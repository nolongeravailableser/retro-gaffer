/**
 * Transfer negotiation (Career & League) — bidding and personal terms.
 *
 * Replaces the instant "pay the fee" buy with a two-step FM-style negotiation:
 *   1. Club step (skipped for free agents) — you bid for the player; the selling
 *      club ACCEPTS, REJECTS, or COUNTERS based on your bid vs the asking price.
 *   2. Personal terms — the player demands a wage scaled by rating and division;
 *      if it blows your wage budget he refuses to join.
 *
 * Pure & deterministic: the club's verdict uses a seeded RNG (no `Math.random`),
 * so it stays consistent with the project's determinism rule. The asking price
 * comes from `lib/market.ts` (`transferFee`/`poachFee`); this module only decides
 * how the club and player REACT to an offer.
 */

import { Rng } from './rng';
import { wage } from './wages';
import { BOTTOM_TIER } from './league';
import type { Player } from './types';

/** How much over the bare wage a player demands to sign (negotiating margin). */
export const WAGE_DEMAND_PREMIUM = 1.25;
/** Extra wage demand per division above the bottom tier (higher leagues pay more). */
export const WAGE_DEMAND_PER_TIER = 0.15;

/**
 * The per-round wage (£M, 1dp) a player demands as personal terms. Scaled off the
 * base `wage(p)` curve by a negotiating premium and by how high up the pyramid the
 * club is (a Premier League move commands Premier League wages). Always ≥ 0.1.
 */
export function wageDemand(p: Player, tier: number): number {
  const tierFactor = 1 + (BOTTOM_TIER - tier) * WAGE_DEMAND_PER_TIER;
  const demand = wage(p) * WAGE_DEMAND_PREMIUM * tierFactor;
  return Math.max(0.1, Math.round(demand * 10) / 10);
}

/** The lowest fraction of the asking price a club will entertain (below ⇒ reject). */
export const BID_FLOOR = 0.85;

export type BidResult = 'accept' | 'counter' | 'reject';

export interface BidVerdict {
  result: BidResult;
  /** Present only when `result === 'counter'` — the fee the club will accept (£M). */
  counter?: number;
}

/**
 * The selling club's response to a bid (£M) against its asking price (£M).
 * - bid ≥ ask              → accept
 * - ask×BID_FLOOR ≤ bid    → counter at roughly the midpoint (never below 90% ask)
 * - below that             → reject
 * A small seeded wobble on the floor keeps clubs from being perfectly predictable.
 * Free agents (asking 0) always accept a 0 bid.
 */
export function evaluateBid(askingPrice: number, bid: number, seed: string | number): BidVerdict {
  if (askingPrice <= 0 || bid >= askingPrice) return { result: 'accept' };
  const rng = new Rng(`${seed}-bid`);
  const floor = BID_FLOOR - rng.next() * 0.05; // 0.80–0.85
  if (bid >= askingPrice * floor) {
    const mid = Math.ceil((bid + askingPrice) / 2);
    const counter = Math.min(askingPrice, Math.max(mid, Math.ceil(askingPrice * 0.9)));
    return { result: 'counter', counter };
  }
  return { result: 'reject' };
}

/**
 * Whether the club can fit a new signing's wage demand under its soft wage budget,
 * given what the squad already pays. Over budget ⇒ the player refuses the move.
 */
export function termsAffordable(demand: number, currentBill: number, budget: number): boolean {
  return currentBill + demand <= budget;
}
