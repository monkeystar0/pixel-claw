import { describe, it, expect } from 'vitest';
import { parseSessionFile, parseSessionLine, extractLabel } from '../../src/openclaw/sessionParser.js';
import { join } from 'node:path';

describe('sessionParser', () => {
  const fixturePath = join(import.meta.dirname, '../fixtures/sample-session.jsonl');

  describe('parseSessionLine', () => {
    it('should detect toolCall in assistant messages', () => {
      const line = JSON.stringify({
        type: 'message',
        id: 'msg1',
        timestamp: '2026-02-27T00:00:00Z',
        message: {
          role: 'assistant',
          content: [
            { type: 'toolCall', id: 'read_001', name: 'Read', arguments: { file_path: '/test.ts' } }
          ]
        }
      });
      const result = parseSessionLine(line);
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('Read');
    });

    it('should extract user message content', () => {
      const line = JSON.stringify({
        type: 'message',
        id: 'msg2',
        timestamp: '2026-02-27T00:00:00Z',
        message: { role: 'user', content: 'Build a REST API' }
      });
      const result = parseSessionLine(line);
      expect(result.chatMessage?.role).toBe('user');
      expect(result.chatMessage?.content).toBe('Build a REST API');
    });

    it('should extract user message from content array', () => {
      const line = JSON.stringify({
        type: 'message',
        id: 'msg3',
        timestamp: '2026-02-27T00:00:00Z',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'Fix the login bug' }]
        }
      });
      const result = parseSessionLine(line);
      expect(result.chatMessage?.role).toBe('user');
      expect(result.chatMessage?.content).toBe('Fix the login bug');
    });

    it('should detect errors in toolResult messages', () => {
      const line = JSON.stringify({
        type: 'message',
        id: 'msg4',
        timestamp: '2026-02-27T00:00:00Z',
        message: {
          role: 'toolResult',
          toolCallId: 'read_001',
          toolName: 'Read',
          isError: true,
          content: [{ type: 'text', text: 'File not found' }]
        }
      });
      const result = parseSessionLine(line);
      expect(result.error).toBe('File not found');
    });

    it('should extract assistant text content', () => {
      const line = JSON.stringify({
        type: 'message',
        id: 'msg5',
        timestamp: '2026-02-27T00:00:00Z',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Here is my analysis.' }]
        }
      });
      const result = parseSessionLine(line);
      expect(result.chatMessage?.role).toBe('assistant');
      expect(result.chatMessage?.content).toBe('Here is my analysis.');
    });
  });

  describe('extractLabel', () => {
    it('should extract label from spawn details', () => {
      const line = { type: 'toolResult', details: { label: 'Deploy service' } };
      expect(extractLabel(line)).toBe('Deploy service');
    });

    it('should extract label from first user message string', () => {
      const line = {
        type: 'message',
        message: { role: 'user', content: 'Please fix the login bug in the authentication module' }
      };
      expect(extractLabel(line)?.length).toBeLessThanOrEqual(40);
    });

    it('should extract label from user message content array', () => {
      const line = {
        type: 'message',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'Short task label' }]
        }
      };
      expect(extractLabel(line)).toBe('Short task label');
    });

    it('should truncate long labels', () => {
      const line = {
        type: 'message',
        message: { role: 'user', content: 'A very long message that exceeds the forty character limit for labels' }
      };
      const label = extractLabel(line);
      expect(label).not.toBeNull();
      expect(label!.length).toBeLessThanOrEqual(40);
      expect(label!.endsWith('...')).toBe(true);
    });
  });

  describe('parseSessionFile', () => {
    it('should parse a complete session file', () => {
      const result = parseSessionFile(fixturePath);
      expect(result.status).toBeDefined();
      expect(result.toolCount).toBeGreaterThanOrEqual(0);
      expect(result.recentTools).toBeInstanceOf(Array);
    });

    it('should count tool calls correctly', () => {
      const result = parseSessionFile(fixturePath);
      expect(result.toolCount).toBe(3);
      expect(result.recentTools).toEqual(['Read', 'Write', 'Bash']);
    });

    it('should extract label from first user message', () => {
      const result = parseSessionFile(fixturePath);
      expect(result.label).toBe('Build a REST API for the user managem...');
    });

    it('should extract start time from session header', () => {
      const result = parseSessionFile(fixturePath);
      expect(result.startTime).toBe(new Date('2026-02-27T00:00:00.000Z').getTime());
    });

    it('should return null for non-existent file', () => {
      const result = parseSessionFile('/nonexistent/path.jsonl');
      expect(result).toBeNull();
    });
  });
});
