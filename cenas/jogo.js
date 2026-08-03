// ============================================================================
// CONSTANTES DE LAYOUT
// ============================================================================
// A resolução interna do jogo foi elevada para 1080x2160 (ver main.js), 3x a
// resolução original de 360x720, para ficar nítido em telas de alta
// densidade. Todas as posições e tamanhos abaixo já estão nessa escala.
//
// O campo de batalha segue o layout 2x5 POR JOGADOR: cada lado (inimigo e
// jogador) tem 2 fileiras de 5 slots (10 cartas por lado, 20 no total).
// O inimigo ocupa as duas fileiras de cima, o jogador as duas de baixo.
// O layout tem duas variações (normal e ampliada, com a mão escondida — ver
// LAYOUT_CAMPO_NORMAL/AMPLIADO abaixo). x guarda o centro X de cada uma das
// 5 colunas (compartilhado pelas 4 fileiras); y* guarda o centro Y de cada
// fileira individual.
// ============================================================================
const GW = 1080; // largura interna do jogo
const GH = 2160; // altura interna do jogo

// Gera o layout completo do campo (posições X/Y de cada uma das 4 fileiras
// e das 5 colunas) a partir de um punhado de medidas base. Usado para gerar
// dois layouts: um normal (com a mão visível) e um ampliado (mão escondida,
// cartas maiores ocupando o espaço que a mão deixou livre).
function calcularLayoutCampo(slotW, slotH, gapFileira, gapTimes, yInimigoTras) {
    const yInimigoFrente = yInimigoTras + slotH + gapFileira;
    const yJogadorFrente = yInimigoFrente + slotH + gapTimes;
    const yJogadorTras = yJogadorFrente + slotH + gapFileira;

    const gapCol = Math.min(20, Math.max(10, (GW - slotW * 5) / 4));
    const larguraTotal = 5 * slotW + 4 * gapCol;
    const margem = (GW - larguraTotal) / 2;
    const primeiro = margem + slotW / 2;
    const xs = [0, 1, 2, 3, 4].map(i => primeiro + i * (slotW + gapCol));

    return {
        slotW, slotH,
        yInimigoTras, yInimigoFrente, yJogadorFrente, yJogadorTras,
        yInimigo: [yInimigoTras, yInimigoFrente],
        yJogador: [yJogadorTras, yJogadorFrente],
        x: xs
    };
}

// Layout normal: mão visível embaixo, campo com tamanho padrão.
const LAYOUT_CAMPO_NORMAL = calcularLayoutCampo(190, 210, 20, 150, 440);

// Layout ampliado: mão escondida, cartas maiores ocupando o espaço extra.
const LAYOUT_CAMPO_AMPLIADO = calcularLayoutCampo(210, 275, 24, 180, 650);

class CenaJogo extends Phaser.Scene {
    constructor() {
        super("CenaJogo");
    }

    create() {
        this.partida = new Partida();

        // Traçado preto padrão em TODOS os textos da cena: sobrescreve
        // this.add.text para injetar stroke preto sempre que a chamada não
        // definir um estilo de traçado próprio. Assim não precisamos repetir
        // { stroke: '#000000', strokeThickness: N } em cada this.add.text().
        const criarTextoOriginal = this.add.text.bind(this.add);
        this.add.text = (x, y, texto, estilo = {}) => {
            const estiloComTraco = Object.assign({ stroke: "#000000", strokeThickness: 4 }, estilo);
            return criarTextoOriginal(x, y, texto, estiloComTraco);
        };

        // Controla se a mão está escondida (para dar mais espaço/destaque
        // ao campo). Começa visível.
        this.maoEscondida = false;
        this.layout = LAYOUT_CAMPO_NORMAL;

        // Trava a interação enquanto uma animação de "resposta" está rolando
        // (jogar carta, conjurar efeito, devolver carta, passar turno) ou
        // enquanto a visualização detalhada de uma carta está aberta, para
        // evitar cliques duplos e conflitos de tween.
        this.travado = false;

        // Referência ao texto de resultado do combate, para poder
        // destruí-lo com segurança caso a interface seja redesenhada
        // antes da animação dele terminar.
        this.textoResultadoAtual = null;

        // Controle do modal de visualização de carta
        this.modalAberto = false;
        this.painelDetalheAtual = null;
        this.overlayDetalheAtual = null;

        // Controle do modal de histórico de cartas jogadas
        this.historicoAberto = false;
        this.painelHistoricoAtual = null;
        this.overlayHistoricoAtual = null;
        this.listaHistoricoContainer = null;
        this.labelPaginaHistorico = null;
        this.btnAnteriorHistorico = null;
        this.btnProximaHistorico = null;
        this.historicoPagina = 0;

        // Só considera que um "arraste" de fato começou depois que o ponteiro
        // se mover mais que este limiar. Sem isso, qualquer toque (mesmo um
        // clique simples para abrir os detalhes da carta) dispararia
        // dragstart/dragend e nunca chegaríamos a um "tap" limpo.
        this.input.dragDistanceThreshold = 8;

        // --- Drag and Drop das cartas da mão ---
        this.input.on('dragstart', (pointer, gameObject) => {
            if (this.travado || !gameObject.dadosCarta) return;
            this.tweens.killTweensOf(gameObject);
            gameObject.setDepth(2000); // sempre por cima de tudo durante o arraste
            this.tweens.add({
                targets: gameObject,
                scaleX: 1.2,
                scaleY: 1.2,
                angle: 0,
                duration: 120,
                ease: 'Back.Out'
            });
        });

        this.input.on('drag', (pointer, gameObject, dragX, dragY) => {
            if (this.travado || !gameObject.dadosCarta) return;
            gameObject.x = dragX;
            gameObject.y = dragY;
        });

        this.input.on('dragend', (pointer, gameObject) => {
            if (this.travado || !gameObject.dadosCarta) return;
            this.tratarSoltarCarta(gameObject);
        });

        this.desenharInterface();
    }

    // Gera uma cor fixa baseada no ID da carta
    obterCorPorId(id) {
        const cores = [0x8e44ad, 0x2980b9, 0x27ae60, 0xd35400, 0xc0392b, 0x16a085, 0xf39c12, 0x34495e];
        return cores[id % cores.length];
    }

    // Encurta nomes longos para caber no espaço pequeno das cartas
    truncarTexto(texto, maximo) {
        if (texto.length <= maximo) return texto;
        return texto.slice(0, maximo - 1) + "…";
    }

    // Selo circular usado para mostrar poder (e também os números
    // maiores da visualização detalhada): bola preta, contorno branco e
    // texto colorido no meio.
    criarSeloEstat(x, y, valor, corTexto, raio) {
        let bola = this.add.circle(x, y, raio, 0x000000).setStrokeStyle(1.5, 0xffffff);
        let texto = this.add.text(x, y, `${valor}`, {
            fontSize: `${Math.round(raio * 0.95)}px`,
            color: corTexto,
            fontStyle: 'bold'
        }).setOrigin(0.5);
        return [bola, texto];
    }

    desenharInterface() {
        // Mata tweens pendentes e remove qualquer texto de resultado que
        // ainda estivesse na tela, evitando animações "órfãs" apontando
        // para objetos destruídos.
        this.tweens.killAll();
        if (this.textoResultadoAtual) {
            this.textoResultadoAtual.destroy();
            this.textoResultadoAtual = null;
        }

        this.children.removeAll();

        // Se a interface for redesenhada, qualquer modal antigo perde a
        // validade (os objetos já foram destruídos por removeAll acima)
        this.modalAberto = false;
        this.painelDetalheAtual = null;
        this.overlayDetalheAtual = null;
        this.historicoAberto = false;
        this.painelHistoricoAtual = null;
        this.overlayHistoricoAtual = null;
        this.listaHistoricoContainer = null;
        this.labelPaginaHistorico = null;
        this.btnAnteriorHistorico = null;
        this.btnProximaHistorico = null;

        this.layout = this.maoEscondida ? LAYOUT_CAMPO_AMPLIADO : LAYOUT_CAMPO_NORMAL;

        this.desenharStatus();
        this.desenharCampoInimigo();
        this.desenharCampoJogador();
        if (!this.maoEscondida) this.desenharMaoEmLeque();
        this.desenharBotaoPassarTurno();
        this.desenharBotaoToggleMao();
    }

    // ---------- LÓGICA DE ARRASTAR E SOLTAR ----------

    tratarSoltarCarta(gameObject) {
        const carta = gameObject.dadosCarta;

        let slots = this.children.list.filter(child => child.isSlot);
        let slotAtingido = null;

        // Usa o centro da carta arrastada (não a caixa inteira) para achar o
        // slot: com 5 slots lado a lado a carta é mais larga que o espaço
        // entre eles, então testar a bounding box inteira faria o mesmo
        // arraste "bater" em dois slots vizinhos ao mesmo tempo.
        slots.forEach((slot, index) => {
            if (Phaser.Geom.Rectangle.Contains(slot.getBounds(), gameObject.x, gameObject.y)) {
                slotAtingido = index;
            }
        });

        // Soltou fora da área de jogo: volta pro leque normalmente
        if (slotAtingido === null) {
            this.animarRetornoAoLeque(gameObject, false);
            return;
        }

        // --- Cartas de efeito: nunca vão para o campo. Ao serem soltas,
        // são conjuradas no meio da tela e consumidas na hora. ---
        if (carta.tipo === "efeito") {
            this.conjurarCartaDeEfeitoJogador(gameObject, carta);
            return;
        }

        // --- Cartas de monstro: comportamento original, vão para o campo ---
        const temEspaco = this.partida.jogador.campo.temEspaco(slotAtingido);

        if (!temEspaco) {
            this.animarRetornoAoLeque(gameObject, true);
            this.cameras.main.shake(150, 0.002);
            return;
        }

        this.travado = true;
        const slotObj = slots[slotAtingido];

        this.tweens.killTweensOf(gameObject);
        this.tweens.add({
            targets: gameObject,
            x: slotObj.x,
            y: slotObj.y,
            angle: 0,
            scaleX: 1,
            scaleY: 1,
            duration: 220,
            ease: 'Cubic.Out',
            onComplete: () => {
                this.partida.jogarCartaDoJogador(carta, slotAtingido);
                this.desenharInterface();
                this.travado = false;
            }
        });
    }

    animarRetornoAoLeque(gameObject, comErro) {
        this.travado = true;
        const destino = gameObject.posOriginal;

        this.tweens.killTweensOf(gameObject);
        this.tweens.add({
            targets: gameObject,
            x: destino.x,
            y: destino.y,
            angle: destino.angle,
            scaleX: 1,
            scaleY: 1,
            duration: comErro ? 340 : 240,
            ease: comErro ? 'Elastic.Out' : 'Back.Out',
            onComplete: () => {
                // Restaura a profundidade original da carta na pilha do leque.
                // É essa linha (setDepth em vez de reordenar a lista de
                // children) que garante que nenhuma carta fique "presa"
                // atrás de outra depois de um hover ou de um drag.
                gameObject.setDepth(gameObject.depthBase);
                this.travado = false;
            }
        });
    }

    // ---------- CONJURAÇÃO DE CARTAS DE EFEITO ----------

    // Quando o jogador solta uma carta de efeito: a própria carta arrastada
    // voa até o meio da tela, cresce, "pulsa" no impacto (momento em que o
    // efeito é de fato aplicado) e então desaparece. Só depois a interface
    // é redesenhada e os alvos afetados recebem a animação de buff/debuff.
    conjurarCartaDeEfeitoJogador(gameObject, carta) {
        this.travado = true;
        this.tweens.killTweensOf(gameObject);
        gameObject.setDepth(3500);

        this.tweens.add({
            targets: gameObject,
            x: GW / 2,
            y: GH / 2,
            angle: 0,
            scaleX: 1.6,
            scaleY: 1.6,
            duration: 260,
            ease: 'Back.Out',
            onComplete: () => {
                const resultado = this.partida.jogarCartaEfeitoDoJogador(carta);

                // Pulso no instante em que o efeito é aplicado
                this.tweens.add({
                    targets: gameObject,
                    scaleX: 1.85,
                    scaleY: 1.85,
                    duration: 130,
                    yoyo: true,
                    ease: 'Sine.easeInOut',
                    onComplete: () => {
                        this.tweens.add({
                            targets: gameObject,
                            alpha: 0,
                            scaleX: 0.6,
                            scaleY: 0.6,
                            duration: 260,
                            delay: 100,
                            ease: 'Sine.easeIn',
                            onComplete: () => {
                                gameObject.destroy();
                                this.desenharInterface();
                                this.animarCartasAfetadas(resultado.afetadas);
                                this.travado = false;
                            }
                        });
                    }
                });
            }
        });
    }

    // Versão usada quando é a IA quem conjura uma carta de efeito: não existe
    // um objeto de carta sendo arrastado, então criamos uma carta temporária
    // no meio da tela só para a animação de conjuração.
    conjurarCartaDeEfeitoInimigo(carta, aoConcluir) {
        const corFundo = this.obterCorPorId(carta.id);

        let rotulo = this.add.text(0, -285, "O inimigo conjurou:", {
            fontSize: "26px",
            color: "#ff8888",
            fontStyle: "bold"
        }).setOrigin(0.5);

        let sombra = this.add.rectangle(8, 10, 260, 340, 0x000000, 0.4);
        let fundo = this.add.rectangle(0, 0, 260, 340, corFundo).setStrokeStyle(6, 0xff4444);
        let nomeTexto = this.add.text(0, -95, carta.nome, {
            fontSize: "26px",
            color: "#ffffff",
            fontStyle: "bold",
            align: "center",
            wordWrap: { width: 220 }
        }).setOrigin(0.5);
        let iconeTexto = this.add.text(0, 60, "⚡", { fontSize: "70px" }).setOrigin(0.5);

        let container = this.add.container(GW / 2, GH / 2, [rotulo, sombra, fundo, nomeTexto, iconeTexto]);
        container.setDepth(3500);
        container.setScale(0.3);
        container.setAlpha(0);

        this.tweens.add({
            targets: container,
            scale: 1,
            alpha: 1,
            duration: 260,
            ease: 'Back.Out',
            onComplete: () => {
                this.tweens.add({
                    targets: container,
                    scaleX: 1.1,
                    scaleY: 1.1,
                    duration: 130,
                    yoyo: true,
                    delay: 200,
                    ease: 'Sine.easeInOut',
                    onComplete: () => {
                        this.tweens.add({
                            targets: container,
                            alpha: 0,
                            scale: 0.6,
                            duration: 260,
                            delay: 100,
                            ease: 'Sine.easeIn',
                            onComplete: () => {
                                container.destroy();
                                aoConcluir();
                            }
                        });
                    }
                });
            }
        });
    }

    // Mostra um "+X"/"-X" flutuante sobre cada carta de campo afetada por um
    // buff ou debuff, junto de um pequeno pulso de escala na própria carta.
    //
    // IMPORTANTE: as cartas de campo acabaram de ser (re)criadas por
    // desenharInterface() e já têm sua própria animação de entrada rodando
    // (scale 0 -> 1, ver criarCartaDeCampo). Se disparássemos o pulso do
    // buff agora, ele entraria em conflito com essa animação de entrada —
    // as duas mexendo em scaleX/scaleY ao mesmo tempo — e o resultado era a
    // carta "sumir" (ir parar em escala 0) no meio do processo. Por isso
    // esperamos a entrada terminar antes de disparar o pulso.
    animarCartasAfetadas(afetadas) {
        if (!afetadas || afetadas.length === 0) return;

        const DURACAO_ENTRADA_CARTA = 260; // precisa bater com criarCartaDeCampo
        this.time.delayedCall(DURACAO_ENTRADA_CARTA + 20, () => {
            afetadas.forEach(({ carta: cartaAfetada, delta }) => {
                const alvo = this.children.list.find(c => c.dadosCartaCampo === cartaAfetada);
                if (alvo) this.animarBuffCarta(alvo, delta);
            });
        });
    }

    animarBuffCarta(containerCampo, delta) {
        // Defesa extra: garante que não haja nenhuma tween antiga ainda
        // mexendo na escala desta carta, e parte de um estado conhecido
        // (escala 1) antes de aplicar o pulso.
        if (!containerCampo || !containerCampo.active) return;
        this.tweens.killTweensOf(containerCampo);
        containerCampo.setScale(1);

        const positivo = delta >= 0;
        const cor = positivo ? "#66ff99" : "#ff6666";

        let texto = this.add.text(containerCampo.x, containerCampo.y - 180, `${positivo ? "+" : ""}${delta}`, {
            fontSize: "40px",
            color: cor,
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(3600).setAlpha(0);

        this.tweens.add({
            targets: texto,
            alpha: 1,
            y: containerCampo.y - 270,
            duration: 700,
            ease: 'Cubic.Out',
            onComplete: () => texto.destroy()
        });

        this.tweens.add({
            targets: texto,
            alpha: 0,
            delay: 450,
            duration: 300
        });

        this.tweens.add({
            targets: containerCampo,
            scaleX: 1.18,
            scaleY: 1.18,
            duration: 140,
            yoyo: true,
            ease: 'Sine.easeInOut'
        });
    }

    // ---------- DESENHO DO CAMPO ----------

    desenharCampoInimigo() {
        const L = this.layout;
        this.add.text(GW / 2, L.yInimigoTras - L.slotH / 2 - 26, "INIMIGO", {
            fontSize: "24px",
            color: "#ff8888",
            fontStyle: "bold"
        }).setOrigin(0.5);

        for (let i = 0; i < 10; i++) {
            const col = i % 5;
            const fileira = Math.floor(i / 5); // 0 = fileira de trás, 1 = de frente
            const xPos = L.x[col];
            const yPos = L.yInimigo[fileira];

            let slotInimigo = this.add.rectangle(xPos, yPos, L.slotW, L.slotH, 0x332222)
                .setStrokeStyle(2, 0x552222)
                .setAlpha(0);
            this.tweens.add({ targets: slotInimigo, alpha: 1, duration: 260, delay: i * 18, ease: 'Sine.easeOut' });

            let carta = this.partida.inimigo.campo.cartas[i];
            if (carta) {
                this.criarCartaDeCampo(xPos, yPos, carta, L);
            }
        }
    }

    desenharCampoJogador() {
        const L = this.layout;
        this.add.text(GW / 2, L.yJogadorTras + L.slotH / 2 + 26, "VOCÊ", {
            fontSize: "24px",
            color: "#88ff99",
            fontStyle: "bold"
        }).setOrigin(0.5);

        for (let i = 0; i < 10; i++) {
            const col = i % 5;
            const fileira = Math.floor(i / 5); // 0 = fileira de trás, 1 = de frente
            const xPos = L.x[col];
            const yPos = L.yJogador[fileira];

            let slot = this.add.rectangle(xPos, yPos, L.slotW, L.slotH, 0x224422)
                .setStrokeStyle(2, 0x225522)
                .setAlpha(0);
            slot.isSlot = true; // Identificador para a colisão do Drag & Drop
            this.tweens.add({ targets: slot, alpha: 1, duration: 260, delay: i * 18, ease: 'Sine.easeOut' });

            let carta = this.partida.jogador.campo.cartas[i];
            if (carta) {
                this.criarCartaDeCampo(xPos, yPos, carta, L);
            }
        }
    }

    // Carta do campo com pequena sombra e animação de "pop" ao aparecer.
    // O poder fica centralizado embaixo, dentro de um selo circular.
    // Também é clicável: um toque abre a visualização detalhada da carta.
    criarCartaDeCampo(xPos, yPos, carta, layout) {
        const L = layout || this.layout;
        const escala = L.slotH / 210; // 210 = altura base do slot no layout normal
        let corFundo = this.obterCorPorId(carta.id);
        const CW = Math.round(L.slotW * 0.926), CH = Math.round(L.slotH * 0.914); // um pouco menor que o slot, com respiro

        let sombra = this.add.rectangle(6, 8, CW, CH, 0x000000, 0.35);
        let fundo = this.add.rectangle(0, 0, CW, CH, corFundo);
        let brilho = this.add.rectangle(0, -CH / 2 + 3, CW - 10, 4, 0xffffff, 0.35);
        let nomeCurto = this.truncarTexto(carta.nome, 14);
        let nomeTexto = this.add.text(0, Math.round(-58 * escala), nomeCurto, {
            fontSize: `${Math.round(20 * escala)}px`,
            color: "#fff",
            align: "center",
            wordWrap: { width: Math.round(150 * escala) }
        }).setOrigin(0.5, 0);

        const [poderBola, poderTexto] = this.criarSeloEstat(0, Math.round(66 * escala), carta.poder, "#ff5555", Math.round(24 * escala));

        const filhos = [sombra, fundo, brilho, nomeTexto, poderBola, poderTexto];

        // Selo indicando que é uma carta de efeito (a passiva já foi
        // disparada ao entrar em campo — este selo é só um lembrete visual)
        if (carta.tipo === "efeito") {
            let selo = this.add.circle(Math.round(66 * escala), Math.round(-72 * escala), Math.round(17 * escala), 0x1a1a1a).setStrokeStyle(2, 0xffffff);
            let iconeSelo = this.add.text(Math.round(66 * escala), Math.round(-72 * escala), "⚡", { fontSize: `${Math.round(18 * escala)}px` }).setOrigin(0.5);
            filhos.push(selo, iconeSelo);
        }

        // Anel de impacto: some rapidinho, dá um "pop" visual no instante
        // em que a carta assenta no slot.
        let anel = this.add.circle(xPos, yPos, 10, corFundo, 0)
            .setStrokeStyle(6, 0xffffff, 0.9)
            .setDepth(500);

        let container = this.add.container(xPos, yPos, filhos);
        container.setScale(0);
        container.setSize(CW, CH);
        container.setInteractive({ useHandCursor: true });

        // Referência à carta de dados, usada para localizar esta carta na
        // tela quando um efeito de buff/debuff precisa animá-la.
        container.dadosCartaCampo = carta;

        container.on('pointerup', () => {
            if (this.travado) return;
            this.mostrarDetalheCarta(carta);
        });

        this.tweens.add({
            targets: container,
            scale: 1,
            duration: 300,
            ease: 'Back.Out'
        });

        // Anel se expandindo e sumindo — o "pop" visual de entrada
        this.tweens.add({
            targets: anel,
            radius: 110,
            alpha: 0,
            duration: 380,
            ease: 'Cubic.Out',
            onComplete: () => anel.destroy()
        });
    }

    // ---------- DESENHO DA MÃO (LEQUE) ----------

    desenharMaoEmLeque() {
        let cartasMao = this.partida.jogador.mao.cartas;
        let totalCartas = cartasMao.length;
        if (totalCartas === 0) return;

        const centroX = GW / 2;      // Centro da tela
        const centroY = 1650;       // Altura base da mão
        const espacamentoX = 105;   // Distância horizontal entre cartas
        const anguloPasso = 7;       // Inclinação por carta
        const curvaturaY = 15;      // Curvatura da parábola

        cartasMao.forEach((carta, indice) => {
            let offset = indice - (totalCartas - 1) / 2;

            let posX = centroX + (offset * espacamentoX);
            let posY = centroY + (Math.pow(offset, 2) * curvaturaY);
            let angulo = offset * anguloPasso;

            let corFundo = this.obterCorPorId(carta.id);
            let sombra = this.add.rectangle(9, 15, 225, 315, 0x000000, 0.35);
            let fundoCarta = this.add.rectangle(0, 0, 225, 315, corFundo);
            let borda = this.add.rectangle(0, 0, 225, 315).setStrokeStyle(5, 0xffffff);
            let nomeCurto = this.truncarTexto(carta.nome, 12);
            let nomeTexto = this.add.text(0, -120, nomeCurto, {
                fontSize: "34px",
                color: "#ffffff",
                align: "center",
                wordWrap: { width: 195 }
            }).setOrigin(0.5, 0);

            const ehEfeitoLeque = carta.tipo === "efeito";
            const filhos = [sombra, fundoCarta, borda, nomeTexto];

            if (!ehEfeitoLeque) {
                const [poderBola, poderTexto] = this.criarSeloEstat(0, 120, carta.poder, "#ff5555", 40);
                filhos.push(poderBola, poderTexto);
            }

            // Selo de carta de efeito, para diferenciar visualmente das cartas de monstro
            if (ehEfeitoLeque) {
                let iconeGrande = this.add.text(0, 90, "⚡", { fontSize: "90px" }).setOrigin(0.5);
                let selo = this.add.circle(90, -126, 28, 0x1a1a1a).setStrokeStyle(2, 0xffffff);
                let iconeSelo = this.add.text(90, -126, "⚡", { fontSize: "30px" }).setOrigin(0.5);
                filhos.push(iconeGrande, selo, iconeSelo);
            }

            let containerCarta = this.add.container(posX, posY, filhos);
            containerCarta.setSize(225, 315);
            containerCarta.setAngle(angulo);
            containerCarta.setInteractive({ useHandCursor: true });

            // Dados usados no drag/drop e na volta ao leque
            containerCarta.dadosCarta = carta;
            containerCarta.posOriginal = { x: posX, y: posY, angle: angulo };

            // depthBase = profundidade "de descanso" da carta, baseada
            // apenas no seu índice no leque. Hover e drag sobem essa
            // profundidade temporariamente; ao sair do hover/drag ela
            // SEMPRE volta para depthBase — nunca ficamos dependendo da
            // ordem de inserção na lista de children (que era o que
            // causava cartas ficarem presas atrás de outras).
            containerCarta.depthBase = indice;
            containerCarta.setDepth(indice);

            this.input.setDraggable(containerCarta);

            // Entrada animada e escalonada (fade + scale) sempre que o
            // leque é redesenhado
            containerCarta.setAlpha(0);
            containerCarta.setScale(0.6);
            this.tweens.add({
                targets: containerCarta,
                alpha: 1,
                scale: 1,
                duration: 220,
                delay: indice * 35,
                ease: 'Back.Out'
            });

            // Efeito de destaque no Hover / Toque
            containerCarta.on('pointerover', () => {
                if (this.travado) return;
                containerCarta.setDepth(1000);
                this.tweens.killTweensOf(containerCarta);
                this.tweens.add({
                    targets: containerCarta,
                    y: centroY - 105,
                    angle: 0,
                    scaleX: 1.15,
                    scaleY: 1.15,
                    duration: 150,
                    ease: 'Back.Out'
                });
            });

            containerCarta.on('pointerout', () => {
                if (this.travado) return;
                containerCarta.setDepth(containerCarta.depthBase);
                this.tweens.killTweensOf(containerCarta);
                this.tweens.add({
                    targets: containerCarta,
                    y: posY,
                    angle: angulo,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 150,
                    ease: 'Sine.easeOut'
                });
            });

            // Toque simples (sem arrastar) abre a visualização detalhada da
            // carta. Como dragDistanceThreshold > 0, um toque que não se
            // move o suficiente nunca chega a virar um drag, então este
            // 'pointerup' só dispara em cliques/toques de verdade.
            containerCarta.on('pointerup', () => {
                if (this.travado) return;
                this.mostrarDetalheCarta(carta);
            });
        });
    }

    // ---------- HISTÓRICO DE CARTAS JOGADAS ----------
    //
    // Modal com a lista (paginada) de todas as cartas jogadas na partida,
    // mais recentes primeiro. Cada linha mostra o turno, quem jogou e o
    // nome da carta; tocar numa linha abre a ficha detalhada dessa carta
    // (reaproveitando mostrarDetalheCarta).

    mostrarHistorico() {
        if (this.modalAberto) return;
        this.modalAberto = true;
        this.historicoAberto = true;
        this.travado = true;
        this.historicoPagina = 0;

        let overlay = this.add.rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 0.78);
        overlay.setDepth(4000);
        overlay.setInteractive();
        overlay.on('pointerup', () => this.fecharHistorico());

        let painelBg = this.add.rectangle(0, 0, 960, 1440, 0x14141c).setStrokeStyle(9, 0xffffff);
        painelBg.setInteractive();
        painelBg.on('pointerup', () => {});

        let titulo = this.add.text(0, -645, "Histórico de Cartas", {
            fontSize: "54px",
            color: "#ffffff",
            fontStyle: "bold"
        }).setOrigin(0.5);

        let fecharBg = this.add.circle(420, -645, 42, 0x2a2a2a).setStrokeStyle(3, 0xffffff);
        let fecharTexto = this.add.text(420, -645, "✕", { fontSize: "48px", color: "#ffffff" }).setOrigin(0.5);
        let fecharBtn = this.add.container(0, 0, [fecharBg, fecharTexto]);
        fecharBtn.setSize(84, 84);
        fecharBtn.setInteractive({ useHandCursor: true });
        fecharBtn.on('pointerup', () => this.fecharHistorico());

        const totalCartas = this.partida.historico.length;
        let subtitulo = this.add.text(
            0, -564,
            `${totalCartas} carta${totalCartas === 1 ? "" : "s"} jogada${totalCartas === 1 ? "" : "s"}`,
            { fontSize: "36px", color: "#999999" }
        ).setOrigin(0.5);

        // Container que guarda só as linhas da página atual: fica fácil
        // recriar apenas ele quando o usuário troca de página.
        let listaContainer = this.add.container(0, 0, []);

        let btnAnterior = this.criarBotaoPaginacaoHistorico(-180, 585, "‹", () => this.mudarPaginaHistorico(-1));
        let labelPagina = this.add.text(0, 585, "", { fontSize: "39px", color: "#cccccc" }).setOrigin(0.5);
        let btnProxima = this.criarBotaoPaginacaoHistorico(180, 585, "›", () => this.mudarPaginaHistorico(1));

        let painel = this.add.container(GW / 2, GH / 2, [
            painelBg, titulo, fecharBtn, subtitulo, listaContainer, btnAnterior, labelPagina, btnProxima
        ]);
        painel.setDepth(4001);
        painel.setScale(0.85);
        painel.setAlpha(0);

        this.overlayHistoricoAtual = overlay;
        this.painelHistoricoAtual = painel;
        this.listaHistoricoContainer = listaContainer;
        this.labelPaginaHistorico = labelPagina;
        this.btnAnteriorHistorico = btnAnterior;
        this.btnProximaHistorico = btnProxima;

        this.tweens.add({
            targets: painel,
            scale: 1,
            alpha: 1,
            duration: 200,
            ease: 'Back.Out'
        });

        this.atualizarListaHistorico();
    }

    criarBotaoPaginacaoHistorico(x, y, texto, aoClicar) {
        let bg = this.add.circle(x, y, 48, 0x2a2a2a).setStrokeStyle(3, 0xffffff);
        let label = this.add.text(x, y, texto, { fontSize: "54px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
        let btn = this.add.container(0, 0, [bg, label]);
        btn.setSize(96, 96);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerup', aoClicar);
        return btn;
    }

    // Redesenha só as linhas da página atual (chamado ao abrir o modal e
    // sempre que o usuário navega entre páginas).
    atualizarListaHistorico() {
        if (!this.listaHistoricoContainer) return;
        this.listaHistoricoContainer.removeAll(true);

        const TAMANHO_PAGINA = 6;
        // Mais recente primeiro
        const historico = [...this.partida.historico].reverse();
        const totalPaginas = Math.max(1, Math.ceil(historico.length / TAMANHO_PAGINA));
        this.historicoPagina = Phaser.Math.Clamp(this.historicoPagina, 0, totalPaginas - 1);

        if (historico.length === 0) {
            let vazio = this.add.text(0, -60, "Nenhuma carta jogada ainda.", {
                fontSize: "38px",
                color: "#aaaaaa",
                align: "center",
                wordWrap: { width: 780 }
            }).setOrigin(0.5);
            this.listaHistoricoContainer.add(vazio);
        } else {
            const inicio = this.historicoPagina * TAMANHO_PAGINA;
            const pagina = historico.slice(inicio, inicio + TAMANHO_PAGINA);

            pagina.forEach((entrada, indice) => {
                const y = -450 + indice * 162;
                this.listaHistoricoContainer.add(this.criarLinhaHistorico(entrada, y));
            });
        }

        if (this.labelPaginaHistorico) {
            this.labelPaginaHistorico.setText(`${this.historicoPagina + 1} / ${totalPaginas}`);
        }
        if (this.btnAnteriorHistorico) {
            this.btnAnteriorHistorico.setAlpha(this.historicoPagina === 0 ? 0.35 : 1);
        }
        if (this.btnProximaHistorico) {
            this.btnProximaHistorico.setAlpha(this.historicoPagina >= totalPaginas - 1 ? 0.35 : 1);
        }
    }

    mudarPaginaHistorico(delta) {
        this.historicoPagina += delta;
        this.atualizarListaHistorico();
    }

    // Uma linha da lista: turno + quem jogou de um lado, nome da carta no
    // meio, seta indicando que é clicável. Tocar na linha abre a ficha da carta.
    criarLinhaHistorico(entrada, y) {
        const corDono = entrada.quem === "jogador" ? 0x2ecc71 : 0xe74c3c;
        const labelDono = entrada.quem === "jogador" ? "Você" : "Inimigo";
        const corLabelDono = entrada.quem === "jogador" ? "#66ff99" : "#ff8888";

        let fundo = this.add.rectangle(0, 0, 840, 138, 0x1e1e28).setStrokeStyle(3, 0x333344);
        let barra = this.add.rectangle(-402, 0, 18, 138, corDono);

        let turnoTexto = this.add.text(-354, -33, `Turno ${entrada.turno}`, {
            fontSize: "30px",
            color: "#999999",
            fontStyle: "bold"
        }).setOrigin(0, 0.5);

        let donoTexto = this.add.text(-354, 33, labelDono, {
            fontSize: "30px",
            color: corLabelDono
        }).setOrigin(0, 0.5);

        let nomeTexto = this.add.text(-60, 0, this.truncarTexto(entrada.carta.nome, 18), {
            fontSize: "38px",
            color: "#ffffff",
            fontStyle: "bold",
            align: "center",
            wordWrap: { width: 390 }
        }).setOrigin(0.5);

        let seta = this.add.text(384, 0, "›", { fontSize: "48px", color: "#888888" }).setOrigin(0.5);

        let linha = this.add.container(0, y, [fundo, barra, turnoTexto, donoTexto, nomeTexto, seta]);
        linha.setSize(840, 138);
        linha.setInteractive({ useHandCursor: true });
        linha.on('pointerover', () => fundo.setFillStyle(0x28283a));
        linha.on('pointerout', () => fundo.setFillStyle(0x1e1e28));
        linha.on('pointerup', () => this.abrirDetalheDoHistorico(entrada.carta));

        return linha;
    }

    // Chamado ao tocar numa linha do histórico: fecha o modal de histórico
    // imediatamente (sem animação de saída, pra não brigar de estado com o
    // modal de detalhe) e abre a ficha da carta na sequência.
    abrirDetalheDoHistorico(carta) {
        if (this.painelHistoricoAtual) this.painelHistoricoAtual.destroy();
        if (this.overlayHistoricoAtual) this.overlayHistoricoAtual.destroy();
        this.painelHistoricoAtual = null;
        this.overlayHistoricoAtual = null;
        this.listaHistoricoContainer = null;
        this.labelPaginaHistorico = null;
        this.btnAnteriorHistorico = null;
        this.btnProximaHistorico = null;
        this.historicoAberto = false;
        this.modalAberto = false;

        this.mostrarDetalheCarta(carta);
    }

    fecharHistorico() {
        if (!this.historicoAberto) return;

        this.tweens.add({
            targets: this.painelHistoricoAtual,
            scale: 0.85,
            alpha: 0,
            duration: 150,
            ease: 'Sine.easeIn',
            onComplete: () => {
                if (this.painelHistoricoAtual) this.painelHistoricoAtual.destroy();
                if (this.overlayHistoricoAtual) this.overlayHistoricoAtual.destroy();
                this.painelHistoricoAtual = null;
                this.overlayHistoricoAtual = null;
                this.listaHistoricoContainer = null;
                this.labelPaginaHistorico = null;
                this.btnAnteriorHistorico = null;
                this.btnProximaHistorico = null;
                this.historicoAberto = false;
                this.modalAberto = false;
                this.travado = false;
            }
        });
    }

    // ---------- VISUALIZAÇÃO DETALHADA DA CARTA ----------

    // Mostra um painel grande com a "arte" (placeholder colorido), nome,
    // poder (no mesmo selo circular usado nas cartas) e a descrição
    // completa (flavor text + efeito passivo).
    mostrarDetalheCarta(carta) {
        if (this.modalAberto) return;
        this.modalAberto = true;
        this.travado = true;

        // Fundo escurecido cobrindo a tela toda; tocar nele fecha o painel
        let overlay = this.add.rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 0.78);
        overlay.setDepth(4000);
        overlay.setInteractive();
        overlay.on('pointerup', () => this.fecharDetalheCarta());

        const corFundo = this.obterCorPorId(carta.id);
        const ehEfeito = carta.tipo === "efeito";

        let painelBg = this.add.rectangle(0, 0, 840, 1320, 0x14141c).setStrokeStyle(9, 0xffffff);
        // Impede que o toque no painel "vaze" para o overlay e feche o modal
        painelBg.setInteractive();
        painelBg.on('pointerup', () => {});

        // "Imagem" da carta: placeholder colorido baseado no id, sem nenhum asset
        let imagem = this.add.rectangle(0, -345, 660, 480, corFundo).setStrokeStyle(6, 0xffffff);
        let iconeImagem = this.add.text(0, -345, ehEfeito ? "⚡" : "⚔", { fontSize: "156px" }).setOrigin(0.5);

        let etiquetaTipo = this.add.text(0, -765, ehEfeito ? "CARTA DE EFEITO" : "CARTA DE PERSONAGEM", {
            fontSize: "36px",
            color: ehEfeito ? "#ffe066" : "#9be7ff",
            fontStyle: "bold"
        }).setOrigin(0.5);

        let nomeTexto = this.add.text(0, -60, carta.nome, {
            fontSize: "54px",
            color: "#ffffff",
            fontStyle: "bold",
            align: "center",
            wordWrap: { width: 750 }
        }).setOrigin(0.5, 0);

        const filhosPainel = [painelBg, imagem, iconeImagem, etiquetaTipo, nomeTexto];

        let descY = 160;
        if (!ehEfeito) {
            const [poderBola, poderTexto] = this.criarSeloEstat(0, 135, carta.poder, "#ff5555", 90);
            let poderLabel = this.add.text(0, 255, "PODER", { fontSize: "33px", color: "#aaaaaa" }).setOrigin(0.5);
            filhosPainel.push(poderBola, poderTexto, poderLabel);
            descY = 330;
        }

        let descTexto = this.add.text(0, descY, carta.descricaoCompleta(), {
            fontSize: "30px",
            color: "#dddddd",
            align: "center",
            wordWrap: { width: 720 },
            lineSpacing: 10
        }).setOrigin(0.5, 0);

        let fecharBg = this.add.circle(360, -615, 42, 0x2a2a2a).setStrokeStyle(3, 0xffffff);
        let fecharTexto = this.add.text(360, -615, "✕", { fontSize: "48px", color: "#ffffff" }).setOrigin(0.5);
        let fecharBtn = this.add.container(0, 0, [fecharBg, fecharTexto]);
        fecharBtn.setSize(84, 84);
        fecharBtn.setInteractive({ useHandCursor: true });
        fecharBtn.on('pointerup', () => this.fecharDetalheCarta());

        filhosPainel.push(descTexto, fecharBtn);

        let painel = this.add.container(GW / 2, GH / 2, filhosPainel);
        painel.setDepth(4001);
        painel.setScale(0.8);
        painel.setAlpha(0);

        this.tweens.add({
            targets: painel,
            scale: 1,
            alpha: 1,
            duration: 200,
            ease: 'Back.Out'
        });

        this.overlayDetalheAtual = overlay;
        this.painelDetalheAtual = painel;
    }

    fecharDetalheCarta() {
        if (!this.modalAberto) return;

        this.tweens.add({
            targets: this.painelDetalheAtual,
            scale: 0.8,
            alpha: 0,
            duration: 150,
            ease: 'Sine.easeIn',
            onComplete: () => {
                if (this.painelDetalheAtual) this.painelDetalheAtual.destroy();
                if (this.overlayDetalheAtual) this.overlayDetalheAtual.destroy();
                this.painelDetalheAtual = null;
                this.overlayDetalheAtual = null;
                this.modalAberto = false;
                this.travado = false;
            }
        });
    }

    // ---------- STATUS / UI ----------

    desenharStatus() {
        this.add.text(45, 45, `Turno: ${this.partida.turno}`, { fontSize: "36px", color: "#ffffff" });
        this.add.text(45, 100, `Vitórias: ${this.partida.jogador.vitorias}`, { fontSize: "36px", color: "#ff0000" });
        this.desenharBotaoHistorico();
    }

    // Botão que abre o modal com o histórico de cartas jogadas na partida.
    desenharBotaoHistorico() {
        let bg = this.add.rectangle(0, 0, 300, 80, 0x2255aa).setStrokeStyle(4, 0xffffff);
        let texto = this.add.text(0, 0, "📜 Histórico", { fontSize: "28px", color: "#ffffff" }).setOrigin(0.5);

        let btn = this.add.container(200, 220, [bg, texto]);
        btn.setSize(300, 80);
        btn.setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => {
            if (this.travado) return;
            this.tweens.add({ targets: btn, scale: 1.05, duration: 100 });
        });

        btn.on('pointerout', () => {
            if (this.travado) return;
            this.tweens.add({ targets: btn, scale: 1, duration: 100 });
        });

        btn.on('pointerup', () => {
            if (this.travado) return;
            this.mostrarHistorico();
        });
    }

    // Botão flutuante, sempre no rodapé, para esconder/mostrar a mão e dar
    // mais espaço/destaque ao campo. Some/reaparece com uma animação da
    // própria mão, não só um corte seco.
    desenharBotaoToggleMao() {
        const qtd = this.partida.jogador.mao.cartas.length;
        const rotulo = this.maoEscondida ? `▲ Mostrar Mão (${qtd})` : "▼ Esconder Mão";
        const corBg = this.maoEscondida ? 0x225533 : 0x333333;

        let bg = this.add.rectangle(0, 0, 340, 72, corBg).setStrokeStyle(3, 0xffffff, 0.7);
        let texto = this.add.text(0, 0, rotulo, { fontSize: "26px", color: "#ffffff" }).setOrigin(0.5);

        let btn = this.add.container(GW / 2, GH - 50, [bg, texto]);
        btn.setSize(340, 72);
        btn.setDepth(50);
        btn.setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => {
            if (this.travado) return;
            this.tweens.add({ targets: btn, scale: 1.05, duration: 100 });
        });

        btn.on('pointerout', () => {
            if (this.travado) return;
            this.tweens.add({ targets: btn, scale: 1, duration: 100 });
        });

        btn.on('pointerup', () => {
            if (this.travado) return;
            this.alternarMao();
        });
    }

    // Alterna a visibilidade da mão. Ao esconder, as cartas na tela deslizam
    // para baixo e somem antes do campo ser redesenhado (maior); ao mostrar
    // de novo, a própria entrada animada do leque já cuida da transição.
    alternarMao() {
        if (this.maoEscondida) {
            this.maoEscondida = false;
            this.desenharInterface();
            return;
        }

        const cartasNaTela = this.children.list.filter(c => c.dadosCarta);
        if (cartasNaTela.length === 0) {
            this.maoEscondida = true;
            this.desenharInterface();
            return;
        }

        this.travado = true;
        this.tweens.add({
            targets: cartasNaTela,
            y: '+=420',
            alpha: 0,
            duration: 260,
            ease: 'Cubic.In',
            onComplete: () => {
                this.maoEscondida = true;
                this.desenharInterface();
                this.travado = false;
            }
        });
    }

    desenharBotaoPassarTurno() {
        let bg = this.add.rectangle(0, 0, 340, 100, 0xff5500).setStrokeStyle(4, 0xffffff);
        let texto = this.add.text(0, 0, "Passar Turno", { fontSize: "32px", color: "#fff" }).setOrigin(0.5);

        let btn = this.add.container(GW - 210, 90, [bg, texto]);
        btn.setSize(340, 100);
        btn.setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => {
            if (this.travado) return;
            this.tweens.add({ targets: btn, scale: 1.05, duration: 100 });
        });

        btn.on('pointerout', () => {
            if (this.travado) return;
            this.tweens.add({ targets: btn, scale: 1, duration: 100 });
        });

        btn.on("pointerdown", () => {
            if (this.travado) return;
            this.travado = true;

            this.tweens.add({
                targets: btn,
                scale: 0.88,
                duration: 90,
                yoyo: true,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    const resultado = this.partida.fimTurno();
                    const efeitoInimigo = this.partida.efeitoInimigoTurno;

                    const finalizarTurno = () => {
                        this.desenharInterface();
                        if (efeitoInimigo) {
                            this.animarCartasAfetadas(efeitoInimigo.afetadas);
                        }
                        this.mostrarResultadoCombate(resultado);
                        this.travado = false;
                    };

                    if (efeitoInimigo) {
                        this.conjurarCartaDeEfeitoInimigo(efeitoInimigo.carta, finalizarTurno);
                    } else {
                        finalizarTurno();
                    }
                }
            });
        });
    }

    // Feedback visual do resultado da rodada: flash de câmera (nativo do
    // Phaser, sem asset nenhum) + texto flutuante que some sozinho.
    mostrarResultadoCombate(resultado) {
        const config = {
            jogador: { cor: [0, 255, 136], texto: "Você venceu a rodada!", corTexto: "#00ff88" },
            inimigo: { cor: [255, 68, 68], texto: "O inimigo venceu a rodada!", corTexto: "#ff4444" },
            empate: { cor: [200, 200, 200], texto: "Rodada empatada!", corTexto: "#ffffff" }
        };
        const info = config[resultado.resultado];

        this.cameras.main.flash(400, info.cor[0], info.cor[1], info.cor[2]);

        let texto = this.add.text(GW / 2, 750, info.texto, {
            fontSize: "44px",
            color: info.corTexto,
            fontStyle: "bold",
            align: "center",
            wordWrap: { width: 850 }
        }).setOrigin(0.5).setDepth(3000).setAlpha(0);

        this.textoResultadoAtual = texto;

        this.tweens.add({
            targets: texto,
            alpha: 1,
            y: 660,
            duration: 300,
            ease: 'Back.Out',
            onComplete: () => {
                this.tweens.add({
                    targets: texto,
                    alpha: 0,
                    y: 570,
                    delay: 700,
                    duration: 400,
                    onComplete: () => {
                        texto.destroy();
                        if (this.textoResultadoAtual === texto) {
                            this.textoResultadoAtual = null;
                        }
                    }
                });
            }
        });
    }
}
