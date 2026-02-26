import { useState, useCallback } from 'react'
import type { SessionData } from '../hooks/useWebSocket.js'

interface ActionsTabProps {
  session: SessionData
  onAbort: (sessionId: string) => void
  onClose: () => void
}

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 16px',
  border: '1px solid',
  borderRadius: 2,
  fontFamily: 'monospace',
  fontSize: 12,
  cursor: 'pointer',
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const confirmOverlay: React.CSSProperties = {
  padding: 12,
  background: 'rgba(255, 50, 50, 0.08)',
  border: '1px solid rgba(255, 50, 50, 0.3)',
  borderRadius: 2,
  marginTop: 8,
}

export function ActionsTab({ session, onAbort, onClose }: ActionsTabProps) {
  const [confirmAction, setConfirmAction] = useState<'abort' | null>(null)
  const [actionResult, setActionResult] = useState<string | null>(null)

  const handleAbort = useCallback(() => {
    onAbort(session.sessionId)
    setConfirmAction(null)
    setActionResult('Session abort sent')
    setTimeout(() => {
      setActionResult(null)
      onClose()
    }, 1500)
  }, [session.sessionId, onAbort, onClose])

  const isRunning = session.status === 'running'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {actionResult && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(74, 255, 74, 0.1)',
          border: '1px solid rgba(74, 255, 74, 0.3)',
          borderRadius: 2,
          fontSize: 11,
          color: '#4aff4a',
          textAlign: 'center',
        }}>
          {actionResult}
        </div>
      )}

      <button
        style={{
          ...buttonStyle,
          background: isRunning ? 'rgba(255, 100, 50, 0.08)' : 'rgba(255,255,255,0.02)',
          borderColor: isRunning ? 'rgba(255, 100, 50, 0.3)' : 'rgba(255,255,255,0.08)',
          color: isRunning ? '#ff9966' : '#555',
          cursor: isRunning ? 'pointer' : 'not-allowed',
          opacity: isRunning ? 1 : 0.5,
        }}
        onClick={() => isRunning && setConfirmAction('abort')}
        disabled={!isRunning}
      >
        <span style={{ fontWeight: 'bold' }}>Abort Session</span>
        <span style={{ fontSize: 10, opacity: 0.7 }}>
          Force stop the agent immediately
        </span>
      </button>

      {confirmAction === 'abort' && (
        <div style={confirmOverlay}>
          <div style={{ fontSize: 12, color: '#ff6666', marginBottom: 8 }}>
            Force abort? The agent will stop immediately.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={{
                flex: 1,
                padding: '6px 12px',
                background: '#5a2020',
                border: '1px solid #8a3030',
                borderRadius: 2,
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: 11,
                cursor: 'pointer',
              }}
              onClick={handleAbort}
            >
              Confirm Abort
            </button>
            <button
              style={{
                flex: 1,
                padding: '6px 12px',
                background: '#252540',
                border: '1px solid #4a4a6a',
                borderRadius: 2,
                color: '#aaa',
                fontFamily: 'monospace',
                fontSize: 11,
                cursor: 'pointer',
              }}
              onClick={() => setConfirmAction(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!isRunning && (
        <div style={{
          padding: 12,
          textAlign: 'center',
          fontSize: 11,
          color: '#555',
        }}>
          Session is {session.status} — no actions available
        </div>
      )}
    </div>
  )
}
