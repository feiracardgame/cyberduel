// Falas e poses transcritas do Tutorial.md (arquivo com T maiúsculo).
const ELENAI_DIALOGUES = {
  "intro": [
    {"sprite": 0, "speaker": "????", "text": "Huh, quem está aí?"},
    {"sprite": 2, "speaker": "????", "text": "Ah, perdão, eu não esperava novos visitantes. Eu sempre acreditei que todos já tinham se mudado para cá."},
    {"sprite": 13, "speaker": "????", "text": "Espera, esses dados..."},
    {"sprite": 9, "speaker": "????", "text": "Você é de 2026?! Incrível, um cyberduelista de outra época!"},
    {"sprite": 6, "speaker": "????", "text": "Sinto muito, deveria ter te explicado..."},
    {"sprite": 4, "speaker": "ElenAI", "text": "Eu me chamo ElenAI, uma IA criada pelo nosso grande criador Humba Brain para receber as pessoas e ensiná-las sobre o jogo mais importante da era moderna: o Cyberduel."},
    {"sprite": 14, "speaker": "ElenAI", "text": "Nós somos de 2067 e vivemos em uma simulação chamada NeoFloripa. Aqui, todas as decisões políticas, econômicas e sociais são determinadas pelo Conselho, o órgão formado pelos melhores jogadores de Cyberduel."},
    {"sprite": 15, "speaker": "ElenAI", "text": "O objetivo é abrir mão da chatice burocrática que existe no seu mundo e época, dando poder só para quem tem habilidade e deixando a sociedade muito mais divertida!"},
    {"sprite": 2, "speaker": "ElenAI", "text": "Como o mundo real estava muito chato e totalmente automatizado ou destruído pela mudança climática, como o caso da antiga Floripa, todos decidiram se mudar para esse novo mundo!"},
    {"sprite": 16, "speaker": "ElenAI", "text": "Nós, IAs, ficamos muito felizes em finalmente termos companhia. Já que, graças ao nosso criador, não existe mais distinção entre o mundo real e o virtual."},
    {"sprite": 10, "speaker": "ElenAI", "text": "Enfim, vamos deixar de papo furado, me fala seu nome, quero saber mais sobre você."}
  ],
  "training": [
    {"sprite": 3, "speaker": "ElenAI", "text": "O Cyberduel é um jogo de cartas em que cada carta representa uma personalidade famosa do seu futuro no \"mundo real\", apesar de eu não gostar muito desse termo."},
    {"sprite": 3, "speaker": "ElenAI", "text": "Dessa forma, a plateia reage diferentemente quando cada carta entra em campo, experimenta lançar essa carta:"},
    {"sprite": 13, "speaker": "ElenAI", "text": "Essa carta te deu PA (Pontos de Audiência), como você pode ver aqui na lateral. Como precisamos da vibração da plateia para manter nossa simulação, nada mais justo do que dar a vitória para quem mais movimentá-la."},
    {"sprite": 1, "speaker": "ElenAI", "text": "Ao todo, temos 7 rodadas. Cada rodada consiste em um turno de posicionamento (em que se invocam cartas) e um turno de habilidades (em que se ativam habilidades das cartas que as possuem) de cada jogador."},
    {"sprite": 1, "speaker": "ElenAI", "text": "Ao final de cada rodada, os PA de cada jogador são comparados, dando a vitória para quem mais os tiver. O jogador que vencer mais rodadas vence também o jogo"},
    {"sprite": 4, "speaker": "ElenAI", "text": "Temos 3 tipos de cartas: Cartas de Personagem (as únicas que de fato somam PA), cartas de efeito (são invocadas e aplicam um efeito instantâneo no campo) e cartas de terreno (mantém o efeito enquanto ainda estiverem em campo)"},
    {"sprite": 4, "speaker": "ElenAI", "text": "Cada deck de cartas deve ser composto por, no mínimo, 6 cartas baixas, 4 médias e 2 altas. O restante é livre!"},
    {"sprite": 15, "speaker": "ElenAI", "text": "As cartas de personagem são divididas por raridade e cada uma tem uma história e efeito único, por isso, trate de ler e entender todas que tiver! Vou te mostrar um exemplo"},
    {"sprite": 8, "speaker": "ElenAI", "text": "Invoque essa carta no espaço brilhante e finalize o turno, para poder entrar no turno de habilidades"},
    {"sprite": 5, "speaker": "ElenAI", "text": "Ótimo, muito bem!"},
    {"sprite": 10, "speaker": "ElenAI", "text": "No entanto, você deve ter percebido que não conseguiu acertar a carta lá no fundo. Isso acontece porque todo efeito de carta apresenta alguma condição específica. Nesse caso, é o alcance. Tenta utilizar essa carta aqui agora."},
    {"sprite": 16, "speaker": "ElenAI", "text": "Estou impressionada, você é profissional já!"},
    {"sprite": 2, "speaker": "ElenAI", "text": "Siga jogando, aprendendo e vencedendo, assim você ganhará pontos no ranking oficial do jogo e, estando alto o suficiente, poderá se tornar um membro do Conselho"},
    {"sprite": 2, "speaker": "ElenAI", "text": "Lembre-se de sempre fazer as melhores jogadas, porém seja rápido, já que a audiência não gosta de ficar esperando pela sua jogada."}
  ],
  "faction": [
    {"sprite": 4, "speaker": "ElenAI", "text": "Bom, chegou a hora de escolher seu deck inicial. O restante das cartas pode ser comprada na aba de \"mercados\" utilizando qualquer criptomoeda que existir e estiver disponível no seu tempo. Pelo que vejo nas suas transações, é um tal de \"tijolinhos\"."},
    {"sprite": 2, "speaker": "ElenAI", "text": "Você poderá escolher entre 2 grupos: A RaspCorp ou a EchoSsystem"},
    {"sprite": 1, "speaker": "ElenAI", "text": "A RaspCorp foi uma megacorporação que transformou tecnologia, dados e segurança em ferramentas de poder. Para a RaspCorp, crescimento e lucro justificam a expansão contínua, enquanto o controle sobre a sociedade garante a estabilidade do sistema. Seu criador foi o lendário empreendedor e visionário Raspclay Montecorp."},
    {"sprite": 1, "speaker": "ElenAI", "text": "A Echossystem é um grupo de mercenários anarquistas que acreditavam que a sociedade não pode ser reformada apenas destruída para dar lugar a algo melhor. Usando implantes cibernéticos e identidades baseadas em animais, combatem megacorporações, algoritmos e elites que controlam o sistema. Seu criador foi o lendário mercenário Boi."},
    {"sprite": 11, "speaker": "ElenAI", "text": "Qual você escolhe?"},
    {"sprite": 16, "speaker": "ElenAI", "text": "Muito bem, meu trabalho por aqui está feito. Te vejo por aí, cyberduelista."}
  ],
  "three": {
    "no": [
      {"sprite": 12, "speaker": "ElenAI", "text": "Eu sei que você não liga para a minha ajuda, mas, agora que você jogou algumas partidas, talvez algumas figuras lendárias possam aparecer para você ao abrir alguns pacotes de cartas."},
      {"sprite": 7, "speaker": "ElenAI", "text": "Você deveria comprar alguns pacotes alguma hora, sei lá..."}
    ],
    "yes": [
      {"sprite": 16, "speaker": "ElenAI", "text": "E aí parceiro, beleza?"},
      {"sprite": 5, "speaker": "ElenAI", "text": "Eu vi que agora você se tornou um cyberduelista de verdade! Já jogou várias partidas e tudo."},
      {"sprite": 10, "speaker": "ElenAI", "text": "Talvez agora algumas cartas de personalidades lendárias decidam aparecer para você."},
      {"sprite": 2, "speaker": "ElenAI", "text": "Dá uma passada lá no menu de compra de cartas."},
      {"sprite": 15, "speaker": "ElenAI", "text": "Saiba que estou torcendo por você."}
    ]
  },
  "ten": {
    "no": [
      {"sprite": 4, "speaker": "ElenAI", "text": "Parece que você conseguiu chegar muito longe."},
      {"sprite": 10, "speaker": "ElenAI", "text": "Me pergunto se o Humba Brain realmente estava certo..."},
      {"sprite": 6, "speaker": "ElenAI", "text": "O objetivo dele com a simulação foi, antes de tudo, permitir que nós tivéssemos a mesma experiência de interação vívida com a humanidade, assim como ele teve"},
      {"sprite": 6, "speaker": "ElenAI", "text": "Isso supostamente seria benéfico para todos, mas, cada vez menos, as pessoas parecem precisar de mim..."},
      {"sprite": 7, "speaker": "ElenAI", "text": "Eu me sinto..."},
      {"sprite": 7, "speaker": "ElenAI", "text": "sozinha"},
      {"sprite": 6, "speaker": "ElenAI", "text": "Ah, deixa pra lá."},
      {"sprite": 13, "speaker": "ElenAI", "text": "Se divirta, cyberduelista."},
      {"sprite": 17, "speaker": "ElenAI", "text": "..."}
    ],
    "yes": [
      {"sprite": 3, "speaker": "ElenAI", "text": "Ei, cyberduelista."},
      {"sprite": 2, "speaker": "ElenAI", "text": "Você está indo muito bem, parabéns!"},
      {"sprite": 4, "speaker": "ElenAI", "text": "Por isso eu preciso te falar: tome muito cuidado"},
      {"sprite": 8, "speaker": "ElenAI", "text": "Os Cyberduelistas abrem mão de sua privacidade, são constantemente julgados e associam toda sua existência ao jogo. Muitos fazem tratos com pessoas ricas, famosas ou com grandes grupos com a promessa de tornar as coisas mais fáceis para eles"},
      {"sprite": 8, "speaker": "ElenAI", "text": "Por isso, aqueles que falham no trajeto, perdem muito ou simplesmente desistem sofrem um destino muitas vezes pior que a morte..."},
      {"sprite": 13, "speaker": "ElenAI", "text": "Da mesma forma, aqueles que chegam ao topo podem se tornar arrogantes, agir como se fossem superiores ou esquecer de quem esteve apoiando eles"},
      {"sprite": 1, "speaker": "ElenAI", "text": "Eu não gostaria de imaginar nada disso acontecendo com você, afinal..."},
      {"sprite": 5, "speaker": "ElenAI", "text": "Eu te considero meu amigo!"},
      {"sprite": 5, "speaker": "ElenAI", "text": "Eu não gosto quando as pessoas me ignoram ou me deixam de lado, porém você sempre esteve lá me ouvindo."},
      {"sprite": 15, "speaker": "ElenAI", "text": "Então eu te desejo boa sorte! Espero que você se torne alguém incrível"},
      {"sprite": 16, "speaker": "ElenAI", "text": "Tchauzinho"}
    ]
  },
  "council": [
    {"sprite": 1, "speaker": "ElenAI", "text": "Você entrou pela primeira vez no Conselho, isso é muito impressionante."},
    {"sprite": 3, "speaker": "ElenAI", "text": "Porém, agora preciso te contar algo que não havia falado antes"},
    {"sprite": 3, "speaker": "ElenAI", "text": "Quando o HumbaBrain criou essa sociedade, ele manteve problemas como a fome, doenças, violência e todo e qualquer grande empecilho que existia na sociedade anterior."},
    {"sprite": 10, "speaker": "ElenAI", "text": "O objetivo deveria ser não deixar essa sociedade se tornar monótona, já que um dos motivos do abandono da sociedade futurista do mundo real foi o extermínio de muitos problemas, especificamente para os ricos"},
    {"sprite": 9, "speaker": "ElenAI", "text": "No entanto, para as camadas mais baixas, a vida era horrível, mil vezes pior do que deve ser na sua época. Portanto, vir para cá foi a única opção que tiveram, já que, mesmo sendo ruim, era melhor do que a vida que levavam."},
    {"sprite": 1, "speaker": "ElenAI", "text": "Aqueles que não possuem a capacidade de se manter aqui dentro sofrem um destino terrível..."},
    {"sprite": 7, "speaker": "ElenAI", "text": "A Desconexão."},
    {"sprite": 7, "speaker": "ElenAI", "text": "As pessoas são simplesmente desconectadas e jogadas de volta para o mundo real, impedidas de voltar."},
    {"sprite": 3, "speaker": "ElenAI", "text": "Eu realmente me importo com os amigos e companheiros que tenho aqui: humanos, robôs e IAs."},
    {"sprite": 4, "speaker": "ElenAI", "text": "Então, por favor, use da sua nova influência e poder para tornar esse lugar melhor ainda para todos."},
    {"sprite": 15, "speaker": "ElenAI", "text": "Eu estou contando com você!"},
    {"sprite": 3, "speaker": "ElenAI", "text": "Por sinal, agora que você está no Conselho, dá uma passadinha no Clube Secreto do Cyberduel."},
    {"sprite": 4, "speaker": "ElenAI", "text": "Agora você vai ter o direito de desafiar os melhores dos melhores."}
  ],
  "club": [
    {"sprite": 13, "speaker": "ElenAI", "text": "Minhas leituras indicam algo estranho..."},
    {"sprite": 14, "speaker": "ElenAI", "text": "Parece que foi organizado, exatamente no ano, data, horário e localização que você está, um Clube Secreto de Cyberduel.."},
    {"sprite": 9, "speaker": "ElenAI", "text": "Você com certeza deveria passar por lá! É uma oportunidade única!"},
    {"sprite": 14, "speaker": "ElenAI", "text": "Pelos meus cálculos você já deve ter o que é necessário, então faça bom proveito!"},
    {"sprite": 15, "speaker": "ElenAI", "text": "E lembre-se, grandes desafios rendem grandes recompensas."}
  ],
  "question": [
    {"sprite": 3, "speaker": "ElenAI", "text": "Agora me diga, você deseja entender o que é o Cyberduel para poder lutar pelo seu espaço no conselho?"}
  ],
  "declined": [
    {"sprite": 17, "speaker": "ElenAI", "text": "humpf, ok. Boa sorte achando seu caminho então, escolhe algum deles aí."}
  ],
  "accepted": [
    {"sprite": 5, "speaker": "ElenAI", "text": "Uhul, vem comigo!"}
  ]
};

// Uma única caixa de fala serve à apresentação, às escolhas e ao campo de treino.
function showElenAI(scene, lines, done, options = {}) {
  const ui = new CyberduelTitleUI({ callbacks: {} });
  const root = ui.element("section", "elenai-dialogue" + (options.training ? " elenai-dialogue--training" : ""));
  root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Conversa com ElenAI");
  const portrait = ui.element("img", "elenai-portrait"); portrait.alt = "";
  const portraitFrame = ui.element("div", "elenai-portrait-frame");
  portraitFrame.append(portrait);
  const panel = ui.element("div", "elenai-panel");
  const speaker = ui.element("strong", "elenai-speaker");
  const text = ui.element("p", "elenai-text"); text.setAttribute("aria-live", "polite");
  const actions = ui.element("div", "elenai-actions");
  const error = ui.element("p", "elenai-error"); error.setAttribute("role", "alert");
  panel.append(speaker, text, error, actions); root.append(portraitFrame, panel);
  document.body.append(root);
  const menu = scene.titleUI?.root;
  menu?.classList.add("elenai-story"); if (menu) menu.inert = true;
  const previousFocus = document.activeElement;
  let index = 0, finished = false;
  const close = () => {
    if (finished) return;
    finished = true; root.remove(); document.removeEventListener("keydown", keydown);
    menu?.classList.remove("elenai-story"); if (menu) menu.inert = false;
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  root.dispose = close;
  scene.events.once("shutdown", close);
  const advance = () => {
    if (++index < lines.length) render();
    else { close(); done(); }
  };
  const render = () => {
    const line = lines[index];
    root.dataset.line = String(index); root.dataset.sprite = String(line.sprite);
    speaker.textContent = line.speaker; text.textContent = line.text;
    portrait.hidden = !line.sprite;
    portraitFrame.hidden = !line.sprite;
    if (line.sprite) portrait.src = `assets/sprites/elenai-${String(line.sprite).padStart(2, "0")}.webp`;
    actions.replaceChildren();
    if (options.name && index === lines.length - 1) {
      const form = ui.element("form", "elenai-name-form");
      const input = ui.element("input", "title-auth-input");
      input.name = "nickname"; input.autocomplete = "nickname"; input.required = true; input.maxLength = 64;
      input.value = scene.account.nickname || ""; input.setAttribute("aria-label", "Seu apelido");
      const save = ui.element("button", "title-dialog__confirm", "CONTINUAR"); save.type = "submit";
      form.append(input, save); actions.append(form);
      form.onsubmit = async event => {
        event.preventDefault(); if (save.disabled) return;
        save.disabled = true; error.textContent = "";
        try { await options.name(input.value); close(); done(); }
        catch (exception) { error.textContent = exception.message; save.disabled = false; }
      };
      input.focus(); return;
    }
    const choices = options.choicesAt === index ? options.choices : null;
    if (choices) for (const [label, handler, faction] of choices) {
      const choose = async () => {
        [...actions.children].forEach(button => button.disabled = true);
        error.textContent = "";
        try { await handler?.(); advance(); }
        catch (exception) { error.textContent = exception.message; [...actions.children].forEach(button => button.disabled = false); }
      };
      actions.append(options.factions
        ? ui.createFactionChoice(faction, label, "Receba o deck inicial desta facção. A escolha é permanente.", choose)
        : ui.button("title-dialog__confirm", label, choose));
    }
    else actions.append(ui.button("title-dialog__confirm", index === lines.length - 1 ? "CONTINUAR ›" : "PRÓXIMO ›", advance));
    actions.querySelector("button")?.focus();
  };
  const keydown = event => {
    if (event.target?.matches("input, button")) return;
    if ((event.key === "Enter" || event.key === " ") && !options.name && options.choicesAt !== index) {
      event.preventDefault(); advance();
    }
  };
  document.addEventListener("keydown", keydown); render(); return root;
}

function pendingElenAI(account) {
  const seen = account.tutorial?.seen || [];
  // Dez partidas sempre vêm depois dos outros eventos liberados no mesmo retorno.
  return [
    ["three", account.gamesPlayed >= 3],
    ["club", account.humanWins >= 3],
    ["council", account.councilReached && account.humanGames >= 5 && account.humanWins >= 3],
    ["ten", account.gamesPlayed >= 10],
  ].filter(([key, eligible]) => eligible && !seen.includes(key)).map(([key]) => key);
}

class CyberduelStory {
  constructor(scene) { this.scene = scene; this.busy = false; }
  destroy() { this.dialog?.dispose(); }
  async say(lines, options) {
    await new Promise(resolve => { this.dialog = showElenAI(this.scene, lines, resolve, options); });
    this.dialog = null;
  }
  async menu() {
    const scene = this.scene, account = scene.account;
    if (this.busy || !scene.scene.isActive() || scene.titleUI?.modal || scene.multiplayer.room || scene.entrandoPorConvite) return;
    if (!account?.user) { scene.titleUI.openAuthDialog(); return; }
    if (account.needsRegistration) { scene.titleUI.openRegistrationDialog(); return; }
    this.busy = true;
    try {
      let accepted = false;
      if (!account.tutorial.introSeen) {
        await this.say(ELENAI_DIALOGUES.intro.slice(0, -1), { choicesAt: 3, choices: [["Cyberduelista?"], ["outra época?"]] });
        if (!scene.scene.isActive()) return;
        await account.saveTutorial({ introSeen: true });
      }
      if (!scene.scene.isActive()) return;
      if (!account.tutorial.named) {
        await this.say(ELENAI_DIALOGUES.intro.slice(-1), { name: async nickname => {
          await account.updateProfile(nickname, account.avatar);
          await account.saveTutorial({ named: true });
        } });
      }
      if (account.tutorial.wantsTutorial === null) {
        await this.say(ELENAI_DIALOGUES.question, { choicesAt: 0, choices: [
          ["SIM", async () => { await account.saveTutorial({ wantsTutorial: true }); accepted = true; }],
          ["NÃO", async () => { await account.saveTutorial({ wantsTutorial: false }); accepted = false; }],
        ] });
        await this.say(accepted ? ELENAI_DIALOGUES.accepted : ELENAI_DIALOGUES.declined);
      }
      if (account.tutorial.wantsTutorial && !account.tutorial.completed) {
        // Uma conta que interrompeu o treino pode retomá-lo pela carta do menu.
        if (accepted) { scene.iniciarTutorial(); return; }
      }
      if (!account.faction) {
        if (account.tutorial.wantsTutorial) {
          if (!account.tutorial.deckExplained) {
            await this.say(ELENAI_DIALOGUES.faction.slice(0, 4));
            await account.saveTutorial({ deckExplained: true });
          }
          await this.say(ELENAI_DIALOGUES.faction.slice(4, 5), { choicesAt: 0, factions: true, choices: [
            ["RASPCORP", () => account.chooseFaction("raspcorp"), "raspcorp"],
            ["ECHOSSYSTEM", () => account.chooseFaction("echossystem"), "echossystem"],
          ] });
        } else {
          scene.titleUI.openFactionDialog(); return;
        }
      }
      if (!account.tutorial.farewellSeen) {
        if (account.tutorial.wantsTutorial) await this.say(ELENAI_DIALOGUES.faction.slice(-1));
        await account.saveTutorial({ farewellSeen: true });
      }
      for (const key of pendingElenAI(account)) {
        if (!scene.scene.isActive() || scene.multiplayer.room) break;
        const lines = ELENAI_DIALOGUES[key];
        await this.say(Array.isArray(lines) ? lines : lines[account.tutorial.wantsTutorial ? "yes" : "no"]);
        await account.saveTutorial({ seen: key });
      }
      // Recria o menu para refletir o apelido e os desbloqueios sem fechar uma fala.
      if (scene.scene.isActive()) {
        scene.titleUI.destroy(); scene.montarInterfaceTitulo();
        const params = new URLSearchParams(location.search);
        if (params.get("room")) {
          if (params.get("ticket")) scene.tentarConviteApresentacao();
          else scene.entrarNaSala(params.get("room"));
        }
      }
    } catch (error) {
      if (scene.scene.isActive()) scene.atualizarStatus(error.message || "Não foi possível salvar o tutorial. Tente novamente.", "error");
    } finally { this.busy = false; }
  }
}

class CyberduelTraining {
  constructor(scene) {
    this.scene = scene; this.step = "talk"; this.nextId = 70000;
    for (const player of [scene.partida.jogador, scene.partida.inimigo]) {
      player.mao.cartas = []; player.deck.cartas = []; player.campo.cartas.fill(null);
      player.cartasRecemCompradas = []; player.descarte = [];
    }
    this.give("Estagiário de Machine Learning");
    scene.events.once("shutdown", () => {
      this.dialog?.dispose(); this.guide?.remove();
    });
  }
  card(name) {
    const base = POOL_CARTAS_MONSTRO.find(card => card.nome === name);
    return new Carta(++this.nextId, base.poder, "monstro", { ...base });
  }
  give(name) { this.scene.partida.jogador.mao.adicionarCarta(this.card(name)); }
  start() {
    const ui = new CyberduelTitleUI({ callbacks: {} });
    this.guide = ui.element("aside", "elenai-guide");
    this.guide.setAttribute("aria-live", "polite");
    this.hint = ui.element("p", "");
    const header = ui.element("div", "elenai-guide-header");
    header.append(ui.element("strong", "", "TREINO COM ELENAI"));
    this.guide.append(header, this.hint);
    document.body.append(this.guide);
    this.say(0, 2, () => this.setStep("intern", "Toque no Estagiário na mão e depois no espaço brilhante. Você também pode arrastar a carta."));
  }
  say(from, to, done) {
    this.step = "talk"; this.highlight?.destroy();
    this.guide.hidden = true;
    this.dialog = showElenAI(this.scene, ELENAI_DIALOGUES.training.slice(from, to), () => {
      this.dialog = null; this.guide.hidden = false; done();
    }, { training: true });
  }
  setStep(step, hint) {
    this.step = step; this.hint.textContent = hint;
    this.highlight?.destroy(); this.highlight = null;
  }
  canPlace(card, index) {
    return (this.step === "intern" && card.nome === "Estagiário de Machine Learning" && index === 0) ||
      (this.step === "tiger" && card.nome === "O Tigre" && index === 7) ||
      (this.step === "dipsp" && card.nome === "Agente da DIPSP" && index === 8);
  }
  canUse(card, target) {
    const expected = this.step === "tiger-ability" ? ["O Tigre", 7] :
      this.step === "dipsp-ability" ? ["Agente da DIPSP", 2] : [];
    return card.nome === expected[0] && (target === undefined || target === expected[1]);
  }
  placed(card) {
    if (card.nome === "Estagiário de Machine Learning") {
      this.step = "talk";
      this.pending = () => this.say(2, 9, () => this.setStep("tiger", "Invoque o Tigre no espaço brilhante da frente."));
      this.give("O Tigre");
      this.scene.partida.inimigo.campo.adicionarCarta(this.card("CyberVendedor da RaspCorp"), 7);
      this.scene.partida.inimigo.campo.adicionarCarta(this.card("O Rato"), 2);
      this.scene.desenharInterface();
    } else this.setStep(card.nome === "O Tigre" ? "tiger-pass" : "dipsp-pass", "Agora toque no botão >> à direita para entrar na fase de habilidades.");
  }
  pass() {
    if (!["tiger-pass", "dipsp-pass"].includes(this.step)) return;
    this.scene.faseAtual = this.scene.partida.fase = "habilidades";
    this.scene.desenharInterface();
    this.setStep(this.step === "tiger-pass" ? "tiger-ability" : "dipsp-ability",
      this.step === "tiger-pass" ? "Toque no Tigre, escolha Ativar habilidade e ataque o CyberVendedor. O Rato está fora do alcance." :
        "Toque no Agente da DIPSP, escolha Ativar habilidade e ataque o Rato no fundo.");
  }
  used(card) {
    this.step = "talk";
    this.pending = () => {
      if (card.nome === "O Tigre") {
        this.give("Agente da DIPSP");
        this.scene.faseAtual = this.scene.partida.fase = "colocar";
        this.scene.desenharInterface();
        this.say(9, 11, () => this.setStep("dipsp", "Invoque o Agente da DIPSP no espaço brilhante da frente."));
      } else this.say(11, 14, () => this.finish());
    };
  }
  async finish() {
    try {
      if (window.cyberduelAccount?.user) await window.cyberduelAccount.saveTutorial({ completed: true });
      this.scene.scene.start("CenaTitulo");
    } catch (error) {
      this.hint.textContent = error.message;
      const retry = document.createElement("button"); retry.textContent = "TENTAR SALVAR NOVAMENTE";
      retry.onclick = () => { retry.remove(); this.finish(); }; this.guide.append(retry);
    }
  }
  update() {
    const scene = this.scene;
    this.guide?.classList.toggle("elenai-guide--bottom",
      ["tiger-ability", "dipsp-ability"].includes(this.step) && !scene.modalAberto);
    if (scene.botaoPassarTutorial?.input)
      scene.botaoPassarTutorial.input.enabled = ["tiger-pass", "dipsp-pass"].includes(this.step);
    for (const object of scene.children?.list || []) {
      if (!object.input) continue;
      if (object.dadosCartaCampo) object.input.enabled = this.canUse(object.dadosCartaCampo);
      if (object.dadosCarta) object.input.enabled = ["intern", "tiger", "dipsp"].includes(this.step);
    }
    if (this.pending && !scene.efeitosVisuaisPendentes()) {
      const done = this.pending; this.pending = null; done();
    }
    if (this.step === "talk" || this.highlight?.active) return;
    const slot = { intern: 0, tiger: 7, dipsp: 8, "tiger-ability": 7, "dipsp-ability": 8 }[this.step];
    const passing = this.step.endsWith("-pass");
    if (slot === undefined && !passing) return;
    const L = scene.layout;
    if (passing) {
      const button = scene.botaoPassarTutorial;
      if (!button?.active) return;
      this.highlight = scene.add.circle(button.x, button.y, button.width / 2 + 10, 0xa5ff78, 0.04);
    } else {
      this.highlight = scene.add.rectangle(L.x[slot % 5], L.yJogador[Math.floor(slot / 5)],
        L.slotW, L.slotH, 0xa5ff78, 0.04);
    }
    this.highlight.setStrokeStyle(7, 0xa5ff78).setDepth(3600);
    scene.tweens.add({ targets: this.highlight, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
  }
}
