import { describe, it, expect, beforeEach } from 'vitest'
import {
  createPlayer,
  updatePlayer,
  getInteractTarget,
  getInteractFurniture,
} from '../../client/src/world/engine/player.js'
import type { Player, PlayerAppearance } from '../../client/src/world/engine/player.js'
import { Direction, CharacterState, TileType, TILE_SIZE, FurnitureType } from '../../client/src/world/types.js'
import type { Character, TileType as TileTypeVal, PlacedFurniture } from '../../client/src/world/types.js'

function makeSimpleTileMap(rows: number, cols: number): TileTypeVal[][] {
  const map: TileTypeVal[][] = []
  for (let r = 0; r < rows; r++) {
    const row: TileTypeVal[] = []
    for (let c = 0; c < cols; c++) {
      if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
        row.push(TileType.WALL)
      } else {
        row.push(TileType.FLOOR_1)
      }
    }
    map.push(row)
  }
  return map
}

describe('Player', () => {
  const defaultAppearance: PlayerAppearance = {
    palette: 0,
    hueShift: 0,
  }

  describe('createPlayer', () => {
    it('should create player at specified tile position', () => {
      const player = createPlayer(3, 3, defaultAppearance)
      expect(player.tileCol).toBe(3)
      expect(player.tileRow).toBe(3)
      expect(player.x).toBe(3 * TILE_SIZE + TILE_SIZE / 2)
      expect(player.y).toBe(3 * TILE_SIZE + TILE_SIZE / 2)
    })

    it('should initialize with DOWN direction', () => {
      const player = createPlayer(1, 1, defaultAppearance)
      expect(player.dir).toBe(Direction.DOWN)
    })

    it('should start in IDLE state', () => {
      const player = createPlayer(1, 1, defaultAppearance)
      expect(player.state).toBe(CharacterState.IDLE)
    })

    it('should apply appearance settings', () => {
      const appearance: PlayerAppearance = { palette: 3, hueShift: 90 }
      const player = createPlayer(1, 1, appearance)
      expect(player.palette).toBe(3)
      expect(player.hueShift).toBe(90)
    })
  })

  describe('updatePlayer', () => {
    let tileMap: TileTypeVal[][]
    let blockedTiles: Set<string>
    let player: Player

    beforeEach(() => {
      tileMap = makeSimpleTileMap(10, 10)
      blockedTiles = new Set()
      player = createPlayer(5, 5, defaultAppearance)
    })

    it('should move right when right key pressed', () => {
      const keys = { up: false, down: false, left: false, right: true }
      const initialX = player.x
      updatePlayer(player, keys, 0.1, tileMap, blockedTiles)
      expect(player.x).toBeGreaterThan(initialX)
    })

    it('should move left when left key pressed', () => {
      const keys = { up: false, down: false, left: true, right: false }
      const initialX = player.x
      updatePlayer(player, keys, 0.1, tileMap, blockedTiles)
      expect(player.x).toBeLessThan(initialX)
    })

    it('should move down when down key pressed', () => {
      const keys = { up: false, down: true, left: false, right: false }
      const initialY = player.y
      updatePlayer(player, keys, 0.1, tileMap, blockedTiles)
      expect(player.y).toBeGreaterThan(initialY)
    })

    it('should move up when up key pressed', () => {
      const keys = { up: true, down: false, left: false, right: false }
      const initialY = player.y
      updatePlayer(player, keys, 0.1, tileMap, blockedTiles)
      expect(player.y).toBeLessThan(initialY)
    })

    it('should update direction to face movement direction', () => {
      const keys = { up: false, down: false, left: true, right: false }
      updatePlayer(player, keys, 0.1, tileMap, blockedTiles)
      expect(player.dir).toBe(Direction.LEFT)
    })

    it('should not move through walls', () => {
      player = createPlayer(1, 1, defaultAppearance)
      const keys = { up: true, down: false, left: false, right: false }
      updatePlayer(player, keys, 0.5, tileMap, blockedTiles)
      expect(player.tileRow).toBeGreaterThanOrEqual(1)
    })

    it('should not move through blocked tiles', () => {
      blockedTiles.add('5,4')
      const keys = { up: true, down: false, left: false, right: false }
      const initialY = player.y
      updatePlayer(player, keys, 2.0, tileMap, blockedTiles)
      expect(player.tileRow).toBeGreaterThanOrEqual(4)
    })

    it('should not move when no keys pressed', () => {
      const keys = { up: false, down: false, left: false, right: false }
      const initialX = player.x
      const initialY = player.y
      updatePlayer(player, keys, 0.1, tileMap, blockedTiles)
      expect(player.x).toBe(initialX)
      expect(player.y).toBe(initialY)
    })

    it('should be in WALK state when moving', () => {
      const keys = { up: false, down: true, left: false, right: false }
      updatePlayer(player, keys, 0.1, tileMap, blockedTiles)
      expect(player.state).toBe(CharacterState.WALK)
    })

    it('should be in IDLE state when not moving', () => {
      const keys = { up: false, down: false, left: false, right: false }
      updatePlayer(player, keys, 0.1, tileMap, blockedTiles)
      expect(player.state).toBe(CharacterState.IDLE)
    })
  })

  describe('getInteractTarget', () => {
    it('should find agent within 2 tiles when facing them', () => {
      const player = createPlayer(5, 5, defaultAppearance)
      player.dir = Direction.RIGHT
      const agent: Character = {
        id: 1,
        state: CharacterState.TYPE,
        dir: Direction.DOWN,
        x: 7 * TILE_SIZE + TILE_SIZE / 2,
        y: 5 * TILE_SIZE + TILE_SIZE / 2,
        tileCol: 7,
        tileRow: 5,
        path: [],
        moveProgress: 0,
        currentTool: null,
        palette: 0,
        hueShift: 0,
        frame: 0,
        frameTimer: 0,
        wanderTimer: 0,
        wanderCount: 0,
        wanderLimit: 5,
        isActive: true,
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
      const target = getInteractTarget(player, [agent])
      expect(target).toBe(1)
    })

    it('should not find agent beyond 2 tiles', () => {
      const player = createPlayer(5, 5, defaultAppearance)
      player.dir = Direction.RIGHT
      const agent: Character = {
        id: 1,
        state: CharacterState.TYPE,
        dir: Direction.DOWN,
        x: 9 * TILE_SIZE + TILE_SIZE / 2,
        y: 5 * TILE_SIZE + TILE_SIZE / 2,
        tileCol: 9,
        tileRow: 5,
        path: [],
        moveProgress: 0,
        currentTool: null,
        palette: 0,
        hueShift: 0,
        frame: 0,
        frameTimer: 0,
        wanderTimer: 0,
        wanderCount: 0,
        wanderLimit: 5,
        isActive: true,
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
      const target = getInteractTarget(player, [agent])
      expect(target).toBeNull()
    })

    it('should not find agent in wrong direction', () => {
      const player = createPlayer(5, 5, defaultAppearance)
      player.dir = Direction.LEFT
      const agent: Character = {
        id: 1,
        state: CharacterState.TYPE,
        dir: Direction.DOWN,
        x: 7 * TILE_SIZE + TILE_SIZE / 2,
        y: 5 * TILE_SIZE + TILE_SIZE / 2,
        tileCol: 7,
        tileRow: 5,
        path: [],
        moveProgress: 0,
        currentTool: null,
        palette: 0,
        hueShift: 0,
        frame: 0,
        frameTimer: 0,
        wanderTimer: 0,
        wanderCount: 0,
        wanderLimit: 5,
        isActive: true,
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
      const target = getInteractTarget(player, [agent])
      expect(target).toBeNull()
    })

    it('should return null when no agents nearby', () => {
      const player = createPlayer(5, 5, defaultAppearance)
      const target = getInteractTarget(player, [])
      expect(target).toBeNull()
    })

    it('should find nearest agent when multiple in range', () => {
      const player = createPlayer(5, 5, defaultAppearance)
      player.dir = Direction.RIGHT
      const makeAgent = (id: number, col: number): Character => ({
        id,
        state: CharacterState.TYPE,
        dir: Direction.DOWN,
        x: col * TILE_SIZE + TILE_SIZE / 2,
        y: 5 * TILE_SIZE + TILE_SIZE / 2,
        tileCol: col,
        tileRow: 5,
        path: [],
        moveProgress: 0,
        currentTool: null,
        palette: 0,
        hueShift: 0,
        frame: 0,
        frameTimer: 0,
        wanderTimer: 0,
        wanderCount: 0,
        wanderLimit: 5,
        isActive: true,
        seatId: null,
        bubbleType: null,
        bubbleTimer: 0,
        seatTimer: 0,
        isSubagent: false,
        parentAgentId: null,
        matrixEffect: null,
        matrixEffectTimer: 0,
        matrixEffectSeeds: [],
      })
      const target = getInteractTarget(player, [makeAgent(2, 7), makeAgent(1, 6)])
      expect(target).toBe(1)
    })
  })

  describe('getInteractFurniture', () => {
    it('should find wardrobe within range when facing it', () => {
      const player = createPlayer(2, 5, defaultAppearance)
      player.dir = Direction.UP
      const furniture: PlacedFurniture[] = [
        { uid: 'w1', type: FurnitureType.WARDROBE, col: 1, row: 3 },
      ]
      const result = getInteractFurniture(player, furniture, FurnitureType.WARDROBE)
      expect(result).not.toBeNull()
      expect(result!.uid).toBe('w1')
    })

    it('should return null when no wardrobe in range', () => {
      const player = createPlayer(5, 5, defaultAppearance)
      player.dir = Direction.UP
      const furniture: PlacedFurniture[] = [
        { uid: 'w1', type: FurnitureType.WARDROBE, col: 1, row: 1 },
      ]
      const result = getInteractFurniture(player, furniture, FurnitureType.WARDROBE)
      expect(result).toBeNull()
    })

    it('should ignore non-matching furniture types', () => {
      const player = createPlayer(2, 3, defaultAppearance)
      player.dir = Direction.RIGHT
      const furniture: PlacedFurniture[] = [
        { uid: 'd1', type: FurnitureType.DESK, col: 3, row: 3 },
      ]
      const result = getInteractFurniture(player, furniture, FurnitureType.WARDROBE)
      expect(result).toBeNull()
    })

    it('should use fallback distance when not facing furniture', () => {
      const player = createPlayer(2, 5, defaultAppearance)
      player.dir = Direction.LEFT
      const furniture: PlacedFurniture[] = [
        { uid: 'w1', type: FurnitureType.WARDROBE, col: 1, row: 3 },
      ]
      const result = getInteractFurniture(player, furniture, FurnitureType.WARDROBE)
      expect(result).not.toBeNull()
      expect(result!.uid).toBe('w1')
    })
  })

  describe('appearance persistence', () => {
    it('should serialize appearance to JSON', () => {
      const appearance: PlayerAppearance = { palette: 2, hueShift: 45 }
      const json = JSON.stringify(appearance)
      const parsed = JSON.parse(json) as PlayerAppearance
      expect(parsed.palette).toBe(2)
      expect(parsed.hueShift).toBe(45)
    })
  })
})
