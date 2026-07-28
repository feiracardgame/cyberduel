class CenaJogo extends Phaser.Scene {
    constructor() {
        super("CenaJogo");
    }

    create() {
        this.partida = new Partida();
        this.desenharInterface();
    }

    desenharInterface() {
        this.children.removeAll();

        this.desenharCampoInimigo();
        this.desenharCampoJogador();
        this.desenharMao();
        this.desenharStatus();
        this.desenharBotaoPassarTurno();
    }

    desenharCampoInimigo() {
        for (let i = 0; i < 3; i++) {
            this.add.rectangle(200 + i * 180, 120, 120, 140, 0x332222);

            let carta = this.partida.inimigo.campo.cartas[i];
            if (carta) {
                this.add.text(155 + i * 180, 100, `ID:${carta.id}\nP:${carta.poder}\nC:${carta.custo}`, {
                    fontSize: "16px",
                    backgroundColor: "#aa0000",
                    color: "#fff",
                    padding: 8
                });
            }
        }
    }

    desenharCampoJogador() {
        for (let i = 0; i < 3; i++) {
            let slot = this.add.rectangle(200 + i * 180, 300, 120, 140, 0x224422).setInteractive();

            // Clique no slot do campo para baixar a carta selecionada
            slot.on("pointerdown", () => {
                if (this.partida.cartaSelecionada) {
                    let jogou = this.partida.jogador.jogarCarta(this.partida.cartaSelecionada, i);
                    if (jogou) {
                        this.partida.cartaSelecionada = null;
                        this.desenharInterface();
                    }
                }
            });

            let carta = this.partida.jogador.campo.cartas[i];
            if (carta) {
                this.add.text(155 + i * 180, 280, `ID:${carta.id}\nP:${carta.poder}\nC:${carta.custo}`, {
                    fontSize: "16px",
                    backgroundColor: "#0055aa",
                    color: "#fff",
                    padding: 8
                });
            }
        }
    }

    desenharMao() {
        this.partida.jogador.mao.cartas.forEach((carta, indice) => {
            let ehSelecionada = (carta === this.partida.cartaSelecionada);

            let texto = this.add.text(
                40 + indice * 110,
                480,
                `ID:${carta.id}\nP:${carta.poder}\nC:${carta.custo}`,
                {
                    fontSize: "16px",
                    backgroundColor: ehSelecionada ? "#ffaa00" : "#333333",
                    color: "#fff",
                    padding: 8
                }
            ).setInteractive();

            texto.on("pointerdown", () => {
                this.partida.cartaSelecionada = carta;
                this.desenharInterface();
            });
        });
    }

    desenharStatus() {
        this.add.text(20, 20, `Energia: ${this.partida.jogador.energia}`, { fontSize: "20px", color: "#00ff00" });
        this.add.text(20, 50, `Turno: ${this.partida.turno}`, { fontSize: "20px", color: "#ffffff" })
        this.add.text(20, 80, `Vitorias: ${this.partida.jogador.vitorias}`, { fontSize: "20px", color: "#ff0000" })
        .setStyle({ 
            fontSize: "22px", 
            color: "#f8f8f8",
            fontStyle: "bold"
        });
    }
    desenharBotaoPassarTurno() {
        let btn = this.add.text(650, 20, "Passar Turno", {
            fontSize: "18px",
            backgroundColor: "#ff5500",
            color: "#fff",
            padding: 10
        }).setInteractive();

        btn.on("pointerdown", () => {
            this.partida.cartaSelecionada = null;
            this.partida.fimTurno();
            this.desenharInterface();
        });
    }  
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: "#111",
    scene: CenaJogo
};

new Phaser.Game(config);