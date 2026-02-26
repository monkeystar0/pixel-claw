import { useState, useEffect, useCallback, useRef } from 'react'

export interface KeyState {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  interact: boolean
}

const KEY_MAP: Record<string, keyof KeyState> = {
  'ArrowUp': 'up',
  'ArrowDown': 'down',
  'ArrowLeft': 'left',
  'ArrowRight': 'right',
  'KeyW': 'up',
  'KeyS': 'down',
  'KeyA': 'left',
  'KeyD': 'right',
  'KeyE': 'interact',
  'Space': 'interact',
}

export function useGameInput(): KeyState {
  const keysRef = useRef<KeyState>({
    up: false, down: false, left: false, right: false, interact: false,
  })
  const [, setTick] = useState(0)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const action = KEY_MAP[e.code]
    if (action && !keysRef.current[action]) {
      keysRef.current = { ...keysRef.current, [action]: true }
      setTick(t => t + 1)
    }
  }, [])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const action = KEY_MAP[e.code]
    if (action && keysRef.current[action]) {
      keysRef.current = { ...keysRef.current, [action]: false }
      setTick(t => t + 1)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])

  return keysRef.current
}
