import { describe, it, expect } from 'vitest';
import { seasonNarrative, type NarrativeCtx } from '@/lib/narrative';

const base: NarrativeCtx = {
  tier: 1, matchweek: 22, totalWeeks: 22, clubs: 12,
  yourPos: 6, yourPoints: 30, leaderPoints: 45, promoCutoffPoints: 38, dropLinePoints: 18,
};

describe('seasonNarrative', () => {
  it('stays silent early in the season', () => {
    expect(seasonNarrative({ ...base, matchweek: 5 })).toBeNull();
  });

  it('top of the top flight in the run-in → title story', () => {
    const s = seasonNarrative({ ...base, matchweek: 20, yourPos: 1 });
    expect(s?.tone).toBe('title');
    expect(s?.headline).toMatch(/Top of the table/);
  });

  it('final day leading the table → win-the-title', () => {
    const s = seasonNarrative({ ...base, matchweek: 22, yourPos: 1 });
    expect(s?.tone).toBe('title');
    expect(s?.headline).toMatch(/title is yours/);
  });

  it('chasing within reach → in the title race', () => {
    const s = seasonNarrative({ ...base, matchweek: 21, yourPos: 2, yourPoints: 43, leaderPoints: 45 });
    expect(s?.tone).toBe('title');
    expect(s?.headline).toMatch(/title race/);
  });

  it('promotion places in a lower tier', () => {
    const s = seasonNarrative({ ...base, tier: 3, matchweek: 20, yourPos: 2 });
    expect(s?.tone).toBe('promotion');
  });

  it('in the drop zone → survival', () => {
    const s = seasonNarrative({ ...base, tier: 3, matchweek: 20, yourPos: 11, yourPoints: 16, dropLinePoints: 16 });
    expect(s?.tone).toBe('survival');
    expect(s?.headline).toMatch(/Fighting the drop/);
  });

  it('final-day survival reads as Survival Sunday', () => {
    const s = seasonNarrative({ ...base, tier: 3, matchweek: 22, yourPos: 12, yourPoints: 14, dropLinePoints: 14 });
    expect(s?.headline).toMatch(/Survival Sunday/);
  });

  it('mid-table with nothing on it → null (no manufactured drama)', () => {
    // 6th of 12, comfortably clear of both ends, 3 games left.
    const s = seasonNarrative({ ...base, tier: 1, matchweek: 20, yourPos: 6, yourPoints: 30, leaderPoints: 55, dropLinePoints: 12 });
    expect(s).toBeNull();
  });

  it('standalone league (tier null) still frames a title run-in', () => {
    const s = seasonNarrative({ ...base, tier: null, matchweek: 11, totalWeeks: 11, yourPos: 1 });
    expect(s?.tone).toBe('title');
  });
});
