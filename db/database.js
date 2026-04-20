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

module.exports = db;
