import {
  requireChatMember,
  requireChatSession,
  requireGameMaster,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { chatRoom, type RealtimeEvent } from '../chat.entity.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { CombatRepository } from '../combat.repository.js';
import type { CombatantSource } from '../combatant-source.contract.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { Rng } from '@shared/dice/roll.js';
import type { CombatStatePayload } from '@modules/session/session.entity.js';

export interface StartCombatInput {
  playerId: string;
  sessionId: string;
}

export class StartCombatService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly combatants: CombatantSource,
    private readonly combat: CombatRepository,
    private readonly bus: InMemoryMessageBus,
    private readonly rng: Rng,
  ) {}

  async execute(input: StartCombatInput): Promise<CombatStatePayload> {
    const session = await requireChatSession(this.messages, input.sessionId);
    const game = await requireChatMember(
      this.access,
      session.gameId,
      input.playerId,
    );
    requireGameMaster(game, input.playerId);

    const refs = await this.combatants.listByGame(session.gameId);
    const seeds = refs.map((ref) => ({
      kind: ref.kind,
      refId: ref.refId,
      name: ref.name,
    }));
    const state = await this.combat.start(
      input.sessionId,
      seeds,
      () => this.rng(1, 20),
      input.playerId,
    );

    const event: RealtimeEvent = { type: 'session.combat', state };
    this.bus.publish(chatRoom(input.sessionId), event);

    return state;
  }
}
