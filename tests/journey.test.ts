import { describe, it, expect } from 'vitest';
import { journeyFor } from '@/lib/journey';
import type { Player, Role } from '@/lib/types';

function mk(id: string, role: Role): Player {
  return {
    id,
    name: id,
    era: '2010',
    cost: 3,
    stats: { attack: 50, defense: 50 },
    tags: [],
    role,
    rarity: 'silver',
  };
}

/** Exact 4-4-2 coverage: 1 GK, 4 DEF, 4 MID, 2 FWD. */
function legalSquad(): Player[] {
  return [
    mk('gk0', 'GK'),
    ...[0, 1, 2, 3].map((i) => mk(`def${i}`, 'DEF')),
    ...[0, 1, 2, 3].map((i) => mk(`mid${i}`, 'MID')),
    ...[0, 1].map((i) => mk(`fwd${i}`, 'FWD')),
  ];
}

describe('journeyFor', () => {
  it('empty squad → sign stage, every role missing', () => {
    const j = journeyFor([], '442', 0);
    expect(j.stage).toBe('sign');
    expect(j.missing).toEqual({ GK: 1, DEF: 4, MID: 4, FWD: 2 });
    expect(j.missingText).toBe('a GK · 4 DEF · 4 MID · 2 FWD');
  });

  it('partial coverage → sign stage listing only the gaps', () => {
    const squad = legalSquad().filter((p) => p.id !== 'gk0' && p.id !== 'fwd1');
    const j = journeyFor(squad, '442', 0);
    expect(j.stage).toBe('sign');
    expect(j.missing).toEqual({ GK: 1, FWD: 1 });
    expect(j.missingText).toBe('a GK · a FWD');
  });

  it('full role coverage but XI unfilled → pick stage', () => {
    const j = journeyFor(legalSquad(), '442', 7);
    expect(j.stage).toBe('pick');
    expect(j.missingText).toBe('');
  });

  it('XI filled → play stage', () => {
    expect(journeyFor(legalSquad(), '442', 11).stage).toBe('play');
  });

  it('gaps depend on the formation', () => {
    // 4-3-3 wants 3 FWD; a 4-4-2-shaped squad (2 FWD) is one striker short.
    const j = journeyFor(legalSquad(), '433', 0);
    expect(j.stage).toBe('sign');
    expect(j.missing).toEqual({ FWD: 1 });
  });

  it('extra depth beyond requirements does not block stages', () => {
    const squad = [...legalSquad(), mk('gk1', 'GK'), mk('mid9', 'MID')];
    expect(journeyFor(squad, '442', 11).stage).toBe('play');
  });
});
