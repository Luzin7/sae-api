import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { GameSessionNotifier } from '@shared/game-session/game-session-notifier.contract.js';
import { resolveHeight, resolveWeight } from '../character.appearance.js';
import { assertAttributeBudget } from '../character.attributes.js';
import { requireEditableCharacter } from '../character.authorization.js';
import { bondsPatch } from '../character.bonds.js';
import {
  CONDICIONAMENTO,
  deriveProficiencies,
  deriveSize,
  deriveVaalaques,
  proficiencyBonus,
  type Rng,
  VITALIDADE,
} from '../character.derivation.js';
import {
  type AttributeScores,
  type Character,
  type ProficiencyScores,
  type UpdateCharacterInput,
} from '../character.entity.js';
import { NpMasterOnlyError } from '../character.errors.js';
import type { CharacterRepository } from '../character.repository.js';
import { bExp, maxEffort, maxHp } from '../character.stats.js';
import { assertSkillPools } from '../skills/skill-allocation.js';

export type UpdateCharacterCommand = Omit<UpdateCharacterInput, 'bonds'> & {
  bonds?: string;
};

function mergeAttributes(
  character: Character,
  input: UpdateCharacterCommand,
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
  input: UpdateCharacterCommand,
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

function resolveAppearance(
  character: Character,
  input: UpdateCharacterCommand,
  rng: Rng,
): { heightCm: number | null; weightKg: number | null } {
  const hasHeight =
    input.heightCm !== undefined || input.heightRoll !== undefined;
  const hasWeight =
    input.weightKg !== undefined || input.weightRoll !== undefined;

  if (!hasHeight && !hasWeight) {
    return { heightCm: character.heightCm, weightKg: character.weightKg };
  }

  return {
    heightCm: hasHeight ? resolveHeight(input, rng) : character.heightCm,
    weightKg: hasWeight ? resolveWeight(input, rng) : character.weightKg,
  };
}

function resolveSize(
  heightCm: number | null,
  weightKg: number | null,
): string | null {
  return deriveSize(heightCm, weightKg);
}

function resolveVaalaques(
  character: Character,
  input: UpdateCharacterCommand,
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
    private readonly access: GameAccess,
    private readonly rng: Rng,
    private readonly notifier: GameSessionNotifier,
  ) {}

  async execute(
    id: string,
    requesterId: string,
    input: UpdateCharacterCommand,
  ): Promise<Character> {
    const { character, isMaster } = await requireEditableCharacter(
      this.characters,
      this.access,
      id,
      requesterId,
    );
    if (input.np !== undefined && !isMaster) throw new NpMasterOnlyError();

    const attributes = mergeAttributes(character, input);
    const np = input.np ?? character.np;
    assertAttributeBudget(np, attributes);

    const proficiencies = resolveProficiencies(character, input);
    const skills = await this.characters.findSkillDetails(id);
    assertSkillPools(proficiencies, np, skills);

    const hp = maxHp(
      np,
      attributes.constitution,
      proficiencyBonus(skills, VITALIDADE),
    );
    const effort = maxEffort(proficiencyBonus(skills, CONDICIONAMENTO));
    const appearance = resolveAppearance(character, input, this.rng);

    const { bonds, ...patch } = input;
    const updated = await this.characters.save(id, {
      ...patch,
      ...bondsPatch(bonds),
      np,
      ...attributes,
      ...proficiencies,
      heightCm: appearance.heightCm ?? undefined,
      weightKg: appearance.weightKg ?? undefined,
      size: resolveSize(appearance.heightCm, appearance.weightKg),
      vaalaques: resolveVaalaques(character, input, this.rng),
      maxHp: hp,
      maxEffort: effort,
      bExp: bExp(np),
      currentHp: Math.min(character.currentHp, hp),
      currentEffort: Math.min(character.currentEffort, effort),
    });

    await this.notifier.notifyRosterChanged(updated.gameId);

    return updated;
  }
}
