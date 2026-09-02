// A cena Phaser funciona apenas como ponte para o editor responsivo em DOM.
// Assim o montador se adapta a qualquer tela sem herdar a grade fixa do jogo.
class CenaDeckBuilder extends Phaser.Scene {
  constructor() {
    super("CenaDeckBuilder");
  }

  create() {
    this.cameras.main.setBackgroundColor("#020409");
    this.deckBuilderUI = new CyberduelDeckBuilderUI({
      scene: this,
      builder: window.cyberduelDeckBuilder,
      onExit: () => this.scene.start("CenaTitulo"),
    });
    this.deckBuilderUI.mount();
    this.events.once("shutdown", () => this.deckBuilderUI?.destroy());
  }

  // Mantido como uma pequena API da cena para testes e integrações antigas.
  ordenarCatalogo(cards) {
    const order = new Map(
      window.cyberduelDeckBuilder
        .filterCatalog({ order: this.ordemNivel })
        .map((card, index) => [card.key, index]),
    );
    return [...cards].sort(
      (a, b) => (order.get(a.key) ?? Infinity) - (order.get(b.key) ?? Infinity),
    );
  }
}
