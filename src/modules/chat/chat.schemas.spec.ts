import { describe, expect, it } from 'vitest';
import { InboundFrameSchema, OutboundEventSchema } from './chat.schemas.js';

const MONSTER_ENTRY = {
  combatantId: 'c-1',
  kind: 'monster' as const,
  refId: 'mon-1',
  name: 'Goblin',
  initiativeValue: null,
  hasRolled: false,
  currentHp: 20,
  maxHp: 20,
  currentEffort: 10,
  maxEffort: 10,
  afflictions: ['ferido'],
  cognition: 2,
  psyche: -2,
  instinct: 0,
  constitution: 3,
  motricity: 1,
  perception: 0,
};

const CHARACTER_ENTRY = {
  combatantId: 'c-2',
  kind: 'character' as const,
  refId: 'char-1',
  name: 'Ana',
  initiativeValue: 10,
  hasRolled: true,
  currentHp: null,
  maxHp: null,
  currentEffort: null,
  maxEffort: null,
  afflictions: [],
  cognition: null,
  psyche: null,
  instinct: null,
  constitution: null,
  motricity: null,
  perception: null,
};

describe('OutboundEventSchema', () => {
  it('keeps the combatant instance fields in session.combat', () => {
    const result = OutboundEventSchema.safeParse({
      type: 'session.combat',
      active: true,
      turnIndex: 0,
      round: 1,
      entries: [MONSTER_ENTRY, CHARACTER_ENTRY],
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      type: 'session.combat',
      active: true,
      turnIndex: 0,
      round: 1,
      entries: [MONSTER_ENTRY, CHARACTER_ENTRY],
    });
  });

  it('still accepts session.monster-vitals', () => {
    const event = {
      type: 'session.monster-vitals' as const,
      monsterId: 'mon-1',
      currentHp: 20,
      maxHp: 20,
      currentEffort: 10,
      maxEffort: 10,
      afflictions: ['ferido'],
    };

    const result = OutboundEventSchema.safeParse(event);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(event);
  });
});

describe('InboundFrameSchema master.next-turn', () => {
  const SESSION_ID = '11111111-1111-4111-8111-111111111111';

  it('accepts a frame with the expected turn and round', () => {
    const result = InboundFrameSchema.safeParse({
      type: 'master.next-turn',
      sessionId: SESSION_ID,
      expectedTurnIndex: 0,
      expectedRound: 1,
    });

    expect(result.success).toBe(true);
  });

  it('rejects a frame without the expected turn and round', () => {
    const result = InboundFrameSchema.safeParse({
      type: 'master.next-turn',
      sessionId: SESSION_ID,
    });

    expect(result.success).toBe(false);
  });
});
