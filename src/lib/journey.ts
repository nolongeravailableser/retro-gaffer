/**
 * The core-loop journey: SIGN players → PICK an XI → KICK OFF. A single derived
 * stage that the UI uses to make the next action obvious everywhere (journey
 * bar label/routing, nav attention dot, empty states). Pure & deterministic.
 *
 * Callers pass the players that can actually be FIELDED right now (i.e. owned
 * minus suspended/injured) — "you own a GK but he's banned" is a sign-stage
 * problem, not a pick-stage one.
 */

import type { Player, Role } from './types';
import { XI_SIZE } from './types';
import { roleCounts } from './formations';

export type JourneyStage = 'sign' | 'pick' | 'play';

export interface Journey {
  stage: JourneyStage;
  /** Role gaps blocking a legal XI (sign stage only), e.g. { GK: 1, DEF: 2 }. */
  missing: Partial<Record<Role, number>>;
  /** Readable gap summary for the sign stage, e.g. "a GK · 2 DEF". */
  missingText: string;
}

const ROLES: Role[] = ['GK', 'DEF', 'MID', 'FWD'];

function formatMissing(missing: Partial<Record<Role, number>>): string {
  const parts: string[] = [];
  for (const role of ROLES) {
    const gap = missing[role];
    if (!gap) continue;
    parts.push(gap === 1 ? `a ${role}` : `${gap} ${role}`);
  }
  return parts.join(' · ');
}

/** Derive where the player is in the sign → pick → play loop. */
export function journeyFor(
  fieldablePlayers: readonly Player[],
  formationId: string,
  filled: number
): Journey {
  const required = roleCounts(formationId);
  const have: Record<Role, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of fieldablePlayers) have[p.role]++;

  const missing: Partial<Record<Role, number>> = {};
  for (const role of ROLES) {
    const gap = required[role] - have[role];
    if (gap > 0) missing[role] = gap;
  }

  if (Object.keys(missing).length > 0) {
    return { stage: 'sign', missing, missingText: formatMissing(missing) };
  }
  if (filled < XI_SIZE) return { stage: 'pick', missing: {}, missingText: '' };
  return { stage: 'play', missing: {}, missingText: '' };
}
