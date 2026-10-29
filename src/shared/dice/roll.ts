import { ATTRIBUTE_DIE_SIDES, attributeDiceRule } from './attribute-dice.js';

export type RollKind = 'best' | 'worst' | 'single';

export interface AttributeRoll {
  rolls: number[];
  result: number;
  kind: RollKind;
}

export type Rng = (min: number, max: number) => number;

export function rollDie(sides: number, rng: Rng): number {
  return rng(1, sides);
}

export function rollAttribute(attrValue: number, rng: Rng): AttributeRoll {
  const { dice, keep } = attributeDiceRule(attrValue);
  const rolls = Array.from({ length: dice }, () =>
    rollDie(ATTRIBUTE_DIE_SIDES, rng),
  );

  if (keep === 'best') return { rolls, result: Math.max(...rolls), kind: keep };
  if (keep === 'worst')
    return { rolls, result: Math.min(...rolls), kind: keep };
  return { rolls, result: rolls[0]!, kind: keep };
}

export function rollWithModifiers(
  input: { attrValue: number; bonuses: number[] },
  rng: Rng,
): number {
  const { result } = rollAttribute(input.attrValue, rng);
  const bonus = input.bonuses.reduce((sum, value) => sum + value, 0);

  return result + bonus;
}
