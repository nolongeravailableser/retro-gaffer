import { describe, it, expect } from 'vitest';
import { deriveStats, teamStatProfile, STAT_LABELS } from '@/lib/stats';
import { simulateMatch, type MatchTeam } from '@/lib/engine';
import type { Player, Position, Role } from '@/lib/types';

function mk(
  id: string,
  role: Role,
  attack: number,
  defense: number,
  position?: Position
): Player {
  return {
    id,
    name: id,
    era: '2010',
    cost: 3,
    stats: { attack, defense },
    tags: [],
    role,
    rarity: 'silver',
    position,
  };
}

const KEYS = Object.keys(STAT_LABELS) as (keyof ReturnType<typeof deriveStats>)[];

describe('deriveStats', () => {
  it('is deterministic and memo-stable', () => {
    const p = mk('p1', 'FWD', 80, 30, 'Striker');
    expect(deriveStats(p)).toEqual(deriveStats({ ...p }));
  });

  it('keeps every stat within 1–99', () => {
    for (const [atk, def] of [[1, 1], [99, 99], [50, 50]] as const) {
      for (const pos of ['Goalkeeper', 'CenterBack', 'Winger', 'Striker'] as Position[]) {
        const s = deriveStats(mk(`b-${pos}-${atk}`, 'MID', atk, def, pos));
        for (const k of KEYS) {
          expect(s[k]).toBeGreaterThanOrEqual(1);
          expect(s[k]).toBeLessThanOrEqual(99);
        }
      }
    }
  });

  it('follows positional archetypes', () => {
    const winger = deriveStats(mk('w', 'FWD', 70, 30, 'Winger'));
    const cb = deriveStats(mk('c', 'DEF', 30, 70, 'CenterBack'));
    const striker = deriveStats(mk('s', 'FWD', 70, 30, 'Striker'));
    const anchor = deriveStats(mk('a', 'MID', 50, 60, 'Anchor'));
    expect(winger.pace).toBeGreaterThan(cb.pace);
    expect(cb.defending).toBeGreaterThan(winger.defending);
    expect(striker.shooting).toBeGreaterThan(anchor.shooting);
    expect(anchor.physical).toBeGreaterThan(winger.physical);
  });

  it('better players get better skill stats', () => {
    const elite = deriveStats(mk('e', 'FWD', 95, 40, 'Striker'));
    const journeyman = deriveStats(mk('j', 'FWD', 45, 25, 'Striker'));
    expect(elite.shooting).toBeGreaterThan(journeyman.shooting);
    expect(elite.passing).toBeGreaterThan(journeyman.passing);
  });

  it("the keeper stat tracks a GK's DEF; outfielders can't keep goal", () => {
    const gk = deriveStats(mk('gk', 'GK', 12, 88, 'Goalkeeper'));
    expect(Math.abs(gk.goalkeeping - 88)).toBeLessThanOrEqual(5);
    const st = deriveStats(mk('st', 'FWD', 90, 30, 'Striker'));
    expect(st.goalkeeping).toBeLessThanOrEqual(15);
  });

  it('falls back to role archetypes when no position is authored', () => {
    const rivalDef = deriveStats(mk('r1', 'DEF', 50, 50));
    const rivalFwd = deriveStats(mk('r2', 'FWD', 50, 50));
    expect(rivalDef.defending).toBeGreaterThan(rivalFwd.defending);
    expect(rivalFwd.shooting).toBeGreaterThan(rivalDef.shooting);
  });
});

describe('teamStatProfile', () => {
  const squad = (q: number): Player[] => [
    mk(`gk${q}`, 'GK', 10, q, 'Goalkeeper'),
    ...[0, 1, 2, 3].map((i) => mk(`d${q}${i}`, 'DEF', 30, q, 'CenterBack')),
    ...[0, 1, 2, 3].map((i) => mk(`m${q}${i}`, 'MID', q, 55, 'Playmaker')),
    ...[0, 1].map((i) => mk(`f${q}${i}`, 'FWD', q, 30, 'Striker')),
  ];

  it('stronger squads profile higher, empty squads are neutral', () => {
    const strong = teamStatProfile(squad(90));
    const weak = teamStatProfile(squad(45));
    expect(strong.creation).toBeGreaterThan(weak.creation);
    expect(strong.finishing).toBeGreaterThan(weak.finishing);
    expect(strong.defending).toBeGreaterThan(weak.defending);
    expect(strong.goalkeeping).toBeGreaterThan(weak.goalkeeping);
    expect(teamStatProfile([])).toEqual({
      creation: 50, finishing: 50, defending: 50, goalkeeping: 50, composure: 50,
    });
  });

  it('a squad with no keeper has a weak last line', () => {
    const noGk = squad(80).filter((p) => p.role !== 'GK');
    expect(teamStatProfile(noGk).goalkeeping).toBeLessThanOrEqual(30);
  });
});

describe('engine stat sensitivity', () => {
  // Two squads with IDENTICAL ATK/DEF but different positional make-up.
  const sharpshooters: MatchTeam = {
    name: 'Sharp', attack: 700, defense: 650,
    squad: [
      mk('s-gk', 'GK', 10, 60, 'Goalkeeper'),
      ...[0, 1, 2, 3].map((i) => mk(`s-d${i}`, 'DEF', 30, 60, 'CenterBack')),
      ...[0, 1, 2, 3].map((i) => mk(`s-m${i}`, 'MID', 75, 50, 'Playmaker')),
      ...[0, 1].map((i) => mk(`s-f${i}`, 'FWD', 92, 30, 'Striker')),
    ],
  };
  const blunt: MatchTeam = {
    name: 'Blunt', attack: 700, defense: 650,
    squad: [
      mk('b-gk', 'GK', 10, 60, 'Goalkeeper'),
      ...[0, 1, 2, 3].map((i) => mk(`b-d${i}`, 'DEF', 30, 60, 'CenterBack')),
      ...[0, 1, 2, 3].map((i) => mk(`b-m${i}`, 'MID', 45, 50, 'Anchor')),
      ...[0, 1].map((i) => mk(`b-f${i}`, 'FWD', 45, 30, 'Fullback')),
    ],
  };

  it('a sharper attacking profile out-creates a blunt one (same ATK/DEF)', () => {
    let sharpGoals = 0;
    let bluntGoals = 0;
    for (let s = 0; s < 300; s++) {
      sharpGoals += simulateMatch(sharpshooters, blunt, `sens-${s}`).score.a;
      bluntGoals += simulateMatch(blunt, sharpshooters, `sens2-${s}`).score.a;
    }
    expect(sharpGoals).toBeGreaterThan(bluntGoals);
  });

  it('statInfluence: 0 makes outcomes independent of the extended stats', () => {
    const tuning = {
      xgScale: 2.5, minXg: 0.15, maxXg: 2.5, chanceFactor: 1.4,
      pYellow: 0.025, pStraightRed: 0.003, pInjury: 0.005, statInfluence: 0,
    };
    for (let s = 0; s < 40; s++) {
      const r1 = simulateMatch(sharpshooters, blunt, `off-${s}`, tuning);
      const r2 = simulateMatch(blunt, sharpshooters, `off-${s}`, tuning);
      // Same seed, same ATK/DEF, stats disabled → identical scores & shapes.
      expect(r1.score).toEqual(r2.score);
      expect(r1.xg).toEqual(r2.xg);
      expect(r1.events.length).toBe(r2.events.length);
    }
  });

  it('the card magnet collects far more than his 1/11 share of bookings', () => {
    // One low-discipline Anchor among ten high-discipline Playmakers: the
    // weighting decides WHO gets booked (the rate itself is unchanged).
    const magnetId = 'magnet';
    const mixed: MatchTeam = {
      name: 'M', attack: 600, defense: 600,
      squad: [
        mk(magnetId, 'MID', 60, 60, 'Anchor'),
        ...Array.from({ length: 10 }, (_, i) => mk(`calm${i}`, 'MID', 60, 60, 'Playmaker')),
      ],
    };
    const opp: MatchTeam = {
      name: 'O', attack: 600, defense: 600,
      squad: Array.from({ length: 11 }, (_, i) => mk(`o${i}`, 'MID', 60, 60, 'Playmaker')),
    };
    let magnetCards = 0;
    let totalCards = 0;
    for (let s = 0; s < 400; s++) {
      const r = simulateMatch(mixed, opp, `card-${s}`);
      for (const e of r.events) {
        if (e.side !== 'A' || (e.kind !== 'yellow' && e.kind !== 'red')) continue;
        totalCards++;
        if (e.text.includes(magnetId)) magnetCards++;
      }
    }
    expect(totalCards).toBeGreaterThan(100);
    // Uniform share would be ~9.1%; the weighting puts the magnet near ~12.8%
    // (weights ≈1.06 vs ≈0.72). Assert clearly above uniform incl. noise.
    expect(magnetCards / totalCards).toBeGreaterThan(0.11);
  });
});
