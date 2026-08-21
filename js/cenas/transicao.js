// ============================================================================
// CENA DE TRANSIÇÃO
// ============================================================================
// Roda entre o título e o jogo. Só toca o vídeo "Transicao_de_tela" em tela
// cheia, na resolução nativa (1080x2160, igual a GW/GH — por isso não
// precisa de setDisplaySize, senão ia distorcer/dar zoom à toa). Nenhuma
// interface do jogo existe nessa cena. Mantém o áudio original do vídeo
// (play(loop=false) sem mute). Ao terminar, manda direto pra CenaJogo, que
// desenha a parte_3 em loop como fundo (ver desenharFundoJogo() em
// jogo.js) e faz a interface dar fade in por cima dela.
// ============================================================================
class CenaTransicao extends Phaser.Scene {
  constructor() {
    super("CenaTransicao");
  }

  create() {
    this.cameras.main.setBackgroundColor("#000000");

    const video = this.add.video(GW / 2, GH / 2, "videoTransicao");
    video.setOrigin(0.5);
    // Sem setDisplaySize: o vídeo já nasce 1080x2160, do mesmo tamanho
    // interno do jogo (GW/GH) — toca na resolução original, sem esticar
    // e sem zoom.
    video.play(false); // loop = false, mantém o áudio do próprio vídeo

    video.once("complete", () => {
      this.scene.start("CenaJogo");
    });
  }
}
