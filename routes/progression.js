// Glue between the pure tournament logic (tournament.js) and the database.
// Recomputes the resolved knockout bracket from current results and writes the
// resolved team names back into the matches table.

const db = require('../db/database');
const tournament = require('../tournament');

// Human-readable Dutch placeholder for an unresolved knockout slot, mirroring the
// labels in db/schedule.js. Used to revert a slot when its result is cleared.
function displayForSource(src) {
  if (!src) return null;
  let m;
  if ((m = src.match(/^1([A-L])$/))) return 'Winnaar Groep ' + m[1];
  if ((m = src.match(/^2([A-L])$/))) return 'Nr. 2 Groep ' + m[1];
  if ((m = src.match(/^3:([A-L]+)$/))) return 'Beste 3e (' + m[1].split('').join('/') + ')';
  if ((m = src.match(/^W(\d+)$/))) return 'Winnaar W' + m[1];
  if ((m = src.match(/^L(\d+)$/))) return 'Verliezer W' + m[1];
  return src;
}

const allMatchesStmt = db.prepare('SELECT * FROM matches ORDER BY match_number');
const updateNames = db.prepare(
  'UPDATE matches SET home_team = ?, away_team = ? WHERE match_number = ?'
);

// Recompute the bracket and persist resolved team names for every knockout match
// that is not manually overridden. A slot with an unknown team reverts to its
// placeholder, so clearing a result cleanly rolls the bracket back.
function recompute() {
  const matches = allMatchesStmt.all();
  const { bracket } = tournament.build(matches);

  const apply = db.transaction(() => {
    for (const m of matches) {
      if (m.stage === 'group' || m.is_manual) continue;
      const res = bracket[m.match_number] || {};
      const home = res.home || displayForSource(m.home_source);
      const away = res.away || displayForSource(m.away_source);
      if (home !== m.home_team || away !== m.away_team) {
        updateNames.run(home, away, m.match_number);
      }
    }
  });
  apply();
}

// Full snapshot for the standings page / API.
function snapshot() {
  const matches = allMatchesStmt.all();
  return tournament.build(matches);
}

module.exports = { recompute, snapshot, displayForSource };
