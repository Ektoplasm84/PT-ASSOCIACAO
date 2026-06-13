# Handoff: PT Associação — Design System Integration

> **For:** Claude Code working in the `Ektoplasm84/PT-ASSOCIACAO` repo (Express + EJS + Bootstrap 5.3).
> **Goal:** Apply the approved PT Associação visual identity (verde / ouro / vermelho palette, Space Grotesk display type, deeper putty background, azulejo login) to the existing app.

---

## ⭑⭑ Revision 4 — START HERE · verified against the live repo, stage by stage

> R4 is a **reconciliation pass** verified against `Ektoplasm84/PT-ASSOCIACAO@main`. The app uses **Express + EJS + Bootstrap 5.3** (`npm run dev`). No build step — files go straight into `express.static`. **Ignore Revision 3 and below entirely** — they are kept for historical reference only.

### Execution order

**Do these steps in sequence. Restart `npm run dev` once after Step 3, then verify after each markup stage.**

| Step | What | Where |
|---|---|---|
| **1** | Copy bundle assets | See table below |
| **2** | Add `--vermelho-500` token alias inside `:root{}` | `pt-design-system.css` |
| **3** | Paste the Consolidated CSS block at the END of the file | `pt-design-system.css` |
| **4** | Restart server → verify fast-path (branded shell, copper login) | `npm run dev` |
| **5–12** | Apply markup changes stage by stage, running each stage's ✅ checklist | See stages below |

### Bundle assets — copy these first

| Bundle file | Repo destination | Notes |
|---|---|---|
| `assets/logo-emblem.png` | `frontend/public/images/logo-emblem.png` | Replaces `logo-emblem.svg` |
| `assets/logo-full.jpg` | `frontend/public/images/logo-full.jpg` | Full lockup — emails/share |
| `css/azulejo-tile.svg` | `frontend/public/css/ds/azulejo-tile.svg` | Replaces the green tile |

### Consolidated CSS — paste all at once at the END of `pt-design-system.css`

> Copy this entire block and append it to `pt-design-system.css`. Individual stage sections explain each rule; this block saves you hunting.

```css
/* ============================================================
   R4 — Consolidated additions to pt-design-system.css
   Paste at the END of the file so these rules win the cascade.
   ============================================================ */

/* ── Stage 1 · fluid desktop + responsive shell ── */
.pta-main{ max-width:none; margin:0; padding:var(--space-6) clamp(var(--space-5),3.5vw,var(--space-9)) var(--space-9); }
.pta-nav__item{ white-space:nowrap; }
@media (max-width:768px){
  .pta-topbar{ gap:var(--space-3); padding:0 var(--space-4); height:56px; }
  .pta-topbar__right{ gap:var(--space-2); }
  .pta-brand__sub{ display:none; }
  .pta-user__email{ display:none; }
  .pta-nav{ position:fixed; left:0; right:0; bottom:0; height:auto; gap:0;
    justify-content:space-around; z-index:var(--z-sticky); background:var(--surface-inverse);
    border-top:3px solid var(--gold-400); padding:6px 0 calc(6px + env(safe-area-inset-bottom));
    box-shadow:0 -6px 18px rgba(0,0,0,.18); }
  .pta-nav__item{ flex:1; flex-direction:column; gap:3px; height:auto; padding:6px 4px;
    min-height:52px; font-size:var(--text-2xs); line-height:1.1; border-bottom:none;
    margin-bottom:0; border-top:3px solid transparent; margin-top:-3px; text-align:center; }
  .pta-nav__item .bi{ font-size:1.35em; }
  .pta-nav__item.is-active{ border-top-color:var(--gold-400); }
  .pta-main{ padding:var(--space-5) var(--space-4) calc(var(--space-9) + 64px + env(safe-area-inset-bottom)); }
  .pta-statsbar{ grid-template-columns:repeat(2,1fr); }
  .pta-statsbar > div:nth-child(2){ border-right:none; }
  .pta-statsbar > div:nth-child(1),.pta-statsbar > div:nth-child(2){ border-bottom:1px solid var(--border-subtle); }
}
@media (max-width:480px){ .pta-brand__name{ display:none; } }

/* ── Stage 1b · logo emblem rounding ── */
.pta-brand img{ border-radius:9px; }
.pta-login__brand img{ border-radius:18px; }

/* ── Stage 2 · charcoal + copper login (replaces the green-azulejo .pta-login block) ── */
.pta-login{
  min-height:100vh; display:flex; align-items:center; justify-content:center; position:relative;
  background:
    url(azulejo-tile.svg) center top / 220px 220px repeat,
    radial-gradient(85% 65% at 50% 32%, rgba(192,99,43,0.20), rgba(192,99,43,0) 58%),
    radial-gradient(130% 95% at 50% -10%, #353330, #141312);
  background-color:#141312; padding:var(--space-5);
}
.pta-login::before{ content:""; position:absolute; inset:0; pointer-events:none;
  background:radial-gradient(72% 56% at 50% 42%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.55) 100%); }
.pta-login .pta-btn{ background:#C0632B; }
.pta-login .pta-btn:hover{ background:#A8531F; }
.pta-login .pta-btn:active{ background:#8F4517; }

/* ── Stage 3 · dashboard mobile ── */
.pta-table-wrap{ overflow-x:auto; -webkit-overflow-scrolling:touch; }
.pta-agenda{ display:none; flex-direction:column; }
@media (max-width:640px){
  .pta-cal-grid, .pta-cal-hd{ display:none; }
  .pta-agenda{ display:flex; }
}
.pta-agenda__day{ display:flex; gap:14px; padding:11px 0; border-bottom:1px solid var(--border-subtle); }
.pta-agenda__day:last-child{ border-bottom:none; }
.pta-agenda__date{ flex:none; width:46px; text-align:center; }
.pta-agenda__dnum{ font-family:var(--font-display); font-weight:600; font-size:21px; color:var(--text-strong); line-height:1; }
.pta-agenda__dow{ font-size:10px; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); margin-top:3px; }
.pta-agenda__date.is-today .pta-agenda__dnum{ color:#fff; background:var(--green-600); border-radius:8px; display:inline-block; padding:3px 0; width:34px; }
.pta-agenda__evs{ flex:1; display:flex; flex-direction:column; gap:6px; min-width:0; }
.pta-agenda__ev{ display:flex; align-items:stretch; gap:9px; padding:7px 10px; border-radius:8px; background:var(--stone-50); }
.pta-agenda__bar{ width:3px; border-radius:2px; flex:none; }
.pta-agenda__txt{ min-width:0; }
.pta-agenda__t{ font-weight:600; font-size:13px; color:var(--text-strong); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pta-agenda__m{ font-size:11px; color:var(--text-muted); }

/* ── Stage 4 · section label + profile layout ── */
.section-label{ font-size:var(--text-xs); font-weight:700; letter-spacing:.1em; text-transform:uppercase;
  color:var(--text-muted); margin:1.75rem 0 .75rem; display:flex; align-items:center; gap:.5rem; }
.profile-layout{ display:grid; grid-template-columns:200px 1fr; gap:var(--space-6); align-items:start; }
.profile-sidebar{ display:flex; flex-direction:column; gap:var(--space-4); }
.profile-cards{ display:grid; grid-template-columns:1fr 1fr; gap:var(--space-4); }
.profile-cards .full{ grid-column:1/-1; }
@media (max-width:768px){
  .profile-layout{ grid-template-columns:1fr; }
  .profile-cards{ grid-template-columns:1fr; }
  .profile-sidebar{ flex-direction:row; align-items:center; }
}

/* ── Stage 5 · members toolbar wraps on mobile ── */
@media (max-width:640px){
  .pta-toolbar{ flex-wrap:wrap; }
  .pta-filterchips{ margin-left:0; width:100%; }
}

/* ── Stage 6 · member detail mobile ── */
@media (max-width:768px){ .pta-detail{ grid-template-columns:1fr; } }
@media (max-width:520px){ .pta-docslots{ grid-template-columns:repeat(2,1fr); } }
```

> **`--vermelho-500` token alias (Step 2 above):** find the `:root{}` block near the top of `pt-design-system.css` — it already has `--brand`, `--color-success`, `--color-danger`, `--color-warning`, `--border`. Add this line alongside them:
> ```css
> --vermelho-500: var(--crimson-500);
> ```
> Do **not** paste it outside `:root{}` — CSS custom properties in `:root` only.

### Out-of-scope views (not covered by R4)
These files exist but were not part of this reconciliation pass — apply Bridge styling (already linked) and leave as-is for now:
- `user/profile-edit.ejs` — member self-edit form
- `views/error.ejs` / `views/404.ejs` — error pages

---

### Stage 1 — Global shell & responsive layout  ✅ verified `@main`

**What the shell actually is now** (it has drifted from R3's snippets — these are the source of truth):

- **`partials/header.ejs` is a full document**, not a fragment. It emits `<!DOCTYPE html>` → `<html lang="pt">` → `<head>` (with `<meta name="viewport" content="width=device-width, initial-scale=1">` ✅) → opens `<body>`, the topbar, and `<main class="pta-main">`. Stylesheet order is correct, with **flag-icons added**:
  `bootstrap → bootstrap-icons → flag-icons → /css/custom.css → /css/ds/pt-design-system.css → /css/ds/pt-bootstrap-bridge.css`
- **Topbar** (`.pta-topbar`) now carries, beyond R3:
  - a **Documents/Vault** nav item (`/vault`, `bi-archive-fill`) on the admin nav;
  - a **separate member (non-admin) nav** — *My Profile* + *Documents*;
  - the **Super Admin badge with an inline `v1.3` version tag**;
  - a **server-logs console button** (super-admin only): `<button class="pta-topbar__bell pta-console-toggle" id="pta-console-btn">` with `bi-terminal-fill`, which `window.open()`s `/admin/logs` as a 960×520 popup (inline script at the bottom of the partial);
  - an **edit-profile pencil** (`/profile/edit`) for `role === 'member'`;
  - nav highlighting via a computed `_navActive` (`title` → `dashboard`/`members`/`vault`/`audit`), gated on `canViewAll` / `canWrite`.
- **`partials/footer.ejs`** closes `</main>`, loads the Bootstrap JS bundle, and contains an **Escudos easter egg** — clicking a `.js-esc-twd` label 5× toggles the annual fee into Portuguese escudos (`1.769$00`, period thousands-separator, `1 EUR = 200.482 PTE`).
- **`custom.css`** is already trimmed to the R2 target (only `.bg-honorary` / `.text-honorary`, bound to `--violet-500`). No off-brand hexes remain. ✅

> All of the above is **intentional and stays.** The console button, escudos egg, flag-icons, and version tag are keepers — the CSS below leaves their markup untouched and only adjusts layout/visuals.

**Two layout problems to fix — paste this block at the end of `pt-design-system.css`:**

1. *Desktop is locked to a 1180px centered column* (`.pta-main{max-width:var(--content-max);margin:0 auto}`). Target: **fully fluid, edge-to-edge with comfortable side padding.**
2. *No responsive treatment at all* — the topbar overflows on phones (the whole DS ships only 2 media queries). Target: **slim topbar + an app-style bottom tab bar** built from the existing `.pta-nav` markup (no EJS change).

```css
/* ============================================================
   R4 · Stage 1 — fluid desktop + responsive shell
   Paste at the END of pt-design-system.css so it wins the cascade.
   No markup changes: the bottom tab bar reuses the existing
   .pta-nav / .pta-nav__item structure from header.ejs.
   ============================================================ */

/* — Desktop: fill the viewport, drop the centered cap — */
.pta-main{
  max-width: none;
  margin: 0;
  padding: var(--space-6) clamp(var(--space-5), 3.5vw, var(--space-9)) var(--space-9);
}
.pta-nav__item{ white-space: nowrap; }   /* keep "Audit Log" on one line */

/* — Tablet / phone — */
@media (max-width: 768px){
  /* Slim the topbar, shed low-value text */
  .pta-topbar{ gap: var(--space-3); padding: 0 var(--space-4); height: 56px; }
  .pta-topbar__right{ gap: var(--space-2); }
  .pta-brand__sub{ display: none; }          /* "Luso · Taiwanese" */
  .pta-user__email{ display: none; }         /* email is in the profile page */

  /* Nav → fixed app-style bottom tab bar (same markup, restyled) */
  .pta-nav{
    position: fixed; left: 0; right: 0; bottom: 0;
    height: auto; gap: 0;
    justify-content: space-around;
    z-index: var(--z-sticky);
    background: var(--surface-inverse);
    border-top: 3px solid var(--gold-400);
    padding: 6px 0 calc(6px + env(safe-area-inset-bottom));
    box-shadow: 0 -6px 18px rgba(0,0,0,.18);
  }
  .pta-nav__item{
    flex: 1; flex-direction: column; gap: 3px;
    height: auto; padding: 6px 4px; min-height: 52px;   /* ≥44px touch target */
    font-size: var(--text-2xs); line-height: 1.1;
    border-bottom: none; margin-bottom: 0;
    border-top: 3px solid transparent; margin-top: -3px; /* gold indicator moves to top edge */
    text-align: center;
  }
  .pta-nav__item .bi{ font-size: 1.35em; }
  .pta-nav__item.is-active{ border-top-color: var(--gold-400); }

  /* Clear the fixed bar so page content isn't hidden behind it */
  .pta-main{
    padding: var(--space-5) var(--space-4)
             calc(var(--space-9) + 64px + env(safe-area-inset-bottom));
  }
}

/* — Small phones: reclaim space in the topbar — */
@media (max-width: 480px){
  .pta-brand__name{ display: none; }   /* emblem alone stands in for the lockup */
}
```

**Verify after pasting:**
- Wide desktop (≥1600px): content fills the width with even side padding — no narrow centered column.
- Phone (≤768px): top nav disappears from the topbar and reappears as a green bottom bar with gold-topped active item; tapping a tab navigates; nothing is hidden behind the bar; the console/bell/logout still fit the slim topbar.
- The `.pta-statsbar` 4-column grid and the dashboard's side-by-side `col-lg-*` rows still need their own mobile rules — handled in **Stage 3**, not here.

**✅ Operational check — Stage 1 (run in-browser after deploy)**
- [ ] Desktop (≥769px): content fills full viewport width — no narrow 1180px centred column; even side padding.
- [ ] Desktop: `Audit Log` nav item stays on one line (no wrapping).
- [ ] DevTools ≤768px: nav items disappear from topbar; a deep-green bottom bar appears with all nav items icon+label, gold top-border on the active tab; nothing hidden behind the bar.
- [ ] DevTools ≤480px: brand name hides; emblem alone remains in topbar.
- [ ] Email address hidden at mobile width. No console errors on any page.

### Stage 1b — Logo swap  ✅

The templated armillary placeholder is replaced with the real **Associação Cultural** mark: a charcoal (`#313131`) tile with the copper (`#C0632B`) circuit-maze (Taiwan) emblem, recomposed as a **centered rounded app-icon tile** so the orange keeps its contrast on any background (green topbar, white login card, charcoal login page).

**Bundle assets:** `assets/logo-emblem.png` (512×512), `assets/logo-full.jpg` (the full original lockup — keep for emails / share images / favicons; not used in the app chrome).

1. Copy `logo-emblem.png` → `frontend/public/images/logo-emblem.png`.
2. In **`partials/header.ejs`** and **`login.ejs`**, change the emblem source from `/images/logo-emblem.svg` → **`/images/logo-emblem.png`** (the topbar `<img>` and the `.pta-login__brand` `<img>`). Keep the `width`/`height`/`alt`.
3. Round the tile (append to `pt-design-system.css`) — no inline styles needed:
```css
.pta-brand img{ border-radius: 9px; }
.pta-login__brand img{ border-radius: 18px; }
```

The old `logo-emblem.svg` / `logo-wordmark.svg` are now unused — leave or delete; the wordmark is rendered as HTML text in both the topbar (`PT Associação`) and login (`Associação Cultural / Portuguesa na Formosa`).

**✅ Operational check — Stage 1b (run in-browser after deploy)**
- [ ] Topbar: rounded charcoal tile emblem (38×38, `border-radius:9px`) to the left of "PT Associação". No broken image (Network tab: `logo-emblem.png` 200).
- [ ] Login: emblem 76×76 with `border-radius:18px` above the title. No `.svg` 404.
- [ ] Emblem is the circuit-maze Taiwan mark on charcoal — not the old armillary placeholder.

---

### Stage 2 — Login  ✅ verified `@main`

**Live `login.ejs` is already correct on copy** — do **not** reintroduce old strings:
- title: **`Associação Cultural <br> Portuguesa na Formosa`** (`.pta-login__title`)
- sub: **`Version: V1.6`** (`.pta-login__sub`)
- hint: `Portuguese–Taiwanese Association · members & standing` / `Access is restricted to registered members and staff.`

The only change is **palette → match the new logo** (the green azulejo fought the charcoal/copper emblem). Two parts, both in the DS — **no `login.ejs` markup change** beyond the emblem `src` (Stage 1b):

1. **Replace** `frontend/public/css/ds/azulejo-tile.svg` with the bundle's **copper-on-charcoal** version (same filename, same `url(azulejo-tile.svg)` reference → drop-in). It recolours the Portuguese star tile from gold to copper.
2. **Replace the `.pta-login` + `.pta-login::before` rules** in `pt-design-system.css` (the old green-azulejo block) with the charcoal/copper version below, and add the copper Sign-in override:
```css
/* R4 · Stage 2 — charcoal + copper login (replaces the green-azulejo .pta-login block) */
.pta-login{
  min-height:100vh;display:flex;align-items:center;justify-content:center;position:relative;
  background:
    url(azulejo-tile.svg) center top / 220px 220px repeat,
    radial-gradient(85% 65% at 50% 32%, rgba(192,99,43,0.20), rgba(192,99,43,0) 58%),
    radial-gradient(130% 95% at 50% -10%, #353330, #141312);
  background-color:#141312;padding:var(--space-5);
}
.pta-login::before{
  content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(72% 56% at 50% 42%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.55) 100%);
}
/* Sign in shifted to copper to match the emblem (scoped to the login card) */
.pta-login .pta-btn{ background:#C0632B; }
.pta-login .pta-btn:hover{ background:#A8531F; }
.pta-login .pta-btn:active{ background:#8F4517; }
```

**Verify:** charcoal page with a faint copper star tile and a warm glow behind the card; white card unchanged; the emblem reads as a rounded tile; **Sign in is copper**, not green; title says *Associação Cultural / Portuguesa na Formosa · Version: V1.6*.

> The copper Sign-in is **scoped to `.pta-login`** for now — the rest of the app keeps the verde primary button. If you later want copper as the global primary CTA, that's a separate decision (Stage TBD).

**✅ Operational check — Stage 2 (run in-browser after deploy)**
- [ ] Login page background is dark charcoal with faint copper star tile and warm orange glow — **no green**.
- [ ] Title: **"Associação Cultural / Portuguesa na Formosa"** — NOT "PT Associação / Membership Register".
- [ ] Sub: **"Version: V1.6"**.
- [ ] Sign in button is copper (`#C0632B`), not green.
- [ ] Flash error (wrong password) shows a brand-styled `.pta-alert--danger` — not a plain Bootstrap alert.
- [ ] No console errors.

---

### Stage 3 — Dashboard  ✅ verified `@main` (1187 lines)

**Live structure (top → bottom):**
1. Page head — "Dashboard" + New Member (`canWrite`)
2. Stat tiles — 4-up `.pta-statsbar` (Total / Fee Paid / Unpaid / Honorary)
3. **Warnings & Advisories** — `.pta-table` (Member / Fee / ARC / CC / View); ARC+CC expiry tinted by inline `daysLabel()` returning `tone:'danger'|'warning'`
4. **Vision Model Health** *(super-admin)* — live-JS table; "Run Check" → `POST /admin/ocr-health-check`; dismiss → `POST /admin/ocr-dismiss-warning`
5. **OCR Model Configuration** (`col-lg-7`) + **Default Annual Fee** (`col-lg-5`) *(super-admin)*
6. **Association Calendar** (`col-lg-8`) + **Upcoming Events** (`col-lg-4`) + Bootstrap **New Event modal** (`#newEventModal`)
7. **Recent Members** — table + "View All Members" link
8. **File Vault** (`#vault`, inline in dashboard — **not** a separate page) — Public Vault + Administration Vault (`canVaultAdmin`), side by side `col-lg-6`

**⚠️ R3 corrections — do NOT follow these R3 claims:**
- ❌ *"OCR config is a stack of `.pta-configrow`"* — **wrong.** Live = a JS-built `.pta-table` (# / Model ID / Role / Test / Remove) + Add-model input + Timeout field + Save form (`POST /admin/settings/models`). `.pta-configrow` is not used here.
- ❌ File Vault absent from R3 — **exists and must be preserved.**
- ❌ New Event modal absent from R3 — **exists** (Bootstrap modal, audience targeting: All/Paid/Unpaid/Honorary/Non-Honorary → `POST /admin/events`).

**Required render locals:**
`stats{total,paid,unpaid,honorary}`, `warnings[]`, `isSuperAdmin`, `modelWarnings[]`, `activeModels[]`, `ocrTimeoutSec`, `defaultFee`, `recent[]`, `vaultPublic[]`, `vaultAdmin[]`, `canVaultAdmin`, `canWrite`, `currentUser{id,position}`

> Calendar already uses the brand `CAL_COLORS` array — no colour fix needed. All `.pta-cal-*` / `.pta-upcoming__*` classes exist in the DS. The `--color-success/-danger/-warning`, `--border`, `--surface-raised` inline vars already resolve to brand tokens via the compat aliases in the DS.

#### Mobile fix 1 — table horizontal scroll

Wrap every `<table class="pta-table">` that sits in a `.pta-card__body` with:
```html
<div class="pta-table-wrap"><table class="pta-table">…</table></div>
```
Affected tables: Warnings & Advisories · Vision Model Health · OCR Model Configuration · Recent Members.

Add to `pt-design-system.css` (append at end):
```css
/* R4 · Stage 3 — table scroll on mobile */
.pta-table-wrap{ overflow-x:auto; -webkit-overflow-scrolling:touch; }
```

#### Mobile fix 2 — compact calendar agenda (≤640px)

**Part A — markup** — in `dashboard.ejs`, inside `.pta-cal` div, after `<div class="pta-cal-events" id="calEventsPanel">…</div>`:
```html
<div class="pta-agenda" id="calAgenda"><!-- populated by renderAgendaMobile() --></div>
```

**Part B — JS** — add this function to the calendar script block (after `renderUpcoming()`), then call `renderAgendaMobile();` as the last line inside `renderGrid()`:
```javascript
function renderAgendaMobile() {
  var el = document.getElementById('calAgenda');
  if (!el) return;
  el.innerHTML = '';
  var todayStr = new Date().toISOString().slice(0, 10);
  var byDay = {};
  _calEvents.forEach(function(e) {
    var d = e.start_date ? e.start_date.slice(0, 10) : null;
    if (d) { (byDay[d] = byDay[d] || []).push(e); }
  });
  var days = Object.keys(byDay).sort();
  if (!days.length) {
    el.innerHTML = '<div class="small" style="color:var(--text-muted)">Sem eventos este mês.</div>';
    return;
  }
  var DOW = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  days.forEach(function(ds) {
    var dt   = new Date(ds + 'T00:00:00');
    var item = document.createElement('div');
    item.className = 'pta-agenda__day';
    var dateDiv = document.createElement('div');
    dateDiv.className = 'pta-agenda__date' + (ds === todayStr ? ' is-today' : '');
    dateDiv.innerHTML = '<div class="pta-agenda__dnum">' + dt.getDate() + '</div>'
                      + '<div class="pta-agenda__dow">' + DOW[dt.getDay()] + '</div>';
    var evsDiv = document.createElement('div');
    evsDiv.className = 'pta-agenda__evs';
    byDay[ds].forEach(function(e) {
      var ev = document.createElement('div');
      ev.className = 'pta-agenda__ev';
      ev.style.cursor = 'pointer';
      ev.innerHTML = '<div class="pta-agenda__bar" style="background:'
        + CAL_COLORS[e.id % CAL_COLORS.length] + '"></div>'
        + '<div class="pta-agenda__txt"><div class="pta-agenda__t">' + escH(e.title) + '</div>'
        + (e.location ? '<div class="pta-agenda__m">' + escH(e.location) + '</div>' : '')
        + '</div>';
      ev.addEventListener('click', (function(d) { return function() { selectDay(d); }; }(ds)));
      evsDiv.appendChild(ev);
    });
    item.appendChild(dateDiv);
    item.appendChild(evsDiv);
    el.appendChild(item);
  });
}
```

**Part C — CSS** (append to `pt-design-system.css`):
```css
/* R4 · Stage 3 — mobile calendar agenda */
.pta-agenda{ display:none; flex-direction:column; }
@media (max-width:640px){
  .pta-cal-grid, .pta-cal-hd{ display:none; }
  .pta-agenda{ display:flex; }
}
.pta-agenda__day{ display:flex; gap:14px; padding:11px 0; border-bottom:1px solid var(--border-subtle); }
.pta-agenda__day:last-child{ border-bottom:none; }
.pta-agenda__date{ flex:none; width:46px; text-align:center; }
.pta-agenda__dnum{ font-family:var(--font-display); font-weight:600; font-size:21px; color:var(--text-strong); line-height:1; }
.pta-agenda__dow{ font-size:10px; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); margin-top:3px; }
.pta-agenda__date.is-today .pta-agenda__dnum{ color:#fff; background:var(--green-600); border-radius:8px; display:inline-block; padding:3px 0; width:34px; }
.pta-agenda__evs{ flex:1; display:flex; flex-direction:column; gap:6px; min-width:0; }
.pta-agenda__ev{ display:flex; align-items:stretch; gap:9px; padding:7px 10px; border-radius:8px; background:var(--stone-50); }
.pta-agenda__bar{ width:3px; border-radius:2px; flex:none; }
.pta-agenda__txt{ min-width:0; }
.pta-agenda__t{ font-weight:600; font-size:13px; color:var(--text-strong); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pta-agenda__m{ font-size:11px; color:var(--text-muted); }
```

**✅ Operational check — Stage 3 (run in-browser after deploy, as super-admin)**
- [ ] All 8 sections render top-to-bottom; no JS errors in console.
- [ ] OCR Config: a JS-built table lists models with Test + Remove buttons; "Add Model ID" + "Save Model List" work.
- [ ] Vision Model Health "Run Check" spins, then updates the table.
- [ ] Calendar renders month grid with brand-coloured event strips; clicking a day shows event detail + attendees.
- [ ] Upcoming Events panel populates alongside the calendar.
- [ ] "New Event" button opens the Bootstrap modal (if canWrite or position-gated); audience checkboxes work.
- [ ] File Vault section (`#vault`) appears below Recent Members — Public and Admin columns visible.
- [ ] DevTools ≤640px: calendar switches to the agenda list (date + event bar + title); today shows verde circle.
- [ ] DevTools ≤640px: wide tables (Warnings / OCR / Recent) scroll horizontally — no full-page overflow.

---

### Stage 4 — Profile restructure + nav simplification

**Changes approved:**
1. **Documents removed from the member nav** — members no longer need a top-nav "Documents" link; vault content is now inline in the profile page.
2. **Profile tabs removed** — the `.pta-tabs` / `data-tab-pane` structure is flattened into a single-scroll page; Notifications appear as a section after the profile cards, not a separate tab.
3. **Public Documents section added to profile** — the public vault file list (currently at `/vault`) appears inline at the bottom of the profile page.

> The admin nav retains the Documents link (admins still need `/vault` for the member-view reference from the dashboard Vault section). This change affects the **member nav only**.

#### 4a — `partials/header.ejs` — remove Documents from member nav

Find the member nav block (the `} else {` branch, for non-admin roles) and **delete** the Documents nav item:
```html
<!-- DELETE this line from the member nav: -->
<a class="pta-nav__item <%= title === 'Public Documents' ? 'is-active' : '' %>" href="/vault"><i class="bi bi-archive-fill"></i><span>Documents</span></a>
```
The admin nav (the `if (canViewAll)` branch) keeps its Documents item unchanged.

Also update the bell notification deep-link — change `?tab=notifications` to a scroll anchor:
```html
<!-- BEFORE -->
<a href="/profile?tab=notifications" class="pta-topbar__bell" ...>
<!-- AFTER -->
<a href="/profile#notifications" class="pta-topbar__bell" ...>
```

#### 4b — `user/profile.ejs` — flatten to single scroll

**Remove** the entire `.pta-tabs` block (the two `<button class="pta-tab">` elements and the `<div class="pta-tabs">` wrapper).

**Remove** the `data-tab-pane` wrapper divs (`<div data-tab-pane="profile">` and `<div data-tab-pane="notifications">`), keeping their inner content.

**Remove** the tab-switching JS block (the `showTab` function and `document.querySelectorAll('.pta-tab').forEach(…)` call) from the `<script>` at the bottom.

**Add** a section label before the invites content (place it where the `<!-- ═══ Tab 2: Notifications ═══ -->` comment was):
```html
<div class="section-label" id="notifications">
  <i class="bi bi-bell"></i> Notifications
  <% if (pendingCount > 0) { %><span class="pta-badge pta-badge--solid pta-tone-danger" style="margin-left:.5rem"><%= pendingCount %></span><% } %>
</div>
```

**Remove** the duplicate `feeReminder` alert from the notifications section (it already appears at the top of the profile section — keep only one).

Add a CSS rule for `.section-label` (append to `pt-design-system.css`):
```css
/* R4 · Stage 4 — section label divider */
.section-label{ font-size:var(--text-xs); font-weight:700; letter-spacing:.1em; text-transform:uppercase;
  color:var(--text-muted); margin:1.75rem 0 .75rem; display:flex; align-items:center; gap:.5rem; }
```

#### 4c — Add Public Documents section to `user/profile.ejs`

At the very bottom of the page, **before** `<%- include('../partials/footer') %>`, add:
```html
<div class="section-label" style="margin-top:2rem"><i class="bi bi-archive-fill" style="color:var(--green-600)"></i> Public Documents</div>
<div class="pta-card pta-card--flush">
  <% if (!vaultFiles || !vaultFiles.length) { %>
  <div style="text-align:center;padding:2rem;color:var(--text-muted)">
    <i class="bi bi-archive" style="font-size:1.5rem;display:block;margin-bottom:.4rem"></i>
    No documents published yet.
  </div>
  <% } else { %>
  <div class="pta-table-wrap">
    <table class="pta-table">
      <thead><tr><th>File</th><th>Description</th><th>Date</th><th></th></tr></thead>
      <tbody>
        <% vaultFiles.forEach(function(f) {
          const ext = f.original_name.split('.').pop().toLowerCase();
          const ico = ext==='pdf' ? 'bi-file-earmark-pdf'
                    : ['jpg','jpeg','png','webp'].includes(ext) ? 'bi-file-earmark-image'
                    : ['doc','docx'].includes(ext) ? 'bi-file-earmark-word'
                    : 'bi-file-earmark';
        %>
        <tr>
          <td><i class="bi <%= ico %>" style="margin-right:.4rem;color:var(--text-muted)"></i>
            <span style="font-weight:500"><%= f.original_name %></span>
            <span class="pta-id" style="font-size:.75rem"><%= Math.round(f.file_size/1024) %> KB</span></td>
          <td style="color:var(--text-muted)"><%= f.description || '—' %></td>
          <td><span class="pta-id"><%= f.uploaded_at ? f.uploaded_at.slice(0,10) : '—' %></span></td>
          <td><a href="/vault/files/<%= f.id %>" class="pta-btn pta-btn--ghost pta-btn--sm"><i class="bi bi-download"></i></a></td>
        </tr>
        <% }); %>
      </tbody>
    </table>
  </div>
  <% } %>
</div>
```

#### 4d — Route change: pass `vaultFiles` to the profile render

In the profile GET route (likely `routes/user.js` or `routes/profile.js`), fetch public vault files and pass them:
```javascript
// Add to the profile GET handler, alongside the existing member/invites/documents queries:
const vaultFiles = await db.all(
  "SELECT * FROM vault_files WHERE section = 'public' ORDER BY uploaded_at DESC"
);
// Then pass to res.render:
res.render('user/profile', { …existingLocals, vaultFiles });
```
Adjust the table name and column names to match your actual schema (`vault_files`, `section`, `uploaded_at`). Check `routes/admin.js` `/admin/vault/upload` for the exact table name used.

#### 4e — Profile layout (desktop 2-col + mobile responsive)

Replace the Bootstrap `<div class="row g-4">` / `col-md-3` / `col-md-9` wrapper with a CSS-grid layout that uses the full viewport width on desktop and stacks on mobile.

**Markup** — in `user/profile.ejs`, replace the `<div class="row g-4">…</div>` wrapper with:
```html
<div class="profile-layout">
  <div class="profile-sidebar">
    <!-- keep existing photo/avatar/badge markup -->
  </div>
  <div class="profile-cards">
    <!-- Personal Info card -->   <!-- Membership Info card  -->
    <!-- ARC Data card      -->   <!-- Cartão de Cidadão card -->
    <% if (canWrite && member.notes) { %>
    <div class="card full">…Notes…</div>
    <% } %>
    <div class="card full">…My Documents…</div>
  </div>
</div>
<!-- Notifications section-label + invites come AFTER .profile-layout (full-width) -->
<!-- Public Documents section-label + table come AFTER notifications (full-width)  -->
```
Paired info cards (Personal/Membership, ARC/CC) sit in 2-col; Notes + Documents span full width via `.full`.

**CSS** — append to `pt-design-system.css`:
```css
/* R4 · Stage 4 — member profile layout */
.profile-layout{ display:grid; grid-template-columns:200px 1fr; gap:var(--space-6); align-items:start; }
.profile-sidebar{ display:flex; flex-direction:column; gap:var(--space-4); }
.profile-cards{ display:grid; grid-template-columns:1fr 1fr; gap:var(--space-4); }
.profile-cards .full{ grid-column:1/-1; }
@media (max-width:768px){
  .profile-layout{ grid-template-columns:1fr; }
  .profile-cards{ grid-template-columns:1fr; }
  .profile-sidebar{ flex-direction:row; align-items:center; }
}
```

**✅ Operational check — Stage 4 (run in-browser as a member account)**
- [ ] Member nav: **no Documents link** — only "My Profile" in the topbar nav (mobile: bottom bar has My Profile only, no Documents tab).
- [ ] Profile page: **no tabs visible** — single scrolling page.
- [ ] Notifications section appears inline after the profile cards; pending invites show Accept/Decline/Add to Calendar; responding updates the card without reload.
- [ ] Bell icon in topbar links to `/profile#notifications` and scrolls to the Notifications section.
- [ ] Public Documents section appears at the bottom; files list renders if vault has published files; Download links work.
- [ ] Admin/super-admin nav still shows Documents link → `/vault` unchanged.
- [ ] No console errors.

---

### Stage 8 — Audit log + server-log window  ✅ verified `@main`

#### 8a · `admin/audit-log.ejs`

**Live state:** Bootstrap-only — `d-flex` page head, `.card.shadow-sm`, `.table-responsive` (already wraps the table — no mobile overflow issue), `.table.table-sm.table-hover`, Bootstrap `.badge.bg-*`, smart pagination (first/last ± 2 + ellipsis). **No `.pta-*` classes.** Bridge covers it.

**Action types logged** (11 + fallback): member.created / updated / deleted / role_changed / card_uploaded / doc_uploaded / doc_deleted / ocr_applied / nia_photo_saved · profile.self_updated · member.fee_updated.

**Required render locals:** `logs[]`, `total`, `totalPages`, `page`.

**Targeted DS upgrades** (same pattern as Stage 7 — leave table internals, upgrade chrome):

1. **Page head** — replace `d-flex` header with `.pta-pagehead`:
```html
<div class="pta-pagehead">
  <div class="pta-pagehead__titles">
    <h1><i class="bi bi-journal-text"></i> Audit Log</h1>
    <span class="pta-pagehead__sub"><%= total %> total entr<%= total === 1 ? 'y' : 'ies' %></span>
  </div>
</div>
```

2. **Action badges** — replace Bootstrap `.badge.bg-*` with `.pta-badge.pta-badge--soft.pta-tone-*`. Update `ACTION_LABELS` colors:

| Bootstrap `color` | DS `pta-tone-*` |
|---|---|
| `success` | `success` |
| `primary` | `info` |
| `danger` | `danger` |
| `warning` | `gold` |
| `info` | `info` |
| `secondary` | `neutral` |

```html
<!-- BEFORE -->
<span class="badge bg-<%= meta.color %> d-inline-flex align-items-center gap-1">
<!-- AFTER -->
<span class="pta-badge pta-badge--soft pta-tone-<%= meta.color %>">
```
*(Add a tone-mapping step or update the `ACTION_LABELS` color values directly.)*

3. **Empty state card** — replace `.card.shadow-sm` empty state with `.pta-card`:
```html
<div class="pta-card"><div class="pta-card__body" style="color:var(--text-muted)">
  <i class="bi bi-check-circle" style="color:var(--success)"></i> No audit entries yet.
</div></div>
```

4. **Table card wrapper** — replace `.card.shadow-sm` table wrapper with `.pta-card.pta-card--flush`. Keep `.table-responsive` inside it.

> Pagination (`.pagination.pagination-sm`) is bridge-styled — acceptable. No `.pta-pager` replacement needed.

#### 8b · `admin/log-window.ejs`

**This is an intentional standalone dark-terminal popup** — do not integrate DS styles. It is opened by the super-admin console button in the topbar (`window.open('/admin/logs', …)`), runs independently of the main shell, and has its own GitHub-dark palette (`#0d1117` bg, `#3fb950` live green, `#f85149` error red). **Leave it as-is.**

It streams via `EventSource('/admin/logs/stream')` with auto-scroll + pause toggle. `IBM Plex Mono` is in its font stack (matches `--font-mono`).

**✅ Operational check — Stage 8**
- [ ] Audit Log page head shows `.pta-pagehead` with title + entry count sub.
- [ ] Action badges render as `.pta-badge--soft` with correct DS tones (green for created/fee, info for updated, crimson for deleted, gold for role_changed/warning).
- [ ] Empty state uses `.pta-card` style.
- [ ] Table wraps in a `.pta-card--flush`; `.table-responsive` keeps horizontal scroll on mobile.
- [ ] Pagination works: smart ellipsis, Prev/Next disabled at edges.
- [ ] Server log window: click the terminal icon (super-admin topbar) → 960×520 dark popup opens; `connecting…` → `live`; logs stream in real time; Clear and Pause scroll work.
- [ ] No console errors on either page.

---

## ⭑ Revision 3 (superseded by R4 — kept for reference only; do not apply)

**Files:** `admin/member-edit.ejs`, `admin/member-new.ejs`, `partials/member-form.ejs`, `partials/phone-field.ejs`

**Live state:** All four are **entirely Bootstrap-styled** — no `.pta-*` classes. The bridge covers them acceptably (cards, inputs, selects, labels all render on-brand). The Bootstrap `.col-md-*` grid in `member-form.ejs` handles mobile stacking natively — no responsive gaps.

**`member-form.ejs` sections** (shared by both edit and new):
1. **Personal Info** — First/Last Name, "Use ARC name" autofill button, Phone (`phone-field.ejs` partial), Email, Address ZH/EN, Profile Photo upload
2. **Membership Info** — Password, Member ID (disabled on edit), Join Date, Fee Amount select (standard TWD / 0 TWD honorary), Last Paid, Valid Until (disabled/auto), Fee Status badge
3. **ARC / APRC / Taiwan Passport** — 3-way radio `.btn-group` (ARC / APRC / TW Passport) toggling fields via `arcDocTypeChanged()` JS; Number, Chinese Name, English Name, Issue Date, Expiry Date (hidden for APRC → shows Permanent badge), Passport Number, Serial Number
4. **Cartão de Cidadão** — CC Number, Expiry, NIF, NISS
5. **Notes** — textarea (admin-only)

**`phone-field.ejs`** — Bootstrap `input-group` + dropdown dial-code picker with `flag-icons` `fi fi-*` flags + searchable list.

**Required render locals:** `member-edit.ejs` → `member`, `errors[]`, `countries[]`, `taiwanLocations[]`, `defaultFee`. `member-new.ejs` → `data`, same.

**Targeted DS upgrades** (recommended — form internals can stay Bootstrap, bridge covers them):

1. **Page heads** in `member-edit.ejs` and `member-new.ejs` — replace Bootstrap `row/col/h2` with `.pta-pagehead`:
```html
<!-- BEFORE (both files) -->
<div class="row mb-3">
  <div class="col"><h2 class="fw-bold">…</h2></div>
  <div class="col-auto"><a href="…" class="btn btn-outline-secondary"><i class="bi bi-arrow-left"></i> Back</a></div>
</div>
<!-- AFTER -->
<div class="pta-pagehead">
  <div class="pta-pagehead__titles">
    <h1>Edit — <%= member.arc_name_en || … %></h1>  <!-- or "New Member" -->
  </div>
  <a href="…" class="pta-btn pta-btn--secondary"><i class="bi bi-arrow-left"></i> Back</a>
</div>
```

2. **Error alerts** — replace `.alert.alert-danger` with `.pta-alert.pta-alert--danger`:
```html
<div class="pta-alert pta-alert--danger" role="alert">
  <i class="bi bi-exclamation-octagon-fill pta-alert__ico"></i>
  <div class="pta-alert__body"><ul class="mb-0"><% errors.forEach(e => { %><li><%= e %></li><% }) %></ul></div>
</div>
```

3. **Submit/Cancel buttons** — replace Bootstrap button classes with DS classes:
```html
<!-- Save Changes / Create Member -->
<button type="submit" class="pta-btn"><i class="bi bi-save"></i> Save Changes</button>
<!-- Cancel -->
<a href="…" class="pta-btn pta-btn--secondary ms-2">Cancel</a>
```

> Leave the form internals (`form-control`, `form-select`, `form-label`, `.card`, `.btn-group`, `.btn-check`, the phone dropdown) as-is — the bridge handles them and migrating the full form is low priority vs. the visible chrome changes above.

**✅ Operational check — Stage 7**
- [ ] Edit/New page heads use `.pta-pagehead` — "Edit — NAME" or "New Member" with Back button.
- [ ] Validation errors show as `.pta-alert--danger` (brand crimson, not Bootstrap red).
- [ ] Submit buttons are verde `.pta-btn`; Cancel is `.pta-btn--secondary`.
- [ ] Form sections render correctly (ARC type toggle works; APRC hides expiry field; phone dial-code picker opens with flag icons).
- [ ] Mobile: Bootstrap grid stacks `col-md-6` fields to single column — no layout issues.
- [ ] No console errors.

---

## ⭑ Revision 3 (superseded by R4 — kept for reference only; do not apply)

**Live structure** (`.pta-detail` sidebar + content — matches R3 intent, with several additions):

**Sidebar:**
- Profile card: photo (if `member.photo_path`) or initials avatar + display name + ZH name + fee badge + `account_created` date; "Fetch NIA Photo" button (canWrite, hidden for APRC/TW Passport holders — NIA lookup not available)
- **Account Settings** *(super_admin)* — role dropdown + position dropdown + save → `POST /admin/members/:id/account` *(absent from R3)*
- **Danger Zone** *(canWrite)* — delete member → `POST /admin/members/:id/delete` with confirmation

**Content cards (top → bottom):**
1. **Contact** — `.pta-dl.pta-dl--split` (Phone / Email) + `.pta-fieldset` (Address ZH / EN)
2. **Membership & Fees** — `.pta-dl.pta-dl--split` (Member ID / Join date / Fee amount / Last paid / Valid until / Status)
3. **Residence** — eyebrow + title both dynamic: `is_aprc` → "Alien Permanent Resident Certificate / APRC", `is_tw_passport` → "Taiwan Passport / TW Passport", else "Alien Resident Certificate / ARC". `.pta-dl.pta-dl--split` (Number / Serial / Chinese name / Passport No. / Issue / Expiry + validity badge)
4. **Cartão de Cidadão** — `.pta-dl.pta-dl--split` (CC Number / NIF / NISS / Expiry + validity badge)
5. **Notes** *(canWrite + member.notes)* — plain text
6. **Documents** — `.pta-docslots` 4-slot grid (ARC Front/Back + CC Front/Back), each `.pta-docslot` with thumbnail, OCR-extract button, download, delete, replace/upload; below that a misc-docs list with download/delete; bottom: multi-file upload `input-group`

**Three Bootstrap modals** *(all new vs R3)*:
- `#imageViewModal` — photo lightbox (view + download)
- `#ocrModal` — OCR scan/review/apply flow (`POST /admin/members/:id/documents/:docId/ocr` → field checkboxes → `POST /admin/members/:id/documents/apply-ocr`)
- `#arcPhotoModal` — NIA official photo fetch with CAPTCHA (`POST /admin/members/:id/nia-photo`)

**Required render locals:** `member{…}`, `documents[]`, `canWrite`, `isSuperAdmin`

**⚠️ Token alias gap:** the file uses inline `var(--vermelho-500,#BE3A2B)` (Danger Zone header colour). `--vermelho-500` is not defined in the DS (the red ramp is `--crimson-*`). The `#BE3A2B` fallback saves it, but add the alias to the DS `:root` block for correctness:
```css
/* add inside :root in pt-design-system.css */
--vermelho-500: var(--crimson-500);
```

**Mobile fixes** — append to `pt-design-system.css`:
```css
/* R4 · Stage 6 — member detail mobile */
@media (max-width:768px){
  .pta-detail{ grid-template-columns:1fr; }   /* sidebar stacks above content */
}
@media (max-width:520px){
  .pta-docslots{ grid-template-columns:repeat(2,1fr); }   /* 2-col doc slots */
}
```

**✅ Operational check — Stage 6**
- [ ] Member detail loads; all 6 content cards render; sidebar shows profile card + (super_admin) Account Settings + (canWrite) Danger Zone.
- [ ] ARC/APRC/TW Passport card: eyebrow and title update correctly per `is_aprc`/`is_tw_passport`.
- [ ] Document slots: uploaded images show as thumbnails; OCR button opens the scan modal; Apply saves and reloads the page.
- [ ] NIA Photo button visible (non-APRC/non-TW members, canWrite); opens captcha modal.
- [ ] DevTools ≤768px: sidebar stacks above the content cards (single column).
- [ ] DevTools ≤520px: document slots go to 2-per-row.
- [ ] No `--vermelho-500` fallback triggering (Danger Zone header is crimson, not `#BE3A2B` grey).
- [ ] No console errors.

---

## ⭑ Revision 3 (superseded by R4 — kept for reference only; do not apply)

**Live state — what's actually in `members-list.ejs`** (R3 showed a 6-col skeleton; the live file has more):

| Column | Notes |
|---|---|
| Member | Avatar (photo if `m.photo_path` exists, else initials) + EN name + ZH name |
| Member ID | `.pta-id` mono |
| Email | Plain text |
| Position | Badge tone derived from `user_role` (super_admin→gold, admin→info) then `position` (honorary→honorary, board roles→info, member→neutral) |
| **ID Type** *(new)* | APRC / TW Passport / ARC — badge from `m.is_aprc` / `m.is_tw_passport` |
| Fee Status | `feeBadge()` — honorary maps to `pta-tone-honorary`, not `na` |
| **Warnings** *(new)* | Per-row inline ARC+CC expiry calculation — badge per warning, or "No Warning" (success) |
| Joined | `.pta-id` mono |
| *(Edit)* | Ghost icon button; `event.stopPropagation()` so row-click still navigates |

**Toolbar:** `.pta-search` form + Bootstrap `form-select form-select-sm` sort dropdown + `.pta-filterchips` (All / Paid / Renewal / Unpaid). Sort options: Name A→Z, Name Z→A, Recently Added, Oldest First, Join Date ↓/↑. A helper `memberListUrl(overrides)` builds the query string preserving active filters.

**Pagination:** Bootstrap `.pagination` (bridge-styled). No `.pta-pager` used — acceptable via bridge; replace with `.pta-pager` only if bridge styling drifts.

**Required render locals:** `members[]`, `total`, `totalPages`, `page`, `search`, `feeFilter`, `sort`, `canWrite`.

**No markup changes needed** — all `.pta-*` classes resolve correctly.

**Optional style improvement:** swap the sort dropdown to `.pta-control` for brand consistency:
```html
<!-- BEFORE -->
<select class="form-select form-select-sm" style="width:auto;min-width:9rem" …>
<!-- AFTER -->
<select class="pta-control" style="width:auto;min-width:9rem" …>
```

**Mobile CSS** — append to `pt-design-system.css` (`.pta-table-wrap` is already added in Stage 3):
```css
/* R4 · Stage 5 — members toolbar wraps on mobile */
@media (max-width:640px){
  .pta-toolbar{ flex-wrap:wrap; }
  .pta-filterchips{ margin-left:0; width:100%; }
}
```

**✅ Operational check — Stage 5**
- [ ] Members list renders with all 9 columns; photos show for members who have them; initials avatars for the rest.
- [ ] Sort dropdown changes the list order; active filter chip is highlighted.
- [ ] Warning column shows per-row ARC/CC expiry badges (or "No Warning").
- [ ] Row click navigates to member detail; Edit pencil button works independently.
- [ ] DevTools ≤640px: toolbar wraps (search + sort stack above filterchips); table scrolls horizontally; nothing overflows.
- [ ] No console errors.

---

## ⭑ Revision 3 (superseded by R4 — kept for reference only; do not apply)

Revision 2 of this bundle shipped CSS that **did not match the app's real markup**, and it told you to delete `custom.css` calendar rules. The result: the dashboard calendar lost its styling (giant unstyled cells), colours fell back to navy/grey, and the dashboard looked nothing like the approved mockup. Revision 3 fixes all of it **and** ships the actual `dashboard.ejs` so the layout matches the mockup exactly. **Do exactly the four steps below.**

### What the dashboard must look like (the mockup)
A single page, top → bottom:
1. **Page head** — "Dashboard" + New Member button.
2. **Stat tiles** — Total / Fee Paid / Unpaid / Honorary (one flush card).
3. **Warnings & Advisories** — table.
4. **Vision Model Health** *(super-admin)* — full-width table.
5. **OCR Model Configuration + Default Annual Fee** *(super-admin)* — **two cards SIDE BY SIDE** (`col-lg-7` / `col-lg-5`).
6. **Association Calendar + Upcoming Events** — **two cards SIDE BY SIDE** (`col-lg-8` / `col-lg-4`). Calendar: compact cells (~84px, NOT square/giant), verde "today", warm event strips. Upcoming Events: a list built client-side from the same events the calendar fetches.
7. **Recent Members** — table.

### The four steps

| # | Action | File in bundle | Destination in repo |
|---|--------|----------------|---------------------|
| 1 | **Replace** the design-system CSS | `css/pt-design-system.css` | `frontend/public/css/ds/pt-design-system.css` |
| 2 | **Replace** the trimmed custom CSS | `css/custom.css` | `frontend/public/css/custom.css` |
| 3 | **Replace** the dashboard view | `views/admin/dashboard.ejs` | `frontend/views/admin/dashboard.ejs` |
| 4 | **Verify** link order in `header.ejs` + `login.ejs` | — | Bootstrap → custom.css → pt-design-system.css → pt-bootstrap-bridge.css |

That's the whole deploy for the dashboard. `pt-bootstrap-bridge.css`, the logos, and `azulejo-tile.svg` are unchanged from before — copy them only if they're not already in place.

### Why R2 broke (so you can spot the same class of bug elsewhere)

- **Calendar class names:** the app emits **single-dash** classes (`.pta-cal-day`, `.pta-cal-strip`, `.pta-cal-grid`, `.pta-cal-hd`, `.pta-cal-events`, `.pta-cal-ev-item`). R2's CSS styled BEM names (`.pta-cal__day`). **R3's CSS now matches the app's single-dash names**, so the existing calendar JS works untouched.
- **Token names:** the EJS uses inline `var(--brand,#1a3a6e)`, `var(--color-success,#3E9B6E)`, `var(--color-danger,#C0392B)`, `var(--border,#e5e5e5)`, `var(--surface-raised,#f8f8f8)`. The DS didn't define those names, so every one fell through to its off-brand fallback. **R3 adds them as compatibility aliases** (`--brand`→green-500, `--color-success`→green-500, `--color-danger`→crimson-500, `--border`→border-subtle; `--warning`/`--surface-raised` already existed) so all that inline markup resolves to brand colours with no EJS edits.
- **Event colours are set in JavaScript:** the calendar assigns `strip.style.background = CAL_COLORS[id % 8]` inline — **no stylesheet can override that.** The provided `dashboard.ejs` already replaces the old rainbow `CAL_COLORS` with the brand array `['#307A4F','#286CAB','#B94739','#99732B','#7955A0','#298084','#B1582B','#94436D']` (the hex of `--event-1…8`). If you keep your own `dashboard.ejs`, change that one array.
- **The side-by-side layout + Upcoming Events panel never existed in the app** — they were mockup-only. R3's `dashboard.ejs` adds them: two Bootstrap `row > col` pairs, and an `#calUpcoming` panel populated by a new `renderUpcoming()` function (no new server route — it reuses the events the grid already fetches for the visible month, filtered to today-or-later).

### Calendar sizing (the giant-cells fix)
R3 CSS sets `.pta-cal-day { min-height:84px; aspect-ratio:auto; }` (R2 used `aspect-ratio:1`, which made each cell as tall as a full-width column is wide). The provided `dashboard.ejs` also puts the calendar in `col-lg-8`, so it never spans full width.

### If you are NOT super-admin when testing
The OCR/Fee/Vision-Health cards are inside `<% if (isSuperAdmin) { %>`. Log in as the seeded super-admin (`admin@associacao.pt`) to see them.

---

## ⟶ Revision 2 (deployment) — what changed

This bundle now covers the surfaces the app grew after the first handoff: **the dashboard calendar, the topbar notification bell, profile tabs, and event-invite cards.** Those were being hand-styled in `frontend/public/css/custom.css` with off-brand values (a navy calendar via `var(--brand,#1a3a6e)`, a `#e74c3c` bell badge, `#6f42c1` honorary purple). The design system now owns them, bound to real tokens.

**To deploy this revision, three files change in the repo:**

1. **Replace** `frontend/public/css/ds/pt-design-system.css` with the one in this bundle (now includes `--event-1…8`, `.pta-cal-*`, `.pta-tabs`, `.pta-invite`, the topbar bell, and `.pta-btn--gold-soft`).
2. **Replace** `frontend/public/css/custom.css` with the trimmed one in this bundle (`css/custom.css`) — see **Step 2b**.
3. **Confirm the calendar/bell/tabs/invite markup** uses the `.pta-*` classes — see **Step 3f–3i**. Class names like `.pta-cal-strip` are unchanged from what the app already emits, so the calendar JS keeps working; the colours just come from tokens now.

`pt-bootstrap-bridge.css` is unchanged. Nothing else moves.

---

## Overview

This bundle is a **drop-in CSS design system** — real, production-ready stylesheets, not throwaway mockups. Your app is server-rendered EJS styled with Bootstrap 5.3 (loaded from CDN in `frontend/views/partials/header.ejs` and `frontend/views/login.ejs`). There is **no build step, no React** — these files go straight into `express.static` (`frontend/public/`).

There are **two layers**, and you should ship **both**:

1. **`pt-design-system.css`** — all design tokens (colors, Space Grotesk + Public Sans + IBM Plex Mono, spacing, shadows), plus the `.pta-*` component and app-shell classes (buttons, badges, cards, the deep-green topbar, dashboard stat tiles, the member-detail card grid, the azulejo login).
2. **`pt-bootstrap-bridge.css`** — remaps Bootstrap's own CSS variables and components onto the tokens, so **your existing markup reskins instantly with zero structural changes.**

> **Strategy:** Link both files now → the whole app immediately adopts the palette, fonts, and background (the "fast path" via the bridge). Then progressively convert high-value views (login → dashboard → member-detail) to the `.pta-*` classes for **pixel-perfect** parity with the approved mockups. The bridge keeps every un-migrated page looking correct in the meantime.

---

## Files in this bundle

```
design_handoff_pt_admin/
├── HANDOFF.md                     ← this file
├── views/
│   └── admin/
│       └── dashboard.ejs          ← R3: complete dashboard (replaces frontend/views/admin/dashboard.ejs)
├── css/
│   ├── pt-design-system.css       ← tokens + .pta-* components + layout (self-contained)
│   ├── pt-bootstrap-bridge.css    ← Bootstrap-variable remap (instant reskin)
│   ├── custom.css                 ← R2: trimmed replacement for the app's custom.css
│   └── azulejo-tile.svg           ← seamless tile for the login background (referenced by the CSS)
└── assets/
    ├── logo-emblem.svg            ← circular armillary monogram (topbar + login)
    └── logo-wordmark.svg          ← horizontal lockup
```

Fonts load from Google Fonts via an `@import` at the top of `pt-design-system.css` (Space Grotesk, Public Sans, IBM Plex Mono) — no font files to host. Bootstrap Icons are already loaded in `header.ejs`, so all `bi-*` icons keep working.

---

## Step 1 — Copy the files into the repo

```
frontend/public/css/ds/pt-design-system.css
frontend/public/css/ds/pt-bootstrap-bridge.css
frontend/public/css/ds/azulejo-tile.svg
frontend/public/images/logo-emblem.svg
frontend/public/images/logo-wordmark.svg
```

(`azulejo-tile.svg` **must** sit next to `pt-design-system.css` — the CSS references it as a relative `url(azulejo-tile.svg)`.)

## Step 2 — Link the stylesheets (both layout files)

In **`frontend/views/partials/header.ejs`** and **`frontend/views/login.ejs`**, add these two lines **after** the existing Bootstrap `<link>` and after `custom.css`:

```html
<link rel="stylesheet" href="/css/ds/pt-design-system.css">
<link rel="stylesheet" href="/css/ds/pt-bootstrap-bridge.css">
```

Order is load-bearing: Bootstrap → custom.css → **pt-design-system → pt-bootstrap-bridge**. Ours must win the cascade.

**That's the entire "fast path."** Restart (`npm run dev`) and every page is now branded. Commit here before migrating views.

> Optional: once views are migrated you can delete the now-redundant overrides in `frontend/public/css/custom.css` (the `body`/`.card`/`.badge` rules), but leaving them is harmless.

---

## Step 2b — Replace `custom.css` (Revision 2)

This revision moves the calendar, the topbar bell, the page background, and card radius into the design system. The old hand-written rules for those in `frontend/public/css/custom.css` are now **wrong** (off-brand colours) and **redundant**. **Replace the whole file** with `css/custom.css` from this bundle.

**Delete these blocks from the app's `custom.css`** (the bundle's version already omits them):

```css
body { background-color: #f8f9fa; }      /* cold grey — DS sets warm putty */
.card { border-radius: 0.5rem; }          /* DS owns card radius */
.table th { … }                           /* DS .pta-table owns this */
.bg-honorary  { background-color: #6f42c1 … }   /* Bootstrap purple → token */
.text-honorary { color: #6f42c1 … }
.pta-topbar__bell { … }  .pta-bell__badge { background:#e74c3c … }   /* now in DS, vermelho */
.pta-cal-nav / .pta-cal-grid / .pta-cal-day / .pta-cal-strip / …      /* now in DS, verde + --event-* */
```

What the trimmed `custom.css` keeps: just the `.bg-honorary` / `.text-honorary` utilities, rebound to `var(--violet-500)` so they match the honorary badge/avatar.

> **Why the calendar was navy:** the old rules used `var(--brand,#1a3a6e)` and `rgba(52,152,219,…)`. `--brand` is not a token in this system, so every calendar rule fell through to a Bootstrap-blue fallback. The DS version binds "today" to `--green-500` and event strips to the new `--event-1…8` ramp.

---

## Step 3 — Progressive view migration (full fidelity)

For each view below, swap the Bootstrap markup for the `.pta-*` structure to match the approved mockups exactly. **Verify field names against the `res.render(...)` locals in `routes/admin.js` / `routes/auth.js`** — the snippets use illustrative names (`member.arc_name_en`, etc.); adjust to your actual variables.

### 3a · `login.ejs` — azulejo login

Replace the `<body>` contents with:

```html
<body class="pta-login">
  <div class="pta-login__card">
    <div class="pta-login__brand">
      <img src="/images/logo-emblem.svg" width="72" height="72" alt="PT Associação">
      <div>
        <div class="pta-login__title">PT Associação</div>
        <div class="pta-login__sub">Membership Register</div>
      </div>
    </div>

    <% if (flash) { %>
      <div class="pta-alert pta-alert--<%= flash.type === 'danger' ? 'danger' : flash.type %>" role="alert">
        <i class="bi bi-exclamation-octagon-fill pta-alert__ico"></i>
        <div class="pta-alert__body"><%= flash.message %></div>
      </div>
    <% } %>

    <form class="pta-login__form" action="/login" method="POST" novalidate>
      <div class="pta-field">
        <label class="pta-field__label" for="email">Email</label>
        <input class="pta-control" id="email" type="email" name="email" autofocus required>
      </div>
      <div class="pta-field">
        <label class="pta-field__label" for="password">Password</label>
        <input class="pta-control" id="password" type="password" name="password" required>
      </div>
      <button type="submit" class="pta-btn pta-btn--block">
        <i class="bi bi-box-arrow-in-right"></i> Sign in
      </button>
    </form>

    <div class="pta-login__hint">
      Portuguese–Taiwanese Association · members &amp; standing<br>
      Access is restricted to registered members and staff.
    </div>
  </div>
</body>
```

### 3b · `partials/header.ejs` — deep-green topbar

Replace the `<nav class="navbar …">…</nav>` with the `.pta-topbar`. (Keep your EJS role/auth conditionals.)

```html
<header class="pta-topbar">
  <a class="pta-brand" href="/">
    <img src="/images/logo-emblem.svg" width="38" height="38" alt="">
    <span class="pta-brand__txt">
      <span class="pta-brand__name">PT Associação</span>
      <span class="pta-brand__sub">Luso · Taiwanese</span>
    </span>
  </a>

  <nav class="pta-nav">
    <a class="pta-nav__item <%= active==='dashboard' ? 'is-active' : '' %>" href="/admin"><i class="bi bi-speedometer2"></i><span>Dashboard</span></a>
    <a class="pta-nav__item <%= active==='members' ? 'is-active' : '' %>" href="/admin/members"><i class="bi bi-people-fill"></i><span>Members</span></a>
    <% if (canWrite) { %>
      <a class="pta-nav__item <%= active==='audit' ? 'is-active' : '' %>" href="/admin/audit"><i class="bi bi-clock-history"></i><span>Audit Log</span></a>
    <% } %>
  </nav>

  <div class="pta-topbar__right">
    <% if (currentUser.role === 'super_admin') { %><span class="pta-badge pta-badge--solid pta-tone-danger">Super Admin</span>
    <% } else if (currentUser.role === 'admin') { %><span class="pta-badge pta-badge--solid pta-tone-gold">Admin</span><% } %>
    <span class="pta-user">
      <span class="pta-user__email"><%= currentUser.email %></span>
      <form action="/logout" method="POST" class="d-inline">
        <button class="pta-user__logout" type="submit" title="Log out"><i class="bi bi-box-arrow-right"></i></button>
      </form>
    </span>
  </div>
</header>
```

Pass an `active` local from each route (`'dashboard'` / `'members'` / `'audit'`) so the nav highlights correctly. Wrap page bodies in `<main class="pta-main">…</main>` for the centered max-width frame.

### 3c · `admin/dashboard.ejs` — stat tiles

```html
<div class="pta-card pta-card--flush">
  <div class="pta-statsbar">
    <div class="pta-stat"><div class="pta-stat__top"><span class="pta-stat__ico"><i class="bi bi-people-fill"></i></span><span class="pta-stat__label">Total Members</span></div><span class="pta-stat__value"><%= stats.total %></span></div>
    <div class="pta-stat pta-stat--success"><div class="pta-stat__top"><span class="pta-stat__ico"><i class="bi bi-check2-circle"></i></span><span class="pta-stat__label">Fee Paid</span></div><span class="pta-stat__value"><%= stats.paid %></span></div>
    <div class="pta-stat pta-stat--danger"><div class="pta-stat__top"><span class="pta-stat__ico"><i class="bi bi-exclamation-circle"></i></span><span class="pta-stat__label">Unpaid</span></div><span class="pta-stat__value"><%= stats.unpaid %></span><span class="pta-stat__sub">incl. expired</span></div>
    <div class="pta-stat pta-stat--honorary"><div class="pta-stat__top"><span class="pta-stat__ico"><i class="bi bi-award"></i></span><span class="pta-stat__label">Honorary</span></div><span class="pta-stat__value"><%= stats.honorary %></span><span class="pta-stat__sub">fee exempt</span></div>
  </div>
</div>
```

### 3d · `admin/members-list.ejs` — register table

Use `.pta-card.pta-card--flush` wrapping a `.pta-table`, with a `.pta-toolbar` (search + `.pta-chip` filters) above it:

```html
<div class="pta-toolbar">
  <div class="pta-search"><i class="bi bi-search"></i><input class="pta-control" placeholder="Search name, ID or email…"></div>
  <div class="pta-filterchips">
    <button class="pta-chip is-active">All</button><button class="pta-chip">Paid</button>
    <button class="pta-chip">Renewal</button><button class="pta-chip">Unpaid</button>
  </div>
</div>
<div class="pta-card pta-card--flush">
  <table class="pta-table">
    <thead><tr><th>Member</th><th>Member ID</th><th>Email</th><th>Position</th><th>Fee Status</th><th>Joined</th></tr></thead>
    <tbody>
      <% members.forEach(function(m){ %>
      <tr class="is-clickable" onclick="location.href='/admin/members/<%= m.id %>'">
        <td><div class="pta-namecell">
          <span class="pta-avatar pta-avatar--sm"><%= (m.arc_name_en||'').split(' ').map(s=>s[0]).slice(0,2).join('') %></span>
          <span class="pta-namecell__txt"><span class="pta-namecell__en"><%= m.arc_name_en %></span><span class="pta-namecell__zh"><%= m.arc_chinese_name %></span></span>
        </div></td>
        <td><span class="pta-id"><%= m.member_id %></span></td>
        <td><%= m.email %></td>
        <td><span class="pta-badge pta-badge--soft pta-tone-info"><%= m.position %></span></td>
        <td><%- feeBadge(m.fee_status) %></td>
        <td><span class="pta-id"><%= m.join_date %></span></td>
      </tr>
      <% }); %>
    </tbody>
  </table>
</div>
```

**Fee badge helper** (map a fee status to a badge — put in a partial or EJS helper):
| status | markup |
|---|---|
| `paid` | `<span class="pta-badge pta-badge--soft pta-tone-success"><span class="pta-badge__dot"></span>Paid</span>` |
| `renewal_incoming` | `<span class="pta-badge pta-badge--soft pta-tone-gold"><span class="pta-badge__dot"></span>Renewal incoming</span>` |
| `unpaid` | `<span class="pta-badge pta-badge--soft pta-tone-danger"><span class="pta-badge__dot"></span>Unpaid</span>` |
| `na` (honorary) | `<span class="pta-badge pta-badge--soft pta-tone-honorary">Exempt</span>` |

### 3e · `admin/member-detail.ejs` — the reorganized profile

This is the most-improved screen. Structure: page head, then `.pta-detail` (264px sidebar + content). The content column is a **vertical stack of full-width cards**, and dense cards use `.pta-dl.pta-dl--split` (two label/value columns). Addresses use `.pta-fieldset` (stacked label-over-value). See the live reference for the exact card order: **Contact → Membership & Fees → Residence (ARC) → Cartão de Cidadão → Notes → Documents.**

```html
<div class="pta-pagehead">
  <div class="pta-pagehead__titles">
    <a class="pta-chip" style="align-self:flex-start" href="/admin/members"><i class="bi bi-arrow-left"></i> Members</a>
    <h1><%= member.arc_name_en %></h1>
    <span class="pta-pagehead__sub"><%= member.arc_chinese_name %> · <span class="pta-id"><%= member.member_id %></span></span>
  </div>
  <div style="display:flex;gap:.5rem">
    <a class="pta-btn pta-btn--secondary" href="/admin/members/<%= member.id %>/edit"><i class="bi bi-pencil"></i> Edit</a>
  </div>
</div>

<div class="pta-detail">
  <!-- Sidebar: profile + role + danger zone -->
  <div style="display:flex;flex-direction:column;gap:1.5rem">
    <div class="pta-card"><div class="pta-card__body">
      <div class="pta-profilecard">
        <span class="pta-avatar pta-avatar--xl"><%= initials %></span>
        <div><div class="pta-profilecard__name"><%= member.arc_name_en %></div><div class="pta-profilecard__zh"><%= member.arc_chinese_name %></div></div>
        <%- feeBadge(member.fee_status) %>
        <div class="pta-profilecard__meta">Account created <%= member.join_date %></div>
      </div>
    </div></div>
    <!-- (role-management + danger-zone cards as in the reference) -->
  </div>

  <!-- Content: full-width info bands -->
  <div style="display:flex;flex-direction:column;gap:1.5rem">

    <div class="pta-card">
      <header class="pta-card__head"><i class="bi bi-person-lines-fill"></i><div class="pta-card__titles"><span class="pta-card__title">Contact</span></div></header>
      <div class="pta-card__body">
        <dl class="pta-dl pta-dl--split">
          <dt>Phone</dt><dd class="mono"><%= member.phone %></dd>
          <dt>Email</dt><dd><%= member.email %></dd>
        </dl>
        <div class="pta-fieldset">
          <div><div class="pta-fieldset__lbl">Address · 中文</div><div class="pta-fieldset__val"><%= member.address_zh %></div></div>
          <div><div class="pta-fieldset__lbl">Address · EN</div><div class="pta-fieldset__val"><%= member.address %></div></div>
        </div>
      </div>
    </div>

    <div class="pta-card">
      <header class="pta-card__head"><i class="bi bi-card-checklist"></i><div class="pta-card__titles"><span class="pta-card__title">Membership &amp; Fees</span></div></header>
      <div class="pta-card__body"><dl class="pta-dl pta-dl--split">
        <dt>Member ID</dt><dd class="mono"><%= member.member_id %></dd>
        <dt>Join date</dt><dd class="mono"><%= member.join_date %></dd>
        <dt>Annual fee</dt><dd><%= member.fee_amount %> TWD</dd>
        <dt>Last paid</dt><dd class="mono"><%= member.fee_last_paid %></dd>
        <dt>Valid until</dt><dd class="mono"><%= member.fee_valid_until %></dd>
        <dt>Status</dt><dd><%- feeBadge(member.fee_status) %></dd>
      </dl></div>
    </div>

    <!-- Residence — ARC: same .pta-card + .pta-dl--split with eyebrow "Alien Resident Certificate" -->
    <!-- Cartão de Cidadão: same, eyebrow "Portuguese ID" -->
    <!-- Documents: .pta-card with a .pta-docslots grid of .pta-docslot thumbs -->
  </div>
</div>
```

For the card header **eyebrow**, add a span above the title inside `.pta-card__titles`:
```html
<div class="pta-card__titles"><span class="pta-card__eyebrow">Alien Resident Certificate</span><span class="pta-card__title">Residence — ARC</span></div>
```

---

## Step 3f–3j — Revision 2 surfaces (calendar · bell · tabs · invites · settings)

These markup references are the source of truth: the live, working versions are the specimen cards in the design system (`cards/calendar.html`, `cards/tabs.html`, `cards/invite.html`, `cards/status-configrow.html`) and the admin kit (`ui_kits/admin/Dashboard.jsx`, `AppShell.jsx`). Copy structure from there; the classes below are stable.

### 3f · Dashboard calendar (`admin/dashboard.ejs`)
The app already emits `.pta-cal-*` markup; with this revision the **colours now come from tokens** — no markup change needed beyond confirming class names. Each event strip takes a colour slot: `class="pta-cal-strip"` + an inline `background: var(--event-N)` where `N = (event.id % 8) + 1` (or add modifier classes `pta-cal__strip--e1…e8`). "Today" is `.is-today` (verde), event days `.has-events` (azulejo tint).

```html
<div class="pta-cal-day is-today has-events">
  <div class="dnum">11</div>
  <div class="pta-cal-strip" style="background:var(--event-1)">General meeting</div>
</div>
```

### 3g · Topbar bell (`partials/header.ejs`)
Inside `.pta-topbar__right`, before the role badge:
```html
<a class="pta-topbar__bell" href="/profile?tab=notifications" title="<%= pendingInviteCount %> pending">
  <i class="bi bi-bell-fill"></i>
  <% if (pendingInviteCount > 0) { %><span class="pta-bell__badge"><%= pendingInviteCount %></span><% } %>
</a>
```

### 3h · Profile tabs (`user/profile.ejs`)
Replace the Bootstrap `.nav-tabs` with:
```html
<div class="pta-tabs" role="tablist">
  <button class="pta-tab is-active" data-tab="profile"><i class="bi bi-person-vcard"></i> My Profile</button>
  <button class="pta-tab" data-tab="notifications"><i class="bi bi-bell"></i> Notifications
    <% if (pendingInviteCount > 0) { %><span class="pta-tab__count"><%= pendingInviteCount %></span><% } %>
  </button>
</div>
```
Keep your existing tab-switch JS; just toggle `.is-active` on the buttons instead of Bootstrap's `.active`.

### 3i · Event invite cards (`user/profile.ejs`, Notifications tab)
```html
<div class="pta-invite<%= invite.status !== 'pending' ? ' is-resolved' : '' %>">
  <div class="pta-invite__rail" style="background:var(--event-<%= (invite.event_id % 8) + 1 %>)"></div>
  <div class="pta-invite__body">
    <div class="pta-invite__top">
      <div>
        <div class="pta-invite__title"><%= invite.title %></div>
        <div class="pta-invite__meta"><span><i class="bi bi-calendar-event"></i><span class="mono"><%= invite.start_date %></span></span><span><i class="bi bi-geo-alt"></i><%= invite.location %></span></div>
      </div>
      <span class="pta-invite__status is-<%= invite.status %>"><%= invite.status %></span>
    </div>
    <% if (invite.status === 'pending') { %>
    <div class="pta-invite__actions">
      <button class="pta-btn pta-btn--sm" data-respond="accepted"><i class="bi bi-check-lg"></i> Accept</button>
      <button class="pta-btn pta-btn--secondary pta-btn--sm" data-respond="declined">Decline</button>
      <a class="pta-btn pta-btn--gold-soft pta-btn--sm" href="/profile/invites/<%= invite.id %>/export.ics"><i class="bi bi-calendar-plus"></i> Add to Calendar</a>
    </div>
    <% } %>
  </div>
</div>
```

### 3j · Super-admin settings cards (`admin/dashboard.ejs`)
All three are `.pta-card`s. **Vision Model Health** is a `.pta-table` with a `.pta-status` cell per row; **OCR Model Configuration** is a stack of `.pta-configrow`; **Default Annual Fee** is a `.pta-control` + Save. Status + config markup:
```html
<!-- model health status cell -->
<span class="pta-status pta-status--online"><span class="pta-status__dot"></span>Online</span>   <!-- --offline / --idle -->

<!-- one OCR model row -->
<div class="pta-configrow">
  <div class="pta-configrow__main"><span class="pta-configrow__id">nvidia/nemotron-nano-12b-v2-vl:free</span><span class="pta-configrow__role">Primary</span></div>
  <div class="pta-configrow__actions">
    <button class="pta-btn pta-btn--secondary pta-btn--sm">Test</button>
    <button class="pta-btn pta-btn--ghost pta-btn--sm pta-btn--icon"><i class="bi bi-trash"></i></button>
  </div>
</div>
```

---

## Component class reference

| Component | Base class | Variants / modifiers |
|---|---|---|
| **Button** | `.pta-btn` | `--accent`/`--danger`, `--gold`, `--secondary`, `--ghost`, `--subtle`, `--sm`, `--lg`, `--icon`, `--block` |
| **Badge** | `.pta-badge` | `--soft` / `--solid` × tone `pta-tone-{success,warning,danger,info,neutral,gold,honorary}`; `--lg`; inner `.pta-badge__dot` |
| **Avatar** | `.pta-avatar` | `--sm/--md/--lg/--xl`, `--honorary`; put initials as text or `<img>` inside |
| **Card** | `.pta-card` | `--accent` (green top rule), `--flush` (no body padding); `.pta-card__head` + `.pta-card__titles` (`__eyebrow`,`__title`); `.pta-card__body` |
| **Field** | `.pta-field` | `.pta-field__label` + `.pta-control` (`--mono`); `.pta-field--error`, `.pta-field__hint`, `.pta-field__error` |
| **Alert** | `.pta-alert` | `--success/--danger/--warning/--info`; `.pta-alert__ico` + `.pta-alert__body` |
| **Stat tile** | `.pta-stat` | `--success/--warning/--danger/--honorary/--info`; `__ico`,`__label`,`__value`,`__sub` |
| **Calendar** *(R2)* | `.pta-cal-*` | `.pta-cal-day`(`.is-today`/`.has-events`/`.is-other`/`.is-selected`), `.pta-cal-strip` + `var(--event-1…8)`, `.pta-cal-strip--more` |
| **Tabs** *(R2)* | `.pta-tabs` | `.pta-tab`(`.is-active`), `.pta-tab__count` (crimson pending pill) |
| **Invite** *(R2)* | `.pta-invite` | `.is-resolved`; `__rail`,`__body`,`__top`,`__title`,`__meta`,`__desc`,`__actions`; `__status`(`.is-pending/.is-accepted/.is-declined`) |
| **Status** *(R2)* | `.pta-status` | `--online/--offline/--idle`; inner `.pta-status__dot` |
| **Config row** *(R2)* | `.pta-configrow` | `__main`,`__id`,`__role`,`__actions` |
| **Bell** *(R2)* | `.pta-topbar__bell` | inner `.pta-bell__badge` (crimson pending count) |

*(R2)* = added in Revision 2.

App-shell/layout classes: `.pta-shell`, `.pta-topbar`, `.pta-nav`, `.pta-main`, `.pta-pagehead`, `.pta-table`, `.pta-toolbar`, `.pta-chip`, `.pta-detail`, `.pta-dl`(`--split`), `.pta-fieldset`, `.pta-docslots`, `.pta-login`.

---

## Design tokens (reference)

**Brand colors** — verde (primary) `#0E6B41`, vermelho (accent) `#BE3A2B`, ouro (highlight) `#CB9A35`, azul (info) `#1D4E89`, honorary violet `#6B4BA6`. Full 50–900 ramps + semantic aliases (`--brand-primary`, `--surface-page`, `--text-strong`, `--success`, etc.) are defined at the top of `pt-design-system.css`.

**Event palette** *(R2)* — `--event-1…8`: eight warm equal-chroma hues for the calendar, assigned per event as `(event.id % 8) + 1`. An event uses the same slot on its calendar strip and its invite rail.

**Surfaces** — page `#EAE6DB` (deeper putty), card `#FFFFFF`, inverse (topbar) green-800, sunken stone-200.

**Type** — display **Space Grotesk** (`--font-display`), UI **Public Sans** (`--font-sans`), data **IBM Plex Mono** (`--font-mono`, always `tabular-nums`). Scale `--text-2xs … --text-4xl` (16px base, 1.2 ratio). **Every ID/number/date is mono; `arc_name_en` is ALL CAPS.**

**Spacing** — 4px base, `--space-1 … --space-10`. **Radii** — `--radius-md` 8px (inputs/cards), `--radius-lg` 12px, `--radius-pill`. **Shadows** — warm low `--shadow-xs … --shadow-xl`; green focus ring `--shadow-focus`.

---

## Acceptance checklist

- [ ] Both stylesheets linked after Bootstrap in `header.ejs` **and** `login.ejs`; app restarts cleanly.
- [ ] Fast-path verified: buttons are green, navbar deep-green with gold underline, body is putty, headings are Space Grotesk, flash alerts use the soft brand tones.
- [ ] Login uses `.pta-login` with the azulejo background and the emblem lockup.
- [ ] Topbar, dashboard stat tiles, members table, and member-detail bands match the reference (`Contact → Membership & Fees → ARC → Cartão de Cidadão → Documents`).
- [ ] All IDs / ARC & CC numbers / NIF / NISS / dates render in IBM Plex Mono; `arc_name_en` is uppercase; Portuguese accents preserved (Associação, Cartão, gestão).
- [ ] No emoji; all icons are Bootstrap Icons `bi-*`.
- [ ] **R2:** `custom.css` replaced with the trimmed bundle version; no `#1a3a6e` / `#e74c3c` / `#6f42c1` / `#f8f9fa` left in the repo's CSS.
- [ ] **R2:** dashboard calendar "today" is verde (not navy); event strips draw from `--event-1…8`; topbar bell badge is vermelho.
- [ ] **R2:** super-admin dashboard shows Vision Model Health (`.pta-status` dots), OCR Model Configuration (`.pta-configrow`), and Default Annual Fee.
- [ ] **R2:** profile tabs use `.pta-tabs` (verde underline); invite cards use `.pta-invite`.

## Notes & caveats

- **Logo is a placeholder.** The emblem/wordmark are tasteful stand-ins — swap in the association's real mark when available (same filenames, keep the viewBox).
- **Bridge vs. adoption:** the bridge makes un-migrated pages look right, but only the `.pta-*` markup gives true parity (custom topbar, stat tiles, detail card grid, doc slots). Migrate at your pace; both can coexist.
- **Field names:** snippet locals are illustrative — confirm against your route `render` locals and EJS partials (`member-form.ejs`, `address-field.ejs`, `phone-field.ejs`).
