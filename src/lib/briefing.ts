/**
 * Pre-match scouting briefing — a plain-English read of the opponent's threat
 * and the approach that counters it, derived from their strength balance and
 * stat profile. Pure & deterministic; informational only (no match-strength
 * effect — you act on it via your squad, formation and the in-match talks).
 * Companion to the post-match verdict (matchAnalysis): scout before, explain after.
 */

import { teamStatProfile } from './stats';
import type { Player } from './types';

export type Lean = 'attack' | 'defence' | 'balanced';

export interface Briefing {
  lean: Lean;
  /** Their main danger, one short phrase. */
  threat: string;
  /** The recommended approach against it. */
  plan: string;
}

/** How lopsided their attack/defence must be to read as a clear lean. */
const LEAN_RATIO = 1.08;

export function opponentBriefing(opp: {
  attack: number;
  defense: number;
  squad: readonly Player[];
}): Briefing {
  const { attack, defense, squad } = opp;
  const prof = teamStatProfile(squad);

  let lean: Lean = 'balanced';
  if (attack > defense * LEAN_RATIO) lean = 'attack';
  else if (defense > attack * LEAN_RATIO) lean = 'defence';

  if (lean === 'attack') {
    const danger =
      prof.finishing >= prof.creation
        ? 'clinical in front of goal'
        : 'quick and creative going forward';
    return {
      lean,
      threat: `Dangerous in attack — ${danger}.`,
      plan: 'Stay compact and hit them on the break.',
    };
  }
  if (lean === 'defence') {
    return {
      lean,
      threat: 'Hard to break down — well organised at the back.',
      plan: 'Be patient, work the ball wide, and pick your moment.',
    };
  }
  return {
    lean,
    threat: 'Well balanced — no obvious weakness.',
    plan: 'Match them up and take your chances.',
  };
}
