/**
 * Formation registry. Every formation fields 11 players (1 GK + 10 outfield)
 * but differs in how those slots break down by role and how they lay out on the
 * pitch. Game logic (chemistry, engine) is formation-agnostic — only placement
 * eligibility and the board rendering depend on this.
 */

import type { Role } from './types';

export interface Formation {
  id: string;
  name: string;
  /** Slot index → required role. Length 11. */
  slots: Role[];
  /** Slot indices grouped into display rows, top (attack) → bottom (keeper). */
  rows: number[][];
}

// Canonical slot order per formation: index 0 is always the GK.
export const FORMATIONS: Record<string, Formation> = {
  '442': {
    id: '442',
    name: '4-4-2',
    slots: ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD'],
    rows: [[9, 10], [5, 6, 7, 8], [1, 2, 3, 4], [0]],
  },
  '433': {
    id: '433',
    name: '4-3-3',
    slots: ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'],
    rows: [[8, 9, 10], [5, 6, 7], [1, 2, 3, 4], [0]],
  },
  '352': {
    id: '352',
    name: '3-5-2',
    slots: ['GK', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD'],
    rows: [[9, 10], [4, 5, 6, 7, 8], [1, 2, 3], [0]],
  },
  '4231': {
    id: '4231',
    name: '4-2-3-1',
    slots: ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD'],
    rows: [[10], [7, 8, 9], [5, 6], [1, 2, 3, 4], [0]],
  },
};

export const FORMATION_IDS = Object.keys(FORMATIONS);
export const DEFAULT_FORMATION = '442';

export function getFormation(id: string | undefined | null): Formation {
  return (id && FORMATIONS[id]) || FORMATIONS[DEFAULT_FORMATION];
}

/** Role required at a given slot for a formation. */
export function slotRole(formationId: string, slotIndex: number): Role {
  return getFormation(formationId).slots[slotIndex];
}

/** How many slots of each role a formation needs (handy for UI hints). */
export function roleCounts(formationId: string): Record<Role, number> {
  const counts: Record<Role, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const r of getFormation(formationId).slots) counts[r]++;
  return counts;
}
