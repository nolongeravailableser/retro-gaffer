/**
 * Auto-Pick — one-click squad helpers. Pure & deterministic (no RNG; ties break
 * on player id), so picks are reproducible and Daily-safe.
 *
 *  - pickBestXI: field the strongest available XI for a formation, respecting
 *    suspensions/injuries, with a chemistry-aware refinement pass.
 *  - planAutoBuy: from the CURRENT shop offers only, choose signings that fill
 *    the XI's missing roles within budget. Never chains paid refreshes and
 *    never spends below a reserve — a helper must not drain the bankroll.
 */

import type { Player, Role } from './types';
import { XI_SIZE, BENCH_SIZE } from './types';
import { getFormation, roleCounts } from './formations';
import { computeChemistry } from './chemistry';
import { positionFit } from './positions';

/** How much each stat matters per role (a striker's DEF is nearly irrelevant). */
const ROLE_WEIGHT: Record<Role, { atk: number; def: number }> = {
  GK: { atk: 0.1, def: 1 },
  DEF: { atk: 0.35, def: 1 },
  MID: { atk: 0.75, def: 0.75 },
  FWD: { atk: 1, def: 0.35 },
};

/** Role-weighted quality of a player (raw stats, no chemistry). */
export function roleScore(p: Player, role: Role = p.role): number {
  const w = ROLE_WEIGHT[role];
  return p.stats.attack * w.atk + p.stats.defense * w.def;
}

/** Chemistry-boosted total strength of a set of starters. */
function squadStrength(starters: Player[]): number {
  const c = computeChemistry(starters);
  return c.totalAttack + c.totalDefense;
}

/** Stable ordering: better score first, then id (determinism on ties). */
function byScoreDesc(role: Role) {
  return (a: Player, b: Player) =>
    roleScore(b, role) - roleScore(a, role) || a.id.localeCompare(b.id);
}

export interface Availability {
  suspensions: readonly string[];
  injuries: Readonly<Record<string, number>>;
}

export interface PickResult {
  /** Slot index → playerId | null, matching the formation's slots. */
  xi: (string | null)[];
  bench: string[];
  /** How many XI slots were filled. */
  filled: number;
}

/**
 * Pick the strongest available XI for a formation.
 *
 * Greedy fill per slot by role-weighted score, then a bounded refinement pass:
 * for each slot, try every unused same-role player and keep a swap when the
 * chemistry-boosted squad strength improves. Suspended/injured players are
 * never fielded; leftovers (best first, unavailable last) fill the bench.
 */
export function pickBestXI(
  ownedIds: readonly string[],
  formationId: string,
  availability: Availability,
  resolve: (id: string) => Player | undefined
): PickResult {
  const formation = getFormation(formationId);
  const suspended = new Set(availability.suspensions);
  const owned = ownedIds
    .map(resolve)
    .filter((p): p is Player => !!p);
  const available = owned.filter(
    (p) => !suspended.has(p.id) && !availability.injuries[p.id]
  );

  // Greedy: hand each slot the best remaining player of its role, PREFERRING
  // players who actually play that slot's nominal position (positionFit), so the
  // default XI fields in position and avoids the out-of-position penalty.
  const queue = new Map<Role, Player[]>();
  for (const role of ['GK', 'DEF', 'MID', 'FWD'] as Role[]) {
    queue.set(role, available.filter((p) => p.role === role).sort(byScoreDesc(role)));
  }
  const xi: (Player | null)[] = new Array(XI_SIZE).fill(null);
  formation.slots.forEach((role, i) => {
    const poolR = queue.get(role)!;
    if (poolR.length === 0) return;
    const pos = formation.positions[i];
    let best = 0;
    let bestScore = -Infinity;
    poolR.forEach((p, idx) => {
      const s = roleScore(p, role) * positionFit(p, pos);
      if (s > bestScore) {
        bestScore = s;
        best = idx;
      }
    });
    xi[i] = poolR.splice(best, 1)[0];
  });
  // Whatever the greedy pass didn't use is the candidate pool for refinement.
  let pool = available.filter((p) => !xi.includes(p));

  // Refinement: chemistry can beat raw stats — accept any same-role swap that
  // raises the boosted squad strength. Bounded passes keep it fast + terminating.
  for (let pass = 0; pass < 2; pass++) {
    let improved = false;
    for (let i = 0; i < XI_SIZE; i++) {
      const incumbent = xi[i];
      if (!incumbent) continue;
      const role = formation.slots[i];
      const candidates = pool.filter((p) => p.role === role).sort((a, b) => a.id.localeCompare(b.id));
      for (const challenger of candidates) {
        const current = squadStrength(xi.filter((p): p is Player => !!p));
        const trial = xi.slice();
        trial[i] = challenger;
        const next = squadStrength(trial.filter((p): p is Player => !!p));
        if (next > current + 1e-9) {
          xi[i] = challenger;
          // The displaced incumbent returns to the pool for other slots/passes.
          pool = pool.filter((p) => p.id !== challenger.id).concat(incumbent);
          improved = true;
          break; // re-evaluate this slot's pool next pass
        }
      }
    }
    if (!improved) break;
  }

  // Bench: best leftovers first; unavailable (injured/suspended) players go
  // last — they can sit on the bench, but shouldn't crowd out fit cover.
  const fielded = new Set(xi.filter((p): p is Player => !!p).map((p) => p.id));
  const leftovers = owned
    .filter((p) => !fielded.has(p.id))
    .sort((a, b) => {
      const aFit = !suspended.has(a.id) && !availability.injuries[a.id] ? 0 : 1;
      const bFit = !suspended.has(b.id) && !availability.injuries[b.id] ? 0 : 1;
      return aFit - bFit || roleScore(b) - roleScore(a) || a.id.localeCompare(b.id);
    });

  return {
    xi: xi.map((p) => p?.id ?? null),
    bench: leftovers.slice(0, BENCH_SIZE).map((p) => p.id),
    filled: fielded.size,
  };
}

/** Auto-buy never spends the bankroll below this floor (refreshes, wagers). */
export const AUTO_BUY_RESERVE = 5;

export interface ShopOffer {
  /** Shop slot index (so the store can buy the right slot). */
  index: number;
  player: Player;
  /** Effective cost (relic discounts already applied). */
  cost: number;
}

/**
 * Plan need-driven signings from the current offers: buy only players whose
 * role the squad can't yet field a full XI with, best (chemistry-aware) value
 * first, while staying above `reserve` and below the roster cap. Returns the
 * offers to buy, in purchase order. Empty plan = nothing needed/affordable.
 */
export function planAutoBuy(
  offers: readonly ShopOffer[],
  ownedPlayers: readonly Player[],
  starters: readonly Player[],
  formationId: string,
  bankroll: number,
  ownedCount: number,
  rosterCap: number,
  reserve: number = AUTO_BUY_RESERVE
): ShopOffer[] {
  const required = roleCounts(formationId);
  const have: Record<Role, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of ownedPlayers) have[p.role]++;

  const plan: ShopOffer[] = [];
  const remaining = [...offers];
  let funds = bankroll;
  let count = ownedCount;
  const baseStrength = squadStrength([...starters]);

  for (;;) {
    if (count >= rosterCap) break;
    const needed = (role: Role) => have[role] < required[role];
    const candidates = remaining
      .filter((o) => needed(o.player.role) && funds - o.cost >= reserve)
      .sort((a, b) => {
        // Best marginal value first: role-weighted quality + chemistry lift.
        const lift = (o: ShopOffer) =>
          roleScore(o.player) + (squadStrength([...starters, o.player]) - baseStrength);
        return lift(b) - lift(a) || a.cost - b.cost || a.player.id.localeCompare(b.player.id);
      });
    const pick = candidates[0];
    if (!pick) break;
    plan.push(pick);
    remaining.splice(remaining.indexOf(pick), 1);
    funds -= pick.cost;
    count++;
    have[pick.player.role]++;
  }

  return plan;
}
