import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use default values when no env vars set', async () => {
    delete process.env.OPENCLAW_DIR;
    delete process.env.PORT;
    const { loadConfig } = await import('../../src/config.js');
    const config = loadConfig();
    expect(config.openclawAgent).toBe('main');
    expect(config.port).toBe(3000);
    expect(config.pollInterval).toBe(500);
    expect(config.openclawDir).toContain('.openclaw');
  });

  it('should override defaults with env vars', async () => {
    process.env.OPENCLAW_DIR = '/custom/path';
    process.env.OPENCLAW_AGENT = 'secondary';
    process.env.OPENCLAW_GATEWAY_URL = 'ws://remote:9999';
    process.env.PORT = '8080';
    process.env.POLL_INTERVAL = '1000';
    const { loadConfig } = await import('../../src/config.js');
    const config = loadConfig();
    expect(config.openclawDir).toBe('/custom/path');
    expect(config.openclawAgent).toBe('secondary');
    expect(config.gatewayUrl).toBe('ws://remote:9999');
    expect(config.port).toBe(8080);
    expect(config.pollInterval).toBe(1000);
  });

  it('should resolve sessionsDir from openclawDir and agent', async () => {
    process.env.OPENCLAW_DIR = '/test/openclaw';
    process.env.OPENCLAW_AGENT = 'main';
    const { loadConfig } = await import('../../src/config.js');
    const config = loadConfig();
    expect(config.sessionsDir).toBe('/test/openclaw/agents/main/sessions');
    expect(config.sessionsJsonPath).toBe('/test/openclaw/agents/main/sessions/sessions.json');
  });
});
