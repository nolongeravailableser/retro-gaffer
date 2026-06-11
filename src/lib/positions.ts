/**
 * Position eligibility — which granular positions a player can credibly fill,
 * inferred from his one authored position (no per-player data authoring). Pure
 * and deterministic; drives placement eligibility, the out-of-position penalty,
 * and position-aware auto-pick.
 *
 * The eight authored positions map to four coarse Roles (see POSITION_TO_ROLE).
 * A player's eligible set is his natural position plus the adjacent ones a real
 * player of that type would cover — and adjacency deliberately crosses Role
 * lines (a full-back pushing to wing-back, a striker drifting wide), so the XI
 * can be more flexible than the coarse Role buckets allow.
 */

import type { Player, Position, Role } from './types';

export const POSITION_TO_ROLE: Record<Position, Role> = {
  Goalkeeper: 'GK',
  CenterBack: 'DEF',
  Fullback: 'DEF',
  Anchor: 'MID',
  BoxToBox: 'MID',
  Playmaker: 'MID',
  Winger: 'FWD',
  Striker: 'FWD',
};

/** Real-life position adjacency (includes the position itself, first). */
const ELIGIBLE: Record<Position, Position[]> = {
  Goalkeeper: ['Goalkeeper'],
  CenterBack: ['CenterBack', 'Fullback'],
  Fullback: ['Fullback', 'CenterBack', 'Winger'],
  Anchor: ['Anchor', 'CenterBack', 'BoxToBox'],
  BoxToBox: ['BoxToBox', 'Anchor', 'Playmaker'],
  Playmaker: ['Playmaker', 'BoxToBox', 'Winger'],
  Winger: ['Winger', 'Striker', 'Playmaker'],
  Striker: ['Striker', 'Winger'],
};

/** Penalty multiplier for fielding a player outside his eligible positions. */
export const OUT_OF_POSITION_MULT = 0.9;

const ALL_POSITIONS = Object.keys(POSITION_TO_ROLE) as Position[];

/** Positions belonging to a coarse role (fallback for position-less fixtures). */
function positionsForRole(role: Role): Position[] {
  return ALL_POSITIONS.filter((p) => POSITION_TO_ROLE[p] === role);
}

/**
 * The positions a player can play. Uses his authored `position`; if absent
 * (lightweight fixtures, legacy data) falls back to every position of his role.
 */
export function eligiblePositions(p: Player): Position[] {
  if (p.position) return ELIGIBLE[p.position];
  return positionsForRole(p.role);
}

/** Can this player play that exact position (no penalty)? */
export function canPlay(p: Player, pos: Position): boolean {
  return eligiblePositions(p).includes(pos);
}

/**
 * Effectiveness multiplier for fielding `p` at slot position `pos`:
 * 1 when it's one of his positions, OUT_OF_POSITION_MULT when he's only there
 * on coarse-role cover (e.g. an Anchor filling a Playmaker slot).
 */
export function positionFit(p: Player, pos: Position): number {
  return canPlay(p, pos) ? 1 : OUT_OF_POSITION_MULT;
}

/**
 * Can `p` be placed in a slot wanting `pos` at all? Yes if it's an eligible
 * position OR (lenient, so an XI is always fieldable) the coarse roles match —
 * the latter just carries the out-of-position penalty.
 */
export function canFillSlot(p: Player, pos: Position): boolean {
  return canPlay(p, pos) || p.role === POSITION_TO_ROLE[pos];
}
