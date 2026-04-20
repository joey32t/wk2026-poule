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
| `db/seed.js` | Seeds 104 matches + 5 users (runs on Railway start) |
| `middleware/auth.js` | `requireAuth` / `requireAdmin` JWT middleware |
| `routes/predictions.js` | STAGE_DEADLINES, save/get predictions, DELETE single pred (admin) |
| `routes/results.js` | Admin: enter/clear match results incl. ET + penalty fields |
| `routes/leaderboard.js` | Scoring logic — POINTS map + SECOND_CHANCE map + calcPoints() |
| `routes/users.js` | Admin: list/add/reset users |
| `routes/auth.js` | Login, change-password |
| `public/css/style.css` | Orange (#FF6200) + navy (#003893) dark theme |
| `public/js/auth.js` | AUTH object, renderHeaderUser(), toggleMobileNav() |
| `public/js/main.js` | Stage tabs, match cards, predictions rendering, FLAGS map |
| `public/js/admin.js` | All admin panel logic |
| `public/js/leaderboard.js` | Leaderboard render + prize display |

## Database schema (matches table)
```
id, match_number, stage, group_letter, home_team, away_team, kickoff_cest, venue,
result_home, result_away,   ← 90-min score
et_home, et_away,           ← extra time score (nullable)
pen_home, pen_away          ← penalties score (nullable, display only)
```

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
- Start command: `node db/seed.js && node server.js`
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
