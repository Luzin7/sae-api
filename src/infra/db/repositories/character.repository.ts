import { eq } from 'drizzle-orm';
import type {
  Character,
  CharacterItem,
  CharacterSkill,
  CharacterSkillDetail,
  CreateCharacterInput,
  CreateItemInput,
  Page,
  SkillSummary,
  UpdateCharacterInput,
  UpdateItemInput,
} from '@modules/character/character.entity.js';
import {
  CharacterItemNotFoundError,
  CharacterNotFoundError,
  SkillNotFoundError,
} from '@modules/character/character.errors.js';
import type { CharacterRepository } from '@modules/character/character.repository.js';
import { db } from '../index.js';
import {
  character as characterTable,
  characterItem as characterItemTable,
  characterSkill as characterSkillTable,
  skill as skillTable,
} from '../schema.js';
import {
  toCharacter,
  toCharacterChanges,
  toItem,
  toItemChanges,
  toSkill,
} from './character.repository.mappers.js';

function isForeignKeyViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  return 'code' in error && error.code === '23503';
}

export function characterRepository(): CharacterRepository {
  return {
    async create(input: CreateCharacterInput): Promise<Character> {
      const [row] = await db
        .insert(characterTable)
        .values({
          playerId: input.playerId,
          gameId: input.gameId,
          nickname: input.nickname,
          epithet: input.epithet ?? null,
          np: input.np,
          cognition: input.cognition,
          psyche: input.psyche,
          instinct: input.instinct,
          constitution: input.constitution,
          motricity: input.motricity,
          perception: input.perception,
          cognitionProficiency: input.cognitionProficiency,
          psycheProficiency: input.psycheProficiency,
          instinctProficiency: input.instinctProficiency,
          constitutionProficiency: input.constitutionProficiency,
          motricityProficiency: input.motricityProficiency,
          perceptionProficiency: input.perceptionProficiency,
          maxHp: input.maxHp,
          maxEffort: input.maxEffort,
          bExp: input.bExp,
          currentHp: input.currentHp,
          currentEffort: input.currentEffort,
          hairColor: input.hairColor ?? null,
          heightCm: input.heightCm ?? null,
          weightKg: input.weightKg ?? null,
          size: input.size ?? null,
          background: input.background ?? null,
          profession: input.profession ?? null,
          motivation: input.motivation ?? null,
          affliction: input.affliction ?? null,
          socialClass: input.socialClass,
          vaalaques: input.vaalaques,
          bonds: input.bonds ?? null,
          personality: input.personality,
          posture: input.posture,
        })
        .returning();
      if (!row) throw new CharacterNotFoundError();

      return toCharacter(row);
    },

    async findById(id: string): Promise<Character | null> {
      const [row] = await db
        .select()
        .from(characterTable)
        .where(eq(characterTable.id, id))
        .limit(1);

      return row ? toCharacter(row) : null;
    },

    async findByPlayer(playerId: string, page: Page): Promise<Character[]> {
      const rows = await db
        .select()
        .from(characterTable)
        .where(eq(characterTable.playerId, playerId))
        .limit(page.limit)
        .offset(page.offset);

      return rows.map(toCharacter);
    },

    async findByGame(gameId: string): Promise<Character[]> {
      const rows = await db
        .select()
        .from(characterTable)
        .where(eq(characterTable.gameId, gameId));

      return rows.map(toCharacter);
    },

    async save(
      id: string,
      patch: Partial<UpdateCharacterInput>,
    ): Promise<Character> {
      const [row] = await db
        .update(characterTable)
        .set(toCharacterChanges(patch))
        .where(eq(characterTable.id, id))
        .returning();
      if (!row) throw new CharacterNotFoundError();

      return toCharacter(row);
    },

    async delete(id: string): Promise<void> {
      await db.delete(characterTable).where(eq(characterTable.id, id));
    },

    async findItems(characterId: string): Promise<CharacterItem[]> {
      const rows = await db
        .select()
        .from(characterItemTable)
        .where(eq(characterItemTable.characterId, characterId));

      return rows.map(toItem);
    },

    async findItemById(itemId: string): Promise<CharacterItem | null> {
      const [row] = await db
        .select()
        .from(characterItemTable)
        .where(eq(characterItemTable.id, itemId))
        .limit(1);

      return row ? toItem(row) : null;
    },

    async addItem(
      characterId: string,
      input: CreateItemInput,
    ): Promise<CharacterItem> {
      const [row] = await db
        .insert(characterItemTable)
        .values({
          characterId,
          name: input.name,
          type: input.type,
          slot: input.slot ?? 'backpack',
          equipped: input.equipped ?? false,
          description: input.description ?? null,
          quantity: input.quantity ?? 1,
          attributes: input.attributes ?? null,
        })
        .returning();
      if (!row) throw new CharacterItemNotFoundError();

      return toItem(row);
    },

    async updateItem(
      itemId: string,
      input: UpdateItemInput,
    ): Promise<CharacterItem> {
      const [row] = await db
        .update(characterItemTable)
        .set(toItemChanges(input))
        .where(eq(characterItemTable.id, itemId))
        .returning();
      if (!row) throw new CharacterItemNotFoundError();

      return toItem(row);
    },

    async deleteItem(itemId: string): Promise<void> {
      await db
        .delete(characterItemTable)
        .where(eq(characterItemTable.id, itemId));
    },

    async findSkills(characterId: string): Promise<CharacterSkill[]> {
      const rows = await db
        .select()
        .from(characterSkillTable)
        .where(eq(characterSkillTable.characterId, characterId));

      return rows.map(toSkill);
    },

    async findSkillDetails(
      characterId: string,
    ): Promise<CharacterSkillDetail[]> {
      const rows = await db
        .select({
          id: characterSkillTable.id,
          characterId: characterSkillTable.characterId,
          skillId: characterSkillTable.skillId,
          proficiencyBonus: characterSkillTable.proficiencyBonus,
          skillName: skillTable.name,
          attribute: skillTable.attribute,
        })
        .from(characterSkillTable)
        .innerJoin(skillTable, eq(characterSkillTable.skillId, skillTable.id))
        .where(eq(characterSkillTable.characterId, characterId));

      return rows;
    },

    async findSkillById(skillId: string): Promise<SkillSummary | null> {
      const [row] = await db
        .select({
          id: skillTable.id,
          name: skillTable.name,
          attribute: skillTable.attribute,
        })
        .from(skillTable)
        .where(eq(skillTable.id, skillId))
        .limit(1);

      return row ?? null;
    },

    async upsertSkill(
      characterId: string,
      skillId: string,
      proficiencyBonus: number,
    ): Promise<CharacterSkill> {
      try {
        const [row] = await db
          .insert(characterSkillTable)
          .values({ characterId, skillId, proficiencyBonus })
          .onConflictDoUpdate({
            target: [
              characterSkillTable.characterId,
              characterSkillTable.skillId,
            ],
            set: { proficiencyBonus },
          })
          .returning();
        if (!row) throw new CharacterNotFoundError();

        return toSkill(row);
      } catch (error) {
        if (isForeignKeyViolation(error)) throw new SkillNotFoundError();
        throw error;
      }
    },
  };
}
