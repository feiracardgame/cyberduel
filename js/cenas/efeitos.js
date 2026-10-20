// A cena independente preserva os efeitos durante o redesenho do campo.
const APRESENTACAO_EFEITOS = Object.freeze({
  "HumbaBrain": { invocacao: "somHumba", video: "videoEfeitohumba", volume: 0.3 },
  "Professores de Duelo": { habilidade: "somProfessores", video: "videoEfeitoprofessores", momentos: ["habilidade"], volume: 0.3 },
  "Refrigeradores de DataCenter": { habilidade: "somRefrigerador", visual: "refrigeracao", momentos: ["habilidade"], corAlvo: 0xb567ff },
  "Montadores de Cabos": { habilidade: "somMontador", visual: "extensao", momentos: ["habilidade"], corAlvo: 0xb567ff },
  "Estudante de Curso Técnico": { habilidade: "somEstudante", visual: "aprendizado", momentos: ["habilidade"], corAlvo: 0xb567ff },
  "CyberUnidades de Emergência": { habilidade: "somBombeiro", visual: "extintor", momentos: ["habilidade"], corAlvo: 0xffffff },
  "TecnoAgentes de Segurança": { habilidade: "somPolicial", momentos: ["habilidade", "advertencia"], corAlvo: 0xb567ff },
  "NeoMedicânico": { habilidade: "somMedico", visual: "cura", momentos: ["habilidade"], corAlvo: 0xb567ff },
  "Influenciador Digital": { habilidade: "somInfluenciador", visual: "opiniao", momentos: ["habilidade"], corAlvo: 0xb567ff },
  "CyberPolíticos": { passiva: "somPolitico", momentos: ["passiva"], somenteVinculo: true, corAlvo: 0xb567ff },
  "NeoPalhoça": { invocacao: "somNeoPalhoca" },
  "Torre MonteCorp": { invocacao: "somTorre" },
  "Beira-mar norte de NeoFloripa": { invocacao: "somBeira" },
  "Nexus de Dados Global": { invocacao: "somNexus" },
  "CyberVendedor da RaspCorp": { habilidade: "somCyberVendedor", momentos: ["habilidade"] },
  "IA de treinamento": { invocacao: "somInteracao", momentos: ["invocacao"], visual: "tutorial" },
  "HAL 9001": { habilidade: "somHal", momentos: ["habilidade"] },
  "H.A.R.V.I.S": { invocacao: "somHarvis" },
  "Replicantes": { continuo: "somReplicantes" },
  "Dragão das Comunicações Móveis": { despertar: "somDragao", momentos: ["despertar"], visual: "fullart" },
  "DeepClaude ChatGemini": { habilidade: "somDeepClaude" },
  "Bug na Matrix": { invocacao: "somBug" },
  "Você Parece Sozinho": { conjuracao: "somLonely" },
  "Estagiário de Machine Learning": { habilidade: "somEstagiario", momentos: ["habilidade"] },
  "Gestor de Recursos Predominantemente Humanos": { habilidade: "somGRPH", momentos: ["habilidade"] },
  "NeoAnalista de Suporte Nível Alpha": { invocacao: "somNeoAnalista", video: "efeitoNeoAnalista" },
  "CryptoAcionistas": { inicio_turno: "somCryptoAcionistas", visual: "moeda", momentos: ["inicio_turno"], somenteGanho: true },
  "Advogado Corporativo": { habilidade: "somAdvogado", visual: "juridico", momentos: ["habilidade"] },
  "Agente da DIPSP": { habilidade: "somTiro", visual: "plasma", cor: 0x3388ff, corAlvo: 0x3388ff, momentos: ["habilidade"] },
  'UCC "Juggernaut"': { habilidade: "somJuggernaut", visual: "impactoJuggernaut", video: "videoEfeitoJuggernaut", momentos: ["habilidade"] },
  "O Tigre": { habilidade: "somTigre", imagem: "efeitoTigre", momentos: ["habilidade"], visual: "garras" },
  "RaspClay MonteCorp": { invocacao: "somRaspClay", video: "efeitoRaspClayVertical", volume: 0.3 },
  "Dieh'Go, o Xerife": { habilidade: "somDiego", visual: "caveiras", video: "videoEfeitodiego", momentos: ["habilidade"], volume: 0.3 },
  "A Aranha": { habilidade: "somAranha", imagem: "efeitoAranha", momentos: ["habilidade"], video: "videoEfeitoAranha" },
  "O Boi": { habilidade: "somBoi", imagem: "efeitoBoi", momentos: ["habilidade"], video: "videoEfeitoBoi", volume: 0.3 },
  "A Cabra": { habilidade: "somCabra", imagem: "efeitoCabra", momentos: ["habilidade"] },
  "O Cão": { passiva: "somCao", imagem: "efeitoCao", momentos: ["passiva"] },
  "O Trotar do Cavalo": { conjuracao: "somCavalo", imagem: "efeitoCavalo", momentos: ["conjuracao"] },
  "A Cobra": { veneno: "somCobra", imagem: "efeitoCobra", momentos: ["habilidade", "veneno"], picharMomentos: ["veneno"] },
  "A Toca do Coelho": { invocacao: "somCoelho", imagem: "efeitoCoelho", momentos: ["invocacao"] },
  "O Canto do Galo": { conjuracao: "somGalo", imagem: "efeitoGalo", momentos: ["conjuracao"] },
  "A Travessura do Macaco": { conjuracao: "somMacaco", armadilha: "somMacaco", imagem: "efeitoMacaco", momentos: ["conjuracao", "armadilha"] },
  "O Porco": { protecao: "somPorco", imagem: "efeitoPorco", momentos: ["protecao"] },
  "O Rato": { habilidade: "somRato", imagem: "efeitoRato", momentos: ["habilidade"] },
  "Povo da Areia": { invocacao: "somAreia" },
  "A Ferreira": { habilidade: "somFerreira", visual: "forja", momentos: ["habilidade"] },
  "Tuh'Coh, O Feio": { continuo: "somFeio", momentos: ["continuo"], somenteGanho: true },
  "Sen'Tenzhah, O Mau": { habilidade: "somMau", visual: "soco", momentos: ["habilidade"] },
  "O Bom": { habilidade: "somBom2", visual: "passaros", momentos: ["habilidade"] },
});

class CenaEfeitos extends Phaser.Scene {
  constructor() { super("CenaEfeitos"); }

  create({ jogo, sequencia = 0 }) {
    configurarCameraLogica(this);
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
    this.jogo = jogo;
    this.ultimoEvento = sequencia;
    this.fila = [];
    this.exibidos = [];
    this.executando = false;
    this.encontroEmCurso = null;
    this.invocacaoEmCurso = null;
    this.invocacoesPendentes = new Map();
    this.haCartasOcultas = false;
    this.marcasSindicato = new Map();
    if (!this.anims.exists("forja-ferreira")) this.anims.create({
      key: "forja-ferreira", frames: this.anims.generateFrameNumbers("efeitoFerreira", { start: 0, end: 9 }),
      frameRate: 25, repeat: -1,
    });
    if (!this.anims.exists("moeda-crypto")) this.anims.create({
      key: "moeda-crypto", frames: this.anims.generateFrameNumbers("efeitoCrypto", { start: 0, end: 12 }),
      frameRate: 1000 / 60, repeat: -1,
    });
    this.events.once("shutdown", () => this.cancelarInvocacoesPendentes());
    this.events.once("shutdown", () => {
      this.marcasSindicato.forEach(marca => marca.destroy());
      this.marcasSindicato.clear();
    });
    this.scene.bringToTop();
  }

  receber(eventos) {
    if (!this.fila) return;
    for (const evento of eventos || []) {
      if (evento.id <= this.ultimoEvento) continue;
      this.ultimoEvento = evento.id;
      const copia = JSON.parse(JSON.stringify(evento));
      this.fila.push(copia);
      if (copia.momento === "invocacao" && copia.fonte.indice >= 0 &&
          (copia.lado !== "jogador" || this.jogo.multiplayer?.spectator)) {
        this.invocacoesPendentes ||= new Map();
        this.invocacoesPendentes.set(copia.id, copia);
      }
    }
    this.atualizarVisibilidadeInvocacoes();
    this.proximo();
  }

  ponto(lado, indice) {
    const layout = this.jogo.layout || LAYOUT_CAMPO_NORMAL;
    if (indice < 0 || indice >= 10) return { x: LARGURA_LAYOUT / 2, y: ALTURA_LAYOUT / 2 };
    return { x: layout.x[indice % 5], y: (lado === "jogador" ? layout.yJogador : layout.yInimigo)[Math.floor(indice / 5)] };
  }

  update() {
    this.atualizarVisibilidadeInvocacoes();
    this.atualizarMarcasSindicato();
  }

  // Marcas derivadas do estado: sobrevivem ao redesenho e à reconexão, sem repetir o som.
  atualizarMarcasSindicato() {
    const partida = this.jogo.partida;
    if (!partida?.jogador || !partida.inimigo) return;
    this.marcasSindicato ||= new Map();
    const desejadas = new Map();
    for (const lado of ["jogador", "inimigo"]) {
      const campo = partida[lado].campo.cartas;
      const adversarios = partida[lado === "jogador" ? "inimigo" : "jogador"].campo.cartas;
      campo.forEach((carta, indice) => {
        if (!carta || (carta.ocultadaPelaToca && !carta.revelada && (lado !== "jogador" || this.jogo.multiplayer?.spectator))) return;
        const chaves = [];
        if (carta.bonusBloqueado) chaves.push("efeitoBombeiro");
        if (adversarios.some(agente => agente?.efeito?.acao === "advertir" && agente.alvosAdvertidos?.includes(carta.id))) chaves.push("efeitoPolicial");
        if (campo.some(politico => politico?.efeito?.tipo === TIPOS_EFEITO.VINCULO_ALIADO && politico.aliadoVinculadoId === carta.id)) chaves.push("efeitoPolitico");
        for (const chave of chaves) {
          if (!this.textures.exists(chave)) continue;
          const id = `${lado}:${carta.id}:${chave}`;
          const ponto = this.ponto(lado, indice);
          let marca = this.marcasSindicato.get(id);
          if (!marca) {
            marca = this.add.image(ponto.x, ponto.y, chave).setAlpha(0).setDepth(chave === "efeitoPolitico" ? 50 : 40);
            marca.marcaSindicato = chave;
            this.tweens.add({ targets: marca, alpha: 1, duration: 650, delay: chave === "efeitoBombeiro" ? 350 : 0 });
          }
          const layout = this.jogo.layout;
          marca.setPosition(ponto.x, ponto.y)
            .setScale(Math.min(layout.slotW * .9 / marca.width, layout.slotH * .7 / marca.height))
            .setAngle(this.jogo.multiplayer?.presentation && lado === "inimigo" ? 180 : 0);
          desejadas.set(id, marca);
        }
      });
    }
    for (const [id, marca] of this.marcasSindicato) if (!desejadas.has(id)) marca.destroy();
    this.marcasSindicato = desejadas;
  }

  revelarSimbolo(chave, ponto, guardar) {
    if (!this.textures.exists(chave)) return;
    const simbolo = guardar(this.add.image(ponto.x, ponto.y, chave).setDepth(11));
    const layout = this.jogo.layout;
    simbolo.setScale(Math.min(layout.slotW * .9 / simbolo.width, layout.slotH * .75 / simbolo.height));
    simbolo.setAngle(this.jogo.multiplayer?.presentation && ponto.lado === "inimigo" ? 180 : 0);
    simbolo.setCrop(0, 0, simbolo.width, 0);
    const tinta = { progresso: 0 };
    this.tweens.add({ targets: tinta, progresso: 1, duration: 380,
      onUpdate: () => { if (simbolo.active) simbolo.setCrop(0, 0, simbolo.width, simbolo.height * tinta.progresso); } });
    this.tweens.add({ targets: simbolo, alpha: 0, delay: 750, duration: 250 });
    return simbolo;
  }

  deveOcultarCarta(carta) {
    if (!carta || !this.invocacoesPendentes?.size) return false;
    for (const evento of this.invocacoesPendentes.values()) {
      const campo = this.jogo.partida?.[evento.lado]?.campo.cartas || [];
      if (campo.includes(carta) && carta.id === evento.fonte.id) return true;
    }
    return false;
  }

  atualizarVisibilidadeInvocacoes() {
    if (!this.invocacoesPendentes?.size && !this.haCartasOcultas) return;
    this.haCartasOcultas = false;
    // Inclui quem ainda espera na fila, não só a carta que já está voando.
    for (const objeto of this.jogo.children.list) {
      const ocultar = this.deveOcultarCarta(objeto.dadosCartaCampo);
      if (ocultar || objeto.ocultaPorInvocacao) {
        objeto.setVisible(!ocultar);
        objeto.ocultaPorInvocacao = ocultar;
        if (ocultar) this.haCartasOcultas = true;
      }
    }
  }

  restaurarCartaEmTransito() {
    if (this.invocacaoEmCurso)
      this.invocacoesPendentes?.delete(this.invocacaoEmCurso.id);
    this.invocacaoEmCurso = null;
    this.atualizarVisibilidadeInvocacoes();
  }

  cancelarInvocacoesPendentes() {
    this.invocacoesPendentes?.clear();
    this.invocacaoEmCurso = null;
    this.atualizarVisibilidadeInvocacoes();
  }

  animarFonte(evento, fonte, guardar, aoImpactar) {
    const remoto = evento.lado !== "jogador" || this.jogo.multiplayer?.spectator;
    if ((!remoto && !["armadilha", "conjuracao"].includes(evento.momento)) || !["invocacao", "conjuracao", "habilidade", "armadilha"].includes(evento.momento)) {
      aoImpactar();
      return;
    }
    const invocacao = evento.momento === "invocacao" && fonte.indice >= 0;
    const habilidade = evento.momento === "habilidade";
    const layout = this.jogo.layout || LAYOUT_CAMPO_NORMAL;
    const largura = layout.slotW;
    const altura = layout.slotH;
    const origem = habilidade ? this.ponto(evento.lado, fonte.indice) : {
      x: LARGURA_LAYOUT / 2,
      y: evento.lado === "inimigo" ? Y_MAO_INIMIGO : Y_MAO_JOGADOR,
    };
    const destino = invocacao ? this.ponto(evento.lado, fonte.indice) : habilidade ? {
      x: origem.x, y: Math.max(altura, origem.y - 65),
    } : { x: LARGURA_LAYOUT / 2, y: ALTURA_LAYOUT / 2 };
    const oculta = remoto && !!evento.fonte.oculto;
    const chave = oculta ? "fundoCarta" : fonte.imagem;
    const arte = chave && this.textures.exists(chave)
      ? this.add.image(0, 0, chave).setDisplaySize(largura, altura)
      : this.add.rectangle(0, 0, largura, altura, 0x14341f);
    const moldura = this.add.rectangle(0, 0, largura, altura, 0x000000, 0)
      .setStrokeStyle(4, 0x60ff95);
    const frente = this.add.container(0, 0, [arte, moldura]);
    if (!oculta) {
      const placa = this.add.rectangle(0, altura / 2 - 31, largura - 8, 56, 0x071d0e, 0.9);
      const nome = this.add.text(0, altura / 2 - 31, fonte.nome, {
        fontFamily: "Arial, sans-serif", fontSize: "18px", fontStyle: "bold", align: "center", color: "#ffffff",
        wordWrap: { width: largura - 18 },
      }).setOrigin(0.5);
      nome.setScale(Math.min(1, 50 / nome.height));
      frente.add([placa, nome]);
    }
    const verso = !habilidade && this.textures.exists("fundoCarta")
      ? this.add.image(0, 0, "fundoCarta").setDisplaySize(largura, altura) : null;
    const orientacao = this.jogo.multiplayer?.presentation && evento.lado === "inimigo" ? 180 : 0;
    frente.setAngle(orientacao);
    verso?.setAngle(orientacao);
    frente.setVisible(!verso);
    const carta = guardar(this.add.container(origem.x, origem.y, [frente, verso].filter(Boolean)))
      .setDepth(30).setScale(habilidade ? 1 : 0.7).setAngle(habilidade ? 0 : -12);
    carta.eventoApresentado = evento.id;
    if (invocacao) {
      this.invocacaoEmCurso = evento;
      this.atualizarVisibilidadeInvocacoes();
    }
    const escala = invocacao ? 1 : habilidade ? 1.18 : 2;
    const margemX = largura * escala * 1.1 / 2 + (invocacao ? 0 : 12);
    const margemY = altura * escala * 1.1 / 2 + 12;
    if (!invocacao && !habilidade) {
      destino.x = Math.max(margemX, Math.min(LARGURA_LAYOUT - margemX, destino.x));
      destino.y = Math.max(margemY, Math.min(ALTURA_LAYOUT - margemY, destino.y));
    }
    const impactar = () => {
      this.restaurarCartaEmTransito();
      aoImpactar();
      this.tweens.add({ targets: carta, scaleX: escala * 1.1, scaleY: escala * 1.1,
        duration: 120, yoyo: true, onComplete: () => {
          this.tweens.add({ targets: carta, alpha: 0, y: carta.y - (invocacao ? 0 : 25),
            duration: 240, delay: invocacao ? 0 : 220 });
        } });
    };
    this.tweens.add({ targets: carta, x: destino.x, y: destino.y,
      scaleX: escala, scaleY: escala, angle: 0, duration: habilidade ? 240 : 380,
      ease: "Cubic.Out", onComplete: () => {
        if (!verso) return impactar();
        this.tweens.add({ targets: carta, scaleX: 0, duration: 100, onComplete: () => {
          verso.setVisible(false); frente.setVisible(true);
          this.tweens.add({ targets: carta, scaleX: escala, duration: 140,
            ease: "Sine.Out", onComplete: impactar });
        } });
      } });
  }

  pichar(chave, ponto, guardar, largura = 170, altura = 210) {
    if (!this.textures.exists(chave)) return;
    const simbolo = guardar(this.add.image(ponto.x, ponto.y, chave).setDepth(10));
    simbolo.setScale(Math.min(largura / simbolo.width, altura / simbolo.height));
    simbolo.setCrop(0, 0, simbolo.width, 0);
    const tinta = { progresso: 0 };
    this.tweens.add({ targets: tinta, progresso: 1, duration: 380,
      onUpdate: () => simbolo.setCrop(0, 0, simbolo.width, simbolo.height * tinta.progresso) });
    for (let i = 0; i < 12; i++) {
      const gota = guardar(this.add.circle(ponto.x - largura / 2 + (i * 37 % largura),
        ponto.y - altura / 2 + (i * 53 % altura), 1 + i % 3, 0xff405c, 0.7));
      this.tweens.add({ targets: gota, alpha: 0, duration: 300, delay: i * 20 });
    }
    this.tweens.add({ targets: simbolo, alpha: 0, delay: 650, duration: 300 });
  }

  tremerCarta(carta) {
    if (!carta?.active) return;
    const x = carta.x;
    this.tweens.add({ targets: carta, x: x + 7, duration: 45, yoyo: true, repeat: 3,
      onComplete: () => { if (carta.active) carta.x = x; } });
  }

  animarSegurancaX1(evento, aoConcluir) {
    const W = LARGURA_LAYOUT, H = ALTURA_LAYOUT, cx = W / 2, cy = H * .49;
    const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const objetos = [], timers = [], animacoes = [], sons = [];
    const estado = this.segurancaX1EmCurso = { eventoId: evento.id, fase: "protocolo", destruidas: 0 };
    let encerrado = false;
    const guardar = objeto => { objetos.push(objeto); return objeto.setName("seguranca-x1-efeito"); };
    const depois = (delay, callback) => timers.push(this.time.delayedCall(delay, () => { if (!encerrado) callback(); }));
    const animar = config => animacoes.push(this.tweens.add(config));
    const tocar = (key, volume = .7, rate = 1) => {
      if (!this.cache.audio.exists(key)) return;
      const sound = this.sound.add(key, { volume: window.cyberduelSettings?.effects(volume, key) ?? volume, rate });
      sons.push(sound); sound.play();
    };
    const tremer = (duracao, intensidade) => {
      if (!reduzido) {
        this.jogo.cameras?.main?.shake(duracao, intensidade);
        this.cameras.main.shake(duracao, intensidade * .45);
      }
    };
    const limpar = () => {
      if (encerrado) return;
      encerrado = true;
      timers.forEach(timer => timer.remove(false));
      animacoes.forEach(animacao => animacao.remove());
      objetos.forEach(objeto => { if (objeto.active) objeto.destroy(); });
      sons.forEach(sound => sound.destroy());
      this.cameras?.main?.resetFX(); this.jogo.cameras?.main?.resetFX();
      this.segurancaX1EmCurso = null;
      this.events.off("shutdown", limpar);
    };
    this.events.once("shutdown", limpar);
    const titulo = (text, y, size, color = "#d9ffae") => guardar(this.add.text(cx, y, text, {
      fontFamily: "Rushblade, Arial, sans-serif", fontSize: `${size}px`, align: "center",
      color, stroke: "#020704", strokeThickness: 8, letterSpacing: 3,
    }).setOrigin(.5).setDepth(90).setAlpha(0));
    const anel = (x, y, raio, cor, depth = 42) => guardar(this.add.circle(x, y, raio, cor, 0)
      .setStrokeStyle(3, cor, .8).setDepth(depth));
    const fundo = guardar(this.add.rectangle(cx, H / 2, W, H, 0x010604, 0).setDepth(20));
    animar({ targets: fundo, fillAlpha: .97, duration: 650 });
    const barras = [H * .035, H * .965].map(y => guardar(this.add.rectangle(cx, y, W, H * .07, 0x000000)
      .setDepth(88).setAlpha(0)));
    animar({ targets: barras, alpha: 1, duration: 500 });
    const alerta = titulo("SEGURANÇA X1", H * .13, 88, "#c5ff52");
    const subtitulo = titulo("PROTOCOLO DE ANIQUILAÇÃO", H * .175, 27);
    const status = titulo("SISTEMA COMPROMETIDO", H * .85, 26, "#72e9d9");
    animar({ targets: [alerta, subtitulo, status], alpha: 1, duration: 500 });
    const alvos = evento.alvos.filter(alvo => alvo.lado !== evento.lado && alvo.removida);
    const cartas = alvos.map(alvo => {
      const p = this.ponto(alvo.lado, alvo.indice), layout = this.jogo.layout;
      const key = alvo.oculto && (alvo.lado !== "jogador" || this.jogo.multiplayer?.spectator) ? "fundoCarta" : alvo.imagem;
      const image = key && this.textures.exists(key) ? guardar(this.add.image(p.x, p.y, key)
        .setDisplaySize(layout.slotW, layout.slotH).setDepth(23)).setName("seguranca-x1-alvo") : null;
      return { p, key, image };
    });
    const chaveArte = this.textures.exists("segurancaX1Arte") ? "segurancaX1Arte" :
      this.textures.exists("despertarDragaoArte") ? "despertarDragaoArte" : evento.fonte.imagem || "o_dragao";
    const dragao = guardar(this.add.image(cx, cy, chaveArte).setDepth(35).setAlpha(0)).setName("seguranca-x1-dragao");
    const escala = Math.min(W * 1.12 / dragao.width, H * .72 / dragao.height);
    dragao.setScale(escala * (reduzido ? 1 : .72));
    const reator = guardar(this.add.graphics().setPosition(cx, cy).setDepth(33).setAlpha(0));
    for (let i = 0; i < 3; i++) {
      const raio = W * (.28 + i * .11);
      reator.lineStyle(i === 1 ? 5 : 2, i === 1 ? 0xbaff3d : 0x42d9cb, .55);
      for (let segmento = 0; segmento < 8; segmento++) {
        reator.beginPath(); reator.arc(0, 0, raio, segmento * Math.PI / 4, segmento * Math.PI / 4 + .55); reator.strokePath();
      }
    }
    for (let i = 0; i < 48; i++) {
      const a = i * Math.PI / 24, r = W * .51, externo = r + (i % 4 ? 10 : 30);
      reator.lineStyle(i % 4 ? 2 : 4, 0xbaff3d, .7);
      reator.lineBetween(Math.cos(a) * r, Math.sin(a) * r, Math.cos(a) * externo, Math.sin(a) * externo);
    }
    animar({ targets: reator, alpha: 1, duration: 1000 });
    if (!reduzido) {
      animar({ targets: reator, angle: 100, duration: 6800 });
      for (let i = 0; i < 40; i++) {
        const a = i * 2.39996, r = W * (.35 + i % 7 * .055);
        const particula = guardar(this.add.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r,
          2 + i % 4, i % 3 ? 0xc5ff52 : 0x5df5f3, .75).setDepth(38));
        animar({ targets: particula, x: cx, y: cy, alpha: 0, scale: .1, duration: 1300,
          delay: 500 + i * 38, ease: "Cubic.In" });
      }
    }
    depois(850, () => {
      estado.fase = "despertar";
      tocar("somDragao", .75, .72); tremer(1400, .004);
      animar({ targets: dragao, alpha: 1, scaleX: escala, scaleY: escala, duration: reduzido ? 500 : 1400, ease: "Cubic.Out" });
      status.setText("AUTORIDADE MÁXIMA · CONTENÇÃO ROMPIDA");
    });
    const alvoY = alvos.length ? alvos.reduce((sum, alvo) => sum + this.ponto(alvo.lado, alvo.indice).y, 0) / alvos.length :
      H * (evento.lado === "jogador" ? .3 : .7);
    const origemX = cx - W * .14, origemY = cy + H * .045;
    const nucleo = guardar(this.add.circle(origemX, origemY, 52, 0xeaffc9, .9).setDepth(45).setAlpha(0));
    const aura = guardar(this.add.circle(origemX, origemY, 130, 0x8dff27, .15).setDepth(44).setAlpha(0));
    depois(2300, () => {
      estado.fase = "sobrecarga";
      tocar("somDragao", .6, 1.12);
      status.setText("ENERGIA CRÍTICA · DISPARO IMINENTE");
      animar({ targets: [nucleo, aura], alpha: 1, duration: 700 });
      if (!reduzido) {
        animar({ targets: nucleo, scale: 1.8, duration: 1050, ease: "Expo.In" });
        animar({ targets: aura, scale: 2.1, duration: 1050, ease: "Expo.In" });
        animar({ targets: dragao, scaleX: escala * 1.12, scaleY: escala * 1.12, duration: 1050, ease: "Cubic.In" });
        for (let i = 0; i < 3; i++) {
          const ring = anel(origemX, origemY, 160 + i * 95, i % 2 ? 0x5ce8ef : 0xbaff3d, 46);
          animar({ targets: ring, scale: .12, alpha: 0, duration: 800, delay: i * 120, ease: "Expo.In" });
        }
      }
    });
    depois(3450, () => {
      estado.fase = "disparo";
      animar({ targets: [nucleo, aura], alpha: 0, duration: 180 });
      animar({ targets: [alerta, subtitulo], alpha: 0, duration: 200 });
      dragao.setVisible(false).setAlpha(0);
      fundo.setFillStyle(0x010604, 1);
    });
    depois(3700, () => {
      tocar("somExplosao", .8, .6); tocar("somTiro", .4, .7); tremer(850, .018);
      animar({ targets: reator, alpha: .2, duration: 350 });
      status.setText(`ALVOS NEUTRALIZADOS · 0 / ${cartas.length}`);
      const feixe = guardar(this.add.graphics().setDepth(50).setAlpha(0)).setName("seguranca-x1-feixe");
      const left = W * .1, right = W * .9, finalY = alvoY + (alvoY < origemY ? -170 : 170);
      feixe.fillStyle(0x60ff1d, .12); feixe.fillTriangle(origemX, origemY, left - 80, finalY, right + 80, finalY);
      feixe.fillStyle(0xbaff3d, .3); feixe.fillTriangle(origemX, origemY, left, finalY, right, finalY);
      feixe.fillStyle(0xf4ffe0, .55); feixe.fillTriangle(origemX, origemY, cx - W * .19, finalY, cx + W * .19, finalY);
      animar({ targets: feixe, alpha: reduzido ? .3 : 1, duration: 180 });
      animar({ targets: feixe, alpha: 0, delay: 1000, duration: 700 });
      if (!reduzido) {
        const plasma = guardar(this.add.graphics().setDepth(52).setBlendMode(Phaser.BlendModes.ADD));
        const energia = { progresso: 0 };
        animar({ targets: energia, progresso: 1, duration: 1300, onUpdate: () => {
          plasma.clear();
          const fase = Math.floor(energia.progresso * 24);
          for (let i = 0; i < 11; i++) {
            const destinoX = W * (.05 + i * .09);
            plasma.lineStyle(i % 3 ? 3 : 7, i % 3 ? 0xd9ffb2 : 0x46fff0, (1 - energia.progresso) * .85);
            plasma.beginPath(); plasma.moveTo(origemX, origemY);
            for (let j = 1; j <= 8; j++) plasma.lineTo(origemX + (destinoX - origemX) * j / 8 +
              Math.sin(i * 7 + j * 5 + fase * 3) * 32, origemY + (finalY - origemY) * j / 8);
            plasma.strokePath();
          }
        } });
        const choque = guardar(this.add.rectangle(cx, H / 2, W, H, 0xe6ffc0, .55).setDepth(80));
        animar({ targets: choque, alpha: 0, duration: 450 });
        for (let i = 0; i < 3; i++) {
          const onda = anel(cx, alvoY, 35, i % 2 ? 0x4bfff0 : 0xdbff8b, 54);
          onda.setScale(1, .4);
          animar({ targets: onda, scaleX: 22, scaleY: 12, alpha: 0, delay: i * 160, duration: 1200, ease: "Cubic.Out" });
        }
      }
      cartas.forEach(({ p, key, image }, index) => depois(250 + index * 110, () => {
        estado.destruidas++;
        status.setText(`ALVOS NEUTRALIZADOS · ${estado.destruidas} / ${cartas.length}`);
        if (image?.active) {
          if (reduzido) animar({ targets: image, alpha: 0, duration: 400 });
          else image.destroy();
        }
        const explosao = guardar(this.add.circle(p.x, p.y, 22, 0xeaffac, .85).setDepth(57)).setName("seguranca-x1-explosao");
        animar({ targets: explosao, scale: reduzido ? 2 : 7, alpha: 0, duration: 650, ease: "Cubic.Out" });
        if (reduzido) return;
        const mira = guardar(this.add.graphics().setDepth(56));
        mira.lineStyle(3, 0xc5ff52, .8); mira.lineBetween(origemX, origemY, p.x, p.y);
        animar({ targets: mira, alpha: 0, duration: 450 });
        if (key && this.textures.exists(key)) for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
          const shard = guardar(this.add.image(p.x, p.y, key).setDepth(59)).setName("seguranca-x1-fragmento");
          shard.setScale(this.jogo.layout.slotW / shard.width, this.jogo.layout.slotH / shard.height)
            .setCrop(col * shard.width / 3, row * shard.height / 3, shard.width / 3, shard.height / 3);
          const a = (row * 3 + col) * Math.PI * 2 / 9 + index;
          animar({ targets: shard, x: p.x + Math.cos(a) * (320 + col * 90), y: p.y + Math.sin(a) * (350 + row * 80),
            angle: (col - 1) * 170 + row * 100, alpha: 0, scaleX: shard.scaleX * .12, scaleY: shard.scaleY * .12,
            duration: 1500, ease: "Cubic.Out" });
        }
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4 + index;
          const fogo = guardar(this.add.circle(p.x, p.y, 3 + i % 4, i % 3 ? 0xc5ff52 : 0x51ecff, .9).setDepth(60));
          animar({ targets: fogo, x: p.x + Math.cos(a) * (170 + i * 20),
            y: p.y + Math.sin(a) * (170 + i * 20), alpha: 0, duration: 1100 });
        }
        if (index % 3 === 0) tocar("somExplosao", .22, .8 + index * .035);
      }));
    });
    depois(6000, () => {
      estado.fase = "retorno";
      status.setText("RUPTURA TOTAL · O DRAGÃO RETORNA");
      dragao.setVisible(true).setScale(escala * (reduzido ? 1 : .4));
      tocar("somDragao", .8, .82); tocar("somExplosao", .65, .65);
      animar({ targets: dragao, alpha: 1, scaleX: escala, scaleY: escala,
        duration: reduzido ? 650 : 900, ease: "Back.Out" });
      animar({ targets: reator, alpha: .8, duration: 700 });
      if (!reduzido) {
        tremer(750, .013);
        const ruptura = guardar(this.add.circle(cx, cy, 55, 0xddffac, .8).setDepth(70))
          .setName("seguranca-x1-retorno");
        animar({ targets: ruptura, scale: 20, alpha: 0, duration: 650, ease: "Expo.Out" });
        for (let i = 0; i < 3; i++) {
          const onda = anel(cx, cy, 65, i % 2 ? 0x52fff0 : 0xbaff3d, 71);
          animar({ targets: onda, scale: 15 + i * 3, alpha: 0, duration: 1000, delay: i * 100, ease: "Cubic.Out" });
          const eco = guardar(this.add.image(cx, cy, chaveArte).setDepth(34).setScale(escala * .5)
            .setTint(i % 2 ? 0x4affeb : 0xbaff3d).setAlpha(.3));
          animar({ targets: eco, scaleX: escala * (1.3 + i * .15), scaleY: escala * (1.3 + i * .15),
            alpha: 0, duration: 950, delay: i * 90 });
        }
        for (let i = 0; i < 28; i++) {
          const a = i * 2.39996;
          const estilhaco = guardar(this.add.rectangle(cx, cy, 3 + i % 4, 35 + i % 5 * 15,
            i % 3 ? 0xbaff3d : 0x51fff0, .85).setAngle(a * 180 / Math.PI + 90).setDepth(72));
          animar({ targets: estilhaco, x: cx + Math.cos(a) * W * .8, y: cy + Math.sin(a) * H * .45,
            alpha: 0, duration: 850 + i % 5 * 70, ease: "Cubic.Out" });
        }
        const fissuras = guardar(this.add.graphics().setDepth(65));
        for (let i = 0; i < 7; i++) {
          const a = i * Math.PI * 2 / 7;
          fissuras.lineStyle(2, 0xbaff3d, .45); fissuras.beginPath(); fissuras.moveTo(cx, alvoY);
          for (let j = 1; j <= 6; j++) fissuras.lineTo(cx + Math.cos(a) * j * 110 + Math.sin(i * 3 + j) * 35,
            alvoY + Math.sin(a) * j * 150);
          fissuras.strokePath();
        }
        animar({ targets: fissuras, alpha: 0, duration: 1600 });
      }
    });
    depois(7100, () => {
      estado.fase = "veredito";
      const vitoria = titulo("ANIQUILAÇÃO", H * .73, 98, "#e4ffc4");
      const detalhe = titulo(evento.lado === "jogador" ? "VITÓRIA ABSOLUTA" : "CAMPO ANIQUILADO", H * .785, 34);
      animar({ targets: [vitoria, detalhe], alpha: 1, duration: 650 });
      status.setText(`${cartas.length} ALVOS · NENHUMA DEFESA`);
      const linha = guardar(this.add.rectangle(cx, H * .815, W * .55, 2, 0xc5ff52).setDepth(90).setAlpha(0));
      animar({ targets: linha, alpha: .7, duration: 650 });
    });
    depois(9700, () => animar({ targets: objetos.filter(objeto => objeto.active), alpha: 0, duration: 450 }));
    depois(10200, () => { limpar(); aoConcluir(); });
  }

  animarDespertarDragao(evento, aoConcluir) {
    const W = LARGURA_LAYOUT, H = ALTURA_LAYOUT, cx = W / 2, cy = H * .44;
    const origem = this.ponto(evento.lado, evento.fonte.indice);
    const objetos = [], timers = [], animacoes = [], sons = [];
    const estado = this.despertarDragaoEmCurso = { eventoId: evento.id, fase: "pressagio" };
    let encerrado = false;
    const guardar = objeto => { objetos.push(objeto); return objeto; };
    const animar = config => { const tween = this.tweens.add(config); animacoes.push(tween); return tween; };
    const depois = (delay, fn) => timers.push(this.time.delayedCall(delay, () => { if (!encerrado) fn(); }));
    const tocar = (key, volume, rate = 1) => {
      if (!this.cache.audio.exists(key)) return;
      const anteriores = this.sound.getAll?.(key) || [];
      this.sound.play(key, { volume: window.cyberduelSettings?.effects(volume, key) ?? volume, rate });
      sons.push(...(this.sound.getAll?.(key) || []).filter(sound => !anteriores.includes(sound)));
    };
    const limpar = () => {
      if (encerrado) return;
      encerrado = true;
      timers.forEach(timer => timer.remove?.(false));
      animacoes.forEach(tween => tween?.remove?.());
      objetos.forEach(objeto => { this.tweens.killTweensOf(objeto); if (objeto.active) objeto.destroy(); });
      sons.forEach(sound => sound.destroy());
      this.jogo.cameras?.main?.shakeEffect?.reset();
      if (this.despertarDragaoEmCurso === estado) this.despertarDragaoEmCurso = null;
      this.events.off("shutdown", limpar);
    };
    this.events.once("shutdown", limpar);
    const brilhoKey = "despertar-dragao-brilho";
    if (!this.textures.exists(brilhoKey)) {
      const textura = this.textures.createCanvas(brilhoKey, 128, 128);
      const ctx = textura.context;
      const gradiente = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradiente.addColorStop(0, "rgba(255,255,240,1)");
      gradiente.addColorStop(.12, "rgba(220,255,170,.85)");
      gradiente.addColorStop(.36, "rgba(145,255,60,.3)");
      gradiente.addColorStop(1, "rgba(80,255,0,0)");
      ctx.fillStyle = gradiente; ctx.fillRect(0, 0, 128, 128); textura.refresh();
    }
    const brilho = (x, y, tamanho, alpha, depth = 108) => guardar(this.add.image(x, y, brilhoKey)
      .setDisplaySize(tamanho, tamanho).setAlpha(alpha).setDepth(depth).setBlendMode("ADD"));
    const texto = (nome, valor, y, tamanho, cor = "#ecffd8") => guardar(this.add.text(cx, y, valor, {
      fontFamily: "Rushblade, Arial, sans-serif", fontSize: `${tamanho}px`, fontStyle: "bold",
      align: "center", color: cor, stroke: "#020803", strokeThickness: 10,
      shadow: { offsetX: 0, offsetY: 0, color: "#7cff25", blur: 18, fill: true },
    }).setOrigin(.5).setDepth(145).setAlpha(0).setName(nome));
    const fundo = guardar(this.add.rectangle(cx, H / 2, W, H, 0x010604, 0).setDepth(100).setInteractive());
    animar({ targets: fundo, fillAlpha: .97, duration: 800, ease: "Sine.InOut" });
    const ambiente = brilho(cx, cy, W * 1.8, 0, 101);
    animar({ targets: ambiente, alpha: .23, duration: 1600 });
    const topo = guardar(this.add.rectangle(cx, 0, W, H * .09, 0x000000).setOrigin(.5, 0).setDepth(150).setScale(1, 0));
    const rodape = guardar(this.add.rectangle(cx, H, W, H * .09, 0x000000).setOrigin(.5, 1).setDepth(150).setScale(1, 0));
    animar({ targets: [topo, rodape], scaleY: 1, duration: 600, ease: "Cubic.Out" });
    const aviso = texto("despertar-dragao-pressagio", "ALGO ANTIGO\nESTÁ DESPERTANDO", H * .22, 62, "#badc9b");
    animar({ targets: aviso, alpha: 1, y: H * .20, duration: 650, delay: 220 });
    const semente = brilho(origem.x, origem.y, 170, .9, 112);
    animar({ targets: semente, x: cx, y: cy, displayWidth: 60, displayHeight: 60,
      duration: 1200, ease: "Expo.In" });

    // Um único desenho animado mantém os anéis e os raios leves no celular.
    const vortice = guardar(this.add.graphics().setDepth(109).setName("despertar-dragao-vortice"));
    const giro = { valor: 0 };
    animar({ targets: giro, valor: Math.PI * 5, duration: 4200, onUpdate: () => {
      vortice.clear();
      for (let anel = 0; anel < 4; anel++) {
        const raio = W * (.14 + anel * .105);
        const rotacao = giro.valor * (anel % 2 ? -1 : 1);
        vortice.lineStyle(anel === 0 ? 5 : 2, anel % 2 ? 0xd5ffb0 : 0x83ff31, .65 - anel * .1);
        for (let arco = 0; arco < 8; arco++) {
          vortice.beginPath();
          for (let ponto = 0; ponto <= 10; ponto++) {
            const a = rotacao + arco * Math.PI / 4 + ponto * .047;
            const x = cx + Math.cos(a) * raio, y = cy + Math.sin(a) * raio * .8;
            if (ponto === 0) vortice.moveTo(x, y); else vortice.lineTo(x, y);
          }
          vortice.strokePath();
        }
      }
    } });
    animar({ targets: vortice, alpha: 0, delay: 3700, duration: 550 });
    for (let i = 0; i < 42; i++) {
      const angulo = i * 2.39996, raio = W * (.35 + (i % 7) * .08);
      const particula = brilho(cx + Math.cos(angulo) * raio, cy + Math.sin(angulo) * raio * 1.5,
        12 + i % 5 * 5, .45 + i % 3 * .15, 111);
      animar({ targets: particula, x: cx, y: cy, alpha: 0, scaleX: .04, scaleY: .04,
        duration: 1000 + i % 6 * 95, delay: i * 19, ease: "Cubic.In" });
    }
    const feixe = guardar(this.add.rectangle(cx, cy, 8, H * .72, 0xcaff8d, .7)
      .setDepth(114).setScale(.1, 0));
    animar({ targets: feixe, scaleX: 1, scaleY: 1, duration: 1100, ease: "Expo.In" });
    const chaveRetrato = this.textures.exists("despertarDragaoRetrato") ? "despertarDragaoRetrato" : evento.fonte.imagem;
    const retrato = guardar(this.add.image(cx, cy + H * .12, chaveRetrato).setDepth(122)
      .setAlpha(0).setTint(0x071109).setName("despertar-dragao-retrato"));
    const escalaRetrato = W * 1.2 / retrato.width;
    retrato.setScale(escalaRetrato * .72);
    const chaveArte = this.textures.exists("despertarDragaoArte") ? "despertarDragaoArte" : evento.fonte.imagem;
    const arte = guardar(this.add.image(cx, H * .43, chaveArte).setDepth(118)
      .setAlpha(0).setVisible(false).setName("despertar-dragao-arte"));
    const escalaArte = Math.min(W * 1.04 / arte.width, H * .78 / arte.height);
    arte.setScale(escalaArte * 1.13);
    const claridade = guardar(this.add.rectangle(cx, H / 2, W, H, 0xe8ffd6)
      .setDepth(140).setAlpha(0));
    const titulo = texto("despertar-dragao-titulo", "O DRAGÃO\nDESPERTOU", H * .77, 112);
    const subtitulo = texto("despertar-dragao-legenda", "O PASSADO NÃO MORREU.", H * .865, 40, "#bfff72");

    depois(1450, () => {
      estado.fase = "ruptura";
      animar({ targets: aviso, alpha: 0, y: H * .17, duration: 250 });
      tocar("somExplosao", .32, .6);
      this.jogo.cameras.main.shake(650, .005);
      animar({ targets: feixe, scaleX: 32, alpha: 0, duration: 650, ease: "Expo.Out" });
      animar({ targets: retrato, alpha: 1, y: cy, scaleX: escalaRetrato, scaleY: escalaRetrato,
        duration: 850, ease: "Cubic.Out" });
      const fendas = guardar(this.add.graphics().setDepth(125));
      for (let i = 0; i < 12; i++) {
        const angulo = i * Math.PI / 6;
        fendas.lineStyle(i % 3 ? 2 : 6, i % 2 ? 0xbaff36 : 0xefffdc, .8);
        fendas.beginPath(); fendas.moveTo(cx, cy);
        for (let j = 1; j <= 6; j++) {
          const r = j * W * .12;
          fendas.lineTo(cx + Math.cos(angulo) * r + Math.sin(i * 5 + j * 3) * 30,
            cy + Math.sin(angulo) * r * 1.5);
        }
        fendas.strokePath();
      }
      animar({ targets: fendas, alpha: 0, duration: 950 });
      for (let i = 0; i < 18; i++) {
        const a = i * 2.39996, r = 80 + i % 5 * 25;
        const fragmento = guardar(this.add.triangle(cx + Math.cos(a) * r, cy + Math.sin(a) * r,
          0, 0, 16 + i % 4 * 8, 9, 3, 42, i % 3 ? 0x284b32 : 0xc6ff80)
          .setStrokeStyle(2, 0xa5ff52).setDepth(127));
        animar({ targets: fragmento, x: cx + Math.cos(a) * W, y: cy + Math.sin(a) * H * .65,
          angle: i * 57, alpha: 0, duration: 1500, ease: "Cubic.Out" });
      }
    });
    depois(2300, () => {
      estado.fase = "despertar";
      tocar("somDragao", .72);
      tocar("somExplosao", .55, .8);
      retrato.clearTint();
      this.jogo.cameras.main.shake(1300, .013);
      claridade.setAlpha(.88);
      animar({ targets: claridade, alpha: 0, duration: 550, ease: "Cubic.Out" });
      animar({ targets: retrato, scaleX: escalaRetrato * 1.12, scaleY: escalaRetrato * 1.12,
        y: cy - H * .025, duration: 1700, ease: "Sine.Out" });
      for (let i = 0; i < 4; i++) {
        const onda = guardar(this.add.circle(cx, cy, 55, 0x9aff37, 0)
          .setStrokeStyle(i ? 3 : 12, i % 2 ? 0xe5ffc6 : 0x91ff21).setDepth(126));
        animar({ targets: onda, scale: 19 + i * 3, alpha: 0, duration: 1400,
          delay: i * 110, ease: "Expo.Out" });
      }
      for (let i = 0; i < 30; i++) {
        const a = i * 2.39996, r = W * (.45 + i % 4 * .18);
        const faisca = brilho(cx, cy, 16 + i % 5 * 5, .9, 130);
        animar({ targets: faisca, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 1.5,
          alpha: 0, duration: 1000 + i % 5 * 160, ease: "Cubic.Out" });
      }
      const sombraTexto = guardar(this.add.rectangle(cx, H * .84, W, H * .3, 0x010704, .77).setDepth(141));
      animar({ targets: sombraTexto, alpha: 0, delay: 1900, duration: 500 });
      titulo.setScale(1.32);
      animar({ targets: titulo, alpha: 1, scaleX: 1, scaleY: 1, duration: 500, ease: "Expo.Out" });
      animar({ targets: subtitulo, alpha: 1, duration: 500, delay: 350 });
    });
    depois(4300, () => {
      estado.fase = "memorias";
      arte.setVisible(true);
      animar({ targets: arte, alpha: .95, scaleX: escalaArte, scaleY: escalaArte, duration: 1100, ease: "Sine.Out" });
      animar({ targets: retrato, alpha: 0, x: cx + W * .12, duration: 800 });
      animar({ targets: [titulo, subtitulo], alpha: 0, duration: 220 });
      depois(240, () => {
        titulo.setText("MEMÓRIAS\nDO PASSADO").setScale(.86).setAlpha(0);
        subtitulo.setText("+3 PA A CADA RODADA").setAlpha(0);
        animar({ targets: titulo, alpha: 1, scaleX: 1, scaleY: 1, duration: 600, ease: "Cubic.Out" });
        animar({ targets: subtitulo, alpha: 1, duration: 500, delay: 250 });
      });
      const moldura = guardar(this.add.graphics().setDepth(120));
      moldura.lineStyle(2, 0xc7ff80, .8);
      for (const sinal of [-1, 1]) {
        const x = cx + sinal * W * .45;
        for (const y of [H * .13, H * .68]) {
          moldura.beginPath(); moldura.moveTo(x - sinal * 80, y); moldura.lineTo(x, y);
          moldura.lineTo(x, y + (y < cy ? 1 : -1) * 100); moldura.strokePath();
        }
      }
      animar({ targets: moldura, alpha: 0, delay: 1500, duration: 700 });
    });
    const duracao = Math.min(11000, Math.max(7600, 2300 + (this.cache.audio.get?.("somDragao")?.duration || 0) * 1000));
    depois(duracao - 1100, () => {
      estado.fase = "retorno";
      animar({ targets: [titulo, subtitulo, topo, rodape, fundo, ambiente], alpha: 0, duration: 850 });
      animar({ targets: arte, x: origem.x, y: origem.y,
        scaleX: this.jogo.layout.slotW / arte.width, scaleY: this.jogo.layout.slotH / arte.height,
        alpha: 0, duration: 950, ease: "Cubic.InOut" });
      const eco = guardar(this.add.rectangle(origem.x, origem.y, this.jogo.layout.slotW, this.jogo.layout.slotH,
        0x9dff3d, .12).setStrokeStyle(5, 0xccff8c).setDepth(129).setAlpha(0));
      animar({ targets: eco, alpha: .9, duration: 320, delay: 450, yoyo: true });
    });
    depois(duracao, () => { limpar(); aoConcluir(); });
  }

  animarEncontro(evento, aoConcluir) {
    const pares = {
      boi_raspclay: ["encontroBoi", "encontroRaspClay", "O BOI", "RASPCLAY MONTECORP", "fundoEncontroBoi"],
      tigre_dipsp: ["encontroDIPSP", "encontroTigre", "DIPSP", "O TIGRE", "fundoEncontroTigre"],
      bom_mau: ["encontroBom", "encontroMau", "O BOM", "O MAU", "fundoEncontroBom"],
    };
    const trio = evento.encontro === "trio";
    const aprendizado = evento.encontro === "aprendizado";
    const par = pares[evento.encontro];
    const chaves = aprendizado ? ["encontroSarda", "encontroFelipe", "encontroAluno"] : trio ? ["posterTrio"] : par?.slice(0, 2);
    if (!chaves?.every(chave => this.textures.exists(chave))) { aoConcluir(); return; }
    const combate = evento.encontro === "tigre_dipsp";
    const movimentoReduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const cor = evento.encontro === "bom_mau" ? 0xe9b86b : 0x5be4ff;
    const duracao = aprendizado ? movimentoReduzido ? 2600 : 6800 : trio ? 4400 : combate ? 3500 : 2800;
    const painel = this.add.container(LARGURA_LAYOUT / 2, ALTURA_LAYOUT / 2, []).setDepth(1000).setAlpha(0);
    painel.encontro = evento.encontro;
    this.encontroEmCurso = painel;
    painel.faseEncontro = "abertura";
    painel.impactosEncontro = 0;
    const timers = [], animacoes = [], sons = [];
    let encerrado = false;
    const depois = (delay, callback) => timers.push(this.time.delayedCall(delay, () => { if (!encerrado) callback(); }));
    const animar = config => {
      const onComplete = config.onComplete, onUpdate = config.onUpdate;
      animacoes.push(this.tweens.add({ ...config,
        onComplete: () => { if (!encerrado) onComplete?.(); },
        onUpdate: () => { if (!encerrado) onUpdate?.(); },
      }));
    };
    const tocar = (key, volume = .16) => {
      if (!this.cache.audio.exists(key)) return;
      const anteriores = this.sound.getAll?.(key) || [];
      this.sound.play(key, { volume: window.cyberduelSettings?.effects(volume, key) ?? volume });
      sons.push(...(this.sound.getAll?.(key) || []).filter(sound => !anteriores.includes(sound)));
    };
    const limpar = () => {
      if (encerrado) return;
      encerrado = true;
      timers.forEach(timer => timer?.remove?.());
      animacoes.forEach(animacao => animacao?.stop?.());
      sons.forEach(som => som.destroy());
      this.events?.off("shutdown", limpar);
      if (this.encontroEmCurso === painel) this.encontroEmCurso = null;
      if (painel.active) painel.destroy(true);
    };
    this.events?.once("shutdown", limpar);
    const guardar = objeto => { painel.add([objeto]); return objeto; };
    guardar(this.add.rectangle(0, 0, LARGURA_LAYOUT, ALTURA_LAYOUT, 0x030509, trio ? .98 : .94)).setInteractive();
    const texto = (x, y, valor, tamanho, color = "#f9e6c8") => guardar(this.add.text(x, y, valor, {
      fontFamily: "Rushblade, Arial, sans-serif", fontSize: `${tamanho}px`, color,
      align: "center", stroke: "#080b11", strokeThickness: 5, wordWrap: { width: 940 },
    }).setOrigin(.5));
    if (aprendizado) {
      const W = LARGURA_LAYOUT, H = ALTURA_LAYOUT;
      if (this.textures.exists("fundoAprendizado")) {
        const fundo = guardar(this.add.image(0, 0, "fundoAprendizado"));
        fundo.name = "fundo-encontro";
        const escala = Math.max(W / fundo.width, H / fundo.height);
        fundo.setScale(escala).setAlpha(.85);
        if (!movimentoReduzido) animar({ targets: fundo, scaleX: escala * 1.07, scaleY: escala * 1.07, duration: duracao, ease: "Sine.easeInOut" });
      }
      const atmosfera = guardar(this.add.graphics());
      atmosfera.fillGradientStyle(0x07020f, 0x07020f, 0x07020f, 0x07020f, .98, .98, 0, 0);
      atmosfera.fillRect(-W / 2, -H / 2, W, 610);
      atmosfera.fillGradientStyle(0x07020f, 0x07020f, 0x07020f, 0x07020f, 0, 0, 1, 1);
      atmosfera.fillRect(-W / 2, 620, W, H / 2 - 620);
      const portal = guardar(this.add.graphics().setBlendMode("ADD"));
      const professores = chaves.slice(0, 2).map((chave, i) => {
        const x = i ? 255 : -255;
        const arte = guardar(this.add.image(x, 380, chave).setOrigin(.5, 1));
        arte.name = i ? "aprendizado-felipe" : "aprendizado-sarda";
        const escala = Math.min(650 / arte.width, 1040 / arte.height);
        arte.setScale(escala).setAlpha(0);
        if (!movimentoReduzido) arte.setPosition(i ? 850 : -850, 440).setAngle(i ? 7 : -7);
        animar({ targets: arte, x, y: 380, angle: 0, alpha: 1, delay: 300 + i * 170,
          duration: movimentoReduzido ? 350 : 950, ease: "Cubic.easeOut" });
        return arte;
      });
      const energia = guardar(this.add.graphics().setBlendMode("ADD"));
      const aura = guardar(this.add.image(0, 800, "encontroAluno").setOrigin(.5, 1)
        .setTint(0xc24cff).setTintMode(Phaser.TintModes.FILL).setBlendMode("ADD").setAlpha(0));
      const aluno = guardar(this.add.image(0, 800, "encontroAluno").setOrigin(.5, 1));
      aluno.name = "aprendizado-aluno";
      const escalaAluno = Math.min(940 / aluno.width, 900 / aluno.height);
      aluno.setScale(escalaAluno).setAlpha(0);
      aura.setScale(escalaAluno * 1.035);
      if (!movimentoReduzido) aluno.y = 1050;
      animar({ targets: aluno, y: 800, alpha: 1, delay: 650, duration: movimentoReduzido ? 350 : 1000, ease: "Cubic.easeOut" });
      const impacto = guardar(this.add.graphics());
      const eclipse = guardar(this.add.rectangle(0, 0, W, H, 0x05010b, 1).setAlpha(0));
      const estado = { progresso: 0, explosao: 0, orbita: 0 };
      const desenhar = () => {
        const p = estado.progresso, t = estado.orbita * Math.PI * 5 + p * Math.PI * 2;
        portal.clear(); energia.clear(); impacto.clear();
        for (let i = 0; i < 3; i++) {
          const raio = 300 + i * 64;
          portal.lineStyle(i ? 2 : 5, i % 2 ? 0x54dfff : 0xc865ff, .22 + p * .25);
          portal.beginPath();
          portal.arc(0, 80, raio, t * (i % 2 ? -1 : 1) + i, t * (i % 2 ? -1 : 1) + i + Math.PI * 1.65);
          portal.strokePath();
          for (let j = 0; j < 12; j++) {
            const a = j * Math.PI / 6 + t * .15;
            portal.lineBetween(Math.cos(a) * raio, 80 + Math.sin(a) * raio,
              Math.cos(a) * (raio + 15), 80 + Math.sin(a) * (raio + 15));
          }
        }
        if (!movimentoReduzido) {
          for (let j = 0; j < 24; j++) {
            const a = j * Math.PI / 12 + t * .25, f = (estado.orbita * 2 + j / 24) % 1;
            const r = 110 + (1 - f) * 850;
            portal.lineStyle(j % 3 ? 1 : 3, j % 2 ? 0x63e6ff : 0xffb568, .12 + p * .3);
            portal.lineBetween(Math.cos(a) * r, 130 + Math.sin(a) * r * 1.35,
              Math.cos(a) * (r + 60 + p * 110), 130 + Math.sin(a) * (r + 60 + p * 110) * 1.35);
          }
        }
        if (p > 0 && p < 1 && !movimentoReduzido) {
          for (const lado of [-1, 1]) {
            const cor = lado < 0 ? 0xffb044 : 0x58e5ff;
            for (let camada = 0; camada < 3; camada++) {
              energia.lineStyle([42, 12, 3][camada], camada === 2 ? 0xffffff : cor, [.08, .6, .95][camada]);
              energia.beginPath();
              for (let j = 0; j <= 36; j++) {
                const f = j / 36, x = lado * 350 * (1 - f);
                const y = -160 + f * 310 + Math.sin(f * 15 + t * 4 + lado) * Math.sin(f * Math.PI) * (55 + p * 35);
                if (j) energia.lineTo(x, y); else energia.moveTo(x, y);
              }
              energia.strokePath();
            }
            for (let j = 0; j < 22; j++) {
              const f = (p * 3 + j / 22) % 1, a = j * 2.4 + t;
              const x = lado * (460 * (1 - f)), y = 150 - (1 - f) * 380 + Math.sin(a) * 80 * (1 - f);
              energia.fillStyle(j % 3 ? cor : 0xffffff, .8 * Math.sin(f * Math.PI));
              energia.fillRect(x, y, 3 + f * 5, 12 + f * 12);
            }
          }
          for (let j = 0; j < 30; j++) {
            const a = j * Math.PI / 15 + t * 2, r = 290 * (1 - p * .65);
            const x = Math.cos(a) * r, y = 140 + Math.sin(a) * r * .4;
            energia.lineStyle(j % 3 ? 2 : 5, j % 2 ? 0xffbd73 : 0x85f5ff, .8);
            energia.lineBetween(x, y, Math.cos(a + .17) * r, 140 + Math.sin(a + .17) * r * .4);
          }
        }
        const e = estado.explosao;
        if (e > 0 && e < 1 && !movimentoReduzido) {
          energia.fillStyle(0xa565ff, (1 - e) * .24);
          energia.fillRect(-140 * (1 - e), -H / 2, 280 * (1 - e), H);
          energia.fillStyle(0xd5ffff, (1 - e) * .75);
          energia.fillRect(-22 * (1 - e), -H / 2, 44 * (1 - e), H);
          for (let i = 0; i < 3; i++) {
            impacto.lineStyle(8 - i * 2, i ? 0xc671ff : 0xffd7a0, (1 - e) * .85);
            impacto.strokeCircle(0, 130, 80 + e * (700 + i * 150));
          }
          for (let j = 0; j < 28; j++) {
            const a = j * Math.PI * 2 / 28, r = 90 + e * 1000;
            impacto.lineStyle(j % 3 ? 2 : 5, j % 2 ? 0x82edff : 0xffc97e, (1 - e) * .8);
            impacto.lineBetween(Math.cos(a) * r, 130 + Math.sin(a) * r,
              Math.cos(a) * (r + 60 + j % 4 * 35), 130 + Math.sin(a) * (r + 60 + j % 4 * 35));
          }
        }
      };
      desenhar();
      if (!movimentoReduzido) {
        animar({ targets: estado, orbita: 1, duration: duracao, onUpdate: desenhar });
        depois(3250, () => animar({ targets: eclipse, alpha: .65, duration: 260, ease: "Cubic.easeIn" }));
      }
      const transferencia = movimentoReduzido ? 800 : 1800;
      const assimilacao = movimentoReduzido ? 1400 : 3700;
      if (!movimentoReduzido) depois(600, () => tocar("somProfessores", .22));
      depois(transferencia, () => {
        painel.faseEncontro = "transferencia";
        if (!movimentoReduzido) {
          animar({ targets: estado, progresso: 1, duration: 1900, ease: "Sine.easeIn", onUpdate: desenhar });
          animar({ targets: aura, alpha: .65, duration: 1900 });
          animar({ targets: [aluno, aura], y: 760, duration: 1900, ease: "Sine.easeIn" });
          professores.forEach((arte, i) => animar({ targets: arte, x: i ? 305 : -305, y: 350,
            alpha: .65, duration: 1900, ease: "Sine.easeIn" }));
        }
      });
      depois(assimilacao, () => {
        painel.faseEncontro = "assimilacao";
        painel.impactosEncontro++;
        if (!movimentoReduzido) {
          tocar("somExplosao", .14);
          animar({ targets: eclipse, alpha: 0, duration: 120 });
          aura.setTint(0xaaffef);
          animar({ targets: estado, explosao: 1, duration: 1250, ease: "Cubic.easeOut", onUpdate: desenhar });
          animar({ targets: aura, alpha: .9, scaleX: escalaAluno * 1.08, scaleY: escalaAluno * 1.08, duration: 220, yoyo: true });
          animar({ targets: aluno, scaleX: escalaAluno * 1.045, scaleY: escalaAluno * 1.045, duration: 240, yoyo: true, ease: "Cubic.easeOut" });
          animar({ targets: professores, alpha: .25, duration: 650 });
          animar({ targets: [aluno, aura], y: 735, duration: 450, ease: "Cubic.easeOut" });
          const flash = guardar(this.add.rectangle(0, 0, W, H, 0xd6b6ff, .32));
          animar({ targets: flash, alpha: 0, duration: 550 });
          animar({ targets: painel, x: W / 2 + 12, duration: 45, yoyo: true, repeat: 3 });
        }
      });
      depois(movimentoReduzido ? 1800 : 4600, () => {
        painel.faseEncontro = "concluido";
        if (!movimentoReduzido) {
          animar({ targets: aura, alpha: .22, duration: 900 });
        }
      });
    } else if (trio) {
      const poster = guardar(this.add.image(0, 0, "posterTrio"));
      poster.name = "poster-trio";
      const escala = Math.min(LARGURA_LAYOUT * .94 / poster.width, ALTURA_LAYOUT * .88 / poster.height);
      poster.setScale(escala);
      poster.revelado = movimentoReduzido;
      if (!movimentoReduzido) {
        poster.setScale(escala * .95).setAngle(-.7);
        poster.setCrop(0, 0, poster.width, 0);
        const impressao = { progresso: 0 };
        animar({ targets: impressao, progresso: 1, delay: 200, duration: 950, ease: "Cubic.easeInOut",
          onUpdate: () => poster.setCrop(0, 0, poster.width, poster.height * impressao.progresso),
          onComplete: () => { poster.setCrop(); poster.revelado = true; painel.faseEncontro = "cartaz"; } });
        animar({ targets: poster, scaleX: escala, scaleY: escala, angle: 0, duration: 3900, ease: "Sine.easeOut" });
      } else depois(450, () => { painel.faseEncontro = "cartaz"; });
    } else {
      guardar(this.add.rectangle(0, 0, LARGURA_LAYOUT, 1180, 0x0a131e));
      if (this.textures.exists(par[4])) {
        const fundo = guardar(this.add.image(0, 0, par[4]));
        fundo.name = "fundo-encontro";
        const escala = Math.max(LARGURA_LAYOUT / fundo.width, 1180 / fundo.height);
        fundo.setScale(escala).setAlpha(0);
        animar({ targets: fundo, alpha: 1, duration: 420 });
        if (!movimentoReduzido) animar({ targets: fundo, scaleX: escala * 1.035, scaleY: escala * 1.035,
          duration: duracao, ease: "Sine.easeInOut" });
      }
      for (const y of [-600, 600]) guardar(this.add.rectangle(0, y, LARGURA_LAYOUT, 3, cor));
      const titulo = texto(0, -715, "DESTINOS EM CONFLITO", 35).setAlpha(0);
      animar({ targets: titulo, alpha: 1, delay: 350, duration: 280 });
      const retratos = chaves.map((chave, indice) => {
        const x = [-280, 280][indice];
        const arte = guardar(this.add.image(x, 570, chave).setOrigin(.5, 1));
        const escala = Math.min(560 / arte.width, 1140 / arte.height);
        arte.setScale(escala).setAlpha(0);
        const inicio = movimentoReduzido ? x : x + (x < 0 ? -440 : 440);
        arte.x = inicio;
        arte.name = indice === 0 ? "retrato-esquerdo" : "retrato-direito";
        if (!movimentoReduzido) arte.y += 35;
        animar({ targets: arte, x, y: 570, alpha: 1, duration: 650, delay: 150 + indice * 130, ease: "Cubic.easeOut" });
        return arte;
      });
      for (const [x, nome] of [[-280, par[2]], [280, par[3]]]) {
        const label = texto(x, 660, nome, 36).setAlpha(0);
        label.setScale(Math.min(1, 480 / label.width));
        animar({ targets: label, alpha: 1, delay: 700, duration: 250 });
      }
      const versus = texto(0, -20, "VS", 94, "#ffffff").setAlpha(0);
      animar({ targets: versus, alpha: 1, delay: 780, duration: 220 });
      depois(950, () => { painel.faseEncontro = "confronto"; });
      if (combate) {
        const dipspAtaca = evento.fonte.nome === "Agente da DIPSP";
        const frase = texto(0, 770, dipspAtaca
          ? "Ameaça identificada, iniciada neutralização"
          : "Abatendo lacaios do sistema", 34, dipspAtaca ? "#83d9ff" : "#ff8980").setAlpha(0);
        frase.name = "frase-encontro";
        animar({ targets: frase, alpha: 1, delay: 700, duration: 250 });
        const primeiro = dipspAtaca ? 0 : 1;
        for (const [turno, delay] of (movimentoReduzido ? [] : [1050, 1530, 2010, 2490]).entries()) {
          const indice = turno % 2 ? 1 - primeiro : primeiro;
          const dipsp = indice === 0, direcao = dipsp ? 1 : -1;
          const atacante = retratos[indice], defensor = retratos[1 - indice];
          depois(delay, () => { painel.faseEncontro = "combate"; painel.impactosEncontro++; tocar(dipsp ? "somTiro" : "somTigreAtaque"); });
          animar({ targets: atacante, x: direcao * -140, duration: 150, delay, yoyo: true, ease: "Cubic.easeIn" });
          animar({ targets: defensor, x: direcao * 335, angle: direcao * 3, duration: 130, delay: delay + 130, yoyo: true });
        }
      }
    }
    animar({ targets: painel, alpha: 1, duration: 250 });
    depois(160, () => tocar("somInteracao", .10));
    depois(duracao, () => {
      painel.faseEncontro = "saida";
      animar({ targets: painel, alpha: 0, duration: 280, onComplete: () => {
        limpar(); aoConcluir();
      } });
    });
  }

  proximo() {
    if (this.executando || !this.fila.length) return;
    this.executando = true;
    const evento = this.fila.shift();
    this.eventoAtual = evento;
    this.exibidos.push(evento.id);
    if (evento.encontro && !evento.encontroExibido) {
      evento.encontroExibido = true;
      // Retoma o mesmo evento: a vinheta antecede os efeitos e não consome a ação.
      this.animarEncontro(evento, () => {
        this.fila.unshift(evento); this.exibidos.pop();
        this.executando = false; this.proximo();
      });
      return;
    }
    if (evento.momento === "seguranca_x1") {
      this.animarSegurancaX1(evento, () => {
        this.executando = false; this.eventoAtual = null; this.proximo();
      });
      return;
    }
    const remoto = evento.lado !== "jogador" || this.jogo.multiplayer?.spectator;
    const fonteOculta = remoto && evento.fonte.oculto;
    const fonte = fonteOculta ? { nome: "Carta oculta", indice: evento.fonte.indice } : evento.fonte;
    const perfil = APRESENTACAO_EFEITOS[fonte.habilidadeAprendidaDe || fonte.nome] || {};
    if (evento.momento === "despertar" && perfil.visual === "fullart" &&
        fonte.imagem && this.textures.exists(fonte.imagem)) {
      this.animarDespertarDragao(evento, () => {
        this.executando = false; this.eventoAtual = null; this.proximo();
      });
      return;
    }
    const objetos = [];
    const guardar = (o) => { objetos.push(o); return o; };
    const impactoJuggernaut = perfil.visual === "impactoJuggernaut" && evento.momento === "habilidade";
    const ataqueBom = perfil.visual === "passaros" && evento.momento === "habilidade";
    const curaMedico = perfil.visual === "cura" && evento.momento === "habilidade";
    const cartasAntesDano = [];
    // O motor já resolveu o ataque; mantém o PA anterior até apresentar o impacto.
    if (impactoJuggernaut || ataqueBom || curaMedico) for (const alvo of evento.alvos || []) {
      if (curaMedico ? !(alvo.delta > 0) : !(alvo.delta < 0) && !alvo.removida) continue;
      const oculta = alvo.oculto && (alvo.lado !== "jogador" || this.jogo.multiplayer?.spectator);
      const chave = oculta ? "fundoCarta" : alvo.imagem;
      if (!chave || !this.textures.exists(chave)) continue;
      const ponto = this.ponto(alvo.lado, alvo.indice);
      const layout = this.jogo.layout;
      const filhos = [this.add.image(0, 0, chave).setDisplaySize(layout.slotW, layout.slotH)];
      const atual = this.jogo.partida?.[alvo.lado]?.campo.cartas.find(c => c?.id === alvo.id);
      let pa;
      if (!oculta) {
        const y = layout.slotH / 2 - 42;
        pa = this.add.text(0, y, `${(atual?.poder || 0) - (alvo.delta || 0)}`, {
          fontSize: "26px", color: "#ffffff", fontStyle: "bold",
        }).setOrigin(0.5);
        filhos.push(this.add.rectangle(0, y, 46, 46, 0x061027, 1)
          .setStrokeStyle(1.5, alvo.lado === "jogador" ? 0x54ddff : 0xff63ad), pa);
      }
      const carta = guardar(this.add.container(ponto.x, ponto.y, filhos)
        .setAngle(this.jogo.multiplayer?.presentation && alvo.lado === "inimigo" ? 180 : 0));
      carta.antesDanoJuggernaut = impactoJuggernaut;
      carta.antesDanoBom = ataqueBom;
      carta.antesCuraMedico = curaMedico;
      cartasAntesDano.push({ carta, pa, alvo });
    }
    // Alvos, sons e vídeos começam no impacto da carta, na mesma fila.
    const aplicar = () => {
      const origem = this.ponto(evento.lado, fonte.indice);
      const echo = !!perfil.imagem;
      const cor = echo ? 0xff304e : 0x69caff;
      const pulsar = (p, largura = 170, altura = 240, corHalo = cor) => {
        const halo = guardar(this.add.rectangle(p.x, p.y, largura, altura, corHalo, 0.12).setStrokeStyle(5, corHalo));
        this.tweens.add({ targets: halo, scale: 1.12, alpha: 0.15, duration: 420, yoyo: true });
      };
      const ativo = perfil.momentos?.includes(evento.momento) &&
        (!perfil.somenteGanho || evento.alvos?.some((alvo) => alvo.id === fonte.id && alvo.delta > 0));
      const pichacaoAtiva = ativo && (!perfil.picharMomentos || perfil.picharMomentos.includes(evento.momento));
      let alvos = (evento.alvos || []).filter((alvo) => alvo.selecionado || alvo.lado !== evento.lado || alvo.id !== fonte.id || perfil.imagem === "efeitoBoi" || (alvo.delta && perfil.imagem !== "efeitoRato"));
      if (ativo && perfil.visual === "garras" && alvos.length && this.cache.audio.exists("somTigreAtaque"))
        this.sound.play("somTigreAtaque", { volume: window.cyberduelSettings?.effects(0.3, "somTigreAtaque") ?? 0.3 });
      // Só o autor vê onde a armadilha foi plantada; o disparo é público.
      if (remoto && fonte.efeito?.tipo === TIPOS_EFEITO.ARMADILHA_ESPACO && evento.momento === "conjuracao") alvos = [];
      if (fonte.indice >= 0 && ((!echo && !perfil.momentos) ||
        (ativo && ["efeitoRato", "efeitoCabra"].includes(perfil.imagem)))) pulsar(origem);
      if (ativo && perfil.visual === "tutorial" && this.textures.exists("iaTutorial14")) {
        const topo = this.jogo.multiplayer?.presentation && evento.lado === "inimigo";
        const tutorial = guardar(this.add.image(topo ? 160 : LARGURA_LAYOUT - 160,
          topo ? 170 : ALTURA_LAYOUT - 170, "iaTutorial14").setDepth(20));
        tutorial.setScale(Math.min(280 / tutorial.width, 280 / tutorial.height)).setAngle(topo ? 180 : 0).setAlpha(0);
        this.tweens.add({ targets: tutorial, alpha: 1, duration: 220 });
      }
      if (ativo && perfil.imagem === "efeitoCoelho") {
        this.pichar(perfil.imagem, { x: LARGURA_LAYOUT / 2, y: ALTURA_LAYOUT / 2 }, guardar, 650, 750);
      }
      let danoApresentado = false;
      const aplicarDano = () => {
        if (danoApresentado) return;
        danoApresentado = true;
        for (const { carta, pa, alvo } of cartasAntesDano) {
          if (alvo.removida && !ataqueBom) pa?.setText("0");
          else carta.destroy();
        }
        for (const alvo of alvos) {
          const destino = this.ponto(alvo.lado, alvo.indice);
          destino.lado = alvo.lado;
          if (ativo && perfil.visual === "refrigeracao") this.revelarSimbolo("efeitoRefrigerador", destino, guardar);
          if (ativo && perfil.visual === "extensao" && Number.isInteger(alvo.indiceAnterior) && alvo.indiceAnterior !== alvo.indice) {
            this.revelarSimbolo("efeitoMontador", { ...this.ponto(alvo.lado, alvo.indiceAnterior), lado: alvo.lado }, guardar);
            this.revelarSimbolo("efeitoMontador", destino, guardar);
          }
          if (ativo && perfil.visual === "aprendizado" && alvo.id !== fonte.id) {
            const brilho = guardar(this.add.rectangle(destino.x, destino.y, this.jogo.layout.slotW, this.jogo.layout.slotH, 0x9944ff, .65).setDepth(11));
            brilho.brilhoAprendizado = true;
            this.tweens.add({ targets: brilho, alpha: 0, duration: 850 });
          }
          if (ativo && perfil.visual === "extintor") {
            for (let i = 0; i < 12; i++) {
              const fumaça = guardar(this.add.ellipse(origem.x, origem.y, 26 + i * 3, 18 + i * 2, 0xffffff, .3).setDepth(11));
              fumaça.rajadaExtintor = true;
              this.tweens.add({ targets: fumaça, x: destino.x + (i % 3 - 1) * 18, y: destino.y + (i % 4 - 1.5) * 22,
                scaleX: 2.5, scaleY: 2.5, alpha: 0, delay: i * 20, duration: 400 });
            }
          }
          if (ativo && perfil.visual === "opiniao") this.revelarSimbolo(alvo.lado === evento.lado ? "efeitoInfluenciadorLike" : "efeitoInfluenciadorDeslike", destino, guardar);
          if (ativo && perfil.visual === "moeda" && alvo.delta > 0 && this.textures.exists("efeitoCrypto")) {
            const moeda = guardar(this.add.sprite(destino.x, destino.y, "efeitoCrypto").setDepth(11));
            const layout = this.jogo.layout;
            const escala = Math.min((layout.slotW - 20) / moeda.width, (layout.slotH - 20) / moeda.height);
            moeda.setScale(escala * 0.6).setAlpha(0)
              .setAngle(this.jogo.multiplayer?.presentation && alvo.lado === "inimigo" ? 180 : 0).play("moeda-crypto");
            this.tweens.add({ targets: moeda, scaleX: escala, scaleY: escala, alpha: 1, duration: 180, ease: "Back.Out" });
          }
          if (ativo && perfil.visual === "forja" && alvo.delta > 0 && this.textures.exists("efeitoFerreira")) {
            const forja = guardar(this.add.sprite(destino.x, destino.y, "efeitoFerreira").setDepth(11));
            forja.setScale(Math.min(180 / forja.width, 210 / forja.height)).play("forja-ferreira");
          }
          if (ativo && perfil.visual === "soco" && alvo.delta < 0 && this.textures.exists("efeitoMau")) {
            const soco = guardar(this.add.image(destino.x, destino.y, "efeitoMau").setDepth(11));
            const escala = Math.min(180 / soco.width, 210 / soco.height);
            soco.setScale(escala * 0.65).setAngle(this.jogo.multiplayer?.presentation && alvo.lado === "inimigo" ? 180 : 0);
            this.tweens.add({ targets: soco, scaleX: escala, scaleY: escala, duration: 140, ease: "Back.Out" });
            this.tweens.add({ targets: soco, alpha: 0, delay: 350, duration: 220 });
          }
          if ((!perfil.momentos && !echo) || ativo) pulsar(destino, 170, 240, perfil.corAlvo ?? (echo ? cor : alvo.delta < 0 ? 0xff526c : 0x69caff));
          if (pichacaoAtiva && perfil.imagem && perfil.imagem !== "efeitoCoelho" && (perfil.imagem !== "efeitoAranha" || alvo.capturada)) {
            const layout = this.jogo.layout;
            this.pichar(perfil.imagem, destino, guardar,
              alvo.armadilha ? layout.slotW - 8 : 170, alvo.armadilha ? layout.slotH - 8 : 210);
          }
          if (alvo.cascaGrossa) {
            pulsar(destino, 170, 240, 0xff304e);
            this.pichar("efeitoPorco", destino, guardar);
            if (this.cache.audio.exists("somPorco")) this.sound.play("somPorco", { volume: window.cyberduelSettings?.effects(0.3, "somPorco") ?? 0.3 });
          }
          if (ativo && perfil.visual === "garras") {
            for (let i = 0; i < 3; i++) {
              const garra = guardar(this.add.triangle(destino.x + (i - 1) * 35, destino.y,
                0, 0, 14, 55, 5, 180, 0xffdae0).setStrokeStyle(2, 0xff405c))
                .setAngle(28).setScale(1, 0.02).setDepth(11);
              this.tweens.add({ targets: garra, scaleY: 1, delay: i * 70, duration: 130,
                onComplete: () => this.tweens.add({ targets: garra, alpha: 0, delay: 180, duration: 220 }) });
            }
          }
          if (ativo && perfil.imagem === "efeitoCavalo" && alvo.delta < 0) {
            const cartaCampo = this.jogo.children.list.find((o) => o.dadosCartaCampo?.id === alvo.id &&
              this.jogo.partida?.[alvo.lado]?.campo.cartas.includes(o.dadosCartaCampo));
            this.tremerCarta(cartaCampo);
          }
          if (alvo.removida && !impactoJuggernaut && !(alvo.oculto && (alvo.lado !== "jogador" || this.jogo.multiplayer?.spectator))) {
            if (alvo.imagem && this.textures.exists(alvo.imagem)) {
              const orientacao = this.jogo.multiplayer?.presentation && alvo.lado === "inimigo" ? 180 : 0;
              const fantasma = guardar(this.add.image(destino.x, destino.y, alvo.imagem).setDisplaySize(170, 230).setAngle(orientacao));
              if (ativo && perfil.imagem === "efeitoCavalo" && alvo.delta < 0) this.tremerCarta(fantasma);
              this.tweens.add({ targets: fantasma, alpha: 0, angle: orientacao + 18, y: destino.y + 65, duration: 850 });
            }
            if (alvo.nome === "CyberPolíticos") {
              for (let i = 0; i < 14; i++) {
                const papel = guardar(this.add.rectangle(destino.x, destino.y, 10, 18, i % 2 ? 0xb779ed : 0xe4d5fa));
                this.tweens.add({ targets: papel, x: destino.x + Math.cos(i) * 150,
                  y: destino.y + Math.sin(i) * 180, angle: i * 70, alpha: 0, duration: 900 });
              }
              guardar(this.add.text(destino.x, destino.y, "CONTRATO\nROMPIDO", { fontSize: "25px", color: "#e2b0ff", align: "center", stroke: "#160c22", strokeThickness: 5 }).setOrigin(0.5));
            }
          }
          if ((echo || perfil.somenteGanho) && !ativo && !alvo.cascaGrossa) continue;
          if (alvo.armadilha) continue;
          const texto = alvo.removida ? "Saiu do campo" : alvo.delta ? `${alvo.delta > 0 ? "+" : ""}${alvo.delta} PA` : alvo.bloqueado ? (perfil.imagem === "efeitoBoi" ? "PA restaurado" : "PA protegido") : "Efeito ativo";
          guardar(this.add.text(destino.x, destino.y - 70, texto, {
            fontFamily: "Arial, sans-serif", fontSize: "22px", fontStyle: "bold", align: "center",
            wordWrap: { width: 165, useAdvancedWrap: true }, color: alvo.delta < 0 ? "#ff889e" : "#a6deff",
            stroke: "#06220f", strokeThickness: 6,
          }).setOrigin(0.5).setDepth(12)
            .setAngle(this.jogo.multiplayer?.presentation && alvo.lado === "inimigo" ? 180 : 0));
          if (evento.momento === "habilidade" && perfil.visual === "plasma" && alvo.lado !== evento.lado) {
            for (let i = 0; i < 5; i++) {
              const orb = guardar(this.add.circle(origem.x, origem.y, 6 + i, perfil.cor ?? 0x43ff82, 0.85));
              this.tweens.add({ targets: orb, x: destino.x + (i - 2) * 13, y: destino.y,
                duration: 220 + i * 60, onComplete: () => {
                  orb.setRadius(24); this.tweens.add({ targets: orb, alpha: 0, scale: 2, duration: 220 });
                } });
            }
          }
          if (evento.momento === "habilidade" && perfil.visual === "caveiras" && alvo.delta < 0) {
            const quantidade = Math.min(6, Math.abs(alvo.delta));
            for (let i = 0; i < quantidade; i++) {
              const x = destino.x + ((i % 3) - (Math.min(quantidade, 3) - 1) / 2) * 48;
              const y = destino.y + Math.floor(i / 3) * 55;
              if (this.textures.exists("efeitoDiego")) guardar(this.add.image(x, y, "efeitoDiego").setDisplaySize(46, 46));
              else guardar(this.add.text(x, y, "☠", { fontSize: "40px", color: "#ffffff" }).setOrigin(0.5));
            }
          }
          if (evento.momento === "habilidade" && perfil.visual === "juridico" && alvo.removida && alvo.lado !== evento.lado) {
            guardar(this.add.image(destino.x, destino.y, "efeitoAdvogado").setDisplaySize(340, 245));
          }
        }
      };
      if (curaMedico) {
        for (const alvo of alvos) if (alvo.delta > 0) this.revelarSimbolo("efeitoMedico", { ...this.ponto(alvo.lado, alvo.indice), lado: alvo.lado }, guardar);
        this.time.delayedCall(450, aplicarDano);
      } else if (ataqueBom) {
        const passaros = [];
        for (const alvo of alvos) {
          if (!(alvo.delta < 0) || !this.textures.exists("efeitoBom")) continue;
          const destino = this.ponto(alvo.lado, alvo.indice);
          const passaro = guardar(this.add.image(destino.x, destino.y, "efeitoBom").setDepth(12));
          const layout = this.jogo.layout;
          passaro.setScale(Math.min((layout.slotW - 20) / passaro.width, (layout.slotH - 20) / passaro.height))
            .setAngle(this.jogo.multiplayer?.presentation && alvo.lado === "inimigo" ? 180 : 0);
          passaros.push(passaro);
        }
        this.time.delayedCall(300, () => {
          aplicarDano();
          this.tweens.add({ targets: passaros, alpha: 0, duration: 180 });
        });
      } else if (!impactoJuggernaut) aplicarDano();
      const som = perfil[evento.momento] || (evento.momento === "invocacao" ? "somJogarCarta" : alvos.some(a => a.removida) ? "somExplosao" : "somBuff");
      const volume = perfil.volume ?? 0.3;
      const tocaSom = (!perfil.somenteVinculo || fonte.aliadoVinculadoId != null) && (!perfil.somenteGanho || ativo) && (!echo || (ativo && (alvos.length || perfil.imagem === "efeitoCoelho" || ["efeitoAranha", "efeitoBoi", "efeitoCabra"].includes(perfil.imagem)))) &&
        (som !== "somReplicantes" || alvos.some(alvo => alvo.delta > 0)) && this.cache.audio.exists(som);
      if (tocaSom) this.sound.play(som, { volume: window.cyberduelSettings?.effects(volume, som) ?? volume });
      const duracaoInvestida = ativo && perfil.visual === "garras" ? (this.cache.audio.get?.("somTigreInvestida")?.duration || 0) * 1000 : 0;
      let duracao = impactoJuggernaut ? 650 : Math.max(1000, duracaoInvestida, tocaSom ? (this.cache.audio.get?.(som)?.duration || 0) * 1000 : 0);
      let audioTerminou = false, videoPendente = false, concluido = false, filaLiberada = false;
      const liberarFila = () => {
        if (filaLiberada) return;
        filaLiberada = true;
        this.executando = false;
        this.eventoAtual = null;
        this.proximo();
      };
      const concluir = () => {
        if (concluido || !audioTerminou || videoPendente) return;
        concluido = true;
        objetos.forEach((o) => { if (o.active) o.destroy(); });
        liberarFila();
      };
      if ((perfil.momentos ? ativo : evento.momento === "invocacao") && perfil.video && this.cache.video.exists(perfil.video)) {
        if (!impactoJuggernaut) duracao = Math.max(duracao, 1700);
        videoPendente = true;
        const alvoVideo = impactoJuggernaut ? alvos[0] : null;
        const pontoVideo = alvoVideo ? this.ponto(alvoVideo.lado, alvoVideo.indice) : origem;
        const video = guardar(this.add.video(pontoVideo.x, pontoVideo.y, perfil.video).setDepth(impactoJuggernaut ? 10 : -1).setVisible(false));
        const liberarVideo = () => { videoPendente = false; if (impactoJuggernaut) { aplicarDano(); audioTerminou = true; } concluir(); };
        video.once("complete", liberarVideo);
        video.once("created", () => {
          const grande = ["efeitoRaspClayVertical", "videoEfeitoAranha", "videoEfeitoBoi", "videoEfeitohumba", "videoEfeitodiego", "videoEfeitoprofessores"].includes(perfil.video);
          video.setPosition(grande ? LARGURA_LAYOUT / 2 : pontoVideo.x, grande ? ALTURA_LAYOUT / 2 : pontoVideo.y);
          const ajustar = perfil.video === "videoEfeitoAranha" ? Math.max : Math.min;
          const escala = ajustar((grande ? LARGURA_LAYOUT : impactoJuggernaut ? 340 : 260) / video.width,
            (grande ? ALTURA_LAYOUT : impactoJuggernaut ? 245 : 260) / video.height);
          video.setScale(escala).setVisible(true);
          if (!grande) video.setAngle(this.jogo.multiplayer?.presentation && (alvoVideo?.lado || evento.lado) === "inimigo" ? 180 : 0);
          if (impactoJuggernaut) {
            const danoImpacto = window.setTimeout(() => { if (video.active) aplicarDano(); }, 300);
            const fimImpacto = window.setTimeout(liberarVideo, 650);
            video.once("destroy", () => { window.clearTimeout(danoImpacto); window.clearTimeout(fimImpacto); });
          }
        });
        video.once("error", () => { video.setVisible(false); liberarVideo(); });
        video.setMute(true);
        video.play(false);
        // Decodificação/reprodução bloqueada não pode prender o turno.
        const esperaVideo = this.time.delayedCall(15000, liberarVideo);
        video.once("destroy", () => esperaVideo.remove?.());
      }
      if (!impactoJuggernaut || !videoPendente) this.time.delayedCall(duracao, () => {
        if (impactoJuggernaut) aplicarDano();
        audioTerminou = true;
        concluir();
      });
      // O voo já terminou; halo e som genérico continuam sem reter a passagem de turno.
      if (evento.momento === "invocacao" && !ativo && !alvos.length &&
          !perfil.invocacao && !(perfil.video && !perfil.momentos)) liberarFila();
    };
    if (evento.momento === "habilidade" && perfil.visual === "garras" && this.cache.audio.exists("somTigreInvestida"))
      this.sound.play("somTigreInvestida", { volume: window.cyberduelSettings?.effects(0.3, "somTigreInvestida") ?? 0.3 });
    if (impactoJuggernaut) aplicar();
    else this.animarFonte(evento, fonte, guardar, aplicar);
  }

}
window.CenaEfeitos = CenaEfeitos;
