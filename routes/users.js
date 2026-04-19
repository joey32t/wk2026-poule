const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/admin/users
router.get('/users', requireAdmin, (_req, res) => {
  const users = db.prepare(
    'SELECT id, username, is_admin, created_at FROM users ORDER BY id'
  ).all();
  res.json(users);
});

// POST /api/admin/users – add a new user
router.post('/users', requireAdmin, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Gebruikersnaam en wachtwoord zijn verplicht' });
  if (password.length < 4)
    return res.status(400).json({ error: 'Wachtwoord moet minstens 4 tekens zijn' });

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Gebruikersnaam is al in gebruik' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 0)'
  ).run(username, hash);

  res.status(201).json({ id: result.lastInsertRowid, username });
});

// PUT /api/admin/users/:id/reset-password – admin resets a user's password
router.put('/users/:id/reset-password', requireAdmin, (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 4)
    return res.status(400).json({ error: 'Wachtwoord moet minstens 4 tekens zijn' });

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' });

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ message: 'Wachtwoord gereset' });
});

module.exports = router;
