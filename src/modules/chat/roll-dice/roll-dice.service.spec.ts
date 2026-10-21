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
  ChatForbiddenError,
  ChatSkillNotFoundError,
  ChatTestNotFoundError,
} from '../chat.errors.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import {
  fixedRng,
  makeCharacterAccess,
  makeChatMessages,
  makeCombat,
  makeGameAccess,
  makePlayerDirectory,
} from '../chat.testkit.js';
import type {
  CombatantPayload,
  CombatStatePayload,
} from '@modules/session/session.entity.js';
import { RollDiceService } from './roll-dice.service.js';

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

type RollMessages = ChatMessageRepository & {
  hasRolledTest(
    sessionId: string,
    playerId: string,
    testId: string,
  ): Promise<boolean>;
};

function makeRollMessages(): RollMessages {
  return {
    ...makeChatMessages(),
    hasRolledTest: vi
      .fn<
        (
          sessionId: string,
          playerId: string,
          testId: string,
        ) => Promise<boolean>
      >()
      .mockResolvedValue(false),
  };
}

function makeEntry(
  overrides: Partial<CombatantPayload> = {},
): CombatantPayload {
  return {
    combatantId: 'c-1',
    kind: 'character',
    refId: 'char-1',
    name: 'Hero',
    initiativeValue: 10,
    hasRolled: true,
    ...overrides,
  };
}

function makeCombatState(
  entries: CombatantPayload[],
  overrides: Partial<CombatStatePayload> = {},
): CombatStatePayload {
  return { active: true, turnIndex: 0, round: 1, entries, ...overrides };
}

function build() {
  const messages = makeRollMessages();
  const access = makeGameAccess();
  const characters = makeCharacterAccess();
  const players = makePlayerDirectory({ p1: 'Ana' });
  const combat = makeCombat();
  const bus = new InMemoryMessageBus();
  const service = new RollDiceService(
    messages,
    access,
    characters,
    players,
    bus,
    fixedRng(10),
    combat,
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
  vi.mocked(combat.findState).mockResolvedValue(null);

  return { messages, access, characters, players, combat, bus, service };
}

describe('RollDiceService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves attribute, bonus and BExp from persisted state, never the frame', async () => {
    const { combat, bus, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(
      makeCombatState([makeEntry()]),
    );
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
    const { messages, combat, bus, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(
      makeCombatState([makeEntry()]),
    );
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

  it('forbids rolling a character owned by another player', async () => {
    const { characters, service } = build();
    vi.mocked(characters.findById).mockResolvedValue(
      makeSnapshot({ playerId: 'someone-else' }),
    );

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        characterId: 'char-1',
        skillId: 'skill-1',
      }),
    ).rejects.toBeInstanceOf(ChatForbiddenError);
  });

  it('allows the master to roll for another player', async () => {
    const { access, characters, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'p1',
    });
    vi.mocked(characters.findById).mockResolvedValue(
      makeSnapshot({ playerId: 'someone-else' }),
    );

    const result = await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      characterId: 'char-1',
      skillId: 'skill-1',
    });

    expect(result.total).toBe(16);
  });

  it('errors when a declared test cannot be found', async () => {
    const { messages, service } = build();
    vi.mocked(messages.findTestById).mockResolvedValue(null);

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        characterId: 'char-1',
        skillId: 'skill-1',
        testId: 'missing',
      }),
    ).rejects.toBeInstanceOf(ChatTestNotFoundError);
  });

  it('persists the test outcome and broadcasts it when the test applies', async () => {
    const { messages, bus, service } = build();
    vi.mocked(messages.findTestById).mockResolvedValue({
      testId: 'test-1',
      skillId: 'skill-1',
      cd: 15,
      mode: 'open',
      targetCharacterId: null,
      targetName: null,
    });
    const publish = vi.spyOn(bus, 'publish');

    const result = await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      characterId: 'char-1',
      skillId: 'skill-1',
      testId: 'test-1',
    });

    expect(result.testId).toBe('test-1');
    expect(result.cd).toBe(15);
    expect(result.success).toBe(true);
    expect(messages.appendLog).toHaveBeenCalledWith({
      sessionId: 'session-1',
      playerId: 'p1',
      eventType: 'dice_roll',
      payload: {
        expression: 'constitution',
        results: [10, 10, 10, 10],
        total: 16,
        testId: 'test-1',
        cd: 15,
        success: true,
      },
    });
    expect(publish).toHaveBeenCalledWith('session:session-1', {
      type: 'dice.rolled',
      roll: result,
    });
  });

  it('rejects a declared test whose skill differs from the roll', async () => {
    const { messages, characters, service } = build();
    vi.mocked(messages.findTestById).mockResolvedValue({
      testId: 'test-1',
      skillId: 'skill-1',
      cd: 15,
      mode: 'open',
      targetCharacterId: null,
      targetName: null,
    });
    vi.mocked(characters.findSkillById).mockResolvedValue({
      id: 'skill-2',
      attribute: 'constitution',
    });

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        characterId: 'char-1',
        skillId: 'skill-2',
        testId: 'test-1',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION',
      message: expect.any(String),
    });
  });

  it('resolves a targeted test when the rolled skill and target match', async () => {
    const { messages, service } = build();
    vi.mocked(messages.findTestById).mockResolvedValue({
      testId: 'test-2',
      skillId: 'skill-1',
      cd: 15,
      mode: 'targeted',
      targetCharacterId: 'char-1',
      targetName: 'Ana',
    });

    const result = await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      characterId: 'char-1',
      skillId: 'skill-1',
      testId: 'test-2',
    });

    expect(result.testId).toBe('test-2');
    expect(result.cd).toBe(15);
    expect(result.success).toBe(true);
  });

  it('rejects a targeted test aimed at another character', async () => {
    const { messages, characters, service } = build();
    vi.mocked(characters.findById).mockResolvedValue(
      makeSnapshot({ id: 'char-2', playerId: 'p1' }),
    );
    vi.mocked(messages.findTestById).mockResolvedValue({
      testId: 'test-3',
      skillId: 'skill-1',
      cd: 15,
      mode: 'targeted',
      targetCharacterId: 'char-1',
      targetName: 'Ana',
    });

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        characterId: 'char-2',
        skillId: 'skill-1',
        testId: 'test-3',
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: expect.any(String),
    });
  });

  it('allows a player to roll their own character on their combat turn without a test', async () => {
    const { combat, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(
      makeCombatState([makeEntry()]),
    );

    const result = await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      characterId: 'char-1',
      skillId: 'skill-1',
    });

    expect(result.total).toBe(16);
    expect(result.testId).toBeUndefined();
  });

  it('rejects a roll with no test when combat is not active', async () => {
    const { combat, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(null);

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        characterId: 'char-1',
        skillId: 'skill-1',
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: expect.any(String),
    });
  });

  it('rejects a roll when the current combatant is another player character', async () => {
    const { combat, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(
      makeCombatState([makeEntry({ refId: 'char-2', name: 'Bia' })]),
    );

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        characterId: 'char-1',
        skillId: 'skill-1',
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: expect.any(String),
    });
  });

  it('rejects a roll when the current combatant is a monster', async () => {
    const { combat, service } = build();
    vi.mocked(combat.findState).mockResolvedValue(
      makeCombatState([
        makeEntry({ kind: 'monster', refId: 'mon-1', name: 'Goblin' }),
      ]),
    );

    await expect(
      service.execute({
        playerId: 'p1',
        sessionId: 'session-1',
        characterId: 'char-1',
        skillId: 'skill-1',
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: expect.any(String),
    });
  });

  it('rejects a second roll of the same test by the same player', async () => {
    const { messages, service } = build();
    vi.mocked(messages.findTestById).mockResolvedValue({
      testId: 'test-1',
      skillId: 'skill-1',
      cd: 15,
      mode: 'open',
      targetCharacterId: null,
      targetName: null,
    });
    vi.mocked(messages.hasRolledTest)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const input = {
      playerId: 'p1',
      sessionId: 'session-1',
      characterId: 'char-1',
      skillId: 'skill-1',
      testId: 'test-1',
    };
    const first = await service.execute(input);
    expect(first.testId).toBe('test-1');

    await expect(service.execute(input)).rejects.toMatchObject({
      code: 'CONFLICT',
      message: expect.any(String),
    });
  });

  it('allows the master with a test during another combatant turn', async () => {
    const { messages, access, characters, combat, service } = build();
    vi.mocked(access.findById).mockResolvedValue({
      id: 'game-1',
      masterId: 'p1',
    });
    vi.mocked(characters.findById).mockResolvedValue(
      makeSnapshot({ playerId: 'someone-else' }),
    );
    vi.mocked(combat.findState).mockResolvedValue(
      makeCombatState([
        makeEntry({ kind: 'monster', refId: 'mon-1', name: 'Goblin' }),
      ]),
    );
    vi.mocked(messages.findTestById).mockResolvedValue({
      testId: 'test-1',
      skillId: 'skill-1',
      cd: 15,
      mode: 'open',
      targetCharacterId: null,
      targetName: null,
    });

    const result = await service.execute({
      playerId: 'p1',
      sessionId: 'session-1',
      characterId: 'char-1',
      skillId: 'skill-1',
      testId: 'test-1',
    });

    expect(result.testId).toBe('test-1');
  });
});
