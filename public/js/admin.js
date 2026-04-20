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
  const res = await fetch('/api/matches');
  allMatches = await res.json();
  populateMatchSelects();
  loadUsers();
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

  // Fetch predictions for all matches
  const predResults = await Promise.all(
    matches.map(m => fetch(`/api/predictions?match_id=${m.id}`).then(r => r.json()))
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

init();
