import { SkillCatalogEmptyError } from '../character.errors.js';
import type { SkillSummary } from '../character.entity.js';
import type { CharacterRepository } from '../character.repository.js';

export type SkillLoader = () => Promise<readonly SkillSummary[]>;

export class MemoizedSkillDirectory implements Pick<
  CharacterRepository,
  'findSkillsByIds'
> {
  private loaded: Promise<ReadonlyMap<string, SkillSummary>> | null = null;

  constructor(private readonly loadSkills: SkillLoader) {}

  async findSkillsByIds(ids: readonly string[]): Promise<SkillSummary[]> {
    const byId = await this.load();

    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  private load(): Promise<ReadonlyMap<string, SkillSummary>> {
    if (this.loaded) return this.loaded;

    const pending = this.loadSkills().then((skills) => {
      if (skills.length === 0) throw new SkillCatalogEmptyError();

      return new Map(skills.map((entry) => [entry.id, entry]));
    });
    this.loaded = pending;
    pending.catch(() => {
      if (this.loaded === pending) this.loaded = null;
    });

    return pending;
  }
}
