import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import type { CharacterSnapshot } from '../character-access.contract.js';
import {
  ChatCharacterNotFoundError,
  InvalidHpError,
  MasterOnlyError,
} from '../chat.errors.js';
import {
  makeCharacterAccess,
  makeChatMessages,
  makeGameAccess,
} from '../chat.testkit.js';
import { ForceHpService } from './force-hp.service.js';

function makeSnapshot(
  overrides: Partial<CharacterSnapshot> = {},
): CharacterSnapshot {
  return {
    id: 'char-1',
    gameId: 'game-1',
    playerId: 'p1',
    currentHp: 20,
    maxHp: 26,
    currentEffort: 0,
    maxEffort: 20,
    bExp: 0,
    attributes: {
      cognition: -5,
      psyche: -5,
      instinct: -5,
      constitution: -5,
      motricity: -5,
      perception: -5,
    },
    ...overrides,
  };
}

function build() {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const characters = makeCharacterAccess();
  const bus = new InMemoryMessageBus();
  const service = new ForceHpService(messages, access, characters, bus);

  vi.mocked(messages.findSession).mockResolvedValue({
    id: 'session-1',
    gameId: 'game-1',
  });
  vi.mocked(characters.findById).mockResolvedValue(makeSnapshot());

  return { messages, access, characters, bus, service };
}

describe('ForceHpService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forbids a non-master before touching the character', async () => {
    const { messages, access, characters, bus, service } = build();
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
        characterId: 'char-1',
        newHp: 5,
      }),
    ).rejects.toBeInstanceOf(MasterOnlyError);
    expect(characters.updateHp).not.toHaveBeenCalled();
    expect(messages.appendLog).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('lets the master change another player and persists before broadcasting', async () => {
    const { messages, access, characters, bus, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });
    const publish = vi.spyOn(bus, 'publish');

    await service.execute({
      playerId: 'master-1',
      sessionId: 'session-1',
      characterId: 'char-1',
      newHp: 5,
    });

    expect(messages.appendLog).toHaveBeenCalledWith({
      sessionId: 'session-1',
      playerId: 'master-1',
      eventType: 'hp_change',
      payload: {
        characterId: 'char-1',
        delta: -15,
        currentHp: 5,
        maxHp: 26,
      },
    });
    expect(characters.updateHp).toHaveBeenCalledWith('char-1', 5);
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'character.hp-changed',
      characterId: 'char-1',
      oldHp: 20,
      newHp: 5,
    });
    expect(
      vi.mocked(messages.appendLog).mock.invocationCallOrder[0],
    ).toBeLessThan(publish.mock.invocationCallOrder[0] ?? 0);
  });

  it('rejects an HP outside the character bounds', async () => {
    const { access, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });

    await expect(
      service.execute({
        playerId: 'master-1',
        sessionId: 'session-1',
        characterId: 'char-1',
        newHp: 99,
      }),
    ).rejects.toBeInstanceOf(InvalidHpError);
  });

  it('errors when the character is in another game', async () => {
    const { access, characters, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'master-1',
    });
    vi.mocked(characters.findById).mockResolvedValue(
      makeSnapshot({ gameId: 'other-game' }),
    );

    await expect(
      service.execute({
        playerId: 'master-1',
        sessionId: 'session-1',
        characterId: 'char-1',
        newHp: 1,
      }),
    ).rejects.toBeInstanceOf(ChatCharacterNotFoundError);
  });
});
