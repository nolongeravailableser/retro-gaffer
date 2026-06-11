/**
 * Player match ratings — a pure, deterministic read over the engine's events.
 * Given the same events/squad/context it always produces the same ratings, so
 * it's safe to compute live (from the events shown so far) and at full-time.
 *
 * The model is FM-flavoured and intentionally simple/explainable: a ~6.3 base
 * (plus a tiny seeded per-player jitter so an uninvolved XI isn't a wall of
 * identical 6.3s), then involvement (goals/assists), discipline, clean sheets /
 * goals conceded for the back line, and the team result. Clamped to 3.0–10.0.
 */

import type { MatchEvent, Player, Role, PlayerHistory } from './types';
import { Rng } from './rng';

export const EMPTY_HISTORY: PlayerHistory = {
  apps: 0,
  goals: 0,
  assists: 0,
  yellows: 0,
  reds: 0,
  motm: 0,
  ratingSum: 0,
};

/** Average match rating, or null with no appearances. */
export function avgRating(h: PlayerHistory): number | null {
  return h.apps > 0 ? Math.round((h.ratingSum / h.apps) * 10) / 10 : null;
}

export interface PlayerRating {
  playerId: string;
  name: string;
  role: Role;
  /** 3.0–10.0, one decimal. */
  rating: number;
  goals: number;
  assists: number;
  yellows: number;
  red: boolean;
  /** Man of the match — the highest-rated player who played. */
  motm: boolean;
}

export interface RatingContext {
  /** Goals conceded by side A (side B's score) — drives the back line's mark. */
  goalsConceded: number;
  outcome: 'win' | 'draw' | 'loss';
  /** The match seed, for the small deterministic per-player jitter. */
  seed: number | string;
}

/**
 * Ratings for side A's players. `squad` is whoever took the field (the XI);
 * `events` may be the full match OR a live prefix (ratings update as it plays).
 */
export function matchRatings(
  events: MatchEvent[],
  squad: Player[],
  ctx: RatingContext
): PlayerRating[] {
  const tally = new Map<string, { goals: number; assists: number; yellows: number; red: boolean }>();
  for (const p of squad) tally.set(p.id, { goals: 0, assists: 0, yellows: 0, red: false });

  for (const e of events) {
    if (e.side !== 'A') continue;
    if (e.kind === 'goal') {
      if (e.playerId && tally.has(e.playerId)) tally.get(e.playerId)!.goals++;
      if (e.assistId && tally.has(e.assistId)) tally.get(e.assistId)!.assists++;
    } else if (e.kind === 'yellow') {
      if (e.playerId && tally.has(e.playerId)) tally.get(e.playerId)!.yellows++;
    } else if (e.kind === 'red') {
      if (e.playerId && tally.has(e.playerId)) tally.get(e.playerId)!.red = true;
    }
  }

  const ratings = squad.map((p) => {
    const t = tally.get(p.id)!;
    // Stable per-player, per-match jitter (±0.4) so the XI isn't all 6.3.
    const jitter = (new Rng(`${ctx.seed}-rate-${p.id}`).next() - 0.5) * 0.8;
    let r = 6.3 + jitter;

    r += t.goals * 1.1 + t.assists * 0.75;
    r -= t.yellows * 0.3;
    if (t.red) r -= 1.6;

    // Back line is judged on goals against; keepers most of all.
    if (p.role === 'GK' || p.role === 'DEF') {
      if (ctx.goalsConceded === 0) r += p.role === 'GK' ? 1.0 : 0.6;
      else r -= ctx.goalsConceded * (p.role === 'GK' ? 0.22 : 0.16);
    }

    r += ctx.outcome === 'win' ? 0.25 : ctx.outcome === 'loss' ? -0.25 : 0;

    r = Math.max(3.0, Math.min(10.0, r));
    return {
      playerId: p.id,
      name: p.name,
      role: p.role,
      rating: Math.round(r * 10) / 10,
      goals: t.goals,
      assists: t.assists,
      yellows: t.yellows,
      red: t.red,
      motm: false,
    };
  });

  // Man of the match: highest rating, ties broken by id for determinism.
  if (ratings.length > 0) {
    let best = ratings[0];
    for (const r of ratings) {
      if (r.rating > best.rating || (r.rating === best.rating && r.playerId < best.playerId)) {
        best = r;
      }
    }
    best.motm = true;
  }

  return ratings;
}

/**
 * Fold one match's ratings into the cumulative per-player history. Pure: returns
 * a new map. `squad` is the XI that started; each gets an appearance plus their
 * goals/assists/cards/rating from this match.
 */
export function accrueHistory(
  history: Record<string, PlayerHistory>,
  events: MatchEvent[],
  squad: Player[],
  ctx: RatingContext
): Record<string, PlayerHistory> {
  const next = { ...history };
  for (const r of matchRatings(events, squad, ctx)) {
    const h = next[r.playerId] ?? EMPTY_HISTORY;
    next[r.playerId] = {
      apps: h.apps + 1,
      goals: h.goals + r.goals,
      assists: h.assists + r.assists,
      yellows: h.yellows + r.yellows,
      reds: h.reds + (r.red ? 1 : 0),
      motm: h.motm + (r.motm ? 1 : 0),
      ratingSum: Math.round((h.ratingSum + r.rating) * 10) / 10,
    };
  }
  return next;
}
