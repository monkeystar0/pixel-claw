import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GatewayClient } from '../../src/openclaw/gatewayClient.js';
import { WebSocketServer, WebSocket as WsWebSocket } from 'ws';
import { randomUUID } from 'node:crypto';

const TEST_TOKEN = 'test-auth-token-12345';

function createMockGatewayServer(port: number): {
  server: WebSocketServer;
  lastMessage: () => Record<string, unknown> | null;
  respond: (data: unknown) => void;
  close: () => Promise<void>;
} {
  let lastMsg: Record<string, unknown> | null = null;
  let activeSocket: WsWebSocket | null = null;

  const server = new WebSocketServer({ port });

  server.on('connection', (socket) => {
    activeSocket = socket;

    const nonce = randomUUID();
    socket.send(JSON.stringify({
      type: 'event',
      event: 'connect.challenge',
      payload: { nonce, ts: Date.now() },
    }));

    socket.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());

        if (data.type === 'req' && data.method === 'connect') {
          if (data.params?.auth?.token === TEST_TOKEN) {
            socket.send(JSON.stringify({
              type: 'res',
              id: data.id,
              ok: true,
              payload: { type: 'hello-ok', protocol: 3, policy: { tickIntervalMs: 15000 } },
            }));
          }
          return;
        }

        lastMsg = data;

        if (data.method === 'hello') {
          socket.send(JSON.stringify({
            jsonrpc: '2.0',
            id: data.id,
            result: { ok: true, protocol: 1 },
          }));
        }
      } catch { /* skip */ }
    });
  });

  return {
    server,
    lastMessage: () => lastMsg,
    respond: (data) => {
      if (activeSocket && activeSocket.readyState === WsWebSocket.OPEN) {
        activeSocket.send(JSON.stringify(data));
      }
    },
    close: () => new Promise<void>((resolve) => {
      server.close(() => resolve());
      for (const client of server.clients) {
        client.terminate();
      }
    }),
  };
}

describe('GatewayClient', () => {
  let mockServer: ReturnType<typeof createMockGatewayServer>;
  let client: GatewayClient;
  const PORT = 19876;

  beforeEach(async () => {
    mockServer = createMockGatewayServer(PORT);
    await new Promise<void>(r => mockServer.server.on('listening', r));
  });

  afterEach(async () => {
    if (client) client.disconnect();
    await mockServer.close();
  });

  async function connectAndAuth(): Promise<void> {
    client = new GatewayClient(`ws://localhost:${PORT}`, TEST_TOKEN);
    await client.connect();
    await new Promise<void>((resolve) => {
      if ((client as unknown as { authenticated: boolean }).authenticated) {
        resolve();
      } else {
        client.once('authenticated', resolve);
      }
    });
  }

  it('should connect to gateway WebSocket', async () => {
    client = new GatewayClient(`ws://localhost:${PORT}`, TEST_TOKEN);
    await client.connect();

    expect(client.isConnected()).toBe(true);
  });

  it('should authenticate via challenge-response', async () => {
    await connectAndAuth();
    expect(client.isConnected()).toBe(true);
  });

  it('should send chat.send with correct params', async () => {
    await connectAndAuth();

    const sessionKey = 'agent:main:main';
    const message = 'Hello agent';

    const sendPromise = client.sendPrompt(sessionKey, message);

    await new Promise(r => setTimeout(r, 100));

    const lastMsg = mockServer.lastMessage();
    expect(lastMsg).not.toBeNull();
    expect(lastMsg!.method).toBe('chat.send');
    expect((lastMsg!.params as Record<string, unknown>).sessionKey).toBe(sessionKey);
    expect((lastMsg!.params as Record<string, unknown>).message).toBe(message);

    mockServer.respond({
      type: 'res',
      id: lastMsg!.id,
      ok: true,
      payload: { runId: 'run-123' },
    });

    const result = await sendPromise;
    expect(result.runId).toBe('run-123');
  });

  it('should send chat.abort with correct params', async () => {
    await connectAndAuth();

    const sessionKey = 'agent:main:main';
    const runId = 'run-456';

    const abortPromise = client.abortSession(sessionKey, runId);

    await new Promise(r => setTimeout(r, 100));

    const lastMsg = mockServer.lastMessage();
    expect(lastMsg!.method).toBe('chat.abort');
    expect((lastMsg!.params as Record<string, unknown>).sessionKey).toBe(sessionKey);
    expect((lastMsg!.params as Record<string, unknown>).runId).toBe(runId);

    mockServer.respond({
      type: 'res',
      id: lastMsg!.id,
      ok: true,
      payload: { aborted: true },
    });

    await abortPromise;
  });

  it('should emit chat:event on unsolicited messages', async () => {
    await connectAndAuth();

    const eventPromise = new Promise<Record<string, unknown>>((resolve) => {
      client.once('chat:event', (data) => resolve(data));
    });

    mockServer.respond({
      type: 'event',
      event: 'chat',
      payload: {
        sessionKey: 'agent:main:main',
        state: 'delta',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Working on it...' }],
        },
      },
    });

    const event = await eventPromise;
    expect(event.state).toBe('delta');
    expect(event.sessionKey).toBe('agent:main:main');
  });

  it('should handle connection errors gracefully', async () => {
    client = new GatewayClient('ws://localhost:1', TEST_TOKEN);
    await expect(client.connect()).rejects.toThrow();
    expect(client.isConnected()).toBe(false);
  });

  it('should disconnect cleanly', async () => {
    await connectAndAuth();
    expect(client.isConnected()).toBe(true);

    client.disconnect();
    expect(client.isConnected()).toBe(false);
  });
});
