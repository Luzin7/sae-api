import type { FastifyInstance } from 'fastify';
import { authenticate } from '@infra/http/authenticate.js';
import { attributeBudget } from '@shared/rules/attributes.js';
import {
  AFFLICTIONS,
  ATTRIBUTES,
  ATTRIBUTE_COST,
  ATTRIBUTE_SCALE,
  DIFFICULTY_CLASSES,
  ESPECIALISTA_SKILL_CAP,
  HAIR_COLOR_BANDS,
  HEIGHT_FACTORS,
  MOTIVATIONS,
  OFICIO_CD_REDUCTION,
  OFICIOS,
  PERSONALITIES,
  POSTURES,
  PROFICIENCY_LEVELS,
  PROFICIENCY_SKILL_CAP,
  SIZE_CATEGORIES,
  SOCIAL_CLASSES,
  SOCIAL_DISTANCE_MODIFIERS,
  WEIGHT_FACTORS,
} from '@shared/rules/index.js';
import type { SkillCatalog } from './skill-catalog.contract.js';

const MAX_NP = 20;
/** Index 0 is unused; index NP holds the attribute budget for that NP. */
const ATTRIBUTE_BUDGET_BY_NP: readonly number[] = [
  0,
  ...Array.from({ length: MAX_NP }, (_, index) => attributeBudget(index + 1)),
];

export interface RulesRoutesOptions {
  skillCatalog: SkillCatalog;
}

/**
 * Read-only catalog of the rulebook tables. Constants come from `@shared/rules`;
 * only `skillCatalog` is read from the DB so it can carry the persisted ids.
 */
export default async function rulesRoutes(
  app: FastifyInstance,
  opts: RulesRoutesOptions,
) {
  app.get('/rules', { preHandler: authenticate }, async () => ({
    attributes: ATTRIBUTES,
    attributeScale: ATTRIBUTE_SCALE,
    attributeCost: ATTRIBUTE_COST,
    attributeBudgetByNp: ATTRIBUTE_BUDGET_BY_NP,
    skillCatalog: await opts.skillCatalog.list(),
    proficiencyLevels: PROFICIENCY_LEVELS,
    proficiencySkillCap: PROFICIENCY_SKILL_CAP,
    especialistaSkillCap: ESPECIALISTA_SKILL_CAP,
    personalities: PERSONALITIES,
    postures: POSTURES,
    proficiencyByArchetype: {
      personalities: PERSONALITIES,
      postures: POSTURES,
    },
    oficios: OFICIOS,
    oficioCdReduction: OFICIO_CD_REDUCTION,
    socialClasses: SOCIAL_CLASSES,
    socialDistanceModifiers: SOCIAL_DISTANCE_MODIFIERS,
    difficultyClasses: DIFFICULTY_CLASSES,
    heightFactors: HEIGHT_FACTORS,
    weightFactors: WEIGHT_FACTORS,
    sizeCategories: SIZE_CATEGORIES,
    hairColorBands: HAIR_COLOR_BANDS,
    motivations: MOTIVATIONS,
    afflictions: AFFLICTIONS,
  }));
}
