# Cozy Crafters SMP — Website Project

## What This Is

The official website for Cozy Crafters SMP, a Minecraft survival server. Built as a static site on GitHub Pages with a Cloudflare Worker backend. The site has a community gallery with comments, a patch notes system with emoji reactions, a server newspaper called The Cozy Chronicles, a donation/support page, a staff-only wiki, and a full admin panel.

**Live site:** https://cozycrafters.net
**Repo:** https://github.com/Cheddah01/cozy-crafters-web

---

## Architecture

### Frontend
- **Static HTML/CSS/JS** on GitHub Pages — no framework, no build step
- Custom domain: `cozycrafters.net` (DNS on Namecheap → GitHub Pages IPs)
- Shared stylesheet: `styles.css`
- Auth system: `auth.js` (Discord OAuth, stores token as `ccAuthToken` in localStorage)
- Inline admin editing: `inline-admin.js` (side panel for changelog, modal for chronicles)

### Backend API
- **Cloudflare Worker** at `cozy-crafters-api.colbysthickey.workers.dev`
- Code lives in `worker.js` — paste into Cloudflare dashboard to deploy
- All endpoints prefixed with `/api/`

### Database
- **Cloudflare D1** (SQLite) — binding name: `DB`
- Database name: `cozy-crafters-db`

### File Storage
- **Cloudflare R2** bucket: `cozy-crafters-media` — binding name: `MEDIA`
- Public URL: `https://pub-36f7c4945e55454d8abcd89643e95937.r2.dev`

### Auth
- Discord OAuth via app ID `1495223646283890719`
- Worker secrets: `AUTH_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `JWT_SECRET`
- JWT stored as `ccAuthToken` in localStorage (NOT `ccToken` — this has caused bugs before)

---

## Pages

| File | Public | Description |
|------|--------|-------------|
| `index.html` | Yes | Homepage — cycling video backgrounds, splash text, server IP copy, live server status with player heads, anniversary banner, donation section |
| `changelog.html` | Yes | Patch notes — structured changes builder, custom tags, emoji reactions (👍🎉❤️🔥😂), share links with deep-linking, Notion-style side panel editor |
| `chronicles.html` | Yes | Newspaper — Playfair Display masthead, rotating slogans, sections, classifieds, corrections, editor's notes, pull quotes |
| `gallery.html` | Yes | Community gallery — multi-image posts, tags, Instagram-style lightbox with sidebar comments, external URL support, comment count badges |
| `support.html` | Yes | Donation page — animated progress bar, PayPal button, dynamic cost breakdown from admin |
| `year-one.html` | Yes | Anniversary retrospective — standalone design, player stats, leaderboards, era timeline |
| `wiki.html` | Staff only | Staff wiki — sidebar navigation, markdown editor with toolbar, categories, preview mode |
| `admin.html` | Admin only | 7-tab admin panel (Backgrounds, Splash Text, Patch Notes, Chronicles, Gallery, Support, Users) |
| `auth-callback.html` | — | Discord OAuth token handoff, redirects to `ccAuthReturn` or `/` |

### Supporting Files
- `styles.css` — Shared stylesheet with CSS variables
- `auth.js` — Login state, nav auth UI, Discord login redirect
- `inline-admin.js` — On-page editing for changelog and chronicles
- `robots.txt` — Allows all crawlers, points to sitemap
- `sitemap.xml` — Lists all public pages
- `favicon.png` — Custom logo
- `CNAME` — Contains `cozycrafters.net`

---

## Database Schema

### Settings (key-value store)
Used for: `splashText`, `changelog`, `changelogTags`, `chronicles`, `chroniclesSections`, `chroniclesConfig`, `supportCosts`, `background`

### Users
`id, discord_id, username, avatar, role, created_at, last_login`
- Roles: `admin`, `moderator`, `member` (default)
- Admin users: cheddah01 (`350372554785161218`), biscuitbouncer (`526860861785243648`)

### Reactions
`entry_id, user_id, emoji` — emoji reactions on changelog entries

### Gallery
`id, user_id, title, caption, tags, external_url, created_at`

### Gallery Images
`id, post_id, image_url, sort_order`

### Gallery Comments
`id, post_id, user_id, body, created_at`

### Wiki Pages
`id, slug, title, category, content, updated_by, created_at, updated_at, sort_order`

---

## Worker API Endpoints

### Auth
- `GET /auth/discord` → redirect to Discord OAuth
- `GET /auth/discord/callback` → exchange code, create/update user, issue JWT
- `GET /api/me` → current user from JWT
- `GET /api/users` → admin list all users
- `PUT /api/users/:id/role` → admin change role

### Settings
- `GET /api/settings/:key` → public read
- `GET /api/settings` → public read all
- `PUT /api/settings/:key` → admin write

### Reactions
- `GET /api/reactions/:entryId` → counts + user reactions
- `GET /api/reactions-bulk?ids=...` → bulk load
- `POST /api/reactions/:entryId` → toggle reaction

### Gallery
- `GET /api/gallery?limit=&offset=&tag=` → paginated posts with images, user info, comment counts
- `POST /api/gallery` → create post (images and/or external_url)
- `POST /api/gallery/upload` → upload image to R2
- `DELETE /api/gallery/:id` → owner/admin delete

### Gallery Comments
- `GET /api/gallery/:id/comments` → list with user info
- `POST /api/gallery/:id/comments` → add comment (login, 500 char max)
- `DELETE /api/gallery/comments/:id` → owner/admin delete

### Wiki
- `GET /api/wiki` → list all pages (staff only)
- `GET /api/wiki/:slug` → get page (staff only)
- `POST /api/wiki` → create page (admin only)
- `PUT /api/wiki/:slug` → update page (admin only)
- `DELETE /api/wiki/:slug` → delete page (admin only)

### Media
- `POST /api/upload` → admin upload to R2 (up to 200MB)
- `GET /api/uploads` → admin list R2 files
- `DELETE /api/upload/:key` → admin delete

---

## Design System

### Palette
- `--sun: #F4C95D` — gold accent
- `--sun-deep: #C9A23B` — gold shadow
- `--cream: #FFF4DC` — text/light
- `--ink: #1A1A12` — dark background
- `--moss: #6B8E4E` — green accent
- `--moss-dark: #2F4423` — dark green
- `--bark: #5C3D2E` — brown
- `--bark-deep: #3D2B1F` — dark brown

### Fonts
- **Fredoka** — headings, buttons, display text
- **Nunito** — body text, labels, descriptions
- **Playfair Display** — Chronicles masthead only

### In-Game Branding (separate from website)
- Server pink: `&#FFAAD4`
- Decorator: `✦`
- GUI format: `&#HEX&l&n` per-character gradient display names in small caps Unicode

### Design Patterns
- Cards: `rgba(255, 244, 220, 0.03)` background, `rgba(244, 201, 93, 0.12)` border
- Buttons: gold background with `box-shadow: 0 4px 0 var(--sun-deep)`
- Status green: `#A8C77E`
- Error/delete red: `#E87070`
- External link blue: `#8BB8E8`

---

## Key Decisions & Preferences

- **No frameworks** — static HTML/CSS/JS, no React/Next/Astro
- **No forums** — Discord is sufficient for discussions
- **Config editing discipline** — never reformat, restructure, or add comments to existing YAML files; only make targeted edits
- **PayPal for donations** — not Tebex/Ko-fi
- **Earthy palette** — NOT the server's in-game pink (#FFAAD4)
- **Auth token key** — stored as `ccAuthToken`, NOT `ccToken` (this has caused bugs)
- **Avatar URLs** — stored as full URLs in DB, not just Discord hashes
- **SEO** — meta descriptions, canonical URLs, JSON-LD on homepage, submitted to Google Search Console
- **Mobile responsive** — all pages have mobile breakpoints

---

## Server Context

Cozy Crafters is a Paper 1.21 Minecraft SMP hosted on RawPower (Pterodactyl panel). The owner is Colby (cheddah01 / Cheddah). The server has a community-first identity — cozy, low-friction, personality-driven.

### Key Plugins
LuckPerms, Vault, EssentialsX, DeluxeMenus, GriefPrevention, CoreProtect, LiteBans, Multiverse-Core, PlotSquared, ShopGUI+, PhoenixCrates, CrazyVouchers, AxRewards, AxRankMenu, AxQuestBoard, AxDarkAuctions, DTLTraders, AuraSkills, PlayTime, NickCloud Lottery, HeadDatabase, Citizens2, AxKills, AxBoosters, ChatManager, DeluxeTags, MoneyPouchDeluxe, VotifierPlus, VotingPlugin

### Rank System
Ore-themed: Iron → Gold → Emerald → Diamond → Netherite

### Regular Players
cimou, Coshmee, Rodrigo, biscutbouncer, zer0vr09, puzzle4770, aloe202

---

## What's Been Built (Completed)
- ✅ Full website with 8 pages
- ✅ Cloudflare Worker API with D1 + R2
- ✅ Discord OAuth login
- ✅ Admin panel (7 tabs)
- ✅ Gallery with multi-image posts, comments, external URLs, lightbox
- ✅ Changelog with reactions, share links, structured builder, side panel editor
- ✅ Chronicles newspaper with inline editing
- ✅ Support page with donation goal bar
- ✅ Staff wiki with toolbar editor and preview
- ✅ User role management (admin panel)
- ✅ Live server status with player heads (mcstatus.io)
- ✅ Year One anniversary page
- ✅ SEO (meta tags, sitemap, JSON-LD, Google Search Console)
- ✅ VotingPlugin + VotifierPlus reward config
- ✅ Server listing descriptions and voting setup

## Pending / Possible Future Work
- 🔲 Upload og-image.png (1200x630) to repo for Discord embed previews
- 🔲 LiteBans web integration via Cloudflare Hyperdrive (started discussion, not built)
- 🔲 Discord webhook for patch note publishing
- 🔲 404 page
- 🔲 Server listing submissions (some done, more to go)
