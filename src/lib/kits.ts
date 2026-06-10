/**
 * Team kits — visual identity for every side on the pitch. Pure & UI-agnostic.
 *
 *  - The PLAYER designs a kit (curated palette × pattern) during onboarding or
 *    later in Club settings; it persists like the club name.
 *  - Every NAMED opponent (the 10 rival clubs + the 3 bosses) has an authored
 *    kit; unknown names (PvP imports) hash deterministically to a palette kit,
 *    so the same opponent always wears the same shirt.
 *  - resolveKits() guarantees the two sides are visually distinct: a clash
 *    swaps the opposition to an away variant, escalating to a guaranteed-
 *    contrast fallback. Deterministic — the same fixture always looks the same.
 */

import { hashSeed } from './rng';

export type KitPattern = 'solid' | 'stripes' | 'hoops' | 'sash' | 'halves';

export interface Kit {
  /** Shirt colour (hex). */
  primary: string;
  /** Accent colour the pattern is drawn in (hex). */
  secondary: string;
  pattern: KitPattern;
}

export const KIT_PATTERNS: KitPattern[] = ['solid', 'stripes', 'hoops', 'sash', 'halves'];

/** Curated shirt colours — every one reads clearly on the dark pitch. */
export const KIT_PALETTE: string[] = [
  '#39ff14', // classic neon green
  '#ffb000', // amber
  '#ff4d4d', // red
  '#4da6ff', // sky blue
  '#3b82f6', // royal blue
  '#ffffff', // white
  '#e879f9', // fuchsia
  '#ff7a1a', // tangerine
  '#2dd4bf', // teal
  '#a78bfa', // violet
];

/** The classic strip worn before a kit is designed. */
export const DEFAULT_KIT: Kit = { primary: '#39ff14', secondary: '#0a1f12', pattern: 'solid' };

/** Authored identities for every named opponent in the database. */
const TEAM_KITS: Record<string, Kit> = {
  // Rival clubs (see opponent.ts RIVAL_NAMES)
  'Wanderers AFC':          { primary: '#e2e8f0', secondary: '#111827', pattern: 'stripes' },
  'Albion Rovers':          { primary: '#3b82f6', secondary: '#ffffff', pattern: 'halves' },
  'Real Sociopaths':        { primary: '#9f1239', secondary: '#7dd3fc', pattern: 'hoops' },
  'Dynamo Disappointment':  { primary: '#a78bfa', secondary: '#ffffff', pattern: 'solid' },
  'Athletic Hangover':      { primary: '#ff4d4d', secondary: '#ffffff', pattern: 'stripes' },
  'Sporting Mediocre':      { primary: '#2dd4bf', secondary: '#0f172a', pattern: 'hoops' },
  'Inter Pub League':       { primary: '#3b82f6', secondary: '#111827', pattern: 'stripes' },
  'FC Relegation':          { primary: '#94a3b8', secondary: '#475569', pattern: 'solid' },
  'Hartlepool Galacticos':  { primary: '#fde047', secondary: '#3b82f6', pattern: 'sash' },
  'Accrington Stanley XI':  { primary: '#ff7a1a', secondary: '#ffffff', pattern: 'hoops' },
  // Bosses (see bosses.ts)
  '2008 Derby County':      { primary: '#ffffff', secondary: '#111827', pattern: 'solid' },
  "Galacticos '03":         { primary: '#ffffff', secondary: '#ffd700', pattern: 'sash' },
  "Invincibles '04":        { primary: '#ef4444', secondary: '#ffffff', pattern: 'solid' },
};

/** Euclidean RGB distance between two hex colours (0–441). */
export function colorDistance(a: string, b: string): number {
  const rgb = (h: string) => {
    const v = parseInt(h.replace('#', ''), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  };
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/** Two shirts are confusable below this distance. */
export const CLASH_THRESHOLD = 100;

/** The kit a team wears at home. Authored where known, hashed where not. */
export function kitForTeam(name: string): Kit {
  const authored = TEAM_KITS[name];
  if (authored) return authored;
  // NOTE: >>> keeps the shifts unsigned — a signed >> can go negative and
  // produce a negative modulo (undefined palette index).
  const h = hashSeed(`kit-${name}`);
  const primary = KIT_PALETTE[h % KIT_PALETTE.length];
  let secondary = KIT_PALETTE[(h >>> 3) % KIT_PALETTE.length];
  if (secondary === primary) {
    secondary = KIT_PALETTE[((h >>> 3) + 3) % KIT_PALETTE.length];
  }
  return { primary, secondary, pattern: KIT_PATTERNS[(h >>> 7) % KIT_PATTERNS.length] };
}

/** High-contrast emergency shirts, tried in order. */
const CONTRAST_FALLBACKS = ['#e879f9', '#ffb000', '#ffffff', '#3b82f6', '#ff4d4d'];

/**
 * Resolve what both sides wear for a fixture: the player's kit as picked, and
 * the opposition's home kit unless it clashes — then their away variant
 * (colours swapped), then a guaranteed-contrast fallback. Deterministic.
 */
export function resolveKits(playerKit: Kit, oppName: string): { a: Kit; b: Kit } {
  const home = kitForTeam(oppName);
  if (colorDistance(playerKit.primary, home.primary) >= CLASH_THRESHOLD) {
    return { a: playerKit, b: home };
  }
  // Away variant: swap shirt and accent.
  const away: Kit = { primary: home.secondary, secondary: home.primary, pattern: home.pattern };
  if (colorDistance(playerKit.primary, away.primary) >= CLASH_THRESHOLD) {
    return { a: playerKit, b: away };
  }
  // Third kit: first emergency colour that contrasts with BOTH shirts.
  const third = CONTRAST_FALLBACKS.find(
    (c) => colorDistance(playerKit.primary, c) >= CLASH_THRESHOLD
  ) ?? '#e879f9';
  return { a: playerKit, b: { primary: third, secondary: home.primary, pattern: 'solid' } };
}

/** What the keeper wears: a shirt far from his own side's outfield colour. */
export function gkColor(kit: Kit): string {
  return (
    CONTRAST_FALLBACKS.find((c) => colorDistance(kit.primary, c) >= CLASH_THRESHOLD) ?? '#ffb000'
  );
}

/** Validate an untrusted kit (imported saves); null when malformed. */
export function sanitizeKit(k: unknown): Kit | null {
  if (!k || typeof k !== 'object') return null;
  const kit = k as Partial<Kit>;
  const hex = /^#[0-9a-fA-F]{6}$/;
  if (typeof kit.primary !== 'string' || !hex.test(kit.primary)) return null;
  if (typeof kit.secondary !== 'string' || !hex.test(kit.secondary)) return null;
  if (!KIT_PATTERNS.includes(kit.pattern as KitPattern)) return null;
  return { primary: kit.primary, secondary: kit.secondary, pattern: kit.pattern as KitPattern };
}
