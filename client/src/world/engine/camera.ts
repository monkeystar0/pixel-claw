import { CAMERA_FOLLOW_LERP, CAMERA_FOLLOW_SNAP_THRESHOLD } from '../constants.js'

export class Camera {
  x = 0
  y = 0
  viewportWidth: number
  viewportHeight: number
  zoom = 1

  private roomWidth = Infinity
  private roomHeight = Infinity
  private targetX = 0
  private targetY = 0
  private smoothEnabled = false
  private lerpFactor = CAMERA_FOLLOW_LERP

  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewportWidth = viewportWidth
    this.viewportHeight = viewportHeight
  }

  setRoomBounds(width: number, height: number): void {
    this.roomWidth = width
    this.roomHeight = height
  }

  enableSmooth(factor?: number): void {
    this.smoothEnabled = true
    if (factor !== undefined) this.lerpFactor = factor
  }

  disableSmooth(): void {
    this.smoothEnabled = false
  }

  follow(targetX: number, targetY: number): void {
    const desiredX = targetX - this.viewportWidth / 2
    const desiredY = targetY - this.viewportHeight / 2

    if (this.smoothEnabled) {
      this.targetX = this.clampX(desiredX)
      this.targetY = this.clampY(desiredY)
    } else {
      this.x = this.clampX(desiredX)
      this.y = this.clampY(desiredY)
    }
  }

  update(dt: number): void {
    if (!this.smoothEnabled) return

    const dx = this.targetX - this.x
    const dy = this.targetY - this.y

    if (Math.abs(dx) < CAMERA_FOLLOW_SNAP_THRESHOLD &&
        Math.abs(dy) < CAMERA_FOLLOW_SNAP_THRESHOLD) {
      this.x = this.targetX
      this.y = this.targetY
      return
    }

    const f = 1 - Math.pow(1 - this.lerpFactor, dt * 60)
    this.x += dx * f
    this.y += dy * f
  }

  resize(width: number, height: number): void {
    this.viewportWidth = width
    this.viewportHeight = height
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.x / this.zoom) * this.zoom,
      y: (wy - this.y / this.zoom) * this.zoom,
    }
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: sx / this.zoom + this.x / this.zoom,
      y: sy / this.zoom + this.y / this.zoom,
    }
  }

  private clampX(x: number): number {
    if (this.roomWidth <= this.viewportWidth) {
      return (this.roomWidth - this.viewportWidth) / 2
    }
    return Math.max(0, Math.min(x, this.roomWidth - this.viewportWidth))
  }

  private clampY(y: number): number {
    if (this.roomHeight <= this.viewportHeight) {
      return (this.roomHeight - this.viewportHeight) / 2
    }
    return Math.max(0, Math.min(y, this.roomHeight - this.viewportHeight))
  }
}
