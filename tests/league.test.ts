import { describe, it, expect } from 'vitest';
import {
  generateLeague,
  roundRobin,
  table,
  simAiResult,
  simAiWeek,
  playerFixture,
  position,
  totalWeeks,
  fixtureKey,
  YOU,
  seasonOutcome,
  nextTier,
  TOP_TIER,
  BOTTOM_TIER,
  type LeagueState,
} from '@/lib/league';

describe('roundRobin', () => {
  it('schedules a single round-robin: n-1 weeks, every pair once', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `t${i}`);
    const fx = roundRobin(ids);
    expect(new Set(fx.map((f) => f.matchweek)).size).toBe(11); // 12 teams → 11 weeks
    expect(fx).toHaveLength((12 * 11) / 2); // 66 fixtures
    // every unordered pair appears exactly once
    const pairs = new Set(fx.map((f) => [f.home, f.away].sort().join('|')));
    expect(pairs.size).toBe(66);
    // each week has 6 fixtures and no team plays twice in a week
    for (let w = 1; w <= 11; w++) {
      const wk = fx.filter((f) => f.matchweek === w);
      expect(wk).toHaveLength(6);
      const teams = wk.flatMap((f) => [f.home, f.away]);
      expect(new Set(teams).size).toBe(12);
    }
  });
});

describe('generateLeague', () => {
  it('is deterministic and includes the player + 11 AI clubs', () => {
    const a = generateLeague('seed-1', 1400);
    const b = generateLeague('seed-1', 1400);
    expect(a).toEqual(b);
    expect(a.clubs).toHaveLength(12);
    expect(a.clubs[0].id).toBe(YOU);
    expect(a.clubs.filter((c) => c.id !== YOU)).toHaveLength(11);
    expect(totalWeeks(a)).toBe(11);
    // the player has exactly one fixture each week
    for (let w = 1; w <= 11; w++) expect(playerFixture(a, w)).not.toBeNull();
  });
});

describe('simAiResult / simAiWeek', () => {
  it('is deterministic and yields non-negative integer scores', () => {
    const r1 = simAiResult(1400, 1200, 'x');
    const r2 = simAiResult(1400, 1200, 'x');
    expect(r1).toEqual(r2);
    expect(Number.isInteger(r1.home)).toBe(true);
    expect(r1.home).toBeGreaterThanOrEqual(0);
    expect(r1.away).toBeGreaterThanOrEqual(0);
  });

  it('simAiWeek resolves only non-player fixtures', () => {
    const st = generateLeague('seed-2', 1400);
    const got = simAiWeek(st, 1, 'seed-2');
    const pf = playerFixture(st, 1)!;
    expect(got[fixtureKey(pf)]).toBeUndefined(); // player's own fixture not auto-resolved
    // 6 fixtures/week, minus the player's one = 5 AI results
    expect(Object.keys(got)).toHaveLength(5);
  });
});

describe('pyramid (Career divisions)', () => {
  const N = 12;
  it('top tier: 1st = champion, drop zone relegated, else stay', () => {
    expect(seasonOutcome(TOP_TIER, 1, N)).toBe('champion');
    expect(seasonOutcome(TOP_TIER, 5, N)).toBe('stay');
    expect(seasonOutcome(TOP_TIER, 12, N)).toBe('relegated'); // bottom 3 (10,11,12)
    expect(nextTier(TOP_TIER, 'champion')).toBe(TOP_TIER); // can't go higher
    expect(nextTier(TOP_TIER, 'relegated')).toBe(TOP_TIER + 1);
  });

  it('mid tier: top 3 promoted, bottom 3 relegated, else stay', () => {
    const mid = 3;
    expect(seasonOutcome(mid, 1, N)).toBe('promoted');
    expect(seasonOutcome(mid, 3, N)).toBe('promoted');
    expect(seasonOutcome(mid, 4, N)).toBe('stay');
    expect(seasonOutcome(mid, 12, N)).toBe('relegated');
    expect(nextTier(mid, 'promoted')).toBe(mid - 1);
    expect(nextTier(mid, 'relegated')).toBe(mid + 1);
    expect(nextTier(mid, 'stay')).toBe(mid);
  });

  it('bottom tier: the drop zone means the sack (nowhere lower)', () => {
    expect(seasonOutcome(BOTTOM_TIER, 12, N)).toBe('sacked');
    expect(seasonOutcome(BOTTOM_TIER, 2, N)).toBe('promoted');
    expect(seasonOutcome(BOTTOM_TIER, 6, N)).toBe('stay');
  });
});

describe('table', () => {
  it('awards 3/1/0 and sorts by points then GD', () => {
    const st: LeagueState = {
      clubs: [
        { id: YOU, name: 'You', strength: 1000 },
        { id: 'a', name: 'A', strength: 1000 },
        { id: 'b', name: 'B', strength: 1000 },
        { id: 'c', name: 'C', strength: 1000 },
      ],
      fixtures: [
        { matchweek: 1, home: YOU, away: 'a' },
        { matchweek: 1, home: 'b', away: 'c' },
      ],
      results: {
        '1-YOU-a': { home: 3, away: 0 }, // YOU win big
        '1-b-c': { home: 1, away: 1 }, // draw
      },
      matchweek: 2,
    };
    const t = table(st);
    expect(t[0].teamId).toBe(YOU); // 3 pts, +3 GD → top
    expect(t[0].points).toBe(3);
    expect(t[0].gd).toBe(3);
    expect(t.find((r) => r.teamId === 'a')!.points).toBe(0);
    expect(t.find((r) => r.teamId === 'b')!.points).toBe(1);
    expect(position(st, YOU)).toBe(1);
  });
});
