import { useState, useEffect, useCallback, useRef } from 'react';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextTokens: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface SessionData {
  sessionId: string;
  sessionAlias: string | null;
  label: string;
  status: 'running' | 'complete' | 'failed';
  elapsed: number;
  currentTool: string | null;
  currentToolArgs: string | null;
  toolCount: number;
  recentTools: string[];
  errorDetails: string | null;
  room: string;
  origin: { provider: string | null; surface: string | null; label: string | null } | null;
  tokenUsage: TokenUsage | null;
  model: string | null;
  updatedAt: number;
}

export interface ChannelInfo {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  connected: boolean;
  subChannels: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 16_000;

function resolveWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

export interface GatewayLogEntry {
  timestamp: string;
  category: string;
  message: string;
  level: 'info' | 'error' | 'warn' | 'debug';
}

const MAX_ACTIVITY_LOG = 100;

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [gatewayConnected, setGatewayConnected] = useState(false);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [chatMessages, setChatMessages] = useState<Map<string, ChatMessage[]>>(new Map());
  const [pendingSessionIds, setPendingSessionIds] = useState<Set<string>>(new Set());
  const [gatewayLog, setGatewayLog] = useState<GatewayLogEntry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountedRef = useRef(true);
  const sessionsRef = useRef<SessionData[]>([]);

  const handleMessage = useCallback((event: MessageEvent) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    switch (data.type) {
      case 'sessions:sync': {
        const synced = data.sessions as SessionData[];
        setSessions(synced);
        sessionsRef.current = synced;
        break;
      }
      case 'channels:sync':
        setChannels(data.channels as ChannelInfo[]);
        break;
      case 'gateway:status':
        setGatewayConnected(data.connected as boolean);
        break;
      case 'session:added': {
        const added = data.session as SessionData;
        setSessions(prev =>
          prev.some(s => s.sessionId === added.sessionId) ? prev : [...prev, added]
        );
        break;
      }
      case 'session:updated': {
        const updated = data.session as SessionData;
        setSessions(prev => {
          const next = prev.map(s => s.sessionId === updated.sessionId ? updated : s);
          sessionsRef.current = next;
          return next;
        });
        break;
      }
      case 'session:removed':
        setSessions(prev => prev.filter(s => s.sessionId !== data.sessionId));
        break;
      case 'channels:updated':
        setChannels(data.channels as ChannelInfo[]);
        break;
      case 'session:history': {
        const sid = data.sessionId as string;
        const msgs = data.messages as ChatMessage[];
        setChatMessages(prev => {
          const next = new Map(prev);
          next.set(sid, msgs);
          return next;
        });
        break;
      }
      case 'session:promptAck': {
        const sid = data.sessionId as string;
        if (!data.ok) {
          setPendingSessionIds(prev => {
            const next = new Set(prev);
            next.delete(sid);
            return next;
          });
        }
        break;
      }
      case 'activityLog:sync': {
        const entries = data.entries as GatewayLogEntry[];
        setGatewayLog(entries.slice(-MAX_ACTIVITY_LOG).reverse());
        break;
      }
      case 'activityLog:entry': {
        const entry = data.entry as GatewayLogEntry;
        setGatewayLog(prev => [entry, ...prev].slice(0, MAX_ACTIVITY_LOG));
        break;
      }
      case 'session:chatEvent': {
        const sid = data.sessionId as string;
        const msg = data.message as ChatMessage;
        const state = data.state as string | undefined;
        if (!sid || !msg?.content) break;

        setChatMessages(prev => {
          const next = new Map(prev);
          const existing = next.get(sid) ?? [];

          if (state === 'delta') {
            const last = existing[existing.length - 1];
            if (last && last.role === 'assistant') {
              next.set(sid, [...existing.slice(0, -1), { ...last, content: msg.content, timestamp: msg.timestamp }]);
            } else {
              next.set(sid, [...existing, msg]);
            }
          } else if (state === 'final') {
            const last = existing[existing.length - 1];
            if (last && last.role === 'assistant') {
              next.set(sid, [...existing.slice(0, -1), { ...last, content: msg.content, timestamp: msg.timestamp }]);
            } else if (msg.content) {
              next.set(sid, [...existing, msg]);
            }
          } else if (msg.content) {
            next.set(sid, [...existing, msg]);
          }
          return next;
        });

        if (state === 'final' || state === 'error') {
          setPendingSessionIds(prev => {
            const next = new Set(prev);
            next.delete(sid);
            return next;
          });
        }
        break;
      }
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const ws = new WebSocket(resolveWsUrl());
    wsRef.current = ws;

    ws.addEventListener('open', () => {
      if (!mountedRef.current) return;
      setConnected(true);
      reconnectAttempt.current = 0;
    });

    ws.addEventListener('message', handleMessage);

    ws.addEventListener('close', () => {
      if (!mountedRef.current) return;
      setConnected(false);
      wsRef.current = null;
      scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      ws.close();
    });
  }, [handleMessage]);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, reconnectAttempt.current),
      RECONNECT_MAX_MS,
    );
    reconnectAttempt.current++;
    reconnectTimer.current = setTimeout(connect, delay);
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const sendPrompt = useCallback((sessionId: string, message: string) => {
    const userMsg: ChatMessage = { role: 'user', content: message, timestamp: Date.now() };
    setChatMessages(prev => {
      const next = new Map(prev);
      const existing = next.get(sessionId) ?? [];
      next.set(sessionId, [...existing, userMsg]);
      return next;
    });
    setPendingSessionIds(prev => {
      const next = new Set(prev);
      next.add(sessionId);
      return next;
    });
    send({ type: 'session:sendPrompt', sessionId, message });
  }, [send]);

  const abortSession = useCallback((sessionId: string) => {
    send({ type: 'session:abort', sessionId });
  }, [send]);

  const resetSession = useCallback((sessionId: string) => {
    send({ type: 'session:resetSession', sessionId });
    setChatMessages(prev => {
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });
    setPendingSessionIds(prev => {
      const next = new Set(prev);
      next.delete(sessionId);
      return next;
    });
  }, [send]);

  const getHistory = useCallback((sessionId: string, limit = 20) => {
    send({ type: 'session:getHistory', sessionId, limit });
  }, [send]);

  return {
    connected,
    gatewayConnected,
    sessions,
    channels,
    chatMessages,
    pendingSessionIds,
    gatewayLog,
    sendPrompt,
    abortSession,
    resetSession,
    getHistory,
    send,
  };
}
