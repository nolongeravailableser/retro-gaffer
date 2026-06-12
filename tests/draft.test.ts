import { describe, it, expect } from 'vitest';
import {
  snakeOrder,
  generateDraft,
  currentTeam,
  draftComplete,
  canPick,
  pickableInDraft,
  aiPick,
  applyPick,
  draftedStrength,
  DRAFT_NEED,
  DRAFT_SQUAD_SIZE,
  type DraftablePlayer,
} from '@/lib/draft';
import type { Role } from '@/lib/types';

/**
 * A generous synthetic pool, deep in cheap players (like the real 668-player
 * pool with its many free agents) so the cheapest legal XI stays affordable
 * throughout — and a spread of pricier quality on top.
 */
function makePool(): DraftablePlayer[] {
  const counts: Record<Role, number> = { GK: 30, DEF: 80, MID: 80, FWD: 50 };
  const out: DraftablePlayer[] = [];
  for (const role of Object.keys(counts) as Role[]) {
    for (let k = 0; k < counts[role]; k++) {
      const rating = 60 + (k % 40) * 3; // 60…177
      // Fat cheap tail: everything below ~rating 90 costs £1; quality climbs.
      const value = Math.max(1, Math.round((rating - 90) / 5)); // £1 … ~£17
      out.push({ id: `${role}-${k}`, role, rating, value });
    }
  }
  return out;
}

function makeTeams(yourBudget: number, aiBudget: number, n = 12) {
  return Array.from({ length: n }, (_, i) => ({
    id: i === 0 ? 'YOU' : `ai${i}`,
    name: i === 0 ? 'You' : `Club ${i}`,
    budget: i === 0 ? yourBudget : aiBudget,
  }));
}

/** Auto-run a whole draft with the AI logic for every pick. */
function runDraft(seed: string, yourBudget: number, aiBudget: number) {
  let state = generateDraft(seed, makeTeams(yourBudget, aiBudget), makePool());
  let guard = 0;
  while (!draftComplete(state) && guard++ < 5000) {
    const pick = aiPick(state, currentTeam(state)!);
    expect(pick).not.toBeNull();
    state = applyPick(state, pick!);
  }
  return state;
}

const roleCount = (state: ReturnType<typeof runDraft>, teamIdx: number, role: Role) =>
  state.teams[teamIdx].roster.filter((id) => state.meta[id].role === role).length;

describe('snake order', () => {
  it('runs forward then backward each round', () => {
    expect(snakeOrder(3, 2)).toEqual([0, 1, 2, 2, 1, 0]);
    expect(snakeOrder(4, 1)).toEqual([0, 1, 2, 3]);
    expect(snakeOrder(2, 3)).toEqual([0, 1, 1, 0, 0, 1]);
  });

  it('gives every team an equal number of picks', () => {
    const order = snakeOrder(12, DRAFT_SQUAD_SIZE);
    expect(order).toHaveLength(12 * DRAFT_SQUAD_SIZE);
    for (let t = 0; t < 12; t++) {
      expect(order.filter((x) => x === t)).toHaveLength(DRAFT_SQUAD_SIZE);
    }
  });
});

describe('draft — a full run', () => {
  it('every team ends with a full, legal, fieldable squad', () => {
    const state = runDraft('seed-1', 140, 140);
    expect(draftComplete(state)).toBe(true);
    for (let t = 0; t < state.teams.length; t++) {
      expect(state.teams[t].roster).toHaveLength(DRAFT_SQUAD_SIZE);
      // Covers every required role → can field a legal XI.
      for (const [role, need] of Object.entries(DRAFT_NEED) as [Role, number][]) {
        expect(roleCount(state, t, role)).toBeGreaterThanOrEqual(need);
      }
      // Never overspent.
      expect(state.teams[t].budget).toBeGreaterThanOrEqual(0);
    }
  });

  it('never drafts the same player to two teams', () => {
    const state = runDraft('seed-2', 160, 130);
    const all = state.teams.flatMap((t) => t.roster);
    expect(new Set(all).size).toBe(all.length);
  });

  it('the RESERVE GUARD keeps even a shoestring budget fieldable', () => {
    // A tiny budget can't buy stars, but must still complete a legal XI.
    const state = runDraft('seed-3', 20, 200);
    const you = state.teams[0];
    expect(you.roster).toHaveLength(DRAFT_SQUAD_SIZE);
    for (const [role, need] of Object.entries(DRAFT_NEED) as [Role, number][]) {
      expect(roleCount(state, 0, role)).toBeGreaterThanOrEqual(need);
    }
    expect(you.budget).toBeGreaterThanOrEqual(0);
  });

  it('a bigger budget drafts a stronger squad', () => {
    const rich = runDraft('seed-same', 260, 100);
    const poor = runDraft('seed-same', 60, 100);
    expect(draftedStrength(rich, 0)).toBeGreaterThan(draftedStrength(poor, 0));
  });

  it('is deterministic for the same seed + budgets', () => {
    const a = runDraft('seed-det', 140, 140);
    const b = runDraft('seed-det', 140, 140);
    expect(a.teams.map((t) => t.roster)).toEqual(b.teams.map((t) => t.roster));
  });
});

describe('canPick — affordability + reserve guard', () => {
  it('rejects a player you cannot afford', () => {
    const state = generateDraft('s', makeTeams(5, 140), makePool());
    const expensive = state.pool.find((id) => state.meta[id].value > 5)!;
    expect(canPick(state, 0, expensive)).toBe(false);
  });

  it('blocks a splurge that would strand you, but allows a sensible pick', () => {
    // A cheap legal XI (11 × £3 = £33) is affordable on £60; a £40 star is not,
    // because £60 − £40 = £20 < the £30 needed to still fill the other 10 slots.
    const cheap = (id: string, role: Role): DraftablePlayer => ({ id, role, rating: 90, value: 3 });
    const pool: DraftablePlayer[] = [
      cheap('gk1', 'GK'), cheap('gk2', 'GK'),
      cheap('d1', 'DEF'), cheap('d2', 'DEF'), cheap('d3', 'DEF'), cheap('d4', 'DEF'), cheap('d5', 'DEF'),
      cheap('m1', 'MID'), cheap('m2', 'MID'), cheap('m3', 'MID'), cheap('m4', 'MID'), cheap('m5', 'MID'),
      cheap('f1', 'FWD'), cheap('f2', 'FWD'), cheap('f3', 'FWD'),
      { id: 'star', role: 'FWD', rating: 200, value: 40 },
    ];
    const state = generateDraft('s', [{ id: 'YOU', name: 'You', budget: 60 }], pool);
    expect(canPick(state, 0, 'star')).toBe(false); // the splurge strands you
    expect(canPick(state, 0, 'gk1')).toBe(true); // a £3 role-filler is fine
  });
});

describe('pickableInDraft — free picking with a completion guarantee', () => {
  it('lets you draft any affordable role from the very first pick', () => {
    const pool: DraftablePlayer[] = [
      { id: 'gk1', role: 'GK', rating: 90, value: 3 },
      { id: 'star', role: 'FWD', rating: 200, value: 30 },
      { id: 'm1', role: 'MID', rating: 90, value: 3 },
    ];
    const state = generateDraft('s', [{ id: 'YOU', name: 'You', budget: 100 }], pool);
    // No role-first: an affordable FWD star is pickable straight away (14 picks,
    // 11 required, so plenty of room before required roles must be filled).
    expect(pickableInDraft(state, 0, 'star')).toBe(true);
    expect(pickableInDraft(state, 0, 'gk1')).toBe(true);
  });

  it('reserves your final picks for still-needed required roles', () => {
    // A roster one slot from the squad cap (DRAFT_SQUAD_SIZE−1) that still needs a
    // GK → the last pick must be that GK; a non-needed role is blocked.
    const c = (id: string, role: Role): DraftablePlayer => ({ id, role, rating: 90, value: 1 });
    const drafted = [
      c('d1', 'DEF'), c('d2', 'DEF'), c('d3', 'DEF'), c('d4', 'DEF'), c('x1', 'DEF'), c('x2', 'DEF'),
      c('m1', 'MID'), c('m2', 'MID'), c('m3', 'MID'), c('m4', 'MID'), c('x3', 'MID'),
      c('f1', 'FWD'), c('f2', 'FWD'), c('x4', 'FWD'), c('x5', 'FWD'),
    ]; // 15 players — one short of the 16-man squad, no GK yet
    const pool = [...drafted, c('gk', 'GK'), c('extraFwd', 'FWD')];
    let s = generateDraft('s', [{ id: 'YOU', name: 'You', budget: 100 }], pool);
    for (const p of drafted) s = applyPick(s, p.id); // 1 pick left, still need a GK
    expect(pickableInDraft(s, 0, 'gk')).toBe(true); // must take the GK
    expect(pickableInDraft(s, 0, 'extraFwd')).toBe(false); // can't waste the last pick
  });

  it('depth last-resort: you can always fill your squad even at £0', () => {
    const c = (id: string, role: Role): DraftablePlayer => ({ id, role, rating: 90, value: 1 });
    const xi: DraftablePlayer[] = [
      c('gk', 'GK'), c('d1', 'DEF'), c('d2', 'DEF'), c('d3', 'DEF'), c('d4', 'DEF'),
      c('m1', 'MID'), c('m2', 'MID'), c('m3', 'MID'), c('m4', 'MID'), c('f1', 'FWD'), c('f2', 'FWD'),
    ];
    const depthPool = [...xi, c('depth', 'MID')];
    let s = generateDraft('s', [{ id: 'YOU', name: 'You', budget: 11 }], depthPool);
    for (const id of xi.map((p) => p.id)) s = applyPick(s, id); // draft the legal XI
    expect(s.teams[0].budget).toBe(0); // spent it all
    // XI complete, £0 left — the cheapest remaining player is still pickable.
    expect(pickableInDraft(s, 0, 'depth')).toBe(true);
  });

  it('last resort: the cheapest needed-role player is always pickable, even over budget', () => {
    // Budget too small for the only (expensive) GK, but you NEED a GK → the
    // cheapest available GK is pickable anyway so you can complete a legal XI.
    const tight: DraftablePlayer[] = [{ id: 'onlyGk', role: 'GK', rating: 200, value: 99 }];
    const state = generateDraft('s', [{ id: 'YOU', name: 'You', budget: 5 }], tight);
    expect(canPick(state, 0, 'onlyGk')).toBe(false); // can't afford under the guard
    expect(pickableInDraft(state, 0, 'onlyGk')).toBe(true); // …but it's the last resort
  });
});
