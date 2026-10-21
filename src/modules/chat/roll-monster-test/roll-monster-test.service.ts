import {
  requireChatMember,
  requireChatSession,
  requireGameMaster,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { chatRoom, type RealtimeEvent } from '../chat.entity.js';
import {
  ChatMonsterNotFoundError,
  CombatStateNotFoundError,
} from '../chat.errors.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { CombatRepository } from '../combat.repository.js';
import type { CombatantSource } from '../combatant-source.contract.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import { rollAttribute, type Rng } from '@shared/dice/roll.js';
import type { AttributeKey } from '@shared/rules/attributes.js';

export interface RollMonsterTestInput {
  playerId: string;
  sessionId: string;
  monsterId: string;
  attribute: AttributeKey;
}

export class RollMonsterTestService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly combatants: CombatantSource,
    private readonly combat: CombatRepository,
    private readonly bus: InMemoryMessageBus,
    private readonly rng: Rng,
  ) {}

  async execute(input: RollMonsterTestInput): Promise<RealtimeEvent> {
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

    const attribute = input.attribute;
    const roll = rollAttribute(monster.attributes[attribute], this.rng);

    const event: RealtimeEvent = {
      type: 'session.monster-rolled',
      monsterId: input.monsterId,
      name: monster.name,
      attribute,
      rolls: roll.rolls,
      result: roll.result,
      kind: roll.kind,
    };

    await this.messages.appendLog({
      sessionId: input.sessionId,
      playerId: input.playerId,
      eventType: 'dice_roll',
      payload: {
        expression: `${monster.name} — ${attribute}`,
        results: roll.rolls,
        total: roll.result,
      },
    });

    this.bus.publish(chatRoom(input.sessionId), event);

    return event;
  }
}
