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

  it('a maldistributed but full squad fields any formation out of position', () => {
    // A 4-4-2-shaped squad (4 MID, 2 FWD) can legally field a 4-3-3 — a midfielder
    // plays the third forward out of position (at a penalty). It is NOT a signing
    // problem, so the journey moves to pick/play, never "sign a FWD". Legality is
    // keeper-line based (1 GK + 10 outfielders), so it's formation-independent.
    expect(journeyFor(legalSquad(), '433', 0).stage).toBe('pick');
    expect(journeyFor(legalSquad(), '352', 0).stage).toBe('pick');
    expect(journeyFor(legalSquad(), '433', 11).stage).toBe('play');
  });

  it('only signs when a keeper line is genuinely short (not on maldistribution)', () => {
    // 1 GK + 9 outfielders (one short of eleven) → must sign an outfielder,
    // whatever the distribution. The hint points at the most-deficient role.
    const nineOutfield = [
      mk('gk0', 'GK'),
      ...[0, 1, 2, 3, 4].map((i) => mk(`def${i}`, 'DEF')),
      ...[0, 1, 2, 3].map((i) => mk(`mid${i}`, 'MID')),
    ];
    const j = journeyFor(nineOutfield, '442', 0);
    expect(j.stage).toBe('sign');
    expect(Object.values(j.missing).reduce((a, b) => a + (b ?? 0), 0)).toBe(1);
    // No keeper at all → sign a GK regardless of outfield depth.
    expect(journeyFor(legalSquad().filter((p) => p.role !== 'GK'), '442', 0).missing.GK).toBe(1);
  });

  it('extra depth beyond requirements does not block stages', () => {
    const squad = [...legalSquad(), mk('gk1', 'GK'), mk('mid9', 'MID')];
    expect(journeyFor(squad, '442', 11).stage).toBe('play');
  });
});
