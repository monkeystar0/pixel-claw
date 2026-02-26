import { useState, useEffect, useCallback, useRef } from 'react';

interface SessionData {
  sessionId: string;
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
}

interface ChannelInfo {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  connected: boolean;
}

interface ChatMessage {
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

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mountedRef = useRef(true);

  const handleMessage = useCallback((event: MessageEvent) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    switch (data.type) {
      case 'sessions:sync':
        setSessions(data.sessions as SessionData[]);
        break;
      case 'channels:sync':
        setChannels(data.channels as ChannelInfo[]);
        break;
      case 'session:added':
        setSessions(prev => [...prev, data.session as SessionData]);
        break;
      case 'session:updated':
        setSessions(prev => prev.map(s =>
          s.sessionId === (data.session as SessionData).sessionId
            ? (data.session as SessionData)
            : s
        ));
        break;
      case 'session:removed':
        setSessions(prev => prev.filter(s => s.sessionId !== data.sessionId));
        break;
      case 'channels:updated':
        setChannels(data.channels as ChannelInfo[]);
        break;
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
    send({ type: 'session:sendPrompt', sessionId, message });
  }, [send]);

  const abortSession = useCallback((sessionId: string) => {
    send({ type: 'session:abort', sessionId });
  }, [send]);

  const getHistory = useCallback((sessionId: string, limit = 20) => {
    send({ type: 'session:getHistory', sessionId, limit });
  }, [send]);

  return {
    connected,
    sessions,
    channels,
    sendPrompt,
    abortSession,
    getHistory,
    send,
  };
}
