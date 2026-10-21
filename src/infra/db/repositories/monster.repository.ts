import { eq } from 'drizzle-orm';
import type {
  CreateMonsterInput,
  Monster,
  UpdateMonsterInput,
} from '@modules/bestiary/bestiary.entity.js';
import { MonsterNotFoundError } from '@modules/bestiary/bestiary.errors.js';
import type { MonsterRepository } from '@modules/bestiary/bestiary.repository.js';
import { db } from '../index.js';
import { monster as monsterTable } from '../schema.js';
import { toMonster, toMonsterChanges } from './monster.repository.mappers.js';

const DEFAULT_ATTRIBUTE = -5;

export function monsterRepository(): MonsterRepository {
  return {
    async create(input: CreateMonsterInput): Promise<Monster> {
      const [row] = await db
        .insert(monsterTable)
        .values({
          gameId: input.gameId,
          name: input.name,
          np: input.np,
          maxHp: input.maxHp,
          currentHp: input.currentHp ?? input.maxHp,
          maxEffort: input.maxEffort,
          currentEffort: input.currentEffort ?? input.maxEffort,
          size: input.size ?? null,
          cognition: input.cognition ?? DEFAULT_ATTRIBUTE,
          psyche: input.psyche ?? DEFAULT_ATTRIBUTE,
          instinct: input.instinct ?? DEFAULT_ATTRIBUTE,
          constitution: input.constitution ?? DEFAULT_ATTRIBUTE,
          motricity: input.motricity ?? DEFAULT_ATTRIBUTE,
          perception: input.perception ?? DEFAULT_ATTRIBUTE,
          heightCm: input.heightCm ?? null,
          weightKg: input.weightKg ?? null,
          notes: input.notes ?? null,
          createdBy: input.createdBy,
        })
        .returning();
      if (!row) throw new MonsterNotFoundError();

      return toMonster(row);
    },

    async findById(id: string): Promise<Monster | null> {
      const [row] = await db
        .select()
        .from(monsterTable)
        .where(eq(monsterTable.id, id))
        .limit(1);

      return row ? toMonster(row) : null;
    },

    async findByGame(gameId: string): Promise<Monster[]> {
      const rows = await db
        .select()
        .from(monsterTable)
        .where(eq(monsterTable.gameId, gameId));

      return rows.map(toMonster);
    },

    async save(
      id: string,
      patch: Partial<UpdateMonsterInput>,
    ): Promise<Monster> {
      const [row] = await db
        .update(monsterTable)
        .set(toMonsterChanges(patch))
        .where(eq(monsterTable.id, id))
        .returning();
      if (!row) throw new MonsterNotFoundError();

      return toMonster(row);
    },

    async delete(id: string): Promise<void> {
      await db.delete(monsterTable).where(eq(monsterTable.id, id));
    },
  };
}
