import { Direction, CharacterState, TILE_SIZE } from '../types.js'
import type { Character, TileType as TileTypeVal } from '../types.js'
import { isWalkable } from '../layout/tileMap.js'
import { WALK_SPEED_PX_PER_SEC, WALK_FRAME_DURATION_SEC } from '../constants.js'

const INTERACT_RANGE_TILES = 2

export interface PlayerAppearance {
  palette: number
  hueShift: number
}

export interface KeyState {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

export interface Player {
  x: number
  y: number
  tileCol: number
  tileRow: number
  dir: Direction
  state: CharacterState
  frame: number
  frameTimer: number
  palette: number
  hueShift: number
}

export function createPlayer(
  col: number,
  row: number,
  appearance: PlayerAppearance,
): Player {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
    tileCol: col,
    tileRow: row,
    dir: Direction.DOWN,
    state: CharacterState.IDLE,
    frame: 0,
    frameTimer: 0,
    palette: appearance.palette,
    hueShift: appearance.hueShift,
  }
}

export function updatePlayer(
  player: Player,
  keys: KeyState,
  dt: number,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
): void {
  let dx = 0
  let dy = 0

  if (keys.right) { dx += 1; player.dir = Direction.RIGHT }
  if (keys.left) { dx -= 1; player.dir = Direction.LEFT }
  if (keys.down) { dy += 1; player.dir = Direction.DOWN }
  if (keys.up) { dy -= 1; player.dir = Direction.UP }

  if (dx === 0 && dy === 0) {
    player.state = CharacterState.IDLE
    player.frame = 0
    player.frameTimer = 0
    return
  }

  player.state = CharacterState.WALK

  if (dx !== 0 && dy !== 0) {
    const len = Math.SQRT2
    dx /= len
    dy /= len
  }

  const speed = WALK_SPEED_PX_PER_SEC * dt
  let newX = player.x + dx * speed
  let newY = player.y + dy * speed

  const newTileCol = Math.floor(newX / TILE_SIZE)
  const newTileRow = Math.floor(newY / TILE_SIZE)

  if (dx !== 0) {
    const testCol = Math.floor(newX / TILE_SIZE)
    if (!isWalkable(testCol, player.tileRow, tileMap, blockedTiles)) {
      newX = player.x
    }
  }

  if (dy !== 0) {
    const testRow = Math.floor(newY / TILE_SIZE)
    const xCol = Math.floor(newX / TILE_SIZE)
    if (!isWalkable(xCol, testRow, tileMap, blockedTiles)) {
      newY = player.y
    }
  }

  player.x = newX
  player.y = newY
  player.tileCol = Math.floor(player.x / TILE_SIZE)
  player.tileRow = Math.floor(player.y / TILE_SIZE)

  player.frameTimer += dt
  if (player.frameTimer >= WALK_FRAME_DURATION_SEC) {
    player.frameTimer -= WALK_FRAME_DURATION_SEC
    player.frame = (player.frame + 1) % 4
  }
}

function facingDelta(dir: Direction): { dc: number; dr: number } {
  switch (dir) {
    case Direction.RIGHT: return { dc: 1, dr: 0 }
    case Direction.LEFT: return { dc: -1, dr: 0 }
    case Direction.DOWN: return { dc: 0, dr: 1 }
    case Direction.UP: return { dc: 0, dr: -1 }
    default: return { dc: 0, dr: 0 }
  }
}

export function getInteractTarget(
  player: Player,
  characters: Character[],
): number | null {
  if (characters.length === 0) return null

  const { dc, dr } = facingDelta(player.dir)
  let bestId: number | null = null
  let bestDist = Infinity

  for (const ch of characters) {
    const dtc = ch.tileCol - player.tileCol
    const dtr = ch.tileRow - player.tileRow
    const dist = Math.abs(dtc) + Math.abs(dtr)
    if (dist > INTERACT_RANGE_TILES || dist === 0) continue

    const inDirection =
      (dc !== 0 && Math.sign(dtc) === dc && Math.abs(dtr) <= 1) ||
      (dr !== 0 && Math.sign(dtr) === dr && Math.abs(dtc) <= 1)

    if (!inDirection) continue

    if (dist < bestDist) {
      bestDist = dist
      bestId = ch.id
    }
  }

  return bestId
}

export const PLAYER_CHARACTER_ID = -999

export function playerToCharacter(player: Player): Character {
  return {
    id: PLAYER_CHARACTER_ID,
    state: player.state,
    dir: player.dir,
    x: player.x,
    y: player.y,
    tileCol: player.tileCol,
    tileRow: player.tileRow,
    path: [],
    moveProgress: 0,
    currentTool: null,
    palette: player.palette,
    hueShift: player.hueShift,
    frame: player.frame,
    frameTimer: player.frameTimer,
    wanderTimer: 0,
    wanderCount: 0,
    wanderLimit: 0,
    isActive: false,
    seatId: null,
    bubbleType: null,
    bubbleTimer: 0,
    seatTimer: 0,
    isSubagent: false,
    parentAgentId: null,
    matrixEffect: null,
    matrixEffectTimer: 0,
    matrixEffectSeeds: [],
  }
}

const APPEARANCE_KEY = 'pixel-claw-player-appearance'

export function saveAppearance(appearance: PlayerAppearance): void {
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance))
  } catch { /* localStorage may be unavailable */ }
}

export function loadAppearance(): PlayerAppearance | null {
  try {
    const data = localStorage.getItem(APPEARANCE_KEY)
    if (!data) return null
    return JSON.parse(data) as PlayerAppearance
  } catch {
    return null
  }
}
