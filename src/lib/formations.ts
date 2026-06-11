/**
 * Formation registry. Every formation fields 11 players (1 GK + 10 outfield).
 * Each slot now carries a granular `Position` (where that player nominally
 * plays); the coarse `Role` per slot is DERIVED from it, so existing
 * role-based logic (chemistry, codec, engine) is unchanged and saved XIs —
 * indexed by slot — keep their meaning (the four original formations keep their
 * exact per-index roles + indices + rows).
 */

import type { Position, Role } from './types';
import { POSITION_TO_ROLE } from './positions';

export interface Formation {
  id: string;
  name: string;
  /** Slot index → nominal position. Length 11; index 0 is always the keeper. */
  positions: Position[];
  /** Slot index → coarse role (derived from `positions`). Length 11. */
  slots: Role[];
  /** Slot indices grouped into display rows, top (attack) → bottom (keeper). */
  rows: number[][];
}

type FormationDef = Omit<Formation, 'slots'>;

const G: Position = 'Goalkeeper';
const CB: Position = 'CenterBack';
const FB: Position = 'Fullback';
const DM: Position = 'Anchor';
const CM: Position = 'BoxToBox';
const AM: Position = 'Playmaker';
const W: Position = 'Winger';
const ST: Position = 'Striker';

// Slot positions chosen to match each original formation's per-index coarse
// role exactly (so saves are unaffected); new formations are free-form.
const DEFS: FormationDef[] = [
  { id: '442', name: '4-4-2',
    positions: [G, FB, CB, CB, FB, AM, CM, CM, AM, ST, ST],
    rows: [[9, 10], [5, 6, 7, 8], [1, 2, 3, 4], [0]] },
  { id: '433', name: '4-3-3',
    positions: [G, FB, CB, CB, FB, DM, CM, AM, W, ST, W],
    rows: [[8, 9, 10], [5, 6, 7], [1, 2, 3, 4], [0]] },
  { id: '352', name: '3-5-2',
    positions: [G, CB, CB, CB, AM, CM, DM, CM, AM, ST, ST],
    rows: [[9, 10], [4, 5, 6, 7, 8], [1, 2, 3], [0]] },
  { id: '4231', name: '4-2-3-1',
    positions: [G, FB, CB, CB, FB, DM, CM, AM, AM, AM, ST],
    rows: [[10], [7, 8, 9], [5, 6], [1, 2, 3, 4], [0]] },
  // ── new ──
  { id: '343', name: '3-4-3',
    positions: [G, CB, CB, CB, AM, CM, CM, AM, W, ST, W],
    rows: [[8, 9, 10], [4, 5, 6, 7], [1, 2, 3], [0]] },
  { id: '532', name: '5-3-2',
    positions: [G, FB, CB, CB, CB, FB, CM, DM, CM, ST, ST],
    rows: [[9, 10], [6, 7, 8], [1, 2, 3, 4, 5], [0]] },
  { id: '4141', name: '4-1-4-1',
    positions: [G, FB, CB, CB, FB, DM, AM, CM, CM, AM, ST],
    rows: [[10], [6, 7, 8, 9], [5], [1, 2, 3, 4], [0]] },
  { id: '4132', name: '4-1-3-2 (diamond)',
    positions: [G, FB, CB, CB, FB, DM, CM, CM, AM, ST, ST],
    rows: [[9, 10], [8], [6, 7], [5], [1, 2, 3, 4], [0]] },
];

function build(def: FormationDef): Formation {
  return { ...def, slots: def.positions.map((p) => POSITION_TO_ROLE[p]) };
}

export const FORMATIONS: Record<string, Formation> = Object.fromEntries(
  DEFS.map((d) => [d.id, build(d)])
);

// Explicit (NOT Object.keys — integer-like ids get reordered numerically),
// so the formation picker shows them in this curated order.
export const FORMATION_IDS = DEFS.map((d) => d.id);
export const DEFAULT_FORMATION = '442';

export function getFormation(id: string | undefined | null): Formation {
  return (id && FORMATIONS[id]) || FORMATIONS[DEFAULT_FORMATION];
}

/** Role required at a given slot for a formation. */
export function slotRole(formationId: string, slotIndex: number): Role {
  return getFormation(formationId).slots[slotIndex];
}

/** Nominal position at a given slot for a formation. */
export function slotPosition(formationId: string, slotIndex: number): Position {
  return getFormation(formationId).positions[slotIndex];
}

/** How many slots of each role a formation needs (handy for UI hints). */
export function roleCounts(formationId: string): Record<Role, number> {
  const counts: Record<Role, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const r of getFormation(formationId).slots) counts[r]++;
  return counts;
}
