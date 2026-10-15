// Reproduz o vídeo de transição antes de abrir a partida.
class CenaTransicao extends Phaser.Scene {
  constructor() {
    super("CenaTransicao");
  }

  create() {
    configurarCameraLogica(this);
    this.cameras.main.setBackgroundColor("#000000");

    const campo = window.cyberduelSettings?.get("battlefield");
    const abertura = { 1: "carregamento_echorasp.mp4", 2: "carregamento_sindicato.mp4",
      3: "carregamento_echorasp.mp4", 4: "carregamento_remanescentes.mp4" }[campo] || this.registry.get("aberturaTransicao");
    const chave = { "carregamento_echorasp.mp4": "videoAberturaEchoRasp", "carregamento_sindicato.mp4": "videoAberturaSindicato",
      "carregamento_remanescentes.mp4": "videoAberturaRemanescentes" }[abertura] || "videoTransicao";
    this.fundoTransicao = { "carregamento_echorasp.mp4": "jogoFundo", "carregamento_sindicato.mp4": "videoParte3",
      "carregamento_remanescentes.mp4": "videoDeserto" }[abertura];
    const video = this.add.video(LARGURA_LAYOUT / 2, ALTURA_LAYOUT / 2, chave);
    video.setOrigin(0.5);
    // As aberturas têm áudios diferentes (Echo/Rasp não tem faixa de áudio).
    // Usa a trilha da facção em todas, no mesmo nível da partida.
    video.setMute(true);
    const musica = window.cyberduelSettings?.get("battlefield") === 3 ? "musicaHumbaNet"
      : { "carregamento_sindicato.mp4": "musicaFundo", "carregamento_remanescentes.mp4": "musicaRemanescentes" }[abertura] || "musicaPadrao";
    window.cyberduelSettings?.playMusic(this, musica);
    video.setVisible(false);
    video.once("created", (_video, largura, altura) => {
      if (!video.active || !largura || !altura) return;
      const escala = Math.max(LARGURA_LAYOUT / largura, ALTURA_LAYOUT / altura);
      video.setDisplaySize(largura * escala, altura * escala).setVisible(true);
    });
    this.jaTransicionou = false;

    video.once("complete", () => {
      this.pularParaJogo(video);
    });
    video.once("error", () => this.pularParaJogo(video));
    // Um vídeo que não inicia ou não termina não pode prender a partida.
    this.time.delayedCall(20000, () => this.pularParaJogo(video));
    this.events.once("shutdown", () => video.destroy());

    this.criarSkip(video);
    video.play(false);
  }

  // Troca de cena uma única vez e interrompe o vídeo.
  pularParaJogo(video) {
    if (this.jaTransicionou) return;
    this.jaTransicionou = true;

    if (video && video.isPlaying()) {
      video.stop();
    }

    this.scene.start("CenaJogo", { fundoBatalha: this.fundoTransicao });
  }

  criarSkip(video) {
    // Atalho de teclado: ESPAÇO pula na hora
    this.input.keyboard.on("keydown-SPACE", () => {
      this.pularParaJogo(video);
    });

    // Segurar a tela por 2s pula também
    const raio = 46;
    const duracaoSegurar = 2000;
    const x = LARGURA_LAYOUT - 110;
    const y = ALTURA_LAYOUT - 130;

    let dica = this.add
      .text(x, y - raio - 34, "Segure para pular", {
        fontSize: "26px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setAlpha(0.7);

    // Trilho de fundo do anel de progresso.
    let trilho = this.add.circle(x, y, raio, 0x000000, 0.35);
    trilho.setStrokeStyle(6, 0xffffff, 0.35);

    // Gráfico que desenha o arco de progresso conforme o jogador segura.
    let anelProgresso = this.add.graphics();

    let progresso = { valor: 0 };
    let tweenSegurar = null;

    const desenharAnel = () => {
      anelProgresso.clear();
      if (progresso.valor <= 0) return;
      anelProgresso.lineStyle(6, 0x00e0a0, 1);
      anelProgresso.beginPath();
      anelProgresso.arc(
        x,
        y,
        raio,
        Phaser.Math.DegToRad(-90),
        Phaser.Math.DegToRad(-90 + 360 * progresso.valor),
        false,
      );
      anelProgresso.strokePath();
    };

    const cancelarSegurar = () => {
      if (tweenSegurar) {
        tweenSegurar.stop();
        tweenSegurar = null;
      }
      this.tweens.add({
        targets: progresso,
        valor: 0,
        duration: 150,
        onUpdate: desenharAnel,
      });
    };

    this.input.on("pointerdown", () => {
      if (this.jaTransicionou) return;
      progresso.valor = 0;
      tweenSegurar = this.tweens.add({
        targets: progresso,
        valor: 1,
        duration: duracaoSegurar,
        ease: "Linear",
        onUpdate: desenharAnel,
        onComplete: () => this.pularParaJogo(video),
      });
    });

    this.input.on("pointerup", cancelarSegurar);
    this.input.on("pointerupoutside", cancelarSegurar);
  }
}
