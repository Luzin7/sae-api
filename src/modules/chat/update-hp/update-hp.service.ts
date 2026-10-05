import {
  requireCharacterInGame,
  requireChatMember,
  requireChatSession,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { applyHpChange } from '../chat.hp.js';
import { ChatForbiddenError } from '../chat.errors.js';
import type { RealtimeEvent } from '../chat.entity.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { CharacterAccess } from '../character-access.contract.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';

export interface UpdateHpInput {
  playerId: string;
  sessionId: string;
  characterId: string;
  newHp: number;
}

/** A player may only change their own character's HP. */
export class UpdateHpService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly characters: CharacterAccess,
    private readonly bus: InMemoryMessageBus,
  ) {}

  async execute(input: UpdateHpInput): Promise<RealtimeEvent> {
    const session = await requireChatSession(this.messages, input.sessionId);
    await requireChatMember(this.access, session.gameId, input.playerId);
    const character = await requireCharacterInGame(
      this.characters,
      session.gameId,
      input.characterId,
    );
    if (character.playerId !== input.playerId) throw new ChatForbiddenError();

    return applyHpChange(this.messages, this.characters, this.bus, {
      sessionId: input.sessionId,
      playerId: input.playerId,
      character,
      newHp: input.newHp,
    });
  }
}
