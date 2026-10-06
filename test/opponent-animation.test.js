const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ window: {}, Phaser: { Scene: class {} },
  LARGURA_LAYOUT: 1080, ALTURA_LAYOUT: 2220, Y_MAO_INIMIGO: 230, Y_MAO_JOGADOR: 1900,
  TIPOS_EFEITO: { ARMADILHA_ESPACO: 'armadilha', SILENCIAR_CARTA: 'silenciar_carta', BONUS_POR_TERRENOS: 'bonus_por_terrenos' },
});
vm.runInContext(fs.readFileSync('js/cenas/efeitos.js', 'utf8'), context);
const Scene = context.window.CenaEfeitos;
function fixture(spectator = false) {
  const tasks = [], objects = [], tweens = [], impacts = [], sounds = [];
  let time = 0;
  const schedule = (delay, fn) => tasks.push({ at: time + delay, fn });
  const object = (type, x, y, value) => {
    const o = { type, x, y, value, active: true, visible: true, width: 512, height: 768,
      get displayWidth() { return this.width * (this.scaleX ?? 1); },
      get displayHeight() { return this.height * (this.scaleY ?? 1); },
      setPosition(x,y) { this.x=x; this.y=y; return this; },
      setMute() { return this; }, once(event, fn) { (this.handlers ||= {})[event]=fn; return this; },
      play() { this.handlers?.created?.(); return this; },
      setDisplaySize(w,h) { this.width=w; this.height=h; return this; },
      setCrop(...crop) { this.crop=crop; return this; },
      setStrokeStyle(width, color) { this.strokeColor=color; return this; }, setOrigin() { return this; },
      setAlpha(v) { this.alpha=v; return this; }, setSize() { return this; },
      setInteractive() { return this; }, on() { return this; },
      setVisible(v) { this.visible=v; return this; }, setDepth() { return this; },
      setScale(x,y=x) { this.scaleX=x; this.scaleY=y; return this; }, setAngle(v) { this.angle=v; return this; },
      add(children) { this.value.push(...children); return this; },
      destroy() { this.active=false; if(Array.isArray(this.value)) this.value.forEach(c=>c.destroy()); },
    };
    objects.push(o); return o;
  };
  const source = { id: 1, nome: 'Teste', imagem: 'arte', indice: 0 };
  const fieldObject = object('field', 110, 560); fieldObject.dadosCartaCampo=source;
  const s = Object.assign(Object.create(Scene.prototype), {
    fila: [], ultimoEvento: 0, exibidos: [], executando: false,
    jogo: { multiplayer: { spectator }, layout: { slotW: 195, slotH: 270,
      x: [110,325,540,755,970], yInimigo: [560,842], yJogador: [1436,1154] },
      partida: { inimigo: { campo: { cartas: [source] } }, jogador: { campo: { cartas: [] } } },
      children: { list: [fieldObject] } },
    add: Object.fromEntries(['image','rectangle','text','circle','ellipse','triangle','container','video'].map(type=>[type,(...args)=>object(type,...args)])),
    sound: { play: key => sounds.push(key) },
    textures: { exists:()=>true }, cache: { audio: { exists:()=>false }, video: { exists:()=>false } },
    time: { delayedCall: schedule },
    tweens: { add(config) {
      tweens.push(config);
      schedule((config.delay||0)+config.duration*(config.yoyo?2:1),()=>{
        for(const k of ['x','y','alpha','scaleX','scaleY','progresso']) if(config[k]!==undefined) config.targets[k]=config[k];
        config.onUpdate?.();
        config.onComplete?.();
      });
    } },
  });
  const original = s.animarFonte;
  s.animarFonte = (event, source, keep, callback) => original.call(s,event,source,keep,()=>{impacts.push(event.id);callback();});
  return { s, source, fieldObject, objects, tweens, impacts, sounds,
    getTime() { return time; },
    step() { tasks.sort((a,b)=>a.at-b.at); const next=tasks.shift(); if(!next)return false; time=next.at; next.fn(); s.update(); return true; },
    flush() { let n=0; while(this.step()) assert.ok(++n<200); },
    event(id, momento, extra={}) { return {id,lado:'inimigo',momento,fonte:{...source},alvos:[],...extra}; },
  };
}
// Invocação voa da mão ao campo, sobrevive ao redesenho e restaura a carta no impacto.
{
  const f=fixture(), event=f.event(1,'invocacao');
  f.s.receber([event]);
  assert.equal(f.fieldObject.visible,false);
  const fly=f.tweens[0];
  assert.equal(fly.targets.y,230); assert.equal(fly.x,110); assert.equal(fly.y,560);
  const replacement={...f.fieldObject,visible:true}; f.s.jogo.children.list=[replacement]; f.s.update();
  assert.equal(replacement.visible,false);
  f.s.receber([event]);
  f.flush();
  assert.equal(replacement.visible,true);
  assert.deepEqual(Array.from(f.s.exibidos),[1]);
  assert.deepEqual(f.impacts,[1]);
  assert.equal(f.s.executando,false);
  assert.ok(f.objects.filter(o=>o.type==='container').every(o=>!o.active));
}
// Duas invocações no mesmo estado ficam ocultas até seus respectivos impactos.
for (const separado of [false, true]) {
  const f=fixture(), segunda={...f.source,id:2,indice:1};
  const segundoObjeto={...f.fieldObject,dadosCartaCampo:segunda};
  f.s.jogo.partida.inimigo.campo.cartas.push(segunda);
  f.s.jogo.children.list.push(segundoObjeto);
  const eventos=[f.event(1,'invocacao'),f.event(2,'invocacao',{fonte:segunda})];
  if(separado) f.s.receber([eventos[0]]);
  f.s.receber(eventos);
  assert.equal(f.fieldObject.visible,false);
  assert.equal(segundoObjeto.visible,false,'Carta na fila não aparece antes de voar.');
  // Um snapshot substitui as instâncias das cartas durante a animação.
  const novas=[{...f.source},{...segunda}];
  f.s.jogo.partida.inimigo.campo.cartas=novas;
  f.s.jogo.children.list.forEach((o,i)=>{o.dadosCartaCampo=novas[i];});
  assert.equal(f.s.deveOcultarCarta(novas[1]),true);
  while(!f.impacts.length) assert.ok(f.step());
  assert.equal(f.fieldObject.visible,true);
  assert.equal(segundoObjeto.visible,false,'Primeiro impacto não revela a segunda carta.');
  f.flush();
  assert.equal(segundoObjeto.visible,true);
  assert.deepEqual(f.impacts,[1,2]);
}
// Encerrar a camada restaura também as invocações que ainda aguardam na fila.
{
  const f=fixture(), segunda={...f.source,id:2,indice:1};
  const segundoObjeto={...f.fieldObject,dadosCartaCampo:segunda};
  f.s.jogo.partida.inimigo.campo.cartas.push(segunda);
  f.s.jogo.children.list.push(segundoObjeto);
  f.s.receber([f.event(1,'invocacao'),f.event(2,'invocacao',{fonte:segunda})]);
  f.s.cancelarInvocacoesPendentes();
  assert.equal(f.fieldObject.visible,true);
  assert.equal(segundoObjeto.visible,true);
  assert.equal(f.s.invocacoesPendentes.size,0);
}
// Uma conjuração sem alvos também exibe a carta; a habilidade seguinte aguarda a fila.
{
  const f=fixture();
  f.s.receber([f.event(1,'conjuracao',{fonte:{...f.source,indice:-1}}),f.event(2,'habilidade')]);
  assert.equal(f.tweens[0].x,540); assert.equal(f.tweens[0].y,1110);
  assert.deepEqual(f.impacts,[]);
  assert.ok(f.objects.some(o=>o.type==='text'&&o.value==='Teste'));
  f.flush();
  assert.deepEqual(f.impacts,[1,2]);
  assert.deepEqual(Array.from(f.s.exibidos),[1,2]);
  assert.ok(f.tweens.some(t=>t.y===495), 'Habilidade destaca a carta de origem.');
}
// Não expõe nome/arte de cartas ocultas e não duplica conjuração local já animada na cena de jogo.
{
  const f=fixture();
  f.s.receber([f.event(1,'invocacao',{fonte:{...f.source,oculto:true}})]);
  assert.ok(!f.objects.some(o=>o.value==='arte'||o.value==='Teste'));
  f.flush();
  const local=fixture(); local.s.receber([local.event(1,'conjuracao',{lado:'jogador'})]);
  assert.equal(local.objects.filter(o=>o.eventoApresentado === 1).length,1);
  local.flush();
  const spectator=fixture(true); spectator.s.receber([spectator.event(1,'conjuracao',{lado:'jogador'})]);
  assert.equal(spectator.tweens[0].targets.y,1900);
  spectator.flush();
}
// Encerrar a camada durante um voo não deixa a carta do campo invisível.
{
  const f=fixture(); f.s.receber([f.event(1,'invocacao')]);
  f.s.restaurarCartaEmTransito(); assert.equal(f.fieldObject.visible,true);
}
console.log('Animações do oponente: voo, conjuração, habilidade, fila, redesenho, sigilo e perspectiva validados.');

// Os símbolos seguem o efeito, preservam a proporção e são destruídos ao concluir.
for (const [name, texture, moment] of [
  ['A Aranha', 'efeitoAranha', 'habilidade'], ['O Boi', 'efeitoBoi', 'habilidade'],
  ['A Cabra', 'efeitoCabra', 'habilidade'], ['O Cão', 'efeitoCao', 'passiva'],
  ['O Trotar do Cavalo', 'efeitoCavalo', 'conjuracao'],
  ['A Cobra', 'efeitoCobra', 'veneno'], ['A Toca do Coelho', 'efeitoCoelho', 'invocacao'],
  ['O Canto do Galo', 'efeitoGalo', 'conjuracao'], ['A Travessura do Macaco', 'efeitoMacaco', 'armadilha'],
  ['O Porco', 'efeitoPorco', 'protecao'], ['O Rato', 'efeitoRato', 'habilidade'],
  ['O Tigre', 'efeitoTigre', 'habilidade'],
]) {
  for (const side of ['jogador', 'inimigo']) {
    const f = fixture();
    f.s.receber([f.event(1, moment, { lado: side, fonte: { ...f.source, nome: name }, alvos: [{ lado: side === 'jogador' ? 'inimigo' : 'jogador', indice: 5, id: 2, delta: -1, capturada: true }] })]);
    f.flush();
    const symbols = f.objects.filter(o => o.type === 'image' && o.value === texture);
    assert.equal(symbols.length, 1, `${name}: um símbolo por evento, ${side}`);
    assert.equal(symbols[0].active, false, 'Liberar o símbolo após o efeito.');
    assert.ok(Number.isFinite(symbols[0].scaleX));
    assert.equal(symbols[0].scaleX, symbols[0].scaleY, 'Preservar a proporção.');
  }
}
{
  const hidden = fixture();
  hidden.s.receber([hidden.event(1, 'invocacao', { fonte: { ...hidden.source, nome: 'A Toca do Coelho', oculto: true } })]);
  hidden.flush();
  assert.ok(!hidden.objects.some(o => o.value === 'efeitoCoelho'), 'Não revelar a identidade de fonte oculta.');
  const inactive = fixture();
  inactive.s.receber([inactive.event(1, 'invocacao', { fonte: { ...inactive.source, nome: 'A Aranha' } })]);
  inactive.flush();
  assert.ok(!inactive.objects.some(o => o.value === 'efeitoAranha'), 'Habilidade ativa não dispara na invocação.');
  const learned = fixture();
  learned.s.receber([learned.event(1, 'habilidade', { fonte: { ...learned.source, habilidadeAprendidaDe: 'O Tigre' }, alvos: [{ lado: 'jogador', indice: 5, id: 2, delta: -3 }] })]);
  learned.flush();
  assert.equal(learned.objects.filter(o => o.value === 'efeitoTigre').length, 1);
}
console.log('EchoSsystem: 12 símbolos, gatilhos, perspectiva, proporção, limpeza, sigilo e habilidade aprendida validados.');

// O turno só é liberado quando o último efeito remoto termina.
vm.runInContext(fs.readFileSync('js/cenas/jogo.js', 'utf8'), context);
const Game = vm.runInContext('CenaJogo', context);
for (const multiplayerAtivo of [false, true]) {
  const f = fixture();
  let starts = 0, passes = 0;
  const game = Object.assign(Object.create(Game.prototype), {
    scene: { manager: { keys: { CenaEfeitos: f.s } } },
    partida: { fase: 'colocar', jogador: {}, inimigo: {} },
    multiplayerAtivo, multiplayer: { player: 1, initialized: true, remainingMs: () => 30000,
      finishTurn() { passes++; } },
    soloStep: 0, soloStarter: 2, ehMeuTurno: false, faseAtual: 'colocar',
    proximaAtualizacaoAuras: Infinity, prazoFaseLocal: Date.now() + 30000,
    desenharInterface() {}, atualizarVisualTimerTurno() {},
    iniciarNovoTurnoDoJogador() { starts++; this.ehMeuTurno = true; },
    desenharRodaBotoes() {}, mostrarEsperaMultiplayer() {},
    encerrarSelecoesDaFase() {}, pausarTimerAteProximoTurno() {},
  });
  f.s.receber([f.event(1, 'invocacao'), f.event(2, 'habilidade')]);
  if (multiplayerAtivo) game.finalizarRecebimentoMultiplayer(null, { activePlayer: 1, phase: 'colocar' }, false);
  else game.avancarFaseSolo();
  assert.equal(game.ehMeuTurno, false);
  assert.equal(starts, 0);
  // Mesmo um controle com estado antigo não permite comandos durante a fila.
  game.ehMeuTurno = true; game.travado = false;
  assert.equal(game.podeJogarCartasAgora(), false);
  game.faseAtual = 'habilidades';
  assert.equal(game.podeUsarHabilidadesAgora(), false);
  game.aoClicarPassarTurno();
  assert.equal(passes, 0);
  game.ehMeuTurno = false; game.faseAtual = 'colocar';
  while (f.s.exibidos.length < 2) assert.ok(f.step());
  game.update(0);
  assert.equal(starts, 0, 'O segundo efeito ainda bloqueia a vez.');
  if (multiplayerAtivo) {
    game.finalizarRecebimentoMultiplayer(null, { activePlayer: 2, phase: 'habilidades' }, false);
    game.finalizarRecebimentoMultiplayer(null, { activePlayer: 1, phase: 'habilidades' }, false);
  }
  f.flush(); game.update(0);
  assert.equal(starts, 1);
  assert.equal(game.ehMeuTurno, true);
  assert.equal(game.travado, false);
  assert.equal(game.turnoAposEfeitos, null);
  if (multiplayerAtivo) assert.equal(game.faseAtual, 'habilidades', 'Usa a atualização mais recente.');
  game.update(0);
  assert.equal(starts, 1, 'Não inicia a mesma vez duas vezes.');
}
console.log('Turno aguarda todos os efeitos remotos no solo e multiplayer; comandos bloqueados e atualização mais recente preservada.');

// Sigilo do espaço da armadilha e símbolos nos alvos, nunca na origem do roubo.
for (const side of ['jogador', 'inimigo']) {
  const f = fixture();
  f.s.receber([f.event(1, 'conjuracao', { lado: side,
    fonte: { ...f.source, nome: 'A Travessura do Macaco', efeito: { tipo: 'armadilha' } },
    alvos: [{ lado: side === 'jogador' ? 'inimigo' : 'jogador', indice: 7, armadilha: true }] })]);
  f.flush();
  assert.equal(f.objects.filter(o => o.value === 'efeitoMacaco').length, side === 'jogador' ? 1 : 0);
}
{
  const f = fixture();
  f.s.receber([f.event(1, 'habilidade', { fonte: { ...f.source, nome: 'O Rato' },
    alvos: [{ lado: 'inimigo', indice: 0, id: 1, delta: 1 }, { lado: 'jogador', indice: 7, id: 2, delta: -1 }] })]);
  f.flush();
  const marks = f.objects.filter(o => o.value === 'efeitoRato');
  assert.equal(marks.length, 1);
  assert.equal(marks[0].x, 540); assert.equal(marks[0].y, 1154);
  assert.deepEqual(marks[0].crop, [0, 0, 512, 768], 'Pichação revela toda a arte.');
}
for (const name of ['O Cão', 'O Porco', 'A Cobra']) {
  const f = fixture();
  f.s.receber([f.event(1, name === 'A Cobra' ? 'habilidade' : 'passiva', { fonte: { ...f.source, nome: name } })]);
  f.flush();
  assert.ok(!f.objects.some(o => /^efeito/.test(o.value)), 'Não disparar símbolo antes do gatilho real.');
}
{
  const f = fixture();
  f.s.receber([f.event(1, 'habilidade', { fonte: { ...f.source, nome: 'O Rato' },
    alvos: [{ lado: 'jogador', indice: 5, id: 2, delta: 0, cascaGrossa: true }] })]);
  f.flush();
  assert.ok(f.objects.some(o => o.value === 'efeitoPorco'));
}
// Dono vê a face; adversário e espectador veem o verso. Revelação elimina a ocultação.
for (const spectator of [false, true]) for (const revelada of [false, true]) {
  const f = fixture(spectator), calls = [];
  const card = { id: 9, ocultadaPelaToca: true, revelada };
  const cards = Array(10).fill(null); cards[0] = card;
  const game = Object.assign(Object.create(Game.prototype), {
    multiplayer: { spectator, presentation: true }, layout: f.s.jogo.layout,
    partida: { jogador: { campo: { cartas: cards } }, inimigo: { campo: { cartas: cards, armadilhas: new Set() } } },
    add: f.s.add, criarCartaDeCampo(...args) { calls.push(args); },
  });
  game.desenharCampoJogador(); game.desenharCampoInimigo();
  assert.equal(calls[0][4], spectator && !revelada);
  assert.equal(calls[1][4], !revelada);
}
console.log('Echossystem: pichação no alvo, gatilhos, Casca Grossa, armadilha privada e Toca por perspectiva validados.');

for (const [name, video, sound] of [['A Aranha', 'videoEfeitoAranha', 'somAranha'], ['O Boi', 'videoEfeitoBoi', 'somBoi']]) {
  const f = fixture(); f.s.cache.video.exists = () => true; f.s.cache.audio.exists = () => true;
  f.s.receber([f.event(1, 'habilidade', { fonte: { ...f.source, nome: name },
    alvos: [{ lado: 'jogador', id: 2, indice: 5, capturada: true }] })]);
  f.flush();
  const clip = f.objects.find(o => o.type === 'video' && o.value === video);
  assert.ok(clip); assert.equal(clip.active, false);
  assert.equal(clip.x, 540); assert.equal(clip.y, 1110);
  assert.ok(f.sounds.includes(sound));
}
{
  const f = fixture(); f.s.cache.audio.exists = () => true;
  const target = f.fieldObject; target.dadosCartaCampo.id = 8;
  f.s.receber([f.event(1, 'conjuracao', { lado: 'jogador', fonte: { ...f.source, nome: 'O Trotar do Cavalo' },
    alvos: [{ lado: 'inimigo', id: 8, indice: 0, delta: -3 }] })]);
  f.flush();
  assert.ok(f.tweens.some(t => t.targets === target && t.repeat === 3 && t.yoyo));
  assert.equal(target.x, 110); assert.ok(f.sounds.includes('somCavalo'));
}
console.log('Vídeos da Aranha/Boi, sons próprios, tremor do Cavalo e limpeza validados.');

for (const [nome, texto] of [['O Boi', 'PA restaurado'], ['O Porco', 'PA protegido']]) {
  const f = fixture();
  f.s.receber([f.event(1, nome === 'O Boi' ? 'habilidade' : 'protecao', {
    fonte: { ...f.source, nome }, alvos: [{ lado: 'jogador', id: 8, indice: 5, delta: 0, bloqueado: true }],
  })]);
  f.flush();
  assert.ok(f.objects.some(o => o.type === 'text' && o.value === texto));
}

{
  const f = fixture();
  f.s.receber([f.event(1, 'conjuracao', { fonte: { ...f.source, nome: 'O Trotar do Cavalo' },
    alvos: [{ lado: 'jogador', id: 8, indice: 5, delta: -3, removida: true, imagem: 'arte' }] })]);
  f.flush();
  const ghost = f.objects.find(o => o.type === 'image' && o.value === 'arte' && o.width === 170);
  assert.ok(f.tweens.some(t => t.targets === ghost && t.repeat === 3 && t.yoyo));
  assert.equal(ghost.active, false, 'A carta removida também treme e desaparece.');
}

// Face, selo de PA e coelhinho convivem no mesmo container; a marca da Aranha acompanha o vínculo.
for (const captured of [false, true]) {
  const f = fixture(), own = { id: 9, imagem: 'arte', poder: 5, tipo: 'monstro', ocultadaPelaToca: true, revelada: false,
    capturadaPor: captured ? {} : null };
  const game = Object.assign(Object.create(Game.prototype), {
    add: f.s.add, textures: f.s.textures, tweens: f.s.tweens, multiplayer: {},
    partida: { jogador: { campo: { cartas: [own] } }, inimigo: { campo: { cartas: [] } } },
    renderizandoInterface: true, interfaceJaDesenhada: true, chavesCampoNovasRender: new Set(),
    obterCorPorId: () => 0, chaveCartaMultiplayer: c => c.id,
    criarSeloEstat: () => [f.s.add.circle(0,0,5), f.s.add.text(0,0,'5')],
  });
  game.criarCartaDeCampo(100, 100, own, f.s.jogo.layout, false, true);
  assert.ok(f.objects.some(o => o.value === 'arte'));
  assert.ok(f.objects.some(o => o.value === '5'));
  assert.ok(f.objects.some(o => o.indicadorToca && o.type === 'container' && o.value.length === 8));
  assert.equal(f.objects.filter(o => o.value === 'efeitoAranha').length, captured ? 1 : 0);
}
{
  const f = fixture();
  Game.prototype.criarIndicadorArmadilha.call({ add: f.s.add }, 100, 200, f.s.jogo.layout);
  assert.ok(f.objects.some(o => o.value === 'efeitoMacaco' && o.x === 100 && o.y === 200));
}
console.log('Marcadores persistentes, face e PA do dono e coelhinho validados.');

// Os vídeos de habilidades não devem disparar ao invocar a Aranha ou o Boi.
for (const nome of ['A Aranha', 'O Boi']) {
  const f = fixture(); f.s.cache.video.exists = () => true;
  f.s.receber([f.event(1, 'invocacao', { fonte: { ...f.source, nome } })]);
  f.flush();
  assert.ok(!f.objects.some(o => o.type === 'video'), `${nome}: vídeo somente na habilidade.`);
}
console.log('Vídeos de habilidade não disparam na invocação.');

// Na mesa, arte e PA acompanham o dono; girar o container durante efeitos não altera o conteúdo.
for (const presentation of [false, true]) for (const side of ['jogador', 'inimigo']) {
  const f = fixture();
  const card = { id: 90, imagem: 'arte', nome: 'Teste de orientação', poder: 7, tipo: 'monstro' };
  const game = Object.assign(Object.create(Game.prototype), {
    add: f.s.add, textures: f.s.textures, tweens: f.s.tweens, multiplayer: { presentation },
    partida: { jogador: { campo: { cartas: side === 'jogador' ? [card] : [] } },
      inimigo: { campo: { cartas: side === 'inimigo' ? [card] : [] } } },
    renderizandoInterface: true, interfaceJaDesenhada: true, chavesCampoNovasRender: new Set(),
    obterCorPorId: () => 0, chaveCartaMultiplayer: c => c.id,
    criarSeloEstat: (x, y, power) => [f.s.add.circle(x,y,5), f.s.add.text(x,y,String(power))],
  });
  game.criarCartaDeCampo(100, 100, card, f.s.jogo.layout);
  const art = f.objects.find(o => o.value === 'arte');
  const power = f.objects.find(o => o.value === '7');
  const angle = presentation && side === 'inimigo' ? 180 : 0;
  assert.equal(art.angle || 0, angle);
  assert.equal(power.angle || 0, angle);
  assert.equal(power.y, angle ? -85 : 85, 'PA permanece na borda inferior da carta para seu dono.');
  const container = f.objects.find(o => o.dadosCartaCampo === card);
  container.setAngle(0);
  assert.equal(art.angle || 0, angle, 'Animação externa não reinverte a arte.');
  assert.equal(power.angle || 0, angle);
  const hidden = { ...card, id: 91 };
  game.partida[side].campo.cartas = [hidden];
  game.criarCartaDeCampo(100, 100, hidden, f.s.jogo.layout, true);
  assert.equal(f.objects.find(o => o.value === 'fundoCarta').angle || 0, angle);
}
for (const presentation of [false, true]) for (const side of ['jogador', 'inimigo']) {
  const f = fixture(true);
  f.s.jogo.multiplayer.presentation = presentation;
  f.s.receber([f.event(1, 'invocacao', { lado: side,
    alvos: [{ lado: side, id: 8, indice: 0, delta: 2 }] })]);
  f.flush();
  const angle = presentation && side === 'inimigo' ? 180 : 0;
  const front = f.objects.find(o => o.type === 'container' && o.value.some(child => child.value === 'arte'));
  assert.equal(front.angle || 0, angle);
  assert.equal(f.objects.find(o => o.value === 'fundoCarta').angle || 0, angle);
  assert.equal(f.objects.find(o => o.value === '+2 PA').angle || 0, angle);
}
console.log('Mesa: arte, verso, PA, invocação e números dos efeitos orientados para cada dono; demais modos preservados.');

// Novos sons: mesmo gatilho para dono, oponente e espectador; fila não repete evento.
const newSounds = [
  ['CyberVendedor da RaspCorp', 'habilidade', 'somCyberVendedor'],
  ['IA de treinamento', 'invocacao', 'somInteracao'],
  ['HAL 9001', 'habilidade', 'somHal'],
  ['H.A.R.V.I.S', 'invocacao', 'somHarvis'],
  ['Replicantes', 'continuo', 'somReplicantes'],
  ['Dragão das Comunicações Móveis', 'despertar', 'somDragao'],
  ['DeepClaude ChatGemini', 'habilidade', 'somDeepClaude'],
  ['Bug na Matrix', 'invocacao', 'somBug'],
  ['Você Parece Sozinho', 'conjuracao', 'somLonely'],
];
for (const [name, moment, key] of newSounds) for (const side of ['jogador', 'inimigo']) for (const spectator of [false, true]) {
  const f = fixture(spectator);
  f.s.cache.audio.exists = () => true;
  f.s.cache.audio.get = sound => ({ duration: sound === key ? 5 : 0 });
  const event = f.event(1, moment, { lado: side, fonte: { ...f.source, nome: name },
    alvos: [{ lado: side, id: f.source.id, indice: 0, delta: 3 }] });
  f.s.receber([event]); f.s.receber([event]);
  f.flush();
  assert.equal(f.sounds.filter(s => s === key).length, 1, `${name}, ${side}, espectador ${spectator}`);
  assert.ok(f.getTime() >= 5000, 'A fila espera a duração do som.');
  if (moment !== 'invocacao') {
    const inactive = fixture(); inactive.s.cache.audio.exists = () => true;
    inactive.s.receber([inactive.event(1, 'invocacao', { fonte: { ...inactive.source, nome: name } })]);
    inactive.flush(); assert.ok(!inactive.sounds.includes(key), `${name}: som somente no gatilho correto.`);
  }
  const hidden = fixture(true); hidden.s.cache.audio.exists = () => true;
  hidden.s.receber([hidden.event(1, moment, { fonte: { ...hidden.source, nome: name, oculto: true } })]);
  hidden.flush(); assert.ok(!hidden.sounds.includes(key), 'Som não revela a identidade de carta oculta ao espectador.');
}
{
  const f = fixture(); f.s.cache.audio.exists = () => true;
  f.s.receber([f.event(1, 'continuo', { fonte: { ...f.source, nome: 'Replicantes' },
    alvos: [{ lado: 'jogador', id: f.source.id, indice: 0, delta: -3 }] })]);
  f.flush(); assert.ok(!f.sounds.includes('somReplicantes'), 'Perder bônus não toca o anúncio de ganho.');
}
{
  const f = fixture(); f.s.cache.audio.exists = () => true;
  f.s.receber([f.event(1, 'habilidade', { fonte: { ...f.source, nome: 'O Tigre' },
    alvos: [{ lado: 'inimigo', id: 1, indice: 0, delta: -3 }, { lado: 'inimigo', id: 2, indice: 1, delta: -3 }] })]);
  f.flush();
  for (const key of ['somTigreInvestida', 'somTigreAtaque', 'somTigre']) assert.equal(f.sounds.filter(s => s === key).length, 1);
}
console.log('Nove sons de cartas, gatilhos, perspectivas, áudio único, duração da fila e investida/garras do Tigre validados.');

// Cores e alvos definidos no documento, inclusive custo do Estagiário e transferência do GRPH.
for (const [name, alvos] of [
  ['CyberVendedor da RaspCorp', [{ lado: 'jogador', id: 2, indice: 5, delta: 1 }]],
  ['Estagiário de Machine Learning', [{ lado: 'inimigo', id: 1, indice: 0, delta: -1 }, { lado: 'jogador', id: 2, indice: 5, delta: 3 }]],
  ['Gestor de Recursos Predominantemente Humanos', [{ lado: 'jogador', id: 2, indice: 5, delta: -2 }, { lado: 'jogador', id: 3, indice: 6, delta: 4 }]],
]) {
  const f = fixture();
  f.s.receber([f.event(1, 'habilidade', { fonte: { ...f.source, nome: name }, alvos })]);
  f.flush();
  for (const alvo of alvos) {
    const point = f.s.ponto(alvo.lado, alvo.indice);
    assert.ok(f.objects.some(o => o.type === 'rectangle' && o.x === point.x && o.y === point.y &&
      o.strokeColor === (alvo.delta < 0 ? 0xff526c : 0x69caff)), `${name}: cor do alvo ${alvo.id}`);
  }
  if (name === 'CyberVendedor da RaspCorp')
    assert.ok(!f.objects.some(o => o.type === 'rectangle' && o.x === 110 && o.y === 560 && o.strokeColor === 0x69caff));
}
for (const side of ['jogador', 'inimigo']) {
  const f = fixture(true); f.s.jogo.multiplayer.presentation = true;
  f.s.receber([f.event(1, 'invocacao', { lado: side, fonte: { ...f.source, nome: 'IA de treinamento' } })]);
  f.flush();
  const sprite = f.objects.find(o => o.value === 'iaTutorial14');
  assert.ok(sprite); assert.equal(sprite.angle, side === 'inimigo' ? 180 : 0);
  assert.equal(sprite.x, side === 'inimigo' ? 160 : 920);
  assert.equal(sprite.active, false);
}
for (const ganho of [false, true]) {
  const f = fixture(); f.s.cache.video.exists = () => true; f.s.cache.audio.exists = () => true;
  f.s.receber([f.event(1, 'inicio_turno', { fonte: { ...f.source, nome: 'CryptoAcionistas' },
    alvos: [{ lado: 'inimigo', id: 1, indice: 0, delta: ganho ? 2 : 0 }] })]);
  const clip = f.objects.find(o => o.value === 'videoEfeitoCrypto');
  assert.equal(!!clip, ganho);
  assert.equal(f.sounds.includes('somCryptoAcionistas'), ganho);
  if (ganho) {
    assert.equal(clip.x, 110); assert.equal(clip.y, 560);
    while (f.getTime() < 1700) f.step();
    assert.equal(f.s.executando, true, 'A fila não corta um vídeo que ainda está tocando.');
    clip.handlers.complete();
    assert.equal(f.s.executando, false);
  }
  f.flush();
}
for (const side of ['jogador', 'inimigo']) for (const removed of [false, true]) {
  const f = fixture(); f.s.cache.audio.exists = () => true;
  f.s.cache.audio.get = () => ({ duration: 5 });
  f.s.jogo.multiplayer.presentation = true;
  const targetSide = side === 'jogador' ? 'inimigo' : 'jogador';
  f.s.receber([f.event(1, 'habilidade', { lado: side, fonte: { ...f.source, nome: 'UCC "Juggernaut"' },
    alvos: [{ lado: targetSide, id: 2, indice: 3, delta: -5, removida: removed, imagem: 'vitima' }] })]);
  const victim = f.objects.find(o => o.value === 'vitima');
  assert.equal(!!victim, removed);
  if (removed) assert.equal(victim.active, true, 'A vítima permanece visível antes do impacto.');
  while (!f.objects.some(o => o.value === 'efeitoJuggernaut')) assert.ok(f.step());
  const start = f.getTime(), impact = f.objects.find(o => o.value === 'efeitoJuggernaut');
  assert.equal(impact.x, 755); assert.equal(impact.y, targetSide === 'inimigo' ? 560 : 1436);
  assert.equal(impact.angle, targetSide === 'inimigo' ? 180 : 0);
  assert.ok(!f.tweens.some(t => t.targets === victim && t.alpha === 0), 'Sem saída antecipada.');
  while (f.s.executando) {
    if (removed) assert.equal(victim.active, true);
    assert.ok(f.step());
  }
  assert.equal(f.getTime() - start, 200, 'Impacto termina em 200 ms, independente do áudio.');
  assert.equal(impact.active, false);
  if (removed) assert.equal(victim.active, false, 'A vítima sai junto com o fim do impacto.');
  f.flush();
}
{
  const f = fixture(true);
  f.s.receber([f.event(1, 'habilidade', { lado: 'jogador', fonte: { ...f.source, nome: 'UCC "Juggernaut"' },
    alvos: [{ lado: 'inimigo', id: 2, indice: 3, delta: -5, removida: true, oculto: true, imagem: 'secreta' }] })]);
  assert.ok(f.objects.some(o => o.value === 'fundoCarta'));
  assert.ok(!f.objects.some(o => o.value === 'secreta'), 'O impacto preserva o verso da vítima oculta.');
  f.flush();
}
// Cadeado do HAL acompanha o estado atual; os Replicantes contornam terrenos de ambos os campos.
for (const active of [false, true]) for (const side of ['jogador', 'inimigo']) {
  const f = fixture(), terrain = { id: 8, tipo: 'terreno', imagem: 'arte', poder: 0 };
  const target = { id: 9, tipo: 'monstro', imagem: 'arte', poder: 7, efeitoDesabilitado: active,
    fonteSupressao: { efeito: { tipo: 'silenciar_carta' } } };
  const rep = { id: 10, tipo: 'monstro', efeito: active ? { tipo: 'bonus_por_terrenos' } : null };
  f.s.jogo.partida[side].campo.cartas = [terrain, target];
  f.s.jogo.partida[side === 'jogador' ? 'inimigo' : 'jogador'].campo.cartas = [rep];
  const game = Object.assign(Object.create(Game.prototype), {
    add: f.s.add, textures: f.s.textures, tweens: f.s.tweens, multiplayer: {}, partida: f.s.jogo.partida,
    renderizandoInterface: true, interfaceJaDesenhada: true, chavesCampoNovasRender: new Set(),
    obterCorPorId: () => 0, chaveCartaMultiplayer: c => c.id,
    criarSeloEstat: () => [f.s.add.circle(0,0,5), f.s.add.text(0,0,'7')],
  });
  for (const card of [terrain, target]) game.criarCartaDeCampo(100, 100, card, f.s.jogo.layout);
  assert.equal(f.objects.filter(o => o.indicadorHal).length, active ? 1 : 0);
  assert.equal(f.objects.filter(o => o.indicadorReplicantes).length, active ? 1 : 0);
}
{
  const f = fixture();
  f.s.receber([f.event(1, 'despertar', { fonte: { ...f.source, nome: 'Dragão das Comunicações Móveis' } })]);
  f.flush(); assert.ok(f.objects.some(o => o.type === 'image' && o.value === 'arte' && o.x === 540 && o.y === 1110));
  const dormant = fixture();
  dormant.s.receber([dormant.event(1, 'invocacao', { fonte: { ...dormant.source, nome: 'Dragão das Comunicações Móveis' } })]);
  dormant.flush(); assert.ok(!dormant.objects.some(o => o.type === 'image' && o.value === 'arte' && o.x === 540 && o.y === 1110));
}
console.log('Visuais do documento: cores, sprite 14, Crypto apenas no ganho, Juggernaut no alvo, fila de vídeo, HAL, Replicantes e full art do despertar validados.');
