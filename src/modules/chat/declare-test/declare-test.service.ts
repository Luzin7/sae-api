import { randomUUID } from 'node:crypto';
import {
  requireChatMember,
  requireChatSession,
  requireGameMaster,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { chatRoom, type RealtimeEvent } from '../chat.entity.js';
import { TestTargetNotFoundError } from '../chat.errors.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { CombatantSource } from '../combatant-source.contract.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { TestDeclaredPayload } from '@modules/session/session.entity.js';

export interface DeclareTestInput {
  playerId: string;
  sessionId: string;
  skillId: string;
  cd: number;
  mode: 'open' | 'targeted';
  targetCharacterId: string | null;
}

export class DeclareTestService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly combatants: CombatantSource,
    private readonly bus: InMemoryMessageBus,
  ) {}

  async execute(input: DeclareTestInput): Promise<TestDeclaredPayload> {
    const session = await requireChatSession(this.messages, input.sessionId);
    const game = await requireChatMember(
      this.access,
      session.gameId,
      input.playerId,
    );
    requireGameMaster(game, input.playerId);

    const targeted = input.mode === 'targeted';
    const targetName = targeted
      ? await this.resolveTargetName(session.gameId, input.targetCharacterId)
      : null;
    const test: TestDeclaredPayload = {
      testId: randomUUID(),
      skillId: input.skillId,
      cd: input.cd,
      mode: input.mode,
      targetCharacterId: targeted ? input.targetCharacterId : null,
      targetName,
    };

    await this.messages.appendLog({
      sessionId: input.sessionId,
      playerId: input.playerId,
      eventType: 'test_declared',
      payload: test,
    });

    const event: RealtimeEvent = { type: 'session.test-declared', test };
    this.bus.publish(chatRoom(input.sessionId), event);

    return test;
  }

  private async resolveTargetName(
    gameId: string,
    targetCharacterId: string | null,
  ): Promise<string> {
    const ref = await this.combatants.findByRef(
      gameId,
      'character',
      targetCharacterId ?? '',
    );
    if (!ref) throw new TestTargetNotFoundError();

    return ref.name;
  }
}
