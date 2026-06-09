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

const XG_SCALE = 5;
const MIN_XG = 0.25;
const MAX_XG = 4.5;
/** A near-miss is a bit more likely than a goal, for ticker texture. */
const CHANCE_FACTOR = 1.4;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Expected Goals from a side's attack vs the opponent's defense.
 * Evenly matched (attack == oppDefense) → half of XG_SCALE. Monotonic:
 * more attack raises xG, more opposing defense lowers it.
 */
export function expectedGoals(attack: number, oppDefense: number): number {
  if (attack <= 0) return MIN_XG;
  const ratio = attack / (attack + Math.max(0, oppDefense));
  return clamp(ratio * XG_SCALE, MIN_XG, MAX_XG);
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

const KICKOFF = 'And we are underway at the Theatre of Nostalgia!';
const HALFTIME = 'The referee blows for half-time.';
const FULLTIME = "That's full-time!";

/** Weight scorers toward the front of the pitch. */
function pickScorer(rng: Rng, squad: Player[]): string {
  if (squad.length === 0) return 'a trialist';
  const weights = squad.map((p) =>
    p.role === 'FWD' ? 4 : p.role === 'MID' ? 3 : p.role === 'DEF' ? 1 : 0.2
  );
  const total = weights.reduce((s, w) => s + w, 0);
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
  seed: number | string
): MatchResult {
  const rng = new Rng(seed);
  const xgA = expectedGoals(a.attack, b.defense);
  const xgB = expectedGoals(b.attack, a.defense);
  const perMinuteA = xgA / 90;
  const perMinuteB = xgB / 90;

  const events: MatchEvent[] = [
    { minute: 0, side: 'A', kind: 'flavour', text: KICKOFF },
  ];
  let goalsA = 0;
  let goalsB = 0;

  const sides: ('A' | 'B')[] = ['A', 'B'];
  for (let minute = 1; minute <= 90; minute++) {
    for (const side of sides) {
      const team = side === 'A' ? a : b;
      const perMinute = side === 'A' ? perMinuteA : perMinuteB;
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
      } else if (rng.chance(perMinute * CHANCE_FACTOR)) {
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
  }

  events.push({ minute: 90, side: 'A', kind: 'flavour', text: FULLTIME });

  const outcome =
    goalsA > goalsB ? 'win' : goalsA < goalsB ? 'loss' : 'draw';

  return {
    events,
    score: { a: goalsA, b: goalsB },
    xg: { a: Math.round(xgA * 100) / 100, b: Math.round(xgB * 100) / 100 },
    outcome,
  };
}
