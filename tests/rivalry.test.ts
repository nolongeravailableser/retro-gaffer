import { describe, it, expect } from 'vitest';
import { headToHead, rivalryLine } from '@/lib/rivalry';
import { fixtureKey, YOU } from '@/lib/league';
import type { LeagueState } from '@/lib/league';

/** Minimal league with two fixtures vs RIVAL (one each venue) + optional results. */
function league(results: Record<string, { home: number; away: number }>): LeagueState {
  const fixtures = [
    { matchweek: 1, home: YOU, away: 'RIVAL' },
    { matchweek: 12, home: 'RIVAL', away: YOU },
    { matchweek: 1, home: 'OTHER', away: 'RIVAL' }, // not your fixture — ignored
  ];
  return { clubs: [], fixtures, results, matchweek: 13 } as unknown as LeagueState;
}

describe('headToHead', () => {
  it('no meetings played yet → empty record', () => {
    const h = headToHead(league({}), 'RIVAL');
    expect(h.meetings).toHaveLength(0);
    expect(rivalryLine(h, 'Rival FC')).toBeNull();
  });

  it('counts a played meeting from your perspective (home win)', () => {
    const f = { matchweek: 1, home: YOU, away: 'RIVAL' };
    const h = headToHead(league({ [fixtureKey(f)]: { home: 2, away: 1 } }), 'RIVAL');
    expect(h.meetings).toHaveLength(1);
    expect(h.wins).toBe(1);
    expect(h.meetings[0]).toMatchObject({ youScored: 2, oppScored: 1, home: true });
  });

  it('reads your score correctly when you were away', () => {
    const f = { matchweek: 12, home: 'RIVAL', away: YOU };
    const h = headToHead(league({ [fixtureKey(f)]: { home: 3, away: 0 } }), 'RIVAL');
    expect(h.losses).toBe(1);
    expect(h.meetings[0]).toMatchObject({ youScored: 0, oppScored: 3, home: false });
  });

  it('rivalryLine frames revenge after a defeat', () => {
    const f = { matchweek: 1, home: YOU, away: 'RIVAL' };
    const h = headToHead(league({ [fixtureKey(f)]: { home: 0, away: 2 } }), 'RIVAL');
    expect(rivalryLine(h, 'Rival FC')).toMatch(/revenge\?/i);
  });

  it('rivalryLine celebrates a prior win', () => {
    const f = { matchweek: 1, home: YOU, away: 'RIVAL' };
    const h = headToHead(league({ [fixtureKey(f)]: { home: 3, away: 1 } }), 'RIVAL');
    expect(rivalryLine(h, 'Rival FC')).toMatch(/won the reverse fixture/i);
  });
});
