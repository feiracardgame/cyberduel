const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ window: {}, Phaser: { Scene: class {} } });
vm.runInContext(fs.readFileSync('js/cenas/jogo.js', 'utf8'),context);
const Scene = vm.runInContext('CenaJogo',context);
const images=[],containers=[];
function object() { return { setDisplaySize(){return this;},setAngle(){return this;},setDepth(){return this;} }; }
const scene=Object.assign(Object.create(Scene.prototype),{
  multiplayer: { spectator:true, presentation:true },
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
scene.add.rectangle = () => { throw Error('Espectador não deve desenhar sombras das mãos.'); };
scene.desenharMaoInimigo();scene.desenharMaoInimigo('jogador');scene.desenharMaoEmLeque();
let concluidas = 0;
scene.animarComprasInimigas(2, () => concluidas++);
assert.equal(concluidas, 1, 'Pular a animação deve concluir a atualização remota.');
assert.deepEqual(images, []);
assert.deepEqual(containers, []);
scene.multiplayer.presentation = false;
scene.add.rectangle = object;
scene.desenharMaoInimigo(); scene.desenharMaoEmLeque();
assert.deepEqual(images, ['fundoCarta', 'fundoCarta', 'fundoCarta'], 'Espectador comum mantém os versos das duas mãos.');
images.length = 0;
scene.multiplayer.spectator = false;
scene.partida.maoRevelada = () => false;
scene.add.rectangle = object;
scene.desenharMaoInimigo();
assert.deepEqual(images, ['fundoCarta'], 'Jogadores continuam vendo a mão adversária normalmente.');
console.log('Apresentação sem mãos ou compras; espectador comum e jogadores preservados.');
