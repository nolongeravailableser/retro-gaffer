import { describe, it, expect } from 'vitest';
import { computeChemistry } from '@/lib/chemistry';
import { effectiveStrength, NO_MODIFIERS, mergeModifiers } from '@/lib/effects';
import { relicModifiers, relicBuyDiscount, relicHasFreeRefresh } from '@/lib/relics';
import { drawEvent } from '@/lib/events';
import type { Player } from '@/lib/types';

function mk(id: string, role: Player['role'], attack: number, defense: number): Player {
  return { id, name: id, cost: 4, stats: { attack, defense }, tags: [], role, rarity: 'gold' };
}

const xi = [mk('gk', 'GK', 20, 80), mk('cb', 'DEF', 40, 85), mk('mf', 'MID', 80, 60), mk('st', 'FWD', 90, 40)];
const chem = computeChemistry(xi);

describe('effectiveStrength', () => {
  it('with no modifiers reproduces raw chemistry totals', () => {
    const s = effectiveStrength(chem.perPlayer, NO_MODIFIERS);
    expect(s.attack).toBe(Math.round(chem.totalAttack));
    expect(s.defense).toBe(Math.round(chem.totalDefense));
  });

  it('applies a role multiplier only to that role', () => {
    const base = effectiveStrength(chem.perPlayer);
    const boosted = effectiveStrength(chem.perPlayer, { ...NO_MODIFIERS, role: { FWD: 2 } });
    // The striker's 90 attack should add another 90 to the team attack.
    expect(boosted.attack).toBe(base.attack + 90);
  });

  it('applies a per-player form multiplier', () => {
    const base = effectiveStrength(chem.perPlayer);
    const hot = effectiveStrength(chem.perPlayer, { ...NO_MODIFIERS, player: { mf: 1.5 } });
    expect(hot.attack).toBe(base.attack + 80 * 0.5);
  });

  it('teamMult scales the whole XI', () => {
    const base = effectiveStrength(chem.perPlayer);
    const boosted = effectiveStrength(chem.perPlayer, { ...NO_MODIFIERS, teamMult: 1.1 });
    expect(boosted.attack).toBe(Math.round(base.attack * 1.1));
  });

  it('merges modifiers multiplicatively', () => {
    const m = mergeModifiers(
      { ...NO_MODIFIERS, role: { FWD: 1.2 }, teamMult: 1.1 },
      { ...NO_MODIFIERS, role: { FWD: 1.5 }, teamMult: 1.1 }
    );
    expect(m.role.FWD).toBeCloseTo(1.8);
    expect(m.teamMult).toBeCloseTo(1.21);
  });
});

describe('relics', () => {
  it('Hairdryer amplifies chemistry', () => {
    expect(relicModifiers(['hairdryer']).chemAmplify).toBe(1.5);
  });
  it('Super-Agent gives a buy discount', () => {
    expect(relicBuyDiscount(['agent'])).toBe(1);
    expect(relicBuyDiscount([])).toBe(0);
  });
  it('Lucky Boots grants a free refresh', () => {
    expect(relicHasFreeRefresh(['lucky_boots'])).toBe(true);
    expect(relicHasFreeRefresh(['agent'])).toBe(false);
  });
});

describe('events', () => {
  it('is deterministic per run seed + round', () => {
    const a = drawEvent(3, 'run-1', ['mf', 'st'], []);
    const b = drawEvent(3, 'run-1', ['mf', 'st'], []);
    expect(a).toEqual(b);
  });

  it('always returns a usable event of a known kind', () => {
    for (let r = 1; r <= 50; r++) {
      const e = drawEvent(r, 'seed', ['mf'], []);
      expect(['meta', 'form', 'relic']).toContain(e.kind);
      if (e.kind === 'relic') expect(e.relicChoices!.length).toBeGreaterThan(0);
      if (e.kind === 'form') expect(e.formPlayerId).toBeTruthy();
    }
  });

  it('never offers an already-owned relic', () => {
    const owned = ['hairdryer', 'agent', 'lucky_boots'];
    for (let r = 1; r <= 50; r++) {
      const e = drawEvent(r, 'x', ['mf'], owned);
      if (e.kind === 'relic') {
        for (const c of e.relicChoices!) expect(owned).not.toContain(c);
      }
    }
  });
});
