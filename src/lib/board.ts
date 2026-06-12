/**
 * Board confidence (Career) — the owner relationship FM does shallowly.
 *
 * DERIVED, not stored: confidence is a pure function of where you sit in the
 * table vs the field and your recent form, so there's no new persisted state.
 * It's surfaced in the Inbox (a pre-season expectation, a mid-season warning if
 * the mood sours) and shown as a meter in the Career Hub.
 *
 * v1 has no teeth beyond flavour — relegation from the bottom tier stays the only
 * hard sacking, so the balance sim is untouched. Confidence can grow consequences
 * later (a "final warning" gate) without re-architecting.
 */

import { TOP_TIER, BOTTOM_TIER } from './league';

export type ConfidenceBand = 'secure' | 'stable' | 'shaky' | 'under-pressure';

/**
 * Board confidence 0–100, from league position (vs the field) + recent form.
 * Top of the table & winning → secure; bottom & losing → under pressure.
 */
export const CONFIDENCE_NEUTRAL = 60; // pre-season baseline (board hasn't judged yet)

export function boardConfidence(
  position: number,
  clubs: number,
  record: { w: number; d: number; l: number }
): number {
  const games = record.w + record.d + record.l;
  // Before a ball is kicked the table is just an alphabetical tiebreak, so the
  // board sits at a neutral baseline rather than reading a meaningless position.
  if (games === 0) return CONFIDENCE_NEUTRAL;
  const posScore = clubs > 1 ? 1 - (position - 1) / (clubs - 1) : 1; // 1st → 1, last → 0
  const formScore = (record.w + record.d * 0.5) / games;
  return Math.round(100 * (0.65 * posScore + 0.35 * formScore));
}

export function confidenceBand(c: number): ConfidenceBand {
  if (c >= 70) return 'secure';
  if (c >= 50) return 'stable';
  if (c >= 32) return 'shaky';
  return 'under-pressure';
}

/** A short, human label for the confidence band (UI + inbox copy). */
export function confidenceLabel(band: ConfidenceBand): string {
  switch (band) {
    case 'secure': return 'rock solid';
    case 'stable': return 'stable';
    case 'shaky': return 'wavering';
    case 'under-pressure': return 'under pressure';
  }
}

/** The board's pre-season ask, scaled by where you are in the pyramid. */
export function boardExpectation(tier: number): string {
  if (tier === TOP_TIER) return 'compete near the top and chase the title';
  if (tier === BOTTOM_TIER) return 'mount a promotion challenge';
  return 'finish in the top half and push for promotion';
}
