import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import { MasterOnlyError } from '../chat.errors.js';
import {
  fixedRng,
  makeChatMessages,
  makeCombat,
  makeCombatants,
  makeGameAccess,
} from '../chat.testkit.js';
import type { Rng } from '@shared/dice/roll.js';
import type { CombatStatePayload } from '@modules/session/session.entity.js';
import { StartCombatService } from './start-combat.service.js';

const STATE: CombatStatePayload = {
  active: true,
  turnIndex: 0,
  round: 1,
  entries: [
    {
      combatantId: 'c-1',
      kind: 'character',
      refId: 'char-1',
      name: 'Ana',
      initiativeValue: null,
      hasRolled: false,
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

function build(rng: Rng = fixedRng(7)) {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const combatants = makeCombatants();
  const combat = makeCombat();
  const bus = new InMemoryMessageBus();
  const service = new StartCombatService(
    messages,
    access,
    combatants,
    combat,
    bus,
    rng,
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

describe('StartCombatService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('seeds the roster from the game and publishes after the repository commits', async () => {
    const { combatants, combat, bus, service } = build();
    vi.mocked(combatants.listByGame).mockResolvedValue([
      { kind: 'character', refId: 'char-1', name: 'Ana', ownerPlayerId: 'p1' },
    ]);
    vi.mocked(combat.start).mockResolvedValue(STATE);
    const publish = vi.spyOn(bus, 'publish');

    await service.execute({ playerId: 'p1', sessionId: 'session-1' });

    expect(combat.start).toHaveBeenCalledWith(
      'session-1',
      [
        {
          kind: 'character',
          refId: 'char-1',
          name: 'Ana',
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
      expect.any(Function),
      'p1',
    );
    expect(vi.mocked(combat.start).mock.invocationCallOrder[0]).toBeLessThan(
      publish.mock.invocationCallOrder[0] ?? 0,
    );
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'session.combat',
      state: STATE,
    });
  });

  it('seeds monster vitals from the roster without per-monster reads', async () => {
    const { combatants, combat, service } = build();
    vi.mocked(combatants.listByGame).mockResolvedValue([
      { kind: 'character', refId: 'char-1', name: 'Ana', ownerPlayerId: 'p1' },
      {
        kind: 'monster',
        refId: 'mon-1',
        name: 'Goblin',
        ownerPlayerId: null,
        template: {
          attributes: {
            cognition: 2,
            psyche: -2,
            instinct: 0,
            constitution: 3,
            motricity: 1,
            perception: 0,
          },
          currentHp: 12,
          maxHp: 20,
          maxEffort: 10,
        },
      },
    ]);
    vi.mocked(combat.start).mockResolvedValue(STATE);

    await service.execute({ playerId: 'p1', sessionId: 'session-1' });

    expect(combatants.listByGame).toHaveBeenCalledTimes(1);
    expect(combatants.findMonsterInGame).not.toHaveBeenCalled();
    expect(combatants.findByRef).not.toHaveBeenCalled();
    expect(combat.start).toHaveBeenCalledWith(
      'session-1',
      [
        {
          kind: 'character',
          refId: 'char-1',
          name: 'Ana',
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
        {
          kind: 'monster',
          refId: 'mon-1',
          name: 'Goblin',
          currentHp: 12,
          maxHp: 20,
          currentEffort: 0,
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
      expect.any(Function),
      'p1',
    );
  });

  it('passes a plain d20 thunk to combat.start and never rolls initiative itself', async () => {
    const rng = vi.fn(() => 7);
    const { combatants, combat, service } = build(rng);
    vi.mocked(combatants.listByGame).mockResolvedValue([
      { kind: 'monster', refId: 'mon-1', name: 'Goblin', ownerPlayerId: null },
    ]);
    vi.mocked(combat.start).mockResolvedValue(STATE);

    await service.execute({ playerId: 'p1', sessionId: 'session-1' });

    const call = vi.mocked(combat.start).mock.calls[0];
    expect(call?.[0]).toBe('session-1');
    expect(call?.[1]).toEqual([
      {
        kind: 'monster',
        refId: 'mon-1',
        name: 'Goblin',
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
    ]);
    expect(call?.[2]?.()).toBe(7);
    expect(call?.[3]).toBe('p1');
    expect(rng).toHaveBeenCalledWith(1, 20);
    expect(combat.rollInitiative).not.toHaveBeenCalled();
  });

  it('forbids a non-master', async () => {
    const { access, combat, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });

    await expect(
      service.execute({ playerId: 'p1', sessionId: 'session-1' }),
    ).rejects.toBeInstanceOf(MasterOnlyError);
    expect(combat.start).not.toHaveBeenCalled();
  });
});
