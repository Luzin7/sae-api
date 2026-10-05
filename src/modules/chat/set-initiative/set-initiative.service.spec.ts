import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import type { InitiativeEntry } from '../chat.entity.js';
import { MasterOnlyError } from '../chat.errors.js';
import { makeChatMessages, makeGameAccess } from '../chat.testkit.js';
import { SetInitiativeService } from './set-initiative.service.js';

const ORDER: InitiativeEntry[] = [
  { playerId: 'p1', playerName: 'Ana', value: 18 },
  { playerId: 'p2', playerName: 'Beto', value: 12 },
];

function build() {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const bus = new InMemoryMessageBus();
  const service = new SetInitiativeService(messages, access, bus);

  vi.mocked(messages.findSession).mockResolvedValue({
    id: 'session-1',
    gameId: 'game-1',
  });

  return { messages, access, bus, service };
}

describe('SetInitiativeService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids a non-master before persisting or broadcasting', async () => {
    const { messages, access, bus, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });
    vi.mocked(access.isMember).mockResolvedValue(true);
    const publish = vi.spyOn(bus, 'publish');

    await expect(
      service.execute({ playerId: 'p1', sessionId: 'session-1', order: ORDER }),
    ).rejects.toBeInstanceOf(MasterOnlyError);
    expect(messages.appendLog).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('persists before broadcasting for the master', async () => {
    const { messages, access, bus, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'p1',
    });
    const publish = vi.spyOn(bus, 'publish');

    await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      order: ORDER,
    });

    expect(messages.appendLog).toHaveBeenCalledWith({
      sessionId: 'session-1',
      playerId: 'p1',
      eventType: 'initiative',
      payload: { order: ORDER },
    });
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'session.initiative',
      order: ORDER,
    });
    expect(
      vi.mocked(messages.appendLog).mock.invocationCallOrder[0],
    ).toBeLessThan(publish.mock.invocationCallOrder[0] ?? 0);
  });
});
