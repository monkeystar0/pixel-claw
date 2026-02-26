import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionWatcher } from '../../src/openclaw/sessionWatcher.js';
import { mkdtempSync, writeFileSync, mkdirSync, unlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Config } from '../../src/config.js';
import type { SessionData } from '../../src/openclaw/types.js';

function makeConfig(sessionsDir: string): Config {
  return {
    openclawDir: join(sessionsDir, '..', '..', '..'),
    openclawAgent: 'main',
    gatewayUrl: 'ws://localhost:3578',
    sessionsDir,
    sessionsJsonPath: join(sessionsDir, 'sessions.json'),
    openclawConfigPath: join(sessionsDir, '..', '..', '..', 'openclaw.json'),
    port: 3000,
    pollInterval: 200,
  };
}

function makeSampleJsonl(sessionId: string): string {
  const lines = [
    JSON.stringify({ type: 'session', version: 3, id: sessionId, timestamp: new Date().toISOString() }),
    JSON.stringify({
      type: 'message', id: 'msg1', timestamp: new Date().toISOString(),
      message: { role: 'user', content: [{ type: 'text', text: 'Hello agent' }] },
    }),
    JSON.stringify({
      type: 'message', id: 'msg2', timestamp: new Date().toISOString(),
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Working on it.' },
          { type: 'toolCall', id: 'read_1', name: 'Read', arguments: { file_path: '/test.ts' } },
        ],
      },
    }),
  ];
  return lines.join('\n') + '\n';
}

function makeSessionsJson(entries: Record<string, unknown>): string {
  return JSON.stringify(entries);
}

describe('SessionWatcher', () => {
  let tmpDir: string;
  let sessionsDir: string;
  let config: Config;
  let watcher: SessionWatcher;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'pixel-claw-test-'));
    sessionsDir = join(tmpDir, 'agents', 'main', 'sessions');
    mkdirSync(sessionsDir, { recursive: true });
    config = makeConfig(sessionsDir);
  });

  afterEach(async () => {
    if (watcher) {
      watcher.stop();
    }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should initialize with empty sessions', () => {
    watcher = new SessionWatcher(config);
    expect(watcher.getSessions().size).toBe(0);
  });

  it('should detect existing JSONL files on start', async () => {
    const sessionId = 'test-session-001';
    writeFileSync(join(sessionsDir, `${sessionId}.jsonl`), makeSampleJsonl(sessionId));

    watcher = new SessionWatcher(config);
    await watcher.start();

    // Give chokidar time to detect files
    await new Promise(r => setTimeout(r, 500));

    const sessions = watcher.getSessions();
    expect(sessions.size).toBe(1);
    expect(sessions.has(sessionId)).toBe(true);
  });

  it('should emit session:added when new JSONL appears', async () => {
    watcher = new SessionWatcher(config);
    await watcher.start();
    await new Promise(r => setTimeout(r, 300));

    const addedPromise = new Promise<SessionData>((resolve) => {
      watcher.once('session:added', (session: SessionData) => resolve(session));
    });

    const sessionId = 'new-session-002';
    writeFileSync(join(sessionsDir, `${sessionId}.jsonl`), makeSampleJsonl(sessionId));

    const session = await addedPromise;
    expect(session.sessionId).toBe(sessionId);
    expect(session.toolCount).toBeGreaterThan(0);
  });

  it('should emit session:updated when JSONL changes', async () => {
    const sessionId = 'update-session-003';
    const filePath = join(sessionsDir, `${sessionId}.jsonl`);
    writeFileSync(filePath, makeSampleJsonl(sessionId));

    watcher = new SessionWatcher(config);
    await watcher.start();
    await new Promise(r => setTimeout(r, 500));

    const updatedPromise = new Promise<SessionData>((resolve) => {
      watcher.once('session:updated', (session: SessionData) => resolve(session));
    });

    const extraLine = JSON.stringify({
      type: 'message', id: 'msg3', timestamp: new Date().toISOString(),
      message: {
        role: 'assistant',
        content: [{ type: 'toolCall', id: 'write_1', name: 'Write', arguments: { file_path: '/out.ts', content: 'done' } }],
      },
    });
    writeFileSync(filePath, makeSampleJsonl(sessionId) + extraLine + '\n');

    const session = await updatedPromise;
    expect(session.sessionId).toBe(sessionId);
    expect(session.toolCount).toBe(2);
  });

  it('should emit session:removed when JSONL deleted', async () => {
    const sessionId = 'remove-session-004';
    const filePath = join(sessionsDir, `${sessionId}.jsonl`);
    writeFileSync(filePath, makeSampleJsonl(sessionId));

    watcher = new SessionWatcher(config);
    await watcher.start();
    await new Promise(r => setTimeout(r, 500));

    const removedPromise = new Promise<string>((resolve) => {
      watcher.once('session:removed', (id: string) => resolve(id));
    });

    unlinkSync(filePath);
    const removedId = await removedPromise;
    expect(removedId).toBe(sessionId);
  });

  it('should apply metadata from sessions.json', async () => {
    const sessionId = 'meta-session-005';
    writeFileSync(join(sessionsDir, `${sessionId}.jsonl`), makeSampleJsonl(sessionId));

    const sessionsJsonData = {
      [`agent:main:subagent:${sessionId}`]: {
        sessionId,
        updatedAt: Date.now(),
        origin: { provider: 'slack', surface: 'slack', label: '#general', from: 'slack:channel:C123' },
      },
    };
    writeFileSync(config.sessionsJsonPath, makeSessionsJson(sessionsJsonData));

    watcher = new SessionWatcher(config);
    await watcher.start();
    await new Promise(r => setTimeout(r, 500));

    const sessions = watcher.getSessions();
    const session = sessions.get(sessionId);
    expect(session).toBeDefined();
    expect(session!.origin?.provider).toBe('slack');
  });

  it('should correctly determine running status from updatedAt', async () => {
    const sessionId = 'status-session-006';
    writeFileSync(join(sessionsDir, `${sessionId}.jsonl`), makeSampleJsonl(sessionId));

    const sessionsJsonData = {
      [`agent:main:subagent:${sessionId}`]: {
        sessionId,
        updatedAt: Date.now(),
      },
    };
    writeFileSync(config.sessionsJsonPath, makeSessionsJson(sessionsJsonData));

    watcher = new SessionWatcher(config);
    await watcher.start();
    await new Promise(r => setTimeout(r, 500));

    const session = watcher.getSessions().get(sessionId);
    expect(session).toBeDefined();
    expect(session!.status).toBe('running');
  });

  it('should stop and cleanup watchers', async () => {
    watcher = new SessionWatcher(config);
    await watcher.start();
    watcher.stop();

    expect(watcher.getSessions().size).toBe(0);
  });
});
