const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
class Element {
  constructor() { this.children=[]; this.dataset={}; this.style={}; this.attributes={}; this.events={};
    this.classList = { add: name => { this.className += ` ${name}`; }, remove() {} }; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, handler) { this.events[name] = handler; }
  focus() { this.focused = true; }
  remove() { this.removed=true; }
}
const document = { createElement: () => new Element(), body: new Element(), events: {},
  addEventListener(name, handler) { this.events[name] = handler; },
  removeEventListener(name, handler) { if (this.events[name] === handler) delete this.events[name]; } };
const intervals = new Map();
let intervalId = 0;
const volumes = { musicVolume: .75, effectsVolume: .9 };
const context=vm.createContext({ window:{ cyberduelSettings: {
  get: key => volumes[key], set: (key, value) => { volumes[key] = value; }, applyDomTextScale() {},
} }, document, requestAnimationFrame: fn => fn(), setTimeout: fn => fn(), clearTimeout() {},
 setInterval(callback) { const id = ++intervalId; intervals.set(id, callback); return id; }, clearInterval(id) { intervals.delete(id); },
 Phaser:{ Scene:class{}, Math:{Clamp:(n,min,max)=>Math.max(min,Math.min(max,n))} } });
vm.runInContext(fs.readFileSync('js/title-ui.js','utf8'),context);
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
const rain = presentation.children[0];
assert.equal(rain.className, 'title-matrix');
assert.equal(rain.children.length, 24, 'A apresentação reutiliza a chuva de letras do menu.');
const initialText = rain.children[0].children[0].textContent;
intervals.get(2)();
assert.notEqual(rain.children[0].children[0].textContent, initialText);
const centralCode = presentation.children[2].children[1];
assert.equal(centralCode.textContent, 'CÓDIGO 123456', 'Código disponível desde a abertura.');
assert.ok(presentation.children[1].children.every(seat => seat.children[2].textContent === '123456'));
const audioButton = presentation.children[2].children[0].children[0];
assert.equal(audioButton.attributes['aria-label'], 'Ajustar volume da apresentação');
audioButton.onclick();
const modal = presentation.children.at(-1);
assert.equal(modal.children[0].attributes['aria-label'], 'Áudio da apresentação');
const controls = modal.children[0].children[3].children;
assert.equal(controls.length, 2, 'A apresentação contém apenas música e efeitos.');
const [music, effects] = controls.map(row => row.children[1]);
assert.deepEqual([music.value, effects.value], ['75', '90']);
music.value = '67'; music.events.input();
effects.value = '0'; effects.events.input();
assert.deepEqual(volumes, { musicVolume: .67, effectsVolume: 0 });
assert.equal(controls[0].children[0].children[1].textContent, '67%');
assert.equal(controls[1].children[0].children[1].textContent, '0%');
document.events.keydown({ key: 'Escape' });
assert.equal(modal.removed, true);
assert.equal(audioButton.focused, true, 'Fechar devolve o foco ao nome CYBERDUEL.');
audioButton.onclick();
assert.equal(presentation.children.at(-1).children[0].children[3].children[0].children[1].value, '67');
showPresentation({ ...response, serverNow: Date.now(), seats: [{ player: 1, reservedUntil: Date.now() + 60_000 }, response.seats[1]] });
assert.match(presentation.children[1].children[0].children[0].textContent, /RESERVADO · 60s/);
showPresentation({ ...response, room: { code: '123456', players: 1 } });
assert.equal(centralCode.textContent, 'CÓDIGO 123456', 'Entrar não esconde o código.');
title.multiplayer.onReady();
assert.equal(started, 'CenaJogo');
assert.equal(document.body.children.at(-1), presentation, 'Código não é movido para fora da espera.');
titleEvents.emit('shutdown');
assert.equal(presentation.removed, true, 'A espera e seu código saem quando o duelo começa.');
assert.equal(intervals.size, 0, 'A chuva para de atualizar ao sair da apresentação.');
assert.equal(document.events.keydown, undefined, 'Sair da espera remove o atalho do modal de áudio.');
console.log('Mesa: HUD atual, fases, espera e código apenas antes do duelo validados.');
console.log('Áudio da apresentação: acesso pelo nome, sliders independentes, zero, fechamento e limpeza aprovados.');
