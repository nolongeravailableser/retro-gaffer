/**
 * Club finances — wages & league-scaled rewards (FM-flavoured). Pure and
 * deterministic; all amounts are £millions.
 *
 * - Every owned player draws a per-round wage scaled by his rating (convex, so
 *   stars cost disproportionately more). The squad wage bill is a real recurring
 *   expense that counteracts prize money.
 * - Prize money + round income scale with the DIVISION (the round you're on),
 *   so lower leagues pay less — you can't sustain a galaxy of stars in League
 *   Two. A soft wage budget (from bankroll + division) tells you what's
 *   affordable.
 *
 * Constants are tuned against the balance sim (`npm run sim`).
 */

import { TOP_TIER, BOTTOM_TIER } from './league';
import type { Player, Role } from './types';

/** Role weighting for a single 0–99 "overall" rating. */
const OVR_W: Record<Role, { atk: number; def: number }> = {
  GK: { atk: 0.15, def: 0.85 },
  DEF: { atk: 0.3, def: 0.7 },
  MID: { atk: 0.5, def: 0.5 },
  FWD: { atk: 0.75, def: 0.25 },
};

/** Role-weighted overall rating (0–99-ish). */
export function overall(p: Player): number {
  const w = OVR_W[p.role];
  return Math.round(p.stats.attack * w.atk + p.stats.defense * w.def);
}

/** A ~99-overall player's per-round wage (£M); the curve's ceiling. */
export const WAGE_TOP = 0.8;
/** Convexity — higher = stars cost relatively more than journeymen. */
export const WAGE_EXP = 3;

/** Per-round wage (£M, 1 dp) for one player. */
export function wage(p: Player): number {
  const r = Math.max(0, Math.min(1, overall(p) / 99));
  return Math.round(Math.pow(r, WAGE_EXP) * WAGE_TOP * 10) / 10;
}

/** Total per-round wage bill (£M, 1 dp) for a squad. */
export function wageBill(players: Iterable<Player>): number {
  let sum = 0;
  for (const p of players) sum += wage(p);
  return Math.round(sum * 10) / 10;
}

/**
 * Division multiplier for prize money / income by round (1 → maxRounds).
 * Lower leagues pay less; the top division pays most. Clamped so Endless
 * (round → ∞) and one-off scenarios stay sane.
 */
export const DIV_MULT_FLOOR = 0.6;
export const DIV_MULT_CEIL = 1.7;
export function divisionMult(round: number, maxRounds = 12): number {
  const span = Math.max(1, (Number.isFinite(maxRounds) ? maxRounds : 12) - 1);
  const t = Math.max(0, Math.min(1, (round - 1) / span));
  return Math.round((DIV_MULT_FLOOR + (DIV_MULT_CEIL - DIV_MULT_FLOOR) * t) * 100) / 100;
}

/**
 * Division multiplier by pyramid TIER (Career/League). Unlike `divisionMult`,
 * which scales by the round within a finite climb, a league season is played
 * entirely in one division — so prize money/income are flat across its
 * matchweeks and scaled only by how high up the pyramid you are. Bottom tier →
 * floor, top tier → ceil. Standalone League (no tier) passes the mid tier.
 */
export function tierMult(tier: number): number {
  const span = Math.max(1, BOTTOM_TIER - TOP_TIER);
  const t = Math.max(0, Math.min(1, (BOTTOM_TIER - tier) / span));
  return Math.round((DIV_MULT_FLOOR + (DIV_MULT_CEIL - DIV_MULT_FLOOR) * t) * 100) / 100;
}

/** The tier a tier-less standalone League season is paid at (mid pyramid). */
export const LEAGUE_NEUTRAL_TIER = Math.round((TOP_TIER + BOTTOM_TIER) / 2);

/** How steeply the wage bill rises per division climbed in a Career. */
export const WAGE_TIER_K = 1.8;

/**
 * Career wage multiplier by pyramid tier — the Premier League demands Premier
 * League wages. Bottom tier ×1; each rung up multiplies the bill by
 * `WAGE_TIER_K`. Without this, tier-scaled income in an open-ended career just
 * piles up unspent (a complete squad has nothing left to buy); scaling wages
 * keeps the FM wage-budget tension alive and bounds the economy to a plateau.
 * Tuned against the career balance sim (`npm run sim`). Classic and standalone
 * League are unscaled (×1).
 */
export function wageTierMult(tier: number): number {
  return WAGE_TIER_K ** (BOTTOM_TIER - tier);
}

/**
 * Soft wage budget (£M/round): what the club can comfortably sustain given its
 * bankroll and division. Going over isn't blocked — you just bleed cash — but
 * the UI flags it.
 */
export function wageBudget(bankroll: number, divMult: number): number {
  return Math.round((5 * divMult + Math.max(0, bankroll) * 0.06) * 10) / 10;
}
