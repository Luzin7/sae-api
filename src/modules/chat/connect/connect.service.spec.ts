import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import { ChatForbiddenError } from '../chat.errors.js';
import {
  makeChatMessages,
  makeGameAccess,
  makePlayerDirectory,
} from '../chat.testkit.js';
import { ConnectService } from './connect.service.js';

function build() {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const players = makePlayerDirectory({ p1: 'Ana' });
  const bus = new InMemoryMessageBus();
  const service = new ConnectService(messages, access, players, bus);

  vi.mocked(messages.findSession).mockResolvedValue({
    id: 'session-1',
    gameId: 'game-1',
  });
  vi.mocked(messages.listRecentChat).mockResolvedValue([]);

  return { messages, access, players, bus, service };
}

describe('ConnectService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids a non-member before joining the room', async () => {
    const { messages, access, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });
    vi.mocked(access.isMember).mockResolvedValue(false);

    await expect(
      service.execute({
        playerId: 'p1',
        socketId: 'socket-1',
        sessionId: 'session-1',
      }),
    ).rejects.toBeInstanceOf(ChatForbiddenError);
    expect(messages.appendLog).not.toHaveBeenCalled();
  });

  it('persists the join before fanning out presence and state', async () => {
    const { messages, access, bus, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });
    vi.mocked(access.isMember).mockResolvedValue(true);
    bus.register('socket-1', 'p1', () => undefined);
    const publish = vi.spyOn(bus, 'publish');

    const result = await service.execute({
      playerId: 'p1',
      socketId: 'socket-1',
      sessionId: 'session-1',
    });

    expect(result.history).toEqual([]);
    expect(messages.appendLog).toHaveBeenCalledWith({
      sessionId: 'session-1',
      playerId: 'p1',
      eventType: 'player_join',
      payload: { playerId: 'p1', name: 'Ana' },
    });
    const players = [{ playerId: 'p1', name: 'Ana' }];
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'session.player-joined',
      player: { playerId: 'p1', name: 'Ana' },
    });
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'presence',
      players,
    });
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'session.state',
      players,
    });
    expect(
      vi.mocked(messages.appendLog).mock.invocationCallOrder[0],
    ).toBeLessThan(publish.mock.invocationCallOrder[0] ?? 0);
  });
});
