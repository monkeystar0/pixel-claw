import { EventEmitter } from 'node:events';
import { watch, type FSWatcher } from 'chokidar';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { Config } from '../config.js';
import type { SessionData, SessionOrigin } from './types.js';
import { parseSessionFile } from './sessionParser.js';

interface SessionsJsonEntry {
  sessionId: string;
  updatedAt?: number;
  label?: string;
  displayName?: string;
  origin?: SessionOrigin;
  abortedLastRun?: boolean;
}

interface SessionsMetadata {
  labels: Map<string, string>;
  origins: Map<string, SessionOrigin>;
  activeSessionIds: Set<string>;
  allSessionIds: Set<string>;
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
      const sessionId = basename(file, '.jsonl');
      const session = this.parseAndEnrich(filePath, sessionId, metadata);
      if (session) {
        this.sessions.set(sessionId, session);
      }
    }
  }

  private handleFileChange(filePath: string, eventType: 'added' | 'updated'): void {
    if (!filePath.endsWith('.jsonl') || filePath.includes('.lock') || filePath.includes('.deleted')) {
      return;
    }

    const sessionId = basename(filePath, '.jsonl');
    const metadata = this.loadSessionsMetadata();
    const session = this.parseAndEnrich(filePath, sessionId, metadata);
    if (!session) return;

    const isNew = !this.sessions.has(sessionId);
    this.sessions.set(sessionId, session);

    if (isNew || eventType === 'added') {
      this.emit('session:added', session);
    } else {
      this.emit('session:updated', session);
    }
  }

  private handleFileRemoved(filePath: string): void {
    if (!filePath.endsWith('.jsonl')) return;

    const sessionId = basename(filePath, '.jsonl');
    if (this.sessions.has(sessionId)) {
      this.sessions.delete(sessionId);
      this.emit('session:removed', sessionId);
    }
  }

  private parseAndEnrich(
    filePath: string,
    sessionId: string,
    metadata: SessionsMetadata,
  ): SessionData | null {
    const session = parseSessionFile(filePath);
    if (!session) return null;

    const label = metadata.labels.get(sessionId);
    if (label) {
      session.label = label;
    }

    const origin = metadata.origins.get(sessionId);
    if (origin) {
      session.origin = origin;
    }

    if (metadata.activeSessionIds.has(sessionId)) {
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

    try {
      if (!existsSync(this.config.sessionsJsonPath)) {
        return { labels, origins, activeSessionIds, allSessionIds };
      }

      const raw = readFileSync(this.config.sessionsJsonPath, 'utf-8');
      const data = JSON.parse(raw) as Record<string, SessionsJsonEntry>;
      const now = Date.now();

      for (const [, entry] of Object.entries(data)) {
        if (!entry.sessionId) continue;
        const sid = entry.sessionId;
        allSessionIds.add(sid);

        if (entry.label || entry.displayName) {
          labels.set(sid, (entry.label ?? entry.displayName)!);
        }

        if (entry.origin) {
          origins.set(sid, entry.origin);
        }

        if (entry.updatedAt && (now - entry.updatedAt) < ACTIVE_THRESHOLD_MS) {
          activeSessionIds.add(sid);
        }
      }
    } catch {
      // Gracefully handle read/parse errors
    }

    return { labels, origins, activeSessionIds, allSessionIds };
  }
}
