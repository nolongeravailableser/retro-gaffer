# Retro Gaffer — Living Context

> Maintained by Claude. Updated whenever a significant task completes, a major bug is
> fixed, or work wraps for the day. Treat this as the source of truth for "where are we."
>
> **Last updated:** 2026-06-10

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
savecode, **modes**, **playerMeta**) — deterministic and fully unit-tested. UI components
in `src/components/` are thin and read from the store.

**Player data:** `src/data/players.json` (503 players) is compiled/validated from CSV by
`scripts/generate_players.py` (a Python tool, run manually — not part of the JS build).

**Deploy:** static SPA → `dist/`. **Live at https://retro-gaffer.vercel.app/** via Vercel
Git integration — pushing to `origin/main` auto-builds (`npm run build`) and deploys. No
`.vercel` link or CI workflow in-repo; the connection lives in the Vercel dashboard.
Netlify config (`netlify.toml`) is also present but Vercel is the live host.

---

## 2. Current State (built, committed & deployed)

The game is feature-complete and stable. Everything below is **committed to `main` and
live** unless noted.

**Core loop**
- **Roguelike season** — 12-round ladder (Sunday League → CL Final), 3 lives, escalating
  absolute-strength opponents, bosses at R4/R8/R12, between-round events, daily challenge.
- **Economy** — round income, interest, win-streak bonus, wages, Gaffer's Gamble wager,
  escalating life buyback. `STARTING_BANKROLL = 50` (a full average-cost 16-man squad is
  buyable at kickoff).
- **Transfer market** — themed packs (All-Stars / league / decade / Cult Heroes / premium
  Icon Pack), 3 offers, paid refresh, shop lock.
- **Tactics** — 4 formations, drag-and-drop or click-to-assign, FUT-style rarity cards,
  chemistry (shared tags grant +10%).
- **Match engine** — deterministic seeded xG sim (`XG_SCALE = 2.5`), rendered as a retro
  text ticker with speed toggle (1×/2×/4×), instant-result, animated score, live progress.
- **Discipline & fitness** — per-minute yellow/red/injury rolls; red = 1-game ban; injuries
  out 1–3 rounds. Post-match Team News panel; availability enforced (can't field
  suspended/injured players).
- **Async PvP** — export XI to `GAFFER-1-…` code or `?vs=` link; import to play.
- **Save/load** — persistence + corrupted-save recovery; portable `GAFFER-SAVE-…` codes.

**UI structure (Football Manager-style)**
- **Tabbed nav** (`src/components/nav/TabNav.tsx`): **Tactics / Transfers / Season / More**.
  Desktop sticky top bar; mobile fixed bottom nav. (Squad was merged into Tactics.)
- **Tactics tab** = combined squad + formation: pitch/bench/chemistry on one side, a
  compact FM-style squad list (`SquadList.tsx`) on the other. On mobile the squad list
  renders first (above the pitch) so newly-signed players are immediately visible.
- **Rated data presentation** — `StatBar.tsx` (tiered ATK/DEF bars), granular position +
  league badges (`playerMeta.ts`), chemistry preview on shop cards (what a signing would
  add to the current XI), availability strip (`AvailabilityStrip.tsx`).
- **Match stakes** — SeasonPanel shows explicit Win/Draw/Loss payouts that update live with
  the wager, incl. the loss life-cost. Round/lives/streak promoted into the HUD.

**Quality gates (current):**
- `npm run build` — green (tsc -b + vite build). Bundle is code-split via
  `manualChunks` (app / vendor-react / vendor-motion / players-data / dnd) — no >500KB chunk.
- `npm test` — **146/146 passing** across 15 files.

**Records & collection:**
- `collection` (all-time signed player ids) + `bestScore` ({endless, daily}) persisted across
  runs. Recorded in buy / startScenario / advanceCareerSeason and at scored-run end.
- **Records screen** (`RecordsPanel`, More tab): players signed X/503, career-best division,
  best Endless/Daily score, best career (seasons), scenario stars, collection-by-rarity bars.
- (Unseen-weighting deliberately NOT done — would risk Daily's shared-seed fairness, and the
  Scout Network already makes any player findable on demand.)

**Player acquisition (transfer market fairness):**
- **Pity / bad-luck protection** — `dryStreak` (run state) counts refreshes with no
  gold+ on offer; after `PITY_THRESHOLD` (5) the next roll forces a gold+ (`rollWithPity`
  in the store, applied to refresh + round-advance). Resets on any gold+ shown.
- **Scout Discovery Network** (`src/lib/scouting.ts`) — paid, targeted refreshes that
  guarantee a brief-matching player (drawShop's new `mustMatch` predicate). Briefs: each
  role, A Star (gold+), Cult Hero, and **Hidden Gem (easter_egg)** — the formerly
  unfindable eggs (Ali Dia, Jon Mow) are now scoutable on demand. UI: ScoutPanel in the
  Transfers tab. Casts a wide net (rolls All-Stars). Deterministic (seeded) → Daily-safe.
- **Featured Free Agent** (`src/lib/featured.ts`) — a deterministic daily-rotating gold/icon
  player offered at 40% off (`signFeatured` action, `FeaturedBanner` atop Transfers). Same
  for everyone that day. (A themed rotating *pack* was skipped — the thematic tags are too
  small for a 3-slot pack; and milestone-gated eggs were skipped since the Scout Network's
  Hidden Gem brief already makes easter eggs findable on demand.)

**Game modes (Phase 0 + Phase 1 + Phase 2 + Phase 3 shipped):**
- **Classic** — the standard 12-round climb.
- **Endless** — no finish line (`maxRounds: Infinity`), escalating opponents, scored by
  rounds reached. New Run modal lets you pick the mode.
- **Run mutators** — 8 optional run-long modifiers (Glass Cannon, Low Block, Carnage,
  Underdog, High Roller, Last Stand, Steep Climb, Relic Hunter), chosen in the New Run
  modal (or Random); each is a pure `ModeConfig` transform in `src/lib/mutators.ts`.
- **Daily Gauntlet** — deterministic seed + a deterministic "Rule of the Day" mutator +
  a comparable run score (`src/lib/score.ts`). HUD shows live score + active mutator badge.
- **Scenarios** (`src/lib/scenarios.ts`) — authored challenges with prebuilt squads + fixed
  start state + objective + 1–3 star grading (persisted per scenario in `scenarioStars`).
  Three shipped: Smash & Grab (1-life CL final), Hold the Line (survive 6, `finalMustWin:
  false`), Threadbare (broke + a man light). Listed in the **More** tab (ScenariosPanel).
  `runConfig(state)` resolves scenario > mode+mutator everywhere.
- **Career / Dynasty** (`src/lib/career.ts`) — a meta-layer of many seasons; squad +
  bankroll + relics persist between seasons. Each season is a classic 12-round climb with a
  **board target** (`boardTarget(season)`: S1 round 6 → S4+ round 12). Go out before the
  target = **sacked, career over**; meet it → between-seasons **review** (`CareerReview.tsx`):
  board bonus, **academy youth intake** (generated prospects, promote ≤1), and **aging**
  (veterans decline after a 2-season peak, youth grow for 3 seasons). `careerBest` =
  most seasons survived (persisted). Generated/aged players resolve via a **pool overlay**
  (`registerPlayers`/`clearOverlay` in `src/data/pool.ts`), re-registered on rehydrate.
  Started from the New Run modal's Career card.
  - **Youth scouting**: prospects carry a hidden `potential` (Player.potential) shown as a
    fuzzy ★ range; pay `SCOUT_YOUTH_COST` (£4M) in the review to reveal the exact rating
    (`scoutYouth` action + `careerReview.scouted`). Aging growth ramps stats toward potential.
  - **Board variety**: demands escalate to "win the title" once the target reaches the top
    division (`boardWantsTitle`/`boardMet`) — late seasons need a trophy, not just survival.

---

## 3. Active Work

**Game-mode foundation — Phase 0 DONE & deployed (commit `4f8a14d`).**

Introduced `src/lib/modes.ts`: a single `ModeConfig` that parameterizes the rules that were
previously hardcoded (maxRounds, startingLives, startingBankroll, roundIncome, roundTarget
curve, boss schedule, engine tuning, event rates). The `CLASSIC` preset is assembled FROM
the existing constants (one source of truth, no drift). Pure lib functions
(`engine.simulateMatch`/`expectedGoals`, `events.drawEvent`, `bosses.getBoss/bossTeam`,
`ladder.buildRoundOpponent/roundTargetStrength`) gained an optional trailing config arg
defaulting to classic, so all existing callers/tests are byte-identical. Store carries
`mode` in run state (persistence **v9**, migration defaults `mode:'classic'`; save codes
round-trip it). App/MatchView/SeasonPanel/Hud read the active mode. New `tests/modes.test.ts`
(6 tests) locks "Classic == defaults". **No gameplay change — pure refactor keystone.**

**Roadmap (agreed direction):** the game-modes plan is phased —
- **Phase 0** ✅ ModeConfig foundation (done, commit `4f8a14d`).
- **Phase 1** ✅ run **mutators** + **Endless** + scored **Daily Gauntlet** (done — see §2).
  Files: `src/lib/mutators.ts`, `src/lib/score.ts`, `ENDLESS` in `modes.ts`,
  `NewRunModal.tsx`, `startRun` store action, persistence v10 (adds `mutator`).
- **Phase 2** ✅ **Scenarios / Challenges** (done — see §2). Files: `src/lib/scenarios.ts`,
  `ScenariosPanel.tsx`, `Stars.tsx`, `startScenario` action, `finalMustWin` on ModeConfig,
  persistence v11 (adds `scenario` + `scenarioStars`).
- **Phase 3** ✅ **Career / Dynasty** (done — see §2). Files: `src/lib/career.ts`,
  `CareerReview.tsx`, pool overlay in `src/data/pool.ts`, `startCareer`/`advanceCareerSeason`
  actions, `career`/`careerReview`/`careerBest` state, persistence v12.
  **Deferred for a future pass:** youth scouting (narrow potential), transfer negotiations,
  multiple simultaneous board demands.
- **Phase 3:** Career / Dynasty (multi-season persistence, youth academy + scouting,
  aging/regens, board objectives).
- **Cross-cutting:** evolve one-shot events into branching tactical dilemmas.

No active bugs outstanding. Recent UI bug fixes (all committed): New Game/Daily inline
confirm popover (replaced `window.confirm`), squad click-to-assign reliability (drag moved
to a grip handle), squad-list-first-on-mobile.

---

## 4. Key Decisions & Quirks

- **Game modes go through `ModeConfig`:** to add a mode, add a preset to `MODES` in
  `src/lib/modes.ts` and (if needed) thread its config — do NOT fork the engine or
  re-hardcode constants. Keep `CLASSIC` derived from the base constants.
- **Dev server port:** `.claude/launch.json` pins Vite to port **5180** with
  `--strictPort` (5173 is often taken). Vite ignores the `PORT` env var, so `autoPort`
  alone doesn't work — must pass `--port`.
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
