import { EventEmitter } from 'node:events';
import { watch, type FSWatcher } from 'chokidar';
import { readFileSync, existsSync } from 'node:fs';
import type { ChannelInfo } from './types.js';

interface ChannelConfigEntry {
  enabled?: boolean;
  allow?: boolean;
}

interface ChannelTypeConfig {
  enabled?: boolean;
  mode?: string;
  channels?: Record<string, ChannelConfigEntry>;
}

interface OpenClawConfig {
  channels?: Record<string, ChannelTypeConfig>;
}

export class ChannelRegistry extends EventEmitter {
  private configPath: string;
  private channels: ChannelInfo[] = [];
  private connectedProviders: Set<string> = new Set();
  private fileWatcher: FSWatcher | null = null;

  constructor(configPath: string) {
    super();
    this.configPath = configPath;
  }

  async start(): Promise<void> {
    this.loadChannels();

    if (existsSync(this.configPath)) {
      this.fileWatcher = watch(this.configPath, {
        persistent: true,
        ignoreInitial: true,
      });

      this.fileWatcher.on('change', () => {
        this.loadChannels();
        this.emit('channels:updated', this.channels);
      });
    }
  }

  stop(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    this.channels = [];
  }

  getChannels(): ChannelInfo[] {
    return [...this.channels];
  }

  updateConnectedProviders(providers: Set<string>): void {
    const changed = providers.size !== this.connectedProviders.size
      || [...providers].some(p => !this.connectedProviders.has(p));

    if (!changed) return

    this.connectedProviders = new Set(providers);
    this.channels = this.channels.map(ch => ({
      ...ch,
      connected: this.connectedProviders.has(ch.type.toLowerCase()),
    }));
    this.emit('channels:updated', this.channels);
  }

  private loadChannels(): void {
    if (!existsSync(this.configPath)) {
      this.channels = [];
      return;
    }

    try {
      const raw = readFileSync(this.configPath, 'utf-8');
      const config: OpenClawConfig = JSON.parse(raw);
      this.channels = this.parseChannels(config);
    } catch {
      this.channels = [];
    }
  }

  private parseChannels(config: OpenClawConfig): ChannelInfo[] {
    const result: ChannelInfo[] = [];

    if (!config.channels) return result;

    for (const [channelType, typeConfig] of Object.entries(config.channels)) {
      const subChannels = typeConfig.channels ?? {};
      const enabledSubCount = Object.values(subChannels)
        .filter(ch => ch.enabled !== false).length;

      result.push({
        id: channelType,
        name: channelType.charAt(0).toUpperCase() + channelType.slice(1),
        type: channelType,
        enabled: typeConfig.enabled ?? false,
        connected: this.connectedProviders.has(channelType.toLowerCase()),
        subChannels: enabledSubCount,
      });
    }

    return result;
  }
}
