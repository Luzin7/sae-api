import {
  requireChatMember,
  requireChatSession,
  requireGameMaster,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { chatRoom, type RealtimeEvent } from '../chat.entity.js';
import {
  CombatNotReadyError,
  CombatStateNotFoundError,
} from '../chat.errors.js';
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
    if (!state || !state.active) throw new CombatStateNotFoundError();
    if (state.entries.length === 0) throw new CombatNotReadyError();
    if (state.entries.some((entry) => !entry.hasRolled)) {
      throw new CombatNotReadyError();
    }

    const wrapping = state.turnIndex + 1 >= state.entries.length;
    const turnIndex = wrapping ? 0 : state.turnIndex + 1;
    const round = wrapping ? state.round + 1 : state.round;
    const nextState = await this.combat.setTurn(
      input.sessionId,
      turnIndex,
      round,
    );

    await this.messages.appendLog({
      sessionId: input.sessionId,
      playerId: input.playerId,
      eventType: 'combat_state',
      payload: nextState,
    });

    const event: RealtimeEvent = { type: 'session.combat', state: nextState };
    this.bus.publish(chatRoom(input.sessionId), event);

    return nextState;
  }
}
