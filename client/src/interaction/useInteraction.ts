import { useState, useCallback, useEffect, useRef } from 'react'
import type { Player } from '../world/engine/player.js'
import { getInteractTarget } from '../world/engine/player.js'
import type { Character } from '../world/types.js'
import type { SessionData } from '../hooks/useWebSocket.js'

export type InteractionTab = 'status' | 'chat' | 'actions'

export interface InteractionState {
  sessionId: string | null
  activeTab: InteractionTab
  isOpen: boolean
}

export function useInteraction(
  player: Player | null,
  characters: Character[],
  sessions: SessionData[],
  interactKeyPressed: boolean,
) {
  const [state, setState] = useState<InteractionState>({
    sessionId: null,
    activeTab: 'status',
    isOpen: false,
  })

  const prevInteractRef = useRef(false)
  const sessionMapRef = useRef(new Map<number, string>())

  useEffect(() => {
    const map = new Map<number, string>()
    for (const s of sessions) {
      const charId = characters.find(c => c.id > 0)?.id
      if (charId !== undefined) {
        map.set(charId, s.sessionId)
      }
    }
    sessionMapRef.current = map
  }, [sessions, characters])

  const interactTargetId = player ? getInteractTarget(player, characters) : null

  useEffect(() => {
    const justPressed = interactKeyPressed && !prevInteractRef.current
    prevInteractRef.current = interactKeyPressed

    if (!justPressed) return

    if (state.isOpen) {
      setState(prev => ({ ...prev, isOpen: false, sessionId: null }))
      return
    }

    if (interactTargetId !== null) {
      const matchingSession = sessions.find(s => {
        return true
      })
      if (matchingSession) {
        setState({
          sessionId: matchingSession.sessionId,
          activeTab: 'status',
          isOpen: true,
        })
      }
    }
  }, [interactKeyPressed, state.isOpen, interactTargetId, sessions])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && state.isOpen) {
        setState(prev => ({ ...prev, isOpen: false, sessionId: null }))
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [state.isOpen])

  const setTab = useCallback((tab: InteractionTab) => {
    setState(prev => ({ ...prev, activeTab: tab }))
  }, [])

  const closePanel = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false, sessionId: null }))
  }, [])

  const openPanel = useCallback((sessionId: string) => {
    setState({ sessionId, activeTab: 'status', isOpen: true })
  }, [])

  const currentSession = state.sessionId
    ? sessions.find(s => s.sessionId === state.sessionId) ?? null
    : null

  return {
    ...state,
    interactTargetId,
    currentSession,
    setTab,
    closePanel,
    openPanel,
    inputDisabled: state.isOpen,
  }
}
