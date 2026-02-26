import type { OfficeLayout } from '../types.js'
import { createDefaultLayout } from '../layout/layoutSerializer.js'

export interface RoomDoorway {
  col: number
  row: number
  targetRoomId: string
  targetCol: number
  targetRow: number
}

export interface RoomDefinition {
  id: string
  name: string
  layout: OfficeLayout
  doorways: RoomDoorway[]
}

export type TransitionState = 'none' | 'fading-out' | 'fading-in'

export interface RoomTransition {
  state: TransitionState
  progress: number
  fromRoomId: string | null
  toRoomId: string | null
  targetCol: number
  targetRow: number
}

const FADE_DURATION_SEC = 0.3

export function createTransition(): RoomTransition {
  return {
    state: 'none',
    progress: 0,
    fromRoomId: null,
    toRoomId: null,
    targetCol: 0,
    targetRow: 0,
  }
}

export function startTransition(
  transition: RoomTransition,
  fromRoomId: string,
  toRoomId: string,
  targetCol: number,
  targetRow: number,
): void {
  transition.state = 'fading-out'
  transition.progress = 0
  transition.fromRoomId = fromRoomId
  transition.toRoomId = toRoomId
  transition.targetCol = targetCol
  transition.targetRow = targetRow
}

export function updateTransition(
  transition: RoomTransition,
  dt: number,
): { switchRoom: boolean; completed: boolean } {
  if (transition.state === 'none') {
    return { switchRoom: false, completed: false }
  }

  transition.progress += dt / FADE_DURATION_SEC

  if (transition.state === 'fading-out' && transition.progress >= 1) {
    transition.state = 'fading-in'
    transition.progress = 0
    return { switchRoom: true, completed: false }
  }

  if (transition.state === 'fading-in' && transition.progress >= 1) {
    transition.state = 'none'
    transition.progress = 0
    transition.fromRoomId = null
    transition.toRoomId = null
    return { switchRoom: false, completed: true }
  }

  return { switchRoom: false, completed: false }
}

export function getTransitionAlpha(transition: RoomTransition): number {
  if (transition.state === 'none') return 1
  if (transition.state === 'fading-out') return 1 - transition.progress
  return transition.progress
}

export function createDefaultRooms(): RoomDefinition[] {
  return [
    {
      id: 'main-hall',
      name: 'Main Hall',
      layout: createDefaultLayout(),
      doorways: [],
    },
  ]
}
