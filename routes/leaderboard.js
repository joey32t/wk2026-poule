const express = require('express');
const db = require('../db/database');

const router = express.Router();

const POINTS = {
  group: { winner: 1, exact: 2 },
  r32:   { winner: 2, exact: 3 },
  r16:   { winner: 3, exact: 4 },
  qf:    { winner: 4, exact: 5 },
  sf:    { winner: 5, exact: 7 },
  '3rd': { winner: 5, exact: 7 },
  final: { winner: 10, exact: 15 },
};

function calcPoints(stage, resultHome, resultAway, predHome, predAway) {
  const pts = POINTS[stage];
  if (!pts) return 0;

  const actualWinner = Math.sign(resultHome - resultAway); // -1, 0, or 1
  const predWinner   = Math.sign(predHome - predAway);

  if (predHome === resultHome && predAway === resultAway) return pts.exact;
  if (predWinner === actualWinner) return pts.winner;
  return 0;
}

router.get('/leaderboard', (_req, res) => {
  const users = db.prepare('SELECT id, username FROM users ORDER BY username').all();

  // All matches with results entered
  const finishedMatches = db.prepare(
    'SELECT * FROM matches WHERE result_home IS NOT NULL AND result_away IS NOT NULL'
  ).all();

  const stageTotals = {};
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
        pred.pred_home, pred.pred_away
      );
      breakdown[match.stage] = (breakdown[match.stage] || 0) + pts;
      total += pts;
    }

    return { username: user.username, total, breakdown };
  });

  leaderboard.sort((a, b) => b.total - a.total);
  leaderboard.forEach((entry, i) => { entry.rank = i + 1; });

  res.json(leaderboard);
});

module.exports = router;
