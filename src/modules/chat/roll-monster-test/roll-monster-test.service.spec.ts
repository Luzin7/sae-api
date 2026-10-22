import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import {
  ChatMonsterNotFoundError,
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
import type { CombatStatePayload } from '@modules/session/session.entity.js';
import { RollMonsterTestService } from './roll-monster-test.service.js';

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

function build() {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const combatants = makeCombatants();
  const combat = makeCombat();
  const bus = new InMemoryMessageBus();
  const service = new RollMonsterTestService(
    messages,
    access,
    combatants,
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

  return { messages, access, combatants, combat, bus, service };
}

describe('RollMonsterTestService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rolls a monster attribute and publishes the event', async () => {
    const { messages, combatants, combat, bus, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(STATE);
    vi.mocked(combatants.findMonsterInGame).mockResolvedValue({
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
      currentHp: 10,
      maxHp: 10,
      currentEffort: 5,
      maxEffort: 5,
    });
    const publish = vi.spyOn(bus, 'publish');

    const event = await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      monsterId: 'monster-1',
      attribute: 'cognition',
    });

    expect(event).toEqual({
      type: 'session.monster-rolled',
      monsterId: 'monster-1',
      name: 'Goblin',
      attribute: 'cognition',
      rolls: [12, 12],
      result: 12,
      kind: 'best',
    });
    expect(messages.appendLog).toHaveBeenCalledWith({
      sessionId: 'session-1',
      playerId: 'p1',
      eventType: 'dice_roll',
      payload: {
        expression: 'Goblin — cognition',
        results: [12, 12],
        total: 12,
      },
    });
    expect(publish).toHaveBeenCalledWith(
      'session:session-1',
      expect.objectContaining({ type: 'session.monster-rolled' }),
    );
  });

  it('forbids a non-master', async () => {
    const { access, combat, service } = build();
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
      }),
    ).rejects.toBeInstanceOf(MasterOnlyError);
    expect(combat.findState).not.toHaveBeenCalled();
  });

  it('rejects when there is no active combat', async () => {
    const { combat, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(null);

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        monsterId: 'monster-1',
        attribute: 'cognition',
      }),
    ).rejects.toBeInstanceOf(CombatStateNotFoundError);
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
        attribute: 'cognition',
      }),
    ).rejects.toBeInstanceOf(ChatMonsterNotFoundError);
  });
});
