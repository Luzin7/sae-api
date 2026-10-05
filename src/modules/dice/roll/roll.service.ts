import { rollAttribute, type Rng } from '@shared/dice/roll.js';
import type { RollInput, RollResult } from '../dice.schemas.js';

export class RollService {
  constructor(private readonly rng: Rng) {}

  execute(input: RollInput): RollResult {
    const { rolls, result, kind } = rollAttribute(input.attrValue, this.rng);
    const total = result + input.skillBonus + input.bExp;

    return {
      attribute: input.attribute,
      rolls,
      result,
      kind,
      skillBonus: input.skillBonus,
      bExp: input.bExp,
      total,
    };
  }
}
