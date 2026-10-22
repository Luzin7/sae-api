export interface OficioDefinition {
  name: string;
  affectedSkills: readonly string[];
}

/**
 * Source: official rulebook, https://fnandesrafael.github.io/sangue-e-aco/
 * (Capítulo 1 - Antecedentes).
 *
 * Two transcribed rows cited skills that do not exist in the 30-skill catalog.
 * They are corrected explicitly so the fix is not silent:
 *   Evocação (Acadêmico)          → Impressão (INT)
 *   Moral (Militar, Figura Pública) → Compostura (PSI)
 */
export const OFICIO_SKILL_CORRECTIONS: Readonly<Record<string, string>> = {
  Evocação: 'Impressão',
  Moral: 'Compostura',
};

/** 12 ofícios and the skills that receive the CD reduction (official rulebook). */
export const OFICIOS: readonly OficioDefinition[] = [
  {
    name: 'Artista',
    affectedSkills: [
      'Atuação',
      'Expressividade',
      'Impressão',
      '1 Percepção (escolha)',
    ],
  },
  {
    name: 'Artífice',
    affectedSkills: ['Lógica', 'Contato', 'Manipulação', 'Precisão'],
  },
  {
    name: 'Atleta',
    affectedSkills: ['Vitalidade', 'Condicionamento', 'Mobilidade', 'Carisma'],
  },
  {
    name: 'Acadêmico',
    affectedSkills: ['Erudição', 'Observação', 'Impressão', 'Linguística'],
  },
  {
    name: 'Comerciante',
    affectedSkills: ['Carisma', 'Empatia', 'Retórica', 'Estratégia'],
  },
  {
    name: 'Criminoso',
    affectedSkills: [
      'Reflexo',
      'Mobilidade',
      'Perspectiva',
      'Presença/Carisma',
    ],
  },
  {
    name: 'Figura Pública',
    affectedSkills: [
      'Carisma',
      'Estratégia ou Compostura',
      'Retórica',
      'Expressividade',
    ],
  },
  {
    name: 'Investigador',
    affectedSkills: ['Lógica', 'Retórica', 'Perspectiva', 'Criatividade'],
  },
  {
    name: 'Medicante',
    affectedSkills: ['Erudição', 'Pressentimento', 'Empatia', 'Precisão'],
  },
  {
    name: 'Militar',
    affectedSkills: ['Compostura', 'Estratégia', 'Tolerância', 'Primalidade'],
  },
  {
    name: 'Operário',
    affectedSkills: ['Fortitude', 'Tolerância', 'Pressentimento', 'Empatia'],
  },
  {
    name: 'Pária',
    affectedSkills: ['Fortitude', 'Vitalidade', 'Presença', 'Pressentimento'],
  },
];

export interface OficioReductionBand {
  minNp: number;
  maxNp: number;
  degrees: number;
}

export const OFICIO_CD_REDUCTION: readonly OficioReductionBand[] = [
  { minNp: 1, maxNp: 5, degrees: 1 },
  { minNp: 6, maxNp: 10, degrees: 2 },
  { minNp: 11, maxNp: 15, degrees: 3 },
  { minNp: 16, maxNp: 20, degrees: 4 },
];

export function oficioCdReduction(np: number): number {
  const band = OFICIO_CD_REDUCTION.find(
    (entry) => np >= entry.minNp && np <= entry.maxNp,
  );
  if (!band) return 0;
  return band.degrees;
}
