import { describe, it, expect, beforeEach } from 'vitest'
import { WorldState } from '../../client/src/world/engine/worldState.js'
import { createDefaultLayout } from '../../client/src/world/layout/layoutSerializer.js'

describe('WorldState', () => {
  let world: WorldState

  beforeEach(() => {
    world = new WorldState()
  })

  describe('room management', () => {
    it('should add a room with a layout', () => {
      const layout = createDefaultLayout()
      world.addRoom('main-hall', layout)
      expect(world.getRoomIds()).toContain('main-hall')
    })

    it('should add multiple rooms', () => {
      world.addRoom('main-hall', createDefaultLayout())
      world.addRoom('slack-room', createDefaultLayout())
      world.addRoom('discord-room', createDefaultLayout())
      expect(world.getRoomIds()).toHaveLength(3)
    })

    it('should set current room', () => {
      world.addRoom('main-hall', createDefaultLayout())
      world.addRoom('slack-room', createDefaultLayout())
      world.setCurrentRoom('slack-room')
      expect(world.getCurrentRoomId()).toBe('slack-room')
    })

    it('should default to first added room', () => {
      world.addRoom('main-hall', createDefaultLayout())
      world.addRoom('slack-room', createDefaultLayout())
      expect(world.getCurrentRoomId()).toBe('main-hall')
    })

    it('should get room state by id', () => {
      world.addRoom('main-hall', createDefaultLayout())
      const room = world.getRoom('main-hall')
      expect(room).toBeDefined()
      expect(room!.layout).toBeDefined()
      expect(room!.characters).toBeDefined()
    })

    it('should return null for unknown room', () => {
      expect(world.getRoom('nonexistent')).toBeNull()
    })
  })

  describe('agent management', () => {
    beforeEach(() => {
      world.addRoom('main-hall', createDefaultLayout())
      world.addRoom('slack-room', createDefaultLayout())
    })

    it('should add agent to a specific room', () => {
      world.addAgent('session-1', 'main-hall')
      const room = world.getRoom('main-hall')!
      expect(room.characters.size).toBe(1)
    })

    it('should add agents to different rooms', () => {
      world.addAgent('session-1', 'main-hall')
      world.addAgent('session-2', 'slack-room')

      expect(world.getRoom('main-hall')!.characters.size).toBe(1)
      expect(world.getRoom('slack-room')!.characters.size).toBe(1)
    })

    it('should remove agent from correct room', () => {
      world.addAgent('session-1', 'main-hall')
      world.addAgent('session-2', 'main-hall')
      world.removeAgent('session-1')

      expect(world.getAgentRoom('session-1')).toBeNull()
      expect(world.getAgentRoom('session-2')).toBe('main-hall')
    })

    it('should not add duplicate agents', () => {
      world.addAgent('session-1', 'main-hall')
      world.addAgent('session-1', 'main-hall')

      expect(world.getRoom('main-hall')!.characters.size).toBe(1)
    })

    it('should track which room an agent is in', () => {
      world.addAgent('session-1', 'main-hall')
      world.addAgent('session-2', 'slack-room')

      expect(world.getAgentRoom('session-1')).toBe('main-hall')
      expect(world.getAgentRoom('session-2')).toBe('slack-room')
    })

    it('should return null for unknown agent room', () => {
      expect(world.getAgentRoom('nonexistent')).toBeNull()
    })
  })

  describe('agent state updates', () => {
    beforeEach(() => {
      world.addRoom('main-hall', createDefaultLayout())
      world.addAgent('session-1', 'main-hall')
    })

    it('should set agent active state', () => {
      world.setAgentActive('session-1', true)
      const room = world.getRoom('main-hall')!
      const charId = world.getAgentCharacterId('session-1')!
      const ch = room.characters.get(charId)!
      expect(ch.isActive).toBe(true)
    })

    it('should set agent tool', () => {
      world.setAgentTool('session-1', 'Read')
      const room = world.getRoom('main-hall')!
      const charId = world.getAgentCharacterId('session-1')!
      const ch = room.characters.get(charId)!
      expect(ch.currentTool).toBe('Read')
    })

    it('should clear agent tool', () => {
      world.setAgentTool('session-1', 'Read')
      world.setAgentTool('session-1', null)
      const room = world.getRoom('main-hall')!
      const charId = world.getAgentCharacterId('session-1')!
      const ch = room.characters.get(charId)!
      expect(ch.currentTool).toBeNull()
    })
  })

  describe('update loop', () => {
    beforeEach(() => {
      world.addRoom('main-hall', createDefaultLayout())
      world.addRoom('slack-room', createDefaultLayout())
      world.addAgent('session-1', 'main-hall')
      world.addAgent('session-2', 'slack-room')
      world.setCurrentRoom('main-hall')
    })

    it('should update current room characters', () => {
      const room = world.getRoom('main-hall')!
      const charId = world.getAgentCharacterId('session-1')!
      const before = room.characters.get(charId)!.frameTimer
      world.update(0.1)
      const after = room.characters.get(charId)!.frameTimer
      expect(after).not.toBe(before)
    })

    it('should not update non-current room characters', () => {
      const room = world.getRoom('slack-room')!
      const charId = world.getAgentCharacterId('session-2')!
      const before = room.characters.get(charId)!.frameTimer
      world.update(0.1)
      const after = room.characters.get(charId)!.frameTimer
      expect(after).toBe(before)
    })
  })

  describe('agent bubble management', () => {
    beforeEach(() => {
      world.addRoom('main-hall', createDefaultLayout())
      world.addAgent('session-1', 'main-hall')
    })

    it('should show thinking bubble on agent', () => {
      world.showAgentThinkingBubble('session-1')
      const room = world.getRoom('main-hall')!
      const charId = world.getAgentCharacterId('session-1')!
      const ch = room.characters.get(charId)!
      expect(ch.bubbleType).toBe('thinking')
    })

    it('should dismiss agent bubble', () => {
      world.showAgentThinkingBubble('session-1')
      world.dismissAgentBubble('session-1')
      const room = world.getRoom('main-hall')!
      const charId = world.getAgentCharacterId('session-1')!
      const ch = room.characters.get(charId)!
      expect(ch.bubbleType).toBeNull()
    })

    it('should show done bubble after thinking', () => {
      world.showAgentThinkingBubble('session-1')
      world.showAgentDoneBubble('session-1')
      const room = world.getRoom('main-hall')!
      const charId = world.getAgentCharacterId('session-1')!
      const ch = room.characters.get(charId)!
      expect(ch.bubbleType).toBe('waiting')
      expect(ch.bubbleTimer).toBeGreaterThan(0)
    })

    it('should not show thinking bubble for unknown session', () => {
      world.showAgentThinkingBubble('nonexistent')
      const room = world.getRoom('main-hall')!
      const charId = world.getAgentCharacterId('session-1')!
      const ch = room.characters.get(charId)!
      expect(ch.bubbleType).toBeNull()
    })
  })

  describe('getAllSessions', () => {
    it('should return all session-to-room mappings', () => {
      world.addRoom('main-hall', createDefaultLayout())
      world.addRoom('slack-room', createDefaultLayout())
      world.addAgent('session-1', 'main-hall')
      world.addAgent('session-2', 'slack-room')

      const sessions = world.getAllSessions()
      expect(sessions).toHaveLength(2)
      expect(sessions).toContainEqual({ sessionId: 'session-1', roomId: 'main-hall' })
      expect(sessions).toContainEqual({ sessionId: 'session-2', roomId: 'slack-room' })
    })
  })
})
