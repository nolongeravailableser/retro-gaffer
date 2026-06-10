import { describe, it, expect } from 'vitest';
import {
  simulateMatch,
  simulateSegment,
  freshCarry,
  applyInjuryPenalty,
  finalizeResult,
  kickoffEvent,
  halfTimeEvent,
  fullTimeEvent,
  DEFAULT_TUNING,
  type MatchTeam,
} from '@/lib/engine';
import { TEAM_TALKS, applyTalk } from '@/lib/teamtalk';
import type { Player, Role } from '@/lib/types';

function squad(prefix: string): Player[] {
  return Array.from({ length: 11 }, (_, i) => ({
    id: `${prefix}_${i}`,
    name: `${prefix}-${i}`,
    era: '2010',
    cost: 4,
    stats: { attack: 60, defense: 60 },
    tags: [],
    role: (i < 2 ? 'FWD' : i < 6 ? 'MID' : i < 10 ? 'DEF' : 'GK') as Role,
    rarity: 'silver' as const,
  }));
}

const teamA: MatchTeam = { name: 'A', attack: 700, defense: 650, squad: squad('a') };
const teamB: MatchTeam = { name: 'B', attack: 620, defense: 680, squad: squad('b') };

describe('segmented simulation', () => {
  it('two uninterrupted half segments reproduce simulateMatch exactly', () => {
    for (let s = 0; s < 10; s++) {
      const seed = `parity-${s}`;
      const whole = simulateMatch(teamA, teamB, seed);
      const h1 = simulateSegment(teamA, teamB, seed, DEFAULT_TUNING, 1, 45, freshCarry());
      const h2 = simulateSegment(teamA, teamB, seed, DEFAULT_TUNING, 46, 90, h1.carry);
      const assembled = finalizeResult(
        [kickoffEvent(), ...h1.events, halfTimeEvent(), ...h2.events, fullTimeEvent()],
        h2.carry,
        { a: h1.xg.a + h2.xg.a, b: h1.xg.b + h2.xg.b }
      );
      expect(assembled).toEqual(whole);
    }
  });

  it('segments are deterministic and carry yellow cards across the break', () => {
    const one = simulateSegment(teamA, teamB, 'det', DEFAULT_TUNING, 1, 45, freshCarry());
    const two = simulateSegment(teamA, teamB, 'det', DEFAULT_TUNING, 1, 45, freshCarry());
    expect(one).toEqual(two);
    // Whatever yellows happened in H1 are visible to H2 via the carry.
    const h2 = simulateSegment(teamA, teamB, 'det', DEFAULT_TUNING, 46, 90, one.carry);
    expect(h2.carry.yellowedA.length).toBeGreaterThanOrEqual(one.carry.yellowedA.length);
  });

  it('pauseOnInjury stops the segment at the injury with no penalty applied', () => {
    // Scan seeds for a first-half injury.
    for (let s = 0; s < 200; s++) {
      const seg = simulateSegment(teamA, teamB, `inj-${s}`, DEFAULT_TUNING, 1, 45, freshCarry(), true);
      if (seg.stop !== 'injury') continue;
      const last = seg.events.at(-1)!;
      expect(last.kind).toBe('injury');
      expect(seg.carry.injuredId).toBeTruthy();
      expect(seg.nextMinute).toBe(last.minute + 1);
      // No injury penalty yet — the caller decides. (Reds also move aMult, so
      // assert against a red-free pause only.)
      if (!seg.carry.redPlayerId && !seg.carry.oppRed && !seg.carry.oppInjured) {
        expect(seg.carry.aMult).toBe(1);
      }
      // Play-on path applies the penalty explicitly.
      const penalised = applyInjuryPenalty(seg.carry);
      expect(penalised.aMult).toBeLessThan(seg.carry.aMult);
      // The match resumes from the pause and runs to half-time legally.
      const rest = simulateSegment(teamA, teamB, `inj-${s}`, DEFAULT_TUNING, seg.nextMinute, 45, penalised);
      for (const e of rest.events) {
        expect(e.minute).toBeGreaterThanOrEqual(seg.nextMinute);
        expect(e.minute).toBeLessThanOrEqual(45);
      }
      return; // one verified pause is enough
    }
    throw new Error('no injury found in 200 seeds — pInjury regression?');
  });

  it('score always equals the goal events across paused/resumed play', () => {
    for (let s = 0; s < 30; s++) {
      let carry = freshCarry();
      const events = [kickoffEvent()];
      let next = 1;
      // Interactive-style loop: pause on injuries, never substitute.
      while (next <= 90) {
        if (next === 46) events.push(halfTimeEvent());
        const to = next <= 45 ? 45 : 90;
        const seg = simulateSegment(teamA, teamB, `loop-${s}`, DEFAULT_TUNING, next, to, carry, true);
        events.push(...seg.events);
        carry = seg.stop === 'injury' ? applyInjuryPenalty(seg.carry) : seg.carry;
        next = seg.nextMinute;
      }
      events.push(fullTimeEvent());
      const result = finalizeResult(events, carry, { a: 1, b: 1 });
      const goalsA = events.filter((e) => e.kind === 'goal' && e.side === 'A').length;
      const goalsB = events.filter((e) => e.kind === 'goal' && e.side === 'B').length;
      expect(result.score).toEqual({ a: goalsA, b: goalsB });
      // Events remain minute-ordered through every pause.
      let lastMinute = -1;
      for (const e of events) {
        expect(e.minute).toBeGreaterThanOrEqual(lastMinute === 45 && e.minute === 45 ? 45 : 0);
        if (e.minute < lastMinute) throw new Error('events out of order');
        lastMinute = e.minute;
      }
    }
  });
});

describe('team talks', () => {
  it('apply bounded multipliers (steady is identity)', () => {
    const attack = TEAM_TALKS.find((t) => t.id === 'attack')!;
    const steady = TEAM_TALKS.find((t) => t.id === 'steady')!;
    const park = TEAM_TALKS.find((t) => t.id === 'park')!;
    expect(applyTalk(teamA, steady)).toEqual(teamA);
    const aggro = applyTalk(teamA, attack);
    expect(aggro.attack).toBeGreaterThan(teamA.attack);
    expect(aggro.defense).toBeLessThan(teamA.defense);
    const bus = applyTalk(teamA, park);
    expect(bus.defense).toBeGreaterThan(teamA.defense);
    expect(bus.attack).toBeLessThan(teamA.attack);
  });

  it('all-out attack produces more second-half goals than staying steady', () => {
    const attack = TEAM_TALKS.find((t) => t.id === 'attack')!;
    let boosted = 0;
    let steady = 0;
    for (let s = 0; s < 300; s++) {
      const h1 = simulateSegment(teamA, teamB, `talk-${s}`, DEFAULT_TUNING, 1, 45, freshCarry());
      boosted += simulateSegment(applyTalk(teamA, attack), teamB, `talk-${s}`, DEFAULT_TUNING, 46, 90, h1.carry)
        .carry.goalsA;
      steady += simulateSegment(teamA, teamB, `talk-${s}`, DEFAULT_TUNING, 46, 90, h1.carry).carry.goalsA;
    }
    expect(boosted).toBeGreaterThan(steady);
  });
});
