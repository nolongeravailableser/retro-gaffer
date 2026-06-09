/**
 * Relics — persistent run modifiers (Balatro-style). Earned from events, they
 * warp a whole run's economy and/or matches and stack into build archetypes.
 */

import { NO_MODIFIERS, mergeModifiers, type MatchModifiers } from './effects';

export interface Relic {
  id: string;
  name: string;
  blurb: string;
  emoji: string;
  /** Per-match strength modifiers this relic contributes. */
  mods?: Partial<MatchModifiers>;
  /** Reduces each signing's cost by this much (£m). */
  buyDiscount?: number;
  /** The first shop refresh each round is free. */
  freeRefresh?: boolean;
}

export const RELICS: Record<string, Relic> = {
  hairdryer: {
    id: 'hairdryer',
    name: 'Hairdryer Treatment',
    blurb: 'Chemistry bonuses are 50% stronger.',
    emoji: '🔥',
    mods: { chemAmplify: 1.5 },
  },
  agent: {
    id: 'agent',
    name: 'Super-Agent',
    blurb: 'Every signing costs £1M less.',
    emoji: '🤝',
    buyDiscount: 1,
  },
  lucky_boots: {
    id: 'lucky_boots',
    name: 'Lucky Boots',
    blurb: 'Your first shop refresh each round is free.',
    emoji: '🥾',
    freeRefresh: true,
  },
  talisman: {
    id: 'talisman',
    name: 'Lucky Talisman',
    blurb: 'Your whole XI plays 6% better.',
    emoji: '🍀',
    mods: { teamMult: 1.06 },
  },
  sponsor: {
    id: 'sponsor',
    name: 'Shirt Sponsor',
    blurb: 'Forwards score 12% harder.',
    emoji: '💷',
    mods: { role: { FWD: 1.12 } },
  },
};

export function getRelic(id: string): Relic | undefined {
  return RELICS[id];
}

/** Combined per-match modifiers from all owned relics. */
export function relicModifiers(relics: readonly string[]): MatchModifiers {
  let mods = NO_MODIFIERS;
  for (const id of relics) {
    const r = RELICS[id];
    if (r?.mods) mods = mergeModifiers(mods, { ...NO_MODIFIERS, ...r.mods });
  }
  return mods;
}

export function relicBuyDiscount(relics: readonly string[]): number {
  return relics.reduce((sum, id) => sum + (RELICS[id]?.buyDiscount ?? 0), 0);
}

export function relicHasFreeRefresh(relics: readonly string[]): boolean {
  return relics.some((id) => RELICS[id]?.freeRefresh);
}
