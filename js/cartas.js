console.log("cartas.js carregado");

// ============================================================================
// ARQUIVO DE DADOS DAS CARTAS
// ============================================================================
// Tudo relacionado a "o que é uma carta" mora aqui: a classe Carta, os tipos
// de efeito passivo e o pool de cartas de efeito usado para montar os decks.
//
// Para adicionar uma carta de efeito nova, basta acrescentar um objeto ao
// array POOL_CARTAS_EFEITO lá embaixo — não precisa mexer em mais nada.
// Para mudar como o jogo resolve/mostra os efeitos, mexa nas funções
// descreverEfeito() e (em main.js) Partida.aplicarEfeitoInvocacao().
// ============================================================================

// ---------- SISTEMA DE EFEITOS PASSIVOS (AO INVOCAR) ----------
//
// Todos os efeitos aqui são disparados uma única vez, no momento em que a
// carta é colocada em campo (invocada) ou conjurada. Não existem habilidades
// ativadas manualmente — isso mantém o fluxo do jogo simples e automático.

const TIPOS_EFEITO = {
  BUFF_ALIADOS: "buff_aliados", // fortalece as outras cartas aliadas já em campo
  DEBUFF_INIMIGOS: "debuff_inimigos", // enfraquece as cartas inimigas em campo
  COMPRAR_CARTA: "comprar_carta", // dono compra carta(s) extra do deck
  DESCARTAR_CARTA: "descartar_carta", // oponente descarta carta(s) aleatória(s) da mão
  ATACAR: "atacar", // dano em alvo(s) inimigo(s) dentro de um range H/V a partir da posição
  BUFF_ALIADO_ESCOLHIDO: "buff_aliado_escolhido", // dono escolhe UMA carta aliada em campo (pode ser esta mesma) pra ganhar poder
};

// Gera a frase descritiva de um efeito, usada na visualização detalhada da carta
function descreverEfeito(efeito) {
  if (!efeito) return "";
  switch (efeito.tipo) {
    case TIPOS_EFEITO.BUFF_ALIADOS:
      return `Ao ser invocada: todos os aliados em campo ganham +${efeito.valor} de poder.`;
    case TIPOS_EFEITO.DEBUFF_INIMIGOS:
      return `Ao ser invocada: todas as cartas inimigas em campo perdem -${efeito.valor} de poder.`;
    case TIPOS_EFEITO.COMPRAR_CARTA:
      return `Ao ser invocada: você compra ${efeito.valor} carta${efeito.valor > 1 ? "s" : ""} do deck.`;
    case TIPOS_EFEITO.DESCARTAR_CARTA:
      return `Ao ser invocada: o oponente descarta ${efeito.valor} carta${efeito.valor > 1 ? "s" : ""} aleatória${efeito.valor > 1 ? "s" : ""} da mão.`;
    case TIPOS_EFEITO.ATACAR:
      return `Habilidade ativa (1x por turno, em campo): causa ${efeito.valor} de dano ${efeito.atingeTodos ? "a todos os alvos" : "a um alvo"} em range (H${efeito.rangeH}/V${efeito.rangeV}).`;
    case TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO:
      return efeito.custoProprio
        ? `Habilidade ativa (1x por turno, em campo): escolha uma carta aliada em campo para ganhar +${efeito.valor} de poder. Esta carta perde ${efeito.custoProprio} de poder.`
        : `Ao ser invocada: escolha uma carta aliada em campo (pode ser esta) para ganhar +${efeito.valor} de poder.`;
    default:
      return "";
  }
}

// ---------- SISTEMA DE EFEITOS DE TURNO (A CADA FIM DE TURNO) ----------
//
// Diferente dos efeitos acima (que disparam 1x, ao entrar em campo), estes
// são reavaliados a cada fim de turno, para cada carta que ainda estiver
// viva em campo. Quem resolve isso é Partida.resolverEfeitosDeTurno(),
// em main.js.

const TIPOS_EFEITO_TURNO = {
  CHANCE_GANHAR_PODER: "chance_ganhar_poder", // % de chance de ganhar +poder a cada turno
};

// Gera a frase descritiva de um efeito de turno, usada na visualização
// detalhada da carta (mesma ideia de descreverEfeito(), mas para este
// segundo tipo de efeito).
function descreverEfeitoTurno(efeito) {
  if (!efeito) return "";
  switch (efeito.tipo) {
    case TIPOS_EFEITO_TURNO.CHANCE_GANHAR_PODER:
      return `A cada turno: ${Math.round(efeito.chance * 100)}% de chance de ganhar +${efeito.valor} de poder.`;
    default:
      return "";
  }
}

// ----------------------------------------------------------------------------
// POOL DE CARTAS MONSTRO ESPECIAIS
// ----------------------------------------------------------------------------
// Assim como POOL_CARTAS_EFEITO (mais abaixo), cada entrada aqui é um
// "molde" de carta — mas de tipo "monstro" (vai a campo), com efeitoTurno
// em vez de efeito. O id também é gerado só quando o deck de teste é
// montado (Jogador.criardeckteste(), em main.js).
// ----------------------------------------------------------------------------
const POOL_CARTAS_MONSTRO = [
  {
    nome: "CryptoAcionistas",
    poder: 6,
    descricao:
      "Após a implementação das moedas digitais em escala global, os CryptoAcionistas rapidamente se tornaram a nova tendência. Defensores ferrenhos da sustentabilidade, continuam trabalhando diariamente para maximizar o ROI, elevar o valuation e garantir um futuro melhor para as próximas gerações de suas CryptoWallets.",
    imagem: "cryptoacionistas",
    // Ponto da imagem que fica centralizado dentro do retângulo de arte
    // (0 a 1, em cada eixo — 0.5/0.5 é o centro da imagem, que é o
    // padrão se você não definir "foco"). Como o retângulo de exibição é
    // mais largo que alto e a arte é um retrato em pé, a imagem é
    // ampliada até cobrir o retângulo inteiro (sem distorcer) e o que
    // sobra é recortado; "foco" só decide QUAL PARTE da imagem fica
    // visível depois do recorte.
    //   x: 0 = mostra mais a esquerda da imagem, 1 = mais a direita
    //   y: 0 = mostra mais o topo (ótimo pra garantir que o rosto
    //      apareça), 1 = mostra mais a base da imagem
    foco: { x: 0.5, y: 0.15 },
    efeitoTurno: {
      tipo: TIPOS_EFEITO_TURNO.CHANCE_GANHAR_PODER,
      chance: 0.5,
      valor: 1,
    },
  },

  {
    nome: "CyberVendedor da RaspCorp",
    poder: 3,
    descricao:
      "Quando surgiram os primeiros bio-androides, foi-se percebido que seria possível criar um funcionário que juntaria a capacidade de convencimento de um ser humano e a não necessidade de descanso de um robô, resultando em um vendedor duplamente capacitado, com duas vezes menos salário e três vezes menos alma.",
    imagem: "cybervendedor",
    foco: { x: 0.5, y: 0.4 },
    efeito: {
      tipo: TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO,
      valor: 1,
    },
    // Venda Casada: efeito passivo normal (dispara ao invocar), não é
    // habilidade ativa — segue o mesmo fluxo de BUFF_ALIADOS/DEBUFF_INIMIGOS.
  },

  {
    nome: "Agente da DIPSP",
    poder: 3,
    descricao:
      "Uma carta de campo com habilidade ativa: mira e dispara num alvo à sua escolha.",
    imagem: "dipsp",
    efeito: {
      tipo: TIPOS_EFEITO.ATACAR,
      valor: 3,
      rangeH: 2,
      rangeV: 2,
      atingeTodos: false,
    },
    habilidadeAtiva: true, // NÃO dispara ao invocar — precisa ser ativada em campo
    somAtaque: "somTiro",
  },

  {
    nome: 'UCC "Juggernaut"',
    poder: 11,
    descricao:
      "A Unidade Cibernética de Combate, apelidada de Juggernaut, é responsável pela defesa e controle de NeoFloripa. Afinal, a liberdade é grande, mas não infinita. Desde sua implementação, a CyberCidade aboliu os firewalls: agora as ameaças são pessoalmente confrontadas.",
    imagem: "juggernaut",
    efeito: {
      tipo: TIPOS_EFEITO.ATACAR,
      valor: 5,
      // rangeH:5 e rangeV:3 cobrem o campo inimigo inteiro (5 colunas,
      // 2 fileiras de profundidade), o que na prática implementa
      // "escolha qualquer carta do campo inimigo" (Protocolo de
      // Segurança) reaproveitando 100% do sistema de ATACAR existente.
      rangeH: 5,
      rangeV: 3,
      atingeTodos: false,
    },
    habilidadeAtiva: true, // Protocolo de Segurança: não dispara ao invocar — ativa em campo, 1x por turno
    somAtaque: "somTiro",
  },

  {
    nome: "Estagiário de Machine Learning",
    poder: 2,
    descricao:
      "As árduas horas dedicadas ao treinamento e desenvolvimento de IAs capazes de substituir o trabalho humano demonstram que, apesar de ser apenas um estagiário, seu trabalho é vital para o futuro da empresa. O RPH estima que ele continuará sendo lembrado por aproximadamente três semanas após sua substituição.",
    imagem: "estagiarioml",
    efeito: {
      tipo: TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO,
      valor: 2,
      custoProprio: 1, // Machine Learning: além de buffar o alvo, o próprio Estagiário perde 1 PA
    },
    habilidadeAtiva: true, // Machine Learning: NÃO dispara ao invocar — ativa em campo, 1x por turno, mesma
    // família de "carta em campo com botão de habilidade" do Agente da DIPSP/Juggernaut,
    // só que aqui alvo é ALIADO (ver ativarHabilidade() em main.js) em vez de inimigo.
  },

  // Adicione novas cartas de monstro especiais aqui, seguindo o mesmo
  // formato acima. O campo "foco" é opcional — se não colocar, usa 0.5/0.5
  // (centro da imagem), sem precisar mexer em nenhum outro lugar do código.
];

// ----------------------------------------------------------------------------
// POOL DE CARTAS DE EFEITO
// ----------------------------------------------------------------------------
// Cada entrada é um "molde" (não tem id ainda — o id é gerado quando o deck
// de teste é montado, em Jogador.criardeckteste(), no main.js).
//
// Para criar uma carta nova, copie um bloco abaixo e ajuste os campos:
//   nome       -> nome exibido na carta
//   poder      -> poder da carta (usado só se ela também pudesse ir a campo;
//                 hoje cartas de efeito nunca vão a campo, mas o valor ainda
//                 aparece no selo da carta)
//   descricao  -> texto de "flavor", mostrado na visualização detalhada
//   efeito     -> { tipo: TIPOS_EFEITO.<algum>, valor: <número> }
// ----------------------------------------------------------------------------
const POOL_CARTAS_EFEITO = [
  {
    nome: "Engenheiro de Elite",
    poder: 3,
    descricao:
      "Um técnico que reforça as defesas de toda a equipe assim que entra em campo.",
    efeito: { tipo: TIPOS_EFEITO.BUFF_ALIADOS, valor: 2 },
  },
  {
    nome: "Vírus Corrosivo",
    poder: 2,
    descricao:
      "Um malware agressivo que corrompe os sistemas inimigos no instante da invasão.",
    efeito: { tipo: TIPOS_EFEITO.DEBUFF_INIMIGOS, valor: 2 },
  },
  {
    nome: "Gerador Portátil",
    poder: 1,
    descricao: "Acessa a rede e extrai dados extras assim que é conectado.",
    efeito: { tipo: TIPOS_EFEITO.COMPRAR_CARTA, valor: 1 },
  },
  {
    nome: "Hacker Fantasma",
    poder: 4,
    descricao:
      "Invade os servidores inimigos e corrompe seus arquivos ao ser ativado.",
    efeito: { tipo: TIPOS_EFEITO.DESCARTAR_CARTA, valor: 1 },
  },
  {
    nome: "Enxame de Drones",
    poder: 2,
    descricao: "Pequenos drones autônomos que reforçam toda a formação aliada.",
    efeito: { tipo: TIPOS_EFEITO.BUFF_ALIADOS, valor: 1 },
  },
  {
    nome: "Pulso EMP",
    poder: 1,
    descricao:
      "Uma sobrecarga elétrica de curto alcance que enfraquece os sistemas inimigos.",
    efeito: { tipo: TIPOS_EFEITO.DEBUFF_INIMIGOS, valor: 3 },
  },

  // Adicione novas cartas de efeito aqui, seguindo o mesmo formato acima.
];

// ----------------------------------------------------------------------------
// CLASSE CARTA
// ----------------------------------------------------------------------------
class Carta {
  constructor(id, poder, tipo, opcoes = {}) {
    this.id = id;
    this.poder = poder;
    this.tipo = tipo; // "monstro" ou "efeito"
    this.nome = opcoes.nome || `Unidade #${id}`;
    this.descricaoFlavor = opcoes.descricao || "";
    this.efeito = opcoes.efeito || null; // efeito passivo, disparado só ao ser invocada
    this.efeitoTurno = opcoes.efeitoTurno || null; // efeito passivo, reavaliado a cada fim de turno em campo
    this.imagem = opcoes.imagem || null; // chave da textura carregada no preload (ver CenaJogo)
    this.foco = opcoes.foco || { x: 0.5, y: 0.5 }; // ponto da imagem centralizado no recorte (ver POOL_CARTAS_MONSTRO)
    this.somAtaque = opcoes.somAtaque || null; // chave do som (preload) tocado quando esta carta ataca
    this.habilidadeAtiva = !!opcoes.habilidadeAtiva; // true = ataque é ativado manualmente em campo, não ao invocar
    this.usadaEsteTurno = false; // trava a habilidade ativa até o próximo turno
  }

  mostrar() {
    console.log(`Carta ID: ${this.id}, Poder: ${this.poder}`);
  }

  buff(valor) {
    // Poder nunca fica negativo, mesmo após vários debuffs
    this.poder = Math.max(0, this.poder + valor);
  }

  // Texto completo mostrado na visualização detalhada da carta
  descricaoCompleta() {
    const partes = [];
    if (this.descricaoFlavor) partes.push(this.descricaoFlavor);
    const textoEfeito = descreverEfeito(this.efeito);
    if (textoEfeito) partes.push(textoEfeito);
    const textoEfeitoTurno = descreverEfeitoTurno(this.efeitoTurno);
    if (textoEfeitoTurno) partes.push(textoEfeitoTurno);
    if (partes.length === 0)
      partes.push("Uma unidade de combate padrão, sem habilidades especiais.");
    return partes.join(" ");
  }
}
