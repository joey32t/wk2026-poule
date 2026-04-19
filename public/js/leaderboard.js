if (!AUTH.requireLogin()) throw new Error('not logged in');
renderHeaderUser();

const STAGE_LABELS = {
  group: 'Groep', r32: 'R32', r16: 'R16',
  qf: 'QF', sf: 'HF', '3rd': '3e', final: 'Finale'
};

async function loadLeaderboard() {
  const res = await fetch('/api/leaderboard');
  const data = await res.json();
  renderLeaderboard(data);
}

function renderLeaderboard(entries) {
  const container = document.getElementById('leaderboard-container');

  if (!entries.length) {
    container.innerHTML = '<div class="loading">Nog geen punten berekend.</div>';
    return;
  }

  const rankClass = r => r === 1 ? 'rank-1' : r === 2 ? 'rank-2' : r === 3 ? 'rank-3' : 'rank-other';

  const rows = entries.map(e => {
    const pills = Object.entries(e.breakdown)
      .filter(([,pts]) => pts > 0)
      .map(([stage, pts]) =>
        `<span class="pill">${STAGE_LABELS[stage] || stage}: <span>${pts}</span></span>`
      ).join('');

    return `
      <tr>
        <td><span class="rank-badge ${rankClass(e.rank)}">${e.rank}</span></td>
        <td><strong>${e.username}</strong></td>
        <td><span class="pts-total">${e.total}</span></td>
        <td><div class="breakdown-pills">${pills || '<span style="color:var(--text-muted);font-size:.8rem">—</span>'}</div></td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="leaderboard-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Naam</th>
          <th>Punten</th>
          <th>Verdeling</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

loadLeaderboard();
// Auto-refresh every 30 seconds
setInterval(loadLeaderboard, 30000);
