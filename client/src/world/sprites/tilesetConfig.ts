/**
 * Tileset extraction configuration.
 *
 * Defines pixel regions in the PNG tilesets for floors and furniture.
 * Coordinates are in PIXELS (not tiles). Each tile is 16×16px.
 *
 * Interiors spritesheet: 256×1424 (16 cols × 89 rows of 16px tiles)
 * Room Builder spritesheet: 272×368 (17 cols × 23 rows of 16px tiles)
 */

const T = 16

export interface SpriteRegion {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Floor tile patterns from Room_Builder spritesheet (right side).
 * Each is a single 16×16 tile from the center of a floor pattern block.
 * Cols 11-13 and 14-16 contain floor patterns in rows 5-14.
 * Index 0 → FLOOR_1, Index 1 → FLOOR_2, ... Index 6 → FLOOR_7.
 */
export const FLOOR_TILE_REGIONS: SpriteRegion[] = [
  { x: 12 * T, y: 5 * T, w: T, h: T },   // 0: Red-brown brick
  { x: 12 * T, y: 7 * T, w: T, h: T },   // 1: Cream/beige sand
  { x: 12 * T, y: 9 * T, w: T, h: T },   // 2: Teal/cyan mosaic
  { x: 12 * T, y: 11 * T, w: T, h: T },  // 3: Light grey-blue
  { x: 12 * T, y: 13 * T, w: T, h: T },  // 4: Warm orange-brown
  { x: 15 * T, y: 5 * T, w: T, h: T },   // 5: Grey-mauve stone
  { x: 15 * T, y: 7 * T, w: T, h: T },   // 6: Dark grey-brown
]

/**
 * Furniture sprite regions from Interiors spritesheet.
 * Coordinates verified via pixel analysis of interiors.png (256×1424).
 * Key matches FurnitureType value for replacement via getCatalogEntry().
 */
export const FURNITURE_REGIONS: Record<string, SpriteRegion> = {
  desk:       { x: 4 * T, y: 31 * T, w: 2 * T, h: 2 * T },  // Golden-brown desk (rows 31-32, cols 4-5)
  bookshelf:  { x: 13 * T, y: 11 * T, w: T, h: 2 * T },     // Blue-gold bookshelf (rows 11-12, col 13)
  plant:      { x: 10 * T, y: 28 * T, w: T, h: 2 * T },     // Dark green plant (rows 28-29, col 10)
  cooler:     { x: T, y: 26 * T, w: T, h: 2 * T },           // Grey appliance (rows 26-27, col 1)
  whiteboard: { x: 10 * T, y: 36 * T, w: 2 * T, h: T },     // White board (row 36, cols 10-11)
  chair:      { x: 2 * T, y: 17 * T, w: T, h: T },           // Grey chair seat (row 17, col 2)
  pc:         { x: 3 * T, y: 49 * T, w: T, h: T },           // Dark monitor screen (row 49, col 3)
  lamp:       { x: 5 * T, y: 44 * T, w: T, h: T },           // Amber lamp (row 44, col 5)
}
