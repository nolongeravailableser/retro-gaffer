import { describe, it, expect } from 'vitest';
import { buildShotMap, channelPhrase } from '@/lib/shotmap';
import type { VizScene } from '@/lib/matchviz';

/** Minimal scene whose final ball point is (x,y). */
function scene(kind: VizScene['kind'], side: 'A' | 'B', x: number, y: number): VizScene {
  return { kind, side, ball: [{ t: 0, x: 0.5, y: 0.5 }, { t: 1, x, y }], shiftA: 0, shiftB: 0 };
}

describe('buildShotMap', () => {
  it('extracts only goal/chance scenes as shots, tagging goals', () => {
    const scenes = [
      scene('goal', 'A', 0.9, 0.5),
      scene('chance', 'A', 0.85, 0.2),
      scene('yellow', 'A', 0.4, 0.4), // ignored
      scene('flavour', 'B', 0.5, 0.5), // ignored
      scene('goal', 'B', 0.1, 0.5),
    ];
    const m = buildShotMap(scenes);
    expect(m.shots).toHaveLength(3);
    expect(m.yours.goals).toBe(1);
    expect(m.yours.chances).toBe(1);
    expect(m.theirs.goals).toBe(1);
    expect(m.theirs.chances).toBe(0);
  });

  it('reports the dominant channel from shot y-positions', () => {
    const scenes = [
      scene('chance', 'A', 0.9, 0.1), // left
      scene('goal', 'A', 0.9, 0.15), // left
      scene('chance', 'A', 0.9, 0.5), // central
    ];
    expect(buildShotMap(scenes).yours.channel).toBe('left');
  });

  it('central shots read as central', () => {
    const scenes = [scene('chance', 'A', 0.88, 0.5), scene('goal', 'A', 0.9, 0.55)];
    expect(buildShotMap(scenes).yours.channel).toBe('central');
  });

  it('no shots → null channel, empty counts', () => {
    const m = buildShotMap([scene('yellow', 'A', 0.4, 0.4)]);
    expect(m.shots).toHaveLength(0);
    expect(m.yours.channel).toBeNull();
    expect(m.yours.goals).toBe(0);
  });

  it('channelPhrase renders plain English', () => {
    expect(channelPhrase('central')).toBe('through the middle');
    expect(channelPhrase('left')).toBe('down the left');
    expect(channelPhrase('right')).toBe('down the right');
    expect(channelPhrase(null)).toBe('');
  });
});
