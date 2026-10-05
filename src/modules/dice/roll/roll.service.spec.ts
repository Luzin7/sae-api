import { describe, it, expect } from 'vitest';
import type { Rng } from '@shared/dice/roll.js';
import { RollService } from './roll.service.js';

const fixedRng: Rng = (min, max) => max;
const service = new RollService(fixedRng);

describe('RollService.execute', () => {
  it('total equals result + skillBonus + bExp', () => {
    const result = service.execute({
      attribute: 'COG',
      attrValue: 1,
      skillBonus: 3,
      bExp: 2,
    });

    expect(result.total).toBe(result.result + 3 + 2);
  });

  it('includes the attribute in the response', () => {
    const result = service.execute({
      attribute: 'PSI',
      attrValue: 1,
      skillBonus: 0,
      bExp: 0,
    });

    expect(result.attribute).toBe('PSI');
  });

  it('rolls qty = |attrValue| + 1 dice and picks the best for a positive attribute', () => {
    const result = service.execute({
      attribute: 'CON',
      attrValue: 2,
      skillBonus: 0,
      bExp: 0,
    });

    expect(result.rolls).toHaveLength(3);
    expect(result.kind).toBe('best');
  });

  it('picks the worst roll for a negative attribute', () => {
    const result = service.execute({
      attribute: 'MOT',
      attrValue: -2,
      skillBonus: 1,
      bExp: 3,
    });

    expect(result.total).toBe(result.result + 1 + 3);
    expect(result.kind).toBe('worst');
  });
});
