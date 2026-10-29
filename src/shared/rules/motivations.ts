export interface MotivationDefinition {
  key: string;
  name: string;
  description: string;
  trigger: string;
}

export const MOTIVATIONS: readonly MotivationDefinition[] = [
  {
    key: 'reconhecimento',
    name: 'Reconhecimento',
    description:
      'Busca por validação e prestígio. Internamente, o personagem precisa ser visto e reconhecido; fisicamente, se esforça para se destacar em momentos decisivos; socialmente, busca aprovação e status.',
    trigger:
      'Quando o personagem está sob observação direta de uma audiência relevante ou em uma situação onde sua reputação está sendo julgada ou pode ser significativamente afetada.',
  },
  {
    key: 'adrenalina',
    name: 'Adrenalina',
    description:
      'Desejo por intensidade e risco. Internamente, o personagem se sente vivo em situações extremas; fisicamente, se lança em ações perigosas; socialmente, tende a assumir riscos diante de outros.',
    trigger:
      'Quando o personagem está em uma situação de perigo imediato com risco real de dano grave, falha crítica ou consequências severas.',
  },
  {
    key: 'ambicao',
    name: 'Ambição',
    description:
      'Desejo de conquistar algo maior. Internamente, é guiado por metas claras; fisicamente, age para alcançá-las; socialmente, disputa espaço, poder ou recursos.',
    trigger:
      'Quando surge uma oportunidade concreta e imediata de avanço significativo em direção a um objetivo central do personagem.',
  },
  {
    key: 'dever',
    name: 'Dever',
    description:
      'Compromisso com pessoas, causas ou responsabilidades. Internamente, sente obrigação moral; fisicamente, age para proteger ou cumprir; socialmente, assume papéis de responsabilidade.',
    trigger:
      'Quando alguém, grupo ou responsabilidade direta do personagem está em risco claro, imediato ou prestes a sofrer consequências.',
  },
  {
    key: 'patriotismo',
    name: 'Patriotismo',
    description:
      'Lealdade a um povo, nação ou causa maior. Internamente, acredita em algo coletivo; fisicamente, luta por isso; socialmente, representa e defende esse grupo.',
    trigger:
      'Quando indivíduos, símbolos ou interesses do grupo ao qual o personagem é leal estão sob ameaça direta ou sendo desafiados.',
  },
  {
    key: 'excentricidade',
    name: 'Excentricidade',
    description:
      'Afirmação da própria identidade e valor. Internamente, o personagem se vê como único ou superior; fisicamente, age para provar isso; socialmente, busca destaque ou ruptura de padrões.',
    trigger:
      'Quando há uma audiência, rival ou situação onde o personagem pode ser comparado, desafiado ou reconhecido publicamente.',
  },
  {
    key: 'revolucao',
    name: 'Revolução',
    description:
      'Desejo de romper estruturas e transformar o mundo. Internamente, rejeita o status quo; fisicamente, confronta sistemas ou autoridades; socialmente, inspira mudança ou questiona normas.',
    trigger:
      'Quando o personagem se depara com uma estrutura opressiva, autoridade dominante ou limitação clara que pode ser desafiada, subvertida ou transformada.',
  },
  {
    key: 'liberdade',
    name: 'Liberdade',
    description:
      'Necessidade de autonomia e rejeição a limitações. Internamente, teme ser controlado; fisicamente, resiste a contenção; socialmente, evita obrigações que o aprisionem.',
    trigger:
      'Quando o personagem está sob risco de restrição direta de sua liberdade, como captura, coerção, controle ou perda de autonomia.',
  },
];
