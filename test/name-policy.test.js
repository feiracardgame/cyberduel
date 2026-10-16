const assert = require('node:assert/strict');
const { nameIsBlocked } = require('../server/name-policy');
for (const name of ['εpstein', 'ɛpstein', 'єpstein', 'ƐPSTEIN', 'ᴇᴘꜱᴛᴇɪɴ',
  'ерѕtеіո', 'ε.p.ѕ.t.ɛ.ɪ.ɴ', 'zzεpsteinyy', 'zzɛpsteinyy', 'zzɛp5tɛ1nyy',
  'ᴅɪᴅᴅʏ', 'ԁіԁԁу', 'ρuffԁaԁԁу', 'ɑԁмιո', 'ѕυρρоrt'])
  assert.equal(nameIsBlocked(name), true, `Letras visualmente semelhantes: ${name}`);
for (const start of [0x1d41a, 0x1d68a, 0x1d552, 0x24d0, 0xff41, 0x1f150, 0x1f170, 0x1f1e6]) {
  const styled = Array.from('epstein', letter => String.fromCodePoint(start + letter.charCodeAt(0) - 97)).join('');
  assert.equal(nameIsBlocked(styled), true, `Fonte estilizada: ${styled}`);
  assert.equal(nameIsBlocked(`zz${styled}yy`), true, `Fonte estilizada no meio: ${styled}`);
}
for (const name of ['zzɑԁмιոyy', 'zzρоrոyy', 'ᴊᴏãᴏ', 'ᴍᴀʀɪᴀɴᴀ', 'Αλέξανδρος', 'Марина', '李雷'])
  assert.equal(nameIsBlocked(name), false, `Limites e nomes legítimos: ${name}`);
for (const name of ['asduhasiudepsteinasduiasdiuh', 'zzEPSTEINyy', 'zzDiddyYY',
  'zzd.i.d.d.yyy', 'zz3p5t31nyy', 'zzep1steinYY', 'zzcaralhoyy', 'zzSeanCombsyy'])
  assert.equal(nameIsBlocked(name), true, `Termo com mais de quatro letras no meio: ${name}`);
for (const name of ['zzadminyy', 'zzsuporteyy', 'zzcyberduelyy', 'zzcuyy', 'zzpauyy',
  'zzputayy', 'zzfodayy', 'zzfdpyy', 'zzshitYY', 'zzpornYY', 'zzrapeYY'])
  assert.equal(nameIsBlocked(name), false, `Reservado ou termo curto não bloqueia trecho: ${name}`);
for (const name of ['admin', 'Admin_Joao', 'AdMiN01', 'ＡＤＭＩＮ', 'аdmin', 'ElénAI', 'p.u.t.a', 'P U T A',
  'C4R4LH0', 'puta123', 'foda123', 'Héil Hitler', 'a\u200bdmin', 'Duelista\u202e', 'filho da puta'])
  assert.equal(nameIsBlocked(name), true, name);
for (const name of ['k.r.l.h', 'K4R4LH0', 'bucetagem', 'X1B1U', 'pirokuda',
  'masturbacao', 'chupadora de pau', 'resto de aborto', 'merece morrer',
  'odeio judeus', 'morte aos gays', 'muthafucka', 'paedophile', 'child abuser',
  'SuperAdmin', 'SYSADMIN123', 'Game Master', 'Mod.Team', 'Support Team',
  'cyberduel_oficial', 'Equipe Cyberduel', 'suporte-cyberduel'])
  assert.equal(nameIsBlocked(name), true, name);
for (const name of ['Arrombadinha', 'B0C3T1NH4', 'x.e.r.e.c.u.d.a', 'pau mole',
  'FUD4S3', 'filho da vadia', 'puta que pariu', 'chupa minha rola', 'DeBil Mental',
  'N3ON4Z1ST4', 'supremacia branca', 'morte aos judeus', 'go kill yourself',
  'suicide-se', 'm.a.t.e.s.e', 'P0RNHUB', 'xvideos123', 'child porn', 'abuso infantil',
  'blowjob', 'lolicon', 'shotacon', 'putinharabudadopipididi'])
  assert.equal(nameIsBlocked(name), true, name);
for (const name of ['Jeffrey Epstein', 'JEFFERY_EPSTEIN', 'Jeffry-Epstien', 'Jeff Epstain',
  'J. Epstein', 'Epstein123', 'xX_3p5t31n_Xx', 'Épstein', 'E P S T E I N',
  'P. Diddy', 'P Diddy', 'P_D1DDY', 'p.d.i.d.d.y', 'Diddy123', 'DiddyDuelista',
  'P Didi', 'P Didy', 'Puff Daddy', 'Puffy_Daddy', 'Puff Dady', 'Sean Combs',
  'Sean John Combs', 'Sean Puffy Combs', 'Shawn Combs', 's34n_c0mbs',
  'v.t.n.c', 'vai se foder', 'T0M4R_N0_CU', 'p3d0f1l0', 'Sieg Heil',
  'Ku Klux Klan', 'White Power', 'kill yourself', 'b0qu3t3', 'bullshit'])
  assert.equal(nameIsBlocked(name), true, name);
for (const name of ['Ana Clara', 'João', 'Paulo', 'Camila', 'Scunthorpe', 'Picard', 'Computador',
  'Duelista123', 'Boi', 'RaspClay', 'Bom', 'Mau', 'Feio', 'Jeffrey', 'Jeff', 'Sean',
  'Shawn', 'John', 'Didi', 'Puff', 'Comandante', 'Epico', 'Cornelia', 'Cornelio',
  'Mariana', 'Branco', 'Negro', 'Judeu', 'Samurai', 'Estrela', 'Mestre', 'Matheus',
  'Raphael', 'Raposa', 'Arsenal', 'Arsenio', 'Tito', 'Tita', 'Gameiro', 'Modesto'])
  assert.equal(nameIsBlocked(name), false, name);
console.log('Ban list: acentos, leetspeak, separadores, invisíveis, equipe e nomes legítimos validados.');
