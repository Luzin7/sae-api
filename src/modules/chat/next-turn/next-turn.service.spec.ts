import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import { MasterOnlyError } from '../chat.errors.js';
import {
  makeChatMessages,
  makeCombat,
  makeGameAccess,
} from '../chat.testkit.js';
import type { CombatStatePayload } from '@modules/session/session.entity.js';
import { NextTurnService } from './next-turn.service.js';

const STATE: CombatStatePayload = {
  active: true,
  turnIndex: 1,
  round: 1,
  entries: [],
};

const INPUT = {
  playerId: 'master-1',
  sessionId: 'session-1',
  expectedTurnIndex: 0,
  expectedRound: 1,
};

function build() {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const combat = makeCombat();
  const bus = new InMemoryMessageBus();
  vi.mocked(messages.findSession).mockResolvedValue({
    id: 'session-1',
    gameId: 'game-1',
  });
  vi.mocked(access.findById).mockResolvedValue({
    id: 'game-1',
    masterId: 'master-1',
  });
  vi.mocked(access.isMember).mockResolvedValue(true);

  return {
    combat,
    publish: vi.spyOn(bus, 'publish'),
    service: new NextTurnService(messages, access, combat, bus),
  };
}

describe('NextTurnService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('publishes a pe-changed per recovered character, then the combat state', async () => {
    const { combat, publish, service } = build();
    vi.mocked(combat.advanceTurn).mockResolvedValue({
      state: STATE,
      recovered: [
        { characterId: 'char-a', oldEffort: 3, newEffort: 2 },
        { characterId: 'char-c', oldEffort: 1, newEffort: 0 },
      ],
    });

    await service.execute(INPUT);

    expect(publish.mock.calls).toEqual([
      [
        'session:session-1',
        {
          type: 'character.pe-changed',
          characterId: 'char-a',
          oldPe: 3,
          newPe: 2,
        },
      ],
      [
        'session:session-1',
        {
          type: 'character.pe-changed',
          characterId: 'char-c',
          oldPe: 1,
          newPe: 0,
        },
      ],
      ['session:session-1', { type: 'session.combat', state: STATE }],
    ]);
  });

  it('a stale frame recovers nothing and only republishes the state', async () => {
    const { combat, publish, service } = build();
    vi.mocked(combat.advanceTurn).mockResolvedValue({
      state: STATE,
      recovered: [],
    });

    await service.execute(INPUT);

    expect(publish.mock.calls).toEqual([
      ['session:session-1', { type: 'session.combat', state: STATE }],
    ]);
  });

  it('only the master advances the turn', async () => {
    const { combat, service } = build();

    await expect(
      service.execute({ ...INPUT, playerId: 'other' }),
    ).rejects.toBeInstanceOf(MasterOnlyError);
    expect(combat.advanceTurn).not.toHaveBeenCalled();
  });
});
