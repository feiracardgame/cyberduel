const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ window: {}, Phaser: { Scene: class {} },
  LARGURA_LAYOUT: 1080, ALTURA_LAYOUT: 2220, Y_MAO_INIMIGO: 230, Y_MAO_JOGADOR: 1900,
  TIPOS_EFEITO: { ARMADILHA_ESPACO: 'armadilha' },
});
vm.runInContext(fs.readFileSync('js/cenas/efeitos.js', 'utf8'), context);
const Scene = context.window.CenaEfeitos;
function fixture(spectator = false) {
  const tasks = [], objects = [], tweens = [], impacts = [];
  let time = 0;
  const schedule = (delay, fn) => tasks.push({ at: time + delay, fn });
  const object = (type, x, y, value) => {
    const o = { type, x, y, value, active: true, visible: true,
      setDisplaySize(w,h) { this.width=w; this.height=h; return this; },
      setStrokeStyle() { return this; }, setOrigin() { return this; },
      setVisible(v) { this.visible=v; return this; }, setDepth() { return this; },
      setScale(v) { this.scaleX=this.scaleY=v; return this; }, setAngle(v) { this.angle=v; return this; },
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
    add: Object.fromEntries(['image','rectangle','text','circle','container'].map(type=>[type,(...args)=>object(type,...args)])),
    textures: { exists:()=>true }, cache: { audio: { exists:()=>false }, video: { exists:()=>false } },
    time: { delayedCall: schedule },
    tweens: { add(config) {
      tweens.push(config);
      schedule((config.delay||0)+config.duration*(config.yoyo?2:1),()=>{
        for(const k of ['x','y','alpha','scaleX','scaleY']) if(config[k]!==undefined) config.targets[k]=config[k];
        config.onComplete?.();
      });
    } },
  });
  const original = s.animarFonte;
  s.animarFonte = (event, source, keep, callback) => original.call(s,event,source,keep,()=>{impacts.push(event.id);callback();});
  return { s, source, fieldObject, objects, tweens, impacts,
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
  assert.equal(local.objects.filter(o=>o.type==='container').length,0);
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
