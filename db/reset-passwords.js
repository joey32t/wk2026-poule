// One-time password recovery tool.
//
// When the RESET_PASSWORD environment variable is set, every user's password is
// reset to that value on boot. Use it to regain access after a lockout, then
// REMOVE the variable so a later restart doesn't reset passwords again.
//
// Usage on Railway:
//   1. Add a variable  RESET_PASSWORD = wk2026
//   2. Redeploy / restart — all accounts now log in with that password
//   3. DELETE the RESET_PASSWORD variable
//   4. Change each password from the admin panel ("Reset wachtwoord")

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./database');

function resetIfRequested() {
  const pw = process.env.RESET_PASSWORD;
  if (!pw) return;

  const hash = bcrypt.hashSync(pw, 10);
  const r = db.prepare('UPDATE users SET password_hash = ?').run(hash);
  console.log(`⚠  RESET_PASSWORD is set — reset ${r.changes} user password(s) to the provided value.`);
  console.log('⚠  Remove the RESET_PASSWORD variable now so future restarts do not reset passwords again.');
}

module.exports = { resetIfRequested };

// Allow running as a standalone script too.
if (require.main === module) resetIfRequested();
