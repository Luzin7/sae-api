import {
  requireChatMember,
  requireChatSession,
  requireGameMaster,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { chatRoom, type RealtimeEvent } from '../chat.entity.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { CombatRepository } from '../combat.repository.js';
import type { AfflictionKey } from '@shared/rules/afflictions.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { CombatStatePayload } from '@modules/session/session.entity.js';

export interface SetMonsterAfflictionsInput {
  playerId: string;
  sessionId: string;
  monsterId: string;
  afflictions: AfflictionKey[];
}

/** Master-only: replaces the afflictions of a monster instance in the combat. */
export class SetMonsterAfflictionsService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly combat: CombatRepository,
    private readonly bus: InMemoryMessageBus,
  ) {}

  async execute(
    input: SetMonsterAfflictionsInput,
  ): Promise<CombatStatePayload> {
    const session = await requireChatSession(this.messages, input.sessionId);
    const game = await requireChatMember(
      this.access,
      session.gameId,
      input.playerId,
    );
    requireGameMaster(game, input.playerId);

    const { state } = await this.combat.setInstanceAfflictions({
      sessionId: input.sessionId,
      monsterId: input.monsterId,
      afflictions: input.afflictions,
      playerId: input.playerId,
    });

    const event: RealtimeEvent = { type: 'session.combat', state };
    this.bus.publish(chatRoom(input.sessionId), event);

    return state;
  }
}
