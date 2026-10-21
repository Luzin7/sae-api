import { describe, expect, it, vi } from 'vitest';
import type { CharacterAccess, CharacterSnapshot } from './character-access.contract.js';
import type { ChatMessageRepository } from './chat.repository.js';
import { InMemoryMessageBus } from './chat.bus.js';
import {
  ChatForbiddenError,
  ChatTestNotFoundError,
  CombatNotReadyError,
  MasterOnlyError,
} from './chat.errors.js';
import type {
  CombatantKind,
  CombatantRef,
  CombatantSource,
} from './combatant-source.contract.js';
import type { CombatRepository } from './combat.repository.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { PlayerDirectory } from '@shared/player-directory/player-directory.contract.js';
import type { Rng } from '@shared/dice/roll.js';
import type { TestDeclaredPayload } from '@modules/session/session.entity.js';
import {
  fixedRng,
  makeCharacterAccess,
  makeChatMessages,
  makeGameAccess,
  makeInMemoryCombat,
  makeInMemoryCombatants,
  makePlayerDirectory,
  sequenceRng,
} from './chat.testkit.js';
import { DeclareTestService } from './declare-test/declare-test.service.js';
import { EndCombatService } from './end-combat/end-combat.service.js';
import { NextTurnService } from './next-turn/next-turn.service.js';
import { RollDiceService } from './roll-dice/roll-dice.service.js';
import { RollInitiativeService } from './roll-initiative/roll-initiative.service.js';
import { StartCombatService } from './start-combat/start-combat.service.js';

const SESSION_ID = 's-1';
const GAME_ID = 'g-1';
const MASTER_ID = 'p-master';
const OWNER_ID = 'p-owner';
const OTHER_ID = 'p-other';
const SKILL_ID = 'skill-1';

const CHARACTER_ID = 'char-1';
const FOREIGN_CHARACTER_ID = 'char-2';
const MONSTER_ID = 'mon-1';

function makeRefs(): CombatantRef[] {
  return [
    {
      kind: 'character',
      refId: CHARACTER_ID,
      name: 'Ana',
      ownerPlayerId: OWNER_ID,
    },
    {
      kind: 'character',
      refId: FOREIGN_CHARACTER_ID,
      name: 'Bia',
      ownerPlayerId: OTHER_ID,
    },
    { kind: 'monster', refId: MONSTER_ID, name: 'Goblin', ownerPlayerId: null },
  ];
}

function makeCharacter(): CharacterSnapshot {
  return {
    id: CHARACTER_ID,
    gameId: GAME_ID,
    playerId: OWNER_ID,
    name: 'Ana',
    currentHp: 10,
    maxHp: 10,
    currentEffort: 5,
    maxEffort: 5,
    bExp: 3,
    attributes: {
      cognition: 0,
      psyche: 0,
      instinct: 0,
      constitution: 0,
      motricity: 0,
      perception: 0,
    },
  };
}

interface FlowOptions {
  rng?: Rng;
  masterId?: string;
  member?: boolean;
}

interface CombatFlow {
  messages: ChatMessageRepository;
  access: GameAccess;
  characters: CharacterAccess;
  players: PlayerDirectory;
  combatants: CombatantSource;
  combat: CombatRepository;
  bus: InMemoryMessageBus;
  startCombat: StartCombatService;
  rollInitiative: RollInitiativeService;
  nextTurn: NextTurnService;
  endCombat: EndCombatService;
  declareTest: DeclareTestService;
  rollDice: RollDiceService;
}

function buildFlow(options: FlowOptions = {}): CombatFlow {
  const messages = makeChatMessages();
  const access = makeGameAccess();
  const characters = makeCharacterAccess();
  const players = makePlayerDirectory({
    [MASTER_ID]: 'Mestre',
    [OWNER_ID]: 'Ana',
    [OTHER_ID]: 'Bia',
  });
  const combatants = makeInMemoryCombatants(makeRefs());
  const combat = makeInMemoryCombat();
  const bus = new InMemoryMessageBus();
  const tests = new Map<string, TestDeclaredPayload>();

  vi.mocked(messages.findSession).mockResolvedValue({
    id: SESSION_ID,
    gameId: GAME_ID,
  });
  vi.mocked(messages.appendLog).mockImplementation(async (input) => {
    if (input.eventType === 'test_declared') {
      tests.set(input.payload.testId, input.payload);
    }
  });
  vi.mocked(messages.findTestById).mockImplementation(
    async (_sessionId, testId) => tests.get(testId) ?? null,
  );
  vi.mocked(access.findById).mockResolvedValue({
    id: GAME_ID,
    masterId: options.masterId ?? MASTER_ID,
  });
  vi.mocked(access.isMember).mockResolvedValue(options.member ?? true);
  vi.mocked(characters.findById).mockResolvedValue(makeCharacter());
  vi.mocked(characters.findSkillById).mockResolvedValue({
    id: SKILL_ID,
    attribute: 'motricity',
  });
  vi.mocked(characters.findSkillForCharacter).mockResolvedValue({
    skillId: SKILL_ID,
    proficiencyBonus: 2,
  });

  const rng = options.rng ?? fixedRng(10);

  return {
    messages,
    access,
    characters,
    players,
    combatants,
    combat,
    bus,
    startCombat: new StartCombatService(messages, access, combatants, combat, bus),
    rollInitiative: new RollInitiativeService(
      messages,
      access,
      combatants,
      combat,
      bus,
      rng,
    ),
    nextTurn: new NextTurnService(messages, access, combat, bus),
    endCombat: new EndCombatService(messages, access, combat, bus),
    declareTest: new DeclareTestService(messages, access, combatants, bus),
    rollDice: new RollDiceService(
      messages,
      access,
      characters,
      players,
      bus,
      rng,
      combat,
    ),
  };
}

function rollAs(
  flow: CombatFlow,
  playerId: string,
  kind: CombatantKind,
  refId: string,
) {
  return flow.rollInitiative.execute({
    playerId,
    sessionId: SESSION_ID,
    kind,
    refId,
  });
}

function entryValue(
  entries: { refId: string; initiativeValue: number | null }[],
  refId: string,
): number | null {
  return entries.find((entry) => entry.refId === refId)?.initiativeValue ?? null;
}

describe('StartCombatService', () => {
  it('seeds combatants from CombatantSource.listByGame', async () => {
    const flow = buildFlow();

    const state = await flow.startCombat.execute({
      playerId: MASTER_ID,
      sessionId: SESSION_ID,
    });

    expect(state.active).toBe(true);
    expect(state.turnIndex).toBe(0);
    expect(state.round).toBe(1);
    expect(state.entries).toHaveLength(3);
    expect(state.entries.map((entry) => entry.kind).sort()).toEqual([
      'character',
      'character',
      'monster',
    ]);
    expect(state.entries.every((entry) => !entry.hasRolled)).toBe(true);
  });

  it('rejects a non-master player', async () => {
    const flow = buildFlow({ masterId: OTHER_ID });

    await expect(
      flow.startCombat.execute({ playerId: OWNER_ID, sessionId: SESSION_ID }),
    ).rejects.toBeInstanceOf(MasterOnlyError);
  });
});

describe('RollInitiativeService', () => {
  it('lets an owner roll their own character', async () => {
    const flow = buildFlow();
    await flow.startCombat.execute({ playerId: MASTER_ID, sessionId: SESSION_ID });

    const state = await rollAs(flow, OWNER_ID, 'character', CHARACTER_ID);

    expect(entryValue(state.entries, CHARACTER_ID)).toBe(10);
  });

  it('rejects a player rolling another player character', async () => {
    const flow = buildFlow();
    await flow.startCombat.execute({ playerId: MASTER_ID, sessionId: SESSION_ID });

    await expect(
      rollAs(flow, OTHER_ID, 'character', CHARACTER_ID),
    ).rejects.toBeInstanceOf(ChatForbiddenError);
  });

  it('lets only the master roll a monster', async () => {
    const flow = buildFlow();
    await flow.startCombat.execute({ playerId: MASTER_ID, sessionId: SESSION_ID });

    await expect(
      rollAs(flow, OWNER_ID, 'monster', MONSTER_ID),
    ).rejects.toBeInstanceOf(MasterOnlyError);

    const state = await rollAs(flow, MASTER_ID, 'monster', MONSTER_ID);
    expect(entryValue(state.entries, MONSTER_ID)).toBe(10);
  });

  it('rerolls on collision and keeps values unique', async () => {
    const flow = buildFlow({ rng: sequenceRng([5, 5, 12]) });
    await flow.startCombat.execute({ playerId: MASTER_ID, sessionId: SESSION_ID });

    await rollAs(flow, MASTER_ID, 'character', CHARACTER_ID);
    const state = await rollAs(flow, MASTER_ID, 'character', FOREIGN_CHARACTER_ID);

    const values = state.entries
      .filter((entry) => entry.hasRolled)
      .map((entry) => entry.initiativeValue)
      .sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(values).toEqual([5, 12]);
  });

  it('is idempotent when the same combatant rolls twice', async () => {
    const flow = buildFlow({ rng: sequenceRng([9, 20]) });
    await flow.startCombat.execute({ playerId: MASTER_ID, sessionId: SESSION_ID });

    const first = await rollAs(flow, OWNER_ID, 'character', CHARACTER_ID);
    const second = await rollAs(flow, OWNER_ID, 'character', CHARACTER_ID);

    expect(entryValue(first.entries, CHARACTER_ID)).toBe(9);
    expect(entryValue(second.entries, CHARACTER_ID)).toBe(9);
  });
});

describe('NextTurnService', () => {
  it('blocks while any combatant has not rolled', async () => {
    const flow = buildFlow();
    await flow.startCombat.execute({ playerId: MASTER_ID, sessionId: SESSION_ID });

    await expect(
      flow.nextTurn.execute({ playerId: MASTER_ID, sessionId: SESSION_ID }),
    ).rejects.toBeInstanceOf(CombatNotReadyError);
  });

  it('wraps the round when advancing past the last combatant', async () => {
    const flow = buildFlow();
    await flow.startCombat.execute({ playerId: MASTER_ID, sessionId: SESSION_ID });
    await rollAs(flow, MASTER_ID, 'character', CHARACTER_ID);
    await rollAs(flow, MASTER_ID, 'character', FOREIGN_CHARACTER_ID);
    await rollAs(flow, MASTER_ID, 'monster', MONSTER_ID);

    await flow.nextTurn.execute({ playerId: MASTER_ID, sessionId: SESSION_ID });
    await flow.nextTurn.execute({ playerId: MASTER_ID, sessionId: SESSION_ID });
    const state = await flow.nextTurn.execute({
      playerId: MASTER_ID,
      sessionId: SESSION_ID,
    });

    expect(state.turnIndex).toBe(0);
    expect(state.round).toBe(2);
  });
});

describe('EndCombatService', () => {
  it('ends the combat and clears the state', async () => {
    const flow = buildFlow();
    await flow.startCombat.execute({ playerId: MASTER_ID, sessionId: SESSION_ID });

    const state = await flow.endCombat.execute({
      playerId: MASTER_ID,
      sessionId: SESSION_ID,
    });

    expect(state.active).toBe(false);
    await expect(flow.combat.findState(SESSION_ID)).resolves.toBeNull();
  });
});

describe('DeclareTestService and RollDiceService', () => {
  it('resolves a targeted test as a success when total reaches the cd', async () => {
    const flow = buildFlow({ rng: fixedRng(10) });
    const test = await flow.declareTest.execute({
      playerId: MASTER_ID,
      sessionId: SESSION_ID,
      skillId: SKILL_ID,
      cd: 12,
      mode: 'targeted',
      targetCharacterId: CHARACTER_ID,
    });

    const roll = await flow.rollDice.execute({
      playerId: OWNER_ID,
      sessionId: SESSION_ID,
      characterId: CHARACTER_ID,
      skillId: SKILL_ID,
      testId: test.testId,
    });

    expect(roll.testId).toBe(test.testId);
    expect(roll.cd).toBe(12);
    expect(roll.success).toBe(true);
  });

  it('resolves a targeted test as a failure when total is below the cd', async () => {
    const flow = buildFlow({ rng: fixedRng(10) });
    const test = await flow.declareTest.execute({
      playerId: MASTER_ID,
      sessionId: SESSION_ID,
      skillId: SKILL_ID,
      cd: 20,
      mode: 'targeted',
      targetCharacterId: CHARACTER_ID,
    });

    const roll = await flow.rollDice.execute({
      playerId: OWNER_ID,
      sessionId: SESSION_ID,
      characterId: CHARACTER_ID,
      skillId: SKILL_ID,
      testId: test.testId,
    });

    expect(roll.cd).toBe(20);
    expect(roll.success).toBe(false);
  });

  it('fails when the testId does not exist', async () => {
    const flow = buildFlow();

    await expect(
      flow.rollDice.execute({
        playerId: OWNER_ID,
        sessionId: SESSION_ID,
        characterId: CHARACTER_ID,
        skillId: SKILL_ID,
        testId: 'missing-test',
      }),
    ).rejects.toBeInstanceOf(ChatTestNotFoundError);
  });

  it('rejects rolling a character the player does not own', async () => {
    const flow = buildFlow();

    await expect(
      flow.rollDice.execute({
        playerId: OTHER_ID,
        sessionId: SESSION_ID,
        characterId: CHARACTER_ID,
        skillId: SKILL_ID,
      }),
    ).rejects.toBeInstanceOf(ChatForbiddenError);
  });
});

describe('persisted log payloads', () => {
  it('logs combat_state when combat starts', async () => {
    const flow = buildFlow();

    await flow.startCombat.execute({ playerId: MASTER_ID, sessionId: SESSION_ID });

    expect(flow.messages.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        playerId: MASTER_ID,
        eventType: 'combat_state',
        payload: expect.objectContaining({
          active: true,
          turnIndex: 0,
          round: 1,
          entries: expect.any(Array),
        }),
      }),
    );
  });

  it('logs test_declared with the declared fields', async () => {
    const flow = buildFlow();

    const test = await flow.declareTest.execute({
      playerId: MASTER_ID,
      sessionId: SESSION_ID,
      skillId: SKILL_ID,
      cd: 12,
      mode: 'targeted',
      targetCharacterId: CHARACTER_ID,
    });

    expect(flow.messages.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'test_declared',
        payload: expect.objectContaining({
          testId: test.testId,
          skillId: SKILL_ID,
          cd: 12,
          mode: 'targeted',
          targetCharacterId: CHARACTER_ID,
          targetName: 'Ana',
        }),
      }),
    );
  });

  it('logs dice_roll with the test resolution fields', async () => {
    const flow = buildFlow({ rng: fixedRng(10) });
    const test = await flow.declareTest.execute({
      playerId: MASTER_ID,
      sessionId: SESSION_ID,
      skillId: SKILL_ID,
      cd: 12,
      mode: 'targeted',
      targetCharacterId: CHARACTER_ID,
    });

    await flow.rollDice.execute({
      playerId: OWNER_ID,
      sessionId: SESSION_ID,
      characterId: CHARACTER_ID,
      skillId: SKILL_ID,
      testId: test.testId,
    });

    expect(flow.messages.appendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'dice_roll',
        payload: expect.objectContaining({
          total: 15,
          testId: test.testId,
          cd: 12,
          success: true,
        }),
      }),
    );
  });
});
