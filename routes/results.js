const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const progression = require('./progression');

const router = express.Router();

// POST /api/admin/results  – enter or update a match result (+ optional ET/pen)
router.post('/results', requireAdmin, (req, res) => {
  const { match_id, result_home, result_away, et_home, et_away, pen_home, pen_away } = req.body;

  if (match_id == null || result_home == null || result_away == null)
    return res.status(400).json({ error: 'match_id, result_home en result_away zijn verplicht' });
  if (!Number.isInteger(result_home) || !Number.isInteger(result_away) || result_home < 0 || result_away < 0)
    return res.status(400).json({ error: 'Scores moeten gehele niet-negatieve getallen zijn' });

  const match = db.prepare('SELECT id FROM matches WHERE id = ?').get(match_id);
  if (!match) return res.status(404).json({ error: 'Wedstrijd niet gevonden' });

  const etH  = (et_home  != null && et_home  !== '') ? parseInt(et_home)  : null;
  const etA  = (et_away  != null && et_away  !== '') ? parseInt(et_away)  : null;
  const penH = (pen_home != null && pen_home !== '') ? parseInt(pen_home) : null;
  const penA = (pen_away != null && pen_away !== '') ? parseInt(pen_away) : null;

  db.prepare(
    'UPDATE matches SET result_home=?, result_away=?, et_home=?, et_away=?, pen_home=?, pen_away=? WHERE id=?'
  ).run(result_home, result_away, etH, etA, penH, penA, match_id);

  progression.recompute(); // auto-advance teams into the next round

  res.json({ message: 'Resultaat opgeslagen' });
});

// DELETE /api/admin/results/:match_id – clear a result (including ET/pen)
router.delete('/results/:match_id', requireAdmin, (req, res) => {
  db.prepare(
    'UPDATE matches SET result_home=NULL, result_away=NULL, et_home=NULL, et_away=NULL, pen_home=NULL, pen_away=NULL WHERE id=?'
  ).run(req.params.match_id);

  progression.recompute(); // roll the bracket back where it can no longer be decided

  res.json({ message: 'Resultaat verwijderd' });
});

// PUT /api/admin/matches/:id – manually override team names for a knockout match.
// Sets is_manual so auto-progression leaves this match alone afterwards.
router.put('/matches/:id', requireAdmin, (req, res) => {
  const { home_team, away_team } = req.body;
  if (!home_team || !away_team)
    return res.status(400).json({ error: 'home_team en away_team zijn verplicht' });

  db.prepare(
    'UPDATE matches SET home_team = ?, away_team = ?, is_manual = 1 WHERE id = ?'
  ).run(home_team, away_team, req.params.id);
  res.json({ message: 'Teamnamen bijgewerkt (handmatig)' });
});

// POST /api/admin/matches/:id/auto – drop a manual override and let the bracket
// logic fill this match automatically again.
router.post('/matches/:id/auto', requireAdmin, (req, res) => {
  db.prepare('UPDATE matches SET is_manual = 0 WHERE id = ?').run(req.params.id);
  progression.recompute();
  res.json({ message: 'Wedstrijd weer op automatisch gezet' });
});

module.exports = router;
