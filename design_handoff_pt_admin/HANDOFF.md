# Handoff: PT Associação — Design System Integration

> **For:** Claude Code working in the `Ektoplasm84/PT-ASSOCIACAO` repo (Express + EJS + Bootstrap 5.3).
> **Goal:** Apply the approved PT Associação visual identity (verde / ouro / vermelho palette, Space Grotesk display type, deeper putty background, azulejo login) to the existing app.

---

## ⭑ Revision 3 — START HERE (supersedes the older notes below)

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
