import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import {
  directoryCharacter,
  makeChatMessages,
  makeGameAccess,
  makePlayerDirectory,
} from '../chat.testkit.js';
import { LeaveService } from './leave.service.js';

function build() {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const players = makePlayerDirectory(
    { p1: 'Ana', p2: 'Bia', master: 'Mestre' },
    [directoryCharacter('p1', 'char-1')],
  );
  const bus = new InMemoryMessageBus();
  const service = new LeaveService(messages, access, players, bus);

  vi.mocked(messages.findSession).mockResolvedValue({
    id: 'session-1',
    gameId: 'game-1',
  });
  vi.mocked(access.findById).mockResolvedValue({
    id: 'game-1',
    masterId: 'master',
  });

  return { messages, access, players, bus, service };
}

function join(bus: InMemoryMessageBus, socketId: string, playerId: string) {
  bus.register(socketId, playerId, () => undefined);
  bus.join('session:session-1', socketId);
}

describe('LeaveService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits player-left with the character ids and refreshed presence', async () => {
    const { messages, bus, service } = build();
    join(bus, 'socket-1', 'p1');
    join(bus, 'socket-2', 'p2');
    const publish = vi.spyOn(bus, 'publish');

    await service.execute({
      playerId: 'p1',
      socketId: 'socket-1',
      sessionId: 'session-1',
    });

    expect(messages.appendLog).toHaveBeenCalledWith({
      sessionId: 'session-1',
      playerId: 'p1',
      eventType: 'player_leave',
      payload: { playerId: 'p1', name: 'Ana' },
    });
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'session.player-left',
      player: { playerId: 'p1', name: 'Ana', characterIds: ['char-1'] },
    });
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'presence',
      master: null,
      players: [{ playerId: 'p2', name: 'Bia', characterIds: [] }],
    });
  });

  it('keeps a connected master in master while a player leaves', async () => {
    const { bus, service } = build();
    join(bus, 'socket-1', 'p1');
    join(bus, 'socket-2', 'master');
    const publish = vi.spyOn(bus, 'publish');

    await service.execute({
      playerId: 'p1',
      socketId: 'socket-1',
      sessionId: 'session-1',
    });

    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'presence',
      master: { playerId: 'master', name: 'Mestre' },
      players: [],
    });
  });

  it('does not emit player-left when the master disconnects', async () => {
    const { bus, service } = build();
    join(bus, 'socket-1', 'master');
    join(bus, 'socket-2', 'p1');
    const publish = vi.spyOn(bus, 'publish');

    await service.execute({
      playerId: 'master',
      socketId: 'socket-1',
      sessionId: 'session-1',
    });

    expect(publish).not.toHaveBeenCalledWith(
      'session:session-1',
      expect.objectContaining({ type: 'session.player-left' }),
    );
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'presence',
      master: null,
      players: [{ playerId: 'p1', name: 'Ana', characterIds: ['char-1'] }],
    });
  });

  it('does nothing when the session is gone', async () => {
    const { messages, bus, service } = build();
    vi.mocked(messages.findSession).mockResolvedValue(null);
    const publish = vi.spyOn(bus, 'publish');

    await service.execute({
      playerId: 'p1',
      socketId: 'socket-1',
      sessionId: 'session-1',
    });

    expect(publish).not.toHaveBeenCalled();
  });
});
