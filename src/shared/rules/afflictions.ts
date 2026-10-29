export const AFFLICTION_KEYS = [
  'fobia',
  'vicio',
  'juramento',
  'trauma',
  'deficiencia',
  'apego',
  'segredo',
  'estigma',
] as const;

export type AfflictionKey = (typeof AFFLICTION_KEYS)[number];

export interface AfflictionDefinition {
  key: AfflictionKey;
  name: string;
  description: string;
  requirement: string;
  trigger: string;
}

/** 8 optional afflictions; taken at character creation. Official rulebook text, verbatim. */
export const AFFLICTIONS: readonly AfflictionDefinition[] = [
  {
    key: 'fobia',
    name: 'Fobia',
    description: 'Medo intenso e debilitante diante de algo específico.',
    requirement:
      'Definir a fonte da fobia (criatura, ambiente, situação, etc.).',
    trigger:
      'Quando o personagem se depara diretamente com a fonte da fobia ou algo que a represente claramente.',
  },
  {
    key: 'vicio',
    name: 'Vício',
    description: 'Dependência física ou psicológica de substância ou hábito.',
    requirement: 'Definir o objeto do vício e sua frequência de consumo.',
    trigger:
      'Quando o personagem está em abstinência ou em situação onde não pode satisfazer o vício.',
  },
  {
    key: 'juramento',
    name: 'Juramento',
    description: 'Compromisso rígido que limita ações do personagem.',
    requirement:
      'Listar claramente ações proibidas pelo juramento ou código de honra.',
    trigger:
      'Quando uma situação exige diretamente que o personagem viole seu juramento para ter sucesso.',
  },
  {
    key: 'trauma',
    name: 'Trauma',
    description: 'Marca psicológica causada por evento passado.',
    requirement: 'Definir o evento traumático e seus gatilhos específicos.',
    trigger:
      'Quando a situação remete diretamente ao evento ou ativa um dos gatilhos definidos.',
  },
  {
    key: 'deficiencia',
    name: 'Deficiência',
    description: 'Limitação física permanente que reduz capacidades.',
    requirement: 'Escolher uma condição (ex: cegueira, surdez, amputação).',
    trigger:
      'Quando a limitação impacta diretamente a ação realizada ou o ambiente exige sua superação.',
  },
  {
    key: 'apego',
    name: 'Apego',
    description: 'Dependência emocional de pessoa ou objeto específico.',
    requirement: 'Definir a pessoa ou objeto ao qual o personagem é apegado.',
    trigger: 'Quando o alvo do apego está em risco, ausente ou inacessível.',
  },
  {
    key: 'segredo',
    name: 'Segredo',
    description:
      'Informação que o personagem precisa esconder a qualquer custo.',
    requirement:
      'Definir o segredo e suas possíveis consequências se revelado.',
    trigger:
      'Quando há risco real de descoberta, investigação direta ou exposição iminente.',
  },
  {
    key: 'estigma',
    name: 'Estigma',
    description: 'Marca social que gera rejeição ou preconceito.',
    requirement: 'Definir a natureza do estigma e os grupos que o reconhecem.',
    trigger:
      'Quando o personagem interage com indivíduos ou grupos que reconhecem ou reagem ao estigma.',
  },
];
