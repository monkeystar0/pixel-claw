import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { createServer } from '../../src/server/fastify.js';
import type { SessionData, ChannelInfo, ChatMessage } from '../../src/openclaw/types.js';

function makeMockSessionManager() {
  const emitter = new EventEmitter();
  const sessions: (SessionData & { room: string })[] = [
    {
      sessionId: 'integ-001',
      label: 'Integration test session',
      status: 'running' as const,
      elapsed: 60,
      currentTool: 'Read',
      currentToolArgs: '"test.ts"',
      toolCount: 3,
      recentTools: ['Read', 'Write', 'Read'],
      errorDetails: null,
      filePath: '/tmp/integ-001.jsonl',
      startTime: Date.now() - 60_000,
      origin: null,
      room: 'main-hall',
    },
  ];
  const channels: ChannelInfo[] = [
    { id: 'slack:#general', name: '#general', type: 'slack', enabled: true, connected: false },
  ];
  const history: ChatMessage[] = [
    { role: 'user', content: 'Build a test', timestamp: Date.now() - 30_000 },
    { role: 'assistant', content: 'Working on it.', timestamp: Date.now() - 25_000 },
  ];

  return Object.assign(emitter, {
    getSessions: () => sessions,
    getChannels: () => channels,
    getHistory: async (_sid: string, _limit: number) => history,
    sendPrompt: async (_sid: string, _msg: string) => ({ runId: 'run-integ-1' }),
    abortSession: async (_sid: string) => {},
    start: async () => {},
    stop: () => {},
  });
}

function connectAndCollectMessages(port: number): Promise<{ ws: WebSocket; messages: Record<string, unknown>[] }> {
  return new Promise((resolve, reject) => {
    const messages: Record<string, unknown>[] = [];
    const ws = new WebSocket(`ws://localhost:${port}/ws`);

    ws.on('message', (raw) => {
      messages.push(JSON.parse(raw.toString()));
    });
    ws.on('open', () => resolve({ ws, messages }));
    ws.on('error', reject);
  });
}

function waitForMessage(
  messages: Record<string, unknown>[],
  ws: WebSocket,
  type: string,
  timeoutMs = 3000,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const existing = messages.find(m => m.type === type);
    if (existing) {
      resolve(existing);
      return;
    }

    const handler = (raw: Buffer) => {
      const data = JSON.parse(raw.toString());
      if (data.type === type) {
        clearTimeout(timer);
        ws.removeListener('message', handler);
        resolve(data);
      }
    };
    ws.on('message', handler);
    const timer = setTimeout(() => {
      ws.removeListener('message', handler);
      reject(new Error(`Timeout waiting for ${type}`));
    }, timeoutMs);
  });
}

function sendMessage(ws: WebSocket, data: Record<string, unknown>) {
  ws.send(JSON.stringify(data));
}

describe('WebSocket Server Integration', () => {
  const PORT = 19877;
  let server: Awaited<ReturnType<typeof createServer>>;
  let manager: ReturnType<typeof makeMockSessionManager>;

  beforeAll(async () => {
    manager = makeMockSessionManager();
    const config = {
      openclawDir: '/tmp',
      openclawAgent: 'main',
      gatewayUrl: 'ws://localhost:3578',
      sessionsDir: '/tmp/sessions',
      sessionsJsonPath: '/tmp/sessions/sessions.json',
      openclawConfigPath: '/tmp/openclaw.json',
      port: PORT,
      pollInterval: 500,
    };
    server = await createServer(config, manager as never);
    await server.listen({ port: PORT, host: '127.0.0.1' });
  });

  afterAll(async () => {
    await server.close();
  });

  it('should accept WebSocket connections', async () => {
    const { ws } = await connectAndCollectMessages(PORT);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it('should send sessions:sync on connect', async () => {
    const { ws, messages } = await connectAndCollectMessages(PORT);
    await new Promise(r => setTimeout(r, 100));

    const msg = await waitForMessage(messages, ws, 'sessions:sync');
    expect(msg.type).toBe('sessions:sync');
    const sessions = msg.sessions as Array<Record<string, unknown>>;
    expect(sessions.length).toBe(1);
    expect(sessions[0].sessionId).toBe('integ-001');
    ws.close();
  });

  it('should send channels:sync on connect', async () => {
    const { ws, messages } = await connectAndCollectMessages(PORT);
    await new Promise(r => setTimeout(r, 100));

    const msg = await waitForMessage(messages, ws, 'channels:sync');
    expect(msg.type).toBe('channels:sync');
    expect(Array.isArray(msg.channels)).toBe(true);
    ws.close();
  });

  it('should handle session:getHistory request', async () => {
    const { ws, messages } = await connectAndCollectMessages(PORT);
    await new Promise(r => setTimeout(r, 100));

    sendMessage(ws, {
      type: 'session:getHistory',
      sessionId: 'integ-001',
      limit: 20,
    });

    const response = await waitForMessage(messages, ws, 'session:history');
    expect(response.sessionId).toBe('integ-001');
    const chatMessages = response.messages as ChatMessage[];
    expect(chatMessages.length).toBe(2);
    ws.close();
  });

  it('should handle session:sendPrompt request', async () => {
    const { ws, messages } = await connectAndCollectMessages(PORT);
    await new Promise(r => setTimeout(r, 100));

    sendMessage(ws, {
      type: 'session:sendPrompt',
      sessionId: 'integ-001',
      message: 'Hello agent',
    });

    const response = await waitForMessage(messages, ws, 'session:promptAck');
    expect(response.sessionId).toBe('integ-001');
    expect(response.runId).toBe('run-integ-1');
    ws.close();
  });

  it('should broadcast session:updated when manager emits', async () => {
    const { ws, messages } = await connectAndCollectMessages(PORT);
    await new Promise(r => setTimeout(r, 100));

    manager.emit('session:updated', {
      sessionId: 'integ-001',
      label: 'Updated session',
      status: 'complete',
      room: 'main-hall',
    });

    const msg = await waitForMessage(messages, ws, 'session:updated');
    expect(msg.type).toBe('session:updated');
    expect((msg.session as Record<string, unknown>).status).toBe('complete');
    ws.close();
  });

  it('should handle session:abort request', async () => {
    const { ws, messages } = await connectAndCollectMessages(PORT);
    await new Promise(r => setTimeout(r, 100));

    sendMessage(ws, {
      type: 'session:abort',
      sessionId: 'integ-001',
    });

    const response = await waitForMessage(messages, ws, 'session:abortAck');
    expect(response.sessionId).toBe('integ-001');
    expect(response.ok).toBe(true);
    ws.close();
  });
});
