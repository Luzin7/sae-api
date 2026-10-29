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
  EffortChangeResult,
} from '../character-access.contract.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';

export interface ChangeEffortInput {
  playerId: string;
  sessionId: string;
  characterId: string;
  delta: number;
}

/** The character's owner or the game's master may change its PE. */
export class ChangeEffortService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly characters: CharacterAccess,
    private readonly bus: InMemoryMessageBus,
  ) {}

  async execute(input: ChangeEffortInput): Promise<EffortChangeResult> {
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

    const result = await this.characters.changeEffort(
      character.id,
      input.delta,
      { sessionId: input.sessionId, playerId: input.playerId },
    );
    this.publishChanges(input.sessionId, character.id, result);

    return result;
  }

  private publishChanges(
    sessionId: string,
    characterId: string,
    result: EffortChangeResult,
  ): void {
    const room = chatRoom(sessionId);
    if (result.oldEffort !== result.newEffort) {
      this.bus.publish(room, {
        type: 'character.pe-changed',
        characterId,
        oldPe: result.oldEffort,
        newPe: result.newEffort,
      });
    }
    if (result.oldHp !== result.newHp) {
      this.bus.publish(room, {
        type: 'character.hp-changed',
        characterId,
        oldHp: result.oldHp,
        newHp: result.newHp,
      });
    }
  }
}
