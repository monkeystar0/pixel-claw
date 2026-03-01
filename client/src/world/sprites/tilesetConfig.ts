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
 * Furniture sprite regions from Interiors spritesheet (interiors.png, 256×1424).
 * Coordinates verified via pixel analysis.
 *
 * Key naming: active keys (matching FurnitureType) are used directly by getCatalogEntry().
 * Prefixed keys (e.g. "alt_*") are catalogued for future use but not yet wired into the game.
 *
 * Notation: (cols C1-C2, rows R1-R2) = tile coordinates, WxH = tile dimensions.
 */
export const FURNITURE_REGIONS: Record<string, SpriteRegion> = {

  // ── Active (used by FurnitureType / furnitureCatalog) ──────────

  desk:       { x: 4 * T, y: 31 * T, w: 2 * T, h: 2 * T },  // Golden-brown desk (cols 4-5, rows 31-32) 2×2
  bookshelf:  { x: 13 * T, y: 11 * T, w: T, h: 2 * T },     // Blue-gold bookshelf (col 13, rows 11-12) 1×2
  plant:      { x: 10 * T, y: 28 * T, w: T, h: 2 * T },     // Dark green plant (col 10, rows 28-29) 1×2
  cooler:     { x: T, y: 26 * T, w: T, h: 2 * T },           // Grey appliance (col 1, rows 26-27) 1×2
  whiteboard: { x: 10 * T, y: 36 * T, w: 2 * T, h: T },     // White board (cols 10-11, row 36) 2×1
  chair:      { x: 2 * T, y: 17 * T, w: T, h: T },           // Grey chair seat (col 2, row 17) 1×1
  pc:         { x: 3 * T, y: 49 * T, w: T, h: T },           // Dark monitor screen (col 3, row 49) 1×1
  lamp:       { x: 5 * T, y: 44 * T, w: T, h: T },           // Amber lamp (col 5, row 44) 1×1
  wardrobe:   { x: 7 * T, y: 48 * T, w: 2 * T, h: 3 * T },  // Closed-door wooden wardrobe (cols 7-8, rows 48-50) 2×3

  // ── Beds ───────────────────────────────────────────────────────

  alt_bed_green:        { x: 0, y: 0, w: 3 * T, h: 4 * T },           // Green single bed (cols 0-2, rows 0-3) 3×4
  alt_bed_blue_striped: { x: 4 * T, y: 0, w: 3 * T, h: 4 * T },      // Blue-striped bed, wood frame (cols 4-6, rows 0-3) 3×4
  alt_bed_teal:         { x: 9 * T, y: 0, w: 3 * T, h: 4 * T },      // Teal/cyan bed (cols 9-11, rows 0-3) 3×4
  alt_bed_white:        { x: 0, y: 5 * T, w: 3 * T, h: 4 * T },      // White single bed (cols 0-2, rows 5-8) 3×4
  alt_bed_teal_large:   { x: 10 * T, y: 5 * T, w: 6 * T, h: 4 * T }, // Large teal bed, wood frame (cols 10-15, rows 5-8) 6×4

  // ── Sofas & Couches ────────────────────────────────────────────

  alt_sofa_orange:       { x: 0, y: 10 * T, w: 2 * T, h: 2 * T },     // Orange sofa/cabinet (cols 0-1, rows 10-11) 2×2
  alt_couch_orange:      { x: 6 * T, y: 12 * T, w: 2 * T, h: 2 * T }, // Orange couch (cols 6-7, rows 12-13) 2×2
  alt_sofa_red:          { x: 7 * T, y: 18 * T, w: 2 * T, h: 2 * T }, // Red upholstered sofa (cols 7-8, rows 18-19) 2×2
  alt_sofa_grey_3seat:   { x: 0, y: 72 * T, w: 3 * T, h: 2 * T },    // Grey 3-seat sofa (cols 0-2, rows 72-73) 3×2
  alt_sofa_grey_2seat:   { x: 3 * T, y: 72 * T, w: 2 * T, h: 2 * T },// Grey 2-seat sofa (cols 3-4, rows 72-73) 2×2
  alt_sofa_brown_2seat:  { x: 6 * T, y: 72 * T, w: 2 * T, h: 2 * T },// Brown 2-seat sofa (cols 6-7, rows 72-73) 2×2
  alt_sofa_grey_back:    { x: 3 * T, y: 76 * T, w: 2 * T, h: 2 * T },// Grey sofa (back-facing) (cols 3-4, rows 76-77) 2×2

  // ── Cabinets & Shelves ─────────────────────────────────────────

  alt_cabinet_beige_l:   { x: 3 * T, y: 10 * T, w: 2 * T, h: 2 * T },   // Beige cabinet left (cols 3-4, rows 10-11) 2×2
  alt_cabinet_beige_r:   { x: 5 * T, y: 10 * T, w: 2 * T, h: 2 * T },   // Beige cabinet right (cols 5-6, rows 10-11) 2×2
  alt_file_cabinet:      { x: 0, y: 16 * T, w: 4 * T, h: 2 * T },       // Filing cabinets wall (cols 0-3, rows 16-17) 4×2
  alt_bookshelf_color:   { x: 4 * T, y: 14 * T, w: 2 * T, h: 4 * T },   // Colorful bookshelf (cols 4-5, rows 14-17) 2×4
  alt_vending_machine_1: { x: T, y: 18 * T, w: T, h: 2 * T },           // Vending machine 1 (col 1, rows 18-19) 1×2
  alt_vending_machine_2: { x: 2 * T, y: 18 * T, w: T, h: 2 * T },      // Vending machine 2 (col 2, rows 18-19) 1×2
  alt_vending_machine_3: { x: 3 * T, y: 18 * T, w: T, h: 2 * T },      // Vending machine 3 (col 3, rows 18-19) 1×2
  alt_shelf_drinks:      { x: 4 * T, y: 18 * T, w: T, h: 2 * T },      // Drink shelf (col 4, rows 18-19) 1×2
  alt_shelf_groceries:   { x: 11 * T, y: 68 * T, w: 3 * T, h: 4 * T }, // Grocery shelf (cols 11-13, rows 68-71) 3×4
  alt_shelf_colorful:    { x: 14 * T, y: 68 * T, w: 2 * T, h: 4 * T }, // Colorful shelf (cols 14-15, rows 68-71) 2×4

  // ── Wardrobes & Dressers ───────────────────────────────────────

  alt_wardrobe_glass:     { x: 9 * T, y: 48 * T, w: 2 * T, h: 2 * T },   // Glass-door wardrobe (cols 9-10, rows 48-49) 2×2
  alt_wardrobe_small_1:   { x: 11 * T, y: 48 * T, w: 2 * T, h: 2 * T },  // Small cabinet, glass doors (cols 11-12, rows 48-49) 2×2
  alt_wardrobe_small_2:   { x: 13 * T, y: 48 * T, w: 2 * T, h: 2 * T },  // Small wooden cabinet (cols 13-14, rows 48-49) 2×2
  alt_vanity_mirror_sm:   { x: T, y: 48 * T, w: 2 * T, h: 2 * T },       // Vanity/dresser with mirror small (cols 1-2, rows 48-49) 2×2
  alt_vanity_mirror_lg:   { x: 3 * T, y: 48 * T, w: 2 * T, h: 2 * T },   // Vanity/dresser with mirror large (cols 3-4, rows 48-49) 2×2
  alt_purple_dresser:     { x: 2 * T, y: 44 * T, w: 2 * T, h: 2 * T },   // Purple dresser with gold trim (cols 2-3, rows 44-45) 2×2
  alt_purple_cabinet_lg:  { x: 4 * T, y: 44 * T, w: 3 * T, h: 4 * T },   // Large purple cabinet (cols 4-6, rows 44-47) 3×4
  alt_purple_bookcase:    { x: 0, y: 44 * T, w: 2 * T, h: 4 * T },       // Purple bookcase with gold trim (cols 0-1, rows 44-47) 2×4

  // ── Tables ─────────────────────────────────────────────────────

  alt_table_small:        { x: 5 * T, y: 7 * T, w: T, h: 2 * T },        // Small side table (col 5, rows 7-8) 1×2
  alt_desk_school:        { x: T, y: 35 * T, w: 4 * T, h: 2 * T },       // School desk, long (cols 1-4, rows 35-36) 4×2
  alt_desk_teacher:       { x: 5 * T, y: 35 * T, w: 2 * T, h: 2 * T },   // Teacher desk (cols 5-6, rows 35-36) 2×2
  alt_bench_wood_1:       { x: T, y: 51 * T, w: 2 * T, h: T },           // Wooden bench 1 (cols 1-2, rows 51) 2×1
  alt_bench_wood_2:       { x: 3 * T, y: 51 * T, w: 2 * T, h: T },      // Wooden bench 2 (cols 3-4, rows 51) 2×1
  alt_counter_kitchen:    { x: 4 * T, y: 26 * T, w: 5 * T, h: 2 * T },   // Kitchen counter (cols 4-8, rows 26-27) 5×2

  // ── Chairs (variants) ─────────────────────────────────────────

  alt_chair_school_front: { x: 3 * T, y: 31 * T, w: T, h: T },           // School chair front (col 3, row 31) 1×1
  alt_chair_school_back:  { x: 3 * T, y: 32 * T, w: T, h: T },           // School chair back (col 3, row 32) 1×1
  alt_chair_wood_front:   { x: 6 * T, y: 22 * T, w: T, h: 2 * T },      // Wooden chair front (col 6, rows 22-23) 1×2
  alt_chair_wood_side:    { x: 7 * T, y: 22 * T, w: T, h: 2 * T },      // Wooden chair side (col 7, rows 22-23) 1×2
  alt_chair_red:          { x: 11 * T, y: 53 * T, w: T, h: 2 * T },     // Red upholstered chair (col 11, rows 53-54) 1×2
  alt_chair_blue:         { x: 12 * T, y: 53 * T, w: T, h: 2 * T },     // Blue upholstered chair (col 12, rows 53-54) 1×2
  alt_stool:              { x: 5 * T, y: 12 * T, w: T, h: 2 * T },      // Round-top stool (col 5, rows 12-13) 1×2

  // ── Rugs & Mats ───────────────────────────────────────────────

  alt_rug_beige:          { x: 7 * T, y: 2 * T, w: 3 * T, h: 3 * T },    // Beige striped rug (cols 7-9, rows 2-4) 3×3
  alt_rug_blue_gold:      { x: 14 * T, y: 10 * T, w: 2 * T, h: 4 * T },  // Blue/gold rug (cols 14-15, rows 10-13) 2×4
  alt_rug_red_gold:       { x: 7 * T, y: 15 * T, w: 3 * T, h: 3 * T },   // Red/gold rug (cols 7-9, rows 15-17) 3×3
  alt_rug_red_brown:      { x: 13 * T, y: 17 * T, w: 3 * T, h: 3 * T },  // Red/brown rug (cols 13-15, rows 17-19) 3×3
  alt_mat_green:          { x: 0, y: 42 * T, w: 2 * T, h: 2 * T },       // Green mat/rug (cols 0-1, rows 42-43) 2×2
  alt_mat_blue:           { x: 2 * T, y: 42 * T, w: 2 * T, h: 2 * T },   // Blue mat/rug (cols 2-3, rows 42-43) 2×2

  // ── Paintings & Wall Art ───────────────────────────────────────

  alt_painting_1:         { x: 0, y: 20 * T, w: 2 * T, h: T },           // Painting — fish scene (cols 0-1, row 20) 2×1
  alt_painting_2:         { x: 2 * T, y: 20 * T, w: 2 * T, h: T },      // Painting — colorful abstract (cols 2-3, row 20) 2×1
  alt_painting_3:         { x: 4 * T, y: 20 * T, w: 2 * T, h: T },      // Painting — red art (cols 4-5, row 20) 2×1
  alt_painting_fireplace: { x: 6 * T, y: 20 * T, w: 2 * T, h: 2 * T },  // Fireplace painting (cols 6-7, rows 20-21) 2×2
  alt_painting_frame_red: { x: 9 * T, y: 20 * T, w: 2 * T, h: 2 * T },  // Red/gold framed painting (cols 9-10, rows 20-21) 2×2
  alt_painting_frame_blue:{ x: 11 * T, y: 20 * T, w: 2 * T, h: 2 * T }, // Blue framed painting (cols 11-12, rows 20-21) 2×2
  alt_frame_cloud:        { x: 2 * T, y: 12 * T, w: 2 * T, h: T },      // Cloud landscape painting (cols 2-3, row 12) 2×1
  alt_poster_1:           { x: 0, y: 70 * T, w: T, h: T },               // Pixel poster 1 (col 0, row 70) 1×1
  alt_poster_2:           { x: T, y: 70 * T, w: T, h: T },               // Pixel poster 2 (col 1, row 70) 1×1
  alt_poster_3:           { x: 2 * T, y: 70 * T, w: T, h: T },           // Pixel poster 3 (col 2, row 70) 1×1
  alt_world_map:          { x: 8 * T, y: 67 * T, w: 2 * T, h: 2 * T },  // World map wall hanging (cols 8-9, rows 67-68) 2×2

  // ── Windows & Doors ────────────────────────────────────────────

  alt_window_red:         { x: 5 * T, y: 24 * T, w: 2 * T, h: 2 * T },   // Red window frame (cols 5-6, rows 24-25) 2×2
  alt_window_mirror:      { x: 7 * T, y: 24 * T, w: 2 * T, h: 2 * T },   // Mirror window (cols 7-8, rows 24-25) 2×2
  alt_window_cabinet:     { x: 9 * T, y: 24 * T, w: 2 * T, h: 2 * T },   // Cabinet/door brown (cols 9-10, rows 24-25) 2×2
  alt_window_large:       { x: 0, y: 26 * T, w: 2 * T, h: 2 * T },      // Large window (cols 0-1, rows 26-27) 2×2
  alt_window_wall:        { x: 0, y: 28 * T, w: 4 * T, h: 2 * T },      // Wall windows panel (cols 0-3, rows 28-29) 4×2
  alt_curtains_brown:     { x: 4 * T, y: 24 * T, w: 2 * T, h: 3 * T },  // Brown curtains/drapes (cols 4-5, rows 24-26) 2×3
  alt_door_wood:          { x: 7 * T, y: 9 * T, w: T, h: T },            // Small wooden door (col 7, row 9) 1×1

  // ── Plants & Decorations ───────────────────────────────────────

  alt_plant_tree_small:   { x: 10 * T, y: 45 * T, w: T, h: 2 * T },     // Small indoor tree (col 10, rows 45-46) 1×2
  alt_plant_tree_medium:  { x: 11 * T, y: 45 * T, w: T, h: 2 * T },     // Medium indoor tree (col 11, rows 45-46) 1×2
  alt_plant_palm:         { x: 12 * T, y: 44 * T, w: 2 * T, h: 3 * T }, // Palm tree in pot (cols 12-13, rows 44-46) 2×3
  alt_fruit_basket_1:     { x: 0, y: 52 * T, w: T, h: T },               // Fruit basket green (col 0, row 52) 1×1
  alt_fruit_basket_2:     { x: T, y: 52 * T, w: T, h: T },               // Fruit basket orange (col 1, row 52) 1×1
  alt_fruit_basket_3:     { x: 2 * T, y: 52 * T, w: T, h: T },           // Fruit basket pink (col 2, row 52) 1×1
  alt_aquarium_green:     { x: 0, y: 22 * T, w: 2 * T, h: 2 * T },      // Aquarium green (cols 0-1, rows 22-23) 2×2
  alt_aquarium_blue:      { x: 0, y: 24 * T, w: 2 * T, h: T },          // Aquarium blue (cols 0-1, row 24) 2×1
  alt_vase_pot_1:         { x: 0, y: 66 * T, w: T, h: T },               // Ceramic pot 1 (col 0, row 66) 1×1
  alt_vase_pot_2:         { x: T, y: 66 * T, w: T, h: T },               // Ceramic pot 2 (col 1, row 66) 1×1
  alt_fishbowl:           { x: 2 * T, y: 67 * T, w: T, h: T },           // Fishbowl (col 2, row 67) 1×1

  // ── Lamps & Lighting ──────────────────────────────────────────

  alt_lamp_red:           { x: 11 * T, y: 53 * T, w: T, h: 2 * T },     // Red table lamp (col 11, rows 53-54) — same region as red chair
  alt_lamp_stand_red:     { x: 9 * T, y: 55 * T, w: T, h: 2 * T },      // Red floor lamp (col 9, rows 55-56) 1×2
  alt_lamp_stand_blue:    { x: 10 * T, y: 55 * T, w: T, h: 2 * T },     // Blue floor lamp (col 10, rows 55-56) 1×2
  alt_lamp_desk_1:        { x: 13 * T, y: 55 * T, w: T, h: 2 * T },     // Desk lamp warm (col 13, rows 55-56) 1×2
  alt_lamp_desk_2:        { x: 14 * T, y: 55 * T, w: T, h: 2 * T },     // Desk lamp blue (col 14, rows 55-56) 1×2

  // ── Electronics & Appliances ───────────────────────────────────

  alt_tv_small:           { x: 3 * T, y: 4 * T, w: T, h: T },            // Small TV/monitor (col 3, row 4) 1×1
  alt_tv_wall:            { x: 0, y: 14 * T, w: 2 * T, h: 2 * T },      // Wall-mounted TV (cols 0-1, rows 14-15) 2×2
  alt_fridge:             { x: 3 * T, y: 5 * T, w: T, h: 3 * T },        // Refrigerator (col 3, rows 5-7) 1×3
  alt_fridge_grey:        { x: 10 * T, y: 40 * T, w: T, h: 2 * T },     // Grey fridge/server (col 10, rows 40-41) 1×2
  alt_chalkboard_sm:      { x: 8 * T, y: 40 * T, w: 2 * T, h: 2 * T }, // Small chalkboard (cols 8-9, rows 40-41) 2×2
  alt_chalkboard_lg:      { x: 12 * T, y: 40 * T, w: 2 * T, h: 2 * T },// Large chalkboard (cols 12-13, rows 40-41) 2×2
  alt_chalkboard_wide:    { x: 8 * T, y: 37 * T, w: 2 * T, h: T },      // Wide chalkboard (cols 8-9, row 37) 2×1
  alt_bulletin_board:     { x: 14 * T, y: 37 * T, w: 2 * T, h: 2 * T }, // Bulletin board (cols 14-15, rows 37-38) 2×2

  // ── Mirrors ────────────────────────────────────────────────────

  alt_mirror_wall:        { x: 0, y: 12 * T, w: T, h: T },               // Small wall mirror (col 0, row 12) 1×1
  alt_mirror_standing:    { x: 4 * T, y: 66 * T, w: T, h: 3 * T },      // Standing full-length mirror (col 4, rows 66-68) 1×3
  alt_mirror_ornate:      { x: 7 * T, y: 67 * T, w: T, h: 2 * T },      // Ornate standing mirror (col 7, rows 67-68) 1×2
  alt_mirror_hand:        { x: 0, y: 51 * T, w: T, h: T },               // Hand mirror/vanity mirror (col 0, row 51) 1×1

  // ── Globes & School Items ─────────────────────────────────────

  alt_globe_gold:         { x: 14 * T, y: 35 * T, w: T, h: 2 * T },     // Globe on gold stand (col 14, rows 35-36) 1×2
  alt_globe_wood:         { x: 15 * T, y: 35 * T, w: T, h: 2 * T },     // Globe on wood stand (col 15, rows 35-36) 1×2
  alt_globe_world:        { x: 10 * T, y: 67 * T, w: T, h: 2 * T },     // Blue globe (col 10, rows 67-68) 1×2
  alt_open_book:          { x: 7 * T, y: 37 * T, w: T, h: 2 * T },      // Open book on stand (col 7, rows 37-38) 1×2

  // ── Folding Screen & Mannequin ─────────────────────────────────

  alt_folding_screen:     { x: T, y: 22 * T, w: 2 * T, h: 2 * T },      // Decorative folding screen (cols 1-2, rows 22-23) 2×2
  alt_mannequin:          { x: 5 * T, y: 48 * T, w: T, h: 2 * T },      // Dress mannequin (col 5, rows 48-49) 1×2

  // ── Rustic / Country ──────────────────────────────────────────

  alt_crate_open:         { x: 5 * T, y: 60 * T, w: 2 * T, h: 2 * T },   // Open wooden crate (cols 5-6, rows 60-61) 2×2
  alt_crate_closed:       { x: 7 * T, y: 60 * T, w: T, h: T },           // Closed small crate (col 7, row 60) 1×1
  alt_guitar:             { x: 8 * T, y: 60 * T, w: T, h: 2 * T },       // Guitar standing (col 8, rows 60-61) 1×2
  alt_cabinet_rustic:     { x: 0, y: 62 * T, w: 2 * T, h: 2 * T },      // Rustic cabinet (cols 0-1, rows 62-63) 2×2
  alt_nightstand_1:       { x: 12 * T, y: 60 * T, w: T, h: 2 * T },     // Nightstand/clock cabinet (col 12, rows 60-61) 1×2
  alt_nightstand_2:       { x: 13 * T, y: 60 * T, w: T, h: 2 * T },     // Nightstand variant (col 13, rows 60-61) 1×2

  // ── TV Cabinets & Sideboards ──────────────────────────────────

  alt_tv_cabinet_1:       { x: 0, y: 60 * T, w: 2 * T, h: T },          // TV cabinet dark (cols 0-1, row 60) 2×1
  alt_tv_cabinet_2:       { x: 2 * T, y: 60 * T, w: 2 * T, h: T },     // TV cabinet light (cols 2-3, row 60) 2×1
  alt_sideboard_1:        { x: 0, y: 58 * T, w: 2 * T, h: T },          // Low sideboard (cols 0-1, row 58) 2×1
  alt_sideboard_2:        { x: 2 * T, y: 58 * T, w: T, h: T },          // Low sideboard narrow (col 2, row 58) 1×1

  // ── Cushions & Pillows ────────────────────────────────────────

  alt_cushion_blue:       { x: 10 * T, y: 74 * T, w: T, h: T },         // Blue star cushion (col 10, row 74) 1×1
  alt_cushion_gold:       { x: 11 * T, y: 74 * T, w: T, h: T },         // Gold star cushion (col 11, row 74) 1×1
  alt_pillow_purple:      { x: 6 * T, y: 74 * T, w: 2 * T, h: 2 * T }, // Purple floor pillow (cols 6-7, rows 74-75) 2×2
}
