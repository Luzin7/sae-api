import { asc } from 'drizzle-orm';
import type { SkillCatalog } from '@modules/rules/skill-catalog.contract.js';
import { db } from '../index.js';
import { skill } from '../schema.js';

export function skillCatalogRepository(): SkillCatalog {
  return {
    async list() {
      return db
        .select({ id: skill.id, name: skill.name, attribute: skill.attribute })
        .from(skill)
        .orderBy(asc(skill.name));
    },
  };
}
