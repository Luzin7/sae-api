import {
  requireChatMember,
  requireChatSession,
  requireGameMaster,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { chatRoom, type RealtimeEvent } from '../chat.entity.js';
import { EmptyNarrationError } from '../chat.errors.js';
import { resolvePlayerSummary } from '../chat.players.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { PlayerDirectory } from '../player-directory.contract.js';

export interface MasterBroadcastInput {
  playerId: string;
  sessionId: string;
  text: string;
}

type Clock = () => Date;

/** Master-only narration. Persisted as `master_broadcast`, fanned out as `master.narration`. */
export class MasterBroadcastService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly players: PlayerDirectory,
    private readonly bus: InMemoryMessageBus,
    private readonly clock: Clock,
  ) {}

  async execute(input: MasterBroadcastInput): Promise<RealtimeEvent> {
    const session = await requireChatSession(this.messages, input.sessionId);
    const game = await requireChatMember(
      this.access,
      session.gameId,
      input.playerId,
    );
    requireGameMaster(game, input.playerId);

    const text = input.text.trim();
    if (text.length === 0) throw new EmptyNarrationError();

    const player = await resolvePlayerSummary(this.players, input.playerId);
    await this.messages.appendLog({
      sessionId: input.sessionId,
      playerId: input.playerId,
      eventType: 'master_broadcast',
      payload: { text },
    });

    const event: RealtimeEvent = {
      type: 'master.narration',
      playerId: input.playerId,
      playerName: player.name,
      text,
      at: this.clock().toISOString(),
    };
    this.bus.publish(chatRoom(input.sessionId), event);

    return event;
  }
}
