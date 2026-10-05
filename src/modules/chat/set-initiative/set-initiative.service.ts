import {
  requireChatMember,
  requireChatSession,
  requireGameMaster,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import {
  chatRoom,
  type InitiativeEntry,
  type RealtimeEvent,
} from '../chat.entity.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';

export interface SetInitiativeInput {
  playerId: string;
  sessionId: string;
  order: InitiativeEntry[];
}

/** Master-only initiative order; persisted as `initiative`, fanned out as `session.initiative`. */
export class SetInitiativeService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly bus: InMemoryMessageBus,
  ) {}

  async execute(input: SetInitiativeInput): Promise<RealtimeEvent> {
    const session = await requireChatSession(this.messages, input.sessionId);
    const game = await requireChatMember(
      this.access,
      session.gameId,
      input.playerId,
    );
    requireGameMaster(game, input.playerId);

    await this.messages.appendLog({
      sessionId: input.sessionId,
      playerId: input.playerId,
      eventType: 'initiative',
      payload: { order: input.order },
    });

    const event: RealtimeEvent = {
      type: 'session.initiative',
      order: input.order,
    };
    this.bus.publish(chatRoom(input.sessionId), event);

    return event;
  }
}
