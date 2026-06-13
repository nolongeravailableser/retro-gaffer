# Retro Gaffer — Living Context

> Maintained by Claude. Updated whenever a significant task completes, a major bug is
> fixed, or work wraps for the day. Treat this as the source of truth for "where are we."
>
> **🗂️ BACKLOG + ROADMAP now live in `BACKLOG.md` (2026-06-13).** After the redesign the
> user opened a brainstorm → a confirmed feature backlog with a dependency-aware **Track A
> (now, Sonnet/Opus) / Track B (Fable-blocked, balance/taste-critical)** roadmap + per-task
> model + a per-task definition-of-done. **Working through it in order.** Autonomy is now
> broad: `.claude/settings.local.json` got a hands-off allow-list (npm/npx/git/gh/node/
> python3/sed/preview_* + Edit/Write) with a deny-list keeping `rm -rf`/`sudo`/force-push/
> `git reset --hard`/`git clean` prompting. **Model checkpoint pref still stands** — recommend
> + wait per task. Fable is temporarily unavailable, so Track B waits.
>
> **▶ TRACK A PHASE 1 COMPLETE (#1–#8, all SHIPPED + PUSHED).** Then user batch-authorized
> **Phase 2 "Opus-safe first" (AskUserQuestion 2026-06-13):** do the pure-narrative/presentation
> items hands-off on Opus — **N3 ✅ (below), then N1 (world moves), D10 (rivalries, narrative-
> scoped)** — and **QUEUE for Fable** the balance/tuning items: **D8 manager perks, N5 nemesis
> manager, and N4's economy payoff** (the project-pitch's "judged-against-it" bonus; a
> narrative-only N4 could be Opus later). Commit+push each once green; flag real decisions.
>
> **▶ Phase 2 #3 — D10 RIVALRIES (narrative-scoped) ✅ SHIPPED + PUSHED. Opus.** `lib/rivalry.ts`
> (pure, 5 tests) `headToHead()` + `rivalryLine()` frame the reverse-fixture rematch ("they beat
> you 3-0 last time — revenge?") as a "RIVALRY" line + H2H W-D-L in the FixtureHero. No mechanics/
> persistence → balance-safe. Gates: tsc · **450 tests** (+5) · build · e2e. **This completes the
> user-authorized Opus-safe Phase-2 trio (N3, N1, D10).** Fable-queued next: D8 perks, N5 nemesis,
> N4 project-payoff, + the deferred fast-follows (R4 reel, B4 counter, D10 payoff, N1 generative half).
>
> **▶ Phase 2 #2 — N1 WORLD MOVES (ex-player half) ✅ SHIPPED + PUSHED. Opus.** `lib/alumni.ts`
> (pure, 7 tests): players who leave (sell/cashed-in/Bosman) → top-level persisted `alumni`
> (carries across clubs, resets on new career); seeded `alumniNews()` posts a season-end "where
> are they now" `news` inbox message. Persistence **v31** (+migration legacy→`alumni:[]`,
> verified on R7). Narrative-only → balance-neutral. Gates: tsc · **445 tests** (+7) · build · e2e
> · sim. Fast-follow: old-clubs-rise/fall + ex-players-as-managers (the generative half).
>
> **▶ Phase 2 #1 — N3 EMERGENT NARRATIVE SEASONS ✅ SHIPPED + PUSHED. Opus.** `lib/narrative.ts`
> (pure, 9 tests) frames the run-in (title/promotion/survival/final-day, mathematically-alive) →
> tone-coloured banner atop the FixtureHero. Presentation-only → balance-neutral. Gates: tsc ·
> **438 tests** (+9) · build · e2e. (Banner needs a season run-in to see live — logic fully tested.)
>
> **▶ Track A #8 — #2a POOL STRANDING AUDIT ✅ DONE (read-only). Opus.** Verdict: **NO
> stranding** — coarse-role supply for a single 12-club league is GK ×2.92 / DEF ×2.75 / MID
> ×2.97 / FWD ×5.31, and `draft.sim` reports **stranded = 0 / 360 seasons**. The pool is big
> enough; the real gap is VARIETY (thin granular roles: Anchor/DM 34, Winger 56, Fullback 62;
> 30%-striker skew). So **#2b authoring (Fable) is justified for variety/breadth, NOT legality** —
> top up GK/DM/winger/fullback + league breadth, don't add strikers. Findings written to BACKLOG #2.
> **→ Phase 1 of Track A is COMPLETE (#1–#8). Next: Phase 2 (career meta) or the Fable track.**
>
> **▶ Track A #7 — R1 TRIAGED INBOX ✅ SHIPPED + PUSHED. Opus.** `lib/inbox.ts` `needsAction()`
> /`actionCount()` (pure, 6 tests): open bid / unanswered pledge = action, else FYI. `InboxPanel`
> = always-visible "Action needed" + collapsible "Updates" digest (default collapsed when
> something's pressing). Career/League-only. e2e renders the career inbox crash-free; logic tested.
> (No triage-layout screenshot this session — throwaway-career start was flaky/didn't persist
> before reload; R7 Classic has no inbox. Restored R7 intact.) Gates: tsc · **429 tests** (+6) · build · e2e.
>
> **▶ Track A #6 — E12 SQUAD DEPTH CHART ✅ SHIPPED + PUSHED. Opus.** `lib/depth.ts` (pure, 6
> tests) `squadDepth()` → per-role health vs the formation (short/thin/ok + note; lone keeper
> flagged); `components/squad/SquadDepth.tsx` collapsible "Depth" panel in the Squad-tab roster
> column (fit/needed, status, player chips → tap opens the profile). Pure → balance-neutral.
> Gates: tsc · **423 tests** (+6) · build · e2e. Live-verified (R7: 4 thin — lone keeper + no cover).
>
> **▶ Track A #5 — B4 PRE-MATCH SCOUTING BRIEFING ✅ SHIPPED + PUSHED (briefing-only, user-chosen
> via AskUserQuestion). Opus.** `lib/briefing.ts` (pure, 4 tests) reads the opponent's attack/
> defence lean + stat profile → a threat phrase + recommended approach; shown as a "SCOUTING" line
> in the FixtureHero under the verdict. Informational → zero balance/feel risk. **Deferred
> fast-follow: the counter PAYOFF** (pre-match plan w/ a match-long ATK/DEF effect) — needs a
> set-not-stack mentality refactor (would also cap B5's HT+70' compounding). Gates: tsc · **417
> tests** (+4) · build · e2e. Live-verified the scouting line on R7 (non-destructive).
>
> **▶ Track A #4 — B5 IN-MATCH MENTALITY SHIFT ✅ SHIPPED + PUSHED. Opus.** A 2nd decision
> point at `TACTICAL_MINUTE`=70 in MatchView's `advance()`, reusing the half-time talk
> machinery + overlay ("Tactical shift · 70' — push for more or see it out?": attack/steady/
> park). INTERACTIVE-ONLY (gated): non-interactive/PvP keeps the single 46→90 segment
> byte-identical; sim uses simulateMatch → balance untouched. e2e loops answering both talks.
> Live-verified the 70' overlay (score-aware copy). Gates: tsc · 413 tests · build · e2e.
>
> **▶ Track A #3 — "WHERE IT WAS WON" SHOT MAP ✅ SHIPPED + PUSHED. Opus.** (R4 is PARTIAL —
> shot map done, animated replay reel deferred.) `lib/shotmap.ts` (pure, 5 tests) derives shots
> from the viz timeline's goal/chance scenes; `components/match/ShotMap.tsx` plots them on a
> mini-pitch (yours→right, theirs→left, goals filled/chances hollow) + a per-side channel read,
> at FT under the verdict. Pure → balance-neutral (sim skipped). Gates: tsc · **413 tests** (+5)
> · build · e2e. Live-verified (1-0 win: 3 chances through the middle, clean sheet).
>
> **▶ Track A #2 — "WHY YOU LOST" ANALYSIS ✅ SHIPPED + PUSHED. Opus.**
> `lib/matchAnalysis.ts` (pure, 7 tests) reads the deterministic result back — xG (chances),
> score-vs-xG (finishing/keeper), `teamStatProfile` dimensions (names the cause), red cards —
> into a one-line verdict + ≤4 toned factors from your perspective. `components/match/
> MatchVerdict.tsx` renders it at FT above the timeline. Pure lib NOT imported by engine/store/
> sim → balance-neutral (sim skipped, justified). Gates: tsc · **408 tests** (+7) · build · e2e.
> Live-verified a real R7 match: 1-0 win → "Edged it — a tight one settled your way · chances
> even xG 1.5–1.0 · resolute defending." (R7 save backed up + restored.)
>
> **▶ Track A #1 — FM-style PLAYER PROFILE ✅ SHIPPED + PUSHED (commit 31a9980). Opus.**
> `components/player/PlayerProfile.tsx` — full-screen context-adaptive overlay (z-80, owned/
> market/rival), reachable from squad rows + market cards. Surfaces previously-hidden data
> (discipline, eligible positions, contract/Bosman, age/development, market+sell value, wage,
> humanized chem links). Store: transient `profilePlayerId` + `openProfile`/`closeProfile`
> (NOT persisted → no version bump). Inline `PlayerSheet` removed (overlay replaces it). Gates:
> tsc · **401 tests** (+4 `profile.test.ts`) · build · e2e · career sim baseline unchanged
> (£71M PL median / 43% champ — proves it's balance-neutral). Live-verified owned context both
> viewports; fixed a Sell-hidden-in-legacy-Classic bug (draft gate now `draft !== null`).
> Market context type-checked + reuses the tested `NegotiationModal` (not yet live-played).
> See `BACKLOG.md` item 1 for the fast-follows. HEAD still `787f822` until this commits.
>
> **⚡ UI REDESIGN — ALL 7 PHASES SHIPPED & LIVE (2026-06-13, user-approved "build it
> and push to live").** Full proposal + per-screen rationale: `design-mockups/index.html`
> (10 standalone HTML mockups — throwaway reference, not wired to the app). Every phase
> gated on tsc + 394 vitest + build + e2e before pushing (no lib/store/engine changes →
> sims untouched by construction; Classic 36.8% economy intact).
> - **P1 chrome:** one-row `TopBar` (old 4-row header+Hud+New Game/Daily → ☰ menu, toasts
>   ported) + stable 4-tab `MainNav` (home/squad/market/club — Draft LOCKS Market with a
>   reason instead of hiding 5 tabs) + `ClubTab` pill sub-nav (Career hub / Records /
>   Challenges / Compete / Settings). TabNav/Hud deleted. Tokens: `surface-1/2/3`,
>   `tier-*`, `font-data` (IBM Plex Mono added to font link).
> - **P2 Home:** `FixtureHero` replaces SeasonPanel's playing state (SeasonPanel remains
>   as the dismissed-RunOver end card): crests + table positions, relative-strength edge
>   bar with plain-English verdict, W/D/L stakes + "How is this calculated?" expander,
>   wager STEPPER (testids wager-input/none/quarter/max kept), cup/boss/draft variants.
> - **P3 Squad:** pitch-first on all viewports; `OvrBadge` (tier-coloured, lib overall())
>   is THE player number everywhere; roster rows = role/name/status-chips/form/chem/OVR
>   with an inline player sheet (full stats, history, To-bench, two-tap Sell — the 11
>   permanent sell buttons are gone); live ATK/DEF/links chips by the formation picker.
> - **P4 Market:** Free agents / Open market / At rivals as primary segments with inline
>   rules; pinned bank/wage-bar/squad header; labelled fee buttons ("Poach · £xM weakens
>   them"); window-closed = browsable but desaturated.
> - **P5 Match:** decisions (talk/sub) are now a FULL overlay over the match (never below
>   the fold; talk-*/sub-* testids kept, e2e drives them); FT payout = itemised receipt →
>   net → new balance; cup FT = "Glory, not gold" via a new `knockout` prop captured at
>   kick-off (also fixes a latent bug: cup FT used to show the previous league game's
>   stale lastIncome).
> - **P6 Club hub:** facilities show NEXT-level payoff; history rows carry 🏆 CUP chips
>   (`rec.cupWon`); reputation meter explains itself; honours grid fits 5 tiles.
> - **P7 front door + teaching + draft:** StartMenu gets floodlight CSS atmosphere,
>   wordmark, Resume card with a season-progress bar, Daily chip with today's rule +
>   two-tap start (testid `menu-daily`). Onboarding is ONE identity step (club+manager+
>   kit merged; `skip-onboarding`/`onboarding-finish` kept) — the 5-card tour now only
>   serves "How to play" replays; teaching moved to 3 one-time `CoachMark`s (Home/Squad/
>   Market, localStorage `gaffer-coach-*`, device-scoped). DraftRoom: "DRAFT NIGHT · on
>   the clock" header, budget bar exposing the hidden XI-reserve guard (spent/reserved/
>   free), rival latest-picks ticker, your-picks rail, disabled picks say why.
> - **e2e smoke was STALE on main** (StartMenu z-55 blocked `kickoff-cta` after
>   onboarding skip — pre-existing fail); rewritten through the real front door
>   (testids `menu-new-career`, `start-pending-mode`). Dead `SquadPanel.tsx` deleted.
> - **Where the mockups deliberately weren't followed:** no fifth Cup tab (hero variant
>   instead); ladder modes keep SeasonPanel internals under the new hero (containment);
>   NegotiationModal/SavePanel flows untouched (restyle-by-token only).
>
> **POST-REDESIGN POLISH (2026-06-13, all SHIPPED & LIVE, gates 397 tests + build + e2e
> each).** Per-task model checkpoints now precede work (user pref — recommend Sonnet/
> Opus/Fable + wait for his pick; see memory). Commits in order:
> - `0a40a61` QA: shared `tagLabel()` humanizes raw chemistry tags (cult_hero → Cult
>   Hero) in ChemistryPanel/PlayerCard/ShopCard (+3 tests); FixtureHero wraps long
>   opponent names (line-clamp-2) instead of truncating.
> - `cd709d0` Motion R1: `MoneyCounter` (easeOutCubic count-up, reduced-motion safe) on
>   the TopBar bankroll + matchday-receipt balance; springier player-detail sheet.
> - `d0d27ca` Motion R2: kick-off CTA + helper `whileTap`; full-time match report
>   staggers in (timeline + ratings) with MOTM star pop — finished report only,
>   reduced-motion safe (live strip stays static).
> - `a126df7` Career QA: CareerHub "This Season" shows neutral "Season ahead" (not red
>   "Drop zone — sack risk") at MW1/0-played.
> - `0e44659` Cup QA: in-match decision-overlay scrim opaqued (/85→/95 + blur-md) so a
>   busy ratings panel can't bleed through; cup-week hero + glory-not-gold FT verified
>   live (played a career to the MW6 QF).
> - `943c8fb` Daily leaderboard: shimmer skeleton + explained-offline state ("needs a
>   connection"); compact run-over embed still hides until real data.
> - **Verified live:** all redesign screens now seen running on both viewports incl.
>   career-only ones (three-tier market/poach, career hub, cup week). **Tooling notes:**
>   `setTimeout` async loops inside `preview_eval` don't resolve (hit 30s wall) — drive
>   with discrete synchronous clicks; editing the match modal mid-session triggers HMR
>   glitches in an open match (restart the preview server to verify cleanly); stop the
>   preview server before `npm run test:e2e` (they contend for port 5180).
>
> **Last updated:** 2026-06-12 (later session — **Career difficulty rebalance** +
> live-playtest QA + a trap fix + a **career economy retighten** + **contract-renewal
> money sink** + a **domestic cup inside Career**. All career-only; Classic untouched.
> Gates: **394 tests + balance sims**, tsc + build green, persistence **v30** (no bump —
> cup reuses the existing persisted `s.cup` + a rehydrate backfill), **Classic ladder
> 36.8%** preserved. (HEAD `ef8d098`; difficulty/trap/economy/renewals already PUSHED as
> `6d626b9`; the cup commit is local — pushing next.)
>
> **Domestic cup in Career (commit `ef8d098`):** a parallel knockout interleaved with the
> league — QF/SF/Final at matchweeks 6/12/18 as EXTRA midweek ties (the league matchweek
> doesn't advance on a cup tie). Reuses `lib/cup.ts`. **Glory, not gold:** no prize money
> (economy untouched), but injuries carry and a final win is logged as a Cup title
> (`SeasonRecord.cupWon` → `careerHonours.cupTitles` → `managerReputation`). New
> `careerCupDue`/`cupChampion`/`CAREER_CUP_ROUND_WEEKS` (cup.ts); `resolveCareerCupRound`
> in the store (never ends the run / never advances the matchweek); standalone Cup mode
> keeps its own path (`s.cup && !s.career`). UI: career-aware `CupBracket`, cup-framed
> `SeasonPanel`, "🏆 Play Cup Tie" CTA, Cups in the CareerHub honours. Live-verified the
> full interleave end-to-end.
>
> **Economy arc (this session):** the harder climb lengthened careers → an inflated
> top-tier hoard (T1 median £618M, 91% hoarding >£400M). Two moves: (1) **retighten** —
> `WAGE_TIER_K` 1.3→**1.4** (finance.ts) + `UPKEEP_PER_LEVEL` 0.75→**0.85** (stadium.ts).
> (2) **contract-renewal signing-on bonuses** (`RENEWAL_RATE`=0.3, market.ts) as the
> STANDING sink — keeping your squad together now costs real money (a galáctico squad is
> expensive to HOLD; lapse a deal and he walks on a Bosman). Both modelled in
> `career.sim.ts`. Net: T1 median **£71M**, max **£999M**, hoarders **27%**; champ
> ~43% / sacked ~1% / PL ~97% all unchanged (pure economy). Classic 36.8%, Draft
> 0-stranded. Live-verified the renewal UI (£6M cost + running total).
>
> **Live playthrough QA (this session):** played a full Hardcore season end-to-end —
> verified tougher AI (youStrength 1062 = 900×1.18), contested matches (MW1 lost 1-2,
> xG near-even), full match flow, a **season-end sacking** (bottom-3 in the National
> League), the **Job Market** (2 vacancies), and **takeJob** → inherited a real squad at
> a new club with the new league also at Hardcore strength. All correct.
>
> **Trap fix it surfaced (commit `762452b`):** a thin squad hit by bans/injuries (more
> common now on Hardcore) could be told to "sign a MID" with the transfer window shut —
> reading like a soft-lock. Root cause: `journeyFor` gated on per-role counts (ignoring
> that any outfielder can play any outfield slot out of position), and `pickBestXI`'s
> crisis cover would park the backup GK in midfield (high-DEF keeper won on raw
> roleScore). Fixed: journey legality is now KEEPER-LINE based (≥1 GK + enough
> outfielders total → fieldable in ANY formation, out of position); Auto-Pick never
> crosses the keeper line. Live-verified (2 MIDs in a 4-4-2 → a FWD+DEF fill the MID
> slots, no GK outfield, Play ready). journey/autopick unit tests cover both.
>
> **Difficulty rebalance (this session, committed `54dc692`):** the difficulty dial now
> bites on the PITCH. New `DifficultyConfig.aiStrengthMult` scales the AI clubs you face
> (Easy 0.95 / Standard 1.07 / Hardcore 1.18), wired into every Career league-gen site
> (`careerLeagueBase` in the store). Standard is now a real contest (champ 64%→**40%**
> over a dynasty, contested climb, real relegation risk) instead of a near-guaranteed
> march; Easy is a gentle power-fantasy (78%), Hardcore brutal (8% champ / 80% sacked,
> PL still reachable 60%). Hardcore board teeth softened to grace 2 / threshold 22 so its
> failures are earned on the pitch. Also fixed a **latent board-confidence bug**: the
> season W/D/L `record` accumulated across the whole career (old glory propped up
> confidence) — now reset per season in `advanceCareerSeason` (matches the sim). The
> career sim (`tests/career.sim.ts`) is now **difficulty-aware** with a guarded
> difficulty-sweep (`npm run sim`). No persistence change. **User decision (locked via
> AskUserQuestion): "Make Standard a real contest."**
>
> **What shipped this session:**
> 1. **5-PILLAR STRATEGIC RE-FOUNDATION** (all live): P4 Difficulty Matrix
>    (Easy/Standard/Hardcore — board sacking teeth, scaled budget, hard wage ceiling;
>    `lib/difficulty.ts`). P1 Financial Balancing Array (`lib/finance.ts` — one
>    per-division economy table + sponsorship + disciplinary fines, net-neutral). P3
>    Unknown-pool start (new careers begin with grey generated journeymen). P5 **Manager
>    career / job market** (`lib/jobs.ts` — a sacking is NOT game over; apply for jobs
>    matching reputation, take over a club with its inherited real squad; reputation +
>    trophy cabinet span clubs). P2 **Start Menu** (`StartMenu.tsx` — one-click Resume,
>    New Career w/ difficulty picker, Quick Classic, demoted modes behind "More ways to
>    play").
> 2. **Manager-career polish** + **Start-Menu bug fixes** (More-ways-to-play z-index,
>    tutorial rewrite, Records sub-view).
> 3. **CLASSIC reworked into a closed DRAFT TOURNAMENT** (`lib/draft.ts`, `DraftRoom.tsx`):
>    free-pick snake draft vs 11 AI clubs (difficulty-scaled budget) → single
>    round-robin league; 16-man squad (XI + 5 subs); **bank locked at £0, no
>    transfers/economy**; focused UI (only Tactics/Season/Club tabs). Balance-gated via
>    `tests/draft.sim.ts` (0/360 stranded; Easy avgPos 5.5/top3 33%, Hard 8.3/11%).
>    Legacy ladder-Classic saves still play as a ladder (graceful).
>
> Detail for each in §2 / §3 below. The user's save (`gaffer-run`) is a **Classic ladder
> R7** run (legacy, pre-rework) — back it up before destructive browser tests. See §3
> "⭐ NEXT SESSION — START HERE".)

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

**Phase 3 — 2D pitch overhaul (SHIPPED 2026-06-11, commit `001f95f`):**
- Renderer-only (`MatchPitchView.tsx`), determinism-safe — `buildVizTimeline`
  output unchanged, matchviz tests still pass. The possessing team pushes up
  (role-weighted), the defending team drops, both tilt toward the ball's lane;
  the nearest attacker is **glued to the ball** (carrier — ball at his feet),
  the nearest defender **presses** it. As the ball moves its path the carrier
  changes → reads as passing. Dead-ball scenes hold shape.
- `scene.shiftA/shiftB` are now unused by the renderer (still on the type).
- Verified: 40-frame canvas probe → a kit dot on the ball every live frame
  (min ball↔carrier dist 0.006 of width); FT frame shows real formation
  shapes. Possible future polish: smoother scene-boundary transitions,
  off-ball runs, distinct dribble-vs-pass ball speed.

**Phase 4 — big systems (IN PROGRESS):**
- **4.1 dynamic positions + formations (SHIPPED, commits `393570e`…`8879ad8`):**
  - `src/lib/positions.ts` — `eligiblePositions` infers playable positions from
    the one authored position via real-life adjacency (crosses Role lines:
    Fullback↔Winger etc.); `canFillSlot` (same-role OR eligible), `positionFit`
    (1 / 0.9), `OUT_OF_POSITION_MULT`. `POSITION_TO_ROLE` moved here.
  - Formations carry `positions[]` (granular); `slots[]` (Role) derived → codec
    /chemistry unchanged, original four byte-identical (save-safe). +4 formations
    (3-4-3, 5-3-2, 4-1-4-1, 4-1-3-2 diamond) = 8. `slotPosition()`,
    `FORMATION_IDS` is curated order.
  - Placement (`isSlotEligible`/`placeInSlot`) position-aware (cross-role moves
    allowed; out-of-position warned). `effectiveStrength` takes a per-player
    `posMult`; App feeds it from XI×formation (out-of-position starter at 90%).
    Subs keep their Phase-2.4 clone.
  - `pickBestXI` greedy is position-aware (fields in position → no penalty by
    default). Pitch slots show position (CB/FB/DM/CM/AM/W/ST) + amber "!" when
    out of position. Sim still 39.0%. Tests: positions(6)+formations(4) → 243.
- **4.2 FM finances & wages (SHIPPED, commits `f669d25`…`e11bd66`):**
  - `src/lib/wages.ts` — `overall(p)` (role-weighted 0–99), `wage(p)` (convex
    in overall → stars cost disproportionately), `wageBill(squad)`,
    `divisionMult(round)` (prize money/income scale with the division; clamped
    for Endless/scenarios), `wageBudget(bankroll, divMult)` (soft guideline).
  - `resolveRound`: reward + round income × divisionMult; wage = rating-based
    squad bill (replaces the old flat squad-size tax, now removed from
    ladder.ts). SeasonPanel stakes match + show "Wage bill £X / £Y budget"
    (rose when over). No persistence change (all derived).
  - Balance: sim updated to the new economy + re-gated → completion 39.0% →
    **37.2%** (real wages + lower early-league income bite; deaths still at the
    R12 boss, not bankruptcy). Tests: wages.test.ts (5); removed the old
    ladder wageBill test. 247 total.
- **4.3 League-Season mode (IN PROGRESS):**
  - **4.3a engine (SHIPPED, commit `d7be85e`):** `src/lib/league.ts` —
    `generateLeague` (YOU + 11 seeded AI clubs, varied strength), `roundRobin`
    (circle method → 11 matchweeks, every pair once, balanced home/away),
    `simAiResult`/`simAiWeek` (light xG sim for non-player fixtures),
    `table`/`position` (3-1-0, sorted points→GD→GF→name). Pure/deterministic.
    Tests: league.test.ts (5).
  - **4.3b standalone League mode (SHIPPED, commit `7793212`):** `league`
    ModeConfig (12 teams, 11 matchweeks, no lives/bosses); `league` store state
    (persist **v20** + migration + saveSlice + freshRun reset); `startLeague`;
    `resolveRound` early branch → `resolveLeagueRound` (record player result +
    `simAiWeek`, advance matchweek, champion=won, reuse FM finances + player
    history). App: matchweek opponent = the fixture's club (`generateOpponent`
    from its strength, club name). `LeagueTable.tsx` on the Season tab; New Run
    "League Season" card; SeasonPanel loss note = "no points" in a league.
    Verified live end-to-end (won MW1 → table updated, you 2nd; MW advanced).
    Win = champion (1st).
  - **4.3c league-aware end screen (SHIPPED, commit `1ae0fc6`):** RunOverModal
    shows LEAGUE CHAMPIONS! / SEASON OVER, "Finished: Champions/Nth of 12",
    the league-table record, and a "New League Season" replay. Found+fixed in
    the League debug pass (a full season played to the title; champion screen
    verified). League mode debug pass otherwise clean.
  - **4.4a pyramid foundation (SHIPPED, commit `cffbee2`):** `lib/league.ts`
    DIVISIONS (National League→Premier League, rising AI base), TOP/BOTTOM_TIER,
    PROMOTION/RELEGATION_SPOTS (top/bottom 3), `seasonOutcome` (champion/
    promoted/stay/relegated/sacked) + `nextTier`. Tests +3.
  - **4.4b Career = league pyramid (SHIPPED, commits `413c276`+`94cddbd`):**
    Each Career season is now a league in the club's current `tier` of the
    English pyramid (National League → Premier League). The board-target framing
    is gone; the league finish decides everything.
    - **Reuse, not nest:** Career sets the top-level `s.league` (same field
      standalone League uses), so App's opponent logic + `resolveLeagueRound`
      work unchanged. `CareerState` gained `tier` (dropped `targetRound`).
    - `resolveLeagueRound` is career-aware: a finished season runs
      `seasonOutcome(tier, pos, 12)` → `champion` (top tier 1st) WINS the run;
      `sacked` (drop zone in the bottom tier) ENDS it; else opens the
      between-seasons review (promoted/stay/relegated) which KEEPS the existing
      `ageRoster` + `generateYouth` academy intake. `advanceCareerSeason`
      applies `review.toTier` (`nextTier`) and generates a fresh league there.
      Removed the dead classic-career branch from `resolveRound`.
    - **Economy:** `lib/wages.ts` `tierMult(tier)` — a season is one division,
      so prize money/income scale by the pyramid TIER (flat across matchweeks),
      bottom→floor (0.6) … top→ceil (1.7). Standalone League pays
      `LEAGUE_NEUTRAL_TIER`. Sim still **37.2%** (Classic path untouched).
    - **Achievements** now evaluate on the league/career path (restores Dynasty
      etc. for career; no bosses, lives inert via a MAX_SAFE_INTEGER sentinel).
    - **Persistence v21:** legacy careers get `tier: BOTTOM_TIER` + drop
      `targetRound`; `onRehydrateStorage` regenerates a league for a league-less
      career. `lib/career.ts` removed `boardTarget`/`boardWantsTitle`/`boardMet`.
    - **UI:** Hud + SeasonPanel show the division + promotion/relegation framing;
      `CareerReview` is a promotion/relegation summary (keeps academy intake);
      `RunOverModal` headlines "CHAMPIONS OF ENGLAND!" on a top-tier win and
      "SACKED" only on relegation from the bottom tier; NewRunModal Career copy
      updated. Tests: career.test (reviewBonus), wages (tierMult), savecode (v21
      migration), **careerLeague.test.ts (5 store-integration tests)** → 260.
    - **Verified live:** New Career → National League (tier 5), 12 clubs,
      tier-appropriate AI strength, division shown everywhere, table renders,
      floor-economy stakes. Existing R7 Classic save migrated + rehydrated clean
      (backed up to `gaffer-run-BACKUP` and restored).
  - **4.4c stadium development (SHIPPED, commit `70be944`):** career-only club
    facilities — `lib/stadium.ts` (pure, 4 tests): `Facilities {stadium,
    academy, medical}`, levels 0–3, `upgradeCost` (rises per level),
    `matchdayIncome`/`youthBonus`/`injuryReduction`. `CareerState.facilities`
    carries across seasons (persist **v22**; existing careers → level 0). Store:
    `startCareer` seeds them, new `upgradeFacility(id)` action (spend bankroll,
    cap at MAX_LEVEL=3), `advanceCareerSeason` carries them; `resolveLeagueRound`
    applies the effects (career only) — stadium → flat matchday income (folded
    into round income), medical → shaves rounds off new injuries, academy →
    more prospects per intake. UI: `CareerReview` "Club Development" upgrade
    panel + `SeasonPanel` live readout. Tests: stadium(4) + careerLeague(+3) +
    savecode v22 → **267**. Classic sim untouched (career-only economy).
  - **4.5 Career Hub (SHIPPED, commit `453f665`):** a dedicated dynasty home
    (Club tab, career only). `CareerState.history: SeasonRecord[]` (logged at
    each season end in `resolveLeagueRound`, carried across seasons; persist
    **v23**); `careerHonours()` derives titles/promotions/relegations/peak tier.
    `components/career/CareerHub.tsx` = club identity + `PyramidLadder.tsx`
    (summit→base ladder, your rung lit with crest) + live this-season outlook
    (position + promotion/relegation pill + matchweek bar) + honours cabinet +
    club development + season-by-season history timeline (outcome badges).
    `FacilitiesPanel.tsx` extracted (shared by hub + review; **mid-season
    upgrades** now allowed, shows each facility's live effect). RunOverModal
    gained a career honours strip. Tests → **269**. Verified live.
    - **Follow-up polish (commit `5774f25`):** the `LeagueTable` (Season tab)
      now colours promotion (green) / relegation (red, "Drop = sacked" in the
      bottom tier) zones in a Career, with a legend; `SeasonPanel`'s header
      reads "Matchweek N/11 · {Division}" for league/career runs instead of the
      old ladder-tier "Round 1 · Sunday League".
  - **4.6 Polish pass (SHIPPED locally, commits `45da828`…`28c9780`):**
    - **Career economy rebalance.** New `tests/career.sim.ts` (Monte-Carlo
      dynasty harness over the real engine/league/economy/aging) exposed
      runaway bankroll — a complete persistent squad has nothing left to buy, so
      tier income piled up unbounded (median PL £2.6B). Fix: `wageTierMult(tier)`
      in wages.ts (×1 at the bottom tier, ×`WAGE_TIER_K`=1.8 per rung → ~10.5× in
      the PL), applied in `resolveLeagueRound` for career runs only. Swept to
      K=1.8: bankroll now plateaus (PL median £211M, down 12×) and is solvent
      (56% eventually champion over 20 seasons); bottom tier + Classic
      untouched (Classic sim still 37.2%). SeasonPanel stakes/wage preview now
      mirror resolveLeagueRound (tierMult + matchday + tier-scaled wages).
    - **Promotion celebration** in CareerReview: confetti + spring-in trophy +
      animated tier-rise (old division struck through → new in green);
      respects reduced-motion.
    - **Pitch-view polish** (MatchPitchView, determinism-safe): persistent dot
      smoothing (glides scene boundaries + carrier hand-off), off-ball forward
      runs, dribble-vs-pass ball pacing.
  - **4.8 FM transfer market (Career/League) — Phase A (SHIPPED + PUSHED, commits `4b524c5`/`6e35ab8`/`78eb2a7`):**
    Replaces the roguelike gacha shop in the simulation modes with a real,
    browsable market. (Classic keeps the draft shop.)
    - **Content:** +165 lower-league/cult players (`data_src/english_lower.csv`,
      tagged `cult_hero|lower_legend`) via a new safe `--add` mode in
      `generate_players.py` (appends a shard, keeps every existing id intact).
      Pool **503 → 668**. Records "players signed" uses `POOL.length` (auto).
    - **`lib/market.ts`:** `marketValue` (convex EXP=5 × `MARKET_TIER_K`=1.2 tier
      inflation — quality is expensive and scales with the division); **free-agent
      floor** (`overall<64` = £0, no resale → always fieldable, never
      bankrupt-locked); `transferFee`/`marketSellValue`;
      `CAREER_STARTING_BANKROLL`=35.
    - **store/UI:** `signPlayer`, `autoFillSquad` (free-agent fill), market-value
      selling; `components/shop/TransferMarket.tsx` (search/role-filter/free-agent
      toggle/affordable-first); wired into the Transfers tab for Career/League;
      JourneyBar/SquadList market-aware.
    - **economy retune** (market is now the primary sink): `WAGE_TIER_K` 1.5→1.3,
      `UPKEEP_PER_LEVEL` 1.0→0.75. No persistence change (free agents = pool
      minus owned; **rival squads are Phase B**).
    - Sim: reaches PL ~94%, champ ~53%, sacked ~4%; Classic 36.8%. Cult £2-9M,
      stars £20-41M+, galáctico PL squad ~£500M. tsc · 274 tests · build green.
  - **4.8 FM transfer market — Phase B (SHIPPED + PUSHED, commit `767ba13`):**
    rival clubs own real squads → a living market with poaching.
    - `lib/league.ts`: `LeagueClub.squad?` + `assignClubSquads(clubs, pool)`
      (clubs draft strongest-first into role-balanced 14-man squads — favourites
      own the galácticos, minnows get journeymen; no overlap); `allClubOwnedIds`,
      `clubOf`. `lib/market.ts`: `poachFee` (×`POACH_PREMIUM`=1.4).
    - store: `leagueWithSquads()` drafts squads at start/advance/rehydrate
      (idempotent — never undoes poaching; squad is additive + runtime-backfilled,
      **no persistence bump**). `signPlayer` poaches (pays premium, removes from
      the rival, dents their `strength`); free agents / `autoFillSquad` exclude
      club-owned. TransferMarket: "At clubs" filter + ↪club tags + poach buttons.
    - Market tiers: **free agents** (unowned <64, £0) · **open-market** (unowned
      ≥64) · **poach targets** (rival-owned, premium, weakens them). Tests +1 →
      **275**. `generateLeague` unchanged → sim/Classic unaffected. Verified live
      (poached Messi £28M → club strength 839→677).
    - **Remaining polish (optional):** sell-to-clubs flavour; rivals re-signing
      after a poach; transfer windows/bidding. Cup competitions still parked.
  - **4.7 Money sink + title flourish (SHIPPED + PUSHED, commit `faec112`):**
    - **Facility upkeep** (`facilityUpkeep` in stadium.ts, `UPKEEP_PER_LEVEL`=1.0):
      a recurring £/matchweek running cost = totalLevels × per-level × tierMult,
      career-only, applied in `resolveLeagueRound`. `lastIncome` gained an
      `upkeep` field (SeasonPanel + MatchView banners + FacilitiesPanel "Running
      costs" surface it). **Re-tuned both sinks together** via the sim:
      `WAGE_TIER_K` 1.8 → **1.5**, upkeep **1.0**. The economy now has a shape —
      build a war chest climbing (T3/T2 median ~£190M) then spend it surviving at
      the top (**PL median £65M**, max £1.4B, was £2.6B/£4.9B). Champ 57%, climb
      intact; **Classic untouched (sim 37.2%)**. `career.sim.ts` gained
      wage×upkeep combo sweeps.
    - **Champions-of-England flourish**: winning the PL bursts confetti over the
      RunOverModal header (reduced-motion safe) + the honours chips.
- **Phase 4 is feature-complete.** All forks from §2l preamble are resolved.

---

## 3. Active Work & Next Directions

### ⭐ NEXT SESSION — START HERE

**▶ READY-TO-PASTE PROMPT FOR THE NEXT SESSION:**
> Read CLAUDE_CONTEXT.md first — the header block (⚡ UI REDESIGN + POST-REDESIGN POLISH)
> + this "⭐ NEXT SESSION — START HERE" block. The **full UI redesign (7 phases) + all
> post-redesign polish, QA, a consistency pass, and a mobile slot-overlap fix are SHIPPED
> & LIVE.** HEAD `787f822`, working tree clean, local == `origin/main`, persistence
> **v30**, gates green (**397 tests + build + e2e**, balance sims unaffected — no
> lib/store/engine changes in the redesign). The design proposal lives in
> `design-mockups/` (throwaway HTML reference, not wired in). **There is no open
> backlog — the redesign is complete.**
>
> **⚠️ MODEL CHECKPOINT (standing user pref; memory `model-recommendation-before-tasks`):**
> before starting ANY new task, give a one-line model recommendation + reason
> (Sonnet 4.6 = mechanical/QA/CSS/copy · Opus 4.8 = substantial multi-file features ·
> Fable 5 = design-taste-heavy or balance-sensitive) and **PAUSE until the user picks/
> confirms the model** (`/model`). Only then start. This is the one approved exception to
> otherwise-autonomous working (memory `working-style-autonomy`).
>
> **Gates before every push** (this session's norm = push-to-live per task once green;
> confirm the user still wants that): `npx tsc -b`, `npx vitest run` (397), `npm run
> build`, then `npm run test:e2e` — **stop the preview server before e2e** (port 5180
> contention). If touching `src/lib/` or the store, also `npm run sim` (Classic ladder
> 36.8% sacred). Keep CLAUDE_CONTEXT.md updated at task wrap; bump persistence version +
> add a migration for any persisted-shape change.
>
> **Live-QA tooling gotchas (this session):** the user's save (`gaffer-run`) is a
> **Classic R7 ladder** run — back it up (`gaffer-run-BACKUP`) before any destructive
> browser test (new run / playing a match) and restore + reload after. `setTimeout`-based
> async loops inside `preview_eval` DON'T resolve (hit the 30s wall) — drive playthroughs
> with discrete synchronous clicks. Editing the match modal mid-session causes HMR
> glitches in an open match — restart the preview server to verify cleanly.
>
> Today I want to: **[FILL IN — or ask me]**. If I haven't said, recommend a model + a
> task and wait for my pick. (Parked ideas if I'm out of direction: loans, international
> call-ups, set-piece/tactics depth, a continental cup, or a youth-academy money sink —
> all would be new features, so check `npm run sim` if they touch the engine/economy.)

### ⭐ CAREER DIFFICULTY REBALANCE (2026-06-12, committed `54dc692`, NOT pushed)

The home-and-away career was too easy (champ ~67%/dynasty, sacked ~1.3%). Root cause
(found via a new difficulty-aware career sim): the difficulty dial only touched the
BUDGET/BOARD, never the football — promotion rates were ~identical across Easy/Std/Hard
because the budget/wage levers don't dent your dominance over the low-division AI bases
(T5 900 … T1 1650), and Hardcore's tension was a board technicality (promoted-but-sacked).

- **New lever `DifficultyConfig.aiStrengthMult`** (`lib/difficulty.ts`) scales the AI
  clubs you face in Career: **Easy 0.95 / Standard 1.07 / Hardcore 1.18**. Wired via a
  new `careerLeagueBase(tier, difficulty)` helper in the store at every Career
  league-gen site (`startCareer`, `advanceCareerSeason`, `takeJob`, rehydrate);
  standalone League keeps the neutral `LEAGUE_BASE_STRENGTH` (unaffected). Since the
  player's matchweek opponent + AI-vs-AI both derive from `club.strength` (← the league
  base), one multiplier scales the whole division. Only NEW leagues are affected
  (existing in-progress leagues keep their baked strengths → no migration).
- **Hardcore board teeth softened**: graceSeasons 1→2, sackThreshold 35→22, so failures
  are earned on the pitch (relegations) rather than a confidence technicality.
- **Latent bug fixed**: the season W/D/L `record` (used for board confidence) accumulated
  across the WHOLE career — old promotions propped up confidence so a catastrophic season
  couldn't floor it (and `pos` was current-season while `formScore` was all-time —
  incoherent). Now reset per season in `advanceCareerSeason` (`takeJob` already did).
  Only affects Hardcore (Easy/Standard have `sackThreshold 0` → board never sacks on
  form). Persisted-but-self-correcting → no version bump.
- **Balance (career sim, difficulty-aware, 250+ dynasties/difficulty, `npm run sim`):**
  Standard champ **64%→40%**, contested climb (T5 80% / T4 70% / T3 54% / Championship→PL
  38% / title 7%/season), real relegation risk (PL 17%, T2 11%). Easy 78% champ (gentle).
  Hardcore 8% champ / **80% sacked** but PL reachable 60%, ~11 seasons before the axe.
  **Classic 36.8% untouched** (separate `balance.sim.ts`); Draft League 0-stranded.
  Economy bounded (T1 median £618M, was £526M — longer careers accumulate more; not a
  runaway). The difficulty sweep now GUARDS the tension gradient (asserts champ
  easy>std>hard, sacked hard>std, Standard ∈ (20,55)%, Hardcore PL>20%).
- **UI:** the StartMenu difficulty picker shows a headline competition line per tier
  ("A genuine contest…", "A brutal division…"); live-verified the picker renders.
- Tests: `difficulty.test.ts` (aiStrengthMult monotonic + Standard contest assertions),
  `careerLeague.test.ts` (board-teeth path updated for grace 2). **386 tests**, build green.
- **Not yet wired** (future): `rivalAggression` (market poaching pressure), `agentInflation`
  (negotiation) — still parked with their natural pillars.

### ⭐⭐⭐ STRATEGIC RE-FOUNDATION (2026-06-12, user-approved) — COMPLETE & PUSHED (+ Classic Draft-Tournament rework, also pushed)

After the FM-core roadmap completed, the user set a 4-pillar strategic direction to
make the game a "world-class" FM. We discussed architecture before building; the
**four locked design decisions** (via AskUserQuestion):
1. **Economy scale = PROPORTIONAL** — keep the compressed £ scale (£35M start);
   mirror the *ratios* between divisions, NOT literal real-world £ figures (a ~200×
   spread would break every tuned constant + persisted bankroll).
2. **Modes = DEMOTE, don't delete** — Classic + Career are the two front-door modes;
   Endless/Cup/Scenarios/Daily move behind a low-key "More ways to play" entry
   (keeps the Daily leaderboard backend; no save/regression risk).
3. **Unknown pool = unknowns are the FLOOR** — a new Career starts with a procedurally
   generated grey XI; EVERY real player (incl. the cheap 4.8 lower-league signings)
   becomes a market *upgrade*. Cleanest "signing a real player is a win" identity.
4. **Sequencing = difficulty first**, then economy → unknown-pool → start-menu, each
   a separately gated milestone.

**The four pillars:**
- **Pillar 4 — Operational Difficulty Matrix ✅ SHIPPED (engine).** `src/lib/difficulty.ts`
  (pure, 5 tests): `DifficultyId` (easy/standard/hardcore), `DifficultyConfig`,
  `DIFFICULTIES`, `getDifficulty`, `canSack(cfg, confidence, season)`. Difficulty
  dictates CLUB LIMITATIONS, not match-AI cleverness: board patience (graceSeasons +
  sackThreshold), opening budget (startBankrollMult), wage ceiling (wageBudgetMult),
  market volatility (agentInflation, rivalAggression). **Wired now:** top-level
  persisted `difficulty` (v28 migration → 'standard'); `startCareer(difficulty?)`
  scales the opening kitty; `resolveLeagueRound` gives the board TEETH — on Hardcore a
  season of sustained low confidence (`boardConfidence < sackThreshold`, past the grace
  window) SACKS you even without relegation (the teeth `board.ts` was scaffolded for).
  `setDifficulty` action for the future picker. **Standard reproduces today exactly**
  (mult ×1, sackThreshold 0) → the career sim (always Standard) + Classic are
  byte-untouched. Integration A/B test: Standard survives a relegation, Hardcore sacks.
  - **NOT YET wired (land with their natural pillar):** wageBudgetMult hard cap →
    Pillar 1 (finances); agentInflation → negotiation polish; rivalAggression → market.
    The **difficulty PICKER UI** lands with the Start Menu (Pillar 2) — for now
    difficulty defaults to Standard (no regression) and is fully engine-wired.
- **Pillar 1 — Real-World Financial Balancing Array ✅ SHIPPED.** `src/lib/finance.ts`
  is the ONE declarative source of truth for every division's economy. Commits:
  - **1a (consolidation):** `DIVISION_FINANCE` table holds per-tier prizeMult/wageMult/
    marketMult (computed by the SAME formulas → behaviour-neutral) PLUS the new fields.
    `wages.ts`/`market.ts` re-export thin aliases (`tierMult`, `wageTierMult`,
    `marketTierMult`, `MARKET_TIER_K`, `WAGE_TIER_K`, `LEAGUE_NEUTRAL_TIER`) so every
    call site is untouched. Sim provably identical. `finance.test.ts` (5).
  - **1b/1c (sponsorship + fines):** season-level **sponsorship** (`sponsorLocal` every
    club + reputation-gated `sponsorGlobal`/TV money, only the top flight) banked in
    startCareer/advanceCareerSeason with a `sponsorshipMessage` inbox note; per-match
    **disciplinary fines** (`disciplinaryFine`, red = 2 yellows, tier-scaled) counted
    from side-A card events in `resolveLeagueRound`, shown in the payout breakdown
    (`lastIncome.fine`). Calibrated so each tier's sponsorship ≈ its average fines
    (texture without runaway; top runs a slight deficit = hoarding brake, bottom a
    slight surplus = solvency cushion; a DISCIPLINED squad keeps the surplus). Sim
    mirrors both → economy preserved (PL median £546M→£526M, max £1620M→£1462M,
    Classic 36.8%). +2 tests.
  - **1d (wage cap):** the difficulty budget lever — `signPlayer` enforces a hard
    wage ceiling = `wageBudget × difficulty.wageBudgetMult` (Easy lenient, Standard
    at-budget, Hardcore tight → galáctico-stacking gated). `difficulty.wageCap()`.
    signPlayer isn't in the sim → economy unchanged. +1 test.
  - **NO persistence change** (all derived). **Live browser verification deferred to
    Pillar 2** — the new observable surfaces (difficulty picker, Hardcore cap/sacking,
    high-tier sponsorship/fines) need the Start-Menu picker to be UI-reachable; verify
    them together then.
- **Pillar 3 — Unknown-pool starting squad ✅ SHIPPED.** `generateUnknowns(seed)` in
  `lib/career.ts` — a deterministic 15-man grey squad (2 GK/5 DEF/5 MID/3 FWD), rated
  below the free-agent floor (overall < 64), `unknown-…` ids that never collide with
  the real pool, tagged 'unknown'. `startCareer` seeds it via the existing overlay
  (real = players.json, generated = overlay), snapshots into `career.roster` (survives
  reload — rehydrate re-registers), auto-fields a legal XI + bench. App routes the
  non-empty new squad to Tactics → you land on your grey XI; every real signing is an
  upgrade (decision #3). No persistence change. Sim drafts directly → untouched.
  career.test (3) + careerLeague (1). Live visual check batched into Pillar 2.
- **Pillar 5 — Manager career / job market (NEW, user-requested mid-session).** "When
  a manager is sacked they should apply for other jobs in the game world — only jobs
  matching their reputation — it shouldn't be game over." Reframes the career into a
  MANAGER's journey across clubs. **Locked design (user):** inherit the new club's
  REAL squad (FM-authentic, reuses `assignClubSquads`); **NEVER game over** (always
  ≥1 vacancy); **ceiling-down** reach (a title-winner can still land mid-table after a
  low sacking — titles open doors). The persistent identity is the MANAGER (name,
  reputation, one trophy cabinet across all clubs); new career = your OWN club (custom
  name/kit) from the bottom w/ unknowns, sacking = take over an ESTABLISHED club. Keep
  your kit as your managerial "brand".
  - **✅ FULLY SHIPPED + LIVE-VERIFIED (commits `246729b` engine, `83221fc` wiring/UI).**
    - `lib/jobs.ts` (pure, 11 tests): `managerReputation(honours)` 0–100 (peak tier +
      titles/promotions + tenure − relegations), `reputationCeilingTier` (~20 rep/rung),
      `reputationLabel`, `generateVacancies(rep, seed)` (always ≥1, ceiling→base biased
      to ceiling), `draftInheritedSquad(strength, pool, seed)` (real pool players matched
      to a club's stature).
    - **store:** `jobMarket: Vacancy[]|null` (persisted, **v29** migration).
      `resolveLeagueRound`'s sacking branch (bottom-tier relegation OR Hardcore board-sack)
      now generates vacancies from `managerReputation(history)` and opens the market —
      `runStatus` stays `'playing'` (NEVER game over); no between-seasons review on a
      sacking. `takeJob(vacancy)`: inherit the club's real squad, its division, a fresh
      tier-scaled budget (`CAREER_STARTING_BANKROLL × tierMult + sponsorship`); `clubName`
      becomes the new club (kit stays your brand); season + history carry across clubs;
      facilities reset (rebuild project).
    - **UI:** `components/career/JobMarket.tsx` — App-level overlay (z-65) with a
      reputation meter + vacancy cards (club, division, squad stature, Apply). Champion-
      of-England still ends gloriously (only sackings reroute here).
    - **Live-verified:** new career fielded 15 grey unknowns @ £38M w/ sponsorship inbox
      (Pillars 1+3); injected a sacked state → Job Market rendered ("On the market",
      ESTABLISHED 74/100 meter, vacancy cards); clicked Apply → took over Oakvale City
      (League One) with a real inherited squad (Cureton/Mellor/Kinkladze/Hopkin/
      Cattermole…), season 4→5, history carried, £48M, no console errors; restored the
      R7 backup clean.
    - **Follow-up polish ✅ DONE (commit `56311a9`):** (1) difficulty-aware job market —
      `DifficultyConfig.jobOffers` (Easy 5/Standard 4/Hardcore 2) + `repPenaltyOnSack`
      (Hardcore docks 15 rep → humbler clubs); applied in resolveLeagueRound; Standard
      unchanged → sim untouched. (2) Manager trophy cabinet spanning clubs —
      `SeasonRecord.club` (optional, recorded at season-end) + `careerHonours.clubsManaged`;
      CareerHub shows "Clubs managed" + names the club per season in the history timeline.
      (3) Reputation meter in the Career Hub (managerReputation + label). Live-verified on
      a 3-club career. No persistence bump.
- **Pillar 2 — Start Menu + mode demotion ✅ SHIPPED + LIVE-VERIFIED (commit `f206b06`).**
  `components/run/StartMenu.tsx` (App-level, z-55, shown on load, hidden during a
  match): one-click **Resume** hero that reads the live run back (mode/career division +
  season + matchweek + bankroll); **New Career** → a dedicated **difficulty picker**
  step (Easy/Standard/Hardcore cards from `DifficultyConfig.effects`, Standard
  pre-selected) → `startCareer(picked)`; **Quick Classic**; and the demoted modes
  (Endless/Cup/Scenarios/Daily) behind **"More ways to play"** → the existing
  NewRunModal (decision #2). How-to-play + Records links. The **RETRO GAFFER logo is
  the home button** back to the menu; NewRunModal's `onStarted` dismisses it;
  first-time visitors hit onboarding (z-70) first. This is where the difficulty
  engine (wired since P4) finally becomes reachable in normal play. Live-verified
  (Resume summary correct, difficulty matrix renders, Resume enters game, logo
  returns, no console errors, R7 save untouched).

**Anti-bloat principle reaffirmed:** the codebase is v28 / 347 tests — the lever is
CONSOLIDATION (declarative tables, reuse overlay/ModeConfig/persistence patterns), not
parallel systems. Mode demotion is the one move that genuinely cuts surface area.

### ⭐ CLASSIC DRAFT LEAGUE (2026-06-12, user-requested rework — committed, NOT pushed)

The user reworked Classic from the gacha ladder into a **snake-draft league**. Quick
Classic → **pick difficulty** → **draft** a 14-man squad against 11 AI clubs (your
budget scales with difficulty; AI budgets seeded) → the drafted squads form a **single
round-robin league** (11 matchweeks) → finish 1st to win.
- `lib/draft.ts` (pure, 14 tests): `snakeOrder`, `generateDraft`, `canPick` (reserve
  guard — never spend so you can't fill required roles), **`pickableInDraft`** (ROLE-
  FIRST for the player + a last-resort so a legal XI is ALWAYS completable, even on a
  depleted market), `aiPick` (role-first + safety net), `leagueFromDraft`,
  `CLASSIC_DRAFT_BUDGET`=150.
- store: `draft: DraftState|null` (persisted, **v30**); `startClassicDraft(difficulty)`,
  `draftPick(id)` (your pick → AI picks around you → on completion builds the league +
  fields your XI). Season runs the existing league path (`s.league` set, `s.career`
  null → 1st = champions). `components/run/DraftRoom.tsx` (z-65 board).
- Entry points: StartMenu Quick Classic (difficulty pick), NewRunModal Classic card,
  RunOverModal Classic replay — all route to the draft (mode-checked BEFORE `league`).
- **Graceful migration:** existing ladder-Classic saves keep playing as a ladder; only
  NEW Classic runs are draft leagues. The old ladder resolve path is still intact.
- **Live-verified:** drafted Grobbelaar/Pirlo/Guardiola/Ronaldinho/Giggs (str 1909 vs
  AI 1953-1964), played MW1, table + AI fixtures resolved, no console errors.
- **Debugged + balanced (commits `e387fb3`, `f13b684`):** a full playthrough fixed two
  real stranding bugs (the board didn't surface affordable players when budget ran low
  — both for a needed role and for depth at £0; now it surfaces affordable + a
  last-resort, so the squad ALWAYS fills). Cosmetic: replay label "New Classic", HUD
  hides lives-hearts in a league. **Balance sim (`tests/draft.sim.ts`, via `npm run
  sim`):** 120 seasons/difficulty through the real draft+engine; asserts the draft
  never strands (0/360). **Perf:** `aiPick` was O(pool²)/pick (laggy in-game + a slow
  sim) → one-pass `reserveCost` + lazy `aiPick` (snappy). **Difficulty-scaled rivals:**
  AI budget = `AI_DRAFT_BUDGET(120)/startBankrollMult` (weaker clubs on Easy, richer on
  Hardcore) → clean curve: Easy champ 15%/top3 48%, Std 13%/30%, Hard 4%/18%.
- **✅ CLOSED-TOURNAMENT + FREE-PICK REWORK (commit `32383c0`, playtest feedback):**
  Now a proper closed tournament with a real draft board.
  - **Draft board** (`DraftRoom.tsx`): FREE picking from pick 1 (any affordable role —
    no role-first; killed the "pool changes after 11 picks" jank). `pickableInDraft`
    reserves your final picks for any still-missing required roles + a last-resort
    cheapest, so a legal XI ALWAYS completes. Surfaces the full pool (≤200) with
    position tabs + name search + Value/Rating sort (asc/desc) + Affordable filter.
    Clear attributes per card: overall (tier-coloured) + ATK/DEF.
  - **Closed tournament:** 16-man squad (`DRAFT_SQUAD_SIZE`=16 — XI + 5 subs). Bank
    LOCKED at £0 (`resolveLeagueRound` gates ALL economy/inbox/offers/morale for
    `draftLeague = mode==='classic' && !career`); no transfers in/out (sell blocked).
    Hidden UI: bank HUD, lives-hearts, and the Transfers/Inbox/Challenges/Compete/
    Records tabs (only Tactics/Season/Club via TabNav `hiddenTabs`).
  - Sim re-gated: still 0/360 stranded; curve holds (Easy avgPos 5.5/top3 33%, Hard
    8.3/11%). Live-verified end-to-end; pushed.

---

**Status (2026-06-12):** the **entire FM-core roadmap is shipped & PUSHED** — the
FM-feel transfer batch (tasks 1–4 + Inbox) AND both roadmap tiers: Next-Up
(home-and-away, training/fatigue, morale, Cup) + Future-Edge (board confidence &
pledges, living transfer-market AI, fan/finance loop, player dynamics). Then a
**full-season integration QA** found & fixed a real **auto-pick soft-lock**
(commit `bf698b6`). Gates: **tsc clean · 340 tests · build green · persistence
v27 · Classic 36.8% · career economy preserved.** Nothing left on the roadmap;
the loop is feature-complete. Full per-feature detail in §2l below. _(Older lines
in this block referencing v25/299 tests are historical — current is v27/340.)_

The FM transfer system has:
negotiated bidding + personal terms (marquee wage gate), incoming offers, transfer
windows, contracts/Bosman, and an Inbox tying results/injuries/board/bids/
departures together. Next candidates are the **Parked** list under ⭐ below.

**The current transfer system (Career/League):** browsable market
(`components/shop/TransferMarket.tsx`) with three tiers — **free agents**
(unowned, overall < `FREE_AGENT_MAX_OVERALL`=64, £0, no resale), **open-market**
(unowned, ≥64, market value), **poach targets** (rival-owned, `poachFee` =
market value × `POACH_PREMIUM`=1.4, and poaching dents the club's strength).
Store actions: `signPlayer(id)` (buy/poach), `autoFillSquad()` (free-agent fill),
tier-aware `sell`. Classic/Endless/Scenario keep the roguelike gacha `Shop`.

**LIVE ECONOMY CONSTANTS (source of truth — §2l historical notes show older
swept values; THESE are what's shipped):**
- `lib/market.ts`: `VALUE_DIV`=45, `VALUE_EXP`=5, `MARKET_TIER_K`=1.2,
  `MARKET_SELL_RATE`=0.85, `FREE_AGENT_MAX_OVERALL`=64, `POACH_PREMIUM`=1.4,
  `CAREER_STARTING_BANKROLL`=35, **`RENEWAL_RATE`=0.3** (contract-renewal
  signing-on bonus = 30% of market value; free for free agents).
- `finance.ts`: `WAGE_TIER_K`=**1.4** (was 1.3). `lib/stadium.ts`:
  `UPKEEP_PER_LEVEL`=**0.85** (was 0.75). Bumped together 2026-06-12 to tame the
  top-tier hoard the difficulty rebalance inflated (career-only → Classic untouched).
- **Contract-renewal bonuses are the STANDING money sink** (the "nothing to spend
  on once your squad's complete" fix): `renewalCost(p, tier)`; charged in
  `advanceCareerSeason` for renewed players; `renewContract` gated on the bankroll;
  CareerReview shows the cost + a running total. Modelled in `career.sim.ts` (the
  AI renews the best expiring it can afford).
- Career sim (`tests/career.sim.ts`, run via `npm run sim`) — CURRENT (post
  difficulty rebalance + economy retighten + renewals): **Standard** reaches PL
  **~97%**, champion **~43%** over 20 seasons (was ~67% — now a real contest),
  sacked **~1%**, **PL median bankroll ~£71M** (was £546-618M), hoarders (>£400M)
  **~27%** (was 91%), max ~£999M; Easy ~75% champ / Hardcore ~8% champ, ~80%
  sacked. **Classic completion 36.8%** (the Classic balance harness
  `tests/balance.sim.ts` shares the run; career levers are post-match/career-only
  so Classic is untouched). Persistence **v30**. **389 tests**, build green.

**⭐ FM-FEEL ENHANCEMENTS — COMPLETE & PUSHED (tasks 1–4 + Inbox).** All
Career/League only; Classic untouched. Commits `439b3ec`…`d28306c` (see git log).

1. **Bidding & personal terms — ✅ (commits `439b3ec`, `becc78b`).**
   `lib/negotiation.ts` (pure, 8 tests): `wageDemand`, `evaluateBid`
   (accept/counter/reject vs asking price), `maxWageOffer` — a **per-player wage
   ceiling** scaling with division + bankroll (the marquee gate: a galáctico balks
   in a low division even when you can afford the fee; debugging found the old
   squad-budget gate never fired). `NegotiationModal.tsx` is the flow;
   `signPlayer(id, agreedFee?)` commits. Modal-only gate → no economy impact.
2. **Incoming offers for YOUR players — ✅ (commit `26b4d61`), via the Inbox.**
   `lib/market.ts` `rivalBids` (pure, seeded): players ≥`OFFER_MIN_OVERALL` (70)
   draw bids; buyer biased to clubs short in that role then by strength; capped
   2/wk. Generated in `resolveLeagueRound` on a SEPARATE seed stream → determinism
   intact. Accept banks the fee + player leaves + buyer strengthens; reject keeps.
   - **Club Inbox (connective tissue, commit `f08a9e2`):** `lib/inbox.ts` + a
     top-level persisted `inbox: InboxMessage[]`. `resolveLeagueRound` posts result
     recaps, injury notes (with duration), board verdicts + bids; Bosman departures
     too. Conditional **Inbox tab** (Career/League only) with unread badge;
     `InboxPanel.tsx` inline Accept/Reject. `markInboxRead`/`acceptOffer`/`rejectOffer`.
3. **Transfer windows — ✅ (commit `cb4873f`).** `lib/league.ts`
   `isWindowOpen(mw, weeks)` — summer window (`SUMMER_WINDOW_WEEKS`=3) + one winter
   week (`winterWindowWeek`); `nextWindowOpensAt` for UI. `signPlayer`/`sell`/
   `autoFillSquad`/`acceptOffer` + offer generation all window-gated (market modes
   only). TransferMarket shows an open/closed banner; signing disabled when closed.
4. **Contracts & Bosman — ✅ (commit `d28306c`).** `CareerMeta.contractYears`
   (`DEFAULT_CONTRACT`=3, `YOUTH_CONTRACT`=4); `resolveContracts` (pure) runs deals
   down each season — renewed reset, expiring+unrenewed leave on a free.
   `advanceCareerSeason` drops departed from owned/xi/bench (they stay registered →
   reappear in the market) + posts a Bosman inbox note. CareerReview gained an
   **Expiring Contracts** renew-toggle section. Persistence **v25** + migration.

**Parked after FM transfers** (next candidates): cup competitions
([[future-feature-ideas]]); transfer polish (sell-to-clubs flavour, rivals
re-signing after a poach/Bosman, AI clubs bidding against each other); contract
WAGES were kept derived (the wage *bill* still uses `wage(p)`, not a stored agreed
wage) to avoid an economy re-tune — revisit if per-player negotiated wages are wanted.

**⭐⭐ FM-CORE ROADMAP (2026-06-12, user-approved):** strategic feature-map after
the FM-transfer batch. The engine (`engine.ts`+`stats.ts`: attribute-driven,
segmented, 2D viz) is strong; the management *shell* is the work. Two tiers:
- **Next Up (core loop) — ✅ ALL DONE:** (1) home-and-away; (2)+(4) training,
  sharpness & fatigue; (3) morale/form; (5) **Cup mode** (`lib/cup.ts`, see below).
  The weekly loop is complete. **Next tier: Future-Edge** (board confidence,
  living transfer-market AI, memory-carrying inbox interactions, player dynamics,
  fan/finance loop) — all ride the Inbox + retro-minimal UI.
- **Future Edge (the "FM killers"):** living board confidence — **✅ DONE**;
  **living transfer-market AI — ✅ DONE** (rivals re-sign after a poach + AI clubs
  sign over the season); **fan/finance reinvestment loop — ✅ DONE**;
  **memory-carrying inbox (the press-conference killer) — ✅ DONE**; **lightweight
  player dynamics — ✅ DONE** (see below). **The whole FM-core roadmap is now
  delivered.** All ride the **Inbox** + retro-minimal UI.

**Future-Edge: player dynamics (captain + dressing room) — ✅ DONE (Career/League;
DERIVED → no persistence).** `lib/squad.ts` (pure, 4 tests): `captainOf` (highest-
rated fit starter, the squad leader), `dressingRoomMood` (buzzing/settled/tense/
fractured from the squad's aggregate morale), `leadershipMult`/`leadershipModifiers`
(the captain's mood swings the whole XI ±`LEADERSHIP_SWING`=2.5% via
`MatchModifiers.teamMult` — a happy leader lifts everyone). App folds it in
alongside training/morale (career/league only). UI: TrainingPanel shows
"Dressing room: settled · Captain: Tony Coton". Sim-safe (the harness has no
morale → neutral → Classic 36.8%, career unchanged). Verified live.

**Future-Edge: memory-carrying inbox / board pledges — ✅ DONE (Career).** The
board's pre-season expectation is now an INTERACTIVE message you respond to and
the inbox REMEMBERS, paying off at season end. `lib/board.ts`: `metExpectation`
(lower tiers must promote, top flight must survive), `pledgePayoff` (`accept` =
±`PLEDGE_BONUS`/`PLEDGE_PENALTY` gamble · `temper` = `TEMPER_BONUS`/0 safe · no
pledge = 0, the sim's baseline). `InboxMessage` gained `pledgeable`/`pledge`;
`expectationMessage` is pledgeable; `pledgePayoffMessage` is the season-end note.
Store `respondToBoard(id, choice)`; `resolveLeagueRound` reads the season's pledge,
adjusts `careerReview.bonus` by the payoff (floored at 0) + posts the payoff note.
`InboxPanel` renders Accept-the-challenge / Temper buttons + the remembered choice.
**Sim-safe** (the sim never pledges → neutral → Classic 36.8%, career unchanged).
board(6)+careerLeague(+1) tests. Verified live: accepted → remembered; payoff
integration-tested (win → promoted → bonus = reviewBonus + PLEDGE_BONUS + a note).

**Future-Edge: fan/finance loop — ✅ DONE (Career).** `lib/stadium.ts`:
`STADIUM_CAPACITY` per level + `attendanceFill(streak)` (form-driven, bounded
0.6–1.0, averages ≈`REFERENCE_FILL`=0.8 so the economy is neutral), `attendance`
(capacity × fill), and `matchdayIncomeFor(level, streak)` — matchday income now
FLEXES with the crowd (a winning run packs the ground → more income; a slump
empties it), replacing the old flat `matchdayIncome` in `resolveLeagueRound` +
the career sim. The loop made visible: FacilitiesPanel shows "🎟 6,000 / 8,000 ·
75% full" and the live matchday £. Calibrated zero-sum (neutral streak = the old
flat figure) → **sim preserved** (Classic 36.8%, PL median £546M vs £550M, hoarders
84.7%). 5 stadium tests. Verified live.

**Future-Edge: AI clubs sign over the season (living market) — ✅ DONE.**
`lib/market.ts` `aiClubSigning` (pure, seeded, 3 tests): each matchweek (window
open, separate seed stream so match results are untouched) a rival may sign the
best available open-market player (≥64) — weighted toward weaker clubs; signs to
fill a gap if it has one, else for DEPTH (clubs start role-balanced, so the strict
needs-gating was initially a dead feature — caught live, fixed to allow depth
buys). The club strengthens (`AI_SIGN_FACTOR`=0.5, capped +100) and that target
leaves YOUR market (`signingMessage` inbox note). Applied in `resolveLeagueRound`
(folds into the returned league clubs). Store-only → Classic 36.8% untouched.
Verified live: "Dewsworth Albion strengthen — signed Sergi Roberto" (squad 14→15).

**Future-Edge: rivals re-sign after a poach — ✅ DONE.** In `signPlayer`'s poach
branch (store), when you prise a player from a rival the club now REACTS: it
re-signs the best available replacement of that role from the open market
(`POOL`, excluding owned + all club-owned), so it's dented (−1.2× the poached
rating) but not gutted (+0.9× the replacement) — and the replacement leaves the
pool (the market tightens). Notice names the replacement. Integration-tested
(`careerLeague.test.ts`: squad size restored, replacement left the pool). Store-
only (the sim doesn't poach) → Classic 36.8% untouched. Verified live: poached a
club's player → every club stayed at 14 (the loser re-signed).

**Future-Edge: living board confidence — ✅ DONE (Career; derived → no persistence,
no sim change).** `lib/board.ts` (pure, 4 tests): `boardConfidence(position,
clubs, record)` blends table position (65%) + form (35%) → 0–100, with a neutral
`CONFIDENCE_NEUTRAL`=60 baseline before any games (the pre-season table is just an
alphabetical tiebreak); `confidenceBand` (secure/stable/shaky/under-pressure) +
`confidenceLabel`; `boardExpectation(tier)` (pyramid-scaled ask). Inbox: a
pre-season `expectationMessage` (posted in `startCareer` + `advanceCareerSeason`)
and a deduped mid-season `confidenceWarning` (fires once per season when
confidence is `under-pressure`, in `resolveLeagueRound`). UI: a confidence meter
in `CareerHub`'s This-Season panel. No hard sacking yet (relegation stays the only
fail → sim untouched); teeth can be added later without re-architecting. Verified
live: National-League career → "mount a promotion challenge" expectation in the
inbox + a "Stable" meter pre-season.
- **Anti-bloat principles** (already how the codebase works): derive don't store;
  one pure `lib/` module + thin UI per feature; the Inbox is the default UI surface;
  stay seeded/deterministic; don't fork the engine, add a bounded lever.

**#1 home-and-away fixtures — ✅ DONE (user chose "everywhere").** `lib/league.ts`
`doubleRoundRobin` (single RR + reversed-venue return legs → 2(n−1)=22 matchweeks
for 12 clubs). `generateLeague` uses it for League AND Career. `totalWeeks` now
derives from the fixtures (legacy single-RR saves keep 11 weeks → **no migration**).
New `seasonScale(state)` = (clubs−1)/weeks (0.5 for home-and-away) normalizes the
per-matchweek economy in BOTH `resolveLeagueRound` and the career sim, so a season
nets the same as the old 11-game one (balance invariant to fixture count). Window
helpers + UI already read `totalWeeks`, so they adapted free. **Sim re-gated:**
Classic 36.8% (untouched); career economy preserved (PL median ~£550M, solvent,
climbs). Note the longer season lowers variance → **easier career** (champ
53%→67%, sacked 4%→1.3%) — accepted as the cost of a legitimate league.

**#2+#4 training, sharpness & fatigue — ✅ DONE (Career/League; user chose
SUBTLE drift + GENTLE bite).** `lib/training.ts` (pure, 11 tests):
- **Sharpness** (0–100, `nextSharpness`): +8 starting, −6 benched; `sharpnessMult`
  = 1.0 when sharp (≥70), down to 0.95 rusty. Rewards a settled XI.
- **Fatigue** (0–100, `nextFatigue`): +18 starting, recovers a fraction each week
  (25%, fitness focus 40%); `fatigueMult` 1.0 until 55 then down to 0.95. A regular
  starter settles ~72 (≈neutral), so the SYSTEM is near net-neutral for a fixed XI
  → **the career sim (which doesn't model it) stays valid**; it's a skill layer.
- **Training focus** (`TrainingFocus`: attacking/balanced/defensive/fitness):
  `focusModifiers` tilts via `MatchModifiers.role` (attacking → +FWD/MID, etc.);
  fitness speeds recovery. `conditionModifiers` folds each starter's
  sharpness×fatigue into `MatchModifiers.player`.
- **Wiring:** App's `playerTeam` merges `focusModifiers` + `conditionModifiers`
  into the existing modifier pipeline **only when `career||league`** (Classic
  byte-identical, no engine change). `resolveLeagueRound` updates sharpness/fatigue
  from who started (pruned to the squad). Store: `training`/`sharpness`/`fatigue`
  (persist **v26** + migration), `setTraining`. UI: `TrainingPanel` (Tactics tab,
  focus selector + "N rusty · N tired" summary) + TIRED/RUSTY badges in SquadList.
- Verified live: focus persists; a played MW set starter sharpness 70→78,
  fatigue 0→18; injected extremes showed the badges + summary. Sim unmoved.

**#3 morale/form — ✅ DONE (Career/League; fully DERIVED → no persistence bump).**
`lib/morale.ts` (pure, 5 tests): `morale(avgRating, sharpness)` blends recent form
(avg match rating, 60%) + involvement (sharpness as a minutes proxy, 40%) → 0–100;
`moraleBand` (buzzing/good/content/unsettled/unhappy); bounded `moraleMult` (±3%,
neutral at 55); `moraleModifiers` folds each starter into `MatchModifiers.player`.
App merges it alongside the training/condition mods (career/league only → Classic
byte-identical). `resolveLeagueRound` posts ONE deduped `morale` inbox message for
the unhappiest newly-unhappy player per matchweek (stable id `morale-{id}` → never
spams). UI: mood icon (Smile/Meh/Frown) in SquadList + a `morale` inbox kind/icon.
A skill layer the sim doesn't model (≈net-neutral) → sim unmoved (Classic 36.8%).
Verified live: a frozen-out, poor-form starter showed the Frown + RUSTY and
triggered "Tony Coton is unhappy" in the inbox; dedup held.

**#5 Cup mode — ✅ DONE (standalone knockout; user chose "standalone" over
interleaved to protect the snappy identity).** `lib/cup.ts` (pure, 5 tests):
`generateCup` (reuses `generateLeague` for seeded clubs → 8 clubs, 3 rounds,
shuffled bracket draw), `cupTies`/`playerTie`, `tieWinner` (score, level →
seeded shootout), `resolveCupRound` (your tie = real engine, AI ties simmed via
`simAiResult`, survivors advance). New `cup` ModeId/`CUP` config + `cup: CupState`
store state (persist **v27** + migration), `startCup`, `resolveCupRoundState`
(light sprint economy: reward+income+interest−wages, discipline + history; no
tiers/facilities). Reuses the FM transfer market (`marketTierOf` returns neutral
for cup; no windows). UI: `CupBracket.tsx` on the Season tab, New Run "Cup Run"
card, cup-aware `SeasonPanel` header + `RunOverModal` (CUP WINNERS / KNOCKED OUT
+ "New Cup Run" replay). No training/morale/inbox in cup (a 3-match sprint).
Classic sim untouched (36.8%) — cup is a separate mode the harness doesn't run.
Verified live: built a squad via the market, played QF→SF→Final (bracket advanced,
AI ties resolved, a red-card suspension handled via the normal availability flow),
lost the final → cup-aware end screen.

**Implementation anchors:** market logic in `lib/market.ts`; league/club state
+ squads in `lib/league.ts` (`LeagueClub.squad`, `clubOf`, `allClubOwnedIds`);
the FM economy resolves in the store's `resolveLeagueRound` + `signPlayer`/`sell`;
UI in `components/shop/TransferMarket.tsx`. Re-gate any economy shift with
`npm run sim` (career + Classic). **Parked after FM transfers:** cup competitions
([[future-feature-ideas]]); transfer polish (sell-to-clubs flavour, rivals
re-signing after a poach).

**Career recap (just shipped — §2l 4.4b/4.4c/4.5):** Career reuses the top-level
`s.league`; `CareerState` holds `tier` (division), `facilities` (club upgrades),
and `history` (completed-season log). `resolveLeagueRound` runs `seasonOutcome` at
season end (champion = win the run, sacked = relegated from the bottom tier, else
a promotion/relegation review that keeps the academy intake), logs the season to
`history`, and applies facility effects; `tierMult` scales prize money by tier.
The **Career Hub** (`components/career/CareerHub.tsx`, in the Club tab) is the
dynasty home: pyramid ladder, this-season outlook, honours (`careerHonours()`),
mid-season facility upgrades (`FacilitiesPanel.tsx`), and the history timeline.
Store-integration coverage: `tests/careerLeague.test.ts` (+ `stadium.test.ts`,
`career.test.ts`).

**Operational gotchas learned this session (IMPORTANT for browser testing):**
- BEFORE any destructive browser test (New Game / startLeague / playing a
  match), back the save up to a **localStorage key** (e.g.
  `localStorage.setItem('gaffer-run-BACKUP', localStorage.getItem('gaffer-run'))`).
  An in-memory (`window.__x`) snapshot is wiped by page reloads — this cost the
  user's R7 save once. (R7 was reconstructed; a backup key habit prevents it.)
- `import('/src/store/useGameStore.ts')` in preview_eval sometimes returns a
  **phantom store instance** separate from the app's — reads/writes won't always
  reflect the UI. Trust the UI + `localStorage` for ground truth, not `window.__gs`.
- Editing the **store** file often doesn't hot-reload its action closures
  (zustand+HMR); do a full page reload to pick up store changes.
- `preview_console_logs` returns a **stale buffer** (fixed old `?t=` timestamps);
  use a production `npm run build` as the authoritative "no real errors" check.
- Match modals run out at 0.5×/Instant fast; a match completing **advances the
  round** (resolves) — close the modal to suspend instead, or back up first.

The full roadmap detail (every phase, commit hashes, files) is in §2l above.

---

**Earlier roadmap context.**

All earlier work — planned phases (0–3), the 2026-06-10 mega-session
(sections 2b–2i: QA fixes, FTUE, journey bar, auto-pick/auto-sign, flat nav,
extended stats, 2D pitch view, team kits), the improvement program (§2j:
interactive match, sound, crests, achievements, ErrorBoundary, e2e, PWA, Daily
leaderboard) and QA audit #2 (§2k) — is shipped and deployed. (That baseline
was v18 / 224 tests; the 2026-06-11 feedback roadmap took it to **v20 / 255** —
see §2l and the "START HERE" block above for the current state.)

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
- **Daily leaderboard** — LIVE (Upstash provisioned; prod `/api/daily` 200).
  (Was listed here as "ships dark" — that's stale; it's been live since
  2026-06-10, see §2j.)

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
