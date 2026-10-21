import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import { requireReadableCharacter } from '../character.authorization.js';
import type {
  CharacterItem,
  CharacterSkillDetail,
} from '../character.entity.js';
import {
  CharacterPresenter,
  type CharacterResponse,
} from '../character.presenter.js';
import type { CharacterRepository } from '../character.repository.js';

export interface CharacterSheet {
  character: CharacterResponse;
  items: CharacterItem[];
  skills: CharacterSkillDetail[];
}

export class GetSheetService {
  constructor(
    private readonly characters: CharacterRepository,
    private readonly access: GameAccess,
  ) {}

  async execute(id: string, requesterId: string): Promise<CharacterSheet> {
    const character = await requireReadableCharacter(
      this.characters,
      this.access,
      id,
      requesterId,
    );

    const [items, skills] = await Promise.all([
      this.characters.findItems(id),
      this.characters.findSkillDetails(id),
    ]);

    return {
      character: CharacterPresenter.toHTTP(character),
      items,
      skills,
    };
  }
}
