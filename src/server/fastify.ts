import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { WebSocket } from 'ws';
import type { Config } from '../config.js';
import type { SessionManager } from '../services/sessionManager.js';
import type { GatewayLogReader } from '../openclaw/gatewayLogReader.js';
import { setupWebSocketHandler } from './websocket.js';

export async function createServer(config: Config, manager: SessionManager, logReader?: GatewayLogReader) {
  const app = Fastify({ logger: false });

  await app.register(fastifyWebsocket);

  const clientDistPath = join(import.meta.dirname, '..', '..', 'client', 'dist');
  if (existsSync(clientDistPath)) {
    await app.register(fastifyStatic, {
      root: clientDistPath,
      prefix: '/',
    });
  }

  const clients = new Set<WebSocket>();
  const handleConnection = setupWebSocketHandler(manager, clients, logReader);

  app.get('/ws', { websocket: true }, (socket) => {
    handleConnection(socket as unknown as WebSocket);
  });

  app.get('/health', async () => {
    return { status: 'ok', sessions: manager.getSessions().length };
  });

  return app;
}
