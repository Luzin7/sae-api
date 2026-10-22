import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import { ChatTestNotFoundError, MasterOnlyError } from '../chat.errors.js';
import { makeChatMessages, makeGameAccess } from '../chat.testkit.js';
import { CloseTestService } from './close-test.service.js';

function build() {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const bus = new InMemoryMessageBus();
  const service = new CloseTestService(messages, access, bus);
  const publish = vi.spyOn(bus, 'publish');

  vi.mocked(messages.findSession).mockResolvedValue({
    id: 'session-1',
    gameId: 'game-1',
  });
  vi.mocked(access.findById).mockResolvedValue({
    id: 'game-1',
    masterId: 'master-1',
  });
  vi.mocked(access.isMember).mockResolvedValue(true);
  vi.mocked(messages.findTestById).mockResolvedValue({
    testId: 'test-1',
    skillId: 'skill-1',
    cd: 15,
    mode: 'open',
    targetCharacterId: null,
    targetName: null,
  });
  vi.mocked(messages.isTestClosed).mockResolvedValue(false);

  return { messages, publish, service };
}

const input = {
  playerId: 'master-1',
  sessionId: 'session-1',
  testId: 'test-1',
};

describe('CloseTestService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids a non-master with no write', async () => {
    const { messages, publish, service } = build();

    await expect(
      service.execute({ ...input, playerId: 'p1' }),
    ).rejects.toBeInstanceOf(MasterOnlyError);
    expect(messages.appendLog).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('rejects an unknown test', async () => {
    const { messages, service } = build();
    vi.mocked(messages.findTestById).mockResolvedValue(null);

    await expect(service.execute(input)).rejects.toBeInstanceOf(
      ChatTestNotFoundError,
    );
    expect(messages.appendLog).not.toHaveBeenCalled();
  });

  it('appends the log before publishing', async () => {
    const { messages, publish, service } = build();

    await service.execute(input);

    expect(messages.appendLog).toHaveBeenCalledWith({
      sessionId: 'session-1',
      playerId: 'master-1',
      eventType: 'test_closed',
      payload: { testId: 'test-1' },
    });
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'session.test-closed',
      testId: 'test-1',
    });
    expect(
      vi.mocked(messages.appendLog).mock.invocationCallOrder[0],
    ).toBeLessThan(publish.mock.invocationCallOrder[0] ?? 0);
  });

  it('does nothing when the test is already closed', async () => {
    const { messages, publish, service } = build();
    vi.mocked(messages.isTestClosed).mockResolvedValue(true);

    await service.execute(input);

    expect(messages.appendLog).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });
});
