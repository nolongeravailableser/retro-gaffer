/**
 * Classic Draft League — the squad draft.
 *
 * Classic is a self-contained league: YOU and 11 AI clubs draft a squad each
 * from a shared player pool, then play a round-robin season against the very
 * squads everyone drafted. No gacha packs — a real fantasy-style snake draft.
 *
 * Each team has a BUDGET (yours scales with difficulty). Picks happen in SNAKE
 * order (1→N, then N→1, repeating) so picking last in one round means picking
 * first in the next — fair. A pick costs the player's market value against the
 * team's budget. The whole thing is pure & seeded (deterministic), so a draft
 * replays identically.
 *
 * The logic that "makes sense": a RESERVE GUARD. A team may never spend so much
 * that it can't still afford to fill its required roles (a legal XI). Before any
 * pick we reserve the minimum cost to complete the unfilled required roles with
 * the cheapest players left, so every team always ends the draft fieldable.
 */

import { Rng } from './rng';
import type { Role } from './types';

/** A player as the draft sees it — id, role, rating (atk+def), and £m value. */
export interface DraftablePlayer {
  id: string;
  role: Role;
  rating: number;
  value: number;
}

/** Roles a squad must cover to field a legal XI (sums to 11). */
export const DRAFT_NEED: Record<Role, number> = { GK: 1, DEF: 4, MID: 4, FWD: 2 };
/** Total players each team drafts (a legal XI + three for the bench). */
export const DRAFT_SQUAD_SIZE = 14;

export interface DraftTeam {
  id: string;
  name: string;
  /** Remaining transfer budget (£m). */
  budget: number;
  /** Drafted player ids, in pick order. */
  roster: string[];
}

export interface DraftState {
  teams: DraftTeam[];
  /** Available (undrafted) player ids. */
  pool: string[];
  /** Flat snake sequence of team indices for the entire draft. */
  order: number[];
  /** Position within `order` of the pick about to be made. */
  pick: number;
  /** Player metadata, by id (role/rating/value) — static across the draft. */
  meta: Record<string, DraftablePlayer>;
}

/**
 * Snake pick order: round 1 runs 0…N-1, round 2 runs N-1…0, and so on, for
 * `rounds` rounds. Returns the flat sequence of team indices.
 */
export function snakeOrder(numTeams: number, rounds: number): number[] {
  const order: number[] = [];
  for (let r = 0; r < rounds; r++) {
    const base = Array.from({ length: numTeams }, (_, i) => i);
    order.push(...(r % 2 === 0 ? base : base.reverse()));
  }
  return order;
}

/** Build the initial draft: a seeded random first-round order, then snake it. */
export function generateDraft(
  seed: string | number,
  teams: Array<{ id: string; name: string; budget: number }>,
  players: readonly DraftablePlayer[]
): DraftState {
  const rng = new Rng(`${seed}-draft`);
  // Randomise the seating (first-round pick order), then snake from there.
  const seats = teams.map((_, i) => i);
  for (let i = seats.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [seats[i], seats[j]] = [seats[j], seats[i]];
  }
  const order = snakeOrder(teams.length, DRAFT_SQUAD_SIZE).map((slot) => seats[slot]);
  const meta: Record<string, DraftablePlayer> = {};
  for (const p of players) meta[p.id] = p;
  return {
    teams: teams.map((t) => ({ id: t.id, name: t.name, budget: t.budget, roster: [] })),
    pool: players.map((p) => p.id),
    order,
    pick: 0,
    meta,
  };
}

/** The index of the team picking now, or null when the draft is complete. */
export function currentTeam(state: DraftState): number | null {
  return state.pick < state.order.length ? state.order[state.pick] : null;
}

export function draftComplete(state: DraftState): boolean {
  return state.pick >= state.order.length;
}

/** How many of each required role a team still needs (0 if met or over). */
function unmetNeeds(state: DraftState, team: DraftTeam): Partial<Record<Role, number>> {
  const have: Record<string, number> = {};
  for (const id of team.roster) {
    const r = state.meta[id]?.role;
    if (r) have[r] = (have[r] ?? 0) + 1;
  }
  const need: Partial<Record<Role, number>> = {};
  for (const [role, n] of Object.entries(DRAFT_NEED) as [Role, number][]) {
    const short = n - (have[role] ?? 0);
    if (short > 0) need[role] = short;
  }
  return need;
}

/**
 * The minimum budget a team must keep back to still complete its required roles
 * — the cheapest available player for each still-needed slot (excluding
 * `excludeId`, the player being considered). This is the reserve guard.
 */
function reserveCost(state: DraftState, team: DraftTeam, excludeId?: string): number {
  const needs = unmetNeeds(state, team);
  let reserve = 0;
  // Cheapest available per role, in ascending order, so multiple slots of the
  // same role reserve the N cheapest (not the same one twice).
  for (const [role, count] of Object.entries(needs) as [Role, number][]) {
    const cheapest = state.pool
      .filter((id) => id !== excludeId && state.meta[id]?.role === role)
      .map((id) => state.meta[id].value)
      .sort((a, b) => a - b)
      .slice(0, count);
    for (const c of cheapest) reserve += c;
  }
  return reserve;
}

/**
 * Whether a team can draft a player: it's available and affordable WITHOUT
 * breaking the reserve guard (it must keep enough to fill its remaining required
 * roles). The role the player fills relaxes the reserve for that slot.
 */
export function canPick(state: DraftState, teamIdx: number, playerId: string): boolean {
  const team = state.teams[teamIdx];
  const p = state.meta[playerId];
  if (!team || !p || !state.pool.includes(playerId)) return false;
  if (p.value > team.budget) return false;
  // After this pick, can the team still afford its remaining required roles?
  // Excluding the picked player both from the pool and (if it filled a need)
  // from the reserve, since picking it covers that slot.
  const afterRoster = { ...team, roster: [...team.roster, playerId] };
  const reserve = reserveCost(state, afterRoster, playerId);
  return p.value <= team.budget - reserve;
}

/**
 * The AI's pick for the team on the clock. Prefers players that fill a still-
 * needed required role (completing a legal XI first), then takes the best
 * available it can sensibly afford — with a little seeded variety so clubs don't
 * draft identically. Returns null only if nothing is pickable (shouldn't happen
 * while the pool has players, thanks to the reserve guard).
 */
export function aiPick(state: DraftState, teamIdx: number): string | null {
  const team = state.teams[teamIdx];
  const needs = unmetNeeds(state, team);
  const neededRoles = new Set(Object.keys(needs) as Role[]);
  let pickable = state.pool.filter((id) => canPick(state, teamIdx, id));
  // While required roles are open, restrict to them (field a legal XI first).
  if (neededRoles.size) {
    const needed = pickable.filter((id) => neededRoles.has(state.meta[id].role));
    if (needed.length) pickable = needed;
  }
  if (pickable.length === 0) {
    // Safety net (a depleted pool can't satisfy the budget guard): complete the
    // squad anyway with the cheapest still-needed player, then cheapest overall.
    // Fielding a legal XI comes before staying perfectly under budget.
    const needFirst = neededRoles.size
      ? state.pool.filter((id) => neededRoles.has(state.meta[id].role))
      : [];
    const fallback = (needFirst.length ? needFirst : state.pool)
      .sort((a, b) => state.meta[a].value - state.meta[b].value);
    return fallback[0] ?? null;
  }
  const candidates = pickable.sort((a, b) => state.meta[b].rating - state.meta[a].rating);
  // Seeded pick from the top few, so the strongest player usually goes but the
  // draft isn't perfectly deterministic-greedy for every club.
  const rng = new Rng(`${state.pick}-${team.id}-aipick`);
  const top = candidates.slice(0, Math.min(3, candidates.length));
  return top[rng.int(0, top.length - 1)];
}

/** Apply a pick (charge the budget, move the player to the roster), advance. */
export function applyPick(state: DraftState, playerId: string): DraftState {
  const teamIdx = currentTeam(state);
  if (teamIdx === null) return state;
  const p = state.meta[playerId];
  if (!p || !state.pool.includes(playerId)) return state;
  const teams = state.teams.map((t, i) =>
    i === teamIdx
      ? { ...t, budget: Math.max(0, Math.round((t.budget - p.value) * 10) / 10), roster: [...t.roster, playerId] }
      : t
  );
  return {
    ...state,
    teams,
    pool: state.pool.filter((id) => id !== playerId),
    pick: state.pick + 1,
  };
}

/** A drafted club's strength (ATK+DEF) — the sum of its roster's ratings. */
export function draftedStrength(state: DraftState, teamIdx: number): number {
  return state.teams[teamIdx].roster.reduce((s, id) => s + (state.meta[id]?.rating ?? 0), 0);
}
