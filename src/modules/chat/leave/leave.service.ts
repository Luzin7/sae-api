import type { InMemoryMessageBus } from '../chat.bus.js';
import { chatRoom } from '../chat.entity.js';
import { resolvePlayerPresence, resolvePresence } from '../chat.players.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { PlayerDirectory } from '@shared/player-directory/player-directory.contract.js';

export interface LeaveInput {
  playerId: string;
  socketId: string;
  sessionId: string;
}

/**
 * Best-effort disconnect cleanup: leave the room, persist `player_leave`, then
 * fan out `session.player-left` and refreshed `presence`. Never throws — the
 * socket may already be gone or the session ended. The master never emits
 * `player-left`; their online state is carried by `presence`/`session.state`.
 */
export class LeaveService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly players: PlayerDirectory,
    private readonly bus: InMemoryMessageBus,
  ) {}

  async execute(input: LeaveInput): Promise<void> {
    const session = await this.messages.findSession(input.sessionId);
    if (!session) return;

    const game = await this.access.findById(session.gameId);
    if (!game) return;

    const room = chatRoom(input.sessionId);
    this.bus.leave(room, input.socketId);
    const presence = await resolvePresence(
      this.players,
      session.gameId,
      this.bus.presence(room),
      game.masterId,
    );
    const player = await resolvePlayerPresence(
      this.players,
      session.gameId,
      input.playerId,
    );
    if (!player) {
      this.bus.publish(room, { type: 'presence', ...presence });
      return;
    }

    await this.messages.appendLog({
      sessionId: input.sessionId,
      playerId: input.playerId,
      eventType: 'player_leave',
      payload: { playerId: player.playerId, name: player.name },
    });

    if (player.playerId !== game.masterId) {
      this.bus.publish(room, { type: 'session.player-left', player });
    }
    this.bus.publish(room, { type: 'presence', ...presence });
  }
}
