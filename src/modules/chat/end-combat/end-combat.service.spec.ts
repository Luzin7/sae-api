import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import { MasterOnlyError } from '../chat.errors.js';
import {
  makeChatMessages,
  makeCombat,
  makeGameAccess,
} from '../chat.testkit.js';
import { EndCombatService } from './end-combat.service.js';

function build() {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const combat = makeCombat();
  const bus = new InMemoryMessageBus();
  const service = new EndCombatService(messages, access, combat, bus);

  vi.mocked(messages.findSession).mockResolvedValue({
    id: 'session-1',
    gameId: 'game-1',
  });
  vi.mocked(access.findById).mockResolvedValue({
    id: 'game-1',
    masterId: 'p1',
  });
  vi.mocked(access.isMember).mockResolvedValue(true);

  return { messages, access, combat, bus, service };
}

describe('EndCombatService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids a non-master', async () => {
    const { access, combat, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });

    await expect(
      service.execute({ playerId: 'p1', sessionId: 'session-1' }),
    ).rejects.toBeInstanceOf(MasterOnlyError);
    expect(combat.end).not.toHaveBeenCalled();
  });
});
