require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./database');

// Check if already seeded
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount > 0) {
  console.log('Database already seeded, skipping.');
  process.exit(0);
}

// ─── Default Users ────────────────────────────────────────────────────────────
const defaultPassword = bcrypt.hashSync('wk2026', 10);
const insertUser = db.prepare(
  'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)'
);
insertUser.run('joey',       defaultPassword, 1);
insertUser.run('annemieke',  defaultPassword, 0);
insertUser.run('mike',       defaultPassword, 0);
insertUser.run('shanna',     defaultPassword, 0);
insertUser.run('dave',       defaultPassword, 0);
console.log('Users created.');

// ─── Match Data ───────────────────────────────────────────────────────────────
// The full 104-match schedule lives in db/schedule.js (single source of truth,
// also used by db/sync-schedule.js to update the live DB). Times are Amsterdam
// local (CEST, +02:00). Knockout matches carry source codes resolved at runtime.
const SCHEDULE = require('./schedule');

const insertMatch = db.prepare(`
  INSERT INTO matches (match_number, stage, group_letter, home_team, away_team,
                       kickoff_cest, venue, home_source, away_source)
  VALUES (@n, @stage, @group, @home, @away, @kickoff, @venue, @homeSrc, @awaySrc)
`);

const seedMatches = db.transaction(() => {
  for (const m of SCHEDULE) insertMatch.run(m);
});

seedMatches();
console.log(`Matches seeded (${SCHEDULE.length} total).`);
console.log('\nDefault credentials for all users: wk2026');
console.log('Admin account: joey');
