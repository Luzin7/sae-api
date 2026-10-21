import {
  requireChatMember,
  requireChatSession,
  requireGameMaster,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { chatRoom, type RealtimeEvent } from '../chat.entity.js';
import {
  ChatMonsterNotFoundError,
  CombatStateNotFoundError,
} from '../chat.errors.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { CombatRepository } from '../combat.repository.js';
import type { CombatantSource } from '../combatant-source.contract.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';

export interface UpdateMonsterVitalsInput {
  playerId: string;
  sessionId: string;
  monsterId: string;
  currentHp: number;
  currentEffort: number;
}

export class UpdateMonsterVitalsService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly combatants: CombatantSource,
    private readonly combat: CombatRepository,
    private readonly bus: InMemoryMessageBus,
  ) {}

  async execute(input: UpdateMonsterVitalsInput): Promise<RealtimeEvent> {
    const session = await requireChatSession(this.messages, input.sessionId);
    const game = await requireChatMember(
      this.access,
      session.gameId,
      input.playerId,
    );
    requireGameMaster(game, input.playerId);

    const state = await this.combat.findState(input.sessionId);
    if (!state?.active) throw new CombatStateNotFoundError();

    const monster = await this.combatants.findMonsterInGame(
      session.gameId,
      input.monsterId,
    );
    if (!monster) throw new ChatMonsterNotFoundError();

    const currentHp = Math.min(Math.max(input.currentHp, 0), monster.maxHp);
    const currentEffort = Math.min(
      Math.max(input.currentEffort, 0),
      monster.maxEffort,
    );

    await this.combatants.saveMonsterVitals(input.monsterId, {
      currentHp,
      currentEffort,
    });

    const event: RealtimeEvent = {
      type: 'session.monster-vitals',
      monsterId: monster.id,
      currentHp,
      maxHp: monster.maxHp,
      currentEffort,
      maxEffort: monster.maxEffort,
    };
    this.bus.publish(chatRoom(input.sessionId), event);

    return event;
  }
}
