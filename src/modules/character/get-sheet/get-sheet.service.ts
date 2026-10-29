import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import { requireReadableCharacter } from '../character.authorization.js';
import type {
  CharacterItem,
  CharacterSkillDetail,
} from '../character.entity.js';
import {
  CharacterPresenter,
  type CharacterReadResponse,
} from '../character.presenter.js';
import type { CharacterRepository } from '../character.repository.js';
import { withAdvancementOf } from '../character-view.js';

export interface CharacterSheet {
  character: CharacterReadResponse;
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

    const [items, skills, view] = await Promise.all([
      this.characters.findItems(id),
      this.characters.findSkillDetails(id),
      withAdvancementOf(this.characters, character),
    ]);

    return {
      character: CharacterPresenter.toReadHTTP(view),
      items,
      skills,
    };
  }
}
