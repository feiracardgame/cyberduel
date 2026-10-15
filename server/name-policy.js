// Política central para username e apelido; o servidor é a autoridade.
const RESERVED = new Set([
  'admin', 'administrator', 'administrador', 'administradora', 'moderador', 'moderadora',
  'moderator', 'suporte', 'support', 'staff', 'sistema', 'system', 'cyberduel', 'elenai',
]);
const BLOCKED = [
  'porra', 'caralho', 'caralhos', 'merda', 'bosta', 'puta', 'puto', 'putaria',
  'foda', 'foder', 'fodase', 'fodido', 'cu', 'cuzinho', 'cuzao', 'buceta', 'pinto',
  'pica', 'pau', 'cacete', 'fdp', 'filhodaputa', 'filhadaputa', 'arrombado', 'arrombada',
  'viado', 'veado', 'bicha', 'bichona', 'traveco', 'sapatona', 'retardado', 'retardada',
  'nazista', 'nazismo', 'neonazi', 'hitler', 'heilhitler', 'nigger', 'nigga',
  'fuck', 'fucker', 'motherfucker', 'shit', 'bitch', 'faggot', 'porn', 'porno',
];
const substitutions = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't',
  '@': 'a', '$': 's', '!': 'i', 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x', 'і': 'i' };
function nameIsBlocked(value) {
  const original = String(value || '').normalize('NFKC');
  // Caracteres invisíveis, controles e escrita bidirecional não fazem parte de nomes.
  if (/[\p{Cc}\p{Cf}]/u.test(original)) return true;
  const normalized = original.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[013457@$!аеорсхі]/gu, c => substitutions[c]);
  const words = normalized.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const compact = words.join('').replace(/\d/g, '');
  const withoutSuffix = original.toLocaleLowerCase('pt-BR').replace(/\d+$/u, '')
    .normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\p{L}]/gu, '');
  if (RESERVED.has(compact) || RESERVED.has(withoutSuffix) || words.some(word => RESERVED.has(word))) return true;
  return BLOCKED.some(word => words.includes(word) || compact === word || withoutSuffix === word ||
    (word.length >= 5 && compact.includes(word)) ||
    new RegExp(`^${word}\\d*$`).test(normalized));
}
module.exports = { nameIsBlocked };
