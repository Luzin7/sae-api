import {
  requireChatMember,
  requireChatSession,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { type ChatMessage, chatRoom } from '../chat.entity.js';
import { resolvePlayerSummary, resolvePlayers } from '../chat.players.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import { CHAT_HISTORY_LIMIT } from '../chat.schemas.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { PlayerDirectory } from '../player-directory.contract.js';

export interface ConnectInput {
  playerId: string;
  socketId: string;
  sessionId: string;
}

export interface ConnectResult {
  history: ChatMessage[];
}

export class ConnectService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly players: PlayerDirectory,
    private readonly bus: InMemoryMessageBus,
  ) {}

  async execute(input: ConnectInput): Promise<ConnectResult> {
    const session = await requireChatSession(this.messages, input.sessionId);
    await requireChatMember(this.access, session.gameId, input.playerId);
    const player = await resolvePlayerSummary(this.players, input.playerId);

    const room = chatRoom(input.sessionId);
    this.bus.join(room, input.socketId);
    const players = await resolvePlayers(this.players, this.bus.presence(room));

    await this.messages.appendLog({
      sessionId: input.sessionId,
      playerId: input.playerId,
      eventType: 'player_join',
      payload: { playerId: input.playerId, name: player.name },
    });

    this.bus.publish(room, { type: 'session.player-joined', player });
    this.bus.publish(room, { type: 'presence', players });
    this.bus.publish(room, { type: 'session.state', players });

    const history = await this.messages.listRecentChat(
      input.sessionId,
      CHAT_HISTORY_LIMIT,
    );

    return { history };
  }
}
