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
