import { describe, it, expect } from 'vitest';
import {
  eligiblePositions,
  canPlay,
  canFillSlot,
  positionFit,
  OUT_OF_POSITION_MULT,
  POSITION_TO_ROLE,
} from '@/lib/positions';
import type { Player, Position, Role } from '@/lib/types';

function mk(position: Position): Player {
  return {
    id: position,
    name: position,
    cost: 4,
    stats: { attack: 60, defense: 60 },
    tags: [],
    role: POSITION_TO_ROLE[position],
    rarity: 'gold',
    position,
  };
}

describe('positions', () => {
  it('a player is always eligible for his own position', () => {
    for (const pos of Object.keys(POSITION_TO_ROLE) as Position[]) {
      expect(eligiblePositions(mk(pos))).toContain(pos);
      expect(canPlay(mk(pos), pos)).toBe(true);
      expect(positionFit(mk(pos), pos)).toBe(1);
    }
  });

  it('eligibility crosses role lines (full-back can play winger)', () => {
    const fb = mk('Fullback');
    expect(canPlay(fb, 'Winger')).toBe(true); // FWD slot, but FB is eligible
    expect(POSITION_TO_ROLE.Winger).toBe('FWD');
    expect(POSITION_TO_ROLE.Fullback).toBe('DEF');
  });

  it('a same-role but non-eligible slot is fillable, with the penalty', () => {
    const anchor = mk('Anchor'); // MID; eligible: Anchor/CenterBack/BoxToBox
    expect(canPlay(anchor, 'Playmaker')).toBe(false); // not eligible
    expect(canFillSlot(anchor, 'Playmaker')).toBe(true); // same role (MID) → fillable
    expect(positionFit(anchor, 'Playmaker')).toBe(OUT_OF_POSITION_MULT);
  });

  it('a wrong-role, non-eligible slot is not fillable', () => {
    const striker = mk('Striker'); // eligible: Striker/Winger (both FWD)
    expect(canFillSlot(striker, 'CenterBack')).toBe(false);
    expect(canFillSlot(striker, 'Goalkeeper')).toBe(false);
  });

  it('keepers only play in goal', () => {
    const gk = mk('Goalkeeper');
    expect(eligiblePositions(gk)).toEqual(['Goalkeeper']);
    expect(canFillSlot(gk, 'CenterBack')).toBe(false);
  });

  it('falls back to role positions when no authored position', () => {
    const bare: Player = { id: 'x', name: 'x', cost: 2, stats: { attack: 50, defense: 50 }, tags: [], role: 'MID' as Role, rarity: 'bronze' };
    const elig = eligiblePositions(bare);
    expect(elig).toEqual(['Anchor', 'BoxToBox', 'Playmaker']); // all MID positions
  });
});
