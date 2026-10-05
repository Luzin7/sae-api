import { z } from 'zod';
import type {
  Character,
  CharacterItem,
  CharacterSkill,
  UpdateCharacterInput,
  UpdateItemInput,
} from '@modules/character/character.entity.js';
import {
  character as characterTable,
  characterItem as characterItemTable,
  characterSkill as characterSkillTable,
} from '../schema.js';

type CharacterRow = typeof characterTable.$inferSelect;
type CharacterItemRow = typeof characterItemTable.$inferSelect;
type CharacterSkillRow = typeof characterSkillTable.$inferSelect;

const ItemAttributesSchema = z.record(z.number());

export function toCharacter(row: CharacterRow): Character {
  return {
    id: row.id,
    playerId: row.playerId,
    gameId: row.gameId,
    nickname: row.nickname,
    epithet: row.epithet,
    np: row.np,
    cognition: row.cognition,
    psyche: row.psyche,
    instinct: row.instinct,
    constitution: row.constitution,
    motricity: row.motricity,
    perception: row.perception,
    cognitionProficiency: row.cognitionProficiency,
    psycheProficiency: row.psycheProficiency,
    instinctProficiency: row.instinctProficiency,
    constitutionProficiency: row.constitutionProficiency,
    motricityProficiency: row.motricityProficiency,
    perceptionProficiency: row.perceptionProficiency,
    maxHp: row.maxHp,
    maxEffort: row.maxEffort,
    bExp: row.bExp,
    currentHp: row.currentHp,
    currentEffort: row.currentEffort,
    hairColor: row.hairColor,
    heightCm: row.heightCm,
    weightKg: row.weightKg,
    size: row.size,
    background: row.background,
    profession: row.profession,
    motivation: row.motivation,
    affliction: row.affliction,
    socialClass: row.socialClass,
    vaalaques: row.vaalaques,
    bonds: row.bonds,
    personality: row.personality,
    posture: row.posture,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toItem(row: CharacterItemRow): CharacterItem {
  return {
    id: row.id,
    characterId: row.characterId,
    name: row.name,
    type: row.type,
    slot: row.slot,
    equipped: row.equipped,
    description: row.description,
    quantity: row.quantity,
    attributes:
      row.attributes === null
        ? null
        : ItemAttributesSchema.parse(row.attributes),
  };
}

export function toSkill(row: CharacterSkillRow): CharacterSkill {
  return {
    id: row.id,
    characterId: row.characterId,
    skillId: row.skillId,
    proficiencyBonus: row.proficiencyBonus,
  };
}

export function toCharacterChanges(
  patch: Partial<UpdateCharacterInput>,
): Partial<typeof characterTable.$inferInsert> {
  const changes: Partial<typeof characterTable.$inferInsert> = {};
  if (patch.nickname !== undefined) changes.nickname = patch.nickname;
  if (patch.epithet !== undefined) changes.epithet = patch.epithet;
  if (patch.np !== undefined) changes.np = patch.np;
  if (patch.cognition !== undefined) changes.cognition = patch.cognition;
  if (patch.psyche !== undefined) changes.psyche = patch.psyche;
  if (patch.instinct !== undefined) changes.instinct = patch.instinct;
  if (patch.constitution !== undefined)
    changes.constitution = patch.constitution;
  if (patch.motricity !== undefined) changes.motricity = patch.motricity;
  if (patch.perception !== undefined) changes.perception = patch.perception;
  if (patch.cognitionProficiency !== undefined) {
    changes.cognitionProficiency = patch.cognitionProficiency;
  }
  if (patch.psycheProficiency !== undefined) {
    changes.psycheProficiency = patch.psycheProficiency;
  }
  if (patch.instinctProficiency !== undefined) {
    changes.instinctProficiency = patch.instinctProficiency;
  }
  if (patch.constitutionProficiency !== undefined) {
    changes.constitutionProficiency = patch.constitutionProficiency;
  }
  if (patch.motricityProficiency !== undefined) {
    changes.motricityProficiency = patch.motricityProficiency;
  }
  if (patch.perceptionProficiency !== undefined) {
    changes.perceptionProficiency = patch.perceptionProficiency;
  }
  if (patch.maxHp !== undefined) changes.maxHp = patch.maxHp;
  if (patch.maxEffort !== undefined) changes.maxEffort = patch.maxEffort;
  if (patch.bExp !== undefined) changes.bExp = patch.bExp;
  if (patch.currentHp !== undefined) changes.currentHp = patch.currentHp;
  if (patch.currentEffort !== undefined)
    changes.currentEffort = patch.currentEffort;
  if (patch.hairColor !== undefined) changes.hairColor = patch.hairColor;
  if (patch.heightCm !== undefined) changes.heightCm = patch.heightCm;
  if (patch.weightKg !== undefined) changes.weightKg = patch.weightKg;
  if (patch.size !== undefined) changes.size = patch.size;
  if (patch.background !== undefined) changes.background = patch.background;
  if (patch.profession !== undefined) changes.profession = patch.profession;
  if (patch.motivation !== undefined) changes.motivation = patch.motivation;
  if (patch.affliction !== undefined) changes.affliction = patch.affliction;
  if (patch.socialClass !== undefined) changes.socialClass = patch.socialClass;
  if (patch.vaalaques !== undefined) changes.vaalaques = patch.vaalaques;
  if (patch.bonds !== undefined) changes.bonds = patch.bonds;
  if (patch.personality !== undefined) changes.personality = patch.personality;
  if (patch.posture !== undefined) changes.posture = patch.posture;
  changes.updatedAt = new Date();

  return changes;
}

export function toItemChanges(
  patch: UpdateItemInput,
): Partial<typeof characterItemTable.$inferInsert> {
  const changes: Partial<typeof characterItemTable.$inferInsert> = {};
  if (patch.name !== undefined) changes.name = patch.name;
  if (patch.type !== undefined) changes.type = patch.type;
  if (patch.slot !== undefined) changes.slot = patch.slot;
  if (patch.equipped !== undefined) changes.equipped = patch.equipped;
  if (patch.description !== undefined) changes.description = patch.description;
  if (patch.quantity !== undefined) changes.quantity = patch.quantity;
  if (patch.attributes !== undefined) changes.attributes = patch.attributes;

  return changes;
}
