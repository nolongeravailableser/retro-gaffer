import { describe, it, expect } from 'vitest';
import {
  captainOf,
  dressingRoomMood,
  moodLabel,
  leadershipMult,
  leadershipModifiers,
  LEADERSHIP_SWING,
} from '@/lib/squad';
import { overall } from '@/lib/wages';
import { MORALE_NEUTRAL } from '@/lib/morale';
import type { Player, Role } from '@/lib/types';

function mk(id: string, role: Role, attack: number, defense: number): Player {
  return { id, name: id, cost: 4, stats: { attack, defense }, tags: [], role, rarity: 'gold' };
}

describe('squad dynamics', () => {
  it('captain is the highest-rated starter (ties break on id)', () => {
    const star = mk('star', 'FWD', 95, 60);
    const squad = [mk('a', 'DEF', 40, 60), star, mk('b', 'MID', 50, 50)];
    expect(captainOf(squad, overall)).toBe(star);
    expect(captainOf([], overall)).toBeNull();
  });

  it('dressing-room mood reads the collective morale', () => {
    expect(dressingRoomMood([85, 80, 78])).toBe('buzzing');
    expect(dressingRoomMood([55, 58, 52])).toBe('settled');
    expect(dressingRoomMood([40, 42, 38])).toBe('tense');
    expect(dressingRoomMood([20, 25, 18])).toBe('fractured');
    expect(dressingRoomMood([])).toBe('settled'); // empty → neutral
    expect(moodLabel('fractured')).toBe('fractured');
  });

  it('leadership is a gentle team swing around the neutral point', () => {
    expect(leadershipMult(MORALE_NEUTRAL)).toBeCloseTo(1, 5);
    expect(leadershipMult(100)).toBeCloseTo(1 + LEADERSHIP_SWING, 5);
    expect(leadershipMult(0)).toBeLessThan(1);
    expect(leadershipMult(0)).toBeGreaterThanOrEqual(1 - LEADERSHIP_SWING - 1e-9);
  });

  it('leadershipModifiers folds into teamMult; null captain is a no-op', () => {
    expect(leadershipModifiers(null).teamMult).toBe(1);
    expect(leadershipModifiers(100).teamMult).toBeGreaterThan(1);
    expect(leadershipModifiers(10).teamMult).toBeLessThan(1);
  });
});
