import type { SessionData } from '../hooks/useWebSocket.js'

interface StatusTabProps {
  session: SessionData
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return min > 0 ? `${min}m ${sec.toString().padStart(2, '0')}s` : `${sec}s`
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'running': return '#4aff4a'
    case 'complete': return '#4a9eff'
    case 'failed': return '#ff4a4a'
    default: return '#888'
  }
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px 0',
  fontSize: 12,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
}

const labelStyle: React.CSSProperties = {
  color: '#888',
  flexShrink: 0,
  marginRight: 12,
}

const valueStyle: React.CSSProperties = {
  textAlign: 'right',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

export function StatusTab({ session }: StatusTabProps) {
  const origin = session.origin
  const originLabel = origin?.label
    || (origin?.provider && origin?.surface
      ? `${origin.provider} ${origin.surface}`
      : origin?.provider || null)

  return (
    <div>
      <div style={rowStyle}>
        <span style={labelStyle}>Status</span>
        <span style={{
          ...valueStyle,
          color: getStatusColor(session.status),
          fontWeight: 'bold',
        }}>
          {session.status === 'running' ? '● Running' : session.status === 'complete' ? '✓ Complete' : '✗ Failed'}
        </span>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>Elapsed</span>
        <span style={valueStyle}>{formatElapsed(session.elapsed)}</span>
      </div>

      {session.currentTool && (
        <div style={rowStyle}>
          <span style={labelStyle}>Tool</span>
          <span style={{ ...valueStyle, color: '#ffcc4a' }}>
            {session.currentTool}
          </span>
        </div>
      )}

      {session.currentToolArgs && (
        <div style={{
          padding: '4px 8px',
          margin: '4px 0',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 2,
          fontSize: 10,
          color: '#999',
          maxHeight: 60,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}>
          {session.currentToolArgs}
        </div>
      )}

      <div style={rowStyle}>
        <span style={labelStyle}>Tools Used</span>
        <span style={valueStyle}>{session.toolCount}</span>
      </div>

      {session.recentTools.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          padding: '6px 0',
        }}>
          {session.recentTools.slice(-5).map((tool, i) => (
            <span key={i} style={{
              padding: '2px 6px',
              background: '#252540',
              border: '1px solid #3a3a5a',
              borderRadius: 2,
              fontSize: 10,
              color: '#aaa',
            }}>
              {tool}
            </span>
          ))}
        </div>
      )}

      {originLabel && (
        <div style={rowStyle}>
          <span style={labelStyle}>Origin</span>
          <span style={{
            ...valueStyle,
            padding: '2px 6px',
            background: '#1a2a4a',
            border: '1px solid #2a4a7a',
            borderRadius: 2,
            fontSize: 10,
          }}>
            {originLabel}
          </span>
        </div>
      )}

      {session.errorDetails && (
        <div style={{
          marginTop: 8,
          padding: 8,
          background: 'rgba(255, 50, 50, 0.1)',
          border: '1px solid rgba(255, 50, 50, 0.3)',
          borderRadius: 2,
          fontSize: 11,
          color: '#ff6666',
          maxHeight: 80,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
        }}>
          {session.errorDetails}
        </div>
      )}
    </div>
  )
}
