import type { WebSocket } from 'ws';
import type { SessionManager } from '../services/sessionManager.js';
import type { SessionData, ChannelInfo } from '../openclaw/types.js';

function send(ws: WebSocket, data: Record<string, unknown>): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function handleIncoming(ws: WebSocket, manager: SessionManager): void {
  ws.on('message', async (raw) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const type = data.type as string;

    switch (type) {
      case 'session:getHistory': {
        const sessionId = data.sessionId as string;
        const limit = (data.limit as number) || 20;
        try {
          const messages = await manager.getHistory(sessionId, limit);
          send(ws, { type: 'session:history', sessionId, messages });
        } catch (err) {
          send(ws, { type: 'session:history', sessionId, messages: [], error: String(err) });
        }
        break;
      }

      case 'session:sendPrompt': {
        const sessionId = data.sessionId as string;
        const message = data.message as string;
        try {
          const result = await manager.sendPrompt(sessionId, message);
          send(ws, { type: 'session:promptAck', sessionId, runId: result.runId, ok: true });
        } catch (err) {
          send(ws, { type: 'session:promptAck', sessionId, ok: false, error: String(err) });
        }
        break;
      }

      case 'session:abort': {
        const sessionId = data.sessionId as string;
        const runId = data.runId as string | undefined;
        try {
          await manager.abortSession(sessionId, runId);
          send(ws, { type: 'session:abortAck', sessionId, ok: true });
        } catch (err) {
          send(ws, { type: 'session:abortAck', sessionId, ok: false, error: String(err) });
        }
        break;
      }
    }
  });
}

export function setupWebSocketHandler(
  manager: SessionManager,
  clients: Set<WebSocket>,
): (ws: WebSocket) => void {
  manager.on('session:added', (session: SessionData) => {
    broadcast(clients, { type: 'session:added', session });
  });

  manager.on('session:updated', (session: SessionData) => {
    broadcast(clients, { type: 'session:updated', session });
  });

  manager.on('session:removed', (sessionId: string) => {
    broadcast(clients, { type: 'session:removed', sessionId });
  });

  manager.on('channels:updated', (channels: ChannelInfo[]) => {
    broadcast(clients, { type: 'channels:updated', channels });
  });

  manager.on('chat:event', (data: Record<string, unknown>) => {
    broadcast(clients, { type: 'chat:event', ...data });
  });

  return (ws: WebSocket) => {
    clients.add(ws);

    send(ws, { type: 'sessions:sync', sessions: manager.getSessions() });
    send(ws, { type: 'channels:sync', channels: manager.getChannels() });

    handleIncoming(ws, manager);

    ws.on('close', () => {
      clients.delete(ws);
    });
  };
}

function broadcast(clients: Set<WebSocket>, data: Record<string, unknown>): void {
  const payload = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}
