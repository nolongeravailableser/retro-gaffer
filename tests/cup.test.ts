import { describe, it, expect } from 'vitest';
import {
  generateCup,
  cupTies,
  playerTie,
  tieWinner,
  resolveCupRound,
  roundName,
  careerCupDue,
  cupChampion,
  CAREER_CUP_ROUND_WEEKS,
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

describe('cup — career interleave', () => {
  it('a tie is due only once its round-week arrives (and the player is still in)', () => {
    const cup = generateCup('seed-c', 1250); // round 1, player alive
    const [qf, sf] = CAREER_CUP_ROUND_WEEKS;
    expect(careerCupDue(cup, qf - 1)).toBe(false); // before the QF week
    expect(careerCupDue(cup, qf)).toBe(true); // QF week arrives
    expect(careerCupDue(cup, sf)).toBe(true); // a late entry still due

    // Win the QF → round 2; not due again until the SF week.
    const pt = playerTie(cup)!;
    const win = pt.home === YOU ? { home: 2, away: 0 } : { home: 0, away: 2 };
    const r = resolveCupRound(cup, win, 'seed-c-cup');
    const cup2 = { ...cup, alive: r.alive, results: r.results, round: 2 };
    expect(careerCupDue(cup2, qf)).toBe(false); // QF week, but round 2 isn't due yet
    expect(careerCupDue(cup2, sf)).toBe(true); // SF week
  });

  it('an eliminated player has no further ties; the champion is the sole survivor', () => {
    const cup = generateCup('seed-d', 1250);
    const pt = playerTie(cup)!;
    const loss = pt.home === YOU ? { home: 0, away: 2 } : { home: 2, away: 0 };
    const r = resolveCupRound(cup, loss, 'seed-d-cup');
    const out = { ...cup, alive: r.alive, results: r.results, round: 1 }; // frozen on KO
    expect(careerCupDue(out, CAREER_CUP_ROUND_WEEKS[1])).toBe(false); // no tie → never due
    expect(cupChampion(out)).toBe(false);

    // Player as sole survivor past the final → champion.
    const lifted = { ...cup, alive: [YOU], round: cup.rounds + 1 };
    expect(cupChampion(lifted)).toBe(true);
    expect(careerCupDue(lifted, 99)).toBe(false); // cup concluded
  });
});
