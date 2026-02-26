interface RoomIndicatorProps {
  roomName: string
  channelStatus?: 'connected' | 'disconnected' | null
}

export function RoomIndicator({ roomName, channelStatus }: RoomIndicatorProps) {
  return (
    <div style={{
      position: 'absolute',
      top: 8,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '4px 12px',
      background: 'rgba(26, 26, 46, 0.85)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 4,
      fontFamily: 'monospace',
      fontSize: 12,
      color: '#ccc',
    }}>
      <span style={{ fontWeight: 'bold' }}>{roomName}</span>
      {channelStatus && (
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: channelStatus === 'connected' ? '#4aff4a' : '#ff4a4a',
        }} />
      )}
    </div>
  )
}
