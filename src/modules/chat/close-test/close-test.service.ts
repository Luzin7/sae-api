import {
  requireChatMember,
  requireChatSession,
  requireGameMaster,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { chatRoom, type RealtimeEvent } from '../chat.entity.js';
import { ChatTestNotFoundError } from '../chat.errors.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';

export interface CloseTestInput {
  playerId: string;
  sessionId: string;
  testId: string;
}

export class CloseTestService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly bus: InMemoryMessageBus,
  ) {}

  async execute(input: CloseTestInput): Promise<void> {
    const session = await requireChatSession(this.messages, input.sessionId);
    const game = await requireChatMember(
      this.access,
      session.gameId,
      input.playerId,
    );
    requireGameMaster(game, input.playerId);

    const test = await this.messages.findTestById(
      input.sessionId,
      input.testId,
    );
    if (!test) throw new ChatTestNotFoundError();

    const closed = await this.messages.isTestClosed(
      input.sessionId,
      input.testId,
    );
    if (closed) return;

    await this.messages.appendLog({
      sessionId: input.sessionId,
      playerId: input.playerId,
      eventType: 'test_closed',
      payload: { testId: input.testId },
    });

    const event: RealtimeEvent = {
      type: 'session.test-closed',
      testId: input.testId,
    };
    this.bus.publish(chatRoom(input.sessionId), event);
  }
}
