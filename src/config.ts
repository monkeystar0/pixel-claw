import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

export interface DeviceIdentity {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
  authToken: string | null;
  pairedClientId: string | null;
  pairedClientMode: string | null;
  pairedScopes: string[] | null;
}

export interface Config {
  openclawDir: string;
  openclawAgent: string;
  gatewayUrl: string;
  gatewayToken: string | null;
  deviceIdentity: DeviceIdentity | null;
  sessionsDir: string;
  sessionsJsonPath: string;
  openclawConfigPath: string;
  port: number;
  pollInterval: number;
}

function envStr(key: string, fallback: string): string {
  const val = process.env[key] ?? fallback;
  if (val.startsWith('~')) {
    return join(homedir(), val.slice(1));
  }
  return val;
}

function envInt(key: string, fallback: number): number {
  const val = process.env[key];
  if (val === undefined) return fallback;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function readGatewayToken(configPath: string): string | null {
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const data = JSON.parse(raw);
    return data?.gateway?.auth?.token ?? null;
  } catch {
    return null;
  }
}

function readDeviceAuthToken(openclawDir: string): string | null {
  try {
    const authPath = join(openclawDir, 'identity', 'device-auth.json');
    const raw = readFileSync(authPath, 'utf-8');
    const data = JSON.parse(raw);
    return data?.tokens?.operator?.token ?? null;
  } catch {
    return null;
  }
}

function readPairedMetadata(openclawDir: string, deviceId: string): { clientId: string; clientMode: string; scopes: string[] } | null {
  try {
    const pairedPath = join(openclawDir, 'devices', 'paired.json');
    const raw = readFileSync(pairedPath, 'utf-8');
    const data = JSON.parse(raw);
    const entry = data?.[deviceId];
    if (entry?.clientId) {
      return {
        clientId: entry.clientId,
        clientMode: entry.clientMode ?? 'backend',
        scopes: entry.scopes ?? ['operator.read'],
      };
    }
    return null;
  } catch {
    return null;
  }
}

function readDeviceIdentity(openclawDir: string): DeviceIdentity | null {
  try {
    const devicePath = join(openclawDir, 'identity', 'device.json');
    const raw = readFileSync(devicePath, 'utf-8');
    const data = JSON.parse(raw);
    if (data?.deviceId && data?.publicKeyPem && data?.privateKeyPem) {
      const authToken = readDeviceAuthToken(openclawDir);
      const paired = readPairedMetadata(openclawDir, data.deviceId);
      return {
        deviceId: data.deviceId,
        publicKeyPem: data.publicKeyPem,
        privateKeyPem: data.privateKeyPem,
        authToken,
        pairedClientId: paired?.clientId ?? null,
        pairedClientMode: paired?.clientMode ?? null,
        pairedScopes: paired?.scopes ?? null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function loadConfig(): Config {
  const openclawDir = envStr('OPENCLAW_DIR', join(homedir(), '.openclaw'));
  const openclawAgent = envStr('OPENCLAW_AGENT', 'main');
  const sessionsDir = join(openclawDir, 'agents', openclawAgent, 'sessions');
  const openclawConfigPath = join(openclawDir, 'openclaw.json');

  return {
    openclawDir,
    openclawAgent,
    gatewayUrl: envStr('OPENCLAW_GATEWAY_URL', 'ws://localhost:18789'),
    gatewayToken: envStr('OPENCLAW_GATEWAY_TOKEN', '') || readGatewayToken(openclawConfigPath),
    deviceIdentity: readDeviceIdentity(openclawDir),
    sessionsDir,
    sessionsJsonPath: join(sessionsDir, 'sessions.json'),
    openclawConfigPath,
    port: envInt('PORT', 3000),
    pollInterval: envInt('POLL_INTERVAL', 500),
  };
}
