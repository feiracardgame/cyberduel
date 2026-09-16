const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ window: {}, Phaser: { Scene: class {} } });
vm.runInContext(fs.readFileSync('js/cenas/jogo.js', 'utf8'),context);
const Scene = vm.runInContext('CenaJogo',context);
const images=[],containers=[];
function object() { return { setDisplaySize(){return this;},setAngle(){return this;},setDepth(){return this;} }; }
const scene=Object.assign(Object.create(Scene.prototype),{
  multiplayer: { spectator:true },
  partida: {
    jogador: { mao: { cartas: [{nome:'Carta oculta'},{nome:'Carta oculta'}] } },
    inimigo: { mao: { cartas: [{nome:'Carta oculta'}] } },
    maoRevelada() { throw Error('Espectador não pode revelar a mão nem pelo Nexus.'); },
  },
  add: {
    rectangle: object,
    image(x,y,key) { images.push(key); return object(); },
    container(x,y,children) { const value={...object(),x,y,list:children};containers.push(value);return value; },
    text() { throw Error('Não desenhar nomes nem estatísticas de cartas ocultas.'); },
  },
});
scene.desenharMaoInimigo();scene.desenharMaoEmLeque();
assert.deepEqual(images,['fundoCarta','fundoCarta','fundoCarta']);
assert.equal(containers.filter(c=>c.maoOcultaLado==='jogador').length,2);
assert.equal(containers.filter(c=>c.maoOcultaLado==='inimigo').length,1);
assert.ok(containers.every(c=>!c.input&&!c.dadosCarta));
console.log('Espectador: mãos dos dois jogadores usam o verso normal, sem dados ou interação.');
