// Falas e poses de markdown/Tutorialguia.md, com os controles atuais do duelo.
const ELENAI_DIALOGUES = {
  "intro": [
    {"sprite": 0, "speaker": "ElenAI", "text": "Oi! Eu sou a ElenAI. Vou te mostrar o Cyberduel jogando."},
    {"sprite": 4, "speaker": "ElenAI", "text": "Estamos em NeoFloripa, em 2067. Aqui, quem manda bem nas cartas pode chegar ao Conselho."},
    {"sprite": 10, "speaker": "ElenAI", "text": "Como você quer ser chamado?"}
  ],
  "training": [
    {"sprite": 3, "speaker": "ElenAI", "text": "Vamos jogar! Primeiro, segure o Estagiário para ver a carta. Depois feche no X."},
    {"sprite": 5, "speaker": "ElenAI", "text": "Sua carta entrou e somou PA: pontos de audiência. Mais PA no fim da rodada = vitória. Vença mais rodadas para ganhar a partida de 7 rodadas."},
    {"sprite": 4, "speaker": "ElenAI", "text": "Viu os PA subirem? A Torre dá +2 aos seus personagens da RaspCorp enquanto fica no campo. Agora use um efeito para remover a Torre rival!", "visuals": [
      {"image": "Estagiario_machine_learning.png", "label": "Personagem", "detail": "Soma PA"},
      {"image": "Voce_parece_sozinho.png", "label": "Efeito", "detail": "Usou, aconteceu"},
      {"image": "Torre_MonteCorp.png", "label": "Terreno", "detail": "Fica no campo"}
    ]},
    {"sprite": 5, "speaker": "ElenAI", "text": "Acertou! O Tigre alcança a frente, mas não o Rato no fundo. Agora tente o Agente da DIPSP: ele atira mais longe."},
    {"sprite": 16, "speaker": "ElenAI", "text": "Você já usou personagem, terreno, efeito e habilidade! Agora vamos ao menu comprar e abrir um booster da outra facção."}
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
    {"sprite": 3, "speaker": "ElenAI", "text": "Quer aprender na prática? Vamos invocar, usar efeito, terreno e abrir um booster. Eu mostro onde tocar."}
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
  const previousMusic = scene.cyberMusic?.key;
  window.cyberduelSettings?.playMusic?.(scene, "musicaIA");
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
  let index = 0, finished = false, removeNameCorrection;
  const close = () => {
    if (finished) return;
    removeNameCorrection?.();
    finished = true; root.remove(); document.removeEventListener("keydown", keydown);
    menu?.classList.remove("elenai-story"); if (menu) menu.inert = false;
    if (previousFocus?.isConnected) previousFocus.focus();
    if (previousMusic && scene.scene.isActive())
      window.cyberduelSettings?.playMusic?.(scene, previousMusic);
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
    panel.querySelector(".elenai-lesson")?.remove();
    if (line.visuals) {
      const lesson = ui.element("div", "elenai-lesson");
      for (const visual of line.visuals) {
        const figure = ui.element("figure");
        const image = ui.element("img"); image.src = `assets/cartas/${visual.image}`; image.alt = "";
        figure.append(image, ui.element("strong", "", visual.label), ui.element("small", "", visual.detail));
        lesson.append(figure);
      }
      text.after(lesson);
    }
    if (options.name && index === lines.length - 1) {
      const form = ui.element("form", "elenai-name-form");
      const input = ui.element("input", "title-auth-input");
      input.name = "nickname"; input.autocomplete = "nickname"; input.required = true; input.maxLength = 64;
      input.value = scene.account.nickname || ""; input.setAttribute("aria-label", "Seu apelido");
      const save = ui.element("button", "title-dialog__confirm", "CONTINUAR"); save.type = "submit";
      form.append(input, error, save); actions.append(form);
      form.onsubmit = async event => {
        event.preventDefault(); if (save.disabled) return;
        save.disabled = true; error.textContent = "";
        try { await options.name(input.value); close(); done(); }
        catch (exception) {
          error.textContent = exception.message; save.disabled = false;
          if (exception.code === "NAME_NOT_ALLOWED" && exception.requiresNameChange) {
            removeNameCorrection?.();
            removeNameCorrection = scene.account.onChange(({ user, nameRestriction, tutorial }) => {
              if (user && !nameRestriction && tutorial?.named) { close(); done(); }
            });
          }
        }
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
  if (options.factions) {
    const analysis = ui.element("div", "faction-analyses");
    for (const faction of ["raspcorp", "echossystem"])
      analysis.append(ui.createFactionAnalysis(faction));
    panel.append(analysis);
  }
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
    if (this.busy || !scene.scene.isActive() || scene.titleUI?.modal || scene.titleUI?.boosterTraining || scene.multiplayer.room || scene.entrandoPorConvite || account?.nameRestriction) return;
    if (!account?.user) { scene.titleUI.openAuthDialog(); return; }
    if (account.needsRegistration) { scene.titleUI.openRegistrationDialog(); return; }
    this.busy = true;
    try {
      let accepted = false;
      if (!account.tutorial.introSeen) {
        await this.say(ELENAI_DIALOGUES.intro.slice(0, -1));
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
          ["VAMOS JOGAR", async () => { await account.saveTutorial({ wantsTutorial: true }); accepted = true; }],
          ["IR AO MENU", async () => { await account.saveTutorial({ wantsTutorial: false }); accepted = false; }],
        ] });
      }
      if (account.tutorial.wantsTutorial && !account.tutorial.completed) {
        // Uma conta que interrompeu o treino pode retomá-lo pela carta do menu.
        if (accepted) { scene.iniciarTutorial(); return; }
      }
      if (!account.faction) {
        if (account.tutorial.wantsTutorial) {
          if (!account.tutorial.deckExplained) {
            await this.say([{ sprite: 4, speaker: "ElenAI", text: "Escolha sua facção para receber um deck pronto. Depois, compre boosters por 50 tijolinhos e teste outras cartas no Deck Builder." }]);
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
        if (!new URLSearchParams(location.search).get("room")) {
          if (account.tutorial.boosterTutorialStarted && !account.tutorial.boosterTutorialSeen && account.authProvider !== "offline")
            new CyberduelBoosterTraining(scene.titleUI);
          else if (!account.tutorial.menuTourSeen) scene.titleUI.openMenuTour?.();
        }
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

class CyberduelTutorialPointer {
  constructor() {
    this.root = document.createElement("div");
    this.root.className = "tutorial-pointer";
    this.root.setAttribute("aria-hidden", "true");
    this.root.innerHTML = '<span class="tutorial-pointer__gesture"><svg viewBox="0 0 32 40" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V5a3 3 0 0 1 6 0v13-3a3 3 0 0 1 6 0v3a3 3 0 0 1 5 2v9c0 5-3 8-8 8h-3c-4 0-6-2-8-5l-7-9a3 3 0 0 1 5-3l4 4"/></svg></span><strong></strong>';
    this.label = this.root.querySelector("strong");
    document.body.append(this.root);
    this.hide();
  }
  show(bounds, label, gesture = "tap") {
    const left = Math.max(4, bounds.x), top = Math.max(4, bounds.y);
    const right = Math.min(window.innerWidth - 4, bounds.x + bounds.width);
    const bottom = Math.min(window.innerHeight - 4, bounds.y + bounds.height);
    if (right <= left || bottom <= top) { this.hide(); return; }
    this.root.hidden = false;
    this.root.dataset.gesture = gesture;
    this.root.classList.toggle("tutorial-pointer--left", (left + right) / 2 < 90);
    this.root.classList.toggle("tutorial-pointer--right", (left + right) / 2 > window.innerWidth - 90);
    this.root.classList.toggle("tutorial-pointer--above", bounds.y + bounds.height + 75 > window.innerHeight);
    Object.assign(this.root.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
    if (this.label.textContent !== label) this.label.textContent = label;
  }
  hide() { this.root.hidden = true; }
  destroy() { this.root.remove(); }
}

class CyberduelBoosterTraining {
  constructor(ui) {
    this.ui = ui;
    this.account = ui.account;
    this.user = this.account.user;
    this.purchaseId = "tutorial-opposite-booster-v1";
    this.faction = this.account.faction === "raspcorp" ? "echossystem" : "raspcorp";
    this.factionName = this.faction === "raspcorp" ? "RASPCORP" : "ECHOSSYSTEM";
    ui.boosterTraining?.destroy();
    ui.boosterTraining = this;
    this.pointer = new CyberduelTutorialPointer();
    this.guide = ui.element("aside", "elenai-guide elenai-guide--menu");
    const avatar = ui.element("img", "elenai-guide-avatar");
    avatar.src = "assets/sprites/elenai-05.webp"; avatar.alt = "";
    const header = ui.element("div", "elenai-guide-header");
    this.progress = ui.element("strong");
    this.skip = ui.button("elenai-exit", "PULAR", () => this.finish());
    header.append(this.progress, this.skip);
    this.hint = ui.element("p"); this.hint.setAttribute("aria-live", "polite");
    this.guide.append(avatar, header, this.hint); document.body.append(this.guide);
    this.timer = setInterval(() => this.update(), 100);
    this.update();
  }
  point(target, message, step, label = "TOQUE AQUI", gesture = "tap") {
    this.progress.textContent = `${step} / 6 · SEU PRIMEIRO BOOSTER`;
    if (this.hint.textContent !== message) this.hint.textContent = message;
    if (this.target !== target) {
      this.target?.classList.remove("tutorial-target");
      this.target = target;
      target?.classList.add("tutorial-target");
      target?.scrollIntoView({ block: "center", behavior: "instant" });
    }
    if (!target || target.disabled) { this.pointer.hide(); return; }
    const bounds = target.getBoundingClientRect();
    this.guide.classList.toggle("elenai-guide--bottom", bounds.y + bounds.height / 2 < window.innerHeight / 2);
    this.pointer.show(bounds, label, gesture);
  }
  update() {
    if (this.finishing || !this.ui.root?.isConnected || this.ui.cardMenuTransitioning) return;
    const ui = this.ui, modal = ui.modal, kind = modal?.dataset.kind;
    this.skip.disabled = !!ui.modalRequired;
    const progress = this.account.tutorial || {};
    const query = selector => modal?.querySelector(selector);
    if (progress.boosterTutorialOpened && kind !== "booster-opening") { this.finish(); return; }
    if (kind === "boosters") {
      if (progress.boosterTutorialPurchased) {
        this.point(query(".booster-inventory-link"), "Resgatou! Agora toque em VER INVENTÁRIO para encontrar seu pacote.", 4);
      } else {
        const faction = query(`[data-faction="${this.faction}"]`);
        if (faction?.getAttribute("aria-pressed") !== "true") {
          this.point(faction, `Escolha ${this.factionName}: é a facção oposta à sua.`, 3);
        } else {
          this.point(query(".booster-buy"), "Seu primeiro booster do tutorial é GRÁTIS, uma vez por conta. Resgate: as 5 cartas serão suas!", 3, "RESGATAR GRÁTIS");
        }
      }
      return;
    }
    if (kind === "booster-inventory") {
      const row = [...modal.querySelectorAll(".booster-inventory-item")].find(row => row.textContent.toUpperCase().includes(this.factionName));
      this.point(row?.querySelector(".booster-buy"), `Aqui está seu pacote ${this.factionName}. Toque em ABRIR BOOSTER.`, 4);
      return;
    }
    if (kind === "booster-opening") {
      if (modal.dataset.packId !== this.purchaseId) {
        this.point(query(".booster-close"), "Volte ao inventário para abrir o pacote do tutorial.", 4);
      } else if (!query(".is-revealed")) {
        this.point(query(".booster-scratch"), "Arraste o dedo pelo lacre para abrir. Também pode tocar em ABRIR PACOTE.", 5, "ARRASTE →", "swipe");
      } else {
        const revealed = Number(modal.dataset.revealed) || 0;
        this.point(query(".booster-buy"), revealed < 5
          ? `${revealed} / 5 cartas. Deslize a carta para cima ou toque em PRÓXIMA CARTA.`
          : "As 5 cartas já estão na coleção! Toque em VOLTAR AO INVENTÁRIO para concluir.", 6,
          revealed < 5 ? "PRÓXIMA CARTA ↑" : "CONCLUIR");
      }
      return;
    }
    if (modal) {
      this.point(modal.querySelector('[aria-label^="Fechar"], .booster-close, .card-menu-dialog__close'), "Feche esta tela para continuar o treino do booster.", 1);
      return;
    }
    const state = ui.cardMenuState, menu = ui.cardMenuEls;
    if (state.mode === "categories") {
      if (state.items[state.categoryIndex]?.id !== "cartas") {
        const index = ui.menuCategories.findIndex(item => item.id === "cartas");
        this.point(menu.cards[state.categoryIndex < index ? 2 : 0], "Vamos abrir um booster de verdade. Toque na carta ao lado até chegar em CARTAS.", 1);
      } else this.point(menu.cards[1], "Toque na carta CARTAS, no centro, para entrar.", 1);
    } else if (state.currentKind !== "cartas") {
      this.point(menu.backRow.querySelector("button"), "Toque em VOLTAR. O booster fica no menu CARTAS.", 1);
    } else {
      const art = progress.boosterTutorialPurchased ? "abrir_boosters" : "comprar_booster";
      const index = state.items.findIndex(item => item.art === art);
      if (state.optionIndex !== index) {
        this.point(menu.cards[state.optionIndex < index ? 2 : 0], `Toque na carta ao lado até chegar em ${progress.boosterTutorialPurchased ? "Abrir" : "Comprar"} boosters.`, 2);
      } else this.point(menu.cards[1], `Toque na carta do centro para ${progress.boosterTutorialPurchased ? "ver seu inventário" : "entrar na loja de boosters"}.`, 2);
    }
  }
  async finish() {
    if (this.finishing || this.ui.modalRequired) return;
    this.finishing = true;
    try {
      await this.account.saveTutorial({ boosterTutorialSeen: true, menuTourSeen: true });
      this.destroy();
      if (this.ui.modal) this.ui.closeModal(true);
      else this.account.notify();
    } catch (error) {
      this.finishing = false;
      this.hint.textContent = error.message || "Não foi possível salvar. Tente novamente.";
    }
  }
  destroy() {
    clearInterval(this.timer);
    this.target?.classList.remove("tutorial-target");
    this.pointer.destroy(); this.guide.remove();
    if (this.ui.boosterTraining === this) this.ui.boosterTraining = null;
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
      this.dialog?.dispose(); this.guide?.remove(); this.pointer?.destroy();
    });
  }
  card(name) {
    const base = POOL_CARTAS_MONSTRO.find(card => card.nome === name) ||
      POOL_CARTAS_TERRENO.find(card => card.nome === name) || POOL_CARTAS_EFEITO.find(card => card.nome === name);
    const type = POOL_CARTAS_MONSTRO.includes(base) ? "monstro" : POOL_CARTAS_TERRENO.includes(base) ? "terreno" : "efeito";
    return new Carta(++this.nextId, base.poder || 0, type, { ...base });
  }
  give(name) { this.scene.partida.jogador.mao.adicionarCarta(this.card(name)); }
  start() {
    const ui = new CyberduelTitleUI({ callbacks: {} });
    this.guide = ui.element("aside", "elenai-guide");
    this.guide.setAttribute("aria-live", "polite");
    this.hint = ui.element("p", "");
    const header = ui.element("div", "elenai-guide-header");
    header.append(ui.element("strong", "", "TREINO COM ELENAI"));
    const portrait = ui.element("img", "elenai-guide-avatar");
    portrait.src = "assets/sprites/elenai-03.webp"; portrait.alt = "";
    this.progress = ui.element("span", "elenai-guide-progress");
    this.progress.setAttribute("aria-label", "Progresso do treino");
    header.append(this.progress, ui.button("elenai-exit", "SAIR", () => this.scene.scene.start("CenaTitulo")));
    this.guide.append(portrait, header, this.hint);
    document.body.append(this.guide);
    this.pointer = new CyberduelTutorialPointer();
    this.say(0, 1, () => this.setStep("intern-inspect", "Segure o Estagiário na sua mão para abrir a ficha. Depois, feche pelo X."));
  }
  say(from, to, done) {
    this.step = "talk"; this.highlight?.destroy();
    this.pointer?.hide();
    this.guide.hidden = true;
    this.dialog = showElenAI(this.scene, ELENAI_DIALOGUES.training.slice(from, to), () => {
      this.dialog = null; this.guide.hidden = false; done();
    }, { training: true });
  }
  setStep(step, hint) {
    this.step = step; this.hint.textContent = hint;
    const stages = ["intern-inspect", "intern", "terrain", "effect", "tiger", "tiger-pass", "tiger-ability", "dipsp", "dipsp-pass", "dipsp-ability"];
    if (this.progress) this.progress.textContent = `${stages.indexOf(step) + 1} / ${stages.length}`;
    this.highlight?.destroy(); this.highlight = null;
    this.alvoDestaque = null;
  }
  expectedCard() {
    return { intern: "Estagiário de Machine Learning", terrain: "Torre MonteCorp", effect: "Vento dos Ermos",
      tiger: "O Tigre", dipsp: "Agente da DIPSP" }[this.step.split("-")[0]];
  }
  canPlace(card, index) {
    return card.nome === this.expectedCard() && index === { intern: 0, terrain: 1, effect: 3, tiger: 7, dipsp: 8 }[this.step];
  }
  canPlayEffect(card, target) { return this.step === "effect" && card.nome === "Vento dos Ermos" && target === 0; }
  canUse(card, target) {
    const expected = this.step === "tiger-ability" ? ["O Tigre", 7] :
      this.step === "dipsp-ability" ? ["Agente da DIPSP", 2] : [];
    return card.nome === expected[0] && (target === undefined || target === expected[1]);
  }
  canInspect(card) {
    return this.step !== "talk" && !this.step.endsWith("-pass") && !!card && card.nome === this.expectedCard();
  }
  placed(card) {
    if (card.nome === "Estagiário de Machine Learning") {
      this.step = "talk";
      this.pending = () => this.say(1, 2, () => this.setStep("terrain", "Coloque a Torre no espaço brilhante. Veja os PA do Estagiário subirem!"));
      this.give("Torre MonteCorp");
      this.scene.partida.inimigo.campo.adicionarCarta(this.card("CyberVendedor da RaspCorp"), 7);
      this.scene.partida.inimigo.campo.adicionarCarta(this.card("O Rato"), 2);
      this.scene.desenharInterface();
    } else if (card.tipo === "terreno") {
      this.step = "talk";
      this.give("Vento dos Ermos");
      this.scene.partida.inimigo.campo.adicionarCarta(this.card("Torre MonteCorp"), 0);
      this.scene.partida.resolverEfeitosContinuos(this.scene.partida.inimigo);
      this.scene.desenharInterface();
      this.pending = () => this.say(2, 3, () => this.setStep("effect", "Toque no Vento dos Ermos na mão. Depois toque no campo para usar."));
    } else if (card.tipo === "efeito") {
      this.step = "talk";
      this.give("O Tigre");
      this.scene.desenharInterface();
      this.pending = () => this.setStep("tiger", "Terreno rival removido! O bônus acabou. Agora coloque o Tigre no espaço brilhante.");
    } else this.setStep(card.nome === "O Tigre" ? "tiger-pass" : "dipsp-pass", "Toque no botão >> à direita. Vamos usar a habilidade!");
  }
  pass() {
    if (!["tiger-pass", "dipsp-pass"].includes(this.step)) return;
    this.scene.faseAtual = this.scene.partida.fase = "habilidades";
    this.scene.desenharInterface();
    this.setStep(this.step === "tiger-pass" ? "tiger-ability" : "dipsp-ability",
      this.step === "tiger-pass" ? "Toque no Tigre para selecioná-lo. Depois, use a bolinha verde ao lado da carta." :
        "Toque no Agente da DIPSP para selecioná-lo. Depois, use a bolinha verde ao lado da carta.");
  }
  used(card) {
    this.step = "talk";
    this.pending = () => {
      if (card.nome === "O Tigre") {
        this.give("Agente da DIPSP");
        this.scene.faseAtual = this.scene.partida.fase = "colocar";
        this.scene.desenharInterface();
        this.say(3, 4, () => this.setStep("dipsp", "Invoque o Agente da DIPSP no espaço brilhante da frente."));
      } else this.say(4, 5, () => this.finish());
    };
  }
  async finish() {
    try {
      if (window.cyberduelAccount?.authProvider === "offline")
        window.cyberduelAccount.tutorial.completed = true;
      else if (window.cyberduelAccount?.user) await window.cyberduelAccount.saveTutorial({ completed: true, boosterTutorialStarted: true, boosterTutorialSeen: false });
      this.scene.scene.start("CenaTitulo");
    } catch (error) {
      this.hint.textContent = error.message;
      const retry = document.createElement("button"); retry.textContent = "TENTAR SALVAR NOVAMENTE";
      retry.onclick = () => { retry.remove(); this.finish(); }; this.guide.append(retry);
    }
  }
  pointAt(x, y, width, height, label) {
    if (!this.pointer) return;
    const scene = this.scene, canvas = scene.game.canvas, rect = canvas.getBoundingClientRect();
    const top = scene.cameras.main.getWorldPoint(0, 0), bottom = scene.cameras.main.getWorldPoint(canvas.width, canvas.height);
    const scaleX = rect.width / (bottom.x - top.x), scaleY = rect.height / (bottom.y - top.y);
    this.pointer.show({ x: rect.left + (x - width / 2 - top.x) * scaleX,
      y: rect.top + (y - height / 2 - top.y) * scaleY, width: width * scaleX, height: height * scaleY }, label,
      this.step === "intern-inspect" && !scene.modalAberto ? "hold" : "tap");
  }
  update() {
    const scene = this.scene;
    if (this.guide) this.guide.hidden = !!this.dialog || (this.step === "talk" && !!this.pending);
    if (scene.modalAberto) this.hint.textContent = "Ficha aberta! Solte o dedo e toque no X destacado para fechar.";
    if (this.step === "intern-inspect") {
      if (scene.modalAberto) {
        this.inspecaoVista = true;
      }
      else if (this.inspecaoVista) this.setStep("intern", "Agora dê um toque no Estagiário para selecioná-lo e depois toque no espaço destacado. Você também pode arrastar a carta.");
    }
    this.guide?.classList.toggle("elenai-guide--bottom",
      (["tiger-ability", "dipsp-ability"].includes(this.step) && !scene.modalAberto) ||
      !!scene.modalAberto);
    if (scene.botaoPassarTutorial?.input)
      scene.botaoPassarTutorial.input.enabled = ["tiger-pass", "dipsp-pass"].includes(this.step);
    for (const object of scene.children?.list || []) {
      if (!object.input) continue;
      if (object.dadosCartaCampo) object.input.enabled = this.canUse(object.dadosCartaCampo);
      if (object.dadosCarta) object.input.enabled = ["intern-inspect", "intern", "terrain", "effect", "tiger", "dipsp"].includes(this.step);
    }
    if (this.pending && !scene.efeitosVisuaisPendentes()) {
      const done = this.pending; this.pending = null; done();
    }
    if (this.step === "talk" || scene.modalAberto || this.dialog) {
      this.highlight?.destroy(); this.highlight = null; this.alvoDestaque = null;
      const close = scene.modalAberto && scene.painelDetalheAtual?.getByName("fechar-detalhe-carta");
      if (close) {
        const transform = close.getWorldTransformMatrix();
        this.pointAt(transform.tx, transform.ty, close.width * Math.hypot(transform.a, transform.b),
          close.height * Math.hypot(transform.c, transform.d), "TOQUE NO X");
      } else this.pointer?.hide();
      return;
    }
    const slot = { "intern-inspect": 0, intern: 0, terrain: 1, effect: 3, tiger: 7, dipsp: 8, "tiger-ability": 7, "dipsp-ability": 8 }[this.step];
    const passing = this.step.endsWith("-pass");
    if (slot === undefined && !passing) return;
    const L = scene.layout;
    let objeto, circular = false, x, y, largura = L.slotW, altura = L.slotH, chave = this.step;
    if (passing) {
      objeto = scene.botaoPassarTutorial;
      if (!objeto?.active) return;
      circular = true; largura = objeto.width;
    } else if (this.step === "effect" && scene.objetosSelecaoAlvo?.length) {
      x = L.x[0]; y = L.yInimigo[0]; chave += ":alvo";
      this.hint.textContent = "Toque na Torre rival destacada. O efeito remove o terreno e vai para o descarte.";
    } else if (this.step.endsWith("-ability")) {
      const tigre = this.step === "tiger-ability", nome = tigre ? "O Tigre" : "Agente da DIPSP";
      if (scene.objetosSelecaoAlvo?.length) {
        const alvo = tigre ? 7 : 2;
        x = L.x[alvo % 5]; y = L.yInimigo[Math.floor(alvo / 5)]; chave += ":alvo";
        this.hint.textContent = tigre ? "Toque no CyberVendedor destacado. O Rato está longe demais." :
          "Toque no Rato destacado. O Agente alcança o fundo!";
      } else if (scene.cartaCampoSelecionada?.dadosCartaCampo?.nome === nome && scene.botaoHabilidadeCampo?.visible) {
        objeto = scene.botaoHabilidadeCampo; circular = true; largura = objeto.width;
        this.hint.textContent = "Área dourada = alcance. Toque na bolinha verde para atacar.";
      } else {
        objeto = scene.children.list.find(o => o.dadosCartaCampo?.nome === nome);
        this.hint.textContent = `Toque ${tigre ? "no Tigre" : "no Agente da DIPSP"} no campo.`;
      }
    } else {
      const nome = this.expectedCard();
      const mao = scene.children.list.find(o => o.dadosCarta?.nome === nome);
      if (this.step === "intern-inspect" || (mao && scene.cartaMaoSelecionada !== mao &&
        !(scene.gestoInspecaoCarta?.container === mao && scene.gestoInspecaoCarta.cancelado))) objeto = mao;
      if (mao && this.step !== "intern-inspect") this.hint.textContent = objeto
        ? `Toque em ${nome} na sua mão.`
        : "Carta selecionada! Toque no espaço brilhante.";
    }
    x ??= objeto?.x ?? L.x[slot % 5]; y ??= objeto?.y ?? L.yJogador[Math.floor(slot / 5)];
    if (objeto && !circular) { largura = objeto.width || largura; altura = objeto.height || altura; }
    this.pointAt(x, y, circular ? largura + 20 : largura, circular ? largura + 20 : altura,
      this.step === "intern-inspect" ? "SEGURE ATÉ ABRIR" : "TOQUE AQUI");
    const alvoDestaque = objeto || chave;
    if (this.highlight?.active && this.alvoDestaque === alvoDestaque) {
      this.highlight.setPosition(x, y); return;
    }
    this.highlight?.destroy();
    this.alvoDestaque = alvoDestaque;
    this.highlight = circular ? scene.add.circle(x, y, largura / 2 + 10, 0xa5ff78, 0.04) :
      scene.add.rectangle(x, y, largura, altura, 0xa5ff78, 0.04);
    this.highlight.setStrokeStyle(7, 0xa5ff78).setDepth(3600);
    scene.tweens.add({ targets: this.highlight, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
  }
}
