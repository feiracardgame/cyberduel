// A cena independente preserva os efeitos durante o redesenho do campo.
const APRESENTACAO_EFEITOS = Object.freeze({
  "HumbaBrain": { invocacao: "somHumba", video: "videoEfeitohumba", volume: 0.75 },
  "Professores de Duelo": { habilidade: "somProfessores", video: "videoEfeitoprofessores", momentos: ["habilidade"], volume: 0.75 },
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
  "RaspClay MonteCorp": { invocacao: "somRaspClay", video: "efeitoRaspClayVertical", volume: 0.75 },
  "Dieh'Go, o Xerife": { habilidade: "somDiego", visual: "caveiras", video: "videoEfeitodiego", momentos: ["habilidade"], volume: 0.75 },
  "A Aranha": { habilidade: "somAranha", imagem: "efeitoAranha", momentos: ["habilidade"], video: "videoEfeitoAranha" },
  "O Boi": { habilidade: "somBoi", imagem: "efeitoBoi", momentos: ["habilidade"], video: "videoEfeitoBoi", volume: 0.75 },
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
    this.invocacaoEmCurso = null;
    this.invocacoesPendentes = new Map();
    this.haCartasOcultas = false;
    if (!this.anims.exists("forja-ferreira")) this.anims.create({
      key: "forja-ferreira", frames: this.anims.generateFrameNumbers("efeitoFerreira", { start: 0, end: 9 }),
      frameRate: 25, repeat: -1,
    });
    if (!this.anims.exists("moeda-crypto")) this.anims.create({
      key: "moeda-crypto", frames: this.anims.generateFrameNumbers("efeitoCrypto", { start: 0, end: 12 }),
      frameRate: 1000 / 60, repeat: -1,
    });
    this.events.once("shutdown", () => this.cancelarInvocacoesPendentes());
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
    destino.x = Math.max(margemX, Math.min(LARGURA_LAYOUT - margemX, destino.x));
    destino.y = Math.max(margemY, Math.min(ALTURA_LAYOUT - margemY, destino.y));
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

  proximo() {
    if (this.executando || !this.fila.length) return;
    this.executando = true;
    const evento = this.fila.shift();
    this.eventoAtual = evento;
    this.exibidos.push(evento.id);
    const remoto = evento.lado !== "jogador" || this.jogo.multiplayer?.spectator;
    const fonteOculta = remoto && evento.fonte.oculto;
    const fonte = fonteOculta ? { nome: "Carta oculta", indice: evento.fonte.indice } : evento.fonte;
    const perfil = APRESENTACAO_EFEITOS[fonte.habilidadeAprendidaDe || fonte.nome] || {};
    const objetos = [];
    const guardar = (o) => { objetos.push(o); return o; };
    const impactoJuggernaut = perfil.visual === "impactoJuggernaut" && evento.momento === "habilidade";
    const ataqueBom = perfil.visual === "passaros" && evento.momento === "habilidade";
    const cartasAntesDano = [];
    // O motor já resolveu o ataque; mantém o PA anterior até apresentar o impacto.
    if (impactoJuggernaut || ataqueBom) for (const alvo of evento.alvos || []) {
      if (!(alvo.delta < 0) && !alvo.removida) continue;
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
      let alvos = (evento.alvos || []).filter((alvo) => alvo.lado !== evento.lado || alvo.id !== fonte.id || perfil.imagem === "efeitoBoi" || (alvo.delta && perfil.imagem !== "efeitoRato"));
      if (ativo && perfil.visual === "garras" && alvos.length && this.cache.audio.exists("somTigreAtaque"))
        this.sound.play("somTigreAtaque", { volume: window.cyberduelSettings?.effects(0.3) ?? 0.3 });
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
      if (ativo && perfil.visual === "fullart" && fonte.imagem && this.textures.exists(fonte.imagem)) {
        guardar(this.add.rectangle(LARGURA_LAYOUT / 2, ALTURA_LAYOUT / 2, LARGURA_LAYOUT, ALTURA_LAYOUT, 0x000000, 0.7).setDepth(19));
        const arte = guardar(this.add.image(LARGURA_LAYOUT / 2, ALTURA_LAYOUT / 2, fonte.imagem).setDepth(20));
        arte.setScale(Math.min((LARGURA_LAYOUT - 80) / arte.width, (ALTURA_LAYOUT - 80) / arte.height));
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
            if (this.cache.audio.exists("somPorco")) this.sound.play("somPorco", { volume: window.cyberduelSettings?.effects(0.3) ?? 0.3 });
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
            guardar(this.add.image(Phaser.Math.Clamp(destino.x, 175, LARGURA_LAYOUT - 175), destino.y, "efeitoAdvogado").setDisplaySize(340, 245));
          }
        }
      };
      if (ataqueBom) {
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
      const tocaSom = (!perfil.somenteGanho || ativo) && (!echo || (ativo && (alvos.length || perfil.imagem === "efeitoCoelho" || ["efeitoAranha", "efeitoBoi", "efeitoCabra"].includes(perfil.imagem)))) &&
        (som !== "somReplicantes" || alvos.some(alvo => alvo.delta > 0)) && this.cache.audio.exists(som);
      if (tocaSom) this.sound.play(som, { volume: window.cyberduelSettings?.effects(volume) ?? volume });
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
          if (!grande) video.setPosition(
            Math.max(video.displayWidth / 2 + 12, Math.min(LARGURA_LAYOUT - video.displayWidth / 2 - 12, video.x)),
            Math.max(video.displayHeight / 2 + 12, Math.min(ALTURA_LAYOUT - video.displayHeight / 2 - 12, video.y)));
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
      this.sound.play("somTigreInvestida", { volume: window.cyberduelSettings?.effects(0.3) ?? 0.3 });
    if (impactoJuggernaut) aplicar();
    else this.animarFonte(evento, fonte, guardar, aplicar);
  }

}
window.CenaEfeitos = CenaEfeitos;
