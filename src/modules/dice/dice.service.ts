import { rollAttribute } from '../character/character.stats.js';
import type { DiceRollBody, DiceRollResponse } from './dice.schemas.js';

export class DiceService {
  roll(body: DiceRollBody): DiceRollResponse {
    const { rolls, result, kind } = rollAttribute(body.attrValue);
    const total = result + body.skillBonus + body.bExp;

    return {
      attribute: body.attribute,
      rolls,
      result,
      kind,
      skillBonus: body.skillBonus,
      bExp: body.bExp,
      total,
    };
  }
}
