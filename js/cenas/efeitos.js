// A cena independente preserva os efeitos durante o redesenho do campo.
const APRESENTACAO_EFEITOS = Object.freeze({
  "CyberVendedor da RaspCorp": { passiva: "somBuff" },
  "Estagiário de Machine Learning": { habilidade: "somEstagiario" },
  "Gestor de Recursos Predominantemente Humanos": { habilidade: "somGRPH" },
  "NeoAnalista de Suporte Nível Alpha": { invocacao: "somNeoAnalista", video: "efeitoNeoAnalista" },
  "CryptoAcionistas": { inicio_turno: "somCryptoAcionistas" },
  "Advogado Corporativo": { habilidade: "somAdvogado", visual: "juridico" },
  "Agente da DIPSP": { habilidade: "somTiro", visual: "plasma" },
  'UCC "Juggernaut"': { habilidade: "somTiro", visual: "plasma" },
  "O Tigre": { habilidade: "somTigreAtaque", imagem: "efeitoTigre", momentos: ["habilidade"] },
  "RaspClay MonteCorp": { invocacao: "somRaspClay", video: "efeitoRaspClayVertical" },
  "Dieh'Go, o Xerife": { visual: "caveiras" },
  "A Aranha": { imagem: "efeitoAranha", momentos: ["habilidade"] },
  "O Boi": { imagem: "efeitoBoi", momentos: ["habilidade"] },
  "A Cabra": { imagem: "efeitoCabra", momentos: ["habilidade"] },
  "O Cão": { imagem: "efeitoCao", momentos: ["passiva"] },
  "O Trotar do Cavalo": { imagem: "efeitoCavalo", momentos: ["conjuracao"] },
  "A Cobra": { imagem: "efeitoCobra", momentos: ["habilidade", "veneno"] },
  "A Toca do Coelho": { imagem: "efeitoCoelho", momentos: ["invocacao"] },
  "O Canto do Galo": { imagem: "efeitoGalo", momentos: ["conjuracao"] },
  "A Travessura do Macaco": { imagem: "efeitoMacaco", momentos: ["conjuracao"] },
  "O Porco": { imagem: "efeitoPorco", momentos: ["passiva"] },
  "O Rato": { imagem: "efeitoRato", momentos: ["habilidade"] },
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
    if (!remoto || !["invocacao", "conjuracao", "habilidade"].includes(evento.momento)) {
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
        fontSize: "18px", fontStyle: "bold", align: "center", color: "#ffffff",
        wordWrap: { width: largura - 18 },
      }).setOrigin(0.5);
      frente.add([placa, nome]);
    }
    const verso = !habilidade && this.textures.exists("fundoCarta")
      ? this.add.image(0, 0, "fundoCarta").setDisplaySize(largura, altura) : null;
    frente.setVisible(!verso);
    const carta = guardar(this.add.container(origem.x, origem.y, [frente, verso].filter(Boolean)))
      .setDepth(30).setScale(habilidade ? 1 : 0.7).setAngle(habilidade ? 0 : -12);
    carta.eventoApresentado = evento.id;
    if (invocacao) {
      this.invocacaoEmCurso = evento;
      this.atualizarVisibilidadeInvocacoes();
    }
    const escala = invocacao ? 1 : habilidade ? 1.18 : 2;
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
    // Alvos, sons e vídeos começam no impacto da carta, na mesma fila.
    const aplicar = () => {
      const origem = this.ponto(evento.lado, fonte.indice);
      const pulsar = (p, largura = 170, altura = 240) => {
        const halo = guardar(this.add.rectangle(p.x, p.y, largura, altura, 0x000000, 0).setStrokeStyle(5, 0x60ff95));
        this.tweens.add({ targets: halo, scale: 1.12, alpha: 0.15, duration: 420, yoyo: true });
      };
      if (fonte.indice >= 0) pulsar(origem);
      if (perfil.momentos?.includes(evento.momento) && this.textures.exists(perfil.imagem)) {
        const simbolo = guardar(this.add.image(origem.x, origem.y, perfil.imagem));
        const escala = Math.min(200 / simbolo.width, 240 / simbolo.height);
        simbolo.setScale(escala);
        this.tweens.add({ targets: simbolo, scaleX: escala * 1.15, scaleY: escala * 1.15,
          alpha: 0, delay: 150, duration: 700, ease: "Sine.Out" });
      }
      let alvos = (evento.alvos || []).filter((alvo) => alvo.lado !== evento.lado || alvo.id !== fonte.id || alvo.delta);
      // O uso da armadilha é público, mas o espaço escolhido continua privado.
      if (remoto && fonte.efeito?.tipo === TIPOS_EFEITO.ARMADILHA_ESPACO) alvos = [];
      for (const alvo of alvos) {
        const destino = this.ponto(alvo.lado, alvo.indice);
        pulsar(destino);
        if (alvo.removida && !(alvo.oculto && remoto)) {
          if (alvo.imagem && this.textures.exists(alvo.imagem)) {
            const fantasma = guardar(this.add.image(destino.x, destino.y, alvo.imagem).setDisplaySize(170, 230));
            this.tweens.add({ targets: fantasma, alpha: 0, angle: 18, y: destino.y + 65, duration: 850 });
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
        const texto = alvo.removida ? "REMOVIDA" : alvo.delta ? `${alvo.delta > 0 ? "+" : ""}${alvo.delta} PA` : alvo.bloqueado ? "PA BLOQUEADO" : "EFEITO APLICADO";
        guardar(this.add.text(destino.x, destino.y - 70, texto, {
          fontSize: "22px", fontStyle: "bold", color: alvo.delta < 0 ? "#ff889e" : "#9affbd",
          stroke: "#06220f", strokeThickness: 6,
        }).setOrigin(0.5));
        if (evento.momento === "habilidade" && perfil.visual === "plasma" && alvo.lado !== evento.lado) {
          for (let i = 0; i < 5; i++) {
            const orb = guardar(this.add.circle(origem.x, origem.y, 6 + i, 0x43ff82, 0.85));
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
      const som = perfil[evento.momento] || (evento.momento === "invocacao" ? "somJogarCarta" : "somBuff");
      if (this.cache.audio.exists(som)) this.sound.play(som, { volume: window.cyberduelSettings?.effects(0.3) ?? 0.3 });
      let duracao = 1000;
      if (evento.momento === "invocacao" && perfil.video && this.cache.video.exists(perfil.video)) {
        duracao = 1700;
        const video = guardar(this.add.video(origem.x, origem.y, perfil.video).setVisible(false));
        video.once("created", () => {
          const grande = perfil.video === "efeitoRaspClayVertical";
          video.setPosition(grande ? LARGURA_LAYOUT / 2 : origem.x, grande ? ALTURA_LAYOUT / 2 : origem.y);
          const escala = Math.min((grande ? 950 : 260) / video.width, (grande ? 1440 : 260) / video.height);
          video.setScale(escala).setVisible(true);
        });
        video.once("error", () => video.setVisible(false));
        video.setMute(true);
        video.play(false);
      }
      this.time.delayedCall(duracao, () => {
        objetos.forEach((o) => { if (o.active) o.destroy(); });
        this.executando = false;
        this.proximo();
      });
    };
    this.animarFonte(evento, fonte, guardar, aplicar);
  }

}
window.CenaEfeitos = CenaEfeitos;
