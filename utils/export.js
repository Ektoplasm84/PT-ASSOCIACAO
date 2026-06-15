'use strict';

const ExcelJS  = require('exceljs');
const archiver = require('archiver');
const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');

const TMP_DIR = path.join(process.cwd(), 'uploads', 'tmp');
const _jobs   = new Map();

function _ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

// Delete any leftover export ZIPs from previous server runs (in-memory job map is gone on restart)
function _cleanupOrphans() {
  if (!fs.existsSync(TMP_DIR)) return;
  for (const f of fs.readdirSync(TMP_DIR)) {
    if (f.startsWith('export_') && f.endsWith('.zip')) {
      try { fs.unlinkSync(path.join(TMP_DIR, f)); } catch (_) {}
    }
  }
}
_cleanupOrphans();

// ── Public API ─────────────────────────────────────────────────────────────────

function startExportJob(members, documentsMap) {
  _ensureTmpDir();
  const jobId = crypto.randomBytes(8).toString('hex');
  _jobs.set(jobId, { pending: true, progress: 0, total: members.length + 1, stage: 'Preparing…' });
  _runExport(jobId, members, documentsMap).catch(err => {
    const j = _jobs.get(jobId) || {};
    _jobs.set(jobId, { ...j, error: err.message, done: true });
  });
  return jobId;
}

function getExportJob(jobId) {
  return _jobs.get(jobId) || null;
}

function deleteExportJob(jobId) {
  const j = _jobs.get(jobId);
  if (j && j.zipPath) { try { fs.unlinkSync(j.zipPath); } catch (_) {} }
  _jobs.delete(jobId);
}

// ── Core export ────────────────────────────────────────────────────────────────

async function _runExport(jobId, members, documentsMap) {
  const job = _jobs.get(jobId);

  // Stage 1: Build Excel workbook
  job.total    = members.length + 1;
  job.progress = 0;
  job.stage    = `Building spreadsheet… (0 / ${members.length})`;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'PT Associação';
  wb.created = new Date();

  const ws = wb.addWorksheet('Members');
  ws.columns = [
    { header: 'Member ID',         key: 'member_id',         width: 14 },
    { header: 'First Name',        key: 'first_name',        width: 16 },
    { header: 'Last Name',         key: 'last_name',         width: 22 },
    { header: 'Display Name (EN)', key: 'display_name',      width: 30 },
    { header: 'Chinese Name',      key: 'arc_chinese_name',  width: 14 },
    { header: 'Email',             key: 'email',             width: 32 },
    { header: 'Phone',             key: 'phone',             width: 18 },
    { header: 'Join Date',         key: 'join_date',         width: 12 },
    { header: 'Position',          key: 'position',          width: 14 },
    { header: 'Role',              key: 'role',              width: 14 },
    { header: 'Fee Status',        key: 'fee_status',        width: 18 },
    { header: 'Fee Amount (TWD)',  key: 'fee_amount',        width: 16 },
    { header: 'Fee Last Paid',     key: 'fee_last_paid',     width: 14 },
    { header: 'Fee Valid Until',   key: 'fee_valid_until',   width: 14 },
    { header: 'ARC Number',        key: 'arc_number',        width: 14 },
    { header: 'ARC Serial No.',    key: 'arc_serial_number', width: 14 },
    { header: 'ARC Issue Date',    key: 'arc_issue_date',    width: 14 },
    { header: 'ARC Expiry Date',   key: 'arc_expiry_date',   width: 14 },
    { header: 'Passport Number',   key: 'passport_number',   width: 14 },
    { header: 'TW ID Number',      key: 'tw_id_number',      width: 14 },
    { header: 'CC Number',         key: 'cc_number',         width: 24 },
    { header: 'CC Expiry',         key: 'cc_expiry_date',    width: 12 },
    { header: 'NIF',               key: 'nif',               width: 12 },
    { header: 'NISS',              key: 'niss',              width: 14 },
    { header: 'Date of Birth',     key: 'date_of_birth',     width: 14 },
    { header: 'Gender',            key: 'gender',            width: 8  },
    { header: 'Birthplace (TW)',   key: 'birthplace_tw',     width: 20 },
    { header: 'Address (ZH)',      key: 'address_zh',        width: 40 },
    { header: 'Address (EN)',      key: 'address',           width: 40 },
    { header: 'Notes',             key: 'notes',             width: 40 },
    { header: 'Documents',         key: 'documents',         width: 50 },
  ];

  const hdr = ws.getRow(1);
  hdr.font = { bold: true };
  hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6D1C4' } };
  hdr.alignment = { vertical: 'middle' };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (let i = 0; i < members.length; i++) {
    const m    = members[i];
    const docs = documentsMap[m.id] || [];

    ws.addRow({
      member_id:         m.member_id,
      first_name:        m.first_name  || '',
      last_name:         m.last_name   || '',
      display_name:      m.arc_name_en || `${m.first_name} ${m.last_name}`.trim(),
      arc_chinese_name:  m.arc_chinese_name  || '',
      email:             m.email        || '',
      phone:             m.phone        || '',
      join_date:         m.join_date    ? m.join_date.slice(0, 10) : '',
      position:          m.user_position || '',
      role:              m.user_role    || '',
      fee_status:        m.fee_status   || '',
      fee_amount:        m.fee_amount != null ? m.fee_amount : '',
      fee_last_paid:     m.fee_last_paid  ? m.fee_last_paid.slice(0, 10) : '',
      fee_valid_until:   m.fee_valid_until ? m.fee_valid_until.slice(0, 10) : '',
      arc_number:        m.arc_number        || '',
      arc_serial_number: m.arc_serial_number || '',
      arc_issue_date:    m.arc_issue_date    ? m.arc_issue_date.slice(0, 10) : '',
      arc_expiry_date:   m.is_aprc || m.arc_expiry_date === '9999-12-31'
                           ? 'Permanent'
                           : (m.arc_expiry_date ? m.arc_expiry_date.slice(0, 10) : ''),
      passport_number:   m.passport_number || '',
      tw_id_number:      m.tw_id_number   || '',
      cc_number:         m.cc_number      || '',
      cc_expiry_date:    m.cc_expiry_date  ? m.cc_expiry_date.slice(0, 10) : '',
      nif:               m.nif   || '',
      niss:              m.niss  || '',
      date_of_birth:     m.date_of_birth  ? m.date_of_birth.slice(0, 10) : '',
      gender:            m.gender         || '',
      birthplace_tw:     m.birthplace_tw  || '',
      address_zh:        m.address_zh     || '',
      address:           m.address        || '',
      notes:             m.notes          || '',
      documents:         docs.map(d => d.original_name).join(', '),
    });

    job.progress = i + 1;
    job.stage    = `Building spreadsheet… (${job.progress} / ${members.length})`;
  }

  const xlsxBuf = await wb.xlsx.writeBuffer();

  // Stage 2: Build ZIP
  job.stage = 'Packaging documents…';

  const zipPath = path.join(TMP_DIR, `export_${jobId}.zip`);

  await new Promise((resolve, reject) => {
    const output  = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    archive.on('error', reject);
    output.on('close', resolve);
    archive.pipe(output);

    archive.append(Buffer.from(xlsxBuf), { name: 'data.xlsx' });

    for (const m of members) {
      const docs = documentsMap[m.id] || [];
      for (const doc of docs) {
        const abs = path.join(process.cwd(), doc.file_path);
        if (fs.existsSync(abs)) {
          archive.file(abs, { name: `${m.member_id}/${doc.original_name}` });
        }
      }
    }

    archive.finalize();
  });

  job.stage    = 'Ready for download';
  job.done     = true;
  job.zipPath  = zipPath;
  job.progress = job.total;
}

module.exports = { startExportJob, getExportJob, deleteExportJob };
