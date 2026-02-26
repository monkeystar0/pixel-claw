interface HelpOverlayProps {
  onClose: () => void
}

const controls = [
  { key: 'WASD / Arrows', desc: 'Move character' },
  { key: 'E / Space', desc: 'Interact with agent' },
  { key: 'Escape', desc: 'Close panel' },
  { key: '?', desc: 'Toggle this help' },
]

export function HelpOverlay({ onClose }: HelpOverlayProps) {
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
          Controls
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {controls.map(c => (
            <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
              <span style={{
                padding: '2px 8px',
                background: '#252540',
                border: '1px solid #3a3a5a',
                borderRadius: 2,
                fontSize: 11,
                whiteSpace: 'nowrap',
              }}>
                {c.key}
              </span>
              <span style={{ fontSize: 12, color: '#aaa' }}>{c.desc}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 10, color: '#555' }}>
          Click anywhere or press ? to close
        </div>
      </div>
    </div>
  )
}
