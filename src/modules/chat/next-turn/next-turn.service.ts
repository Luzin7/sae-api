import {
  requireChatMember,
  requireChatSession,
  requireGameMaster,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { chatRoom, type RealtimeEvent } from '../chat.entity.js';
import { CombatStateNotFoundError } from '../chat.errors.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { CombatRepository } from '../combat.repository.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { CombatStatePayload } from '@modules/session/session.entity.js';

export interface NextTurnInput {
  playerId: string;
  sessionId: string;
}

export class NextTurnService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly combat: CombatRepository,
    private readonly bus: InMemoryMessageBus,
  ) {}

  async execute(input: NextTurnInput): Promise<CombatStatePayload> {
    const session = await requireChatSession(this.messages, input.sessionId);
    const game = await requireChatMember(
      this.access,
      session.gameId,
      input.playerId,
    );
    requireGameMaster(game, input.playerId);

    const state = await this.combat.findState(input.sessionId);
    if (!state) throw new CombatStateNotFoundError();

    const nextState = await this.combat.advanceTurn({
      sessionId: input.sessionId,
      playerId: input.playerId,
      expectedTurnIndex: state.turnIndex,
      expectedRound: state.round,
    });

    const event: RealtimeEvent = { type: 'session.combat', state: nextState };
    this.bus.publish(chatRoom(input.sessionId), event);

    return nextState;
  }
}
