// Admin panel — only accessible to admins
if (!AUTH.requireLogin()) throw new Error('not logged in');
const user = AUTH.getUser();
if (!user || !user.is_admin) {
  alert('Geen toegang. Alleen de admin heeft toegang tot deze pagina.');
  window.location.href = '/';
  throw new Error('not admin');
}
renderHeaderUser();

const STAGE_LABELS = {
  group: 'Groep', r32: 'Ronde van 32', r16: 'Ronde van 16',
  qf: 'Kwartfinale', sf: 'Halve Finale', '3rd': '3e Plaats', final: 'Finale'
};

const KNOCKOUT_STAGES = new Set(['r32', 'r16', 'qf', 'sf', '3rd', 'final']);

let allMatches = [];

async function init() {
  await AUTH.initPool();
  const res = await fetch('/api/matches');
  allMatches = await res.json();
  populateMatchSelects();
  loadUsers();
  loadPoolsAdmin();
  loadBonusAdmin();
}

function populateMatchSelects() {
  const resultSel = document.getElementById('result-match-select');
  const teamSel   = document.getElementById('team-match-select');

  allMatches.forEach(m => {
    const label = `W${m.match_number}: ${m.home_team} vs ${m.away_team} (${STAGE_LABELS[m.stage] || m.stage})`;
    const opt1 = new Option(label, m.id);
    resultSel.add(opt1);

    if (m.stage !== 'group') {
      const opt2 = new Option(label, m.id);
      teamSel.add(opt2);
    }
  });
}

// ─── Result Section ───────────────────────────────────────────────────────────
function onMatchSelect() {
  const id = parseInt(document.getElementById('result-match-select').value);
  const match = allMatches.find(m => m.id === id);
  const teamsEl = document.getElementById('result-teams');
  const etSection = document.getElementById('et-section');

  if (match) {
    let info = `${match.home_team} vs ${match.away_team}`;
    if (match.result_home !== null) {
      info += ` · Uitslag: ${match.result_home}–${match.result_away}`;
      if (match.et_home !== null) info += ` (v.v. ${match.et_home}–${match.et_away})`;
      if (match.pen_home !== null) info += ` (pen. ${match.pen_home}–${match.pen_away})`;
    }
    teamsEl.textContent = info;
    document.getElementById('result-home').value = match.result_home ?? '';
    document.getElementById('result-away').value = match.result_away ?? '';

    // Show ET/pen fields only for knockout matches
    if (KNOCKOUT_STAGES.has(match.stage)) {
      etSection.style.display = '';
      document.getElementById('result-et-home').value = match.et_home ?? '';
      document.getElementById('result-et-away').value = match.et_away ?? '';
      document.getElementById('result-pen-home').value = match.pen_home ?? '';
      document.getElementById('result-pen-away').value = match.pen_away ?? '';
    } else {
      etSection.style.display = 'none';
    }
  } else {
    teamsEl.textContent = '';
    etSection.style.display = 'none';
  }
}

async function saveResult() {
  const matchId    = parseInt(document.getElementById('result-match-select').value);
  const resultHome = parseInt(document.getElementById('result-home').value);
  const resultAway = parseInt(document.getElementById('result-away').value);
  const successEl  = document.getElementById('result-success');
  const errorEl    = document.getElementById('result-error');
  successEl.classList.remove('show');
  errorEl.classList.remove('show');

  if (!matchId || isNaN(resultHome) || isNaN(resultAway)) {
    errorEl.textContent = 'Selecteer een wedstrijd en voer geldige scores in.';
    errorEl.classList.add('show');
    return;
  }

  const match = allMatches.find(m => m.id === matchId);
  const body = { match_id: matchId, result_home: resultHome, result_away: resultAway };

  // Include ET/pen if visible and filled in
  if (match && KNOCKOUT_STAGES.has(match.stage)) {
    const etH = document.getElementById('result-et-home').value;
    const etA = document.getElementById('result-et-away').value;
    const penH = document.getElementById('result-pen-home').value;
    const penA = document.getElementById('result-pen-away').value;
    body.et_home  = etH  !== '' ? parseInt(etH)  : null;
    body.et_away  = etA  !== '' ? parseInt(etA)  : null;
    body.pen_home = penH !== '' ? parseInt(penH) : null;
    body.pen_away = penA !== '' ? parseInt(penA) : null;
  }

  const res = await fetch('/api/admin/results', {
    method: 'POST',
    headers: AUTH.headers(),
    body: JSON.stringify(body)
  });
  const data = await res.json();

  if (!res.ok) {
    errorEl.textContent = data.error;
    errorEl.classList.add('show');
  } else {
    successEl.textContent = 'Uitslag opgeslagen!';
    successEl.classList.add('show');
    // Update local cache
    const idx = allMatches.findIndex(m => m.id === matchId);
    if (idx >= 0) {
      Object.assign(allMatches[idx], {
        result_home: resultHome, result_away: resultAway,
        et_home: body.et_home ?? null, et_away: body.et_away ?? null,
        pen_home: body.pen_home ?? null, pen_away: body.pen_away ?? null,
      });
    }
    onMatchSelect();
  }
}

async function clearResult() {
  const matchId = parseInt(document.getElementById('result-match-select').value);
  if (!matchId) return;
  if (!confirm('Uitslag wissen voor deze wedstrijd?')) return;

  const successEl = document.getElementById('result-success');
  const errorEl   = document.getElementById('result-error');
  successEl.classList.remove('show');
  errorEl.classList.remove('show');

  const res = await fetch(`/api/admin/results/${matchId}`, {
    method: 'DELETE',
    headers: AUTH.headers()
  });
  const data = await res.json();

  if (!res.ok) {
    errorEl.textContent = data.error;
    errorEl.classList.add('show');
  } else {
    successEl.textContent = 'Uitslag gewist.';
    successEl.classList.add('show');
    const idx = allMatches.findIndex(m => m.id === matchId);
    if (idx >= 0) {
      allMatches[idx].result_home = null; allMatches[idx].result_away = null;
      allMatches[idx].et_home = null; allMatches[idx].et_away = null;
      allMatches[idx].pen_home = null; allMatches[idx].pen_away = null;
    }
    onMatchSelect();
  }
}

// ─── Team Names Section ───────────────────────────────────────────────────────
function onTeamMatchSelect() {
  const id = parseInt(document.getElementById('team-match-select').value);
  const match = allMatches.find(m => m.id === id);
  if (match) {
    document.getElementById('team-home').value = match.home_team;
    document.getElementById('team-away').value = match.away_team;
  }
}

async function saveTeams() {
  const matchId   = parseInt(document.getElementById('team-match-select').value);
  const homeTeam  = document.getElementById('team-home').value.trim();
  const awayTeam  = document.getElementById('team-away').value.trim();
  const successEl = document.getElementById('team-success');
  const errorEl   = document.getElementById('team-error');
  successEl.classList.remove('show');
  errorEl.classList.remove('show');

  if (!matchId || !homeTeam || !awayTeam) {
    errorEl.textContent = 'Selecteer een wedstrijd en vul beide teamnamen in.';
    errorEl.classList.add('show');
    return;
  }

  const res = await fetch(`/api/admin/matches/${matchId}`, {
    method: 'PUT',
    headers: AUTH.headers(),
    body: JSON.stringify({ home_team: homeTeam, away_team: awayTeam })
  });
  const data = await res.json();

  if (!res.ok) {
    errorEl.textContent = data.error;
    errorEl.classList.add('show');
  } else {
    successEl.textContent = 'Teamnamen bijgewerkt!';
    successEl.classList.add('show');
    const idx = allMatches.findIndex(m => m.id === matchId);
    if (idx >= 0) { allMatches[idx].home_team = homeTeam; allMatches[idx].away_team = awayTeam; }
    document.getElementById('result-match-select').innerHTML = '<option value="">— Kies een wedstrijd —</option>';
    document.getElementById('team-match-select').innerHTML = '<option value="">— Kies een wedstrijd —</option>';
    populateMatchSelects();
  }
}

// ─── Users Section ────────────────────────────────────────────────────────────
async function loadUsers() {
  const res = await fetch('/api/admin/users', { headers: AUTH.headers() });
  const users = await res.json();
  const list = document.getElementById('users-list');
  list.innerHTML = users.map(u => `
    <li>
      <div class="user-info">
        ${u.is_admin ? '<span class="admin-crown">👑</span>' : ''}
        <strong>${u.username}</strong>
        <span style="font-size:0.72rem;color:var(--text-muted)">${u.is_admin ? 'Admin' : 'Deelnemer'}</span>
      </div>
      <button class="btn-sm" onclick="resetPassword(${u.id}, '${u.username}')">Reset wachtwoord</button>
    </li>
  `).join('');
}

async function addUser() {
  const username  = document.getElementById('new-username').value.trim();
  const password  = document.getElementById('new-password').value;
  const successEl = document.getElementById('user-success');
  const errorEl   = document.getElementById('user-error');
  successEl.classList.remove('show');
  errorEl.classList.remove('show');

  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: AUTH.headers(),
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();

  if (!res.ok) {
    errorEl.textContent = data.error;
    errorEl.classList.add('show');
  } else {
    successEl.textContent = `${username} toegevoegd! Tijdelijk wachtwoord: ${password}`;
    successEl.classList.add('show');
    document.getElementById('new-username').value = '';
    document.getElementById('new-password').value = '';
    loadUsers();
  }
}

async function resetPassword(userId, username) {
  const newPw = prompt(`Nieuw wachtwoord voor ${username}:`);
  if (!newPw) return;

  const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
    method: 'PUT',
    headers: AUTH.headers(),
    body: JSON.stringify({ new_password: newPw })
  });
  const data = await res.json();
  alert(res.ok ? `Wachtwoord van ${username} gereset.` : data.error);
}

// ─── View All Predictions ─────────────────────────────────────────────────────
async function loadAdminPredictions() {
  const stage = document.getElementById('view-pred-stage').value;
  const container = document.getElementById('admin-pred-table');
  if (!stage) { container.innerHTML = ''; return; }

  container.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">Laden...</div>';

  let url = `/api/matches?stage=${stage}`;
  const matchRes = await fetch(url);
  const matches = await matchRes.json();

  if (!matches.length) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">Geen wedstrijden gevonden.</div>';
    return;
  }

  // Fetch predictions for all matches (scoped to the selected poule via the header switcher)
  const predResults = await Promise.all(
    matches.map(m => fetch(`/api/predictions?match_id=${m.id}&${AUTH.poolQuery()}`, { headers: AUTH.headers() }).then(r => r.json()))
  );

  // Collect all unique usernames
  const allUsers = [...new Set(predResults.flat().map(p => p.username))].sort();

  if (!allUsers.length) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">Nog geen voorspellingen.</div>';
    return;
  }

  // Build lookup: match_id -> username -> prediction
  const predMap = {};
  matches.forEach((m, i) => {
    predMap[m.id] = {};
    predResults[i].forEach(p => { predMap[m.id][p.username] = p; });
  });

  const header = `<tr><th>Wedstrijd</th>${allUsers.map(u => `<th>${u}</th>`).join('')}</tr>`;
  const rows = matches.map(m => {
    const cells = allUsers.map(u => {
      const p = predMap[m.id][u];
      if (!p) return `<td><span style="color:var(--text-muted)">—</span></td>`;
      return `<td>
        <span>${p.pred_home}–${p.pred_away}</span>
        <button class="pred-del-btn" title="Wissen" onclick="deletePrediction(${p.id}, '${u}', '${m.home_team} vs ${m.away_team}')">✕</button>
      </td>`;
    }).join('');
    const result = m.result_home !== null ? ` <span style="color:var(--orange-hl)">${m.result_home}–${m.result_away}</span>` : '';
    return `<tr><td style="white-space:nowrap;font-size:0.78rem">${m.home_team} vs ${m.away_team}${result}</td>${cells}</tr>`;
  }).join('');

  container.innerHTML = `<table class="pred-overview-table"><thead>${header}</thead><tbody>${rows}</tbody></table>`;
}

async function deletePrediction(predId, username, matchLabel) {
  if (!confirm(`Voorspelling van ${username} voor "${matchLabel}" wissen?`)) return;

  const res = await fetch(`/api/predictions/${predId}`, {
    method: 'DELETE',
    headers: AUTH.headers()
  });
  const data = await res.json();

  if (!res.ok) {
    alert(data.error || 'Wissen mislukt');
  } else {
    loadAdminPredictions(); // refresh table
  }
}

// ─── Bonus Game (Winnaar & Topscorer) ──────────────────────────────────────────
async function loadBonusAdmin() {
  const container = document.getElementById('bonus-admin-table');
  const poolId = AUTH.getPoolId();
  const [users, bonus, pools] = await Promise.all([
    fetch('/api/admin/users', { headers: AUTH.headers() }).then(r => r.json()),
    fetch(`/api/bonus?${AUTH.poolQuery()}`, { headers: AUTH.headers() }).then(r => r.json()),
    poolId ? fetch('/api/admin/pools', { headers: AUTH.headers() }).then(r => r.json()) : Promise.resolve(null)
  ]);

  const byUser = {};
  bonus.forEach(b => { byUser[b.user_id] = b; });

  // When a poule is selected, only show its members; otherwise all users.
  let shownUsers = users;
  if (poolId && pools) {
    const p = pools.find(x => String(x.id) === String(poolId));
    const members = new Set(p ? p.members : []);
    shownUsers = users.filter(u => members.has(u.id));
  }

  const rows = shownUsers.map(u => {
    const b = byUser[u.id] || {};
    const champ  = b.champion   ? `${flagImg(b.champion)} ${b.champion}` : '<span style="color:var(--text-muted)">—</span>';
    const scorer = b.top_scorer ? b.top_scorer                          : '<span style="color:var(--text-muted)">—</span>';
    return `<tr>
      <td style="white-space:nowrap"><strong>${u.username}</strong></td>
      <td>${champ}</td>
      <td>${scorer}</td>
      <td style="text-align:center"><input type="checkbox" id="champ-${u.id}" ${b.champion_awarded ? 'checked' : ''} onchange="awardBonus(${u.id})"></td>
      <td style="text-align:center"><input type="checkbox" id="scorer-${u.id}" ${b.top_scorer_awarded ? 'checked' : ''} onchange="awardBonus(${u.id})"></td>
    </tr>`;
  }).join('');

  container.innerHTML = `<table class="pred-overview-table">
    <thead><tr><th>Naam</th><th>Wereldkampioen</th><th>Topscorer</th><th>Kampioen (20)</th><th>Topscorer (15)</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

async function awardBonus(userId) {
  const champion_awarded   = document.getElementById(`champ-${userId}`).checked;
  const top_scorer_awarded = document.getElementById(`scorer-${userId}`).checked;

  const res = await fetch(`/api/admin/bonus/${userId}/award`, {
    method: 'PUT',
    headers: AUTH.headers(),
    body: JSON.stringify({ champion_awarded, top_scorer_awarded })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    alert(data.error || 'Bijwerken mislukt');
  }
}

// ─── Poules beheren ─────────────────────────────────────────────────────────────
async function loadPoolsAdmin() {
  const container = document.getElementById('pools-list');
  const [users, pools] = await Promise.all([
    fetch('/api/admin/users', { headers: AUTH.headers() }).then(r => r.json()),
    fetch('/api/admin/pools', { headers: AUTH.headers() }).then(r => r.json())
  ]);

  if (!pools.length) {
    container.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem">Nog geen poules. Maak er hierboven een aan.</div>';
    return;
  }

  container.innerHTML = pools.map(p => {
    const members = new Set(p.members);
    const nameEsc = p.name.replace(/'/g, "\\'");
    const checks = users.map(u => `
      <label style="display:inline-flex;align-items:center;gap:5px;margin:3px 14px 3px 0;font-size:0.85rem;white-space:nowrap">
        <input type="checkbox" ${members.has(u.id) ? 'checked' : ''} onchange="togglePoolMember(${p.id}, ${u.id}, this.checked)">
        ${u.username}${u.is_admin ? ' 👑' : ''}
      </label>`).join('');
    return `
      <div style="border:1px solid var(--border, rgba(255,255,255,0.12));border-radius:8px;padding:0.75rem 1rem;margin-bottom:0.75rem">
        <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.5rem">
          <strong>${p.name}</strong>
          <span style="color:var(--text-muted);font-size:0.78rem">${p.members.length} ${p.members.length === 1 ? 'lid' : 'leden'}</span>
          <span style="flex:1"></span>
          <button class="btn-sm" onclick="renamePool(${p.id}, '${nameEsc}')">Hernoem</button>
          <button class="btn-sm btn-danger" onclick="deletePool(${p.id}, '${nameEsc}')">Verwijder</button>
        </div>
        <div style="display:flex;flex-wrap:wrap">${checks}</div>
      </div>`;
  }).join('');
}

async function createPool() {
  const input = document.getElementById('new-pool-name');
  const err = document.getElementById('pools-error');
  err.classList.remove('show');
  const name = input.value.trim();
  if (!name) { err.textContent = 'Voer een naam in.'; err.classList.add('show'); return; }

  const res = await fetch('/api/admin/pools', {
    method: 'POST', headers: AUTH.headers(), body: JSON.stringify({ name })
  });
  const data = await res.json();
  if (!res.ok) { err.textContent = data.error || 'Aanmaken mislukt'; err.classList.add('show'); return; }
  input.value = '';
  loadPoolsAdmin();
}

async function renamePool(id, current) {
  const name = prompt('Nieuwe naam voor de poule:', current);
  if (!name || !name.trim()) return;
  const res = await fetch(`/api/admin/pools/${id}`, {
    method: 'PUT', headers: AUTH.headers(), body: JSON.stringify({ name: name.trim() })
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Hernoemen mislukt'); return; }
  loadPoolsAdmin();
}

async function deletePool(id, name) {
  if (!confirm(`Poule "${name}" verwijderen? De deelnemers blijven bestaan, alleen de poule verdwijnt.`)) return;
  const res = await fetch(`/api/admin/pools/${id}`, { method: 'DELETE', headers: AUTH.headers() });
  if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Verwijderen mislukt'); return; }
  loadPoolsAdmin();
}

async function togglePoolMember(poolId, userId, checked) {
  const res = checked
    ? await fetch(`/api/admin/pools/${poolId}/members`, {
        method: 'POST', headers: AUTH.headers(), body: JSON.stringify({ user_id: userId })
      })
    : await fetch(`/api/admin/pools/${poolId}/members/${userId}`, {
        method: 'DELETE', headers: AUTH.headers()
      });
  if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Bijwerken mislukt'); }
  loadPoolsAdmin();
}

init();
