const express = require('express');
const db = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Stage deadlines in CEST (ISO strings). Predictions locked at this time.
const STAGE_DEADLINES = {
  group: '2026-06-11T20:00:00+02:00',
  r32:   '2026-06-28T20:00:00+02:00',
  r16:   '2026-07-04T18:00:00+02:00',
  qf:    '2026-07-09T21:00:00+02:00',
  sf:    '2026-07-14T20:00:00+02:00',
  '3rd': '2026-07-18T22:00:00+02:00',
  final: '2026-07-19T20:00:00+02:00',
};

// GET /api/matches?stage=group&group=F  OR  ?stage=r32  etc.
router.get('/matches', (req, res) => {
  const { stage, group } = req.query;
  let matches;
  if (stage === 'group' && group) {
    matches = db.prepare(
      'SELECT * FROM matches WHERE stage = ? AND group_letter = ? ORDER BY match_number'
    ).all('group', group.toUpperCase());
  } else if (stage) {
    matches = db.prepare(
      'SELECT * FROM matches WHERE stage = ? ORDER BY match_number'
    ).all(stage);
  } else {
    matches = db.prepare('SELECT * FROM matches ORDER BY match_number').all();
  }
  res.json(matches);
});

// GET /api/predictions?match_id=31  – returns all user predictions for a match
router.get('/predictions', (req, res) => {
  const { match_id } = req.query;
  if (!match_id) return res.status(400).json({ error: 'match_id vereist' });

  const preds = db.prepare(`
    SELECT p.id, p.user_id, u.username, p.match_id, p.pred_home, p.pred_away, p.updated_at
    FROM predictions p
    JOIN users u ON u.id = p.user_id
    WHERE p.match_id = ?
    ORDER BY u.username
  `).all(match_id);
  res.json(preds);
});

// POST /api/predictions – save or update own prediction
router.post('/predictions', requireAuth, (req, res) => {
  const { match_id, pred_home, pred_away } = req.body;

  if (match_id == null || pred_home == null || pred_away == null)
    return res.status(400).json({ error: 'match_id, pred_home en pred_away zijn verplicht' });
  if (!Number.isInteger(pred_home) || !Number.isInteger(pred_away) || pred_home < 0 || pred_away < 0)
    return res.status(400).json({ error: 'Scores moeten gehele niet-negatieve getallen zijn' });

  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(match_id);
  if (!match) return res.status(404).json({ error: 'Wedstrijd niet gevonden' });

  const deadline = STAGE_DEADLINES[match.stage];
  if (deadline && new Date() >= new Date(deadline))
    return res.status(403).json({ error: 'Deadline verstreken – voorspellingen zijn vergrendeld' });

  db.prepare(`
    INSERT INTO predictions (user_id, match_id, pred_home, pred_away, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, match_id) DO UPDATE SET
      pred_home  = excluded.pred_home,
      pred_away  = excluded.pred_away,
      updated_at = CURRENT_TIMESTAMP
  `).run(req.user.id, match_id, pred_home, pred_away);

  res.json({ message: 'Voorspelling opgeslagen' });
});

// GET /api/deadlines – return all stage deadlines for frontend countdown
router.get('/deadlines', (_req, res) => {
  res.json(STAGE_DEADLINES);
});

// DELETE /api/predictions?stage=all|group|r32|... OR ?match_id=X  (admin only)
router.delete('/predictions', requireAdmin, (req, res) => {
  const { stage, match_id } = req.query;
  if (match_id) {
    db.prepare('DELETE FROM predictions WHERE match_id = ?').run(match_id);
  } else if (stage === 'all') {
    db.prepare('DELETE FROM predictions').run();
  } else if (stage) {
    db.prepare('DELETE FROM predictions WHERE match_id IN (SELECT id FROM matches WHERE stage = ?)').run(stage);
  } else {
    return res.status(400).json({ error: 'stage of match_id vereist' });
  }
  res.json({ message: 'Voorspellingen verwijderd' });
});

module.exports = router;
