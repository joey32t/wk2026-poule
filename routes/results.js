const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/admin/results  – enter or update a match result
router.post('/results', requireAdmin, (req, res) => {
  const { match_id, result_home, result_away } = req.body;

  if (match_id == null || result_home == null || result_away == null)
    return res.status(400).json({ error: 'match_id, result_home en result_away zijn verplicht' });
  if (!Number.isInteger(result_home) || !Number.isInteger(result_away) || result_home < 0 || result_away < 0)
    return res.status(400).json({ error: 'Scores moeten gehele niet-negatieve getallen zijn' });

  const match = db.prepare('SELECT id FROM matches WHERE id = ?').get(match_id);
  if (!match) return res.status(404).json({ error: 'Wedstrijd niet gevonden' });

  db.prepare(
    'UPDATE matches SET result_home = ?, result_away = ? WHERE id = ?'
  ).run(result_home, result_away, match_id);

  res.json({ message: 'Resultaat opgeslagen' });
});

// DELETE /api/admin/results/:match_id – clear a result
router.delete('/results/:match_id', requireAdmin, (req, res) => {
  db.prepare(
    'UPDATE matches SET result_home = NULL, result_away = NULL WHERE id = ?'
  ).run(req.params.match_id);
  res.json({ message: 'Resultaat verwijderd' });
});

// PUT /api/admin/matches/:id – update team names for knockout TBD matches
router.put('/matches/:id', requireAdmin, (req, res) => {
  const { home_team, away_team } = req.body;
  if (!home_team || !away_team)
    return res.status(400).json({ error: 'home_team en away_team zijn verplicht' });

  db.prepare(
    'UPDATE matches SET home_team = ?, away_team = ? WHERE id = ?'
  ).run(home_team, away_team, req.params.id);
  res.json({ message: 'Teamnamen bijgewerkt' });
});

module.exports = router;
