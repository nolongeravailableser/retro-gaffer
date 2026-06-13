import { describe, it, expect } from 'vitest';
import { opponentBriefing } from '@/lib/briefing';
import { POOL } from '@/data/pool';

const squad = POOL.slice(0, 11);

describe('opponentBriefing', () => {
  it('attack-leaning side → attack threat + compact plan', () => {
    const b = opponentBriefing({ attack: 900, defense: 700, squad });
    expect(b.lean).toBe('attack');
    expect(b.threat).toMatch(/Dangerous in attack/);
    expect(b.plan).toMatch(/compact|break/i);
  });

  it('defence-leaning side → hard-to-break-down + patient plan', () => {
    const b = opponentBriefing({ attack: 700, defense: 900, squad });
    expect(b.lean).toBe('defence');
    expect(b.threat).toMatch(/Hard to break down/);
    expect(b.plan).toMatch(/patient|wide/i);
  });

  it('even side → balanced, no obvious weakness', () => {
    const b = opponentBriefing({ attack: 800, defense: 800, squad });
    expect(b.lean).toBe('balanced');
    expect(b.threat).toMatch(/balanced/i);
  });

  it('is deterministic', () => {
    const opp = { attack: 880, defense: 760, squad };
    expect(opponentBriefing(opp)).toEqual(opponentBriefing(opp));
  });
});
