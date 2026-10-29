import type { GameSessionNotifier } from '@shared/game-session/game-session-notifier.contract.js';
import {
  CONDICIONAMENTO,
  maxEffort,
  maxHp,
  VITALIDADE,
} from '@shared/rules/vitals.js';
import { assertAddOnly, increasedSkills } from '../character.advancement.js';
import { assertAttributeBudget } from '../character.attributes.js';
import { requireOwnedCharacter } from '../character.authorization.js';
import { proficiencyBonus } from '../character.derivation.js';
import type {
  AttributeScores,
  Character,
  CharacterSkillDetail,
  SheetChanges,
  UpsertSkillInput,
} from '../character.entity.js';
import type { CharacterRepository } from '../character.repository.js';
import { type CharacterView, withAdvancementOf } from '../character-view.js';
import {
  assertSkillBonusCaps,
  assertSkillPools,
  resolveSkillAllocations,
  type SkillAllocationDetail,
} from '../skills/skill-allocation.js';

export interface AdvanceCharacterCommand {
  version: number;
  attributes: Partial<AttributeScores>;
  skills: UpsertSkillInput[];
}

function mergeAttributes(
  character: Character,
  requested: Partial<AttributeScores>,
): AttributeScores {
  return {
    cognition: requested.cognition ?? character.cognition,
    psyche: requested.psyche ?? character.psyche,
    instinct: requested.instinct ?? character.instinct,
    constitution: requested.constitution ?? character.constitution,
    motricity: requested.motricity ?? character.motricity,
    perception: requested.perception ?? character.perception,
  };
}

function mergeSkills(
  saved: readonly CharacterSkillDetail[],
  raised: readonly SkillAllocationDetail[],
): SkillAllocationDetail[] {
  const untouched = saved.filter(
    (entry) => !raised.some((skill) => skill.skillId === entry.skillId),
  );

  return [...untouched, ...raised];
}

export class AdvanceCharacterService {
  constructor(
    private readonly characters: CharacterRepository,
    private readonly notifier: GameSessionNotifier,
  ) {}

  async execute(
    id: string,
    requesterId: string,
    command: AdvanceCharacterCommand,
  ): Promise<CharacterView> {
    await requireOwnedCharacter(this.characters, id, requesterId);
    const catalog = await resolveSkillAllocations(
      this.characters,
      command.skills,
    );

    const updated = await this.characters.updateSheet({
      id,
      expectedVersion: command.version,
      decide: (current, saved) => this.decide(current, saved, command, catalog),
    });

    await this.notifier.notifyCharacterAdvanced(updated.gameId, {
      characterId: updated.id,
    });

    return withAdvancementOf(this.characters, updated);
  }

  private decide(
    current: Character,
    saved: CharacterSkillDetail[],
    command: AdvanceCharacterCommand,
    catalog: readonly SkillAllocationDetail[],
  ): SheetChanges {
    assertAddOnly(current, saved, command);

    const raised = increasedSkills(saved, command.skills);
    const allocations = catalog.filter((entry) =>
      raised.some((skill) => skill.skillId === entry.skillId),
    );
    const attributes = mergeAttributes(current, command.attributes);
    const skills = mergeSkills(saved, allocations);
    assertAttributeBudget(current.np, attributes);
    assertSkillBonusCaps(current, allocations);
    assertSkillPools(current, current.np, skills);

    return {
      ...attributes,
      skills: raised,
      maxHp: maxHp(
        current.np,
        attributes.constitution,
        proficiencyBonus(skills, VITALIDADE),
      ),
      maxEffort: maxEffort(proficiencyBonus(skills, CONDICIONAMENTO)),
    };
  }
}
