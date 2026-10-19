const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ window: {}, Phaser: { Scene: class {} } });
vm.runInContext(fs.readFileSync('js/cenas/jogo.js', 'utf8'),context);
const Scene = vm.runInContext('CenaJogo',context);
const images=[],containers=[];
function object() { return {
  setDisplaySize(){return this;},setAngle(angle){this.angle=angle;return this;},setDepth(){return this;},
  setOrigin(){return this;},setStrokeStyle(){return this;},setSize(){return this;},
  setInteractive(){throw Error('Apresentação não pode interagir com a mão.');},
}; }
const scene=Object.assign(Object.create(Scene.prototype),{
  multiplayer: { spectator:true, presentation:true },
  partida: {
    jogador: { mao: { cartas: [{nome:'O Boi',imagem:'arte-jogador'},{nome:'A Cobra',imagem:'arte-jogador'}] } },
    inimigo: { mao: { cartas: [{nome:'O Rato',imagem:'arte-inimigo'}] } },
    maoRevelada() { throw Error('Espectador não pode revelar a mão nem pelo Nexus.'); },
  },
  add: {
    rectangle: object,
    image(x,y,key) { images.push(key); return object(); },
    container(x,y,children) { const value={...object(),x,y,list:children};containers.push(value);return value; },
    text: object,
  },
  obterCorPorId: () => 0,
  truncarTexto: text => text,
  criarSeloEstat: () => [object(),object()],
});
scene.desenharMaoInimigo();scene.desenharMaoEmLeque();
scene.configurarGestosMao();
let concluidas = 0;
scene.animarComprasInimigas(2, () => concluidas++);
assert.equal(concluidas, 1, 'Pular a animação deve concluir a atualização remota.');
assert.deepEqual(images, ['arte-inimigo', 'arte-jogador', 'arte-jogador']);
assert.equal(containers[0].angle, 180, 'Mão do jogador 2 orientada para seu lado da mesa.');
assert.equal(containers.filter(card => card.dadosCarta).length, 3, 'As duas mãos usam o mesmo leque da interface atual.');
images.length = 0;
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
console.log('Apresentação com mãos abertas sem interação; espectador comum e jogadores preservados.');
