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

/**
 * Load all sprite assets and register them with the sprite system.
 * Call once on application startup.
 */
export async function loadAllSprites(basePath = '/sprites'): Promise<void> {
  const [wallSprites, charSprites] = await Promise.all([
    loadWallSprites(basePath),
    loadCharacterSprites(basePath),
  ])

  if (wallSprites.length > 0) {
    setWallSprites(wallSprites)
  }

  if (charSprites.length > 0) {
    setCharacterTemplates(charSprites)
  }

  // Floor sprites: no floors.png available, using default solid tiles
  setFloorSprites([])
}
