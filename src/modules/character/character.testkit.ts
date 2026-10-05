import { vi } from 'vitest';
import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type {
  Character,
  CharacterItem,
  CharacterSkill,
  CharacterSkillDetail,
  SkillSummary,
} from './character.entity.js';
import type { CharacterRepository } from './character.repository.js';

const DEFAULT_SKILL_ID = '11111111-1111-1111-1111-111111111111';

export function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    playerId: 'player-1',
    gameId: 'game-1',
    nickname: 'Hero',
    epithet: null,
    np: 1,
    cognition: -5,
    psyche: -5,
    instinct: -5,
    constitution: -5,
    motricity: -5,
    perception: -5,
    cognitionProficiency: 'imperito',
    psycheProficiency: 'imperito',
    instinctProficiency: 'imperito',
    constitutionProficiency: 'imperito',
    motricityProficiency: 'imperito',
    perceptionProficiency: 'imperito',
    maxHp: 26,
    maxEffort: 20,
    bExp: 0,
    currentHp: 26,
    currentEffort: 0,
    hairColor: null,
    heightCm: null,
    weightKg: null,
    size: null,
    background: null,
    profession: null,
    motivation: null,
    affliction: null,
    socialClass: 'plebeu',
    vaalaques: 0,
    bonds: null,
    personality: null,
    posture: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

export function makeItem(
  overrides: Partial<CharacterItem> = {},
): CharacterItem {
  return {
    id: 'item-1',
    characterId: 'char-1',
    name: 'Knife',
    type: 'weapon',
    slot: 'backpack',
    equipped: false,
    description: null,
    quantity: 1,
    attributes: null,
    ...overrides,
  };
}

export function makeSkill(
  overrides: Partial<CharacterSkill> = {},
): CharacterSkill {
  return {
    id: 'skill-1',
    characterId: 'char-1',
    skillId: DEFAULT_SKILL_ID,
    proficiencyBonus: 3,
    ...overrides,
  };
}

export function makeSkillDetail(
  overrides: Partial<CharacterSkillDetail> = {},
): CharacterSkillDetail {
  return {
    ...makeSkill(),
    skillName: 'Vitalidade',
    attribute: 'constitution',
    ...overrides,
  };
}

export function makeSkillSummary(
  overrides: Partial<SkillSummary> = {},
): SkillSummary {
  return {
    id: DEFAULT_SKILL_ID,
    name: 'Vitalidade',
    attribute: 'constitution',
    ...overrides,
  };
}

export function makeCharacterRepository(): CharacterRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByPlayer: vi.fn(),
    findByGame: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    findItems: vi.fn(),
    findItemById: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    findSkills: vi.fn(),
    findSkillDetails: vi.fn(),
    findSkillById: vi.fn(),
    upsertSkill: vi.fn(),
  };
}

export function makeMembership(): GameAccess {
  return {
    findById: vi.fn().mockResolvedValue({ id: 'game-1', masterId: 'master-1' }),
    isMember: vi.fn(),
  };
}
