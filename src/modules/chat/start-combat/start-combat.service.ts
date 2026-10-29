import {
  requireChatMember,
  requireChatSession,
  requireGameMaster,
} from '../chat.authorization.js';
import type { InMemoryMessageBus } from '../chat.bus.js';
import { chatRoom, type RealtimeEvent } from '../chat.entity.js';
import type { ChatMessageRepository } from '../chat.repository.js';
import type { CombatRepository, CombatantSeed } from '../combat.repository.js';
import type {
  CombatantRef,
  CombatantSource,
} from '../combatant-source.contract.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { CombatStatePayload } from '@modules/session/session.entity.js';

export interface StartCombatInput {
  playerId: string;
  sessionId: string;
}

function seedWithoutVitals(ref: CombatantRef): CombatantSeed {
  return {
    kind: ref.kind,
    refId: ref.refId,
    name: ref.name,
    currentHp: null,
    maxHp: null,
    currentEffort: null,
    maxEffort: null,
    afflictions: [],
    cognition: null,
    psyche: null,
    instinct: null,
    constitution: null,
    motricity: null,
    perception: null,
  };
}

function toCombatantSeed(ref: CombatantRef): CombatantSeed {
  if (ref.kind === 'character') return seedWithoutVitals(ref);

  const template = ref.template;
  if (!template) return seedWithoutVitals(ref);

  return {
    kind: ref.kind,
    refId: ref.refId,
    name: ref.name,
    currentHp: template.currentHp,
    maxHp: template.maxHp,
    currentEffort: template.currentEffort,
    maxEffort: template.maxEffort,
    afflictions: [],
    cognition: template.attributes.cognition,
    psyche: template.attributes.psyche,
    instinct: template.attributes.instinct,
    constitution: template.attributes.constitution,
    motricity: template.attributes.motricity,
    perception: template.attributes.perception,
  };
}

export class StartCombatService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly combatants: CombatantSource,
    private readonly combat: CombatRepository,
    private readonly bus: InMemoryMessageBus,
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
    const seeds = refs.map(toCombatantSeed);
    const state = await this.combat.start(
      input.sessionId,
      seeds,
      input.playerId,
    );

    const event: RealtimeEvent = { type: 'session.combat', state };
    this.bus.publish(chatRoom(input.sessionId), event);

    return state;
  }
}
