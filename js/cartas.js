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
  REDISTRIBUIR_PODER: "redistribuir_poder", // dono escolhe DUAS cartas aliadas distintas em campo: uma perde poder, a outra ganha
  DESTRUIR_TERRENO_INIMIGO: "destruir_terreno_inimigo", // habilidade ativa, 1x POR PARTIDA (não reseta por turno): elimina um terreno inimigo escolhido
  BUSCAR_CARTA_DECK: "buscar_carta_deck", // ao conjurar: dono escolhe uma carta do próprio baralho e a compra direto pra mão
  ABSORVER_ALIADOS: "absorver_aliados", // dono escolhe ATÉ N cartas aliadas de nível baixo/médio em campo: elas somem, e esta carta ganha o poder somado delas

  // ---- EchoSsystem (booster 2) ----
  RESETAR_PODER: "resetar_poder", // O Boi (Novo Começo): escolhe uma carta aliada em campo e a devolve ao poder original (poderBase), zerando bônus/reduções acumulados
  ATACAR_DOIS_ALVOS: "atacar_dois_alvos", // O Tigre (Garra de aço): igual a ATACAR, mas escolhe DOIS alvos inimigos distintos em vez de um só (mesmo range para os dois)
  OVERRIDE: "override", // A Aranha (Override): escolhe uma carta inimiga com poder MENOR que o dela; a carta é "capturada" pro campo do dono, se houver espaço livre
  ROUBAR_PODER: "roubar_poder", // O Rato (Mãos Leves): escolhe uma carta inimiga em qualquer lugar do campo e rouba poder dela, somando ao próprio poder
  REPOSICIONAR: "reposicionar", // A Cabra (Escalada): troca de lugar com outra carta aliada (ou se move pra um espaço livre) no próprio campo
  REVELAR_CARTAS_INIMIGO: "revelar_cartas_inimigo", // O Cão (Faro): ao ser invocado, revela até N cartas da mão/baralho do inimigo
  CASCA_GROSSA: "casca_grossa", // O Porco (Casca Grossa): passivo permanente — o poder desta carta nunca reduz abaixo do poder original (poderBase), mesmo com múltiplas reduções (ver Carta.buff())
  ENVENENAR: "envenenar", // A Cobra (Dose Letal): escolhe uma carta inimiga em alcance curto (à frente ou espaço adjacente) e a envenena — ela perde poder a cada turno enquanto estiver em campo
};

// O jogo não tem uma tag de "nível" separada por carta — "baixo/médio/alto"
// é só uma forma de falar do PODER dela. ABSORVER_ALIADOS usa um teto de
// poder (efeito.nivelMaximo) pra decidir quem conta como "baixo ou médio":
// cartas com poder MAIOR que o teto (ex: o próprio RaspClay MonteCorp, ou
// o Juggernaut) são "nível alto" e ficam de fora.

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
    case TIPOS_EFEITO.REDISTRIBUIR_PODER:
      return `Habilidade ativa (1x por turno, em campo): escolha uma carta aliada para perder ${efeito.perda} de poder, e outra carta aliada para ganhar +${efeito.ganho} de poder.`;
    case TIPOS_EFEITO.DESTRUIR_TERRENO_INIMIGO:
      return `Habilidade ativa (1x por turno, em campo): escolha um terreno inimigo para ser eliminado.`;
    case TIPOS_EFEITO.BUSCAR_CARTA_DECK:
      return `Ao ser conjurada: escolha uma carta do seu baralho para puxar diretamente para sua mão.`;
    case TIPOS_EFEITO.ABSORVER_ALIADOS:
      return `Ao ser invocada: escolha até ${efeito.maxAlvos} carta${efeito.maxAlvos > 1 ? "s" : ""} aliada${efeito.maxAlvos > 1 ? "s" : ""} de nível baixo ou médio em campo. Elas são removidas do campo, e esta carta ganha poder igual à soma dos poderes delas.`;
    case TIPOS_EFEITO.RESETAR_PODER:
      return `Habilidade ativa (1x por turno, em campo): escolha uma carta aliada em campo para retornar ao seu poder original, perdendo todos os bônus e reduções que tiver recebido.`;
    case TIPOS_EFEITO.ATACAR_DOIS_ALVOS:
      return `Habilidade ativa (1x por turno, em campo): escolha 2 cartas inimigas em alcance curto (H${efeito.rangeH}/V${efeito.rangeV}) para perder ${efeito.valor} de PA cada.`;
    case TIPOS_EFEITO.OVERRIDE:
      return `Habilidade ativa (1x por turno, em campo): escolha uma carta inimiga com poder menor que o desta carta. Ela é capturada para o seu campo, se houver espaço livre.`;
    case TIPOS_EFEITO.ROUBAR_PODER:
      return `Habilidade ativa (1x por turno, em campo): escolha uma carta inimiga em qualquer lugar do campo. Rouba ${efeito.valor} de poder dela, somando esse valor ao próprio poder.`;
    case TIPOS_EFEITO.REPOSICIONAR:
      return `Habilidade ativa (1x por turno, em campo): troque de lugar com outra carta aliada, ou mova-se para um espaço livre do seu campo.`;
    case TIPOS_EFEITO.REVELAR_CARTAS_INIMIGO:
      return `Ao ser invocado: revela até ${efeito.valor} cartas da mão ou do baralho do inimigo.`;
    case TIPOS_EFEITO.CASCA_GROSSA:
      return `Casca Grossa: o poder desta carta nunca pode ser reduzido abaixo do seu valor original.`;
    case TIPOS_EFEITO.ENVENENAR:
      return `Habilidade ativa (1x por turno, em campo): escolha uma carta inimiga em alcance curto (à frente ou em espaço adjacente) para envenenar. Ela perde ${efeito.valor} de poder a cada turno enquanto estiver em campo.`;
    default:
      return "";
  }
}

// ---------- SISTEMA DE EFEITOS DE TERRENO (CONTÍNUOS, ENQUANTO EM CAMPO) ----------
//
// Cartas de terreno: ocupam um espaço normal do campo, têm poder sempre 0
// (não têm PA, não atacam nem podem ser atacadas) e seu efeito fica ativo
// continuamente enquanto a carta estiver em campo (recalculado a cada
// mudança relevante por Partida.resolverEfeitosContinuos(), em main.js).

const TIPOS_EFEITO_CONTINUO = {
  BUFF_CAMPO_CONTINUO: "buff_campo_continuo", // enquanto em campo: cartas aliadas (de um booster, se definido) ganham +poder
  RECUPERAR_DANO_CONTINUO: "recuperar_dano_continuo", // enquanto em campo: aliadas que perderam PA recuperam um pouco ao fim de cada turno
  REVELAR_MAO_CONTINUO: "revelar_mao_continuo", // enquanto em campo: mão do oponente fica revelada
};

function descreverEfeitoContinuo(efeito) {
  if (!efeito) return "";
  switch (efeito.tipo) {
    case TIPOS_EFEITO_CONTINUO.BUFF_CAMPO_CONTINUO:
      return `Enquanto estiver em campo: cartas aliadas${efeito.booster ? ` da ${efeito.booster}` : ""} ganham +${efeito.valor} de PA.`;
    case TIPOS_EFEITO_CONTINUO.RECUPERAR_DANO_CONTINUO:
      return `Enquanto estiver em campo: cartas aliadas que sofreram dano recuperam +${efeito.valor} de PA ao final de cada turno.`;
    case TIPOS_EFEITO_CONTINUO.REVELAR_MAO_CONTINUO:
      return `Enquanto estiver em campo: a mão do oponente permanece revelada.`;
    default:
      return "";
  }
}

// ----------------------------------------------------------------------------
// POOL DE CARTAS DE TERRENO
// ----------------------------------------------------------------------------
// Molde igual aos outros pools: sem id (gerado ao montar deck) e sem "poder"
// (terrenos são sempre 0 PA — ver classe Carta).
// ----------------------------------------------------------------------------
const POOL_CARTAS_TERRENO = [
  {
    nome: "Torre MonteCorp",
    descricao:
      "Recriada no mundo virtual com mais de quatro quilômetros de altura, a Torre MonteCorp permanece como um lembrete constante de que, se a Raspcorp quisesse conquistar os céus, provavelmente encontraria uma forma de monetizá-los.",
    imagem: "torremontecorp",
    efeitoContinuo: {
      tipo: TIPOS_EFEITO_CONTINUO.BUFF_CAMPO_CONTINUO,
      valor: 2,
      booster: "raspcorp",
    },
  },
  {
    nome: "Beira-mar norte de NeoFloripa",
    descricao:
      "Depois que a verdadeira Floripa sucumbiu ao aumento do nível do mar, os nostálgicos decidiram recriá-la no mundo virtual. Ironicamente, continua sendo o jeito mais acessível de morar na ilha. O trânsito, contudo, nem aqui foi resolvido.",
    imagem: "beiramarneofloripa",
    efeitoContinuo: {
      tipo: TIPOS_EFEITO_CONTINUO.RECUPERAR_DANO_CONTINUO,
      valor: 1,
    },
  },
  {
    nome: "Nexus de Dados Global",
    descricao:
      "Responsável por armazenar aproximadamente 99% dos dados da humanidade. Sua destruição foi comparada à queima da Biblioteca de Alexandria, caso ela armazenasse apenas informações pessoais obtidas por meios semilegais. Ainda bem que tudo é salvo na nuvem atualmente.",
    imagem: "nexusneofloripa",
    efeitoContinuo: {
      tipo: TIPOS_EFEITO_CONTINUO.REVELAR_MAO_CONTINUO,
    },
  },

  // Adicione novas cartas de terreno aqui, seguindo o mesmo formato acima.
];

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
    booster: "raspcorp",
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
    booster: "raspcorp",
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
    booster: "raspcorp",
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
    booster: "raspcorp",
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
    booster: "raspcorp",
    efeito: {
      tipo: TIPOS_EFEITO.BUFF_ALIADO_ESCOLHIDO,
      valor: 2,
      custoProprio: 1, // Machine Learning: além de buffar o alvo, o próprio Estagiário perde 1 PA
    },
    habilidadeAtiva: true, // Machine Learning: NÃO dispara ao invocar — ativa em campo, 1x por turno, mesma
    // família de "carta em campo com botão de habilidade" do Agente da DIPSP/Juggernaut,
    // só que aqui alvo é ALIADO (ver ativarHabilidade() em main.js) em vez de inimigo.
  },

  {
    nome: "Gestor de Recursos Predominantemente Humanos",
    poder: 5,
    descricao:
      "Atualmente, funcionários humanos e máquinas compartilham os mesmos benefícios corporativos. Nenhum dos dois está particularmente satisfeito com isso. O RH garante que todas as reclamações sejam igualmente ignoradas.",
    imagem: "rh", // arte ainda não adicionada (ver Cartas_e_boosters.md) — cai no retângulo placeholder
    booster: "raspcorp",
    efeito: {
      tipo: TIPOS_EFEITO.REDISTRIBUIR_PODER,
      perda: 2, // Reestruturação Interna: uma carta aliada escolhida perde 2 PA...
      ganho: 3, // ...e OUTRA carta aliada escolhida ganha 3 PA (dois alvos distintos)
    },
    habilidadeAtiva: true, // Reestruturação Interna: não dispara ao invocar — ativa em campo, 1x por turno
  },

  {
    nome: "Advogado Corporativo",
    poder: 5,
    descricao:
      "Sua principal função é garantir que a Raspcorp permaneça em conformidade com a legislação vigente. Felizmente, ambas costumam ser atualizadas ao mesmo tempo. Ao longo de sua carreira, participou da aquisição de sete empresas, três governos e um incidente que permanece sob sigilo judicial.",
    imagem: "adv",
    booster: "raspcorp",
    efeito: {
      tipo: TIPOS_EFEITO.DESTRUIR_TERRENO_INIMIGO,
    },
    habilidadeAtiva: true,

    // Adicione a linha abaixo:
    somAtaque: "somAdvogado",
  },

  {
    nome: "RaspClay MonteCorp",
    poder: 10,
    descricao:
      'Raspclay trocou seu antigo nome pelo topo dos arranha-céus de Floripa. Atualmente, comanda a irreverente e opressora empresa de tecnologia, serviços, segurança privada e propaganda Raspcorp. Após comprar todos os setores da sociedade, seus advogados passaram a afirmar que a palavra "monopólio" carrega uma conotação desnecessariamente negativa.',
    imagem: "raspclay",
    booster: "raspcorp",
    foco: { x: 0.5, y: 0.05 },
    lendaria: true, // 1x só no deck — visualização detalhada com destaque especial (ver jogo.js)
    efeito: {
      tipo: TIPOS_EFEITO.ABSORVER_ALIADOS,
      maxAlvos: 3, // Potencialização de Capital: até 3 cartas aliadas por ativação
      nivelMaximo: 7, // só absorve cartas de nível baixo ou médio (poder até 7)
    },
    // Potencialização de Capital: efeito passivo normal (dispara ao
    // invocar, como a Venda Casada do CyberVendedor), não é habilidade
    // ativa — mas como pode ter VÁRIOS alvos (não só um), a UI usa um
    // fluxo de seleção próprio com um botão "Confirmar" em vez de resolver
    // no primeiro toque — ver iniciarSelecaoDeAbsorcao() em jogo.js.
  },

  // ---------- EchoSsystem (booster 2) ----------
  // As 3 primeiras cartas do booster 2 a entrar no jogo — escolhidas por já
  // terem arte pronta em assets/cartas/ (ver Cartas_e_boosters.md).

  {
    nome: "O Tigre",
    poder: 9,
    descricao:
      "Repleto de orgulho, o Tigre era o campeão das arenas ilegais do antigo mundo e, nas horas vagas, um mercenário. Quando o velho mundo começou a ser destruído, perdeu sua principal fonte de renda e, principalmente, seu público. Agora, encontrou na EchoSsystem a oportunidade perfeita para construir um novo mundo onde todos possam finalmente reconhecer sua superioridade.",
    imagem: "eltigre",
    booster: "echossystem",
    efeito: {
      tipo: TIPOS_EFEITO.ATACAR_DOIS_ALVOS,
      valor: 3,
      // "Alcance curto": só a coluna imediatamente vizinha (rangeH:1) e a
      // fileira adjacente (rangeV:1) — combate corpo a corpo.
      rangeH: 5,
      rangeV: 1,
    },

    habilidadeAtiva: true, // Garra de aço: não dispara ao invocar — ativa em campo, 1x por turno
    somAtaque: "somTigreAtaque",
  },

  {
    nome: "A Aranha",
    poder: 5,
    descricao:
      "A Aranha é filha do finado fundador da EchoSsystem, “O Dragão”. Proibida pelo pai de participar das missões, foi treinada para invadir sistemas e fornecer suporte tecnológico. Agora, em um mundo virtual, estar atrás de uma tela significa estar em todos os lugares ao mesmo tempo.",
    imagem: "daranha",
    booster: "echossystem",
    efeito: {
      tipo: TIPOS_EFEITO.OVERRIDE,
    },
    // Override: no card original a carta capturada "passa a contar pontos
    // para sua equipe" mas continua fisicamente no campo inimigo. Esse jogo
    // pontua por poder total em cada campo (ver Partida.calcularPoderTotal),
    // sem um conceito de "dono temporário" separado do campo físico — pra
    // não reescrever esse sistema inteiro, a implementação simplifica o
    // efeito para uma CAPTURA de verdade: a carta-alvo é movida pro campo
    // do dono da Aranha (se houver espaço livre), o que já produz o mesmo
    // resultado prático (o poder dela passa a contar pro outro lado).
    habilidadeAtiva: true, // Override: não dispara ao invocar — ativa em campo, 1x por turno
  },

  {
    nome: "O Boi",
    poder: 10,
    descricao:
      "Outrora um trabalhador comum, o Boi perdeu a visão e o emprego em um acidente e foi obrigado a usar um visor vermelho para enxergar. Consumido pelas perdas e pelo vermelho que agora domina seus olhos, reuniu, sob a tutela do mercenário “O Dragão”, outros 10 indivíduos com um objetivo: destruir o mundo e reconstruí-lo da maneira certa, não importa quantas vezes seja necessário.",
    imagem: "oboi",
    booster: "echossystem",
    lendaria: true, // 1x só no deck — visualização detalhada com destaque especial (ver jogo.js)
    efeito: {
      tipo: TIPOS_EFEITO.RESETAR_PODER,
    },
    habilidadeAtiva: true, // Novo Começo: não dispara ao invocar — ativa em campo, 1x por turno
  },

  {
    nome: "O Rato",
    poder: 1,
    descricao:
      "O Rato é o membro mais jovem da EchoSsystem. Sua habilidade de infiltração é tão impressionante que poucos acreditam que ele de fato exista. O mesmo não pode ser dito sobre as piadas envolvendo seu nome, que aparecem em praticamente todas as reuniões do grupo.",
    imagem: "rato", // arte ainda não adicionada — cai no placeholder até assets/cartas/O_rato.png existir
    foco: { x: 0.5, y: 0.15 },
    booster: "echossystem",
    efeito: {
      tipo: TIPOS_EFEITO.ROUBAR_PODER,
      valor: 1,
    },
    habilidadeAtiva: true, // Mãos Leves: não dispara ao invocar — ativa em campo, 1x por turno
  },

  {
    nome: "A Cabra",
    poder: 3,
    descricao:
      "A Cabra era ginasta olímpica antes da humanidade decidir que esportes tradicionais deixaram de ser uma profissão. Hoje, ela continua escalando estruturas gigantescas, mas finalmente encontrou um público que realmente valoriza seu trabalho: a equipe de segurança do último andar da torre MonteCorp.",
    imagem: "cabra", // arte ainda não adicionada — cai no placeholder até assets/cartas/A_cabra.png existir
    foco: { x: 0.5, y: 0.8 }, // arte ainda não adicionada — cai no placeholder até assets/cartas/A_cabra.png existir
    booster: "echossystem",
    efeito: {
      tipo: TIPOS_EFEITO.REPOSICIONAR,
    },
    habilidadeAtiva: true, // Escalada: não dispara ao invocar — ativa em campo, 1x por turno
  },

  {
    nome: "O Cão",
    poder: 4,
    descricao:
      "Antes mesmo de entrar para o grupo anarquista, o Cão já era um mercenário especializado em rastrear alvos. Seus implantes cibernéticos de olfato permitem encontrar praticamente qualquer pessoa pelo menor dos rastros. O único problema é que a idade já está afetando seus sentidos: recentemente, ele passou três horas seguindo o próprio cheiro.",
    imagem: "cao", // arte ainda não adicionada — cai no placeholder até assets/cartas/O_cão.png existir
    foco: { x: 0.5, y: 0.9 },
    booster: "echossystem",
    efeito: {
      tipo: TIPOS_EFEITO.REVELAR_CARTAS_INIMIGO,
      valor: 5,
    },
    // Faro: efeito passivo normal (dispara ao invocar), não é habilidade
    // ativa — mesma família de BUFF_ALIADOS/DEBUFF_INIMIGOS.
  },

  {
    nome: "O Porco",
    poder: 6,
    descricao:
      "O Porco acredita que nenhum trabalho é nojento demais. Entre esgotos, lixões industriais e montanhas de sucata, tornou-se especialista em encontrar recursos onde ninguém mais pisaria. Anos de exposição aos ambientes mais inóspitos de NeoFloripa fizeram seu corpo desenvolver uma resistência impressionante. Felizmente, o olfato também foi perdido no processo.",
    imagem: "porco", // arte ainda não adicionada — cai no placeholder até assets/cartas/O_porco.png existir
    booster: "echossystem",
    efeito: {
      tipo: TIPOS_EFEITO.CASCA_GROSSA,
    },
    // Casca Grossa: passivo permanente, sem gatilho — não dispara ao
    // invocar nem é habilidade ativa. O piso é resolvido direto em
    // Carta.buff() (abaixo): reduções normais, mas nunca abaixo de 6 (o
    // poderBase dela).
  },

  {
    nome: "A Cobra",
    poder: 5,
    descricao:
      "A Cobra é uma lendária produtora de venenos que nunca perguntou quem era o cliente, desde que ele pagasse o suficiente. Quando seus próprios compradores decidiram eliminá-la, ela finalmente percebeu que talvez fosse hora de escolher melhor seus parceiros. Agora, ao lado da EchoSsystem, pretende fazer cada um deles provar do próprio veneno.",
    imagem: null, // arte ainda não adicionada — cai no placeholder até assets/cartas/Cobra.png existir
    booster: "echossystem",
    efeito: {
      tipo: TIPOS_EFEITO.ENVENENAR,
      valor: 1,
      rangeH: 2,
      rangeV: 1,
    },
    habilidadeAtiva: true, // Dose Letal: não dispara ao invocar — ativa em campo, 1x por turno
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

  {
    nome: "Sugestão Algorítmica",
    poder: 1,
    descricao:
      "Após analisar seu histórico de compras, pesquisas e sonhos recorrentes, o algoritmo preparou uma sugestão especialmente para você. Foi você que aceitou todos os cookies...",
    // Provisória: reaproveita a arte do Gestor de RH até ter uma própria.
    imagem: "sugalg",
    efeito: { tipo: TIPOS_EFEITO.BUSCAR_CARTA_DECK },
  },

  // Adicione novas cartas de efeito aqui, seguindo o mesmo formato acima.
];

// ----------------------------------------------------------------------------
// CLASSE CARTA
// ----------------------------------------------------------------------------
class Carta {
  constructor(id, poder, tipo, opcoes = {}) {
    this.id = id;
    // Terreno: ocupa espaço normal do campo, mas nunca tem PA.
    this.poder = tipo === "terreno" ? 0 : poder;
    this.tipo = tipo; // "monstro", "efeito" ou "terreno"
    this.nome = opcoes.nome || `Unidade #${id}`;
    this.descricaoFlavor = opcoes.descricao || "";
    this.efeito = opcoes.efeito || null; // efeito passivo, disparado só ao ser invocada
    this.efeitoTurno = opcoes.efeitoTurno || null; // efeito passivo, reavaliado a cada fim de turno em campo
    this.efeitoContinuo = opcoes.efeitoContinuo || null; // terreno: efeito ativo continuamente enquanto em campo
    this.booster = opcoes.booster || null; // ex: "raspcorp" — usado por efeitos contínuos que filtram por booster
    this.imagem = opcoes.imagem || null; // chave da textura carregada no preload (ver CenaJogo)
    this.foco = opcoes.foco || { x: 0.5, y: 0.5 }; // ponto da imagem centralizado no recorte (ver POOL_CARTAS_MONSTRO)
    this.somAtaque = opcoes.somAtaque || null; // chave do som (preload) tocado quando esta carta ataca
    this.habilidadeAtiva = !!opcoes.habilidadeAtiva; // true = ataque é ativado manualmente em campo, não ao invocar
    this.lendaria = !!opcoes.lendaria; // true = visualização detalhada com destaque especial dourado (ver mostrarDetalheCarta, em jogo.js)
    this.usadaEsteTurno = false; // trava a habilidade ativa até o próximo turno
    this.usadaNaPartida = false; // trava habilidades "1x por jogo" (ex: Cessar e Desistir) até o fim da partida, sem resetar por turno
    this.poderBase = this.poder; // teto de recuperação (ex: terreno Beira-mar) e base p/ bônus de terreno
    this.bonusTerreno = 0; // soma de bônus contínuos aplicados por terrenos (revertida/reaplicada a cada recálculo)
    this.envenenada = null; // Dose Letal (A Cobra): { valor } enquanto envenenada — perde poder a cada turno (ver Partida.resolverEfeitosDeTurno)
  }

  mostrar() {
    console.log(`Carta ID: ${this.id}, Poder: ${this.poder}`);
  }

  buff(valor) {
    // Casca Grossa (O Porco): reduções normais, mas o poder nunca desce
    // abaixo do valor original (poderBase) — ganhos continuam sem teto.
    if (
      valor < 0 &&
      this.efeito &&
      this.efeito.tipo === TIPOS_EFEITO.CASCA_GROSSA
    ) {
      this.poder = Math.max(this.poderBase, this.poder + valor);
      return;
    }
    // Poder nunca fica negativo, mesmo após vários debuffs
    this.poder = Math.max(0, this.poder + valor);
  }

  // Texto completo mostrado na visualização detalhada da carta
  descricaoCompleta() {
    return this.partesDescricao()
      .map((p) => p.texto)
      .join(" ");
  }

  // Igual a descricaoCompleta(), mas separado em partes com a tag "flavor"
  // (texto de ambientação) ou "efeito" (regra de jogo) — usado pra colorir
  // cada trecho de forma diferente na visualização detalhada (ver jogo.js).
  partesDescricao() {
    const partes = [];
    if (this.descricaoFlavor)
      partes.push({ texto: this.descricaoFlavor, tipo: "flavor" });
    const textoEfeito = descreverEfeito(this.efeito);
    if (textoEfeito) partes.push({ texto: textoEfeito, tipo: "efeito" });
    const textoEfeitoTurno = descreverEfeitoTurno(this.efeitoTurno);
    if (textoEfeitoTurno)
      partes.push({ texto: textoEfeitoTurno, tipo: "efeito" });
    const textoEfeitoContinuo = descreverEfeitoContinuo(this.efeitoContinuo);
    if (textoEfeitoContinuo)
      partes.push({ texto: textoEfeitoContinuo, tipo: "efeito" });
    if (partes.length === 0)
      partes.push({
        texto: "Uma unidade de combate padrão, sem habilidades especiais.",
        tipo: "flavor",
      });
    return partes;
  }
}
