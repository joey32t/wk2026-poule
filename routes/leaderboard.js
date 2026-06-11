const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { resolveScope } = require('../db/pools-helpers');
// Scoring (POINTS / SECOND_CHANCE / calcPoints) lives in the shared module so the
// leaderboard and the on-screen per-prediction pills use the exact same point system.
const { calcPoints } = require('../public/js/scoring');

const router = express.Router();

router.get('/leaderboard', requireAuth, (req, res) => {
  const scope = resolveScope(req);
  if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

  let users;
  if (scope.userIds === null) {
    users = db.prepare('SELECT id, username FROM users ORDER BY username').all();
  } else if (scope.userIds.length === 0) {
    users = [];
  } else {
    const ph = scope.userIds.map(() => '?').join(',');
    users = db.prepare(`SELECT id, username FROM users WHERE id IN (${ph}) ORDER BY username`)
      .all(...scope.userIds);
  }

  const finishedMatches = db.prepare(
    'SELECT * FROM matches WHERE result_home IS NOT NULL AND result_away IS NOT NULL'
  ).all();

  const leaderboard = users.map(user => {
    const breakdown = {};
    let total = 0;

    for (const match of finishedMatches) {
      const pred = db.prepare(
        'SELECT * FROM predictions WHERE user_id = ? AND match_id = ?'
      ).get(user.id, match.id);
      if (!pred) continue;

      const pts = calcPoints(
        match.stage, match.result_home, match.result_away,
        pred.pred_home, pred.pred_away,
        match.et_home, match.et_away
      );
      breakdown[match.stage] = (breakdown[match.stage] || 0) + pts;
      total += pts;
    }

    // Bonus game ("Voorspel Vooraf") — admin-awarded champion (20) + top scorer (15)
    const bonus = db.prepare(
      'SELECT champion_awarded, top_scorer_awarded FROM bonus_predictions WHERE user_id = ?'
    ).get(user.id);
    const bonusPts = (bonus && bonus.champion_awarded ? 20 : 0)
                   + (bonus && bonus.top_scorer_awarded ? 15 : 0);
    if (bonusPts) {
      breakdown.bonus = bonusPts;
      total += bonusPts;
    }

    return { username: user.username, total, breakdown };
  });

  leaderboard.sort((a, b) => b.total - a.total);
  leaderboard.forEach((entry, i) => { entry.rank = i + 1; });

  res.json(leaderboard);
});

module.exports = router;
