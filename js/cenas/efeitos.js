// Camada independente: redesenhar o tabuleiro não interrompe efeitos em andamento.
// Cada evento tem identidade própria; atualizações acumuladas nunca apagam ativações.
const APRESENTACAO_EFEITOS = Object.freeze({
  "CyberVendedor da RaspCorp": { passiva: "somBuff" },
  "Estagiário de Machine Learning": { habilidade: "somEstagiario" },
  "Gestor de Recursos Predominantemente Humanos": { habilidade: "somGRPH" },
  "NeoAnalista de Suporte Nível Alpha": { invocacao: "somNeoAnalista", video: "efeitoNeoAnalista" },
  "CryptoAcionistas": { inicio_turno: "somCryptoAcionistas" },
  "Advogado Corporativo": { habilidade: "somAdvogado", visual: "juridico" },
  "Agente da DIPSP": { habilidade: "somTiro", visual: "plasma" },
  'UCC "Juggernaut"': { habilidade: "somTiro", visual: "plasma" },
  "O Tigre": { habilidade: "somTigreAtaque" },
  "RaspClay MonteCorp": { invocacao: "somRaspClay", video: "efeitoRaspClayVertical" },
  "Dieh'Go, o Xerife": { visual: "caveiras" },
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
    this.scene.bringToTop();
  }

  receber(eventos) {
    if (!this.fila) return;
    for (const evento of eventos || []) {
      if (evento.id <= this.ultimoEvento) continue;
      this.ultimoEvento = evento.id;
      this.fila.push(JSON.parse(JSON.stringify(evento)));
    }
    this.proximo();
  }

  ponto(lado, indice) {
    const layout = this.jogo.layout || LAYOUT_CAMPO_NORMAL;
    if (indice < 0 || indice >= 10) return { x: GW / 2, y: GH / 2 };
    return { x: layout.x[indice % 5], y: (lado === "jogador" ? layout.yJogador : layout.yInimigo)[Math.floor(indice / 5)] };
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
    const cor = evento.lado === "jogador" ? 0x5bffb0 : 0x60cfff;
    const objetos = [];
    const guardar = (o) => { objetos.push(o); return o; };
    const origem = this.ponto(evento.lado, fonte.indice);
    const momentos = { invocacao: "EM CAMPO", habilidade: "HABILIDADE", passiva: "EFEITO DE INVOCAÇÃO",
      inicio_turno: "INÍCIO DO TURNO", continuo: "EFEITO CONTÍNUO", veneno: "VENENO",
      cura: "RECUPERAÇÃO", advertencia: "ADVERTÊNCIA", conjuracao: "CARTA DE EFEITO" };
    const dono = this.jogo.multiplayer?.spectator
      ? (evento.lado === "jogador" ? this.jogo.multiplayer.localUsername : this.jogo.multiplayer.opponentUsername)
      : evento.lado === "jogador" ? "VOCÊ" : "INIMIGO";
    guardar(this.add.rectangle(GW / 2, 365, 970, 142, 0x061322, 0.94).setStrokeStyle(2, cor));
    guardar(this.add.text(90, 307, `${dono} · ${momentos[evento.momento] || "EFEITO"}`, {
      fontSize: "22px", color: "#9dd8f0", fontStyle: "bold",
    }));
    guardar(this.add.text(90, 340, fonte.nome, { fontSize: "26px", color: "#ffffff",
      fontStyle: "bold", wordWrap: { width: 895 } }));
    const resumo = evento.mensagem || this.resumir(evento, remoto);
    guardar(this.add.text(90, 391, resumo, { fontSize: "21px", color: "#d0efdf", wordWrap: { width: 895 } }));

    const pulsar = (p, largura = 170, altura = 240) => {
      const halo = guardar(this.add.rectangle(p.x, p.y, largura, altura, 0x000000, 0).setStrokeStyle(5, cor));
      this.tweens.add({ targets: halo, scale: 1.12, alpha: 0.15, duration: 420, yoyo: true });
    };
    if (fonte.indice >= 0) pulsar(origem);
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
        stroke: "#061322", strokeThickness: 6,
      }).setOrigin(0.5));
      if (evento.momento === "habilidade" && perfil.visual === "plasma" && alvo.lado !== evento.lado) {
        for (let i = 0; i < 5; i++) {
          const orb = guardar(this.add.circle(origem.x, origem.y, 6 + i, 0x43cfff, 0.85));
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
        guardar(this.add.image(Phaser.Math.Clamp(destino.x, 175, GW - 175), destino.y, "efeitoAdvogado").setDisplaySize(340, 245));
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
        video.setPosition(grande ? GW / 2 : origem.x, grande ? GH / 2 : origem.y);
        video.setDisplaySize(grande ? 950 : 230, grande ? 1440 : 310).setVisible(true);
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
  }

  resumir(evento, remoto) {
    if (remoto && evento.fonte.oculto) return "Efeito de uma carta oculta";
    if (evento.fonte.efeito?.tipo === TIPOS_EFEITO.ARMADILHA_ESPACO) return "Armadilha preparada";
    const alvos = (evento.alvos || []).filter((a) => a.id !== evento.fonte.id || a.lado !== evento.lado || a.delta);
    if (alvos.length) return alvos.map((a) => {
      const nome = a.oculto && (remoto || a.lado !== "jogador") ? "Carta oculta" : a.nome;
      return `${nome}: ${a.removida ? "removida" : a.delta ? `${a.delta > 0 ? "+" : ""}${a.delta} PA` : "efeito aplicado"}`;
    }).join(" · ").slice(0, 130);
    const efeito = evento.fonte.efeito;
    return (efeito?.texto || descreverEfeito(efeito) || descreverEfeitoTurno(evento.fonte.efeitoTurno) ||
      descreverEfeitoContinuo(evento.fonte.efeitoContinuo) || "Carta colocada em campo").slice(0, 130);
  }
}
window.CenaEfeitos = CenaEfeitos;
