/**
 * The player pool: single source of truth. Loads the raw "peak snapshot" JSON
 * and maps it to the runtime `Player` shape used across the app — deriving the
 * pitch role, card rarity, and chemistry synergy keys.
 */

import raw from './players.json';
import type { Player, Position, Rarity, RawPlayer, Role } from '@/lib/types';

/** Granular authored position → the four pitch buckets. */
const POSITION_TO_ROLE: Record<Position, Role> = {
  Goalkeeper: 'GK',
  CenterBack: 'DEF',
  Fullback: 'DEF',
  Anchor: 'MID',
  BoxToBox: 'MID',
  Playmaker: 'MID',
  Winger: 'FWD',
  Striker: 'FWD',
};

/** Peak-impact cost (1–5) → card tier. */
function rarityFromCost(cost: number): Rarity {
  if (cost >= 5) return 'icon';
  if (cost === 4) return 'gold';
  if (cost === 3) return 'silver';
  return 'bronze';
}

function toPlayer(r: RawPlayer): Player {
  return {
    id: r.id,
    name: r.name,
    cost: r.cost,
    stats: r.stats,
    tags: r.tags,
    role: POSITION_TO_ROLE[r.role],
    rarity: rarityFromCost(r.cost),
    position: r.role,
    peak_season: r.peak_season,
    club: r.club,
    league: r.league,
    nationality: r.nationality,
    // Club + nationality join the curated tags as chemistry keys (FUT-style).
    synergyTags: [...r.tags, r.club, r.nationality],
    era: r.peak_season,
  };
}

export const POOL: Player[] = (raw as RawPlayer[]).map(toPlayer);

const BY_ID = new Map(POOL.map((p) => [p.id, p]));

/** Look up a player from the static pool by id. */
export function getPlayer(id: string | null | undefined): Player | undefined {
  return id ? BY_ID.get(id) : undefined;
}
