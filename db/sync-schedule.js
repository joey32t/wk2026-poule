// Idempotent schedule sync — keeps an already-seeded (live) database in step with
// db/schedule.js WITHOUT disturbing entered results or user predictions.
//
// Why this exists: db/seed.js only runs on an empty database, so edits to the
// schedule never reach the live Railway DB. This script upserts every match by
// match_number on each boot.
//
// What it updates per match: stage, group_letter, kickoff_cest, venue, and the
// knockout slot definitions (home_source / away_source). For knockout matches it
// also refreshes the placeholder home_team / away_team — but only while the match
// has no result yet and has not been manually overridden (is_manual = 0), so a
// resolved/locked team is never clobbered. Group team names and orientation are
// left exactly as seeded so existing score predictions keep their meaning.
//
// It never touches: result_*, et_*, pen_*, or the predictions table.

require('dotenv').config();
const db = require('./database');
const SCHEDULE = require('./schedule');

const getMatch = db.prepare('SELECT * FROM matches WHERE match_number = ?');
const insertMatch = db.prepare(`
  INSERT INTO matches (match_number, stage, group_letter, home_team, away_team,
                       kickoff_cest, venue, home_source, away_source)
  VALUES (@n, @stage, @group, @home, @away, @kickoff, @venue, @homeSrc, @awaySrc)
`);
const updateMeta = db.prepare(`
  UPDATE matches
     SET stage = @stage, group_letter = @group, kickoff_cest = @kickoff,
         venue = @venue, home_source = @homeSrc, away_source = @awaySrc
   WHERE match_number = @n
`);
const updateKnockoutNames = db.prepare(`
  UPDATE matches SET home_team = @home, away_team = @away WHERE match_number = @n
`);

function syncSchedule() {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM matches').get().c;
  if (existing === 0) {
    console.log('Schedule sync: no matches yet (fresh DB) — seed.js will populate.');
    return;
  }

  let inserted = 0, updated = 0, namesRefreshed = 0;
  const sync = db.transaction(() => {
    for (const m of SCHEDULE) {
      const row = getMatch.get(m.n);
      if (!row) { insertMatch.run(m); inserted++; continue; }

      updateMeta.run(m);
      updated++;

      // Refresh knockout placeholder names only when safe: no result entered and
      // not manually overridden. Group names are never rewritten (predictions rely
      // on the original team orientation).
      if (m.stage !== 'group') {
        const hasResult = row.result_home !== null && row.result_away !== null;
        if (!hasResult && !row.is_manual) {
          updateKnockoutNames.run(m);
          namesRefreshed++;
        }
      }
    }
  });
  sync();
  console.log(`Schedule sync complete: ${inserted} inserted, ${updated} updated, ${namesRefreshed} knockout placeholders refreshed.`);

  // Re-resolve the bracket from any results already entered (safe + idempotent).
  try {
    require('../routes/progression').recompute();
    console.log('Schedule sync: bracket re-resolved from existing results.');
  } catch (e) {
    console.log('Schedule sync: bracket recompute skipped (', e.message, ').');
  }
}

module.exports = { syncSchedule };

// Allow running as a standalone script (npm run sync / start command).
if (require.main === module) syncSchedule();
