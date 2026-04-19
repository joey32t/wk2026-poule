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
  if (match) {
    let info = `${match.home_team} vs ${match.away_team}`;
    if (match.result_home !== null) info += ` · Huidige uitslag: ${match.result_home}–${match.result_away}`;
    teamsEl.textContent = info;
    document.getElementById('result-home').value = match.result_home ?? '';
    document.getElementById('result-away').value = match.result_away ?? '';
  } else {
    teamsEl.textContent = '';
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

  const res = await fetch('/api/admin/results', {
    method: 'POST',
    headers: AUTH.headers(),
    body: JSON.stringify({ match_id: matchId, result_home: resultHome, result_away: resultAway })
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
    if (idx >= 0) { allMatches[idx].result_home = resultHome; allMatches[idx].result_away = resultAway; }
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
    // Re-populate dropdowns
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

init();
