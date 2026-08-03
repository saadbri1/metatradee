# Platform design audit — authenticated workspace

Branch `review/platform-design-v1`, from `0e6e3f8`. Based on the actual shell,
dashboard and shared components, not on assumptions.

Read `docs/BILLING_STATUS.md` first: billing, PayPal, webhook, pricing,
entitlement, migration and billing-test paths are frozen. This slice touches
none of them.

## What is already good

Worth stating, because the temptation with a design pass is to replace things
that are working:

- The token layer in `src/styles/tokens.css` is genuinely well made. Semantic,
  theme-aware, HSL-channel format so Tailwind can compose opacity, and the
  contrast decisions are documented with measured ratios and the reasoning for
  each. The navigation rail having its own absolute scale — so it does not
  invert with the theme — is exactly right.
- `--profit` / `--loss` are reserved for P&L only. That discipline is rare and
  is preserved here.
- Reduced motion is honoured globally.
- Locked navigation stays visible and explains the gate rather than hiding the
  product, and the lock reaches assistive tech.

The architecture does not need replacing. What it lacks is consistency between
surfaces built at different times.

## Current problems

### 1. Two different page headers

`TopBar` serves every route except `/dashboard` and `/chart`, which the shell
opts out of explicitly. The dashboard then builds its own header. They disagree
on nearly everything:

|            | TopBar             | Dashboard header       |
| ---------- | ------------------ | ---------------------- |
| Height     | `h-[76px]`         | `h-16`                 |
| Border     | `border-border/80` | `border-border/70`     |
| Background | `bg-background/95` | `bg-card/95`           |
| Title      | `text-base`        | `font-display text-xl` |

Moving between Dashboard and any other page shifts the header 12px and changes
its colour. That reads as two applications.

### 2. Three card chromes, two of them duplicated string-for-string

- the `Card` primitive: `rounded-xl border bg-card shadow`, `p-6`
- the dashboard's `AnalyticsCard`:
  `rounded-md border border-border/70 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.025)]`
- the KPI frame in `renderRegion`: that same literal, repeated inline

Different radius, different border weight, different shadow, different padding.
The dashboard's chrome is a hand-written string in two places, so they can drift
independently — and the shadow is a raw arbitrary value, not a token.

### 3. No shadow, spacing or type scale

- Shadows are literals: `shadow-[0_1px_2px_hsl(var(--foreground)/0.025)]`,
  `shadow-[8px_0_24px_hsl(var(--foreground)/0.06)]`, plus `shadow`, `shadow-sm`,
  `shadow-md` from Tailwind's defaults. Four vocabularies for one concept.
- Border opacity is ad hoc: `border-border`, `/70`, `/80`, with no rule for
  which means what.
- Type sizes are arbitrary pixels scattered through components: `text-[15px]`,
  `text-[13px]`, `text-[11px]`, `text-[10px]`. A panel title is `text-[15px]` in
  one place and `text-base` in another.

### 4. No success token, and success currently renders as muted text

`--profit` is correctly reserved for P&L, so there is no colour for "this
worked". `SuccessState` therefore renders a confirmation in
`text-muted-foreground` — the same weight as de-emphasised helper text. A
confirmation that looks like an aside is a hierarchy failure, and reaching for
`--profit` instead would break the P&L reservation.

### 5. Mobile: the dashboard is overlapped by its own tab bar

The shell reserves space for the fixed `MobileTabBar` with `pb-24`, but only on
routes that are not `/dashboard` or `/chart`:

```
tradingWorkspace || dashboardWorkspace ? 'px-0 py-0' : 'px-4 py-6 pb-24 md:px-6 lg:pb-8'
```

The dashboard's own `<main>` uses `py-4 … xl:pb-8` and reserves nothing. On
mobile the last row of widgets sits underneath the tab bar. This is a live
defect, not a stylistic preference.

### 6. Shared components restyled by descendant selectors

The dashboard reshapes `NotificationCenter` from the outside:

```
[&_button]:size-10 [&_button]:rounded-full [&_button]:border …
```

The sidebar does the same to `UserMenu`. Both work, and both mean the component
has no real API for the variation it is being asked for — so the override has to
be repeated wherever the variation is wanted.

### 7. Hierarchy inside the dashboard

The page `h1` is "Dashboard", and immediately below it an `h2` says
"Good morning {name}!". The greeting is the largest text in the content area
while carrying the least information. KPI values, which are what the page is
for, are visually equal to their own labels.

## Chosen visual direction

**A calm instrument panel, not a marketing page.**

- **Surfaces do the structural work, not borders.** One panel treatment: a
  single-pixel border, a shadow that is almost imperceptible, and a consistent
  radius. Depth is used only to separate a panel from the page.
- **Density with air.** Data-dense is the point; crowding is not. Consistent
  gutters and one vertical rhythm, so scanning is predictable.
- **Typography carries hierarchy, colour does not.** Page title, panel title,
  label and metric are four defined steps. Colour is reserved for state
  (`--primary` for the active/interactive, `--profit`/`--loss` for P&L,
  `--warning`, `--destructive`, and now `--success`).
- **The rail stays dark in both themes.** It is the product's anchor and the
  one deliberate high-contrast element. Unchanged.
- **Motion is state feedback only.** No entrances for their own sake, nothing
  decorative, everything already gated on `prefers-reduced-motion`.

Explicitly not doing: gradients, glassmorphism, neon, oversized in-app
headings, decorative animation, or any new UI framework.

## Component strategy

Extend the existing system; do not replace the architecture. No new
dependencies — everything below is Tailwind plus the existing token layer.

**Tokens added** (`src/styles/tokens.css`, surfaced through
`tailwind.config.ts`):

- `--surface-raised` — the elevated step, named rather than implied by
  `--popover`
- `--success` / `--success-foreground` — distinct from `--profit`, so
  confirmations stop borrowing the P&L colour
- a shadow scale: `--shadow-panel`, `--shadow-raised`, `--shadow-rail`
- a type scale exposed as Tailwind sizes: `label`, `body`, `panel-title`,
  `page-title`, `metric`
- a layout rhythm exposed as spacing aliases: `gutter`, `panel`, `stack`

**Primitives created**:

- `Panel` / `PanelHeader` / `PanelTitle` / `PanelBody` — the single card chrome,
  replacing the three variants and both duplicated literals
- `PageHeader` — one header pattern, adopted by both `TopBar` and the dashboard

## Scope of this first slice

1. Token additions above
2. `Panel` and `PageHeader` primitives
3. Authenticated shell: header unification and the mobile overlap fix
4. Sidebar / mobile navigation active state
5. Dashboard page: hierarchy, panel consistency, spacing rhythm

All existing actions, links, queries, route behaviour, widget editing,
filters, dialogs and `data-*` test hooks are preserved. No dashboard data is
invented and no feature is removed to make the page look calmer.

## Deferred to the next slice

- **Journal** list, detail and editor
- **Chart / trading workspace** — it has its own route-scoped dark theme and
  deserves its own pass
- **Analytics, Reports, Playbook, Calendar, AI Coach, Goals**
- **Settings** and onboarding
- **Billing page** — frozen this phase; it will need the new `Panel` once
  unfrozen
- **`Card` primitive migration** — `Panel` is introduced alongside it. Migrating
  every existing `Card` call site belongs with the surfaces that use them, not
  in a shell-and-dashboard slice.
- **The descendant-selector overrides** on `NotificationCenter` and `UserMenu` —
  fixing them properly means giving those components a size/shape API, which
  touches routes outside this slice.
