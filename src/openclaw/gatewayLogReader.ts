import { EventEmitter } from 'node:events';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { watch, type FSWatcher } from 'chokidar';

export interface GatewayLogEntry {
  timestamp: string;
  category: string;
  message: string;
  level: 'info' | 'error' | 'warn' | 'debug';
}

const LOG_LINE_RE = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+\[([^\]]+)\]\s+(.+)$/;
const MAX_INITIAL_ENTRIES = 100;
const TAIL_READ_BYTES = 64 * 1024;

export class GatewayLogReader extends EventEmitter {
  private logPath: string;
  private fileWatcher: FSWatcher | null = null;
  private lastSize = 0;
  private entries: GatewayLogEntry[] = [];

  constructor(logPath: string) {
    super();
    this.logPath = logPath;
  }

  async start(): Promise<void> {
    this.entries = this.readTail();

    if (!existsSync(this.logPath)) return;

    this.lastSize = statSync(this.logPath).size;

    this.fileWatcher = watch(this.logPath, {
      persistent: true,
      ignoreInitial: true,
      usePolling: true,
      interval: 1000,
    });

    this.fileWatcher.on('change', () => this.onFileChange());
  }

  stop(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
  }

  getEntries(): GatewayLogEntry[] {
    return [...this.entries];
  }

  private readTail(): GatewayLogEntry[] {
    if (!existsSync(this.logPath)) return [];

    try {
      const raw = readFileSync(this.logPath, 'utf-8');
      const lines = raw.split('\n').filter(l => l.trim());
      const tail = lines.slice(-MAX_INITIAL_ENTRIES * 3);

      const entries: GatewayLogEntry[] = [];
      for (const line of tail) {
        const entry = this.parseLine(line);
        if (entry) entries.push(entry);
      }

      return entries.slice(-MAX_INITIAL_ENTRIES);
    } catch {
      return [];
    }
  }

  private onFileChange(): void {
    if (!existsSync(this.logPath)) return;

    try {
      const stat = statSync(this.logPath);
      const newSize = stat.size;

      if (newSize <= this.lastSize) {
        this.lastSize = newSize;
        return;
      }

      const readStart = Math.max(this.lastSize - 256, 0);
      const fd = require('node:fs').openSync(this.logPath, 'r');
      const buf = Buffer.alloc(Math.min(newSize - readStart, TAIL_READ_BYTES));
      require('node:fs').readSync(fd, buf, 0, buf.length, readStart);
      require('node:fs').closeSync(fd);

      const chunk = buf.toString('utf-8');
      const lines = chunk.split('\n');

      const startIdx = readStart === this.lastSize ? 0 : 1;

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const entry = this.parseLine(line);
        if (entry) {
          this.entries.push(entry);
          this.emit('entry', entry);
        }
      }

      while (this.entries.length > MAX_INITIAL_ENTRIES * 2) {
        this.entries.shift();
      }

      this.lastSize = newSize;
    } catch {
      // gracefully handle read errors
    }
  }

  private parseLine(line: string): GatewayLogEntry | null {
    const match = line.match(LOG_LINE_RE);
    if (!match) return null;

    const [, timestamp, category, message] = match;

    let level: GatewayLogEntry['level'] = 'info';
    if (message.includes('✗') || message.toLowerCase().includes('error')) {
      level = 'error';
    } else if (message.toLowerCase().includes('warn')) {
      level = 'warn';
    }

    return { timestamp, category, message, level };
  }
}
