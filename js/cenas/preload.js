// ============================================================================
// CENA DE PRELOAD
// ============================================================================
// Primeira cena a rodar (ver a lista "scene" em main.js). Carrega TODOS os
// assets do jogo (imagens e sons) de uma vez só, mostrando uma barra de
// carregamento, e ao terminar manda pra CenaTitulo.
//
// Pra adicionar um asset novo no jogo, carregue ele aqui dentro de
// preload() — não precisa mexer em mais nada, a barra já reage a
// qualquer coisa que passe por this.load.
// ============================================================================
window.CYBERDUEL_IMAGE_ASSETS = Object.freeze({
  fundoCarta: "assets/fundo/fundo_carta_2.png",
  cryptoacionistas: "assets/cartas/cryptoacionistas.png",
  dipsp: "assets/cartas/AgenteDIPSP.png",
  juggernaut: "assets/cartas/juggernautplaceholder.png",
  cybervendedor: "assets/cartas/cybervendedor.png",
  estagiarioml: "assets/cartas/Estagiario_machine_learning.png",
  rh: "assets/cartas/Departamento_RH.png",
  beiramarneofloripa: "assets/cartas/Beiramar_Neofloripa.png",
  torremontecorp: "assets/cartas/Torre_MonteCorp.png",
  nexusneofloripa: "assets/cartas/NexusNeoFloripa.png",
  sugalg: "assets/cartas/Sugestão_algoritmica.png",
  adv: "assets/cartas/AdvogadoDaRaspCorp.png",
  raspclay: "assets/cartas/RaspClay_MonteCorp.png",
  rato: "assets/cartas/O_rato.png",
  cabra: "assets/cartas/A_cabra.png",
  cao: "assets/cartas/O_cao.png",
  porco: "assets/cartas/O_porco.png",
  cobra: "assets/cartas/Cobra.png",
  cavalo: "assets/cartas/O_cavalo.png",
  galo: "assets/cartas/O_galo.png",
  macaco: "assets/cartas/O_macaco.png",
  tocacoelho: "assets/cartas/Toca_do_Coelho.png",
  neoanalista: "assets/cartas/NeoAnalista_de_Suporte_Nivel_Alpha.png",
  humbabrain: "assets/cartas/HumbaBrain.png",
  voceparecesozinho: "assets/cartas/Voce_parece_sozinho.png",
  diehgo: "assets/cartas/Di_Ego_caçador_de_recompensas.png",
  eltigre: "assets/cartas/el_tigre.png",
  daranha: "assets/cartas/D_Aranha.png",
  oboi: "assets/cartas/Anarcoboi.png",
  jogoFundo: "assets/fundo/jogo-fundo.png",
  efeitoAdvogado: "assets/efeitos/efeito-advogado.png",
});

// O DOM do deck builder continua usando as artes originais acima. Dentro do
// Phaser, onde nenhuma carta normal precisa exceder 720px de largura, usamos
// WebP dimensionado: o download das cartas cai de dezenas de MB para poucos
// MB e a memória de textura da GPU também diminui bastante.
window.CYBERDUEL_GAME_IMAGE_ASSETS = Object.freeze(
  Object.fromEntries(
    Object.entries(window.CYBERDUEL_IMAGE_ASSETS).map(([key, url]) => [
      key,
      url.startsWith("assets/cartas/")
        ? url
            .replace("assets/cartas/", "assets/cartas/game/")
            .replace(/\.png$/i, ".webp?v=20260902a")
        : url,
    ]),
  ),
);

class CenaPreload extends Phaser.Scene {
  constructor() {
    super("CenaPreload");
  }

  preload() {
    configurarCameraLogica(this);
    this.criarBarraDeCarregamento();

    // ---------- ASSETS DO JOGO ----------
    Object.entries(window.CYBERDUEL_GAME_IMAGE_ASSETS).forEach(([key, url]) =>
      this.load.image(key, url),
    );
    //musicas
    this.load.audio("musicaFundo", "assets/sons/jogo-musica.wav");
    this.load.audio("somJogarCarta", "assets/sons/jogo-cartawhoosh.wav");
    //sons
    this.load.audio("somTorcida", "assets/sons/jogo-torcida.wav");
    this.load.audio("somPop", "assets/sons/jogo-pop.mp3");
    this.load.audio("somComprarCarta", "assets/sons/jogo-compra.mp3");
    this.load.audio("somBuff", "assets/sons/jogo-buff.mp3");
    this.load.audio("somHover", "assets/sons/jogo-cartawhoosh.wav");
    this.load.audio("somTiro", "assets/sons/jogo-dipsptiro.wav");
    this.load.audio("somTigreAtaque", "assets/sons/som-tigregarra.mp3");
    this.load.audio("somAdvogado", "assets/sons/som-advogado.mp3");
    this.load.audio("somRaspClay", "assets/sons/som-raspclay.mp3");
    //videos
    this.load.video("videoTransicao", "assets/videos/transicaocerta.mp4");
    this.load.video(
      "videoParte3",
      "assets/videos/game/parte_3-720p.mp4?v=20260902a",
    );
    //efeitos
    this.load.video(
      "efeitoRaspClayVertical",
      "assets/efeitos/efeito-raspclay-vertical-alpha.webm",
    );
  }

  // Monta o logo + a barra de carregamento (fundo + preenchimento + %)
  // e liga os listeners de progresso do loader do Phaser pra ela reagir
  // em tempo real, conforme cada asset vai terminando de baixar.
  criarBarraDeCarregamento() {
    this.cameras.main.setBackgroundColor("#030509");

    const larguraBarra = 850;
    const alturaBarra = 22;
    const x = GW / 2 - larguraBarra / 2;
    const y = GH / 2 + 150;

    // Mesmo vocabulário visual do título/deck forge: grade técnica,
    // painéis escuros, linhas finas e ciano como sinal ativo.
    const grade = this.add.graphics();
    grade.lineStyle(1, 0x45a6c4, 0.09);
    for (let gx = 0; gx <= GW; gx += 72) grade.lineBetween(gx, 0, gx, GH);
    for (let gy = 0; gy <= GH; gy += 72) grade.lineBetween(0, gy, GW, gy);

    this.add.rectangle(GW / 2, 72, GW - 96, 1, 0x7cd3ff, 0.18);
    this.add
      .text(60, 38, "CD  //  NEOFLORIPA OS", {
        fontSize: "19px", color: "#6f8593", fontStyle: "bold",
      })
      .setOrigin(0, 0.5);
    this.add
      .text(GW - 60, 38, "●  REDE ATIVA", {
        fontSize: "17px", color: "#38f2a0", fontStyle: "bold",
      })
      .setOrigin(1, 0.5);

    this.add
      .text(GW / 2, GH / 2 - 300, "CYBER", {
        fontFamily: "Impact, Arial Narrow, sans-serif",
        fontSize: "150px",
        color: "#ffffff",
        fontStyle: "bold italic",
        stroke: "#030509",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(GW / 2, GH / 2 - 170, "DUEL", {
        fontFamily: "Impact, Arial Narrow, sans-serif",
        fontSize: "150px", color: "#030509", fontStyle: "bold italic",
        stroke: "#23d7ff", strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.add
      .text(GW / 2, GH / 2 - 50, "AUDIÊNCIA É PODER", {
        fontSize: "19px", color: "#8291a3", fontStyle: "bold",
        letterSpacing: 8,
      })
      .setOrigin(0.5);

    let textoStatus = this.add
      .text(x, y - 54, "INICIALIZANDO SIMULAÇÃO", {
        fontSize: "19px", color: "#23d7ff", fontStyle: "bold",
      })
      .setOrigin(0, 0.5);

    // Moldura externa da barra
    this.add
      .rectangle(GW / 2, y, larguraBarra + 28, alturaBarra + 28, 0x090e17, 0.96)
      .setStrokeStyle(2, 0x7cd3ff, 0.22);

    // Trilho vazio (o "fundo" da barra, atrás do preenchimento)
    this.add.rectangle(GW / 2, y, larguraBarra, alturaBarra, 0x020408, 1);

    // Preenchimento que cresce da esquerda pra direita conforme o
    // progresso — origin (0, 0.5) pra crescer só em largura, sem se
    // deslocar do lugar.
    let barraFill = this.add
      .rectangle(x, y, 4, alturaBarra, 0x23d7ff)
      .setOrigin(0, 0.5);

    // Brilho sutil por cima do preenchimento, só pra dar um respiro
    // visual (mesma ideia dos "brilho" já usados nas cartas de campo).
    let brilhoFill = this.add
      .rectangle(x, y - alturaBarra / 2 + 3, 4, 4, 0xffffff, 0.5)
      .setOrigin(0, 0.5);

    let textoPorcentagem = this.add
      .text(GW - x, y - 54, "00%", {
        fontSize: "21px", color: "#f3f8fc", fontStyle: "bold",
        fontFamily: "monospace",
      })
      .setOrigin(1, 0.5);

    const textoModulo = this.add
      .text(GW / 2, y + 66, "Sincronizando protocolos de duelo", {
        fontSize: "18px", color: "#607180",
      })
      .setOrigin(0.5);

    this.load.on("progress", (valor) => {
      const larguraAtual = Math.max(4, larguraBarra * valor);
      barraFill.width = larguraAtual;
      brilhoFill.width = larguraAtual;
      textoPorcentagem.setText(`${String(Math.round(valor * 100)).padStart(2, "0")}%`);
      if (valor > 0.78) textoModulo.setText("Calibrando arena tática");
      else if (valor > 0.42) textoModulo.setText("Indexando cartas e efeitos");
    });

    this.load.on("complete", () => {
      textoStatus.setText("SIMULAÇÃO PRONTA").setColor("#38f2a0");
      textoModulo.setText("Acesso liberado").setColor("#38f2a0");
    });
  }

  create() {
    // `?deck=1` também funciona como atalho direto para o montador. Além
    // de ser útil no celular, permite validar a cena sem atravessar menus.
    const abrirDeck =
      new URLSearchParams(window.location.search).get("deck") === "1";
    this.time.delayedCall(abrirDeck ? 0 : 300, () => {
      this.scene.start(abrirDeck ? "CenaDeckBuilder" : "CenaTitulo");
    });
  }
}
