import type { SizeCategoryKey } from '@shared/rules/size.js';
export interface Monster {
  id: string;
  gameId: string | null;
  name: string;
  np: number;
  maxHp: number;
  currentHp: number;
  maxEffort: number;
  size: SizeCategoryKey | null;
  cognition: number;
  psyche: number;
  instinct: number;
  constitution: number;
  motricity: number;
  perception: number;
  heightCm: number | null;
  weightKg: number | null;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MonsterSheetInput {
  name: string;
  np: number;
  maxHp: number;
  maxEffort: number;
  currentHp?: number;
  size?: SizeCategoryKey | null;
  cognition?: number;
  psyche?: number;
  instinct?: number;
  constitution?: number;
  motricity?: number;
  perception?: number;
  heightCm?: number | null;
  weightKg?: number | null;
  notes?: string | null;
}

export interface CreateMonsterInput extends MonsterSheetInput {
  gameId?: string | null;
  createdBy: string;
  clientRequestId: string;
}

export type UpdateMonsterInput = Partial<MonsterSheetInput>;
