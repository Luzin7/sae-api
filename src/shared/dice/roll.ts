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
  const qty = Math.abs(attrValue) + 1;
  const rolls = Array.from({ length: qty }, () => rollDie(20, rng));

  if (attrValue > 0) return { rolls, result: Math.max(...rolls), kind: 'best' };
  if (attrValue < 0) return { rolls, result: Math.min(...rolls), kind: 'worst' };
  return { rolls, result: rolls[0]!, kind: 'single' };
}

export function rollWithModifiers(
  input: { attrValue: number; bonuses: number[] },
  rng: Rng,
): number {
  const { result } = rollAttribute(input.attrValue, rng);
  const bonus = input.bonuses.reduce((sum, value) => sum + value, 0);

  return result + bonus;
}
