# PT Associação — Project Reference

## What This Is

A membership management web application for a Portuguese-Taiwanese association. Members have extended profiles including personal data, Taiwan ARC (Alien Resident Certificate) data, and Portuguese Cartão de Cidadão data. Deployed as a Node.js application via cPanel's "Setup Node.js App" feature.

---

## Current Status (as of 2026-06-12)

### Done
- Full Node.js + Express backend with SQLite embedded database
- Role/position system: `role` (permission) + `position` (association title) — see § Role System
- Honorary members (`position = 'honorary'`) — fee N/A, excluded from fee stats, no voting
- Member card divided into 5 sections: Personal Info, Membership Info, ARC Data, Cartão de Cidadão, Notes
- Display name throughout app: `arc_name_en` when available, falls back to `first_name + last_name`
- Address stored as two plain text fields (`address_zh` from ARC OCR, `address` English) — no dropdown picker
- Fee system: annual fee (0 or 300 TWD), date last paid, auto-computed status and validity
- Photo upload per member; document upload/download with thumbnail generation
- Session-based authentication (bcrypt), sessions persisted in SQLite
- **PT Design System** — `.pta-*` component layer on top of Bootstrap 5; full design handoff applied to all admin pages
- **Card OCR** — dual-model parallel execution via OpenRouter vision API; admin reviews merged results + model conflict highlights in modal; apply selectively
- **NIA ARC photo fetch** — server fetches Taiwan NIA captcha, admin solves it, official photo saved to profile
- **Image lightbox** — clicking card or misc doc thumbnails opens a Bootstrap modal with full-size view + download button
- **Dashboard warnings** — compact stats bar + Warnings & Advisories table (unpaid fees + expiring ARC/CC within 60 days)
- **Vision Model Health** — super_admin dashboard card; on-demand model ping; passive offline detection during scans; dismiss individual warnings
- **OCR Model Configuration** — super_admin dashboard card; live list of active models with role labels; add/remove/test any model ID; saved to `settings` table, persists across restarts
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
- **Fee label clarity** — fee-exempt / honorary members display as "Honorary Member" throughout all templates; dropdown options read "0 TWD — Honorary Member"; raw "0 TWD (Exempt)" label eliminated
- **Members list role visibility** — Position column in `members-list.ejs` now reflects system role: super_admin → "Super Admin" (gold badge), admin → "Admin" (info badge); falls back to association position for regular members
- **Honorary fee-amount zero fix** — all fee_amount parsing uses `parseInt(n,10) >= 0 ? parseInt(n,10) : 300`; the old `|| 300` falsy-zero check no longer overwrites a stored `0` with `300`
- **RFC 5987 Content-Disposition** — document view and download routes in both `admin.js` and `user.js` use `contentDispositionFilename(disposition, name)` helper; emits `filename*=UTF-8''...` for non-ASCII filenames; `res.download()` no longer used
- **Trust proxy + production cookie** — `app.set('trust proxy', 1)` added before session middleware; `cookie.secure` activates when `NODE_ENV=production`; both required for HTTPS `Secure` sessions behind cPanel's nginx reverse proxy. Set `NODE_ENV=production` in the cPanel Node.js App environment variables panel.
- **`isManagementUser(u)` helper** — in `routes/admin.js`; returns `true` when `u.position` is in `MGMT_POSITIONS`; shared by `feeWriteGuard` and `calendarWriteGuard`
- **`resolveAudience()` UNION query** — refactored from 4 separate DB calls to a single UNION query built from safe hardcoded SQL segments
- **OCR model ID validation** — `MODEL_ID_RE = /^[a-zA-Z0-9_\-/:\.]{1,120}$/` applied on `POST /admin/settings/models` and `POST /admin/ocr-test-model`; 10-second per-model cooldown (`_testCooldowns` Map) on the test route
- **`setActiveModels()` stale-status cleanup** — when the model list changes, `modelStatus` entries for removed model IDs are deleted so stale offline warnings no longer appear
- **Calendar event strips** — dashboard calendar cells show colored titled strips (`.pta-cal-strip`) instead of a dot; up to 2 strips stacked per cell; color assigned by `CAL_COLORS[event.id % 8]` (8 colors); "+N more" shown when >2 events; cells with events get `.has-events` tint + bold date number
- **New Event button guard** — only shown to `canWrite` users or management-position users (not plain gestao viewers without write access)
- **Invites route guard** — `GET /admin/events/:id/invites` uses `adminOnly` (previously only viewAll)
- **Event end_date validation** — `POST /admin/events` rejects `end_date < start_date` with a 400 flash
- **Fee reminder on Profile tab** — fee reminder alert shown on both My Profile tab and Notifications tab of `user/profile.ejs`
- **Notes card for super_admin** — Notes card on member profile gated by `canWrite && member.notes`; was previously admin-role-only
- **NIA fetch-error retry** — "Try again" button shown when NIA photo fetch fails; re-invokes `loadCaptcha()` without a page reload
- **Invite respond error handling** — `profile.ejs` fetch checks `r.ok` before parsing JSON; alerts user on error with session-expiry hint
- **ARC name hint on edit form** — `member-form.ejs` shows a blue info banner with a "Use ARC name" button when `arc_name_en` differs from stored `first_name`/`last_name`; values passed via `data-arc-first`/`data-arc-last` attributes (no JS injection); splits on last word (last word → Last Name, remainder → First Name)
- **Version v1.3** — login page subtitle + Super Admin topbar badge

### Not Yet Built
- Email notifications to members
- SMS notifications to members
- Self-service password reset (forgot password email flow)
- Member-facing document upload
- Export / reporting features

### Calendar & Notifications — Planned Extensions

#### Email delivery of event invites
The `event_invites` table has a `notified_at TEXT` column reserved for this.
When an email system is added, the mailer queries `WHERE notified_at IS NULL`, sends
one email per row, then stamps `notified_at = datetime('now')`. No schema change needed.
Suggested trigger: after `POST /admin/events` resolves the audience and inserts invite rows,
call the mailer in the background (or queue it). Attach the `.ics` file to the email so
recipients get a one-click "Add to Calendar" prompt in Apple Mail / Gmail.

#### iCal export — admin side
`GET /profile/invites/:id/export.ics` is live for members. Still to add:
- `GET /admin/events/:id/export.ics` — admin downloads a `.ics` for any event (e.g. to share
  externally or paste into a club newsletter).

#### Event location — map link
The `location` field on events is currently plain text (e.g. `"Taipei Park"`, `"AIT"`).
WIP: render it as a `https://maps.google.com/?q=<encoded>` link wherever it is displayed
(day panel in dashboard, invite card on member profile). Zero API key, zero cost — one-liner
template change. No geocoding or validation needed.

---

## Project Structure

```
PT ASSOCIACAO/
│
├── app.js                        Entry point. Wires middleware, sessions, routes. Loads .env.
│                                 Authenticated routes: GET /uploads/photos/:f, /uploads/thumbs/:f
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
│   │                             role change, audit log, OCR health check)
│   └── user.js                   All /profile/* routes (own profile + downloads)
│
├── middleware/
│   └── auth.js                   requireAuth, requireAdmin, requireSuperAdmin, requireViewAll
│
├── utils/
│   ├── fee.js                    computeFeeStatus(fee_amount, fee_last_paid) helper
│   ├── ocr.js                    OpenRouter vision API — dual-model parallel scan + health tracking
│   │                             Exports: scan, checkModels, getModelWarnings, dismissModelWarning
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
│   │   │   ├── header.ejs        HTML head, CDN links (Bootstrap + Icons + Flags + Design System),
│   │   │   │                     .pta-topbar navbar, opens <main class="pta-main">
│   │   │   ├── footer.ejs        </main>, Bootstrap JS bundle CDN
│   │   │   ├── flash.ejs         Alert banner for success/error messages
│   │   │   ├── phone-field.ejs   Reusable country dial-code picker + number input
│   │   │   └── member-form.ejs   5-section form (Personal / Membership / ARC / CC / Notes)
│   │   ├── admin/
│   │   │   ├── dashboard.ejs     .pta-statsbar + Warnings & Advisories + Vision Model Health + recent
│   │   │   ├── members-list.ejs  .pta-toolbar + .pta-filterchips + .pta-table (search, filter, paginate)
│   │   │   ├── member-detail.ejs .pta-detail sidebar+content + image lightbox + OCR modal + NIA modal
│   │   │   ├── member-new.ejs    New member form
│   │   │   ├── member-edit.ejs   Edit member form
│   │   │   └── audit-log.ejs     Paginated audit log (admin+ only)
│   │   └── user/
│   │       ├── profile.ejs       Own profile view
│   │       └── profile-edit.ejs  Edit personal info, ARC data, CC data, password
│   └── public/
│       ├── css/
│       │   ├── custom.css                    Minor Bootstrap overrides
│       │   └── ds/
│       │       ├── pt-design-system.css      Design tokens + .pta-* component styles
│       │       ├── pt-bootstrap-bridge.css   Remaps Bootstrap CSS variables to design tokens
│       │       └── azulejo-tile.svg          Background tile — referenced via relative url() in CSS
│       └── images/
│           ├── logo-emblem.svg               Brand emblem (topbar + login)
│           └── logo-wordmark.svg             Full wordmark
│
├── uploads/                      ← Runtime only. Created on startup. Not in git.
│   ├── photos/                   Member photos — served via authenticated route only
│   ├── documents/
│   └── thumbs/                   Card image thumbnails (JPEG, 200px wide) — authenticated route only
│
└── database/
    └── data.db                   ← Runtime only. Created on startup. Not in git.
```

---

## Environment Variables

Stored in `.env` in the project root. Loaded manually at startup by `app.js`. Never committed — `.gitignore` excludes it.

```
OPENROUTER_API_KEY=sk-or-v1-...        # Required for card OCR feature
SESSION_SECRET=<random 48-byte hex>    # Required — signs session cookies; generate with:
                                       # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# OPENROUTER_MODEL=nvidia/nemotron-nano-12b-v2-vl:free  # Optional: pin one model, bypasses parallel logic
```

See `.env.example` for a template. On cPanel hosting, set these in the Node.js App environment variable panel — do NOT upload `.env`.

---

## Database Schema

### `users`
Stores login credentials, permission role, and association position.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| email | TEXT UNIQUE | Case-insensitive |
| password_hash | TEXT | bcrypt, cost 10 |
| role | TEXT | `super_admin` / `admin` / `member` — controls system permissions |
| position | TEXT | Association title: `member` / `honorary` / `gestao` / `board` / `president` / `treasurer` / `secretary` |
| created_at | TEXT | ISO-8601 datetime |

### `members`
One-to-one with `users`. Stores all personal, document, and membership data.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| user_id | INTEGER FK | Cascades on user delete |
| member_id | TEXT UNIQUE | e.g. `ASSOC-0042`, app-generated |
| first_name | TEXT | |
| last_name | TEXT | |
| phone | TEXT | Optional. Stored as `"+351 912345678"` |
| address | TEXT | English address (plain text) |
| address_zh | TEXT | Chinese address — as printed on ARC card; auto-filled by OCR |
| city | TEXT | Legacy — not actively used |
| postal_code | TEXT | Legacy — not actively used |
| city_zh | TEXT | Legacy — not actively used |
| district_zh | TEXT | Legacy — not actively used |
| district_en | TEXT | Legacy — not actively used |
| address_type | TEXT | Legacy (`tw`/`other`) — not actively used |
| join_date | TEXT | ISO date |
| fee_amount | INTEGER | 0 (exempt) or 300 (TWD). Default 300 |
| fee_last_paid | TEXT | ISO date set by admin when payment received |
| fee_valid_until | TEXT | Auto-computed: fee_last_paid + 1 year |
| fee_status | TEXT | `paid` / `unpaid` / `renewal_incoming` — auto-computed, never set manually |
| notes | TEXT | Admin-only internal notes |
| photo_path | TEXT | Relative path: `uploads/photos/<file>` |
| arc_number | TEXT | Taiwan ARC UI number (e.g. `A800287833`) |
| arc_name_en | TEXT | Holder's name in Western GIVEN SURNAME order (ALL CAPS) — display name throughout app |
| arc_chinese_name | TEXT | Name in Chinese characters as on ARC card |
| arc_issue_date | TEXT | ISO date |
| arc_expiry_date | TEXT | ISO date |
| passport_number | TEXT | |
| arc_serial_number | TEXT | Reference number next to barcode on ARC back (no spaces) |
| cc_number | TEXT | Portuguese Cartão de Cidadão number |
| cc_issue_date | TEXT | **Dormant** — not shown in UI |
| cc_expiry_date | TEXT | ISO date |
| nif | TEXT | Número de Identificação Fiscal (9 digits) |
| niss | TEXT | Número de Identificação de Segurança Social (11 digits) |
| updated_at | TEXT | ISO-8601 datetime |

### `documents`
Many per member. Stores uploaded files.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| member_id | INTEGER FK | Cascades on member delete |
| file_path | TEXT | Relative path: `uploads/documents/<file>` |
| original_name | TEXT | Shown to users on download |
| mime_type | TEXT | |
| doc_type | TEXT | `arc_front` / `arc_back` / `cc_front` / `cc_back` / `misc` |
| thumb_path | TEXT | Relative path to thumbnail (nullable): `uploads/thumbs/<file>` |
| uploaded_at | TEXT | ISO-8601 datetime |

Card documents are one-per-type per member — uploading a new one replaces the existing. `misc` can accumulate freely (up to 5 at a time per upload).

### `settings`
Runtime key/value store for admin-configurable values. Accessed via `getSetting` / `setSetting` helpers in `routes/admin.js`.

| Column | Type | Notes |
|--------|------|-------|
| key | TEXT PK | Unique setting name |
| value | TEXT | Always stored as string; parse as needed |

**Current keys**:
| Key | Default | Description |
|-----|---------|-------------|
| `default_fee_amount` | `'300'` | Annual fee TWD pre-filled on new member form |
| `ocr_models` | _(absent = use hardcoded defaults)_ | JSON array of active OCR model IDs |

### `events`
Association events created by admin / SA / gestao. Displayed on the dashboard calendar widget.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| title | TEXT | Required |
| description | TEXT | Optional |
| location | TEXT | Optional — plain text (see § Planned Extensions for map link WIP) |
| start_date | TEXT | ISO date `YYYY-MM-DD` |
| end_date | TEXT | ISO date, optional (multi-day events) |
| created_by | INTEGER FK | `users.id` — cascades on delete |
| created_at | TEXT | ISO-8601 datetime |

### `event_invites`
One row per (event, user) pair. Tracks RSVP status and future email delivery state.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| event_id | INTEGER FK | `events.id` — cascades on delete |
| user_id | INTEGER FK | `users.id` — cascades on delete |
| status | TEXT | `pending` / `accepted` / `declined` |
| seen_at | TEXT | Timestamp when member first viewed the invite (for future email reminder logic) |
| responded_at | TEXT | Timestamp of last Accept / Decline action |
| notified_at | TEXT | **Reserved for email** — NULL until mailer stamps it |
| — | UNIQUE | `(event_id, user_id)` — one invite per user per event |

Indexes: `idx_ei_user (user_id)`, `idx_ei_event (event_id)`.

### `audit_log`
Append-only. No FK on `member_id` — entries survive member deletion. Capped at 2000 rows (oldest purged on each insert via `utils/audit.js`).

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| actor_id | INTEGER | User ID of whoever made the change (nullable) |
| actor_email | TEXT | Email of actor at time of action |
| member_id | INTEGER | Numeric DB id of affected member (nullable) |
| member_ref | TEXT | Human-readable snapshot: `"ASSOC-0042 João Silva"` |
| action | TEXT | Event key — see § Audit Log Actions |
| detail | TEXT | Field-level diff; filename; `role=x, position=y` for role changes |
| created_at | TEXT | ISO-8601 datetime |

---

## Role System

Two independent columns on `users`: `role` (system permission) and `position` (association title).

### Permission roles (`users.role`)

| Role | Who | Can do |
|------|-----|--------|
| `super_admin` | Association president/owner | Everything: all CRUD, role/position changes, delete any account |
| `admin` | Association staff | All member CRUD, documents, OCR, NIA photo, audit log — no role changes |
| `member` | Everyone else | Own profile only — view + edit own data, download own documents |

### Association positions (`users.position`)

| Position | Notes |
|----------|-------|
| `member` | Default |
| `honorary` | No fees, no voting, fee sections show N/A, excluded from paid/unpaid stats |
| `gestao` | Umbrella for all management positions. Grants view-all + fee-write access regardless of `role`. |
| `board` | Under gestao umbrella — same view-all + fee-write access |
| `president` | Under gestao umbrella — same view-all + fee-write access |
| `treasurer` | Under gestao umbrella — same view-all + fee-write access |
| `secretary` | Under gestao umbrella — same view-all + fee-write access |

### Middleware (`middleware/auth.js`)

```javascript
requireAuth(req, res, next)       // any session — sets currentUser, canWrite, isSuperAdmin, canViewAll
requireAdmin(req, res, next)      // super_admin | admin only
requireSuperAdmin(req, res, next) // super_admin only
requireViewAll(req, res, next)    // admin+ OR position='gestao'
```

### `res.locals` helpers (available in every authenticated template)

| Variable | Value | Use |
|----------|-------|-----|
| `currentUser` | `{ id, email, role, position }` | Identity checks |
| `canWrite` | `true` for super_admin + admin | Hide all write buttons/forms |
| `isSuperAdmin` | `true` for super_admin only | Show Role Management, Vision Model Health, OCR Model Config, Fee Config |
| `canViewAll` | `true` for admin+ OR position=gestao | Access to admin area |
| `pendingInviteCount` | integer | Count of `event_invites` rows with `status='pending'` for the current user — drives the topbar bell badge |

### Inline guards in `routes/admin.js`

```javascript
adminOnly(req, res, next)       // blocks gestao (position) on all write routes
superAdminOnly(req, res, next)  // blocks everyone but super_admin on role-change + health routes
```

---

## Fee Status Logic

Implemented in `utils/fee.js` — `computeFeeStatus(feeAmount, feeLastPaid)`.

| Condition | fee_status | Badge |
|-----------|-----------|-------|
| fee_amount = 0 | `paid` | `pta-tone-success` |
| fee_amount > 0, no date paid | `unpaid` | `pta-tone-danger` |
| Paid, valid until > 30 days away | `paid` | `pta-tone-success` |
| Paid, valid until ≤ 30 days away | `renewal_incoming` | `pta-tone-gold` |
| Paid, valid until has passed | `unpaid` | `pta-tone-danger` |

- `fee_valid_until` = `fee_last_paid` + 1 year
- `fee_status` is always computed on save — never editable directly from a form

---

## Member Card Sections

1. **Personal Info** — first name, last name, phone (dial-code picker), email, address ZH + EN (plain text), photo
2. **Membership Info** — member ID, join date, annual fee amount, last paid, valid until, fee status badge
3. **ARC Data** — ARC number, English name (`arc_name_en`), Chinese name, issue/expiry dates, passport number, serial number
4. **Cartão de Cidadão** — CC number, expiry date, NIF, NISS
5. **Notes** — free text, visible to admins only

---

## Routes Quick Reference

### Public
| Method | Path | Description |
|--------|------|-------------|
| GET | `/login` | Login page |
| POST | `/login` | Authenticate; redirect by role |
| POST | `/logout` | Destroy session |
| GET | `/` | Redirect to dashboard or profile |

### Authenticated file serving (`app.js`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/uploads/photos/:filename` | Serve member photo (requireAuth) |
| GET | `/uploads/thumbs/:filename` | Serve thumbnail (requireAuth) |

### Admin (requires gestao or higher for GET; admin+ for write routes)
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/admin` | viewAll | Dashboard |
| GET | `/admin/members` | viewAll | Member list |
| GET | `/admin/members/new` | adminOnly | New member form |
| POST | `/admin/members` | adminOnly | Create member + user account |
| GET | `/admin/members/:id` | viewAll | Member detail view |
| GET | `/admin/members/:id/edit` | adminOnly | Edit form |
| POST | `/admin/members/:id` | adminOnly | Update member |
| POST | `/admin/members/:id/delete` | adminOnly | Delete member |
| POST | `/admin/members/:id/change-role` | superAdminOnly | Change account role + position |
| POST | `/admin/members/:id/set-password` | superAdminOnly | Set a new password for the member; body `{ new_password, confirm_password }`; min 6 chars; hashed with bcryptjs |
| POST | `/admin/members/:id/documents` | adminOnly | Upload misc documents (up to 5) |
| POST | `/admin/members/:id/documents/card` | adminOnly | Upload card image; auto-runs OCR; returns `{ extracted }` JSON |
| POST | `/admin/members/:id/documents/:docId/ocr` | adminOnly | Re-run OCR on stored card; returns `{ extracted }` JSON |
| POST | `/admin/members/:id/apply-card-fields` | adminOnly | Apply OCR-extracted fields; returns JSON |
| POST | `/admin/members/:id/documents/:docId/delete` | adminOnly | Delete a document |
| GET | `/admin/members/:id/documents/:docId/view` | viewAll | Serve document inline (lightbox) |
| GET | `/admin/members/:id/documents/:docId/download` | viewAll | Download a document |
| GET | `/admin/members/:id/arc-captcha` | adminOnly | Fetch NIA captcha (base64 + session token) |
| POST | `/admin/members/:id/arc-fetch-photo` | adminOnly | Validate captcha + call NIA + save photo |
| POST | `/admin/ocr-health-check` | superAdminOnly | Ping all active OCR models; returns `{ warnings }` |
| POST | `/admin/ocr-dismiss-warning` | superAdminOnly | Body `{ model }` — clears in-memory model warning |
| POST | `/admin/ocr-test-model` | superAdminOnly | Body `{ model }` — ping one model ID; returns `{ ok, error? }` |
| POST | `/admin/settings/fee` | superAdminOnly | Body `{ fee_amount }` — save default annual fee to settings table |
| POST | `/admin/settings/models` | superAdminOnly | Body `{ models[] }` — save OCR model list to settings table |
| GET | `/admin/audit` | adminOnly | Audit log (paginated 50/page, newest first) |

### Calendar / Events (requires canViewAll for reads; calendarWriteGuard for writes)
| Method | Path | Guard | Description |
|--------|------|-------|-------------|
| GET | `/admin/events/data` | viewAll | JSON — events for `?year=&month=`; includes invite/accepted/declined counts |
| POST | `/admin/events` | calendarWrite | Create event; body `{ title, start_date, end_date?, location?, description?, audience[] }`; validates `end_date >= start_date`; resolves audience via UNION query → inserts invite rows in same transaction |
| POST | `/admin/events/:id/delete` | calendarWrite | Delete event + all invites; SA can delete any, others own only |
| GET | `/admin/events/:id/invites` | adminOnly | JSON — all invitees for an event with status + display name; grouped by status server-side |

`calendarWriteGuard` allows `admin`, `super_admin`, and all `MGMT_POSITIONS` (gestao / board / president / treasurer / secretary).

### Member (requires login, own data only)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/profile` | Own profile view — My Profile tab; accepts `?tab=notifications` to open Notifications tab |
| GET | `/profile/edit` | Edit: personal info, ARC data, CC data, password |
| POST | `/profile` | Save own profile changes |
| GET | `/profile/documents/:docId/view` | Serve own document inline |
| GET | `/profile/documents/:docId/download` | Download own document (ownership verified) |
| GET | `/profile/invites/:id/export.ics` | Download RFC 5545 `.ics` for one invite (ownership verified) |
| POST | `/profile/invites/:id/respond` | Body `{ action: 'accepted'|'declined' }` — updates invite status; returns `{ ok, status }` JSON |

---

## Card OCR Feature

### Overview
Admin uploads a card image (JPEG/PNG/WebP, max 5 MB). Server sends it to two OpenRouter vision LLMs in parallel. Results are merged — first non-empty value wins; conflicts surfaced for admin to resolve. Admin reviews in Before/After modal and selectively applies fields.

### Card Types and Fields
| doc_type | Card face | Fields extracted |
|----------|-----------|-----------------|
| `arc_front` | Taiwan ARC — front | `arc_number`, `arc_name_en`, `arc_chinese_name`, `arc_issue_date`, `arc_expiry_date`, `passport_number`, `address_zh` |
| `arc_back` | Taiwan ARC — back | `arc_serial_number` |
| `cc_front` | Portuguese CC — front | `cc_number`, `cc_expiry_date` |
| `cc_back` | Portuguese CC — back | `nif`, `niss` |

### Implementation (`utils/ocr.js`)
- Pure HTTP to `https://openrouter.ai/api/v1/chat/completions`
- Image base64-encoded, sent as inline data URL
- Four distinct per-type prompts in `PROMPTS`
- **Dual-model parallel execution**: first two entries in `_activeModels` run simultaneously via `Promise.allSettled`
- **Merge logic**: first non-empty value wins; `_conflicts: { field: [valA, valB] }` when both differ
- **Fallback**: if either parallel slot is rate-limited (429), third model substituted
- **In-memory health tracking**: non-429 errors mark model as offline; cleared on successful call
- `OPENROUTER_MODEL` env var pins one model (bypasses all parallel/fallback logic)
- Markdown code fences stripped before `JSON.parse`

### Active model list (runtime-configurable)
`_activeModels` in `ocr.js` is mutable. On startup, `routes/admin.js` reads `ocr_models` from the `settings` table and calls `setActiveModels()`. Hardcoded defaults (`DEFAULT_VISION_MODELS`) apply if the setting is absent.

| # | Model ID | Role |
|---|----------|------|
| 1 | `nvidia/nemotron-nano-12b-v2-vl:free` | Primary (fast, reliable) |
| 2 | `nex-agi/nex-n2-pro:free` | Secondary parallel |
| 3 | `moonshotai/kimi-k2.6:free` | Fallback on 429 |

**Do not swap models without first verifying the exact model ID on OpenRouter.** Invalid IDs return HTTP 400 and create false "Offline" warnings. Use the dashboard "Test" button before adding any new model.

### `utils/ocr.js` exports
| Export | Description |
|--------|-------------|
| `scan(docType, imagePath)` | Run OCR; returns extracted fields + optional `_conflicts` |
| `checkModels()` | Ping all active models; update in-memory health store; return warnings |
| `getModelWarnings()` | Return current in-memory warning array |
| `dismissModelWarning(modelId)` | Clear a warning entry |
| `getActiveModels()` | Return current `_activeModels` copy |
| `setActiveModels(models)` | Replace active list; falls back to defaults if empty/invalid; clears stale `modelStatus` entries for removed models |
| `testModel(modelId)` | Ping one model; returns `{ ok: bool, error?: string }` |

### Post-processing
- `arc_serial_number`: spaces stripped — models hallucinate a space between letter prefix and digits (e.g. "F 230502164" → "F230502164")
- `arc_name_en`: prompts instruct models to convert ARC SURNAME-FIRST to Western GIVEN-FIRST format

### Prompt notes
- **arc_front — Chinese name**: on the same row as the UI No., immediately after the alphanumeric code
- **arc_front — address**: under "居留地址 Residence address" label at card bottom
- **arc_front — name order**: ARC prints SURNAME GIVEN; prompt instructs reorder to GIVEN SURNAME
- **arc_back serial**: reference number to the RIGHT of barcode at the very TOP — NOT MRZ, NOT 舊式統一證號
- **cc_front dates**: printed DD MM YYYY — prompt converts to YYYY-MM-DD
- **cc_back NISS**: some card generations print `X` — prompt returns `""` in that case

### OCR Review Modal (`member-detail.ejs`)
- `CARD_FIELDS` per-type field list — shows all expected fields even when empty
- Row states: `table-success` (new data), `table-warning` (differs from saved), `table-info` + `?` badge (models disagreed)
- Conflicted fields show a `<select>` dropdown (Model A / Model B) — `data-value` on checkbox updates live
- Per-field checkbox (pre-checked), Accept All / Reject All buttons
- On submit, only checked fields POSTed to `apply-card-fields` (validated against ALLOWED list server-side)

---

## Key Behaviours

### Authentication & Authorisation
- Session-based. Sessions live in SQLite via `better-sqlite3-session-store`.
- `requireAuth` sets `res.locals` helpers for every authenticated page.
- Admin router mounted with `requireViewAll` — gestao (position) can view, write routes have `adminOnly` inline.
- All queries in `routes/user.js` scope to `WHERE user_id = req.session.userId`.

### Login Brute-Force Protection (`routes/auth.js`)
- In-memory `Map` keyed by `req.ip` — no extra packages.
- 5 failed attempts within 15 minutes → IP blocked for 15 minutes.
- Successful login clears the counter. Stale entries purged every 30 minutes.
- **Resets on server restart** — intentional (shared hosting).

### Audit Log
- Table: `audit_log` — no FK on `member_id`, entries survive member deletion.
- Hard cap: 2000 rows. `writeAudit()` uses a transaction to insert + trim atomically.
- **No UPDATE or DELETE routes** — append-only by design.

| Action key | When |
|-----------|------|
| `member.created` | Admin creates a new member |
| `member.updated` | Admin saves member edit form (detail = field diff) |
| `member.deleted` | Admin deletes a member |
| `member.role_changed` | Super-admin changes role/position |
| `member.password_reset` | Super-admin sets a new password for a member |
| `member.card_uploaded` | Card image uploaded |
| `member.doc_uploaded` | Misc document(s) uploaded |
| `member.doc_deleted` | Document deleted |
| `member.ocr_applied` | OCR-extracted fields applied |
| `member.nia_photo_saved` | NIA photo fetched and saved |
| `profile.self_updated` | Member edits own profile (detail = field diff) |
| `settings.fee_changed` | Super-admin changes default annual fee (detail = new value) |
| `settings.models_changed` | Super-admin saves OCR model list (detail = comma-separated IDs) |
| `event.created` | Admin/gestao creates a calendar event (detail = title, date, invite count) |
| `event.deleted` | Admin/gestao deletes an event (detail = title, date) |

### File Uploads
- **Photos**: JPEG/PNG/WebP, max 2 MB → `uploads/photos/`
- **Card images**: JPEG/PNG/WebP, max 5 MB → `uploads/documents/`; thumbnails (200px wide JPEG) → `uploads/thumbs/`. One per type per member — uploading replaces existing.
- **Misc documents**: PDF/Word/images/text, max 10 MB each, up to 5 at a time → `uploads/documents/`
- Filenames: `{timestamp}-{uuid}.ext` — original filename NOT used on disk
- **Photos and thumbs served via `requireAuth` routes** — not `express.static`
- Documents served via authenticated download routes (ownership verified)

### Member IDs
Format: `ASSOC-XXXX` (zero-padded 4 digits). `nextMemberId()` called **inside** the create transaction.

### DB Migrations (startup checks in `database/db.js`)
1. `needsRebuild` — if `fee_amount` or `renewal_incoming` absent → full rebuild
2. Users role migration — if `super_admin` absent → recreate, mapping `admin→super_admin`, `user→member`
3. `ALTER TABLE … ADD COLUMN` for multiple columns — existence check first
4. `settings` table — `CREATE TABLE IF NOT EXISTS settings (key TEXT PK, value TEXT)` — always runs safely
- Pattern: check → migrate in transaction → recreate indexes
- Never use `db.exec` with multiple statements

### Flash Messages
`req.session.flash = { type: 'success'|'danger', message }` before redirect. Consumed once, rendered by `partials/flash.ejs`.

### cPanel Deployment (HostArmada / LiteSpeed)
- Entry point: `app.js`. Port: `process.env.PORT`.
- All file paths use `process.cwd()`.
- Do NOT upload `node_modules/`, `uploads/`, `database/data.db`, or `.env`.
- Set `OPENROUTER_API_KEY`, `SESSION_SECRET`, and **`NODE_ENV=production`** as environment variables in the Node.js App panel.
- `NODE_ENV=production` is required for `cookie.secure: true`; combined with `app.set('trust proxy', 1)` this enables HTTPS-only session cookies behind cPanel's nginx reverse proxy.

**Deploy workflow (after every git push):**
1. cPanel Terminal (or Git panel): `git pull` in `/home/chiangly/repositories/PT-ASSOCIACAO/`
2. `npm install` (only needed when `package.json` changes)
3. Find the running process PID: open `https://associacao.poetico.co/node-check.php?token=ptassoc-diag-2024`
4. Kill it: `https://associacao.poetico.co/node-kill.php?token=ptassoc-diag-2024&pid=XXXX`
5. cPanel → Node.js Selector → **Start**

**Why this is needed:** HostArmada runs Node via LiteSpeed's `lsnode` process manager. The "Stop" button in the Node.js panel does not always terminate the running process — it can be orphaned (PPID=1). The kill step ensures the stale process is gone before starting fresh.

**PID changes every restart** — always check before killing. `node-kill.php` and `node-check.php` are gitignored and must be uploaded manually to `public_html/` (not to the app directory). Delete them from the server when not actively debugging.

**`database/data.db` survives normal deploys** (it is gitignored and `git pull` does not touch it). It is only lost if the entire application directory is deleted from cPanel. Back up `data.db` via cPanel File Manager periodically.

---

## NIA ARC Photo Fetch

Implemented in `routes/admin.js`. Uses Node's built-in `fetch` (Node 18+).

### Flow
1. Admin clicks **"Fetch NIA Photo"** button (in sidebar profile card, under the member's photo)
2. Server calls NIA `GET /api/captcha` → captcha image + `JSESSIONID`; stored server-side (5-min TTL)
3. Captcha shown in modal; admin types answer
4. Server validates captcha: fail → reload; pass → search
5. Server calls NIA `POST /api/search` with ARC fields + captcha
6. `rcode: "0000"` → photo saved, `photo_path` updated, page reloads
7. `rcode: "0301"` → "No matching record found" error

### NIA API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/icinfo-frontend/api/captcha?{ts}` | Get captcha image + JSESSIONID |
| GET | `/icinfo-frontend/api/captcha/{answer}/validation` | Validate captcha |
| POST | `/icinfo-frontend/api/search` | Submit ARC data; returns `{ rcode, message, data: { image } }` |

POST body: `{ "uino": "...", "issueDate": "YYYY-MM-DD", "expiryDate": "YYYY-MM-DD", "serialNo": "...", "captcha": "..." }`

---

## Frontend Design System

### Load order (must be preserved in `header.ejs`)
```
Bootstrap 5.3.3 CSS (CDN, SRI hash)
Bootstrap Icons 1.11.3 (CDN, SRI hash)
Flag Icons 7.2.3 (CDN, SRI hash)
/css/custom.css
/css/ds/pt-design-system.css
/css/ds/pt-bootstrap-bridge.css
```

`login.ejs` is standalone — loads its own CDN links + design system CSS without using `header.ejs`.

### Layout shell
Every authenticated page:
```
header.ejs → <main class="pta-main">  [flash]  [content]
footer.ejs → </main>
```

### Page Inventory

#### `login.ejs`
Standalone. `.pta-login` > `.pta-login__card` > `.pta-login__brand` (logo) + flash + `.pta-login__form`.

#### `admin/dashboard.ejs`
Variables: `stats { total, honorary, paid, unpaid }`, `warnings[]`, `recent[]`, `modelWarnings[]`, `activeModels[]`, `defaultFee` (last three: super_admin only).

- `.pta-pagehead` — title + "New Member" button (canWrite)
- `.pta-card.pta-card--flush` > `.pta-statsbar` — 4 `.pta-stat` tiles: Total / Paid / Unpaid / Honorary
- **Warnings & Advisories** card — `.pta-table` with fee/ARC/CC columns; count badge
- **Vision Model Health** card (isSuperAdmin) — model status table; "Run Check" AJAX; per-row dismiss. All DOM uses `createElement`/`textContent` — no innerHTML with untrusted data.
- **OCR Model Configuration** card (isSuperAdmin) — JS-rendered model list (`modelConfigRows` tbody populated by `renderModelList()` via `DOMContentLoaded`); per-model Test (AJAX) + Remove; Add Model input + Test + Add; Save button → `POST /admin/settings/models`.
- **Default Annual Fee** card (isSuperAdmin) — number input pre-filled with `defaultFee`; Save → `POST /admin/settings/fee`; also retroactively updates `fee_amount` for all `fee_status='unpaid'` non-honorary members; flash message reports how many were updated.
- **Association Calendar** card (all canViewAll) — month grid (Mon–Sun, EU week); AJAX loads `/admin/events/data`; today highlighted; cells with events get `.has-events` class (light blue tint + bold date number); per-day up to 2 colored `.pta-cal-strip` title strips stacked from bottom (color = `CAL_COLORS[event.id % 8]`); "+N more" strip when >2 events; click day → event panel below grid; "New Event" button (canWrite or management position) opens modal; per-event attendee toggle (fetches `/admin/events/:id/invites`); delete button (ownership enforced server-side).
  - **New Event modal** — title, start/end date, location, description, audience checkboxes (All / Paid / Unpaid / Honorary / Non-Honorary); closes automatically on success via `bootstrap.Modal.getOrCreateInstance(...).hide()`.
- **Recent Members** card — last 5 joins

**Note on script timing**: the OCR model config HTML card appears *after* the `<script>` block in the source, so `renderModelList()` is deferred with a `DOMContentLoaded` guard.

#### `admin/members-list.ejs`
Variables: `members[]`, `search`, `feeFilter`, `page`, `totalPages`, `total`.

- `.pta-pagehead` — member count + "New Member" (canWrite)
- `.pta-toolbar` — `.pta-search` (GET form, preserves fee filter in hidden input) + `.pta-filterchips` (All / Paid / Renewal / Unpaid)
- `.pta-card.pta-card--flush` > `.pta-table` — clickable rows; avatar initials + namecell; fee badge; pagination
- **Position column** — shows system role when elevated: `super_admin` → "Super Admin" (gold badge), `admin` → "Admin" (info badge); falls back to association position for `role=member` rows. Query selects `u.role as user_role`.

#### `admin/member-detail.ejs`
Variables: `member` (full row + `user_role`, `user_position`, `account_created`), `documents[]`.

Layout: `.pta-pagehead` (back link + name + edit button) → `.pta-detail` (sidebar + content)

**Sidebar**:
- Profile card: `.pta-avatar--xl` (photo or initials), name, fee badge or "Honorary Member", **Fetch NIA Photo button** (canWrite)
- Account Settings panel (isSuperAdmin): role select + position select; below a `<hr>`, a separate password reset form (`POST /admin/members/:id/set-password`) with new + confirm inputs; client-side mismatch alert + confirm dialog before submit
- NIA Photo modal: if the fetch fails, a "Try again" button appears (id `arcRetryBtn`) that re-invokes `loadCaptcha()` without a page reload
- Danger Zone (canWrite): delete form

**Content column** (6 cards):
1. Contact — phone, email, address fields
2. Membership & Fees — member ID, dates, fee; Update Payment form (canViewAll && !isHonorary)
3. ARC (eyebrow: "Alien Resident Certificate") — 7 fields + expiry validity badge
4. Cartão de Cidadão (eyebrow: "Portuguese ID") — 4 fields + expiry validity badge
5. Notes
6. Documents — `.pta-docslots` (4 card slots) + misc list + upload form

Three modals: Image Lightbox, OCR Review, NIA Photo — all lazy-inited Bootstrap modals.

#### `admin/member-new.ejs` / `admin/member-edit.ejs`
Variables: `errors[]`, `data`, `countries`, `defaultFee`. Use `partials/member-form.ejs`.

New member form (`GET /admin/members/new`) pre-fills `data` with:
- `email`: `membro.XXXX@associacao.pt` (random 4-char alphanumeric suffix)
- `first_name`: `Novo`
- `last_name`: `Membro XXXX`
- `fee_amount`: value from `settings.default_fee_amount`

`partials/member-form.ejs` fee dropdown is dynamic — shows `v.fee_amount` (if non-zero) or `defaultFee` as the non-zero option. Both new and edit routes must pass `defaultFee` to `res.render()`.

#### `admin/audit-log.ejs`
Variables: `logs[]`, `page`, `totalPages`, `total`. Paginated 50/page, newest first.

#### `user/profile.ejs`
Variables: `member`, `documents[]`, `invites[]`, `feeReminder` (string or null), `activeTab` (`'profile'` or `'notifications'`).

Two Bootstrap tabs:
- **My Profile** — existing read-only member data (personal, membership, ARC, CC, notes, documents); fee reminder alert shown here too (if unpaid/renewal_incoming and not honorary)
- **Notifications** — fee reminder alert (if unpaid/renewal_incoming and not honorary); pending invite cards with Accept / Decline / Add to Calendar buttons; previous responses list (accepted shows calendar icon, declined does not); fetch errors surface an alert with session-expiry hint

The `GET /profile` route always loads both tabs' data. Pass `?tab=notifications` to auto-activate the Notifications tab (used by the topbar bell link).

#### `user/profile-edit.ejs`
4 editable sections: Personal Info, ARC Data, Cartão de Cidadão, Change Password.

---

## Known Constraints & Gotchas

### Deployment
- **No Chromium / Puppeteer** — shared hosting
- **Node 18+** — global `fetch` required
- **`better-sqlite3`** — native compilation; always `npm install` on server

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
- **Fee amount = 0** — use `parseInt(n,10) >= 0 ? ... : 300`, not `|| 300`; honorary members store `0` and it must not be silently replaced with `300`
- **Bootstrap modal init** — lazy getter only; never `new bootstrap.Modal(...)` at parse time
- **OCR model IDs** — verify on OpenRouter before adding; wrong IDs give HTTP 400
- **HTTPS cookies on cPanel** — requires `app.set('trust proxy', 1)` in `app.js` AND `NODE_ENV=production` in the cPanel App panel; without both, session cookies will not be flagged `Secure`

---

## Default Credentials (change immediately)

| Field | Value |
|-------|-------|
| Email | `admin@associacao.pt` |
| Password | `admin1234` |
| Role | `super_admin` |

---

## Future: Notifications & Communication

In-app notifications are live (bell icon, Notifications tab, event invites). Next layers:

1. **Email** — add `nodemailer`. For calendar events: query `event_invites WHERE notified_at IS NULL`, send, stamp `notified_at`. Attach `.ics` file so recipients get a one-click "Add to Calendar" prompt. Other trigger points: member creation, fee renewal reminder, document upload.
2. **SMS** — add Twilio or equivalent for urgent fee/event reminders.
3. **No extra schema needed for email/SMS on calendar events** — `event_invites.notified_at` column is already present. For non-event notifications (system messages, fee alerts), a separate `notifications` table may be added later.
