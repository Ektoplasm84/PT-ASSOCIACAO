const db = require('../database/db');

const MAX_ENTRIES = 2000;

const insertAndTrim = db.transaction((actorId, actorEmail, memberId, memberRef, action, detail) => {
  db.prepare(`
    INSERT INTO audit_log (actor_id, actor_email, member_id, member_ref, action, detail)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(actorId, actorEmail, memberId || null, memberRef || null, action, detail || null);

  const count = db.prepare('SELECT COUNT(*) as cnt FROM audit_log').get().cnt;
  if (count > MAX_ENTRIES) {
    db.prepare(
      `DELETE FROM audit_log WHERE id IN (SELECT id FROM audit_log ORDER BY id ASC LIMIT ?)`
    ).run(count - MAX_ENTRIES);
  }
});

function writeAudit(actorId, actorEmail, memberId, memberRef, action, detail) {
  insertAndTrim(actorId, actorEmail, memberId, memberRef, action, detail);
}

module.exports = { writeAudit };
