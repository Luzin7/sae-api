import {
  ATTRIBUTE_NAMES,
  ATTRIBUTE_SCALE,
  attributeBudget,
  type AttributeKey,
} from '@shared/rules/attributes.js';
import {
  proficiencyPool,
  type ProficiencyLevel,
} from '@shared/rules/proficiency.js';
import {
  bExp,
  CONDICIONAMENTO,
  hitDie,
  type HitDie,
  maxEffort,
  maxHp,
  VITALIDADE,
} from '@shared/rules/vitals.js';
import {
  startingWealthRange,
  type WealthRange,
} from '@shared/rules/social-classes.js';
import { attributePointsSpent } from '../character.attributes.js';
import type { PreviewCharacterBody } from '../character.schemas.js';
import {
  deriveProficiencies,
  derivePreviewSizeDetail,
  proficiencyBonus,
  type SizeDetail,
} from '../character.derivation.js';
import type { AttributeScores } from '../character.entity.js';
import type { CharacterRepository } from '../character.repository.js';
import { proficiencyLevelFor } from '../skills/proficiency-field.js';
import { resolveSkillAllocations } from '../skills/skill-allocation.js';

export type PerAttribute<T> = Record<AttributeKey, T>;

export interface AttributePointsPreview {
  budget: number;
  spent: number;
  remaining: number;
}

export interface CharacterPreview {
  hitDie: HitDie | null;
  maxHp: number | null;
  maxEffort: number;
  bExp: number;
  proficiencyLevels: PerAttribute<ProficiencyLevel> | null;
  skillBudget: PerAttribute<number> | null;
  attributePoints: AttributePointsPreview;
  size: SizeDetail | null;
  startingWealth: WealthRange | null;
}

const ATTRIBUTE_FLOOR = ATTRIBUTE_SCALE[0];

export class PreviewCharacterService {
  constructor(
    private readonly characters: Pick<CharacterRepository, 'findSkillsByIds'>,
  ) {}

  async execute(input: PreviewCharacterBody): Promise<CharacterPreview> {
    const allocations = await resolveSkillAllocations(
      this.characters,
      input.skills ?? [],
    );
    const proficiencyLevels = this.proficiencyLevels(input);

    return {
      hitDie:
        input.constitution === undefined
          ? null
          : hitDie(input.constitution).die,
      maxHp:
        input.constitution === undefined
          ? null
          : maxHp(
              input.np,
              input.constitution,
              proficiencyBonus(allocations, VITALIDADE),
            ),
      maxEffort: maxEffort(proficiencyBonus(allocations, CONDICIONAMENTO)),
      bExp: bExp(input.np),
      proficiencyLevels,
      skillBudget:
        proficiencyLevels && this.skillBudget(proficiencyLevels, input.np),
      attributePoints: this.attributePoints(input),
      size: derivePreviewSizeDetail(input),
      startingWealth: input.socialClass
        ? startingWealthRange(input.socialClass)
        : null,
    };
  }

  private proficiencyLevels(
    input: PreviewCharacterBody,
  ): PerAttribute<ProficiencyLevel> | null {
    if (!input.personality || !input.posture) return null;

    const scores = deriveProficiencies(input.personality, input.posture);

    return Object.fromEntries(
      ATTRIBUTE_NAMES.map((name) => [name, proficiencyLevelFor(scores, name)]),
    ) as PerAttribute<ProficiencyLevel>;
  }

  private skillBudget(
    levels: PerAttribute<ProficiencyLevel>,
    np: number,
  ): PerAttribute<number> {
    return Object.fromEntries(
      ATTRIBUTE_NAMES.map((name) => [name, proficiencyPool(levels[name], np)]),
    ) as PerAttribute<number>;
  }

  private attributePoints(input: PreviewCharacterBody): AttributePointsPreview {
    const scores = Object.fromEntries(
      ATTRIBUTE_NAMES.map((name) => [name, input[name] ?? ATTRIBUTE_FLOOR]),
    ) as unknown as AttributeScores;
    const budget = attributeBudget(input.np);
    const spent = attributePointsSpent(scores);

    return { budget, spent, remaining: budget - spent };
  }
}
