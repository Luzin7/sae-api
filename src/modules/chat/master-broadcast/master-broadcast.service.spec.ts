import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import { EmptyNarrationError, MasterOnlyError } from '../chat.errors.js';
import {
  makeChatMessages,
  makeGameAccess,
  makePlayerDirectory,
} from '../chat.testkit.js';
import { MasterBroadcastService } from './master-broadcast.service.js';

const CLOCK = () => new Date('2024-01-01T00:00:00.000Z');

function build() {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const players = makePlayerDirectory({ p1: 'Ana', master: 'Mestre' });
  const bus = new InMemoryMessageBus();
  const service = new MasterBroadcastService(
    messages,
    access,
    players,
    bus,
    CLOCK,
  );

  vi.mocked(messages.findSession).mockResolvedValue({
    id: 'session-1',
    gameId: 'game-1',
  });

  return { messages, access, players, bus, service };
}

describe('MasterBroadcastService', () => {
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
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        text: 'narrate',
      }),
    ).rejects.toBeInstanceOf(MasterOnlyError);
    expect(messages.appendLog).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('persists before broadcasting and stamps the clock', async () => {
    const { messages, access, bus, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'p1',
    });
    const publish = vi.spyOn(bus, 'publish');

    await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      text: '  A porta range.  ',
    });

    expect(messages.appendLog).toHaveBeenCalledWith({
      sessionId: 'session-1',
      playerId: 'p1',
      eventType: 'master_broadcast',
      payload: { text: 'A porta range.' },
    });
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'master.narration',
      playerId: 'p1',
      playerName: 'Ana',
      text: 'A porta range.',
      at: '2024-01-01T00:00:00.000Z',
    });
    expect(
      vi.mocked(messages.appendLog).mock.invocationCallOrder[0],
    ).toBeLessThan(publish.mock.invocationCallOrder[0] ?? 0);
  });

  it('rejects blank narration', async () => {
    const { messages, access, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'p1',
    });

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        text: '   ',
      }),
    ).rejects.toBeInstanceOf(EmptyNarrationError);
    expect(messages.appendLog).not.toHaveBeenCalled();
  });
});
