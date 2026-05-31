const express = require('express');
const progression = require('./progression');

const router = express.Router();

// GET /api/standings – group tables, third-placed ranking and the resolved bracket.
router.get('/standings', (_req, res) => {
  const { standings, thirdRanking, qualifiedKey, bracket } = progression.snapshot();

  // Strip internal flags (_complete) and expose a clean shape.
  const groups = {};
  for (const g of Object.keys(standings)) {
    groups[g] = {
      complete: !!standings[g]._complete,
      rows: standings[g].map(r => ({
        team: r.team, position: r.position,
        P: r.P, W: r.W, D: r.D, L: r.L, GF: r.GF, GA: r.GA, GD: r.GD, Pts: r.Pts,
        tiebreakNote: !!r.tiebreakNote,
      })),
    };
  }

  res.json({ groups, thirdRanking, qualifiedKey, bracket });
});

module.exports = router;
