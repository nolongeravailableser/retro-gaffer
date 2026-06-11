/**
 * Transfer market valuations (Career & League). Pure & deterministic.
 *
 * Unlike Classic's fixed authored `cost` (a roguelike draft price), a career/
 * league transfer has a **market value** derived from the player's rating and
 * inflated by the division — a 90-rated star is journeyman-priced in the
 * National League but costs Premier League money in the Premier League. This
 * makes transfers a real, scaling decision (and the main money sink) instead of
 * trivially cheap once you're established. Classic does NOT use this.
 *
 * Tuned against the career balance sim (`npm run sim`).
 */

import { overall } from './wages';
import { BOTTOM_TIER } from './league';
import type { Player } from './types';

/** Convexity of the value curve — stars cost disproportionately more.
 *  Tuned so a starting £50M comfortably fields a lower-league XI (overall ~62 ≈
 *  £2M) while stars run into the tens of millions (×division inflation on top). */
const VALUE_DIV = 45;
const VALUE_EXP = 5;

/** How much each division up multiplies a player's value (richer leagues pay more). */
export const MARKET_TIER_K = 1.2;

/**
 * Career/League opening transfer kitty (£m). Higher than Classic's £50M because
 * you build an XI from scratch at MARKET value — you need enough to field a side
 * AND have the value curve stay steep enough to gate squad quality as you climb.
 * Classic keeps STARTING_BANKROLL (its roguelike draft uses cheap fixed costs).
 */
export const CAREER_STARTING_BANKROLL = 35;

/** Resale haircut: you recoup this fraction of market value when selling. */
export const MARKET_SELL_RATE = 0.85;

/**
 * Base market value (£m) from a player's overall rating — convex, so a galaxy
 * star costs many multiples of a journeyman. Division-agnostic.
 */
export function baseValue(p: Player): number {
  const o = overall(p);
  return Math.max(1, Math.round((o / VALUE_DIV) ** VALUE_EXP));
}

/** Division inflation multiplier: ×1 at the bottom tier, ×K per rung up. */
export function marketTierMult(tier: number): number {
  return MARKET_TIER_K ** (BOTTOM_TIER - tier);
}

/** A player's headline market value (£m) in a given division — what a quality
 *  player is worth, before the free-agent floor below. */
export function marketValue(p: Player, tier: number): number {
  return Math.max(1, Math.round(baseValue(p) * marketTierMult(tier)));
}

/**
 * Free-agent floor: journeyman-quality players (overall below this) are FREE
 * transfers — no fee, just a place in your squad. This guarantees you can always
 * field an XI on any budget (so a career is never bankrupt-locked), while real
 * quality still costs market value. The challenge becomes sporting, not "can I
 * afford eleven bodies." Every pitch role has free options at this threshold.
 */
export const FREE_AGENT_MAX_OVERALL = 64;

export function isFreeAgent(p: Player): boolean {
  return overall(p) < FREE_AGENT_MAX_OVERALL;
}

/** The fee to sign a player (£m): free agents cost nothing; quality costs value. */
export function transferFee(p: Player, tier: number): number {
  return isFreeAgent(p) ? 0 : marketValue(p, tier);
}

/** What selling a player nets you (£m) — free agents have no resale value. */
export function marketSellValue(p: Player, tier: number): number {
  if (isFreeAgent(p)) return 0;
  return Math.max(1, Math.round(marketValue(p, tier) * MARKET_SELL_RATE));
}
