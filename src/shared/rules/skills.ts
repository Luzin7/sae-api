import type { AttributeKey } from './attributes.js';

export interface SkillDefinition {
  name: string;
  attribute: AttributeKey;
}

/** The 30 skills, 5 per attribute. Names are the exact pt-BR catalog names. */
export const SKILLS: readonly SkillDefinition[] = [
  { name: 'Erudição', attribute: 'cognition' },
  { name: 'Estratégia', attribute: 'cognition' },
  { name: 'Linguística', attribute: 'cognition' },
  { name: 'Lógica', attribute: 'cognition' },
  { name: 'Retórica', attribute: 'cognition' },
  { name: 'Atuação', attribute: 'psyche' },
  { name: 'Carisma', attribute: 'psyche' },
  { name: 'Compostura', attribute: 'psyche' },
  { name: 'Empatia', attribute: 'psyche' },
  { name: 'Presença', attribute: 'psyche' },
  { name: 'Criatividade', attribute: 'instinct' },
  { name: 'Pressentimento', attribute: 'instinct' },
  { name: 'Reminiscência', attribute: 'instinct' },
  { name: 'Perspectiva', attribute: 'instinct' },
  { name: 'Impressão', attribute: 'instinct' },
  { name: 'Condicionamento', attribute: 'constitution' },
  { name: 'Fortitude', attribute: 'constitution' },
  { name: 'Primalidade', attribute: 'constitution' },
  { name: 'Tolerância', attribute: 'constitution' },
  { name: 'Vitalidade', attribute: 'constitution' },
  { name: 'Expressividade', attribute: 'motricity' },
  { name: 'Manipulação', attribute: 'motricity' },
  { name: 'Mobilidade', attribute: 'motricity' },
  { name: 'Precisão', attribute: 'motricity' },
  { name: 'Reflexo', attribute: 'motricity' },
  { name: 'Aromatismo', attribute: 'perception' },
  { name: 'Contato', attribute: 'perception' },
  { name: 'Escuta', attribute: 'perception' },
  { name: 'Gustação', attribute: 'perception' },
  { name: 'Observação', attribute: 'perception' },
];

export function skillsByAttribute(attribute: AttributeKey): readonly SkillDefinition[] {
  return SKILLS.filter((skill) => skill.attribute === attribute);
}
