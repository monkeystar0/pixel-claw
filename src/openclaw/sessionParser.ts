import { readFileSync, existsSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import type { ToolCall, ChatMessage, SessionData, SessionOrigin } from './types.js';

const SENSITIVE_KEYS = /token|key|secret|password|auth|credential/i;
const MAX_LABEL_LENGTH = 40;
const RECENT_TOOLS_LIMIT = 5;

interface ParsedLine {
  toolCalls: ToolCall[];
  chatMessage: ChatMessage | null;
  error: string | null;
  timestamp: number | null;
  sessionStart: number | null;
}

interface SessionLineData {
  type: string;
  id?: string;
  parentId?: string | null;
  timestamp?: string;
  message?: {
    role: string;
    content?: unknown;
    toolCallId?: string;
    toolName?: string;
    isError?: boolean;
  };
  details?: { label?: string };
}

export function parseSessionLine(line: string): ParsedLine {
  const result: ParsedLine = {
    toolCalls: [],
    chatMessage: null,
    error: null,
    timestamp: null,
    sessionStart: null,
  };

  let parsed: SessionLineData;
  try {
    parsed = JSON.parse(line);
  } catch {
    return result;
  }

  if (parsed.timestamp) {
    result.timestamp = new Date(parsed.timestamp).getTime();
  }

  if (parsed.type === 'session') {
    result.sessionStart = result.timestamp;
    return result;
  }

  if (parsed.type !== 'message' || !parsed.message) {
    return result;
  }

  const { role, content } = parsed.message;

  if (role === 'assistant') {
    if (Array.isArray(content)) {
      for (const block of content) {
        if (typeof block !== 'object' || block === null) continue;
        const b = block as Record<string, unknown>;

        if (b.type === 'toolCall' && typeof b.name === 'string') {
          result.toolCalls.push({
            id: (b.id as string) ?? '',
            name: b.name,
            args: formatToolArgs(b.arguments as Record<string, unknown> | undefined),
          });
        }

        if (b.type === 'text' && typeof b.text === 'string' && !result.chatMessage) {
          result.chatMessage = {
            role: 'assistant',
            content: b.text,
            timestamp: result.timestamp ?? 0,
          };
        }
      }
    }
  } else if (role === 'user') {
    if (typeof content === 'string') {
      result.chatMessage = {
        role: 'user',
        content,
        timestamp: result.timestamp ?? 0,
      };
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (typeof block !== 'object' || block === null) continue;
        const b = block as Record<string, unknown>;
        if (b.type === 'text' && typeof b.text === 'string') {
          result.chatMessage = {
            role: 'user',
            content: b.text,
            timestamp: result.timestamp ?? 0,
          };
          break;
        }
      }
    }
  } else if (role === 'toolResult') {
    if (parsed.message.isError) {
      const contentArr = content;
      if (Array.isArray(contentArr)) {
        for (const block of contentArr) {
          if (typeof block === 'object' && block !== null) {
            const b = block as Record<string, unknown>;
            if (b.type === 'text' && typeof b.text === 'string') {
              result.error = b.text;
              break;
            }
          }
        }
      }
    }
  }

  return result;
}

export function extractLabel(lineObj: Record<string, unknown>): string | null {
  if (
    typeof lineObj.details === 'object' &&
    lineObj.details !== null &&
    typeof (lineObj.details as Record<string, unknown>).label === 'string'
  ) {
    return (lineObj.details as Record<string, string>).label;
  }

  if (lineObj.type === 'message') {
    const message = lineObj.message as Record<string, unknown> | undefined;
    if (!message || message.role !== 'user') return null;

    const content = message.content;
    if (typeof content === 'string') {
      return truncateLabel(content.split('\n')[0].trim());
    }

    if (Array.isArray(content)) {
      for (const item of content) {
        if (typeof item === 'object' && item !== null) {
          const b = item as Record<string, unknown>;
          if (b.type === 'text' && typeof b.text === 'string') {
            let text = b.text;
            const bracketMatch = text.match(/^\[.*?\]\s*/);
            if (bracketMatch) {
              text = text.substring(bracketMatch[0].length);
            }
            return truncateLabel(text.split('\n')[0].trim());
          }
        }
      }
    }
  }

  return null;
}

function truncateLabel(text: string): string {
  if (text.length > MAX_LABEL_LENGTH) {
    return text.substring(0, MAX_LABEL_LENGTH - 3) + '...';
  }
  return text;
}

export function formatToolArgs(args: Record<string, unknown> | undefined): string {
  if (!args) return '';
  for (const [key, value] of Object.entries(args)) {
    if (SENSITIVE_KEYS.test(key)) continue;
    if (typeof value === 'string' && value.length > 0) {
      const firstLine = value.split('\n')[0];
      const truncated = firstLine.length > 40 ? firstLine.substring(0, 37) + '...' : firstLine;
      return `"${truncated}"`;
    }
  }
  return '';
}

export function parseSessionFile(filePath: string): SessionData | null {
  if (!existsSync(filePath)) return null;

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  const lines = content.trim().split('\n').filter(l => l.trim());
  if (lines.length === 0) return null;

  const sessionId = basename(filePath, '.jsonl');
  let label: string | null = null;
  let startTime: number | null = null;
  let toolCount = 0;
  let lastToolName: string | null = null;
  let lastToolArgs: string | null = null;
  let hasError = false;
  let errorDetails: string | null = null;
  const recentToolNames: string[] = [];

  for (const line of lines) {
    const parsed = parseSessionLine(line);

    if (parsed.sessionStart !== null && startTime === null) {
      startTime = parsed.sessionStart;
    }

    if (label === null) {
      try {
        const lineObj = JSON.parse(line);
        const extracted = extractLabel(lineObj);
        if (extracted) label = extracted;
      } catch { /* skip */ }
    }

    for (const tool of parsed.toolCalls) {
      toolCount++;
      lastToolName = tool.name;
      lastToolArgs = tool.args;
      recentToolNames.push(tool.name);
    }

    if (parsed.error) {
      hasError = true;
      errorDetails = parsed.error.length > 80
        ? parsed.error.substring(0, 80) + '...'
        : parsed.error;
    }
  }

  const stats = statSync(filePath);
  const mtime = stats.mtimeMs;
  const now = Date.now();
  const isRecent = (now - mtime) < 60_000;

  let status: 'running' | 'complete' | 'failed' = 'complete';
  if (isRecent) {
    status = 'running';
  } else if (hasError) {
    status = 'failed';
  }

  if (startTime === null) {
    startTime = stats.birthtimeMs || stats.ctimeMs;
  }

  const elapsed = Math.floor((now - startTime) / 1000);

  return {
    sessionId,
    label: label ?? sessionId,
    status,
    elapsed,
    currentTool: lastToolName,
    currentToolArgs: lastToolArgs,
    toolCount,
    recentTools: recentToolNames.slice(-RECENT_TOOLS_LIMIT),
    errorDetails,
    filePath,
    startTime,
    origin: null,
  };
}

export function getRecentMessages(filePath: string, limit: number): ChatMessage[] {
  if (!existsSync(filePath)) return [];

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const lines = content.trim().split('\n').filter(l => l.trim());
  const messages: ChatMessage[] = [];

  for (const line of lines) {
    const parsed = parseSessionLine(line);
    if (parsed.chatMessage) {
      messages.push(parsed.chatMessage);
    }
  }

  return messages.slice(-limit);
}
