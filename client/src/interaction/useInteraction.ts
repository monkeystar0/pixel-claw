import { useState, useCallback, useEffect } from 'react'
import type { SessionData } from '../hooks/useWebSocket.js'

export type InteractionTab = 'status' | 'chat' | 'actions'

export interface InteractionState {
  sessionId: string | null
  activeTab: InteractionTab
  isOpen: boolean
}

export function useInteraction(sessions: SessionData[]) {
  const [state, setState] = useState<InteractionState>({
    sessionId: null,
    activeTab: 'status',
    isOpen: false,
  })

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
    currentSession,
    setTab,
    closePanel,
    openPanel,
    inputDisabled: state.isOpen,
  }
}
