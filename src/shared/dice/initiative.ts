const MAX_FACES = 20;

function firstFreeFace(taken: number[]): number | null {
  for (let face = 1; face <= MAX_FACES; face++) {
    if (!taken.includes(face)) return face;
  }

  return null;
}

export function pickUniqueValue(taken: number[], roll: () => number): number {
  const freeFace = firstFreeFace(taken);
  if (freeFace === null) return roll();

  for (let attempt = 0; attempt < MAX_FACES; attempt++) {
    const value = roll();
    if (!taken.includes(value)) return value;
  }

  return freeFace;
}
