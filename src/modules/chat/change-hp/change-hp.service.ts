import {
  requireCharacterWriter,
  requireChatMember,
  requireChatSession,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { chatRoom } from '../chat.entity.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type {
  CharacterAccess,
  HpChangeResult,
} from '../character-access.contract.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';

export interface ChangeHpInput {
  playerId: string;
  sessionId: string;
  characterId: string;
  delta: number;
}

/** The character's owner or the game's master may change its PS. */
export class ChangeHpService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly characters: CharacterAccess,
    private readonly bus: InMemoryMessageBus,
  ) {}

  async execute(input: ChangeHpInput): Promise<HpChangeResult> {
    const session = await requireChatSession(this.messages, input.sessionId);
    const game = await requireChatMember(
      this.access,
      session.gameId,
      input.playerId,
    );
    const character = await requireCharacterWriter(
      this.characters,
      game,
      input.playerId,
      input.characterId,
    );

    const result = await this.characters.changeHp(character.id, input.delta, {
      sessionId: input.sessionId,
      playerId: input.playerId,
    });
    if (result.oldHp === result.newHp) return result;

    this.bus.publish(chatRoom(input.sessionId), {
      type: 'character.hp-changed',
      characterId: character.id,
      oldHp: result.oldHp,
      newHp: result.newHp,
    });

    return result;
  }
}
