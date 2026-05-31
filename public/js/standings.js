if (!AUTH.requireLogin()) throw new Error('not logged in');
renderHeaderUser();

const STAGE_LABELS = {
  r32: 'Ronde van 32', r16: 'Ronde van 16', qf: 'Kwartfinale',
  sf: 'Halve Finale', '3rd': 'Troostfinale', final: 'Finale',
};
const KO_ORDER = ['r32', 'r16', 'qf', 'sf', '3rd', 'final'];

let DATA = null;     // /api/standings payload
let MATCHES = null;  // /api/matches (for the bracket view + scores)

async function init() {
  const [s, m] = await Promise.all([
    fetch('/api/standings').then(r => r.json()),
    fetch('/api/matches').then(r => r.json()),
  ]);
  DATA = s; MATCHES = m;
  document.getElementById('standings-loading').style.display = 'none';
  renderGroups();
  renderThirds();
  renderBracket();
}

function switchView(view) {
  document.querySelectorAll('.standings-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view));
  ['groups', 'thirds', 'bracket'].forEach(v =>
    document.getElementById('view-' + v).style.display = v === view ? '' : 'none');
}

// ─── Groups ──────────────────────────────────────────────────────────────────
function renderGroups() {
  const groups = DATA.groups;
  const html = Object.keys(groups).sort().map(letter => {
    const g = groups[letter];
    const rows = g.rows.map(r => {
      const posClass = r.position <= 2 ? 'qual' : (r.position === 3 ? 'maybe' : '');
      return `
        <tr class="${posClass}">
          <td class="st-pos">${r.position}</td>
          <td class="st-team">${flagImg(r.team)}<span>${r.team}</span>${r.tiebreakNote ? '<span class="st-note" title="Gelijk geëindigd – beslissing volgens fair-play/loting">*</span>' : ''}</td>
          <td>${r.P}</td>
          <td class="st-hide">${r.W}</td>
          <td class="st-hide">${r.D}</td>
          <td class="st-hide">${r.L}</td>
          <td class="st-gd">${r.GD > 0 ? '+' : ''}${r.GD}</td>
          <td class="st-pts">${r.Pts}</td>
        </tr>`;
    }).join('');
    return `
      <div class="group-card">
        <div class="group-card-title">Groep ${letter}${g.complete ? '' : ' <span class="st-live">loopt</span>'}</div>
        <table class="group-table">
          <thead><tr>
            <th></th><th>Team</th><th>W</th>
            <th class="st-hide">G</th><th class="st-hide">L</th><th class="st-hide">V</th>
            <th>DS</th><th>Ptn</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');
  document.getElementById('view-groups').innerHTML =
    `<div class="group-grid">${html}</div>
     <div class="st-legend"><span class="dot qual"></span>Geplaatst (1e/2e)
       <span class="dot maybe"></span>Mogelijk via beste nr. 3
       <span class="st-star">*</span> = gelijk, beslist via fair-play/loting</div>`;
}

// ─── Best third-placed ───────────────────────────────────────────────────────
function renderThirds() {
  const t = DATA.thirdRanking;
  if (!t.length) {
    document.getElementById('view-thirds').innerHTML =
      '<div class="st-empty">Nog geen volledige groepen — ranglijst van de nummers 3 verschijnt zodra er groepen zijn afgerond.</div>';
    return;
  }
  const rows = t.map(x => `
    <tr class="${x.qualified ? 'qual' : 'out'}">
      <td class="st-pos">${x.rank}</td>
      <td class="st-team">${flagImg(x.team)}<span>${x.team}</span></td>
      <td class="st-hide">${x.group}</td>
      <td>${x.Pts}</td>
      <td class="st-gd">${x.GD > 0 ? '+' : ''}${x.GD}</td>
      <td>${x.GF}</td>
      <td class="st-badge">${x.qualified ? '✓' : '—'}</td>
    </tr>`).join('');
  document.getElementById('view-thirds').innerHTML = `
    <div class="group-card">
      <div class="group-card-title">Ranglijst nummers 3 — beste 8 plaatsen zich</div>
      <table class="group-table">
        <thead><tr><th></th><th>Team</th><th class="st-hide">Grp</th><th>Ptn</th><th>DS</th><th>DV</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─── Bracket / schema ────────────────────────────────────────────────────────
function renderBracket() {
  const ko = MATCHES.filter(m => m.stage !== 'group');
  const html = KO_ORDER.map(stage => {
    const ms = ko.filter(m => m.stage === stage).sort((a, b) => a.match_number - b.match_number);
    if (!ms.length) return '';
    const cards = ms.map(m => {
      const played = m.result_home !== null && m.result_away !== null;
      const score = played ? `${m.result_home}–${m.result_away}` : 'vs';
      const extra = played && m.pen_home !== null ? `<span class="br-pen">pen ${m.pen_home}–${m.pen_away}</span>` : '';
      const win = DATA.bracket[m.match_number] && DATA.bracket[m.match_number].winner;
      const side = (team) => `
        <div class="br-team ${win && team === win ? 'br-win' : ''}">
          ${flagImg(team)}<span>${team}</span>
        </div>`;
      return `
        <div class="br-match">
          <div class="br-num">W${m.match_number}</div>
          ${side(m.home_team)}
          <div class="br-score">${score}${extra ? '<br>' + extra : ''}</div>
          ${side(m.away_team)}
        </div>`;
    }).join('');
    return `<div class="br-round"><div class="br-round-title">${STAGE_LABELS[stage]}</div><div class="br-grid">${cards}</div></div>`;
  }).join('');
  document.getElementById('view-bracket').innerHTML = html;
}

init();
