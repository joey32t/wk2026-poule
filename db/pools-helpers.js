const db = require('./database');

// All user-ids in a poule.
function getPoolMemberIds(poolId) {
  return db.prepare('SELECT user_id FROM pool_members WHERE pool_id = ?').all(poolId).map(r => r.user_id);
}

function userInPool(poolId, userId) {
  return !!db.prepare('SELECT 1 FROM pool_members WHERE pool_id = ? AND user_id = ?').get(poolId, userId);
}

// Poule ids a user belongs to.
function getUserPoolIds(userId) {
  return db.prepare('SELECT pool_id FROM pool_members WHERE user_id = ?').all(userId).map(r => r.pool_id);
}

// Decide which user-ids a request is allowed to see for poule-scoped reads.
// Returns { ok, userIds, error, status }.
//   userIds === null  → no filter (all users / global)
//   userIds === []    → show nothing (e.g. a non-admin not in any poule)
//   userIds === [...]  → restrict to these ids
function resolveScope(req) {
  const raw = req.query.pool_id;
  const poolId = raw != null && raw !== '' ? parseInt(raw) : null;
  const isAdmin = req.user && req.user.is_admin;

  if (poolId) {
    if (!isAdmin && !userInPool(poolId, req.user.id))
      return { ok: false, status: 403, error: 'Geen toegang tot deze poule' };
    return { ok: true, userIds: getPoolMemberIds(poolId) };
  }

  // No poule selected.
  if (isAdmin) return { ok: true, userIds: null }; // admin "Alle deelnemers"

  const mine = getUserPoolIds(req.user.id);
  if (mine.length === 0) return { ok: true, userIds: [] }; // not competing yet

  // Safety net: a non-admin without an explicit pool_id can only ever see the
  // union of their own poules' members, never the full global list.
  const set = new Set();
  for (const pid of mine) for (const uid of getPoolMemberIds(pid)) set.add(uid);
  return { ok: true, userIds: [...set] };
}

module.exports = { getPoolMemberIds, userInPool, getUserPoolIds, resolveScope };
