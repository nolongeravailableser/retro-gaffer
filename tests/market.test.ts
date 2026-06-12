import { describe, it, expect } from 'vitest';
import {
  baseValue, marketValue, marketSellValue, marketTierMult, MARKET_SELL_RATE,
  transferFee, isFreeAgent, FREE_AGENT_MAX_OVERALL,
  rivalBids, OFFER_MIN_OVERALL, MAX_OFFERS_PER_WEEK, type BidderClub,
  aiClubSigning, type AiCandidate,
} from '@/lib/market';
import { overall } from '@/lib/wages';
import { TOP_TIER, BOTTOM_TIER } from '@/lib/league';
import type { Player, Role } from '@/lib/types';

function mk(role: Role, attack: number, defense: number): Player {
  return { id: `${role}-${attack}-${defense}`, name: 'p', cost: 4, stats: { attack, defense }, tags: [], role, rarity: 'gold' };
}

describe('market valuations', () => {
  it('baseValue is convex — stars cost disproportionately more than journeymen', () => {
    const low = baseValue(mk('MID', 50, 50));
    const mid = baseValue(mk('MID', 75, 75));
    const top = baseValue(mk('MID', 95, 95));
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(top);
    expect(top - mid).toBeGreaterThan(mid - low); // convex
    expect(low).toBeGreaterThanOrEqual(1);
  });

  it('division inflation: same player costs more the higher up the pyramid', () => {
    const star = mk('FWD', 92, 50);
    expect(marketTierMult(BOTTOM_TIER)).toBeCloseTo(1, 5);
    expect(marketValue(star, BOTTOM_TIER)).toBeLessThan(marketValue(star, TOP_TIER));
    // A star is genuinely expensive at the top (Premier League money).
    expect(marketValue(star, TOP_TIER)).toBeGreaterThan(marketValue(star, BOTTOM_TIER) * 2);
  });

  it('sell value is a haircut on market value', () => {
    const p = mk('DEF', 90, 95); // ensure not a free agent
    expect(isFreeAgent(p)).toBe(false);
    expect(marketSellValue(p, 3)).toBeLessThan(marketValue(p, 3));
    expect(marketSellValue(p, 3)).toBeCloseTo(Math.round(marketValue(p, 3) * MARKET_SELL_RATE), 0);
  });

  it('free agents (below the overall floor) cost nothing and have no resale', () => {
    const journeyman = mk('MID', 50, 50);
    expect(overall(journeyman)).toBeLessThan(FREE_AGENT_MAX_OVERALL);
    expect(isFreeAgent(journeyman)).toBe(true);
    expect(transferFee(journeyman, 5)).toBe(0);
    expect(transferFee(journeyman, 1)).toBe(0); // free in every division
    expect(marketSellValue(journeyman, 3)).toBe(0);

    const star = mk('FWD', 92, 55);
    expect(isFreeAgent(star)).toBe(false);
    expect(transferFee(star, 1)).toBe(marketValue(star, 1)); // quality costs full value
  });
});

describe('rivalBids — incoming offers for your players', () => {
  const clubs: BidderClub[] = [
    { id: 'ai0', name: 'Strong FC', strength: 1600, needsRoles: ['FWD'] },
    { id: 'ai1', name: 'Weak FC', strength: 400, needsRoles: ['DEF'] },
  ];

  it('only bids for your better players (≥ OFFER_MIN_OVERALL), never journeymen', () => {
    const star = mk('FWD', 95, 60); // well above the floor
    const journeyman = mk('MID', 50, 50);
    expect(overall(star)).toBeGreaterThanOrEqual(OFFER_MIN_OVERALL);
    const bids = rivalBids([star, journeyman], clubs, 3, 'seed-x');
    for (const b of bids) expect(b.playerId).toBe(star.id);
  });

  it('is deterministic and capped per week', () => {
    const squad = Array.from({ length: 6 }, (_, i) => mk('FWD', 90 + (i % 5), 55));
    const a = rivalBids(squad, clubs, 3, 'seed-y');
    const b = rivalBids(squad, clubs, 3, 'seed-y');
    expect(a).toEqual(b); // same seed → same bids
    expect(a.length).toBeLessThanOrEqual(MAX_OFFERS_PER_WEEK);
  });

  it('skips players who already have an open bid (exclude set)', () => {
    const star = mk('FWD', 95, 60);
    const bids = rivalBids([star], clubs, 3, 'seed-z', new Set([star.id]));
    expect(bids).toEqual([]);
  });

  it('biases the buyer toward a club needing that role', () => {
    // A defender: only Weak FC needs DEF, so it should win despite being weaker.
    const cb = mk('DEF', 90, 95);
    // Force a bid by trying many seeds; assert that whenever a bid lands, the
    // role-needing club is chosen (Strong FC doesn't need DEF here).
    let sawBid = false;
    for (let i = 0; i < 30; i++) {
      const bids = rivalBids([cb], clubs, 3, `role-${i}`);
      for (const b of bids) {
        sawBid = true;
        expect(b.clubId).toBe('ai1'); // Weak FC needs DEF
      }
    }
    expect(sawBid).toBe(true);
  });
});

describe('aiClubSigning — living market', () => {
  const bidders: BidderClub[] = [
    { id: 'ai0', name: 'Strong FC', strength: 1600, needsRoles: ['FWD'] },
    { id: 'ai1', name: 'Weak FC', strength: 400, needsRoles: ['FWD'] },
  ];
  const candidatesByRole: Record<string, AiCandidate[]> = {
    FWD: [{ id: 'star', name: 'Star', rating: 180 }, { id: 'sub', name: 'Sub', rating: 140 }],
  };

  it('is deterministic and signs the best candidate for a needed role', () => {
    // Find a seed that fires (chance is 0.3) and assert the shape.
    let fired = null;
    for (let i = 0; i < 50 && !fired; i++) fired = aiClubSigning(bidders, candidatesByRole, `s-${i}`);
    expect(fired).not.toBeNull();
    expect(fired!.playerId).toBe('star'); // best available for FWD
    expect(fired!.strengthGain).toBeGreaterThan(0);
    // Same seed → same result.
    const seed = (() => { for (let i = 0; i < 50; i++) if (aiClubSigning(bidders, candidatesByRole, `s-${i}`)) return `s-${i}`; })()!;
    expect(aiClubSigning(bidders, candidatesByRole, seed)).toEqual(aiClubSigning(bidders, candidatesByRole, seed));
  });

  it('a full (no-needs) club can still strengthen for depth', () => {
    const noNeed: BidderClub[] = [{ id: 'ai0', name: 'A', strength: 1000, needsRoles: [] }];
    let fired = null;
    for (let i = 0; i < 50 && !fired; i++) fired = aiClubSigning(noNeed, candidatesByRole, `n-${i}`);
    expect(fired).not.toBeNull(); // signs for depth even with no gap
    expect(fired!.playerId).toBe('star');
  });

  it('returns null when there are no candidates at all', () => {
    for (let i = 0; i < 30; i++) expect(aiClubSigning(bidders, { FWD: [] }, `e-${i}`)).toBeNull();
    for (let i = 0; i < 30; i++) expect(aiClubSigning(bidders, {}, `z-${i}`)).toBeNull();
  });
});
