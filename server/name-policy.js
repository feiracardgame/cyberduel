// Política central para username e apelido; o servidor é a autoridade.
const RESERVED = new Set([
  'admin', 'administrator', 'administrador', 'administradora', 'moderador', 'moderadora',
  'moderator', 'suporte', 'support', 'staff', 'sistema', 'system', 'cyberduel', 'elenai',
  'gamemaster', 'gameadmin', 'superadmin', 'sysadmin', 'webmaster',
  'administracao', 'moderacao', 'modteam', 'supportteam', 'staffteam',
  'cyberdueloficial', 'cyberduelofficial', 'cyberduelsupport', 'cyberduelstaff',
  'equipecyberduel', 'suportecyberduel', 'admincyberduel', 'moderadorcyberduel',
]);
const BLOCKED = [
  'porra', 'caralho', 'caralhos', 'merda', 'bosta', 'puta', 'puto', 'putaria',
  'foda', 'foder', 'fodase', 'fodido', 'cu', 'cuzinho', 'cuzao', 'buceta', 'pinto',
  'pica', 'pau', 'cacete', 'fdp', 'filhodaputa', 'filhadaputa', 'arrombado', 'arrombada',
  'viado', 'veado', 'bicha', 'bichona', 'traveco', 'sapatona', 'retardado', 'retardada',
  'nazista', 'nazismo', 'neonazi', 'hitler', 'heilhitler', 'nigger', 'nigga',
  'fuck', 'fucker', 'motherfucker', 'shit', 'bitch', 'faggot', 'porn', 'porno',
  // Ofensas, assédio, conteúdo sexual e apologia ao ódio (formas sem acentos).
  'pqp', 'vsf', 'vtnc', 'tnc', 'vaisefoder', 'vaitefoder',
  'tomarnocu', 'vaiseferrar', 'desgracado', 'desgracada',
  'escroto', 'escrota', 'babaca', 'otario', 'otaria', 'imbecil', 'idiota',
  'bostinha', 'merdinha', 'putinha', 'putona', 'vagabunda', 'vagabundo',
  'chupapau', 'chupapica', 'chupacu', 'lambecu',
  'boceta', 'xoxota', 'xereca', 'xerereca', 'piroca', 'pirocudo', 'roludo',
  'punheta', 'punheteiro', 'punheteira', 'siririca', 'boquete', 'boqueteiro',
  'boqueteira', 'gostosa', 'gostoso', 'orgasmo', 'ejaculacao', 'gozada',
  'pornografia', 'pornografico', 'pornografica', 'hentai', 'xxx',
  'pedofilo', 'pedofila', 'pedofilia', 'estuprador', 'estupradora', 'estupro',
  'zoofilia', 'zoofilo', 'necrofilia', 'necrofilo',
  'pretoimundo', 'pretaimunda', 'judeuimundo', 'judiaimunda',
  'whitepower', 'whitesupremacy', 'siegheil', 'heil', 'kukluxklan',
  'killyourself', 'semata',
  'asshole', 'bastard', 'dickhead', 'cocksucker', 'cock', 'pussy', 'whore',
  'slut', 'wanker', 'bollocks', 'bullshit', 'dumbass', 'jackass',
  // Mais variantes de insultos e conteúdo impróprio em português e inglês.
  'arrombadinho', 'arrombadinha', 'cuzona', 'cusao', 'cusona', 'bucetudo', 'bucetuda',
  'bucetinha', 'bocetinha', 'xerecuda', 'xoxotuda', 'pirocuda', 'pirocao', 'picagrossa',
  'paugrandao', 'paunocu', 'picamole', 'paumole', 'sacudo', 'sacuda',
  'piranha', 'quenga', 'rapariga', 'prostituta', 'prostituto', 'prostibulo',
  'safadona', 'safadao', 'tarado', 'tarada', 'taradinho', 'taradinha',
  'tesao', 'tesuda', 'tesudo', 'fudido', 'fudida', 'fodida', 'fudendo', 'fodendo',
  'fudase', 'fuderse', 'foderse', 'fudedor', 'fodedor', 'fudidao', 'fudidona',
  'caralhao', 'caralhudo', 'caralhuda', 'caralhinho', 'porralouca',
  'chuparola', 'chupameupau', 'chupaminhapica', 'chupaminharola', 'sentanapica',
  'sentanomeupau', 'sentanarola', 'enfianocu', 'vaipraputaquepariu', 'putaquepariu',
  'filhodarapariga', 'filhodapiranha', 'filhodacachorra', 'filhodavadia', 'vadia', 'vadio',
  'broxa', 'brocha', 'cornomanso', 'corna', 'corno', 'cornao', 'chifrudo', 'chifruda',
  'mongoloide', 'mongolao', 'mongolona', 'debilmental', 'subhumano', 'subhumana',
  'travecao', 'sapatone', 'viadao', 'viadinho', 'viadagem', 'baitola', 'boiola',
  'bichonao', 'maricona', 'maricas', 'fag', 'dyke', 'tranny', 'shemale',
  'chink', 'gook', 'spic', 'kike', 'raghead', 'towelhead', 'wetback',
  'negroimundo', 'negraimunda', 'racabranca', 'supremaciabranca', 'orgulhonazista',
  'nazipride', 'nazipower', 'neonazista', 'neonazismo', 'holocaustofake',
  'morranegros', 'matemnegros', 'morteaosjudeus', 'matemjudeus', 'gasthejews',
  'suicidese', 'matese', 'vaicometersuicidio', 'gokillyourself',
  'blowjob', 'handjob', 'rimjob', 'gangbang', 'bukkake', 'cumshot', 'creampie',
  'deepthroat', 'dickpic', 'sextape', 'sexting', 'onlyfans', 'pornhub', 'xvideos',
  'xhamster', 'redtube', 'youporn', 'rule34', 'r34porn', 'lolicon', 'shotacon',
  'childporn', 'childmolester', 'molestador', 'molestadora', 'abusoinfantil',
  // Abreviações, grafias alternativas e expressões compostas usadas para contornar a lista.
  'krl', 'krlh', 'crlh', 'crl', 'karalho', 'karalhu', 'carai', 'caraleo',
  'karai', 'kct', 'kacete', 'kacetada', 'kuzinho', 'kuzao', 'kuzona',
  'bucetao', 'bucetona', 'bocetao', 'bocetona', 'bucetagem',
  'xavasca', 'xavasquinha', 'xaninha', 'xerecao', 'xerecona', 'xibiu',
  'pikudo', 'pikuda', 'pirocona', 'piroquinha', 'pirokudo', 'pirokuda',
  'punhetinha', 'punhetaco', 'punhetagem', 'punhetar', 'punhete', 'masturbacao',
  'masturbador', 'masturbadora', 'masturbar', 'ejacular', 'ejaculador', 'gozador',
  'gozadeira', 'gozando', 'gozarnacara', 'gozanaboca', 'leitadanacara',
  'boquetinho', 'boquetao', 'boquetuda', 'chupadoradepau', 'chupadordepau',
  'comedoradecu', 'comedordecu', 'comedordebuceta', 'comedoradebuceta',
  'dameucu', 'meucu', 'teucu', 'seucu', 'cuaberto', 'culargo', 'cufrouxo',
  'arrombamento', 'arrombadaco', 'arrombadona', 'putanheiro', 'puteiro', 'puteira',
  'putariazinha', 'putanheiragem', 'putalhao', 'putalhona', 'vagabundagem',
  'pilantra', 'canalha', 'cretino', 'cretina', 'lixohumano', 'escoriahumana',
  'vermehumano', 'restodeaborto', 'abortofalhado', 'abortomalfeito',
  'vaimorrer', 'merecemorrer', 'merecesmorrer', 'morralogo', 'morradeumavez',
  'matanegros', 'matajudeus', 'exterminiojudeu', 'exterminionegro',
  'odeionegros', 'odeiojudeus', 'odeiogays', 'morteaosgays', 'matemgays', 'peladas',
  'homossexualimundo', 'gay', 'transimundo', 'transimunda',
  'niggar', 'niggah', 'nigguh', 'niglet', 'coon', 'darkie', 'paki',
  'fagget', 'faggit', 'faggy', 'fagboy', 'faglord', 'retard', 'retarded',
  'motherfuker', 'motherfukker', 'muthafucka', 'mofo', 'fuk', 'fuker', 'phuck',
  'biatch', 'beeyotch', 'arsehole', 'arse', 'shithead', 'shitface',
  'dipshit', 'twat', 'fuckwit', 'fuckface', 'buttfucker', 'buttplug',
  'jizz', 'jizzface', 'cumdump', 'cumslut', 'cumbucket', 'dickwad', 'dickface',
  'dickless', 'ballsack', 'nutsack', 'boner', 'titfuck', 'tittyfuck',
  'tits', 'titties', 'boobs', 'boobies', 'milfporn', 'dilfporn',
  'rape', 'rapist', 'daterape', 'bestiality', 'necrophilia', 'paedophile',
  'paedophilia', 'pedophile', 'pedophilia', 'childrapist', 'childabuser',
  // Nomes e aliases pedidos; separadores, acentos e leetspeak são normalizados abaixo.
  'epstein', 'epstain', 'epstien', 'epsten', 'epshtein', 'episteen',
  'jeffreyepstein', 'jefferyepstein', 'jeffryepstein', 'jeffepstein', 'jepstein',
  'diddy', 'diddyy', 'didicombs', 'pdidi', 'pdidy', 'pdddy',
  'puffdaddy', 'puffydaddy', 'puffdady', 'puffdiddi',
  'seancombs', 'seanjohncombs', 'seanpuffycombs', 'seandiddycombs', 'shawncombs', 'putinharabudadopipididi'
];
// Equivalências práticas para nomes estilizados; não é um esqueleto Unicode completo.
// Referência sobre caracteres visualmente semelhantes: https://www.unicode.org/reports/tr39/
// NFKC já cobre fontes matemáticas, largura cheia e letras circuladas comuns.
const letterVariants = {
  a: 'αаɑɐᴀ', b: 'βϐвьʙɓƀ', c: 'ϲсᴄƈ', d: 'ԁժɗđᴅ',
  e: 'εϵеҽɛɜᴇəɘє', f: 'ϝғƒꜰ', g: 'ɡɢԍցǥ', h: 'һհнʜħ',
  i: 'ιіӏıɩɪ', j: 'јϳʝᴊ', k: 'κϰкᴋƙ', l: 'ⅼʟłƖ',
  m: 'μмᴍɱ', n: 'ηոпɴŋռ', o: 'οоօσᴏøɵ', p: 'ρϱрᴘƥ',
  q: 'ԛզɋ', r: 'гʀɾʁ', s: 'ѕꜱʂʃ', t: 'τтᴛƭ',
  u: 'υսᴜʋʊ', v: 'νѵⅴᴠ', w: 'ωѡԝᴡ', x: 'χхⅹ', y: 'γуүʏ', z: 'ζᴢƶ',
};
const visualLetters = Object.fromEntries(Object.entries(letterVariants)
  .flatMap(([letter, variants]) => Array.from(variants, variant => [variant, letter])));
function foldVisualLetters(value) {
  return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^\x00-\x7f]/gu, character => {
      if (visualLetters[character]) return visualLetters[character];
      const point = character.codePointAt(0);
      // Letras em círculos/quadrados negativos e indicadores regionais (emoji).
      for (const start of [0x1f150, 0x1f170, 0x1f1e6])
        if (point >= start && point < start + 26) return String.fromCharCode(97 + point - start);
      return character;
    });
}
const substitutions = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't',
  '@': 'a', '$': 's', '!': 'i' };
function nameIsBlocked(value) {
  const original = String(value || '').normalize('NFKC');
  // Caracteres invisíveis, controles e escrita bidirecional não fazem parte de nomes.
  if (/[\p{Cc}\p{Cf}]/u.test(original)) return true;
  const letters = foldVisualLetters(original);
  const normalized = letters.replace(/[013457@$!]/gu, c => substitutions[c]);
  const words = normalized.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const compact = words.join('').replace(/\d/g, '');
  const withoutSuffix = letters.replace(/\d+$/u, '').replace(/[^\p{L}]/gu, '');
  if (RESERVED.has(compact) || RESERVED.has(withoutSuffix) || words.some(word => RESERVED.has(word))) return true;
  // Apenas termos proibidos com mais de quatro letras bloqueiam trechos de outros nomes.
  return BLOCKED.some(word => words.includes(word) || compact === word || withoutSuffix === word ||
    (word.length > 4 && (compact.includes(word) || withoutSuffix.includes(word))) ||
    new RegExp(`^${word}\\d*$`).test(normalized));
}
module.exports = { nameIsBlocked };
