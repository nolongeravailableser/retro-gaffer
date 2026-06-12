/**
 * Player morale (Career & League) — the man-management beat.
 *
 * DERIVED, not stored: morale is a pure function of recent form (average match
 * rating) and involvement (match sharpness as a minutes proxy — a regular starter
 * is sharp and happy; a frozen-out player goes rusty and unsettled). So there's
 * no new persisted state and nothing to migrate; it updates for free as form and
 * playing time move.
 *
 * Effect is bounded and gentle (±3%), folded into the existing match-modifier
 * pipeline — happy players overperform a touch, unhappy ones dip. Surfaced in the
 * Inbox ("X has grown unhappy at his lack of football").
 */

import { NO_MODIFIERS, type MatchModifiers } from './effects';
import { SHARP_START } from './training';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export type MoraleBand = 'buzzing' | 'good' | 'content' | 'unsettled' | 'unhappy';

/** Weight of form vs involvement in the morale blend. */
export const FORM_WEIGHT = 0.6;
export const INVOLVEMENT_WEIGHT = 0.4;
export const MORALE_NEUTRAL = 55; // ~"content" — the no-effect point
export const MORALE_MAX_SWING = 0.03; // ±3% match nudge at the extremes

/**
 * Player morale 0–100. `avgRating` is the recent form (3.0–10.0, or null for a
 * player yet to feature); `sharpness` (0–100) stands in for how involved he's
 * been. A new signing (no apps, default sharpness) lands around "content".
 */
export function morale(avgRating: number | null, sharpness: number = SHARP_START): number {
  // Form: a 5.0 average reads as miserable, 8.0 as flying (6.3-ish base ≈ middling).
  const form = avgRating == null ? MORALE_NEUTRAL : clamp01((avgRating - 5) / 3) * 100;
  const involvement = clamp01(sharpness / 100) * 100;
  return Math.round(FORM_WEIGHT * form + INVOLVEMENT_WEIGHT * involvement);
}

export function moraleBand(m: number): MoraleBand {
  if (m >= 75) return 'buzzing';
  if (m >= 60) return 'good';
  if (m >= 45) return 'content';
  if (m >= 30) return 'unsettled';
  return 'unhappy';
}

/** Bounded match multiplier (0.97–1.03), centred on the neutral point. */
export function moraleMult(m: number): number {
  const t = Math.max(-1, Math.min(1, (m - MORALE_NEUTRAL) / (100 - MORALE_NEUTRAL)));
  return 1 + t * MORALE_MAX_SWING;
}

/**
 * Per-starter morale modifiers, folded into MatchModifiers.player. `ratingOf`
 * resolves a player's average rating (null if none), `sharpnessOf` his sharpness.
 */
export function moraleModifiers(
  starterIds: readonly string[],
  ratingOf: (id: string) => number | null,
  sharpnessOf: (id: string) => number | undefined
): MatchModifiers {
  const player: Record<string, number> = {};
  for (const id of starterIds) {
    player[id] = moraleMult(morale(ratingOf(id), sharpnessOf(id) ?? SHARP_START));
  }
  return { ...NO_MODIFIERS, player };
}

/** A short, human label for the morale band (UI + inbox copy). */
export function moraleLabel(band: MoraleBand): string {
  switch (band) {
    case 'buzzing': return 'buzzing';
    case 'good': return 'happy';
    case 'content': return 'content';
    case 'unsettled': return 'unsettled';
    case 'unhappy': return 'unhappy';
  }
}
