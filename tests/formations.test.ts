import { describe, it, expect } from 'vitest';
import { FORMATIONS, FORMATION_IDS, getFormation, slotRole, slotPosition } from '@/lib/formations';
import { POSITION_TO_ROLE } from '@/lib/positions';

describe('formations', () => {
  it('every formation has 11 slots with rows covering each index once', () => {
    for (const id of FORMATION_IDS) {
      const f = FORMATIONS[id];
      expect(f.positions).toHaveLength(11);
      expect(f.slots).toHaveLength(11);
      const idxs = f.rows.flat().sort((a, b) => a - b);
      expect(idxs).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(f.positions[0]).toBe('Goalkeeper'); // slot 0 is always the keeper
    }
  });

  it('coarse role is always derived from the slot position', () => {
    for (const id of FORMATION_IDS) {
      const f = FORMATIONS[id];
      f.positions.forEach((pos, i) => {
        expect(f.slots[i]).toBe(POSITION_TO_ROLE[pos]);
        expect(slotRole(id, i)).toBe(POSITION_TO_ROLE[slotPosition(id, i)]);
      });
    }
  });

  it('the original four keep their exact per-index coarse roles (save-safe)', () => {
    // These role arrays are what pre-4.1 saves were built against.
    const legacy: Record<string, string[]> = {
      '442': ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD'],
      '433': ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD'],
      '352': ['GK', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD'],
      '4231': ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD'],
    };
    for (const [id, roles] of Object.entries(legacy)) {
      expect(getFormation(id).slots).toEqual(roles);
    }
  });

  it('added four new formations (8 total)', () => {
    expect(FORMATION_IDS).toEqual(['442', '433', '352', '4231', '343', '532', '4141', '4132']);
  });
});
