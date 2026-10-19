const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
class Element {
  constructor() { this.children=[]; this.dataset={}; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute() {}
  remove() { this.removed=true; }
}
const document = { createElement: () => new Element(), body: new Element() };
const context=vm.createContext({ window:{}, document, Phaser:{ Scene:class{}, Math:{Clamp:(n,min,max)=>Math.max(min,Math.min(max,n))} } });
vm.runInContext(fs.readFileSync('js/cenas/jogo.js','utf8'),context);
vm.runInContext(fs.readFileSync('js/cenas/titulo.js','utf8'),context);
const Scene=vm.runInContext('CenaJogo',context), Title=vm.runInContext('CenaTitulo',context);
const layout=vm.runInContext('LAYOUT_CAMPO_NORMAL',context);
const object=()=>({ active:true, setOrigin(){return this;},setText(value){this.text=value;return this;},setPosition(x,y){this.x=x;this.y=y;return this;},setAngle(value){this.angle=value;return this;}, add(value){this.children=value;return this;} });
const panels=[];
const game=Object.assign(Object.create(Scene.prototype),{
 multiplayer:{presentation:true,activePlayer:1,localNickname:'Ana',opponentNickname:'Bruno',remainingMs:()=>20000},
 partida:{jogador:{},inimigo:{},rodadasJogador:2,rodadasInimigo:1,turno:3,maxTurnos:7,calcularPoderTotal:()=>10},
 faseAtual:'habilidades', timerContainer:object(),timerTexto:object(),timerLabelTexto:object(),timerEstadoTexto:object(),timerBarra:{},
 layout,
 formatarTempoTurno:()=> '00:20',duracaoPermitidaPara:()=>40000,
 criarPlacaDuelo(x,y){const panel=object().setPosition(x,y);panels.push(panel);return panel;},
 criarTextoUI(x,y,text){return object().setText(text);},
});
game.desenharStatus();
assert.equal(panels.length,2);
assert.match(panels[0].children.text,/RODADAS.*2.*:.*1/);
assert.equal(panels[1].children.text,'HABILIDADES');
assert.deepEqual(panels.map(panel => panel.angle), [0, 0], 'Os painéis centrais apontam para o jogador 1.');
game.multiplayer.activePlayer=2;
game.desenharStatus();
assert.deepEqual(panels.slice(2).map(panel => panel.angle), [180, 180], 'Rodadas e fase giram para o jogador 2.');
game.timerContainer.setPosition(700,99).setAngle(0);
for (const phase of ['colocar','habilidades']) for (const player of [1,2]) {
 game.faseAtual=phase;game.multiplayer.activePlayer=player;game.atualizarVisualTimerTurno();
 assert.equal(game.timerEstadoTexto.text,`Vez de ${player===1?'Ana':'Bruno'}`);
 assert.equal(game.timerLabelTexto.text,phase==='habilidades'?'Habilidades':'Colocar cartas');
 assert.equal(game.timerContainer.angle,player===2?180:0, 'Painel de turno acompanha o jogador ativo.');
 assert.equal(game.timerContainer.y,99);
 assert.equal(game.timerBarra.displayWidth,185);
}
let left=0;
const title=Object.assign(Object.create(Title.prototype),{multiplayer:{leaveRoom(){left++;}},atualizarStatus(){}});
title.mostrarEsperaArena(2);
const waiting=title.telaEsperaArena;
assert.equal(waiting.className,'arena-waiting');
assert.equal(waiting.children[2].textContent,'Aguardando o outro jogador…');
waiting.children.at(-1).onclick();assert.equal(left,1);assert.equal(waiting.removed,true);

context.window.CYBERDUEL_TABLE = 1;
let showPresentation;
const response = { ok: true, room: { code: '123456', players: 0 },
 invitations: [{ player: 1 }, { player: 2 }], seats: [{ player: 1, connected: false }, { player: 2, connected: false }], nicknames: {} };
const titleEvents = new EventEmitter(), duelEvents = new EventEmitter();
let started;
Object.assign(title, { scene: { isActive: () => true, get: () => ({ events: duelEvents }), start: key => { started = key; } }, events: titleEvents, multiplayer: {
 createPresentation(show) { showPresentation = show; show(response); },
} });
title.montarApresentacao();
const presentation = document.body.children.at(-1);
const centralCode = presentation.children[1].children[1];
assert.equal(centralCode.textContent, 'CÓDIGO 123456', 'Código disponível desde a abertura.');
assert.ok(presentation.children[0].children.every(seat => seat.children[2].textContent === '123456'));
showPresentation({ ...response, room: { code: '123456', players: 1 } });
assert.equal(centralCode.textContent, 'CÓDIGO 123456', 'Entrar não esconde o código.');
title.multiplayer.onReady();
assert.equal(started, 'CenaJogo');
assert.equal(document.body.children.at(-1), presentation, 'Código não é movido para fora da espera.');
titleEvents.emit('shutdown');
assert.equal(presentation.removed, true, 'A espera e seu código saem quando o duelo começa.');
console.log('Mesa: HUD atual, fases, espera e código apenas antes do duelo validados.');
