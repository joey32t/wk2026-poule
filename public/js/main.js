if (!AUTH.requireLogin()) throw new Error('not logged in');
renderHeaderUser();

const STAGE_DEADLINES = {};
const STAGE_LABELS = {
  group: 'Groepsfase', r32: 'Ronde van 32', r16: 'Ronde van 16',
  qf: 'Kwartfinale', sf: 'Halve Finale', '3rd': '3e Plaats', final: 'Finale'
};
const STAGE_ORDER = ['group', 'r32', 'r16', 'qf', 'sf', '3rd', 'final'];

// Team emoji flags
const FLAGS = {
  'Mexico':                '🇲🇽', 'South Africa':        '🇿🇦', 'Korea Republic':     '🇰🇷',
  'Czechia':               '🇨🇿', 'Canada':              '🇨🇦', 'Bosnia & Herzegovina':'🇧🇦',
  'Qatar':                 '🇶🇦', 'Switzerland':         '🇨🇭', 'Brazil':             '🇧🇷',
  'Morocco':               '🇲🇦', 'Haiti':               '🇭🇹', 'Scotland':           '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'USA':                   '🇺🇸', 'Paraguay':            '🇵🇾', 'Australia':          '🇦🇺',
  'Türkiye':               '🇹🇷', 'Germany':             '🇩🇪', 'Curaçao':            '🇨🇼',
  'Ivory Coast':           '🇨🇮', 'Ecuador':             '🇪🇨', 'Netherlands':        '🇳🇱',
  'Japan':                 '🇯🇵', 'Sweden':              '🇸🇪', 'Tunisia':            '🇹🇳',
  'Belgium':               '🇧🇪', 'Egypt':               '🇪🇬', 'Iran':               '🇮🇷',
  'New Zealand':           '🇳🇿', 'Spain':               '🇪🇸', 'Uruguay':            '🇺🇾',
  'Saudi Arabia':          '🇸🇦', 'Cape Verde':          '🇨🇻', 'France':             '🇫🇷',
  'Senegal':               '🇸🇳', 'Norway':              '🇳🇴', 'Iraq':               '🇮🇶',
  'Argentina':             '🇦🇷', 'Algeria':             '🇩🇿', 'Austria':            '🇦🇹',
  'Jordan':                '🇯🇴', 'Portugal':            '🇵🇹', 'DR Congo':           '🇨🇩',
  'Colombia':              '🇨🇴', 'Uzbekistan':          '🇺🇿', 'England':            '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Croatia':               '🇭🇷', 'Panama':              '🇵🇦', 'Ghana':              '🇬🇭',
};

function getFlag(name) {
  return FLAGS[name] || '🏳';
}

let currentStage = 'group';
let currentGroup = 'A';
let deadlinesLoaded = false;
let countdownInterval = null;
let allPredictions = {}; // keyed by match_id -> array of predictions

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  await loadDeadlines();
  currentStage = detectCurrentStage();
  setupStageTabs();
  await loadStage(currentStage, currentGroup);
  startCountdown();
}

async function loadDeadlines() {
  const res = await fetch('/api/deadlines');
  const data = await res.json();
  Object.assign(STAGE_DEADLINES, data);
  deadlinesLoaded = true;
}

function detectCurrentStage() {
  const now = new Date();
  for (const stage of STAGE_ORDER) {
    const dl = STAGE_DEADLINES[stage];
    if (!dl) continue;
    if (now < new Date(dl)) return stage; // deadline hasn't passed yet
  }
  // All deadlines passed — show final
  return 'final';
}

// ─── Stage / Group Tabs ──────────────────────────────────────────────────────
function setupStageTabs() {
  document.querySelectorAll('.stage-tab').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentStage = btn.dataset.stage;
      updateStageTabs();
      const grp = currentStage === 'group' ? currentGroup : null;
      await loadStage(currentStage, grp);
      updateCountdownDisplay();
    });
  });

  document.querySelectorAll('.group-tab').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentGroup = btn.dataset.group;
      updateGroupTabs();
      await loadStage('group', currentGroup);
    });
  });

  updateStageTabs();
}

function updateStageTabs() {
  document.querySelectorAll('.stage-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.stage === currentStage)
  );
  const groupTabs = document.getElementById('group-tabs');
  groupTabs.style.display = currentStage === 'group' ? 'flex' : 'none';
  updateGroupTabs();
}

function updateGroupTabs() {
  document.querySelectorAll('.group-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.group === currentGroup)
  );
}

// ─── Load Matches ────────────────────────────────────────────────────────────
async function loadStage(stage, group) {
  const grid = document.getElementById('matches-grid');
  grid.innerHTML = '<div class="loading">Laden...</div>';

  let url = `/api/matches?stage=${stage}`;
  if (stage === 'group' && group) url += `&group=${group}`;

  const [matchRes] = await Promise.all([fetch(url)]);
  const matches = await matchRes.json();

  if (!matches.length) {
    grid.innerHTML = '<div class="loading">Geen wedstrijden gevonden.</div>';
    return;
  }

  // Fetch all predictions for all matches in parallel
  const predResults = await Promise.all(
    matches.map(m => fetch(`/api/predictions?match_id=${m.id}`).then(r => r.json()))
  );
  matches.forEach((m, i) => { allPredictions[m.id] = predResults[i]; });

  grid.innerHTML = matches.map(m => renderMatchCard(m)).join('');
  attachSaveHandlers();
}

// ─── Match Card ──────────────────────────────────────────────────────────────
function renderMatchCard(match) {
  const kickoff = new Date(match.kickoff_cest);
  const dateStr = kickoff.toLocaleDateString('nl-NL', { weekday:'short', day:'numeric', month:'short' });
  const timeStr = kickoff.toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/Amsterdam' });

  const hasResult = match.result_home !== null && match.result_away !== null;
  const deadline = STAGE_DEADLINES[match.stage];
  const isLocked = deadline && new Date() >= new Date(deadline);

  const preds = allPredictions[match.id] || [];
  const currentUser = AUTH.getUser();

  const resultHtml = hasResult
    ? `<div class="match-result">${match.result_home} – ${match.result_away}</div>`
    : `<div class="vs-text">VS</div>`;

  const predsHtml = renderPredictions(match, preds, currentUser, hasResult, isLocked);

  return `
    <div class="match-card" id="match-${match.id}">
      <div class="match-header">
        <span class="match-number">Wedstrijd ${match.match_number}</span>
        <span class="match-meta">${dateStr} · ${timeStr}<br>${match.venue}</span>
      </div>
      <div class="match-teams">
        <div class="team">
          <span class="team-flag">${getFlag(match.home_team)}</span>
          <span class="team-name">${match.home_team}</span>
        </div>
        <div class="vs-block">${resultHtml}</div>
        <div class="team">
          <span class="team-flag">${getFlag(match.away_team)}</span>
          <span class="team-name">${match.away_team}</span>
        </div>
      </div>
      <div class="predictions-section">
        <div class="predictions-title">Voorspellingen</div>
        ${predsHtml}
      </div>
    </div>
  `;
}

function renderPredictions(match, preds, currentUser, hasResult, isLocked) {
  // Build a map of username -> prediction
  const predMap = {};
  preds.forEach(p => { predMap[p.username.toLowerCase()] = p; });

  // All known users (from the predictions list + current user)
  const allUsers = [...new Set([...preds.map(p => p.username), currentUser.username])];
  // Sort: current user first, then alphabetical
  allUsers.sort((a, b) => {
    if (a.toLowerCase() === currentUser.username.toLowerCase()) return -1;
    if (b.toLowerCase() === currentUser.username.toLowerCase()) return 1;
    return a.localeCompare(b);
  });

  return allUsers.map(username => {
    const pred = predMap[username.toLowerCase()];
    const isMe = username.toLowerCase() === currentUser.username.toLowerCase();
    const canEdit = isMe && !isLocked;

    let statusClass = '';
    let statusDot = '';
    if (hasResult && pred) {
      const actualWinner = Math.sign(match.result_home - match.result_away);
      const predWinner   = Math.sign(pred.pred_home - pred.pred_away);
      if (pred.pred_home === match.result_home && pred.pred_away === match.result_away) {
        statusClass = 'correct';
        statusDot = '<span class="pred-status correct"></span>';
      } else if (predWinner === actualWinner) {
        statusClass = 'partial';
        statusDot = '<span class="pred-status partial"></span>';
      } else {
        statusClass = 'wrong';
        statusDot = '<span class="pred-status wrong"></span>';
      }
    }

    const rowClass = `prediction-row ${isMe ? 'mine' : ''} ${statusClass}`.trim();

    if (canEdit) {
      // Editable row
      const h = pred ? pred.pred_home : '';
      const a = pred ? pred.pred_away : '';
      return `
        <div class="${rowClass}" data-match-id="${match.id}" data-username="${username}">
          <span class="pred-username">${username}</span>
          <div class="pred-inputs">
            <input type="number" class="pred-score-input pred-home" min="0" max="99" value="${h}" placeholder="-">
            <span class="pred-dash">–</span>
            <input type="number" class="pred-score-input pred-away" min="0" max="99" value="${a}" placeholder="-">
          </div>
          <button class="pred-save-btn" data-match-id="${match.id}">Opslaan</button>
        </div>
      `;
    } else if (pred) {
      // Show prediction (locked or other user, result not known yet → only show own predictions and locked others)
      const show = isMe || isLocked;
      const displayStr = show ? `${pred.pred_home} – ${pred.pred_away}` : '?';
      return `
        <div class="${rowClass}">
          <span class="pred-username">${username}</span>
          <span class="pred-result-display">${displayStr}</span>
          ${statusDot}
        </div>
      `;
    } else if (isMe && isLocked) {
      return `
        <div class="${rowClass}">
          <span class="pred-username">${username}</span>
          <span class="empty-pred">Niet ingevuld</span>
        </div>
      `;
    } else if (isMe) {
      // Shouldn't be editable (locked) but not yet locked — should have been canEdit
      return '';
    } else {
      // Other user, no prediction yet
      return `
        <div class="${rowClass}">
          <span class="pred-username">${username}</span>
          <span class="empty-pred">Nog niet ingevuld</span>
        </div>
      `;
    }
  }).join('');
}

// ─── Save Predictions ─────────────────────────────────────────────────────────
function attachSaveHandlers() {
  document.querySelectorAll('.pred-save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const matchId = parseInt(btn.dataset.matchId);
      const row = btn.closest('.prediction-row');
      const homeInput = row.querySelector('.pred-home');
      const awayInput = row.querySelector('.pred-away');

      const h = parseInt(homeInput.value);
      const a = parseInt(awayInput.value);

      if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
        showToast('Voer geldige scores in (0 of hoger)', true);
        return;
      }

      btn.disabled = true;
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: AUTH.headers(),
        body: JSON.stringify({ match_id: matchId, pred_home: h, pred_away: a })
      });
      const data = await res.json();
      btn.disabled = false;

      if (!res.ok) {
        showToast(data.error || 'Opslaan mislukt', true);
      } else {
        showToast('Voorspelling opgeslagen!');
        // Refresh the match card
        const match = await fetch(`/api/matches?stage=${currentStage}${currentStage==='group'?'&group='+currentGroup:''}`).then(r=>r.json()).then(arr=>arr.find(m=>m.id===matchId));
        const preds = await fetch(`/api/predictions?match_id=${matchId}`).then(r=>r.json());
        allPredictions[matchId] = preds;
        const card = document.getElementById(`match-${matchId}`);
        if (card && match) card.outerHTML = renderMatchCard(match);
        attachSaveHandlers();
      }
    });
  });
}

// ─── Countdown ───────────────────────────────────────────────────────────────
function startCountdown() {
  clearInterval(countdownInterval);
  updateCountdownDisplay();
  countdownInterval = setInterval(updateCountdownDisplay, 1000);
}

function updateCountdownDisplay() {
  const bar = document.getElementById('countdown-bar');
  const val = document.getElementById('countdown-value');
  const badge = document.getElementById('lock-badge');
  const deadline = STAGE_DEADLINES[currentStage];

  if (!deadline) {
    val.textContent = '—';
    return;
  }

  const now = new Date();
  const dl  = new Date(deadline);
  const diff = dl - now;

  if (diff <= 0) {
    val.textContent = 'VERGRENDELD';
    badge.style.display = '';
    bar.classList.add('locked');
  } else {
    bar.classList.remove('locked');
    badge.style.display = 'none';
    const totalSecs = Math.floor(diff / 1000);
    const days  = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const mins  = Math.floor((totalSecs % 3600) / 60);
    const secs  = totalSecs % 60;

    if (days > 0) {
      val.textContent = `${days}d ${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    } else {
      val.textContent = `${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    }
  }
}

// ─── Change Password ──────────────────────────────────────────────────────────
function openPwModal() { document.getElementById('pw-modal').classList.add('show'); }
function closePwModal() {
  document.getElementById('pw-modal').classList.remove('show');
  document.getElementById('pw-error').classList.remove('show');
}

async function changePassword() {
  const current = document.getElementById('pw-current').value;
  const newPw   = document.getElementById('pw-new').value;
  const errEl   = document.getElementById('pw-error');
  errEl.classList.remove('show');

  const res = await fetch('/api/change-password', {
    method: 'POST',
    headers: AUTH.headers(),
    body: JSON.stringify({ current_password: current, new_password: newPw })
  });
  const data = await res.json();

  if (!res.ok) {
    errEl.textContent = data.error;
    errEl.classList.add('show');
    return;
  }
  closePwModal();
  showToast('Wachtwoord gewijzigd!');
}

init();
