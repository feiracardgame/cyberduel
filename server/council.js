const ranking = require('./ranking');
const isMember = (account, accounts) => !!account && ranking.leaderboard(accounts).slice(0, 10).includes(account);
function expire(room, now = Date.now()) {
  if (!room?.reservations) return false;
  let changed = false;
  for (const [seat, reservation] of room.reservations) if (reservation.expiresAt <= now) {
    room.reservations.delete(seat); changed = true;
  }
  return changed;
}
function reserve(room, owner, seat, now = Date.now()) {
  expire(room, now);
  if (!room || room.state || !room.presentationHost || ![1, 2].includes(seat) || room.players.has(seat)) return null;
  room.reservations ||= new Map();
  const existing = room.reservations.get(seat);
  if (existing && existing.owner !== owner) return null;
  if (existing) return existing;
  for (const [other, reservation] of room.reservations) if (reservation.owner === owner) room.reservations.delete(other);
  const reservation = { owner, expiresAt: now + 60_000 };
  room.reservations.set(seat, reservation);
  return reservation;
}
module.exports = { isMember, expire, reserve };
