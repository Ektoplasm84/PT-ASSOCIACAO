const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const Jimp = require('jimp');
const db = require('../database/db');
const { writeAudit } = require('../utils/audit');
const { startOcrJob, getOcrJob } = require('../utils/ocr');
const countries       = require('../utils/countries');
const taiwanLocations = require('../utils/taiwan-districts');

function fixFilename(name) {
  return Buffer.from(name, 'latin1').toString('utf8');
}

async function generateThumb(srcPath, thumbPath) {
  const img = await Jimp.read(srcPath);
  await img.resize(300, Jimp.AUTO).writeAsync(thumbPath);
}

const CARD_TYPES = ['arc_front', 'arc_back', 'cc_front', 'cc_back', 'tw_passport_front', 'tw_id_front', 'tw_id_back'];

const cardUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  },
});

const router = express.Router();

function contentDispositionFilename(disposition, name) {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\r\n]/g, '_');
  if (ascii === name) return `${disposition}; filename="${ascii}"`;
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

const photoStorage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, path.join(process.cwd(), 'uploads', 'photos'));
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

function getOwnMember(userId) {
  return db.prepare(
    `SELECT m.*, u.email, u.position as user_position FROM members m JOIN users u ON u.id = m.user_id WHERE m.user_id = ?`
  ).get(userId);
}

// --- Own profile view ---

router.get('/', (req, res) => {
  const member = getOwnMember(req.session.userId);
  if (!member) {
    req.session.flash = { type: 'danger', message: 'No member profile found for your account.' };
    return res.redirect('/login');
  }
  const documents = db.prepare(
    `SELECT * FROM documents WHERE member_id = ? ORDER BY uploaded_at DESC`
  ).all(member.id);

  const invites = db.prepare(`
    SELECT ei.id, ei.status, ei.responded_at,
           e.id as event_id, e.title, e.description, e.location, e.start_date, e.end_date,
           u.email as creator_email
    FROM event_invites ei
    JOIN events e ON e.id = ei.event_id
    JOIN users u ON u.id = e.created_by
    WHERE ei.user_id = ?
    ORDER BY e.start_date ASC
  `).all(req.session.userId);

  let feeReminder = null;
  if (member.user_position !== 'honorary') {
    if (member.fee_status === 'unpaid') {
      feeReminder = 'Your annual membership fee is overdue.';
    } else if (member.fee_status === 'renewal_incoming') {
      feeReminder = `Your fee is due for renewal (valid until ${member.fee_valid_until ? member.fee_valid_until.slice(0, 10) : '—'}).`;
    }
  }

  const vaultFiles = db.prepare(
    `SELECT * FROM vault_files WHERE section = 'public' ORDER BY uploaded_at DESC`
  ).all();

  res.render('user/profile', { title: 'My Profile', member, documents, invites, feeReminder, vaultFiles });
});

// --- Edit form ---

router.get('/edit', (req, res) => {
  const member = getOwnMember(req.session.userId);
  if (!member) return res.redirect('/profile');
  const documents = db.prepare(`SELECT * FROM documents WHERE member_id = ? ORDER BY uploaded_at DESC`).all(member.id);
  res.render('user/profile-edit', { title: 'Edit Profile', member, errors: [], countries, taiwanLocations, documents });
});

// --- Update own profile ---

router.post('/', photoUpload.single('photo'), (req, res) => {
  const member = getOwnMember(req.session.userId);
  if (!member) return res.redirect('/login');

  const {
    phone_dialcode, phone_number,
    address_type,
    address, city, postal_code,
    city_zh, district_zh, district_en, address_zh,
    current_password, new_password,
    arc_number, arc_name_en, arc_chinese_name, arc_issue_date, arc_expiry_date,
    passport_number, arc_serial_number, tw_id_number, date_of_birth, gender, birthplace_tw,
    cc_number, cc_expiry_date, nif, niss,
  } = req.body;
  const errors = [];

  if (new_password) {
    if (!current_password) {
      errors.push('Enter your current password to set a new one.');
    } else {
      const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.session.userId);
      if (!bcrypt.compareSync(current_password, user.password_hash)) {
        errors.push('Current password is incorrect.');
      } else if (new_password.length < 6) {
        errors.push('New password must be at least 6 characters.');
      }
    }
  }

  if (errors.length) {
    if (req.file) fs.unlinkSync(req.file.path);
    const documents = db.prepare(`SELECT * FROM documents WHERE member_id = ? ORDER BY uploaded_at DESC`).all(member.id);
    return res.render('user/profile-edit', {
      title: 'Edit Profile',
      member: { ...member, ...req.body },
      errors,
      countries,
      taiwanLocations,
      documents,
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

  const update = db.transaction(() => {
    if (new_password && new_password.length >= 6) {
      const hash = bcrypt.hashSync(new_password, 10);
      db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hash, req.session.userId);
    }

    db.prepare(`
      UPDATE members SET
        phone=?,
        address_type=?, address=?, city=?, postal_code=?,
        city_zh=?, district_zh=?, district_en=?, address_zh=?,
        photo_path=?,
        arc_number=?, arc_name_en=?, arc_chinese_name=?, arc_issue_date=?, arc_expiry_date=?,
        passport_number=?, arc_serial_number=?, tw_id_number=?,
        date_of_birth=?, gender=?, birthplace_tw=?,
        cc_number=?, cc_expiry_date=?, nif=?, niss=?,
        updated_at=datetime('now')
      WHERE user_id=?
    `).run(
      phone,
      address_type || 'tw', address || null, city || null, postal_code || null,
      city_zh || null, district_zh || null, district_en || null, address_zh || null,
      photoPath,
      arc_number || null, arc_name_en || null, arc_chinese_name || null,
      arc_issue_date || null, arc_expiry_date || null,
      passport_number || null, arc_serial_number || null,
      (member.is_tw_id || member.is_tw_passport) ? (tw_id_number || null) : member.tw_id_number,
      date_of_birth || null,
      gender || null,
      (member.is_tw_id || member.is_tw_passport) ? (birthplace_tw || null) : member.birthplace_tw,
      cc_number || null, cc_expiry_date || null, nif || null, niss || null,
      req.session.userId
    );
  });

  update();

  const _selfChanges = [];
  const _phone = phone_number ? `${phone_dialcode || '+351'} ${phone_number}` : null;
  const _trackSelf = [
    ['phone',           member.phone,                         _phone],
    ['arc_expiry_date', member.arc_expiry_date ? member.arc_expiry_date.slice(0,10) : null, arc_expiry_date || null],
    ['cc_expiry_date',  member.cc_expiry_date  ? member.cc_expiry_date.slice(0,10)  : null, cc_expiry_date  || null],
    ['arc_number',      member.arc_number,                    arc_number  || null],
    ['cc_number',       member.cc_number,                     cc_number   || null],
    ['address_zh',      member.address_zh,                    address_zh  || null],
    ['address',         member.address,                       address     || null],
  ];
  for (const [field, oldVal, newVal] of _trackSelf) {
    const o = oldVal ?? '—', n = newVal ?? '—';
    if (o !== n) _selfChanges.push(`${field}: "${o}" → "${n}"`);
  }
  if (new_password && new_password.length >= 6) _selfChanges.push('password changed');
  const _selfDetail = _selfChanges.length ? _selfChanges.join(' | ') : null;

  writeAudit(member.user_id, member.email,
             member.id, `${member.member_id} ${member.first_name} ${member.last_name}`, 'profile.self_updated', _selfDetail);

  req.session.flash = { type: 'success', message: 'Profile updated.' };
  res.redirect('/profile');
});

// --- View own document inline (for lightbox preview) ---

router.get('/documents/:docId/view', (req, res) => {
  const member = getOwnMember(req.session.userId);
  if (!member) return res.status(403).send('Unauthorized.');

  const doc = db.prepare(
    `SELECT * FROM documents WHERE id = ? AND member_id = ?`
  ).get(req.params.docId, member.id);

  if (!doc) return res.status(404).send('Document not found.');

  const filePath = path.join(process.cwd(), doc.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).send('File missing from server.');

  res.setHeader('Content-Disposition', contentDispositionFilename('inline', doc.original_name));
  res.sendFile(filePath);
});

// --- iCal export for a single invite ---

router.get('/invites/:id/export.ics', (req, res) => {
  const invite = db.prepare(`
    SELECT ei.id, e.id as event_id, e.title, e.description, e.location, e.start_date, e.end_date
    FROM event_invites ei
    JOIN events e ON e.id = ei.event_id
    WHERE ei.id = ? AND ei.user_id = ?
  `).get(req.params.id, req.session.userId);

  if (!invite) return res.status(404).send('Invite not found.');

  function icsDate(d) { return d ? d.slice(0, 10).replace(/-/g, '') : null; }
  function icsDateNext(d) {
    const dt = new Date((d.slice(0, 10)) + 'T00:00:00Z');
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString().slice(0, 10).replace(/-/g, '');
  }
  function icsEscape(s) { return s ? s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n') : ''; }

  const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  const endDate = invite.end_date ? icsDateNext(invite.end_date) : icsDateNext(invite.start_date);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PT Associacao//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:event-${invite.event_id}-inv-${invite.id}@associacao.pt`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${icsDate(invite.start_date)}`,
    `DTEND;VALUE=DATE:${endDate}`,
    `SUMMARY:${icsEscape(invite.title)}`,
    invite.location    ? `LOCATION:${icsEscape(invite.location)}`       : null,
    invite.description ? `DESCRIPTION:${icsEscape(invite.description)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  const safeName = invite.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.ics"`);
  res.send(lines);
});

// --- Respond to event invite ---

router.post('/invites/:id/respond', (req, res) => {
  const { action } = req.body;
  if (!['accepted', 'declined'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action.' });
  }
  const invite = db.prepare(
    `SELECT * FROM event_invites WHERE id = ? AND user_id = ?`
  ).get(req.params.id, req.session.userId);
  if (!invite) return res.status(404).json({ error: 'Invite not found.' });
  db.prepare(
    `UPDATE event_invites SET status = ?, responded_at = datetime('now') WHERE id = ?`
  ).run(action, req.params.id);
  res.json({ ok: true, status: action });
});

// --- Upload own card document (AJAX) + auto-OCR ---

router.post('/documents/card', cardUpload.single('image'), async (req, res) => {
  const member = getOwnMember(req.session.userId);
  if (!member) return res.status(403).json({ error: 'Unauthorized.' });
  if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });

  const docType = req.body.doc_type;
  if (!CARD_TYPES.includes(docType)) return res.status(400).json({ error: 'Invalid card type.' });

  const ext          = path.extname(req.file.originalname).toLowerCase() || '.jpg';
  const filename     = `${Date.now()}-${uuidv4()}${ext}`;
  const filePath     = path.join('uploads', 'documents', filename);
  const thumbRelPath = path.join('uploads', 'thumbs', `thumb-${filename}`);
  const absFilePath  = path.join(process.cwd(), filePath);
  const absThumbPath = path.join(process.cwd(), thumbRelPath);

  try {
    fs.writeFileSync(absFilePath, req.file.buffer);

    let thumbPath = null;
    try { await generateThumb(absFilePath, absThumbPath); thumbPath = thumbRelPath; } catch (_) {}

    const existing = db.prepare('SELECT * FROM documents WHERE member_id = ? AND doc_type = ?').get(member.id, docType);
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
    `).run(member.id, filePath, fixFilename(req.file.originalname), req.file.mimetype, docType, thumbPath);

    const docId = insertRes.lastInsertRowid;
    writeAudit(req.session.userId, member.email, member.id,
               `${member.member_id} ${member.first_name} ${member.last_name}`,
               'member.card_uploaded', docType);

    res.json({ ok: true, docId, thumbPath, ocrPending: true });
    startOcrJob(docId, docType, absFilePath);
  } catch (err) {
    try { fs.unlinkSync(absFilePath); } catch (_) {}
    try { fs.unlinkSync(absThumbPath); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

// --- Poll OCR status for own document ---

router.get('/documents/:docId/ocr-status', (req, res) => {
  const member = getOwnMember(req.session.userId);
  if (!member) return res.status(403).json({ error: 'Unauthorized.' });
  const docId = parseInt(req.params.docId, 10);
  const doc   = db.prepare('SELECT id FROM documents WHERE id = ? AND member_id = ?').get(docId, member.id);
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  const cached = getOcrJob(docId);
  if (!cached) return res.json({ done: false, notFound: true });
  res.json(cached);
});

// --- Download own document ---

router.get('/documents/:docId/download', (req, res) => {
  const member = getOwnMember(req.session.userId);
  if (!member) return res.status(403).send('Unauthorized.');

  const doc = db.prepare(
    `SELECT * FROM documents WHERE id = ? AND member_id = ?`
  ).get(req.params.docId, member.id);

  if (!doc) return res.status(404).send('Document not found.');

  const filePath = path.join(process.cwd(), doc.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).send('File missing from server.');

  res.setHeader('Content-Disposition', contentDispositionFilename('attachment', doc.original_name));
  res.sendFile(filePath);
});

module.exports = { router, contentDispositionFilename };
