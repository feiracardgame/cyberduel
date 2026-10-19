const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const context = vm.createContext({ window: {}, Phaser: { Scene: class {} } });
vm.runInContext(fs.readFileSync('js/cenas/jogo.js', 'utf8'), context);
const { Scene, width, height, layout, expanded, portraits } = vm.runInContext(
  '({ Scene: CenaJogo, width: LARGURA_LAYOUT, height: ALTURA_LAYOUT, layout: LAYOUT_CAMPO_NORMAL, expanded: LAYOUT_CAMPO_AMPLIADO, portraits: PERSONAGENS_DUELO_POR_AVATAR })', context);
for (const path of Object.values(portraits)) assert.ok(fs.existsSync(path));
assert.deepEqual(Object.keys(portraits).sort(), fs.readdirSync('assets/fotosdeperfil')
  .filter(name => name.endsWith('_icon.png')).map(name => `assets/fotosdeperfil/${name}`).sort(),
  'Toda foto selecionável precisa de um busto próprio.');
assert.deepEqual(Object.values(portraits).sort(), fs.readdirSync('assets/profiles')
  .filter(name => /_profil{1,2}e\.png$/.test(name)).map(name => `assets/profiles/${name}`).sort(),
  'Todos os bustos disponíveis precisam estar associados.');
assert.equal(portraits['assets/fotosdeperfil/diego_icon.png'], 'assets/profiles/diego_profille.png');
assert.equal(portraits['assets/fotosdeperfil/advogado_icon.png'], 'assets/profiles/advogado_profille.png');
assert.ok(fs.existsSync('assets/profiles/duel_corner.png'));
assert.ok(fs.existsSync('assets/profiles/duel_corner_opponent.png'));
assert.match(fs.readFileSync('js/cenas/preload.js', 'utf8'), /duelCorner: "assets\/profiles\/duel_corner\.png"/);

function renderer() {
  const objects = [], loaded = [], load = new EventEmitter();
  const object = (x = 0, y = 0, key) => Object.assign(new EventEmitter(), {
    x, y, key, width: 800, height: 800, scaleX: 1, scaleY: 1, active: true,
    setOrigin(x, y) { this.originX = x; this.originY = y; return this; },
    setScale(scale) { this.scaleX = this.scaleY = scale; return this; },
    setDepth(depth) { this.depth = depth; return this; },
    setName(name) { this.name = name; return this; },
    setAngle(angle) { this.angle = angle; return this; },
    setSize(width, height) { this.width = width; this.height = height; return this; },
    setDisplaySize() { return this; }, setStrokeStyle() { return this; },
    setInteractive() { this.interactive = true; return this; }, setAlpha() { return this; },
    fillStyle() { return this; }, fillPoints() { return this; },
    lineStyle() { return this; }, strokePoints() { return this; }, lineBetween() { return this; },
  });
  load.image = (key, path) => loaded.push({ key, path });
  load.start = () => load.emit('complete');
  const scene = Object.assign(Object.create(Scene.prototype), {
    layout, load, events: new EventEmitter(), scene: { isActive: () => true },
    textures: { exists: () => false }, desenharInterface() {},
    aplicarMascaraRender(target, mask) { target.mask = mask; return { target, mask }; },
    limparMascaraRender() {},
    add: { image(x, y, key) { const image = object(x, y, key); objects.push(image); return image; },
      rectangle: object, text: object,
      graphics() { const graphic = object(); objects.push(graphic); return graphic; },
      container(x, y) { const container = object(x, y); objects.push(container); return container; } },
    partida: { jogador: { mao: { cartas: [] } }, inimigo: { mao: { cartas: [] } }, maoRevelada: () => false },
    input: { setDraggable() {} }, interfaceJaDesenhada: true,
    obterCorPorId: () => 0, truncarTexto: text => text, criarSeloEstat: () => [],
  });
  return { scene, objects, loaded };
}

// O perfil remoto tem prioridade, inclusive quando o jogador local ocupa o lugar 2.
const { scene, objects, loaded } = renderer();
context.window.cyberduelAccount = { avatar: 'assets/fotosdeperfil/raspclay_icon.png' };
scene.multiplayerAtivo = true;
scene.multiplayer = { player: 2, profiles: { 1: { avatar: 'assets/fotosdeperfil/raspclay_icon.png' }, 2: { avatar: 'assets/fotosdeperfil/boi_icon.png' } } };
scene.carregarRetratosDuelo();
assert.match(scene.personagensDuelo.jogador, /boi_profile\.png$/);
assert.match(scene.personagensDuelo.inimigo, /raspclay_profile\.png$/);
assert.equal(loaded.length, 2);
scene.textures.exists = () => true;
scene.desenharPersonagensDuelo();
const player = objects.find(object => object.name === 'personagem-jogador');
const opponent = objects.find(object => object.name === 'personagem-inimigo');
assert.equal(player.x, width); assert.equal(player.y, height);
assert.equal(player.originX, 1); assert.equal(player.originY, 1);
assert.equal(opponent.originX, 0);
assert.equal(opponent.x, 0);
assert.equal(opponent.crop, undefined, 'Oponente mantém o busto sem zoom ou recorte.');
assert.ok(opponent.width * opponent.scaleX < 240, 'Busto do oponente cabe antes do nome e do PA.');
const opponentBackground = objects.find(object => object.name === 'fundo-personagem-inimigo');
assert.equal(opponentBackground.key, 'duelCornerOpponent');
assert.equal(opponentBackground.originX, 0); assert.equal(opponentBackground.originY, 0);
assert.equal(player.interactive, undefined, 'Personagem não bloqueia os toques do campo.');
for (const side of ['jogador', 'inimigo']) {
  const background = objects.find(object => object.name === `fundo-personagem-${side}`);
  const portrait = objects.find(object => object.name === `personagem-${side}`);
  assert.ok(background.depth < portrait.depth, 'Painel decorado fica atrás do personagem.');
  assert.equal(background.interactive, undefined, 'Fundo não bloqueia os toques.');
}
const foreground = objects.find(object => object.name === 'faixa-frente-inimigo');
assert.ok(foreground.depth > opponent.depth, 'Faixas rosa e preta ficam na frente do busto.');
assert.ok(foreground.mask, 'Somente a faixa cobre o busto, mantendo o rosto visível.');
const cornerLeft = player.x - player.width * player.scaleX;

// Mãos pequenas e grandes mantêm espaço para o personagem, também como espectador.
for (const count of [1, 6, 10, 20]) {
  const { scene: hand, objects: cards } = renderer();
  hand.partida.jogador.mao.cartas = Array.from({ length: count }, (_, id) => ({ id, nome: 'Carta', tipo: 'monstro' }));
  hand.desenharMaoEmLeque();
  for (const card of cards.filter(card => card.dadosCarta)) {
    const angle = card.angle * Math.PI / 180;
    const halfWidth = Math.abs(Math.cos(angle)) * 88 + Math.abs(Math.sin(angle)) * 123;
    assert.ok(card.x + halfWidth < cornerLeft, `${count} cartas: mão não cobre o personagem.`);
    assert.ok(card.x - halfWidth >= 0, `${count} cartas: mão cabe na tela.`);
  }
  assert.ok(cards.filter(card => card.dadosCarta).every(card => card.interactive));
  cards.length = 0;
  hand.multiplayer = { spectator: true };
  hand.desenharMaoEmLeque();
  assert.ok(cards.filter(card => card.maoOcultaLado).every(card => card.x + 100 < cornerLeft));
}

// Fotos desconhecidas e ausência de foto usam Clayrton, sem baixar o mesmo asset duas vezes.
for (const avatar of ['assets/fotosdeperfil/desconhecido_icon.png', null]) {
  const { scene: fallback, loaded } = renderer();
  context.window.cyberduelAccount.avatar = avatar;
  fallback.carregarRetratosDuelo();
  assert.match(fallback.personagensDuelo.jogador, /raspclay_profile\.png$/);
  assert.equal(loaded.length, 1);
}
for (const [avatar, path] of Object.entries(portraits)) {
  const { scene: mapped } = renderer();
  context.window.cyberduelAccount.avatar = avatar;
  mapped.carregarRetratosDuelo();
  assert.equal(mapped.personagensDuelo.jogador, `personagem:${path}`);
}
const { scene: presentation, loaded: displayAssets, objects: displayObjects } = renderer();
presentation.multiplayerAtivo = true;
presentation.multiplayer = { presentation: true, activePlayer: 1, profiles: {
  1: { avatar: 'assets/fotosdeperfil/boi_icon.png' }, 2: { avatar: 'assets/fotosdeperfil/raspclay_icon.png' },
} };
presentation.carregarRetratosDuelo();
assert.equal(displayAssets.length, 2);
presentation.textures.exists = () => true;
presentation.desenharPersonagensDuelo(); presentation.desenharMaoEmLeque();
assert.ok(displayObjects.find(object => object.name === 'personagem-jogador').key.includes('boi_profile'));
assert.ok(displayObjects.find(object => object.name === 'personagem-inimigo').key.includes('raspclay_profile'));
const displayPlayer = displayObjects.find(object => object.name === 'personagem-jogador');
const displayOpponent = displayObjects.find(object => object.name === 'personagem-inimigo');
assert.equal(displayPlayer.scaleX, displayOpponent.scaleX, 'Mesmo tamanho nos dois lados da apresentação.');
assert.equal(displayOpponent.angle, 180);
assert.equal(displayOpponent.originX, displayPlayer.originX);
assert.equal(displayOpponent.x, width - displayPlayer.x);
assert.equal(displayOpponent.y, height - displayPlayer.y);
for (const side of ['jogador', 'inimigo']) presentation.partida[side].mao.cartas = [{ nome: 'Carta', tipo: 'monstro' }];
displayObjects.length = 0;
presentation.desenharMaoEmLeque(); presentation.desenharMaoInimigo();
const hands = displayObjects.filter(object => object.dadosCarta);
assert.equal(hands.length, 0, 'A apresentação mostra apenas os versos por padrão.');
let backs = displayObjects.filter(object => object.maoOcultaLado);
assert.equal(backs.length, 2);
assert.equal(backs[1].x, width - backs[0].x);
assert.equal(backs[1].y, height - backs[0].y);
assert.equal(backs[1].angle, backs[0].angle + 180);
assert.ok(backs.every(card => !card.interactive));
presentation.partida.maoRevelada = owner => owner === presentation.partida.inimigo;
displayObjects.length = 0;
presentation.desenharMaoEmLeque(); presentation.desenharMaoInimigo();
assert.deepEqual(displayObjects.filter(object => object.dadosCarta).map(object => object.dadosCarta.nome), ['Carta'],
  'O Nexus revela a mão do oponente para a apresentação.');
assert.equal(displayObjects.filter(object => object.maoOcultaLado).length, 1);
presentation.partida.maoRevelada = () => false;
presentation.multiplayer.activePlayer = 2;
displayObjects.length = 0;
presentation.desenharMaoEmLeque(); presentation.desenharMaoInimigo();
backs = displayObjects.filter(object => object.maoOcultaLado);
assert.equal(backs.find(object => object.maoOcultaLado === 'jogador').angle, 180);
assert.equal(backs.find(object => object.maoOcultaLado === 'inimigo').angle, 0,
  'A orientação das mãos acompanha o jogador da vez.');
const symmetricLayout = vm.runInContext('LAYOUT_CAMPO_APRESENTACAO', context);
assert.equal(symmetricLayout.yInimigoTras + symmetricLayout.yJogadorTras, height);
assert.equal(symmetricLayout.yInimigoFrente + symmetricLayout.yJogadorFrente, height);
console.log('Personagens: avatar local/remoto, Boi, Clayrton, fallback, cantos, espaço da mão e apresentação validados.');
