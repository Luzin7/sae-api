import { z } from 'zod';

export const MAX_CHAT_BODY_LENGTH = 2000;
export const CHAT_HISTORY_LIMIT = 50;

const UuidSchema = z.string().uuid();
const NonNegativeIntSchema = z.number().int().min(0);
const AttributeSchema = z.enum([
  'cognition',
  'psyche',
  'instinct',
  'constitution',
  'motricity',
  'perception',
]);

const PlayerSummaryWireSchema = z.object({
  playerId: z.string(),
  name: z.string(),
});

const PlayerPresenceWireSchema = z.object({
  playerId: z.string(),
  name: z.string(),
  characterIds: z.array(z.string()),
});

const CombatantWireSchema = z.object({
  combatantId: z.string(),
  kind: z.enum(['character', 'monster']),
  refId: z.string(),
  name: z.string(),
  initiativeValue: z.number().int().nullable(),
  hasRolled: z.boolean(),
});

/**
 * Inbound frames. Validated at the gateway boundary; a malformed frame never
 * reaches a service. `v` is reserved so the protocol can evolve.
 *
 * `dice.roll` and `character.hp-update` carry ids only: attribute value, skill
 * bonus and BExp are resolved server-side from the character.
 */
export const InboundFrameSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session.join'), sessionId: UuidSchema }),
  z.object({
    type: z.literal('chat.send'),
    sessionId: UuidSchema,
    body: z.string().min(1).max(MAX_CHAT_BODY_LENGTH),
  }),
  z.object({
    type: z.literal('dice.roll'),
    sessionId: UuidSchema,
    characterId: UuidSchema,
    skillId: UuidSchema,
    testId: UuidSchema.optional(),
  }),
  z.object({
    type: z.literal('character.hp-update'),
    sessionId: UuidSchema,
    characterId: UuidSchema,
    newHp: NonNegativeIntSchema,
  }),
  z.object({
    type: z.literal('master.broadcast'),
    sessionId: UuidSchema,
    text: z.string().min(1).max(MAX_CHAT_BODY_LENGTH),
  }),
  z.object({
    type: z.literal('master.force-hp-update'),
    sessionId: UuidSchema,
    characterId: UuidSchema,
    newHp: NonNegativeIntSchema,
  }),
  z.object({ type: z.literal('master.start-combat'), sessionId: UuidSchema }),
  z.object({
    type: z.literal('combat.roll-initiative'),
    sessionId: UuidSchema,
    kind: z.enum(['character', 'monster']),
    refId: UuidSchema,
  }),
  z.object({ type: z.literal('master.next-turn'), sessionId: UuidSchema }),
  z.object({ type: z.literal('master.end-combat'), sessionId: UuidSchema }),
  z.object({
    type: z.literal('master.roll-monster-test'),
    sessionId: UuidSchema,
    monsterId: UuidSchema,
    attribute: z.enum([
      'cognition',
      'psyche',
      'instinct',
      'constitution',
      'motricity',
      'perception',
    ]),
  }),
  z.object({
    type: z.literal('master.declare-test'),
    sessionId: UuidSchema,
    skillId: UuidSchema,
    cd: z.number().int().positive(),
    mode: z.enum(['open', 'targeted']),
    targetCharacterId: UuidSchema.nullable().optional(),
  }),
  z.object({
    type: z.literal('master.monster-vitals-update'),
    sessionId: UuidSchema,
    monsterId: UuidSchema,
    currentHp: NonNegativeIntSchema,
    currentEffort: NonNegativeIntSchema,
  }),
  z.object({
    type: z.literal('master.monster-attack'),
    sessionId: UuidSchema,
    monsterId: UuidSchema,
    attribute: AttributeSchema,
    targetCharacterId: UuidSchema,
    damage: NonNegativeIntSchema,
  }),
  z.object({ type: z.literal('ping') }),
]);

export type InboundFrame = z.infer<typeof InboundFrameSchema>;

export const ChatMessageWireSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  playerId: z.string().nullable(),
  body: z.string(),
  createdAt: z.string(),
});

export type ChatMessageWire = z.infer<typeof ChatMessageWireSchema>;

export const OutboundEventSchema = z.union([
  z.object({
    type: z.literal('session.state'),
    master: PlayerSummaryWireSchema.nullable(),
    players: z.array(PlayerPresenceWireSchema),
  }),
  z.object({
    type: z.literal('session.player-joined'),
    player: PlayerPresenceWireSchema,
  }),
  z.object({
    type: z.literal('session.player-left'),
    player: PlayerPresenceWireSchema,
  }),
  z.object({
    type: z.literal('presence'),
    master: PlayerSummaryWireSchema.nullable(),
    players: z.array(PlayerPresenceWireSchema),
  }),
  z.object({
    type: z.literal('chat.message'),
    message: ChatMessageWireSchema,
  }),
  z.object({
    type: z.literal('chat.history'),
    messages: z.array(ChatMessageWireSchema),
  }),
  z.object({
    type: z.literal('dice.rolled'),
    playerId: z.string(),
    playerName: z.string(),
    skillId: z.string(),
    attribute: z.string(),
    rolls: z.array(z.number().int()),
    result: z.number().int(),
    kind: z.enum(['best', 'worst', 'single']),
    skillBonus: z.number().int(),
    bExp: z.number().int(),
    total: z.number().int(),
    testId: z.string().optional(),
    cd: z.number().int().optional(),
    success: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('character.hp-changed'),
    characterId: z.string(),
    oldHp: z.number().int(),
    newHp: z.number().int(),
  }),
  z.object({
    type: z.literal('character.pe-changed'),
    characterId: z.string(),
    oldPe: z.number().int(),
    newPe: z.number().int(),
  }),
  z.object({
    type: z.literal('master.narration'),
    playerId: z.string(),
    playerName: z.string(),
    text: z.string(),
    at: z.string(),
  }),
  z.object({
    type: z.literal('session.combat'),
    active: z.boolean(),
    turnIndex: z.number().int(),
    round: z.number().int(),
    entries: z.array(CombatantWireSchema),
  }),
  z.object({
    type: z.literal('session.test-declared'),
    testId: z.string(),
    skillId: z.string(),
    cd: z.number().int(),
    mode: z.enum(['open', 'targeted']),
    targetCharacterId: z.string().nullable(),
    targetName: z.string().nullable(),
  }),
  z.object({
    type: z.literal('session.monster-rolled'),
    monsterId: z.string(),
    name: z.string(),
    attribute: z.string(),
    rolls: z.array(z.number().int()),
    result: z.number().int(),
    kind: z.enum(['best', 'worst', 'single']),
  }),
  z.object({
    type: z.literal('session.monster-vitals'),
    monsterId: z.string(),
    currentHp: z.number().int(),
    maxHp: z.number().int(),
    currentEffort: z.number().int(),
    maxEffort: z.number().int(),
  }),
  z.object({
    type: z.literal('session.monster-attacked'),
    monsterId: z.string(),
    name: z.string(),
    attribute: z.string(),
    targetCharacterId: z.string(),
    targetName: z.string(),
    rolls: z.array(z.number().int()),
    result: z.number().int(),
    kind: z.enum(['best', 'worst', 'single']),
    damage: z.number().int(),
  }),
  z.object({ type: z.literal('pong') }),
  z.object({
    type: z.literal('error'),
    error: z.object({ code: z.string(), message: z.string() }),
  }),
]);

export type OutboundEvent = z.infer<typeof OutboundEventSchema>;
