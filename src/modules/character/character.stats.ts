export type HitDie = 'd6' | 'd8' | 'd10' | 'd12' | 'd20';

const HIT_DIE_MAX: Record<HitDie, number> = {
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
};

/** CON −5..−4→d6, −3..−2→d8, 1..2→d10, 3..4→d12, 5→d20. */
export function hitDie(constitution: number): { die: HitDie; max: number } {
  if (constitution <= -4) return { die: 'd6', max: HIT_DIE_MAX.d6 };
  if (constitution <= -2) return { die: 'd8', max: HIT_DIE_MAX.d8 };
  if (constitution <= 2) return { die: 'd10', max: HIT_DIE_MAX.d10 };
  if (constitution <= 4) return { die: 'd12', max: HIT_DIE_MAX.d12 };

  return { die: 'd20', max: HIT_DIE_MAX.d20 };
}

/** 20 + NP × dieMax + proficiency bonus in Vitalidade. */
export function maxHp(
  np: number,
  constitution: number,
  profVitalidade: number,
): number {
  const { max } = hitDie(constitution);

  return 20 + np * max + profVitalidade;
}

/** 20 + proficiency bonus in Condicionamento. Current effort starts at 0. */
export function maxEffort(profCondicionamento: number): number {
  return 20 + profCondicionamento;
}

export function bExp(np: number): number {
  if (np < 1) return 0;

  return Math.floor(np / 2);
}
