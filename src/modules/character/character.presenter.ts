import type { Character } from './character.entity.js';

export interface CharacterResponse {
  id: string;
  playerId: string;
  gameId: string;
  nickname: string;
  epithet: string | null;
  np: number;
  cognition: number;
  psyche: number;
  instinct: number;
  constitution: number;
  motricity: number;
  perception: number;
  cognitionProficiency: string;
  psycheProficiency: string;
  instinctProficiency: string;
  constitutionProficiency: string;
  motricityProficiency: string;
  perceptionProficiency: string;
  maxHp: number;
  maxEffort: number;
  bExp: number;
  currentHp: number;
  currentEffort: number;
  hairColor: string | null;
  heightCm: number | null;
  weightKg: number | null;
  size: string | null;
  background: string | null;
  profession: string | null;
  motivation: string | null;
  afflictions: string[];
  socialClass: string | null;
  vaalaques: number;
  bonds: string[];
  personality: string | null;
  posture: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CharacterPresenter = {
  toHTTP(character: Character): CharacterResponse {
    return {
      id: character.id,
      playerId: character.playerId,
      gameId: character.gameId,
      nickname: character.nickname,
      epithet: character.epithet,
      np: character.np,
      cognition: character.cognition,
      psyche: character.psyche,
      instinct: character.instinct,
      constitution: character.constitution,
      motricity: character.motricity,
      perception: character.perception,
      cognitionProficiency: character.cognitionProficiency,
      psycheProficiency: character.psycheProficiency,
      instinctProficiency: character.instinctProficiency,
      constitutionProficiency: character.constitutionProficiency,
      motricityProficiency: character.motricityProficiency,
      perceptionProficiency: character.perceptionProficiency,
      maxHp: character.maxHp,
      maxEffort: character.maxEffort,
      bExp: character.bExp,
      currentHp: character.currentHp,
      currentEffort: character.currentEffort,
      hairColor: character.hairColor,
      heightCm: character.heightCm,
      weightKg: character.weightKg,
      size: character.size,
      background: character.background,
      profession: character.profession,
      motivation: character.motivation,
      afflictions: character.afflictions,
      socialClass: character.socialClass,
      vaalaques: character.vaalaques,
      bonds: character.bonds,
      personality: character.personality,
      posture: character.posture,
      createdAt: character.createdAt.toISOString(),
      updatedAt: character.updatedAt.toISOString(),
    };
  },
};
