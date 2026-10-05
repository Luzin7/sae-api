import {
  requireCharacterInGame,
  requireChatMember,
  requireChatSession,
  requireGameMaster,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { applyHpChange } from '../chat.hp.js';
import type { RealtimeEvent } from '../chat.entity.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { CharacterAccess } from '../character-access.contract.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';

export interface ForceHpInput {
  playerId: string;
  sessionId: string;
  characterId: string;
  newHp: number;
}

/** Master-only: change any character in the session's game. */
export class ForceHpService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly characters: CharacterAccess,
    private readonly bus: InMemoryMessageBus,
  ) {}

  async execute(input: ForceHpInput): Promise<RealtimeEvent> {
    const session = await requireChatSession(this.messages, input.sessionId);
    const game = await requireChatMember(
      this.access,
      session.gameId,
      input.playerId,
    );
    requireGameMaster(game, input.playerId);
    const character = await requireCharacterInGame(
      this.characters,
      session.gameId,
      input.characterId,
    );

    return applyHpChange(this.messages, this.characters, this.bus, {
      sessionId: input.sessionId,
      playerId: input.playerId,
      character,
      newHp: input.newHp,
    });
  }
}
