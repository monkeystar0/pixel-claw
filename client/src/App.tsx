import { useRef, useEffect, useCallback, useState } from 'react'
import { useWebSocket } from './hooks/useWebSocket.js'
import { useWorld } from './hooks/useWorld.js'
import { useGameInput } from './hooks/useGameInput.js'
import { createPlayer, updatePlayer } from './world/engine/player.js'
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
import type { RoomDoorway } from './world/engine/rooms.js'
import { RoomSelector } from './components/RoomSelector.js'
import { TILE_SIZE } from './world/types.js'
import { ZOOM_DEFAULT_DPR_FACTOR } from './world/constants.js'

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { connected, sessions, channels } = useWebSocket()
  const { world, update: updateWorld, switchRoom } = useWorld(sessions)
  const keys = useGameInput()
  const [currentRoomId, setCurrentRoomId] = useState('main-hall')
  const [spritesLoaded, setSpritesLoaded] = useState(false)

  const playerRef = useRef<Player | null>(null)
  const cameraRef = useRef<Camera | null>(null)
  const transitionRef = useRef(createTransition())
  const roomDefsRef = useRef(createDefaultRooms())

  useEffect(() => {
    loadAllSprites().then(() => setSpritesLoaded(true))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !spritesLoaded) return

    const dpr = window.devicePixelRatio || 1
    const zoom = Math.round(dpr * ZOOM_DEFAULT_DPR_FACTOR)

    if (!playerRef.current) {
      playerRef.current = createPlayer(5, 5, { palette: 0, hueShift: 0 })
    }
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
          const room = world.getCurrentRoom()
          if (room) {
            updatePlayer(player, keys, dt, room.officeState.tileMap, room.officeState.blockedTiles)

            const roomDef = roomDefsRef.current.find(r => r.id === world.getCurrentRoomId())
            if (roomDef) {
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

        const room = world.getCurrentRoom()
        if (room) {
          camera.setRoomBounds(
            room.layout.cols * TILE_SIZE * zoom,
            room.layout.rows * TILE_SIZE * zoom,
          )
          camera.follow(player.x * zoom, player.y * zoom)
          camera.update(dt)
        }
      },
      render(ctx) {
        ctx.save()
        ctx.scale(1, 1)
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
        ctx.fillStyle = '#0a0a14'
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

        const room = world.getCurrentRoom()
        if (!room) {
          ctx.restore()
          return
        }

        const characters = room.officeState.getCharacters()

        // renderFrame internally centers the map with (canvasW - mapW)/2.
        // The camera also centers via clampX/clampY. Subtract renderFrame's
        // centering so the camera is the sole source of positioning.
        const mapW = room.layout.cols * TILE_SIZE * zoom
        const mapH = room.layout.rows * TILE_SIZE * zoom
        const panX = -camera.x - Math.floor((ctx.canvas.width - mapW) / 2)
        const panY = -camera.y - Math.floor((ctx.canvas.height - mapH) / 2)

        renderFrame(
          ctx,
          ctx.canvas.width,
          ctx.canvas.height,
          room.officeState.tileMap,
          room.officeState.furniture,
          characters,
          zoom,
          panX,
          panY,
          undefined,
          undefined,
          room.layout.tileColors,
          room.layout.cols,
          room.layout.rows,
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
  }, [spritesLoaded, world, updateWorld, keys])

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

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated' }}
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
