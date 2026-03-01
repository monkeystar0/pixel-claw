interface MonitorButtonProps {
  onClick: () => void
}

const btnStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: '50%',
  transform: 'translateY(-50%)',
  writingMode: 'vertical-rl',
  textOrientation: 'mixed',
  background: 'rgba(26, 26, 46, 0.9)',
  border: '1px solid #4a4a6a',
  borderRight: 'none',
  borderRadius: '4px 0 0 4px',
  padding: '12px 6px',
  fontFamily: 'monospace',
  fontSize: 10,
  letterSpacing: 2,
  color: '#4aff4a',
  cursor: 'pointer',
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  textTransform: 'uppercase',
}

export function MonitorButton({ onClick }: MonitorButtonProps) {
  return (
    <button
      style={btnStyle}
      onClick={onClick}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(42, 42, 70, 0.95)'
        e.currentTarget.style.color = '#6fff6f'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(26, 26, 46, 0.9)'
        e.currentTarget.style.color = '#4aff4a'
      }}
      title="Agent Monitoring System (M)"
    >
      <span style={{ fontSize: 12 }}>{'⣿'}</span>
      {'Monitor'}
    </button>
  )
}
