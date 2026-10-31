import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import {
  ChatForbiddenError,
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
});
