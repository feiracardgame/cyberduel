console.log("cartas.js carregado");

// ============================================================================
// ARQUIVO DE DADOS DAS CARTAS
// ============================================================================
// Tudo relacionado a "o que é uma carta" mora aqui: a classe Carta, os tipos
// de efeito passivo e o pool de cartas de efeito usado para montar os decks.
//
// Para adicionar uma carta de efeito nova, basta acrescentar um objeto ao
// array POOL_CARTAS_EFEITO lá embaixo — não precisa mexer em mais nada.
// Para mudar como o jogo resolve/mostra os efeitos, mexa nas funções
// descreverEfeito() e (em main.js) Partida.aplicarEfeitoInvocacao().
// ============================================================================

// ---------- SISTEMA DE EFEITOS PASSIVOS (AO INVOCAR) ----------
//
// Todos os efeitos aqui são disparados uma única vez, no momento em que a
// carta é colocada em campo (invocada) ou conjurada. Não existem habilidades
// ativadas manualmente — isso mantém o fluxo do jogo simples e automático.

const TIPOS_EFEITO = {
    BUFF_ALIADOS: "buff_aliados",       // fortalece as outras cartas aliadas já em campo
    DEBUFF_INIMIGOS: "debuff_inimigos", // enfraquece as cartas inimigas em campo
    COMPRAR_CARTA: "comprar_carta",     // dono compra carta(s) extra do deck
    DESCARTAR_CARTA: "descartar_carta"  // oponente descarta carta(s) aleatória(s) da mão
};

// Gera a frase descritiva de um efeito, usada na visualização detalhada da carta
function descreverEfeito(efeito) {
    if (!efeito) return "";
    switch (efeito.tipo) {
        case TIPOS_EFEITO.BUFF_ALIADOS:
            return `Ao ser invocada: todos os aliados em campo ganham +${efeito.valor} de poder.`;
        case TIPOS_EFEITO.DEBUFF_INIMIGOS:
            return `Ao ser invocada: todas as cartas inimigas em campo perdem -${efeito.valor} de poder.`;
        case TIPOS_EFEITO.COMPRAR_CARTA:
            return `Ao ser invocada: você compra ${efeito.valor} carta${efeito.valor > 1 ? "s" : ""} do deck.`;
        case TIPOS_EFEITO.DESCARTAR_CARTA:
            return `Ao ser invocada: o oponente descarta ${efeito.valor} carta${efeito.valor > 1 ? "s" : ""} aleatória${efeito.valor > 1 ? "s" : ""} da mão.`;
        default:
            return "";
    }
}

// ----------------------------------------------------------------------------
// POOL DE CARTAS DE EFEITO
// ----------------------------------------------------------------------------
// Cada entrada é um "molde" (não tem id ainda — o id é gerado quando o deck
// de teste é montado, em Jogador.criardeckteste(), no main.js).
//
// Para criar uma carta nova, copie um bloco abaixo e ajuste os campos:
//   nome       -> nome exibido na carta
//   poder      -> poder da carta (usado só se ela também pudesse ir a campo;
//                 hoje cartas de efeito nunca vão a campo, mas o valor ainda
//                 aparece no selo da carta)
//   descricao  -> texto de "flavor", mostrado na visualização detalhada
//   efeito     -> { tipo: TIPOS_EFEITO.<algum>, valor: <número> }
// ----------------------------------------------------------------------------
const POOL_CARTAS_EFEITO = [
    {
        nome: "Engenheiro de Elite",
        poder: 3,
        descricao: "Um técnico que reforça as defesas de toda a equipe assim que entra em campo.",
        efeito: { tipo: TIPOS_EFEITO.BUFF_ALIADOS, valor: 2 }
    },
    {
        nome: "Vírus Corrosivo",
        poder: 2,
        descricao: "Um malware agressivo que corrompe os sistemas inimigos no instante da invasão.",
        efeito: { tipo: TIPOS_EFEITO.DEBUFF_INIMIGOS, valor: 2 }
    },
    {
        nome: "Gerador Portátil",
        poder: 1,
        descricao: "Acessa a rede e extrai dados extras assim que é conectado.",
        efeito: { tipo: TIPOS_EFEITO.COMPRAR_CARTA, valor: 1 }
    },
    {
        nome: "Hacker Fantasma",
        poder: 4,
        descricao: "Invade os servidores inimigos e corrompe seus arquivos ao ser ativado.",
        efeito: { tipo: TIPOS_EFEITO.DESCARTAR_CARTA, valor: 1 }
    },
    {
        nome: "Enxame de Drones",
        poder: 2,
        descricao: "Pequenos drones autônomos que reforçam toda a formação aliada.",
        efeito: { tipo: TIPOS_EFEITO.BUFF_ALIADOS, valor: 1 }
    },
    {
        nome: "Pulso EMP",
        poder: 1,
        descricao: "Uma sobrecarga elétrica de curto alcance que enfraquece os sistemas inimigos.",
        efeito: { tipo: TIPOS_EFEITO.DEBUFF_INIMIGOS, valor: 3 }
    }

    // Adicione novas cartas de efeito aqui, seguindo o mesmo formato acima.
];

// ----------------------------------------------------------------------------
// CLASSE CARTA
// ----------------------------------------------------------------------------
class Carta {
    constructor(id, poder, tipo, opcoes = {}) {
        this.id = id;
        this.poder = poder;
        this.tipo = tipo; // "monstro" ou "efeito"
        this.nome = opcoes.nome || `Unidade #${id}`;
        this.descricaoFlavor = opcoes.descricao || "";
        this.efeito = opcoes.efeito || null; // efeito passivo, disparado só ao ser invocada
    }

    mostrar() {
        console.log(`Carta ID: ${this.id}, Poder: ${this.poder}`);
    }

    buff(valor) {
        // Poder nunca fica negativo, mesmo após vários debuffs
        this.poder = Math.max(0, this.poder + valor);
    }

    // Texto completo mostrado na visualização detalhada da carta
    descricaoCompleta() {
        const partes = [];
        if (this.descricaoFlavor) partes.push(this.descricaoFlavor);
        const textoEfeito = descreverEfeito(this.efeito);
        if (textoEfeito) partes.push(textoEfeito);
        if (partes.length === 0) partes.push("Uma unidade de combate padrão, sem habilidades especiais.");
        return partes.join(" ");
    }
}
