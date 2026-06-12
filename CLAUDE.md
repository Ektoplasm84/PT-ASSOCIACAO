# PT Associação — Claude Code Guide

Full project context lives in **[PROJECT.md](PROJECT.md)**. Read it before doing anything non-trivial.

---

## What This Project Is

A Node.js membership management web app for a Portuguese-Taiwanese association. SQLite embedded database, EJS templates, Bootstrap 5. Deployed on **HostArmada shared cPanel hosting**.

Permission is controlled by two columns: `users.role` (`super_admin` / `admin` / `member`) and `users.position` (association title — `gestao` is the only position that grants extra access). See § Role System below.

---

## Dev Commands

```powershell
# Start server (PowerShell)
node app.js

# Kill stale node process before restart
Get-Process node | Stop-Process -Force

# Install dependencies (run on server after deploy too)
npm install
```

Server runs on `http://localhost:3000`. Default login: `admin@associacao.pt` / `admin1234` (role: `super_admin`).

### cPanel deploy workflow (HostArmada / LiteSpeed)

LiteSpeed's `lsnode` process manager does not always terminate cleanly when you click "Stop" — the old process can be orphaned (PPID=1) and keep serving stale code. Always kill it explicitly:

1. `git pull` in the app directory on the server
2. Check PID: `https://associacao.poetico.co/node-check.php?token=ptassoc-diag-2024`
3. Kill it: `https://associacao.poetico.co/node-kill.php?token=ptassoc-diag-2024&pid=XXXX`
4. cPanel → Node.js Selector → **Start**

`node-check.php` and `node-kill.php` are gitignored — upload manually to `public_html/` only when needed, delete after use. The PID changes on every restart; always check before killing.

---

## File Map

```
app.js                   Entry point — middleware, sessions, routes, .env loader
                         Sets `app.set('trust proxy', 1)` before session middleware (required for cPanel nginx + Secure cookie)
                         Also mounts authenticated photo/thumb routes (see § Hard Rules)
database/db.js           SQLite schema, migrations, seed admin
routes/auth.js           /login, /logout
routes/admin.js          /admin/* — member CRUD, documents, card OCR, NIA photo fetch,
                         role change, password reset, audit log, OCR health check,
                         settings (fee + models), calendar events (CRUD + attendee list)
                         Also defines getSetting(key, default) / setSetting(key, value) helpers
                         that read/write the settings table. Loads persisted OCR model list
                         from settings at module init and calls setActiveModels().
                         resolveAudience(groups) → single UNION query → array of user IDs for event invite targeting.
                         isManagementUser(u) → true if user.position is in MGMT_POSITIONS; used by feeWriteGuard + calendarWriteGuard.
                         calendarWriteGuard — allows admin+ and all MGMT_POSITIONS.
                         contentDispositionFilename(disposition, name) — RFC 5987 Content-Disposition helper for non-ASCII filenames.
                         MODEL_ID_RE — regex `/^[a-zA-Z0-9_\-/:\.]{1,120}$/` that validates OCR model IDs on all write paths.
                         _testCooldowns — Map enforcing a 10-second per-model cooldown on `POST /admin/ocr-test-model`.
routes/user.js           /profile/* — own profile (tabbed: My Profile + Notifications),
                         invite respond, iCal export
                         contentDispositionFilename(disposition, name) — same RFC 5987 helper as admin.js
middleware/auth.js       requireAuth, requireAdmin, requireSuperAdmin, requireViewAll guards
                         requireAuth also sets res.locals.pendingInviteCount (pending invite count)
utils/fee.js             computeFeeStatus(fee_amount, fee_last_paid)
utils/ocr.js             OpenRouter vision API — dual-model parallel scan
                         Exports: scan(docType, imagePath), checkModels(),
                                  getModelWarnings(), dismissModelWarning(model),
                                  getActiveModels(), setActiveModels(models),
                                  testModel(modelId)
utils/audit.js           writeAudit(actorId, actorEmail, memberId, memberRef, action, detail) — 2000-row cap
utils/countries.js       Full world country list for phone dial-code picker
utils/taiwan-districts.js All 22 TW cities/counties + districts (ZH/EN/postal)
frontend/views/          ALL EJS templates — design territory
frontend/views/partials/phone-field.ejs    Reusable dial-code picker partial
frontend/views/partials/member-form.ejs   5-section member form (used by new + edit pages)
frontend/views/admin/audit-log.ejs        Audit log page (paginated, admin+ only)
frontend/public/css/custom.css            Bootstrap overrides only
frontend/public/css/ds/pt-design-system.css   PT Design System — tokens + .pta-* components
frontend/public/css/ds/pt-bootstrap-bridge.css Bootstrap variable remap to design tokens
frontend/public/css/ds/azulejo-tile.svg   Background tile — must stay next to CSS (relative url())
frontend/public/images/logo-emblem.svg    Brand emblem used in topbar + login
frontend/public/images/logo-wordmark.svg  Full wordmark
uploads/                 Runtime only — photos, documents, thumbs (never commit)
database/data.db         Runtime only — SQLite file (never commit)
.env                     API keys — NEVER commit, NEVER upload to cPanel

Settings table (in data.db):
  key='default_fee_amount'  → integer TWD, default 300
  key='ocr_models'          → JSON array of model ID strings

Events tables (in data.db):
  events           → id, title, description, location, start_date, end_date, created_by, created_at
  event_invites    → id, event_id, user_id, status (pending/accepted/declined),
                     seen_at, responded_at, notified_at (reserved for email), UNIQUE(event_id,user_id)
```

---

## Hard Rules

- **`frontend/`** is Claude Design territory — keep logic out of templates, keep markup out of routes
- **Never set `fee_status` or `fee_valid_until` from a form** — always computed by `utils/fee.js`
- **Use `bcryptjs`**, not `bcrypt` — pure JS, required for shared hosting (no native compile)
- **All file paths** must use `process.cwd()` not `__dirname` — cPanel working directory differs
- **No Puppeteer / Chromium** — shared hosting has none; use server-side `fetch` instead
- **Node 18+** required — NIA photo fetch uses global `fetch`
- **Multi-statement SQLite DDL**: do not use `db.exec` with multiple statements — use a loop of `db.prepare(sql).run()` calls (security hook blocks the other form)
- **Do not upload** `node_modules/`, `uploads/`, `database/data.db`, or **`.env`** to cPanel
- **`.env` must never be committed or uploaded** — `OPENROUTER_API_KEY` and `SESSION_SECRET` are in `.env`; on cPanel set them as environment variables in the Node.js App panel
- **`.env.example`** is safe to commit — it contains no real values, only placeholders
- **Bootstrap modal init** — never call `new bootstrap.Modal(...)` at script parse time; use a lazy getter so instantiation is deferred until after `footer.ejs` loads Bootstrap JS
- **Photos and thumbs are NOT static** — served through authenticated `app.get('/uploads/photos/:filename')` and `app.get('/uploads/thumbs/:filename')` routes in `app.js`. Do not add `express.static` for these paths.
- **`app.set('trust proxy', 1)` must be set** before session middleware in `app.js`; required for HTTPS `Secure` cookies behind cPanel's nginx reverse proxy. Also set `NODE_ENV=production` in the cPanel Node.js App environment variables panel.
- **`fee_amount = 0` is valid** — always use `parseInt(fee_amount, 10) >= 0 ? parseInt(fee_amount, 10) : 300` (not `|| 300`) so honorary members' zero fee is stored correctly.
- **Document Content-Disposition** — use `contentDispositionFilename(disposition, name)` helper (RFC 5987) in both admin.js and user.js for any `Content-Disposition` header; `res.download()` is not used.

---

## Role System

Two independent columns on `users`: `role` (permission) and `position` (association title).

### `users.role` — system permissions
| Role | Access |
|------|--------|
| `super_admin` | Full access: everything including role/position changes and deleting any account |
| `admin` | All member CRUD, documents, OCR, NIA photo, audit log — cannot change roles |
| `member` | Own profile only — view + edit own data, download own documents |

### `users.position` — association title (display + one access rule)
| Position | Notes |
|----------|-------|
| `member` | Default |
| `honorary` | No fees; fee sections show N/A; excluded from paid/unpaid dashboard stats |
| `gestao` | Umbrella for all management positions — grants view-all + fee-write access |
| `board` / `president` / `treasurer` / `secretary` | Sub-positions under the gestao umbrella — same view-all + fee-write access as gestao |

### Middleware (`middleware/auth.js`)
- `requireAuth` — any logged-in user; sets `res.locals.currentUser`, `res.locals.canWrite`, `res.locals.isSuperAdmin`, `res.locals.canViewAll`
- `requireViewAll` — `role IN (super_admin,admin)` OR `position = 'gestao'`; used at admin router mount
- `requireAdmin` — `super_admin | admin`; available for inline use
- `requireSuperAdmin` — `super_admin` only; available for inline use

### `res.locals` helpers (available in every authenticated view)
- `canWrite` — `true` for `super_admin` and `admin`; hides all write controls
- `isSuperAdmin` — `true` for `super_admin` only; shows Role Management panel on member-detail
- `canViewAll` — `true` for admin+ OR position=gestao
- `pendingInviteCount` — integer count of pending event invites for the current user; drives the topbar bell badge

### Inline guards in `routes/admin.js`
- `adminOnly(req, res, next)` — blocks gestao (position) on all write routes
- `superAdminOnly(req, res, next)` — blocks everyone except `super_admin` on role-change and password-reset routes

### Role/Position Change Route
`POST /admin/members/:id/change-role` — super_admin only; validates role from `['super_admin','admin','member']`, updates both `users.role` and `users.position`.

### Password Reset Route
`POST /admin/members/:id/set-password` — super_admin only; body `{ new_password, confirm_password }`; min 6 chars validated server-side; hashed with `bcryptjs` cost 10; audited as `member.password_reset`.

### DB Migrations (startup)
1. `super_admin` absent from users SQL → recreate table: `admin→super_admin`, `user→member`
2. `position` absent from users SQL → recreate table: old `gestao` role → `role=member, position=gestao`

---

## Key Behaviours to Preserve

- Member CRUD is wrapped in `db.transaction()` — user row + member row created/deleted atomically
- Document downloads go through authenticated routes (ownership verified) — files are NOT served statically
- Sessions persist in SQLite via `better-sqlite3-session-store` — survive server restarts
- `nextMemberId()` reads the last member_id and increments — format is `ASSOC-XXXX` (zero-padded 4 digits); called **inside** the create transaction
- All user-facing queries in `routes/user.js` scope to `WHERE user_id = req.session.userId` — never trust URL params for ownership
- Card documents are one-per-type per member (`arc_front`, `arc_back`, `cc_front`, `cc_back`) — uploading a new one deletes the previous file + DB row for that type
- OCR fields applied via `apply-card-fields` are validated against an ALLOWED list — no freeform field writes
- Display name throughout app: `arc_name_en || (first_name + ' ' + last_name)`
- **Audit log is append-only** — never add UPDATE or DELETE routes for `audit_log`; call `writeAudit()` from `utils/audit.js` after every write action on member data
- **Fee status for honorary members** — never compute fee status for `position='honorary'`; their fee sections show N/A and they are excluded from paid/unpaid dashboard counts
- **Login rate limiting** lives in-memory in `routes/auth.js` — it resets on server restart by design (shared hosting); do not persist to DB
- **New member placeholder credentials** — `GET /admin/members/new` pre-fills `email=membro.XXXX@associacao.pt`, `first_name=Novo`, `last_name=Membro XXXX` (random 4-char suffix). Admin can override before saving. Email is the login identifier — changing it immediately changes what the member uses to log in.
- **Fee dropdown in `member-form.ejs`** is dynamic — shows the member's actual stored fee amount (non-zero) or falls back to the `defaultFee` local for new members. `defaultFee` must be passed to `res.render()` for both new and edit routes — including validation re-renders on error.
- **Calendar events** — created by admin/SA/gestao via dashboard modal; `resolveAudience()` in `routes/admin.js` converts audience group strings to user IDs via a single UNION query; invites inserted in the same transaction as the event; `end_date` must be ≥ `start_date` (validated server-side); `GET /admin/events/:id/invites` requires `adminOnly` guard (not just viewAll)
- **Notification bell** — `pendingInviteCount` set in `requireAuth` on every request; topbar bell links to `/profile?tab=notifications`; member profile uses Bootstrap tabs with `activeTab` local controlling which panel is active on load
- **iCal export** — `GET /profile/invites/:id/export.ics`; RFC 5545 plain text, no library needed; DTEND is always start+1 day for single-day events (iCal all-day exclusive end); ownership verified against `req.session.userId`
- **Event location is plain text** — no geocoding; WIP: render as `maps.google.com/?q=` link in templates
- **Fee label for honorary/exempt members** — displays as "Honorary Member" everywhere: fee badge fallback in `feeBadge()`, inline status text in member-detail, fee_amount display in member-detail and profile, dropdown options ("0 TWD — Honorary Member"). Never shows "0 TWD (Exempt)".
- **Members list Position column** — shows system role when elevated: `super_admin` → "Super Admin" (gold badge), `admin` → "Admin" (info badge); falls back to association position for regular members. The list query selects `u.role as user_role` alongside `u.position`.
- **Admin password reset** — super_admin can set a new password for any member via the password reset form in the Account Settings card on member-detail. Client-side: mismatch alert + confirm dialog. Server-side: min 6 chars + mismatch check + bcrypt hash + audit log.
- **Fee reminder alert** — shown on both the My Profile tab and the Notifications tab of `user/profile.ejs`; the alert on the Profile tab lets members see the reminder regardless of which tab they land on.
- **Notes card on member profile** — gated by `canWrite && member.notes` (not `currentUser.role === 'admin'`); super_admin users also see notes.
- **Calendar event indicators** — dashboard calendar cells use `.pta-cal-strip` (colored titled strips, not dots); up to 2 strips stacked per day; colors assigned by `CAL_COLORS[event.id % 8]`; "+N more" strip when >2 events. Cells with events get `.has-events` class (light blue tint, bold number). "New Event" button in dashboard is guarded for `canWrite` OR management positions.
- **NIA fetch-error retry** — when the NIA photo fetch fails, a "Try again" button is shown in `member-detail.ejs` that re-runs `loadCaptcha()` without a page reload.
- **ARC name hint on edit form** — `member-form.ejs` shows a blue info banner with a "Use ARC name" button when `arc_name_en` differs from `first_name + last_name`; values are in `data-arc-first`/`data-arc-last` HTML attributes (EJS HTML-escapes them); JS reads via `this.dataset.*` — never interpolated into JS source. Splits on last whitespace: last word → Last Name, remainder → First Name.

---

## Adding DB Columns

Simple addition (no constraint change):
```javascript
const cols = db.prepare('PRAGMA table_info(members)').all().map(c => c.name);
if (!cols.includes('new_col')) {
  db.prepare('ALTER TABLE members ADD COLUMN new_col TEXT').run();
}
```

Constraint change (requires full table recreation — see PROJECT.md § SQLite Migration Patterns).

---

## Card OCR

Implemented in `utils/ocr.js`. No OCR library — pure HTTPS call to OpenRouter vision API.

```javascript
const { scan } = require('../utils/ocr');
const extracted = await scan('arc_front', '/abs/path/to/image.jpg');
// → { arc_number: '...', arc_name_en: '...', address_zh: '...', ... }
// If the two models disagreed on a field:
// → { ..., _conflicts: { arc_name_en: ['valA', 'valB'] } }
```

Four doc types: `arc_front`, `arc_back`, `cc_front`, `cc_back`. Each has a distinct prompt in `PROMPTS`.

### Dual-model parallel execution
The first two active models run **in parallel**. Their results are merged:
- First non-empty value wins for each field
- If both return different non-empty values → field recorded in `_conflicts: { field: [valA, valB] }`
- If either is rate-limited (429), the third model is substituted as fallback

### Active model list (runtime-configurable)
The list lives in `_activeModels` inside `ocr.js`. On startup, `routes/admin.js` reads `ocr_models` from the `settings` table and calls `setActiveModels()`. If no setting exists, the hardcoded `DEFAULT_VISION_MODELS` is used:

1. `nvidia/nemotron-nano-12b-v2-vl:free` — primary (fast, good results)
2. `nex-agi/nex-n2-pro:free` — secondary parallel
3. `moonshotai/kimi-k2.6:free` — fallback on 429

**Before adding or swapping a model**: verify the exact model ID is valid on OpenRouter. Wrong IDs cause HTTP 400 errors and surface as offline warnings in the dashboard.

`OPENROUTER_MODEL` env var pins a single model (bypasses parallel + fallback logic entirely).

### Model management (`super_admin` only)
```javascript
const { getActiveModels, setActiveModels, testModel } = require('../utils/ocr');
getActiveModels();              // returns current mutable list
setActiveModels(['id1','id2']); // replaces list; falls back to DEFAULT_VISION_MODELS if empty
                                // also clears stale modelStatus entries for removed models
await testModel('model/id');    // pings one model; returns { ok: bool, error?: string }
```
Dashboard "OCR Model Configuration" card shows current models with role labels (Primary / Secondary / Fallback), per-model Test and Remove buttons, Add Model input, and Save. `POST /admin/settings/models` persists the list.

Model IDs are validated against `MODEL_ID_RE = /^[a-zA-Z0-9_\-/:\.]{1,120}$/` on both the models-save and test routes. `POST /admin/ocr-test-model` enforces a 10-second per-model cooldown via `_testCooldowns` Map.

### Post-processing
- `arc_serial_number`: spaces stripped (models hallucinate a space between letter prefix and digits)
- `arc_name_en`: prompts instruct models to reorder from ARC SURNAME-FIRST format to Western GIVEN-FIRST

### Model health (`super_admin` only)
```javascript
const { checkModels, getModelWarnings, dismissModelWarning } = require('../utils/ocr');
await checkModels();           // pings all active models, updates in-memory modelStatus
getModelWarnings();            // returns current warnings array
dismissModelWarning(modelId);  // clears a warning from memory
```
Failures detected passively during scans (non-429 errors) also populate `modelStatus`.
Dashboard shows a "Vision Model Health" card (super_admin only).

### OCR Review Modal conflicts
When `_conflicts` is present in `extracted`, the modal shows a `<select>` dropdown for each conflicted field (Model A vs Model B) instead of a static value. The checkbox's `data-value` updates live when the admin picks.

Routes in `routes/admin.js`:
- `POST /admin/members/:id/documents/card` — upload image, auto-OCR, return `{ extracted }` JSON
- `POST /admin/members/:id/documents/:docId/ocr` — re-run OCR on stored card
- `POST /admin/members/:id/apply-card-fields` — write checked fields to member record
- `POST /admin/ocr-health-check` — super_admin only; pings all active models, returns `{ warnings }`
- `POST /admin/ocr-dismiss-warning` — super_admin only; body `{ model }`, clears in-memory warning
- `POST /admin/ocr-test-model` — super_admin only; body `{ model }`, returns `{ ok, error? }` JSON

---

## App Settings

Runtime-configurable values stored in the `settings` table (key/value). Read/write via helpers in `routes/admin.js`:

```javascript
getSetting('default_fee_amount', '300')   // → string or defaultVal if key absent
setSetting('default_fee_amount', '400')   // → upserts row
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `default_fee_amount` | integer string | `'300'` | Annual fee (TWD) pre-filled on new member forms; saving also retroactively updates all unpaid non-honorary members |
| `ocr_models` | JSON array string | (none — uses hardcoded) | Active OCR model list |

Super-admin dashboard cards for both settings:
- **Default Annual Fee** card — number input + Save → `POST /admin/settings/fee`
- **OCR Model Configuration** card — ordered list, add/remove/test → `POST /admin/settings/models`

Changing the fee also retroactively updates `fee_amount` for all members where `fee_status = 'unpaid'` and `position != 'honorary'`.

See PROJECT.md § Card OCR Feature for full details including prompt notes.

---

## NIA ARC Photo Fetch

Server-side only (no browser automation). Routes in `routes/admin.js`:
- `GET /admin/members/:id/arc-captcha` — fetches captcha image from NIA, stores JSESSIONID, returns base64 to browser
- `POST /admin/members/:id/arc-fetch-photo` — validates captcha with NIA, calls search, saves returned photo

The **Fetch NIA Photo** button lives in the sidebar profile card under the member's photo (not in the ARC section). If the fetch fails, a "Try again" button appears that re-invokes `loadCaptcha()` without a page reload.

See PROJECT.md § NIA ARC Photo Fetch for full API details.

---

## Address Fields

Address is stored as two plain text fields — no dropdown picker needed:
- `address_zh` — Chinese address as printed on the ARC card (auto-filled by OCR scan of `arc_front`)
- `address` — English address

Both are simple `<input type="text">` fields in `member-form.ejs` and `profile-edit.ejs`. The old `address-field.ejs` partial (Taiwan/Other cascading dropdown) still exists on disk but is no longer used.

---

## Design System

The PT Design System is a set of CSS files that sit on top of Bootstrap 5. **Never revert or bypass it.**

### Load order (must be preserved)
```html
Bootstrap 5 CSS (CDN)
Bootstrap Icons (CDN)
Flag Icons (CDN)
/css/custom.css           (Bootstrap minor overrides)
/css/ds/pt-design-system.css   (design tokens + .pta-* components)
/css/ds/pt-bootstrap-bridge.css (remaps Bootstrap variables to design tokens)
```

### Layout structure (all authenticated pages)
```
header.ejs  →  <header class="pta-topbar"> ... </header>
              <main class="pta-main">
                <%- include('flash') %>
                [page content]
footer.ejs  →  </main>
```

### Key component classes
| Class | Purpose |
|-------|---------|
| `.pta-topbar` | Fixed top navigation bar |
| `.pta-nav` / `.pta-nav__item` | Nav links inside topbar |
| `.pta-brand` | Logo + wordmark area |
| `.pta-main` | Page content wrapper (centered, max-width) |
| `.pta-pagehead` | Page title row with action buttons |
| `.pta-card` / `.pta-card--flush` | Content card; flush removes body padding |
| `.pta-card__head` | Card header with icon + titles |
| `.pta-card__eyebrow` | Small label above card title |
| `.pta-table` | Full-width table inside a card |
| `.pta-statsbar` / `.pta-stat` | Dashboard KPI tiles |
| `.pta-toolbar` | Search + filter row above a table |
| `.pta-search` | Search input wrapper inside toolbar |
| `.pta-filterchips` / `.pta-chip` | Filter pill links |
| `.pta-detail` | Two-column sidebar+content layout for detail pages |
| `.pta-badge` | Pill badge; modifier: `--soft`, `--solid` |
| `.pta-btn` | Button; modifiers: `--secondary`, `--ghost`, `--danger`, `--sm`, `--block` |
| `.pta-avatar` | Circular avatar; `--xl` for profile card |
| `.pta-namecell` | Avatar + name stack in list rows |
| `.pta-dl` / `.pta-dl--split` | Definition list; split = label/value in two columns |
| `.pta-fieldset` | Grouped label+value display block |
| `.pta-id` | Monospace identifier style |
| `.pta-docslots` | 2×2 grid for the four card document slots |
| `.pta-login` / `.pta-login__card` | Login page layout |

### Tone modifiers (used with `.pta-badge`, `.pta-stat`, `.pta-avatar`)
`pta-tone-success` · `pta-tone-danger` · `pta-tone-warning` · `pta-tone-gold` · `pta-tone-info` · `pta-tone-neutral` · `pta-tone-honorary`

### SRI hashes
All CDN links in `header.ejs`, `footer.ejs`, and `login.ejs` have `integrity` attributes. If a CDN version is ever bumped, recompute the hash locally:
```powershell
$bytes = (New-Object Net.WebClient).DownloadData('https://...')
'sha384-' + [Convert]::ToBase64String([Security.Cryptography.SHA384]::Create().ComputeHash($bytes))
```

---

## References

- [PROJECT.md](PROJECT.md) — full reference: schema, routes, fee logic, OCR, NIA integration, frontend page inventory, constraints
