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
- **D10. Rivalries** — a repeatedly-faced club becomes a mechanical rival.
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

**Priorities:**
1. **Position imbalance is a BALANCE risk, not just flavour** — clubs draft role-balanced
   14-man squads; the pool is 30% strikers and starved of GK/DM/winger/fullback for a
   ~60-club pyramid. As wing-back / 3-4-3 shapes draft wide players, thin roles risk
   stranding/repetition. **First task is cheap & read-only: audit thin-role stranding
   against `draft.sim` / career sims** before authoring anything. Then top up
   GK/DM/winger/fullback — NOT more strikers.
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

### Next-level features FM has never nailed (brainstorm 2 — 2026-06-13)

- **N1. The world moves & tells the story** ⭐ — players you sell become stars elsewhere,
  old clubs rise/fall, ex-players turn into rival managers — surfaced as emotional payoff
  ("the kid you sold for £2M just won the league"). Tractable with the compressed pool; a
  genuine differentiator.
- **N2. Smart fast-forward** — fast-sim low-stakes matches but pull the user in at dramatic
  moments (hat-trick, relegation six-pointer, last-minute equaliser). Protects the snappy
  identity; beats FM's all-or-nothing "go on holiday."
- **N3. Emergent narrative seasons** — the engine recognizes & frames drama (title decider,
  survival Sunday, cup giant-killing run) with stakes/build-up. Leans on the FixtureHero.
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
