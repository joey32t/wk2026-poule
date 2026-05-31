const express = require('express');
const db = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { resolveScope } = require('../db/pools-helpers');

const router = express.Router();

// The bonus game ("Voorspel Vooraf") locks at the group-stage deadline.
// Keep in sync with STAGE_DEADLINES.group in routes/predictions.js.
const BONUS_DEADLINE = '2026-06-11T20:00:00+02:00';

// GET /api/bonus[?pool_id=2] – bonus predictions, scoped to a poule (visibility
// handled client-side, mirroring GET /api/predictions).
router.get('/bonus', requireAuth, (req, res) => {
  const scope = resolveScope(req);
  if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

  const select = `
    SELECT b.user_id, u.username, b.champion, b.top_scorer,
           b.champion_awarded, b.top_scorer_awarded, b.updated_at
    FROM bonus_predictions b
    JOIN users u ON u.id = b.user_id`;

  let rows;
  if (scope.userIds === null) {
    rows = db.prepare(`${select} ORDER BY u.username`).all();
  } else if (scope.userIds.length === 0) {
    rows = [];
  } else {
    const ph = scope.userIds.map(() => '?').join(',');
    rows = db.prepare(`${select} WHERE b.user_id IN (${ph}) ORDER BY u.username`).all(...scope.userIds);
  }
  res.json(rows);
});

// POST /api/bonus – save or update the caller's champion + top scorer.
router.post('/bonus', requireAuth, (req, res) => {
  if (new Date() >= new Date(BONUS_DEADLINE))
    return res.status(403).json({ error: 'Deadline verstreken – het bonusspel is vergrendeld' });

  const champion  = req.body.champion  != null ? String(req.body.champion).trim()  : '';
  const topScorer = req.body.top_scorer != null ? String(req.body.top_scorer).trim() : '';

  db.prepare(`
    INSERT INTO bonus_predictions (user_id, champion, top_scorer, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      champion   = excluded.champion,
      top_scorer = excluded.top_scorer,
      updated_at = CURRENT_TIMESTAMP
  `).run(req.user.id, champion, topScorer);

  res.json({ message: 'Bonusvoorspelling opgeslagen' });
});

// PUT /api/admin/bonus/:userId/award – admin manually awards the bonus points.
// Upserts so it works even if the user never submitted a bonus prediction.
router.put('/admin/bonus/:userId/award', requireAdmin, (req, res) => {
  const userId = parseInt(req.params.userId);
  const userRow = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!userRow) return res.status(404).json({ error: 'Gebruiker niet gevonden' });

  const champ  = req.body.champion_awarded   ? 1 : 0;
  const scorer = req.body.top_scorer_awarded ? 1 : 0;

  db.prepare(`
    INSERT INTO bonus_predictions (user_id, champion_awarded, top_scorer_awarded, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      champion_awarded   = excluded.champion_awarded,
      top_scorer_awarded = excluded.top_scorer_awarded,
      updated_at = CURRENT_TIMESTAMP
  `).run(userId, champ, scorer);

  res.json({ message: 'Bonuspunten bijgewerkt' });
});

module.exports = router;
