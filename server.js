require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Keep the live DB's schedule + bracket in step with db/schedule.js on every boot.
// Safe + idempotent; never touches results or predictions. Runs here so a plain
// `git push` self-corrects the deployment even if the start command isn't changed.
try {
  require('./db/sync-schedule').syncSchedule();
} catch (e) {
  console.error('Schedule sync on boot failed:', e.message);
}

// Routes
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/predictions'));
app.use('/api', require('./routes/leaderboard'));
app.use('/api', require('./routes/standings'));
app.use('/api/admin', require('./routes/results'));
app.use('/api/admin', require('./routes/users'));

// SPA fallback – serve index.html for any non-API route
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`WK 2026 Poule running on http://localhost:${PORT}`));
