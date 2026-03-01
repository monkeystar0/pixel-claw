import { useRef, useEffect, useCallback } from 'react'
import { WorldState } from '../world/engine/worldState.js'
import { createDefaultRooms } from '../world/engine/rooms.js'
import type { SessionData } from './useWebSocket.js'

const CHANNEL_PROVIDERS = new Set(['slack', 'discord', 'telegram', 'whatsapp'])

const CHANNEL_KEY_PATTERN = /^agent:[^:]+:(slack|discord|telegram|whatsapp):/i

function isChannelSession(session: SessionData): boolean {
  if (session.sessionAlias && CHANNEL_KEY_PATTERN.test(session.sessionAlias)) {
    return true
  }
  return !!session.origin?.provider && CHANNEL_PROVIDERS.has(session.origin.provider.toLowerCase())
}

function shouldBeVisible(session: SessionData): boolean {
  return session.status === 'running' || session.sessionAlias === 'global' || isChannelSession(session)
}

export function useWorld(sessions: SessionData[], openPanelSessionId: string | null = null) {
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
      if (!shouldBeVisible(session)) continue

      const isRunning = session.status === 'running'
      currentIds.add(session.sessionId)
      const prev = prevMap.get(session.sessionId)

      if (!prev) {
        const roomId = session.room || 'main-hall'
        const validRoom = world.getRoom(roomId) ? roomId : 'main-hall'
        world.addAgent(session.sessionId, validRoom)
      }

      world.setAgentActive(session.sessionId, isRunning)
      world.setAgentTool(session.sessionId, session.currentTool)

      const panelOpenForThis = openPanelSessionId === session.sessionId
      const prevSession = prev

      if (panelOpenForThis) {
        world.dismissAgentBubble(session.sessionId)
      } else if (isRunning) {
        world.showAgentThinkingBubble(session.sessionId)
      } else if (prevSession && prevSession.status === 'running' && !isRunning) {
        world.showAgentDoneBubble(session.sessionId)
      }
    }

    for (const [sessionId] of prevMap) {
      if (!currentIds.has(sessionId)) {
        world.removeAgent(sessionId)
      }
    }

    const newMap = new Map<string, SessionData>()
    for (const s of sessions) {
      if (shouldBeVisible(s)) {
        newMap.set(s.sessionId, s)
      }
    }
    prevSessionsRef.current = newMap
  }, [sessions, world, openPanelSessionId])

  const update = useCallback((dt: number) => {
    world.update(dt)
  }, [world])

  const switchRoom = useCallback((roomId: string) => {
    world.setCurrentRoom(roomId)
  }, [world])

  return { world, update, switchRoom }
}
