import type {
  Monster,
  UpdateMonsterInput,
} from '@modules/bestiary/bestiary.entity.js';
import { monster as monsterTable } from '../schema.js';

type MonsterRow = typeof monsterTable.$inferSelect;

export function toMonster(row: MonsterRow): Monster {
  return {
    id: row.id,
    gameId: row.gameId,
    name: row.name,
    np: row.np,
    maxHp: row.maxHp,
    currentHp: row.currentHp,
    maxEffort: row.maxEffort,
    size: row.size,
    cognition: row.cognition,
    psyche: row.psyche,
    instinct: row.instinct,
    constitution: row.constitution,
    motricity: row.motricity,
    perception: row.perception,
    heightCm: row.heightCm,
    weightKg: row.weightKg,
    notes: row.notes,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

type MonsterChanges = Partial<typeof monsterTable.$inferInsert>;

const MUTABLE_FIELDS: ReadonlyArray<keyof UpdateMonsterInput> = [
  'name',
  'np',
  'maxHp',
  'currentHp',
  'maxEffort',
  'size',
  'cognition',
  'psyche',
  'instinct',
  'constitution',
  'motricity',
  'perception',
  'heightCm',
  'weightKg',
  'notes',
];

export function toMonsterChanges(
  patch: Partial<UpdateMonsterInput>,
): MonsterChanges {
  const changes: MonsterChanges = {};

  for (const field of MUTABLE_FIELDS) {
    const value = patch[field];
    if (value === undefined) continue;
    (changes as Record<string, unknown>)[field] = value;
  }
  changes.updatedAt = new Date();

  return changes;
}
