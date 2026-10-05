export interface AfflictionDefinition {
  key: string;
  name: string;
  description: string;
  requirement: string;
  trigger: string;
}

/** 8 optional afflictions; taken at character creation. Transcribed from the rulebook. */
export const AFFLICTIONS: readonly AfflictionDefinition[] = [
  {
    key: 'fobia',
    name: 'Fobia',
    description: 'Medo intenso e debilitante.',
    requirement: 'Definir a fonte da fobia.',
    trigger: 'Ao se deparar diretamente com a fonte.',
  },
  {
    key: 'vicio',
    name: 'Vício',
    description: 'Dependência física ou psicológica.',
    requirement: 'Definir objeto e frequência de consumo.',
    trigger: 'Em abstinência ou impossibilitado de satisfazer o vício.',
  },
  {
    key: 'juramento',
    name: 'Juramento',
    description: 'Compromisso rígido que limita ações.',
    requirement: 'Listar ações proibidas pelo código.',
    trigger: 'Quando a situação exige violar o juramento para ter sucesso.',
  },
  {
    key: 'trauma',
    name: 'Trauma',
    description: 'Marca psicológica de evento passado.',
    requirement: 'Definir evento e gatilhos específicos.',
    trigger: 'Quando a situação remete ao evento ou ativa um gatilho.',
  },
  {
    key: 'deficiencia',
    name: 'Deficiência',
    description: 'Limitação física permanente.',
    requirement: 'Escolher condição (cegueira, surdez, amputação).',
    trigger: 'Quando a limitação impacta diretamente a ação.',
  },
  {
    key: 'apego',
    name: 'Apego',
    description: 'Dependência emocional de pessoa ou objeto.',
    requirement: 'Definir o alvo do apego.',
    trigger: 'Quando o alvo está em risco, ausente ou inacessível.',
  },
  {
    key: 'segredo',
    name: 'Segredo',
    description: 'Informação que precisa ser escondida.',
    requirement: 'Definir o segredo e suas consequências.',
    trigger: 'Quando há risco real de descoberta ou exposição.',
  },
  {
    key: 'estigma',
    name: 'Estigma',
    description: 'Marca social que gera rejeição.',
    requirement: 'Definir natureza e grupos que o reconhecem.',
    trigger: 'Quando interage com grupos que reconhecem o estigma.',
  },
];
