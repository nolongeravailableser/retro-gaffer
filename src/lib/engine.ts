/**
 * Match engine. Pure and fully seeded — given the same teams and seed it
 * ALWAYS produces the identical events and score. No Math.random, no timers.
 * The UI consumes the returned data and animates it; the engine never renders.
 */

import type { Player, MatchEvent, MatchResult } from './types';
import { Rng } from './rng';
import { deriveStats, teamStatProfile, type TeamStatProfile } from './stats';

export interface MatchTeam {
  name: string;
  /** Total boosted attack (already includes chemistry). */
  attack: number;
  /** Total boosted defense (already includes chemistry). */
  defense: number;
  /** Starters, used to name players in commentary. */
  squad: Player[];
}

/**
 * Tunable match parameters. A game mode can override any of these; the default
 * preset below is the classic ruleset, so every existing caller (and test) that
 * omits the argument behaves byte-for-byte as before.
 */
export interface EngineTuning {
  xgScale: number;
  minXg: number;
  maxXg: number;
  /** A near-miss is a bit more likely than a goal, for ticker texture. */
  chanceFactor: number;
  /** Per-minute probability of a yellow card for side A. */
  pYellow: number;
  /** Per-minute probability of a straight red for side A. */
  pStraightRed: number;
  /** Per-minute probability of an injury for side A. */
  pInjury: number;
  /**
   * Master dial (0–1) for how much the EXTENDED stats (pace/shooting/passing/
   * defending/goalkeeping/composure/discipline/physical) sway the sim. At 0 the
   * engine reproduces the pure ATK/DEF math; at 1 (default) stat profiles
   * modulate xG (bounded ±14%), the 75'+ window, scorer identity, and who
   * picks up cards/injuries. Defaults to 1 when omitted.
   */
  statInfluence?: number;
}

/** The classic ruleset — the single source of truth for default match feel. */
export const DEFAULT_TUNING: EngineTuning = {
  xgScale: 2.5,
  minXg: 0.15,
  maxXg: 2.5,
  chanceFactor: 1.4,
  pYellow: 0.025, // ~2.25 yellows/game
  pStraightRed: 0.003, // ~0.27 reds/game
  pInjury: 0.005, // ~0.45 injuries/game
  statInfluence: 1,
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Expected Goals from a side's attack vs the opponent's defense.
 * Evenly matched (attack == oppDefense) → half of xgScale. Monotonic:
 * more attack raises xG, more opposing defense lowers it.
 */
export function expectedGoals(
  attack: number,
  oppDefense: number,
  tuning: EngineTuning = DEFAULT_TUNING
): number {
  if (attack <= 0) return tuning.minXg;
  const ratio = attack / (attack + Math.max(0, oppDefense));
  return clamp(ratio * tuning.xgScale, tuning.minXg, tuning.maxXg);
}

const GOAL_LINES = [
  '{p} smashes it into the top corner! GOAL!',
  '{p} is played in behind and finishes coolly. GOAL!',
  'An absolute worldie from {p}! GOAL!',
  '{p} rises highest and heads it home! GOAL!',
  'Route one — {p} bundles it over the line! GOAL!',
  '{p} curls a free-kick into the postage stamp! GOAL!',
  '{p} dummies the keeper and rolls it in. GOAL!',
  'A thunderbolt from {p} — the net nearly comes off! GOAL!',
  '{p} pounces on the rebound and taps in. GOAL!',
  '{p} slaloms past two and slots it home. GOAL!',
  'Cheeky panenka from {p} from the spot! GOAL!',
  '{p} volleys it first time — unstoppable! GOAL!',
  'A slick one-two and {p} sweeps it in. GOAL!',
  '{p} nods in at the back post from the corner. GOAL!',
];

// Context-flavoured goal pools — chosen deterministically (no extra RNG), then
// the same single rng.int draw picks the line, so match scores are unchanged.
const LATE_GOAL_LINES = [
  'Drama at the death! {p} snatches it late! GOAL!',
  '{p} with a winner in the dying seconds! GOAL!',
  'Heartbreak for the other end — {p} strikes late! GOAL!',
  '{p} pops up in the 90th to settle it! GOAL!',
];

const EQUALIZER_LINES = [
  'Game on! {p} levels it up! GOAL!',
  '{p} hauls them back into it — all square! GOAL!',
  'Right on cue, {p} equalises! GOAL!',
  '{p} answers straight back! It\'s level! GOAL!',
];

const OPENER_LINES = [
  '{p} breaks the deadlock! GOAL!',
  'First blood — {p} opens the scoring! GOAL!',
  '{p} draws first blood with a tidy finish! GOAL!',
];

const CHANCE_LINES = [
  '{p} bursts through the midfield… but drags it just wide!',
  '{p} tries his luck from range — inches over the bar!',
  'Wonderful save! {p} is denied at the near post.',
  '{p} skies it over from six yards — he should score!',
  '{p} rattles the crossbar! So close.',
  '{p} wriggles into the box but the last-ditch tackle is in.',
  '{p} forces a fingertip save from the keeper!',
  'Goalmouth scramble — {p} can\'t quite poke it home!',
  '{p} hits the side-netting and claims it was in!',
  'The flag is up — {p} had timed his run a fraction early.',
  '{p} curls one onto the roof of the net.',
  'Heroic block denies {p} from point-blank range!',
];

const YELLOW_LINES = [
  '{p} catches one late — the referee has no hesitation. Yellow card.',
  'Reckless challenge from {p}. The book comes out.',
  '{p} argues the toss and picks up a booking.',
  'Cynical foul from {p} — straight into the referee\'s notebook.',
  '{p} drags his man down on the break. Booked.',
  'A clumsy lunge from {p} earns a yellow.',
  '{p} is booked for time-wasting — the crowd jeers.',
  'Shirt-pull from {p} and the referee reaches for his pocket.',
];

const SECOND_YELLOW_LINES = [
  '{p} goes in again — second yellow, and he\'s off! Ten men!',
  'Stupid tackle from {p}. Already on a yellow. He\'s off! Ten men.',
  '{p} dives in — second booking, an early bath. Ten men!',
];

const RED_LINES = [
  'STRAIGHT RED for {p}! Horrific challenge — off he goes!',
  '{p} sees red for a last-man foul. Ten men.',
  'The referee shows {p} the red card — dangerous play, no arguments.',
  'Studs up from {p} — the referee has no choice. Red!',
  '{p} loses his head and gets his marching orders. Red card!',
];

const INJURY_LINES = [
  '{p} is down and it looks serious. He\'s helped off the pitch.',
  'Worrying scenes as {p} can\'t continue — a stretcher is called.',
  '{p} pulls up clutching his hamstring. He\'s done for the day.',
  '{p} limps off after a heavy challenge. Fingers crossed it\'s nothing serious.',
  '{p} rolls an ankle in the turf and can\'t run it off.',
  '{p} takes a knock and signals to the bench — he can\'t carry on.',
  'The physio is on for {p}, and it\'s not looking good.',
];

/** Choose the goal-line pool from match context (no RNG consumed). */
function goalPool(minute: number, scoredFor: number, scoredAgainst: number): string[] {
  if (minute >= 85) return LATE_GOAL_LINES;
  if (scoredFor === 1 && scoredAgainst === 0) return OPENER_LINES;
  if (scoredFor === scoredAgainst) return EQUALIZER_LINES; // just drew level
  return GOAL_LINES;
}

// Exported so presentation layers (sound, 2D viz) can recognise the canonical
// whistle beats by TEXT — a driver-inserted flavour event (substitution, team
// talk) that lands on minute 45 must not read as half-time.
export const KICKOFF = 'And we are underway at the Theatre of Nostalgia!';
export const HALFTIME = 'The referee blows for half-time.';
export const FULLTIME = "That's full-time!";

// A sending-off / injury reshapes the rest of the match: the offending side
// creates less and concedes more for the remaining minutes. Reds bite harder
// than injuries. (Determinism is unaffected — these only scale seeded chances.)
const RED_SELF = 0.8; // your scoring rate after a red
const RED_OPP = 1.12; // the opponent's scoring rate after your red
const INJ_SELF = 0.95;
const INJ_OPP = 1.05;

/** Pull a stat-derived factor toward neutral (1) by the influence dial. */
function swayBy(inf: number): (m: number) => number {
  return (m) => 1 + (m - 1) * inf;
}

/**
 * Weight scorers toward the front of the pitch AND toward sharp shooters —
 * your 95-SHO striker leads the charts. Keepers never score. Consumes exactly
 * one rng value (same as a uniform pick), so match RNG structure is unchanged.
 * Returns the Player (so we can credit ids), or null for an empty squad.
 */
function pickScorerPlayer(rng: Rng, squad: Player[], inf: number): Player | null {
  if (squad.length === 0) return null;
  const sway = swayBy(inf);
  const weights: number[] = squad.map((p) => {
    const roleW = p.role === 'FWD' ? 4 : p.role === 'MID' ? 3 : p.role === 'DEF' ? 1 : 0;
    if (roleW === 0) return 0;
    return roleW * sway(0.45 + deriveStats(p).shooting / 90);
  });
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return squad[squad.length - 1]; // all-keeper edge case
  let r = rng.next() * total;
  for (let i = 0; i < squad.length; i++) {
    r -= weights[i];
    if (r <= 0) return squad[i];
  }
  return squad[squad.length - 1];
}

/**
 * Who teed up the goal. Picked from a SEPARATE seeded stream so the core match
 * RNG (and therefore every score) is byte-identical to before this feature —
 * assists are pure decoration on an already-decided goal. Weighted toward
 * creative midfielders; excludes the scorer and keepers; ~25% of goals are solo.
 */
function pickAssister(
  seed: number | string,
  minute: number,
  side: 'A' | 'B',
  squad: Player[],
  scorerId: string | undefined,
  inf: number
): Player | null {
  const candidates = squad.filter((p) => p.id !== scorerId && p.role !== 'GK');
  if (candidates.length === 0) return null;
  const ar = new Rng(`${seed}-assist-${minute}-${side}`);
  if (ar.next() < 0.25) return null; // solo goal
  const sway = swayBy(inf);
  return weightedPick(ar, candidates, (p) => {
    const roleW = p.role === 'MID' ? 1.6 : p.role === 'FWD' ? 1.1 : 0.6;
    return roleW * sway(0.5 + deriveStats(p).passing / 90);
  });
}

/** Weighted pick consuming exactly ONE rng value (like rng.pick). */
function weightedPick(rng: Rng, squad: readonly Player[], weight: (p: Player) => number): Player {
  let total = 0;
  const ws = squad.map((p) => {
    const w = Math.max(0.01, weight(p));
    total += w;
    return w;
  });
  let r = rng.next() * total;
  for (let i = 0; i < squad.length; i++) {
    r -= ws[i];
    if (r <= 0) return squad[i];
  }
  return squad[squad.length - 1];
}

/** Card-proneness: low discipline → up to ~1.3×; high → down to ~0.25×. */
function cardWeight(inf: number): (p: Player) => number {
  const sway = swayBy(inf);
  return (p) => sway((115 - deriveStats(p).discipline) / 65);
}

/** Injury-proneness: frail (low physical) players go down more often. */
function injuryWeight(inf: number): (p: Player) => number {
  const sway = swayBy(inf);
  return (p) => sway((115 - deriveStats(p).physical) / 65);
}

/**
 * Attack-vs-defense stat multiplier for one side's xG. Creation+finishing push
 * it up; the opponent's defending blunts creation and their keeper blunts
 * conversion. Bounded so stats stay a MODIFIER on the ATK/DEF core, never the
 * main event.
 */
function statXgMult(atk: TeamStatProfile, def: TeamStatProfile): number {
  const attackSide = 1 + (atk.creation - 50) * 0.0009 + (atk.finishing - 50) * 0.0013;
  const defenseSide = 1 - (def.defending - 50) * 0.0007 - (def.goalkeeping - 50) * 0.0009;
  return clamp(attackSide * defenseSide, 0.86, 1.14);
}

// ── Segmented simulation ─────────────────────────────────────────────────────
// A match is simulated in SEGMENTS of minutes so play can pause for decisions
// (half-time team talk, substitution after an injury) and resume with changed
// team values. Each segment gets its own seeded RNG stream (`{seed}-seg{from}`),
// so determinism never depends on WHERE the pauses fall — only the choices and
// team values change outcomes. simulateMatch() composes segments and behaves
// like the classic one-shot API.

/** Mutable between-segment state (score, discipline, live strength swing). */
export interface MatchCarry {
  goalsA: number;
  goalsB: number;
  /** Side-A player ids on a yellow. */
  yellowedA: string[];
  redPlayerId: string | null;
  injuredId: string | null;
  injuryRounds: number;
  /** Live strength swing from cards/injuries (1 = full strength). */
  aMult: number;
  bMult: number;
  oppRed: boolean;
  oppInjured: boolean;
}

export function freshCarry(): MatchCarry {
  return {
    goalsA: 0,
    goalsB: 0,
    yellowedA: [],
    redPlayerId: null,
    injuredId: null,
    injuryRounds: 0,
    aMult: 1,
    bMult: 1,
    oppRed: false,
    oppInjured: false,
  };
}

/** Apply the strength penalty of an UNTREATED side-A injury (no substitute). */
export function applyInjuryPenalty(carry: MatchCarry): MatchCarry {
  return { ...carry, aMult: carry.aMult * INJ_SELF, bMult: carry.bMult * INJ_OPP };
}

export function kickoffEvent(): MatchEvent {
  return { minute: 0, side: 'A', kind: 'flavour', text: KICKOFF };
}
export function halfTimeEvent(): MatchEvent {
  return { minute: 45, side: 'A', kind: 'flavour', text: HALFTIME };
}
export function fullTimeEvent(): MatchEvent {
  return { minute: 90, side: 'A', kind: 'flavour', text: FULLTIME };
}

export interface SegmentResult {
  events: MatchEvent[];
  carry: MatchCarry;
  /** First minute NOT yet simulated (resume point; 91 = match done). */
  nextMinute: number;
  /** 'injury' = paused mid-segment for a possible substitution. */
  stop: 'end' | 'injury';
  /** xG accrued over the simulated minutes (for reporting). */
  xg: { a: number; b: number };
}

/**
 * Simulate minutes [fromMinute, toMinute] with the CURRENT team values.
 * When `pauseOnInjury` is set, a side-A injury ends the segment immediately
 * with stop:'injury' and NO strength penalty applied — the caller decides
 * (substitute, or applyInjuryPenalty and play on).
 */
export function simulateSegment(
  a: MatchTeam,
  b: MatchTeam,
  seed: number | string,
  tuning: EngineTuning,
  fromMinute: number,
  toMinute: number,
  carryIn: MatchCarry,
  pauseOnInjury = false
): SegmentResult {
  const rng = new Rng(`${seed}-seg${fromMinute}`);
  const inf = tuning.statInfluence ?? 1;
  const sway = swayBy(inf);

  // Extended-stat layer: team profiles modulate the ATK/DEF xG core (bounded).
  const profA = teamStatProfile(a.squad);
  const profB = teamStatProfile(b.squad);
  const xgA = clamp(
    expectedGoals(a.attack, b.defense, tuning) * sway(statXgMult(profA, profB)),
    tuning.minXg,
    tuning.maxXg
  );
  const xgB = clamp(
    expectedGoals(b.attack, a.defense, tuning) * sway(statXgMult(profB, profA)),
    tuning.minXg,
    tuning.maxXg
  );
  const perMinuteA = xgA / 90;
  const perMinuteB = xgB / 90;

  // Composure: from the 76th minute the clutch side creates a little more,
  // the bottlers a little less. Zero-sum-ish and bounded.
  const lateMultA = sway(clamp(1 + (profA.composure - profB.composure) * 0.0014, 0.93, 1.07));
  const lateMultB = sway(clamp(1 + (profB.composure - profA.composure) * 0.0014, 0.93, 1.07));

  const carry: MatchCarry = { ...carryIn, yellowedA: [...carryIn.yellowedA] };
  const yellowed = new Set(carry.yellowedA);
  const events: MatchEvent[] = [];
  let stop: SegmentResult['stop'] = 'end';
  let minute = fromMinute;
  let simulated = 0;

  const sides: ('A' | 'B')[] = ['A', 'B'];
  outer: for (; minute <= toMinute; minute++) {
    simulated++;
    for (const side of sides) {
      const team = side === 'A' ? a : b;
      const late = minute > 75 ? (side === 'A' ? lateMultA : lateMultB) : 1;
      const perMinute =
        (side === 'A' ? perMinuteA * carry.aMult : perMinuteB * carry.bMult) * late;
      if (rng.chance(perMinute)) {
        const scorer = pickScorerPlayer(rng, team.squad, inf);
        const scorerName = scorer?.name ?? 'a trialist';
        const assister = pickAssister(seed, minute, side, team.squad, scorer?.id, inf);
        if (side === 'A') carry.goalsA++;
        else carry.goalsB++;
        const sFor = side === 'A' ? carry.goalsA : carry.goalsB;
        const sAgainst = side === 'A' ? carry.goalsB : carry.goalsA;
        const pool = goalPool(minute, sFor, sAgainst);
        events.push({
          minute,
          side,
          kind: 'goal',
          text:
            `${team.name}: ${pool[rng.int(0, pool.length - 1)].replace('{p}', scorerName)}` +
            (assister ? ` Teed up by ${assister.name}.` : ''),
          playerName: scorerName,
          playerId: scorer?.id,
          assist: assister?.name,
          assistId: assister?.id,
        });
      } else if (rng.chance(perMinute * tuning.chanceFactor)) {
        const p = pickScorerPlayer(rng, team.squad, inf);
        const pName = p?.name ?? 'a trialist';
        events.push({
          minute,
          side,
          kind: 'chance',
          text: `${team.name}: ${CHANCE_LINES[rng.int(0, CHANCE_LINES.length - 1)].replace('{p}', pName)}`,
          playerName: pName,
          playerId: p?.id,
        });
      }
    }

    // Discipline and injury rolls — always consume the same RNG values per minute
    // for determinism, then conditional player-pick calls only when a roll fires.
    const yellowRoll = rng.next();
    const redRoll = rng.next();
    const injuryRoll = rng.next();

    if (yellowRoll < tuning.pYellow && a.squad.length > 0) {
      const player = weightedPick(rng, a.squad, cardWeight(inf));
      if (yellowed.has(player.id) && !carry.redPlayerId) {
        // Second yellow → red
        carry.redPlayerId = player.id;
        carry.aMult *= RED_SELF;
        carry.bMult *= RED_OPP;
        const line = SECOND_YELLOW_LINES[rng.int(0, SECOND_YELLOW_LINES.length - 1)];
        events.push({ minute, side: 'A', kind: 'red', text: line.replace('{p}', player.name), playerName: player.name, playerId: player.id });
      } else if (!yellowed.has(player.id)) {
        yellowed.add(player.id);
        const line = YELLOW_LINES[rng.int(0, YELLOW_LINES.length - 1)];
        events.push({ minute, side: 'A', kind: 'yellow', text: line.replace('{p}', player.name), playerName: player.name, playerId: player.id });
      }
    }

    if (redRoll < tuning.pStraightRed && !carry.redPlayerId && a.squad.length > 0) {
      const player = weightedPick(rng, a.squad, cardWeight(inf));
      if (!yellowed.has(player.id)) {
        carry.redPlayerId = player.id;
        carry.aMult *= RED_SELF;
        carry.bMult *= RED_OPP;
        const line = RED_LINES[rng.int(0, RED_LINES.length - 1)];
        events.push({ minute, side: 'A', kind: 'red', text: line.replace('{p}', player.name), playerName: player.name, playerId: player.id });
      }
    }

    if (injuryRoll < tuning.pInjury && !carry.injuredId && a.squad.length > 0) {
      const player = weightedPick(rng, a.squad, injuryWeight(inf));
      const r = rng.next();
      carry.injuryRounds = r < 0.6 ? 1 : r < 0.9 ? 2 : 3;
      carry.injuredId = player.id;
      const line = INJURY_LINES[rng.int(0, INJURY_LINES.length - 1)];
      events.push({ minute, side: 'A', kind: 'injury', text: line.replace('{p}', player.name), playerName: player.name, playerId: player.id });
      if (pauseOnInjury) {
        // The caller decides: substitute (no penalty) or play on (penalty).
        minute++;
        stop = 'injury';
        break outer;
      }
      carry.aMult *= INJ_SELF;
      carry.bMult *= INJ_OPP;
    }

    // Opponent (side B) discipline — they can go down to ten men too. These
    // never persist (the player only manages their own squad), but they swing
    // the live match and give the world some reciprocity.
    const oppRedRoll = rng.next();
    const oppInjuryRoll = rng.next();

    if (oppRedRoll < tuning.pStraightRed && !carry.oppRed && b.squad.length > 0) {
      carry.oppRed = true;
      carry.bMult *= RED_SELF;
      carry.aMult *= RED_OPP;
      const player = weightedPick(rng, b.squad, cardWeight(inf));
      const line = RED_LINES[rng.int(0, RED_LINES.length - 1)];
      events.push({ minute, side: 'B', kind: 'red', text: `${b.name}: ${line.replace('{p}', player.name)}`, playerName: player.name, playerId: player.id });
    }

    if (oppInjuryRoll < tuning.pInjury && !carry.oppInjured && b.squad.length > 0) {
      carry.oppInjured = true;
      carry.bMult *= INJ_SELF;
      carry.aMult *= INJ_OPP;
      const player = weightedPick(rng, b.squad, injuryWeight(inf));
      const line = INJURY_LINES[rng.int(0, INJURY_LINES.length - 1)];
      events.push({ minute, side: 'B', kind: 'injury', text: `${b.name}: ${line.replace('{p}', player.name)}`, playerName: player.name, playerId: player.id });
    }
  }

  carry.yellowedA = [...yellowed];
  return {
    events,
    carry,
    nextMinute: stop === 'injury' ? minute : toMinute + 1,
    stop,
    xg: { a: (xgA * simulated) / 90, b: (xgB * simulated) / 90 },
  };
}

/** Assemble the final MatchResult from accumulated events/carry/xG. */
export function finalizeResult(
  events: MatchEvent[],
  carry: MatchCarry,
  xg: { a: number; b: number }
): MatchResult {
  const outcome =
    carry.goalsA > carry.goalsB ? 'win' : carry.goalsA < carry.goalsB ? 'loss' : 'draw';
  return {
    events,
    score: { a: carry.goalsA, b: carry.goalsB },
    xg: { a: Math.round(xg.a * 100) / 100, b: Math.round(xg.b * 100) / 100 },
    outcome,
    suspensions: carry.redPlayerId ? [carry.redPlayerId] : [],
    injuries: carry.injuredId
      ? [{ playerId: carry.injuredId, rounds: carry.injuryRounds }]
      : [],
  };
}

/**
 * Simulate a full 90-minute match in one call (no pauses). Deterministic for a
 * given seed. Composes two half segments — the interactive flow uses the same
 * machinery with decision points in between.
 */
export function simulateMatch(
  a: MatchTeam,
  b: MatchTeam,
  seed: number | string,
  tuning: EngineTuning = DEFAULT_TUNING
): MatchResult {
  const first = simulateSegment(a, b, seed, tuning, 1, 45, freshCarry());
  const second = simulateSegment(a, b, seed, tuning, 46, 90, first.carry);
  const events = [
    kickoffEvent(),
    ...first.events,
    halfTimeEvent(),
    ...second.events,
    fullTimeEvent(),
  ];
  return finalizeResult(events, second.carry, {
    a: first.xg.a + second.xg.a,
    b: first.xg.b + second.xg.b,
  });
}
