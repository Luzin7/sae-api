import type {
  GameSessionNotifier,
  HpChanged,
} from '@shared/game-session/game-session-notifier.contract.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { PlayerDirectory } from '@shared/player-directory/player-directory.contract.js';
import type { ActiveSessionLookup } from '@shared/session/active-session.contract.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { chatRoom, type RealtimeEvent } from '../chat.entity.js';
import { resolvePresence } from '../chat.players.js';

/**
 * Best-effort bridge from REST mutations to the live table. A missing active
 * session or a failing dependency never fails the HTTP write: the caller has
 * already persisted the change, the notification is only a freshness bonus.
 */
export class GameSessionNotifierService implements GameSessionNotifier {
  constructor(
    private readonly sessions: ActiveSessionLookup,
    private readonly access: GameAccess,
    private readonly players: PlayerDirectory,
    private readonly bus: InMemoryMessageBus,
  ) {}

  async notifyRosterChanged(gameId: string): Promise<void> {
    try {
      const session = await this.sessions.findActiveByGame(gameId);
      if (!session) return;

      const game = await this.access.findById(gameId);
      if (!game) return;

      const room = chatRoom(session.id);
      const presence = await resolvePresence(
        this.players,
        gameId,
        this.bus.presence(room),
        game.masterId,
      );
      this.bus.publish(room, { type: 'presence', ...presence });
    } catch {}
  }

  async notifyHpChanged(gameId: string, change: HpChanged): Promise<void> {
    await this.publish(gameId, {
      type: 'character.hp-changed',
      characterId: change.characterId,
      oldHp: change.oldHp,
      newHp: change.newHp,
    });
  }

  private async publish(gameId: string, event: RealtimeEvent): Promise<void> {
    try {
      const session = await this.sessions.findActiveByGame(gameId);
      if (!session) return;

      this.bus.publish(chatRoom(session.id), event);
    } catch {}
  }
}
