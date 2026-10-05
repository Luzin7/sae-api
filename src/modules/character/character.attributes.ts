import type { AttributeValue } from '@shared/rules/attributes.js';
import {
  ATTRIBUTE_SCALE,
  attributeBudget,
  attributeCost,
} from '@shared/rules/attributes.js';
import {
  AttributeBudgetExceededError,
  InvalidAttributeError,
} from './character.errors.js';
import { ATTRIBUTE_NAMES, type AttributeScores } from './character.entity.js';

export { attributeBudget };

const VALID_VALUES: ReadonlySet<number> = new Set<number>(ATTRIBUTE_SCALE);

export function isAttributeValue(value: number): value is AttributeValue {
  return VALID_VALUES.has(value);
}

/** Rejects -1/0 and anything outside the [-5,-4,-3,-2,1,2,3,4,5] scale. */
export function assertValidAttributes(attributes: AttributeScores): void {
  for (const name of ATTRIBUTE_NAMES) {
    const value = attributes[name];
    if (!isAttributeValue(value)) throw new InvalidAttributeError(name, value);
  }
}

export function attributePointsSpent(attributes: AttributeScores): number {
  return ATTRIBUTE_NAMES.reduce((total, name) => {
    const value = attributes[name];
    if (!isAttributeValue(value)) throw new InvalidAttributeError(name, value);

    return total + attributeCost(value);
  }, 0);
}

export function assertAttributeBudget(
  np: number,
  attributes: AttributeScores,
): void {
  if (attributePointsSpent(attributes) > attributeBudget(np)) {
    throw new AttributeBudgetExceededError();
  }
}
