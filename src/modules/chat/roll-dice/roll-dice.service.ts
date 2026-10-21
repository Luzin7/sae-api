import { rollAttribute, type Rng } from '@shared/dice/roll.js';
import {
  requireCharacterInGame,
  requireChatMember,
  requireChatSession,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import {
  chatRoom,
  type DiceRolledEvent,
  type RealtimeEvent,
} from '../chat.entity.js';
import {
  ChatAlreadyRolledError,
  ChatForbiddenError,
  ChatNoActiveRollError,
  ChatNotYourTurnError,
  ChatSkillMismatchError,
  ChatSkillNotFoundError,
  ChatTestNotFoundError,
  ChatTestNotTargetedError,
} from '../chat.errors.js';
import { resolvePlayerSummary } from '../chat.players.js';
import type {
  ChatMessageRepository,
  DiceRollLogPayload,
} from '../chat.repository.js';
import type { CharacterAccess } from '../character-access.contract.js';
import type { CombatRepository } from '../combat.repository.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { PlayerDirectory } from '@shared/player-directory/player-directory.contract.js';
import type { TestDeclaredPayload } from '@modules/session/session.entity.js';

export interface RollDiceInput {
  playerId: string;
  sessionId: string;
  characterId: string;
  skillId: string;
  testId?: string;
}

/**
 * Server-side dice resolution. The client only names the character and skill;
 * the attribute value, proficiency bonus and BExp come from persisted state, so
 * a tampered frame cannot inflate a roll.
 */
export class RollDiceService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly characters: CharacterAccess,
    private readonly players: PlayerDirectory,
    private readonly bus: InMemoryMessageBus,
    private readonly rng: Rng,
    private readonly combat: CombatRepository,
  ) {}

  async execute(input: RollDiceInput): Promise<DiceRolledEvent> {
    const session = await requireChatSession(this.messages, input.sessionId);
    const game = await requireChatMember(
      this.access,
      session.gameId,
      input.playerId,
    );
    const character = await requireCharacterInGame(
      this.characters,
      session.gameId,
      input.characterId,
    );
    const isMaster = game.masterId === input.playerId;
    if (character.playerId !== input.playerId && !isMaster) {
      throw new ChatForbiddenError();
    }
    const skill = await this.characters.findSkillById(input.skillId);
    if (!skill) throw new ChatSkillNotFoundError();

    const test = await this.loadTest(input);
    if (!isMaster) await this.assertCanRoll(input, test);

    const player = await resolvePlayerSummary(this.players, input.playerId);
    const association = await this.characters.findSkillForCharacter(
      input.characterId,
      input.skillId,
    );

    const skillBonus = association?.proficiencyBonus ?? 0;
    const bExp = character.bExp;
    const attrValue = character.attributes[skill.attribute];
    const roll = rollAttribute(attrValue, this.rng);
    const total = roll.result + skillBonus + bExp;

    const rolled: DiceRolledEvent = {
      playerId: input.playerId,
      playerName: player.name,
      skillId: input.skillId,
      attribute: skill.attribute,
      rolls: roll.rolls,
      result: roll.result,
      kind: roll.kind,
      skillBonus,
      bExp,
      total,
    };

    const payload: DiceRollLogPayload = {
      expression: skill.attribute,
      results: roll.rolls,
      total,
    };
    if (this.appliesTest(test, input)) {
      const success = total >= test.cd;
      rolled.testId = test.testId;
      rolled.cd = test.cd;
      rolled.success = success;
      payload.testId = test.testId;
      payload.cd = test.cd;
      payload.success = success;
    }

    await this.messages.appendLog({
      sessionId: input.sessionId,
      playerId: input.playerId,
      eventType: 'dice_roll',
      payload,
    });

    const event: RealtimeEvent = { type: 'dice.rolled', roll: rolled };
    this.bus.publish(chatRoom(input.sessionId), event);

    return rolled;
  }

  private async assertCanRoll(
    input: RollDiceInput,
    test: TestDeclaredPayload | null,
  ): Promise<void> {
    if (!test) {
      await this.requireCombatTurn(input);

      return;
    }
    if (
      test.mode === 'targeted' &&
      test.targetCharacterId !== input.characterId
    ) {
      throw new ChatTestNotTargetedError();
    }
    if (test.skillId !== input.skillId) throw new ChatSkillMismatchError();
    const alreadyRolled = await this.messages.hasRolledTest(
      input.sessionId,
      input.playerId,
      test.testId,
    );
    if (alreadyRolled) throw new ChatAlreadyRolledError();
  }

  private async requireCombatTurn(input: RollDiceInput): Promise<void> {
    const state = await this.combat.findState(input.sessionId);
    if (!state?.active) throw new ChatNoActiveRollError();
    const current = state.entries[state.turnIndex];
    if (current?.kind !== 'character' || current.refId !== input.characterId) {
      throw new ChatNotYourTurnError();
    }
  }

  private appliesTest(
    test: TestDeclaredPayload | null,
    input: RollDiceInput,
  ): test is TestDeclaredPayload {
    if (!test) return false;
    if (test.skillId !== input.skillId) return false;
    if (test.mode === 'open') return true;

    return test.targetCharacterId === input.characterId;
  }

  private async loadTest(
    input: RollDiceInput,
  ): Promise<TestDeclaredPayload | null> {
    if (!input.testId) return null;
    const test = await this.messages.findTestById(
      input.sessionId,
      input.testId,
    );
    if (!test) throw new ChatTestNotFoundError();

    return test;
  }
}
