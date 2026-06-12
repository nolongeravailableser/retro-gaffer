import { describe, it, expect } from 'vitest';
import {
  generateCup,
  cupTies,
  playerTie,
  tieWinner,
  resolveCupRound,
  roundName,
  CUP_SIZE,
} from '@/lib/cup';
import { YOU } from '@/lib/league';

describe('cup — bracket', () => {
  it('generates a deterministic 8-club, 3-round knockout including YOU', () => {
    const a = generateCup('seed-1', 1300);
    const b = generateCup('seed-1', 1300);
    expect(a).toEqual(b); // deterministic
    expect(a.clubs).toHaveLength(CUP_SIZE);
    expect(a.rounds).toBe(3);
    expect(a.alive).toHaveLength(CUP_SIZE);
    expect(a.alive).toContain(YOU);
    expect(a.round).toBe(1);
  });

  it('pairs adjacent survivors; the player has exactly one tie', () => {
    const cup = generateCup('seed-2', 1200);
    const ties = cupTies(cup);
    expect(ties).toHaveLength(CUP_SIZE / 2);
    const pt = playerTie(cup);
    expect(pt).not.toBeNull();
    expect(pt!.home === YOU || pt!.away === YOU).toBe(true);
  });

  it('decides ties on the score, with a seeded shootout when level', () => {
    expect(tieWinner('a', 'b', { home: 2, away: 1 }, 's')).toBe('a');
    expect(tieWinner('a', 'b', { home: 0, away: 3 }, 's')).toBe('b');
    const lvl = tieWinner('a', 'b', { home: 1, away: 1 }, 's');
    expect(['a', 'b']).toContain(lvl);
    expect(tieWinner('a', 'b', { home: 1, away: 1 }, 's')).toBe(lvl); // deterministic
  });

  it('advances the winners; the player goes through only if they win their tie', () => {
    const cup = generateCup('seed-3', 1250);
    const pt = playerTie(cup)!;
    const youHome = pt.home === YOU;
    // A win for YOU.
    const winRes = youHome ? { home: 3, away: 0 } : { home: 0, away: 3 };
    const won = resolveCupRound(cup, winRes, 'seed-3-cup');
    expect(won.playerThrough).toBe(true);
    expect(won.alive).toHaveLength(CUP_SIZE / 2); // field halves
    expect(won.alive).toContain(YOU);
    // A loss for YOU.
    const loseRes = youHome ? { home: 0, away: 2 } : { home: 2, away: 0 };
    const lost = resolveCupRound(cup, loseRes, 'seed-3-cup');
    expect(lost.playerThrough).toBe(false);
    expect(lost.alive).not.toContain(YOU);
  });

  it('names rounds from the final backwards', () => {
    expect(roundName(3, 3)).toBe('Final');
    expect(roundName(2, 3)).toBe('Semi-final');
    expect(roundName(1, 3)).toBe('Quarter-final');
  });
});
