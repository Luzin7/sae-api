import {
  advancementBalance,
  type AdvancementBalance,
  type SkillSpend,
} from './character.advancement.js';
import type { Character } from './character.entity.js';
import type { CharacterRepository } from './character.repository.js';

export interface CharacterView {
  character: Character;
  advancement: AdvancementBalance;
}

type SkillSpendSource = Pick<CharacterRepository, 'findSkillSpend'>;

function toView(character: Character, spend: SkillSpend[]): CharacterView {
  return { character, advancement: advancementBalance(character, spend) };
}

export async function withAdvancement(
  characters: SkillSpendSource,
  list: readonly Character[],
): Promise<CharacterView[]> {
  if (list.length === 0) return [];

  const spend = await characters.findSkillSpend(list.map(({ id }) => id));

  return list.map((character) =>
    toView(
      character,
      spend.filter((row) => row.characterId === character.id),
    ),
  );
}

export async function withAdvancementOf(
  characters: SkillSpendSource,
  character: Character,
): Promise<CharacterView> {
  return toView(character, await characters.findSkillSpend([character.id]));
}
