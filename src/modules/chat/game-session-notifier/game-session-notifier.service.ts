import type {
  CharacterAdvanced,
  EffortChanged,
  GameSessionNotifier,
  HpChanged,
  NpChanged,
} from '@shared/game-session/game-session-notifier.contract.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { PlayerDirectory } from '@shared/player-directory/player-directory.contract.js';
import type { ActiveSessionLookup } from '@shared/session/active-session.contract.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { chatRoom, type RealtimeEvent } from '../chat.entity.js';
import { resolvePresence } from '../chat.players.js';
import type { CombatRepository } from '../combat.repository.js';

export interface NotifierLogger {
  error(details: object, message: string): void;
}

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
    private readonly combat: Pick<CombatRepository, 'findState'>,
    private readonly logger: NotifierLogger,
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
    } catch (error) {
      this.reportFailure('notifyRosterChanged', gameId, error);
    }
  }

  async notifyHpChanged(gameId: string, change: HpChanged): Promise<void> {
    await this.publish(gameId, {
      type: 'character.hp-changed',
      characterId: change.characterId,
      oldHp: change.oldHp,
      newHp: change.newHp,
    });
  }

  async notifyEffortChanged(
    gameId: string,
    change: EffortChanged,
  ): Promise<void> {
    await this.publish(gameId, {
      type: 'character.pe-changed',
      characterId: change.characterId,
      oldPe: change.oldPe,
      newPe: change.newPe,
    });
  }

  async notifyNpChanged(gameId: string, change: NpChanged): Promise<void> {
    await this.publish(gameId, {
      type: 'character.np-changed',
      characterId: change.characterId,
      oldNp: change.oldNp,
      newNp: change.newNp,
    });
  }

  async notifyCharacterAdvanced(
    gameId: string,
    change: CharacterAdvanced,
  ): Promise<void> {
    await this.publish(gameId, {
      type: 'character.advanced',
      characterId: change.characterId,
    });
  }

  async notifyCombatChanged(gameId: string): Promise<void> {
    try {
      const session = await this.sessions.findActiveByGame(gameId);
      if (!session) return;

      const state = await this.combat.findState(session.id);
      if (!state) return;

      this.bus.publish(chatRoom(session.id), { type: 'session.combat', state });
    } catch (error) {
      this.reportFailure('notifyCombatChanged', gameId, error);
    }
  }

  private async publish(gameId: string, event: RealtimeEvent): Promise<void> {
    try {
      const session = await this.sessions.findActiveByGame(gameId);
      if (!session) return;

      this.bus.publish(chatRoom(session.id), event);
    } catch (error) {
      this.reportFailure('publish', gameId, error);
    }
  }

  private reportFailure(step: string, gameId: string, error: unknown): void {
    this.logger.error(
      { step, gameId, err: error },
      'game session notify failed',
    );
  }
}
