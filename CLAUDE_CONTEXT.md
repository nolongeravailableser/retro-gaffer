# Retro Gaffer — Living Context

> Maintained by Claude. Updated whenever a significant task completes, a major bug is
> fixed, or work wraps for the day. Treat this as the source of truth for "where are we."
>
> **Last updated:** 2026-06-11 (Compete tab + leaderboard live + feedback roadmap Phases 1–2 shipped; persistence v19, 233 tests — see §2l)

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
- **Tabbed nav** (`src/components/nav/TabNav.tsx`): **Tactics / Transfers / Season /
  Challenges / PvP / Records / Club** — flat, no nesting (the old "More" tab was split
  out 2026-06-10; **Club** = ClubSettings + SavePanel, the one deliberate merge).
  Desktop sticky top bar (`overflow-x-auto` for narrow widths); mobile fixed bottom nav
  (7 icon-led items with micro labels, ~53px each at 375px). (Squad was merged into
  Tactics.)
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
- `npm test` — **224/224 passing** across 24 files. `npm run test:e2e` — Playwright
  smoke test (full core loop in a real browser). `npm run sim` — balance harness.

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

## 2b. QA Audit-Fix Pass (2026-06-10 — shipped, commits `9c6dea9`…`d38ce74`)

A full QA/UX audit produced a 22-item report (bugs / gameplay / UX); all actioned
except the round-4 boss (left as intentional comic relief). Shipped in the working
tree (build + 153 tests green):

- **End-of-run moment** — new `RunOverModal.tsx` (App-level overlay, shown over any
  tab when `runStatus !== 'playing'`): animated win/lose reveal, stats, **mode-aware
  replay** (Retry Challenge / New Career / Replay Daily / New Endless Run), and a
  career **shortfall line** (board demand vs. reached). Replaces the silent inline
  swap and fixes the "lost run + red card dropped you to Tactics with no signal" flow.
  SeasonPanel's inline end card remains as the dismissed-state fallback (its replay is
  now mode-aware too).
- **Toast tones** — store gained `noticeKind: 'error'|'success'|'info'`; `Hud` styles
  colour/icon/lifetime per kind (errors linger 4.5s, success 1.8s) and the toast is
  tap-to-dismiss. Success messages ("Signed X!", shield-saved) no longer look like red
  errors.
- **In-match discipline** (`engine.ts`) — reds/injuries now **swing the live match**
  (offending side scores less, concedes more for the rest of the game), and the
  **opponent (side B) can pick up reds/injuries too** (in-match + commentary only;
  player-side suspensions/injuries still the only persisted ones). GKs no longer score.
- **Relic carry-over** — an unclaimed relic offer is no longer overwritten on round
  advance (carried until claimed/dismissed). Relic claim now has a confirm step.
- **Daily integrity** — `dailyCompleted` (persisted, **v15**) records the day's run;
  replays are "practice" and don't re-bank the score; Daily popover warns.
- **`best.round` is now per-finite-climb** — Endless/scenarios no longer pollute the
  Classic career-best crown / "NEW CAREER BEST" banner.
- **Match payout** — the full net (result+income+interest+streak−wages±bet) + resulting
  bankroll now show in the match result banner for ladder games (`MatchView` reads
  `lastIncome`), not only on the Season tab afterward.
- **Smaller UX** — New Game confirms before wiping an in-progress run; active-ruleset
  line on the Season panel; disabled-button tooltips (Play / Refresh); clearer fuzzy
  youth-potential stars; honest StatBar at the low end; career-advance notice names
  the signed youth.

Files touched: `store/useGameStore.ts`, `store/persistence.ts` (v15), `lib/engine.ts`,
`lib/ladder.ts` (comment), `components/match/MatchView.tsx`, `components/ui/Hud.tsx`,
`components/ui/StatBar.tsx`, `components/ui/Stars.tsx`, `components/season/SeasonPanel.tsx`,
`components/season/EventBanner.tsx`, `components/run/NewRunModal.tsx`,
`components/run/RunOverModal.tsx` (new), `components/career/CareerReview.tsx`,
`components/shop/Shop.tsx`, `App.tsx`, `tests/engine.test.ts` (+1).

---

## 2c. First-Time User Experience (FTUE) — onboarding + club identity (shipped, `7dbf2c8`)

A brand-new visitor now gets onboarding; players can name their club.

- **Club identity** — store gained `clubName`/`managerName` (+ `onboarded`), all
  **top-level persisted** (survive New Game / mode switches), in `saveSlice`, and
  round-tripped by save codes. `completeOnboarding(club, manager)` sets them (trim,
  24-char cap). The name flows into the match scoreboard (`playerTeam.name`),
  the header subtitle, the SquadList header, the PvP export code, and the share text
  (`formatRunResult` gained an optional `clubName`). Falls back to `'Your XI'`.
- **First-run detection** — persistence **v16**: the migration marks any *existing*
  save `onboarded: true` so live players are never walled; a truly fresh install (no
  save to migrate) keeps the create() default `onboarded: false` → onboarding shows.
- **`OnboardingModal.tsx`** (App-level, z-70) — stage 1 club/manager setup (with a
  "Surprise me" randomiser + Skip), stage 2 a 4-card mechanics carousel
  (Draft → Tactics/Chemistry → Season/lives/bosses → Modes/Daily). Rendered when
  `!onboarded || tutorialOpen`.
- **`ClubSettings.tsx`** (More tab) — rename club/manager any time (reuses
  `completeOnboarding`) and a **Replay tutorial** button (opens the modal in
  `tutorialOnly` mode — carousel only).
- Tests: `tests/savecode.test.ts` +2 (v16 migration marks existing saves onboarded;
  club identity round-trips). Verified live: fresh flow names the club → propagates to
  header/squad/persistence; reload doesn't re-onboard; replay-tutorial works.

---

## 2d. Career progression flow — the "how do I start?" fix (shipped, `655d4ed`)

The kick-off action used to live only at the bottom of the Season tab, so after
building a squad (on Tactics/Transfers) players — especially in Career, and
especially on mobile where it sat below the fold — had no clear path to start.

- **Always-visible kick-off CTA** ([App.tsx](src/App.tsx)) — a sticky bar rendered
  under the TabNav whenever `runStatus === 'playing'` and no match is open. It's the
  single primary action: not ready → "Fill your XI to kick off · X/11" (routes to
  Tactics); ready → "Start Season N" (Career R1) / "Play Round N" — routes to the
  **Season** tab from elsewhere (so stakes/wager stay accessible), and **plays
  directly** when already on Season. Sticky `top-0` (mobile) / `top-[3.25rem]`
  (desktop), so it's above the fold everywhere and clears the fixed bottom nav.
- **Season-tab readiness dot** ([TabNav.tsx](src/components/nav/TabNav.tsx)) — a
  pulsing green dot on the Season tab (desktop + mobile) when ready & not already
  there, via a new optional `seasonReady` prop.
- **Land on the squad screen when a run starts** — `NewRunModal` gained an optional
  `onStarted` callback; App routes to the Tactics tab so Career/runs always begin on
  squad-building, where the CTA then guides kick-off.
- No engine/store/persistence changes; purely flow/affordance. Verified live at
  375px and desktop (sticky, no nav overlap, no console errors); 155 tests + build green.

---

## 2e. Auto-Pick & Auto-Sign (shipped, `f08c1af`)

One-click squad helpers, both pure/deterministic in `src/lib/autopick.ts` (no RNG,
ties break on id → Daily-safe):

- **`pickBestXI`** — fields the strongest available XI: role-weighted scoring
  (GK/DEF judged on DEF, FWD on ATK, MID balanced), excludes suspended/injured,
  then a bounded chemistry refinement pass (accept same-role swaps that raise the
  `computeChemistry` squad strength — so tag-sharers can beat raw stats). Bench =
  best leftovers, fit players first. Store action `autoPickXI()`; "Auto-Pick" wand
  button in the SquadList header (Tactics tab).
- **`planAutoBuy`** — need-driven signings from the CURRENT 3 offers only: buys
  players whose role the squad can't yet field a full XI with, best chemistry-aware
  value first. **Never chains paid refreshes** and **never spends below
  `AUTO_BUY_RESERVE` (£5M)** — a helper must not drain the bankroll. Store action
  `autoBuy()` reuses `buy()` per slot (re-validates + auto-assigns); "Auto-Sign"
  wand button in the Shop header. No-op paths give an info toast ("squad already
  covers every role" / "no affordable GK in these offers").
- Tests: `tests/autopick.test.ts` (13). Verified live on a fresh run:
  Auto-Sign×refresh loop built an 11-man, all-chemistry squad for ~£38M, Auto-Pick
  fielded 11/11, kickoff CTA flipped to "Ready! Play Round 1".

---

## 2f. Core-loop journey redesign — SIGN → PICK → KICK OFF (shipped, `ec4a4c3`)

Tester feedback: the launch→buy→field→play pipeline had no visual hierarchy. Fixed
with one derived "journey stage" driving the whole UI:

- **`src/lib/journey.ts`** (pure, 6 tests) — `journeyFor(fieldablePlayers,
  formationId, filled)` → `'sign' | 'pick' | 'play'` + missing-role summary
  ("a GK · 2 DEF"). Counts only FIELDABLE players (owned minus banned/injured),
  so a suspension that breaks role coverage correctly re-enters the sign stage.
- **`JourneyBar.tsx`** — replaced the kickoff CTA: a 3-step indicator
  (① Sign → ② Pick XI → ③ Kick Off) over ONE stage-aware primary action
  (routes to Transfers / Tactics / Season, plays when on Season) with the
  matching one-tap helper inline (Auto-Sign on sign, Auto-Pick on pick) and a
  "Still needed: …" detail line. Same sticky placement, mobile + desktop.
- **TabNav** — `seasonReady` generalised to `attentionTab`: the pulsing dot
  follows the stage (Transfers → Tactics → Season).
- **Stage-aware landing** — a new run with an empty squad lands on Transfers
  (was Tactics-with-an-empty-pitch, the single most confusing moment); prebuilt
  squads (career S2+, scenarios) land on Tactics. SquadList gained an
  empty-squad state pointing at Transfers.
- **Auto-Sign consistency** — `autoBuy` need-counting now also uses fieldable
  players only, so it buys emergency cover for a banned/injured-out role
  (matches the journey bar's read).
- Note: because signings auto-assign into the XI, the pick stage is usually
  skipped in the happy path (sign-to-ready in one flow) — it appears when
  players are unplaced (benchAll, formation changes, manual removal).
- Verified live (375px + desktop): fresh run lands on Transfers at step ①;
  Auto-Sign loop → "Ready! Play Round 1"; remove player → step ② with
  Auto-Pick; full loop to kickoff; post-match red card correctly flipped the
  bar back to "sign a FWD" with the dot on Transfers.

---

## 2g. Extended player stats → match-engine integration (shipped, `95794c6`)

Eight stats (`src/lib/stats.ts`), each owning ONE engine lever — nothing
decorative: **PAC/PAS** → chance creation · **SHO** → conversion + scorer
identity · **DEF(ending)** → blunts opponent creation · **GK** (single keeper
stat, tracks a GK's DEF) → blunts opponent conversion · **PHY** → injury
resistance · **CMP** → 75'+ clutch window · **DIS** → who collects cards.

- **Derived, not authored**: `deriveStats(p)` (pure, memoized) = positional
  archetype base (8 Position archetypes + Role fallback) + quality coupling
  (ATK/DEF) + per-player id-hash jitter. Nothing persisted, no players.json
  change, no save/codec/version bump; youth, aged, rivals, bosses covered free.
- **Engine** (`engine.ts`): `teamStatProfile(squad)` aggregates feed a bounded
  xG multiplier (±14% clamp — stats season the ATK/DEF core, never replace it);
  composure swings per-minute rates after 75' (±7%); `pickScorer` weights by
  shooting; card/injury victim picks weighted by discipline/physical via a
  one-roll `weightedPick` (RNG consumption per minute UNCHANGED → determinism
  structure intact). New `EngineTuning.statInfluence` master dial (default 1;
  0 reproduces pure ATK/DEF math — tested).
- **UI**: `MiniStats.tsx` — tier-coloured 3×2 grid on ShopCard + PlayerCard
  (keepers swap in GK; full 8 in the tooltip).
- **Balance gate**: `npm run sim` before/after — completion 36.5%→37.2%,
  per-round win% drift ≤3pp, R12 boss unchanged. Tests: `tests/stats.test.ts`
  (11: archetypes, bounds, GK rule, quality coupling, profile aggregates,
  sharp-vs-blunt sensitivity, statInfluence:0 independence, card-magnet share).

---

## 2h. 2D match visualization — the pitch view (shipped, `74876bf`/`0d505bb`)

Playtesters couldn't SEE the action. Architecture: the engine stays an event
generator; a **choreographer** turns its event timeline into 2D scenes.

- **`src/lib/matchviz.ts`** (pure, 9 tests) — `buildVizTimeline(events, seed,
  squadA, squadB, xgShareA)` → one `VizScene` per engine event (build-up →
  GOAL/CHANCE at the right net, foul→card scenes, injury, kickoff/HT/FT set
  pieces; neutral possession weighted by xG dominance between incidents).
  Formation anchors derive from squad ROLES (`anchorsFromSquad`) so any squad
  works (XI, PvP imports, rival spines, partial XIs). Own seeded RNG
  (`{seed}-viz`) — engine RNG untouched (tested: simulateMatch before/after viz
  build is identical). `ballAt(scene, t)` = smoothstep keyframe sampler.
- **`MatchPitchView.tsx`** — ONE canvas + ONE rAF loop, ~23 dots + ball, DPR-
  aware, no per-frame React state, no new deps. Honors prefers-reduced-motion
  (slow static redraws). Team colours: crt-green vs fuchsia.
- **MatchView** — pitch-dominant layout: pitch (16:10, max 38vh) + a compact
  3-line caption feed; "Ticker/Pitch" toggle in the controls swaps to the full
  text ticker. Sync is structural: pitch + ticker both derive from the same
  `(events, shown, speed)` cursor, so 1×/2×/4×/Instant work for free and the
  two views cannot drift.
- Verified live (375px + desktop): canvas pixel-sampling confirmed both teams
  rendered and the ball moving mid-match; toggle round-trips; FT scene under
  the result banner; no console errors. 194/194 tests.

---

## 2i. Team kits — identity for every side (shipped, `0d505bb`)

- **`src/lib/kits.ts`** (pure, 8 tests) — `Kit = {primary, secondary, pattern:
  solid|stripes|hoops|sash|halves}`. Curated 10-colour palette (legible on the
  dark pitch). **Authored kits for all 13 named opponents** (10 rivals + 3
  bosses); unknown names (PvP) hash deterministically to a palette kit.
  `resolveKits(playerKit, oppName)` guarantees contrast: clash → away variant
  (colours swapped) → emergency third kit (tested exhaustively: every palette
  colour × every opponent ≥ CLASH_THRESHOLD apart). `gkColor` keeps keepers
  distinct from their own side. `sanitizeKit` validates untrusted save input.
- **Store/persistence** — `kit: Kit|null` top-level persisted (**v17**),
  `setKit`, `completeOnboarding(club, manager, kit?)`. Migration v17: existing
  saves keep the classic strip (kit: null → DEFAULT_KIT at render).
- **`KitPicker.tsx`** — SVG shirt preview (`KitShirt`) + swatch rows + pattern
  chips + randomiser. Lives in BOTH the onboarding flow (new stage: club → kit
  → tour) and ClubSettings (edit any time). Header shows a mini shirt next to
  the club name.
- **Visualizer** — `MatchPitchView` takes `kitA/kitB`; dots are painted shirt
  colour + pattern overlay readable at dot scale; keepers wear a contrast
  shirt. `MatchView` resolves the fixture's kits via `resolveKits`.
- Verified live: onboarding kit stage → red/white-stripes kit persisted →
  match showed Crimson Casuals (red stripes) vs Hartlepool Galacticos
  (authored yellow/blue sash), keepers distinct. Note: dev-only HMR errors
  appeared when the component gained props while mounted — clean loads are
  error-free; production unaffected.

---

## 2j. Improvement program (2026-06-10 PM — shipped, commits `0ab8455`…`1b2d88b`)

All proposals from the improvement review, built in one pass on the
`improvements` branch (commits 0ab8455..f9d4d7c):

- **Interactive match** (the headline): engine simulation SEGMENTED
  (`simulateSegment`/`MatchCarry`/`finalizeResult`, per-segment RNG streams →
  pause-position-independent determinism; `simulateMatch` composes two halves
  and is parity-tested). **Half-time team talks** (`lib/teamtalk.ts`: attack /
  steady / park, bounded side-A multipliers) and **substitutions** (side-A
  injury pauses with NO penalty; same-role fit bench sub with chemistry-true
  strength recompute, or play on with the knock). MatchView rebuilt around a
  streaming `LiveMatch` state machine; PvP runs it non-interactively. Balance
  re-gated (39.0% completion). 6 new tests.
- **Feel**: WebAudio retro sound cues + device-level mute (`lib/sound.ts`, no
  assets); post-match shots/goals/cards panel; `MatchEvent.playerName` → the
  pitch GOAL flash credits the scorer; seeded SVG **club crests**
  (`CrestBadge`, header + both scoreboard sides).
- **Content**: 3 new scenarios — Giant Killing (drop in at the R8 boss),
  Moneyball (roundIncome 1, starred by peak bankroll), One Shot (1 life).
- **Retention**: 14 **achievements** + Records trophy cabinet
  (`lib/achievements.ts`, snapshot-evaluated in resolveRound, persistence **v18**), unlock toasts.
- **Health**: top-level **ErrorBoundary** (reload + raw-save clipboard rescue;
  already proved itself catching an HMR transient); **Playwright smoke test**
  (`npm run test:e2e`, answers decision windows); **PWA** (vite-plugin-pwa
  autoUpdate SW, icons generated by `scripts/generate_icons.mjs` — a
  dependency-free PNG encoder).
- **Daily leaderboard** (shipped after the program): the project's FIRST
  backend — `api/daily.ts`, one Vercel function over Upstash Redis REST
  (sorted set per day, ZADD GT keeps each device's best, 7-day TTL, bounds-
  checked but not cheat-proof by design). Client (`lib/leaderboard.ts`):
  anonymous device id, per-day deduped fire-and-forget submit on Daily finish
  (RunOverModal), `DailyLeaderboard` panel in RunOverModal + Records + the
  **Compete** tab (the PvP tab, renamed 2026-06-10 to host async PvP *and* the
  world standings under one roof; it sits below the PvP panel in `App.tsx`).
  **LIVE as of 2026-06-10**: Upstash Redis (`upstash-kv-carmine-chair`) is
  provisioned and connected; prod `/api/daily` returns 200 (verified). The
  function reads `KV_REST_API_URL`/`KV_REST_API_TOKEN` (Upstash's default Vercel
  env names; falls back to `UPSTASH_REDIS_REST_*`). **Degradation tiers**:
  `entries === null` (offline/503/dev — Vite has no `/api`) hides the board;
  `entries === []` (live but no scores yet today) shows a "be the first" empty
  state; non-empty shows the ranked list. Board populates when a Daily run
  finishes (RunOverModal posts the score).

---

## 2k. QA Audit #2 fix pass (shipped, commits `24cdcf1`…`a48181b`)

Second full audit after the improvement program; 12 verified findings, all
fixed (several agent-reported "bugs" were verified FALSE and rejected: Instant
cannot skip pauses, tutorial replay never enters setup, subbed-on players
being suspendable is correct football):

- **Match suspend/resume (B1)**: closing the modal mid-match keeps the
  LiveMatch (keyed by fixture seed); reopening resumes at the same minute.
- **AI half-time response (G1)**: `aiTalkFor(scoreFor, scoreAgainst)` —
  trailing 2+ → attack, leading 2+ → park, else nothing; announced in the
  ticker. Deterministic, readable, kills the park-the-bus dominance.
- **Whistle semantics by TEXT (B2)**: engine exports KICKOFF/HALFTIME/FULLTIME;
  sound + viz match those instead of minutes 0/45/90 (sub at 45' ≠ half-time).
- **Dynasty timing (B3)**: snapshot careerSeasons mirrors the sacked path's
  careerBest write (season − 1) — no more one-career-late unlocks.
- **Crash rescue (B4)**: ErrorBoundary copies an importable GAFFER-SAVE code.
- **Achievements (G2)**: champions excludes Dailies; new Gauntlet Conqueror.
- **Speed-gated sound (G3)**, **single Season-tab CTA (U1)**, **60s
  leaderboard cache (U2)**, **instant kit edits in Club settings (U3)**,
  **"Skip setup" label (U4)**, caption keys + shirt aria-label (U5).
- Verified live: suspend at 34' (2:0) → resume at 35' (2:1); single CTA
  confirmed; full match through HT decision clean. 224 tests, e2e, build green.

---

## 2l. User-feedback roadmap (2026-06-11) — Phase 1 shipped (`a67fec7`)

A ~25-point batch of player feedback was triaged into groups and a 4-phase
plan (user-approved sequencing). Forks the user locked in for Phase 4:
**league = new mode alongside the roguelike** (not a replacement); **finances
= full FM-style** (per-player wages by rating + wage budget + league-scaled
rewards, re-gated via `npm run sim`); **player positions = inferred
programmatically** from existing single position (confirm before building).

**Phase 1 — quick wins (SHIPPED `a67fec7`):**
- Match speed: added **0.5× "immersive"** pace; 1× calmed to 650ms/event
  (`SPEED_DELAY` in `MatchView.tsx`).
- **Numeric Gaffer's Gamble** stake input beside None/¼/Max (`SeasonPanel.tsx`,
  `data-testid="wager-input"`).
- **Sell** now a labelled "Sell <value>M" under a SELL column + a two-step
  confirm (arms "Sure?", second tap commits, tap-away cancels) — `SquadList.tsx`.
- **Clear Squad** button exposes the existing `benchAll` beside Auto-Pick.
- **Assign feedback**: `placeInSlot` (store) was a silent no-op on role
  mismatch — now sets an explanatory error notice (the real cause of the
  "can't drag bench→position" report; drag itself was always wired).
- **Pitch-slot BAN / injury (NR) badge + rose ring** when a fielded starter
  is unavailable (`Slot.tsx`/`Pitch.tsx`) — previously only shown in the list.
- Note: Auto-Sign (Shop header) and Auto-Pick-skips-unavailable were already
  shipped before this pass.

**Phase 2 — match experience (SHIPPED 2026-06-11, commits `b82d284`…`6c3738c`):**
- **2.1** engine per-player attribution: `MatchEvent` gained `playerId` +
  `assist`/`assistId`; `pickScorer` returns the Player; `pickAssister` draws
  from a SEPARATE seeded stream (`{seed}-assist-…`) so scores stay
  byte-identical (sim still 39.0%). Cards/injuries carry ids too.
- **2.2** `lib/ratings.ts` — `matchRatings` (3.0–10.0, FM-flavoured,
  deterministic, MOTM) + `accrueHistory`/`avgRating`.
- **2.3** `components/match/MatchReport.tsx` — key-events timeline (scorer +
  assist + minute, cards, injuries, both sides) + side-A ratings (sorted,
  MOTM star, chips). Live ratings panel (collapsible) during play + full
  report at FT in `MatchView`.
- **2.4** out-of-position subs: any fit bench player can replace an injured
  one; off-role plays at 90% (`OUT_OF_POSITION`, a −10% stat clone) — fixes
  "can't sub when injured".
- **2.5** richer, context-aware commentary (bigger pools + opener/equaliser/
  late-winner goal lines; RNG-safe).
- **2.6** player histories: `playerHistory` (per-run, **persistence v19**),
  accrued in `resolveRound`, shown inline in `SquadList`
  ("N apps ★avg G⚽ A🅰 ×MOTM").
- Note: ratings/history credit the STARTING XI (subbed-on scorers are an
  unrecorded edge case). Persistence is now **v19**; tests **233**.

**Remaining phases (NOT started):**
- **Phase 3 — 2D pitch overhaul**: players are static on formation anchors
  with only micro-drift; ball teleports between keyframes. Make it read like
  football (off-ball movement, ball travelling through players, possession
  shape). Pure viz layer, determinism-safe (separate `{seed}-viz` RNG).
- **Phase 4 — big systems**: dynamic positions + formations (granular slots,
  out-of-position penalty), full FM finances/wages, League-Season mode +
  table, career stadium development. Each needs its own design pass +
  balance re-gating.

---

## 3. Active Work & Next Directions

**In flight: the user-feedback roadmap (§2l).** Phases 1 (quick wins) and 2
(match experience) are shipped; **Phases 3–4 are the next work** (2D pitch
overhaul → big systems). See §2l for the full plan and the locked forks.

All earlier work — planned phases (0–3), the 2026-06-10 mega-session
(sections 2b–2i: QA fixes, FTUE, journey bar, auto-pick/auto-sign, flat nav,
extended stats, 2D pitch view, team kits), the improvement program (§2j:
interactive match, sound, crests, achievements, ErrorBoundary, e2e, PWA, Daily
leaderboard) and QA audit #2 (§2k) — is shipped and deployed. Persistence is at
**v18**; tests at **224/224** across 24 files.

**Former candidate next steps — now all shipped** (the 2026-06-10 PM
improvement program + leaderboard delivered the list below; kept here as a
pointer to where each landed):
1. **Interactive match pass** — half-time team-talks + substitutions → §2j;
   AI half-time response → §2k (G1).
2. **Feel** — retro sound + post-match shots/goals/cards panel + scorer-name
   flash + seeded club crests → §2j.
3. **Retention** — Daily leaderboard (first backend) → §2j; achievements +
   trophy cabinet → §2j (G2 refinement in §2k); 3 new scenarios → §2j.
4. **Health** — top-level ErrorBoundary (save-code rescue, hardened in §2k B4),
   Playwright smoke test, PWA/offline install → §2j.

**Still open (deliberately deferred, not bugs):**
- **G5** — the round-4 "gift" boss stays deliberately easy (comic relief);
  revisit only if a twist is wanted.
- **Daily leaderboard activation** — code ships dark; provision Upstash Redis
  in the Vercel dashboard (Storage → Upstash Redis → connect → redeploy) to
  light it up. No code change needed (see §2j).

Historical note: the original game-modes roadmap (Phases 0–3, commit `4f8a14d`
onward) is fully delivered — details in §2. The surviving roadmap item,
"evolve one-shot events into branching tactical dilemmas", was folded into the
interactive-match work (§2j).

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
