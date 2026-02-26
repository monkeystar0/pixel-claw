import { EventEmitter } from 'node:events';
import type { SessionWatcher } from '../openclaw/sessionWatcher.js';
import type { ChannelRegistry } from '../openclaw/channelRegistry.js';
import type { GatewayClient } from '../openclaw/gatewayClient.js';
import type { SessionData, ChannelInfo, ChatMessage } from '../openclaw/types.js';
import { getRecentMessages } from '../openclaw/sessionParser.js';

interface SessionWithRoom extends SessionData {
  room: string;
}

export class SessionManager extends EventEmitter {
  private watcher: SessionWatcher;
  private channels: ChannelRegistry;
  private gateway: GatewayClient;
  private sessionKeyMap: Map<string, string> = new Map();

  constructor(watcher: SessionWatcher, channels: ChannelRegistry, gateway: GatewayClient) {
    super();
    this.watcher = watcher;
    this.channels = channels;
    this.gateway = gateway;
  }

  async start(): Promise<void> {
    this.bindWatcherEvents();
    this.bindChannelEvents();
    this.bindGatewayEvents();

    await Promise.all([
      this.watcher.start(),
      this.channels.start(),
      this.gateway.connect().catch(() => {
        // Gateway may not be available at startup; reconnection handles it
      }),
    ]);
  }

  stop(): void {
    this.watcher.stop();
    this.channels.stop();
    this.gateway.disconnect();
    this.removeAllListeners();
  }

  getSessions(): SessionWithRoom[] {
    const sessions = this.watcher.getSessions();
    return Array.from(sessions.values()).map(s => this.enrichSession(s));
  }

  getChannels(): ChannelInfo[] {
    return this.channels.getChannels();
  }

  async sendPrompt(sessionId: string, message: string): Promise<{ runId: string }> {
    const sessionKey = this.sessionKeyMap.get(sessionId);
    if (!sessionKey) {
      throw new Error(`No session key found for session ${sessionId}`);
    }
    return this.gateway.sendPrompt(sessionKey, message);
  }

  async abortSession(sessionId: string, runId?: string): Promise<void> {
    const sessionKey = this.sessionKeyMap.get(sessionId);
    if (!sessionKey) {
      throw new Error(`No session key found for session ${sessionId}`);
    }
    await this.gateway.abortSession(sessionKey, runId);
  }

  async getHistory(sessionId: string, limit: number): Promise<ChatMessage[]> {
    const sessions = this.watcher.getSessions();
    const session = sessions.get(sessionId);
    if (!session) return [];
    return getRecentMessages(session.filePath, limit);
  }

  registerSessionKey(sessionId: string, sessionKey: string): void {
    this.sessionKeyMap.set(sessionId, sessionKey);
  }

  mapSessionToRoom(session: SessionData): string {
    if (!session.origin?.provider) return 'main-hall';

    const provider = session.origin.provider.toLowerCase();
    switch (provider) {
      case 'slack':
        return 'slack';
      case 'discord':
        return 'discord';
      case 'telegram':
        return 'telegram';
      case 'whatsapp':
        return 'whatsapp';
      case 'webchat':
        return 'main-hall';
      default:
        return 'main-hall';
    }
  }

  private enrichSession(session: SessionData): SessionWithRoom {
    return {
      ...session,
      room: this.mapSessionToRoom(session),
    };
  }

  private bindWatcherEvents(): void {
    this.watcher.on('session:added', (session: SessionData) => {
      this.emit('session:added', this.enrichSession(session));
    });

    this.watcher.on('session:updated', (session: SessionData) => {
      this.emit('session:updated', this.enrichSession(session));
    });

    this.watcher.on('session:removed', (sessionId: string) => {
      this.sessionKeyMap.delete(sessionId);
      this.emit('session:removed', sessionId);
    });
  }

  private bindChannelEvents(): void {
    this.channels.on('channels:updated', (channels: ChannelInfo[]) => {
      this.emit('channels:updated', channels);
    });
  }

  private bindGatewayEvents(): void {
    this.gateway.on('chat:event', (data: Record<string, unknown>) => {
      this.emit('chat:event', data);
    });
  }
}
