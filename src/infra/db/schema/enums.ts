import { pgEnum } from 'drizzle-orm/pg-core';

export const proficiencyLevelEnum = pgEnum('proficiency_level', [
  'imperito',
  'competente',
  'versado',
  'especialista',
]);

export const socialClassEnum = pgEnum('social_class', [
  'opulento',
  'abastado',
  'plebeu',
  'miseravel',
]);

export const itemTypeEnum = pgEnum('item_type', [
  'weapon',
  'armor',
  'overlay',
  'coating',
  'accessory',
  'consumable',
  'misc',
]);

export const itemSlotEnum = pgEnum('item_slot', [
  'head',
  'torso',
  'arms',
  'hands',
  'legs',
  'feet',
  'ring_1',
  'ring_2',
  'external',
  'backpack',
]);

export const eventTypeEnum = pgEnum('event_type', [
  'dice_roll',
  'hp_change',
  'pe_change',
  'chat',
  'player_join',
  'player_leave',
  'master_broadcast',
  'initiative',
]);

export const attributeEnum = pgEnum('attribute', [
  'cognition',
  'psyche',
  'instinct',
  'constitution',
  'motricity',
  'perception',
]);
