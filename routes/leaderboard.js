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

// Bonus points for second-chance (ET) in knockout stages
const SECOND_CHANCE = {
  r32: 1, r16: 1, qf: 1, sf: 2, '3rd': 2, final: 2,
};

function calcPoints(stage, resultHome, resultAway, predHome, predAway, etHome, etAway) {
  const pts = POINTS[stage];
  if (!pts) return 0;

  const actualWinner = Math.sign(resultHome - resultAway);
  const predWinner   = Math.sign(predHome - predAway);

  let total = 0;
  if (predHome === resultHome && predAway === resultAway) total = pts.exact;
  else if (predWinner === actualWinner) total = pts.winner;

  // Second-chance bonus: only for knockout stages when ET was played
  const scPts = SECOND_CHANCE[stage];
  if (scPts && etHome !== null && etHome !== undefined && etAway !== null && etAway !== undefined) {
    const etWinner = Math.sign(etHome - etAway);

    if (predWinner === 0 && actualWinner === 0) {
      // Predicted draw AND 90-min was a draw → gets bonus (match went to ET)
      total += scPts;
    } else if (predWinner !== 0 && etWinner !== 0 && predWinner === etWinner) {
      // Predicted a team win AND that team won in ET → gets bonus
      total += scPts;
    }
  }

  return total;
}

router.get('/leaderboard', (_req, res) => {
  const users = db.prepare('SELECT id, username FROM users ORDER BY username').all();

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

    return { username: user.username, total, breakdown };
  });

  leaderboard.sort((a, b) => b.total - a.total);
  leaderboard.forEach((entry, i) => { entry.rank = i + 1; });

  res.json(leaderboard);
});

module.exports = router;
