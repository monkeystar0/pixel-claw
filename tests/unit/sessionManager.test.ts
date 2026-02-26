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
      id: 'slack:#general',
      name: '#general',
      type: 'slack',
      enabled: true,
      connected: false,
    };
    channels._setChannels([channel]);
    await manager.start();

    const result = manager.getChannels();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('#general');
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
    }))).toBe('slack');

    expect(manager.mapSessionToRoom(makeSampleSession({
      origin: { provider: 'discord', surface: 'discord', from: null, label: '#lobby' },
    }))).toBe('discord');

    expect(manager.mapSessionToRoom(makeSampleSession({
      origin: { provider: 'webchat', surface: 'webchat', from: null, label: null },
    }))).toBe('main-hall');
  });

  it('should route sendPrompt to gateway', async () => {
    await manager.start();
    manager.registerSessionKey('session-001', 'agent:main:test');

    const result = await manager.sendPrompt('session-001', 'Hello agent');
    expect(gateway.sendPrompt).toHaveBeenCalledWith('agent:main:test', 'Hello agent');
    expect(result.runId).toBe('run-123');
  });

  it('should route abortSession to gateway', async () => {
    await manager.start();
    manager.registerSessionKey('session-001', 'agent:main:test');

    await manager.abortSession('session-001');
    expect(gateway.abortSession).toHaveBeenCalledWith('agent:main:test', undefined);
  });

  it('should forward channels:updated from registry', async () => {
    await manager.start();

    const eventPromise = new Promise<ChannelInfo[]>((resolve) => {
      manager.once('channels:updated', resolve);
    });

    const newChannels: ChannelInfo[] = [
      { id: 'slack:#dev', name: '#dev', type: 'slack', enabled: true, connected: false },
    ];
    channels.emit('channels:updated', newChannels);

    const received = await eventPromise;
    expect(received).toHaveLength(1);
  });

  it('should forward chat:event from gateway', async () => {
    await manager.start();

    const eventPromise = new Promise<Record<string, unknown>>((resolve) => {
      manager.once('chat:event', resolve);
    });

    gateway.emit('chat:event', { sessionKey: 'agent:main:main', type: 'text', text: 'Working...' });

    const received = await eventPromise;
    expect(received.type).toBe('text');
  });
});
