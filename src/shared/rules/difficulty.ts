export interface DifficultyClassDefinition {
  cd: number;
  grade: number;
  name: string;
}

export const DIFFICULTY_CLASSES: readonly DifficultyClassDefinition[] = [
  { cd: 5, grade: 1, name: 'Trivial' },
  { cd: 10, grade: 2, name: 'Fácil' },
  { cd: 15, grade: 3, name: 'Moderada' },
  { cd: 20, grade: 4, name: 'Considerável' },
  { cd: 30, grade: 5, name: 'Exigente' },
  { cd: 40, grade: 6, name: 'Árdua' },
  { cd: 50, grade: 7, name: 'Extrema' },
  { cd: 60, grade: 8, name: 'Quase Impossível' },
  { cd: 70, grade: 9, name: 'Impossível' },
  { cd: 80, grade: 10, name: 'Geracional' },
];

export function difficultyByGrade(grade: number): number | null {
  const entry = DIFFICULTY_CLASSES.find((item) => item.grade === grade);
  if (!entry) return null;
  return entry.cd;
}
