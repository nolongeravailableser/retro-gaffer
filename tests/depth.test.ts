import { describe, it, expect } from 'vitest';
import { squadDepth } from '@/lib/depth';
import { overall } from '@/lib/wages';
import { POOL } from '@/data/pool';
import type { Player, Role } from '@/lib/types';

/** Grab n owned-shaped players of a given role from the pool. */
function ofRole(role: Role, n: number): Player[] {
  return POOL.filter((p) => p.role === role).slice(0, n);
}

// A 4-4-2 needs GK 1 / DEF 4 / MID 4 / FWD 2.
const F = '442';

describe('squadDepth', () => {
  it('flags a role short of fit players', () => {
    const players = [...ofRole('GK', 1), ...ofRole('DEF', 2), ...ofRole('MID', 4), ...ofRole('FWD', 2)];
    const def = squadDepth(players, new Set(), F).find((d) => d.role === 'DEF')!;
    expect(def.status).toBe('short'); // need 4, have 2
    expect(def.note).toMatch(/Short/);
  });

  it('flags a lone keeper as thin (no backup)', () => {
    const players = [...ofRole('GK', 1), ...ofRole('DEF', 4), ...ofRole('MID', 4), ...ofRole('FWD', 2)];
    const gk = squadDepth(players, new Set(), F).find((d) => d.role === 'GK')!;
    expect(gk.status).toBe('thin');
    expect(gk.note).toMatch(/backup keeper/i);
  });

  it('exactly enough outfielders = thin (no cover)', () => {
    const players = [...ofRole('GK', 2), ...ofRole('DEF', 4), ...ofRole('MID', 4), ...ofRole('FWD', 2)];
    const fwd = squadDepth(players, new Set(), F).find((d) => d.role === 'FWD')!;
    expect(fwd.status).toBe('thin');
    expect(fwd.note).toMatch(/No cover/);
  });

  it('a spare in the role reads ok', () => {
    const players = [...ofRole('GK', 2), ...ofRole('DEF', 4), ...ofRole('MID', 4), ...ofRole('FWD', 3)];
    const fwd = squadDepth(players, new Set(), F).find((d) => d.role === 'FWD')!;
    expect(fwd.status).toBe('ok');
    expect(fwd.note).toMatch(/reserve/);
  });

  it('counts unavailable players out of the fit tally', () => {
    const fwds = ofRole('FWD', 3);
    const players = [...ofRole('GK', 2), ...ofRole('DEF', 4), ...ofRole('MID', 4), ...fwds];
    const unavailable = new Set([fwds[0].id, fwds[1].id]); // 2 of 3 FWD out
    const fwd = squadDepth(players, unavailable, F).find((d) => d.role === 'FWD')!;
    expect(fwd.fieldable).toBe(1); // need 2
    expect(fwd.status).toBe('short');
  });

  it('players are sorted strongest first', () => {
    const mid = squadDepth(
      [...ofRole('MID', 5), ...ofRole('GK', 1), ...ofRole('DEF', 4), ...ofRole('FWD', 2)],
      new Set(),
      F
    ).find((d) => d.role === 'MID')!;
    const ovrs = mid.players.map(overall);
    for (let i = 1; i < ovrs.length; i++) expect(ovrs[i]).toBeLessThanOrEqual(ovrs[i - 1]);
  });
});
