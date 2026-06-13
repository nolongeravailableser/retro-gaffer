import { describe, it, expect } from 'vitest';
import { recordAlumnus, alumniNews, ALUMNI_CAP, type Alumnus } from '@/lib/alumni';
import { migrateSave, CURRENT_VERSION } from '@/store/persistence';

const mk = (id: string, season: number, ovr: number): Alumnus => ({ id, name: id, season, ovr });

describe('recordAlumnus', () => {
  it('prepends newest and de-dupes by id', () => {
    let a: Alumnus[] = [];
    a = recordAlumnus(a, mk('p1', 1, 80));
    a = recordAlumnus(a, mk('p2', 2, 70));
    a = recordAlumnus(a, mk('p1', 3, 99)); // dup id — ignored, keeps first record
    expect(a.map((x) => x.id)).toEqual(['p2', 'p1']);
    expect(a.find((x) => x.id === 'p1')!.ovr).toBe(80);
  });

  it('caps the list', () => {
    let a: Alumnus[] = [];
    for (let i = 0; i < ALUMNI_CAP + 10; i++) a = recordAlumnus(a, mk(`p${i}`, 1, 70));
    expect(a.length).toBe(ALUMNI_CAP);
  });
});

describe('alumniNews', () => {
  it('returns null until someone has had a season elsewhere', () => {
    expect(alumniNews([mk('p1', 5, 80)], 5, 'seed')).toBeNull(); // left this very season
    expect(alumniNews([], 5, 'seed')).toBeNull();
  });

  it('produces a story about an eligible alumnus, deterministically', () => {
    const alumni = [mk('p1', 2, 85), mk('p2', 3, 60)];
    const a = alumniNews(alumni, 5, 'seed-x');
    expect(a).not.toBeNull();
    expect(['p1', 'p2']).toContain(a!.alumnusId);
    expect(a!.body.length).toBeGreaterThan(0);
    expect(alumniNews(alumni, 5, 'seed-x')).toEqual(a); // same seed → same story
  });

  it('different seasons can tell different stories (seeded by season)', () => {
    const alumni = [mk('p1', 1, 88), mk('p2', 1, 66), mk('p3', 1, 72)];
    const s5 = alumniNews(alumni, 5, 'seed');
    const s6 = alumniNews(alumni, 6, 'seed');
    expect(s5).not.toBeNull();
    expect(s6).not.toBeNull();
    // (not asserting they differ — just that both are valid and seeded)
    expect(alumniNews(alumni, 6, 'seed')).toEqual(s6);
  });
});

describe('persistence v31 migration', () => {
  it('backfills alumni: [] on a pre-v31 save', () => {
    const old = { bankroll: 50, xi: [], bench: [], owned: [], inbox: [] };
    const migrated = migrateSave(old, 30) as { alumni?: unknown };
    expect(migrated.alumni).toEqual([]);
    expect(CURRENT_VERSION).toBeGreaterThanOrEqual(31);
  });

  it('leaves an existing alumni list intact', () => {
    const save = { bankroll: 50, xi: [], bench: [], owned: [], inbox: [], alumni: [mk('x', 1, 70)] };
    const migrated = migrateSave(save, 31) as { alumni: Alumnus[] };
    expect(migrated.alumni).toHaveLength(1);
  });
});
