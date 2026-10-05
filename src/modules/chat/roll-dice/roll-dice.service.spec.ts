import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMessageBus } from '../chat.bus.js';
import type {
  CharacterSnapshot,
  CharacterSkillRef,
  SkillRef,
} from '../character-access.contract.js';
import type { DiceRolledEvent } from '../chat.entity.js';
import {
  ChatCharacterNotFoundError,
  ChatSkillNotFoundError,
} from '../chat.errors.js';
import {
  fixedRng,
  makeCharacterAccess,
  makeChatMessages,
  makeGameAccess,
  makePlayerDirectory,
} from '../chat.testkit.js';
import { RollDiceService } from './roll-dice.service.js';

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
    bExp: 2,
    attributes: {
      cognition: -5,
      psyche: -5,
      instinct: -5,
      constitution: 3,
      motricity: -5,
      perception: -5,
    },
    ...overrides,
  };
}

const SKILL: SkillRef = { id: 'skill-1', attribute: 'constitution' };
const ASSOCIATION: CharacterSkillRef = {
  skillId: 'skill-1',
  proficiencyBonus: 4,
};

function build() {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const characters = makeCharacterAccess();
  const players = makePlayerDirectory({ p1: 'Ana' });
  const bus = new InMemoryMessageBus();
  const service = new RollDiceService(
    messages,
    access,
    characters,
    players,
    bus,
    fixedRng(10),
  );

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
  vi.mocked(characters.findSkillById).mockResolvedValue(SKILL);
  vi.mocked(characters.findSkillForCharacter).mockResolvedValue(ASSOCIATION);

  return { messages, access, characters, players, bus, service };
}

describe('RollDiceService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves attribute, bonus and BExp from persisted state, never the frame', async () => {
    const { bus, service } = build();
    const publish = vi.spyOn(bus, 'publish');

    const result = await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      characterId: 'char-1',
      skillId: 'skill-1',
    });

    const expected: DiceRolledEvent = {
      playerId: 'p1',
      playerName: 'Ana',
      skillId: 'skill-1',
      attribute: 'constitution',
      rolls: [10, 10, 10, 10],
      result: 10,
      kind: 'best',
      skillBonus: 4,
      bExp: 2,
      total: 16,
    };
    expect(result).toEqual(expected);
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'dice.rolled',
      roll: expected,
    });
  });

  it('persists the roll before broadcasting', async () => {
    const { messages, bus, service } = build();
    const publish = vi.spyOn(bus, 'publish');

    await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      characterId: 'char-1',
      skillId: 'skill-1',
    });

    expect(messages.appendLog).toHaveBeenCalledWith({
      sessionId: 'session-1',
      playerId: 'p1',
      eventType: 'dice_roll',
      payload: {
        expression: 'constitution',
        results: [10, 10, 10, 10],
        total: 16,
      },
    });
    expect(
      vi.mocked(messages.appendLog).mock.invocationCallOrder[0],
    ).toBeLessThan(publish.mock.invocationCallOrder[0] ?? 0);
  });

  it('errors when the character is not in the session game', async () => {
    const { characters, service } = build();
    vi.mocked(characters.findById).mockResolvedValue(
      makeSnapshot({ gameId: 'other-game' }),
    );

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        characterId: 'char-1',
        skillId: 'skill-1',
      }),
    ).rejects.toBeInstanceOf(ChatCharacterNotFoundError);
  });

  it('errors when the skill does not exist', async () => {
    const { characters, service } = build();
    vi.mocked(characters.findSkillById).mockResolvedValue(null);

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        characterId: 'char-1',
        skillId: 'missing',
      }),
    ).rejects.toBeInstanceOf(ChatSkillNotFoundError);
  });
});
