/**
 * Economy rules. Pure, UI-agnostic. All amounts are integer £millions.
 *
 * Every spend is validated by a `check*` function that the store calls BEFORE
 * mutating, so bankroll can never go negative and the roster can never overflow.
 */

import type { Player, Rarity } from './types';
import { XI_SIZE, BENCH_SIZE } from './types';
import type { Rng } from './rng';

/** Draw weights per rarity — bronze common, icons rare. */
export const RARITY_WEIGHT: Record<Rarity, number> = {
  bronze: 10,
  silver: 6,
  gold: 3,
  icon: 1,
};

/** Tier ordering, lowest → highest, for guarantee comparisons. */
export const RARITY_RANK: Record<Rarity, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  icon: 3,
};

export const STARTING_BANKROLL = 15;
export const REFRESH_COST = 1;
export const SELL_RATE = 0.8;
export const SHOP_SIZE = 3;
/** Max players a manager can own at once (full XI + full bench). */
export const ROSTER_CAP = XI_SIZE + BENCH_SIZE; // 16

/** Match payouts from side A's perspective. */
export const MATCH_REWARD = { win: 5, draw: 2, loss: 0 } as const;

/** Resale value: 80% of cost, rounded (4 → 3, 7 → 6, 10 → 8). */
export function sellValue(player: Player): number {
  return Math.round(player.cost * SELL_RATE);
}

export interface EconCheck {
  ok: boolean;
  reason?: string;
}

const OK: EconCheck = { ok: true };

/** Can the manager buy this player right now? */
export function checkBuy(
  bankroll: number,
  ownedCount: number,
  player: Player
): EconCheck {
  if (ownedCount >= ROSTER_CAP) return { ok: false, reason: 'Squad full' };
  if (bankroll < player.cost) return { ok: false, reason: 'Not enough funds' };
  return OK;
}

/** Can the manager pay to refresh the shop (cost depends on the pack)? */
export function checkRefresh(
  bankroll: number,
  cost: number = REFRESH_COST
): EconCheck {
  if (bankroll < cost) return { ok: false, reason: 'Not enough funds' };
  return OK;
}

/** Pick an index from `arr`, weighted by rarity. Deterministic via `rng`. */
function weightedIndex(arr: readonly Player[], rng: Rng): number {
  let total = 0;
  for (const p of arr) total += RARITY_WEIGHT[p.rarity];
  let r = rng.next() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= RARITY_WEIGHT[arr[i].rarity];
    if (r <= 0) return i;
  }
  return arr.length - 1;
}

/**
 * Draw up to `size` distinct players from the pool, excluding owned ids.
 * Sampling is WEIGHTED by rarity (see RARITY_WEIGHT) so bronze appears often and
 * icons are rare. If `guarantee` is given, at least one slot is forced to be
 * >= that tier (swapping out the lowest pick). Pure and deterministic.
 */
export function drawShop(
  pool: readonly Player[],
  excludeIds: ReadonlySet<string>,
  rng: Rng,
  size: number = SHOP_SIZE,
  guarantee?: Rarity
): string[] {
  const remaining = pool.filter((p) => !excludeIds.has(p.id));
  const picks: Player[] = [];
  for (let n = 0; n < size && remaining.length > 0; n++) {
    const idx = weightedIndex(remaining, rng);
    picks.push(remaining[idx]);
    remaining.splice(idx, 1);
  }

  if (guarantee && picks.length > 0) {
    const need = RARITY_RANK[guarantee];
    const alreadyMet = picks.some((p) => RARITY_RANK[p.rarity] >= need);
    if (!alreadyMet) {
      const eligible = remaining.filter((p) => RARITY_RANK[p.rarity] >= need);
      if (eligible.length > 0) {
        const repl = eligible[weightedIndex(eligible, rng)];
        let low = 0;
        for (let i = 1; i < picks.length; i++) {
          if (RARITY_RANK[picks[i].rarity] < RARITY_RANK[picks[low].rarity]) low = i;
        }
        picks[low] = repl;
      }
    }
  }

  return picks.map((p) => p.id);
}

export { XI_SIZE, BENCH_SIZE };
