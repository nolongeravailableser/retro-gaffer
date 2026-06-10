/**
 * Featured Free Agent — a deterministic, daily-rotating marquee signing offered
 * at a discount. Everyone sees the same featured player on a given date (like the
 * Daily Challenge), so it's a fair daily hook that surfaces a notable name from
 * the long tail. Pure & UI-agnostic.
 */

import { POOL } from '@/data/pool';
import { hashSeed } from './rng';

/** Only gold/icon names are featured — the spotlight is for marquee players. */
const ELIGIBLE = POOL.filter((p) => p.rarity === 'gold' || p.rarity === 'icon');

/** Fraction off the normal cost for the day's featured player. */
export const FEATURED_DISCOUNT = 0.4;

/** Today's featured player id, deterministic per date. */
export function featuredPlayerId(dateKey: string): string {
  return ELIGIBLE[hashSeed(`gaffer-featured-${dateKey}`) % ELIGIBLE.length].id;
}

/** Discounted price (min £1M). */
export function featuredCost(cost: number): number {
  return Math.max(1, Math.round(cost * (1 - FEATURED_DISCOUNT)));
}
