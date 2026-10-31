import type { AttributeKey } from './attributes.js';
import type { ProficiencyLevel } from './proficiency.js';

export interface MentalLevels {
  cognition: ProficiencyLevel;
  psyche: ProficiencyLevel;
  instinct: ProficiencyLevel;
}

export interface CorporalLevels {
  constitution: ProficiencyLevel;
  motricity: ProficiencyLevel;
  perception: ProficiencyLevel;
}

export interface PersonalityDefinition {
  name: string;
  motto: string;
  paragraphs: readonly string[];
  levels: MentalLevels;
}

export interface PostureDefinition {
  name: string;
  motto: string;
  paragraphs: readonly string[];
  levels: CorporalLevels;
}

/** 10 personalities → mental attribute levels (COG / PSI / INT). */
export const PERSONALITIES: readonly PersonalityDefinition[] = [
  {
    name: 'Erudito',
    motto: 'Observe. Analise. Questione.',
    paragraphs: [
      'O mundo não é algo a ser apenas vivido ele deve ser **compreendido**. Cada detalhe carrega uma estrutura, cada fenômeno esconde uma lógica, cada palavra possui um peso exato. Você não se contenta com respostas simples, nem aceita verdades superficiais. Vá mais fundo. Sempre mais fundo.',
      'Confie na sua **lógica**, refine sua **retórica**, domine a **linguagem** e organize o caos através da **razão**. Onde outros enxergam confusão, você enxerga padrões. Onde há dúvida, você constrói teoria. O conhecimento não é apenas uma ferramenta é o seu território.',
      'Mas cuidado.',
      'Nem tudo pode ser reduzido a sistemas. Pessoas não são equações. Emoções não seguem regras claras. Você pode interpretar mal intenções, ignorar sutilezas sociais ou falhar em perceber aquilo que não pode ser explicado, apenas sentido. Enquanto disseca o mundo com precisão, pode acabar distante dele.',
      'Ainda assim, há poder nisso.',
      'Você pode ser um mestre do saber, um estrategista impecável, alguém cuja mente molda o rumo dos acontecimentos com clareza e profundidade. Ou pode se perder em abstrações, frio, distante, tratando tudo — e todos — como objetos de estudo.',
      'No fim, pouco importa.',
      'O mundo é um problema.',
      'E você foi feito para resolvê-lo.',
    ],
    levels: {
      cognition: 'especialista',
      psyche: 'imperito',
      instinct: 'imperito',
    },
  },
  {
    name: 'Urbano',
    motto: 'Circule. Converse. Conecte.',
    paragraphs: [
      'O mundo se move através de pessoas e você está sempre no meio disso. Vozes, rostos, histórias, interesses. Nada acontece isolado. Tudo passa por alguém. E, mais cedo ou mais tarde, esse alguém acaba passando por você.',
      'Você sabe puxar assunto, manter atenção, dizer o que precisa ser dito ou o que querem ouvir. Sua **presença** abre portas. Sua **empatia** revela intenções. Sua **atuação** se ajusta sem esforço. Em tavernas, ruas, salões ou becos, você nunca está fora do lugar. Sempre há um contato, uma informação, uma oportunidade.',
      'Mas não confunda proximidade com profundidade.',
      'Você pode conhecer muitos e ainda assim não conhecer ninguém. Pode falar com facilidade e, ainda assim, dizer pouco do que realmente importa. Nem tudo é jogo social, e nem todo silêncio pode ser preenchido com palavras. Às vezes, você simplesmente não vê além da superfície.',
      'Ainda assim, isso nunca te impediu antes.',
      'Você pode ser aquele que sabe de tudo antes de todos, que encontra caminhos onde não há, que transforma desconhecidos em aliados com algumas palavras bem colocadas. Ou alguém que vive de aparências, transitando entre grupos sem nunca pertencer de fato a nenhum deles.',
      'No fim, o mundo é feito de gente.',
      'E você sabe como passar por elas.',
    ],
    levels: {
      cognition: 'imperito',
      psyche: 'especialista',
      instinct: 'imperito',
    },
  },
  {
    name: 'Místico',
    motto: 'Sinta. Permita. Escute o que não é dito.',
    paragraphs: [
      'O mundo não se limita ao que pode ser visto, medido ou explicado. Há algo por trás das formas, algo entre os momentos, algo que escapa quando tentam nomear. Você não tenta capturar isso, você **experimenta**.',
      'Confie na sua **intuição**, mergulhe na sua **subjetividade**, abrace a **criatividade** que emerge sem lógica aparente. Você percebe padrões onde não há estrutura, significados onde outros veem vazio. Memórias, sensações, pressentimentos, tudo se mistura. Tudo comunica.',
      'Mas cuidado.',
      'Nem tudo o que você sente é verdade. Nem tudo o que parece profundo tem sentido. Você pode se perder em interpretações, confundir percepção com projeção, ou enxergar demais onde não há nada. Enquanto busca o invisível, o concreto pode escapar por entre os dedos.',
      'Ainda assim… há algo aí.',
      'Você pode ser alguém que acessa o que outros não conseguem sequer conceber, que entende o indizível, que toca camadas da realidade que permanecem ocultas. Ou alguém que se afasta do mundo comum, preso em suas próprias percepções, desconectado do que é simples, direto, real.',
      'No fim, nem tudo precisa ser compreendido.',
      'Algumas coisas apenas precisam ser sentidas.',
    ],
    levels: {
      cognition: 'imperito',
      psyche: 'imperito',
      instinct: 'especialista',
    },
  },
  {
    name: 'Cético',
    motto: 'Questione. Analise. Desconfie.',
    paragraphs: [
      'Nada deve ser aceito como verdade sem antes ser examinado. O mundo está cheio de ilusões, crenças frágeis, interpretações enviesadas, narrativas convenientes. Você não se deixa levar por elas. Você desmonta, testa, verifica. Se algo não pode ser sustentado, não merece ser mantido.',
      'Confie na sua capacidade de **raciocínio**. Organize, compare, investigue. Você enxerga padrões lógicos, identifica inconsistências e expõe falhas com precisão quase cirúrgica. Onde outros veem mistério, você vê lacunas de informação. Onde outros sentem, você pergunta: *por quê?*',
      'Mas você não é cego às pessoas.',
      'Você observa. Analisa comportamento, linguagem, intenção. Entende motivações, reconhece jogos sociais, percebe quando algo está fora do lugar. Sua leitura não é empática, é **interpretativa**. Você compreende os outros não porque sente como eles, mas porque sabe como funcionam.',
      'Ainda assim… há limites.',
      'Nem tudo pode ser reduzido à lógica. Nem tudo pode ser provado. Ao rejeitar o que escapa ao seu entendimento, você corre o risco de ignorar aspectos reais da experiência, intuições válidas, percepções sutis, verdades que não se apresentam de forma direta. O mundo não deixa de ser complexo só porque você exige clareza.',
      'Você pode ser alguém que protege a realidade contra ilusões, que desmascara mentiras e impede que o erro se propague. Ou alguém que nega tudo aquilo que não consegue explicar, fechando-se para possibilidades que existem além do seu controle.',
      'No fim, a questão não é apenas duvidar.',
      'É saber **até onde a dúvida ainda é uma ferramenta, e quando ela se torna uma limitação.**',
    ],
    levels: {
      cognition: 'versado',
      psyche: 'competente',
      instinct: 'imperito',
    },
  },
  {
    name: 'Líder',
    motto: 'Fale. Oriente. Conduza.',
    paragraphs: [
      'Pessoas observam, hesitam, duvidam. Você não. Onde há indecisão, você se posiciona. Onde há ruído, você organiza. Sua presença não passa despercebida, ela **direciona**.',
      'Entenda as pessoas. Leia intenções, reconheça inseguranças, identifique ambições. Você sabe quando pressionar, quando acolher, quando inspirar. Sua força não está apenas no que você diz, mas em **como faz os outros agirem**. Você constrói confiança, impõe respeito ou desperta temor, o importante é que, de uma forma ou de outra, **eles seguem você**.',
      'E você não age no vazio.',
      'Você pensa antes de agir. Avalia cenários, estrutura decisões, antecipa consequências. Talvez não mergulhe nos detalhes mais profundos, mas entende o suficiente para traçar um caminho claro. Sua cognição não é contemplativa, é **funcional**. Serve ao objetivo.',
      'Mas liderança tem um preço.',
      'Pessoas não são peças. Elas resistem, falham, mudam. Se você confiar demais na sua capacidade de conduzir, pode ignorar limites, seus e dos outros. Pode forçar decisões, manipular relações ou carregar responsabilidades que não pode sustentar. E quando tudo depende de você… qualquer erro pesa mais.',
      'Você pode ser aquele que une, que inspira, que transforma um grupo em algo maior do que a soma de suas partes. Ou alguém que controla, domina e molda os outros conforme sua própria visão, independentemente das consequências.',
      'No fim, liderar não é apenas estar à frente.',
      'É decidir **por quem**, **por quê** — e arcar com tudo o que vem depois.',
    ],
    levels: {
      cognition: 'competente',
      psyche: 'versado',
      instinct: 'imperito',
    },
  },
  {
    name: 'Lúdico',
    motto: 'Experimente. Brinque. Improvise.',
    paragraphs: [
      'O mundo não precisa ser levado tão a sério e talvez seja justamente por isso que você o entende tão bem. Regras existem, padrões existem… mas você vê além deles. Você testa limites, combina ideias improváveis, encontra soluções onde ninguém pensaria em procurar.',
      'Confie no seu **raciocínio criativo**. Você conecta pontos distantes, resolve problemas de formas inesperadas, transforma obstáculos em oportunidades simplesmente porque se permite pensar diferente. Para você, pensar não é seguir um caminho, é explorar possibilidades.',
      'E você sente o momento.',
      'Sua percepção do ambiente, do ritmo, da atmosfera… tudo isso guia suas decisões. Você sabe quando agir, quando provocar, quando quebrar a tensão. Sua Intuição não é profunda ou contemplativa, é **intuitiva e responsiva**. Você lê o fluxo das situações e se adapta a ele com naturalidade.',
      'Mas nem tudo é jogo.',
      'Você pode perder o foco, subestimar riscos, tratar situações sérias com leveza excessiva. Nem todo problema aceita improviso. Nem toda consequência pode ser desfeita com uma boa ideia. E quando tudo vira possibilidade, escolher um caminho pode se tornar o maior desafio.',
      'Você pode ser alguém brilhante, inventivo, imprevisível, capaz de transformar qualquer cenário a seu favor com criatividade e timing. Ou alguém inconsistente, disperso, incapaz de sustentar decisões quando elas realmente importam.',
      'No fim, brincar com o mundo é uma forma de entendê-lo.',
      'Mas chega um momento em que você precisa decidir:',
      '**isso ainda é um jogo, ou já deixou de ser?**',
    ],
    levels: {
      cognition: 'versado',
      psyche: 'imperito',
      instinct: 'competente',
    },
  },
  {
    name: 'Visionário',
    motto: 'Imagine. Projete. Antecipe.',
    paragraphs: [
      'O mundo não é apenas o que é, é aquilo que **pode se tornar**. Você enxerga possibilidades antes que elas existam, caminhos onde outros veem apenas o presente. Ideias surgem, se conectam, se expandem. Você não reage ao mundo como ele está; você se orienta pelo que ele **pode vir a ser**.',
      'Confie na sua **intuição**. Ela não é vaga, é direcional. Você percebe tendências, capta sinais sutis, constrói imagens mentais de futuros possíveis. Aquilo que ainda não aconteceu já ocupa espaço nos seus pensamentos. E muitas vezes… você está certo.',
      'Mas visão sem estrutura se perde.',
      'É aqui que entra seu raciocínio. Você organiza, articula, dá forma ao que percebe. Nem sempre com perfeição, nem sempre com profundidade absoluta, mas o suficiente para transformar ideia em direção. Sua cognição não limita sua visão; ela **a ancora**.',
      'Ainda assim… há riscos.',
      'Você pode se apegar demais ao que ainda não existe. Projetar intenções, prever padrões que nunca se concretizam, insistir em caminhos que só fazem sentido na sua própria perspectiva. O futuro é incerto, e quanto mais longe você olha, mais fácil é se distanciar do presente.',
      'Você pode ser alguém que guia outros rumo a algo maior, que enxerga soluções antes que os problemas se manifestem, que constrói significado onde antes havia apenas possibilidade. Ou alguém que vive de projeções, desconectado da realidade imediata, sempre perseguindo algo que nunca se concretiza.',
      'No fim, visão não é apenas enxergar à frente.',
      'É saber **o que fazer com aquilo que você viu**.',
    ],
    levels: {
      cognition: 'competente',
      psyche: 'imperito',
      instinct: 'versado',
    },
  },
  {
    name: 'Virtuoso',
    motto: 'Sinta. Expresse. Marque presença.',
    paragraphs: [
      'O mundo não é apenas percebido, ele é vivido, interpretado e **expresso**. Emoções, sensações, atmosferas… tudo passa por você com intensidade. E, diferente de outros, você não guarda isso. Você **transforma**.',
      'Confie na sua **sensibilidade**. Você capta nuances, percebe o não dito, sente o peso de um ambiente, de uma palavra, de um olhar. Sua percepção não é racional, é **experiencial**. Você entende o mundo porque o atravessa por dentro.',
      'E isso não fica só em você.',
      'Você se comunica. Seja por palavras, gestos ou atitudes, você consegue transmitir o que sente, influenciar o ambiente, tocar os outros de alguma forma. Sua leitura social não é estratégica, é **natural**. Você se ajusta, responde, se conecta.',
      'Mas intensidade também desestabiliza.',
      'Você pode se deixar levar pelo momento, agir antes de compreender, reagir mais do que deveria. Emoções podem nublar julgamento, sensações podem ser confundidas com verdades absolutas. Nem tudo o que é sentido precisa ser seguido.',
      'Você pode ser alguém que inspira, que emociona, que transforma experiências em algo significativo para todos ao redor. Ou alguém instável, reativo, à mercê do que sente, sempre oscilando entre extremos.',
      'No fim, sentir não é o bastante.',
      'É preciso saber **o que fazer com aquilo que te atravessa**.',
    ],
    levels: {
      cognition: 'imperito',
      psyche: 'competente',
      instinct: 'versado',
    },
  },
  {
    name: 'Idealista',
    motto: 'Acredite. Sinta. Insista.',
    paragraphs: [
      'O mundo pode ser melhor, e você **sente isso**. Não como uma ideia distante, mas como algo presente, quase inevitável. Há algo nas pessoas, nas relações, nas possibilidades… algo que vale a pena preservar, proteger, transformar.',
      'Entenda as pessoas. Perceba seus medos, suas contradições, suas fragilidades. Você não as observa de fora, você se conecta. Sua força está em **acreditar nelas**, mesmo quando falham, mesmo quando não correspondem. Você enxerga potencial onde outros veriam apenas limite.',
      'E isso vem de dentro.',
      'Sua intuição guia suas convicções. Você sente o que é certo, o que importa, o que não deveria ser ignorado. Não precisa de uma estrutura perfeita para sustentar isso, sua certeza vem da experiência, da empatia, da percepção do que poderia ser diferente.',
      'Mas acreditar também cobra um preço.',
      'Você pode ignorar sinais claros, insistir em pessoas que não querem mudar, defender ideias que não se sustentam fora da sua própria percepção. Nem tudo pode ser salvo. Nem toda esperança encontra resposta. E quanto mais você insiste, mais isso pesa.',
      'Você pode ser alguém que mantém viva a esperança, que conecta, acolhe e transforma relações através da confiança e da sensibilidade. Ou alguém que se prende a expectativas irreais, sempre frustrado com um mundo que insiste em não corresponder ao que você sente que deveria ser.',
      'No fim, acreditar não é apenas sentir.',
      'É decidir **o que ainda vale a pena sustentar, mesmo quando tudo falha.**',
    ],
    levels: {
      cognition: 'imperito',
      psyche: 'versado',
      instinct: 'competente',
    },
  },
  {
    name: 'Polímata',
    motto: 'Adapte-se. Aprenda. Conecte.',
    paragraphs: [
      'O mundo é vasto demais para ser reduzido a uma única forma de entendimento. Pensar, sentir, interpretar, tudo tem seu lugar. Você não se prende a um único caminho. Em vez disso, transita entre eles.',
      'Você compreende conceitos, organiza ideias, resolve problemas. Talvez não com a profundidade de um especialista, mas com **consistência**. Sua cognição é estável, confiável, sempre disponível quando necessário.',
      'Você entende pessoas. Lê intenções, reconhece padrões de comportamento, se ajusta a diferentes contextos sociais. Não domina, não manipula, mas **acompanha**, responde, se posiciona com naturalidade.',
      'E você também sente.',
      'Percebe nuances, capta atmosferas, reage ao que não é dito. Sua intuição não é avassaladora, mas está sempre presente, oferecendo pequenas direções, ajustes sutis, caminhos alternativos.',
      'Mas amplitude tem um custo.',
      'Você dificilmente será o melhor em algo. Outros irão mais fundo, mais rápido, mais longe. Em situações extremas, isso pesa. Quando tudo depende de excelência absoluta, sua versatilidade pode não ser suficiente.',
      'Você pode ser alguém preparado para qualquer situação, capaz de se ajustar, aprender e contribuir independentemente do contexto. Ou alguém que nunca se aprofunda o bastante, sempre próximo de dominar algo, mas nunca chegando lá.',
      'No fim, saber um pouco de tudo não é uma fraqueza.',
      'Mas também não é o mesmo que **dominar aquilo que realmente importa**.',
    ],
    levels: {
      cognition: 'competente',
      psyche: 'competente',
      instinct: 'competente',
    },
  },
];

/** 10 postures → corporal attribute levels (CON / MOT / PER). */
export const POSTURES: readonly PostureDefinition[] = [
  {
    name: 'Abrutalhado',
    motto: 'Aguente. Avance. Não pare.',
    paragraphs: [
      'O mundo bate, você devolve. Dor não é um obstáculo, é parte do caminho. Cansaço vem, o corpo pesa, os músculos reclamam… e ainda assim, você continua. Onde outros recuam, você **permanece**.',
      'Seu corpo é sua fortaleza. Aguenta impacto, resiste ao desgaste, suporta o que quebraria outros. Ferimentos não te param, no máximo, te atrasam. Você não precisa ser rápido, nem preciso. Você precisa ser **inevitável**.',
      'E isso muda a forma como você age.',
      'Você entra primeiro, segura o que vier, atravessa o que estiver no caminho. Pressão não te desestabiliza, ela te define. Quanto mais difícil, mais você se impõe. Sua presença é física, concreta, impossível de ignorar.',
      'Mas resistência não é invulnerabilidade.',
      'Você pode insistir quando deveria recuar, ignorar limites até que seja tarde demais, confiar demais no corpo e de menos no resto. Nem tudo pode ser resolvido aguentando. Nem todo golpe precisa ser recebido.',
      'Você pode ser alguém que suporta o impossível, que protege os outros simplesmente por continuar de pé quando ninguém mais consegue. Ou alguém que avança sem pensar, absorvendo tudo até que não reste mais nada para sustentar.',
      'No fim, resistir não é apenas sobreviver.',
      'É saber **até quando continuar, e quando cair também tem um custo.**',
    ],
    levels: {
      constitution: 'especialista',
      motricity: 'imperito',
      perception: 'imperito',
    },
  },
  {
    name: 'Dinâmico',
    motto: 'Mova-se. Reaja. Não fique parado.',
    paragraphs: [
      'O mundo não espera, e você também não. Tudo está em fluxo: corpos, objetos, intenções. Você lê esse movimento e responde na mesma medida. Avança, recua, desvia, ajusta. Estar parado é estar em desvantagem.',
      'Seu corpo é rápido, preciso, adaptável. Cada ação se conecta à próxima. Você não executa movimentos isolados, você encadeia, improvisa, responde em tempo real. Onde outros precisam pensar, você já **agiu**.',
      'Velocidade não é só correr.',
      'É mudar de direção, encontrar aberturas, explorar oportunidades antes que desapareçam. Você se reposiciona, contorna obstáculos, transforma espaço em vantagem. O mundo é um campo em constante transformação, e você se transforma com ele.',
      'Mas movimento também dispersa.',
      'Você pode agir antes de entender, reagir sem avaliar, trocar consistência por impulso. Nem toda situação exige velocidade. Às vezes, parar é o que mantém você inteiro.',
      'Você pode ser alguém ágil, imprevisível, sempre um passo à frente, difícil de alcançar e ainda mais difícil de conter. Ou alguém inquieto, instável, que nunca se fixa o suficiente para sustentar uma ação até o fim.',
      'No fim, agir rápido não é o mesmo que agir bem.',
      'É preciso saber **quando se mover, e quando permanecer.**',
    ],
    levels: {
      constitution: 'imperito',
      motricity: 'especialista',
      perception: 'imperito',
    },
  },
  {
    name: 'Aguçado',
    motto: 'Observe. Perceba. Antecipe.',
    paragraphs: [
      'O mundo fala o tempo todo, na forma de detalhes. Um som fora do lugar, um movimento sutil, uma mudança no ambiente. Onde outros veem cenário, você vê **informação**.',
      'Seus sentidos estão sempre ativos. Você nota padrões, identifica ameaças, percebe intenções antes que se concretizem. Nada passa completamente despercebido. Mesmo quando não está procurando, você está **vendo**.',
      'E isso te coloca à frente.',
      'Você reage antes do impacto, se prepara antes do perigo, se posiciona antes da ação acontecer. Sua força não está em resistir ou se mover mais rápido, mas em **não ser pego desprevenido**. Você joga com vantagem, porque já entendeu o que está acontecendo.',
      'Mas percepção não é controle.',
      'Você pode se sobrecarregar com estímulos, hesitar diante de excesso de informação, ver ameaças onde não existem ou se perder tentando antecipar tudo. Nem tudo pode ser previsto. Nem tudo precisa ser analisado.',
      'Você pode ser alguém atento, preciso, sempre preparado, capaz de evitar riscos antes mesmo que eles surjam. Ou alguém tenso, vigilante demais, incapaz de relaxar, sempre esperando pelo próximo problema.',
      'No fim, perceber não é apenas enxergar.',
      'É saber **o que realmente importa, e o que pode ser ignorado.**',
    ],
    levels: {
      constitution: 'imperito',
      motricity: 'imperito',
      perception: 'especialista',
    },
  },
  {
    name: 'Arrojado',
    motto: 'Avance. Arrisque. Supere.',
    paragraphs: [
      'O caminho mais seguro raramente é o mais eficaz. Você sabe disso, e age de acordo. Onde há risco, há oportunidade. Onde há hesitação, você **rompe**.',
      'Seu corpo sustenta suas decisões. Você aguenta impacto, suporta o desgaste, atravessa situações que fariam outros recuar. Mas, diferente do Abrutalhado, você não fica, você **vai**. Seu movimento é direto, decidido, sem espaço para dúvida.',
      'Você entra, executa, resolve.',
      'Há intenção nos seus passos, direção nas suas ações. Você não se lança de forma cega, você escolhe avançar, mesmo sabendo das consequências. Sua motricidade acompanha esse impulso: não é perfeita, mas é suficiente para te colocar onde precisa estar, quando precisa.',
      'Mas ousadia cobra seu preço.',
      'Você pode subestimar riscos, confiar demais na própria resistência, avançar quando deveria esperar. Nem todo obstáculo pode ser atravessado à força. Nem toda oportunidade compensa o custo.',
      'Você pode ser alguém decisivo, corajoso, capaz de mudar o rumo de uma situação no momento certo, assumindo riscos que outros evitariam. Ou alguém imprudente, sempre um passo além do necessário, acumulando consequências que não consegue sustentar.',
      'No fim, avançar não é apenas coragem.',
      'É saber **qual risco vale a pena correr, e qual pode te derrubar.**',
    ],
    levels: {
      constitution: 'versado',
      motricity: 'competente',
      perception: 'imperito',
    },
  },
  {
    name: 'Competitivo',
    motto: 'Dispute. Supere. Vença.',
    paragraphs: [
      'Nada é apenas uma ação, é um teste. Um obstáculo não é só algo a ser resolvido, é algo a ser **superado melhor do que qualquer outro faria**. Você não participa, você compete.',
      'Seu corpo responde com precisão e eficiência. Seus movimentos são treinados, ajustados, refinados. Você executa melhor, mais rápido, com mais controle. Não por acaso, mas porque **quer ser o melhor**.',
      'E você sustenta isso.',
      'Seu corpo aguenta o esforço, mantém o ritmo, suporta a pressão de ir além do limite comum. Você não para no “suficiente”. Sempre há mais um passo, mais um avanço, mais uma forma de fazer melhor.',
      'Mas competição também distorce.',
      'Você pode transformar tudo em disputa, enxergar rivais onde não existem, ultrapassar limites desnecessários apenas para provar um ponto. Nem toda situação exige vitória. Nem toda vitória vale o custo.',
      'Você pode ser alguém que eleva o nível de tudo ao redor, que impulsiona outros a crescer e transforma desafios em conquistas reais. Ou alguém obcecado por desempenho, incapaz de aceitar falhas, sempre medindo valor em termos de superioridade.',
      'No fim, vencer não é apenas superar os outros.',
      'É saber **o que realmente vale a pena conquistar.**',
    ],
    levels: {
      constitution: 'competente',
      motricity: 'versado',
      perception: 'imperito',
    },
  },
  {
    name: 'Protetor',
    motto: 'Sustente. Observe. Intervenha.',
    paragraphs: [
      'Nem todo combate é sobre avançar. Às vezes, é sobre **permanecer**, entre o perigo e aquilo que precisa ser preservado. Você entende isso. Sua força não está apenas em resistir, mas em **segurar a linha**.',
      'Seu corpo aguenta. Impactos, desgaste, pressão, você absorve o que vier. Não por descuido, mas por escolha. Você se coloca onde o risco é maior porque sabe que **alguém precisa estar ali**.',
      'E você está atento.',
      'Você observa o campo, identifica ameaças, antecipa movimentos. Não espera o problema acontecer, você se posiciona antes. Sua percepção não é distante; ela é **prática**, voltada para agir no momento certo.',
      'Mas proteger também pesa.',
      'Você pode assumir responsabilidades que não são suas, se colocar em risco constante, tentar sustentar mais do que consegue. Nem tudo pode ser impedido. Nem todos podem ser salvos.',
      'Você pode ser alguém confiável, firme, que mantém outros seguros mesmo sob pressão, que transforma resistência em segurança. Ou alguém sobrecarregado, sempre carregando mais do que deveria, incapaz de recuar mesmo quando necessário.',
      'No fim, proteger não é apenas resistir.',
      'É saber **o que você pode sustentar, e o que está além do seu alcance.**',
    ],
    levels: {
      constitution: 'versado',
      motricity: 'imperito',
      perception: 'competente',
    },
  },
  {
    name: 'Vigilante',
    motto: 'Vigie. Sustente. Não relaxe.',
    paragraphs: [
      'O perigo raramente avisa quando chega. Ele se insinua, se aproxima aos poucos, se esconde nos intervalos. Você sabe disso, e por isso **não abaixa a guarda**.',
      'Seus sentidos estão sempre atentos. Você observa padrões, nota ausências, percebe mudanças sutis no ambiente. Não se trata de reagir rápido, mas de **nunca ser pego desprevenido**. Antes que algo aconteça, você já está preparado.',
      'E você sustenta essa atenção.',
      'Seu corpo aguenta a vigília, o cansaço, a repetição. Longos períodos de tensão não te quebram facilmente. Você permanece, firme, constante, mantendo o foco mesmo quando tudo ao redor começa a falhar.',
      'Mas vigilância também cobra seu preço.',
      'Você pode se tornar rígido, incapaz de relaxar, sempre esperando pelo pior. Pode ver ameaças onde não existem, gastar energia com o que nunca se concretiza. Nem todo silêncio esconde perigo. Nem toda pausa é uma armadilha.',
      'Você pode ser alguém confiável, sempre atento, que percebe o risco antes que ele se torne real e mantém todos seguros pela sua constância. Ou alguém exausto, preso em um estado contínuo de alerta, incapaz de desligar, sempre à espera de algo que talvez nunca venha.',
      'No fim, vigiar não é apenas observar.',
      'É saber **quando manter os olhos abertos, e quando é seguro fechá-los.**',
    ],
    levels: {
      constitution: 'competente',
      motricity: 'imperito',
      perception: 'versado',
    },
  },
  {
    name: 'Reativo',
    motto: 'Espere. Leia. Responda.',
    paragraphs: [
      'Você não precisa agir primeiro. O mundo se move, e isso é o suficiente. Cada gesto, cada intenção, cada erro… tudo cria uma abertura. Você não força situações. Você **aproveita**.',
      'Observe. Entenda o que está acontecendo antes de se comprometer. Você lê movimentos, reconhece padrões, identifica o momento certo. Sua percepção não busca controle total, ela busca **o instante exato**.',
      'E quando ele chega… você age.',
      'Rápido, preciso, sem hesitação. Seu corpo responde antes que o pensamento atrase. Não há excesso, não há desperdício. Apenas ação direta, no tempo certo, no lugar certo.',
      'Mas reagir também limita.',
      'Você pode depender demais do outro para agir, hesitar quando deveria tomar iniciativa, esperar por uma oportunidade que nunca vem. Nem tudo se resolve respondendo. Às vezes, é preciso criar a situação.',
      'Você pode ser alguém eficiente, difícil de prever, que transforma qualquer ação alheia em vantagem própria. Ou alguém passivo, sempre um passo atrás, preso à necessidade de reagir em vez de decidir.',
      'No fim, responder bem não é o mesmo que conduzir.',
      'É preciso saber **quando esperar, e quando agir por conta própria.**',
    ],
    levels: {
      constitution: 'imperito',
      motricity: 'versado',
      perception: 'competente',
    },
  },
  {
    name: 'Predador',
    motto: 'Rastreie. Acerte. Termine.',
    paragraphs: [
      'Nada se move sem deixar sinais. Um som, um rastro, uma hesitação, tudo entrega. Você observa, interpreta, conecta. O alvo não desaparece… ele apenas ainda não foi encontrado.',
      'Sua percepção é direcionada. Você não vê tudo, você vê **o que importa**. Filtra o ambiente, ignora o irrelevante, foca no essencial. Uma vez que identifica algo, dificilmente perde.',
      'E então você age.',
      'Seus movimentos são precisos, controlados, eficientes. Não há pressa desnecessária, nem desperdício. Você se posiciona, se aproxima, escolhe o momento, e executa. Não é sobre velocidade constante, mas sobre **acerto no momento certo**.',
      'Mas foco também estreita.',
      'Você pode ignorar o resto do ambiente, se fixar demais em um único objetivo, deixar passar ameaças ou oportunidades fora do seu campo de atenção. Nem tudo é um alvo. Nem tudo deve ser perseguido.',
      'Você pode ser alguém implacável, que encontra, persegue e resolve sem falhas, transformando qualquer situação em uma sequência controlada de ações. Ou alguém obsessivo, incapaz de soltar o que começou, mesmo quando já não faz sentido continuar.',
      'No fim, caçar não é apenas encontrar.',
      'É saber **quando seguir, e quando deixar ir.**',
    ],
    levels: {
      constitution: 'imperito',
      motricity: 'competente',
      perception: 'versado',
    },
  },
  {
    name: 'Versátil',
    motto: 'Adapte-se. Ajuste. Continue.',
    paragraphs: [
      'O corpo não precisa ser o melhor em tudo, precisa ser **capaz de responder**. Cada situação exige algo diferente: força, movimento, atenção. Você não se prende a um único modo de agir. Você se ajusta.',
      'Você aguenta quando precisa. Seu corpo resiste ao desgaste comum, suporta esforço, mantém o ritmo. Talvez não por longos extremos, mas o suficiente para **não falhar quando importa**.',
      'Você se move bem. Não de forma excepcional, mas com controle, coordenação e eficiência. Seus movimentos são seguros, funcionais, confiáveis. Você faz o que precisa ser feito, sem excessos, sem falhas graves.',
      'E você percebe o ambiente.',
      'Nota o suficiente, entende o contexto, reage de forma adequada. Não antecipa tudo, mas dificilmente é pego completamente desprevenido. Sua atenção é equilibrada, nem dispersa, nem obsessiva.',
      'Mas equilíbrio também tem seu limite.',
      'Você dificilmente será o mais forte, o mais rápido ou o mais atento. Em situações extremas, isso se torna evidente. Quando tudo exige excelência absoluta, o “bom o bastante” pode não ser suficiente.',
      'Você pode ser alguém confiável em qualquer situação, capaz de se adaptar, sustentar e agir com consistência independentemente do desafio. Ou alguém que nunca se destaca, sempre competente, mas raramente decisivo.',
      'No fim, ser capaz de tudo não é o mesmo que dominar algo.',
      'Mas às vezes… é exatamente o que mantém você de pé.',
    ],
    levels: {
      constitution: 'competente',
      motricity: 'competente',
      perception: 'competente',
    },
  },
];

export type ArchetypeProficiency = Record<AttributeKey, ProficiencyLevel>;

export function deriveProficiency(
  personalityName: string,
  postureName: string,
): ArchetypeProficiency | null {
  const personality = PERSONALITIES.find(
    (entry) => entry.name === personalityName,
  );
  if (!personality) return null;

  const posture = POSTURES.find((entry) => entry.name === postureName);
  if (!posture) return null;

  return { ...personality.levels, ...posture.levels };
}
