// ============================================================================
// CENA DE TÍTULO
// ============================================================================
// Tela simples entre o preload e a partida: nome do jogo + um botão
// "JOGAR" que inicia a CenaJogo. Roda depois da CenaPreload (ver
// main.js), então todos os assets já estão carregados aqui — dá pra usar
// sons de UI (ex: somHover/somPop) se quiser, sem precisar carregar nada.
// ============================================================================
class CenaTitulo extends Phaser.Scene {
  constructor() {
    super("CenaTitulo");
  }

  create() {
    this.cameras.main.setBackgroundColor("#101018");

    let titulo = this.add
      .text(GW / 2, GH / 2 - 280, "CYBERDUEL", {
        fontSize: "116px",
        color: "#ffffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    let subtitulo = this.add
      .text(GW / 2, GH / 2 - 150, "Duelo tático de cartas", {
        fontSize: "36px",
        color: "#9be7ff",
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: titulo,
      alpha: 1,
      y: GH / 2 - 320,
      duration: 500,
      ease: "Back.Out",
    });
    this.tweens.add({
      targets: subtitulo,
      alpha: 1,
      duration: 500,
      delay: 150,
      ease: "Sine.easeOut",
    });

    this.criarBotaoJogar();
  }

  criarBotaoJogar() {
    let bg = this.add
      .rectangle(0, 0, 440, 150, 0xff5500)
      .setStrokeStyle(5, 0xffffff);
    let texto = this.add
      .text(0, 0, "JOGAR", {
        fontSize: "58px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    let btn = this.add.container(GW / 2, GH / 2 + 160, [bg, texto]);
    btn.setSize(440, 150);
    btn.setInteractive({ useHandCursor: true });
    btn.setScale(0);

    this.tweens.add({
      targets: btn,
      scale: 1,
      duration: 420,
      delay: 300,
      ease: "Back.Out",
    });

    btn.on("pointerover", () => {
      this.tweens.add({ targets: btn, scale: 1.06, duration: 120 });
    });

    btn.on("pointerout", () => {
      this.tweens.add({ targets: btn, scale: 1, duration: 120 });
    });

    // Trava pra não disparar duas vezes se o jogador clicar/tocar rápido
    // demais enquanto a transição de cena já está rolando.
    let jaClicou = false;
    btn.on("pointerdown", () => {
      if (jaClicou) return;
      jaClicou = true;

      this.tweens.add({
        targets: btn,
        scale: 0.9,
        duration: 90,
        yoyo: true,
        ease: "Sine.easeInOut",
        onComplete: () => {
          this.cameras.main.fadeOut(200, 0, 0, 0);

          this.cameras.main.once("camerafadeoutcomplete", () => {
          this.scene.start("CenaJogo");
          });
        },
      });
    });
  }
}
