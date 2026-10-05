import type { InMemoryMessageBus } from '../chat.bus.js';
import { chatRoom } from '../chat.entity.js';
import { resolvePlayers } from '../chat.players.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { PlayerDirectory } from '../player-directory.contract.js';

export interface LeaveInput {
  playerId: string;
  socketId: string;
  sessionId: string;
}

/**
 * Best-effort disconnect cleanup: leave the room, persist `player_leave`, then
 * fan out `session.player-left` and refreshed `presence`. Never throws — the
 * socket may already be gone or the session ended.
 */
export class LeaveService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly players: PlayerDirectory,
    private readonly bus: InMemoryMessageBus,
  ) {}

  async execute(input: LeaveInput): Promise<void> {
    const session = await this.messages.findSession(input.sessionId);
    if (!session) return;

    const room = chatRoom(input.sessionId);
    this.bus.leave(room, input.socketId);
    const remaining = await resolvePlayers(
      this.players,
      this.bus.presence(room),
    );
    const player = await this.players.findById(input.playerId);
    if (player) {
      await this.messages.appendLog({
        sessionId: input.sessionId,
        playerId: input.playerId,
        eventType: 'player_leave',
        payload: { playerId: input.playerId, name: player.name },
      });
      this.bus.publish(room, {
        type: 'session.player-left',
        player: { playerId: input.playerId, name: player.name },
      });
    }

    this.bus.publish(room, { type: 'presence', players: remaining });
  }
}
