/**
 * "The Gaffer's Notebook" — between-round events drawn from a weighted deck and
 * shown as retro tabloid headlines. Some warp the next match (tactical meta
 * shifts, player form); some offer a relic to pick. Deterministic per run/round
 * so the Daily Challenge stays fair. Pure.
 */

import { Rng } from './rng';
import { RELICS } from './relics';
import { NO_MODIFIERS, type MatchModifiers } from './effects';
import type { Role } from './types';

export type EventKind = 'meta' | 'form' | 'relic';

export interface GameEvent {
  id: string;
  headline: string;
  blurb: string;
  kind: EventKind;
  /** Modifiers applied to this round's match (NO_MODIFIERS for relic offers). */
  mods: MatchModifiers;
  /** For kind === 'form': the affected player id (UI resolves the name). */
  formPlayerId?: string;
  formHot?: boolean;
  /** For kind === 'relic': the relic ids on offer. */
  relicChoices?: string[];
}

interface MetaShift {
  id: string;
  headline: string;
  blurb: string;
  role: Partial<Record<Role, number>>;
}

const META_SHIFTS: MetaShift[] = [
  { id: 'total_football', headline: 'TOTAL FOOTBALL IS BACK', blurb: 'Midfielders +15% this round.', role: { MID: 1.15 } },
  { id: 'catenaccio', headline: 'CATENACCIO SUNDAY', blurb: 'Defenders +25%, Forwards −10%.', role: { DEF: 1.25, FWD: 0.9 } },
  { id: 'route_one', headline: 'ROUTE ONE REVOLUTION', blurb: 'Forwards +20%, Midfielders −10%.', role: { FWD: 1.2, MID: 0.9 } },
  { id: 'sweeper_keeper', headline: 'THE SWEEPER-KEEPER ERA', blurb: 'Goalkeepers +30%.', role: { GK: 1.3 } },
  { id: 'wing_play', headline: 'GET IT OUT WIDE', blurb: 'Forwards +15%.', role: { FWD: 1.15 } },
];

/**
 * Draw one event for the upcoming round. Weights: 45% tactical meta shift,
 * 30% player form, 25% relic offer (skewed away from relics already owned).
 */
export function drawEvent(
  round: number,
  seed: string | number,
  starterIds: readonly string[],
  ownedRelics: readonly string[]
): GameEvent {
  const rng = new Rng(`${seed}-event-${round}`);
  const roll = rng.next();

  if (roll < 0.45) {
    const m = rng.pick(META_SHIFTS);
    return {
      id: m.id,
      headline: m.headline,
      blurb: m.blurb,
      kind: 'meta',
      mods: { ...NO_MODIFIERS, role: m.role },
    };
  }

  if (roll < 0.75 && starterIds.length > 0) {
    const hot = rng.next() < 0.7;
    const id = rng.pick(starterIds);
    return {
      id: `form-${id}`,
      headline: hot ? 'BACK-PAGE HERO' : 'OFF THE BOIL',
      blurb: hot ? 'A starter is flying — +25% this round.' : 'A starter looks a yard off it — −15% this round.',
      kind: 'form',
      mods: { ...NO_MODIFIERS, player: { [id]: hot ? 1.25 : 0.85 } },
      formPlayerId: id,
      formHot: hot,
    };
  }

  // Relic offer — two not-yet-owned relics to choose from.
  const available = Object.keys(RELICS).filter((r) => !ownedRelics.includes(r));
  const choices = rng.shuffle(available).slice(0, 2);
  if (choices.length === 0) {
    // Everything owned — fall back to a meta shift.
    const m = rng.pick(META_SHIFTS);
    return { id: m.id, headline: m.headline, blurb: m.blurb, kind: 'meta', mods: { ...NO_MODIFIERS, role: m.role } };
  }
  return {
    id: 'relic-offer',
    headline: 'A WORD FROM THE BACKROOM',
    blurb: 'A lasting edge is on the table — pick one.',
    kind: 'relic',
    mods: NO_MODIFIERS,
    relicChoices: choices,
  };
}
