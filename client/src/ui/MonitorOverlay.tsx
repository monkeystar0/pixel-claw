import { useRef, useEffect, useMemo, useState } from 'react'
import type { SessionData, ChannelInfo, GatewayLogEntry } from '../hooks/useWebSocket.js'

interface MonitorOverlayProps {
  sessions: SessionData[]
  channels: ChannelInfo[]
  connected: boolean
  gatewayConnected: boolean
  gatewayLog: GatewayLogEntry[]
  onClose: () => void
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatElapsed(sec: number): string {
  if (sec < 0) sec = 0
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}

function formatLogTime(ts: string): string {
  const d = new Date(ts)
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return `${date} ${time}`
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.substring(0, max) + '…' : s
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'running': return '#4aff4a'
    case 'complete': return '#4a9eff'
    case 'failed': return '#ff4a4a'
    default: return '#888'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'running': return 'RUN'
    case 'complete': return 'DONE'
    case 'failed': return 'FAIL'
    default: return status.toUpperCase()
  }
}

function deriveSessionName(s: SessionData): { name: string; tag: string | null } {
  const alias = s.sessionAlias ?? ''

  if (alias === 'global' || alias === 'agent:main:global') {
    return { name: 'Global Agent', tag: null }
  }

  if (alias === 'agent:main:main') {
    return { name: 'Main Session', tag: 'webchat' }
  }

  if (s.origin?.label) {
    const provider = s.origin.provider ?? ''
    const isThread = alias.includes(':thread:')
    const prefix = isThread ? 'Thread' : 'Channel'
    return {
      name: `${prefix} ${s.origin.label}`,
      tag: provider || null,
    }
  }

  if (s.origin?.provider && s.origin.provider !== 'webchat') {
    const parts = alias.split(':')
    const channelId = parts.find((_p, i) => parts[i - 1] === 'channel' && !parts[i + 1]?.startsWith('thread'))
    const isThread = alias.includes(':thread:')
    return {
      name: `${s.origin.provider} ${isThread ? 'Thread' : 'Channel'} ${channelId?.substring(0, 8) ?? ''}`,
      tag: s.origin.provider,
    }
  }

  if (s.label && s.label !== s.sessionId) {
    return { name: s.label.substring(0, 30), tag: null }
  }

  return { name: s.sessionId.substring(0, 12) + '...', tag: null }
}


const SCANLINE_BG = `repeating-linear-gradient(
  0deg,
  transparent,
  transparent 2px,
  rgba(0,0,0,0.06) 2px,
  rgba(0,0,0,0.06) 4px
)`

const backdrop: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.85)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 200,
  fontFamily: 'monospace',
  color: '#e0e0e0',
}

const panel: React.CSSProperties = {
  background: '#0d0d1a',
  border: '2px solid #4a4a6a',
  borderRadius: 2,
  width: '96vw',
  maxWidth: 1200,
  height: '94vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  backgroundImage: SCANLINE_BG,
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 16px',
  borderBottom: '2px solid #4a4a6a',
  background: '#1a1a2e',
  flexShrink: 0,
}

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 'bold',
  letterSpacing: 3,
  color: '#4aff4a',
  textTransform: 'uppercase',
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #4a4a6a',
  color: '#888',
  fontFamily: 'monospace',
  fontSize: 11,
  padding: '2px 8px',
  cursor: 'pointer',
  borderRadius: 2,
}

const topRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '8px 12px',
  borderBottom: '1px solid #2a2a4a',
  flexShrink: 0,
}

const miniPanel: React.CSSProperties = {
  flex: 1,
  background: '#1a1a2e',
  border: '1px solid #3a3a5a',
  borderRadius: 2,
  padding: '6px 10px',
  fontSize: 11,
}

const miniTitle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 'bold',
  letterSpacing: 2,
  color: '#666',
  textTransform: 'uppercase',
  marginBottom: 4,
}

const sectionHeader: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 'bold',
  letterSpacing: 2,
  color: '#666',
  textTransform: 'uppercase',
  padding: '6px 12px 2px',
  flexShrink: 0,
}

const GRID_COLS = '1.4fr 60px 120px 120px 70px 160px'

const tableHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: GRID_COLS,
  gap: 4,
  padding: '4px 12px',
  fontSize: 9,
  color: '#555',
  letterSpacing: 1,
  textTransform: 'uppercase',
  borderBottom: '1px solid #2a2a4a',
  flexShrink: 0,
}

const tableRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: GRID_COLS,
  gap: 4,
  padding: '5px 12px',
  fontSize: 11,
  borderBottom: '1px solid rgba(255,255,255,0.03)',
  alignItems: 'center',
  cursor: 'pointer',
  transition: 'background 0.1s',
}

const feedContainer: React.CSSProperties = {
  flex: 1,
  minHeight: 80,
  maxHeight: 160,
  overflowY: 'auto',
  padding: '4px 12px 8px',
  flexShrink: 0,
}

const feedLine: React.CSSProperties = {
  fontSize: 10,
  padding: '1px 0',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const dot = (color: string, blink = false): React.CSSProperties => ({
  display: 'inline-block',
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: color,
  marginRight: 6,
  flexShrink: 0,
  animation: blink ? 'monitor-blink 1s step-end infinite' : undefined,
})

const tagStyle = (provider: string): React.CSSProperties => {
  const colors: Record<string, string> = {
    slack: '#4a154b',
    discord: '#5865f2',
    telegram: '#0088cc',
    webchat: '#2a4a2a',
  }
  return {
    fontSize: 8,
    padding: '1px 5px',
    borderRadius: 2,
    background: colors[provider.toLowerCase()] ?? '#333',
    color: '#ccc',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 6,
    flexShrink: 0,
  }
}

const detailPanel: React.CSSProperties = {
  padding: '8px 16px 10px',
  background: '#12122a',
  borderBottom: '1px solid #2a2a4a',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '4px 24px',
  fontSize: 10,
}

const detailLabel: React.CSSProperties = { color: '#555' }
const detailValue: React.CSSProperties = { color: '#ccc', textAlign: 'right' as const }

const blinkKeyframes = `
@keyframes monitor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
`

function TokenBar({ usage }: { usage: SessionData['tokenUsage'] }) {
  if (!usage) return <span style={{ color: '#444' }}>-</span>

  return (
    <span style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 9 }}>
      <span style={{ color: '#4aff4a' }} title="Input tokens">
        {'↑'}{formatTokens(usage.inputTokens)}
      </span>
      <span style={{ color: '#ff9f4a' }} title="Output tokens">
        {'↓'}{formatTokens(usage.outputTokens)}
      </span>
      {usage.cacheRead > 0 && (
        <span style={{ color: '#888' }} title="Cache read">
          {'⟲'}{formatTokens(usage.cacheRead)}
        </span>
      )}
    </span>
  )
}

function SessionDetail({ session }: { session: SessionData }) {
  const t = session.tokenUsage
  return (
    <div style={detailPanel}>
      <div>
        <div style={{ marginBottom: 4 }}>
          <span style={detailLabel}>Session ID: </span>
          <span style={{ ...detailValue, fontSize: 9, color: '#666' }}>{session.sessionId}</span>
        </div>
        {session.sessionAlias && (
          <div style={{ marginBottom: 4 }}>
            <span style={detailLabel}>Alias: </span>
            <span style={{ ...detailValue, fontSize: 9, color: '#888' }}>{session.sessionAlias}</span>
          </div>
        )}
        <div style={{ marginBottom: 4 }}>
          <span style={detailLabel}>Label: </span>
          <span style={{ ...detailValue, color: '#aaa' }}>{session.label}</span>
        </div>
        {session.origin?.provider && (
          <div style={{ marginBottom: 4 }}>
            <span style={detailLabel}>Origin: </span>
            <span style={detailValue}>
              {session.origin.provider}
              {session.origin.label ? ` ${session.origin.label}` : ''}
            </span>
          </div>
        )}
        {session.errorDetails && (
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: '#ff4a4a' }}>Error: </span>
            <span style={{ color: '#ff8888', fontSize: 9 }}>{session.errorDetails}</span>
          </div>
        )}
        {session.recentTools.length > 0 && (
          <div>
            <span style={detailLabel}>Recent tools: </span>
            <span style={{ color: '#ffcc4a', fontSize: 9 }}>{session.recentTools.join(' → ')}</span>
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 9, color: '#555', marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase' }}>
          Token Breakdown
        </div>
        {t ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px' }}>
            <span style={detailLabel}>Input:</span>
            <span style={{ ...detailValue, color: '#4aff4a' }}>{t.inputTokens.toLocaleString()}</span>
            <span style={detailLabel}>Output:</span>
            <span style={{ ...detailValue, color: '#ff9f4a' }}>{t.outputTokens.toLocaleString()}</span>
            <span style={detailLabel}>Total:</span>
            <span style={{ ...detailValue, color: '#fff' }}>{t.totalTokens.toLocaleString()}</span>
            <span style={detailLabel}>Context Window:</span>
            <span style={detailValue}>{t.contextTokens.toLocaleString()}</span>
            <span style={detailLabel}>Cache Read:</span>
            <span style={detailValue}>{t.cacheRead.toLocaleString()}</span>
            <span style={detailLabel}>Cache Write:</span>
            <span style={detailValue}>{t.cacheWrite.toLocaleString()}</span>
          </div>
        ) : (
          <span style={{ color: '#444' }}>No token data</span>
        )}
      </div>
    </div>
  )
}

export function MonitorOverlay({ sessions, channels, connected, gatewayConnected, gatewayLog, onClose }: MonitorOverlayProps) {
  const feedRef = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const failedSessions = useMemo(() => sessions.filter(s => s.status === 'failed'), [sessions])

  const totalTokens = useMemo(() => {
    let input = 0, output = 0, total = 0
    for (const s of sessions) {
      if (s.tokenUsage) {
        input += s.tokenUsage.inputTokens
        output += s.tokenUsage.outputTokens
        total += s.tokenUsage.totalTokens
      }
    }
    return { input, output, total }
  }, [sessions])

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = 0
    }
  }, [gatewayLog])

  const sortedSessions = useMemo(() =>
    [...sessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    [sessions])

  return (
    <>
      <style>{blinkKeyframes}</style>
      <div style={backdrop} onClick={onClose}>
        <div style={panel} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={headerStyle}>
            <span style={titleStyle}>{'>> Agent Monitoring System <<'}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 9, color: '#555' }}>Press M to close</span>
              <button style={closeBtnStyle} onClick={onClose}>[X]</button>
            </div>
          </div>

          {/* Top Row: Gateway / Channels / Alerts */}
          <div style={topRow}>
            <div style={miniPanel}>
              <div style={miniTitle}>Connection</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={dot(gatewayConnected ? '#4aff4a' : '#ff4a4a', !gatewayConnected)} />
                  <span style={{ color: gatewayConnected ? '#4aff4a' : '#ff4a4a', fontWeight: 'bold', fontSize: 10 }}>
                    Gateway: {gatewayConnected ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={dot(connected ? '#4aff4a' : '#ff4a4a', !connected)} />
                  <span style={{ color: connected ? '#4a9eff' : '#ff4a4a', fontWeight: 'bold', fontSize: 10 }}>
                    Server: {connected ? 'OK' : 'LOST'}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: 4, fontSize: 10, color: '#555' }}>
                Sessions: {sessions.length}
              </div>
              <div style={{ fontSize: 10, color: '#555' }}>
                Tokens: {'↑'}{formatTokens(totalTokens.input)} {'↓'}{formatTokens(totalTokens.output)} ({formatTokens(totalTokens.total)} total)
              </div>
            </div>

            <div style={miniPanel}>
              <div style={miniTitle}>Channels</div>
              {channels.length === 0 && (
                <div style={{ color: '#555', fontSize: 10 }}>No channels configured</div>
              )}
              {channels.map(ch => (
                <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
                  <span style={dot(ch.connected ? '#4aff4a' : ch.enabled ? '#ffcc4a' : '#ff4a4a')} />
                  <span style={{ fontSize: 10, color: ch.connected ? '#ccc' : '#888', fontWeight: 'bold' }}>
                    {ch.name}
                  </span>
                  {ch.subChannels > 0 && (
                    <span style={{ fontSize: 9, color: '#555' }}>
                      ({ch.subChannels} ch)
                    </span>
                  )}
                  <span style={{
                    fontSize: 9,
                    marginLeft: 'auto',
                    color: ch.connected ? '#4aff4a' : ch.enabled ? '#ffcc4a' : '#ff4a4a',
                    fontWeight: 'bold',
                  }}>
                    {ch.connected ? 'LIVE' : ch.enabled ? 'IDLE' : 'OFF'}
                  </span>
                </div>
              ))}
            </div>

            {(() => {
              const alerts: { key: string; text: string }[] = []
              if (!connected) alerts.push({ key: 'srv', text: 'Backend server unreachable' })
              if (!gatewayConnected) alerts.push({ key: 'gw', text: 'Gateway offline' })
              for (const s of failedSessions) {
                const { name } = deriveSessionName(s)
                alerts.push({ key: s.sessionId, text: `${name} — FAILED` })
              }
              const hasAlerts = alerts.length > 0

              return (
                <div style={{
                  ...miniPanel,
                  borderColor: hasAlerts ? '#5a2020' : '#3a3a5a',
                  background: hasAlerts ? '#1a0d0d' : '#1a1a2e',
                }}>
                  <div style={miniTitle}>Alerts</div>
                  {!hasAlerts ? (
                    <div style={{ color: '#4aff4a', fontSize: 10 }}>All systems nominal</div>
                  ) : (
                    alerts.map(a => (
                      <div key={a.key} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '1px 0',
                        animation: 'monitor-blink 2s step-end infinite',
                      }}>
                        <span style={{ color: '#ff4a4a', fontSize: 10 }}>!</span>
                        <span style={{
                          fontSize: 10,
                          color: '#ff6666',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {a.text}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )
            })()}
          </div>

          {/* Session Table */}
          <div style={sectionHeader}>Sessions ({sessions.length})</div>
          <div style={tableHeaderStyle}>
            <span>Name</span>
            <span>Status</span>
            <span>Model</span>
            <span>Tool</span>
            <span>Elapsed</span>
            <span>Tokens (in/out)</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {sortedSessions.map(s => {
              const { name, tag } = deriveSessionName(s)
              const isSelected = selectedId === s.sessionId
              return (
                <div key={s.sessionId}>
                  <div
                    style={{
                      ...tableRowStyle,
                      background: isSelected
                        ? 'rgba(74,154,255,0.08)'
                        : s.status === 'failed'
                          ? 'rgba(255,50,50,0.05)'
                          : 'transparent',
                    }}
                    onClick={() => setSelectedId(isSelected ? null : s.sessionId)}
                  >
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: '#ccc',
                      display: 'flex',
                      alignItems: 'center',
                    }}>
                      <span style={{ color: isSelected ? '#fff' : '#ccc' }}>{name}</span>
                      {tag && <span style={tagStyle(tag)}>{tag}</span>}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={dot(getStatusColor(s.status), s.status === 'running')} />
                      <span style={{
                        color: getStatusColor(s.status),
                        fontWeight: 'bold',
                        fontSize: 9,
                      }}>
                        {getStatusLabel(s.status)}
                      </span>
                    </span>
                    <span style={{
                      color: '#888',
                      fontSize: 10,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {s.model?.split('/').pop() ?? '-'}
                    </span>
                    <span style={{
                      color: s.currentTool ? '#ffcc4a' : '#444',
                      fontSize: 10,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {s.currentTool ?? '-'}
                    </span>
                    <span style={{ color: '#aaa', fontSize: 10 }}>
                      {formatElapsed(s.elapsed)}
                    </span>
                    <TokenBar usage={s.tokenUsage} />
                  </div>
                  {isSelected && <SessionDetail session={s} />}
                </div>
              )
            })}
            {sessions.length === 0 && (
              <div style={{ padding: '12px', color: '#444', fontSize: 11, textAlign: 'center' }}>
                No active sessions
              </div>
            )}
          </div>

          {/* Activity Feed — gateway.log */}
          <div style={sectionHeader}>Activity Feed (gateway.log)</div>
          <div ref={feedRef} style={feedContainer}>
            {gatewayLog.length === 0 && (
              <div style={{ color: '#444', fontSize: 10, textAlign: 'center', padding: 8 }}>
                Waiting for gateway activity...
              </div>
            )}
            {gatewayLog.map((entry, i) => {
              const levelColor = entry.level === 'error' ? '#ff4a4a'
                : entry.level === 'warn' ? '#ffcc4a'
                : '#555'
              return (
                <div key={`${entry.timestamp}-${i}`} style={feedLine}>
                  <span style={{ color: '#555' }}>[{formatLogTime(entry.timestamp)}]</span>
                  {' '}
                  <span style={{ color: '#4a9eff' }}>[{entry.category}]</span>
                  {' '}
                  <span style={{ color: levelColor }}>{truncate(entry.message, 100)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
