import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import type { CharacterSnapshot } from '../character-access.contract.js';
import {
  ChatCharacterNotFoundError,
  ChatForbiddenError,
} from '../chat.errors.js';
import {
  makeCharacterAccess,
  makeChatMessages,
  makeGameAccess,
} from '../chat.testkit.js';
import { UpdateHpService } from './update-hp.service.js';

function makeSnapshot(
  overrides: Partial<CharacterSnapshot> = {},
): CharacterSnapshot {
  return {
    id: 'char-1',
    gameId: 'game-1',
    playerId: 'p1',
    name: 'Hero',
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
  const service = new UpdateHpService(messages, access, characters, bus);

  vi.mocked(messages.findSession).mockResolvedValue({
    id: 'session-1',
    gameId: 'game-1',
  });
  vi.mocked(access.findById).mockResolvedValue({
    id: 'game-1',
    masterId: 'master-1',
  });
  vi.mocked(access.isMember).mockResolvedValue(true);
  vi.mocked(characters.findById).mockResolvedValue(makeSnapshot());

  return { messages, characters, bus, service };
}

describe('UpdateHpService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lets the owner change their own character', async () => {
    const { messages, characters, bus, service } = build();
    const publish = vi.spyOn(bus, 'publish');

    await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      characterId: 'char-1',
      newHp: 18,
    });

    expect(characters.updateHpWithLog).toHaveBeenCalledWith('char-1', 18, {
      sessionId: 'session-1',
      playerId: 'p1',
      eventType: 'hp_change',
      payload: {
        characterId: 'char-1',
        delta: -2,
        currentHp: 18,
        maxHp: 26,
      },
    });
    expect(messages.appendLog).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'character.hp-changed',
      characterId: 'char-1',
      oldHp: 20,
      newHp: 18,
    });
  });

  it('leaves no log row when the HP write fails', async () => {
    const { messages, characters, bus, service } = build();
    const publish = vi.spyOn(bus, 'publish');
    vi.mocked(characters.updateHpWithLog).mockRejectedValue(
      new ChatCharacterNotFoundError(),
    );

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        characterId: 'char-1',
        newHp: 18,
      }),
    ).rejects.toBeInstanceOf(ChatCharacterNotFoundError);
    expect(messages.appendLog).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("forbids changing another player's character", async () => {
    const { messages, characters, service } = build();

    await expect(
      service.execute({
        playerId: 'p2',
        sessionId: 'session-1',
        characterId: 'char-1',
        newHp: 18,
      }),
    ).rejects.toBeInstanceOf(ChatForbiddenError);
    expect(characters.updateHpWithLog).not.toHaveBeenCalled();
    expect(messages.appendLog).not.toHaveBeenCalled();
  });
});
