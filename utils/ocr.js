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

const PROMPTS = {
  arc_front: `You are a data-extraction assistant. The image is the FRONT of a Taiwan ARC (Alien Resident Certificate / 中華民國居留證).
Extract the fields below and return ONLY a valid JSON object — no markdown, no explanation.
Use empty string "" for any field you cannot confidently read.
All dates must be in YYYY-MM-DD format.

Field locations on the card:
- Row labelled "統一證號 UI No." contains BOTH the alphanumeric code AND the holder's Chinese name on the same line.
- Row labelled "姓名 Name" contains the full English name in ALL CAPS printed as SURNAME(S) GIVEN_NAME(S) — Taiwan ARC always puts the surname first. You MUST reorder to Western format: GIVEN_NAME(S) SURNAME(S). Example: card prints "DA SILVA PEREIRA SAUL" → output "PEREIRA SAUL DA SILVA".
- "核發日期 Date of issue" is the issue date.
- "居留期限 Date of expiry" is the expiry date.
- "護照號碼 Passport No." is the passport number.
- "居留地址 Residence address" at the bottom of the card contains the full Chinese address.

{
  "arc_number":       "統一證號 UI No. — 1 uppercase letter followed by 9 digits, e.g. A800287833",
  "arc_name_en":      "姓名 Name row — reordered to Western GIVEN SURNAME format in ALL CAPS, e.g. card prints 'DA SILVA PEREIRA SAUL' → output 'PEREIRA SAUL DA SILVA'",
  "arc_chinese_name": "Chinese name on the same row as the UI No. — 2 to 4 Chinese characters, e.g. 李智良",
  "arc_issue_date":   "核發日期 Date of issue in YYYY-MM-DD",
  "arc_expiry_date":  "居留期限 Date of expiry in YYYY-MM-DD",
  "passport_number":  "護照號碼 Passport No., e.g. CE002254",
  "address_zh":       "居留地址 Residence address — full Chinese address at the bottom of the card, e.g. 臺北市大安區信義路四段1號3樓"
}`,

  arc_back: `You are a data-extraction assistant. The image is the BACK of a Taiwan ARC (Alien Resident Certificate).
Extract the field below and return ONLY a valid JSON object — no markdown, no explanation.
Use empty string "" if you cannot read it.

{
  "arc_serial_number": "The reference number printed immediately to the RIGHT of the barcode at the very TOP of the card (e.g. F230256281). It is 1 uppercase letter followed immediately by digits — NO spaces anywhere in the value. Do NOT return the MRZ lines at the bottom, and do NOT return the 舊式統一證號 / Original UI No. in the middle of the card."
}`,

  cc_front: `You are a data-extraction assistant. The image is the FRONT of a Portuguese Cartão de Cidadão (Citizen Card / CC).
Extract the fields below and return ONLY a valid JSON object — no markdown, no explanation.
Use empty string "" for any field you cannot confidently read.
All dates must be converted to YYYY-MM-DD format (dates on the card are printed as DD MM YYYY, e.g. "14 07 2031" → "2031-07-14").

{
  "cc_number":      "N.º DOCUMENTO / Document No. combined with N.º ID CIVIL — 8 digits, a space, then 1 digit + 2–3 uppercase letters + 1 digit, e.g. 01287661 5ZY7",
  "cc_expiry_date": "DATA DE VALIDADE / Expiry Date — in YYYY-MM-DD format"
}`,

  cc_back: `You are a data-extraction assistant. The image is the BACK of a Portuguese Cartão de Cidadão (Citizen Card / CC).
Extract the fields below and return ONLY a valid JSON object — no markdown, no explanation.
Use empty string "" for any field you cannot confidently read or that is not printed.

{
  "nif":  "N.º IDENTIFICAÇÃO FISCAL / TAX No. — 9-digit number, e.g. 153447354",
  "niss": "N.º SEGURANÇA SOCIAL / SOCIAL SECURITY No. — 11-digit number. If the card shows 'X' instead of a number, return empty string ''"
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

const MODEL_TIMEOUT_MS = 45_000; // 45s per model call — keeps total scan under proxy timeout

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

async function callVision(imagePath, prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === 'your_key_here') {
    throw new Error('OPENROUTER_API_KEY not set in .env');
  }

  const ext  = path.extname(imagePath).toLowerCase();
  const mime = MIME[ext] || 'image/jpeg';
  const b64  = fs.readFileSync(imagePath).toString('base64');

  // Pinned model in .env — single call, no merge
  if (process.env.OPENROUTER_MODEL) {
    return callVisionModel(process.env.OPENROUTER_MODEL, prompt, b64, mime);
  }

  const [primary, secondary, tertiary] = _activeModels;
  const t0 = Date.now();
  console.log(`[ocr] parallel scan started — models: [${primary}, ${secondary}]`);

  const [r0, r1] = await Promise.allSettled([
    callVisionModel(primary,   prompt, b64, mime),
    callVisionModel(secondary, prompt, b64, mime),
  ]);

  if (r0.status === 'rejected') console.warn(`[ocr] primary failed: ${r0.reason?.message}`);
  if (r1.status === 'rejected') console.warn(`[ocr] secondary failed: ${r1.reason?.message}`);

  let resultA = r0.status === 'fulfilled' ? r0.value : null;
  let resultB = r1.status === 'fulfilled' ? r1.value : null;

  const needsFallback = (!resultA && r0.reason?.status === 429)
                     || (!resultB && r1.reason?.status === 429);

  if (needsFallback && tertiary) {
    console.warn(`[ocr] rate-limit detected — falling back to ${tertiary}`);
    try {
      const fallback = await callVisionModel(tertiary, prompt, b64, mime);
      if (!resultA) resultA = fallback;
      else          resultB = fallback;
    } catch {
      // best-effort
    }
  }

  if (!resultA && !resultB) throw new Error('All vision models failed or timed out');
  if (!resultA) { console.log(`[ocr] using secondary result only`); return resultB; }
  if (!resultB) { console.log(`[ocr] using primary result only`);   return resultA; }

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

async function scan(docType, imagePath) {
  const prompt = PROMPTS[docType];
  if (!prompt) throw new Error(`No vision prompt for document type: ${docType}`);
  console.log(`[ocr] scan requested — docType=${docType} file=${path.basename(imagePath)}`);
  const result = postProcess(docType, await callVision(imagePath, prompt));
  console.log(`[ocr] scan done — fields: ${Object.keys(result).filter(k => k[0] !== '_' && result[k]).join(', ') || '(none extracted)'}`);
  return result;
}

module.exports = { scan, checkModels, getModelWarnings, dismissModelWarning, getActiveModels, setActiveModels, testModel };
