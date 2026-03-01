/**
 * Web-based sprite loader.
 *
 * Replaces VS Code extension's asset loading (assetLoader.ts + message passing)
 * with direct browser image loading. Converts PNG images to SpriteData (2D hex arrays).
 */

import type { SpriteData } from '../types.js'
import { setFloorSprites } from '../floorTiles.js'
import { setWallSprites } from '../wallTiles.js'
import { setCharacterTemplates } from './spriteData.js'
import { FLOOR_TILE_REGIONS, FURNITURE_REGIONS } from './tilesetConfig.js'

const PNG_ALPHA_THRESHOLD = 128
const WALL_PIECE_WIDTH = 16
const WALL_PIECE_HEIGHT = 32
const WALL_GRID_COLS = 4
const WALL_BITMASK_COUNT = 16
const CHAR_FRAME_W = 16
const CHAR_FRAME_H = 32
const CHAR_FRAMES_PER_ROW = 7
const CHAR_COUNT = 6
const CHARACTER_DIRECTIONS = ['down', 'up', 'right'] as const

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

function imageToPixels(img: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, img.width, img.height)
}

function extractSprite(
  imageData: ImageData,
  ox: number,
  oy: number,
  w: number,
  h: number,
): SpriteData {
  const sprite: SpriteData = []
  const { data, width } = imageData
  for (let y = 0; y < h; y++) {
    const row: string[] = []
    for (let x = 0; x < w; x++) {
      const idx = ((oy + y) * width + (ox + x)) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const a = data[idx + 3]
      if (a < PNG_ALPHA_THRESHOLD) {
        row.push('')
      } else {
        row.push(
          `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase(),
        )
      }
    }
    sprite.push(row)
  }
  return sprite
}

export async function loadWallSprites(basePath = '/sprites'): Promise<SpriteData[]> {
  try {
    const img = await loadImage(`${basePath}/walls.png`)
    const pixels = imageToPixels(img)
    const sprites: SpriteData[] = []
    for (let mask = 0; mask < WALL_BITMASK_COUNT; mask++) {
      const ox = (mask % WALL_GRID_COLS) * WALL_PIECE_WIDTH
      const oy = Math.floor(mask / WALL_GRID_COLS) * WALL_PIECE_HEIGHT
      sprites.push(extractSprite(pixels, ox, oy, WALL_PIECE_WIDTH, WALL_PIECE_HEIGHT))
    }
    return sprites
  } catch {
    console.warn('Wall sprites not available, using fallback')
    return []
  }
}

export interface CharacterDirectionSprites {
  down: SpriteData[]
  up: SpriteData[]
  right: SpriteData[]
}

export async function loadCharacterSprites(
  basePath = '/sprites',
): Promise<CharacterDirectionSprites[]> {
  const characters: CharacterDirectionSprites[] = []
  for (let ci = 0; ci < CHAR_COUNT; ci++) {
    try {
      const img = await loadImage(`${basePath}/characters/char_${ci}.png`)
      const pixels = imageToPixels(img)
      const charData: CharacterDirectionSprites = { down: [], up: [], right: [] }
      for (let dirIdx = 0; dirIdx < CHARACTER_DIRECTIONS.length; dirIdx++) {
        const dir = CHARACTER_DIRECTIONS[dirIdx]
        const rowOffsetY = dirIdx * CHAR_FRAME_H
        const frames: SpriteData[] = []
        for (let f = 0; f < CHAR_FRAMES_PER_ROW; f++) {
          frames.push(
            extractSprite(pixels, f * CHAR_FRAME_W, rowOffsetY, CHAR_FRAME_W, CHAR_FRAME_H),
          )
        }
        charData[dir] = frames
      }
      characters.push(charData)
    } catch {
      console.warn(`Character sprite char_${ci} not available`)
    }
  }
  return characters
}

function extractSpriteGrayscale(
  imageData: ImageData,
  ox: number,
  oy: number,
  w: number,
  h: number,
): SpriteData {
  const sprite: SpriteData = []
  const { data, width } = imageData
  for (let y = 0; y < h; y++) {
    const row: string[] = []
    for (let x = 0; x < w; x++) {
      const idx = ((oy + y) * width + (ox + x)) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const a = data[idx + 3]
      if (a < PNG_ALPHA_THRESHOLD) {
        row.push('')
      } else {
        const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
        const hex = lum.toString(16).padStart(2, '0').toUpperCase()
        row.push(`#${hex}${hex}${hex}`)
      }
    }
    sprite.push(row)
  }
  return sprite
}

export async function loadFloorTileSprites(basePath = '/sprites'): Promise<SpriteData[]> {
  try {
    const img = await loadImage(`${basePath}/room_builder.png`)
    const pixels = imageToPixels(img)
    return FLOOR_TILE_REGIONS.map((r) =>
      extractSpriteGrayscale(pixels, r.x, r.y, r.w, r.h)
    )
  } catch {
    console.warn('Room Builder tileset not available, using fallback floors')
    return []
  }
}

export async function loadFurnitureTilesetSprites(
  basePath = '/sprites',
): Promise<Map<string, SpriteData>> {
  const sprites = new Map<string, SpriteData>()
  try {
    const img = await loadImage(`${basePath}/interiors.png`)
    const pixels = imageToPixels(img)
    for (const [key, region] of Object.entries(FURNITURE_REGIONS)) {
      sprites.set(key, extractSprite(pixels, region.x, region.y, region.w, region.h))
    }
  } catch {
    console.warn('Interiors tileset not available, using fallback furniture')
  }
  return sprites
}

let loadedFurnitureSprites: Map<string, SpriteData> | null = null

export function getFurnitureTilesetSprite(key: string): SpriteData | null {
  return loadedFurnitureSprites?.get(key) ?? null
}

/**
 * Load all sprite assets and register them with the sprite system.
 * Call once on application startup.
 */
export async function loadAllSprites(basePath = '/sprites'): Promise<void> {
  const [wallSprites, charSprites, floorSprites, furnitureSprites] = await Promise.all([
    loadWallSprites(basePath),
    loadCharacterSprites(basePath),
    loadFloorTileSprites(basePath),
    loadFurnitureTilesetSprites(basePath),
  ])

  if (wallSprites.length > 0) {
    setWallSprites(wallSprites)
  }

  if (charSprites.length > 0) {
    setCharacterTemplates(charSprites)
  }

  if (floorSprites.length > 0) {
    setFloorSprites(floorSprites)
  }

  if (furnitureSprites.size > 0) {
    loadedFurnitureSprites = furnitureSprites
  }
}
