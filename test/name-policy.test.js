const assert = require('node:assert/strict');
const { nameIsBlocked } = require('../server/name-policy');
for (const name of ['admin', 'Admin_Joao', 'AdMiN01', 'ＡＤＭＩＮ', 'аdmin', 'ElénAI', 'p.u.t.a', 'P U T A',
  'C4R4LH0', 'puta123', 'foda123', 'Héil Hitler', 'a\u200bdmin', 'Duelista\u202e', 'filho da puta'])
  assert.equal(nameIsBlocked(name), true, name);
for (const name of ['Ana Clara', 'João', 'Paulo', 'Camila', 'Scunthorpe', 'Picard', 'Computador',
  'Duelista123', 'Boi', 'RaspClay', 'Bom', 'Mau', 'Feio'])
  assert.equal(nameIsBlocked(name), false, name);
console.log('Ban list: acentos, leetspeak, separadores, invisíveis, equipe e nomes legítimos validados.');
