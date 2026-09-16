const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ window: {}, Y_MAO_JOGADOR: 1900,
  Phaser: { Scene: class {}, Geom: { Rectangle: { Contains: (r,x,y) => x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height } } } });
vm.runInContext(fs.readFileSync('js/cenas/jogo.js','utf8'),context);
const Scene=vm.runInContext('CenaJogo',context);
const details=[],plays=[];
const scene=Object.assign(Object.create(Scene.prototype),{
  ehMeuTurno:true,faseAtual:'colocar',travado:false,
  input:{dragDistanceThreshold:8},
  tweens:{killTweensOf(){},add({targets,...properties}){Object.assign(targets,properties);}},
  mostrarDetalheCarta(c){details.push(c);},
  tratarSoltarCarta(c,p){plays.push({c,p});},
  pontoDoPonteiro:p=>p,
  children:{list:[{isSlot:true,getBounds:()=>({x:100,y:100,width:200,height:250})}]},
});
const card=id=>({active:true,dadosCarta:{id},depthBase:id,posOriginal:{x:id*100,y:1900,angle:5},setDepth(d){this.depth=d;}});
const a=card(1),b=card(2);
scene.children.list.push(a,b);
scene.selecionarCartaDaMao(a);
assert.equal(scene.cartaMaoSelecionada,a);assert.equal(a.y,1818);assert.equal(details.length,0);
// O gesto guarda a posição levantada antes de tocar na próxima carta.
a._maoSwipeYOriginal=a.y;
a._maoSwipeXOriginal=a.x;
scene.selecionarCartaDaMao(b);
scene.voltarMaoParaPosicao();
assert.equal(a.scaleX,1);assert.equal(a.angle,5);
assert.equal(b.y,1818);
assert.equal(a._maoSwipeYOriginal,undefined);
assert.equal(a.y,1900);assert.equal(a.depth,a.depthBase);assert.equal(scene.cartaMaoSelecionada,b);
scene.selecionarCartaDaMao(b);assert.deepEqual(details,[b.dadosCarta]);
const click={x:150,y:150,getDistance:()=>0};
scene.faseAtual='habilidades';assert.equal(scene.jogarCartaSelecionadaNoCampo(click),false);
scene.faseAtual='colocar';scene.ehMeuTurno=false;assert.equal(scene.jogarCartaSelecionadaNoCampo(click),false);
scene.ehMeuTurno=true;scene.modalAberto=true;assert.equal(scene.jogarCartaSelecionadaNoCampo(click),false);
scene.modalAberto=false;assert.equal(scene.jogarCartaSelecionadaNoCampo({...click,x:500}),false);
assert.equal(scene.jogarCartaSelecionadaNoCampo({...click,getDistance:()=>30}),false);
assert.equal(plays.length,0);assert.equal(scene.cartaMaoSelecionada,b);
assert.equal(scene.jogarCartaSelecionadaNoCampo(click),true);assert.equal(plays[0].c,b);assert.equal(plays[0].p,click);
assert.equal(scene.cartaMaoSelecionada,null);
console.log('Mão: seleção, troca, segundo clique, campo e bloqueios de fase/gesto validados.');

// Mesmo com animações pendentes, a carta antiga baixa de forma síncrona.
scene.tweens.add=()=>{};
scene.cartaMaoSelecionada=b;
b.y=1818;
scene.selecionarCartaDaMao(a);
assert.equal(b.y,b.posOriginal.y);
assert.equal(b.scaleY,1);
scene.voltarMaoParaPosicao();
assert.equal(b.y,b.posOriginal.y);
