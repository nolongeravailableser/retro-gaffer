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
    expect(expectedGoals(600, 600)).toBeCloseTo(1.25);
  });
  it('rises with attack and falls with opposing defense', () => {
    expect(expectedGoals(800, 600)).toBeGreaterThan(expectedGoals(600, 600));
    expect(expectedGoals(600, 800)).toBeLessThan(expectedGoals(600, 600));
  });
  it('clamps to sane bounds', () => {
    expect(expectedGoals(100000, 1)).toBeLessThanOrEqual(2.5);
    expect(expectedGoals(0, 999)).toBeGreaterThanOrEqual(0.15);
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

  it('result always contains suspensions and injuries arrays', () => {
    for (let s = 0; s < 20; s++) {
      const r = simulateMatch(teamA, teamB, s);
      expect(Array.isArray(r.suspensions)).toBe(true);
      expect(Array.isArray(r.injuries)).toBe(true);
    }
  });

  it('suspensions contain only player IDs from side A squad', () => {
    const aIds = new Set(teamA.squad.map((p) => p.id));
    for (let s = 0; s < 50; s++) {
      const r = simulateMatch(teamA, teamB, s);
      for (const id of r.suspensions) {
        expect(aIds.has(id)).toBe(true);
      }
      expect(r.suspensions.length).toBeLessThanOrEqual(1);
    }
  });

  it('injury rounds are between 1 and 3', () => {
    for (let s = 0; s < 50; s++) {
      const r = simulateMatch(teamA, teamB, s);
      for (const inj of r.injuries) {
        expect(inj.rounds).toBeGreaterThanOrEqual(1);
        expect(inj.rounds).toBeLessThanOrEqual(3);
      }
      expect(r.injuries.length).toBeLessThanOrEqual(1);
    }
  });

  it('opponents (side B) can also pick up reds/injuries, but they never persist', () => {
    let sideBDiscipline = 0;
    const aIds = new Set(teamA.squad.map((p) => p.id));
    for (let s = 0; s < 200; s++) {
      const r = simulateMatch(teamA, teamB, s);
      sideBDiscipline += r.events.filter(
        (e) => e.side === 'B' && (e.kind === 'red' || e.kind === 'injury')
      ).length;
      // Returned suspensions/injuries are still the player's (side A) only.
      for (const id of r.suspensions) expect(aIds.has(id)).toBe(true);
      for (const inj of r.injuries) expect(aIds.has(inj.playerId)).toBe(true);
    }
    expect(sideBDiscipline).toBeGreaterThan(0);
  });

  it('goals carry a scorer id; some goals are assisted, never by the scorer', () => {
    const aIds = new Set(teamA.squad.map((p) => p.id));
    let assisted = 0;
    let goals = 0;
    for (let s = 0; s < 200; s++) {
      const r = simulateMatch(teamA, teamB, s);
      for (const e of r.events.filter((e) => e.kind === 'goal' && e.side === 'A')) {
        goals++;
        expect(e.playerId && aIds.has(e.playerId)).toBe(true);
        if (e.assistId) {
          assisted++;
          expect(aIds.has(e.assistId)).toBe(true);
          expect(e.assistId).not.toBe(e.playerId); // can't assist your own goal
        }
      }
    }
    expect(goals).toBeGreaterThan(0);
    expect(assisted).toBeGreaterThan(0); // assists do happen
    expect(assisted).toBeLessThan(goals); // but not every goal (some are solo)
  });

  it('cards and injuries carry the involved player id', () => {
    for (let s = 0; s < 80; s++) {
      const r = simulateMatch(teamA, teamB, s);
      for (const e of r.events.filter((e) => ['yellow', 'red', 'injury'].includes(e.kind))) {
        expect(typeof e.playerId).toBe('string');
      }
    }
  });

  it('discipline/injury events occur at a realistic frequency over many games', () => {
    let reds = 0;
    let yellows = 0;
    let injuries = 0;
    const N = 500;
    for (let s = 0; s < N; s++) {
      const r = simulateMatch(teamA, teamB, s);
      reds += r.suspensions.length;
      injuries += r.injuries.length;
      yellows += r.events.filter((e) => e.kind === 'yellow').length;
    }
    // ~0.3–0.6 reds per game
    expect(reds / N).toBeGreaterThan(0.1);
    expect(reds / N).toBeLessThan(1.0);
    // ~1.5–3 yellows per game
    expect(yellows / N).toBeGreaterThan(0.5);
    expect(yellows / N).toBeLessThan(5.0);
    // ~0.2–0.7 injuries per game
    expect(injuries / N).toBeGreaterThan(0.1);
    expect(injuries / N).toBeLessThan(1.0);
  });
});
