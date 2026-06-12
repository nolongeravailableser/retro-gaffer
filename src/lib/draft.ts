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
import { roundRobin, YOU, type LeagueState, type LeagueClub } from './league';
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
/** Total players each team drafts — a legal XI + five subs (the full 16-man
 *  roster). It's a closed tournament: no transfers, so the bench is your only
 *  cover for suspensions and injuries. */
export const DRAFT_SQUAD_SIZE = 16;

/**
 * Baseline draft budget (£m) for a Classic team — enough to draft a competitive
 * 14-man squad from the pool. YOUR budget scales from this by difficulty; AI
 * clubs get this with a little seeded spread. Tuned for a fair, varied league.
 */
export const CLASSIC_DRAFT_BUDGET = 150;

/**
 * AI clubs' baseline draft budget (£m), with a seeded ±spread per club. Set a
 * notch BELOW the Standard player budget so difficulty reads cleanly: Standard
 * is a real edge, Easy dominates, Hardcore is an underdog. Tuned via the sim.
 */
export const AI_DRAFT_BUDGET = 120;
/** AI budget spread: each club gets AI_DRAFT_BUDGET × (this lo … hi). */
export const AI_BUDGET_LO = 0.85;
export const AI_BUDGET_HI = 1.25;

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
  if (!Object.keys(needs).length) return 0;
  // One pass over the pool, keeping only the `count` cheapest values per needed
  // role (a tiny capped, sorted list) — avoids sorting the whole pool per role.
  const cheapest: Partial<Record<Role, number[]>> = {};
  for (const id of state.pool) {
    if (id === excludeId) continue;
    const m = state.meta[id];
    const count = needs[m.role as Role];
    if (!count) continue;
    const arr = (cheapest[m.role as Role] ??= []);
    if (arr.length < count) {
      arr.push(m.value);
      arr.sort((a, b) => a - b);
    } else if (m.value < arr[arr.length - 1]) {
      arr[arr.length - 1] = m.value;
      arr.sort((a, b) => a - b);
    }
  }
  let reserve = 0;
  for (const role in cheapest) for (const v of cheapest[role as Role]!) reserve += v;
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
 * Whether a team may draft a player in the UI. FREE PICKING: from the very first
 * pick you may draft any player of any role you can afford — no role-first
 * restriction, so the available pool never "changes" on you mid-draft. Two
 * guarantees keep every squad legal:
 *  - you can't over-commit picks to one area — once your remaining picks only
 *    just cover the required roles you still need, you must fill those roles;
 *  - if you've spent up, the cheapest available player of a still-needed role
 *    (or, when the XI is complete, the cheapest player left) is always a
 *    last-resort pick, so the squad ALWAYS fills.
 */
export function pickableInDraft(state: DraftState, teamIdx: number, playerId: string): boolean {
  const team = state.teams[teamIdx];
  const p = state.meta[playerId];
  if (!team || !p || !state.pool.includes(playerId)) return false;
  const needs = unmetNeeds(state, team);
  const requiredLeft = Object.values(needs).reduce((a, b) => a + b, 0);
  const picksLeft = DRAFT_SQUAD_SIZE - team.roster.length;
  // Reserve your final picks for any required roles you still need — otherwise
  // pick freely (any affordable player, any role).
  if (picksLeft <= requiredLeft && !needs[p.role]) return false;
  if (p.value <= team.budget) return true;
  // Spent up → last resort so the squad always completes.
  if (needs[p.role]) {
    const cheapest = Math.min(
      ...state.pool.filter((id) => state.meta[id].role === p.role).map((id) => state.meta[id].value)
    );
    return p.value === cheapest;
  }
  if (requiredLeft === 0) {
    const cheapest = Math.min(...state.pool.map((id) => state.meta[id].value));
    return p.value === cheapest;
  }
  return false;
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
  // Role-first candidate set, best-rated first.
  let candidates = neededRoles.size
    ? state.pool.filter((id) => neededRoles.has(state.meta[id].role))
    : state.pool.slice();
  if (!candidates.length) candidates = state.pool.slice();
  candidates.sort((a, b) => state.meta[b].rating - state.meta[a].rating);
  // Lazily collect the top few that pass the reserve guard — usually the very
  // top (early budgets are ample), so this checks only a handful, not the whole
  // pool. Seeded pick among them so clubs don't draft identically.
  const top: string[] = [];
  for (const id of candidates) {
    if (canPick(state, teamIdx, id)) {
      top.push(id);
      if (top.length >= 3) break;
    }
  }
  if (top.length === 0) {
    // Safety net (a depleted pool can't satisfy the budget guard): complete the
    // squad with the cheapest still-needed player, then cheapest overall.
    const needFirst = neededRoles.size
      ? state.pool.filter((id) => neededRoles.has(state.meta[id].role))
      : [];
    const fallback = (needFirst.length ? needFirst : state.pool.slice())
      .sort((a, b) => state.meta[a].value - state.meta[b].value);
    return fallback[0] ?? null;
  }
  const rng = new Rng(`${state.pick}-${team.id}-aipick`);
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

/**
 * Turn a completed draft into a Classic league: each team becomes a club with
 * the squad it drafted (so the AI you face is literally the squad it built), and
 * a single round-robin fixture list (every pair once → a quick season). The
 * first team is always YOU.
 */
export function leagueFromDraft(state: DraftState): LeagueState {
  const clubs: LeagueClub[] = state.teams.map((t, i) => ({
    id: i === 0 ? YOU : t.id,
    name: t.name,
    strength: draftedStrength(state, i),
    squad: [...t.roster],
  }));
  const fixtures = roundRobin(clubs.map((c) => c.id));
  return { clubs, fixtures, results: {}, matchweek: 1 };
}
