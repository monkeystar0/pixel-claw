import { loadConfig } from './config.js';
import { SessionWatcher } from './openclaw/sessionWatcher.js';
import { ChannelRegistry } from './openclaw/channelRegistry.js';
import { GatewayClient } from './openclaw/gatewayClient.js';
import { SessionManager } from './services/sessionManager.js';
import { createServer } from './server/fastify.js';

const config = loadConfig();
const watcher = new SessionWatcher(config);
const channels = new ChannelRegistry(config.openclawConfigPath);
const gateway = new GatewayClient(config.gatewayUrl);
const manager = new SessionManager(watcher, channels, gateway);
const server = await createServer(config, manager);

await manager.start();
await server.listen({ port: config.port, host: '0.0.0.0' });

console.log(`pixel-claw running at http://localhost:${config.port}`);

const shutdown = async () => {
  console.log('Shutting down...');
  manager.stop();
  await server.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
