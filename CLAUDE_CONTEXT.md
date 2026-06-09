# Retro Gaffer — Living Context

> Maintained by Claude. Updated whenever a significant task completes, a major bug is
> fixed, or work wraps for the day. Treat this as the source of truth for "where are we."
>
> **Last updated:** 2026-06-09

---

## 1. Tech Stack & Architecture

A 100% client-side, no-backend football auto-battler (browser SPA).

- **Framework:** React 18 + TypeScript, built with Vite 5.
- **Styling:** Tailwind CSS 3 (+ PostCSS, autoprefixer). Custom theme tokens (`crt-green`,
  `crt-amber`, `pitch-*`, `chrome-*`, `font-display`/`font-ticker`).
- **State:** a single Zustand store (`src/store/useGameStore.ts`). The whole UI is a
  projection of this store; persistence to `localStorage` via `src/store/persistence.ts`.
- **Animation / interaction:** Framer Motion; drag-and-drop via `@dnd-kit/core`.
- **Other libs:** `lz-string` (compact save/share codes), `lucide-react` (icons).
- **Testing:** Vitest. Unit tests in `tests/`; a separate balance simulation harness
  (`tests/balance.sim.ts`, `vitest.sim.config.ts`, `npm run sim`).

**Architecture principle:** pure game logic lives in `src/lib/` (rng, chemistry, economy,
engine, codec, formations, packs, ladder, relics, effects, bosses, events, daily,
savecode) — deterministic and fully unit-tested. UI components in `src/components/` are
thin and read from the store.

**Player data:** `src/data/players.json` (503 players) is compiled/validated from CSV by
`scripts/generate_players.py` (a Python tool, run manually — not part of the JS build).

**Deploy:** static SPA → `dist/`. **Live at https://retro-gaffer.vercel.app/** via Vercel
Git integration — pushing to `origin/main` auto-builds (`npm run build`) and deploys. No
`.vercel` link or CI workflow in-repo; the connection lives in the Vercel dashboard.
Netlify config (`netlify.toml`) is also present but Vercel is the live host.

---

## 2. Current State (built & confirmed working)

The game is feature-complete and stable. Implemented and passing:

- **Roguelike season** — 12-round ladder (Sunday League → Champions League Final), 3
  lives, escalating opponents, bosses, events, daily challenge mode.
- **Economy** — round income, interest, win-streak bonus, wages, Gaffer's Gamble wager,
  life buyback.
- **Transfer market** — themed packs (All-Stars / league / decade / Cult Heroes / premium
  Icon Pack), 3 offers, paid refresh, shop lock.
- **Tactics** — 4 formations (4-4-2 / 4-3-3 / 3-5-2 / 4-2-3-1), drag-and-drop or
  click-to-assign, FUT-style rarity cards and chemistry (shared tags grant +10%).
- **Match engine** — deterministic seeded xG sim, rendered as a retro text ticker.
- **Async PvP** — export XI to a `GAFFER-1-…` code or `?vs=` challenge link; import to play.
- **Save/load** — persistence + corrupted-save recovery.

**Quality gates (as of last update):**
- `npm run build` — green (tsc -b + vite build).
- `npm test` — **101/101 passing** across 10 files. (Note: README still says "68 tests" —
  stale.)

---

## 3. Active Work

**Mobile responsive pass — DONE & committed.**

Made the whole UI fit narrow phone screens. Changes:
- `src/components/pitch/Slot.tsx` + `Pitch.tsx` — compact slot sizing and tighter gaps
  below the `sm:` breakpoint.
- `src/components/ui/Hud.tsx` — added `flex-wrap` so the bankroll/best/Daily/buttons row
  reflows instead of overflowing.
- `src/components/pitch/FormationSelector.tsx` — added `flex-wrap`.

Verified live at **both 375px and 320px**: zero page-level horizontal overflow; HUD wraps,
formation bar fits, pitch (incl. filled slots) lays out cleanly (slots flex-shrink to fit
at 320px); shop/squad collapse to single column.

**Status:** DONE and **deployed to production**. Merged to `main` (commit `389d57e`),
pushed to `origin/main`, and Vercel auto-built it. Verified live — the deployed bundle
(`index-CkXiRhYP.js`) contains the new layout and no longer the old `h-24 w-28` slot.

**Next up:** nothing active. Awaiting the next task.

---

## 4. Key Decisions & Quirks

- **Dev server port:** `.claude/launch.json` pins Vite to port **5180** with
  `--strictPort` (because port 5173 is often already taken by a running dev instance).
  Vite ignores the `PORT` env var, so `autoPort` alone doesn't work — must pass `--port`.
- **Determinism is sacred:** all game logic is seeded (`src/lib/rng.ts`). Daily mode and
  PvP rely on identical seeds producing identical results. Don't introduce
  `Date.now()`/`Math.random()` into `src/lib/` logic paths.
- **Single source of truth:** never hold game state in component state — it belongs in the
  Zustand store so save/load and the match flow stay consistent.
- **Player DB is generated:** edit the CSV + `scripts/generate_players.py`, not
  `players.json` by hand.
- **Tailwind, not CSS files:** styling is utility classes inline; respect the custom theme
  tokens rather than hard-coding colors.
- **Living-doc rule:** update THIS file whenever a significant task/bug/day wraps.
