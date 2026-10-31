import { describe, expect, it } from 'vitest';
import { InboundFrameSchema } from './chat.schemas.js';

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
});

describe('master.monster-afflictions-update frame', () => {
  const frame = (afflictions: unknown) => ({
    type: 'master.monster-afflictions-update',
    sessionId: '11111111-1111-4111-8111-111111111111',
    monsterId: '22222222-2222-4222-8222-222222222222',
    afflictions,
  });

  it('rejects an unknown affliction key', () => {
    expect(InboundFrameSchema.safeParse(frame(['inventada'])).success).toBe(
      false,
    );
  });
});
