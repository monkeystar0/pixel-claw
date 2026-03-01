import { EventEmitter } from 'node:events';
import { randomUUID, sign as cryptoSign, createPrivateKey, createPublicKey } from 'node:crypto';
import WebSocket from 'ws';
import type { DeviceIdentity } from '../config.js';

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function publicKeyRawBase64Url(publicKeyPem: string): string {
  const key = createPublicKey(publicKeyPem);
  const spki = key.export({ type: 'spki', format: 'der' }) as Buffer;
  if (
    spki.length === ED25519_SPKI_PREFIX.length + 32 &&
    spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    return base64UrlEncode(spki.subarray(ED25519_SPKI_PREFIX.length));
  }
  return base64UrlEncode(spki);
}

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
  private authToken: string | null;
  private device: DeviceIdentity | null;
  private ws: WebSocket | null = null;
  private connected = false;
  private authenticated = false;
  private reconnecting = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private shouldReconnect = false;

  constructor(gatewayUrl: string, authToken: string | null = null, device: DeviceIdentity | null = null) {
    super();
    this.gatewayUrl = gatewayUrl;
    this.authToken = authToken;
    this.device = device;
  }

  async connect(): Promise<void> {
    this.shouldReconnect = true;
    try {
      await this.doConnect();
    } catch (err) {
      console.warn(`[gateway] initial connection failed: ${(err as Error).message}`);
      this.scheduleReconnect();
      throw err;
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.authenticated = false;
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

      let settled = false;

      const onOpen = () => {
        settled = true;
        removeSetupListeners();
        this.connected = true;
        this.reconnectAttempt = 0;
        this.setupListeners(this.ws!);
        console.log(`[gateway] connected to ${this.gatewayUrl}`);
        resolve();
      };

      const onError = (err: Error) => {
        if (settled) return;
        settled = true;
        removeSetupListeners();
        this.connected = false;
        if (this.ws) {
          this.ws.removeAllListeners();
          this.ws = null;
        }
        reject(err);
      };

      const onClose = () => {
        if (settled) return;
        settled = true;
        removeSetupListeners();
        this.connected = false;
        if (this.ws) {
          this.ws.removeAllListeners();
          this.ws = null;
        }
        reject(new Error('WebSocket closed before open'));
      };

      const removeSetupListeners = () => {
        this.ws?.removeListener('open', onOpen);
        this.ws?.removeListener('error', onError);
        this.ws?.removeListener('close', onClose);
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

    ws.on('close', (code: number, reason: Buffer) => {
      console.log(`[gateway] disconnected (code=${code}${reason.length ? ' ' + reason.toString() : ''})`);
      this.connected = false;
      this.authenticated = false;
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


    if (data.type === 'event' && data.event === 'connect.challenge') {
      this.handleChallenge(data.payload as Record<string, unknown>);
      return;
    }

    if (data.type === 'event' && data.event === 'connect.authenticated') {
      this.authenticated = true;
      console.log('[gateway] authenticated');
      this.emit('authenticated');
      return;
    }

    if (data.type === 'res') {
      const resPayload = data.payload as Record<string, unknown> | undefined;
      if (data.ok === true && resPayload?.type === 'hello-ok') {
        this.authenticated = true;
        console.log(`[gateway] authenticated (protocol=${resPayload.protocol})`);
        this.emit('authenticated');
        return;
      }
      if (data.ok === false && !this.pendingRequests.has(data.id as string)) {
        const err = data.error as Record<string, unknown> | undefined;
        console.error(`[gateway] connect rejected: ${JSON.stringify(err ?? data)}`);
        return;
      }
    }

    if (data.type === 'res' && data.id && typeof data.id === 'string' && this.pendingRequests.has(data.id)) {
      const pending = this.pendingRequests.get(data.id)!;
      this.pendingRequests.delete(data.id);
      clearTimeout(pending.timer);

      if (data.ok === false) {
        const err = data.error as Record<string, unknown> | undefined;
        pending.reject(new Error(err?.message as string ?? 'Request failed'));
      } else {
        pending.resolve(data.payload);
      }
      return;
    }

    if (data.type === 'event') {
      const event = data.event as string;
      if (event === 'chat') {
        this.emit('chat:event', data.payload);
      } else {
        this.emit('gateway:event', data);
      }
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
        pending.resolve(data.result ?? data.payload);
      }
      return;
    }
  }

  private handleChallenge(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const nonce = payload.nonce as string;
    if (!this.authToken) {
      console.warn('[gateway] challenge received but no auth token configured');
      return;
    }

    const role = 'operator';

    const clientId = this.device?.pairedClientId ?? 'gateway-client';
    const clientMode = this.device?.pairedClientMode ?? 'backend';
    const scopes = this.device?.pairedScopes ?? ['operator.read'];
    const platform = 'darwin';

    const effectiveToken = this.device?.authToken ?? this.authToken;

    const params: Record<string, unknown> = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: clientId,
        version: '1.0.0',
        platform,
        mode: clientMode,
      },
      role,
      scopes,
      caps: [],
      commands: [],
      permissions: {},
      auth: { token: effectiveToken },
      locale: 'en-US',
      userAgent: 'pixel-claw/1.0.0',
    };

    if (this.device) {
      const signedAtMs = Date.now();
      const token = effectiveToken ?? '';

      const signPayload = [
        'v2',
        this.device.deviceId,
        clientId,
        clientMode,
        role,
        scopes.join(','),
        String(signedAtMs),
        token,
        nonce,
      ].join('|');

      const privKey = createPrivateKey(this.device.privateKeyPem);
      const sigBuf = cryptoSign(null, Buffer.from(signPayload, 'utf8'), privKey);
      const signature = base64UrlEncode(sigBuf);
      const pubKeyB64Url = publicKeyRawBase64Url(this.device.publicKeyPem);

      params.device = {
        id: this.device.deviceId,
        publicKey: pubKeyB64Url,
        signature,
        signedAt: signedAtMs,
        nonce,
      };
    }

    const connectReq = {
      type: 'req',
      id: randomUUID(),
      method: 'connect',
      params,
    };

    this.ws.send(JSON.stringify(connectReq));
    console.log('[gateway] connect request sent');
  }

  private request<T>(method: string, params: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to gateway'));
        return;
      }
      if (!this.authenticated) {
        reject(new Error('Not authenticated with gateway'));
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
        type: 'req',
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

    console.log(`[gateway] reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);
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
