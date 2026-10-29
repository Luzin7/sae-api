import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import type { CharacterSnapshot } from '../character-access.contract.js';
import {
  ChatCharacterNotFoundError,
  ChatMonsterNotFoundError,
  CombatStateNotFoundError,
  MasterOnlyError,
} from '../chat.errors.js';
import {
  fixedRng,
  makeCharacterAccess,
  makeChatMessages,
  makeCombat,
  makeGameAccess,
} from '../chat.testkit.js';
import type { CombatStatePayload } from '@modules/session/session.entity.js';
import { MonsterAttackService } from './monster-attack.service.js';

const STATE: CombatStatePayload = {
  active: true,
  turnIndex: 0,
  round: 1,
  entries: [
    {
      combatantId: 'c-1',
      kind: 'monster',
      refId: 'monster-1',
      name: 'Goblin',
      initiativeValue: null,
      hasRolled: false,
      currentHp: 20,
      maxHp: 20,
      currentEffort: 10,
      maxEffort: 10,
      afflictions: [],
      cognition: 2,
      psyche: -2,
      instinct: 0,
      constitution: 3,
      motricity: 1,
      perception: 0,
    },
  ],
};

const SNAPSHOT_STATE: CombatStatePayload = {
  ...STATE,
  entries: [{ ...STATE.entries[0]!, cognition: 3 }],
};

function makeTarget(
  overrides: Partial<CharacterSnapshot> = {},
): CharacterSnapshot {
  return {
    id: 'char-1',
    gameId: 'game-1',
    playerId: 'p2',
    name: 'Ana',
    currentHp: 20,
    maxHp: 26,
    currentEffort: 0,
    maxEffort: 20,
    bExp: 0,
    attributes: {
      cognition: -5,
      psyche: -5,
      instinct: -5,
      constitution: -5,
      motricity: -5,
      perception: -5,
    },
    ...overrides,
  };
}

function build() {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const characters = makeCharacterAccess();
  const combat = makeCombat();
  const bus = new InMemoryMessageBus();
  const service = new MonsterAttackService(
    messages,
    access,
    characters,
    combat,
    bus,
    fixedRng(12),
  );

  vi.mocked(messages.findSession).mockResolvedValue({
    id: 'session-1',
    gameId: 'game-1',
  });
  vi.mocked(access.findById).mockResolvedValue({
    id: 'game-1',
    masterId: 'p1',
  });
  vi.mocked(access.isMember).mockResolvedValue(true);

  return { messages, access, characters, combat, bus, service };
}

describe('MonsterAttackService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rolls, applies damage and broadcasts the attack', async () => {
    const { messages, characters, combat, bus, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(STATE);
    vi.mocked(characters.findById).mockResolvedValue(makeTarget());
    vi.mocked(characters.changeHp).mockResolvedValue({ oldHp: 20, newHp: 15 });
    const publish = vi.spyOn(bus, 'publish');

    const event = await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      monsterId: 'monster-1',
      attribute: 'cognition',
      targetCharacterId: 'char-1',
      damage: 5,
    });

    expect(characters.changeHp).toHaveBeenCalledWith('char-1', -5, {
      sessionId: 'session-1',
      playerId: 'p1',
    });
    expect(event).toEqual({
      type: 'session.monster-attacked',
      monsterId: 'monster-1',
      name: 'Goblin',
      attribute: 'cognition',
      targetCharacterId: 'char-1',
      targetName: 'Ana',
      rolls: [12, 12],
      result: 12,
      kind: 'best',
      damage: 5,
    });
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'character.hp-changed',
      characterId: 'char-1',
      oldHp: 20,
      newHp: 15,
    });
    expect(publish).toHaveBeenCalledWith(
      'session:session-1',
      expect.objectContaining({ type: 'session.monster-attacked' }),
    );
    expect(messages.appendLog).toHaveBeenCalledWith({
      sessionId: 'session-1',
      playerId: 'p1',
      eventType: 'dice_roll',
      payload: {
        expression: 'Goblin atacou Ana (cognition)',
        results: [12, 12],
        total: 12,
      },
    });
    expect(
      vi.mocked(messages.appendLog).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(characters.changeHp).mock.invocationCallOrder[0] ?? 0,
    );
    expect(
      vi.mocked(characters.changeHp).mock.invocationCallOrder[0],
    ).toBeLessThan(publish.mock.invocationCallOrder[0] ?? 0);
  });

  it('broadcasts the HP returned by the repository, not the stale snapshot', async () => {
    const { characters, combat, bus, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(STATE);
    vi.mocked(characters.findById).mockResolvedValue(makeTarget());
    vi.mocked(characters.changeHp).mockResolvedValue({ oldHp: 2, newHp: 0 });
    const publish = vi.spyOn(bus, 'publish');

    await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      monsterId: 'monster-1',
      attribute: 'cognition',
      targetCharacterId: 'char-1',
      damage: 5,
    });

    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'character.hp-changed',
      characterId: 'char-1',
      oldHp: 2,
      newHp: 0,
    });
  });

  it('does not touch HP when there is no damage', async () => {
    const { characters, combat, bus, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(STATE);
    vi.mocked(characters.findById).mockResolvedValue(makeTarget());
    const publish = vi.spyOn(bus, 'publish');

    const event = await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      monsterId: 'monster-1',
      attribute: 'cognition',
      targetCharacterId: 'char-1',
      damage: 0,
    });

    expect(characters.changeHp).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalledWith(
      'session:session-1',
      expect.objectContaining({ type: 'character.hp-changed' }),
    );
    expect(event).toEqual(expect.objectContaining({ damage: 0 }));
  });

  it('forbids a non-master before rolling', async () => {
    const { access, characters, combat, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        monsterId: 'monster-1',
        attribute: 'cognition',
        targetCharacterId: 'char-1',
        damage: 5,
      }),
    ).rejects.toBeInstanceOf(MasterOnlyError);
    expect(combat.findState).not.toHaveBeenCalled();
    expect(characters.changeHp).not.toHaveBeenCalled();
  });

  it('rejects when there is no active combat', async () => {
    const { combat, characters, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(null);

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        monsterId: 'monster-1',
        attribute: 'cognition',
        targetCharacterId: 'char-1',
        damage: 5,
      }),
    ).rejects.toBeInstanceOf(CombatStateNotFoundError);
    expect(characters.changeHp).not.toHaveBeenCalled();
  });

  it('rolls the attribute snapshotted on the combatant instance', async () => {
    const { characters, combat, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(SNAPSHOT_STATE);
    vi.mocked(characters.findById).mockResolvedValue(makeTarget());

    const event = await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      monsterId: 'monster-1',
      attribute: 'cognition',
      targetCharacterId: 'char-1',
      damage: 0,
    });

    expect(event).toMatchObject({
      rolls: [12, 12, 12],
      result: 12,
      kind: 'best',
    });
  });

  it('rejects a combatant without a snapshotted attribute', async () => {
    const { characters, combat, service } = build();
    vi.mocked(combat.findState).mockResolvedValue({
      ...STATE,
      entries: [{ ...STATE.entries[0]!, cognition: null }],
    });

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        monsterId: 'monster-1',
        attribute: 'cognition',
        targetCharacterId: 'char-1',
        damage: 5,
      }),
    ).rejects.toBeInstanceOf(ChatMonsterNotFoundError);
    expect(characters.findById).not.toHaveBeenCalled();
  });

  it('rejects a monster that is not in the combat', async () => {
    const { characters, combat, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(STATE);

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        monsterId: 'foreign-monster',
        attribute: 'cognition',
        targetCharacterId: 'char-1',
        damage: 5,
      }),
    ).rejects.toBeInstanceOf(ChatMonsterNotFoundError);
    expect(characters.findById).not.toHaveBeenCalled();
  });

  it('rejects a target from another game', async () => {
    const { characters, combat, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(STATE);
    vi.mocked(characters.findById).mockResolvedValue(
      makeTarget({ gameId: 'other-game' }),
    );

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        monsterId: 'monster-1',
        attribute: 'cognition',
        targetCharacterId: 'char-1',
        damage: 5,
      }),
    ).rejects.toBeInstanceOf(ChatCharacterNotFoundError);
    expect(characters.changeHp).not.toHaveBeenCalled();
  });
});
