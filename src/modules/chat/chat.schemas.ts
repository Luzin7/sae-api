import { z } from 'zod';

export const MAX_CHAT_BODY_LENGTH = 2000;
export const CHAT_HISTORY_LIMIT = 50;

const UuidSchema = z.string().uuid();
const NonNegativeIntSchema = z.number().int().min(0);

const PlayerSummaryWireSchema = z.object({
  playerId: z.string(),
  name: z.string(),
});

const InitiativeEntrySchema = z.object({
  playerId: UuidSchema,
  playerName: z.string().min(1),
  value: z.number().int(),
});

const InitiativeEntryWireSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  value: z.number().int(),
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
    type: z.literal('master.set-initiative'),
    sessionId: UuidSchema,
    order: z.array(InitiativeEntrySchema),
  }),
  z.object({
    type: z.literal('master.force-hp-update'),
    sessionId: UuidSchema,
    characterId: UuidSchema,
    newHp: NonNegativeIntSchema,
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
    players: z.array(PlayerSummaryWireSchema),
  }),
  z.object({
    type: z.literal('session.player-joined'),
    player: PlayerSummaryWireSchema,
  }),
  z.object({
    type: z.literal('session.player-left'),
    player: PlayerSummaryWireSchema,
  }),
  z.object({
    type: z.literal('presence'),
    players: z.array(PlayerSummaryWireSchema),
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
    type: z.literal('session.initiative'),
    order: z.array(InitiativeEntryWireSchema),
  }),
  z.object({ type: z.literal('pong') }),
  z.object({
    type: z.literal('error'),
    error: z.object({ code: z.string(), message: z.string() }),
  }),
]);

export type OutboundEvent = z.infer<typeof OutboundEventSchema>;
