import {
  requireChatMember,
  requireChatSession,
  requireGameMaster,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { chatRoom, type RealtimeEvent } from '../chat.entity.js';
import {
  ChatForbiddenError,
  CombatantNotFoundError,
  CombatStateNotFoundError,
} from '../chat.errors.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { CombatRepository } from '../combat.repository.js';
import type {
  CombatantKind,
  CombatantSource,
} from '../combatant-source.contract.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { Rng } from '@shared/dice/roll.js';
import type { CombatStatePayload } from '@modules/session/session.entity.js';

export interface RollInitiativeInput {
  playerId: string;
  sessionId: string;
  kind: CombatantKind;
  refId: string;
}

export class RollInitiativeService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly combatants: CombatantSource,
    private readonly combat: CombatRepository,
    private readonly bus: InMemoryMessageBus,
    private readonly rng: Rng,
  ) {}

  async execute(input: RollInitiativeInput): Promise<CombatStatePayload> {
    const session = await requireChatSession(this.messages, input.sessionId);
    const game = await requireChatMember(
      this.access,
      session.gameId,
      input.playerId,
    );

    const ref = await this.combatants.findByRef(
      session.gameId,
      input.kind,
      input.refId,
    );
    if (!ref) throw new CombatantNotFoundError();

    if (input.kind === 'monster') requireGameMaster(game, input.playerId);
    if (
      input.kind === 'character' &&
      ref.ownerPlayerId !== input.playerId &&
      game.masterId !== input.playerId
    ) {
      throw new ChatForbiddenError();
    }

    const state = await this.combat.findState(input.sessionId);
    if (!state || !state.active) throw new CombatStateNotFoundError();

    const nextState = await this.combat.rollInitiative(
      input.sessionId,
      input.kind,
      input.refId,
      () => this.rng(1, 20),
    );

    await this.messages.appendLog({
      sessionId: input.sessionId,
      playerId: input.playerId,
      eventType: 'combat_state',
      payload: nextState,
    });

    const event: RealtimeEvent = { type: 'session.combat', state: nextState };
    this.bus.publish(chatRoom(input.sessionId), event);

    return nextState;
  }
}
