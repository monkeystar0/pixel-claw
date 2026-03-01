import { useState, useCallback, useRef, useEffect } from 'react'
import type { SessionData, ChatMessage } from '../hooks/useWebSocket.js'

interface ChatTabProps {
  session: SessionData
  onSendPrompt: (sessionId: string, message: string) => void
  onGetHistory: (sessionId: string, limit?: number) => void
  messages: ChatMessage[]
  isPending: boolean
}

const messageListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  maxHeight: 300,
  overflowY: 'auto',
  marginBottom: 12,
  paddingRight: 4,
}

const inputContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '6px 8px',
  background: '#0a0a1a',
  border: '1px solid #3a3a5a',
  borderRadius: 2,
  color: '#e0e0e0',
  fontFamily: 'monospace',
  fontSize: 12,
  outline: 'none',
}

const sendButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: '#2a4a7a',
  border: '1px solid #4a6a9a',
  borderRadius: 2,
  color: '#fff',
  fontFamily: 'monospace',
  fontSize: 11,
  cursor: 'pointer',
}

function getMessageStyle(role: string): React.CSSProperties {
  const isUser = role === 'user'
  return {
    padding: '6px 8px',
    background: isUser ? 'rgba(74, 158, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)',
    border: `1px solid ${isUser ? 'rgba(74, 158, 255, 0.2)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 2,
    fontSize: 11,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: 120,
    overflow: 'auto',
  }
}

const roleLabelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 'bold',
  textTransform: 'uppercase',
  marginBottom: 2,
  letterSpacing: 1,
}

export function ChatTab({ session, onSendPrompt, onGetHistory, messages, isPending }: ChatTabProps) {
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const lastFetchedAtRef = useRef(0)
  const fetchThrottleRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    onGetHistory(session.sessionId, 20)
    lastFetchedAtRef.current = session.updatedAt
    return () => clearTimeout(fetchThrottleRef.current)
  }, [session.sessionId, onGetHistory])

  useEffect(() => {
    if (session.updatedAt <= lastFetchedAtRef.current) return
    clearTimeout(fetchThrottleRef.current)
    fetchThrottleRef.current = setTimeout(() => {
      lastFetchedAtRef.current = session.updatedAt
      onGetHistory(session.sessionId, 20)
    }, 800)
  }, [session.updatedAt, session.sessionId, onGetHistory])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, isPending])

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || isPending) return
    onSendPrompt(session.sessionId, trimmed)
    setInput('')
  }, [input, isPending, session.sessionId, onSendPrompt])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    e.stopPropagation()
  }, [handleSend])

  return (
    <div>
      <div ref={listRef} style={messageListStyle}>
        {messages.length === 0 && (
          <div style={{ color: '#555', fontSize: 11, textAlign: 'center', padding: 20 }}>
            No messages yet
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i}>
            <div style={{
              ...roleLabelStyle,
              color: msg.role === 'user' ? '#4a9eff' : '#8a8a9a',
            }}>
              {msg.role}
            </div>
            <div style={getMessageStyle(msg.role)}>
              {msg.content}
            </div>
          </div>
        ))}
        {isPending && messages[messages.length - 1]?.role !== 'assistant' && (
          <div style={{ color: '#6a6a8a', fontSize: 11, padding: '4px 0' }}>
            <span style={{ animation: 'pulse 1.2s infinite' }}>Thinking...</span>
          </div>
        )}
      </div>

      <div style={inputContainerStyle}>
        <input
          style={inputStyle}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isPending ? 'Waiting for response...' : 'Type a message...'}
          disabled={isPending}
        />
        <button
          style={{
            ...sendButtonStyle,
            opacity: isPending || !input.trim() ? 0.5 : 1,
          }}
          onClick={handleSend}
          disabled={isPending || !input.trim()}
        >
          {isPending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
