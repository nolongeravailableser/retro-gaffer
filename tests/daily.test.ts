import { describe, it, expect } from 'vitest';
import { dailyKey, dailySeed, formatRunResult } from '@/lib/daily';

describe('daily seed', () => {
  it('keys a date as YYYY-MM-DD (local)', () => {
    expect(dailyKey(new Date(2026, 5, 9))).toBe('2026-06-09');
    expect(dailyKey(new Date(2025, 0, 1))).toBe('2025-01-01');
  });

  it('is deterministic per day and differs across days', () => {
    expect(dailySeed('2026-06-09')).toBe(dailySeed('2026-06-09'));
    expect(dailySeed('2026-06-09')).not.toBe(dailySeed('2026-06-10'));
  });
});

describe('formatRunResult', () => {
  it('summarises a won daily run', () => {
    const s = formatRunResult({
      daily: '2026-06-09',
      status: 'won',
      round: 12,
      record: { w: 9, d: 2, l: 1 },
      peakBankroll: 52,
      bestStreak: 6,
    });
    expect(s).toContain('Daily 2026-06-09');
    expect(s).toContain('CHAMPIONS');
    expect(s).toContain('9W-2D-1L');
    expect(s).toContain('£52M');
  });

  it('summarises a lost casual run with the division reached', () => {
    const s = formatRunResult({
      daily: null,
      status: 'lost',
      round: 5,
      record: { w: 3, d: 1, l: 3 },
      peakBankroll: 30,
      bestStreak: 2,
    });
    expect(s).not.toContain('Daily');
    expect(s).toMatch(/Reached .+ \(Round 5\)/);
  });
});
