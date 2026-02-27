import type { OfficeLayout, Character } from '../types.js'
import { OfficeState } from './officeState.js'

export interface RoomState {
  id: string
  officeState: OfficeState
  layout: OfficeLayout
  characters: Map<number, Character>
}

interface AgentMapping {
  sessionId: string
  roomId: string
  characterId: number
}

let nextCharId = 1

export class WorldState {
  private rooms = new Map<string, RoomState>()
  private currentRoomId: string | null = null
  private agentMap = new Map<string, AgentMapping>()

  addRoom(id: string, layout: OfficeLayout): void {
    if (this.rooms.has(id)) return
    const officeState = new OfficeState(layout)
    const room: RoomState = {
      id,
      officeState,
      layout,
      characters: officeState.characters,
    }
    this.rooms.set(id, room)
    if (this.currentRoomId === null) {
      this.currentRoomId = id
    }
  }

  setCurrentRoom(id: string): void {
    if (this.rooms.has(id)) {
      this.currentRoomId = id
    }
  }

  getCurrentRoomId(): string | null {
    return this.currentRoomId
  }

  getCurrentRoom(): RoomState | null {
    if (!this.currentRoomId) return null
    return this.rooms.get(this.currentRoomId) ?? null
  }

  getRoomIds(): string[] {
    return Array.from(this.rooms.keys())
  }

  getRoom(id: string): RoomState | null {
    return this.rooms.get(id) ?? null
  }

  addAgent(sessionId: string, roomId: string): void {
    if (this.agentMap.has(sessionId)) return
    const room = this.rooms.get(roomId)
    if (!room) return

    const charId = nextCharId++
    room.officeState.addAgent(charId, undefined, undefined, undefined, true)

    this.agentMap.set(sessionId, { sessionId, roomId, characterId: charId })
  }

  removeAgent(sessionId: string): void {
    const mapping = this.agentMap.get(sessionId)
    if (!mapping) return

    const room = this.rooms.get(mapping.roomId)
    if (room) {
      room.officeState.removeAgent(mapping.characterId)
    }
    this.agentMap.delete(sessionId)
  }

  getAgentRoom(sessionId: string): string | null {
    return this.agentMap.get(sessionId)?.roomId ?? null
  }

  getAgentCharacterId(sessionId: string): number | null {
    return this.agentMap.get(sessionId)?.characterId ?? null
  }

  setAgentActive(sessionId: string, active: boolean): void {
    const mapping = this.agentMap.get(sessionId)
    if (!mapping) return
    const room = this.rooms.get(mapping.roomId)
    if (room) {
      room.officeState.setAgentActive(mapping.characterId, active)
    }
  }

  setAgentTool(sessionId: string, tool: string | null): void {
    const mapping = this.agentMap.get(sessionId)
    if (!mapping) return
    const room = this.rooms.get(mapping.roomId)
    if (room) {
      room.officeState.setAgentTool(mapping.characterId, tool)
    }
  }

  update(dt: number): void {
    if (!this.currentRoomId) return
    const room = this.rooms.get(this.currentRoomId)
    if (room) {
      room.officeState.update(dt)
    }
  }

  getSessionByCharacterId(charId: number): string | null {
    for (const m of this.agentMap.values()) {
      if (m.characterId === charId) return m.sessionId
    }
    return null
  }

  getAllSessions(): Array<{ sessionId: string; roomId: string }> {
    return Array.from(this.agentMap.values()).map(m => ({
      sessionId: m.sessionId,
      roomId: m.roomId,
    }))
  }
}
