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
    const sessionKey = this.resolveSessionKey(sessionId);
    this.sessionKeyMap.set(sessionId, sessionKey);
    return this.gateway.sendPrompt(sessionKey, message);
  }

  async abortSession(sessionId: string, runId?: string): Promise<void> {
    const sessionKey = this.resolveSessionKey(sessionId);
    this.sessionKeyMap.set(sessionId, sessionKey);
    await this.gateway.abortSession(sessionKey, runId);
  }

  async resetSession(sessionId: string): Promise<{ runId: string }> {
    const sessionKey = this.resolveSessionKey(sessionId);
    this.sessionKeyMap.set(sessionId, sessionKey);
    return this.gateway.sendPrompt(sessionKey, '/reset');
  }

  private resolveSessionKey(sessionId: string): string {
    const explicit = this.sessionKeyMap.get(sessionId);
    if (explicit) {
      console.log(`[session] resolved key via map: ${sessionId} → ${explicit}`);
      return explicit;
    }

    const session = this.watcher.getSessions().get(sessionId);
    if (session?.sessionAlias) {
      console.log(`[session] resolved key via alias: ${sessionId} → ${session.sessionAlias}`);
      return session.sessionAlias;
    }

    console.warn(`[session] no alias found for ${sessionId}, using sessionId as key`);
    return sessionId;
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
    const providerFromKey = this.extractProviderFromAlias(session.sessionAlias);
    const provider = providerFromKey ?? session.origin?.provider?.toLowerCase();

    if (!provider) return 'main-hall';

    switch (provider) {
      case 'slack':
        return 'slack-room';
      case 'discord':
        return 'discord-room';
      case 'telegram':
        return 'telegram-room';
      case 'whatsapp':
        return 'whatsapp-room';
      case 'webchat':
        return 'main-hall';
      default:
        return 'main-hall';
    }
  }

  private extractProviderFromAlias(alias: string | null): string | null {
    if (!alias) return null;
    const match = alias.match(/^agent:[^:]+:(slack|discord|telegram|whatsapp):/i);
    return match ? match[1].toLowerCase() : null;
  }

  private enrichSession(session: SessionData): SessionWithRoom {
    return {
      ...session,
      room: this.mapSessionToRoom(session),
    };
  }

  private updateChannelConnectivity(): void {
    const providers = new Set<string>();
    for (const session of this.watcher.getSessions().values()) {
      const provider = session.origin?.provider?.toLowerCase();
      if (provider && provider !== 'webchat') {
        providers.add(provider);
      }
    }
    this.channels.updateConnectedProviders(providers);
  }

  private bindWatcherEvents(): void {
    this.watcher.on('session:added', (session: SessionData) => {
      this.emit('session:added', this.enrichSession(session));
      this.updateChannelConnectivity();
    });

    this.watcher.on('session:updated', (session: SessionData) => {
      this.emit('session:updated', this.enrichSession(session));
      this.updateChannelConnectivity();
    });

    this.watcher.on('session:removed', (sessionId: string) => {
      this.sessionKeyMap.delete(sessionId);
      this.emit('session:removed', sessionId);
      this.updateChannelConnectivity();
    });
  }

  private bindChannelEvents(): void {
    this.channels.on('channels:updated', (channels: ChannelInfo[]) => {
      this.emit('channels:updated', channels);
    });
  }

  private resolveSessionIdFromKey(sessionKey: string): string | undefined {
    for (const [sid, key] of this.sessionKeyMap) {
      if (key === sessionKey) return sid;
    }
    for (const [sid, session] of this.watcher.getSessions()) {
      if (session.sessionAlias === sessionKey) return sid;
    }
    return undefined;
  }

  private extractTextFromMessage(msg: unknown): string {
    if (!msg || typeof msg !== 'object') return '';
    const m = msg as Record<string, unknown>;
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.content)) {
      return m.content
        .filter((block: unknown) => {
          const b = block as Record<string, unknown>;
          return b?.type === 'text' && typeof b.text === 'string';
        })
        .map((block: unknown) => (block as Record<string, unknown>).text as string)
        .join('');
    }
    return '';
  }

  isGatewayConnected(): boolean {
    return this.gateway.isConnected();
  }

  private bindGatewayEvents(): void {
    this.gateway.on('disconnected', () => {
      this.emit('gateway:status', false);
    });

    this.gateway.on('reconnected', () => {
      this.emit('gateway:status', true);
    });

    this.gateway.on('authenticated', () => {
      this.emit('gateway:status', true);
    });

    this.gateway.on('chat:event', (data: Record<string, unknown>) => {
      const sessionKey = data.sessionKey as string | undefined;
      const sessionId = sessionKey
        ? this.resolveSessionIdFromKey(sessionKey)
        : undefined;

      const resolvedSessionId = sessionId ?? data.sessionId as string | undefined;
      if (!resolvedSessionId) {
        console.warn(`[session] chat event with unresolved sessionKey=${sessionKey}`);
        return;
      }

      const state = data.state as string | undefined;
      const rawMessage = data.message as Record<string, unknown> | undefined;

      if (state === 'error') {
        const errorMsg = data.errorMessage as string | undefined;
        console.warn(`[session] chat error for ${resolvedSessionId}: ${errorMsg}`);
        const message: ChatMessage = {
          role: 'assistant',
          content: errorMsg ? `Error: ${errorMsg}` : 'An error occurred.',
          timestamp: Date.now(),
        };
        this.emit('chat:event', {
          sessionId: resolvedSessionId,
          message,
          state: 'final',
          runId: data.runId,
        });
        return;
      }

      if (!rawMessage) return;

      const text = this.extractTextFromMessage(rawMessage);
      if (!text && state === 'delta') return;

      const message: ChatMessage = {
        role: 'assistant',
        content: text,
        timestamp: Date.now(),
      };

      this.emit('chat:event', {
        sessionId: resolvedSessionId,
        message,
        state: state ?? 'delta',
        runId: data.runId,
      });
    });
  }
}
