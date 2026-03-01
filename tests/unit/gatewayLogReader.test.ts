import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GatewayLogReader } from '../../src/openclaw/gatewayLogReader.js';

const TMP = join(tmpdir(), 'pixel-claw-log-test-' + Date.now());
const LOG_PATH = join(TMP, 'gateway.log');

const SAMPLE_LINES = [
  '2026-02-27T07:06:52.280Z [canvas] host mounted at http://127.0.0.1:18789',
  '2026-02-27T07:06:52.527Z [gateway] agent model: google/gemini-2.5-pro',
  '2026-02-27T07:06:52.535Z [gateway] listening on ws://127.0.0.1:18789',
  '2026-02-27T07:06:54.130Z [slack] [default] starting provider',
  '2026-02-27T07:06:55.746Z [slack] socket mode connected',
  '2026-02-27T07:13:23.136Z [ws] ⇄ res ✗ chat.send 0ms errorCode=INVALID_REQUEST errorMessage=missing scope',
];

beforeEach(() => {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(LOG_PATH, SAMPLE_LINES.join('\n') + '\n');
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('GatewayLogReader', () => {
  it('should parse existing log entries on start', async () => {
    const reader = new GatewayLogReader(LOG_PATH);
    await reader.start();

    const entries = reader.getEntries();
    expect(entries.length).toBe(6);

    expect(entries[0].category).toBe('canvas');
    expect(entries[0].timestamp).toBe('2026-02-27T07:06:52.280Z');
    expect(entries[0].level).toBe('info');

    expect(entries[5].category).toBe('ws');
    expect(entries[5].level).toBe('error');
    expect(entries[5].message).toContain('chat.send');

    reader.stop();
  });

  it('should return empty array for missing log file', async () => {
    const reader = new GatewayLogReader(join(TMP, 'nonexistent.log'));
    await reader.start();
    expect(reader.getEntries()).toEqual([]);
    reader.stop();
  });

  it('should detect error level from ✗ marker', async () => {
    const reader = new GatewayLogReader(LOG_PATH);
    await reader.start();

    const errorEntries = reader.getEntries().filter(e => e.level === 'error');
    expect(errorEntries.length).toBe(1);
    expect(errorEntries[0].message).toContain('errorCode=INVALID_REQUEST');

    reader.stop();
  });

  it('should cap initial entries to 100', async () => {
    const manyLines: string[] = [];
    for (let i = 0; i < 200; i++) {
      manyLines.push(`2026-02-27T07:00:00.${String(i).padStart(3, '0')}Z [test] line ${i}`);
    }
    writeFileSync(LOG_PATH, manyLines.join('\n') + '\n');

    const reader = new GatewayLogReader(LOG_PATH);
    await reader.start();

    const entries = reader.getEntries();
    expect(entries.length).toBe(100);
    expect(entries[99].message).toBe('line 199');

    reader.stop();
  });

  it('should correctly parse category and message', async () => {
    const reader = new GatewayLogReader(LOG_PATH);
    await reader.start();

    const entries = reader.getEntries();
    const slackEntry = entries.find(e => e.category === 'slack' && e.message.includes('socket mode'));
    expect(slackEntry).toBeDefined();
    expect(slackEntry!.message).toBe('socket mode connected');

    reader.stop();
  });
});
