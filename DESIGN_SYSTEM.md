# Questbook Design System: "Field Notes"

The system is calm, gender-neutral and built for accessibility first. Every value lives in `styles/tokens.css`, and the in-app **Design System** page renders the real tokens and components.

## Principles

1. **Neutral by default.** Color never signals gender. The brand pairs spruce green (primary) with marigold (rewards) on warm paper, with no pink-for-girls or blue-for-boys coding. Avatars are creatures and objects, never gendered people.
2. **Inclusive language.** Copy speaks to "you". Teacher names appear without Mr./Ms. The profile asks only for a name and an avatar.
3. **Readable first.** Body text uses Atkinson Hyperlegible, which was designed for low-vision readers and has distinct Il1 and O0 shapes. Headings use Lexend, which was designed to reduce visual stress. Text contrast meets WCAG AA in light and dark themes.
4. **Playful, not childish.** Reward moments (gold, confetti, emoji) are used sparingly. All motion follows the OS setting and the in-app **Reduce motion** setting.
5. **Color is never the only signal.** A subject color always appears with its icon and name. Status also shows as text ("Overdue · Yesterday") or an icon.
6. **Comfortable targets.** Controls are at least 40px tall (`--control-h`). Every action can be reached by keyboard, focus rings are always visible, and each screen has a skip link.

## Color

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--primary` | #0d7a68 | #3cc5a8 | Primary actions, focus, active nav |
| `--primary-soft` | #d9efe9 | #143a33 | Selected states, hover fills |
| `--xp` | #e0a100 | #f2b928 | XP, levels, rewards |
| `--success` | #2c7a38 | #6ac878 | Done, correct |
| `--warning` | #9a5b00 | #f0a846 | Due soon |
| `--danger` | #b3381f | #f27c65 | Overdue, destructive |
| `--info` | #28679f | #74b0ee | Quizzes, notices |
| `--bg` / `--surface` / `--surface-2` | warm paper to white | near-black greens | Layering |
| `--text` / `--text-2` / `--text-3` | ink scale | ink scale | Primary, secondary, tertiary text |

**Subject palette.** The eight evenly spaced hues are named after nature, not people: `--c-ember`, `--c-sun`, `--c-moss`, `--c-sea`, `--c-sky`, `--c-iris`, `--c-plum` and `--c-slate`. Each has a separately tuned value for dark mode. To tint a component, set `--c` on it (for example `style="--c: var(--c-sky)"`) and build fills with `color-mix()`, so one variable themes chips, blocks, bars and borders.

**Theming.** Dark mode applies when the device prefers it, unless `data-theme="light"` is set. It also applies whenever `data-theme="dark"` is set on `<html>`.

## Typography

| Token | Size | Use |
| --- | --- | --- |
| `--fs-3xl` | 2.5rem | Display |
| `--fs-2xl` | 1.875rem | Page titles (h1) |
| `--fs-xl` | 1.375rem | Section titles, stat values |
| `--fs-lg` | 1.125rem | Card titles |
| `--fs-md` | 1rem | Body |
| `--fs-sm` | 0.875rem | Secondary text, buttons |
| `--fs-xs` | 0.75rem | Meta, chips, badges |

Text size follows the user's setting: `data-text="large"` gives 112.5% and `data-text="xl"` gives 125%. Every size is in `rem`, so the whole interface scales.

## Space, shape, elevation, motion

- **Space:** 4px base. `--sp-1` is 4, then 8, 12, 16, 24, 32, and `--sp-7` is 48.
- **Radius:** `--r-sm` 8, `--r-md` 12, `--r-lg` 18 (cards), `--r-xl` 26 (modals, flashcards), `--r-pill`.
- **Elevation:** `--shadow-1` for resting cards, `--shadow-2` for hover and raised elements, `--shadow-3` for modals and toasts.
- **Motion:** `--dur-fast` 120ms, `--dur` 220ms, `--dur-slow` 420ms. `--ease` is for UI and `--ease-bounce` is only for reward moments.

## Components

| Component | Class | Notes |
| --- | --- | --- |
| Button | `.btn` + `.btn-primary`, `.btn-ghost`, `.btn-xp`, `.btn-danger`; sizes `.btn-sm`, `.btn-lg` | Pill shape, icon on the left, 40px tall |
| Icon button | `.icon-btn` | Must have an `aria-label` |
| Card | `.card`, `.card-pad`, `.card-head` | |
| Subject chip | `.chip` with `--c` | Always shows the icon and the name |
| Type badge | `.badge .badge-{homework,quiz,test,project,study,keydate}` | |
| XP tag / pill | `.xp-tag`, `.xp-pill` | Gold means reward. `.is-earned` turns it green. |
| Input | `.input`, `.input-sm`, `.input-lg`, inside `.field` with `.label` | |
| Segmented control | `.seg` with `.seg-btn[aria-pressed]` or `.seg-opt` radios | |
| Progress | `.progress` with `.progress-{xp,success,thin}` | Includes `role="progressbar"` |
| Task row | `.task`, `.check[aria-pressed]` | Subject color shows as a left rail |
| Empty state | `empty({ emoji, title, text, action })` | Always suggests a next step |
| Modal | `modal({ title, body, size })` | Built on native `<dialog>`, which handles focus and Esc |
| Toast | `toast(msg, { kind })` | Uses `role="status"` (errors use `role="alert"`) |

## Voice

- Talk to "you", be encouraging and keep it brief. Examples: "All clear", "Nice work staying on top of things", "Be honest — it only helps you".
- Avoid gendered words ("guys", "his/her"), and avoid shaming words for overdue work. Say "Overdue · 2 days ago", not "You failed…".
