const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || path.join(__dirname, 'wc2026.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    is_admin      INTEGER DEFAULT 0,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS matches (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    match_number  INTEGER UNIQUE,
    stage         TEXT NOT NULL,
    group_letter  TEXT,
    home_team     TEXT NOT NULL,
    away_team     TEXT NOT NULL,
    kickoff_cest  TEXT NOT NULL,
    venue         TEXT NOT NULL,
    result_home   INTEGER,
    result_away   INTEGER
  );

  CREATE TABLE IF NOT EXISTS predictions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    match_id    INTEGER NOT NULL REFERENCES matches(id),
    pred_home   INTEGER NOT NULL,
    pred_away   INTEGER NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, match_id)
  );
`);

// Add ET and penalty columns if they don't exist yet (safe to run on existing DB)
['et_home', 'et_away', 'pen_home', 'pen_away'].forEach(col => {
  try { db.exec(`ALTER TABLE matches ADD COLUMN ${col} INTEGER`); } catch {}
});

// Progression columns (safe to run on existing DB):
//   home_source / away_source — slot definition for knockout matches (e.g. '1A', '2B',
//     '3:CEFHI', 'W73', 'L101'); NULL for group matches. Resolved by tournament.js.
//   is_manual — 1 if an admin manually set this match's team names; auto-progression
//     then leaves the match untouched.
['home_source TEXT', 'away_source TEXT'].forEach(def => {
  try { db.exec(`ALTER TABLE matches ADD COLUMN ${def}`); } catch {}
});
try { db.exec('ALTER TABLE matches ADD COLUMN is_manual INTEGER DEFAULT 0'); } catch {}

// Bonus game ("Voorspel Vooraf"): one row per user with their champion + top-scorer
// pick. champion_awarded / top_scorer_awarded are set manually by the admin (no
// auto-checking). Safe to run on an existing DB — IF NOT EXISTS is a no-op if present.
db.exec(`
  CREATE TABLE IF NOT EXISTS bonus_predictions (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            INTEGER NOT NULL UNIQUE REFERENCES users(id),
    champion           TEXT,
    top_scorer         TEXT,
    champion_awarded   INTEGER DEFAULT 0,
    top_scorer_awarded INTEGER DEFAULT 0,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;
