// Standalone sanity test for tournament.js (run: node test-tournament.js).
// Builds a synthetic but deterministic full tournament and verifies the pipeline:
// standings -> third-placed ranking -> Annex C assignment -> knockout cascade.

const SCHEDULE = require('./db/schedule');
const tournament = require('./tournament');
const annexC = require('./db/annexC');

let failures = 0;
const check = (cond, msg) => { if (!cond) { console.log('  ✗ ' + msg); failures++; } else console.log('  ✓ ' + msg); };

const rating = t => [...t].reduce((s, c) => s + c.charCodeAt(0), 0);

// Turn the schedule into DB-like rows and assign deterministic group results.
const matches = SCHEDULE.map(m => ({
  match_number: m.n, stage: m.stage, group_letter: m.group,
  home_team: m.home, away_team: m.away, home_source: m.homeSrc, away_source: m.awaySrc,
  result_home: null, result_away: null, et_home: null, et_away: null,
  pen_home: null, pen_away: null, is_manual: 0,
}));

for (const m of matches) {
  if (m.stage !== 'group') continue;
  let h = rating(m.home_team) % 4, a = rating(m.away_team) % 5;
  if (h === a) h += 1;
  m.result_home = h; m.result_away = a;
}

// ── Round 1: group standings + third ranking + Annex C key ──
let snap = tournament.build(matches);
console.log('Group stage:');
check(Object.keys(snap.standings).length === 12, '12 groups have standings');
check(Object.values(snap.standings).every(s => s._complete), 'all groups complete');
check(Object.values(snap.standings).every(s => s.length === 4), 'each group has 4 teams');
check(snap.thirdRanking.length === 12, '12 third-placed teams ranked');
check(snap.thirdRanking.filter(t => t.qualified).length === 8, 'exactly 8 thirds qualify');
check(!!snap.qualifiedKey && !!annexC[snap.qualifiedKey], `Annex C key "${snap.qualifiedKey}" exists in table`);

// Points monotonic within a sample group
const gA = snap.standings.A;
check(gA[0].Pts >= gA[1].Pts && gA[1].Pts >= gA[2].Pts && gA[2].Pts >= gA[3].Pts, 'group A sorted by points');

// ── R32 fully resolved ──
const r32 = matches.filter(m => m.stage === 'r32');
const r32Resolved = r32.every(m => snap.bracket[m.match_number].home && snap.bracket[m.match_number].away);
check(r32Resolved, 'all 16 R32 matches have both teams resolved');

// No team should face a team from its own group in the third-place slots (sanity)
// (Annex C guarantees this by construction; just assert teams differ.)
check(r32.every(m => snap.bracket[m.match_number].home !== snap.bracket[m.match_number].away), 'R32 home != away');

// ── Cascade: play every knockout round, home wins 1-0 each time ──
function playRound(stage) {
  for (const m of matches.filter(x => x.stage === stage)) {
    const b = snap.build ? null : snap.bracket[m.match_number];
    if (b && b.home && b.away) { m.result_home = 1; m.result_away = 0; }
  }
  snap = tournament.build(matches);
}
for (const stage of ['r32', 'r16', 'qf', 'sf']) playRound(stage);
// third place + final
for (const m of matches.filter(x => x.stage === '3rd' || x.stage === 'final')) {
  const b = snap.bracket[m.match_number];
  if (b && b.home && b.away) { m.result_home = 1; m.result_away = 0; }
}
snap = tournament.build(matches);

console.log('Knockout cascade:');
const finalM = matches.find(m => m.stage === 'final');
const fb = snap.bracket[finalM.match_number];
check(fb.home && fb.away, 'final has both finalists resolved');
check(!!fb.winner, 'champion determined: ' + fb.winner);
const third = matches.find(m => m.stage === '3rd');
check(!!snap.bracket[third.match_number].winner, 'third-place match resolved');

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
