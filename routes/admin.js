const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const Jimp = require('jimp');
const db = require('../database/db');
const { computeFeeStatus } = require('../utils/fee');
const { scan: ocrScan, checkModels, getModelWarnings, dismissModelWarning, getActiveModels, setActiveModels, testModel: ocrTestModel } = require('../utils/ocr');
const { getLogs, subscribe: logSubscribe } = require('../utils/logstream');
const { writeAudit } = require('../utils/audit');
const countries        = require('../utils/countries');
const taiwanLocations  = require('../utils/taiwan-districts');

const router = express.Router();

// RFC 5987 encode a filename for Content-Disposition headers.
// Falls back to ASCII-safe quoted form for pure-ASCII names.
function contentDispositionFilename(disposition, name) {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\r\n]/g, '_');
  if (ascii === name) return `${disposition}; filename="${ascii}"`;
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

// --- Settings helpers ---

function getSetting(key, defaultVal) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : (defaultVal !== undefined ? String(defaultVal) : null);
}

function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
}

// Load persisted OCR model list from settings (runs at module init)
{
  const saved = getSetting('ocr_models', null);
  if (saved) {
    try { setActiveModels(JSON.parse(saved)); } catch {}
  }
}

// --- OCR background result cache (keyed by document DB id) ---
// Entries expire after 10 minutes. This decouples OCR from the HTTP request
// lifecycle so cPanel's proxy timeout can't drop the result.
const ocrCache = new Map();
function ocrCacheSet(docId, value) {
  ocrCache.set(docId, value);
  setTimeout(() => ocrCache.delete(docId), 10 * 60 * 1000);
}

// --- NIA ARC photo sessions (keyed by short-lived token) ---

const arcSessions = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of arcSessions) if (v.expires < now) arcSessions.delete(k);
}, 5 * 60 * 1000);

const NIA_BASE    = 'https://niaicinfo.immigration.gov.tw/icinfo-frontend';
const NIA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin':   'https://niaicinfo.immigration.gov.tw',
  'Referer':  `${NIA_BASE}/en`,
};

// --- Multer config ---

const photoStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, path.join(process.cwd(), 'uploads', 'photos'));
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  },
});

const docStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, path.join(process.cwd(), 'uploads', 'documents'));
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  },
});

const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  },
});

const docUpload = multer({
  storage: docStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Card images uploaded via AJAX — use memory storage so we can pass buffer to OCR without extra disk write
const cardUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  },
});

const CARD_TYPES = ['arc_front', 'arc_back', 'cc_front', 'cc_back'];

// Generate a 300-wide thumbnail (non-fatal if it fails)
async function generateThumb(srcPath, thumbPath) {
  const img = await Jimp.read(srcPath);
  await img.resize(300, Jimp.AUTO).writeAsync(thumbPath);
}

// --- Role guards (inline middleware for this router) ---

function adminOnly(req, res, next) {
  if (!['admin', 'super_admin'].includes(res.locals.currentUser.role)) {
    req.session.flash = { type: 'danger', message: 'Insufficient permissions.' };
    return res.redirect('/admin');
  }
  next();
}

function superAdminOnly(req, res, next) {
  if (res.locals.currentUser.role !== 'super_admin') {
    req.session.flash = { type: 'danger', message: 'Super-admin access required.' };
    return res.redirect('/admin');
  }
  next();
}

// Gestão umbrella (gestao/board/president/treasurer/secretary) + admin+ — fee fields only
const MGMT_POSITIONS = ['gestao', 'board', 'president', 'treasurer', 'secretary'];

function isManagementUser(u) {
  return ['admin', 'super_admin'].includes(u.role) || MGMT_POSITIONS.includes(u.position);
}

function feeWriteGuard(req, res, next) {
  if (isManagementUser(res.locals.currentUser)) return next();
  req.session.flash = { type: 'danger', message: 'Insufficient permissions.' };
  return res.redirect('/admin');
}

// --- Helpers ---

function nextMemberId() {
  const last = db.prepare(
    `SELECT member_id FROM members ORDER BY id DESC LIMIT 1`
  ).get();
  if (!last) return 'ASSOC-0001';
  const num = parseInt(last.member_id.split('-')[1], 10) + 1;
  return `ASSOC-${String(num).padStart(4, '0')}`;
}

function resolveAudience(groups) {
  if (!groups || !groups.length) return [];
  if (groups.includes('all')) {
    return db.prepare('SELECT id FROM users').all().map(u => u.id);
  }
  const parts = [];
  if (groups.includes('honorary'))
    parts.push("SELECT id FROM users WHERE position = 'honorary'");
  if (groups.includes('non_honorary'))
    parts.push("SELECT id FROM users WHERE position != 'honorary'");
  if (groups.includes('paid'))
    parts.push("SELECT u.id FROM users u JOIN members m ON m.user_id = u.id WHERE u.position != 'honorary' AND m.fee_status IN ('paid','renewal_incoming')");
  if (groups.includes('unpaid'))
    parts.push("SELECT u.id FROM users u JOIN members m ON m.user_id = u.id WHERE u.position != 'honorary' AND m.fee_status = 'unpaid'");
  if (!parts.length) return [];
  return db.prepare(parts.join(' UNION ')).all().map(u => u.id);
}

// --- Dashboard ---

router.get('/', (req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN u.position = 'honorary' THEN 1 ELSE 0 END) as honorary,
      SUM(CASE WHEN u.position != 'honorary' AND (m.fee_status='paid' OR m.fee_status='renewal_incoming') THEN 1 ELSE 0 END) as paid,
      SUM(CASE WHEN u.position != 'honorary' AND m.fee_status='unpaid' THEN 1 ELSE 0 END) as unpaid
    FROM members m JOIN users u ON u.id = m.user_id
  `).get();

  const recent = db.prepare(
    `SELECT m.*, u.email, u.position FROM members m JOIN users u ON u.id = m.user_id ORDER BY m.id DESC LIMIT 5`
  ).all();

  const warnings = db.prepare(`
    SELECT m.id, m.member_id, m.first_name, m.last_name, m.arc_name_en,
           m.fee_status, m.arc_expiry_date, m.cc_expiry_date,
           u.position,
           CASE WHEN u.position != 'honorary' AND m.fee_status = 'unpaid' THEN 1 ELSE 0 END as warn_fee,
           CASE WHEN m.arc_expiry_date IS NOT NULL AND date(m.arc_expiry_date) <= date('now', '+60 days') THEN 1 ELSE 0 END as warn_arc,
           CASE WHEN m.cc_expiry_date  IS NOT NULL AND date(m.cc_expiry_date)  <= date('now', '+60 days') THEN 1 ELSE 0 END as warn_cc
    FROM members m JOIN users u ON u.id = m.user_id
    WHERE (u.position != 'honorary' AND m.fee_status = 'unpaid')
       OR (m.arc_expiry_date IS NOT NULL AND date(m.arc_expiry_date) <= date('now', '+60 days'))
       OR (m.cc_expiry_date  IS NOT NULL AND date(m.cc_expiry_date)  <= date('now', '+60 days'))
    ORDER BY
      CASE WHEN date(m.arc_expiry_date) < date('now') OR date(m.cc_expiry_date) < date('now') THEN 0 ELSE 1 END,
      m.last_name, m.first_name
  `).all();

  const modelWarnings = res.locals.isSuperAdmin ? getModelWarnings() : [];
  const defaultFee    = res.locals.isSuperAdmin ? parseInt(getSetting('default_fee_amount', '300'), 10) : 300;
  const activeModels  = res.locals.isSuperAdmin ? getActiveModels() : [];
  res.render('admin/dashboard', { title: 'Dashboard', stats, recent, warnings, modelWarnings, defaultFee, activeModels });
});

// --- Calendar / Events ---

function calendarWriteGuard(req, res, next) {
  if (isManagementUser(res.locals.currentUser)) return next();
  return res.status(403).json({ error: 'Insufficient permissions.' });
}

router.get('/events/data', (req, res) => {
  const year  = parseInt(req.query.year)  || new Date().getFullYear();
  const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end   = `${year}-${String(month).padStart(2, '0')}-31`;
  const events = db.prepare(`
    SELECT e.id, e.title, e.description, e.location, e.start_date, e.end_date, e.created_by,
           u.email as creator_email,
           (SELECT COUNT(*) FROM event_invites WHERE event_id = e.id) as invite_count,
           (SELECT COUNT(*) FROM event_invites WHERE event_id = e.id AND status = 'accepted') as accepted_count,
           (SELECT COUNT(*) FROM event_invites WHERE event_id = e.id AND status = 'declined') as declined_count
    FROM events e JOIN users u ON u.id = e.created_by
    WHERE e.start_date >= ? AND e.start_date <= ?
    ORDER BY e.start_date
  `).all(start, end);
  res.json(events);
});

router.post('/events', calendarWriteGuard, (req, res) => {
  const { title, description, location, start_date, end_date } = req.body;
  let audience = req.body.audience;
  if (!title || !start_date) return res.status(400).json({ error: 'Title and start date are required.' });
  if (end_date && end_date < start_date) return res.status(400).json({ error: 'End date cannot be before start date.' });
  if (!Array.isArray(audience)) audience = audience ? [audience] : [];

  const createTx = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO events (title, description, location, start_date, end_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(title.trim(), description || null, location || null, start_date, end_date || null, res.locals.currentUser.id);
    const eventId = result.lastInsertRowid;
    const userIds = resolveAudience(audience);
    const ins = db.prepare('INSERT OR IGNORE INTO event_invites (event_id, user_id) VALUES (?, ?)');
    for (const uid of userIds) ins.run(eventId, uid);
    return { eventId, inviteCount: userIds.length };
  });

  const { eventId, inviteCount } = createTx();
  writeAudit(res.locals.currentUser.id, res.locals.currentUser.email, null, null,
    'event.created', `"${title}" on ${start_date}, ${inviteCount} invited`);
  res.json({ ok: true, eventId, inviteCount });
});

router.get('/events/:id/invites', adminOnly, (req, res) => {
  const rows = db.prepare(`
    SELECT ei.status, u.email,
           COALESCE(m.arc_name_en, m.first_name || ' ' || m.last_name) as display_name,
           m.member_id
    FROM event_invites ei
    JOIN users u ON u.id = ei.user_id
    LEFT JOIN members m ON m.user_id = u.id
    WHERE ei.event_id = ?
    ORDER BY
      CASE ei.status WHEN 'accepted' THEN 1 WHEN 'pending' THEN 2 WHEN 'declined' THEN 3 END,
      COALESCE(m.arc_name_en, m.first_name || ' ' || m.last_name), u.email
  `).all(req.params.id);
  res.json(rows);
});

router.post('/events/:id/delete', calendarWriteGuard, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Not found.' });
  const u = res.locals.currentUser;
  if (u.role !== 'super_admin' && event.created_by !== u.id) {
    return res.status(403).json({ error: 'You can only delete your own events.' });
  }
  db.prepare('DELETE FROM event_invites WHERE event_id = ?').run(req.params.id);
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  writeAudit(u.id, u.email, null, null, 'event.deleted', `"${event.title}" on ${event.start_date}`);
  res.json({ ok: true });
});

// --- Member list ---

router.get('/members', (req, res) => {
  const search = req.query.search || '';
  const feeFilter = req.query.fee || '';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const perPage = 20;
  const offset = (page - 1) * perPage;

  let where = 'WHERE 1=1';
  const params = [];

  if (search) {
    where += ` AND (m.first_name LIKE ? OR m.last_name LIKE ? OR m.member_id LIKE ? OR u.email LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (feeFilter) {
    where += ` AND m.fee_status = ?`;
    params.push(feeFilter);
  }

  const total = db.prepare(
    `SELECT COUNT(*) as cnt FROM members m JOIN users u ON u.id = m.user_id ${where}`
  ).get(...params).cnt;

  const members = db.prepare(
    `SELECT m.*, u.email, u.position, u.role as user_role FROM members m JOIN users u ON u.id = m.user_id ${where} ORDER BY m.last_name, m.first_name LIMIT ? OFFSET ?`
  ).all(...params, perPage, offset);

  const totalPages = Math.ceil(total / perPage);

  res.render('admin/members-list', {
    title: 'Members',
    members,
    search,
    feeFilter,
    page,
    totalPages,
    total,
  });
});

// --- New member form ---

router.get('/members/new', adminOnly, (req, res) => {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const defaultFee = parseInt(getSetting('default_fee_amount', '300'), 10);
  const data = {
    email:      `membro.${suffix}@associacao.pt`,
    first_name: 'Novo',
    last_name:  `Membro ${suffix}`,
    fee_amount: defaultFee,
  };
  res.render('admin/member-new', { title: 'New Member', errors: [], data, countries, taiwanLocations, defaultFee });
});

// --- Create member ---

router.post('/members', adminOnly, photoUpload.single('photo'), (req, res) => {
  const {
    first_name, last_name, email, password, phone_dialcode, phone_number,
    address_type,
    address, city, postal_code,
    city_zh, district_zh, district_en, address_zh,
    join_date,
    fee_amount, fee_last_paid,
    notes,
    arc_number, arc_name_en, arc_chinese_name, arc_issue_date, arc_expiry_date,
    passport_number, arc_serial_number,
    cc_number, cc_expiry_date, nif, niss,
  } = req.body;

  const errors = [];
  if (!first_name) errors.push('First name is required.');
  if (!last_name)  errors.push('Last name is required.');
  if (!email)      errors.push('Email is required.');
  if (!password || password.length < 6) errors.push('Password must be at least 6 characters.');

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) errors.push('An account with this email already exists.');

  if (errors.length) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.render('admin/member-new', {
      title: 'New Member',
      errors,
      data: req.body,
      countries,
      taiwanLocations,
      defaultFee: parseInt(getSetting('default_fee_amount', '300'), 10),
    });
  }

  const phone = phone_number ? `${phone_dialcode || '+351'} ${phone_number}` : null;
  const hash = bcrypt.hashSync(password, 10);
  const photoPath = req.file ? path.join('uploads', 'photos', req.file.filename) : null;
  const { status: feeStatus, validUntil: feeValidUntil } = computeFeeStatus(fee_amount, fee_last_paid || null);

  let memberId;
  const create = db.transaction(() => {
    memberId = nextMemberId();
    const userRes = db.prepare(
      `INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'member')`
    ).run(email.trim(), hash);

    db.prepare(`
      INSERT INTO members
        (user_id, member_id, first_name, last_name, phone,
         address_type, address, city, postal_code,
         city_zh, district_zh, district_en, address_zh,
         join_date, fee_amount, fee_last_paid, fee_valid_until, fee_status,
         notes, photo_path,
         arc_number, arc_name_en, arc_chinese_name, arc_issue_date, arc_expiry_date,
         passport_number, arc_serial_number,
         cc_number, cc_expiry_date, nif, niss)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userRes.lastInsertRowid, memberId,
      first_name, last_name, phone,
      address_type || 'tw', address || null, city || null, postal_code || null,
      city_zh || null, district_zh || null, district_en || null, address_zh || null,
      join_date || new Date().toISOString().slice(0, 10),
      parseInt(fee_amount, 10) >= 0 ? parseInt(fee_amount, 10) : 300,
      fee_last_paid || null, feeValidUntil, feeStatus,
      notes || null, photoPath,
      arc_number || null, arc_name_en || null, arc_chinese_name || null,
      arc_issue_date || null, arc_expiry_date || null,
      passport_number || null, arc_serial_number || null,
      cc_number || null, cc_expiry_date || null, nif || null, niss || null
    );

  });

  create();

  const newMember = db.prepare('SELECT id FROM members WHERE member_id = ?').get(memberId);
  writeAudit(res.locals.currentUser.id, res.locals.currentUser.email,
             newMember.id, `${memberId} ${first_name} ${last_name}`, 'member.created', null);

  req.session.flash = { type: 'success', message: `Member ${first_name} ${last_name} created (${memberId}).` };
  res.redirect('/admin/members');
});

// --- Member detail ---

router.get('/members/:id', (req, res) => {
  const member = db.prepare(
    `SELECT m.*, u.email, u.id as user_account_id, u.role as user_role, u.position as user_position, u.created_at as account_created
     FROM members m JOIN users u ON u.id = m.user_id WHERE m.id = ?`
  ).get(req.params.id);

  if (!member) return res.status(404).render('404', { title: 'Not Found' });

  const documents = db.prepare(
    `SELECT * FROM documents WHERE member_id = ? ORDER BY uploaded_at DESC`
  ).all(member.id);

  res.render('admin/member-detail', { title: `${member.first_name} ${member.last_name}`, member, documents });
});

// --- Edit form ---

router.get('/members/:id/edit', adminOnly, (req, res) => {
  const member = db.prepare(
    `SELECT m.*, u.email, u.position as user_position FROM members m JOIN users u ON u.id = m.user_id WHERE m.id = ?`
  ).get(req.params.id);

  if (!member) return res.status(404).render('404', { title: 'Not Found' });

  const defaultFee = parseInt(getSetting('default_fee_amount', '300'), 10);
  res.render('admin/member-edit', { title: 'Edit Member', member, errors: [], countries, taiwanLocations, defaultFee });
});

// --- Update member ---

router.post('/members/:id', adminOnly, photoUpload.single('photo'), (req, res) => {
  const member = db.prepare(
    `SELECT m.*, u.email FROM members m JOIN users u ON u.id = m.user_id WHERE m.id = ?`
  ).get(req.params.id);

  if (!member) return res.status(404).render('404', { title: 'Not Found' });

  const {
    first_name, last_name, email, new_password,
    phone_dialcode, phone_number,
    address_type,
    address, city, postal_code,
    city_zh, district_zh, district_en, address_zh,
    join_date,
    fee_amount, fee_last_paid,
    notes,
    arc_number, arc_name_en, arc_chinese_name, arc_issue_date, arc_expiry_date,
    passport_number, arc_serial_number,
    cc_number, cc_expiry_date, nif, niss,
  } = req.body;

  const errors = [];
  if (!first_name) errors.push('First name is required.');
  if (!last_name)  errors.push('Last name is required.');
  if (!email)      errors.push('Email is required.');

  const emailConflict = db.prepare(
    'SELECT id FROM users WHERE email = ? AND id != ?'
  ).get(email, member.user_id);
  if (emailConflict) errors.push('Another account already uses this email.');

  if (errors.length) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.render('admin/member-edit', {
      title: 'Edit Member',
      member: { ...member, ...req.body },
      errors,
      countries,
      taiwanLocations,
      defaultFee: parseInt(getSetting('default_fee_amount', '300'), 10),
    });
  }

  const phone = phone_number ? `${phone_dialcode || '+351'} ${phone_number}` : null;

  let photoPath = member.photo_path;
  if (req.file) {
    if (photoPath) {
      const old = path.join(process.cwd(), photoPath);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    photoPath = path.join('uploads', 'photos', req.file.filename);
  }

  const { status: feeStatus, validUntil: feeValidUntil } = computeFeeStatus(fee_amount, fee_last_paid || null);

  const update = db.transaction(() => {
    db.prepare(
      `UPDATE users SET email = ? WHERE id = ?`
    ).run(email.trim(), member.user_id);

    if (new_password && new_password.length >= 6) {
      const hash = bcrypt.hashSync(new_password, 10);
      db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hash, member.user_id);
    }

    db.prepare(`
      UPDATE members SET
        first_name=?, last_name=?, phone=?,
        address_type=?, address=?, city=?, postal_code=?,
        city_zh=?, district_zh=?, district_en=?, address_zh=?,
        join_date=?, fee_amount=?, fee_last_paid=?, fee_valid_until=?, fee_status=?,
        notes=?, photo_path=?,
        arc_number=?, arc_name_en=?, arc_chinese_name=?, arc_issue_date=?, arc_expiry_date=?,
        passport_number=?, arc_serial_number=?,
        cc_number=?, cc_expiry_date=?, nif=?, niss=?,
        updated_at=datetime('now')
      WHERE id=?
    `).run(
      first_name, last_name, phone,
      address_type || 'tw', address || null, city || null, postal_code || null,
      city_zh || null, district_zh || null, district_en || null, address_zh || null,
      join_date,
      parseInt(fee_amount, 10) >= 0 ? parseInt(fee_amount, 10) : 300, fee_last_paid || null, feeValidUntil, feeStatus,
      notes || null, photoPath,
      arc_number || null, arc_name_en || null, arc_chinese_name || null,
      arc_issue_date || null, arc_expiry_date || null,
      passport_number || null, arc_serial_number || null,
      cc_number || null, cc_expiry_date || null, nif || null, niss || null,
      member.id
    );
  });

  update();

  // Build a human-readable diff for the audit entry
  const _auditChanges = [];
  const _track = [
    ['first_name',      member.first_name,                    first_name],
    ['last_name',       member.last_name,                     last_name],
    ['email',           member.email,                         email ? email.trim() : null],
    ['phone',           member.phone,                         phone],
    ['fee_amount',      String(member.fee_amount),            String(parseInt(fee_amount, 10) >= 0 ? parseInt(fee_amount, 10) : 300)],
    ['fee_last_paid',   member.fee_last_paid  ? member.fee_last_paid.slice(0,10)  : null, fee_last_paid  || null],
    ['fee_status',      member.fee_status,                    feeStatus],
    ['arc_expiry_date', member.arc_expiry_date ? member.arc_expiry_date.slice(0,10) : null, arc_expiry_date || null],
    ['cc_expiry_date',  member.cc_expiry_date  ? member.cc_expiry_date.slice(0,10)  : null, cc_expiry_date  || null],
    ['arc_number',      member.arc_number,                    arc_number  || null],
    ['cc_number',       member.cc_number,                     cc_number   || null],
    ['notes',           member.notes,                         notes       || null],
  ];
  for (const [field, oldVal, newVal] of _track) {
    const o = oldVal ?? '—', n = newVal ?? '—';
    if (o !== n) _auditChanges.push(`${field}: "${o}" → "${n}"`);
  }
  if (new_password && new_password.length >= 6) _auditChanges.push('password changed');
  const _auditDetail = _auditChanges.length ? _auditChanges.join(' | ') : null;

  writeAudit(res.locals.currentUser.id, res.locals.currentUser.email,
             member.id, `${member.member_id} ${member.first_name} ${member.last_name}`, 'member.updated', _auditDetail);

  // HOOK: send fee confirmation email/SMS if fee_status changed to 'paid'

  req.session.flash = { type: 'success', message: 'Member updated.' };
  res.redirect(`/admin/members/${member.id}`);
});

// --- Delete member ---

router.post('/members/:id/delete', adminOnly, (req, res) => {
  const member = db.prepare(`
    SELECT m.*, u.role as user_role FROM members m JOIN users u ON u.id = m.user_id WHERE m.id = ?
  `).get(req.params.id);
  if (!member) return res.redirect('/admin/members');

  // Only super_admin can delete super_admin accounts
  if (member.user_role === 'super_admin' && res.locals.currentUser.role !== 'super_admin') {
    req.session.flash = { type: 'danger', message: 'Only a super-admin can delete another super-admin account.' };
    return res.redirect(`/admin/members/${req.params.id}`);
  }

  // Clean up files
  if (member.photo_path) {
    const p = path.join(process.cwd(), member.photo_path);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  const docs = db.prepare(`SELECT file_path FROM documents WHERE member_id = ?`).all(member.id);
  for (const doc of docs) {
    const p = path.join(process.cwd(), doc.file_path);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  // Audit before deletion — member row will not exist after CASCADE
  writeAudit(res.locals.currentUser.id, res.locals.currentUser.email,
             member.id, `${member.member_id} ${member.first_name} ${member.last_name}`, 'member.deleted', null);

  // Deleting the user cascades to members and documents
  db.prepare(`DELETE FROM users WHERE id = ?`).run(member.user_id);

  req.session.flash = { type: 'success', message: 'Member deleted.' };
  res.redirect('/admin/members');
});

// --- Upload card documents (AJAX) ---
// One slot per type per member — replaces existing if present. Runs OCR and returns extracted fields.

router.post('/members/:id/documents/card', adminOnly, cardUpload.single('image'), async (req, res) => {
  const member = db.prepare('SELECT id, member_id, first_name, last_name FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found.' });
  if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });

  const docType = req.body.doc_type;
  if (!CARD_TYPES.includes(docType)) return res.status(400).json({ error: 'Invalid card type.' });

  const ext = (path.extname(req.file.originalname).toLowerCase()) || '.jpg';
  const filename = `${Date.now()}-${uuidv4()}${ext}`;
  const filePath = path.join('uploads', 'documents', filename);
  const thumbFilename = `thumb-${filename}`;
  const thumbRelPath = path.join('uploads', 'thumbs', thumbFilename);
  const absFilePath = path.join(process.cwd(), filePath);
  const absThumbPath = path.join(process.cwd(), thumbRelPath);

  try {
    fs.writeFileSync(absFilePath, req.file.buffer);

    let thumbPath = null;
    try {
      await generateThumb(absFilePath, absThumbPath);
      thumbPath = thumbRelPath;
    } catch (_) {}

    // Delete any existing card of this type for this member
    const existing = db.prepare(
      'SELECT * FROM documents WHERE member_id = ? AND doc_type = ?'
    ).get(member.id, docType);
    if (existing) {
      const oldFile = path.join(process.cwd(), existing.file_path);
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      if (existing.thumb_path) {
        const oldThumb = path.join(process.cwd(), existing.thumb_path);
        if (fs.existsSync(oldThumb)) fs.unlinkSync(oldThumb);
      }
      db.prepare('DELETE FROM documents WHERE id = ?').run(existing.id);
    }

    const insertRes = db.prepare(`
      INSERT INTO documents (member_id, file_path, original_name, mime_type, doc_type, thumb_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(member.id, filePath, req.file.originalname, req.file.mimetype, docType, thumbPath);

    const docId = insertRes.lastInsertRowid;

    writeAudit(res.locals.currentUser.id, res.locals.currentUser.email,
               member.id, `${member.member_id} ${member.first_name} ${member.last_name}`, 'member.card_uploaded', docType);

    // Respond immediately — OCR runs in the background so the cPanel proxy
    // timeout can't drop the result before it reaches the browser.
    ocrCache.set(docId, { pending: true });
    res.json({ ok: true, docId, thumbPath, ocrPending: true });

    ocrScan(docType, absFilePath)
      .then(extracted => ocrCacheSet(docId, { done: true, extracted }))
      .catch(e       => ocrCacheSet(docId, { done: true, extracted: { _ocrError: e.message } }));
  } catch (err) {
    try { fs.unlinkSync(absFilePath); } catch (_) {}
    try { fs.unlinkSync(absThumbPath); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

// --- Upload misc documents ---

router.post('/members/:id/documents', adminOnly, docUpload.array('documents', 5), async (req, res) => {
  const member = db.prepare(`SELECT id, member_id, first_name, last_name FROM members WHERE id = ?`).get(req.params.id);
  if (!member) return res.status(404).redirect('/admin/members');

  if (req.files && req.files.length) {
    const insert = db.prepare(`
      INSERT INTO documents (member_id, file_path, original_name, mime_type, doc_type, thumb_path)
      VALUES (?, ?, ?, ?, 'misc', ?)
    `);
    for (const file of req.files) {
      const filePath = path.join('uploads', 'documents', file.filename);
      let thumbPath = null;
      if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
        const thumbFilename = `thumb-${file.filename}`;
        const absThumbPath = path.join(process.cwd(), 'uploads', 'thumbs', thumbFilename);
        try {
          await generateThumb(path.join(process.cwd(), filePath), absThumbPath);
          thumbPath = path.join('uploads', 'thumbs', thumbFilename);
        } catch (_) {}
      }
      insert.run(member.id, filePath, file.originalname, file.mimetype, thumbPath);
    }
    writeAudit(res.locals.currentUser.id, res.locals.currentUser.email,
               member.id, `${member.member_id} ${member.first_name} ${member.last_name}`, 'member.doc_uploaded',
               `${req.files.length} file(s): ${req.files.map(f => f.originalname).join(', ')}`);
    // HOOK: notify member a document was added to their profile
    req.session.flash = { type: 'success', message: `${req.files.length} document(s) uploaded.` };
  }

  res.redirect(`/admin/members/${req.params.id}`);
});

// --- Delete document ---

router.post('/members/:id/documents/:docId/delete', adminOnly, (req, res) => {
  const doc = db.prepare(
    `SELECT * FROM documents WHERE id = ? AND member_id = ?`
  ).get(req.params.docId, req.params.id);

  if (doc) {
    const p = path.join(process.cwd(), doc.file_path);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    db.prepare(`DELETE FROM documents WHERE id = ?`).run(doc.id);
    writeAudit(res.locals.currentUser.id, res.locals.currentUser.email,
               parseInt(req.params.id), `member #${req.params.id}`, 'member.doc_deleted', doc.original_name);
    req.session.flash = { type: 'success', message: 'Document deleted.' };
  }

  res.redirect(`/admin/members/${req.params.id}`);
});

// --- View document inline (for lightbox preview) ---

router.get('/members/:id/documents/:docId/view', adminOnly, (req, res) => {
  const doc = db.prepare(
    `SELECT * FROM documents WHERE id = ? AND member_id = ?`
  ).get(req.params.docId, req.params.id);

  if (!doc) return res.status(404).send('Document not found.');

  const filePath = path.join(process.cwd(), doc.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).send('File missing from server.');

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', 'sandbox');
  res.setHeader('Content-Disposition', contentDispositionFilename('inline', doc.original_name));
  res.sendFile(filePath);
});

// --- Download document ---

router.get('/members/:id/documents/:docId/download', adminOnly, (req, res) => {
  const doc = db.prepare(
    `SELECT * FROM documents WHERE id = ? AND member_id = ?`
  ).get(req.params.docId, req.params.id);

  if (!doc) return res.status(404).send('Document not found.');

  const filePath = path.join(process.cwd(), doc.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).send('File missing from server.');

  res.setHeader('Content-Disposition', contentDispositionFilename('attachment', doc.original_name));
  res.sendFile(filePath);
});

// --- Re-run OCR on a stored card document ---

router.post('/members/:id/documents/:docId/ocr', adminOnly, async (req, res) => {
  const doc = db.prepare(
    'SELECT * FROM documents WHERE id = ? AND member_id = ?'
  ).get(req.params.docId, req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  if (!CARD_TYPES.includes(doc.doc_type)) return res.status(400).json({ error: 'Not a card document.' });

  const filePath = path.join(process.cwd(), doc.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing from server.' });

  const docId = doc.id;
  ocrCache.set(docId, { pending: true });
  res.json({ ok: true, docId, ocrPending: true });

  ocrScan(doc.doc_type, filePath)
    .then(extracted => ocrCacheSet(docId, { done: true, extracted }))
    .catch(e       => ocrCacheSet(docId, { done: true, extracted: { _ocrError: e.message } }));
});

// --- OCR polling endpoint ---

router.get('/members/:id/documents/:docId/ocr-status', adminOnly, (req, res) => {
  const docId  = parseInt(req.params.docId, 10);
  const cached = ocrCache.get(docId);
  if (!cached) return res.json({ done: false, notFound: true });
  res.json(cached);
});

// --- Apply OCR-extracted fields to member record ---

router.post('/members/:id/apply-card-fields', adminOnly, (req, res) => {
  const member = db.prepare('SELECT id, member_id, first_name, last_name FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found.' });

  const ALLOWED = [
    'arc_number', 'arc_name_en', 'arc_chinese_name', 'arc_issue_date', 'arc_expiry_date',
    'arc_serial_number', 'passport_number', 'address_zh',
    'cc_number', 'cc_expiry_date', 'nif', 'niss',
  ];
  const sets = [];
  const params = [];
  for (const field of ALLOWED) {
    if (req.body[field] !== undefined) {
      sets.push(`${field} = ?`);
      params.push(req.body[field] || null);
    }
  }
  if (!sets.length) return res.json({ ok: true });

  params.push(member.id);
  db.prepare(
    `UPDATE members SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`
  ).run(...params);
  writeAudit(res.locals.currentUser.id, res.locals.currentUser.email,
             member.id, `${member.member_id} ${member.first_name} ${member.last_name}`, 'member.ocr_applied',
             sets.map(s => s.split(' = ')[0]).join(', '));
  res.json({ ok: true });
});

// --- NIA: get captcha image ---

router.get('/members/:id/arc-captcha', adminOnly, async (req, res) => {
  const member = db.prepare(
    'SELECT arc_number, arc_issue_date, arc_expiry_date, arc_serial_number FROM members WHERE id = ?'
  ).get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found.' });

  const missing = ['arc_number', 'arc_issue_date', 'arc_expiry_date', 'arc_serial_number']
    .filter(f => !member[f]);
  if (missing.length) {
    return res.status(400).json({
      error: `Fill in these ARC fields first: ${missing.map(f => f.replace(/_/g, ' ')).join(', ')}.`
    });
  }

  try {
    const captchaResp = await fetch(`${NIA_BASE}/api/captcha?${Date.now()}`, {
      headers: { ...NIA_HEADERS, Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' },
    });
    if (!captchaResp.ok) throw new Error(`NIA returned HTTP ${captchaResp.status}`);

    const setCookie = captchaResp.headers.get('set-cookie') || '';
    const jsessionid = (setCookie.match(/JSESSIONID=([^;]+)/) || [])[1];
    if (!jsessionid) throw new Error('No session cookie in NIA response');

    const imgBuf = Buffer.from(await captchaResp.arrayBuffer());
    const token  = uuidv4();
    arcSessions.set(token, { jsessionid, expires: Date.now() + 5 * 60 * 1000 });

    res.json({ token, captchaImage: `data:image/jpeg;base64,${imgBuf.toString('base64')}` });
  } catch (err) {
    res.status(502).json({ error: `Could not reach NIA: ${err.message}` });
  }
});

// --- NIA: submit captcha + fetch photo ---

const NIA_ERRORS = {
  '0301': 'No matching record found. Verify that the ARC number, issue date, expiry date, and serial number exactly match the physical card.',
};

router.post('/members/:id/arc-fetch-photo', adminOnly, async (req, res) => {
  const { token, captchaAnswer } = req.body;
  if (!token || !captchaAnswer) return res.status(400).json({ error: 'Missing token or captcha answer.' });

  const session = arcSessions.get(token);
  if (!session || Date.now() > session.expires) {
    return res.status(400).json({ error: 'Session expired — reload the captcha and try again.', refreshCaptcha: true });
  }
  arcSessions.delete(token);

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).json({ error: 'Member not found.' });

  try {
    // Step 1: validate captcha (mirrors NIA's own client-side check)
    const valResp = await fetch(
      `${NIA_BASE}/api/captcha/${encodeURIComponent(captchaAnswer)}/validation`,
      { headers: { ...NIA_HEADERS, cookie: `JSESSIONID=${session.jsessionid}`, 'Content-Type': 'application/json' } }
    );
    const valText = (await valResp.text()).trim();
    if (valText !== 'true') {
      return res.json({ success: false, error: 'Wrong verification code — please try again.', refreshCaptcha: true });
    }

    // Step 2: search
    const searchResp = await fetch(`${NIA_BASE}/api/search`, {
      method: 'POST',
      headers: {
        ...NIA_HEADERS,
        'Content-Type': 'application/json',
        captcha: captchaAnswer,
        cookie: `JSESSIONID=${session.jsessionid}`,
      },
      body: JSON.stringify({
        uino:       member.arc_number,
        issueDate:  member.arc_issue_date  ? member.arc_issue_date.slice(0, 10)  : '',
        expiryDate: member.arc_expiry_date ? member.arc_expiry_date.slice(0, 10) : '',
        serialNo:   member.arc_serial_number,
        captcha:    captchaAnswer,
      }),
    });

    const result = await searchResp.json();

    if (result.rcode !== '0000' || !result.data?.image) {
      const msg = NIA_ERRORS[result.rcode]
        || (result.rcode !== '0000' ? `NIA error ${result.rcode}: ${result.message}` : 'NIA returned no photo.');
      return res.json({ success: false, error: msg, refreshCaptcha: true });
    }

    // Step 3: decode + save photo
    const imgBuf    = Buffer.from(result.data.image, 'base64');
    const filename  = `${Date.now()}-${uuidv4()}.jpg`;
    const photoPath = path.join('uploads', 'photos', filename);
    fs.writeFileSync(path.join(process.cwd(), photoPath), imgBuf);

    if (member.photo_path) {
      const old = path.join(process.cwd(), member.photo_path);
      if (fs.existsSync(old)) try { fs.unlinkSync(old); } catch {}
    }

    db.prepare(`UPDATE members SET photo_path = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(photoPath, member.id);
    writeAudit(res.locals.currentUser.id, res.locals.currentUser.email,
               member.id, `${member.member_id} ${member.first_name} ${member.last_name}`, 'member.nia_photo_saved', null);

    res.json({ success: true, photoUrl: '/' + photoPath.replace(/\\/g, '/') });
  } catch (err) {
    res.status(502).json({ success: false, error: `Request failed: ${err.message}`, refreshCaptcha: false });
  }
});

// --- Change member account role + position (super_admin only) ---
router.post('/members/:id/change-role', superAdminOnly, (req, res) => {
  const member = db.prepare('SELECT id, user_id, member_id, first_name, last_name FROM members WHERE id = ?').get(req.params.id);
  if (!member) {
    req.session.flash = { type: 'danger', message: 'Member not found.' };
    return res.redirect('/admin/members');
  }
  const { role, position } = req.body;
  const VALID_ROLES     = ['super_admin', 'admin', 'member'];
  const VALID_POSITIONS = ['member', 'honorary', 'gestao', 'board', 'president', 'treasurer', 'secretary'];
  if (!VALID_ROLES.includes(role)) {
    req.session.flash = { type: 'danger', message: 'Invalid role.' };
    return res.redirect(`/admin/members/${req.params.id}`);
  }
  const safePosition = VALID_POSITIONS.includes(position) ? position : 'member';
  db.prepare('UPDATE users SET role = ?, position = ? WHERE id = ?').run(role, safePosition, member.user_id);
  writeAudit(res.locals.currentUser.id, res.locals.currentUser.email,
             member.id, `${member.member_id} ${member.first_name} ${member.last_name}`, 'member.role_changed',
             `role=${role}, position=${safePosition}`);
  req.session.flash = { type: 'success', message: `Account updated: role=${role}, position=${safePosition}.` };
  res.redirect(`/admin/members/${req.params.id}`);
});

// --- Reset member password (super_admin only) ---

router.post('/members/:id/set-password', superAdminOnly, (req, res) => {
  const member = db.prepare('SELECT id, user_id, member_id, first_name, last_name FROM members WHERE id = ?').get(req.params.id);
  if (!member) {
    req.session.flash = { type: 'danger', message: 'Member not found.' };
    return res.redirect('/admin/members');
  }
  const { new_password, confirm_password } = req.body;
  if (!new_password || new_password.length < 6) {
    req.session.flash = { type: 'danger', message: 'Password must be at least 6 characters.' };
    return res.redirect(`/admin/members/${req.params.id}`);
  }
  if (new_password !== confirm_password) {
    req.session.flash = { type: 'danger', message: 'Passwords do not match.' };
    return res.redirect(`/admin/members/${req.params.id}`);
  }
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, member.user_id);
  writeAudit(res.locals.currentUser.id, res.locals.currentUser.email,
             member.id, `${member.member_id} ${member.first_name} ${member.last_name}`,
             'member.password_reset', 'password reset by super_admin');
  req.session.flash = { type: 'success', message: 'Password updated successfully.' };
  res.redirect(`/admin/members/${req.params.id}`);
});

// --- Update fee fields only (gestao + admin+) ---

router.post('/members/:id/fee', feeWriteGuard, (req, res) => {
  const member = db.prepare(
    `SELECT m.id, m.member_id, m.first_name, m.last_name, m.fee_amount, m.fee_last_paid, m.fee_status,
            u.position as user_position
     FROM members m JOIN users u ON u.id = m.user_id WHERE m.id = ?`
  ).get(req.params.id);
  if (!member) return res.redirect('/admin/members');

  if (member.user_position === 'honorary') {
    req.session.flash = { type: 'danger', message: 'Fee fields are not applicable to honorary members.' };
    return res.redirect(`/admin/members/${member.id}`);
  }

  const { fee_amount, fee_last_paid } = req.body;
  const { status: feeStatus, validUntil: feeValidUntil } = computeFeeStatus(fee_amount, fee_last_paid || null);

  db.prepare(
    `UPDATE members SET fee_amount=?, fee_last_paid=?, fee_valid_until=?, fee_status=?, updated_at=datetime('now') WHERE id=?`
  ).run(parseInt(fee_amount, 10) >= 0 ? parseInt(fee_amount, 10) : 300, fee_last_paid || null, feeValidUntil, feeStatus, member.id);

  const oldAmount   = member.fee_amount;
  const oldPaid     = member.fee_last_paid ? member.fee_last_paid.slice(0, 10) : '—';
  const newAmount   = parseInt(fee_amount, 10) >= 0 ? parseInt(fee_amount, 10) : 300;
  const newPaid     = fee_last_paid || '—';
  writeAudit(res.locals.currentUser.id, res.locals.currentUser.email,
             member.id, `${member.member_id} ${member.first_name} ${member.last_name}`, 'member.fee_updated',
             `fee_amount: ${oldAmount} → ${newAmount} | fee_last_paid: "${oldPaid}" → "${newPaid}" | fee_status: ${member.fee_status} → ${feeStatus}`);

  req.session.flash = { type: 'success', message: 'Payment status updated.' };
  res.redirect(`/admin/members/${member.id}`);
});

// --- OCR model health check (super_admin only) ---

router.post('/ocr-health-check', superAdminOnly, async (req, res) => {
  try {
    const warnings = await checkModels();
    res.json({ ok: true, warnings });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/ocr-dismiss-warning', superAdminOnly, (req, res) => {
  const { model } = req.body;
  if (!model) return res.status(400).json({ ok: false, error: 'Missing model.' });
  dismissModelWarning(model);
  res.json({ ok: true });
});

// --- Test a single OCR model ID (AJAX, super_admin only) ---

const MODEL_ID_RE = /^[a-zA-Z0-9_\-/:\.]{1,120}$/;
const _testCooldowns = new Map(); // modelId → last tested timestamp

router.post('/ocr-test-model', superAdminOnly, async (req, res) => {
  const { model } = req.body;
  if (!model) return res.status(400).json({ ok: false, error: 'Missing model.' });
  const id = model.trim();
  if (!MODEL_ID_RE.test(id)) return res.status(400).json({ ok: false, error: 'Invalid model ID format.' });
  const last = _testCooldowns.get(id) || 0;
  if (Date.now() - last < 10_000) return res.status(429).json({ ok: false, error: 'Please wait before testing this model again.' });
  _testCooldowns.set(id, Date.now());
  const result = await ocrTestModel(id).catch(e => ({ ok: false, error: e.message }));
  res.json(result);
});

// --- Settings: default annual fee (super_admin only) ---

router.post('/settings/fee', superAdminOnly, (req, res) => {
  const fee = parseInt(req.body.fee_amount, 10);
  if (isNaN(fee) || fee < 0) {
    req.session.flash = { type: 'danger', message: 'Invalid fee amount.' };
    return res.redirect('/admin');
  }
  setSetting('default_fee_amount', String(fee));
  writeAudit(res.locals.currentUser.id, res.locals.currentUser.email,
             null, null, 'settings.fee_changed', `default_fee_amount=${fee}`);
  req.session.flash = { type: 'success', message: `Default annual fee updated to ${fee} TWD.` };
  res.redirect('/admin');
});

// --- Settings: OCR model list (super_admin only) ---

router.post('/settings/models', superAdminOnly, (req, res) => {
  let models = req.body.models;
  if (typeof models === 'string') models = [models];
  if (!Array.isArray(models)) models = [];
  models = models.map(m => String(m).trim()).filter(m => MODEL_ID_RE.test(m));
  if (!models.length) {
    req.session.flash = { type: 'danger', message: 'Model list cannot be empty.' };
    return res.redirect('/admin');
  }
  setActiveModels(models);
  setSetting('ocr_models', JSON.stringify(models));
  writeAudit(res.locals.currentUser.id, res.locals.currentUser.email,
             null, null, 'settings.models_changed', models.join(', '));
  req.session.flash = { type: 'success', message: 'OCR model list saved.' };
  res.redirect('/admin');
});

// --- Audit log ---

router.get('/audit', adminOnly, (req, res) => {
  const page    = Math.max(1, parseInt(req.query.page) || 1);
  const perPage = 50;
  const offset  = (page - 1) * perPage;

  const total = db.prepare('SELECT COUNT(*) as cnt FROM audit_log').get().cnt;
  const logs  = db.prepare(
    `SELECT * FROM audit_log ORDER BY id DESC LIMIT ? OFFSET ?`
  ).all(perPage, offset);
  const totalPages = Math.ceil(total / perPage);

  res.render('admin/audit-log', { title: 'Audit Log', logs, page, totalPages, total });
});

// --- Server log viewer + stream (SSE) — super_admin only ---

router.get('/logs', (req, res) => {
  if (res.locals.currentUser?.role !== 'super_admin') {
    req.session.flash = { type: 'danger', message: 'Super-admin access required.' };
    return res.redirect('/admin');
  }
  res.render('admin/log-window', {});
});

router.get('/logs/stream', (req, res) => {
  if (res.locals.currentUser?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.setHeader('Content-Type',      'text/event-stream');
  res.setHeader('Cache-Control',     'no-cache');
  res.setHeader('Connection',        'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // prevents nginx from buffering SSE
  res.flushHeaders();

  for (const entry of getLogs()) {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  }

  logSubscribe(res);
});

module.exports = router;
