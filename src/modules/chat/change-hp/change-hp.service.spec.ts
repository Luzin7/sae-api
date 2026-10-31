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
import { ChangeHpService } from './change-hp.service.js';

function makeSnapshot(
  overrides: Partial<CharacterSnapshot> = {},
): CharacterSnapshot {
  return {
    id: 'char-1',
    gameId: 'game-1',
    playerId: 'p1',
    name: 'Hero',
    currentHp: 10,
    maxHp: 30,
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
  const service = new ChangeHpService(messages, access, characters, bus);

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
  vi.mocked(characters.changeHp).mockResolvedValue({ oldHp: 10, newHp: 15 });

  return { characters, service, publish: vi.spyOn(bus, 'publish') };
}

const frame = (playerId: string, delta = 5) => ({
  playerId,
  sessionId: 'session-1',
  characterId: 'char-1',
  delta,
});

describe('ChangeHpService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lets the game master apply a delta and publishes hp-changed', async () => {
    const { characters, service, publish } = build();

    await service.execute(frame('master-1'));

    expect(characters.changeHp).toHaveBeenCalledWith('char-1', 5, {
      sessionId: 'session-1',
      playerId: 'master-1',
    });
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'character.hp-changed',
      characterId: 'char-1',
      oldHp: 10,
      newHp: 15,
    });
  });

  it('forbids the character owner and writes nothing', async () => {
    const { characters, service, publish } = build();

    await expect(service.execute(frame('p1'))).rejects.toBeInstanceOf(
      ChatForbiddenError,
    );
    expect(characters.changeHp).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('forbids another player and writes nothing', async () => {
    const { characters, service, publish } = build();

    await expect(service.execute(frame('p2'))).rejects.toBeInstanceOf(
      ChatForbiddenError,
    );
    expect(characters.changeHp).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('hides a character from another game', async () => {
    const { characters, service } = build();
    vi.mocked(characters.findById).mockResolvedValue(
      makeSnapshot({ gameId: 'game-2' }),
    );

    await expect(service.execute(frame('master-1'))).rejects.toBeInstanceOf(
      ChatCharacterNotFoundError,
    );
    expect(characters.changeHp).not.toHaveBeenCalled();
  });
});
