console.log("Cyberduel iniciou!");

class Carta {
    constructor(id, poder, custo, tipo) {
        this.id = id;
        this.poder = poder;
        this.custo = custo;
        this.tipo = tipo;
    }
    mostrar() {
        console.log(`Carta ID: ${this.id}, Poder: ${this.poder}, Custo: ${this.custo}`);
    }
    buff(valor) {
        this.poder += valor;
    }
}

class Deck {
    constructor() {
        this.cartas = [];
        this.limite = 20;
    }
    adicionarCarta(carta) {
        if (this.cartas.length < this.limite) {
            this.cartas.push(carta);
        }
    }
    embaralhar() {
        Phaser.Utils.Array.Shuffle(this.cartas);
    }
}

class Mao {
    constructor() {
        this.cartas = [];
    }
    adicionarCarta(carta) {
        this.cartas.push(carta);
    }
}

class Campo {
    constructor() {
        this.cartas = [null, null, null];
        this.limite = 3;
    }
    adicionarCarta(carta, posicao) {
        if (this.cartas[posicao] === null) {
            this.cartas[posicao] = carta;
        }
    }
    temEspaco(posicao) {
        return this.cartas[posicao] === null;
    }
}

class Jogador {
    constructor() {
        this.deck = new Deck();
        this.mao = new Mao();
        this.campo = new Campo();
        this.energia = 10;
        this.vitorias = 0;
    }

    jogarCarta(carta, posicao) {
        if (!this.campo.temEspaco(posicao)) return false;
        if (this.energia < carta.custo) return false;

        this.campo.adicionarCarta(carta, posicao);
        this.energia -= carta.custo;

        const indice = this.mao.cartas.indexOf(carta);
        if (indice !== -1) {
            this.mao.cartas.splice(indice, 1);
        }
        return true;
    }

    criardeckteste() {
        for (let i = 0; i < 20; i++) {
            const carta = new Carta(i + 1, Math.floor(Math.random() * 10) + 1, Math.floor(Math.random() * 5) + 1, "monstro");
            this.deck.adicionarCarta(carta);
        }
    }

    comprarCarta() {
        if (this.deck.cartas.length > 0) {
            const compra = this.deck.cartas.pop();
            this.mao.adicionarCarta(compra);
        }
    }
}

class Partida {
    constructor() {
        this.jogador = new Jogador();
        this.inimigo = new Jogador();

        this.jogador.criardeckteste();
        this.inimigo.criardeckteste();

        this.jogador.deck.embaralhar();
        this.inimigo.deck.embaralhar();

        for (let i = 0; i < 5; i++) {
            this.jogador.comprarCarta();
            this.inimigo.comprarCarta();
        }

        this.turno = 1;
        this.cartaSelecionada = null; // Guardar seleção para jogar no slot
    }

    fimTurno() {
        this.turnoIA();
        this.resolverCombate();
        this.turno++;
        this.jogador.energia += 2;
        this.inimigo.energia += 2;
        this.jogador.deck.embaralhar();
        this.inimigo.deck.embaralhar();
        this.jogador.comprarCarta();
        this.inimigo.comprarCarta();
    }

    turnoIA() {
        const carta = this.inimigo.mao.cartas.find(c => c.custo <= this.inimigo.energia);

        if (carta) {
            for (let i = 0; i < 3; i++) {
                if (this.inimigo.campo.temEspaco(i)) {
                    this.inimigo.jogarCarta(carta, i);
                    break;
                }
            }
        }
    }
    calcularPoderTotal(campo) {
        let total = 0;
        for (let carta of campo.cartas) {
            if (carta !== null) {
                total += carta.poder;
            }
        }
        return total;
    }

    resolverCombate() {
        let poderJogador = this.calcularPoderTotal(this.jogador.campo);
        let poderInimigo = this.calcularPoderTotal(this.inimigo.campo);

            console.log(`Poder Jogador: ${poderJogador} | Poder Inimigo: ${poderInimigo}`);

        // 2. Aplica a regra de vitória do combate
        if (poderJogador > poderInimigo) {
            console.log("Jogador venceu a rodada!");
            this.jogador.vitorias++;
        } 
        else if (poderInimigo > poderJogador) {
            console.log("Inimigo venceu a rodada!");
            this.inimigo.vitorias++;
        } 
        else {
            console.log("Empate!");
        }
    }
    }