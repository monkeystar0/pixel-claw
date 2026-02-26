import type { OfficeLayout } from '../types.js'
import { createDefaultLayout } from '../layout/layoutSerializer.js'
import type { Player } from './player.js'

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

/**
 * Check if the player is standing on a doorway tile.
 * Returns the doorway info or null.
 */
export function checkPlayerDoorway(
  player: Player,
  doorways: RoomDoorway[],
): RoomDoorway | null {
  for (const d of doorways) {
    if (player.tileCol === d.col && player.tileRow === d.row) {
      return d
    }
  }
  return null
}

export function createDefaultRooms(): RoomDefinition[] {
  const mainLayout = createDefaultLayout()
  const slackLayout = createDefaultLayout()
  const discordLayout = createDefaultLayout()

  return [
    {
      id: 'main-hall',
      name: 'Main Hall',
      layout: mainLayout,
      doorways: [
        { col: 19, row: 5, targetRoomId: 'slack-room', targetCol: 1, targetRow: 5 },
        { col: 19, row: 6, targetRoomId: 'discord-room', targetCol: 1, targetRow: 6 },
      ],
    },
    {
      id: 'slack-room',
      name: 'Slack Room',
      layout: slackLayout,
      doorways: [
        { col: 0, row: 5, targetRoomId: 'main-hall', targetCol: 18, targetRow: 5 },
      ],
    },
    {
      id: 'discord-room',
      name: 'Discord Room',
      layout: discordLayout,
      doorways: [
        { col: 0, row: 6, targetRoomId: 'main-hall', targetCol: 18, targetRow: 6 },
      ],
    },
  ]
}
