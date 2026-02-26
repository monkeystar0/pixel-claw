import { useCallback } from 'react'

interface RoomInfo {
  id: string
  name: string
  agentCount: number
}

interface RoomSelectorProps {
  rooms: RoomInfo[]
  currentRoomId: string | null
  onSelectRoom: (roomId: string) => void
}

const styles = {
  container: {
    position: 'absolute' as const,
    bottom: 12,
    left: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    fontFamily: 'monospace',
    fontSize: 11,
    pointerEvents: 'auto' as const,
  },
  button: {
    display: 'flex',
    alignItems: 'center' as const,
    gap: 6,
    padding: '4px 8px',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 4,
    cursor: 'pointer',
    color: '#ccc',
    transition: 'all 0.15s',
  },
  active: {
    background: 'rgba(0, 127, 212, 0.3)',
    borderColor: 'rgba(0, 127, 212, 0.6)',
    color: '#fff',
  },
  inactive: {
    background: 'rgba(30, 30, 50, 0.7)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  count: {
    marginLeft: 'auto',
    opacity: 0.6,
  },
}

export function RoomSelector({ rooms, currentRoomId, onSelectRoom }: RoomSelectorProps) {
  const handleClick = useCallback(
    (roomId: string) => {
      if (roomId !== currentRoomId) {
        onSelectRoom(roomId)
      }
    },
    [currentRoomId, onSelectRoom],
  )

  return (
    <div style={styles.container}>
      {rooms.map(room => {
        const isActive = room.id === currentRoomId
        return (
          <button
            key={room.id}
            onClick={() => handleClick(room.id)}
            style={{
              ...styles.button,
              ...(isActive ? styles.active : styles.inactive),
            }}
          >
            <span
              style={{
                ...styles.dot,
                background: isActive ? '#4af' : '#555',
              }}
            />
            <span>{room.name}</span>
            {room.agentCount > 0 && (
              <span style={styles.count}>{room.agentCount}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
