/**
 * Core domain types for Retro Gaffer.
 *
 * These describe the *data*, not the UI. Nothing in this file imports React.
 */

/** The four pitch buckets the formation/board logic operates on. */
export type Role = 'GK' | 'DEF' | 'MID' | 'FWD';

export const ROLES: readonly Role[] = ['GK', 'DEF', 'MID', 'FWD'] as const;

/** Granular authored position, mapped down to a Role for placement. */
export type Position =
  | 'Goalkeeper'
  | 'CenterBack'
  | 'Fullback'
  | 'Anchor'
  | 'BoxToBox'
  | 'Playmaker'
  | 'Winger'
  | 'Striker';

export type League = 'EPL' | 'LaLiga' | 'SerieA';

/** Card tier, lowest → highest. Drives shop odds and card framing. */
export type Rarity = 'bronze' | 'silver' | 'gold' | 'icon';

export const RARITIES: readonly Rarity[] = [
  'bronze',
  'silver',
  'gold',
  'icon',
] as const;

/**
 * The raw schema authored in `players.json` — a historically accurate "peak
 * snapshot" of each player. Mapped to the runtime `Player` by `@/data/pool`.
 */
export interface RawPlayer {
  id: string;
  name: string;
  /** Format 'YYYY/YY', e.g. '2003/04'. */
  peak_season: string;
  club: string;
  league: League;
  nationality: string;
  /** Peak-impact value, 1–5. */
  cost: number;
  stats: PlayerStats;
  /** Granular authored position. */
  role: Position;
  /** Curated synergy keys (e.g. 'invincibles', 'galacticos'). */
  tags: string[];
}

/** Runtime player: raw data + fields derived by the loader. */
export interface Player {
  id: string;
  name: string;
  /** Transfer cost (1–5). */
  cost: number;
  stats: PlayerStats;
  /** Curated tags shown on the card. */
  tags: string[];
  /** Pitch bucket used by formations/eligibility. */
  role: Role;
  /** Card tier, derived from cost. */
  rarity: Rarity;

  // --- rich data (optional so lightweight fixtures stay valid) ---
  /** Granular authored position. */
  position?: Position;
  peak_season?: string;
  club?: string;
  league?: League;
  nationality?: string;
  /** Keys the chemistry engine uses (curated tags + club + nationality). */
  synergyTags?: string[];
  /** Legacy display label; loader sets this to peak_season. */
  era?: string;
}

export interface PlayerStats {
  /** 0–99. */
  attack: number;
  /** 0–99. */
  defense: number;
}

/** Every formation fields 11 and benches up to 5. */
export const XI_SIZE = 11;
export const BENCH_SIZE = 5;

/** A single line of match commentary produced by the engine. */
export interface MatchEvent {
  /** Match minute, 1–90. */
  minute: number;
  /** 'A' = home (player), 'B' = opponent. */
  side: 'A' | 'B';
  kind: 'goal' | 'chance' | 'flavour';
  text: string;
}

export interface MatchResult {
  events: MatchEvent[];
  score: { a: number; b: number };
  xg: { a: number; b: number };
  outcome: 'win' | 'draw' | 'loss'; // from side A's perspective
}
