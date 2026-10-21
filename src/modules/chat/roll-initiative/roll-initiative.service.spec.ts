import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import {
  ChatForbiddenError,
  CombatantNotFoundError,
  CombatStateNotFoundError,
  MasterOnlyError,
} from '../chat.errors.js';
import {
  fixedRng,
  makeChatMessages,
  makeCombat,
  makeCombatants,
  makeGameAccess,
} from '../chat.testkit.js';
import type { CombatantRef } from '../combatant-source.contract.js';
import type { CombatStatePayload } from '@modules/session/session.entity.js';
import { RollInitiativeService } from './roll-initiative.service.js';

const CHARACTER_REF: CombatantRef = {
  kind: 'character',
  refId: 'char-1',
  name: 'Ana',
  ownerPlayerId: 'p1',
};

const MONSTER_REF: CombatantRef = {
  kind: 'monster',
  refId: 'mon-1',
  name: 'Goblin',
  ownerPlayerId: null,
};

function state(): CombatStatePayload {
  return {
    active: true,
    turnIndex: 0,
    round: 1,
    entries: [
      {
        combatantId: 'c-1',
        kind: 'character',
        refId: 'char-1',
        name: 'Ana',
        initiativeValue: 10,
        hasRolled: true,
      },
    ],
  };
}

function build() {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const combatants = makeCombatants();
  const combat = makeCombat();
  const bus = new InMemoryMessageBus();
  const service = new RollInitiativeService(
    messages,
    access,
    combatants,
    combat,
    bus,
    fixedRng(7),
  );

  vi.mocked(messages.findSession).mockResolvedValue({
    id: 'session-1',
    gameId: 'game-1',
  });
  vi.mocked(access.findById).mockResolvedValue({
    id: 'game-1',
    masterId: 'master-1',
  });
  vi.mocked(access.isMember).mockResolvedValue(true);
  vi.mocked(combat.findState).mockResolvedValue(state());
  vi.mocked(combat.rollInitiative).mockResolvedValue(state());

  return { messages, access, combatants, combat, bus, service };
}

describe('RollInitiativeService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('delegates the unique roll to the repository and passes a generator', async () => {
    const { combatants, combat, bus, service } = build();
    vi.mocked(combatants.findByRef).mockResolvedValue(CHARACTER_REF);
    const publish = vi.spyOn(bus, 'publish');

    await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      kind: 'character',
      refId: 'char-1',
    });

    const call = vi.mocked(combat.rollInitiative).mock.calls[0];
    expect(call?.[0]).toBe('session-1');
    expect(call?.[1]).toBe('character');
    expect(call?.[2]).toBe('char-1');
    expect(typeof call?.[3]).toBe('function');
    expect(call?.[3]?.()).toBe(7);
    expect(call?.[4]).toBe('p1');
    expect(
      vi.mocked(combat.rollInitiative).mock.invocationCallOrder[0],
    ).toBeLessThan(publish.mock.invocationCallOrder[0] ?? 0);
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'session.combat',
      state: state(),
    });
  });

  it('forbids a non-owner, non-master character roll', async () => {
    const { access, combatants, combat, service } = build();
    vi.mocked(combatants.findByRef).mockResolvedValue(CHARACTER_REF);
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });
    vi.mocked(access.isMember).mockResolvedValue(true);

    await expect(
      service.execute({
        playerId: 'p2',
        sessionId: 'session-1',
        kind: 'character',
        refId: 'char-1',
      }),
    ).rejects.toBeInstanceOf(ChatForbiddenError);
    expect(combat.rollInitiative).not.toHaveBeenCalled();
  });

  it('requires the master to roll a monster', async () => {
    const { access, combatants, service } = build();
    vi.mocked(combatants.findByRef).mockResolvedValue(MONSTER_REF);
    vi.mocked(access.isMember).mockResolvedValue(true);

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        kind: 'monster',
        refId: 'mon-1',
      }),
    ).rejects.toBeInstanceOf(MasterOnlyError);
  });

  it('errors when the combatant is unknown to the game', async () => {
    const { combatants, service } = build();
    vi.mocked(combatants.findByRef).mockResolvedValue(null);

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        kind: 'character',
        refId: 'missing',
      }),
    ).rejects.toBeInstanceOf(CombatantNotFoundError);
  });

  it('errors when the combat state is inactive', async () => {
    const { combatants, combat, service } = build();
    vi.mocked(combatants.findByRef).mockResolvedValue(CHARACTER_REF);
    vi.mocked(combat.findState).mockResolvedValue({
      ...state(),
      active: false,
    });

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        kind: 'character',
        refId: 'char-1',
      }),
    ).rejects.toBeInstanceOf(CombatStateNotFoundError);
  });

  it('propagates the repository combatant error', async () => {
    const { combatants, combat, service } = build();
    vi.mocked(combatants.findByRef).mockResolvedValue(CHARACTER_REF);
    vi.mocked(combat.rollInitiative).mockRejectedValue(
      new CombatantNotFoundError(),
    );

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        kind: 'character',
        refId: 'char-1',
      }),
    ).rejects.toBeInstanceOf(CombatantNotFoundError);
  });
});
