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
class CenaPreload extends Phaser.Scene {
  constructor() {
    super("CenaPreload");
  }

  preload() {
    this.criarBarraDeCarregamento();

    // ---------- ASSETS DO JOGO ----------
    this.load.image("fundoCarta", "assets/fundo/fundo_carta_2.png");
    //cartas
    this.load.image("cryptoacionistas", "assets/cartas/cryptoacionistas.png");
    this.load.image("dipsp", "assets/cartas/AgenteDIPSP.png");
    this.load.image("juggernaut", "assets/cartas/juggernautplaceholder.png");
    this.load.image("cybervendedor", "assets/cartas/cybervendedor.png");
    this.load.image(
      "estagiarioml",
      "assets/cartas/Estagiario_machine_learning.png",
    );
    this.load.image("rh", "assets/cartas/Departamento_RH.png");
    this.load.image(
      "beiramarneofloripa",
      "assets/cartas/Beiramar_Neofloripa.png",
    );
    this.load.image("torremontecorp", "assets/cartas/Torre_MonteCorp.png");
    this.load.image("nexusneofloripa", "assets/cartas/NexusNeoFloripa.png");
    this.load.image("sugalg", "assets/cartas/Sugestão_algoritmica.png");
    this.load.image("adv", "assets/cartas/AdvogadoDaRaspCorp.png");
    this.load.image("raspclay", "assets/cartas/RaspClay_MonteCorp.png");
    this.load.image("rato", "assets/cartas/O_rato.png") 
    this.load.image("cabra", "assets/cartas/A_cabra.png")
    this.load.image("cao", "assets/cartas/O_cao.png")
    this.load.image("porco", "assets/cartas/O_porco.png")
    this.load.image("cobra", "assets/cartas/Cobra.png");
    this.load.image("cavalo", "assets/cartas/O_cavalo.png");
    this.load.image("galo", "assets/cartas/O_galo.png");
    this.load.image("macaco", "assets/cartas/O_macaco.png");
    this.load.image("tocacoelho", "assets/cartas/Toca_do_Coelho.png");
    this.load.image("neoanalista", "assets/cartas/NeoAnalista_de_Suporte_Nivel_Alpha.png");
    this.load.image("humbabrain", "assets/cartas/HumbaBrain.png");
    this.load.image("voceparecesozinho", "assets/cartas/Voce_parece_sozinho.png");
    this.load.image("diehgo", "assets/cartas/Di_Ego_caçador_de_recompensas.png");
    // EchoSsystem (booster 2)
    this.load.image("eltigre", "assets/cartas/el_tigre.png");
    this.load.image("daranha", "assets/cartas/D_Aranha.png");
    this.load.image("oboi", "assets/cartas/Anarcoboi.png");
    //fundos
    this.load.image("jogoFundo", "assets/fundo/jogo-fundo.png");
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
    //videos
    this.load.video("videoTransicao", "assets/videos/transicaocerta.mp4");
    this.load.video("videoParte3", "assets/videos/parte_3.mp4");
    //efeitos
    this.load.image("efeitoAdvogado", "assets/efeitos/efeito-advogado.png");
  }

  // Monta o logo + a barra de carregamento (fundo + preenchimento + %)
  // e liga os listeners de progresso do loader do Phaser pra ela reagir
  // em tempo real, conforme cada asset vai terminando de baixar.
  criarBarraDeCarregamento() {
    this.cameras.main.setBackgroundColor("#101018");

    const larguraBarra = 760;
    const alturaBarra = 46;
    const x = GW / 2 - larguraBarra / 2;
    const y = GH / 2 + 40;

    this.add
      .text(GW / 2, GH / 2 - 260, "CYBERDUEL", {
        fontSize: "104px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 10,
      })
      .setOrigin(0.5);

    let textoStatus = this.add
      .text(GW / 2, y - 60, "Carregando...", {
        fontSize: "32px",
        color: "#9be7ff",
      })
      .setOrigin(0.5);

    // Moldura externa da barra
    this.add
      .rectangle(GW / 2, y, larguraBarra + 12, alturaBarra + 12, 0x1a1a24)
      .setStrokeStyle(4, 0xffffff);

    // Trilho vazio (o "fundo" da barra, atrás do preenchimento)
    this.add.rectangle(GW / 2, y, larguraBarra, alturaBarra, 0x000000, 0.5);

    // Preenchimento que cresce da esquerda pra direita conforme o
    // progresso — origin (0, 0.5) pra crescer só em largura, sem se
    // deslocar do lugar.
    let barraFill = this.add
      .rectangle(x, y, 4, alturaBarra, 0x00e0a0)
      .setOrigin(0, 0.5);

    // Brilho sutil por cima do preenchimento, só pra dar um respiro
    // visual (mesma ideia dos "brilho" já usados nas cartas de campo).
    let brilhoFill = this.add
      .rectangle(x, y - alturaBarra / 2 + 6, 4, 6, 0xffffff, 0.35)
      .setOrigin(0, 0.5);

    let textoPorcentagem = this.add
      .text(GW / 2, y + 80, "0%", {
        fontSize: "36px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.load.on("progress", (valor) => {
      const larguraAtual = Math.max(4, larguraBarra * valor);
      barraFill.width = larguraAtual;
      brilhoFill.width = larguraAtual;
      textoPorcentagem.setText(`${Math.round(valor * 100)}%`);
    });

    this.load.on("complete", () => {
      textoStatus.setText("Pronto!");
    });
  }

  create() {
    // Pequena pausa depois do "Pronto!" só pra não trocar de cena de
    // supetão — dá tempo do jogador registrar que o carregamento acabou.
    this.time.delayedCall(300, () => {
      this.scene.start("CenaTitulo");
    });
  }
}
