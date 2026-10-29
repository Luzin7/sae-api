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
import type {
  CombatRepository,
  InstanceVitalsPatch,
} from '../combat.repository.js';
import type {
  CombatantPayload,
  CombatStatePayload,
} from '@modules/session/session.entity.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';

export interface UpdateMonsterVitalsInput {
  playerId: string;
  sessionId: string;
  monsterId: string;
  currentHp: number;
  currentEffort: number;
  afflictions?: string[];
}

interface InstanceVitals {
  instance: CombatantPayload;
  maxHp: number;
  maxEffort: number;
}

function requireInstanceVitals(
  state: CombatStatePayload,
  monsterId: string,
): InstanceVitals {
  const instance = state.entries.find(
    (entry) => entry.kind === 'monster' && entry.refId === monsterId,
  );
  if (!instance || instance.maxHp === null || instance.maxEffort === null) {
    throw new ChatMonsterNotFoundError();
  }

  return { instance, maxHp: instance.maxHp, maxEffort: instance.maxEffort };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toVitalsPatch(
  input: UpdateMonsterVitalsInput,
  currentHp: number,
  currentEffort: number,
): InstanceVitalsPatch {
  if (input.afflictions === undefined) return { currentHp, currentEffort };

  return { currentHp, currentEffort, afflictions: input.afflictions };
}

export class UpdateMonsterVitalsService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
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

    const { instance, maxHp, maxEffort } = requireInstanceVitals(
      state,
      input.monsterId,
    );

    const currentHp = clamp(input.currentHp, 0, maxHp);
    const currentEffort = clamp(input.currentEffort, 0, maxEffort);

    await this.combat.saveInstanceVitals(
      input.sessionId,
      input.monsterId,
      toVitalsPatch(input, currentHp, currentEffort),
      input.playerId,
    );

    const event: RealtimeEvent = {
      type: 'session.monster-vitals',
      monsterId: instance.refId,
      currentHp,
      maxHp,
      currentEffort,
      maxEffort,
      afflictions: input.afflictions ?? instance.afflictions,
    };
    this.bus.publish(chatRoom(input.sessionId), event);

    return event;
  }
}
