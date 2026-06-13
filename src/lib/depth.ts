/**
 * Squad depth chart — how well each role line is stocked for the current
 * formation, and where you're exposed. Pure & deterministic. A planning lens
 * over the squad you already own: starters, cover, and the thin spots one
 * suspension away from a problem.
 */

import { roleCounts } from './formations';
import { overall } from './wages';
import { ROLES, type Player, type Role } from './types';

export type DepthStatus = 'ok' | 'thin' | 'short';

export interface RoleDepth {
  role: Role;
  /** Slots this formation needs in the role. */
  needed: number;
  /** Owned players in the role. */
  total: number;
  /** Owned players in the role who are available (not banned/injured). */
  fieldable: number;
  status: DepthStatus;
  /** Plain-English read of the line's health. */
  note: string;
  /** Owned players in the role, strongest first. */
  players: Player[];
}

/**
 * Per-role depth for the current formation.
 * - `short`  — fewer fieldable than the formation needs (you can't field the line).
 * - `thin`   — exactly enough, no cover (one knock away from short); also a lone keeper.
 * - `ok`     — at least one spare.
 */
export function squadDepth(
  players: readonly Player[],
  unavailable: ReadonlySet<string>,
  formationId: string
): RoleDepth[] {
  const needs = roleCounts(formationId);
  return ROLES.map((role) => {
    const inRole = players
      .filter((p) => p.role === role)
      .sort((a, b) => overall(b) - overall(a));
    const fieldable = inRole.filter((p) => !unavailable.has(p.id)).length;
    const needed = needs[role];
    const total = inRole.length;

    let status: DepthStatus;
    let note: string;
    if (fieldable < needed) {
      status = 'short';
      note = `Short — need ${needed}, only ${fieldable} fit`;
    } else if (role === 'GK' && total < 2) {
      status = 'thin';
      note = 'No backup keeper';
    } else if (total <= needed) {
      status = 'thin';
      note = 'No cover — every player starts';
    } else {
      status = 'ok';
      note = `${total - needed} in reserve`;
    }
    return { role, needed, total, fieldable, status, note, players: inRole };
  });
}
