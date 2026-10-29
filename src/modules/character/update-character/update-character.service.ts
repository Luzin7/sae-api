import type { GameAccess } from '@shared/game-access/game-access.contract.js';
import type { GameSessionNotifier } from '@shared/game-session/game-session-notifier.contract.js';
import {
  bExp,
  CONDICIONAMENTO,
  maxEffort,
  maxHp,
  VITALIDADE,
} from '@shared/rules/vitals.js';
import { resolveHeight, resolveWeight } from '../character.appearance.js';
import { assertAttributeBudget } from '../character.attributes.js';
import { requireEditableCharacter } from '../character.authorization.js';
import { assertNpReductionFits } from '../character.np-reduction.js';
import { bondsPatch } from '../character.bonds.js';
import {
  deriveProficiencies,
  deriveSize,
  deriveVaalaques,
  proficiencyBonus,
  type Rng,
} from '../character.derivation.js';
import {
  type AttributeScores,
  type Character,
  type CharacterSkillDetail,
  type ProficiencyScores,
  type SheetChanges,
  type UpdateCharacterInput,
} from '../character.entity.js';
import { NpMasterOnlyError } from '../character.errors.js';
import type { CharacterRepository } from '../character.repository.js';
import { assertSkillPools } from '../skills/skill-allocation.js';

type SheetRequest = Omit<
  UpdateCharacterInput,
  'bonds' | 'currentHp' | 'currentEffort'
> & {
  bonds?: string;
};

export type UpdateCharacterCommand = SheetRequest & { version: number };

function mergeAttributes(
  character: Character,
  input: SheetRequest,
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
  input: SheetRequest,
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
  input: SheetRequest,
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
  input: SheetRequest,
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
    const { isMaster } = await requireEditableCharacter(
      this.characters,
      this.access,
      id,
      requesterId,
    );
    if (input.np !== undefined && !isMaster) throw new NpMasterOnlyError();

    const { version, ...request } = input;
    let oldNp: number | undefined;
    const updated = await this.characters.updateSheet({
      id,
      expectedVersion: version,
      decide: (current, skills) => {
        oldNp = current.np;

        return this.decide(current, skills, request);
      },
    });

    await this.notifier.notifyRosterChanged(updated.gameId);
    if (oldNp === undefined || oldNp === updated.np) return updated;

    await this.notifier.notifyNpChanged(updated.gameId, {
      characterId: updated.id,
      oldNp,
      newNp: updated.np,
    });

    return updated;
  }

  private decide(
    character: Character,
    skills: CharacterSkillDetail[],
    input: SheetRequest,
  ): SheetChanges {
    const attributes = mergeAttributes(character, input);
    const np = input.np ?? character.np;
    const proficiencies = resolveProficiencies(character, input);
    assertNpReductionFits({
      oldNp: character.np,
      newNp: np,
      attributes,
      proficiencies,
      skills,
    });
    assertAttributeBudget(np, attributes);
    assertSkillPools(proficiencies, np, skills);

    const appearance = resolveAppearance(character, input, this.rng);
    const { bonds, ...patch } = input;

    return {
      ...patch,
      ...bondsPatch(bonds),
      np,
      ...attributes,
      ...proficiencies,
      heightCm: appearance.heightCm ?? undefined,
      weightKg: appearance.weightKg ?? undefined,
      size: resolveSize(appearance.heightCm, appearance.weightKg),
      vaalaques: resolveVaalaques(character, input, this.rng),
      maxHp: maxHp(
        np,
        attributes.constitution,
        proficiencyBonus(skills, VITALIDADE),
      ),
      maxEffort: maxEffort(proficiencyBonus(skills, CONDICIONAMENTO)),
      bExp: bExp(np),
    };
  }
}
