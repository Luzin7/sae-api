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
import { ChatSkillNotFoundError } from '../chat.errors.js';
import { resolvePlayerSummary } from '../chat.players.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { CharacterAccess } from '../character-access.contract.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { PlayerDirectory } from '../player-directory.contract.js';

export interface RollDiceInput {
  playerId: string;
  sessionId: string;
  characterId: string;
  skillId: string;
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
  ) {}

  async execute(input: RollDiceInput): Promise<DiceRolledEvent> {
    const session = await requireChatSession(this.messages, input.sessionId);
    await requireChatMember(this.access, session.gameId, input.playerId);
    const character = await requireCharacterInGame(
      this.characters,
      session.gameId,
      input.characterId,
    );
    const skill = await this.characters.findSkillById(input.skillId);
    if (!skill) throw new ChatSkillNotFoundError();

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

    await this.messages.appendLog({
      sessionId: input.sessionId,
      playerId: input.playerId,
      eventType: 'dice_roll',
      payload: {
        expression: skill.attribute,
        results: roll.rolls,
        total,
      },
    });

    const event: RealtimeEvent = { type: 'dice.rolled', roll: rolled };
    this.bus.publish(chatRoom(input.sessionId), event);

    return rolled;
  }
}
