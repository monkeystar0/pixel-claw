import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { SessionManager } from '../../src/services/sessionManager.js';
import type { SessionData, ChannelInfo, ChatMessage } from '../../src/openclaw/types.js';

function makeMockWatcher() {
  const emitter = new EventEmitter();
  const sessions = new Map<string, SessionData>();
  return Object.assign(emitter, {
    start: vi.fn(async () => {}),
    stop: vi.fn(),
    getSessions: vi.fn(() => sessions),
    setShowAll: vi.fn(),
    _sessions: sessions,
  });
}

function makeMockChannelRegistry() {
  const emitter = new EventEmitter();
  let channels: ChannelInfo[] = [];
  return Object.assign(emitter, {
    start: vi.fn(async () => {}),
    stop: vi.fn(),
    getChannels: vi.fn(() => channels),
    updateConnectedProviders: vi.fn(),
    _setChannels: (c: ChannelInfo[]) => { channels = c; },
  });
}

function makeMockGateway() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    isConnected: vi.fn(() => true),
    sendPrompt: vi.fn(async () => ({ runId: 'run-123' })),
    abortSession: vi.fn(async () => undefined),
  });
}

function makeSampleSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    sessionId: 'session-001',
    sessionAlias: null,
    label: 'Test session',
    status: 'running',
    elapsed: 120,
    currentTool: 'Read',
    currentToolArgs: '"main.ts"',
    toolCount: 5,
    recentTools: ['Read', 'Write', 'Bash'],
    errorDetails: null,
    filePath: '/tmp/session-001.jsonl',
    startTime: Date.now() - 120_000,
    origin: null,
    ...overrides,
  };
}

describe('SessionManager', () => {
  let watcher: ReturnType<typeof makeMockWatcher>;
  let channels: ReturnType<typeof makeMockChannelRegistry>;
  let gateway: ReturnType<typeof makeMockGateway>;
  let manager: SessionManager;

  beforeEach(() => {
    watcher = makeMockWatcher();
    channels = makeMockChannelRegistry();
    gateway = makeMockGateway();
    manager = new SessionManager(
      watcher as never,
      channels as never,
      gateway as never,
    );
  });

  it('should initialize and start all sub-services', async () => {
    await manager.start();
    expect(watcher.start).toHaveBeenCalled();
    expect(channels.start).toHaveBeenCalled();
    expect(gateway.connect).toHaveBeenCalled();
  });

  it('should stop all sub-services', async () => {
    await manager.start();
    manager.stop();
    expect(watcher.stop).toHaveBeenCalled();
    expect(channels.stop).toHaveBeenCalled();
    expect(gateway.disconnect).toHaveBeenCalled();
  });

  it('should return sessions from watcher', async () => {
    const session = makeSampleSession();
    watcher._sessions.set(session.sessionId, session);
    await manager.start();

    const sessions = manager.getSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe('session-001');
  });

  it('should return channels from registry', async () => {
    const channel: ChannelInfo = {
      id: 'slack',
      name: 'Slack',
      type: 'slack',
      enabled: true,
      connected: false,
      subChannels: 2,
    };
    channels._setChannels([channel]);
    await manager.start();

    const result = manager.getChannels();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Slack');
  });

  it('should forward session:added from watcher', async () => {
    await manager.start();

    const eventPromise = new Promise<SessionData>((resolve) => {
      manager.once('session:added', resolve);
    });

    const session = makeSampleSession();
    watcher.emit('session:added', session);

    const received = await eventPromise;
    expect(received.sessionId).toBe('session-001');
    expect(received).toHaveProperty('room');
  });

  it('should forward session:updated from watcher', async () => {
    await manager.start();

    const eventPromise = new Promise<SessionData>((resolve) => {
      manager.once('session:updated', resolve);
    });

    const session = makeSampleSession({ status: 'complete' });
    watcher.emit('session:updated', session);

    const received = await eventPromise;
    expect(received.status).toBe('complete');
  });

  it('should forward session:removed from watcher', async () => {
    await manager.start();

    const eventPromise = new Promise<string>((resolve) => {
      manager.once('session:removed', resolve);
    });

    watcher.emit('session:removed', 'session-001');

    const removedId = await eventPromise;
    expect(removedId).toBe('session-001');
  });

  it('should map sessions to rooms based on origin', () => {
    expect(manager.mapSessionToRoom(makeSampleSession())).toBe('main-hall');

    expect(manager.mapSessionToRoom(makeSampleSession({
      origin: { provider: 'slack', surface: 'slack', from: null, label: '#general' },
    }))).toBe('slack-room');

    expect(manager.mapSessionToRoom(makeSampleSession({
      origin: { provider: 'discord', surface: 'discord', from: null, label: '#lobby' },
    }))).toBe('discord-room');

    expect(manager.mapSessionToRoom(makeSampleSession({
      origin: { provider: 'webchat', surface: 'webchat', from: null, label: null },
    }))).toBe('main-hall');
  });

  it('should route sendPrompt to gateway with registered key', async () => {
    await manager.start();
    manager.registerSessionKey('session-001', 'agent:main:test');

    const result = await manager.sendPrompt('session-001', 'Hello agent');
    expect(gateway.sendPrompt).toHaveBeenCalledWith('agent:main:test', 'Hello agent');
    expect(result.runId).toBe('run-123');
  });

  it('should resolve sessionKey via sessionAlias when no explicit key registered', async () => {
    const session = makeSampleSession({ sessionAlias: 'global' });
    watcher._sessions.set(session.sessionId, session);
    await manager.start();

    const result = await manager.sendPrompt('session-001', 'Hello agent');
    expect(gateway.sendPrompt).toHaveBeenCalledWith('global', 'Hello agent');
    expect(result.runId).toBe('run-123');
  });

  it('should fallback to sessionId as sessionKey when no key or alias exists', async () => {
    const session = makeSampleSession({ sessionAlias: null });
    watcher._sessions.set(session.sessionId, session);
    await manager.start();

    const result = await manager.sendPrompt('session-001', 'Hello agent');
    expect(gateway.sendPrompt).toHaveBeenCalledWith('session-001', 'Hello agent');
    expect(result.runId).toBe('run-123');
  });

  it('should route abortSession to gateway', async () => {
    await manager.start();
    manager.registerSessionKey('session-001', 'agent:main:test');

    await manager.abortSession('session-001');
    expect(gateway.abortSession).toHaveBeenCalledWith('agent:main:test', undefined);
  });

  it('should fallback to sessionId for abortSession when no key registered', async () => {
    await manager.start();

    await manager.abortSession('session-001');
    expect(gateway.abortSession).toHaveBeenCalledWith('session-001', undefined);
  });

  it('should route resetSession to gateway via sendPrompt with /reset', async () => {
    await manager.start();
    manager.registerSessionKey('session-001', 'agent:main:test');

    const result = await manager.resetSession('session-001');
    expect(gateway.sendPrompt).toHaveBeenCalledWith('agent:main:test', '/reset');
    expect(result.runId).toBe('run-123');
  });

  it('should resolve resetSession key via sessionAlias', async () => {
    const session = makeSampleSession({ sessionAlias: 'global' });
    watcher._sessions.set(session.sessionId, session);
    await manager.start();

    await manager.resetSession('session-001');
    expect(gateway.sendPrompt).toHaveBeenCalledWith('global', '/reset');
  });

  it('should forward channels:updated from registry', async () => {
    await manager.start();

    const eventPromise = new Promise<ChannelInfo[]>((resolve) => {
      manager.once('channels:updated', resolve);
    });

    const newChannels: ChannelInfo[] = [
      { id: 'slack', name: 'Slack', type: 'slack', enabled: true, connected: false, subChannels: 1 },
    ];
    channels.emit('channels:updated', newChannels);

    const received = await eventPromise;
    expect(received).toHaveLength(1);
  });

  it('should forward chat:event from gateway with sessionId resolved via key map', async () => {
    await manager.start();
    manager.registerSessionKey('session-001', 'agent:main:main');

    const eventPromise = new Promise<Record<string, unknown>>((resolve) => {
      manager.once('chat:event', resolve);
    });

    gateway.emit('chat:event', {
      sessionKey: 'agent:main:main',
      runId: 'run-1',
      state: 'delta',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Working...' }],
        timestamp: Date.now(),
      },
    });

    const received = await eventPromise;
    expect(received.sessionId).toBe('session-001');
    expect(received.state).toBe('delta');
    expect((received.message as ChatMessage).role).toBe('assistant');
    expect((received.message as ChatMessage).content).toBe('Working...');
  });

  it('should forward chat:event resolved via sessionAlias', async () => {
    const session = makeSampleSession({ sessionAlias: 'global' });
    watcher._sessions.set(session.sessionId, session);
    await manager.start();

    const eventPromise = new Promise<Record<string, unknown>>((resolve) => {
      manager.once('chat:event', resolve);
    });

    gateway.emit('chat:event', {
      sessionKey: 'global',
      runId: 'run-2',
      state: 'final',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Done!' }],
        timestamp: Date.now(),
      },
    });

    const received = await eventPromise;
    expect(received.sessionId).toBe('session-001');
    expect(received.state).toBe('final');
    expect((received.message as ChatMessage).content).toBe('Done!');
  });

  it('should forward chat:event with fallback sessionId when no key mapping found', async () => {
    await manager.start();

    const eventPromise = new Promise<Record<string, unknown>>((resolve) => {
      manager.once('chat:event', resolve);
    });

    gateway.emit('chat:event', {
      sessionKey: 'unknown-key',
      sessionId: 'fallback-id',
      runId: 'run-3',
      state: 'final',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello' }],
        timestamp: Date.now(),
      },
    });

    const received = await eventPromise;
    expect(received.sessionId).toBe('fallback-id');
  });

  it('should handle chat:event with error state', async () => {
    const session = makeSampleSession({ sessionAlias: 'global' });
    watcher._sessions.set(session.sessionId, session);
    await manager.start();

    const eventPromise = new Promise<Record<string, unknown>>((resolve) => {
      manager.once('chat:event', resolve);
    });

    gateway.emit('chat:event', {
      sessionKey: 'global',
      runId: 'run-4',
      state: 'error',
      errorMessage: 'Agent crashed',
    });

    const received = await eventPromise;
    expect(received.sessionId).toBe('session-001');
    expect(received.state).toBe('final');
    expect((received.message as ChatMessage).content).toContain('Agent crashed');
  });
});
