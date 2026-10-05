export interface HairColorBand {
  min: number;
  max: number;
  color: string;
}

/** Hair color is a d20 roll; the server rolls, /rules only serves the bands. */
export const HAIR_COLOR_BANDS: readonly HairColorBand[] = [
  { min: 1, max: 4, color: 'Preto' },
  { min: 5, max: 8, color: 'Verde/Azul' },
  { min: 9, max: 12, color: 'Amarelo' },
  { min: 13, max: 17, color: 'Terrosos (Laranja/Castanho)' },
  { min: 18, max: 19, color: 'Rosa/Roxo' },
  { min: 20, max: 20, color: 'Vermelho Escarlate' },
];

export function hairColorForRoll(roll: number): string | null {
  const band = HAIR_COLOR_BANDS.find(
    (entry) => roll >= entry.min && roll <= entry.max,
  );
  if (!band) return null;
  return band.color;
}
