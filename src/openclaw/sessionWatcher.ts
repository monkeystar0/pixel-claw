import { EventEmitter } from 'node:events';
import { watch, type FSWatcher } from 'chokidar';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { Config } from '../config.js';
import type { SessionData, SessionOrigin, TokenUsage } from './types.js';
import { parseSessionFile } from './sessionParser.js';

interface SessionsJsonEntry {
  sessionId: string;
  updatedAt?: number;
  label?: string;
  displayName?: string;
  origin?: SessionOrigin;
  abortedLastRun?: boolean;
  sessionFile?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  contextTokens?: number;
  cacheRead?: number;
  cacheWrite?: number;
  model?: string;
  modelProvider?: string;
}

interface SessionsMetadata {
  labels: Map<string, string>;
  origins: Map<string, SessionOrigin>;
  activeSessionIds: Set<string>;
  allSessionIds: Set<string>;
  aliases: Map<string, string>;
  fileIdToCanonicalId: Map<string, string>;
  tokenUsage: Map<string, TokenUsage>;
  models: Map<string, string>;
  updatedAts: Map<string, number>;
}

const ACTIVE_THRESHOLD_MS = 60_000;

export class SessionWatcher extends EventEmitter {
  private config: Config;
  private sessions: Map<string, SessionData> = new Map();
  private fileWatcher: FSWatcher | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private showAll = false;

  constructor(config: Config) {
    super();
    this.config = config;
  }

  async start(): Promise<void> {
    if (!existsSync(this.config.sessionsDir)) {
      return;
    }

    this.loadExistingSessions();

    this.fileWatcher = watch(this.config.sessionsDir, {
      persistent: true,
      ignoreInitial: true,
      depth: 0,
    });

    this.fileWatcher.on('add', (filePath: string) => this.handleFileChange(filePath, 'added'));
    this.fileWatcher.on('change', (filePath: string) => this.handleFileChange(filePath, 'updated'));
    this.fileWatcher.on('unlink', (filePath: string) => this.handleFileRemoved(filePath));

    this.pollTimer = setInterval(() => this.pollMetadata(), this.config.pollInterval);
  }

  stop(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.sessions.clear();
  }

  setShowAll(showAll: boolean): void {
    this.showAll = showAll;
  }

  getSessions(): Map<string, SessionData> {
    return new Map(this.sessions);
  }

  private loadExistingSessions(): void {
    const metadata = this.loadSessionsMetadata();
    const files = readdirSync(this.config.sessionsDir)
      .filter(f => f.endsWith('.jsonl') && !f.includes('.lock') && !f.includes('.deleted'));

    for (const file of files) {
      const filePath = join(this.config.sessionsDir, file);
      const fileId = basename(file, '.jsonl');
      const session = this.parseAndEnrich(filePath, fileId, metadata);
      if (session) {
        this.sessions.set(session.sessionId, session);
      }
    }
  }

  private handleFileChange(filePath: string, eventType: 'added' | 'updated'): void {
    if (!filePath.endsWith('.jsonl') || filePath.includes('.lock') || filePath.includes('.deleted')) {
      return;
    }

    const fileId = basename(filePath, '.jsonl');
    const metadata = this.loadSessionsMetadata();
    const session = this.parseAndEnrich(filePath, fileId, metadata);
    if (!session) return;

    const isNew = !this.sessions.has(session.sessionId);
    this.sessions.set(session.sessionId, session);

    if (isNew || eventType === 'added') {
      this.emit('session:added', session);
    } else {
      this.emit('session:updated', session);
    }
  }

  private handleFileRemoved(filePath: string): void {
    if (!filePath.endsWith('.jsonl')) return;

    const fileId = basename(filePath, '.jsonl');
    const metadata = this.loadSessionsMetadata();
    const canonicalId = metadata.fileIdToCanonicalId.get(fileId) ?? fileId;

    if (this.sessions.has(canonicalId)) {
      this.sessions.delete(canonicalId);
      this.emit('session:removed', canonicalId);
    }
  }

  private parseAndEnrich(
    filePath: string,
    sessionId: string,
    metadata: SessionsMetadata,
  ): SessionData | null {
    const session = parseSessionFile(filePath);
    if (!session) return null;

    const canonicalId = metadata.fileIdToCanonicalId.get(sessionId) ?? sessionId;
    session.sessionId = canonicalId;

    const label = metadata.labels.get(canonicalId);
    if (label) {
      session.label = label;
    }

    const origin = metadata.origins.get(canonicalId);
    if (origin) {
      session.origin = origin;
    }

    session.sessionAlias = metadata.aliases.get(canonicalId) ?? null;
    session.tokenUsage = metadata.tokenUsage.get(canonicalId) ?? null;
    session.model = metadata.models.get(canonicalId) ?? null;
    session.updatedAt = metadata.updatedAts.get(canonicalId) ?? session.startTime;

    if (metadata.activeSessionIds.has(canonicalId)) {
      session.status = 'running';
    } else if (session.status === 'running') {
      session.status = 'complete';
    }

    return session;
  }

  private pollMetadata(): void {
    const metadata = this.loadSessionsMetadata();
    let changed = false;

    for (const [sessionId, session] of this.sessions) {
      const wasRunning = session.status === 'running';
      const isActive = metadata.activeSessionIds.has(sessionId);

      if (isActive && !wasRunning) {
        session.status = 'running';
        changed = true;
      } else if (!isActive && wasRunning) {
        session.status = 'complete';
        changed = true;
      }

      const label = metadata.labels.get(sessionId);
      if (label && label !== session.label) {
        session.label = label;
        changed = true;
      }

      const origin = metadata.origins.get(sessionId);
      if (origin && !session.origin) {
        session.origin = origin;
        changed = true;
      }

      const alias = metadata.aliases.get(sessionId) ?? null;
      if (alias !== session.sessionAlias) {
        session.sessionAlias = alias;
        changed = true;
      }

      const tokens = metadata.tokenUsage.get(sessionId) ?? null;
      if (tokens && tokens.totalTokens !== session.tokenUsage?.totalTokens) {
        session.tokenUsage = tokens;
        changed = true;
      }

      const model = metadata.models.get(sessionId) ?? null;
      if (model && model !== session.model) {
        session.model = model;
        changed = true;
      }

      const updatedAt = metadata.updatedAts.get(sessionId);
      if (updatedAt && updatedAt !== session.updatedAt) {
        session.updatedAt = updatedAt;
        changed = true;
      }

      if (changed) {
        this.emit('session:updated', session);
        changed = false;
      }
    }
  }

  private loadSessionsMetadata(): SessionsMetadata {
    const labels = new Map<string, string>();
    const origins = new Map<string, SessionOrigin>();
    const activeSessionIds = new Set<string>();
    const allSessionIds = new Set<string>();
    const aliases = new Map<string, string>();
    const fileIdToCanonicalId = new Map<string, string>();
    const tokenUsage = new Map<string, TokenUsage>();
    const models = new Map<string, string>();
    const updatedAts = new Map<string, number>();

    try {
      if (!existsSync(this.config.sessionsJsonPath)) {
        return { labels, origins, activeSessionIds, allSessionIds, aliases, fileIdToCanonicalId, tokenUsage, models, updatedAts };
      }

      const raw = readFileSync(this.config.sessionsJsonPath, 'utf-8');
      const data = JSON.parse(raw) as Record<string, SessionsJsonEntry>;
      const now = Date.now();

      for (const [key, entry] of Object.entries(data)) {
        if (!entry.sessionId) continue;
        const sid = entry.sessionId;
        allSessionIds.add(sid);
        aliases.set(sid, key);

        if (entry.sessionFile) {
          const fileId = basename(entry.sessionFile, '.jsonl');
          if (fileId !== sid) {
            fileIdToCanonicalId.set(fileId, sid);
          }
        }

        if (entry.label || entry.displayName) {
          labels.set(sid, (entry.label ?? entry.displayName)!);
        }

        if (entry.origin) {
          origins.set(sid, entry.origin);
        }

        if (entry.updatedAt && (now - entry.updatedAt) < ACTIVE_THRESHOLD_MS) {
          activeSessionIds.add(sid);
        }

        if (entry.updatedAt) {
          updatedAts.set(sid, entry.updatedAt);
        }

        if (entry.totalTokens !== undefined) {
          tokenUsage.set(sid, {
            inputTokens: entry.inputTokens ?? 0,
            outputTokens: entry.outputTokens ?? 0,
            totalTokens: entry.totalTokens ?? 0,
            contextTokens: entry.contextTokens ?? 0,
            cacheRead: entry.cacheRead ?? 0,
            cacheWrite: entry.cacheWrite ?? 0,
          });
        }

        if (entry.model) {
          const label = entry.modelProvider
            ? `${entry.modelProvider}/${entry.model}`
            : entry.model;
          models.set(sid, label);
        }
      }
    } catch {
      // Gracefully handle read/parse errors
    }

    return { labels, origins, activeSessionIds, allSessionIds, aliases, fileIdToCanonicalId, tokenUsage, models, updatedAts };
  }
}
