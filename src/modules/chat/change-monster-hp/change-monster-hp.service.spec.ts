import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import { MasterOnlyError } from '../chat.errors.js';
import {
  makeChatMessages,
  makeCombat,
  makeGameAccess,
} from '../chat.testkit.js';
import type { CombatStatePayload } from '@modules/session/session.entity.js';
import { ChangeMonsterHpService } from './change-monster-hp.service.js';

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
  vi.mocked(combat.changeInstanceHp).mockResolvedValue({
    state: STATE,
    oldHp: 10,
    newHp: 7,
  });

  return {
    combat,
    publish: vi.spyOn(bus, 'publish'),
    service: new ChangeMonsterHpService(messages, access, combat, bus),
  };
}

describe('ChangeMonsterHpService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies the delta to the instance and broadcasts the combat state', async () => {
    const { combat, publish, service } = build();

    await service.execute({
      playerId: 'master-1',
      sessionId: 'session-1',
      monsterId: 'monster-1',
      delta: -3,
    });

    expect(combat.changeInstanceHp).toHaveBeenCalledWith({
      sessionId: 'session-1',
      monsterId: 'monster-1',
      delta: -3,
      playerId: 'master-1',
    });
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'session.combat',
      state: STATE,
    });
  });

  it('forbids a non-master and writes nothing', async () => {
    const { combat, publish, service } = build();

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        monsterId: 'monster-1',
        delta: -3,
      }),
    ).rejects.toBeInstanceOf(MasterOnlyError);
    expect(combat.changeInstanceHp).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});
