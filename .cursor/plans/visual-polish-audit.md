# Visual polish audit — Cozy Crafters website

**Scope:** `index.html`, `changelog.html`, `gallery.html`, `chronicles.html`, `year-one.html`, `support.html`, `wiki.html`, `admin.html`, `404.html`, `styles.css`  
**Goal:** Identify small inconsistencies only — no redesign.  
**Date:** 2026-04-29

---

## 1. Buttons

| Page / component | What's wrong | Suggested fix | Severity |
|------------------|--------------|---------------|----------|
| **styles.css** (canonical) | `.btn` uses `border-radius: 14px`, `padding: 1.05rem 2.2rem`, `box-shadow: 0 4px 0 var(--sun-deep)` | Use as reference for polish pass | — |
| **gallery.html** (inline) | Primary actions use mixed radii (**10px**, **12px**) and shadow depths (`0 2px 0` / `0 3px 0`) vs shared `0 4px 0`; padding `0.6rem 1.4rem` / `0.75rem 1.6rem` vs global `.btn` | Replace custom rules with `.btn` / `.btn-primary` where markup allows, or extract a small `.gallery-btn` extension in `styles.css` that only adds needed layout (e.g. width) while inheriting radius/shadow from tokens | **High** |
| **support.html** | `.support-donate-btn` duplicates primary button styling (radius 14px aligns; padding `1rem 2rem` vs `1.05rem 2.2rem`) | Tighten padding to match `.btn-primary` or add class `btn btn-primary` + one wrapper if full-width is required | **Low** |
| **404.html** | `.error-actions .btn-secondary` redefines border/background/hover to mirror `.btn-secondary` | Remove duplicate block and rely on `styles.css` `.btn-secondary`, or add a single utility if a one-off tweak is truly needed | **Medium** |
| **wiki.html** | `.wiki-btn`, `.wiki-new-btn` use small radii (**6px**–**8px**) and micro padding — appropriate for dense UI but different from marketing buttons | Acceptable *if* intentional; optionally map `--radius-sm: 8px` in `:root` and reuse for wiki/admin chips so radii are documented, not arbitrary | **Low** |

---

## 2. Spacing rhythm

| Page / component | What's wrong | Suggested fix | Severity |
|------------------|--------------|---------------|----------|
| **Page shells** | Main content top padding varies: e.g. changelog `.page-header` **8rem 3rem 4rem**, gallery `.page-header` **8rem 3rem** start, support `.support-page` **9rem**, 404 **9rem**, chronicles masthead area differs | Normalize to one vertical scale (e.g. `--page-pad-top: clamp(...)`) in `styles.css` and swap inline duplicates — **small deltas only** | **Medium** |
| **Inner max-width** | Hero/content widths differ (`changelog-feed` **780px**, `gallery-content` **1100px**, wiki **820px**, support **640px**, 404 **560px**) — mostly content-driven | No single width fits all; optional doc comment in CSS listing “narrow / medium / wide” presets | **Low** |
| **changelog.html** | `.changelog-feed` padding `3rem 2rem 6rem` vs gallery `2rem 2rem 6rem` — asymmetric horizontal rhythm vs neighbor pages | Align horizontal padding with gallery/chronicles pattern where layouts match | **Low** |

---

## 3. Color usage

| Page / component | What's wrong | Suggested fix | Severity |
|------------------|--------------|---------------|----------|
| **styles.css `:root`** | Documented palette in `CLAUDE.md` vs repo: `--sun-deep` is **#D9A441** in `styles.css`; doc lists **#C9A23B**. `--bark` **#6B4F3A** vs doc **#5C3D2E**. `--ink` **#2B1F15** vs doc **#1A1A12** | **Either** update `CLAUDE.md` to match shipped CSS **or** align CSS variables to doc (risk: visual shift) — decide one source of truth | **Medium** |
| **year-one.html** | Second `:root` block **overrides** globals after `styles.css` (`--sun-deep: #C9A23B`, `--bark: #5C3D2E`, `--ink: #1A1A12`, …) — same page now diverges from `styles.css` for shadows/text using `--sun-deep` elsewhere | Prefer removing duplicate `:root` keys and only add **year-one-specific** tokens (e.g. `--text-muted`) without redefining core palette; or scope overrides under `.year-one` wrapper | **High** |
| **Repeated literals** | Status/success green **#A8C77E**, coral **#E89A6E**, external blue **#8BB8E8** appear as hex in JS and inline styles across gallery, changelog, index | Optional: add `--status-green`, `--external-link`, `--accent-coral` to `:root` and replace literals gradually | **Low** |
| **admin.html** | Inline gradient `#2F4423` / `#2B1F15` on `.bg-tint` — matches vars but not token usage | Use `var(--moss-dark)` / `var(--ink)` in inline style for consistency | **Low** |

---

## 4. Typography hierarchy

| Page / component | What's wrong | Suggested fix | Severity |
|------------------|--------------|---------------|----------|
| **index vs inner pages** | Homepage `h1` uses global `styles.css` giant clamp; inner pages redefine `h1` in scoped `<style>` (e.g. changelog `clamp(2.5rem, 6vw, 4rem)`) — intentional hierarchy | OK; ensure `.page-header h1` shares one clamp formula across changelog/gallery/chronicles where roles match | **Low** |
| **year-one.html** | Local `*` reset and typography for “special page” — many custom `font-size` steps | Already separate art direction; avoid changing copy; only align **color variables** if needed (see §3) | **Low** |

---

## 5. Border treatments

| Page / component | What's wrong | Suggested fix | Severity |
|------------------|--------------|---------------|----------|
| **Cards** | `styles.css` `.feature-card` uses `border-radius: 16px`; changelog `.changelog-entry` uses **18px**; gallery cards **12px**; support card **20px** | Not wrong, but document three tiers (sm / md / lg radius) or converge “content card” radius to **16px** unless layout needs softer corners | **Low** |
| **Borders** | Most use `rgba(244, 201, 93, 0.08)`–`0.12` — consistent enough | Optional token `--border-card: rgba(244,201,93,0.12)` | **Low** |

---

## 6. Hover / transition states

| Page / component | What's wrong | Suggested fix | Severity |
|------------------|--------------|---------------|----------|
| **Global** | `.btn` uses `transition: all 0.3s cubic-bezier(...)`; many page-specific chips/filters use `0.2s ease` | Standardize on two timings: `0.2s` micro, `0.3s` buttons/cards — document in comment | **Low** |
| **wiki.html** | `.wiki-nav-item` / `.wiki-btn` use `0.15s` | Keep for snappy editor feel; just note as “dense UI” exception | **Low** |

---

## 7. Empty / loading states

| Page / component | What's wrong | Suggested fix | Severity |
|------------------|--------------|---------------|----------|
| **gallery.html** | Has `.gallery-loading` + spinner and `.gallery-empty` — good pattern | Ensure spinner hides reliably on error (already partially handled in JS) — verify edge cases only | **Low** |
| **changelog / chronicles** | Entries injected via JS — empty state messaging depends on API returning `[]` | Confirm empty arrays render a friendly line (Fredoka + muted cream), not blank feed | **Medium** |
| **support.html** | Static fallback copy when costs fail — OK | — | **Low** |

---

## 8. Mobile breakpoints

| Location | What's wrong | Suggested fix | Severity |
|----------|--------------|---------------|----------|
| **styles.css** | Primary breakpoints **900px**, **768px**, **420px** | Document as official tiers; inner HTML files mostly mirror **768** / **420**; **gallery** adds **900** for grid — OK | **Low** |
| **styles.css** `@media (max-width: 768px)`** | `.mobile-menu a { font-size: 1.1rem }` overrides default **2rem** hero menu — tighter overlay | Verify intentional (readability vs splash aesthetic); if homepage menu feels cramped vs inner pages, bump slightly | **Medium** |
| **wiki.html** | Own `@media (max-width: 768px)` for sidebar — OK | — | **Low** |

---

## 9. Visual hierarchy

| Page / component | What's wrong | Suggested fix | Severity |
|------------------|--------------|---------------|----------|
| **index.html** | Nav omits **Year One** and **Support** links that exist on `changelog.html`, `support.html`, `404.html`, etc. | **UX/navigation consistency (not purely visual):** align link set with inner pages so “most important” destinations match everywhere, or consciously keep homepage minimal and document in one line in `CLAUDE.md` | **High** |
| **index.html** `brand-mark`** | Links to `#hero` vs other pages linking to `/` | Minor: “logo” behavior differs — use `/` everywhere for predictability | **Low** |

---

## 10. Dead / unfinished UI

| Page / component | What's wrong | Suggested fix | Severity |
|------------------|--------------|---------------|----------|
| **year-one.html** | `*, *::before, *::after { margin:0; padding:0; box-sizing }` repeats global reset from `styles.css` | Remove redundant universal reset if safe (verify no cascade reliance) | **Low** |
| **OG images** | Multiple pages reference `og-image.png` — **CLAUDE.md** notes asset may be missing | Not visual polish — track separately | **Low** |

---

## Prioritized fix order

1. **High — Navigation parity (`index.html`)** — Add Year One + Support (desktop + mobile) to match the majority of pages; decide logo `href` (`/` vs `#hero`).
2. **High — Gallery buttons (`gallery.html`)** — Align primary actions with `.btn-primary` tokens (radius, shadow, padding).
3. **High — Year One palette reset (`year-one.html`)** — Stop overriding global `:root` tokens; scope page-specific vars only.
4. **Medium — Token hygiene (`styles.css` + docs)** — Reconcile `CLAUDE.md` palette vs `:root`; optionally add semantic aliases (`--status-green`, etc.).
5. **Medium — Changelog/chronicles empty states** — Verify friendly empty messaging when APIs return no data.
6. **Medium — 404 secondary buttons** — Drop duplicated `.btn-secondary` overrides where possible.
7. **Medium — Mobile menu font size** — Revisit `1.1rem` vs `2rem` tradeoff after nav parity.
8. **Low** — Page padding / max-width normalization, admin `bg-tint` vars, border-radius tiers, transition documentation, wiki micro-button tokens.

---

*End of audit — ready for targeted implementation in a follow-up pass.*
