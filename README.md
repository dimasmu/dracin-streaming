# DRA.CIN — Chinese Short Drama Discovery (Angular)

A frontend-only prototype for **DRA.CIN**, a discovery and metadata directory for Chinese short
dramas. Migrated from an HTML/CSS/JS prototype to Angular, styled with Tailwind CSS and PrimeNG,
preserving the original near-black navy + electric indigo visual identity.

This project is a **visual prototype** — it requires no backend and no paid external service. The
watch page is a demo player (no video is actually streamed).

## Stack

- Angular 22 (standalone components, signals, lazy-loaded routes)
- Tailwind CSS v4
- PrimeNG v22 + PrimeIcons
- TypeScript (strict)
- Local fixtures only (`src/app/data/*.ts`) + `localStorage` for bookmarks/preferences

## Run locally

```bash
npm install
npm start          # ng serve → http://localhost:4200
```

## Production build

```bash
npm run build      # ng build → dist/dracin
```

## Routes

`/` Home · `/browse` Catalog · `/drama/:slug` Details · `/watch/:slug/:episode` Watch ·
`/genre` Genres · `/platform` Platforms · `/release-schedule` Schedule · `/bookmarks` Bookmarks ·
`/faq` FAQ · `/contact` Contact · `/dmca` DMCA · `/privacy` Privacy · `/terms` Terms

## Data provenance

- **Sourced fields** (titles, slugs, episode counts) originate from the narto-drama.com episode
  sitemap referenced by the original prototype.
- **Curated demo fields** (genre, platform, subtitle language, rating) are illustrative and marked
  as demo data (`ratingIsDemo`, `isDemoData`).
- Card/hero artwork is generated from a per-title OKLCH tone (gradient + monogram) — no copyrighted
  images are used. The schedule page is an illustrative demo, not sourced release information.

## Design tokens

Defined as CSS custom properties in `src/styles.css` and bridged to Tailwind via `@theme`:
`--bg`, `--surface`(-2/-3), `--fg`, `--muted`, `--border`, `--accent`, `--cyan`, `--success`.
A light theme is available via the header toggle (default is dark).
