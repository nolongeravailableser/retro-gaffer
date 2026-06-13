import { describe, it, expect } from 'vitest';
import { worldNews, pastClubsOf } from '@/lib/worldnews';
import type { Alumnus } from '@/lib/alumni';

const star = (id: string, season: number): Alumnus => ({ id, name: id, season, ovr: 85 });

describe('pastClubsOf', () => {
  it('returns distinct prior clubs, excluding the current one', () => {
    const history = [{ club: 'Oldtown' }, { club: 'Oldtown' }, { club: 'Midcity' }, { club: 'Now FC' }, {}];
    expect(pastClubsOf(history, 'Now FC')).toEqual(['Oldtown', 'Midcity']);
  });

  it('empty when you have only ever managed your current club', () => {
    expect(pastClubsOf([{ club: 'Now FC' }, { club: 'Now FC' }], 'Now FC')).toEqual([]);
  });
});

describe('worldNews', () => {
  it('null when there is no past club and no eligible ex-player', () => {
    expect(worldNews({ alumni: [], pastClubs: [], season: 5, seed: 'x' })).toBeNull();
  });

  it('frames an old club when you have one', () => {
    const item = worldNews({ alumni: [], pastClubs: ['Oldtown'], season: 5, seed: 'seed-1' });
    expect(item).not.toBeNull();
    expect(item!.key).toBe('oldclub-Oldtown');
    expect(item!.body).toContain('Oldtown');
  });

  it('is deterministic for a given season + seed', () => {
    const ctx = { alumni: [star('p1', 1)], pastClubs: ['Oldtown'], season: 5, seed: 'seed-9' };
    expect(worldNews(ctx)).toEqual(worldNews(ctx));
  });

  it('only stars who left a while ago are management candidates', () => {
    // A recent / low-rated departure never becomes the manager beat; with no past
    // club either, there is nothing to report.
    const recent: Alumnus = { id: 'p', name: 'p', season: 5, ovr: 85 }; // left this season
    expect(worldNews({ alumni: [recent], pastClubs: [], season: 5, seed: 's' })).toBeNull();
    const journeyman: Alumnus = { id: 'q', name: 'q', season: 1, ovr: 60 };
    expect(worldNews({ alumni: [journeyman], pastClubs: [], season: 5, seed: 's' })).toBeNull();
  });

  it('a long-gone star can surface as a manager (across seeds)', () => {
    const alumni = [star('legend', 1)];
    const hit = Array.from({ length: 20 }, (_, i) =>
      worldNews({ alumni, pastClubs: [], season: 5, seed: `seed-${i}` })
    ).some((x) => x?.key === 'exmgr-legend');
    expect(hit).toBe(true);
  });
});
