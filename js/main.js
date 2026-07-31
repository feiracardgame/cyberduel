console.log("Cyberduel iniciou!");

// Os dados de carta (classe Carta, TIPOS_EFEITO, descreverEfeito e o pool
// POOL_CARTAS_EFEITO) agora moram em js/cartas.js, que é carregado antes
// deste arquivo — veja index.html.

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

    // Cartas de efeito nunca ocupam o campo: são consumidas na hora,
    // aplicam sua passiva e vão descartadas. Só a energia é verificada.
    jogarCartaEfeito(carta) {
        if (this.energia < carta.custo) return false;

        this.energia -= carta.custo;

        const indice = this.mao.cartas.indexOf(carta);
        if (indice !== -1) {
            this.mao.cartas.splice(indice, 1);
        }
        return true;
    }

    criardeckteste() {
        // Uma seleção de cartas de efeito, garantindo variedade tática no deck
        const efeitosEmbaralhados = Phaser.Utils.Array.Shuffle([...POOL_CARTAS_EFEITO]);
        const quantidadeEfeitos = 6;

        for (let i = 0; i < quantidadeEfeitos; i++) {
            const base = efeitosEmbaralhados[i % efeitosEmbaralhados.length];
            const carta = new Carta(1000 + i, base.poder, base.custo, "efeito", {
                nome: base.nome,
                descricao: base.descricao,
                efeito: base.efeito
            });
            this.deck.adicionarCarta(carta);
        }

        // Restante do deck: cartas de monstro comuns, sem efeitos
        const quantidadeMonstros = this.deck.limite - quantidadeEfeitos;
        for (let i = 0; i < quantidadeMonstros; i++) {
            const carta = new Carta(
                i + 1,
                Math.floor(Math.random() * 10) + 1,
                Math.floor(Math.random() * 5) + 1,
                "monstro",
                { nome: `Unidade ${i + 1}`, descricao: "Uma unidade de combate padrão, confiável em qualquer formação." }
            );
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
        this.cartaSelecionada = null;

        // Guarda a carta de efeito jogada pela IA no turno atual (se houver),
        // junto das cartas que foram afetadas por ela, para a cena poder
        // mostrar a animação de conjuração e de buff/debuff no momento certo.
        this.efeitoInimigoTurno = null;

        // Histórico de todas as cartas jogadas na partida, na ordem em que
        // foram jogadas. Cada entrada: { turno, quem: 'jogador'|'inimigo', carta }.
        this.historico = [];
    }

    // Registra uma jogada no histórico. "quem" é 'jogador' ou 'inimigo'.
    registrarHistorico(carta, quem) {
        this.historico.push({ turno: this.turno, quem, carta });
    }

    // Ponto único de entrada para o jogador jogar uma carta de monstro: garante
    // que o efeito passivo de invocação seja aplicado sempre que a jogada for válida.
    jogarCartaDoJogador(carta, posicao) {
        const sucesso = this.jogador.jogarCarta(carta, posicao);
        const afetadas = sucesso ? this.aplicarEfeitoInvocacao(carta, this.jogador, this.inimigo) : [];
        if (sucesso) this.registrarHistorico(carta, "jogador");
        return { sucesso, afetadas };
    }

    // Ponto único de entrada para o jogador conjurar uma carta de efeito:
    // ela nunca vai para o campo, só é consumida e aplica sua passiva.
    jogarCartaEfeitoDoJogador(carta) {
        const sucesso = this.jogador.jogarCartaEfeito(carta);
        const afetadas = sucesso ? this.aplicarEfeitoInvocacao(carta, this.jogador, this.inimigo) : [];
        if (sucesso) this.registrarHistorico(carta, "jogador");
        return { sucesso, afetadas };
    }

    // Aplica o efeito passivo de uma carta no momento em que ela é invocada.
    // "dono" é quem jogou a carta, "oponente" é o outro jogador.
    // Retorna a lista de cartas de campo afetadas (com o delta de poder
    // aplicado), para que a cena possa animar exatamente essas cartas.
    aplicarEfeitoInvocacao(carta, dono, oponente) {
        if (!carta.efeito) return [];
        const { tipo, valor } = carta.efeito;
        const afetadas = [];

        switch (tipo) {
            case TIPOS_EFEITO.BUFF_ALIADOS:
                dono.campo.cartas.forEach(c => {
                    if (c && c !== carta) {
                        c.buff(valor);
                        afetadas.push({ carta: c, delta: valor });
                    }
                });
                break;
            case TIPOS_EFEITO.DEBUFF_INIMIGOS:
                oponente.campo.cartas.forEach(c => {
                    if (c) {
                        c.buff(-valor);
                        afetadas.push({ carta: c, delta: -valor });
                    }
                });
                break;
            case TIPOS_EFEITO.GANHO_ENERGIA:
                dono.energia += valor;
                break;
            case TIPOS_EFEITO.DRENAR_ENERGIA:
                oponente.energia = Math.max(0, oponente.energia - valor);
                break;
        }

        return afetadas;
    }

    fimTurno() {
        this.turnoIA();
        const resultadoCombate = this.resolverCombate();
        this.turno++;
        this.jogador.energia += 2;
        this.inimigo.energia += 2;
        this.jogador.deck.embaralhar();
        this.inimigo.deck.embaralhar();
        this.jogador.comprarCarta();
        this.inimigo.comprarCarta();
        return resultadoCombate;
    }

    turnoIA() {
        this.efeitoInimigoTurno = null;

        const carta = this.inimigo.mao.cartas.find(c => c.custo <= this.inimigo.energia);
        if (!carta) return;

        // Cartas de efeito nunca vão para o campo: são conjuradas e consumidas
        if (carta.tipo === "efeito") {
            const sucesso = this.inimigo.jogarCartaEfeito(carta);
            if (sucesso) {
                const afetadas = this.aplicarEfeitoInvocacao(carta, this.inimigo, this.jogador);
                this.efeitoInimigoTurno = { carta, afetadas };
                this.registrarHistorico(carta, "inimigo");
            }
            return;
        }

        for (let i = 0; i < 3; i++) {
            if (this.inimigo.campo.temEspaco(i)) {
                const sucesso = this.inimigo.jogarCarta(carta, i);
                if (sucesso) this.registrarHistorico(carta, "inimigo");
                break;
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

        let resultado;
        if (poderJogador > poderInimigo) {
            this.jogador.vitorias++;
            resultado = "jogador";
        }
        else if (poderInimigo > poderJogador) {
            this.inimigo.vitorias++;
            resultado = "inimigo";
        }
        else {
            resultado = "empate";
        }

        console.log(`Poder Jogador: ${poderJogador} | Poder Inimigo: ${poderInimigo} | Resultado: ${resultado}`);

        // Retorna o resultado em vez de só logar, para a cena (jogo.js)
        // poder mostrar feedback visual (texto, flash de câmera etc.)
        return { poderJogador, poderInimigo, resultado };
    }
}

// Configuração Phaser 3 para celulares na vertical (360x720)
const config = {
    type: Phaser.AUTO,
    width: 360,
    height: 720,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [ CenaJogo ]
};

const game = new Phaser.Game(config);
