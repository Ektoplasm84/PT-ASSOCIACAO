# PT Associação — Project Reference

## What This Is

A membership management web application for a Portuguese-Taiwanese association. Members have extended profiles including personal data, Taiwan ARC/APRC/Passport data, and Portuguese Cartão de Cidadão data. Deployed as a Node.js application via cPanel's "Setup Node.js App" feature.

---

## Current Status (as of 2026-06-13)

### Done
- Full Node.js + Express backend with SQLite embedded database
- Role/position system: `role` (permission) + `position` (association title) — see § Role System
- Honorary members (`position = 'honorary'`) — fee N/A, excluded from fee stats, no voting
- Member card divided into 5 sections: Personal Info, Membership Info, ARC/ID Data, Cartão de Cidadão, Notes
- Display name throughout app: `arc_name_en` when available, falls back to `first_name + last_name`
- Address stored as two plain text fields (`address_zh` from ARC OCR, `address` English) — no dropdown picker
- Fee system: annual fee (0 or 300 TWD), date last paid, auto-computed status and validity
- Photo upload per member; document upload/download with thumbnail generation
- Session-based authentication (bcrypt), sessions persisted in SQLite
- **PT Design System** — `.pta-*` component layer on top of Bootstrap 5; full design handoff applied to all admin pages
- **Card OCR** — dual-model parallel execution via OpenRouter vision API; admin reviews merged results + model conflict highlights in modal; apply selectively
- **NIA ARC photo fetch** — server fetches Taiwan NIA captcha, admin solves it, official photo saved to profile; blocked for APRC and TW Passport members
- **Image lightbox** — clicking card or misc doc thumbnails opens a Bootstrap modal with full-size view + download button
- **Dashboard warnings** — compact stats bar + Warnings & Advisories table (unpaid fees + expiring ARC/CC within 60 days)
- **Vision Model Health** — super_admin dashboard card; on-demand model ping; passive offline detection during scans; dismiss individual warnings
- **OCR Model Configuration** — super_admin dashboard card; live list of active models with role labels; add/remove/test any model ID; timeout (seconds) input; all saved to `settings` table, persists across restarts. Unsaved-changes indicator on Save button; duplicate model feedback.
- **Default Annual Fee** — super_admin dashboard card; configurable fee amount stored in `settings` table; pre-fills new member form; saving also retroactively updates `fee_amount` for all currently-unpaid non-honorary members
- **Placeholder credentials** — new member form pre-fills a random `membro.XXXX@associacao.pt` email and placeholder name; email is the login credential so changing it changes login immediately
- **Login brute-force protection** — in-memory rate limiter: 5 failures/15 min → 15-min IP block
- **Audit log** — append-only `audit_log` table (cap 2000 rows); every write action on any member records actor + target + changed fields; visible at `/admin/audit` to admin+ only
- **Authenticated photo/thumb serving** — photos and thumbnails served through `requireAuth` routes, not `express.static`
- Default super_admin account seeded on first run
- **Association Calendar** — month grid widget on admin/gestao dashboard; event creation with audience targeting (all / paid / unpaid / honorary / non-honorary); per-day event panel with attendee list (accepted / pending / declined); delete with audit trail
- **In-app notification system** — `event_invites` table; bell icon in topbar (all roles) with pending count badge; Notifications tab on member profile (Bootstrap tabs); accept/decline in-place without page reload; fee reminder alert
- **iCal export (member)** — `GET /profile/invites/:id/export.ics` generates a valid RFC 5545 `.ics` file; "Add to Calendar" button on pending + accepted invites; compatible with Apple Calendar, Google Calendar, Outlook
- **Admin password reset** — super_admin can set a new password for any member from the Account Settings card on member-detail; hashed with bcryptjs cost 10; audited as `member.password_reset`
- **Fee label clarity** — fee-exempt / honorary members display as "Honorary Member" throughout all templates; dropdown options read "0 TWD — Honorary Member"
- **Members list role visibility** — Position column reflects system role: super_admin → "Super Admin" (gold badge), admin → "Admin" (info badge); falls back to association position
- **Honorary fee-amount zero fix** — all fee_amount parsing uses `parseInt(n,10) >= 0 ? parseInt(n,10) : 300`
- **RFC 5987 Content-Disposition** — document view and download routes in both `admin.js` and `user.js` use `contentDispositionFilename(disposition, name)` helper; emits `filename*=UTF-8''...` for non-ASCII filenames
- **Chinese filename fix** — `fixFilename(name)` helper in `admin.js` re-encodes `Buffer.from(name, 'latin1').toString('utf8')` at every upload point; busboy 1.x defaults to latin1, modern browsers send UTF-8
- **Trust proxy + production cookie** — `app.set('trust proxy', 1)` + `NODE_ENV=production` → HTTPS `Secure` sessions behind cPanel's nginx reverse proxy
- **`isManagementUser(u)` helper** — in `routes/admin.js`; returns `true` when `u.position` is in `MGMT_POSITIONS`
- **`resolveAudience()` UNION query** — single UNION query for event audience resolution
- **OCR model ID validation** — `MODEL_ID_RE = /^[a-zA-Z0-9_\-/:\.]{1,120}$/` on save + test routes; 10-second per-model cooldown
- **Calendar event strips** — colored `.pta-cal-strip` titles in calendar cells; up to 2 stacked; "+N more" strip; `.has-events` tint
- **ARC name hint on edit form** — blue info banner + "Use ARC name" button when `arc_name_en` differs from stored name
- **APRC support** — `is_aprc INTEGER` column on members; permanent residents get "APRC — PERMANENT" badge (info tone) instead of expiry; NIA fetch blocked with message; ID Type column shows "APRC"
- **Taiwan Passport support** — `is_tw_passport INTEGER` column on members; ARC/ID section shows 3-way radio (ARC / APRC / TW Passport); passport expiry tracked via `arc_expiry_date`; NIA fetch blocked
- **Members list improvements** — Warnings column (doc expiry badges), ID Type column (ARC/APRC/TW Passport), Sort dropdown (name A-Z/Z-A, recently added, oldest, join date ↑↓)
- **File Vault** — two-section document vault: Public (all members can view/download; admin/SA/management can upload) and Administration (admin/SA only); dashboard cards for upload + manage; `/vault` member page; all actions audited; files stored under `uploads/vault/{section}/`
- **Design System R4** — responsive shell: fluid `.pta-main`, mobile bottom tab nav (`.pta-nav` transforms to fixed bottom bar at ≤768px), copper/charcoal login, mobile calendar agenda (`.pta-agenda` / `renderAgendaMobile()`), `pta-table-wrap` on dashboard tables, profile single-scroll layout (`profile-layout` CSS grid, Bootstrap tabs removed), audit log DS upgrade (pta-pagehead + pta-badge tones + pta-card wrappers); charcoal topbar `#313131`; brand "Associação Cultural Portuguesa / na Formosa"; emblem updated to `logo-emblem.png`
- **Version V1.8** — Cookie-based EN/PT/ZH-TW language switcher (zero-dependency i18n middleware, `locales/` JSON files, `.pta-langsw` DS component); security: open-redirect hardening on `/lang/:code`

### Not Yet Built
- Email notifications to members
- SMS notifications to members
- Self-service password reset (forgot password email flow)
- Member-facing document upload
- Export / reporting features

### Calendar & Notifications — Planned Extensions

#### Email delivery of event invites
The `event_invites` table has a `notified_at TEXT` column reserved for this. When an email system is added, the mailer queries `WHERE notified_at IS NULL`, sends one email per row, then stamps `notified_at = datetime('now')`. Suggested trigger: after `POST /admin/events` inserts invite rows, call the mailer in the background. Attach `.ics` so recipients get a one-click "Add to Calendar" in Apple Mail / Gmail.

#### iCal export — admin side
`GET /profile/invites/:id/export.ics` is live for members. Still to add:
- `GET /admin/events/:id/export.ics` — admin downloads a `.ics` for any event.

#### Event location — map link
The `location` field is currently plain text. WIP: render as `https://maps.google.com/?q=<encoded>` link wherever displayed. Zero API key — one-liner template change.

---

## Project Structure

```
PT ASSOCIACAO/
│
├── app.js                        Entry point. Wires middleware, sessions, routes. Loads .env.
│                                 Authenticated routes: GET /uploads/photos/:f, /uploads/thumbs/:f
│                                 Public vault routes: GET /vault, GET /vault/files/:id
├── package.json
├── .env                          API keys — NEVER committed. See § Environment Variables.
├── .gitignore
│
├── database/
│   └── db.js                     SQLite init, schema + migrations, seeds default admin.
│
├── routes/
│   ├── auth.js                   GET/POST /login, POST /logout, GET /
│   ├── admin.js                  All /admin/* routes (member CRUD, documents, OCR, NIA photo,
│   │                             role change, audit log, OCR health check, vault upload/download/delete)
│   │                             Exports: router (Express Router)
│   └── user.js                   All /profile/* routes (own profile + downloads)
│                                 Exports: { router, contentDispositionFilename }
│
├── middleware/
│   └── auth.js                   requireAuth, requireAdmin, requireSuperAdmin, requireViewAll
│
├── utils/
│   ├── fee.js                    computeFeeStatus(fee_amount, fee_last_paid) helper
│   ├── ocr.js                    OpenRouter vision API — dual-model parallel scan + health tracking
│   │                             Exports: scan, checkModels, getModelWarnings, dismissModelWarning,
│   │                                      getActiveModels, setActiveModels, testModel,
│   │                                      getModelTimeout, setModelTimeout
│   ├── audit.js                  writeAudit(...) — append-only, 2000-row cap, atomic trim
│   ├── countries.js              Full world country list (code, name, dial code, flag)
│   └── taiwan-districts.js       All 22 Taiwan cities/counties with districts (ZH + EN + postal)
│
├── frontend/                     ← ALL frontend work lives here
│   ├── views/
│   │   ├── login.ejs             Standalone (no header partial) — .pta-login layout
│   │   ├── 404.ejs
│   │   ├── error.ejs
│   │   ├── partials/
│   │   │   ├── header.ejs        HTML head, CDN links, .pta-topbar (charcoal #313131); admin/gestao nav: Dashboard+Members+Documents+Audit; member nav: My Profile only
│   │   │   ├── footer.ejs        </main>, Bootstrap JS bundle CDN
│   │   │   ├── flash.ejs         Alert banner for success/error messages
│   │   │   ├── phone-field.ejs   Reusable country dial-code picker + number input
│   │   │   └── member-form.ejs   5-section form (Personal / Membership / ARC+ID / CC / Notes)
│   │   │                         ARC section uses .pta-seg segmented control (ARC / APRC / TW Passport)
│   │   │                         with icons; APRC has no "(Permanent)" label suffix
│   │   ├── admin/
│   │   │   ├── dashboard.ejs     Stats + Warnings + Vision Model Health + OCR config (with timeout) +
│   │   │   │                     Fee config + Calendar + Recent Members + File Vault (two sections)
│   │   │   ├── members-list.ejs  Search + fee filter + sort dropdown + Warnings column + ID Type column
│   │   │   ├── member-detail.ejs APRC/TW Passport display; NIA blocked message for non-ARC
│   │   │   ├── member-new.ejs    New member form
│   │   │   ├── member-edit.ejs   Edit member form
│   │   │   └── audit-log.ejs     Paginated audit log (admin+ only)
│   │   └── user/
│   │       ├── profile.ejs       Own profile — single-scroll layout (no tabs); profile-layout CSS grid; notifications at #notifications anchor; public vault files table at bottom
│   │       ├── profile-edit.ejs  Edit personal info, ARC data, CC data, password
│   │       └── vault.ejs         Public document vault — all authenticated members
│   └── public/
│       ├── css/
│       │   ├── custom.css                    Minor Bootstrap overrides
│       │   └── ds/
│       │       ├── pt-design-system.css      Design tokens + .pta-* component styles
│       │       ├── pt-bootstrap-bridge.css   Remaps Bootstrap CSS variables to design tokens
│       │       └── azulejo-tile.svg          Background tile
│       └── images/
│           ├── logo-emblem.png               Brand emblem (512×512, copper on charcoal) — topbar + login
│           ├── logo-full.jpg                 Full lockup for emails/share
│           └── logo-wordmark.svg             Full wordmark
│
├── uploads/                      ← Runtime only. Created on startup. Not in git.
│   ├── photos/                   Member photos — served via authenticated route only
│   ├── documents/                Card images + misc documents
│   ├── thumbs/                   Card image thumbnails — authenticated route only
│   └── vault/
│       ├── public/               Public vault files — any authenticated user can download
│       └── admin/                Admin vault files — admin/SA only
│
└── database/
    └── data.db                   ← Runtime only. Created on startup. Not in git.
```

---

## Environment Variables

Stored in `.env` in the project root. Loaded manually at startup by `app.js`. Never committed.

```
OPENROUTER_API_KEY=sk-or-v1-...        # Required for card OCR feature
SESSION_SECRET=<random 48-byte hex>    # Required — signs session cookies
# OPENROUTER_MODEL=nvidia/nemotron-nano-12b-v2-vl:free  # Optional: pin one model, bypasses parallel logic
```

On cPanel hosting, set `OPENROUTER_API_KEY`, `SESSION_SECRET`, and `NODE_ENV=production` as environment variables in the Node.js App panel — do NOT upload `.env`.

---

## Database Schema

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| email | TEXT UNIQUE | Case-insensitive |
| password_hash | TEXT | bcrypt, cost 10 |
| role | TEXT | `super_admin` / `admin` / `member` |
| position | TEXT | `member` / `honorary` / `gestao` / `board` / `president` / `treasurer` / `secretary` |
| created_at | TEXT | ISO-8601 datetime |

### `members`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| user_id | INTEGER FK | Cascades on user delete |
| member_id | TEXT UNIQUE | e.g. `ASSOC-0042` |
| first_name | TEXT | |
| last_name | TEXT | |
| phone | TEXT | |
| address | TEXT | English address |
| address_zh | TEXT | Chinese address from ARC OCR |
| city / postal_code / city_zh / district_zh / district_en / address_type | TEXT | Legacy — not actively used |
| join_date | TEXT | ISO date |
| fee_amount | INTEGER | 0 (exempt) or 300 TWD; default 300 |
| fee_last_paid | TEXT | ISO date |
| fee_valid_until | TEXT | Auto-computed: fee_last_paid + 1 year |
| fee_status | TEXT | `paid` / `unpaid` / `renewal_incoming` — always computed, never set from form |
| notes | TEXT | Admin-only internal notes |
| photo_path | TEXT | Relative: `uploads/photos/<file>` |
| arc_number | TEXT | Taiwan ARC UI number (e.g. `A800287833`) |
| arc_name_en | TEXT | Western GIVEN SURNAME order (ALL CAPS) — display name throughout |
| arc_chinese_name | TEXT | Name in Chinese characters |
| arc_issue_date | TEXT | ISO date |
| arc_expiry_date | TEXT | ISO date; also used as passport expiry when `is_tw_passport=1` |
| passport_number | TEXT | |
| arc_serial_number | TEXT | Reference number next to barcode on ARC back |
| is_aprc | INTEGER | 1 = permanent resident; no expiry shown; NIA fetch blocked |
| is_tw_passport | INTEGER | 1 = Taiwan Passport as primary ID; expiry tracked via arc_expiry_date |
| cc_number | TEXT | Portuguese Cartão de Cidadão number |
| cc_issue_date | TEXT | Dormant — not shown in UI |
| cc_expiry_date | TEXT | ISO date |
| nif | TEXT | 9-digit tax number |
| niss | TEXT | 11-digit social security number |
| updated_at | TEXT | ISO-8601 datetime |

### `documents`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| member_id | INTEGER FK | Cascades on member delete |
| file_path | TEXT | Relative: `uploads/documents/<file>` |
| original_name | TEXT | Shown on download; stored after `fixFilename()` UTF-8 re-encoding |
| mime_type | TEXT | |
| doc_type | TEXT | `arc_front` / `arc_back` / `cc_front` / `cc_back` / `misc` |
| thumb_path | TEXT | Nullable: `uploads/thumbs/<file>` |
| uploaded_at | TEXT | ISO-8601 datetime |

Card documents are one-per-type per member (uploading replaces existing). `misc` can accumulate freely.

### `vault_files`
Association-wide document vault. One table for both sections, distinguished by `section`.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| section | TEXT | `'public'` or `'admin'` — CHECK constraint enforced |
| filename | TEXT | Stored filename: `{timestamp}-{uuid}.ext` |
| original_name | TEXT | Original filename; stored after `fixFilename()` UTF-8 re-encoding |
| mime_type | TEXT | |
| file_size | INTEGER | Bytes |
| description | TEXT | Optional; max 200 chars |
| uploaded_by | INTEGER FK | `users.id` — SET NULL on user delete |
| uploaded_at | TEXT | ISO-8601 datetime |

Index: `idx_vault_section (section)`.

Access rules:
- `public` section: any `requireAuth` user can download; admin/SA/management can upload; admin/SA can delete
- `admin` section: admin/SA only for all operations

### `settings`
Runtime key/value store.

| Key | Default | Description |
|-----|---------|-------------|
| `default_fee_amount` | `'300'` | Annual fee TWD pre-filled on new member form; saving updates all unpaid non-honorary members |
| `ocr_models` | _(absent = hardcoded defaults)_ | JSON array of active OCR model IDs |
| `ocr_timeout_ms` | _(absent = 55000)_ | Per-model timeout in milliseconds (10000–120000); configurable via dashboard |

### `events`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| title | TEXT | Required |
| description | TEXT | Optional |
| location | TEXT | Optional — plain text |
| start_date | TEXT | ISO date `YYYY-MM-DD` |
| end_date | TEXT | ISO date, optional |
| created_by | INTEGER FK | `users.id` — cascades on delete |
| created_at | TEXT | ISO-8601 datetime |

### `event_invites`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| event_id | INTEGER FK | Cascades on delete |
| user_id | INTEGER FK | Cascades on delete |
| status | TEXT | `pending` / `accepted` / `declined` |
| seen_at | TEXT | First view timestamp |
| responded_at | TEXT | Last Accept/Decline timestamp |
| notified_at | TEXT | Reserved for email delivery |
| — | UNIQUE | `(event_id, user_id)` |

### `audit_log`
Append-only. No FK on `member_id`. Capped at 2000 rows.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| actor_id | INTEGER | Nullable |
| actor_email | TEXT | |
| member_id | INTEGER | Nullable |
| member_ref | TEXT | e.g. `"ASSOC-0042 João Silva"` |
| action | TEXT | See § Audit Log Actions |
| detail | TEXT | Field diff or descriptive string |
| created_at | TEXT | ISO-8601 datetime |

---

## Role System

Two independent columns on `users`: `role` (system permission) and `position` (association title).

### Permission roles (`users.role`)
| Role | Can do |
|------|--------|
| `super_admin` | Everything: all CRUD, role/position changes, delete any account, OCR config, vault admin |
| `admin` | All member CRUD, documents, OCR, NIA photo, audit log, vault admin — no role changes |
| `member` | Own profile only — view + edit own data, download own documents, view public vault |

### Association positions (`users.position`)
| Position | Notes |
|----------|-------|
| `member` | Default |
| `honorary` | No fees; fee sections show N/A; excluded from paid/unpaid stats |
| `gestao` | Grants view-all + fee-write + calendar-write + public-vault-upload access |
| `board` / `president` / `treasurer` / `secretary` | Same access as gestao |

### Middleware (`middleware/auth.js`)
```javascript
requireAuth(req, res, next)       // any session — sets currentUser, canWrite, isSuperAdmin, canViewAll
requireAdmin(req, res, next)      // super_admin | admin only
requireSuperAdmin(req, res, next) // super_admin only
requireViewAll(req, res, next)    // admin+ OR position in MGMT_POSITIONS
```

### `res.locals` helpers (every authenticated template)
| Variable | Value |
|----------|-------|
| `currentUser` | `{ id, email, role, position }` |
| `canWrite` | `true` for super_admin + admin |
| `isSuperAdmin` | `true` for super_admin only |
| `canViewAll` | `true` for admin+ OR management position |
| `pendingInviteCount` | Count of pending event invites for current user |

### Inline guards in `routes/admin.js`
```javascript
adminOnly(req, res, next)       // blocks gestao (position) on write routes
superAdminOnly(req, res, next)  // blocks everyone but super_admin
canUploadVault(user)            // returns true for admin/SA/all management positions
```

---

## Fee Status Logic

`computeFeeStatus(feeAmount, feeLastPaid)` in `utils/fee.js`.

| Condition | fee_status | Badge |
|-----------|-----------|-------|
| fee_amount = 0 | `paid` | `pta-tone-success` |
| fee_amount > 0, no date | `unpaid` | `pta-tone-danger` |
| Paid, valid > 30 days | `paid` | `pta-tone-success` |
| Paid, valid ≤ 30 days | `renewal_incoming` | `pta-tone-gold` |
| Paid, expired | `unpaid` | `pta-tone-danger` |

---

## Member Card Sections

1. **Personal Info** — first name, last name, phone, email, address ZH + EN, photo
2. **Membership Info** — member ID, join date, annual fee, last paid, valid until, fee status
3. **ARC / ID Data** — 3-way radio: ARC / APRC / TW Passport; number, names, dates, serial; "APRC — PERMANENT" badge when `is_aprc=1`; expiry label changes for passport
4. **Cartão de Cidadão** — CC number, expiry, NIF, NISS
5. **Notes** — admin-only

---

## Routes Quick Reference

### Public
| Method | Path | Description |
|--------|------|-------------|
| GET | `/login` | Login page |
| POST | `/login` | Authenticate |
| POST | `/logout` | Destroy session |
| GET | `/` | Redirect to dashboard or profile |

### Authenticated file serving (`app.js`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/uploads/photos/:filename` | Serve member photo (requireAuth) |
| GET | `/uploads/thumbs/:filename` | Serve thumbnail (requireAuth) |
| GET | `/vault` | Public vault page — all authenticated users |
| GET | `/vault/files/:id` | Download public vault file (requireAuth, section=public only) |

### Admin (requireViewAll for GET; adminOnly/superAdminOnly for writes)
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/admin` | viewAll | Dashboard |
| GET | `/admin/members` | viewAll | Member list (search, fee filter, sort) |
| GET | `/admin/members/new` | adminOnly | New member form |
| POST | `/admin/members` | adminOnly | Create member |
| GET | `/admin/members/:id` | viewAll | Member detail |
| GET | `/admin/members/:id/edit` | adminOnly | Edit form |
| POST | `/admin/members/:id` | adminOnly | Update member |
| POST | `/admin/members/:id/delete` | adminOnly | Delete member |
| POST | `/admin/members/:id/change-role` | superAdminOnly | Change role + position |
| POST | `/admin/members/:id/set-password` | superAdminOnly | Set new password |
| POST | `/admin/members/:id/documents` | adminOnly | Upload misc documents (up to 5) |
| POST | `/admin/members/:id/documents/card` | adminOnly | Upload card image + auto-OCR |
| POST | `/admin/members/:id/documents/:docId/ocr` | adminOnly | Re-run OCR on stored card |
| POST | `/admin/members/:id/apply-card-fields` | adminOnly | Apply OCR fields |
| POST | `/admin/members/:id/documents/:docId/delete` | adminOnly | Delete document |
| GET | `/admin/members/:id/documents/:docId/view` | viewAll | Serve document inline |
| GET | `/admin/members/:id/documents/:docId/download` | viewAll | Download document |
| GET | `/admin/members/:id/arc-captcha` | adminOnly | Fetch NIA captcha (blocked for APRC/TW Passport) |
| POST | `/admin/members/:id/arc-fetch-photo` | adminOnly | Validate captcha + save NIA photo |
| POST | `/admin/ocr-health-check` | superAdminOnly | Ping all OCR models |
| POST | `/admin/ocr-dismiss-warning` | superAdminOnly | Clear in-memory model warning |
| POST | `/admin/ocr-test-model` | superAdminOnly | Ping one model; 10s cooldown |
| POST | `/admin/settings/fee` | superAdminOnly | Save default annual fee |
| POST | `/admin/settings/models` | superAdminOnly | Save OCR model list + timeout |
| GET | `/admin/audit` | adminOnly | Audit log (paginated) |
| POST | `/admin/vault/upload` | requireAuth + guard | Upload to vault (section in body); public = canUploadVault; admin = canWrite |
| GET | `/admin/vault/files/:id` | requireAuth + guard | Download vault file (admin section needs admin/SA/management) |
| POST | `/admin/vault/files/:id/delete` | canWrite | Delete vault file |

### Calendar / Events
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/admin/events/data` | viewAll | JSON events for `?year=&month=` |
| POST | `/admin/events` | calendarWrite | Create event + resolve audience + insert invites |
| POST | `/admin/events/:id/delete` | calendarWrite | Delete event |
| GET | `/admin/events/:id/invites` | adminOnly | JSON invitee list with status |

### Member (requireAuth, own data only)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/profile` | Own profile (My Profile + Notifications tabs) |
| GET | `/profile/edit` | Edit form |
| POST | `/profile` | Save profile changes |
| GET | `/profile/documents/:docId/view` | Serve own document inline |
| GET | `/profile/documents/:docId/download` | Download own document |
| GET | `/profile/invites/:id/export.ics` | Download RFC 5545 `.ics` |
| POST | `/profile/invites/:id/respond` | Accept / Decline invite |

---

## Card OCR Feature

### Card Types and Fields
| doc_type | Fields extracted |
|----------|-----------------|
| `arc_front` | `arc_number`, `arc_name_en`, `arc_chinese_name`, `arc_issue_date`, `arc_expiry_date`, `passport_number`, `address_zh` |
| `arc_back` | `arc_serial_number` |
| `cc_front` | `cc_number`, `cc_expiry_date` |
| `cc_back` | `nif`, `niss` |

### Implementation (`utils/ocr.js`)
- Pure HTTP to OpenRouter `/api/v1/chat/completions`
- **Dual-model parallel**: first two `_activeModels` run via `Promise.allSettled`
- **Merge**: first non-empty value wins; `_conflicts` when both differ and both non-empty
- **Fallback**: third model substituted if either parallel slot returns 429
- **Per-model timeout**: `MODEL_TIMEOUT_MS` (default 55s, configurable via dashboard); AbortController cleared only after `res.json()` body is fully read — headers arriving does NOT clear the timer
- **Health tracking**: non-429 errors mark model offline; cleared on success
- `OPENROUTER_MODEL` env var pins one model (bypasses parallel + fallback)

### `utils/ocr.js` exports
| Export | Description |
|--------|-------------|
| `scan(docType, imagePath)` | Run OCR; returns fields + optional `_conflicts` |
| `checkModels()` | Ping all active models; update health store |
| `getModelWarnings()` | Current in-memory warnings array |
| `dismissModelWarning(modelId)` | Clear a warning |
| `getActiveModels()` | Current `_activeModels` copy |
| `setActiveModels(models)` | Replace list; clears stale `modelStatus` entries |
| `testModel(modelId)` | Ping one model; returns `{ ok, error? }` |
| `getModelTimeout()` | Current `MODEL_TIMEOUT_MS` value |
| `setModelTimeout(ms)` | Set timeout (10000–120000 range enforced) |

### Active model list
| # | Model ID | Role |
|---|----------|------|
| 1 | `nvidia/nemotron-nano-12b-v2-vl:free` | Primary |
| 2 | `nex-agi/nex-n2-pro:free` | Secondary parallel |
| 3 | `moonshotai/kimi-k2.6:free` | Fallback on 429 |

Only models with `:free` suffix are free. Models without `:free` charge OpenRouter credits.

---

## File Vault

Two-section document store for association files. Not for member-specific documents (those live in `documents` table).

### Access matrix
| | Public | Administration |
|---|---|---|
| View / Download | Any logged-in member | Admin + Super Admin |
| Upload | Admin, Super Admin, all management positions | Admin + Super Admin only |
| Delete | Admin + Super Admin | Admin + Super Admin |

### Storage
Files stored under `uploads/vault/public/` and `uploads/vault/admin/`. These directories are created at startup. Served through authenticated routes — NOT via `express.static`.

### Allowed file types (vault upload)
PDF, JPEG, PNG, WebP, plain text, Word (`.doc`/`.docx`), Excel (`.xls`/`.xlsx`). Max 20 MB per file.

### UI
- **Dashboard** — "File Vault" section at the bottom with two side-by-side cards (Public + Administration). Upload form with optional description. Delete button (canWrite). "Member view" link to `/vault`.
- **Member `/vault` page** — clean table of public files with download button; linked from topbar "Documents" for all users.

### Audit events
- `vault.upload` — `[section] filename (N KB)`
- `vault.delete` — `[section] filename`

---

## Key Behaviours

### Authentication & Authorisation
- Sessions in SQLite via `better-sqlite3-session-store` — survive server restarts.
- All queries in `routes/user.js` scope to `WHERE user_id = req.session.userId`.

### Audit Log
- Hard cap: 2000 rows. `writeAudit()` inserts + trims atomically. No UPDATE or DELETE routes.

| Action key | When |
|-----------|------|
| `member.created` | Admin creates a new member |
| `member.updated` | Admin saves member edit (detail = field diff) |
| `member.deleted` | Admin deletes a member |
| `member.role_changed` | Super-admin changes role/position |
| `member.password_reset` | Super-admin sets member password |
| `member.card_uploaded` | Card image uploaded |
| `member.doc_uploaded` | Misc document(s) uploaded |
| `member.doc_deleted` | Document deleted |
| `member.ocr_applied` | OCR fields applied |
| `member.nia_photo_saved` | NIA photo saved |
| `profile.self_updated` | Member edits own profile |
| `settings.fee_changed` | Default annual fee changed |
| `settings.models_changed` | OCR model list (or timeout) saved |
| `event.created` | Calendar event created |
| `event.deleted` | Calendar event deleted |
| `vault.upload` | File uploaded to vault |
| `vault.delete` | File deleted from vault |

### File Uploads
- **Photos**: JPEG/PNG/WebP, max 2 MB → `uploads/photos/`
- **Card images**: max 5 MB → `uploads/documents/`; thumbnails → `uploads/thumbs/`. One per type per member.
- **Misc documents**: PDF/Word/images/text, max 10 MB each → `uploads/documents/`
- **Vault files**: PDF/Word/Excel/images/text, max 20 MB → `uploads/vault/{section}/`
- Disk filenames: `{timestamp}-{uuid}.ext` — original name stored in DB after `fixFilename()` re-encoding
- **Chinese / non-ASCII filenames**: `fixFilename(name)` re-encodes `Buffer.from(name, 'latin1').toString('utf8')` because busboy 1.x defaults to latin1; applied at all upload insert points in `admin.js`

### DB Migrations
- Simple column additions: `PRAGMA table_info` check → `ALTER TABLE … ADD COLUMN`
- Full table recreations: foreign keys OFF → create new → copy → drop old → rename → rebuild indexes
- Never use `db.exec` with multiple statements — security hook blocks it

### cPanel Deployment
1. `git pull` in `/home/chiangly/repositories/PT-ASSOCIACAO/`
2. `npm install` (only when `package.json` changes)
3. Get PID: `https://associacao.poetico.co/node-check.php?token=ptassoc-diag-2024`
4. Kill: `https://associacao.poetico.co/node-kill.php?token=ptassoc-diag-2024&pid=XXXX`
5. cPanel → Node.js Selector → **Start**

`node-check.php` and `node-kill.php` are gitignored — upload manually to `public_html/`, delete after use.

---

## NIA ARC Photo Fetch

Server-side only (Node 18+ global `fetch`). Blocked for `is_aprc=1` and `is_tw_passport=1` members — those don't have a searchable ARC record.

### Flow
1. Admin clicks **"Fetch NIA Photo"** (sidebar, under member photo)
2. Server fetches NIA captcha image + JSESSIONID; stored server-side (5-min TTL)
3. Admin solves captcha in modal
4. Server validates + calls NIA search → saves photo if found
5. On failure: "Try again" button re-runs `loadCaptcha()` without page reload

### NIA API
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/icinfo-frontend/api/captcha?{ts}` | Captcha image + JSESSIONID |
| GET | `/icinfo-frontend/api/captcha/{answer}/validation` | Validate captcha |
| POST | `/icinfo-frontend/api/search` | Submit ARC data; returns photo |

POST body: `{ "uino", "issueDate", "expiryDate", "serialNo", "captcha" }`

---

## Frontend Design System

### Load order
```
Bootstrap 5.3.3 CSS (CDN, SRI)
Bootstrap Icons 1.11.3 (CDN, SRI)
Flag Icons 7.2.3 (CDN, SRI)
/css/custom.css
/css/ds/pt-design-system.css
/css/ds/pt-bootstrap-bridge.css
```

### Page Inventory

#### `login.ejs`
Standalone. `.pta-login` layout. Version badge shows current app version.

#### `admin/dashboard.ejs`
Variables: `stats`, `warnings[]`, `recent[]`, `modelWarnings[]`, `activeModels[]`, `ocrTimeoutSec`, `defaultFee`, `vaultPublic[]`, `vaultAdmin[]`, `canVaultAdmin`.

Sections (top → bottom):
1. Stats bar + Warnings & Advisories
2. Vision Model Health (isSuperAdmin)
3. OCR Model Configuration (isSuperAdmin) — model list, timeout input (10–120s), Save
4. Default Annual Fee (isSuperAdmin)
5. Association Calendar + Upcoming Events
6. Recent Members
7. File Vault — Public card (always shown to canViewAll) + Administration card (canVaultAdmin only)

**Script note**: OCR model config HTML appears after the `<script>` block → `renderModelList()` deferred via `DOMContentLoaded`. Unsaved state: Save button turns red + shows "(unsaved)" when `JSON.stringify(modelList) !== JSON.stringify(_savedModelList)`.

**Mobile calendar**: `renderAgendaMobile()` fires at the end of `renderGrid()`; builds a `.pta-agenda` list grouped by day from `_calEvents`; each row uses `CAL_COLORS` and `escH()`; clicking calls `selectDay()`. Shown at ≤640px.

**Table wrapping**: all four dashboard tables (Warnings, Vision Model Health, OCR Config, Recent Members) are wrapped in `<div class="pta-table-wrap">` for horizontal scroll on mobile.

#### `admin/members-list.ejs`
Variables: `members[]`, `search`, `feeFilter`, `sort`, `page`, `totalPages`, `total`.

Columns: Member (avatar + name) | Member ID | Email | Position | ID Type | Fee Status | Warnings | Joined | Actions

- `sort` param drives `ORDER BY` via server-side `SORT_MAP` whitelist
- `memberListUrl(overrides)` helper builds URLs preserving all active filters
- Warnings column: "No Warning" badge (success) or stacked doc-expiry badges (danger/warning)
- ID Type column: ARC / APRC (info) / TW Passport

#### `admin/member-detail.ejs`
Variables: `member` (full row), `documents[]`.

ARC/ID card:
- Card title changes: "ARC" / "APRC" / "Taiwan Passport"
- Expiry label: "Expiry date" (ARC) / "Passport Expiry" (TW Passport) / hidden (APRC)
- Validity badge: computed by `docValidity()` for ARC/Passport; `{ label: 'APRC — PERMANENT', tone: 'info' }` for APRC
- NIA button replaced with info note for APRC and TW Passport members

#### `admin/member-new.ejs` / `admin/member-edit.ejs`
Use `partials/member-form.ejs`. Variables include `defaultFee`.

`partials/member-form.ejs` ARC section:
- `.pta-seg` segmented control with `btn-check` hidden radio inputs: ARC / APRC / TW Passport
- Icons: `bi-credit-card-fill` (ARC), `bi-shield-fill-check` (APRC), `bi-passport-fill` (TW Passport)
- APRC label has no "(Permanent)" suffix — implied by the acronym
- `arcDocTypeChanged()` JS toggles: expiry label, passport label, APRC permanent badge visibility
- Selected type submitted as `residence_doc_type` → server derives `is_aprc` and `is_tw_passport`

#### `user/profile.ejs`
Single-scroll layout — no Bootstrap tabs. Variables: `member`, `documents[]`, `invites[]`, `feeReminder`, `vaultFiles[]`.

Structure: `profile-layout` CSS grid (`.profile-sidebar` + `.profile-cards`). Sections top-to-bottom: fee reminder alert (once) → member data cards → `.section-label` divider with `id="notifications"` anchor → invite list → public documents table (`.pta-table-wrap`).

Bell link in topbar (`/profile#notifications`) scrolls directly to the notifications section.

APRC members: expiry shows "Permanent (APRC)" badge.

#### `user/vault.ejs`
Variables: `files[]` (public vault only).

Table: filename + size | description | uploader name | date | download button. Empty state shown when no files.

---

## Known Constraints & Gotchas

### Deployment
- No Chromium / Puppeteer — shared hosting
- Node 18+ — global `fetch` required
- `better-sqlite3` — native; always `npm install` on server after deploy

### Package Choices
| Package | Why |
|---------|-----|
| `bcryptjs` | Pure JS — no native addon |
| `better-sqlite3` | Synchronous SQLite, embedded |
| `better-sqlite3-session-store` | Sessions in same SQLite file |
| `multer ^2.x` | Security fixes vs 1.x |
| `uuid ^11.x` | Modern ESM-compatible |

### Common Dev Issues
- **Port 3000 EADDRINUSE** → `Get-Process node | Stop-Process -Force`
- **Fee status** — never set from a form; always computed by `utils/fee.js`
- **Fee amount = 0** — `parseInt(n,10) >= 0 ? parseInt(n,10) : 300`, not `|| 300`
- **Bootstrap modal init** — lazy getter only; never `new bootstrap.Modal(...)` at parse time
- **OCR model IDs** — verify on OpenRouter before adding; wrong IDs give HTTP 400; only `:free` models are free
- **HTTPS cookies on cPanel** — requires `app.set('trust proxy', 1)` AND `NODE_ENV=production` in cPanel panel
- **Chinese filenames** — `fixFilename()` must wrap `req.file.originalname` before DB insert; busboy decodes as latin1
- **APRC members** — never compute fee status for honorary; similarly never show NIA fetch for APRC/TW Passport
- **Vault routing** — public vault routes live directly in `app.js` (not in `user.js`) to avoid the double-prefix problem from sharing the userRouter at a different mount point

---

## Default Credentials

| Field | Value |
|-------|-------|
| Email | `admin@associacao.pt` |
| Password | `admin1234` |
| Role | `super_admin` |

---

## Future: Notifications & Communication

In-app notifications live (bell, Notifications tab, event invites). Next layers:

1. **Email** — `nodemailer`. Query `event_invites WHERE notified_at IS NULL`, send, stamp `notified_at`. Attach `.ics`.
2. **SMS** — Twilio for urgent reminders.
3. **No schema changes needed for email on calendar events** — `event_invites.notified_at` already present.
