import { TileType, FurnitureType, DEFAULT_COLS, DEFAULT_ROWS, TILE_SIZE, Direction } from '../types.js'
import type { TileType as TileTypeVal, OfficeLayout, PlacedFurniture, Seat, FurnitureInstance, FloorColor } from '../types.js'
import { getCatalogEntry } from './furnitureCatalog.js'
import { getColorizedSprite } from '../colorize.js'

/** Convert flat tile array from layout into 2D grid */
export function layoutToTileMap(layout: OfficeLayout): TileTypeVal[][] {
  const map: TileTypeVal[][] = []
  for (let r = 0; r < layout.rows; r++) {
    const row: TileTypeVal[] = []
    for (let c = 0; c < layout.cols; c++) {
      row.push(layout.tiles[r * layout.cols + c])
    }
    map.push(row)
  }
  return map
}

/** Convert placed furniture into renderable FurnitureInstance[] */
export function layoutToFurnitureInstances(furniture: PlacedFurniture[]): FurnitureInstance[] {
  // Pre-compute desk zY per tile so surface items can sort in front of desks
  const deskZByTile = new Map<string, number>()
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type)
    if (!entry || !entry.isDesk) continue
    const deskZY = item.row * TILE_SIZE + entry.sprite.length
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const key = `${item.col + dc},${item.row + dr}`
        const prev = deskZByTile.get(key)
        if (prev === undefined || deskZY > prev) deskZByTile.set(key, deskZY)
      }
    }
  }

  const instances: FurnitureInstance[] = []
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type)
    if (!entry) continue
    const x = item.col * TILE_SIZE
    const y = item.row * TILE_SIZE
    const spriteH = entry.sprite.length
    let zY = y + spriteH

    // Chair z-sorting: ensure characters sitting on chairs render correctly
    if (entry.category === 'chairs') {
      if (entry.orientation === 'back') {
        // Back-facing chairs render IN FRONT of the seated character
        // (the chair back visually occludes the character behind it)
        zY = (item.row + 1) * TILE_SIZE + 1
      } else {
        // All other chairs: cap zY to first row bottom so characters
        // at any seat tile render in front of the chair
        zY = (item.row + 1) * TILE_SIZE
      }
    }

    // Surface items render in front of the desk they sit on
    if (entry.canPlaceOnSurfaces) {
      for (let dr = 0; dr < entry.footprintH; dr++) {
        for (let dc = 0; dc < entry.footprintW; dc++) {
          const deskZ = deskZByTile.get(`${item.col + dc},${item.row + dr}`)
          if (deskZ !== undefined && deskZ + 0.5 > zY) zY = deskZ + 0.5
        }
      }
    }

    // Colorize sprite if this furniture has a color override
    let sprite = entry.sprite
    if (item.color) {
      const { h, s, b: bv, c: cv } = item.color
      sprite = getColorizedSprite(`furn-${item.type}-${h}-${s}-${bv}-${cv}-${item.color.colorize ? 1 : 0}`, entry.sprite, item.color)
    }

    instances.push({ sprite, x, y, zY })
  }
  return instances
}

/** Get all tiles blocked by furniture footprints, optionally excluding a set of tiles.
 *  Skips top backgroundTiles rows so characters can walk through them. */
export function getBlockedTiles(furniture: PlacedFurniture[], excludeTiles?: Set<string>): Set<string> {
  const tiles = new Set<string>()
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type)
    if (!entry) continue
    const bgRows = entry.backgroundTiles || 0
    for (let dr = 0; dr < entry.footprintH; dr++) {
      if (dr < bgRows) continue // skip background rows — characters can walk through
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const key = `${item.col + dc},${item.row + dr}`
        if (excludeTiles && excludeTiles.has(key)) continue
        tiles.add(key)
      }
    }
  }
  return tiles
}

/** Get tiles blocked for placement purposes — skips top backgroundTiles rows per item */
export function getPlacementBlockedTiles(furniture: PlacedFurniture[], excludeUid?: string): Set<string> {
  const tiles = new Set<string>()
  for (const item of furniture) {
    if (item.uid === excludeUid) continue
    const entry = getCatalogEntry(item.type)
    if (!entry) continue
    const bgRows = entry.backgroundTiles || 0
    for (let dr = 0; dr < entry.footprintH; dr++) {
      if (dr < bgRows) continue // skip background rows
      for (let dc = 0; dc < entry.footprintW; dc++) {
        tiles.add(`${item.col + dc},${item.row + dr}`)
      }
    }
  }
  return tiles
}

/** Map chair orientation to character facing direction */
function orientationToFacing(orientation: string): Direction {
  switch (orientation) {
    case 'front': return Direction.DOWN
    case 'back': return Direction.UP
    case 'left': return Direction.LEFT
    case 'right': return Direction.RIGHT
    default: return Direction.DOWN
  }
}

/** Generate seats from chair furniture.
 *  Facing priority: 1) chair orientation, 2) adjacent desk, 3) forward (DOWN). */
export function layoutToSeats(furniture: PlacedFurniture[]): Map<string, Seat> {
  const seats = new Map<string, Seat>()

  // Build set of all desk tiles
  const deskTiles = new Set<string>()
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type)
    if (!entry || !entry.isDesk) continue
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        deskTiles.add(`${item.col + dc},${item.row + dr}`)
      }
    }
  }

  const dirs: Array<{ dc: number; dr: number; facing: Direction }> = [
    { dc: 0, dr: -1, facing: Direction.UP },    // desk is above chair → face UP
    { dc: 0, dr: 1, facing: Direction.DOWN },   // desk is below chair → face DOWN
    { dc: -1, dr: 0, facing: Direction.LEFT },   // desk is left of chair → face LEFT
    { dc: 1, dr: 0, facing: Direction.RIGHT },   // desk is right of chair → face RIGHT
  ]

  // For each chair, every footprint tile becomes a seat.
  // Multi-tile chairs (e.g. 2-tile couches) produce multiple seats.
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type)
    if (!entry || entry.category !== 'chairs') continue

    let seatCount = 0
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const tileCol = item.col + dc
        const tileRow = item.row + dr

        // Determine facing direction:
        // 1) Chair orientation takes priority
        // 2) Adjacent desk direction
        // 3) Default forward (DOWN)
        let facingDir: Direction = Direction.DOWN
        if (entry.orientation) {
          facingDir = orientationToFacing(entry.orientation)
        } else {
          for (const d of dirs) {
            if (deskTiles.has(`${tileCol + d.dc},${tileRow + d.dr}`)) {
              facingDir = d.facing
              break
            }
          }
        }

        // First seat uses chair uid (backward compat), subsequent use uid:N
        const seatUid = seatCount === 0 ? item.uid : `${item.uid}:${seatCount}`
        seats.set(seatUid, {
          uid: seatUid,
          seatCol: tileCol,
          seatRow: tileRow,
          facingDir,
          assigned: false,
        })
        seatCount++
      }
    }
  }

  return seats
}

/** Get the set of tiles occupied by seats (so they can be excluded from blocked tiles) */
export function getSeatTiles(seats: Map<string, Seat>): Set<string> {
  const tiles = new Set<string>()
  for (const seat of seats.values()) {
    tiles.add(`${seat.seatCol},${seat.seatRow}`)
  }
  return tiles
}

/** Shared floor colors */
const FLOOR_BEIGE: FloorColor = { h: 35, s: 30, b: 15, c: 0 }
const FLOOR_WARM_BROWN: FloorColor = { h: 25, s: 45, b: 5, c: 10 }
const FLOOR_CARPET_PURPLE: FloorColor = { h: 280, s: 40, b: -5, c: 0 }
const FLOOR_DOORWAY: FloorColor = { h: 35, s: 25, b: 10, c: 0 }
const FLOOR_COOL_BLUE: FloorColor = { h: 210, s: 30, b: 12, c: 5 }
const FLOOR_SLATE: FloorColor = { h: 220, s: 20, b: 5, c: 8 }
const FLOOR_CARPET_BLUE: FloorColor = { h: 230, s: 45, b: -8, c: 0 }
const FLOOR_TEAL: FloorColor = { h: 170, s: 35, b: 10, c: 5 }
const FLOOR_SAGE: FloorColor = { h: 140, s: 25, b: 8, c: 0 }
const FLOOR_CARPET_GREEN: FloorColor = { h: 160, s: 40, b: -5, c: 0 }
const FLOOR_CARPET_TEAL: FloorColor = { h: 180, s: 35, b: -3, c: 0 }

type TileVal = typeof TileType[keyof typeof TileType]

function buildTileGrid(
  cols: number,
  rows: number,
  fillFn: (r: number, c: number) => { tile: TileVal; color: FloorColor | null },
): { tiles: TileVal[]; tileColors: Array<FloorColor | null> } {
  const tiles: TileVal[] = []
  const tileColors: Array<FloorColor | null> = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const { tile, color } = fillFn(r, c)
      tiles.push(tile)
      tileColors.push(color)
    }
  }
  return { tiles, tileColors }
}

// ── Main Hall ─────────────────────────────────────────────────────
// Warm, welcoming lobby with two work areas, lounge carpet, lots of decor.
export function createMainHallLayout(): OfficeLayout {
  const W = TileType.WALL
  const F1 = TileType.FLOOR_1
  const F2 = TileType.FLOOR_2
  const F3 = TileType.FLOOR_3
  const F4 = TileType.FLOOR_4

  const { tiles, tileColors } = buildTileGrid(DEFAULT_COLS, DEFAULT_ROWS, (r, c) => {
    if (r === 0 || r === DEFAULT_ROWS - 1) return { tile: W, color: null }
    if (c === 0 || c === DEFAULT_COLS - 1) {
      if (c === DEFAULT_COLS - 1 && (r === 5 || r === 6)) return { tile: F4, color: FLOOR_DOORWAY }
      return { tile: W, color: null }
    }
    if (c === 10) {
      if (r >= 4 && r <= 6) return { tile: F4, color: FLOOR_DOORWAY }
      return { tile: W, color: null }
    }
    if (c >= 2 && c <= 5 && r >= 7 && r <= 9) return { tile: F3, color: FLOOR_CARPET_PURPLE }
    if (c < 10) return { tile: F1, color: FLOOR_BEIGE }
    return { tile: F2, color: FLOOR_WARM_BROWN }
  })

  const furniture: PlacedFurniture[] = [
    // ── Left side (lobby/lounge) ──
    { uid: 'mh-desk-l', type: FurnitureType.DESK, col: 4, row: 2 },
    { uid: 'mh-ch-l1', type: FurnitureType.CHAIR, col: 4, row: 1 },
    { uid: 'mh-ch-l2', type: FurnitureType.CHAIR, col: 3, row: 3 },
    { uid: 'mh-ch-l3', type: FurnitureType.CHAIR, col: 6, row: 2 },
    { uid: 'mh-ch-l4', type: FurnitureType.CHAIR, col: 5, row: 4 },
    { uid: 'mh-pc-l', type: FurnitureType.PC, col: 5, row: 2 },
    { uid: 'mh-pl-1', type: FurnitureType.PLANT, col: 1, row: 1 },
    { uid: 'mh-pl-2', type: FurnitureType.PLANT, col: 9, row: 1 },
    { uid: 'mh-pl-5', type: FurnitureType.PLANT, col: 8, row: 8 },
    { uid: 'mh-lamp-1', type: FurnitureType.LAMP, col: 2, row: 7 },
    { uid: 'mh-cl', type: FurnitureType.COOLER, col: 9, row: 9 },
    { uid: 'mh-ch-lg1', type: FurnitureType.CHAIR, col: 3, row: 8 },
    { uid: 'mh-ch-lg2', type: FurnitureType.CHAIR, col: 5, row: 8 },

    // ── Wardrobe (player customization) ──
    { uid: 'mh-wardrobe', type: FurnitureType.WARDROBE, col: 1, row: 3 },

    // ── Right side (tech hub — 4 workstations) ──
    // Station 1: top-left
    { uid: 'mh-desk-r1', type: FurnitureType.DESK, col: 11, row: 1 },
    { uid: 'mh-pc-r1',   type: FurnitureType.PC, col: 12, row: 1 },
    { uid: 'mh-ch-r1',   type: FurnitureType.CHAIR, col: 13, row: 2 },
    // Station 2: top-right
    { uid: 'mh-desk-r2', type: FurnitureType.DESK, col: 15, row: 1 },
    { uid: 'mh-pc-r2',   type: FurnitureType.PC, col: 16, row: 1 },
    { uid: 'mh-ch-r2',   type: FurnitureType.CHAIR, col: 17, row: 2 },
    // Station 3: bottom-left
    { uid: 'mh-desk-r3', type: FurnitureType.DESK, col: 11, row: 7 },
    { uid: 'mh-pc-r3',   type: FurnitureType.PC, col: 12, row: 7 },
    { uid: 'mh-ch-r3',   type: FurnitureType.CHAIR, col: 13, row: 8 },
    // Station 4: bottom-right
    { uid: 'mh-desk-r4', type: FurnitureType.DESK, col: 15, row: 7 },
    { uid: 'mh-pc-r4',   type: FurnitureType.PC, col: 16, row: 7 },
    { uid: 'mh-ch-r4',   type: FurnitureType.CHAIR, col: 17, row: 8 },
    // Tech hub decor
    { uid: 'mh-wb', type: FurnitureType.WHITEBOARD, col: 13, row: 0 },
    { uid: 'mh-pl-3', type: FurnitureType.PLANT, col: 18, row: 1 },
    { uid: 'mh-pl-4', type: FurnitureType.PLANT, col: 18, row: 9 },
    { uid: 'mh-lamp-2', type: FurnitureType.LAMP, col: 14, row: 5 },
  ]

  return { version: 1, cols: DEFAULT_COLS, rows: DEFAULT_ROWS, tiles, tileColors, furniture }
}

// ── Slack Room ────────────────────────────────────────────────────
// Cool-toned tech workspace with multiple desk clusters and meeting area.
export function createSlackRoomLayout(): OfficeLayout {
  const W = TileType.WALL
  const F1 = TileType.FLOOR_1
  const F2 = TileType.FLOOR_2
  const F3 = TileType.FLOOR_3
  const F4 = TileType.FLOOR_4

  const { tiles, tileColors } = buildTileGrid(DEFAULT_COLS, DEFAULT_ROWS, (r, c) => {
    if (r === 0 || r === DEFAULT_ROWS - 1) return { tile: W, color: null }
    if (c === 0) {
      if (r === 5 || r === 6) return { tile: F4, color: FLOOR_DOORWAY }
      return { tile: W, color: null }
    }
    if (c === DEFAULT_COLS - 1) return { tile: W, color: null }
    if (c === 10) {
      if (r >= 4 && r <= 6) return { tile: F4, color: FLOOR_DOORWAY }
      return { tile: W, color: null }
    }
    // Meeting carpet area bottom-right
    if (c >= 14 && c <= 18 && r >= 7 && r <= 9) return { tile: F3, color: FLOOR_CARPET_BLUE }
    if (c < 10) return { tile: F1, color: FLOOR_COOL_BLUE }
    return { tile: F2, color: FLOOR_SLATE }
  })

  const furniture: PlacedFurniture[] = [
    // Left cluster — upper
    { uid: 'sl-desk-1', type: FurnitureType.DESK, col: 3, row: 2 },
    { uid: 'sl-ch-1a', type: FurnitureType.CHAIR, col: 3, row: 1 },
    { uid: 'sl-ch-1b', type: FurnitureType.CHAIR, col: 2, row: 3 },
    { uid: 'sl-ch-1c', type: FurnitureType.CHAIR, col: 5, row: 2 },
    { uid: 'sl-pc-1', type: FurnitureType.PC, col: 4, row: 2 },
    // Left cluster — lower
    { uid: 'sl-desk-2', type: FurnitureType.DESK, col: 5, row: 6 },
    { uid: 'sl-ch-2a', type: FurnitureType.CHAIR, col: 7, row: 6 },
    { uid: 'sl-ch-2b', type: FurnitureType.CHAIR, col: 4, row: 7 },
    { uid: 'sl-ch-2c', type: FurnitureType.CHAIR, col: 6, row: 8 },
    { uid: 'sl-pc-2', type: FurnitureType.PC, col: 5, row: 6 },
    // Right cluster — upper
    { uid: 'sl-desk-3', type: FurnitureType.DESK, col: 14, row: 2 },
    { uid: 'sl-ch-3a', type: FurnitureType.CHAIR, col: 14, row: 1 },
    { uid: 'sl-ch-3b', type: FurnitureType.CHAIR, col: 13, row: 3 },
    { uid: 'sl-ch-3c', type: FurnitureType.CHAIR, col: 16, row: 2 },
    { uid: 'sl-ch-3d', type: FurnitureType.CHAIR, col: 15, row: 4 },
    { uid: 'sl-pc-3', type: FurnitureType.PC, col: 15, row: 2 },
    // Whiteboards
    { uid: 'sl-wb-1', type: FurnitureType.WHITEBOARD, col: 7, row: 0 },
    { uid: 'sl-wb-2', type: FurnitureType.WHITEBOARD, col: 12, row: 0 },
    // Plants
    { uid: 'sl-pl-1', type: FurnitureType.PLANT, col: 1, row: 1 },
    { uid: 'sl-pl-2', type: FurnitureType.PLANT, col: 9, row: 1 },
    { uid: 'sl-pl-3', type: FurnitureType.PLANT, col: 18, row: 1 },
    { uid: 'sl-pl-4', type: FurnitureType.PLANT, col: 1, row: 9 },
    // Bookshelves
    { uid: 'sl-bs-1', type: FurnitureType.BOOKSHELF, col: 1, row: 3 },
    // Lamps + cooler
    { uid: 'sl-lamp-1', type: FurnitureType.LAMP, col: 9, row: 7 },
    { uid: 'sl-lamp-2', type: FurnitureType.LAMP, col: 18, row: 5 },
    { uid: 'sl-cl', type: FurnitureType.COOLER, col: 18, row: 9 },
    // Meeting area chairs
    { uid: 'sl-ch-m1', type: FurnitureType.CHAIR, col: 15, row: 8 },
    { uid: 'sl-ch-m2', type: FurnitureType.CHAIR, col: 17, row: 8 },
  ]

  return { version: 1, cols: DEFAULT_COLS, rows: DEFAULT_ROWS, tiles, tileColors, furniture }
}

// ── Discord Room ──────────────────────────────────────────────────
// Relaxed lounge with teal/green tones, reading nooks, and mixed seating.
export function createDiscordRoomLayout(): OfficeLayout {
  const W = TileType.WALL
  const F1 = TileType.FLOOR_1
  const F2 = TileType.FLOOR_2
  const F3 = TileType.FLOOR_3
  const F4 = TileType.FLOOR_4
  const F5 = TileType.FLOOR_5

  const { tiles, tileColors } = buildTileGrid(DEFAULT_COLS, DEFAULT_ROWS, (r, c) => {
    if (r === 0 || r === DEFAULT_ROWS - 1) return { tile: W, color: null }
    if (c === 0) {
      if (r === 5 || r === 6) return { tile: F4, color: FLOOR_DOORWAY }
      return { tile: W, color: null }
    }
    if (c === DEFAULT_COLS - 1) return { tile: W, color: null }
    if (c === 10) {
      if (r >= 4 && r <= 6) return { tile: F4, color: FLOOR_DOORWAY }
      return { tile: W, color: null }
    }
    // Carpet areas
    if (c >= 2 && c <= 5 && r >= 2 && r <= 4) return { tile: F3, color: FLOOR_CARPET_GREEN }
    if (c >= 14 && c <= 17 && r >= 7 && r <= 9) return { tile: F5, color: FLOOR_CARPET_TEAL }
    if (c < 10) return { tile: F1, color: FLOOR_TEAL }
    return { tile: F2, color: FLOOR_SAGE }
  })

  const furniture: PlacedFurniture[] = [
    // Left reading nook (on carpet)
    { uid: 'dc-bs-1', type: FurnitureType.BOOKSHELF, col: 1, row: 2 },
    { uid: 'dc-bs-2', type: FurnitureType.BOOKSHELF, col: 1, row: 4 },
    { uid: 'dc-ch-n1', type: FurnitureType.CHAIR, col: 3, row: 3 },
    { uid: 'dc-ch-n2', type: FurnitureType.CHAIR, col: 5, row: 3 },
    { uid: 'dc-lamp-n', type: FurnitureType.LAMP, col: 4, row: 2 },
    // Left work desk
    { uid: 'dc-desk-l', type: FurnitureType.DESK, col: 5, row: 6 },
    { uid: 'dc-ch-l1', type: FurnitureType.CHAIR, col: 4, row: 7 },
    { uid: 'dc-ch-l2', type: FurnitureType.CHAIR, col: 7, row: 6 },
    { uid: 'dc-ch-l3', type: FurnitureType.CHAIR, col: 6, row: 8 },
    { uid: 'dc-pc-l', type: FurnitureType.PC, col: 5, row: 6 },
    // Right work desk
    { uid: 'dc-desk-r', type: FurnitureType.DESK, col: 13, row: 2 },
    { uid: 'dc-ch-r1', type: FurnitureType.CHAIR, col: 12, row: 3 },
    { uid: 'dc-ch-r2', type: FurnitureType.CHAIR, col: 15, row: 2 },
    { uid: 'dc-ch-r3', type: FurnitureType.CHAIR, col: 14, row: 4 },
    { uid: 'dc-pc-r', type: FurnitureType.PC, col: 13, row: 2 },
    // Bottom-right lounge area (on teal carpet)
    { uid: 'dc-ch-lg1', type: FurnitureType.CHAIR, col: 15, row: 8 },
    { uid: 'dc-ch-lg2', type: FurnitureType.CHAIR, col: 17, row: 8 },
    { uid: 'dc-lamp-lg', type: FurnitureType.LAMP, col: 16, row: 7 },
    // Plants (scattered)
    { uid: 'dc-pl-1', type: FurnitureType.PLANT, col: 9, row: 1 },
    { uid: 'dc-pl-2', type: FurnitureType.PLANT, col: 18, row: 1 },
    { uid: 'dc-pl-3', type: FurnitureType.PLANT, col: 1, row: 9 },
    { uid: 'dc-pl-4', type: FurnitureType.PLANT, col: 11, row: 9 },
    { uid: 'dc-pl-5', type: FurnitureType.PLANT, col: 1, row: 1 },
    // Whiteboard + bookshelf
    { uid: 'dc-wb', type: FurnitureType.WHITEBOARD, col: 15, row: 0 },
    { uid: 'dc-bs-3', type: FurnitureType.BOOKSHELF, col: 18, row: 5 },
    // Cooler
    { uid: 'dc-cl-1', type: FurnitureType.COOLER, col: 11, row: 7 },
    { uid: 'dc-cl-2', type: FurnitureType.COOLER, col: 18, row: 9 },
  ]

  return { version: 1, cols: DEFAULT_COLS, rows: DEFAULT_ROWS, tiles, tileColors, furniture }
}

/** Create the default office layout (legacy, used as fallback) */
export function createDefaultLayout(): OfficeLayout {
  return createMainHallLayout()
}

/** Serialize layout to JSON string */
export function serializeLayout(layout: OfficeLayout): string {
  return JSON.stringify(layout)
}

/** Deserialize layout from JSON string, migrating old tile types if needed */
export function deserializeLayout(json: string): OfficeLayout | null {
  try {
    const obj = JSON.parse(json)
    if (obj && obj.version === 1 && Array.isArray(obj.tiles) && Array.isArray(obj.furniture)) {
      return migrateLayout(obj as OfficeLayout)
    }
  } catch { /* ignore parse errors */ }
  return null
}

/**
 * Ensure layout has tileColors. If missing, generate defaults based on tile types.
 * Exported for use by message handlers that receive layouts over the wire.
 */
export function migrateLayoutColors(layout: OfficeLayout): OfficeLayout {
  return migrateLayout(layout)
}

/**
 * Migrate old layouts that use legacy tile types (TILE_FLOOR=1, WOOD_FLOOR=2, CARPET=3, DOORWAY=4)
 * to the new pattern-based system. If tileColors is already present, no migration needed.
 */
function migrateLayout(layout: OfficeLayout): OfficeLayout {
  if (layout.tileColors && layout.tileColors.length === layout.tiles.length) {
    return layout // Already migrated
  }

  // Check if any tiles use old values (1-4) — these map directly to FLOOR_1-4
  // but need color assignments
  const tileColors: Array<FloorColor | null> = []
  for (const tile of layout.tiles) {
    switch (tile) {
      case 0: // WALL
        tileColors.push(null)
        break
      case 1: // was TILE_FLOOR → FLOOR_1 beige
        tileColors.push(FLOOR_BEIGE)
        break
      case 2: // was WOOD_FLOOR → FLOOR_2 brown
        tileColors.push(FLOOR_WARM_BROWN)
        break
      case 3: // was CARPET → FLOOR_3 purple
        tileColors.push(FLOOR_CARPET_PURPLE)
        break
      case 4: // was DOORWAY → FLOOR_4 tan
        tileColors.push(FLOOR_DOORWAY)
        break
      default:
        // New tile types (5-7) without colors — use neutral gray
        tileColors.push(tile > 0 ? { h: 0, s: 0, b: 0, c: 0 } : null)
    }
  }

  return { ...layout, tileColors }
}
