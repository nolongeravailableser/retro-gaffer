/**
 * Match engine. Pure and fully seeded — given the same teams and seed it
 * ALWAYS produces the identical events and score. No Math.random, no timers.
 * The UI consumes the returned data and animates it; the engine never renders.
 */

import type { Player, MatchEvent, MatchResult } from './types';
import { Rng } from './rng';

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
];

const CHANCE_LINES = [
  '{p} bursts through the midfield… but drags it just wide!',
  '{p} tries his luck from range — inches over the bar!',
  'Wonderful save! {p} is denied at the near post.',
  '{p} skies it over from six yards — he should score!',
  '{p} rattles the crossbar! So close.',
  '{p} wriggles into the box but the last-ditch tackle is in.',
];

const YELLOW_LINES = [
  '{p} catches one late — the referee has no hesitation. Yellow card.',
  'Reckless challenge from {p}. The book comes out.',
  '{p} argues the toss and picks up a booking.',
  'Cynical foul from {p} — straight into the referee\'s notebook.',
];

const SECOND_YELLOW_LINES = [
  '{p} goes in again — second yellow, and he\'s off! Ten men!',
  'Stupid tackle from {p}. Already on a yellow. He\'s off! Ten men.',
];

const RED_LINES = [
  'STRAIGHT RED for {p}! Horrific challenge — off he goes!',
  '{p} sees red for a last-man foul. Ten men.',
  'The referee shows {p} the red card — dangerous play, no arguments.',
];

const INJURY_LINES = [
  '{p} is down and it looks serious. He\'s helped off the pitch.',
  'Worrying scenes as {p} can\'t continue — a stretcher is called.',
  '{p} pulls up clutching his hamstring. He\'s done for the day.',
  '{p} limps off after a heavy challenge. Fingers crossed it\'s nothing serious.',
];

const KICKOFF = 'And we are underway at the Theatre of Nostalgia!';
const HALFTIME = 'The referee blows for half-time.';
const FULLTIME = "That's full-time!";

// A sending-off / injury reshapes the rest of the match: the offending side
// creates less and concedes more for the remaining minutes. Reds bite harder
// than injuries. (Determinism is unaffected — these only scale seeded chances.)
const RED_SELF = 0.8; // your scoring rate after a red
const RED_OPP = 1.12; // the opponent's scoring rate after your red
const INJ_SELF = 0.95;
const INJ_OPP = 1.05;

/** Weight scorers toward the front of the pitch. Keepers never score. */
function pickScorer(rng: Rng, squad: Player[]): string {
  if (squad.length === 0) return 'a trialist';
  const weights: number[] = squad.map((p) =>
    p.role === 'FWD' ? 4 : p.role === 'MID' ? 3 : p.role === 'DEF' ? 1 : 0
  );
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return squad[squad.length - 1].name; // all-keeper edge case
  let r = rng.next() * total;
  for (let i = 0; i < squad.length; i++) {
    r -= weights[i];
    if (r <= 0) return squad[i].name;
  }
  return squad[squad.length - 1].name;
}

/** Simulate a 90-minute match. Deterministic for a given seed. */
export function simulateMatch(
  a: MatchTeam,
  b: MatchTeam,
  seed: number | string,
  tuning: EngineTuning = DEFAULT_TUNING
): MatchResult {
  const rng = new Rng(seed);
  const xgA = expectedGoals(a.attack, b.defense, tuning);
  const xgB = expectedGoals(b.attack, a.defense, tuning);
  const perMinuteA = xgA / 90;
  const perMinuteB = xgB / 90;

  const events: MatchEvent[] = [
    { minute: 0, side: 'A', kind: 'flavour', text: KICKOFF },
  ];
  let goalsA = 0;
  let goalsB = 0;

  // Live strength swing from cards/injuries (1 = full strength). Updated as
  // events fire, so a red in the 5th minute actually matters for the result.
  let aMult = 1;
  let bMult = 1;

  // Side A discipline persists to the player's squad (suspensions / injuries).
  const yellowed = new Set<string>(); // player IDs with one yellow this game
  let redPlayer: Player | null = null;
  let injuredPlayer: Player | null = null;
  let injuryRounds = 0;
  // Side B discipline is in-match + commentary only (never returned).
  let oppRed = false;
  let oppInjured = false;

  const sides: ('A' | 'B')[] = ['A', 'B'];
  for (let minute = 1; minute <= 90; minute++) {
    for (const side of sides) {
      const team = side === 'A' ? a : b;
      const perMinute = (side === 'A' ? perMinuteA * aMult : perMinuteB * bMult);
      if (rng.chance(perMinute)) {
        const scorer = pickScorer(rng, team.squad);
        if (side === 'A') goalsA++;
        else goalsB++;
        events.push({
          minute,
          side,
          kind: 'goal',
          text: `${team.name}: ${GOAL_LINES[rng.int(0, GOAL_LINES.length - 1)].replace('{p}', scorer)}`,
        });
      } else if (rng.chance(perMinute * tuning.chanceFactor)) {
        const p = pickScorer(rng, team.squad);
        events.push({
          minute,
          side,
          kind: 'chance',
          text: `${team.name}: ${CHANCE_LINES[rng.int(0, CHANCE_LINES.length - 1)].replace('{p}', p)}`,
        });
      }
    }

    if (minute === 45) {
      events.push({ minute: 45, side: 'A', kind: 'flavour', text: HALFTIME });
    }

    // Discipline and injury rolls — always consume the same RNG values per minute
    // for determinism, then conditional player-pick calls only when a roll fires.
    const yellowRoll = rng.next();
    const redRoll = rng.next();
    const injuryRoll = rng.next();

    if (yellowRoll < tuning.pYellow && a.squad.length > 0) {
      const player = rng.pick(a.squad);
      if (yellowed.has(player.id) && !redPlayer) {
        // Second yellow → red
        redPlayer = player;
        aMult *= RED_SELF;
        bMult *= RED_OPP;
        const line = SECOND_YELLOW_LINES[rng.int(0, SECOND_YELLOW_LINES.length - 1)];
        events.push({ minute, side: 'A', kind: 'red', text: line.replace('{p}', player.name) });
      } else if (!yellowed.has(player.id)) {
        yellowed.add(player.id);
        const line = YELLOW_LINES[rng.int(0, YELLOW_LINES.length - 1)];
        events.push({ minute, side: 'A', kind: 'yellow', text: line.replace('{p}', player.name) });
      }
    }

    if (redRoll < tuning.pStraightRed && !redPlayer && a.squad.length > 0) {
      const player = rng.pick(a.squad);
      if (!yellowed.has(player.id)) {
        redPlayer = player;
        aMult *= RED_SELF;
        bMult *= RED_OPP;
        const line = RED_LINES[rng.int(0, RED_LINES.length - 1)];
        events.push({ minute, side: 'A', kind: 'red', text: line.replace('{p}', player.name) });
      }
    }

    if (injuryRoll < tuning.pInjury && !injuredPlayer && a.squad.length > 0) {
      const player = rng.pick(a.squad);
      const r = rng.next();
      injuryRounds = r < 0.6 ? 1 : r < 0.9 ? 2 : 3;
      injuredPlayer = player;
      aMult *= INJ_SELF;
      bMult *= INJ_OPP;
      const line = INJURY_LINES[rng.int(0, INJURY_LINES.length - 1)];
      events.push({ minute, side: 'A', kind: 'injury', text: line.replace('{p}', player.name) });
    }

    // Opponent (side B) discipline — they can go down to ten men too. These
    // never persist (the player only manages their own squad), but they swing
    // the live match and give the world some reciprocity.
    const oppRedRoll = rng.next();
    const oppInjuryRoll = rng.next();

    if (oppRedRoll < tuning.pStraightRed && !oppRed && b.squad.length > 0) {
      oppRed = true;
      bMult *= RED_SELF;
      aMult *= RED_OPP;
      const player = rng.pick(b.squad);
      const line = RED_LINES[rng.int(0, RED_LINES.length - 1)];
      events.push({ minute, side: 'B', kind: 'red', text: `${b.name}: ${line.replace('{p}', player.name)}` });
    }

    if (oppInjuryRoll < tuning.pInjury && !oppInjured && b.squad.length > 0) {
      oppInjured = true;
      bMult *= INJ_SELF;
      aMult *= INJ_OPP;
      const player = rng.pick(b.squad);
      const line = INJURY_LINES[rng.int(0, INJURY_LINES.length - 1)];
      events.push({ minute, side: 'B', kind: 'injury', text: `${b.name}: ${line.replace('{p}', player.name)}` });
    }
  }

  events.push({ minute: 90, side: 'A', kind: 'flavour', text: FULLTIME });

  const outcome =
    goalsA > goalsB ? 'win' : goalsA < goalsB ? 'loss' : 'draw';

  const suspensions = redPlayer ? [redPlayer.id] : [];
  const injuries = injuredPlayer
    ? [{ playerId: injuredPlayer.id, rounds: injuryRounds }]
    : [];

  return {
    events,
    score: { a: goalsA, b: goalsB },
    xg: { a: Math.round(xgA * 100) / 100, b: Math.round(xgB * 100) / 100 },
    outcome,
    suspensions,
    injuries,
  };
}
