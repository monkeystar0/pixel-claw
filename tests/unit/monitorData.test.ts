import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionWatcher } from '../../src/openclaw/sessionWatcher.js';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Config } from '../../src/config.js';

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

describe('Monitor Data - Token Usage', () => {
  let tmpDir: string;
  let sessionsDir: string;
  let config: Config;
  let watcher: SessionWatcher;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'pixel-claw-monitor-test-'));
    sessionsDir = join(tmpDir, 'agents', 'main', 'sessions');
    mkdirSync(sessionsDir, { recursive: true });
    config = makeConfig(sessionsDir);
  });

  afterEach(() => {
    if (watcher) watcher.stop();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should extract token usage from sessions.json', async () => {
    const sessionId = 'token-session-001';
    writeFileSync(join(sessionsDir, `${sessionId}.jsonl`), makeSampleJsonl(sessionId));

    const sessionsJsonData = {
      [`agent:main:${sessionId}`]: {
        sessionId,
        updatedAt: Date.now(),
        inputTokens: 15000,
        outputTokens: 3000,
        totalTokens: 18000,
        contextTokens: 1048576,
        cacheRead: 12000,
        cacheWrite: 500,
        model: 'gemini-2.5-pro',
        modelProvider: 'google',
      },
    };
    writeFileSync(config.sessionsJsonPath, JSON.stringify(sessionsJsonData));

    watcher = new SessionWatcher(config);
    await watcher.start();
    await new Promise(r => setTimeout(r, 500));

    const session = watcher.getSessions().get(sessionId);
    expect(session).toBeDefined();
    expect(session!.tokenUsage).not.toBeNull();
    expect(session!.tokenUsage!.inputTokens).toBe(15000);
    expect(session!.tokenUsage!.outputTokens).toBe(3000);
    expect(session!.tokenUsage!.totalTokens).toBe(18000);
    expect(session!.tokenUsage!.contextTokens).toBe(1048576);
    expect(session!.tokenUsage!.cacheRead).toBe(12000);
    expect(session!.tokenUsage!.cacheWrite).toBe(500);
  });

  it('should extract model information from sessions.json', async () => {
    const sessionId = 'model-session-002';
    writeFileSync(join(sessionsDir, `${sessionId}.jsonl`), makeSampleJsonl(sessionId));

    const sessionsJsonData = {
      [`agent:main:${sessionId}`]: {
        sessionId,
        updatedAt: Date.now(),
        model: 'gemini-2.5-pro',
        modelProvider: 'google',
        totalTokens: 5000,
      },
    };
    writeFileSync(config.sessionsJsonPath, JSON.stringify(sessionsJsonData));

    watcher = new SessionWatcher(config);
    await watcher.start();
    await new Promise(r => setTimeout(r, 500));

    const session = watcher.getSessions().get(sessionId);
    expect(session).toBeDefined();
    expect(session!.model).toBe('google/gemini-2.5-pro');
  });

  it('should extract updatedAt from sessions.json', async () => {
    const sessionId = 'updated-session-003';
    writeFileSync(join(sessionsDir, `${sessionId}.jsonl`), makeSampleJsonl(sessionId));

    const updatedAt = Date.now() - 30000;
    const sessionsJsonData = {
      [`agent:main:${sessionId}`]: {
        sessionId,
        updatedAt,
      },
    };
    writeFileSync(config.sessionsJsonPath, JSON.stringify(sessionsJsonData));

    watcher = new SessionWatcher(config);
    await watcher.start();
    await new Promise(r => setTimeout(r, 500));

    const session = watcher.getSessions().get(sessionId);
    expect(session).toBeDefined();
    expect(session!.updatedAt).toBe(updatedAt);
  });

  it('should default to null tokenUsage when sessions.json has no token fields', async () => {
    const sessionId = 'notoken-session-004';
    writeFileSync(join(sessionsDir, `${sessionId}.jsonl`), makeSampleJsonl(sessionId));

    const sessionsJsonData = {
      [`agent:main:${sessionId}`]: {
        sessionId,
        updatedAt: Date.now(),
      },
    };
    writeFileSync(config.sessionsJsonPath, JSON.stringify(sessionsJsonData));

    watcher = new SessionWatcher(config);
    await watcher.start();
    await new Promise(r => setTimeout(r, 500));

    const session = watcher.getSessions().get(sessionId);
    expect(session).toBeDefined();
    expect(session!.tokenUsage).toBeNull();
  });

  it('should update token usage on poll', async () => {
    const sessionId = 'poll-token-005';
    writeFileSync(join(sessionsDir, `${sessionId}.jsonl`), makeSampleJsonl(sessionId));

    const sessionsJsonData = {
      [`agent:main:${sessionId}`]: {
        sessionId,
        updatedAt: Date.now(),
        totalTokens: 1000,
        inputTokens: 800,
        outputTokens: 200,
        contextTokens: 100000,
        cacheRead: 0,
        cacheWrite: 0,
      },
    };
    writeFileSync(config.sessionsJsonPath, JSON.stringify(sessionsJsonData));

    watcher = new SessionWatcher(config);
    await watcher.start();
    await new Promise(r => setTimeout(r, 500));

    let session = watcher.getSessions().get(sessionId);
    expect(session!.tokenUsage!.totalTokens).toBe(1000);

    sessionsJsonData[`agent:main:${sessionId}`].totalTokens = 5000;
    sessionsJsonData[`agent:main:${sessionId}`].inputTokens = 4000;
    sessionsJsonData[`agent:main:${sessionId}`].outputTokens = 1000;
    sessionsJsonData[`agent:main:${sessionId}`].updatedAt = Date.now();
    writeFileSync(config.sessionsJsonPath, JSON.stringify(sessionsJsonData));

    await new Promise(r => setTimeout(r, 500));

    session = watcher.getSessions().get(sessionId);
    expect(session!.tokenUsage!.totalTokens).toBe(5000);
    expect(session!.tokenUsage!.inputTokens).toBe(4000);
  });
});
