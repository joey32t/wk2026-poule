const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Gebruikersnaam en wachtwoord zijn verplicht' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Verkeerde gebruikersnaam of wachtwoord' });

  const token = jwt.sign(
    { id: user.id, username: user.username, is_admin: user.is_admin === 1 },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
  res.json({ token, username: user.username, is_admin: user.is_admin === 1 });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'Huidig en nieuw wachtwoord zijn verplicht' });
  if (new_password.length < 4)
    return res.status(400).json({ error: 'Wachtwoord moet minstens 4 tekens zijn' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password, user.password_hash))
    return res.status(401).json({ error: 'Huidig wachtwoord is onjuist' });

  const newHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
  res.json({ message: 'Wachtwoord gewijzigd' });
});

module.exports = router;
