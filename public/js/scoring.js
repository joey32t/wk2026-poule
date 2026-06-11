// Shared scoring logic — single source of truth for both the server (rankings,
// routes/leaderboard.js) and the browser (per-prediction points + colours).
// UMD wrapper: exposes module.exports in Node and window.SCORING in the browser,
// so the exact same point system drives the leaderboard AND the on-screen pills.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // Node
  else root.SCORING = api;                                                   // browser → window.SCORING
})(typeof self !== 'undefined' ? self : this, function () {
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

      if (predWinner === 0 && actualWinner === 0 && etWinner === 0) {
        // Predicted draw AND still draw after 120 min (went to penalties)
        total += scPts;
      } else if (predWinner !== 0 && etWinner !== 0 && predWinner === etWinner) {
        // Predicted a team win AND that team won in ET → gets bonus
        total += scPts;
      }
    }

    return total;
  }

  // Presentational helper shared by both browser pages (matches + admin overview):
  // points earned for a scored prediction as a coloured pill. Pure string builder, so
  // it's harmless in Node. Tier: green = exact score, orange = winner/partial (incl. ET
  // bonus), muted = 0. `match` carries stage + result_home/away + et_home/away.
  function predPointsPill(match, pred) {
    const earned = calcPoints(
      match.stage, match.result_home, match.result_away,
      pred.pred_home, pred.pred_away, match.et_home, match.et_away
    );
    const exact = (POINTS[match.stage] || {}).exact;
    const tier = earned === 0 ? 'zero' : (earned === exact ? 'exact' : 'win');
    return '<span class="pred-points ' + tier + '">+' + earned + '</span>';
  }

  return { POINTS, SECOND_CHANCE, calcPoints, predPointsPill };
});
