import { describe, it, expect } from 'vitest';
import { simulateMatch, expectedGoals, type MatchTeam } from '@/lib/engine';
import type { Player } from '@/lib/types';

function squad(prefix: string, n = 11): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}_${i}`,
    name: `${prefix}-${i}`,
    era: '2010',
    cost: 4,
    stats: { attack: 60, defense: 60 },
    tags: [],
    role: i < 2 ? 'FWD' : i < 6 ? 'MID' : i < 10 ? 'DEF' : 'GK',
    rarity: 'silver',
  }));
}

const teamA: MatchTeam = { name: 'A', attack: 700, defense: 650, squad: squad('a') };
const teamB: MatchTeam = { name: 'B', attack: 620, defense: 680, squad: squad('b') };

describe('expectedGoals', () => {
  it('is symmetric/half-scale for evenly matched sides', () => {
    expect(expectedGoals(600, 600)).toBeCloseTo(2.5);
  });
  it('rises with attack and falls with opposing defense', () => {
    expect(expectedGoals(800, 600)).toBeGreaterThan(expectedGoals(600, 600));
    expect(expectedGoals(600, 800)).toBeLessThan(expectedGoals(600, 600));
  });
  it('clamps to sane bounds', () => {
    expect(expectedGoals(100000, 1)).toBeLessThanOrEqual(4.5);
    expect(expectedGoals(0, 999)).toBeGreaterThanOrEqual(0.25);
  });
});

describe('simulateMatch determinism', () => {
  it('produces byte-identical results for the same seed', () => {
    const r1 = simulateMatch(teamA, teamB, 'GAFFER-seed-1');
    const r2 = simulateMatch(teamA, teamB, 'GAFFER-seed-1');
    expect(r1).toEqual(r2);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('different seeds generally diverge', () => {
    const seen = new Set<string>();
    for (let s = 0; s < 12; s++) {
      const r = simulateMatch(teamA, teamB, s);
      seen.add(`${r.score.a}-${r.score.b}-${r.events.length}`);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('simulateMatch invariants', () => {
  it('score equals the number of goal events per side', () => {
    for (let s = 0; s < 30; s++) {
      const r = simulateMatch(teamA, teamB, s);
      const goalsA = r.events.filter((e) => e.kind === 'goal' && e.side === 'A').length;
      const goalsB = r.events.filter((e) => e.kind === 'goal' && e.side === 'B').length;
      expect(r.score.a).toBe(goalsA);
      expect(r.score.b).toBe(goalsB);
    }
  });

  it('outcome agrees with the score (from A perspective)', () => {
    for (let s = 0; s < 30; s++) {
      const r = simulateMatch(teamA, teamB, s);
      const expected =
        r.score.a > r.score.b ? 'win' : r.score.a < r.score.b ? 'loss' : 'draw';
      expect(r.outcome).toBe(expected);
    }
  });

  it('events stay within minutes 0–90 and are ordered', () => {
    const r = simulateMatch(teamA, teamB, 5);
    let last = -1;
    for (const e of r.events) {
      expect(e.minute).toBeGreaterThanOrEqual(0);
      expect(e.minute).toBeLessThanOrEqual(90);
      expect(e.minute).toBeGreaterThanOrEqual(last);
      last = e.minute;
    }
    expect(r.events[0].text).toContain('underway');
    expect(r.events.at(-1)!.text).toContain('full-time');
  });

  it('the stronger side wins more often over many seeds', () => {
    const strong: MatchTeam = { name: 'S', attack: 950, defense: 900, squad: squad('s') };
    const weak: MatchTeam = { name: 'W', attack: 450, defense: 420, squad: squad('w') };
    let strongWins = 0;
    let weakWins = 0;
    for (let s = 0; s < 200; s++) {
      const r = simulateMatch(strong, weak, s);
      if (r.outcome === 'win') strongWins++;
      else if (r.outcome === 'loss') weakWins++;
    }
    expect(strongWins).toBeGreaterThan(weakWins);
  });
});
