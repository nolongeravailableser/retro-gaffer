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

  // Legality is keeper-line based, NOT per-role: any outfielder can play any
  // outfield slot (out of position, at a penalty), so a maldistributed-but-
  // numerous squad (e.g. 5 DEF / 3 MID / 3 FWD for a 4-4-2) can still field a
  // legal XI. You only need to SIGN when a keeper line is genuinely short:
  // too few keepers, or too few outfielders in total. This stops the journey
  // demanding "sign a MID" — sometimes impossible (window shut) — when you can
  // already field eleven (Auto-Pick covers the gap out of position).
  const outfieldRoles: Role[] = ['DEF', 'MID', 'FWD'];
  const gkGap = required.GK - have.GK;
  const outfieldReq = outfieldRoles.reduce((n, r) => n + required[r], 0);
  const outfieldHave = outfieldRoles.reduce((n, r) => n + have[r], 0);
  const outfieldGap = outfieldReq - outfieldHave;

  if (gkGap > 0 || outfieldGap > 0) {
    // Report where you're nominally short for sensible "sign a …" guidance: the
    // GK gap, plus the outfield shortfall attributed to the most-deficient
    // outfield roles (any outfielder closes it — this is just a helpful hint).
    const missing: Partial<Record<Role, number>> = {};
    if (gkGap > 0) missing.GK = gkGap;
    let remaining = Math.max(0, outfieldGap);
    for (const role of outfieldRoles) {
      if (remaining <= 0) break;
      const roleGap = Math.min(remaining, Math.max(0, required[role] - have[role]));
      if (roleGap > 0) { missing[role] = roleGap; remaining -= roleGap; }
    }
    return { stage: 'sign', missing, missingText: formatMissing(missing) };
  }
  if (filled < XI_SIZE) return { stage: 'pick', missing: {}, missingText: '' };
  return { stage: 'play', missing: {}, missingText: '' };
}
