import type { AttributeKey } from '@shared/rules/attributes.js';

/** One persisted row of the skill catalog, exposed with its UUID for allocation. */
export interface SkillCatalogEntry {
  id: string;
  name: string;
  attribute: AttributeKey;
}

/**
 * Consumer-owned, read-only seam for the persisted `skill` catalog. The rules
 * slice resolves ids through this contract instead of importing another slice;
 * the infra adapter is the only place that reads the `skill` table.
 */
export interface SkillCatalog {
  list(): Promise<SkillCatalogEntry[]>;
}
