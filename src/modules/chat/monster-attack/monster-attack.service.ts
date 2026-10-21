import {
  requireChatMember,
  requireChatSession,
  requireGameMaster,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { chatRoom, type RealtimeEvent } from '../chat.entity.js';
import {
  ChatCharacterNotFoundError,
  ChatMonsterNotFoundError,
  CombatStateNotFoundError,
} from '../chat.errors.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { CombatRepository } from '../combat.repository.js';
import type { CombatantSource } from '../combatant-source.contract.js';
import type { CharacterAccess } from '../character-access.contract.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import { rollAttribute, type Rng } from '@shared/dice/roll.js';
import type { AttributeKey } from '@shared/rules/attributes.js';

export interface MonsterAttackInput {
  playerId: string;
  sessionId: string;
  monsterId: string;
  attribute: AttributeKey;
  targetCharacterId: string;
  damage: number;
}

export class MonsterAttackService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly characters: CharacterAccess,
    private readonly combatants: CombatantSource,
    private readonly combat: CombatRepository,
    private readonly bus: InMemoryMessageBus,
    private readonly rng: Rng,
  ) {}

  async execute(input: MonsterAttackInput): Promise<RealtimeEvent> {
    const session = await requireChatSession(this.messages, input.sessionId);
    const game = await requireChatMember(
      this.access,
      session.gameId,
      input.playerId,
    );
    requireGameMaster(game, input.playerId);

    const state = await this.combat.findState(input.sessionId);
    if (!state?.active) throw new CombatStateNotFoundError();

    const monster = await this.combatants.findMonsterInGame(
      session.gameId,
      input.monsterId,
    );
    if (!monster) throw new ChatMonsterNotFoundError();

    const target = await this.characters.findById(input.targetCharacterId);
    if (!target || target.gameId !== session.gameId) {
      throw new ChatCharacterNotFoundError();
    }

    const roll = rollAttribute(
      monster.attributes[input.attribute],
      this.rng,
    );

    await this.messages.appendLog({
      sessionId: input.sessionId,
      playerId: input.playerId,
      eventType: 'dice_roll',
      payload: {
        expression: `${monster.name} atacou ${target.name} (${input.attribute})`,
        results: roll.rolls,
        total: roll.result,
      },
    });

    if (input.damage > 0) {
      const { previousHp, character } = await this.characters.damageHp(
        target.id,
        input.damage,
      );
      this.bus.publish(chatRoom(input.sessionId), {
        type: 'character.hp-changed',
        characterId: character.id,
        oldHp: previousHp,
        newHp: character.currentHp,
      });
    }

    const event: RealtimeEvent = {
      type: 'session.monster-attacked',
      monsterId: monster.id,
      name: monster.name,
      attribute: input.attribute,
      targetCharacterId: target.id,
      targetName: target.name,
      rolls: roll.rolls,
      result: roll.result,
      kind: roll.kind,
      damage: input.damage,
    };
    this.bus.publish(chatRoom(input.sessionId), event);

    return event;
  }
}
