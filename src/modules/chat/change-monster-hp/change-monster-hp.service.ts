import {
  requireChatMember,
  requireChatSession,
  requireGameMaster,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { chatRoom, type RealtimeEvent } from '../chat.entity.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { CombatRepository } from '../combat.repository.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { CombatStatePayload } from '@modules/session/session.entity.js';

export interface ChangeMonsterHpInput {
  playerId: string;
  sessionId: string;
  monsterId: string;
  delta: number;
}

/** Master-only: PS change on a monster instance in the combat. */
export class ChangeMonsterHpService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly combat: CombatRepository,
    private readonly bus: InMemoryMessageBus,
  ) {}

  async execute(input: ChangeMonsterHpInput): Promise<CombatStatePayload> {
    const session = await requireChatSession(this.messages, input.sessionId);
    const game = await requireChatMember(
      this.access,
      session.gameId,
      input.playerId,
    );
    requireGameMaster(game, input.playerId);

    const { state } = await this.combat.changeInstanceHp({
      sessionId: input.sessionId,
      monsterId: input.monsterId,
      delta: input.delta,
      playerId: input.playerId,
    });

    const event: RealtimeEvent = { type: 'session.combat', state };
    this.bus.publish(chatRoom(input.sessionId), event);

    return state;
  }
}
