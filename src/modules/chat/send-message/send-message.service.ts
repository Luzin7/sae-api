import {
  requireChatMember,
  requireChatSession,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { type ChatMessage, chatRoom } from '../chat.entity.js';
import { EmptyChatMessageError } from '../chat.errors.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';

export interface SendMessageInput {
  playerId: string;
  sessionId: string;
  body: string;
}

export class SendMessageService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly bus: InMemoryMessageBus,
  ) {}

  async execute(input: SendMessageInput): Promise<ChatMessage> {
    const session = await requireChatSession(this.messages, input.sessionId);
    await requireChatMember(this.access, session.gameId, input.playerId);

    const body = input.body.trim();
    if (body.length === 0) throw new EmptyChatMessageError();

    const message = await this.messages.appendChat({
      sessionId: input.sessionId,
      playerId: input.playerId,
      body,
    });
    this.bus.publish(chatRoom(input.sessionId), {
      type: 'chat.message',
      message,
    });

    return message;
  }
}
