# Retro Gaffer — Feature Backlog

> Confirmed feature ideas parked for future implementation. Each entry is a spec, not a
> commitment to scope/timing. Brainstormed with the user; only items the user has
> explicitly confirmed land here. See also the `future-feature-ideas` memory for older
> one-line parked ideas (loans, international call-ups, continental cup, youth-academy
> money sink).
>
> **Before building any item:** model checkpoint (recommend Sonnet/Opus/Fable + wait for
> the user's pick), then gates per CLAUDE_CONTEXT.md "NEXT SESSION" block.

---

## Working order / roadmap (2026-06-13)

Dependency-aware sequence. Two tracks because **Fable was temporarily unavailable when
this was planned** — Track A starts now (Sonnet/Opus); Track B is balance/taste-critical
and waits for Fable. Model per task: **Sonnet** = mechanical/UI/copy on existing data ·
**Opus** = substantial multi-file systems (sim is just a gate) · **Fable** = the quality
of the tuning/feel IS the deliverable. Effort: S/M/L. At kickoff, still do the one-line
model checkpoint and wait for the user's pick.

**Track A — start now**
- *Phase 1 — Readability & match clarity:*
  1. #1 Player profile — Opus (L) — foundation hub; later enriched by C6/A2/N7
  2. E11 Why-you-lost analysis — Opus (M)
  3. R4 Highlights reel + heatmap — Opus (M) — pairs with E11
  4. B5 In-match mentality shift — Opus (S) — reuses team-talk levers
  5. B4 Pre-match briefing + counter — Opus (M)
  6. E12 Squad depth chart — Sonnet (S)
  7. R1 Triaged inbox — Sonnet (S)
  8. #2a Pool audit (read-only stranding check) — Sonnet (S) — informs #2b
- *Phase 2 — Career meta & narrative:*
  9. N4 Project pitch — Opus (M) — extends pledges
  10. D8 Manager perks — Opus (M)
  11. D10 Rivalries — Opus (M) — prereq for N5
  12. N5 Nemesis manager — Opus (L) — after D10
  13. N3 Emergent narrative seasons — Opus (M)
  14. N1 World moves & tells the story — Opus (L)
- *Phase 3 — Flow, depth, reach:*
  15. N2 Smart fast-forward — Opus (M)
  16. R3 Fuzzy scouting — Opus (M) — light balance, sim gate
  17. R5 Individual development plans — Opus (M) — tune growth via sim; optional Fable pass
  18. N6 Async shared world — Opus (L) — backend, optional, last

**Track B — queued for Fable (balance/taste-critical)**
- #2b Pool authoring (Bundesliga/Ligue 1 + thin-role top-up) — Fable (L) — after #2a
- A1 Playing styles — Fable (M)
- A2 Player roles (+ position variety) — Fable (M) — enhances the profile
- A3 Tactical familiarity — Fable (S)
- C6 Signature traits — Fable (M) — then surfaces in the profile
- C7 Growing partnerships — Fable (M)
- R2 Adaptive league (rivalAggression) — Fable (M)
- D9 Develop-and-sell loop — Fable (M)
- N7 Footedness + flank balance — Fable (L)

**Note:** the whole on-pitch tactical-depth wave (A1/A2/A3) is Fable-blocked, so Track A
delivers clarity + meta-narrative depth first; tactical depth follows once Fable returns.

**Per-task definition of done:** every item ends GREEN before it's called complete —
`npx tsc -b` · `npx vitest run` (+ new unit tests for the feature) · `npm run build` ·
`npm run test:e2e` (stop the preview server first — port 5180); if it touches `src/lib/`,
the store, or the economy, also `npm run sim` (Classic 36.8% sacred). Then live-verify in
the browser preview (both viewports), bump persistence + add a migration for any
persisted-shape change, and update CLAUDE_CONTEXT.md.

---

## 🐞 Known bugs (triage — reported 2026-06-13) — ✅ ALL FIXED + PUSHED (same day)

Fixed in one pass (tsc · 457 tests · build · e2e green; balance-neutral — UI/notice only):

- **BUG-1 · Can't submit a transfer bid — ✅ FIXED.** The bid `<input>` was a controlled
  NUMBER whose empty value snapped to `0` mid-edit (`Number('')||0`), and Submit is
  `disabled={bid<=0}` — so clearing it to type your own figure stuck it at 0. Now string-backed
  (`NegotiationModal.tsx`): clear + retype freely, derived `bid` for validation, clearer hints.
  Live-verified: clear→empty (not 0), type "7" → submit enabled → "rejected as derisory".
- **BUG-2 · Selling a £0 player doesn't remove him — ✅ FIXED.** Removal worked in-window
  (verified: 16→15); the real issue was a CLOSED window silently blocking the sell while the
  profile's Sell button no-op'd + closed (looked like a failure). Now `PlayerProfile` Sell is
  window-aware (disabled "Window shut" + reason when closed) and free agents read **"Release"**
  (not "Sell · £0M"), confirm reads "Sure? Tap to confirm". Live-verified in a career.
- **BUG-3 · "Squad full" isn't surfaced — ✅ FIXED.** Was only a desktop `title` tooltip
  (invisible on mobile). `TransferMarket.tsx` now shows a visible rose **"Squad full (16/16) —
  sell or release a player…"** banner + a rose SQUAD·FULL chip. Live-verified at 375px.
- **BUG-4 · Incoming offers are buried — ✅ FIXED (mostly).** R1 already pins offers in the
  inbox's "Action needed"; now the post-match toast also calls them out ("📩 N transfer offers
  — open the inbox to respond", `resolveLeagueRound`). Code-verified (needs a played matchweek
  with an offer to see live). Further surfacing (a home banner) remains optional.

---

## 1. FM-style player profile (✅ SHIPPED 2026-06-13)

**STATUS: built + gated green (tsc · 401 tests · build · e2e · sim baseline unchanged).**
`src/components/player/PlayerProfile.tsx` — full-screen overlay (z-80), context-adaptive
(owned / market / rival), reachable from squad-list rows + TransferMarket cards. Store gained
transient `profilePlayerId` + `openProfile`/`closeProfile` (NOT persisted → no version bump).
Surfaces the previously-hidden data: discipline (DIS), eligible positions ("Can play"),
humanized chemistry links, contract years + Bosman flag, age/development, market/sell value,
wage. Owned actions = Field/To-bench/Sell (two-tap); market/rival = reuse `NegotiationModal`.
The inline `PlayerSheet` in SquadList was removed (overlay replaces it; row tap → openProfile).
Live-verified owned context on both viewports (mobile bottom-sheet + desktop centered card);
caught & fixed a real bug (Sell was hidden in legacy-ladder Classic because the draft-tournament
gate used `mode==='classic' && !career` instead of `draft !== null`). Market-context branch is
type-checked + reuses the tested negotiation modal (not yet live-played in a career). Tests:
`tests/profile.test.ts` (4). **Not yet wired (fast-follow): pitch-slot + bench tap-to-profile
(owned players already reachable via the roster list); enriched later by C6 traits / A2 roles /
N7 footedness.**

**Goal:** turn the current Squad-tab inline `PlayerSheet` into a proper FM-style profile
hub — one scannable screen, reachable from anywhere, that adapts to context.

**User decisions (locked via AskUserQuestion):**
- **Format = full-screen overlay** — a dedicated profile modal/panel (not the inline
  expand), with room for the richer content and consistent everywhere.
- **Reach = everywhere including opponents** — openable from squad, bench, shop/market
  targets, pitch slots, AND rival/opponent squads (a real scouting tool).

**What exists today (the foundation):**
- Inline `PlayerSheet` at `src/components/squad/SquadList.tsx:47` — shows club/era/
  nationality, ATK/DEF + 6 extended stat bars (`deriveStats`), match history
  (apps/★/goals/assists/MOTM), To-bench + two-tap Sell. Only opens from the Squad roster.
- Card variants: `cards/PlayerCard.tsx`, `shop/ShopCard.tsx` (MiniStats 3×2 grid + chem
  tags), pitch `pitch/Slot.tsx`.

**Data already in the model but NOT surfaced anywhere in the UI (the high-value gap):**
- **Contract years left** + expiring/Bosman flag (`CareerMeta.contractYears`,
  `isExpiring`) — invisible today despite Bosman losses being a real mechanic.
- **Age at club + trajectory** (`age`, `growthLeft`) — riser vs fader.
- **Potential** ★-range for youth (hidden until scouted — show the fuzzy range / exact if scouted).
- **Disciplinary record** — yellows/reds (`playerHistory`, only ever shown in the match report).
- **Eligible positions** — slots he can fill beyond his natural one (`positions.ts`,
  `eligiblePositions`) — FM's "can play here" map.
- **Chemistry tags themselves** (UI currently shows only the +% bonus, not which links).
- **Market value / wage / sell value** consolidated (`wages.ts`, `market.ts`).

**Context-adaptive profile (the same overlay, three modes):**
- **Owned player:** form arrow, fitness/morale, contract, full history, sell/To-bench actions.
- **Market target:** market value/fee, chem-if-signed preview, what he'd add to the current XI.
- **Opponent player:** scouting read only (stats + threat), no actions.

**Where FM struggles → our better solution:**
- FM splits the profile across 6+ tabs (Overview/Attributes/Information/Reports/
  Development/Contract/Happiness) → we do ONE scannable screen, progressively disclosed,
  no tab-hopping; headline read up top, detail below.
- FM attributes are bare 1–20 numbers with no causation → we keep tier-coloured bars and
  can **highlight the stats the player's role/formation actually leans on** (ties into the
  Playing Styles idea, A1 below).
- FM shows the same firehose for everyone → our profile adapts to owned/market/opponent.

**Build notes / risk:** mostly presentation — no engine or economy change, so **no
`npm run sim` needed** and likely **no persistence bump** (all derived/already-persisted
fields). Main work: a new overlay component reachable from multiple call sites; thread a
"open profile for player id" action through the store or a context. Verify on mobile +
desktop. Likely supersedes the inline `PlayerSheet` (or keep inline as a quick-peek that
links into the full overlay).

---

## Other brainstormed ideas (not yet confirmed — awaiting user pick)

Captured from the 2026-06-13 brainstorm; promote to a numbered spec above once confirmed.

- **A1. Playing styles** — ~5 readable team presets (Gegenpress/Tiki-taka/Counter/Direct/
  Park-the-bus), each a bounded engine lever rewarding different stats. Makes squad-building meaningful.
- **A2. Player roles** — 2–3 roles per position (ball-playing CB vs stopper, playmaker vs
  destroyer) tilting which stats matter. **This is also the home for "more position
  variety"** (inside-forward vs touchline-winger, wing-back vs fullback, second-striker vs
  poacher, deep-lying vs advanced playmaker): express these as roles/duties on the existing
  8 archetypes rather than new pitch coordinates. Note: the engine reduces to coarse Role +
  stats, so the value is the stat-emphasis tilt, not new slot labels. (Vertically the pool
  is already well-covered — DM/CM/AM exist as Anchor/BoxToBox/Playmaker; "AMC" = the
  Playmaker slot. Raw left/right position labels were considered and rejected as cosmetic —
  see N7 footedness for the only L/R mechanic worth its complexity.)
- **A3. Tactical familiarity** — a style/formation strengthens with commitment.
- **B4. Pre-match briefing + counter** — ⏳ PARTIAL (SHIPPED 2026-06-13, briefing-only per user):
  `src/lib/briefing.ts` (pure, 4 tests) `opponentBriefing()` reads the opponent's attack/defence
  lean + stat profile into a threat phrase + recommended approach; shown as a "SCOUTING" line in
  the FixtureHero under the edge-bar verdict. Informational → zero balance/feel risk. **FAST-FOLLOW
  (deferred, user-chosen): the pick-a-counter PAYOFF** (a pre-match plan applying a match-long
  bounded ATK/DEF effect) — needs a set-not-stack mentality refactor so pre-match + HT + 70' don't
  compound (also caps B5's current HT+70' stacking). Gates: tsc · 417 tests · build · e2e.
- **B5. In-match mentality shift** — ✅ SHIPPED 2026-06-13. A second decision point at the 70'
  (`TACTICAL_MINUTE`) in MatchView's `advance()`, reusing the half-time talk machinery
  (`applyTalk`/`aiTalkFor`, the same overlay): "Tactical shift · 70' — push for more or see it
  out?" with All-out attack / Stay the course / Park the bus. **Interactive-only** (gated on
  `interactive`): non-interactive/PvP keeps the single 46→90 segment byte-identical, and the
  balance sim uses `simulateMatch` regardless → balance untouched. Covered by e2e (loops
  answering both talks). Live-verified the 70' overlay (score-aware copy). Gates: tsc · 413 tests · build · e2e.
- **C6. Signature traits** — a punchy handful (Poacher, Set-piece specialist, Big-game,
  Injury-prone, Wantaway), derived deterministically, with clear match effects.
- **C7. Growing partnerships** — duos that share minutes develop a visible chemistry bonus.
- **D8. Manager perks** — light progression for the persistent manager across clubs.
- **D9. Develop-and-sell trader loop** — make buy-low/develop/sell-high a visible playstyle.
- **D10. Rivalries** — ⏳ PARTIAL (SHIPPED 2026-06-13, narrative-scoped per user): `src/lib/
  rivalry.ts` (pure, 5 tests) `headToHead()` reads your reverse-fixture history vs the current
  opponent; `rivalryLine()` frames the rematch (revenge / a win to repeat / settle a draw). Shown
  as a "RIVALRY" line + H2H W-D-L in the FixtureHero. No mechanics, no persistence → balance-safe.
  Gates: tsc · 450 tests · build · e2e. **FAST-FOLLOW (Fable, balance): the mechanical PAYOFF**
  (beating a rival → reputation/morale bonus) + a persistent cross-season nemesis club.
- **E11. "Why you lost" post-match analysis** — ✅ SHIPPED 2026-06-13.
  `src/lib/matchAnalysis.ts` (pure, 7 tests) reads the deterministic result back — xG
  (chances created), score-vs-xG (finishing/keeper), the squads' `teamStatProfile`
  dimensions (names the cause), red cards — into a one-line verdict + ≤4 toned factors,
  all from side A's perspective. `components/match/MatchVerdict.tsx` renders it at full-time
  above the timeline (MatchView). Pure lib not imported by engine/store/sim → balance-neutral
  (sim skipped with justification). Live-verified: a 1-0 win → "Edged it — a tight one settled
  your way · chances even xG 1.5–1.0 · resolute defending." gates: tsc · 408 tests · build · e2e.
- **E12. Squad depth chart / planner** — ✅ SHIPPED 2026-06-13. `src/lib/depth.ts` (pure, 6
  tests) `squadDepth()` reports per-role health vs the current formation (short / thin / ok +
  a plain-English note, lone-keeper flagged); `components/squad/SquadDepth.tsx` is a collapsible
  "Depth" panel in the Squad-tab roster column — fit/needed counts, status flags, player chips
  (starters highlighted, unavailable struck, tap → profile). Pure/derived → balance-neutral.
  Gates: tsc · 423 tests · build · e2e. Live-verified on the R7 squad (4 thin: lone keeper + no cover).

## 2. Player pool — balance & breadth (CONFIRMED 2026-06-13)

**Goal:** fix composition gaps in the 668-player pool. Quality/targeting, NOT raw count
(the loop works at 668; bloating fights anti-bloat).

**Current composition (audited 2026-06-13):**
- 668 players, eras 1992/93→2022/23 (densest 2002–2018; recent years thin) — a deliberate
  Premier-League-era retro pool, on-brand.
- **Leagues: only 3** — EPL 378 (57%) / Serie A 153 / La Liga 137. No Bundesliga, Ligue 1,
  Eredivisie, Primeira.
- **Roles badly striker-heavy:** Striker 199 (30%) · CB 103 · Playmaker 73 · BoxToBox 71 ·
  GK 70 · Fullback 62 · Winger 56 · **Anchor/DM 34**. Wide players + holding mids are thin.
- Cost tiers 1:147 / 2:155 / 3:194 / 4:126 / **5:46 elite**.

**✅ #2a AUDIT DONE (2026-06-13) — verdict: NO stranding; the gap is VARIETY, not size.**
- Coarse-role supply vs a single 12-club league's demand (only one division is "owned" at a
  time): **GK ×2.92 · DEF ×2.75 · MID ×2.97 · FWD ×5.31** — every role has comfortable surplus.
- Authoritative check: `tests/draft.sim.ts` reports **stranded = 0 across all 360 seasons**
  (Easy/Standard/Hardcore × 120). The draft's `pickableInDraft` reserve-guard + the league's
  role-balanced `assignClubSquads` never fail to field a legal XI.
- Coarse roles: GK 70 · DEF 165 · MID 178 · FWD 255. Granular: Striker 199 · CenterBack 103 ·
  Playmaker 73 · BoxToBox 71 · GK 70 · Fullback 62 · Winger 56 · **Anchor/DM 34** (thinnest).
- **So authoring (#2b) is justified for VARIETY/BREADTH + thin-role balance, NOT to prevent
  stranding.** The pool is big enough; the real issues are (a) repetition of the same thin-role
  players (DM/winger/fullback) across a league, and (b) the 30%-striker skew. Top up
  GK/DM/winger/fullback + add league breadth; do NOT add strikers. Re-gate with `npm run sim`.

**Priorities:**
1. **Position imbalance — VARIETY risk (audit downgraded it from "stranding" — see #2a above).**
   Top up the thin granular roles (Anchor/DM 34, Winger 56, Fullback 62, GK depth) and trim the
   striker skew by NOT adding more. Improves squad variety across clubs; not a legality fix.
2. **League breadth (biggest authenticity gap)** — a retro Bundesliga + Ligue 1 shard adds
   missing legend-tiers AND helps #1 (more keepers/wide players/holding mids).
3. **Top-end depth (optional)** — only 46 elite; fine for differentiation today, but a
   late-career galáctico arms race would want more.

**Build notes:** `scripts/generate_players.py` has a safe `--add` shard mode (appends,
keeps existing ids — how the 165 lower-league players landed). Any pool change touches
market values + draft → **re-gate with `npm run sim`** (draft stranding 0/360, Classic
36.8%, career economy). Records "players signed X/Y" uses `POOL.length` (auto-adjusts).

---

### Refinements to existing systems (brainstorm 2 — 2026-06-13)

- **R1. Triaged inbox** — ✅ SHIPPED 2026-06-13. `lib/inbox.ts` `needsAction()`/`actionCount()`
  (pure, 6 tests): an unresolved bid or unanswered board pledge needs action; everything else is
  FYI. `InboxPanel` now renders an always-visible **Action needed** section + a collapsible
  **Updates** digest (default collapsed when something's pressing), so the inbox can't become a
  wall of noise in a long career. Career/League-only. Verified: 6 logic tests + the e2e renders
  the career inbox panel crash-free (it kicks off from a fresh-career Home tab). Note: a
  triage-layout screenshot wasn't captured this session (the manual throwaway-career start was
  flaky / didn't persist). Gates: tsc · 429 tests · build · e2e.
- **R2. Adaptive league** — wire the parked `rivalAggression` lever so rivals invest/poach
  harder as you dominate; keeps a long dynasty tense. Career-only, sim-gated.
- **R3. Fuzzy scouting in the career market** — lower-league players show a fuzzy rating +
  potential range until you pay to scout them (deterministic fuzz → Daily-safe). Recreates
  the "find the next star" thrill; reuses the youth-potential ★-range pattern.
- **R4. Match highlights reel + where-it-was-won heatmap** — ⏳ PARTIAL (SHIPPED 2026-06-13):
  the **shot map + channel read** ("where it was won") is done — `src/lib/shotmap.ts` (pure, 5
  tests) derives shots from the viz timeline's goal/chance scenes; `components/match/ShotMap.tsx`
  plots them on a mini-pitch (yours attacking right, theirs left, goals filled / chances hollow)
  with a per-side channel read, rendered at FT under the verdict. Pairs with E11. **FAST-FOLLOW
  (deferred): the animated replay reel** (re-driving MatchPitchView's rAF loop over goal scenes)
  — riskier (canvas re-drive + match-modal HMR), left for later. Gates: tsc · 413 tests · build · e2e.
- **R5. Individual development plans** — one meaningful choice per wonderkid (focus or
  senior mentor to grow a target stat over a season). Avoids FM's over-engineered training.
- **R6. FM-style transfer-market search & filters (✅ SHIPPED 2026-06-13)** — built + gated green
  (tsc · 469 tests · build · e2e; pure surfacing → balance-neutral, sim skipped, no persistence).
  `components/shop/TransferMarket.tsx` now has: a **Sort** row (Overall / Fee / Name, each toggling
  ↑/↓ — Fee↑ is the bargains view) + an **Affordable** toggle; a collapsible **Filters** panel
  (granular **Position** select over all 8 positions + **Min/Max fee £M** range + Clear); and a
  **"Show more"** pager (PAGE=60) that replaces the old hard `MAX_ROWS=60` cap — **no hidden tail**,
  every owned-pool player is reachable. The filter/sort pipeline was extracted to a pure, unit-tested
  lib `src/lib/marketFilter.ts` (`filterAndSortMarket`, +10 tests in `tests/marketFilter.test.ts`)
  with a stable id tiebreak so paging is deterministic. Live-verified in a career: Fee↑ surfaced
  £6M wingers first (Shaun Wright-Phillips 65, etc.); Show-more 60→120; Position=Winger → 28 of 28.
  (Nationality/league/era/age filters deliberately deferred — search + role + position + fee cover
  the acceptance; age/contract tie into career data, league/era already shown in rows.) Detail:
  - *Today:* 3 segments (free <64 / open ≥64 / rivals) + a coarse Role filter + name search,
    sorted affordable-then-overall-DESC and **capped at `MAX_ROWS = 60`**. So the cheapest /
    lowest-rated players sort to the bottom and get cut by the 60-cap — effectively unfindable.
    That's the core gap to fix.
  - *Want (FM-style):* richer filters — **value/price range**, granular **position** (not just
    Role; ties into [[A2]] player roles), nationality, league/era, overall & key-stat ranges,
    age/contract (career) — plus **sort options incl. value ASC** (find the bargains/journeymen),
    and **no hidden tail** (pagination / lazy-load / "show all", or at least a sort that reaches
    the bottom). Acceptance: any owned-pool player is reachable via the market UI.
  - *Reuse:* the **DraftRoom board** (`DraftRoom.tsx`) already has position tabs + name search +
    Value/Rating sort (asc/desc) + Affordable filter over the full pool (≤200) — lift that pattern.
  - *Notes:* surfacing/filtering only → **balance-neutral, Opus-fit (Track A), no persistence**.
    Pairs with the pool work ([[#2]] ensures variety EXISTS; R6 ensures you can FIND it) and the
    player profile (rows already open it). Re-check perf if removing the cap (the pool is ~668).

- **R7. Squad page rethink + profile-from-everywhere (✅ SHIPPED 2026-06-13)** — all three parts
  built + gated green (tsc · 459 tests · build · e2e; UI-only → balance-neutral, no persistence).
  (1) **Profile from everywhere:** `slotClicked` now opens the profile when you tap a FILLED slot
  with nothing armed (was a silent "arm"); an armed player (via the profile's "Field — pick a slot")
  still places on tap (empty fills / occupied swaps); drag still moves/swaps. `Bench.tsx` tap →
  `openProfile` too. So every player — list, bench, **pitch slot**, market — opens the same overlay.
  (2) **Responsive hybrid layout:** mobile gets a **Formation ⇄ Squad** segmented toggle
  (`squad-view-*` testids); desktop (lg+) keeps the two-column pitch+list simultaneity via `lg:flex`
  overrides. Arming a player auto-switches the mobile view to Formation so "Field" lands on the pitch.
  (3) **Auto-Pick on the pitch:** new shared `components/squad/SquadActions.tsx` (Auto-Pick + Clear,
  `idSuffix` keeps testids unique) used on BOTH the pitch/formation header (`auto-pick-pitch`) and the
  squad-list header (`auto-pick`). New tests in `tests/profile.test.ts` (+2: tap-filled-slot opens
  profile; armed→place). Live-verified both viewports (mobile bottom-sheet profile + toggle + pitch
  Auto-Pick 10→11; desktop centered profile + two-column). Original two parts:
  - **Core fix:** make EVERY player open the profile — currently only the squad-list rows +
    market cards do; the **pitch slots and bench don't** (deferred fast-follow from profile #1).
    Unify the interaction: tap any player (list / bench / **pitch slot**) → profile. Placement
    stays unambiguous by splitting on TARGET: tap a **filled** slot → profile; tap an **empty**
    slot (with a player armed via the profile's "Field" action) → place; **drag** still
    moves/swaps. Bench tap → profile too ("Field" arms him). Wire `Pitch`/`Slot.tsx` +
    `Bench.tsx` to `openProfile`.
  - **Layout (user-chosen: responsive hybrid):** keep the **desktop two-column** (formation +
    full squad list visible at once — don't lose that). Add a **mobile Formation ⇄ Squad
    segmented toggle** so the narrow screen is focused, not an endless scroll
    (pitch+bench+chem+training+list+depth). NOT a uniform Club-style sub-nav (that would sacrifice
    desktop simultaneity — considered & rejected).
  - **Auto-Pick on the formation/pitch view** (user-reported 2026-06-13): the pitch/formation
    view has no Auto-Pick — it lives only in the squad-list header. Surface it on the pitch too
    (reuse `autoPickXI`), so you can fill a legal XI without finding the list. Small add; do it
    with this rework.
  - *Notes:* UI-only → **balance-neutral, Opus-fit (Track A), no persistence** (the mobile
    toggle is transient UI state). Resolves the real inconsistency the user hit (clickable in the
    squad list, not on the pitch). Pairs with the player profile (#1).
- **R8. Career FTUE — guided tutorial journey + navigation/money affordances (✅ SHIPPED 2026-06-13)**
  — `src/components/career/CareerTour.tsx`: a one-time, career-only, device-scoped guided tour that
  walks **Home → Squad → Market → Club** in order, *actually switching the tab behind a floating,
  non-blocking card* (`onGoToTab` → `setActiveTab`) so you see the real screen while it explains
  what each page is and what to do next (progress dots, Back/Next, Skip; `gaffer-career-tour`
  localStorage, `careerTourSeen()`). Shown after onboarding (`career && onboarded && !tourDone &&
  playing && !matchOpen`) so the two never collide. The **money affordances** are largely already
  present and the tour points at them: the TopBar bankroll, the TransferMarket pinned **Bank /
  Wages-vs-Budget bar / Squad count** header (live-verified showing £38M · £2M/£5.3M · 15/16), and
  the JourneyBar "go to Market" routing when the squad needs players. UI/copy only → balance-neutral,
  no persistence (device localStorage, not the save). Gates: tsc · build · e2e (e2e exercises the
  tour on a fresh career). Live-verified: tour auto-appears, steps through all four tabs, finishes on
  "Let's go" and persists. (A "Replay tour" button was deferred — the existing Replay-tutorial covers
  mechanics refreshers; the tour is one-time FTUE.)
- **F-FINANCE. Finance page (FM-style) (CONFIRMED 2026-06-13)** — a dedicated finance view
  (likely a Club sub-nav pill) consolidating the money picture: **transfer budget, current wage
  spend vs wage budget, season income/expenses** (prize money, sponsorship, matchday, upkeep,
  fines), bankroll. Much of the data already exists (`wages.ts` wageBill/wageBudget, `finance.ts`,
  `stadium.ts` upkeep, `lastIncome` breakdown) — this surfaces it in one place. Opus-fit
  (presentation over existing data), balance-neutral, no persistence.
- **F-WAGES. Negotiable player wages (CONFIRMED 2026-06-13)** — today personal terms are
  take-it-or-leave-it: the wage DEMAND is fixed (`wageDemand`) and you only meet or fail it; you
  can't negotiate it down. Make the wage offer negotiable (like the fee bid). NOTE: wages are
  currently DERIVED (the wage bill uses `wage(p)`, not a stored agreed wage) — making wages
  negotiable means STORING a per-player agreed wage + re-tuning the wage economy → **balance-
  sensitive (Fable), persistence bump.** (CLAUDE_CONTEXT already flagged this as "revisit if
  per-player negotiated wages are wanted.")
- **F-SQUAD. Squad-size rework — reflect reality (CONFIRMED 2026-06-13)** — the arbitrary roster
  cap (`ROSTER_CAP`; draft = 16) blocks buying with an unclear reason (see BUG-3). The user wants
  real-world squad sizes instead of a hard low cap. Rework toward a realistic limit (~25 senior)
  with clear messaging; interacts with wages/economy + the draft tournament's fixed 16 →
  **balance/design-sensitive (Fable)**; touches the buy/checkBuy path + likely persistence. Do
  BUG-3 (clear "squad full" messaging) as a quick standalone fix regardless.

### Next-level features FM has never nailed (brainstorm 2 — 2026-06-13)

- **N1. The world moves & tells the story** ⭐ — ✅ SHIPPED 2026-06-13 (ex-player half).
  `src/lib/alumni.ts` (pure, 7 tests): every player who leaves your clubs (sell / cashed-in
  bid / Bosman) is remembered in a top-level persisted `alumni` list (carries across clubs =
  the manager's, resets on a new career); `alumniNews()` surfaces a seeded "where are they now"
  story season-end (a star winning a trophy, a cut veteran sliding down the leagues), posted as
  a `news` inbox message. Persistence **v31** (+migration: legacy → `alumni: []`, verified on the
  R7 save). Narrative-only → balance-neutral. Gates: tsc · 445 tests · build · e2e · sim. (Live
  news needs a multi-season career to surface — logic + migration fully tested.)
  - **Generative half ✅ SHIPPED 2026-06-13:** `src/lib/worldnews.ts` (pure, 7 tests)
    `worldNews()` adds one seeded season-end beat — an **old club you managed** rising/falling
    without you, or an **ex-player moving into management** (stars who left ≥2 seasons ago).
    Derived from the alumni list + `pastClubsOf(career.history)` → **no new persistence**. Posted
    as a `news` inbox message alongside the player story (≤2 world beats/season). Balance-neutral.
    Gates: tsc · 457 tests · build · e2e · sim. **N1 is now feature-complete.**
- **N2. Smart fast-forward** — fast-sim low-stakes matches but pull the user in at dramatic
  moments (hat-trick, relegation six-pointer, last-minute equaliser). Protects the snappy
  identity; beats FM's all-or-nothing "go on holiday."
- **N3. Emergent narrative seasons** — ✅ SHIPPED 2026-06-13. `src/lib/narrative.ts` (pure, 9
  tests) `seasonNarrative()` reads the standings in the run-in (last 5 MW) and frames the fixture
  when it carries earned stakes — title race / promotion / survival / final day (with
  mathematically-alive checks; null otherwise). Rendered as a tone-coloured banner atop the
  FixtureHero. Presentation-only → balance-neutral. Works for career (tier-aware) + standalone/
  draft leagues. Gates: tsc · 438 tests · build · e2e. (Banner not live-screenshotted — needs a
  season run-in; 9 logic tests cover all tones + the silent path, which the e2e also exercises.)
- **N4. The project pitch** — on joining a club, pitch a multi-season project (youth
  revolution / instant glory / rebuild) and be judged against THAT. Extends the pledge
  system into a season-zero narrative contract.
- **N5. A nemesis manager with memory** — a recurring rival manager with personality who
  trades barbs in the inbox, remembers history, and whose team plays differently against
  you. Turns D10 rivalries into characters.
- **N6. Async shared world** — via the existing Vercel/Upstash backend: a rotating real
  player's exported career-squad becomes an AI opponent, or a Manager-of-the-Month async
  ladder. Reuses the squad-export codes. (Privacy/scope to think through.)
- **N7. Footedness + flank balance** — the only version of "add left/right positions" worth
  its complexity. Give players a foot (derived deterministically or lightly authored); a
  left-footer on the right wing becomes an *inverted* winger (real trade-off: cuts inside
  for a shot vs hugs the line to cross); a team unbalanced down one flank (e.g. all
  right-footed wide players) is weaker there. Turns L/R into a readable tactical lever
  instead of cosmetic labels. FM has footedness but rarely makes team balance a clear lever
  → our "do it better than FM" angle. Bigger build: needs a foot field on the 668 players
  (or a deterministic derivation) + a bounded engine lever (flank strength) → **`npm run
  sim` re-gate** since it touches the match engine. Decided 2026-06-13 over adding raw
  ML/MR/AML/AMR/AMC position labels (rejected as engine-meaningless decoration; the
  engine reduces to coarse Role + stats and players carry no side/foot data today).
