import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActiveSessionLookup } from '@shared/session/active-session.contract.js';
import { InMemoryMessageBus } from '../chat.bus.js';
import {
  directoryCharacter,
  makeGameAccess,
  makePlayerDirectory,
} from '../chat.testkit.js';
import { GameSessionNotifierService } from './game-session-notifier.service.js';

function makeSessions(
  active: { id: string } | null = { id: 'session-1' },
): ActiveSessionLookup {
  return { findActiveByGame: vi.fn().mockResolvedValue(active) };
}

function join(bus: InMemoryMessageBus, socketId: string, playerId: string) {
  bus.register(socketId, playerId, () => undefined);
  bus.join('session:session-1', socketId);
}

function build() {
  const sessions = makeSessions();
  const access = makeGameAccess();
  const players = makePlayerDirectory(
    { p1: 'Ana', p2: 'Bia', master: 'Mestre' },
    [
      directoryCharacter('p1', 'char-1'),
      directoryCharacter('p1', 'char-2'),
      directoryCharacter('p2', 'char-3'),
    ],
  );
  const bus = new InMemoryMessageBus();
  const notifier = new GameSessionNotifierService(
    sessions,
    access,
    players,
    bus,
  );

  vi.mocked(access.findById).mockResolvedValue({
    id: 'game-1',
    masterId: 'master',
  });
  join(bus, 'socket-1', 'p1');
  join(bus, 'socket-2', 'master');
  join(bus, 'socket-3', 'p2');

  return { sessions, access, players, bus, notifier };
}

describe('GameSessionNotifierService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('publishes the refreshed roster with character ids', async () => {
    const { bus, notifier } = build();
    const publish = vi.spyOn(bus, 'publish');

    await notifier.notifyRosterChanged('game-1');

    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'presence',
      master: { playerId: 'master', name: 'Mestre' },
      players: [
        { playerId: 'p1', name: 'Ana', characterIds: ['char-1', 'char-2'] },
        { playerId: 'p2', name: 'Bia', characterIds: ['char-3'] },
      ],
    });
  });

  it('publishes the hp frame', async () => {
    const { bus, notifier } = build();
    const publish = vi.spyOn(bus, 'publish');

    await notifier.notifyHpChanged('game-1', {
      characterId: 'char-1',
      oldHp: 20,
      newHp: 14,
    });

    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'character.hp-changed',
      characterId: 'char-1',
      oldHp: 20,
      newHp: 14,
    });
  });

  it('does nothing when the game has no active session', async () => {
    const { sessions, bus, notifier } = build();
    vi.mocked(sessions.findActiveByGame).mockResolvedValue(null);
    const publish = vi.spyOn(bus, 'publish');

    await notifier.notifyRosterChanged('game-1');

    expect(publish).not.toHaveBeenCalled();
  });

  it('does nothing when the game is gone', async () => {
    const { access, bus, notifier } = build();
    vi.mocked(access.findById).mockResolvedValue(null);
    const publish = vi.spyOn(bus, 'publish');

    await notifier.notifyRosterChanged('game-1');

    expect(publish).not.toHaveBeenCalled();
  });

  it('resolves without throwing when a dependency fails', async () => {
    const { sessions, notifier } = build();
    vi.mocked(sessions.findActiveByGame).mockRejectedValue(
      new Error('database down'),
    );

    await expect(
      notifier.notifyRosterChanged('game-1'),
    ).resolves.toBeUndefined();
    await expect(
      notifier.notifyHpChanged('game-1', {
        characterId: 'char-1',
        oldHp: 20,
        newHp: 14,
      }),
    ).resolves.toBeUndefined();
  });
});
