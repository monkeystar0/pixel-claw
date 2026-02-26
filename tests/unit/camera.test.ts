import { describe, it, expect, beforeEach } from 'vitest'
import { Camera } from '../../client/src/world/engine/camera.js'
import { TILE_SIZE } from '../../client/src/world/types.js'

describe('Camera', () => {
  let camera: Camera

  beforeEach(() => {
    camera = new Camera(800, 600)
  })

  describe('initialization', () => {
    it('should create with viewport dimensions', () => {
      expect(camera.viewportWidth).toBe(800)
      expect(camera.viewportHeight).toBe(600)
    })

    it('should start at origin', () => {
      expect(camera.x).toBe(0)
      expect(camera.y).toBe(0)
    })
  })

  describe('follow', () => {
    it('should center viewport on target position', () => {
      camera.setRoomBounds(2000, 2000)
      camera.follow(1000, 1000)
      expect(camera.x).toBe(1000 - 400)
      expect(camera.y).toBe(1000 - 300)
    })

    it('should clamp to room boundaries', () => {
      camera.setRoomBounds(2000, 2000)
      camera.follow(0, 0)
      expect(camera.x).toBeGreaterThanOrEqual(0)
      expect(camera.y).toBeGreaterThanOrEqual(0)
    })

    it('should not scroll past right/bottom edge', () => {
      const roomW = 100 * TILE_SIZE
      const roomH = 60 * TILE_SIZE
      camera.setRoomBounds(roomW, roomH)
      camera.follow(roomW, roomH)
      expect(camera.x + camera.viewportWidth).toBeLessThanOrEqual(roomW)
      expect(camera.y + camera.viewportHeight).toBeLessThanOrEqual(roomH)
    })

    it('should center room when it fits in viewport', () => {
      const roomW = 400
      const roomH = 300
      camera.setRoomBounds(roomW, roomH)
      camera.follow(200, 150)
      expect(camera.x).toBe((roomW - 800) / 2)
      expect(camera.y).toBe((roomH - 600) / 2)
    })
  })

  describe('smooth follow', () => {
    it('should lerp toward target when enabled', () => {
      camera.enableSmooth(0.1)
      camera.follow(500, 400)
      const x1 = camera.x
      camera.update(0.016)
      expect(camera.x).not.toBe(x1)
    })

    it('should snap when close to target', () => {
      camera.enableSmooth(0.5)
      camera.follow(400, 300)
      camera.x = camera.x + 0.3
      camera.y = camera.y + 0.3
      const targetX = camera.x - 0.3
      camera.update(0.016)
      expect(camera.x).toBe(targetX)
    })
  })

  describe('coordinate conversion', () => {
    it('should convert world to screen coordinates', () => {
      camera.x = 50
      camera.y = 100
      const screen = camera.worldToScreen(150, 200)
      expect(screen.x).toBe(100)
      expect(screen.y).toBe(100)
    })

    it('should convert screen to world coordinates', () => {
      camera.x = 50
      camera.y = 100
      const world = camera.screenToWorld(100, 100)
      expect(world.x).toBe(150)
      expect(world.y).toBe(200)
    })

    it('should round-trip world -> screen -> world', () => {
      camera.x = 73
      camera.y = 142
      const wx = 500
      const wy = 300
      const screen = camera.worldToScreen(wx, wy)
      const world = camera.screenToWorld(screen.x, screen.y)
      expect(world.x).toBe(wx)
      expect(world.y).toBe(wy)
    })
  })

  describe('resize', () => {
    it('should update viewport dimensions', () => {
      camera.resize(1024, 768)
      expect(camera.viewportWidth).toBe(1024)
      expect(camera.viewportHeight).toBe(768)
    })
  })

  describe('zoom', () => {
    it('should apply zoom factor to coordinate conversions', () => {
      camera.zoom = 2
      camera.x = 0
      camera.y = 0
      const screen = camera.worldToScreen(100, 100)
      expect(screen.x).toBe(200)
      expect(screen.y).toBe(200)
    })
  })
})
