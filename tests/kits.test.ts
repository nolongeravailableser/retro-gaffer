import { describe, it, expect } from 'vitest';
import {
  kitForTeam,
  resolveKits,
  colorDistance,
  gkColor,
  sanitizeKit,
  CLASH_THRESHOLD,
  KIT_PALETTE,
  KIT_PATTERNS,
  DEFAULT_KIT,
  type Kit,
} from '@/lib/kits';

const RIVALS = [
  'Wanderers AFC', 'Albion Rovers', 'Real Sociopaths', 'Dynamo Disappointment',
  'Athletic Hangover', 'Sporting Mediocre', 'Inter Pub League', 'FC Relegation',
  'Hartlepool Galacticos', 'Accrington Stanley XI',
];
const BOSSES = ['2008 Derby County', "Galacticos '03", "Invincibles '04"];

describe('kitForTeam', () => {
  it('is deterministic for any name', () => {
    expect(kitForTeam('Some PvP Club')).toEqual(kitForTeam('Some PvP Club'));
    expect(kitForTeam('Wanderers AFC')).toEqual(kitForTeam('Wanderers AFC'));
  });

  it('every named opponent has a distinct identity', () => {
    const all = [...RIVALS, ...BOSSES].map((n) => ({ n, k: kitForTeam(n) }));
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i].k;
        const b = all[j].k;
        const looksSame =
          colorDistance(a.primary, b.primary) < 60 && a.pattern === b.pattern;
        expect(looksSame, `${all[i].n} vs ${all[j].n}`).toBe(false);
      }
    }
  });

  it('hash-fallback kits are well-formed', () => {
    for (const name of ['Zebra Utd', 'GAFFER-PVP-XI', 'X']) {
      const k = kitForTeam(name);
      expect(KIT_PALETTE).toContain(k.primary);
      expect(KIT_PALETTE).toContain(k.secondary);
      expect(k.secondary).not.toBe(k.primary);
      expect(KIT_PATTERNS).toContain(k.pattern);
    }
  });
});

describe('resolveKits', () => {
  it('always yields visually distinct shirts, whatever the player wears', () => {
    for (const primary of KIT_PALETTE) {
      const playerKit: Kit = { primary, secondary: '#0a1f12', pattern: 'stripes' };
      for (const opp of [...RIVALS, ...BOSSES, 'Mystery PvP FC']) {
        const { a, b } = resolveKits(playerKit, opp);
        expect(a).toEqual(playerKit); // the player always wears their own kit
        expect(
          colorDistance(a.primary, b.primary),
          `${primary} vs ${opp} → ${b.primary}`
        ).toBeGreaterThanOrEqual(CLASH_THRESHOLD);
      }
    }
  });

  it('keeps the home kit when there is no clash', () => {
    // Neon green player vs Athletic Hangover (red) — no clash, home kit kept.
    const { b } = resolveKits(DEFAULT_KIT, 'Athletic Hangover');
    expect(b).toEqual(kitForTeam('Athletic Hangover'));
  });

  it('switches a clashing opponent to an away/third kit deterministically', () => {
    // White player kit vs 2008 Derby County (white) — must change shirts.
    const white: Kit = { primary: '#ffffff', secondary: '#111827', pattern: 'solid' };
    const one = resolveKits(white, '2008 Derby County');
    const two = resolveKits(white, '2008 Derby County');
    expect(one).toEqual(two);
    expect(one.b.primary).not.toBe('#ffffff');
  });
});

describe('gkColor', () => {
  it('keeps the keeper away from his own outfield colour', () => {
    for (const primary of KIT_PALETTE) {
      const c = gkColor({ primary, secondary: '#0a1f12', pattern: 'solid' });
      expect(colorDistance(primary, c)).toBeGreaterThanOrEqual(CLASH_THRESHOLD);
    }
  });
});

describe('sanitizeKit', () => {
  it('accepts a valid kit and rejects malformed input', () => {
    expect(sanitizeKit(DEFAULT_KIT)).toEqual(DEFAULT_KIT);
    expect(sanitizeKit(null)).toBeNull();
    expect(sanitizeKit({ primary: 'green', secondary: '#fff000', pattern: 'solid' })).toBeNull();
    expect(sanitizeKit({ primary: '#39ff14', secondary: '#0a1f12', pattern: 'zigzag' })).toBeNull();
    expect(sanitizeKit('kit')).toBeNull();
  });
});
