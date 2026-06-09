import { describe, it, expect } from 'vitest';
import {
  roundTargetStrength,
  interest,
  streakBonus,
  roundPayout,
  buildRoundOpponent,
  ladderTier,
  wageBill,
  maxWager,
  lifeBuybackCost,
  MAX_ROUNDS,
} from '@/lib/ladder';
import { getBoss, isBoss } from '@/lib/bosses';

describe('ladder economy', () => {
  it('interest is +1 per 8 banked, capped at 8', () => {
    expect(interest(0)).toBe(0);
    expect(interest(7)).toBe(0);
    expect(interest(24)).toBe(3);
    expect(interest(200)).toBe(8); // capped
  });

  it('streak bonus caps at 6', () => {
    expect(streakBonus(0)).toBe(0);
    expect(streakBonus(4)).toBe(4);
    expect(streakBonus(20)).toBe(6);
  });

  it('roundPayout sums reward + income + interest + streak (win)', () => {
    const p = roundPayout('win', 24, 5, 4);
    expect(p.interest).toBe(3); // 24 → 3
    expect(p.streak).toBe(4);
    expect(p.total).toBe(5 + 3 + 3 + 4);
  });

  it('a loss earns no streak bonus', () => {
    const p = roundPayout('loss', 40, 0, 0);
    expect(p.streak).toBe(0);
    expect(p.total).toBe(0 + 3 + 5 + 0); // 40 → interest 5
  });

  it('wage bill taxes a bloated squad only', () => {
    expect(wageBill(11)).toBe(0);
    expect(wageBill(13)).toBe(0);
    expect(wageBill(16)).toBe(3);
  });

  it('max wager is half the bankroll', () => {
    expect(maxWager(0)).toBe(0);
    expect(maxWager(15)).toBe(7);
    expect(maxWager(40)).toBe(20);
  });

  it('life buy-back cost escalates £8 → £16 → £24', () => {
    expect(lifeBuybackCost(0)).toBe(8);
    expect(lifeBuybackCost(1)).toBe(16);
    expect(lifeBuybackCost(2)).toBe(24);
  });
});

describe('difficulty curve + tiers', () => {
  it('the absolute target rises across normal rounds', () => {
    expect(roundTargetStrength(1)).toBeLessThan(roundTargetStrength(7));
    expect(roundTargetStrength(7)).toBeLessThan(roundTargetStrength(11));
  });
  it('names every round up to the final', () => {
    for (let r = 1; r <= MAX_ROUNDS; r++) {
      expect(typeof ladderTier(r)).toBe('string');
      expect(ladderTier(r).length).toBeGreaterThan(0);
    }
  });
});

describe('round opponent (absolute, anti-rubber-band)', () => {
  it('is deterministic for a run seed + round', () => {
    const a = buildRoundOpponent(700, 650, 5, 'run-1');
    const b = buildRoundOpponent(700, 650, 5, 'run-1');
    expect(a).toEqual(b);
  });

  it('gets stronger in later normal rounds', () => {
    const early = buildRoundOpponent(700, 650, 5, 'run-1');
    const late = buildRoundOpponent(700, 650, 11, 'run-1');
    expect(late.attack + late.defense).toBeGreaterThan(early.attack + early.defense);
  });

  it('stays mostly absolute: a 5x stronger player faces only ~+10% tougher', () => {
    const weak = buildRoundOpponent(150, 150, 5, 'run-1');
    const strong = buildRoundOpponent(800, 800, 5, 'run-1');
    const ratio = (strong.attack + strong.defense) / (weak.attack + weak.defense);
    expect(ratio).toBeLessThanOrEqual(1.25); // not a 5x rubber-band
  });

  it('fields a full XI for commentary', () => {
    expect(buildRoundOpponent(700, 650, 3, 'run-1').squad.length).toBe(11);
  });
});

describe('boss rounds', () => {
  it('flags 4, 8 and 12 as bosses', () => {
    expect(isBoss(4)).toBe(true);
    expect(isBoss(8)).toBe(true);
    expect(isBoss(12)).toBe(true);
    expect(isBoss(5)).toBe(false);
  });

  it('returns the fixed boss team on a boss round, ignoring player strength', () => {
    const a = buildRoundOpponent(50, 50, 12, 'run-1');
    const b = buildRoundOpponent(2000, 2000, 12, 'run-1');
    expect(a.name).toBe(getBoss(12)!.name);
    expect(a.attack).toBe(getBoss(12)!.attack);
    expect(b.attack).toBe(getBoss(12)!.attack); // same regardless of player
    expect(a.squad.length).toBe(11);
  });

  it('the final boss is sudden-death and costs 2 lives', () => {
    const final = getBoss(12)!;
    expect(final.suddenDeath).toBe(true);
    expect(final.lifeCost).toBe(2);
  });
});
