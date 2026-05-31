// Shared auth utilities used across all pages

const AUTH = {
  getToken() { return localStorage.getItem('wk_token'); },
  getUser()  {
    const raw = localStorage.getItem('wk_user');
    return raw ? JSON.parse(raw) : null;
  },
  save(token, username, is_admin) {
    localStorage.setItem('wk_token', token);
    localStorage.setItem('wk_user', JSON.stringify({ username, is_admin }));
  },
  clear() {
    localStorage.removeItem('wk_token');
    localStorage.removeItem('wk_user');
  },
  requireLogin() {
    if (!this.getToken()) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  },
  headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    };
  },

  // ─── Poules (competition groups) ──────────────────────────────────────────
  // wk_pool holds the selected poule id; '' means "Alle deelnemers" (global).
  _pools: null,        // [{id, name}] available to this user (admin: incl. 'Alle deelnemers')
  _poolId: null,       // resolved current selection
  _poolReady: null,    // memoized init promise

  initPool() {
    if (this._poolReady) return this._poolReady;
    this._poolReady = (async () => {
      const user = this.getUser();
      if (!user) { this._pools = []; this._poolId = ''; return ''; }

      let pools = [];
      try {
        if (user.is_admin) {
          const all = await fetch('/api/admin/pools', { headers: this.headers() }).then(r => r.json());
          pools = [{ id: '', name: 'Alle deelnemers' }, ...all.map(p => ({ id: p.id, name: p.name }))];
        } else {
          const mine = await fetch('/api/my-pools', { headers: this.headers() }).then(r => r.json());
          pools = mine.map(p => ({ id: p.id, name: p.name }));
        }
      } catch {
        pools = user.is_admin ? [{ id: '', name: 'Alle deelnemers' }] : [];
      }
      this._pools = pools;

      const stored = localStorage.getItem('wk_pool');
      const has = v => pools.some(p => String(p.id) === String(v));
      if (user.is_admin) {
        this._poolId = (stored != null && has(stored)) ? stored : '';
      } else if (pools.length === 0) {
        this._poolId = '';
      } else {
        this._poolId = (stored && has(stored)) ? stored : String(pools[0].id);
      }
      localStorage.setItem('wk_pool', this._poolId);
      return this._poolId;
    })();
    return this._poolReady;
  },
  getPools() { return this._pools || []; },
  getPoolId() { return this._poolId != null ? this._poolId : (localStorage.getItem('wk_pool') || ''); },
  setPoolId(id) { this._poolId = id; localStorage.setItem('wk_pool', id); },
  poolQuery() { const id = this.getPoolId(); return id ? `pool_id=${encodeURIComponent(id)}` : ''; },
  // A non-admin who belongs to no poule is not competing yet.
  isNoPool() { const u = this.getUser(); return !!u && !u.is_admin && (this._pools || []).length === 0; }
};

// Render the shared header nav user chip + logout
function renderHeaderUser() {
  const user = AUTH.getUser();
  if (!user) return;

  const chip = document.getElementById('user-chip');
  if (chip) chip.textContent = user.username.toUpperCase();

  const adminLink = document.getElementById('admin-nav-link');
  if (adminLink) adminLink.style.display = user.is_admin ? '' : 'none';

  // Mobile nav: show admin link and set username
  const mobileAdmin = document.getElementById('mobile-admin-link');
  if (mobileAdmin) mobileAdmin.style.display = user.is_admin ? '' : 'none';

  const mobileUser = document.getElementById('mobile-user-chip');
  if (mobileUser) mobileUser.textContent = user.username.toUpperCase();

  // Inject the poule switcher into desktop + mobile headers (fire-and-forget).
  renderPoolSwitcher();
}

// Render a poule switcher next to the user chip. Dropdown when the user has 2+
// options; a static label when exactly 1; nothing when 0.
async function renderPoolSwitcher() {
  if (!AUTH.getUser()) return;
  await AUTH.initPool();
  const pools = AUTH.getPools();
  const current = AUTH.getPoolId();

  const inject = (slotId, anchorId) => {
    const anchor = document.getElementById(anchorId);
    if (!anchor) return;
    const old = document.getElementById(slotId);
    if (old) old.remove();

    if (pools.length === 0) return;

    if (pools.length === 1) {
      const span = document.createElement('span');
      span.id = slotId;
      span.textContent = '🏆 ' + pools[0].name;
      span.style.cssText = 'font-size:0.8rem;opacity:0.85;margin-right:0.5rem;white-space:nowrap';
      anchor.parentNode.insertBefore(span, anchor);
      return;
    }

    const sel = document.createElement('select');
    sel.id = slotId;
    sel.innerHTML = pools.map(p =>
      `<option value="${p.id}"${String(p.id) === String(current) ? ' selected' : ''}>${p.name}</option>`
    ).join('');
    sel.style.cssText = 'background:rgba(255,255,255,0.12);color:#fff;border:1px solid rgba(255,255,255,0.25);' +
      'border-radius:6px;padding:3px 6px;font-size:0.8rem;margin-right:0.5rem;max-width:150px;cursor:pointer';
    sel.addEventListener('change', () => { AUTH.setPoolId(sel.value); location.reload(); });
    anchor.parentNode.insertBefore(sel, anchor);
  };

  inject('pool-switcher', 'user-chip');
  inject('pool-switcher-mobile', 'mobile-user-chip');
}

function toggleMobileNav() {
  const nav = document.getElementById('mobile-nav');
  if (nav) nav.classList.toggle('open');
}

// Close mobile nav when clicking outside
document.addEventListener('click', e => {
  const nav = document.getElementById('mobile-nav');
  const btn = document.querySelector('.hamburger-btn');
  if (nav && nav.classList.contains('open') && !nav.contains(e.target) && e.target !== btn) {
    nav.classList.remove('open');
  }
});

function logout() {
  AUTH.clear();
  window.location.href = '/login.html';
}

// Toast notification
function showToast(msg, isError = false) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '');
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => toast.classList.remove('show'), 3000);
}
