import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChannelRegistry } from '../../src/openclaw/channelRegistry.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ChannelInfo } from '../../src/openclaw/types.js';

describe('ChannelRegistry', () => {
  let tmpDir: string;
  let configPath: string;
  let registry: ChannelRegistry;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'pixel-claw-channel-test-'));
    configPath = join(tmpDir, 'openclaw.json');
  });

  afterEach(() => {
    if (registry) {
      registry.stop();
    }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should read channels from config file', async () => {
    const config = {
      channels: {
        slack: {
          enabled: true,
          mode: 'socket',
          channels: {
            '#general': { enabled: true, allow: true },
            '#dev-ops': { enabled: false, allow: true },
          },
        },
        discord: {
          enabled: false,
          channels: { '#main': { enabled: true, allow: true } },
        },
      },
    };
    writeFileSync(configPath, JSON.stringify(config));

    registry = new ChannelRegistry(configPath);
    await registry.start();

    const channels = registry.getChannels();
    expect(channels.length).toBe(2);

    const slack = channels.find(c => c.type === 'slack');
    expect(slack).toBeDefined();
    expect(slack!.name).toBe('Slack');
    expect(slack!.enabled).toBe(true);
    expect(slack!.subChannels).toBe(1);

    const discord = channels.find(c => c.type === 'discord');
    expect(discord).toBeDefined();
    expect(discord!.name).toBe('Discord');
    expect(discord!.enabled).toBe(false);
    expect(discord!.subChannels).toBe(1);
  });

  it('should include channel type even without sub-channels', async () => {
    const config = {
      channels: {
        telegram: { enabled: true, channels: {} },
      },
    };
    writeFileSync(configPath, JSON.stringify(config));

    registry = new ChannelRegistry(configPath);
    await registry.start();

    const channels = registry.getChannels();
    expect(channels.length).toBe(1);
    expect(channels[0].type).toBe('telegram');
    expect(channels[0].name).toBe('Telegram');
    expect(channels[0].enabled).toBe(true);
    expect(channels[0].subChannels).toBe(0);
  });

  it('should handle missing config file gracefully', async () => {
    registry = new ChannelRegistry(join(tmpDir, 'nonexistent.json'));
    await registry.start();

    expect(registry.getChannels()).toEqual([]);
  });

  it('should handle malformed config gracefully', async () => {
    writeFileSync(configPath, '{invalid json');

    registry = new ChannelRegistry(configPath);
    await registry.start();

    expect(registry.getChannels()).toEqual([]);
  });

  it('should emit channels:updated when config changes', async () => {
    const config = {
      channels: { slack: { enabled: true, channels: { '#general': { enabled: true } } } },
    };
    writeFileSync(configPath, JSON.stringify(config));

    registry = new ChannelRegistry(configPath);
    await registry.start();
    expect(registry.getChannels().length).toBe(1);

    // Allow chokidar to initialize its watcher
    await new Promise(r => setTimeout(r, 500));

    const updatedPromise = new Promise<ChannelInfo[]>((resolve) => {
      registry.once('channels:updated', (channels: ChannelInfo[]) => resolve(channels));
    });

    const newConfig = {
      channels: {
        slack: { enabled: true, channels: { '#general': { enabled: true }, '#random': { enabled: true } } },
        discord: { enabled: true, channels: { '#lobby': { enabled: true } } },
      },
    };
    writeFileSync(configPath, JSON.stringify(newConfig));

    const channels = await updatedPromise;
    expect(channels.length).toBe(2);
    expect(channels.find(c => c.type === 'slack')?.subChannels).toBe(2);
    expect(channels.find(c => c.type === 'discord')?.subChannels).toBe(1);
  }, 10_000);

  it('should handle config with no channels section', async () => {
    writeFileSync(configPath, JSON.stringify({ agents: {} }));

    registry = new ChannelRegistry(configPath);
    await registry.start();

    expect(registry.getChannels()).toEqual([]);
  });
});
