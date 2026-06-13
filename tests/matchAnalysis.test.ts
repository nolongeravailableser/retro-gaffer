import { describe, it, expect } from 'vitest';
import { analyzeMatch } from '@/lib/matchAnalysis';
import { POOL } from '@/data/pool';
import type { MatchEvent, MatchResult } from '@/lib/types';

const teamA = { name: 'You', squad: POOL.slice(0, 11) };
const teamB = { name: 'Them', squad: POOL.slice(11, 22) };

function res(
  outcome: 'win' | 'draw' | 'loss',
  gA: number, gB: number, xgA: number, xgB: number,
  events: MatchEvent[] = []
): MatchResult {
  return { events, score: { a: gA, b: gB }, xg: { a: xgA, b: xgB }, outcome, suspensions: [], injuries: [] };
}

describe('analyzeMatch — plain-English causation', () => {
  it('outplayed loss: out-created → "Outplayed" + bad chance factor', () => {
    const a = analyzeMatch(res('loss', 0, 2, 0.6, 2.4), teamA, teamB);
    expect(a.headline).toMatch(/Outplayed/);
    expect(a.factors[0].tone).toBe('bad');
    expect(a.factors[0].text).toMatch(/better chances/);
    // names the defensive dimension as the cause
    expect(a.factors.some((f) => /pulled your defence/.test(f.text))).toBe(true);
  });

  it('wasteful loss: out-created them but lost → "Wasteful" + finishing factor', () => {
    const a = analyzeMatch(res('loss', 0, 1, 2.2, 0.7), teamA, teamB);
    expect(a.headline).toMatch(/Wasteful/);
    expect(a.factors[0].tone).toBe('good'); // you created more
    expect(a.factors.some((f) => /Wasteful in front of goal/.test(f.text))).toBe(true);
  });

  it('deserved win: dominant xG → "Deserved win"', () => {
    const a = analyzeMatch(res('win', 3, 0, 2.6, 0.5), teamA, teamB);
    expect(a.headline).toMatch(/Deserved win/);
    expect(a.factors[0].tone).toBe('good');
  });

  it('smash and grab: won despite fewer chances', () => {
    const a = analyzeMatch(res('win', 1, 0, 0.6, 2.0), teamA, teamB);
    expect(a.headline).toMatch(/Smash and grab/);
    expect(a.factors.some((f) => /Resolute defending|Clinical finishing/.test(f.text))).toBe(true);
  });

  it('even draw → "Honours even"', () => {
    const a = analyzeMatch(res('draw', 1, 1, 1.2, 1.1), teamA, teamB);
    expect(a.headline).toMatch(/Honours even/);
    expect(a.factors[0].tone).toBe('neutral');
  });

  it('red card shows as a man-down factor', () => {
    const reds: MatchEvent[] = [{ minute: 40, side: 'A', kind: 'red', text: 'sent off' }];
    const a = analyzeMatch(res('loss', 0, 2, 0.5, 2.2, reds), teamA, teamB);
    expect(a.factors.some((f) => /Down to 10 men/.test(f.text))).toBe(true);
  });

  it('caps factors at 4 and is deterministic', () => {
    const args = () => analyzeMatch(res('loss', 0, 3, 0.4, 2.8,
      [{ minute: 30, side: 'A', kind: 'red', text: '' }]), teamA, teamB);
    const a = args();
    expect(a.factors.length).toBeGreaterThanOrEqual(1);
    expect(a.factors.length).toBeLessThanOrEqual(4);
    expect(args()).toEqual(a); // same inputs → same verdict
  });
});
