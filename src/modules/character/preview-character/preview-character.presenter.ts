import type { CharacterPreview } from './preview-character.service.js';

export type CharacterPreviewResponse = CharacterPreview;

export class CharacterPreviewPresenter {
  static toHTTP(preview: CharacterPreview): CharacterPreviewResponse {
    return {
      hitDie: preview.hitDie,
      maxHp: preview.maxHp,
      maxEffort: preview.maxEffort,
      bExp: preview.bExp,
      proficiencyLevels: preview.proficiencyLevels,
      skillBudget: preview.skillBudget,
      attributePoints: preview.attributePoints,
      size: preview.size,
      heightFactor: preview.heightFactor,
      weightFactor: preview.weightFactor,
      startingWealth: preview.startingWealth,
    };
  }
}
