# WK 2026 Poule — Project Context

Family football prediction website for the 2026 World Cup.
Players: Joey (admin), Annemieke, Mike, Shanna, Dave.

## Stack
- **Backend:** Node.js + Express, SQLite (`better-sqlite3`), JWT auth, bcryptjs
- **Frontend:** Vanilla HTML/CSS/JS — no framework, Dutch language
- **Deploy:** Railway — auto-deploys on every `git push origin master`
- **GitHub:** https://github.com/joey32त/wk2026-poule

## Local path
`C:/Users/joey/OneDrive/Documents/Lifestyle/Claude Code/World Cup 2026 Poule/`

## Key files
| File | Purpose |
|------|---------|
| `server.js` | Express entry, route registration |
| `db/database.js` | SQLite schema + ALTER TABLE migrations at bottom |
| `db/schedule.js` | **Canonical 104-match schedule** (single source of truth). Times in Amsterdam; knockout rows carry slot `source` codes |
| `db/seed.js` | Seeds users + matches from `schedule.js` (only on empty DB) |
| `db/sync-schedule.js` | Idempotent: updates live DB schedule (kickoff/venue/sources) by match_number, **preserving results + predictions**. Runs on every boot |
| `db/annexC.js` | FIFA Annex C — all 495 best-third assignment combinations (generated data, do not hand-edit) |
| `tournament.js` | **Pure progression logic**: group standings (FIFA tiebreakers), third-place ranking, Annex C assignment, knockout cascade |
| `routes/progression.js` | Bridges `tournament.js` ↔ DB: `recompute()` writes resolved team names; `snapshot()` for the API |
| `middleware/auth.js` | `requireAuth` / `requireAdmin` JWT middleware |
| `routes/predictions.js` | STAGE_DEADLINES, save/get predictions, DELETE single pred (admin) |
| `routes/results.js` | Admin: enter/clear results (calls `progression.recompute()`); PUT manual team override (sets `is_manual`); POST `/matches/:id/auto` reverts to auto |
| `routes/leaderboard.js` | Scoring logic — POINTS map + SECOND_CHANCE map + calcPoints() |
| `routes/standings.js` | GET `/api/standings` — group tables, third ranking, resolved bracket |
| `routes/users.js` | Admin: list/add/reset users |
| `routes/auth.js` | Login, change-password |
| `public/css/style.css` | Orange (#FF6200) + navy (#003893) dark theme |
| `public/js/auth.js` | AUTH object, renderHeaderUser(), toggleMobileNav() |
| `public/js/flags.js` | Shared `flagImg()` / `flagUrl()` — local SVG flags (works on Windows desktop) |
| `public/js/main.js` | Stage tabs, match cards, predictions rendering |
| `public/js/standings.js` | Stand page: group tables, best-3 ranking, bracket views |
| `public/js/admin.js` | All admin panel logic |
| `public/js/leaderboard.js` | Leaderboard render + prize display |
| `public/flags/*.svg` | 48 bundled country flags (flagcdn, incl. gb-eng/gb-sct) |
| `test-tournament.js` | `node test-tournament.js` — sanity test for the progression pipeline |

## Database schema (matches table)
```
id, match_number, stage, group_letter, home_team, away_team, kickoff_cest, venue,
result_home, result_away,   ← 90-min score
et_home, et_away,           ← extra time score (nullable)
pen_home, pen_away,         ← penalties score (nullable, display only)
home_source, away_source,   ← knockout slot definition (1A/2B/3:POOL/W##/L##); NULL for group
is_manual                   ← 1 if admin overrode team names; auto-progression then skips it
```

## Auto-progression
- Group results → `tournament.js` computes standings (Pts → GD → goals → head-to-head; cards/lots
  can't be computed, flagged via `tiebreakNote`) → ranks the 12 third-placed teams → best 8 qualify.
- The 8 qualifying groups form a key into `db/annexC.js` (Annex C) → which group's 3rd fills each
  R32 "best third" slot. Knockout winners/losers cascade R32 → final by match number.
- Triggered after every result save/clear. Resolved names are written to `home_team`/`away_team`;
  cleared results roll a slot back to its placeholder. Manual overrides (`is_manual=1`) are never
  clobbered — revert them with POST `/api/admin/matches/:id/auto`.

## Point system
| Stage | Winner/draw | Exact score | 2nd chance (ET) |
|-------|-------------|-------------|-----------------|
| group | 1 | 2 | — |
| r32 | 2 | 3 | +1 |
| r16 | 3 | 4 | +1 |
| qf | 4 | 5 | +1 |
| sf | 5 | 7 | +2 |
| 3rd | 5 | 7 | +2 |
| final | 10 | 15 | +2 |

## Second-chance scoring rules
- Only applies in knockout stages when `et_home`/`et_away` are set
- **Team-win prediction:** bonus if ET produced a winner AND it's the predicted team (`Math.sign(et-score) === Math.sign(pred)`)
- **Draw prediction:** bonus ONLY if ET also ends in a draw (match goes to penalties) — i.e. `etWinner === 0`
- No bonus based on penalty shootout result

## Stage deadlines (CEST)
group: Jun 11 20:00 · r32: Jun 28 20:00 · r16: Jul 4 18:00
qf: Jul 9 21:00 · sf: Jul 14 20:00 · 3rd: Jul 18 22:00 · final: Jul 19 20:00

## Railway setup
- Start command: `node db/seed.js && node db/sync-schedule.js && node server.js`
  (seed only fills an empty DB; sync-schedule then corrects the schedule on the live DB each boot)
- Env vars: `JWT_SECRET`, `PORT=3000`, `DB_PATH=/data/wc2026.db`
- Persistent volume at `/data` holds the live SQLite DB

## Admin capabilities (joey)
- Enter/clear match results (90-min + optional ET + penalty)
- View all users' predictions before the deadline
- Delete individual predictions (in the "Alle voorspellingen" table)
- Add users, reset passwords
- Update knockout team names

## Deploy workflow
```bash
git add <files>
git commit -m "description"
git push origin master   # Railway auto-redeploys
```
