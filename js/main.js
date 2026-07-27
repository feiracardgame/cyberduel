console.log("Cyberduel iniciou!");

class Carta {
    constructor(id, poder, custo, tipo) {
        this.id = id;
        this.poder = poder;
        this.custo = custo;
        this.tipo = tipo;
    }
    mostrar() {
    console.log(`Carta ID: ${this.id},\n Poder: ${this.poder},\n Custo: ${this.custo},\n Tipo: ${this.tipo}`);
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
    }
    jogarCarta(carta, posicao) {
        if (this.campo.temEspaco(posicao)) {
            if (this.energia >= carta.custo) {
                this.campo.adicionarCarta(carta, posicao);
                this.energia -= carta.custo;
            } else {
                console.log(`Não há energia suficiente para jogar a carta ${carta.id}.`);
            }
            console.log(`Carta ${carta.id} do tipo ${carta.tipo} jogada com sucesso na posicao ${posicao}!`);
        }
        else {
            console.log(`Espaço insuficiente para jogar a carta ${carta.id}.`);
        }
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



const robo = new Carta(1, 5, 2, "monstro");
const drone = new Carta(2, 3, 1, "monstro");
const tanque = new Carta(3, 10, 5, "monstro");
const jogador = new Jogador();
console.log(robo);
robo.mostrar();
robo.buff(2);
robo.mostrar();
jogador.criardeckteste();
jogador.comprarCarta();
jogador.jogarCarta(robo, 0);