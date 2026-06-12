const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');

const router = express.Router();

// In-memory brute-force protection: 5 failures per IP within 15 min → 15-min block
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS    = 15 * 60 * 1000;
const BLOCK_MS     = 15 * 60 * 1000;

function getRateLimit(ip) {
  const now   = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return { blocked: false };
  if (entry.blockedUntil && now < entry.blockedUntil) {
    return { blocked: true, remaining: Math.ceil((entry.blockedUntil - now) / 60000) };
  }
  return { blocked: false };
}

function recordFailure(ip) {
  const now   = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, firstAt: now, blockedUntil: null };
  if (now - entry.firstAt > WINDOW_MS) { entry.count = 0; entry.firstAt = now; entry.blockedUntil = null; }
  entry.count++;
  if (entry.count >= MAX_ATTEMPTS) entry.blockedUntil = now + BLOCK_MS;
  loginAttempts.set(ip, entry);
}

function clearAttempts(ip) { loginAttempts.delete(ip); }

// Purge stale entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of loginAttempts) {
    if ((!e.blockedUntil || now >= e.blockedUntil) && now - e.firstAt > WINDOW_MS) {
      loginAttempts.delete(ip);
    }
  }
}, 30 * 60 * 1000);

const MGMT_POSITIONS = ['gestao', 'board', 'president', 'treasurer', 'secretary'];

function adminDest(role, position) {
  return ['super_admin', 'admin'].includes(role) || MGMT_POSITIONS.includes(position);
}

router.get('/', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const u = db.prepare('SELECT role, position FROM users WHERE id = ?').get(req.session.userId);
  return res.redirect(u && adminDest(u.role, u.position) ? '/admin' : '/profile');
});

router.get('/login', (req, res) => {
  if (req.session.userId) {
    const u = db.prepare('SELECT role, position FROM users WHERE id = ?').get(req.session.userId);
    return res.redirect(u && adminDest(u.role, u.position) ? '/admin' : '/profile');
  }
  res.render('login', { title: 'Login' });
});

router.post('/login', (req, res) => {
  const ip = req.ip;
  const rl = getRateLimit(ip);
  if (rl.blocked) {
    req.session.flash = { type: 'danger', message: `Too many failed attempts. Try again in ${rl.remaining} minute(s).` };
    return res.redirect('/login');
  }

  const { email, password } = req.body;

  if (!email || !password) {
    req.session.flash = { type: 'danger', message: 'Email and password are required.' };
    return res.redirect('/login');
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim());

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    recordFailure(ip);
    req.session.flash = { type: 'danger', message: 'Invalid email or password.' };
    return res.redirect('/login');
  }

  clearAttempts(ip);
  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.flash = { type: 'success', message: `Welcome back!` };

  return res.redirect(adminDest(user.role, user.position) ? '/admin' : '/profile');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
