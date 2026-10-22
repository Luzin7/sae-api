import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import { ChatForbiddenError } from '../chat.errors.js';
import {
  type DirectoryCharacter,
  directoryCharacter,
  makeChatMessages,
  makeCombat,
  makeGameAccess,
  makePlayerDirectory,
} from '../chat.testkit.js';
import { ConnectService } from './connect.service.js';

function build(
  characters: DirectoryCharacter[] = [directoryCharacter('p1', 'char-1')],
) {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const players = makePlayerDirectory(
    { p1: 'Ana', 'master-1': 'Mestre' },
    characters,
  );
  const bus = new InMemoryMessageBus();
  const combat = makeCombat();
  const service = new ConnectService(messages, access, players, bus, combat);

  vi.mocked(messages.findSession).mockResolvedValue({
    id: 'session-1',
    gameId: 'game-1',
  });
  vi.mocked(messages.listRecentChat).mockResolvedValue([]);
  vi.mocked(messages.findLatestTest).mockResolvedValue(null);
  vi.mocked(messages.isTestClosed).mockResolvedValue(false);
  vi.mocked(messages.listTestRollers).mockResolvedValue([]);
  vi.mocked(combat.findState).mockResolvedValue(null);

  return { messages, access, players, bus, combat, service };
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
    const { messages, access, bus, players, service } = build();
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
    const player = { playerId: 'p1', name: 'Ana', characterIds: ['char-1'] };
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'session.player-joined',
      player,
    });
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'presence',
      master: null,
      players: [player],
    });
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'session.state',
      master: null,
      players: [player],
    });
    expect(players.findCharactersByGame).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(messages.appendLog).mock.invocationCallOrder[0],
    ).toBeLessThan(publish.mock.invocationCallOrder[0] ?? 0);
  });

  it('resolves a player with no character as an empty list', async () => {
    const { access, bus, service } = build([]);
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });
    vi.mocked(access.isMember).mockResolvedValue(true);
    bus.register('socket-1', 'p1', () => undefined);
    const publish = vi.spyOn(bus, 'publish');

    await service.execute({
      playerId: 'p1',
      socketId: 'socket-1',
      sessionId: 'session-1',
    });

    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'presence',
      master: null,
      players: [{ playerId: 'p1', name: 'Ana', characterIds: [] }],
    });
  });

  it('joins a player carrying every character in oldest-first order', async () => {
    const { access, bus, service } = build([
      directoryCharacter('p1', 'char-new', '2024-03-01T00:00:00.000Z'),
      directoryCharacter('p1', 'char-old', '2024-01-01T00:00:00.000Z'),
    ]);
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });
    vi.mocked(access.isMember).mockResolvedValue(true);
    bus.register('socket-1', 'p1', () => undefined);
    const publish = vi.spyOn(bus, 'publish');

    await service.execute({
      playerId: 'p1',
      socketId: 'socket-1',
      sessionId: 'session-1',
    });

    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'session.player-joined',
      player: {
        playerId: 'p1',
        name: 'Ana',
        characterIds: ['char-old', 'char-new'],
      },
    });
  });

  it('puts a connected master in master and keeps them out of players', async () => {
    const { access, bus, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });
    vi.mocked(access.isMember).mockResolvedValue(true);
    bus.register('socket-1', 'master-1', () => undefined);
    const publish = vi.spyOn(bus, 'publish');

    await service.execute({
      playerId: 'master-1',
      socketId: 'socket-1',
      sessionId: 'session-1',
    });

    const expected = {
      master: { playerId: 'master-1', name: 'Mestre' },
      players: [],
    };
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'presence',
      ...expected,
    });
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'session.state',
      ...expected,
    });
    expect(publish).not.toHaveBeenCalledWith(
      'session:session-1',
      expect.objectContaining({ type: 'session.player-joined' }),
    );
  });

  it('keeps master null when the master is not connected', async () => {
    const { access, bus, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });
    vi.mocked(access.isMember).mockResolvedValue(true);
    bus.register('socket-1', 'p1', () => undefined);
    const publish = vi.spyOn(bus, 'publish');

    await service.execute({
      playerId: 'p1',
      socketId: 'socket-1',
      sessionId: 'session-1',
    });

    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'session.state',
      master: null,
      players: [{ playerId: 'p1', name: 'Ana', characterIds: ['char-1'] }],
    });
  });

  describe('state on join', () => {
    const joinInput = {
      playerId: 'p1',
      socketId: 'socket-1',
      sessionId: 'session-1',
    };
    const declared = {
      testId: 'test-1',
      skillId: 'skill-1',
      cd: 15,
      mode: 'open' as const,
      targetCharacterId: null,
      targetName: null,
    };

    function buildMember() {
      const built = build();
      vi.mocked(built.access.findById).mockResolvedValue({
        id: 'game-1',
        masterId: 'master-1',
      });
      vi.mocked(built.access.isMember).mockResolvedValue(true);
      built.bus.register('socket-1', 'p1', () => undefined);

      return built;
    }

    it('returns the open test with its rollers', async () => {
      const { messages, service } = buildMember();
      vi.mocked(messages.findLatestTest).mockResolvedValue(declared);
      vi.mocked(messages.listTestRollers).mockResolvedValue(['char-1']);

      const result = await service.execute(joinInput);

      expect(result.openTest).toEqual({
        ...declared,
        rolledCharacterIds: ['char-1'],
      });
    });

    it('returns no test when the latest one is closed', async () => {
      const { messages, service } = buildMember();
      vi.mocked(messages.findLatestTest).mockResolvedValue(declared);
      vi.mocked(messages.isTestClosed).mockResolvedValue(true);

      const result = await service.execute(joinInput);

      expect(result.openTest).toBeNull();
      expect(messages.listTestRollers).not.toHaveBeenCalled();
    });

    it('passes the combat state through', async () => {
      const { combat, service } = buildMember();
      const state = { active: true, turnIndex: 0, round: 1, entries: [] };
      vi.mocked(combat.findState).mockResolvedValue(state);

      const result = await service.execute(joinInput);

      expect(result.combat).toEqual(state);
    });
  });
});
