import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import { MasterOnlyError } from '../chat.errors.js';
import {
  makeChatMessages,
  makeCombat,
  makeGameAccess,
} from '../chat.testkit.js';
import type { CombatStatePayload } from '@modules/session/session.entity.js';
import { SetMonsterAfflictionsService } from './set-monster-afflictions.service.js';

const STATE: CombatStatePayload = {
  active: true,
  turnIndex: 0,
  round: 1,
  entries: [],
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
  vi.mocked(combat.setInstanceAfflictions).mockResolvedValue({ state: STATE });

  return {
    combat,
    publish: vi.spyOn(bus, 'publish'),
    service: new SetMonsterAfflictionsService(messages, access, combat, bus),
  };
}

describe('SetMonsterAfflictionsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids a non-master and writes nothing', async () => {
    const { combat, publish, service } = build();

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        monsterId: 'monster-1',
        afflictions: ['fobia'],
      }),
    ).rejects.toBeInstanceOf(MasterOnlyError);
    expect(combat.setInstanceAfflictions).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});
