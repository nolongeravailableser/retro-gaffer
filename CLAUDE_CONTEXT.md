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

**Gameplay-issue fixes (in progress this session).** User is reporting issues one at a
time; I diagnose and propose, then fix on approval.

- **#1 Starting balance too low — DONE (uncommitted).** £15M couldn't afford a full
  16-man squad. Pool analysis: avg player £3.15M, cheapest legal squad ~£26M, average
  squad ~£50M. Raised `STARTING_BANKROLL` 15 → **50** in `src/lib/economy.ts` so a full
  average-cost squad is buyable at kickoff. All 101 tests pass; verified live (fresh game
  shows £50M). NOT yet committed/deployed. ⚠️ Balance impact: near-max interest from the
  start (cap £8), full squad now incurs wages (>13 owned), early `ROUND_TARGET` rounds get
  easier — revisit difficulty if it feels off.
- **#2 Match could start without a full XI — DONE (uncommitted).** Play was gated on
  `filled > 0` (any 1 player). Now gated on a complete XI (`filled === XI_SIZE`, 11) at all
  three entry points in `src/App.tsx` (ladder Play Round, PvP, challenge banner); disabled
  CTA shows progress "Fill your XI (n/11)" (`SeasonPanel` gained a `filled` prop). Build +
  101 tests green; verified live (button disabled 0→10/11, enables at 11/11).
- **#3 "Spend over budget" — NOT A BUG.** Stress-tested: drained bankroll to £0 via
  buying/refreshing, zero overspend — `buy`/`refreshShop`/`buyLife` all hard-check funds
  and `resolveRound` floors bankroll at 0. User confirmed they were mistaken. (Minor edge
  noted, NOT fixed: the Gaffer's Gamble wager is clamped to ½ bankroll only at set-time, so
  a stale stake can exceed current funds — loss still floors at 0. Revisit only if desired.)

---

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

---

**Tab-based navigation — DONE (uncommitted).**

Restructured the UI to a Football Manager-style tabbed layout. Changes:
- New `src/components/nav/TabNav.tsx` — tab bar component. Desktop: sticky horizontal bar below the header with green underline indicator. Mobile: fixed bottom nav bar with icon + label.
- `src/App.tsx` — added `activeTab` state (`Tab = 'formation' | 'squad' | 'transfers' | 'season' | 'more'`). Each tab conditionally renders its content; DndContext stays at the App level. `pb-20 sm:pb-8` prevents content hiding behind the mobile bottom bar.
- Tab layout: **Formation** (Pitch + Bench + FormationSelector + ChemistryPanel), **Squad** (SquadPanel), **Transfers** (Shop), **Season** (EventBanner + SeasonPanel + Play button), **More** (PvpPanel + SavePanel).
- Challenge banner renders above tabs (global, not tab-specific).

Build green (`npm run build`). Verified live: desktop tab bar works, mobile bottom nav works at 375px, all tabs render correctly.

**Status:** DONE, not yet committed/deployed.

---

**Match engine balance fix — DONE (uncommitted).**

`XG_SCALE` was 5, producing ~5 total goals per evenly-matched game. Halved to 2.5 (plus `MAX_XG` 4.5 → 2.5, `MIN_XG` 0.25 → 0.15) so evenly-matched games produce ~2.5 total goals — realistic. Tests updated.

---

**Injury & disciplinary systems — DONE (uncommitted).**

Two new gameplay mechanics integrated into the match simulation.

**Engine (`src/lib/engine.ts`):**
- Per-minute rolls for yellow (`P=0.025`), straight red (`P=0.003`), injury (`P=0.005`).
- Yellow: tracked per player; second yellow = red. At most 1 red card per game.
- Red card → player ID added to `MatchResult.suspensions` (1-game ban).
- Injury → player ID + duration added to `MatchResult.injuries`; duration 60% 1-round, 30% 2-round, 10% 3-round.
- New `MatchEvent.kind` values: `'yellow'`, `'red'`, `'injury'`.

**Store (`src/store/useGameStore.ts`):**
- New state: `suspensions: string[]` (player IDs banned for next match), `injuries: Record<string, number>` (rounds remaining per player ID).
- `resolveRound` processes both fields: suspensions are replaced each round (one-game ban served), injuries are decremented and cleared when they reach 0.

**Persistence (`src/store/persistence.ts`):** bumped to version 8; migration adds empty defaults so existing saves upgrade cleanly.

**UI (`src/components/squad/SquadPanel.tsx`):** red BAN badge on suspended players, orange `XR` badge on injured players (X = rounds remaining).

Quality gates: `npm run build` clean, `npm test` 105/105 (4 new engine tests added).

**Status:** DONE, not yet committed/deployed.

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
