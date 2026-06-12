/**
 * The Financial Balancing Array — ONE declarative source of truth for every
 * division's economy (Career & League). Pure & deterministic; all £millions.
 *
 * Football's finances span a vast range from the lower leagues to the top flight
 * — tiny local sponsors and modest gates at the bottom; huge global/TV money,
 * Premier League wages and Premier League transfer fees at the top. Rather than
 * scatter that scaling across wages/market/stadium, every per-division lever
 * lives here in `DIVISION_FINANCE`, indexed by pyramid tier:
 *
 *   - prizeMult   — prize money + base round income (and facility upkeep) scaler
 *   - wageMult    — wage-bill scaler (PL wages in the PL)
 *   - marketMult  — transfer-value inflation (a star costs PL money in the PL)
 *   - sponsorLocal / sponsorGlobal — season-level sponsorship (see below)
 *   - finePerCard — disciplinary overhead per booking
 *
 * DESIGN — PROPORTIONAL, not literal: the game runs on a compressed £ scale
 * (£35M opening kitty), so these mirror the *ratios* of real football, not its
 * absolute figures. The legacy multipliers are computed by the SAME formulas the
 * economy was tuned against, so consolidating here is behaviour-neutral (the
 * balance sim is unmoved); only sponsorship + fines are new dimensions, wired in
 * and re-gated separately.
 *
 * `wages.ts` and `market.ts` re-export thin aliases (`tierMult`, `wageTierMult`,
 * `marketTierMult`) so existing call sites are untouched.
 */

import { DIVISIONS, BOTTOM_TIER, TOP_TIER } from './league';

// --- Base scaling constants (formerly split across wages.ts / market.ts) -----

/** Prize/income multiplier endpoints: bottom tier → floor, top tier → ceil. */
export const DIV_MULT_FLOOR = 0.6;
export const DIV_MULT_CEIL = 1.7;

/** How steeply the wage bill rises per division climbed (PL wages in the PL).
 *  Tuned alongside facility upkeep AND the transfer market (the primary sink). */
export const WAGE_TIER_K = 1.3;

/** How much each division up multiplies a player's transfer value. */
export const MARKET_TIER_K = 1.2;

/** The tier a tier-less standalone League / Cup season is paid at (mid pyramid). */
export const LEAGUE_NEUTRAL_TIER = Math.round((TOP_TIER + BOTTOM_TIER) / 2);

// --- The per-tier multipliers (canonical; formula-identical to before) -------

/**
 * Prize money / income multiplier by pyramid TIER. A league season is played
 * entirely in one division, so prize money/income are flat across its matchweeks
 * and scaled only by how high you are. Bottom → floor, top → ceil.
 */
export function prizeTierMult(tier: number): number {
  const span = Math.max(1, BOTTOM_TIER - TOP_TIER);
  const t = Math.max(0, Math.min(1, (BOTTOM_TIER - tier) / span));
  return Math.round((DIV_MULT_FLOOR + (DIV_MULT_CEIL - DIV_MULT_FLOOR) * t) * 100) / 100;
}

/** Wage-bill multiplier by tier: bottom ×1, each rung up ×`WAGE_TIER_K`. */
export function wageTierMult(tier: number): number {
  return WAGE_TIER_K ** (BOTTOM_TIER - tier);
}

/** Transfer-value inflation by tier: ×1 at the bottom, ×`MARKET_TIER_K` per rung. */
export function marketTierMult(tier: number): number {
  return MARKET_TIER_K ** (BOTTOM_TIER - tier);
}

// --- The new declarative dimensions: sponsorship & fines ---------------------

/**
 * Per-tier sponsorship (£m/season) and disciplinary fine rate. Local sponsorship
 * every club has; GLOBAL (TV/commercial) money is the top-flight differentiator —
 * reputation-gated, so it's ~nothing below the Championship and jumps sharply at
 * the top. Fines scale with the division (a PL booking costs more than a
 * non-league one). Proportional placeholders — tuned against the sim when wired.
 */
// Calibrated against the career sim so each tier's season sponsorship and its
// average-discipline fines roughly cancel (texture without runaway): a season's
// fines ≈ (~2.85 bookings/match × 22 matches × 0.5 season-scale) × finePerCard
// ≈ 31 × finePerCard, so finePerCard ≈ sponsorship / 31 nets neutral. Tuned so
// the top tier runs a slight deficit (a brake on hoarding) and the bottom a
// slight surplus (a solvency cushion). A DISCIPLINED squad keeps the surplus.
const SPONSOR_FINE: Record<number, { sponsorLocal: number; sponsorGlobal: number; finePerCard: number }> = {
  5: { sponsorLocal: 3, sponsorGlobal: 0, finePerCard: 0.08 }, // National League
  4: { sponsorLocal: 5, sponsorGlobal: 0, finePerCard: 0.14 }, // League Two
  3: { sponsorLocal: 8, sponsorGlobal: 0, finePerCard: 0.25 }, // League One
  2: { sponsorLocal: 12, sponsorGlobal: 20, finePerCard: 1.1 }, // Championship
  1: { sponsorLocal: 18, sponsorGlobal: 60, finePerCard: 2.6 }, // Premier League
};

// --- The consolidated table --------------------------------------------------

export interface DivisionFinance {
  tier: number;
  name: string;
  /** Prize money + base income (and upkeep) scaler. */
  prizeMult: number;
  /** Wage-bill scaler. */
  wageMult: number;
  /** Transfer-value inflation. */
  marketMult: number;
  /** Local sponsorship, £m/season — every club has one. */
  sponsorLocal: number;
  /** Global/TV money, £m/season — reputation-gated to the top tiers. */
  sponsorGlobal: number;
  /** Disciplinary fine, £m per yellow-equivalent (a red counts double). */
  finePerCard: number;
}

function buildFinance(tier: number, name: string): DivisionFinance {
  const sf = SPONSOR_FINE[tier] ?? { sponsorLocal: 0, sponsorGlobal: 0, finePerCard: 0 };
  return {
    tier,
    name,
    prizeMult: prizeTierMult(tier),
    wageMult: wageTierMult(tier),
    marketMult: marketTierMult(tier),
    ...sf,
  };
}

/** The balancing array: every division's full economic profile, by tier. */
export const DIVISION_FINANCE: Record<number, DivisionFinance> = Object.fromEntries(
  DIVISIONS.map((d) => [d.tier, buildFinance(d.tier, d.name)])
);

/** A division's economic profile, falling back to the neutral mid tier. */
export function divisionFinance(tier: number): DivisionFinance {
  return DIVISION_FINANCE[tier] ?? DIVISION_FINANCE[LEAGUE_NEUTRAL_TIER];
}

/** Total sponsorship banked at the start of a season in a given division (£m). */
export function seasonSponsorship(tier: number): number {
  const f = divisionFinance(tier);
  return f.sponsorLocal + f.sponsorGlobal;
}

/**
 * Disciplinary fine (£m) for a match's bookings in a given division. A red
 * counts as two yellows. Tier-scaled — the bigger the stage, the bigger the fine.
 */
export function disciplinaryFine(yellows: number, reds: number, tier: number): number {
  const rate = divisionFinance(tier).finePerCard;
  return Math.round((Math.max(0, yellows) + Math.max(0, reds) * 2) * rate * 10) / 10;
}
