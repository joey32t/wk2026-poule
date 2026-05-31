const express = require('express');
const db = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/my-pools — poules the current user belongs to (for the header switcher)
router.get('/my-pools', requireAuth, (req, res) => {
  const pools = db.prepare(`
    SELECT p.id, p.name
    FROM pools p
    JOIN pool_members m ON m.pool_id = p.id
    WHERE m.user_id = ?
    ORDER BY p.name COLLATE NOCASE
  `).all(req.user.id);
  res.json(pools);
});

// GET /api/admin/pools — all poules with their member ids
router.get('/admin/pools', requireAdmin, (_req, res) => {
  const pools = db.prepare('SELECT id, name FROM pools ORDER BY name COLLATE NOCASE').all();
  const members = db.prepare('SELECT pool_id, user_id FROM pool_members').all();
  const byPool = {};
  members.forEach(m => { (byPool[m.pool_id] = byPool[m.pool_id] || []).push(m.user_id); });
  res.json(pools.map(p => ({ ...p, members: byPool[p.id] || [] })));
});

// POST /api/admin/pools { name } — create a poule
router.post('/admin/pools', requireAdmin, (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Naam is verplicht' });
  const result = db.prepare('INSERT INTO pools (name) VALUES (?)').run(name);
  res.status(201).json({ id: result.lastInsertRowid, name });
});

// PUT /api/admin/pools/:id { name } — rename
router.put('/admin/pools/:id', requireAdmin, (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Naam is verplicht' });
  const result = db.prepare('UPDATE pools SET name = ? WHERE id = ?').run(name, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Poule niet gevonden' });
  res.json({ message: 'Poule bijgewerkt' });
});

// DELETE /api/admin/pools/:id — delete (memberships cascade)
router.delete('/admin/pools/:id', requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM pools WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Poule niet gevonden' });
  res.json({ message: 'Poule verwijderd' });
});

// POST /api/admin/pools/:id/members { user_id } — add a member
router.post('/admin/pools/:id/members', requireAdmin, (req, res) => {
  const userId = parseInt(req.body.user_id);
  const pool = db.prepare('SELECT id FROM pools WHERE id = ?').get(req.params.id);
  if (!pool) return res.status(404).json({ error: 'Poule niet gevonden' });
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
  db.prepare('INSERT OR IGNORE INTO pool_members (pool_id, user_id) VALUES (?, ?)').run(req.params.id, userId);
  res.json({ message: 'Lid toegevoegd' });
});

// DELETE /api/admin/pools/:id/members/:userId — remove a member
router.delete('/admin/pools/:id/members/:userId', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM pool_members WHERE pool_id = ? AND user_id = ?')
    .run(req.params.id, req.params.userId);
  res.json({ message: 'Lid verwijderd' });
});

module.exports = router;
