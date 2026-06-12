/**
 * Squad dynamics (Career & League) — FM dressing-room depth at a fraction of the
 * complexity. DERIVED, not stored: a captain (your most influential starter) and
 * a dressing-room mood (the squad's aggregate morale), both computed on the fly.
 *
 * - The **captain** is a leader: when he's happy he lifts the whole side a touch;
 *   when he's unsettled it drags on everyone (a small, bounded team multiplier,
 *   distinct from each player's own morale).
 * - The **dressing-room mood** is the squad's collective morale, surfaced in the
 *   Inbox and the Training panel.
 *
 * Effect is gentle (±~2.5%) and folds into the existing match-modifier pipeline,
 * so it never touches the engine; and since the balance sim has no morale, it's a
 * skill layer the sim doesn't model (Classic/career economy untouched).
 */

import { NO_MODIFIERS, type MatchModifiers } from './effects';
import { MORALE_NEUTRAL } from './morale';
import type { Player } from './types';

export type DressingRoom = 'buzzing' | 'settled' | 'tense' | 'fractured';

/** The squad's leader — the highest-rated fit starter (ties break on id). */
export function captainOf(
  starters: readonly Player[],
  overallOf: (p: Player) => number
): Player | null {
  let best: Player | null = null;
  let bestO = -Infinity;
  for (const p of starters) {
    const o = overallOf(p);
    if (o > bestO || (o === bestO && best && p.id < best.id)) {
      best = p;
      bestO = o;
    }
  }
  return best;
}

/** Collective mood from the squad's individual morale values. */
export function dressingRoomMood(moraleValues: readonly number[]): DressingRoom {
  if (moraleValues.length === 0) return 'settled';
  const avg = moraleValues.reduce((a, b) => a + b, 0) / moraleValues.length;
  if (avg >= 70) return 'buzzing';
  if (avg >= 52) return 'settled';
  if (avg >= 38) return 'tense';
  return 'fractured';
}

export function moodLabel(mood: DressingRoom): string {
  switch (mood) {
    case 'buzzing': return 'buzzing';
    case 'settled': return 'settled';
    case 'tense': return 'tense';
    case 'fractured': return 'fractured';
  }
}

/** How much the captain's mood swings the whole team (±~2.5%). */
export const LEADERSHIP_SWING = 0.025;

/** Team multiplier from the captain's morale — a happy leader lifts everyone. */
export function leadershipMult(captainMorale: number): number {
  const t = Math.max(-1, Math.min(1, (captainMorale - MORALE_NEUTRAL) / (100 - MORALE_NEUTRAL)));
  return 1 + t * LEADERSHIP_SWING;
}

/** Folds the captain's leadership into MatchModifiers.teamMult (whole-XI). */
export function leadershipModifiers(captainMorale: number | null): MatchModifiers {
  if (captainMorale == null) return NO_MODIFIERS;
  return { ...NO_MODIFIERS, teamMult: leadershipMult(captainMorale) };
}
