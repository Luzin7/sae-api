import type { AttributeValue } from '../rules/attributes.js';

export const ATTRIBUTE_DIE_SIDES = 20;

export type AttributeDiceKeep = 'best' | 'worst';

export interface AttributeDice {
  dice: number;
  keep: AttributeDiceKeep;
}

export interface AttributeDiceRule {
  dice: number;
  keep: AttributeDiceKeep | 'single';
}

/** Positive value rolls |value| dice keeping the best; negative keeps the worst; 0 rolls one die. */
export function attributeDiceRule(attrValue: number): AttributeDiceRule {
  if (attrValue === 0) return { dice: 1, keep: 'single' };
  if (attrValue > 0) return { dice: attrValue, keep: 'best' };

  return { dice: -attrValue, keep: 'worst' };
}

/** Dice rule for a value on the attribute scale, which excludes 0. */
export function scaleAttributeDice(value: AttributeValue): AttributeDice {
  if (value > 0) return { dice: value, keep: 'best' };

  return { dice: -value, keep: 'worst' };
}
