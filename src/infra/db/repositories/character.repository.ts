import { and, eq, inArray, sql, sum } from 'drizzle-orm';
import type {
  Character,
  CharacterItem,
  CharacterSkill,
  CharacterSkillDetail,
  CreateCharacterInput,
  CreateCharacterResult,
  CreateItemInput,
  VitalsChangeOutcome,
  Page,
  SkillSpendRow,
  SkillSummary,
  UpdateCharacterInput,
  UpdateItemInput,
  UpdateSheetCommand,
  UpsertSkillCommand,
} from '@modules/character/character.entity.js';
import {
  CharacterItemNotFoundError,
  CharacterNotFoundError,
  CharacterVersionConflictError,
  SkillNotFoundError,
} from '@modules/character/character.errors.js';
import type { CharacterRepository } from '@modules/character/character.repository.js';
import { db } from '../index.js';
import {
  changeLockedCharacterEffort,
  changeLockedCharacterHp,
} from './character-vitals.js';
import { removeCharacterCombatants } from './combat.repository.js';
import { isForeignKeyViolation } from '../pg-errors.js';
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

const SKILL_FOREIGN_KEY = 'character_skill_skill_id_skill_id_fk';
const CHARACTER_FOREIGN_KEY = 'character_skill_character_id_character_id_fk';

const SKILL_DETAIL_COLUMNS = {
  id: characterSkillTable.id,
  characterId: characterSkillTable.characterId,
  skillId: characterSkillTable.skillId,
  proficiencyBonus: characterSkillTable.proficiencyBonus,
  skillName: skillTable.name,
  attribute: skillTable.attribute,
};

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function replayCreate(
  tx: Transaction,
  input: CreateCharacterInput,
): Promise<CreateCharacterResult> {
  const [existing] = await tx
    .select()
    .from(characterTable)
    .where(
      and(
        eq(characterTable.playerId, input.playerId),
        eq(characterTable.clientRequestId, input.clientRequestId),
      ),
    )
    .limit(1);
  if (!existing) throw new CharacterNotFoundError();

  return { character: toCharacter(existing), created: false };
}

export function characterRepository(): CharacterRepository {
  return {
    async create(input: CreateCharacterInput): Promise<CreateCharacterResult> {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(characterTable)
          .values({
            playerId: input.playerId,
            gameId: input.gameId,
            clientRequestId: input.clientRequestId,
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
            afflictions: input.afflictions ?? [],
            socialClass: input.socialClass,
            vaalaques: input.vaalaques,
            bonds: input.bonds ?? [],
            personality: input.personality,
            posture: input.posture,
          })
          .onConflictDoNothing({
            target: [characterTable.playerId, characterTable.clientRequestId],
          })
          .returning();
        if (!row) return replayCreate(tx, input);

        if (input.skills.length > 0) {
          await tx.insert(characterSkillTable).values(
            input.skills.map((skill) => ({
              characterId: row.id,
              skillId: skill.skillId,
              proficiencyBonus: skill.proficiencyBonus,
            })),
          );
        }

        return { character: toCharacter(row), created: true };
      });
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
        .set({
          ...toCharacterChanges(patch),
          version: sql`${characterTable.version} + 1`,
        })
        .where(eq(characterTable.id, id))
        .returning();
      if (!row) throw new CharacterNotFoundError();

      return toCharacter(row);
    },

    async updateSheet(command: UpdateSheetCommand): Promise<Character> {
      return db.transaction(async (tx) => {
        const [locked] = await tx
          .select()
          .from(characterTable)
          .where(eq(characterTable.id, command.id))
          .for('update');
        if (!locked) throw new CharacterNotFoundError();
        if (locked.version !== command.expectedVersion)
          throw new CharacterVersionConflictError();

        const skills = await tx
          .select(SKILL_DETAIL_COLUMNS)
          .from(characterSkillTable)
          .innerJoin(skillTable, eq(characterSkillTable.skillId, skillTable.id))
          .where(eq(characterSkillTable.characterId, command.id))
          .for('update', { of: characterSkillTable });

        const changes = command.decide(toCharacter(locked), skills);
        const [row] = await tx
          .update(characterTable)
          .set({
            ...toCharacterChanges(changes),
            currentHp: sql`LEAST(${characterTable.currentHp}, ${changes.maxHp})`,
            currentEffort: sql`LEAST(${characterTable.currentEffort}, ${changes.maxEffort})`,
            version: sql`${characterTable.version} + 1`,
          })
          .where(
            and(
              eq(characterTable.id, command.id),
              eq(characterTable.version, command.expectedVersion),
            ),
          )
          .returning();
        if (!row) throw new CharacterVersionConflictError();

        return toCharacter(row);
      });
    },

    async changeEffort(
      id: string,
      delta: number,
    ): Promise<VitalsChangeOutcome> {
      const change = await changeLockedCharacterEffort(db, id, delta, null);
      if (!change) throw new CharacterNotFoundError();

      return {
        character: toCharacter(change.row),
        oldEffort: change.oldEffort,
        oldHp: change.oldHp,
      };
    },

    async changeHp(id: string, delta: number): Promise<VitalsChangeOutcome> {
      const change = await changeLockedCharacterHp(db, id, delta, null);
      if (!change) throw new CharacterNotFoundError();

      return {
        character: toCharacter(change.row),
        oldEffort: change.oldEffort,
        oldHp: change.oldHp,
      };
    },

    async delete(id: string): Promise<void> {
      await db.transaction(async (tx) => {
        await removeCharacterCombatants(tx, id);
        await tx.delete(characterTable).where(eq(characterTable.id, id));
      });
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
        .select(SKILL_DETAIL_COLUMNS)
        .from(characterSkillTable)
        .innerJoin(skillTable, eq(characterSkillTable.skillId, skillTable.id))
        .where(eq(characterSkillTable.characterId, characterId));

      return rows;
    },

    async findSkillSpend(
      characterIds: readonly string[],
    ): Promise<SkillSpendRow[]> {
      if (characterIds.length === 0) return [];

      const rows = await db
        .select({
          characterId: characterSkillTable.characterId,
          attribute: skillTable.attribute,
          spent: sum(characterSkillTable.proficiencyBonus).mapWith(Number),
        })
        .from(characterSkillTable)
        .innerJoin(skillTable, eq(characterSkillTable.skillId, skillTable.id))
        .where(inArray(characterSkillTable.characterId, [...characterIds]))
        .groupBy(characterSkillTable.characterId, skillTable.attribute);

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

    async findSkillsByIds(ids: readonly string[]): Promise<SkillSummary[]> {
      return db
        .select({
          id: skillTable.id,
          name: skillTable.name,
          attribute: skillTable.attribute,
        })
        .from(skillTable)
        .where(inArray(skillTable.id, [...ids]));
    },

    async upsertSkill(command: UpsertSkillCommand): Promise<CharacterSkill> {
      const { characterId, skillId, proficiencyBonus } = command;
      try {
        return await db.transaction(async (tx) => {
          const [locked] = await tx
            .select()
            .from(characterTable)
            .where(eq(characterTable.id, characterId))
            .for('update');
          if (!locked) throw new CharacterNotFoundError();

          const [row] = await tx
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

          const skills = await tx
            .select(SKILL_DETAIL_COLUMNS)
            .from(characterSkillTable)
            .innerJoin(
              skillTable,
              eq(characterSkillTable.skillId, skillTable.id),
            )
            .where(eq(characterSkillTable.characterId, characterId));
          const limits = command.deriveLimits(toCharacter(locked), skills);
          if (limits) {
            await tx
              .update(characterTable)
              .set({
                maxHp: limits.maxHp,
                maxEffort: limits.maxEffort,
                currentHp: sql`LEAST(${characterTable.currentHp}, ${limits.maxHp})`,
                currentEffort: sql`LEAST(${characterTable.currentEffort}, ${limits.maxEffort})`,
                version: sql`${characterTable.version} + 1`,
                updatedAt: new Date(),
              })
              .where(eq(characterTable.id, characterId));
          }

          return toSkill(row);
        });
      } catch (error) {
        if (isForeignKeyViolation(error, CHARACTER_FOREIGN_KEY))
          throw new CharacterNotFoundError();
        if (isForeignKeyViolation(error, SKILL_FOREIGN_KEY))
          throw new SkillNotFoundError();
        throw error;
      }
    },
  };
}
