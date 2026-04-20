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
  }
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
