import type { Monster } from './bestiary.entity.js';

export interface MonsterResponse {
  id: string;
  gameId: string | null;
  name: string;
  np: number;
  maxHp: number;
  currentHp: number;
  maxEffort: number;
  currentEffort: number;
  size: string | null;
  cognition: number;
  psyche: number;
  instinct: number;
  constitution: number;
  motricity: number;
  perception: number;
  heightCm: number | null;
  weightKg: number | null;
  notes: string | null;
  ownerId: string;
  /** @deprecated alias of `ownerId`, kept for the web client. */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const BestiaryPresenter = {
  toHTTP(monster: Monster): MonsterResponse {
    return {
      id: monster.id,
      gameId: monster.gameId,
      name: monster.name,
      np: monster.np,
      maxHp: monster.maxHp,
      currentHp: monster.currentHp,
      maxEffort: monster.maxEffort,
      currentEffort: monster.currentEffort,
      size: monster.size,
      cognition: monster.cognition,
      psyche: monster.psyche,
      instinct: monster.instinct,
      constitution: monster.constitution,
      motricity: monster.motricity,
      perception: monster.perception,
      heightCm: monster.heightCm,
      weightKg: monster.weightKg,
      notes: monster.notes,
      ownerId: monster.createdBy,
      createdBy: monster.createdBy,
      createdAt: monster.createdAt.toISOString(),
      updatedAt: monster.updatedAt.toISOString(),
    };
  },
};
