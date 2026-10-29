import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CombatantPayload,
  CombatStatePayload,
} from '@modules/session/session.entity.js';
import { AFFLICTION_KEYS } from '@shared/rules/afflictions.js';
import { InMemoryMessageBus } from '../chat.bus.js';
import { ChatMonsterNotFoundError, MasterOnlyError } from '../chat.errors.js';
import type { CombatantSeed } from '../combat.repository.js';
import type { MonsterRef } from '../combatant-source.contract.js';
import {
  makeChatMessages,
  makeCombat,
  makeCombatants,
  makeGameAccess,
} from '../chat.testkit.js';
import { AddMonsterService } from './add-monster.service.js';

const SESSION_ID = 'session-1';
const GAME_ID = 'game-1';
const MASTER_ID = 'p1';
const MONSTER_ID = 'monster-1';

function makeMonster(overrides: Partial<MonsterRef> = {}): MonsterRef {
  return {
    id: MONSTER_ID,
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
    afflictions: ['ferido'],
    ...overrides,
  };
}

function build() {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const combatants = makeCombatants();
  const bus = new InMemoryMessageBus();
  const rows = new Map<string, CombatantPayload[]>();
  let counter = 0;

  function payload(sessionId: string): CombatStatePayload | null {
    const entries = rows.get(sessionId);
    if (!entries) return null;

    return {
      active: true,
      turnIndex: 0,
      round: 1,
      entries: entries.map((entry) => ({
        ...entry,
        afflictions: [...entry.afflictions],
      })),
    };
  }

  const combat = {
    ...makeCombat(),
    findState: vi.fn(async (sessionId: string) => payload(sessionId)),
    addCombatant: vi.fn(async (sessionId: string, seed: CombatantSeed) => {
      const entries = rows.get(sessionId);
      if (!entries) throw new Error('no active combat');

      const exists = entries.some(
        (entry) => entry.kind === seed.kind && entry.refId === seed.refId,
      );
      if (!exists) {
        counter += 1;
        entries.push({
          combatantId: `c-${counter}`,
          kind: seed.kind,
          refId: seed.refId,
          name: seed.name,
          initiativeValue: null,
          hasRolled: false,
          currentHp: seed.currentHp,
          maxHp: seed.maxHp,
          currentEffort: seed.currentEffort,
          maxEffort: seed.maxEffort,
          afflictions: [...seed.afflictions],
          cognition: seed.cognition,
          psyche: seed.psyche,
          instinct: seed.instinct,
          constitution: seed.constitution,
          motricity: seed.motricity,
          perception: seed.perception,
        });
      }

      return payload(sessionId)!;
    }),
  };

  rows.set(SESSION_ID, []);

  const service = new AddMonsterService(
    messages,
    access,
    combatants,
    combat,
    bus,
  );

  vi.mocked(messages.findSession).mockResolvedValue({
    id: SESSION_ID,
    gameId: GAME_ID,
  });
  vi.mocked(access.findById).mockResolvedValue({
    id: GAME_ID,
    masterId: MASTER_ID,
  });
  vi.mocked(access.isMember).mockResolvedValue(true);

  return { messages, access, combatants, combat, bus, service };
}

describe('AddMonsterService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds the template as a combatant with copied vitals', async () => {
    const { combatants, service } = build();
    vi.mocked(combatants.findMonsterInGame).mockResolvedValue(makeMonster());

    const state = await service.execute({
      playerId: MASTER_ID,
      sessionId: SESSION_ID,
      monsterId: MONSTER_ID,
    });

    expect(state.entries).toEqual([
      expect.objectContaining({
        kind: 'monster',
        refId: MONSTER_ID,
        name: 'Goblin',
        currentHp: 20,
        maxHp: 20,
        currentEffort: 10,
        maxEffort: 10,
        afflictions: ['ferido'],
      }),
    ]);
  });

  it('looks the template up inside the session game', async () => {
    const { combatants, service } = build();
    vi.mocked(combatants.findMonsterInGame).mockResolvedValue(makeMonster());

    await service.execute({
      playerId: MASTER_ID,
      sessionId: SESSION_ID,
      monsterId: MONSTER_ID,
    });

    expect(combatants.findMonsterInGame).toHaveBeenCalledWith(
      GAME_ID,
      MONSTER_ID,
    );
  });

  it('forbids a non-master', async () => {
    const { access, combatants, combat, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: GAME_ID,
      masterId: 'other-master',
    });

    await expect(
      service.execute({
        playerId: MASTER_ID,
        sessionId: SESSION_ID,
        monsterId: MONSTER_ID,
      }),
    ).rejects.toBeInstanceOf(MasterOnlyError);
    expect(combatants.findMonsterInGame).not.toHaveBeenCalled();
    expect(combat.addCombatant).not.toHaveBeenCalled();
  });

  it('rejects a monster outside the session game', async () => {
    const { combatants, combat, service } = build();
    vi.mocked(combatants.findMonsterInGame).mockResolvedValue(null);

    await expect(
      service.execute({
        playerId: MASTER_ID,
        sessionId: SESSION_ID,
        monsterId: 'foreign-monster',
      }),
    ).rejects.toBeInstanceOf(ChatMonsterNotFoundError);
    expect(combat.addCombatant).not.toHaveBeenCalled();
  });

  it('keeps a single combatant when the same monster is added twice', async () => {
    const { combatants, service } = build();
    vi.mocked(combatants.findMonsterInGame).mockResolvedValue(makeMonster());

    const first = await service.execute({
      playerId: MASTER_ID,
      sessionId: SESSION_ID,
      monsterId: MONSTER_ID,
    });
    const second = await service.execute({
      playerId: MASTER_ID,
      sessionId: SESSION_ID,
      monsterId: MONSTER_ID,
    });

    expect(second.entries).toHaveLength(1);
    expect(second.entries.map((entry) => entry.combatantId)).toEqual(
      first.entries.map((entry) => entry.combatantId),
    );
  });

  it('copies the template afflictions into the seed', async () => {
    const { combatants, combat, service } = build();
    vi.mocked(combatants.findMonsterInGame).mockResolvedValue(
      makeMonster({ afflictions: [...AFFLICTION_KEYS] }),
    );

    await service.execute({
      playerId: MASTER_ID,
      sessionId: SESSION_ID,
      monsterId: MONSTER_ID,
    });

    expect(combat.addCombatant).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ afflictions: [...AFFLICTION_KEYS] }),
      MASTER_ID,
    );
  });

  it('keeps the combatant vitals after the template changes', async () => {
    const { combatants, combat, service } = build();
    const template = makeMonster();
    vi.mocked(combatants.findMonsterInGame).mockResolvedValue(template);

    await service.execute({
      playerId: MASTER_ID,
      sessionId: SESSION_ID,
      monsterId: MONSTER_ID,
    });

    template.currentHp = 1;
    template.maxHp = 1;
    template.afflictions.push('sangramento');

    const state = await combat.findState(SESSION_ID);

    expect(state?.entries).toEqual([
      expect.objectContaining({
        refId: MONSTER_ID,
        currentHp: 20,
        maxHp: 20,
        afflictions: ['ferido'],
      }),
    ]);
  });
});
