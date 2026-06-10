/**
 * Extended player stats — the deeper data model behind the ATK/DEF core.
 *
 * Eight stats, each owning ONE engine lever (nothing decorative):
 *   pace + passing  → chance creation (own xG up)
 *   shooting        → conversion (own xG up) + who scores
 *   defending       → blunts the OPPONENT's chance creation
 *   goalkeeping     → blunts the OPPONENT's conversion (keeper-only, one stat)
 *   physical        → injury resistance (and a slice of defending duels)
 *   composure       → late-game (75'+) swing — clutch vs. bottlers
 *   discipline      → personal card likelihood (low = card magnet)
 *
 * No data entry: stats are DERIVED deterministically from what a player already
 * is — positional archetype (Winger → fast, Anchor → physical), overall quality
 * (ATK/DEF), and a per-player id-hash jitter so same-archetype players differ.
 * Same player → same stats, forever; aging a career player's ATK/DEF shifts his
 * profile automatically. Pure & memoized; nothing is persisted.
 */

import type { Player, Position, Role } from './types';
import { hashSeed } from './rng';

export interface ExtendedStats {
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
  composure: number;
  discipline: number;
  /** The single keeper stat — tracks DEF for GKs, comedy-low for outfielders. */
  goalkeeping: number;
}

export type ExtendedStatKey = keyof ExtendedStats;

/** Display labels (short codes for chips/bars). */
export const STAT_LABELS: Record<ExtendedStatKey, string> = {
  pace: 'PAC',
  shooting: 'SHO',
  passing: 'PAS',
  defending: 'DEF',
  physical: 'PHY',
  composure: 'CMP',
  discipline: 'DIS',
  goalkeeping: 'GK',
};

type Archetype = Omit<ExtendedStats, 'goalkeeping'> & { goalkeeping: number };

/** Base shape per granular position — what KIND of player this is. */
const POSITION_BASE: Record<Position, Archetype> = {
  Goalkeeper:  { pace: 34, shooting: 12, passing: 46, defending: 32, physical: 70, composure: 70, discipline: 80, goalkeeping: 0 /* tracks DEF */ },
  CenterBack:  { pace: 48, shooting: 25, passing: 52, defending: 86, physical: 85, composure: 60, discipline: 52, goalkeeping: 8 },
  Fullback:    { pace: 76, shooting: 35, passing: 62, defending: 74, physical: 68, composure: 58, discipline: 60, goalkeeping: 6 },
  Anchor:      { pace: 52, shooting: 35, passing: 66, defending: 80, physical: 80, composure: 62, discipline: 46, goalkeeping: 6 },
  BoxToBox:    { pace: 66, shooting: 58, passing: 68, defending: 66, physical: 76, composure: 62, discipline: 55, goalkeeping: 6 },
  Playmaker:   { pace: 58, shooting: 62, passing: 88, defending: 42, physical: 48, composure: 72, discipline: 68, goalkeeping: 6 },
  Winger:      { pace: 88, shooting: 62, passing: 66, defending: 35, physical: 45, composure: 60, discipline: 65, goalkeeping: 5 },
  Striker:     { pace: 72, shooting: 88, passing: 52, defending: 28, physical: 62, composure: 70, discipline: 62, goalkeeping: 5 },
};

/** Coarse fallback when no granular position is authored (rivals, youth). */
const ROLE_FALLBACK: Record<Role, Position> = {
  GK: 'Goalkeeper',
  DEF: 'CenterBack',
  MID: 'BoxToBox',
  FWD: 'Striker',
};

const clamp99 = (v: number) => Math.max(1, Math.min(99, Math.round(v)));

/** Deterministic per-player, per-stat jitter in [-r, r]. */
function jitter(id: string, key: string, r: number): number {
  return (hashSeed(`xstat:${id}:${key}`) % (2 * r + 1)) - r;
}

/** Quality coupling per stat: how much being a BETTER player raises it. */
const QUALITY_K: Record<ExtendedStatKey, number> = {
  pace: 0.5,
  shooting: 0.55,
  passing: 0.55,
  defending: 0.55,
  physical: 0.45,
  composure: 0.35,
  discipline: 0, // temperament, not skill — stars get booked too
  goalkeeping: 0, // handled specially below
};

const cache = new Map<string, ExtendedStats>();

/** Derive (memoized) the extended stats for a player. Pure & deterministic. */
export function deriveStats(p: Player): ExtendedStats {
  const key = `${p.id}:${p.stats.attack}:${p.stats.defense}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const pos = p.position ?? ROLE_FALLBACK[p.role];
  const base = POSITION_BASE[pos] ?? POSITION_BASE[ROLE_FALLBACK[p.role]];
  const quality = Math.max(p.stats.attack, p.stats.defense);

  const out = {} as ExtendedStats;
  for (const k of Object.keys(QUALITY_K) as ExtendedStatKey[]) {
    const r = k === 'discipline' ? 12 : 8;
    out[k] = clamp99(base[k] + (quality - 60) * QUALITY_K[k] + jitter(p.id, k, r));
  }
  // The keeper stat IS the keeper's quality; outfielders keep the comedy floor.
  out.goalkeeping =
    pos === 'Goalkeeper'
      ? clamp99(p.stats.defense + jitter(p.id, 'goalkeeping', 5))
      : clamp99(base.goalkeeping + Math.abs(jitter(p.id, 'goalkeeping', 6)));

  cache.set(key, out);
  return out;
}

/** Team-level aggregates the match engine consumes. All ~1–99, 50 = neutral. */
export interface TeamStatProfile {
  /** Chance creation: pace+passing, led by MID/FWD. */
  creation: number;
  /** Chance conversion: shooting, led by FWD. */
  finishing: number;
  /** Stopping chances at source: defending+physical, led by DEF/MID. */
  defending: number;
  /** The last line: best keeper on the pitch (weak default if none). */
  goalkeeping: number;
  /** Big-moment temperament, squad-wide. */
  composure: number;
}

const NEUTRAL: TeamStatProfile = {
  creation: 50,
  finishing: 50,
  defending: 50,
  goalkeeping: 50,
  composure: 50,
};

/** Per-role weight a player contributes to each attacking/defending aggregate. */
const CREATION_W: Record<Role, number> = { GK: 0.1, DEF: 0.4, MID: 1.0, FWD: 1.2 };
const FINISH_W: Record<Role, number> = { GK: 0, DEF: 0.3, MID: 0.9, FWD: 1.5 };
const DEFEND_W: Record<Role, number> = { GK: 0.3, DEF: 1.4, MID: 0.8, FWD: 0.3 };

/** Aggregate a squad's extended stats into the engine-facing profile. */
export function teamStatProfile(squad: readonly Player[]): TeamStatProfile {
  if (squad.length === 0) return NEUTRAL;

  let creation = 0, creationW = 0;
  let finishing = 0, finishingW = 0;
  let defending = 0, defendingW = 0;
  let composure = 0;
  let goalkeeping = 0;

  for (const p of squad) {
    const s = deriveStats(p);
    const cw = CREATION_W[p.role];
    creation += (s.pace * 0.45 + s.passing * 0.55) * cw;
    creationW += cw;
    const fw = FINISH_W[p.role];
    finishing += s.shooting * fw;
    finishingW += fw;
    const dw = DEFEND_W[p.role];
    defending += (s.defending * 0.7 + s.physical * 0.3) * dw;
    defendingW += dw;
    composure += s.composure;
    if (p.role === 'GK') goalkeeping = Math.max(goalkeeping, s.goalkeeping);
  }

  return {
    creation: creationW ? creation / creationW : 50,
    finishing: finishingW ? finishing / finishingW : 50,
    defending: defendingW ? defending / defendingW : 50,
    // No keeper fielded? The last line is a glove-less outfielder: weak.
    goalkeeping: goalkeeping || 30,
    composure: composure / squad.length,
  };
}
