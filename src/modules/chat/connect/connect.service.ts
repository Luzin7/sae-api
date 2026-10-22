import {
  requireChatMember,
  requireChatSession,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import {
  type ChatMessage,
  chatRoom,
  type OpenTestSnapshot,
} from '../chat.entity.js';
import { resolvePlayerSummary, resolvePresence } from '../chat.players.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import { CHAT_HISTORY_LIMIT } from '../chat.schemas.js';
import type { CombatRepository } from '../combat.repository.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { CombatStatePayload } from '@modules/session/session.entity.js';
import type { PlayerDirectory } from '@shared/player-directory/player-directory.contract.js';

export interface ConnectInput {
  playerId: string;
  socketId: string;
  sessionId: string;
}

export interface ConnectResult {
  history: ChatMessage[];
  openTest: OpenTestSnapshot | null;
  combat: CombatStatePayload | null;
}

export class ConnectService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly players: PlayerDirectory,
    private readonly bus: InMemoryMessageBus,
    private readonly combat: CombatRepository,
  ) {}

  async execute(input: ConnectInput): Promise<ConnectResult> {
    const session = await requireChatSession(this.messages, input.sessionId);
    const game = await requireChatMember(
      this.access,
      session.gameId,
      input.playerId,
    );
    const player = await resolvePlayerSummary(this.players, input.playerId);

    const room = chatRoom(input.sessionId);
    this.bus.join(room, input.socketId);
    const presence = await resolvePresence(
      this.players,
      session.gameId,
      this.bus.presence(room),
      game.masterId,
    );

    await this.messages.appendLog({
      sessionId: input.sessionId,
      playerId: input.playerId,
      eventType: 'player_join',
      payload: { playerId: input.playerId, name: player.name },
    });

    const joined = presence.players.find(
      (entry) => entry.playerId === input.playerId,
    );
    if (joined) {
      this.bus.publish(room, { type: 'session.player-joined', player: joined });
    }
    this.bus.publish(room, { type: 'presence', ...presence });
    this.bus.publish(room, { type: 'session.state', ...presence });

    const history = await this.messages.listRecentChat(
      input.sessionId,
      CHAT_HISTORY_LIMIT,
    );

    const openTest = await this.resolveOpenTest(input.sessionId);
    const combat = await this.combat.findState(input.sessionId);

    return { history, openTest, combat };
  }

  private async resolveOpenTest(
    sessionId: string,
  ): Promise<OpenTestSnapshot | null> {
    const test = await this.messages.findLatestTest(sessionId);
    if (!test) return null;

    const closed = await this.messages.isTestClosed(sessionId, test.testId);
    if (closed) return null;

    const rolledCharacterIds = await this.messages.listTestRollers(
      sessionId,
      test.testId,
    );

    return { ...test, rolledCharacterIds };
  }
}
