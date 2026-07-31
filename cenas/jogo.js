class CenaJogo extends Phaser.Scene {
    constructor() {
        super("CenaJogo");
    }

    create() {
        this.partida = new Partida();

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

    // Selo circular usado para mostrar poder/custo (e também os números
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

        this.desenharStatus();
        this.desenharCampoInimigo();
        this.desenharCampoJogador();
        this.desenharMaoEmLeque();
        this.desenharBotaoPassarTurno();
    }

    // ---------- LÓGICA DE ARRASTAR E SOLTAR ----------

    tratarSoltarCarta(gameObject) {
        const carta = gameObject.dadosCarta;

        let slots = this.children.list.filter(child => child.isSlot);
        let slotAtingido = null;

        slots.forEach((slot, index) => {
            if (Phaser.Geom.Intersects.RectangleToRectangle(gameObject.getBounds(), slot.getBounds())) {
                slotAtingido = index;
            }
        });

        // Soltou fora da área de jogo: volta pro leque normalmente
        if (slotAtingido === null) {
            this.animarRetornoAoLeque(gameObject, false);
            return;
        }

        const temEnergia = this.partida.jogador.energia >= carta.custo;

        // --- Cartas de efeito: nunca vão para o campo. Só precisam de
        // energia; ao serem soltas, são conjuradas no meio da tela e
        // consumidas na hora. ---
        if (carta.tipo === "efeito") {
            if (!temEnergia) {
                this.animarRetornoAoLeque(gameObject, true);
                this.cameras.main.shake(150, 0.002);
                return;
            }
            this.conjurarCartaDeEfeitoJogador(gameObject, carta);
            return;
        }

        // --- Cartas de monstro: comportamento original, vão para o campo ---
        const temEspaco = this.partida.jogador.campo.temEspaco(slotAtingido);

        if (!temEspaco || !temEnergia) {
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
            x: 180,
            y: 360,
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

        let rotulo = this.add.text(0, -95, "O inimigo conjurou:", {
            fontSize: "13px",
            color: "#ff8888",
            fontStyle: "bold"
        }).setOrigin(0.5);

        let sombra = this.add.rectangle(4, 6, 100, 135, 0x000000, 0.4);
        let fundo = this.add.rectangle(0, 0, 100, 135, corFundo).setStrokeStyle(3, 0xff4444);
        let nomeTexto = this.add.text(0, -35, carta.nome, {
            fontSize: "14px",
            color: "#ffffff",
            fontStyle: "bold",
            align: "center",
            wordWrap: { width: 85 }
        }).setOrigin(0.5);
        let iconeTexto = this.add.text(0, 25, "⚡", { fontSize: "30px" }).setOrigin(0.5);

        let container = this.add.container(180, 360, [rotulo, sombra, fundo, nomeTexto, iconeTexto]);
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

        let texto = this.add.text(containerCampo.x, containerCampo.y - 60, `${positivo ? "+" : ""}${delta}`, {
            fontSize: "22px",
            color: cor,
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(3600).setAlpha(0);

        this.tweens.add({
            targets: texto,
            alpha: 1,
            y: containerCampo.y - 90,
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
        for (let i = 0; i < 3; i++) {
            const xPos = 60 + i * 120;
            this.add.rectangle(xPos, 180, 100, 120, 0x332222);

            let carta = this.partida.inimigo.campo.cartas[i];
            if (carta) {
                this.criarCartaDeCampo(xPos, 180, carta);
            }
        }
    }

    desenharCampoJogador() {
        for (let i = 0; i < 3; i++) {
            const xPos = 60 + i * 120;
            let slot = this.add.rectangle(xPos, 340, 100, 120, 0x224422);
            slot.isSlot = true; // Identificador para a colisão do Drag & Drop

            let carta = this.partida.jogador.campo.cartas[i];
            if (carta) {
                this.criarCartaDeCampo(xPos, 340, carta);
            }
        }
    }

    // Carta do campo com pequena sombra e animação de "pop" ao aparecer.
    // Poder fica no canto inferior esquerdo e custo no canto inferior
    // direito, cada um dentro de um selo circular. Também é clicável: um
    // toque abre a visualização detalhada da carta.
    criarCartaDeCampo(xPos, yPos, carta) {
        let corFundo = this.obterCorPorId(carta.id);

        let sombra = this.add.rectangle(3, 4, 90, 110, 0x000000, 0.35);
        let fundo = this.add.rectangle(0, 0, 90, 110, corFundo);
        let nomeCurto = this.truncarTexto(carta.nome, 14);
        let nomeTexto = this.add.text(0, -38, nomeCurto, {
            fontSize: "13px",
            color: "#fff",
            align: "center",
            wordWrap: { width: 78 }
        }).setOrigin(0.5, 0);

        const [poderBola, poderTexto] = this.criarSeloEstat(-33, 42, carta.poder, "#ff5555", 13);
        const [custoBola, custoTexto] = this.criarSeloEstat(33, 42, carta.custo, "#ffdd33", 13);

        const filhos = [sombra, fundo, nomeTexto, poderBola, poderTexto, custoBola, custoTexto];

        // Selo indicando que é uma carta de efeito (a passiva já foi
        // disparada ao entrar em campo — este selo é só um lembrete visual)
        if (carta.tipo === "efeito") {
            let selo = this.add.circle(38, -48, 11, 0x1a1a1a).setStrokeStyle(1, 0xffffff);
            let iconeSelo = this.add.text(38, -48, "⚡", { fontSize: "12px" }).setOrigin(0.5);
            filhos.push(selo, iconeSelo);
        }

        let container = this.add.container(xPos, yPos, filhos);
        container.setScale(0);
        container.setSize(90, 110);
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
            duration: 260,
            ease: 'Back.Out'
        });
    }

    // ---------- DESENHO DA MÃO (LEQUE) ----------

    desenharMaoEmLeque() {
        let cartasMao = this.partida.jogador.mao.cartas;
        let totalCartas = cartasMao.length;
        if (totalCartas === 0) return;

        const centroX = 180;        // Centro da tela (360 / 2)
        const centroY = 550;        // Altura base da mão
        const espacamentoX = 35;    // Distância horizontal entre cartas
        const anguloPasso = 7;      // Inclinação por carta
        const curvaturaY = 5;       // Curvatura da parábola

        cartasMao.forEach((carta, indice) => {
            let offset = indice - (totalCartas - 1) / 2;

            let posX = centroX + (offset * espacamentoX);
            let posY = centroY + (Math.pow(offset, 2) * curvaturaY);
            let angulo = offset * anguloPasso;

            let corFundo = this.obterCorPorId(carta.id);
            let sombra = this.add.rectangle(3, 5, 75, 105, 0x000000, 0.35);
            let fundoCarta = this.add.rectangle(0, 0, 75, 105, corFundo);
            let borda = this.add.rectangle(0, 0, 75, 105).setStrokeStyle(2, 0xffffff);
            let nomeCurto = this.truncarTexto(carta.nome, 12);
            let nomeTexto = this.add.text(0, -40, nomeCurto, {
                fontSize: "12px",
                color: "#ffffff",
                align: "center",
                wordWrap: { width: 65 }
            }).setOrigin(0.5, 0);

            const [poderBola, poderTexto] = this.criarSeloEstat(-27, 40, carta.poder, "#ff5555", 11);
            const [custoBola, custoTexto] = this.criarSeloEstat(27, 40, carta.custo, "#ffdd33", 11);

            const filhos = [sombra, fundoCarta, borda, nomeTexto, poderBola, poderTexto, custoBola, custoTexto];

            // Selo de carta de efeito, para diferenciar visualmente das cartas de monstro
            if (carta.tipo === "efeito") {
                let selo = this.add.circle(30, -42, 10, 0x1a1a1a).setStrokeStyle(1, 0xffffff);
                let iconeSelo = this.add.text(30, -42, "⚡", { fontSize: "11px" }).setOrigin(0.5);
                filhos.push(selo, iconeSelo);
            }

            let containerCarta = this.add.container(posX, posY, filhos);
            containerCarta.setSize(75, 105);
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
                    y: centroY - 35,
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

        let overlay = this.add.rectangle(180, 360, 360, 720, 0x000000, 0.78);
        overlay.setDepth(4000);
        overlay.setInteractive();
        overlay.on('pointerup', () => this.fecharHistorico());

        let painelBg = this.add.rectangle(0, 0, 320, 480, 0x14141c).setStrokeStyle(3, 0xffffff);
        painelBg.setInteractive();
        painelBg.on('pointerup', () => {});

        let titulo = this.add.text(0, -215, "Histórico de Cartas", {
            fontSize: "18px",
            color: "#ffffff",
            fontStyle: "bold"
        }).setOrigin(0.5);

        let fecharBg = this.add.circle(140, -215, 14, 0x2a2a2a).setStrokeStyle(1, 0xffffff);
        let fecharTexto = this.add.text(140, -215, "✕", { fontSize: "16px", color: "#ffffff" }).setOrigin(0.5);
        let fecharBtn = this.add.container(0, 0, [fecharBg, fecharTexto]);
        fecharBtn.setSize(28, 28);
        fecharBtn.setInteractive({ useHandCursor: true });
        fecharBtn.on('pointerup', () => this.fecharHistorico());

        const totalCartas = this.partida.historico.length;
        let subtitulo = this.add.text(
            0, -188,
            `${totalCartas} carta${totalCartas === 1 ? "" : "s"} jogada${totalCartas === 1 ? "" : "s"}`,
            { fontSize: "12px", color: "#999999" }
        ).setOrigin(0.5);

        // Container que guarda só as linhas da página atual: fica fácil
        // recriar apenas ele quando o usuário troca de página.
        let listaContainer = this.add.container(0, 0, []);

        let btnAnterior = this.criarBotaoPaginacaoHistorico(-60, 195, "‹", () => this.mudarPaginaHistorico(-1));
        let labelPagina = this.add.text(0, 195, "", { fontSize: "13px", color: "#cccccc" }).setOrigin(0.5);
        let btnProxima = this.criarBotaoPaginacaoHistorico(60, 195, "›", () => this.mudarPaginaHistorico(1));

        let painel = this.add.container(180, 360, [
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
        let bg = this.add.circle(x, y, 16, 0x2a2a2a).setStrokeStyle(1, 0xffffff);
        let label = this.add.text(x, y, texto, { fontSize: "18px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5);
        let btn = this.add.container(0, 0, [bg, label]);
        btn.setSize(32, 32);
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
            let vazio = this.add.text(0, -20, "Nenhuma carta jogada ainda.", {
                fontSize: "14px",
                color: "#aaaaaa",
                align: "center",
                wordWrap: { width: 260 }
            }).setOrigin(0.5);
            this.listaHistoricoContainer.add(vazio);
        } else {
            const inicio = this.historicoPagina * TAMANHO_PAGINA;
            const pagina = historico.slice(inicio, inicio + TAMANHO_PAGINA);

            pagina.forEach((entrada, indice) => {
                const y = -150 + indice * 54;
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

        let fundo = this.add.rectangle(0, 0, 280, 46, 0x1e1e28).setStrokeStyle(1, 0x333344);
        let barra = this.add.rectangle(-134, 0, 6, 46, corDono);

        let turnoTexto = this.add.text(-118, -11, `Turno ${entrada.turno}`, {
            fontSize: "11px",
            color: "#999999",
            fontStyle: "bold"
        }).setOrigin(0, 0.5);

        let donoTexto = this.add.text(-118, 11, labelDono, {
            fontSize: "11px",
            color: corLabelDono
        }).setOrigin(0, 0.5);

        let nomeTexto = this.add.text(-20, 0, this.truncarTexto(entrada.carta.nome, 18), {
            fontSize: "14px",
            color: "#ffffff",
            fontStyle: "bold",
            align: "center",
            wordWrap: { width: 130 }
        }).setOrigin(0.5);

        let seta = this.add.text(128, 0, "›", { fontSize: "18px", color: "#888888" }).setOrigin(0.5);

        let linha = this.add.container(0, y, [fundo, barra, turnoTexto, donoTexto, nomeTexto, seta]);
        linha.setSize(280, 46);
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
    // poder, custo (nos mesmos selos circulares usados nas cartas) e a
    // descrição completa (flavor text + efeito passivo).
    mostrarDetalheCarta(carta) {
        if (this.modalAberto) return;
        this.modalAberto = true;
        this.travado = true;

        // Fundo escurecido cobrindo a tela toda; tocar nele fecha o painel
        let overlay = this.add.rectangle(180, 360, 360, 720, 0x000000, 0.78);
        overlay.setDepth(4000);
        overlay.setInteractive();
        overlay.on('pointerup', () => this.fecharDetalheCarta());

        const corFundo = this.obterCorPorId(carta.id);
        const ehEfeito = carta.tipo === "efeito";

        let painelBg = this.add.rectangle(0, 0, 280, 440, 0x14141c).setStrokeStyle(3, 0xffffff);
        // Impede que o toque no painel "vaze" para o overlay e feche o modal
        painelBg.setInteractive();
        painelBg.on('pointerup', () => {});

        // "Imagem" da carta: placeholder colorido baseado no id, sem nenhum asset
        let imagem = this.add.rectangle(0, -115, 220, 160, corFundo).setStrokeStyle(2, 0xffffff);
        let iconeImagem = this.add.text(0, -115, ehEfeito ? "⚡" : "⚔", { fontSize: "52px" }).setOrigin(0.5);

        let etiquetaTipo = this.add.text(0, -255, ehEfeito ? "CARTA DE EFEITO" : "CARTA DE PERSONAGEM", {
            fontSize: "12px",
            color: ehEfeito ? "#ffe066" : "#9be7ff",
            fontStyle: "bold"
        }).setOrigin(0.5);

        let nomeTexto = this.add.text(0, -20, carta.nome, {
            fontSize: "18px",
            color: "#ffffff",
            fontStyle: "bold",
            align: "center",
            wordWrap: { width: 250 }
        }).setOrigin(0.5, 0);

        const [poderBola, poderTexto] = this.criarSeloEstat(-55, 45, carta.poder, "#ff5555", 26);
        const [custoBola, custoTexto] = this.criarSeloEstat(55, 45, carta.custo, "#ffdd33", 26);
        let poderLabel = this.add.text(-55, 85, "PODER", { fontSize: "11px", color: "#aaaaaa" }).setOrigin(0.5);
        let custoLabel = this.add.text(55, 85, "CUSTO", { fontSize: "11px", color: "#aaaaaa" }).setOrigin(0.5);

        let descTexto = this.add.text(0, 110, carta.descricaoCompleta(), {
            fontSize: "13px",
            color: "#dddddd",
            align: "center",
            wordWrap: { width: 240 },
            lineSpacing: 4
        }).setOrigin(0.5, 0);

        let fecharBg = this.add.circle(120, -205, 14, 0x2a2a2a).setStrokeStyle(1, 0xffffff);
        let fecharTexto = this.add.text(120, -205, "✕", { fontSize: "16px", color: "#ffffff" }).setOrigin(0.5);
        let fecharBtn = this.add.container(0, 0, [fecharBg, fecharTexto]);
        fecharBtn.setSize(28, 28);
        fecharBtn.setInteractive({ useHandCursor: true });
        fecharBtn.on('pointerup', () => this.fecharDetalheCarta());

        let painel = this.add.container(180, 360, [
            painelBg, imagem, iconeImagem, etiquetaTipo, nomeTexto,
            poderBola, poderTexto, custoBola, custoTexto, poderLabel, custoLabel,
            descTexto, fecharBtn
        ]);
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
        this.add.text(15, 15, `Turno: ${this.partida.turno}`, { fontSize: "16px", color: "#ffffff" });
        this.add.text(15, 40, `Vitórias: ${this.partida.jogador.vitorias}`, { fontSize: "16px", color: "#ff0000" });
        this.desenharEnergiaJogador();
        this.desenharBotaoHistorico();
    }

    // Botão que abre o modal com o histórico de cartas jogadas na partida.
    desenharBotaoHistorico() {
        let bg = this.add.rectangle(0, 0, 110, 30, 0x2255aa).setStrokeStyle(2, 0xffffff);
        let texto = this.add.text(0, 0, "📜 Histórico", { fontSize: "12px", color: "#ffffff" }).setOrigin(0.5);

        let btn = this.add.container(70, 75, [bg, texto]);
        btn.setSize(110, 30);
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

    // Energia total do jogador: bola com fundo amarelo, texto branco com
    // contorno preto, no canto direito da tela, logo abaixo do campo.
    desenharEnergiaJogador() {
        const x = 325;
        const y = 420;

        this.add.text(x, y - 36, "Energia", { fontSize: "12px", color: "#ffffff" }).setOrigin(0.5);

        let bola = this.add.circle(x, y, 24, 0xffdd00);
        let texto = this.add.text(x, y, `${this.partida.jogador.energia}`, {
            fontSize: "20px",
            color: "#ffffff",
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 4
        }).setOrigin(0.5);

        if (this.energiaAnterior !== undefined && this.partida.jogador.energia !== this.energiaAnterior) {
            bola.setScale(1.4);
            texto.setScale(1.4);
            this.tweens.add({ targets: [bola, texto], scale: 1, duration: 300, ease: 'Back.Out' });
        }
        this.energiaAnterior = this.partida.jogador.energia;
    }

    desenharBotaoPassarTurno() {
        let bg = this.add.rectangle(0, 0, 130, 40, 0xff5500).setStrokeStyle(2, 0xffffff);
        let texto = this.add.text(0, 0, "Passar Turno", { fontSize: "14px", color: "#fff" }).setOrigin(0.5);

        let btn = this.add.container(295, 30, [bg, texto]);
        btn.setSize(130, 40);
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

        let texto = this.add.text(180, 250, info.texto, {
            fontSize: "20px",
            color: info.corTexto,
            fontStyle: "bold",
            align: "center",
            wordWrap: { width: 300 }
        }).setOrigin(0.5).setDepth(3000).setAlpha(0);

        this.textoResultadoAtual = texto;

        this.tweens.add({
            targets: texto,
            alpha: 1,
            y: 220,
            duration: 300,
            ease: 'Back.Out',
            onComplete: () => {
                this.tweens.add({
                    targets: texto,
                    alpha: 0,
                    y: 190,
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
