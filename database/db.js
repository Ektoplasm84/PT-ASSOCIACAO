const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(process.cwd(), 'database', 'data.db');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Base schema (first run) ---
const baseSchema = [
  `CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'member' CHECK(role IN ('super_admin','admin','member')),
    position      TEXT    NOT NULL DEFAULT 'member',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS members (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    member_id       TEXT    NOT NULL UNIQUE,
    first_name      TEXT    NOT NULL,
    last_name       TEXT    NOT NULL,
    phone           TEXT,
    address         TEXT,
    city            TEXT,
    postal_code     TEXT,
    join_date       TEXT    NOT NULL DEFAULT (date('now')),
    fee_amount      INTEGER NOT NULL DEFAULT 300,
    fee_last_paid   TEXT,
    fee_valid_until TEXT,
    fee_status      TEXT    NOT NULL DEFAULT 'unpaid'
                    CHECK(fee_status IN ('paid','unpaid','renewal_incoming')),
    notes           TEXT,
    photo_path      TEXT,
    arc_number      TEXT,
    arc_chinese_name TEXT,
    arc_issue_date  TEXT,
    arc_expiry_date TEXT,
    passport_number TEXT,
    arc_serial_number TEXT,
    cc_number       TEXT,
    cc_issue_date   TEXT,
    cc_expiry_date  TEXT,
    nif             TEXT,
    niss            TEXT,
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS documents (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id     INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    file_path     TEXT    NOT NULL,
    original_name TEXT    NOT NULL,
    mime_type     TEXT    NOT NULL,
    uploaded_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email  ON users(email)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_members_mid  ON members(member_id)`,
  `CREATE INDEX       IF NOT EXISTS idx_docs_mid      ON documents(member_id)`,
];

for (const sql of baseSchema) {
  db.prepare(sql).run();
}

// --- Migration: recreate members table when schema is outdated ---
// Triggered when fee_amount column or renewal_incoming status are missing.
const tableSQL = db.prepare(
  `SELECT sql FROM sqlite_master WHERE type='table' AND name='members'`
).get();

const needsRebuild = tableSQL && (
  !tableSQL.sql.includes('fee_amount') ||
  !tableSQL.sql.includes('renewal_incoming')
);

if (needsRebuild) {
  db.pragma('foreign_keys = OFF');

  const rebuild = db.transaction(() => {
    db.prepare(`CREATE TABLE members_new (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id         INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      member_id       TEXT    NOT NULL UNIQUE,
      first_name      TEXT    NOT NULL,
      last_name       TEXT    NOT NULL,
      phone           TEXT,
      address         TEXT,
      city            TEXT,
      postal_code     TEXT,
      join_date       TEXT    NOT NULL DEFAULT (date('now')),
      fee_amount      INTEGER NOT NULL DEFAULT 300,
      fee_last_paid   TEXT,
      fee_valid_until TEXT,
      fee_status      TEXT    NOT NULL DEFAULT 'unpaid'
                      CHECK(fee_status IN ('paid','unpaid','renewal_incoming')),
      notes           TEXT,
      photo_path      TEXT,
      arc_number      TEXT,
      arc_chinese_name TEXT,
      arc_issue_date  TEXT,
      arc_expiry_date TEXT,
      passport_number TEXT,
      arc_serial_number TEXT,
      cc_number       TEXT,
      cc_issue_date   TEXT,
      cc_expiry_date  TEXT,
      nif             TEXT,
      niss            TEXT,
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )`).run();

    // Copy all columns that already exist in the old table
    const oldCols = db.pragma('table_info(members)').map(c => c.name);
    const newTargetCols = [
      'id','user_id','member_id','first_name','last_name','phone','address',
      'city','postal_code','join_date','notes','photo_path',
      'arc_number','arc_chinese_name','arc_issue_date','arc_expiry_date',
      'passport_number','arc_serial_number','cc_number','cc_issue_date',
      'cc_expiry_date','nif','niss','updated_at',
    ];
    const copyable = newTargetCols.filter(c => oldCols.includes(c));

    // Map old fee_status: 'partial' → 'unpaid' (old catch-all)
    db.prepare(`
      INSERT INTO members_new (${copyable.join(',')}, fee_amount, fee_status)
      SELECT ${copyable.join(',')}, 300,
        CASE fee_status
          WHEN 'paid'    THEN 'paid'
          WHEN 'partial' THEN 'unpaid'
          ELSE 'unpaid'
        END
      FROM members
    `).run();

    db.prepare(`DROP TABLE members`).run();
    db.prepare(`ALTER TABLE members_new RENAME TO members`).run();
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_members_mid ON members(member_id)`).run();
  });

  rebuild();
  db.pragma('foreign_keys = ON');
  console.log('Members table migrated: added fee_amount, fee_last_paid, fee_valid_until.');
}

// --- Migration: update users role values (admin→super_admin, user→member) ---
const usersTableSQL = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`).get();
if (usersTableSQL && !usersTableSQL.sql.includes('super_admin')) {
  db.pragma('foreign_keys = OFF');
  const rebuildUsers = db.transaction(() => {
    db.prepare(`CREATE TABLE users_new (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'member' CHECK(role IN ('super_admin','admin','member')),
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    )`).run();
    db.prepare(`
      INSERT INTO users_new (id, email, password_hash, role, created_at)
      SELECT id, email, password_hash,
        CASE role WHEN 'admin' THEN 'super_admin' ELSE 'member' END,
        created_at
      FROM users
    `).run();
    db.prepare('DROP TABLE users').run();
    db.prepare('ALTER TABLE users_new RENAME TO users').run();
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)').run();
  });
  rebuildUsers();
  db.pragma('foreign_keys = ON');
  console.log('Users table migrated: admin→super_admin, user→member.');
}

// --- Migration: add position column + remove gestao from role CHECK ---
const usersTableSQL2 = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
if (usersTableSQL2 && !usersTableSQL2.sql.includes('position')) {
  db.pragma('foreign_keys = OFF');
  const addPosition = db.transaction(() => {
    db.prepare(`CREATE TABLE users_pos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'member' CHECK(role IN ('super_admin','admin','member')),
      position      TEXT    NOT NULL DEFAULT 'member',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    )`).run();
    db.prepare(`
      INSERT INTO users_pos (id, email, password_hash, role, position, created_at)
      SELECT id, email, password_hash,
        CASE role WHEN 'gestao' THEN 'member' ELSE role END,
        CASE role WHEN 'gestao' THEN 'gestao' ELSE 'member' END,
        created_at
      FROM users
    `).run();
    db.prepare('DROP TABLE users').run();
    db.prepare('ALTER TABLE users_pos RENAME TO users').run();
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)').run();
  });
  addPosition();
  db.pragma('foreign_keys = ON');
  console.log('Users table migrated: added position column, gestao role → position.');
}

// --- Seed default admin if no users exist ---
const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
if (userCount.cnt === 0) {
  const hash = bcrypt.hashSync('admin1234', 10);

  const seed = db.transaction(() => {
    const res = db.prepare(
      `INSERT INTO users (email, password_hash, role, position) VALUES (?, ?, 'super_admin', 'member')`
    ).run('admin@associacao.pt', hash);

    db.prepare(`
      INSERT INTO members (user_id, member_id, first_name, last_name, join_date)
      VALUES (?, ?, ?, ?, date('now'))
    `).run(res.lastInsertRowid, 'ASSOC-0001', 'Admin', 'Geral');
  });

  seed();
  console.log('Seeded default admin: admin@associacao.pt / admin1234');
}

// --- Migration: add dual-language address columns ---
const existingCols = db.pragma('table_info(members)').map(c => c.name);
const addrMigrations = [
  { col: 'address_type', sql: `ALTER TABLE members ADD COLUMN address_type TEXT DEFAULT 'tw'` },
  { col: 'city_zh',      sql: `ALTER TABLE members ADD COLUMN city_zh TEXT` },
  { col: 'district_zh',  sql: `ALTER TABLE members ADD COLUMN district_zh TEXT` },
  { col: 'district_en',  sql: `ALTER TABLE members ADD COLUMN district_en TEXT` },
  { col: 'address_zh',   sql: `ALTER TABLE members ADD COLUMN address_zh TEXT` },
];
for (const m of addrMigrations) {
  if (!existingCols.includes(m.col)) {
    db.prepare(m.sql).run();
  }
}

// --- Migration: add arc_name_en to members ---
const memberCols2 = db.prepare('PRAGMA table_info(members)').all().map(c => c.name);
if (!memberCols2.includes('arc_name_en')) {
  db.prepare('ALTER TABLE members ADD COLUMN arc_name_en TEXT').run();
}

// --- Migration: add is_aprc flag to members ---
const memberCols3 = db.prepare('PRAGMA table_info(members)').all().map(c => c.name);
if (!memberCols3.includes('is_aprc')) {
  db.prepare('ALTER TABLE members ADD COLUMN is_aprc INTEGER NOT NULL DEFAULT 0').run();
}

// --- Migration: add doc_type and thumb_path to documents ---
const docCols = db.prepare('PRAGMA table_info(documents)').all().map(c => c.name);
if (!docCols.includes('doc_type')) {
  db.prepare("ALTER TABLE documents ADD COLUMN doc_type TEXT NOT NULL DEFAULT 'misc'").run();
}
if (!docCols.includes('thumb_path')) {
  db.prepare('ALTER TABLE documents ADD COLUMN thumb_path TEXT').run();
}

// HOOK: future notifications schema
// CREATE TABLE IF NOT EXISTS notifications (
//   id        INTEGER PRIMARY KEY AUTOINCREMENT,
//   member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
//   type      TEXT NOT NULL CHECK(type IN ('email','sms')),
//   event     TEXT NOT NULL,
//   sent_at   TEXT,
//   status    TEXT NOT NULL DEFAULT 'pending'
// );

// --- Audit log (no FK on member_id — entries survive member deletion) ---
db.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id    INTEGER,
  actor_email TEXT    NOT NULL,
  member_id   INTEGER,
  member_ref  TEXT,
  action      TEXT    NOT NULL,
  detail      TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
)`).run();

// --- App settings (key/value store for runtime-configurable values) ---
db.prepare(`CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`).run();

// --- Events + per-user invites ---
db.prepare(`CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  description TEXT,
  location    TEXT,
  start_date  TEXT    NOT NULL,
  end_date    TEXT,
  created_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS event_invites (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
  seen_at      TEXT,
  responded_at TEXT,
  notified_at  TEXT,
  UNIQUE(event_id, user_id)
)`).run();

db.prepare(`CREATE INDEX IF NOT EXISTS idx_ei_user  ON event_invites(user_id)`).run();
db.prepare(`CREATE INDEX IF NOT EXISTS idx_ei_event ON event_invites(event_id)`).run();

module.exports = db;
