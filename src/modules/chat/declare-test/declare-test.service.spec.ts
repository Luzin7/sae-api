import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import {
  InvalidDifficultyGradeError,
  MasterOnlyError,
} from '../chat.errors.js';
import {
  makeChatMessages,
  makeCombatants,
  makeGameAccess,
} from '../chat.testkit.js';
import { DeclareTestService } from './declare-test.service.js';

function build() {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const combatants = makeCombatants();
  const bus = new InMemoryMessageBus();
  const service = new DeclareTestService(messages, access, combatants, bus);

  vi.mocked(messages.findSession).mockResolvedValue({
    id: 'session-1',
    gameId: 'game-1',
  });
  vi.mocked(access.findById).mockResolvedValue({
    id: 'game-1',
    masterId: 'master-1',
  });
  vi.mocked(access.isMember).mockResolvedValue(true);

  return { messages, service };
}

const input = {
  playerId: 'master-1',
  sessionId: 'session-1',
  skillId: 'skill-1',
  mode: 'open' as const,
  targetCharacterId: null,
};

describe('DeclareTestService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('derives the cd from the grade and persists both', async () => {
    const { messages, service } = build();

    const test = await service.execute({ ...input, grade: 4 });

    expect(test.grade).toBe(4);
    expect(test.cd).toBe(20);
    expect(messages.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'test_declared',
        payload: expect.objectContaining({ grade: 4, cd: 20 }),
      }),
    );
  });

  it('rejects an unknown grade without appending', async () => {
    const { messages, service } = build();

    await expect(
      service.execute({ ...input, grade: 11 }),
    ).rejects.toBeInstanceOf(InvalidDifficultyGradeError);
    expect(messages.appendLog).not.toHaveBeenCalled();
  });

  it('rejects a non-master', async () => {
    const { service } = build();

    await expect(
      service.execute({ ...input, playerId: 'p1', grade: 2 }),
    ).rejects.toBeInstanceOf(MasterOnlyError);
  });
});
