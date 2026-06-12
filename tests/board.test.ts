import { describe, it, expect } from 'vitest';
import {
  boardConfidence,
  confidenceBand,
  confidenceLabel,
  boardExpectation,
  CONFIDENCE_NEUTRAL,
} from '@/lib/board';
import { TOP_TIER, BOTTOM_TIER } from '@/lib/league';

describe('board confidence', () => {
  it('rises with table position and form', () => {
    const top = boardConfidence(1, 12, { w: 8, d: 1, l: 1 });
    const bottom = boardConfidence(12, 12, { w: 1, d: 1, l: 8 });
    expect(top).toBeGreaterThan(bottom);
    expect(confidenceBand(top)).toBe('secure');
    expect(confidenceBand(bottom)).toBe('under-pressure');
  });

  it('sits at a neutral baseline before any games (table is just a tiebreak)', () => {
    // Even bottom of the alphabetical pre-season table reads as neutral, not a crisis.
    expect(boardConfidence(12, 12, { w: 0, d: 0, l: 0 })).toBe(CONFIDENCE_NEUTRAL);
    expect(confidenceBand(CONFIDENCE_NEUTRAL)).toBe('stable');
  });

  it('bands and labels map sensibly', () => {
    expect(confidenceBand(80)).toBe('secure');
    expect(confidenceBand(60)).toBe('stable');
    expect(confidenceBand(40)).toBe('shaky');
    expect(confidenceBand(10)).toBe('under-pressure');
    expect(confidenceLabel('under-pressure')).toMatch(/pressure/);
  });

  it('expectation scales with the pyramid tier', () => {
    expect(boardExpectation(TOP_TIER)).toMatch(/title|top/i);
    expect(boardExpectation(BOTTOM_TIER)).toMatch(/promotion/i);
    expect(typeof boardExpectation(Math.round((TOP_TIER + BOTTOM_TIER) / 2))).toBe('string');
  });
});
