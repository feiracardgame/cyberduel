// ============================================================================
// CENA DE TRANSIÇÃO
// ============================================================================
// Roda entre o título e o jogo. Só toca o vídeo "Transicao_de_tela" em tela
// cheia, ajustado à proporção configurada sem deformar o vídeo.
// Mantém o áudio original do vídeo
// (play(loop=false) sem mute). Ao terminar, manda direto pra CenaJogo, que
// desenha a parte_3 em loop como fundo (ver desenharFundoJogo() em
// jogo.js) e faz a interface dar fade in por cima dela.
//
// Pular a transição: aperta ESPAÇO (pula na hora) ou segura o dedo/mouse
// na tela por 2 segundos (mostra um anelzinho de progresso enquanto
// segura, pra dar feedback visual). Qualquer um dos dois caminhos —
// inclusive o vídeo terminando sozinho — passa pelo mesmo pularParaJogo(),
// que tem uma trava (jaTransicionou) pra garantir que a cena só troca uma
// vez, não importa quantos gatilhos disparem em cima da hora.
// ============================================================================
class CenaTransicao extends Phaser.Scene {
  constructor() {
    super("CenaTransicao");
  }

  create() {
    configurarCameraLogica(this);
    this.cameras.main.setBackgroundColor("#000000");

    const video = this.add.video(LARGURA_LAYOUT / 2, ALTURA_LAYOUT / 2, "videoTransicao");
    video.setOrigin(0.5);
    video.setVolume?.(window.cyberduelSettings?.music(1) ?? 1);
    video.setVisible(false);
    video.once("created", (_video, largura, altura) => {
      if (!video.active || !largura || !altura) return;
      const escala = Math.max(LARGURA_LAYOUT / largura, ALTURA_LAYOUT / altura);
      video.setDisplaySize(largura * escala, altura * escala).setVisible(true);
    });
    video.play(false); // loop = false, mantém o áudio do próprio vídeo

    this.jaTransicionou = false;

    video.once("complete", () => {
      this.pularParaJogo(video);
    });

    this.criarSkip(video);
  }

  // Troca de cena de forma segura (só executa uma vez, mesmo que o vídeo
  // termine, o espaço seja apertado e o toque seguro completem quase ao
  // mesmo tempo) e para o vídeo pra não ficar tocando por baixo do fade.
  pularParaJogo(video) {
    if (this.jaTransicionou) return;
    this.jaTransicionou = true;

    if (video && video.isPlaying()) {
      video.stop();
    }

    this.scene.start("CenaJogo");
  }

  criarSkip(video) {
    // ---------- Atalho de teclado: ESPAÇO pula na hora ----------
    this.input.keyboard.on("keydown-SPACE", () => {
      this.pularParaJogo(video);
    });

    // ---------- Segurar a tela por 2s pula também ----------
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
