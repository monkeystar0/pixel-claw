import { useRef, useEffect, useCallback } from 'react'
import { WorldState } from '../world/engine/worldState.js'
import { createDefaultRooms } from '../world/engine/rooms.js'
import type { SessionData } from './useWebSocket.js'

export function useWorld(sessions: SessionData[]) {
  const worldRef = useRef<WorldState | null>(null)

  if (!worldRef.current) {
    const world = new WorldState()
    const rooms = createDefaultRooms()
    for (const room of rooms) {
      world.addRoom(room.id, room.layout)
    }
    worldRef.current = world
  }

  const world = worldRef.current
  const prevSessionsRef = useRef<Map<string, SessionData>>(new Map())

  useEffect(() => {
    const prevMap = prevSessionsRef.current
    const currentIds = new Set<string>()

    for (const session of sessions) {
      currentIds.add(session.sessionId)
      const prev = prevMap.get(session.sessionId)

      if (!prev) {
        const roomId = session.room || 'main-hall'
        const validRoom = world.getRoom(roomId) ? roomId : 'main-hall'
        world.addAgent(session.sessionId, validRoom)
      }

      const isRunning = session.status === 'running'
      world.setAgentActive(session.sessionId, isRunning)
      world.setAgentTool(session.sessionId, session.currentTool)
    }

    for (const [sessionId] of prevMap) {
      if (!currentIds.has(sessionId)) {
        world.removeAgent(sessionId)
      }
    }

    const newMap = new Map<string, SessionData>()
    for (const s of sessions) {
      newMap.set(s.sessionId, s)
    }
    prevSessionsRef.current = newMap
  }, [sessions, world])

  const update = useCallback((dt: number) => {
    world.update(dt)
  }, [world])

  const switchRoom = useCallback((roomId: string) => {
    world.setCurrentRoom(roomId)
  }, [world])

  return { world, update, switchRoom }
}
