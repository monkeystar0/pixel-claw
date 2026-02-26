import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Config {
  openclawDir: string;
  openclawAgent: string;
  gatewayUrl: string;
  sessionsDir: string;
  sessionsJsonPath: string;
  openclawConfigPath: string;
  port: number;
  pollInterval: number;
}

function envStr(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (val === undefined) return fallback;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function loadConfig(): Config {
  const openclawDir = envStr('OPENCLAW_DIR', join(homedir(), '.openclaw'));
  const openclawAgent = envStr('OPENCLAW_AGENT', 'main');
  const sessionsDir = join(openclawDir, 'agents', openclawAgent, 'sessions');

  return {
    openclawDir,
    openclawAgent,
    gatewayUrl: envStr('OPENCLAW_GATEWAY_URL', 'ws://localhost:3578'),
    sessionsDir,
    sessionsJsonPath: join(sessionsDir, 'sessions.json'),
    openclawConfigPath: join(openclawDir, 'openclaw.json'),
    port: envInt('PORT', 3000),
    pollInterval: envInt('POLL_INTERVAL', 500),
  };
}
