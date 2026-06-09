# Retro Gaffer ⚽

A nostalgic **football auto-battler** for the browser — draft legends across 30 years
of English, Spanish and Italian football, build chemistry, pick your shape, and climb
the league pyramid in a roguelike season. 100% client-side, no backend.

## Features

- **503-player "peak snapshot" database** — EPL / La Liga / Serie A icons, cult heroes,
  hardmen, dead-ball specialists, FM/CM legends and flop memes (1992/93 → 2022/23).
- **Roguelike Season** — a 12-round climb (Sunday League → Champions League Final) with
  3 lives, escalating opponents, and a TFT-style economy (round income + interest +
  win-streak bonus). Persistent career-best high score.
- **Themed shop "Packs"** — draw from All-Stars, a league, a decade, Cult Heroes, or the
  premium **Icon Pack** (guaranteed icon). Lock the shop to hold a target across rounds.
- **Tactics** — 4 formations (4-4-2 / 4-3-3 / 3-5-2 / 4-2-3-1), drag-and-drop or
  click-to-assign, FUT-style rarity cards, and FUT-style chemistry (shared club,
  nationality, era and achievement tags grant +10% each).
- **Deterministic match engine** — a seeded xG simulation rendered as a retro
  Championship-Manager text ticker.
- **Async PvP** — export your XI to a short `GAFFER-1-…` code or a `?vs=` challenge link;
  import a friend's to play it locally.

## Tech

React + Vite + TypeScript · Tailwind · Zustand · Framer Motion · @dnd-kit · lz-string.
Pure game logic lives in `src/lib/` (rng, chemistry, economy, engine, codec, formations,
packs, ladder) and is fully unit-tested; the UI is a projection of a single Zustand store.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest — 111 unit tests
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build
```

## Player database

`src/data/players.json` is the static pool, validated/compiled by
`scripts/generate_players.py`:

```bash
python3 scripts/generate_players.py --check src/data/players.json
python3 scripts/generate_players.py --from data_src/*.csv --out src/data/players.json
```

## Deploy (static)

It's a static SPA — any static host works. Build output is `dist/`.

- **Vercel:** `npx vercel` (or `npx vercel --prod`). `vercel.json` is included.
- **Netlify:** `npx netlify deploy --prod` (or drag `dist/` into the dashboard).
  `netlify.toml` is included.
- **GitHub Pages:** set `base: '/<repo-name>/'` in `vite.config.ts`, `npm run build`,
  then publish `dist/` (e.g. via the `gh-pages` package or an Actions workflow).
