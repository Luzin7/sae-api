import { assertAttributeBudget } from '../character.attributes.js';
import { requireOwnedCharacter } from '../character.authorization.js';
import {
  CONDICIONAMENTO,
  deriveProficiencies,
  deriveSize,
  deriveVaalaques,
  proficiencyBonus,
  type Rng,
  VITALIDADE,
} from '../character.derivation.js';
import type {
  AttributeScores,
  Character,
  ProficiencyScores,
  UpdateCharacterInput,
} from '../character.entity.js';
import type { CharacterRepository } from '../character.repository.js';
import { bExp, maxEffort, maxHp } from '../character.stats.js';

function mergeAttributes(
  character: Character,
  input: UpdateCharacterInput,
): AttributeScores {
  return {
    cognition: input.cognition ?? character.cognition,
    psyche: input.psyche ?? character.psyche,
    instinct: input.instinct ?? character.instinct,
    constitution: input.constitution ?? character.constitution,
    motricity: input.motricity ?? character.motricity,
    perception: input.perception ?? character.perception,
  };
}

function resolveProficiencies(
  character: Character,
  input: UpdateCharacterInput,
): ProficiencyScores {
  if (input.personality === undefined && input.posture === undefined) {
    return {
      cognitionProficiency: character.cognitionProficiency,
      psycheProficiency: character.psycheProficiency,
      instinctProficiency: character.instinctProficiency,
      constitutionProficiency: character.constitutionProficiency,
      motricityProficiency: character.motricityProficiency,
      perceptionProficiency: character.perceptionProficiency,
    };
  }

  return deriveProficiencies(
    input.personality ?? character.personality ?? '',
    input.posture ?? character.posture ?? '',
  );
}

function resolveSize(
  character: Character,
  input: UpdateCharacterInput,
): string | null {
  if (input.heightCm === undefined && input.weightKg === undefined) {
    return character.size;
  }

  return deriveSize(
    input.heightCm ?? character.heightCm,
    input.weightKg ?? character.weightKg,
  );
}

function resolveVaalaques(
  character: Character,
  input: UpdateCharacterInput,
  rng: Rng,
): number {
  if (
    input.socialClass === undefined ||
    input.socialClass === character.socialClass
  ) {
    return character.vaalaques;
  }

  return deriveVaalaques(input.socialClass, rng);
}

export class UpdateCharacterService {
  constructor(
    private readonly characters: CharacterRepository,
    private readonly rng: Rng,
  ) {}

  async execute(
    id: string,
    requesterId: string,
    input: UpdateCharacterInput,
  ): Promise<Character> {
    const character = await requireOwnedCharacter(
      this.characters,
      id,
      requesterId,
    );

    const attributes = mergeAttributes(character, input);
    const np = input.np ?? character.np;
    assertAttributeBudget(np, attributes);

    const proficiencies = resolveProficiencies(character, input);
    const skills = await this.characters.findSkillDetails(id);
    const hp = maxHp(
      np,
      attributes.constitution,
      proficiencyBonus(skills, VITALIDADE),
    );
    const effort = maxEffort(proficiencyBonus(skills, CONDICIONAMENTO));

    return this.characters.save(id, {
      ...input,
      np,
      ...attributes,
      ...proficiencies,
      size: resolveSize(character, input),
      vaalaques: resolveVaalaques(character, input, this.rng),
      maxHp: hp,
      maxEffort: effort,
      bExp: bExp(np),
      currentHp: Math.min(character.currentHp, hp),
      currentEffort: Math.min(character.currentEffort, effort),
    });
  }
}
