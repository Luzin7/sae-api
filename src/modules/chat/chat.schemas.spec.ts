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
  afflictions: ['trauma'],
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

describe('character.pe-change frame', () => {
  const frame = (delta: unknown) => ({
    type: 'character.pe-change',
    sessionId: '11111111-1111-4111-8111-111111111111',
    characterId: '22222222-2222-4222-8222-222222222222',
    delta,
  });

  it.each([3, -3, 100, -100])('accepts delta %i', (delta) => {
    expect(InboundFrameSchema.safeParse(frame(delta)).success).toBe(true);
  });

  it.each([0, 101, -101, 1.5, '3'])('rejects delta %s', (delta) => {
    expect(InboundFrameSchema.safeParse(frame(delta)).success).toBe(false);
  });
});

describe('master.monster-pe-change frame', () => {
  const frame = (delta: unknown) => ({
    type: 'master.monster-pe-change',
    sessionId: '11111111-1111-4111-8111-111111111111',
    monsterId: '22222222-2222-4222-8222-222222222222',
    delta,
  });

  it('accepts a bounded integer delta', () => {
    expect(InboundFrameSchema.safeParse(frame(-4)).success).toBe(true);
  });

  it.each([0, 101, 2.5])('rejects delta %s', (delta) => {
    expect(InboundFrameSchema.safeParse(frame(delta)).success).toBe(false);
  });
});

describe('hp delta frames', () => {
  const SESSION_ID = '11111111-1111-4111-8111-111111111111';
  const TARGET_ID = '22222222-2222-4222-8222-222222222222';
  const characterFrame = (delta: unknown) => ({
    type: 'character.hp-change',
    sessionId: SESSION_ID,
    characterId: TARGET_ID,
    delta,
  });
  const monsterFrame = (delta: unknown) => ({
    type: 'master.monster-hp-change',
    sessionId: SESSION_ID,
    monsterId: TARGET_ID,
    delta,
  });

  it.each([5, -5, 1000, -1000])('accepts delta %i on both frames', (delta) => {
    expect(InboundFrameSchema.safeParse(characterFrame(delta)).success).toBe(
      true,
    );
    expect(InboundFrameSchema.safeParse(monsterFrame(delta)).success).toBe(
      true,
    );
  });

  it.each([0, 1001, -1001, 1.5, '3'])(
    'rejects delta %s on both frames',
    (delta) => {
      expect(InboundFrameSchema.safeParse(characterFrame(delta)).success).toBe(
        false,
      );
      expect(InboundFrameSchema.safeParse(monsterFrame(delta)).success).toBe(
        false,
      );
    },
  );

  it.each([
    { type: 'character.hp-update', newHp: 5 },
    { type: 'master.force-hp-update', newHp: 5 },
    { type: 'master.monster-vitals-update', currentHp: 5 },
  ])('no longer accepts the absolute frame $type', (extra) => {
    expect(
      InboundFrameSchema.safeParse({
        sessionId: SESSION_ID,
        characterId: TARGET_ID,
        monsterId: TARGET_ID,
        ...extra,
      }).success,
    ).toBe(false);
  });

  it('accepts the np-changed frame', () => {
    const frame = {
      type: 'character.np-changed',
      characterId: 'char-1',
      oldNp: 3,
      newNp: 4,
    };

    const result = OutboundEventSchema.safeParse(frame);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(frame);
  });

  it('no longer accepts session.monster-vitals as an outbound event', () => {
    expect(
      OutboundEventSchema.safeParse({
        type: 'session.monster-vitals',
        monsterId: 'mon-1',
      }).success,
    ).toBe(false);
  });
});

describe('master.monster-afflictions-update frame', () => {
  const frame = (afflictions: unknown) => ({
    type: 'master.monster-afflictions-update',
    sessionId: '11111111-1111-4111-8111-111111111111',
    monsterId: '22222222-2222-4222-8222-222222222222',
    afflictions,
  });

  it('accepts a list of known afflictions, including an empty one', () => {
    expect(
      InboundFrameSchema.safeParse(frame(['fobia', 'vicio'])).success,
    ).toBe(true);
    expect(InboundFrameSchema.safeParse(frame([])).success).toBe(true);
  });

  it('rejects an unknown affliction key', () => {
    expect(InboundFrameSchema.safeParse(frame(['inventada'])).success).toBe(
      false,
    );
  });

  it('rejects a missing list', () => {
    expect(InboundFrameSchema.safeParse(frame(undefined)).success).toBe(false);
  });
});
