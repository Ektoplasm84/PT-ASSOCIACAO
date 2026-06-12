const db = require('../database/db');

const ADMIN_ROLES       = ['super_admin', 'admin'];
const VIEWALL_POSITIONS = ['gestao', 'board', 'president', 'treasurer', 'secretary'];

function canViewAll(user) {
  return ADMIN_ROLES.includes(user.role) || VIEWALL_POSITIONS.includes(user.position);
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    req.session.flash = { type: 'danger', message: 'Please log in to continue.' };
    return res.redirect('/login');
  }
  const user = db.prepare('SELECT id, email, role, position FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    req.session.destroy(() => res.redirect('/login'));
    return;
  }
  res.locals.currentUser  = user;
  res.locals.canWrite     = ADMIN_ROLES.includes(user.role);
  res.locals.isSuperAdmin = user.role === 'super_admin';
  res.locals.canViewAll   = canViewAll(user);
  const _invRow = db.prepare(`SELECT COUNT(*) as cnt FROM event_invites WHERE user_id = ? AND status = 'pending'`).get(user.id);
  res.locals.pendingInviteCount = _invRow ? _invRow.cnt : 0;
  next();
}

// admin + super_admin — write operations
function requireAdmin(req, res, next) {
  if (!ADMIN_ROLES.includes(res.locals.currentUser.role)) {
    req.session.flash = { type: 'danger', message: 'Insufficient permissions.' };
    return res.redirect('/profile');
  }
  next();
}

// super_admin only — role management, account elevation
function requireSuperAdmin(req, res, next) {
  if (res.locals.currentUser.role !== 'super_admin') {
    req.session.flash = { type: 'danger', message: 'Super-admin access required.' };
    return res.redirect('/admin');
  }
  next();
}

// admin/super_admin roles OR gestao position — view all member data
function requireViewAll(req, res, next) {
  if (!canViewAll(res.locals.currentUser)) {
    return res.redirect('/profile');
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireSuperAdmin, requireViewAll };
