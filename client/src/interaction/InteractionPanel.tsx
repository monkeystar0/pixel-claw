import type { InteractionTab } from './useInteraction.js'
import type { SessionData } from '../hooks/useWebSocket.js'

interface InteractionPanelProps {
  session: SessionData
  activeTab: InteractionTab
  onTabChange: (tab: InteractionTab) => void
  onClose: () => void
  children?: React.ReactNode
}

const TABS: Array<{ id: InteractionTab; label: string }> = [
  { id: 'status', label: 'Status' },
  { id: 'chat', label: 'Chat' },
  { id: 'actions', label: 'Actions' },
]

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 420,
  maxHeight: '80vh',
  background: '#1a1a2e',
  border: '2px solid #4a4a6a',
  borderRadius: 2,
  fontFamily: 'monospace',
  color: '#e0e0e0',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
  imageRendering: 'pixelated',
  overflow: 'hidden',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  background: '#252540',
  borderBottom: '1px solid #4a4a6a',
}

const titleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 'bold',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
}

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #5a5a7a',
  color: '#aaa',
  cursor: 'pointer',
  padding: '2px 6px',
  fontFamily: 'monospace',
  fontSize: 11,
  borderRadius: 2,
  marginLeft: 8,
}

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid #4a4a6a',
}

const contentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: 12,
  minHeight: 200,
}

function getTabStyle(isActive: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '6px 0',
    textAlign: 'center',
    fontSize: 11,
    cursor: 'pointer',
    border: 'none',
    borderBottom: isActive ? '2px solid #4a9eff' : '2px solid transparent',
    background: isActive ? '#252540' : '#1a1a2e',
    color: isActive ? '#fff' : '#888',
    fontFamily: 'monospace',
    transition: 'all 0.1s',
  }
}

export function InteractionPanel({
  session,
  activeTab,
  onTabChange,
  onClose,
  children,
}: InteractionPanelProps) {
  return (
    <div style={panelStyle} onClick={e => e.stopPropagation()}>
      <div style={headerStyle}>
        <span style={titleStyle}>{session.label || session.sessionId}</span>
        <button style={closeButtonStyle} onClick={onClose}>
          ESC
        </button>
      </div>
      <div style={tabBarStyle}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            style={getTabStyle(activeTab === tab.id)}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={contentStyle}>
        {children}
      </div>
    </div>
  )
}
