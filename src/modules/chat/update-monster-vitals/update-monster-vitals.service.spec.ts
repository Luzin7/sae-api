import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import type { MonsterRef } from '../combatant-source.contract.js';
import {
  ChatMonsterNotFoundError,
  CombatStateNotFoundError,
  MasterOnlyError,
} from '../chat.errors.js';
import {
  makeChatMessages,
  makeCombat,
  makeCombatants,
  makeGameAccess,
} from '../chat.testkit.js';
import type { CombatStatePayload } from '@modules/session/session.entity.js';
import { UpdateMonsterVitalsService } from './update-monster-vitals.service.js';

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
    },
  ],
};

function makeMonster(overrides: Partial<MonsterRef> = {}): MonsterRef {
  return {
    id: 'monster-1',
    name: 'Goblin',
    attributes: {
      cognition: 2,
      psyche: -2,
      instinct: 0,
      constitution: 3,
      motricity: 1,
      perception: 0,
    },
    currentHp: 20,
    maxHp: 20,
    currentEffort: 10,
    maxEffort: 10,
    ...overrides,
  };
}

function build() {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const combatants = makeCombatants();
  const combat = makeCombat();
  const bus = new InMemoryMessageBus();
  const service = new UpdateMonsterVitalsService(
    messages,
    access,
    combatants,
    combat,
    bus,
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

  return { messages, access, combatants, combat, bus, service };
}

describe('UpdateMonsterVitalsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clamps the vitals and persists before broadcasting', async () => {
    const { combatants, combat, bus, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(STATE);
    vi.mocked(combatants.findMonsterInGame).mockResolvedValue(makeMonster());
    const publish = vi.spyOn(bus, 'publish');

    const event = await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      monsterId: 'monster-1',
      currentHp: 99,
      currentEffort: -5,
    });

    expect(combatants.saveMonsterVitals).toHaveBeenCalledWith('monster-1', {
      currentHp: 20,
      currentEffort: 0,
    });
    expect(event).toEqual({
      type: 'session.monster-vitals',
      monsterId: 'monster-1',
      currentHp: 20,
      maxHp: 20,
      currentEffort: 0,
      maxEffort: 10,
    });
    expect(publish).toHaveBeenCalledWith(
      'session:session-1',
      expect.objectContaining({ type: 'session.monster-vitals' }),
    );
  });

  it('forbids a non-master before touching the monster', async () => {
    const { access, combatants, combat, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        monsterId: 'monster-1',
        currentHp: 5,
        currentEffort: 1,
      }),
    ).rejects.toBeInstanceOf(MasterOnlyError);
    expect(combat.findState).not.toHaveBeenCalled();
    expect(combatants.saveMonsterVitals).not.toHaveBeenCalled();
  });

  it('rejects when there is no active combat', async () => {
    const { combat, combatants, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(null);

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        monsterId: 'monster-1',
        currentHp: 5,
        currentEffort: 1,
      }),
    ).rejects.toBeInstanceOf(CombatStateNotFoundError);
    expect(combatants.saveMonsterVitals).not.toHaveBeenCalled();
  });

  it('rejects a monster from another game', async () => {
    const { combat, combatants, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(STATE);
    vi.mocked(combatants.findMonsterInGame).mockResolvedValue(null);

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        monsterId: 'foreign-monster',
        currentHp: 5,
        currentEffort: 1,
      }),
    ).rejects.toBeInstanceOf(ChatMonsterNotFoundError);
    expect(combatants.saveMonsterVitals).not.toHaveBeenCalled();
  });
});
