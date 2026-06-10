import { describe, it, expect } from 'vitest';
import { buildVizTimeline, anchorsFromSquad, ballAt } from '@/lib/matchviz';
import { simulateMatch, type MatchTeam } from '@/lib/engine';
import type { Player, Role } from '@/lib/types';

function mk(id: string, role: Role): Player {
  return {
    id,
    name: id,
    era: '2010',
    cost: 3,
    stats: { attack: 60, defense: 60 },
    tags: [],
    role,
    rarity: 'silver',
  };
}

function squad(prefix: string): Player[] {
  return [
    mk(`${prefix}gk`, 'GK'),
    ...[0, 1, 2, 3].map((i) => mk(`${prefix}d${i}`, 'DEF')),
    ...[0, 1, 2, 3].map((i) => mk(`${prefix}m${i}`, 'MID')),
    ...[0, 1].map((i) => mk(`${prefix}f${i}`, 'FWD')),
  ];
}

const teamA: MatchTeam = { name: 'A', attack: 700, defense: 650, squad: squad('a') };
const teamB: MatchTeam = { name: 'B', attack: 620, defense: 680, squad: squad('b') };

function timelineFor(seed: string) {
  const result = simulateMatch(teamA, teamB, seed);
  return {
    result,
    tl: buildVizTimeline(result.events, seed, teamA.squad, teamB.squad, 0.55),
  };
}

describe('buildVizTimeline', () => {
  it('is deterministic for the same match + seed', () => {
    expect(timelineFor('viz-1').tl).toEqual(timelineFor('viz-1').tl);
  });

  it('produces exactly one scene per engine event', () => {
    const { result, tl } = timelineFor('viz-2');
    expect(tl.scenes).toHaveLength(result.events.length);
  });

  it('keeps every ball keyframe on the pitch (0–1 both axes)', () => {
    const { tl } = timelineFor('viz-3');
    for (const scene of tl.scenes) {
      expect(scene.ball[0].t).toBe(0);
      expect(scene.ball[scene.ball.length - 1].t).toBe(1);
      for (const p of scene.ball) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(1);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('goals end in the correct net (A attacks right, B attacks left)', () => {
    // Scan a few seeds to find matches with goals on both sides.
    let checkedA = 0;
    let checkedB = 0;
    for (let s = 0; s < 20 && (checkedA < 3 || checkedB < 3); s++) {
      const { result, tl } = timelineFor(`viz-goals-${s}`);
      result.events.forEach((e, i) => {
        if (e.kind !== 'goal') return;
        const finish = tl.scenes[i].ball.at(-1)!;
        if (e.side === 'A') {
          expect(finish.x).toBeGreaterThan(0.9);
          checkedA++;
        } else {
          expect(finish.x).toBeLessThan(0.1);
          checkedB++;
        }
      });
    }
    expect(checkedA).toBeGreaterThan(0);
    expect(checkedB).toBeGreaterThan(0);
  });

  it('flashes the big moments and mirrors card/injury scenes per event', () => {
    const { result, tl } = timelineFor('viz-4');
    result.events.forEach((e, i) => {
      const scene = tl.scenes[i];
      if (e.kind === 'goal') expect(scene.flash?.text).toBe('GOAL!');
      if (e.kind === 'red') expect(scene.flash?.text).toBe('RED CARD');
      if (e.kind === 'yellow') expect(scene.flash?.text).toBe('YELLOW CARD');
      if (e.kind === 'injury') expect(scene.flash?.text).toBe('INJURY');
    });
    expect(tl.scenes[0].flash?.text).toBe('KICK-OFF');
    expect(tl.scenes.at(-1)?.flash?.text).toBe('FULL-TIME');
  });

  it('never perturbs the engine: same match result with and without viz', () => {
    const before = simulateMatch(teamA, teamB, 'viz-iso');
    buildVizTimeline(before.events, 'viz-iso', teamA.squad, teamB.squad);
    const after = simulateMatch(teamA, teamB, 'viz-iso');
    expect(after).toEqual(before);
  });
});

describe('anchorsFromSquad', () => {
  it('lays out lines keeper → forwards, mirrored for the away side', () => {
    const home = anchorsFromSquad(squad('h'), false);
    const away = anchorsFromSquad(squad('w'), true);
    expect(home).toHaveLength(11);
    const gkH = home.find((a) => a.role === 'GK')!;
    const fwH = home.filter((a) => a.role === 'FWD');
    expect(gkH.x).toBeLessThan(0.1);
    for (const f of fwH) expect(f.x).toBeGreaterThan(0.6);
    const gkW = away.find((a) => a.role === 'GK')!;
    expect(gkW.x).toBeGreaterThan(0.9);
  });

  it('handles partial squads without crashing', () => {
    expect(anchorsFromSquad([mk('solo', 'FWD')], false)).toHaveLength(1);
    expect(anchorsFromSquad([], false)).toHaveLength(0);
  });
});

describe('ballAt', () => {
  it('interpolates smoothly within bounds across the whole scene', () => {
    const { tl } = timelineFor('viz-5');
    const scene = tl.scenes[2];
    for (let t = 0; t <= 1.001; t += 0.05) {
      const b = ballAt(scene, Math.min(1, t));
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThanOrEqual(1);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeLessThanOrEqual(1);
    }
    // Endpoints land on the keyframes (within float epsilon).
    expect(ballAt(scene, 0).x).toBeCloseTo(scene.ball[0].x, 9);
    expect(ballAt(scene, 0).y).toBeCloseTo(scene.ball[0].y, 9);
    expect(ballAt(scene, 1).x).toBeCloseTo(scene.ball.at(-1)!.x, 9);
    expect(ballAt(scene, 1).y).toBeCloseTo(scene.ball.at(-1)!.y, 9);
  });
});
