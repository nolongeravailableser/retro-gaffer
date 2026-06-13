/**
 * Transfer-market filtering & sorting. Pure (no React, no store) so the
 * Career/League market can surface the WHOLE pool — including the cheap /
 * low-rated long tail the old hard 60-row cap buried — and be unit-tested.
 *
 * Fee depends on club ownership + division tier (poach vs transfer), so the
 * caller injects `feeOf` and `isAtClub`; everything else is derived here.
 */

import { overall } from './wages';
import { isFreeAgent } from './market';
import type { Player, Position, Role } from './types';

export type MarketSegment = 'free' | 'open' | 'rivals';
export type MarketSortKey = 'overall' | 'value' | 'name';

export interface MarketQuery {
  segment: MarketSegment;
  role: 'ALL' | Role;
  position: 'ALL' | Position;
  /** Case-insensitive name substring; '' = no name filter. */
  query: string;
  /** Inclusive fee bounds in £M; null = unbounded. */
  minFee: number | null;
  maxFee: number | null;
  /** Hide players whose fee exceeds the bankroll. */
  affordableOnly: boolean;
  bankroll: number;
  sortKey: MarketSortKey;
  sortDesc: boolean;
  /** Players already on your books (excluded). */
  ownedSet: Set<string>;
  /** True for players owned by a rival club (poach targets). */
  isAtClub: (id: string) => boolean;
  /** Fee for a given player (poach or transfer, tier-scaled). */
  feeOf: (p: Player) => number;
}

/** Filter then sort the pool for the market list. Returns the full match set
 *  (the caller paginates) so "showing X of N" and "show more" are honest. */
export function filterAndSortMarket(pool: Player[], o: MarketQuery): Player[] {
  const q = o.query.trim().toLowerCase();
  const list = pool.filter((p) => {
    if (o.ownedSet.has(p.id)) return false;
    if (o.role !== 'ALL' && p.role !== o.role) return false;
    if (o.position !== 'ALL' && p.position !== o.position) return false;
    if (q && !p.name.toLowerCase().includes(q)) return false;

    const atClub = o.isAtClub(p.id);
    const inSegment =
      o.segment === 'free' ? !atClub && isFreeAgent(p)
      : o.segment === 'rivals' ? atClub
      : !atClub && !isFreeAgent(p); // open market
    if (!inSegment) return false;

    const fee = o.feeOf(p);
    if (o.minFee !== null && !Number.isNaN(o.minFee) && fee < o.minFee) return false;
    if (o.maxFee !== null && !Number.isNaN(o.maxFee) && fee > o.maxFee) return false;
    if (o.affordableOnly && fee > o.bankroll) return false;
    return true;
  });

  const dir = o.sortDesc ? -1 : 1;
  list.sort((a, b) => {
    const cmp =
      o.sortKey === 'value' ? o.feeOf(a) - o.feeOf(b)
      : o.sortKey === 'name' ? a.name.localeCompare(b.name)
      : overall(a) - overall(b);
    // Stable tiebreak by id so paging is deterministic across renders.
    return cmp * dir || a.id.localeCompare(b.id);
  });
  return list;
}
