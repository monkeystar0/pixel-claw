import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const REQUEST_TIMEOUT_MS = 30_000;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class GatewayClient extends EventEmitter {
  private gatewayUrl: string;
  private ws: WebSocket | null = null;
  private connected = false;
  private reconnecting = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private shouldReconnect = false;

  constructor(gatewayUrl: string) {
    super();
    this.gatewayUrl = gatewayUrl;
  }

  async connect(): Promise<void> {
    this.shouldReconnect = true;
    return this.doConnect();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();

    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Client disconnected'));
      this.pendingRequests.delete(id);
    }

    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }

    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async sendPrompt(sessionKey: string, message: string): Promise<{ runId: string }> {
    return this.request<{ runId: string }>('chat.send', {
      sessionKey,
      message,
      idempotencyKey: randomUUID(),
    });
  }

  async abortSession(sessionKey: string, runId?: string): Promise<void> {
    await this.request('chat.abort', { sessionKey, runId });
  }

  private doConnect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.gatewayUrl);
      } catch (err) {
        this.connected = false;
        reject(err);
        return;
      }

      const onOpen = () => {
        this.connected = true;
        this.reconnectAttempt = 0;
        cleanup();
        resolve();
      };

      const onError = (err: Error) => {
        cleanup();
        this.connected = false;
        if (this.ws) {
          this.ws.removeAllListeners();
          this.ws = null;
        }
        reject(err);
      };

      const onClose = () => {
        cleanup();
        this.connected = false;
        if (this.ws) {
          this.ws.removeAllListeners();
          this.ws = null;
        }
        reject(new Error('WebSocket closed before open'));
      };

      const cleanup = () => {
        this.ws?.removeListener('open', onOpen);
        this.ws?.removeListener('error', onError);
        this.ws?.removeListener('close', onClose);
        if (this.ws) {
          this.setupListeners(this.ws);
        }
      };

      this.ws.on('open', onOpen);
      this.ws.on('error', onError);
      this.ws.on('close', onClose);
    });
  }

  private setupListeners(ws: WebSocket): void {
    ws.on('message', (raw: Buffer) => {
      this.handleMessage(raw.toString());
    });

    ws.on('close', () => {
      this.connected = false;
      this.rejectPendingRequests('Connection closed');
      this.emit('disconnected');
      this.scheduleReconnect();
    });

    ws.on('error', (err: Error) => {
      this.emit('error', err);
    });
  }

  private handleMessage(raw: string): void {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    if (data.id && typeof data.id === 'string' && this.pendingRequests.has(data.id)) {
      const pending = this.pendingRequests.get(data.id)!;
      this.pendingRequests.delete(data.id);
      clearTimeout(pending.timer);

      if (data.error) {
        pending.reject(new Error(
          typeof data.error === 'object' && data.error !== null
            ? (data.error as Record<string, unknown>).message as string ?? 'Request failed'
            : 'Request failed'
        ));
      } else {
        pending.resolve(data.result);
      }
      return;
    }

    if (data.method === 'chat.event' && data.params) {
      this.emit('chat:event', data.params);
      return;
    }

    if (data.method) {
      this.emit('gateway:message', data);
    }
  }

  private request<T>(method: string, params: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to gateway'));
        return;
      }

      const id = randomUUID();
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });

      const message = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      });

      this.ws.send(message);
    });
  }

  private rejectPendingRequests(reason: string): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnecting) return;

    this.reconnecting = true;
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt),
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempt++;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnecting = false;
      try {
        await this.doConnect();
        this.emit('reconnected');
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnecting = false;
  }
}
