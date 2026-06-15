const fs   = require('fs');
const path = require('path');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Default model list — first two run in parallel, third is fallback on 429.
const DEFAULT_VISION_MODELS = [
  'nvidia/nemotron-nano-12b-v2-vl:free',
  'nex-agi/nex-n2-pro:free',
  'moonshotai/kimi-k2.6:free',
];

// Mutable at runtime via setActiveModels() — loaded from DB settings at startup.
let _activeModels = [...DEFAULT_VISION_MODELS];

function getActiveModels() { return [..._activeModels]; }
function setActiveModels(models) {
  _activeModels = (Array.isArray(models) && models.length) ? [...models] : [...DEFAULT_VISION_MODELS];
  for (const id of Object.keys(modelStatus)) {
    if (!_activeModels.includes(id)) delete modelStatus[id];
  }
}

const MODEL_DISPLAY = {
  'nvidia/nemotron-nano-12b-v2-vl:free': 'Nemotron Nano 12B VL',
  'nex-agi/nex-n2-pro:free':            'Nex N2 Pro',
  'moonshotai/kimi-k2.6:free':          'Kimi K2.6',
};

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

// ── Per-type extraction prompts ────────────────────────────────────────────────
// Revamp status: arc_front ✓  arc_back ✓  cc_front ✓  cc_back ✓  tw_passport_front ✓  tw_id_front ✓  tw_id_back ✓

const PROMPTS = {
  arc_front: `You are a data-extraction assistant. The image is the FRONT of a Taiwan ARC (Alien Resident Certificate / 中華民國居留證 外僑居留證).
Extract the fields below and return ONLY a valid JSON object — no markdown, no explanation.
Use empty string "" for any field you cannot confidently read.
Dates on this card use YYYY/MM/DD with slashes — convert to YYYY-MM-DD (replace / with -).

Field locations and constraints:
- 統一證號 UI No.: printed in a box in the upper-left area (may be partially obscured by a hologram). Format: exactly 1 uppercase letter followed by 9 digits, no spaces, e.g. A800173996.
- 姓名 Name row: contains three elements in this left-to-right order:
    1. Chinese name (2–4 Chinese characters) — appears to the LEFT of the gender indicator. If the holder has no Chinese name, this space will be blank — return "".
    2. Gender indicator: 男 Male (male) or 女 Female (female) — acts as a visual separator between Chinese and English name. Use this as a boundary cue.
    3. English name (ALL CAPS Latin) — appears to the RIGHT of / after the gender indicator. The ARC prints SURNAME(S) first, then GIVEN_NAME(S). Reorder to Western given-name-first format. For Portuguese names, the last 1–2 ALL-CAPS words before any obvious given names are typically the surnames. Example: "VALVERDE MARTINS PEDRO MIGUEL" → "PEDRO MIGUEL VALVERDE MARTINS".
- 核發日期 Date of issue: may include a suffix after the date such as "換領" or "補發" — extract only the date, discard the suffix.
- 居留期限 Date of expiry: labelled "Date of expiry (Y/M/D)". If the card shows "永久" or "PERMANENT", return "9999-12-31".
- 出生日期 Date of birth: printed below the English name, YYYY/MM/DD format.
- 護照號碼 Passport No.: printed in the right-centre section.
- 居留地址 Residence address: full Chinese address at the very bottom of the card.

{
  "arc_number":       "統一證號 UI No. — 1 uppercase letter + 9 digits, no spaces, e.g. A800173996",
  "arc_chinese_name": "Chinese name from 姓名 row — 2–4 Chinese characters, left of gender indicator; '' if absent",
  "arc_name_en":      "English name from 姓名 row, after gender indicator — reordered to Western GIVEN SURNAME, ALL CAPS, e.g. PEDRO MIGUEL VALVERDE MARTINS",
  "gender":           "Gender indicator — return Chinese character: '男' for male, '女' for female, nothing else",
  "date_of_birth":    "出生日期 Date of birth — YYYY/MM/DD → YYYY-MM-DD, e.g. 1984-09-08",
  "arc_issue_date":   "核發日期 Date of issue — YYYY-MM-DD, suffix after date discarded",
  "arc_expiry_date":  "居留期限 Date of expiry — YYYY-MM-DD; '9999-12-31' if permanent/永久",
  "passport_number":  "護照號碼 Passport No., e.g. CC637162",
  "address_zh":       "居留地址 Residence address — full Chinese address at the bottom, e.g. 臺北市萬華區西藏路199巷61號7樓"
}`,

  arc_back: `You are a data-extraction assistant. The image is the BACK of a Taiwan ARC (Alien Resident Certificate).
Extract the field below and return ONLY a valid JSON object — no markdown, no explanation.
Use empty string "" if you cannot read it.

Field location:
- The reference serial number is printed in large bold text immediately to the RIGHT of the barcode at the very TOP of the card. Format: exactly 1 uppercase letter followed by 9 digits, no spaces, e.g. F251106628.
- Do NOT return the MRZ lines at the bottom of the card.
- Do NOT return the 舊式統一證號 / Original UI No. printed in the middle of the card.

{
  "arc_serial_number": "Serial No. at top-right — 1 uppercase letter + 9 digits, no spaces, e.g. F251106628"
}`,

  cc_front: `You are a data-extraction assistant. The image is the FRONT of a Portuguese Cartão de Cidadão (Citizen Card / CC).
Extract the fields below and return ONLY a valid JSON object — no markdown, no explanation.
Use empty string "" for any field you cannot confidently read.
Dates on this card are printed as DD MM YYYY — convert to YYYY-MM-DD.

Field locations and constraints:
- N.º DOCUMENTO / DOCUMENT No. (also labelled N.º ID CIVIL / CIVIL ID No.) is the large number in the lower-centre of the card. Format: exactly 8 digits, a space, 1 check digit, a space, 3 alphanumeric characters (uppercase letters and/or digits). e.g. 31910473 7 ZY2. Store with spaces as printed — do not merge the groups.
- DATA DE VALIDADE / EXPIRY DATE is printed to the right of the document number in DD MM YYYY format.

{
  "cc_number":      "N.º DOCUMENTO — 8 digits, space, 1 check digit, space, 3 alphanumeric chars, e.g. 31910473 7 ZY2",
  "cc_expiry_date": "DATA DE VALIDADE / EXPIRY DATE — YYYY-MM-DD, e.g. 2031-08-03"
}`,

  cc_back: `You are a data-extraction assistant. The image is the BACK of a Portuguese Cartão de Cidadão (Citizen Card / CC).
Extract the fields below and return ONLY a valid JSON object — no markdown, no explanation.
Use empty string "" for any field you cannot confidently read.
Ignore the FILIAÇÃO / PARENTS field entirely. Ignore the MRZ lines at the bottom of the card.

Field locations and constraints:
- N.º IDENTIFICAÇÃO FISCAL / TAX No.: 9-digit number in the lower-left area. No spaces or punctuation.
- N.º SEGURANÇA SOCIAL / SOCIAL SECURITY No.: 11-digit number in the lower-centre. If the card shows 'X' instead of digits, return "".

{
  "nif":  "N.º IDENTIFICAÇÃO FISCAL / TAX No. — 9-digit number, e.g. 271118741",
  "niss": "N.º SEGURANÇA SOCIAL / SOCIAL SECURITY No. — 11-digit number; '' if card shows 'X', e.g. 12069447472"
}`,

  tw_passport_front: `You are a data-extraction assistant. The image is the biographical data page of a Republic of China (Taiwan) Passport (中華民國護照).
Extract the fields below and return ONLY a valid JSON object — no markdown, no explanation.
Use empty string "" for any field you cannot confidently read.
All dates must be in YYYY-MM-DD format (Gregorian / CE calendar).

Field locations and constraints:
- 護照號碼 PASSPORT NO. is printed near the top. Format: exactly 2 uppercase letters followed by 8 digits, no spaces, e.g. AB12345678.
- 統一編號 PERSONAL NO. (National ID number) is 1 uppercase letter followed by 9 digits, no spaces, e.g. A123456789.
- English name: "SURNAME" and "GIVEN NAME" are printed on separate labeled lines. Combine as GIVEN_NAME SURNAME in Western given-name-first order, ALL CAPS, e.g. WEI-MING CHEN. Hyphens within a given name are preserved.
- Chinese name (姓名): full Chinese name, family name first. May appear as 姓/名 on separate lines or combined. Return as a single string, e.g. 陳威明.
- 出生日期 DATE OF BIRTH: dates on this page use Gregorian calendar (DD MMM YYYY or similar) — convert to YYYY-MM-DD.
- 性別 SEX: the card shows both the Latin "M"/"F" and Chinese 男/女. Return the Chinese character exactly: '男' or '女'. Do not return M, F, or an English word.
- 出生地 PLACE OF BIRTH: printed in Chinese. Return only the Chinese text, e.g. 臺灣省臺北市.
- 簽發日期 DATE OF ISSUE and 有效期限 DATE OF EXPIRY: Gregorian calendar — convert to YYYY-MM-DD.

{
  "passport_number":  "護照號碼 PASSPORT NO. — 2 uppercase letters + 8 digits, no spaces, e.g. AB12345678",
  "tw_id_number":     "統一編號 PERSONAL NO. — 1 uppercase letter + 9 digits, no spaces, e.g. A123456789",
  "arc_name_en":      "English name — given name first, surname last, ALL CAPS, e.g. WEI-MING CHEN",
  "arc_chinese_name": "Chinese name (姓名) — full name, family name first, e.g. 陳威明",
  "date_of_birth":    "出生日期 DATE OF BIRTH — YYYY-MM-DD, e.g. 1985-03-22",
  "gender":           "性別 SEX — return the Chinese character: '男' for male, '女' for female, nothing else",
  "arc_issue_date":   "簽發日期 DATE OF ISSUE — YYYY-MM-DD",
  "arc_expiry_date":  "有效期限 DATE OF EXPIRY — YYYY-MM-DD",
  "birthplace_tw":    "出生地 PLACE OF BIRTH — Chinese text only, e.g. 臺灣省臺北市"
}`,

  tw_id_front: `You are a data-extraction assistant. The image is the FRONT of a Republic of China (Taiwan) National Identity Card (中華民國國民身分證).
Extract the fields below and return ONLY a valid JSON object — no markdown, no explanation.
Use empty string "" for any field you cannot confidently read.
All dates must be in YYYY-MM-DD format (Gregorian / CE calendar).

Date conversion: Taiwan ID cards use the ROC (Republic of China) calendar. Add 1911 to convert to CE year.
Examples: 民國57年8月11日 = 1968-08-11; 民國110年11月26日 = 2021-11-26.

Field locations on the card:
- 統一編號 is printed in RED at the bottom-right corner labeled "統一編號". Format: exactly 1 uppercase letter (A–Z, county code) followed by 9 digits, no spaces. e.g. U220596267.
- 姓名 is the full Chinese name. On older cards, characters may be spaced apart (e.g. 莊 寅 彩) — strip all spaces and return as continuous string (e.g. 莊寅彩).
- 出生年月日 uses the ROC calendar — add 1911 to the ROC year. 年 separates year/month, 月 separates month/day, 日 ends the date.
- 性別 is always exactly one Chinese character: 男 or 女. Return it as-is — do not translate to English.
- 發證日期 may include an office/reason suffix e.g. "(北市)補發" — ignore the suffix, extract only the date.

{
  "tw_id_number":     "統一編號 — printed in RED, bottom-right; 1 uppercase letter + 9 digits, no spaces, e.g. U220596267",
  "arc_chinese_name": "姓名 — full Chinese name, spaces stripped, e.g. 莊寅彩",
  "date_of_birth":    "出生年月日 — ROC year + 1911 = CE year, YYYY-MM-DD, e.g. 1968-08-11",
  "gender":           "性別 — return the Chinese character exactly as printed: '男' for male, '女' for female, nothing else",
  "arc_issue_date":   "發證日期 — ROC to CE conversion, YYYY-MM-DD, suffix after date discarded"
}`,

  tw_id_back: `You are a data-extraction assistant. The image is the BACK of a Republic of China (Taiwan) National Identity Card (中華民國國民身分證).
Extract the fields below and return ONLY a valid JSON object — no markdown, no explanation.
Use empty string "" for any field you cannot confidently read.

Field locations on the card:
- 住址 (Residential address) may span two printed lines — combine them into one continuous string with no newline.
  Example: line 1 "臺北市中正區新營里1鄰" + line 2 "林森南路137號九樓之1" → "臺北市中正區新營里1鄰林森南路137號九樓之1"
- 出生地 (Place of birth) is a short Chinese location string, e.g. 臺灣省花蓮縣 or 臺北市.

{
  "address_zh":    "住址 — full residential address, two lines joined into one string, e.g. 臺北市中正區新營里1鄰林森南路137號九樓之1",
  "birthplace_tw": "出生地 — place of birth as printed, e.g. 臺灣省花蓮縣"
}`,
};

// ── In-memory model health status ─────────────────────────────────────────────

const modelStatus = {};
// { modelId: { status: 'offline'|'rate_limited', error: string, detectedAt: ISO } }

function getModelWarnings() {
  return Object.entries(modelStatus).map(([model, v]) => ({
    model,
    display: MODEL_DISPLAY[model] || model,
    ...v,
  }));
}

function dismissModelWarning(model) {
  delete modelStatus[model];
}

async function testModel(modelId) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === 'your_key_here') return { ok: false, error: 'API key not set' };
  try {
    const res = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Reply with only the word OK.' }],
        max_tokens: 5,
      }),
    });
    if (res.ok) return { ok: true };
    const body = await res.text().catch(() => '');
    return { ok: false, error: `HTTP ${res.status}${body ? ': ' + body.slice(0, 120) : ''}` };
  } catch (e) {
    return { ok: false, error: e.message.slice(0, 140) };
  }
}

async function checkModels() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === 'your_key_here') return [];

  const models = process.env.OPENROUTER_MODEL ? [process.env.OPENROUTER_MODEL] : _activeModels;

  await Promise.allSettled(models.map(async (model) => {
    try {
      const res = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Reply with only the word OK.' }],
          max_tokens: 5,
        }),
      });
      if (res.status === 429) {
        modelStatus[model] = {
          status: 'rate_limited',
          error: 'Rate limited — at capacity',
          detectedAt: new Date().toISOString(),
        };
      } else if (!res.ok) {
        const body = await res.text().catch(() => '');
        modelStatus[model] = {
          status: 'offline',
          error: `HTTP ${res.status}${body ? ': ' + body.slice(0, 120) : ''}`,
          detectedAt: new Date().toISOString(),
        };
      } else {
        delete modelStatus[model]; // clear any existing warning — model is back
      }
    } catch (e) {
      modelStatus[model] = {
        status: 'offline',
        error: e.message.slice(0, 140),
        detectedAt: new Date().toISOString(),
      };
    }
  }));

  return getModelWarnings();
}

// ── Single-model vision call ───────────────────────────────────────────────────

let MODEL_TIMEOUT_MS = 55_000; // mutable — configurable via setModelTimeout()

function getModelTimeout() { return MODEL_TIMEOUT_MS; }
function setModelTimeout(ms) {
  const n = parseInt(ms, 10);
  if (n >= 10_000 && n <= 120_000) MODEL_TIMEOUT_MS = n;
}

async function callVisionModel(model, prompt, b64, mime) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
    console.warn(`[ocr] ${model} — no response after ${MODEL_TIMEOUT_MS / 1000}s, aborting`);
  }, MODEL_TIMEOUT_MS);

  const t0 = Date.now();
  console.log(`[ocr] → ${model} calling…`);

  try {
    const res = await fetch(OPENROUTER_API_URL, {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text',      text: prompt },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
          ],
        }],
      }),
    });

    // Do NOT clearTimeout here — headers have arrived but the body may still be streaming.
    // The abort signal must stay active through res.json() so a hung body is cancelled too.

    if (res.status === 429) {
      clearTimeout(timer);
      console.warn(`[ocr] ${model} rate-limited (429) after ${Date.now() - t0}ms`);
      const err = new Error(`${model} rate-limited`);
      err.status = 429;
      throw err;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      clearTimeout(timer);
      const elapsed = `${Date.now() - t0}ms`;
      console.error(`[ocr] ${model} HTTP ${res.status} after ${elapsed}: ${body.slice(0, 120)}`);
      modelStatus[model] = {
        status: 'offline',
        error: `HTTP ${res.status}${body ? ': ' + body.slice(0, 120) : ''}`,
        detectedAt: new Date().toISOString(),
      };
      throw new Error(`OpenRouter ${res.status}: ${body}`);
    }

    if (modelStatus[model]) delete modelStatus[model];

    const json = await res.json(); // abort signal still live — fires if body read exceeds total timeout
    clearTimeout(timer);
    const elapsed = `${Date.now() - t0}ms`;
    const raw    = (json.choices?.[0]?.message?.content || '').trim();
    const preview = raw.slice(0, 80).replace(/\n/g, ' ');
    console.log(`[ocr] ✓ ${model} responded in ${elapsed} — ${preview}`);

    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(stripped);

  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      const err = new Error(`${model} timed out after ${MODEL_TIMEOUT_MS / 1000}s`);
      err.code = 'TIMEOUT';
      throw err;
    }
    throw e;
  }
}

// ── Merge two result objects ───────────────────────────────────────────────────
// First non-empty value wins. When both have a value and they differ, the
// primary value is kept but the field is recorded in _conflicts: { key: [a, b] }.

function mergeResults(a, b) {
  const merged    = {};
  const conflicts = {};
  const allKeys   = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of allKeys) {
    const va = (a[key] || '').trim();
    const vb = (b[key] || '').trim();

    if      (!va && !vb) merged[key] = '';
    else if (!va)        merged[key] = vb;
    else if (!vb)        merged[key] = va;
    else if (va === vb)  merged[key] = va;
    else {
      merged[key]    = va;
      conflicts[key] = [va, vb];
    }
  }

  if (Object.keys(conflicts).length) merged._conflicts = conflicts;
  return merged;
}

// ── Orchestrator — parallel dual-model with fallback ─────────────────────────

function shortModelName(id) {
  if (!id) return 'model';
  const slug = id.split('/').pop().replace(/:.*$/, '');
  return slug.length > 22 ? slug.slice(0, 22) + '…' : slug;
}

async function callVision(imagePath, prompt, onStep) {
  const step = typeof onStep === 'function' ? onStep : () => {};
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === 'your_key_here') {
    throw new Error('OPENROUTER_API_KEY not set in .env');
  }

  const ext  = path.extname(imagePath).toLowerCase();
  const mime = MIME[ext] || 'image/jpeg';
  const b64  = fs.readFileSync(imagePath).toString('base64');

  // Pinned model in .env — single call, no merge
  if (process.env.OPENROUTER_MODEL) {
    step(`Sending to ${shortModelName(process.env.OPENROUTER_MODEL)}…`, 'info');
    const result = await callVisionModel(process.env.OPENROUTER_MODEL, prompt, b64, mime);
    step(`${shortModelName(process.env.OPENROUTER_MODEL)}: reply received`, 'ok');
    return result;
  }

  const [primary, secondary, tertiary] = _activeModels;
  const t0 = Date.now();
  console.log(`[ocr] parallel scan started — models: [${primary}, ${secondary}]`);

  step(`Sending to primary (${shortModelName(primary)}) + secondary (${shortModelName(secondary)}) in parallel…`, 'info');

  const p0 = callVisionModel(primary, prompt, b64, mime)
    .then(v  => { step(`Primary (${shortModelName(primary)}): reply received (${((Date.now()-t0)/1000).toFixed(1)}s)`, 'ok'); return v; })
    .catch(e => { step(`Primary (${shortModelName(primary)}): ${e.code === 'TIMEOUT' ? 'timed out' : e.status === 429 ? 'rate-limited (429)' : 'failed'}`, 'warn'); throw e; });

  const p1 = callVisionModel(secondary, prompt, b64, mime)
    .then(v  => { step(`Secondary (${shortModelName(secondary)}): reply received (${((Date.now()-t0)/1000).toFixed(1)}s)`, 'ok'); return v; })
    .catch(e => { step(`Secondary (${shortModelName(secondary)}): ${e.code === 'TIMEOUT' ? 'timed out' : e.status === 429 ? 'rate-limited (429)' : 'failed'}`, 'warn'); throw e; });

  const [r0, r1] = await Promise.allSettled([p0, p1]);

  if (r0.status === 'rejected') console.warn(`[ocr] primary failed: ${r0.reason?.message}`);
  if (r1.status === 'rejected') console.warn(`[ocr] secondary failed: ${r1.reason?.message}`);

  let resultA = r0.status === 'fulfilled' ? r0.value : null;
  let resultB = r1.status === 'fulfilled' ? r1.value : null;

  const needsFallback = (!resultA && r0.reason?.status === 429)
                     || (!resultB && r1.reason?.status === 429);

  if (needsFallback && tertiary) {
    console.warn(`[ocr] rate-limit detected — falling back to ${tertiary}`);
    step(`Rate-limit hit — trying fallback (${shortModelName(tertiary)})…`, 'warn');
    try {
      const fallback = await callVisionModel(tertiary, prompt, b64, mime);
      step(`Fallback (${shortModelName(tertiary)}): reply received (${((Date.now()-t0)/1000).toFixed(1)}s)`, 'ok');
      if (!resultA) resultA = fallback;
      else          resultB = fallback;
    } catch {
      step(`Fallback (${shortModelName(tertiary)}): failed`, 'error');
    }
  }

  if (!resultA && !resultB) throw new Error('All vision models failed or timed out');
  if (!resultA) { console.log(`[ocr] using secondary result only`); return resultB; }
  if (!resultB) { console.log(`[ocr] using primary result only`);   return resultA; }

  step(`Reconciling both responses…`, 'info');
  console.log(`[ocr] merging results from both models — total ${Date.now() - t0}ms`);
  return mergeResults(resultA, resultB);
}

// ── Post-processing ────────────────────────────────────────────────────────────

function postProcess(docType, data) {
  if (docType === 'arc_back' && data.arc_serial_number) {
    // Models hallucinate a space between the letter prefix and digits: "F 230502164" → "F230502164"
    data.arc_serial_number = data.arc_serial_number.replace(/\s+/g, '');
  }
  return data;
}

// ── Public API ─────────────────────────────────────────────────────────────────

async function scan(docType, imagePath, onStep) {
  const prompt = PROMPTS[docType];
  if (!prompt) throw new Error(`No vision prompt for document type: ${docType}`);
  console.log(`[ocr] scan requested — docType=${docType} file=${path.basename(imagePath)}`);
  const result = postProcess(docType, await callVision(imagePath, prompt, onStep));
  console.log(`[ocr] scan done — fields: ${Object.keys(result).filter(k => k[0] !== '_' && result[k]).join(', ') || '(none extracted)'}`);
  return result;
}

// ── Background OCR job cache — shared between admin and member routes ──────────
// Routes call startOcrJob() immediately after responding to the client, then the
// client polls getOcrJob() via the ocr-status endpoint.

const _jobCache = new Map();

function startOcrJob(docId, docType, filePath) {
  const steps = [];
  _jobCache.set(docId, { pending: true, steps });
  const onStep = (msg, state) => steps.push({ msg, state: state || 'info' });
  scan(docType, filePath, onStep)
    .then(extracted => {
      _jobCache.set(docId, { done: true, extracted, steps });
      setTimeout(() => _jobCache.delete(docId), 10 * 60 * 1000);
    })
    .catch(e => {
      _jobCache.set(docId, { done: true, extracted: { _ocrError: e.message }, steps });
      setTimeout(() => _jobCache.delete(docId), 10 * 60 * 1000);
    });
}

function getOcrJob(docId) {
  return _jobCache.get(docId) || null;
}

module.exports = { scan, checkModels, getModelWarnings, dismissModelWarning, getActiveModels, setActiveModels, testModel, getModelTimeout, setModelTimeout, startOcrJob, getOcrJob };
