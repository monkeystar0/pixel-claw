interface SettingsProps {
  gatewayConnected: boolean
  sessionCount: number
  onClose: () => void
}

export function Settings({ gatewayConnected, sessionCount, onClose }: SettingsProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1a1a2e',
          border: '2px solid #4a4a6a',
          borderRadius: 2,
          padding: 24,
          fontFamily: 'monospace',
          color: '#e0e0e0',
          minWidth: 280,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 16 }}>
          Settings
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 0',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ fontSize: 12, color: '#888' }}>Backend</span>
            <span style={{
              fontSize: 11,
              color: gatewayConnected ? '#4aff4a' : '#ff4a4a',
            }}>
              {gatewayConnected ? '● Connected' : '● Disconnected'}
            </span>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 0',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ fontSize: 12, color: '#888' }}>Active Sessions</span>
            <span style={{ fontSize: 11 }}>{sessionCount}</span>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '6px 12px',
            background: '#252540',
            border: '1px solid #4a4a6a',
            borderRadius: 2,
            color: '#aaa',
            fontFamily: 'monospace',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
