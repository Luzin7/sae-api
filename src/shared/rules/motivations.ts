export interface MotivationDefinition {
  key: string;
  name: string;
  description: string;
  trigger: string;
}

/** 8 motivations; the player chooses at most 1. Transcribed from the rulebook. */
export const MOTIVATIONS: readonly MotivationDefinition[] = [
  {
    key: 'reconhecimento',
    name: 'Reconhecimento',
    description: 'Busca por validação e prestígio.',
    trigger: 'Quando sob observação de audiência relevante ou reputação em julgamento.',
  },
  {
    key: 'adrenalina',
    name: 'Adrenalina',
    description: 'Desejo por intensidade e risco.',
    trigger: 'Quando em perigo imediato com risco real de dano grave.',
  },
  {
    key: 'ambicao',
    name: 'Ambição',
    description: 'Desejo de conquistar algo maior.',
    trigger: 'Quando surge oportunidade concreta de avanço em objetivo central.',
  },
  {
    key: 'dever',
    name: 'Dever',
    description: 'Compromisso com pessoas, causas ou responsabilidades.',
    trigger: 'Quando alguém ou responsabilidade direta está em risco.',
  },
  {
    key: 'patriotismo',
    name: 'Patriotismo',
    description: 'Lealdade a um povo, nação ou causa maior.',
    trigger: 'Quando interesses do grupo leal estão sob ameaça direta.',
  },
  {
    key: 'excentricidade',
    name: 'Excentricidade',
    description: 'Afirmação da própria identidade e valor.',
    trigger: 'Quando há audiência, rival ou situação de comparação pública.',
  },
  {
    key: 'revolucao',
    name: 'Revolução',
    description: 'Desejo de romper estruturas e transformar o mundo.',
    trigger: 'Quando confronta estrutura opressiva ou autoridade que pode ser desafiada.',
  },
  {
    key: 'liberdade',
    name: 'Liberdade',
    description: 'Necessidade de autonomia e rejeição a limitações.',
    trigger: 'Quando há risco de restrição direta da liberdade (captura, coerção).',
  },
];
