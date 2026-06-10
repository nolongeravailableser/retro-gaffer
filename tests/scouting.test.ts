import { describe, it, expect } from 'vitest';
import { POOL, getPlayer } from '@/data/pool';
import { drawShop } from '@/lib/economy';
import { Rng } from '@/lib/rng';
import { SCOUT_BRIEFS, getBrief } from '@/lib/scouting';

describe('drawShop mustMatch (scouting)', () => {
  it('guarantees a brief-matching player in the draw', () => {
    const gk = (p: { role: string }) => p.role === 'GK';
    for (const seed of [1, 2, 3, 7, 42]) {
      const ids = drawShop(POOL, new Set(), new Rng(seed), 3, undefined, gk);
      const roles = ids.map((id) => getPlayer(id)!.role);
      expect(roles).toContain('GK');
    }
  });

  it('surfaces an otherwise-unfindable easter egg', () => {
    const egg = (p: { tags: string[] }) => p.tags.includes('easter_egg');
    const ids = drawShop(POOL, new Set(), new Rng(99), 3, undefined, egg);
    expect(ids.some((id) => getPlayer(id)!.tags.includes('easter_egg'))).toBe(true);
  });

  it('never offers owned players, even when matching the brief', () => {
    const fwd = (p: { role: string }) => p.role === 'FWD';
    // Own every forward but a couple, then scout forwards.
    const forwards = POOL.filter((p) => p.role === 'FWD').map((p) => p.id);
    const owned = new Set(forwards.slice(0, forwards.length - 2));
    const ids = drawShop(POOL, owned, new Rng(5), 3, undefined, fwd);
    for (const id of ids) expect(owned.has(id!)).toBe(false);
  });

  it('is deterministic for a given seed', () => {
    const m = (p: { rarity: string }) => p.rarity === 'icon';
    const a = drawShop(POOL, new Set(), new Rng(123), 3, undefined, m);
    const b = drawShop(POOL, new Set(), new Rng(123), 3, undefined, m);
    expect(a).toEqual(b);
  });

  it('falls back gracefully when no match exists', () => {
    const impossible = () => false;
    const ids = drawShop(POOL, new Set(), new Rng(8), 3, undefined, impossible);
    expect(ids).toHaveLength(3); // still a full, valid shop
  });
});

describe('drawShop rarity guarantee still works alongside mustMatch', () => {
  it('honors a gold+ guarantee', () => {
    for (const seed of [1, 2, 3]) {
      const ids = drawShop(POOL, new Set(), new Rng(seed), 3, 'gold');
      const ranks = ids.map((id) => getPlayer(id)!.rarity);
      expect(ranks.some((r) => r === 'gold' || r === 'icon')).toBe(true);
    }
  });
});

describe('scout briefs', () => {
  it('all briefs have unique ids and at least one matching player', () => {
    const ids = SCOUT_BRIEFS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of SCOUT_BRIEFS) {
      expect(b.cost).toBeGreaterThan(0);
      expect(POOL.some((p) => b.match(p))).toBe(true);
    }
  });

  it('getBrief resolves and rejects unknowns', () => {
    expect(getBrief('hidden_gem')?.id).toBe('hidden_gem');
    expect(getBrief(null)).toBeNull();
    expect(getBrief('nope')).toBeNull();
  });
});
