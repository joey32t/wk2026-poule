// Tournament progression logic for the 2026 World Cup (48 teams, 12 groups).
//
// Pure functions — no database access. The caller passes in the full list of
// match rows (as stored in the `matches` table) and receives:
//   • group standings with FIFA tiebreakers,
//   • the ranking of the 12 third-placed teams (best 8 qualify),
//   • the resolved knockout bracket (which real team fills each slot).
//
// Slot source codes (stored in matches.home_source / away_source):
//   1X      winner of group X
//   2X      runner-up of group X
//   3:POOL  best third-placed team from POOL (assigned via Annex C)
//   W##     winner of match ##
//   L##     loser of match ##

const annexC = require('./db/annexC');

const GROUPS = 'ABCDEFGHIJKL'.split('');

// ─── Group standings ────────────────────────────────────────────────────────

// Build an empty stats row for a team.
function blankRow(team) {
  return { team, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
}

// Accumulate one finished match into two stat rows.
function applyMatch(rows, home, away, gh, ga) {
  const h = rows[home], a = rows[away];
  h.P++; a.P++;
  h.GF += gh; h.GA += ga; a.GF += ga; a.GA += gh;
  if (gh > ga)      { h.W++; a.L++; h.Pts += 3; }
  else if (gh < ga) { a.W++; h.L++; a.Pts += 3; }
  else              { h.D++; a.D++; h.Pts++; a.Pts++; }
  h.GD = h.GF - h.GA; a.GD = a.GF - a.GA;
}

function isFinished(m) {
  return m.result_home !== null && m.result_home !== undefined &&
         m.result_away !== null && m.result_away !== undefined;
}

// Compare two rows on overall points → GD → goals scored. Returns <0 / 0 / >0.
function cmpOverall(a, b) {
  return (b.Pts - a.Pts) || (b.GD - a.GD) || (b.GF - a.GF);
}

// Head-to-head mini-table among a set of tied teams, using only the matches
// played between them. Returns a comparison value (Pts → GD → GF in that subset).
function headToHead(tiedTeams, groupMatches) {
  const set = new Set(tiedTeams);
  const mini = {};
  tiedTeams.forEach(t => { mini[t] = blankRow(t); });
  for (const m of groupMatches) {
    if (!isFinished(m)) continue;
    if (set.has(m.home_team) && set.has(m.away_team)) {
      applyMatch(mini, m.home_team, m.away_team, m.result_home, m.result_away);
    }
  }
  return mini;
}

// Compute the standings for a single group. Returns rows sorted best→worst with
// a `position` (1-based) and a `tiebreakNote` when order could not be fully
// resolved by the criteria we can compute (cards / drawing of lots are unknown).
function groupStandings(groupMatches) {
  const teams = new Set();
  groupMatches.forEach(m => { teams.add(m.home_team); teams.add(m.away_team); });
  const rows = {};
  [...teams].forEach(t => { rows[t] = blankRow(t); });

  for (const m of groupMatches) {
    if (isFinished(m)) applyMatch(rows, m.home_team, m.away_team, m.result_home, m.result_away);
  }

  let list = Object.values(rows);
  list.sort((a, b) => cmpOverall(a, b) || a.team.localeCompare(b.team));

  // Resolve ties (equal on Pts/GD/GF) via head-to-head, then flag if still tied.
  let needsResolution = false;
  for (let i = 0; i < list.length;) {
    let j = i + 1;
    while (j < list.length && cmpOverall(list[i], list[j]) === 0) j++;
    if (j - i > 1) {
      const tied = list.slice(i, j).map(r => r.team);
      const mini = headToHead(tied, groupMatches);
      const sortedTied = list.slice(i, j).sort((a, b) => {
        const ma = mini[a.team], mb = mini[b.team];
        return (mb.Pts - ma.Pts) || (mb.GD - ma.GD) || (mb.GF - ma.GF) || a.team.localeCompare(b.team);
      });
      // Detect teams that remain perfectly level even after head-to-head.
      for (let k = i; k < j; k++) {
        const cur = mini[sortedTied[k - i].team];
        const prev = k > i ? mini[sortedTied[k - 1 - i].team] : null;
        if (prev && cur.Pts === prev.Pts && cur.GD === prev.GD && cur.GF === prev.GF) needsResolution = true;
      }
      for (let k = i; k < j; k++) list[k] = sortedTied[k - i];
    }
    i = j;
  }

  list.forEach((r, idx) => { r.position = idx + 1; });
  if (needsResolution) list.forEach(r => { r.tiebreakNote = true; });
  return list;
}

// Has every match in this group been played?
function groupComplete(groupMatches) {
  return groupMatches.length > 0 && groupMatches.every(isFinished);
}

// ─── Third-placed ranking ───────────────────────────────────────────────────

// Rank the third-placed teams across all complete groups. FIFA ranks them by
// overall Pts → GD → GF (no head-to-head, since they are from different groups).
function rankThirds(standingsByGroup) {
  const thirds = [];
  for (const g of GROUPS) {
    const st = standingsByGroup[g];
    if (st && st.length >= 3 && st._complete) thirds.push({ group: g, ...st[2] });
  }
  thirds.sort((a, b) => cmpOverall(a, b) || a.group.localeCompare(b.group));
  thirds.forEach((t, i) => { t.rank = i + 1; t.qualified = i < 8; });
  return thirds;
}

// ─── Slot resolution ────────────────────────────────────────────────────────

// Decide the winner & loser of a knockout match given its two (resolved) teams.
// Uses penalties → extra-time score → 90-minute score, whichever is decisive.
function decideWinnerLoser(m, home, away) {
  if (!home || !away) return null;
  const dec = (h, a) => h > a ? [home, away] : [away, home];
  if (m.pen_home != null && m.pen_away != null && m.pen_home !== m.pen_away) return dec(m.pen_home, m.pen_away);
  const fh = (m.et_home != null) ? m.et_home : m.result_home;
  const fa = (m.et_away != null) ? m.et_away : m.result_away;
  if (fh != null && fa != null && fh !== fa) return dec(fh, fa);
  return null; // undecided (draw without penalties)
}

// Build everything: standings, third ranking, and the resolved bracket.
//   matches: all rows from the `matches` table.
// Returns { standings, thirdRanking, qualifiedKey, bracket }
//   bracket: { [match_number]: { home, away, winner, loser } } (null where unknown)
function build(matches) {
  const byNumber = {};
  matches.forEach(m => { byNumber[m.match_number] = m; });

  // 1. Group standings
  const standings = {};
  const winners = {}, runners = {}, thirds = {};
  for (const g of GROUPS) {
    const gm = matches.filter(m => m.stage === 'group' && m.group_letter === g);
    const st = groupStandings(gm);
    st._complete = groupComplete(gm);
    standings[g] = st;
    if (st._complete) {
      winners[g] = st[0] && st[0].team;
      runners[g] = st[1] && st[1].team;
      thirds[g]  = st[2] && st[2].team;
    }
  }

  // 2. Third-placed ranking → best eight → Annex C key
  const thirdRanking = rankThirds(standings);
  const qualifiedThirdGroups = thirdRanking.filter(t => t.qualified).map(t => t.group);
  const allThirdsKnown = thirdRanking.length === 12 && qualifiedThirdGroups.length === 8;
  const qualifiedKey = allThirdsKnown ? [...qualifiedThirdGroups].sort().join('') : null;
  const annexRow = qualifiedKey ? annexC[qualifiedKey] : null;

  // 3. Resolve the bracket in match-number order (feeders always have lower numbers)
  const winnerOf = {}, loserOf = {};
  const bracket = {};

  const resolveSlot = (src) => {
    if (!src) return null;
    let m;
    if ((m = src.match(/^1([A-L])$/))) return winners[m[1]] || null;
    if ((m = src.match(/^2([A-L])$/))) return runners[m[1]] || null;
    if ((m = src.match(/^W(\d+)$/)))   return winnerOf[m[1]] || null;
    if ((m = src.match(/^L(\d+)$/)))   return loserOf[m[1]] || null;
    return null; // 3:POOL handled separately (needs the home winner's group)
  };

  const knockout = matches
    .filter(m => m.stage !== 'group')
    .sort((a, b) => a.match_number - b.match_number);

  for (const m of knockout) {
    let home = resolveSlot(m.home_source);
    let away = resolveSlot(m.away_source);

    // A "3:POOL" slot is the team facing a group winner. Its group is decided by
    // Annex C, keyed on the qualifying combination and the opposing winner's group.
    const thirdSide = (src, otherSrc) => {
      const tm = src && src.match(/^3:([A-L]+)$/);
      if (!tm) return undefined;
      const wm = otherSrc && otherSrc.match(/^1([A-L])$/);
      if (!annexRow || !wm) return null;          // not yet determinable
      const thirdGroup = annexRow[wm[1]];
      return thirds[thirdGroup] || null;
    };
    const th = thirdSide(m.home_source, m.away_source);
    if (th !== undefined) home = th;
    const ta = thirdSide(m.away_source, m.home_source);
    if (ta !== undefined) away = ta;

    bracket[m.match_number] = { home, away, winner: null, loser: null };

    if (home && away && isFinished(m)) {
      const wl = decideWinnerLoser(m, home, away);
      if (wl) {
        winnerOf[m.match_number] = wl[0];
        loserOf[m.match_number]  = wl[1];
        bracket[m.match_number].winner = wl[0];
        bracket[m.match_number].loser  = wl[1];
      }
    }
  }

  return { standings, thirdRanking, qualifiedKey, bracket };
}

module.exports = { build, groupStandings, GROUPS };
