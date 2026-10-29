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
import type { CombatRepository, CombatantSeed } from '../combat.repository.js';
import type {
  CombatantSource,
  MonsterRef,
} from '../combatant-source.contract.js';
import type { CombatStatePayload } from '@modules/session/session.entity.js';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';

export interface AddMonsterInput {
  playerId: string;
  sessionId: string;
  monsterId: string;
}

const STARTING_EFFORT = 0;

function toMonsterSeed(monsterId: string, monster: MonsterRef): CombatantSeed {
  return {
    kind: 'monster',
    refId: monsterId,
    name: monster.name,
    currentHp: monster.currentHp,
    maxHp: monster.maxHp,
    currentEffort: STARTING_EFFORT,
    maxEffort: monster.maxEffort,
    afflictions: [...monster.afflictions],
    cognition: monster.attributes.cognition,
    psyche: monster.attributes.psyche,
    instinct: monster.attributes.instinct,
    constitution: monster.attributes.constitution,
    motricity: monster.attributes.motricity,
    perception: monster.attributes.perception,
  };
}

export class AddMonsterService {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly access: GameAccess,
    private readonly combatants: CombatantSource,
    private readonly combat: CombatRepository,
    private readonly bus: InMemoryMessageBus,
  ) {}

  async execute(input: AddMonsterInput): Promise<CombatStatePayload> {
    const session = await requireChatSession(this.messages, input.sessionId);
    const game = await requireChatMember(
      this.access,
      session.gameId,
      input.playerId,
    );
    requireGameMaster(game, input.playerId);

    const monster = await this.combatants.findMonsterInGame(
      session.gameId,
      input.monsterId,
    );
    if (!monster) throw new ChatMonsterNotFoundError();

    const state = await this.combat.findState(input.sessionId);
    if (!state?.active) throw new CombatStateNotFoundError();

    const next = await this.combat.addCombatant(
      input.sessionId,
      toMonsterSeed(input.monsterId, monster),
      input.playerId,
    );

    const event: RealtimeEvent = { type: 'session.combat', state: next };
    this.bus.publish(chatRoom(input.sessionId), event);

    return next;
  }
}
