export interface ToolCall {
  id: string;
  name: string;
  args: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextTokens: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface SessionData {
  sessionId: string;
  sessionAlias: string | null;
  label: string;
  status: 'running' | 'complete' | 'failed';
  elapsed: number;
  currentTool: string | null;
  currentToolArgs: string | null;
  toolCount: number;
  recentTools: string[];
  errorDetails: string | null;
  filePath: string;
  startTime: number;
  origin: SessionOrigin | null;
  tokenUsage: TokenUsage | null;
  model: string | null;
  updatedAt: number;
}

export interface SessionOrigin {
  provider: string | null;
  surface: string | null;
  from: string | null;
  label: string | null;
}

export interface SessionMeta {
  sessionId: string;
  sessionKey: string;
  label: string | null;
  updatedAt: number;
  spawnDepth: number;
  origin: SessionOrigin | null;
}

export interface ChannelInfo {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  connected: boolean;
  subChannels: number;
}

export type AgentStatus = 'active' | 'idle' | 'complete' | 'failed';
