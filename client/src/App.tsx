import { useRef, useEffect, useCallback, useState } from 'react'
import { useWebSocket } from './hooks/useWebSocket.js'
import { useWorld } from './hooks/useWorld.js'
import { useGameInput } from './hooks/useGameInput.js'
import { useInteraction } from './interaction/useInteraction.js'
import { createPlayer, updatePlayer, playerToCharacter, loadAppearance, getInteractTarget } from './world/engine/player.js'
import type { Player } from './world/engine/player.js'
import { Camera } from './world/engine/camera.js'
import { startGameLoop } from './world/engine/gameLoop.js'
import { renderFrame } from './world/engine/renderer.js'
import { loadAllSprites } from './world/sprites/spriteLoader.js'
import {
  createTransition,
  updateTransition,
  getTransitionAlpha,
  startTransition,
  checkPlayerDoorway,
  createDefaultRooms,
} from './world/engine/rooms.js'
import { RoomSelector } from './components/RoomSelector.js'
import { InteractionPanel } from './interaction/InteractionPanel.js'
import { StatusTab } from './interaction/StatusTab.js'
import { ChatTab } from './interaction/ChatTab.js'
import { ActionsTab } from './interaction/ActionsTab.js'
import { RoomIndicator } from './ui/RoomIndicator.js'
import { HelpOverlay } from './ui/HelpOverlay.js'
import { TILE_SIZE } from './world/types.js'
import { ZOOM_DEFAULT_DPR_FACTOR } from './world/constants.js'

const NO_KEYS = { up: false, down: false, left: false, right: false, interact: false }

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { connected, sessions, channels, chatMessages, sendPrompt, abortSession, getHistory } = useWebSocket()
  const { world, update: updateWorld, switchRoom } = useWorld(sessions)
  const keys = useGameInput()
  const [currentRoomId, setCurrentRoomId] = useState('main-hall')
  const [spritesLoaded, setSpritesLoaded] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const playerRef = useRef<Player>(
    createPlayer(5, 5, loadAppearance() ?? { palette: 0, hueShift: 0 })
  )
  const cameraRef = useRef<Camera | null>(null)
  const transitionRef = useRef(createTransition())
  const roomDefsRef = useRef(createDefaultRooms())

  useEffect(() => {
    loadAllSprites().then(() => setSpritesLoaded(true))
  }, [])

  const room = world.getCurrentRoom()
  const currentCharacters = room ? room.officeState.getCharacters() : []

  const interaction = useInteraction(sessions)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === '?' || (e.code === 'Slash' && e.shiftKey)) {
        setShowHelp(prev => !prev)
      }
      if (e.code === 'KeyE' || e.code === 'Space') {
        if (!interaction.isOpen && sessions.length > 0) {
          const p = playerRef.current
          const chars = room?.officeState.getCharacters() ?? []
          if (p && chars.length > 0) {
            let targetId = getInteractTarget(p, chars)

            if (targetId === null) {
              let bestDist = 5
              for (const ch of chars) {
                const dx = Math.abs(ch.tileCol - p.tileCol)
                const dy = Math.abs(ch.tileRow - p.tileRow)
                const dist = dx + dy
                if (dist > 0 && dist < bestDist) {
                  bestDist = dist
                  targetId = ch.id
                }
              }
            }

            if (targetId !== null) {
              const sessionId = world.getSessionByCharacterId(targetId)
              if (sessionId) {
                interaction.openPanel(sessionId)
              }
            }
          }
        } else if (interaction.isOpen) {
          interaction.closePanel()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [interaction, sessions, room, world])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !spritesLoaded) return

    const dpr = window.devicePixelRatio || 1
    const zoom = Math.round(dpr * ZOOM_DEFAULT_DPR_FACTOR)

    if (!cameraRef.current) {
      cameraRef.current = new Camera(canvas.clientWidth, canvas.clientHeight)
      cameraRef.current.enableSmooth(0.1)
    }

    const player = playerRef.current
    const camera = cameraRef.current

    const resize = () => {
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      camera.resize(canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    const cleanup = startGameLoop(canvas, {
      update(dt) {
        const transition = transitionRef.current
        const result = updateTransition(transition, dt)

        if (result.switchRoom && transition.toRoomId) {
          world.setCurrentRoom(transition.toRoomId)
          setCurrentRoomId(transition.toRoomId)
          player.tileCol = transition.targetCol
          player.tileRow = transition.targetRow
          player.x = transition.targetCol * TILE_SIZE + TILE_SIZE / 2
          player.y = transition.targetRow * TILE_SIZE + TILE_SIZE / 2
        }

        if (transition.state === 'none') {
          const currentRoom = world.getCurrentRoom()
          if (currentRoom) {
            const effectiveKeys = interaction.inputDisabled ? NO_KEYS : keys
            updatePlayer(player, effectiveKeys, dt, currentRoom.officeState.tileMap, currentRoom.officeState.blockedTiles)

            const roomDef = roomDefsRef.current.find(r => r.id === world.getCurrentRoomId())
            if (roomDef && !interaction.inputDisabled) {
              const doorway = checkPlayerDoorway(player, roomDef.doorways)
              if (doorway) {
                startTransition(
                  transition,
                  roomDef.id,
                  doorway.targetRoomId,
                  doorway.targetCol,
                  doorway.targetRow,
                )
              }
            }
          }
        }

        updateWorld(dt)

        const currentRoom = world.getCurrentRoom()
        if (currentRoom) {
          camera.setRoomBounds(
            currentRoom.layout.cols * TILE_SIZE * zoom,
            currentRoom.layout.rows * TILE_SIZE * zoom,
          )
          camera.follow(player.x * zoom, player.y * zoom)
          camera.update(dt)
        }
      },
      render(ctx) {
        ctx.save()
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
        ctx.fillStyle = '#0a0a14'
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

        const currentRoom = world.getCurrentRoom()
        if (!currentRoom) {
          ctx.restore()
          return
        }

        const agentChars = currentRoom.officeState.getCharacters()
        const playerChar = playerToCharacter(player)
        const allCharacters = [...agentChars, playerChar]

        const mapW = currentRoom.layout.cols * TILE_SIZE * zoom
        const mapH = currentRoom.layout.rows * TILE_SIZE * zoom
        const panX = -camera.x - Math.floor((ctx.canvas.width - mapW) / 2)
        const panY = -camera.y - Math.floor((ctx.canvas.height - mapH) / 2)

        renderFrame(
          ctx,
          ctx.canvas.width,
          ctx.canvas.height,
          currentRoom.officeState.tileMap,
          currentRoom.officeState.furniture,
          allCharacters,
          zoom,
          panX,
          panY,
          undefined,
          undefined,
          currentRoom.layout.tileColors,
          currentRoom.layout.cols,
          currentRoom.layout.rows,
        )

        const transition = transitionRef.current
        const alpha = getTransitionAlpha(transition)
        if (alpha < 1) {
          ctx.fillStyle = `rgba(0, 0, 0, ${1 - alpha})`
          ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
        }

        ctx.restore()
      },
    })

    return () => {
      cleanup()
      window.removeEventListener('resize', resize)
    }
  }, [spritesLoaded, world, updateWorld, keys, interaction.inputDisabled])

  const handleSelectRoom = useCallback((roomId: string) => {
    const transition = transitionRef.current
    if (transition.state !== 'none') return
    const currentId = world.getCurrentRoomId()
    if (!currentId || currentId === roomId) return
    startTransition(transition, currentId, roomId, 5, 5)
  }, [world])

  const roomInfos = roomDefsRef.current.map(r => ({
    id: r.id,
    name: r.name,
    agentCount: sessions.filter(s => (s.room || 'main-hall') === r.id).length,
  }))

  const currentRoomDef = roomDefsRef.current.find(r => r.id === currentRoomId)
  const currentMessages = interaction.sessionId
    ? chatMessages.get(interaction.sessionId) ?? []
    : []

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated' }}
      />

      <RoomIndicator
        roomName={currentRoomDef?.name ?? 'Unknown'}
        channelStatus={connected ? 'connected' : 'disconnected'}
      />

      <div style={{
        position: 'absolute',
        top: 8,
        right: 8,
        padding: '4px 8px',
        background: connected ? '#2d5a2d' : '#5a2d2d',
        borderRadius: 4,
        fontSize: 12,
        fontFamily: 'monospace',
        color: '#fff',
      }}>
        {connected ? 'Connected' : 'Disconnected'}
      </div>

      <RoomSelector
        rooms={roomInfos}
        currentRoomId={currentRoomId}
        onSelectRoom={handleSelectRoom}
      />

      {interaction.isOpen && interaction.currentSession && (
        <InteractionPanel
          session={interaction.currentSession}
          activeTab={interaction.activeTab}
          onTabChange={interaction.setTab}
          onClose={interaction.closePanel}
        >
          {interaction.activeTab === 'status' && (
            <StatusTab session={interaction.currentSession} />
          )}
          {interaction.activeTab === 'chat' && (
            <ChatTab
              session={interaction.currentSession}
              onSendPrompt={sendPrompt}
              onGetHistory={getHistory}
              messages={currentMessages}
            />
          )}
          {interaction.activeTab === 'actions' && (
            <ActionsTab
              session={interaction.currentSession}
              onAbort={abortSession}
              onClose={interaction.closePanel}
            />
          )}
        </InteractionPanel>
      )}

      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}

      {!spritesLoaded && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontFamily: 'monospace',
          fontSize: 14,
          color: '#666',
        }}>
          Loading sprites...
        </div>
      )}
    </div>
  )
}
