import { describe, it, expect } from 'vitest';
import { pickBestXI, planAutoBuy, roleScore, type ShopOffer } from '@/lib/autopick';
import type { Player, Role } from '@/lib/types';

function mk(
  id: string,
  role: Role,
  attack: number,
  defense: number,
  cost = 3,
  tags: string[] = []
): Player {
  return {
    id,
    name: id,
    era: '2010',
    cost,
    stats: { attack, defense },
    tags,
    role,
    rarity: 'silver',
  };
}

/** A legal 4-4-2 squad: 2 GK, 5 DEF, 5 MID, 3 FWD (15 players). */
function fullSquad(): Player[] {
  const out: Player[] = [];
  for (let i = 0; i < 2; i++) out.push(mk(`gk${i}`, 'GK', 10, 70 + i * 5));
  for (let i = 0; i < 5; i++) out.push(mk(`def${i}`, 'DEF', 30, 60 + i * 5));
  for (let i = 0; i < 5; i++) out.push(mk(`mid${i}`, 'MID', 55 + i * 5, 50));
  for (let i = 0; i < 3; i++) out.push(mk(`fwd${i}`, 'FWD', 70 + i * 5, 25));
  return out;
}

function resolver(players: Player[]) {
  const map = new Map(players.map((p) => [p.id, p]));
  return (id: string) => map.get(id);
}

const NO_UNAVAIL = { suspensions: [], injuries: {} };

describe('pickBestXI', () => {
  it('fields a full, role-legal XI for 4-4-2', () => {
    const squad = fullSquad();
    const r = pickBestXI(squad.map((p) => p.id), '442', NO_UNAVAIL, resolver(squad));
    expect(r.filled).toBe(11);
    const roles = r.xi.map((id) => squad.find((p) => p.id === id)?.role);
    expect(roles).toEqual(['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD']);
  });

  it('prefers higher-rated players and benches the rest', () => {
    const squad = fullSquad();
    const r = pickBestXI(squad.map((p) => p.id), '442', NO_UNAVAIL, resolver(squad));
    expect(r.xi).toContain('gk1'); // def 75 beats gk0's 70
    expect(r.xi).not.toContain('gk0');
    // 15 players − 11 fielded = 4 leftovers, all benched (≤ BENCH_SIZE).
    expect(r.bench).toHaveLength(4);
    expect(r.bench).toContain('gk0');
  });

  it('never fields suspended or injured players', () => {
    const squad = fullSquad();
    const r = pickBestXI(
      squad.map((p) => p.id),
      '442',
      { suspensions: ['gk1'], injuries: { fwd2: 2 } },
      resolver(squad)
    );
    expect(r.xi).not.toContain('gk1');
    expect(r.xi).not.toContain('fwd2');
    expect(r.xi).toContain('gk0'); // the fit backup steps in
    expect(r.filled).toBe(11);
  });

  it('chemistry refinement can beat raw stats', () => {
    // Everyone shares the 'club' tag except the raw-stat-better keeper.
    const squad = fullSquad().map((p) => ({ ...p, tags: ['club'] }));
    const loner = mk('gkX', 'GK', 10, 78); // best raw GK, zero chemistry
    const all = [...squad, loner];
    const r = pickBestXI(all.map((p) => p.id), '442', NO_UNAVAIL, resolver(all));
    // gk1 (def 75, +10% chem → 82.5 effective) outranks gkX (78 flat).
    expect(r.xi).toContain('gk1');
    expect(r.xi).not.toContain('gkX');
  });

  it('fields a partial XI when the squad cannot fill 11', () => {
    const squad = [mk('gk0', 'GK', 10, 70), mk('def0', 'DEF', 30, 60), mk('fwd0', 'FWD', 70, 20)];
    const r = pickBestXI(squad.map((p) => p.id), '442', NO_UNAVAIL, resolver(squad));
    expect(r.filled).toBe(3);
    expect(r.xi.filter(Boolean)).toHaveLength(3);
    expect(r.bench).toHaveLength(0);
  });

  it('is deterministic', () => {
    const squad = fullSquad();
    const a = pickBestXI(squad.map((p) => p.id), '442', NO_UNAVAIL, resolver(squad));
    const b = pickBestXI(squad.map((p) => p.id), '442', NO_UNAVAIL, resolver(squad));
    expect(a).toEqual(b);
  });

  it('fills out of position rather than leave a man short (no soft-lock)', () => {
    // 4-4-2 needs 2 FWD, but only ONE fit forward — the other two are injured.
    // With 12 fit players overall, it must still field a full 11 (a MID covers FWD).
    const squad = fullSquad(); // 2 GK, 5 DEF, 5 MID, 3 FWD
    const injuries = { fwd1: 2, fwd2: 1 }; // two forwards out
    const r = pickBestXI(squad.map((p) => p.id), '442', { suspensions: [], injuries }, resolver(squad));
    expect(r.filled).toBe(11); // a full XI, not 10
    // No injured player was fielded.
    expect(r.xi).not.toContain('fwd1');
    expect(r.xi).not.toContain('fwd2');
    // The one fit forward starts; an out-of-position outfielder fills the gap.
    expect(r.xi).toContain('fwd0');
  });
});

describe('roleScore', () => {
  it('weighs stats by role (a striker is judged on attack)', () => {
    const glass = mk('a', 'FWD', 90, 10);
    const rock = mk('b', 'FWD', 10, 90);
    expect(roleScore(glass)).toBeGreaterThan(roleScore(rock));
  });
});

describe('planAutoBuy', () => {
  const offer = (index: number, p: Player): ShopOffer => ({ index, player: p, cost: p.cost });

  it('signs the missing role', () => {
    const owned = fullSquad().filter((p) => p.role !== 'GK'); // no keeper
    const offers = [offer(0, mk('buyGk', 'GK', 10, 70, 4)), offer(1, mk('buyFwd', 'FWD', 80, 20, 4))];
    const plan = planAutoBuy(offers, owned, owned.slice(0, 10), '442', 50, owned.length, 16);
    expect(plan.map((o) => o.player.id)).toEqual(['buyGk']); // need-driven: no FWD splurge
  });

  it('buys nothing when every role is covered', () => {
    const owned = fullSquad();
    const offers = [offer(0, mk('buyFwd', 'FWD', 95, 30, 2))];
    const plan = planAutoBuy(offers, owned, owned.slice(0, 11), '442', 50, owned.length, 16);
    expect(plan).toEqual([]);
  });

  it('never spends below the reserve', () => {
    const owned = fullSquad().filter((p) => p.role !== 'GK');
    const offers = [offer(0, mk('buyGk', 'GK', 10, 70, 10))];
    // bankroll 12, cost 10, reserve 5 → 12 − 10 < 5 → can't buy.
    expect(planAutoBuy(offers, owned, [], '442', 12, owned.length, 16, 5)).toEqual([]);
    // bankroll 15 → 15 − 10 ≥ 5 → buys.
    expect(planAutoBuy(offers, owned, [], '442', 15, owned.length, 16, 5)).toHaveLength(1);
  });

  it('respects the roster cap', () => {
    const owned = fullSquad().filter((p) => p.role !== 'GK');
    const offers = [offer(0, mk('buyGk', 'GK', 10, 70, 4))];
    expect(planAutoBuy(offers, owned, [], '442', 50, 16, 16)).toEqual([]);
  });

  it('fills multiple gaps, best value first', () => {
    const owned = fullSquad().filter((p) => p.role !== 'GK' && p.id !== 'def0' && p.id !== 'def1');
    // Needs: 1 GK + 1 DEF (have 3 of 4 DEF). Offers cover both + a dud.
    const offers = [
      offer(0, mk('buyDef', 'DEF', 30, 70, 4)),
      offer(1, mk('buyGk', 'GK', 10, 70, 4)),
      offer(2, mk('buyMid', 'MID', 80, 60, 4)),
    ];
    const plan = planAutoBuy(offers, owned, [], '442', 50, owned.length, 16);
    expect(plan.map((o) => o.player.id).sort()).toEqual(['buyDef', 'buyGk']);
  });

  it('is deterministic', () => {
    const owned = fullSquad().filter((p) => p.role !== 'GK');
    const offers = [offer(0, mk('a', 'GK', 10, 70, 4)), offer(1, mk('b', 'GK', 10, 70, 4))];
    const one = planAutoBuy(offers, owned, [], '442', 50, owned.length, 16);
    const two = planAutoBuy(offers, owned, [], '442', 50, owned.length, 16);
    expect(one).toEqual(two);
    expect(one.map((o) => o.player.id)).toEqual(['a']); // id tie-break, only 1 GK needed
  });
});
