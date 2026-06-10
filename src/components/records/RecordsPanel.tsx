import { Trophy, Star, Infinity as InfinityIcon, CalendarDays, Briefcase, Library } from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { POOL } from '@/data/pool';
import { bestLabel } from '@/lib/ladder';
import { formatScore } from '@/lib/score';
import { SCENARIOS } from '@/lib/scenarios';
import { RARITIES, type Rarity } from '@/lib/types';

const RARITY_COLORS: Record<Rarity, { text: string; bar: string }> = {
  bronze: { text: 'text-amber-300', bar: 'bg-amber-500' },
  silver: { text: 'text-slate-200', bar: 'bg-slate-300' },
  gold: { text: 'text-yellow-200', bar: 'bg-yellow-400' },
  icon: { text: 'text-fuchsia-200', bar: 'bg-fuchsia-400' },
};

/** All-time achievements: collection, personal bests, scenario stars. */
export default function RecordsPanel() {
  const collection = useGameStore((s) => s.collection);
  const bestScore = useGameStore((s) => s.bestScore);
  const careerBest = useGameStore((s) => s.careerBest);
  const best = useGameStore((s) => s.best);
  const scenarioStars = useGameStore((s) => s.scenarioStars);

  // Collection counts by rarity (discovered vs pool total).
  const owned = new Set(collection);
  const totalByRarity: Record<Rarity, number> = { bronze: 0, silver: 0, gold: 0, icon: 0 };
  const haveByRarity: Record<Rarity, number> = { bronze: 0, silver: 0, gold: 0, icon: 0 };
  for (const p of POOL) {
    totalByRarity[p.rarity]++;
    if (owned.has(p.id)) haveByRarity[p.rarity]++;
  }
  const discovered = collection.filter((id) => getPlayer(id)).length;

  const totalStars = Object.values(scenarioStars).reduce((a, b) => a + b, 0);
  const maxStars = SCENARIOS.length * 3;

  const tiles: { icon: React.ElementType; label: string; value: string }[] = [
    { icon: Library, label: 'Players signed', value: `${discovered}/${POOL.length}` },
    { icon: Trophy, label: 'Career-best division', value: bestLabel(best.round) },
    { icon: InfinityIcon, label: 'Best Endless', value: bestScore.endless ? formatScore(bestScore.endless) : '—' },
    { icon: CalendarDays, label: 'Best Daily', value: bestScore.daily ? formatScore(bestScore.daily) : '—' },
    { icon: Briefcase, label: 'Best career', value: careerBest > 0 ? `${careerBest} seasons` : '—' },
    { icon: Star, label: 'Scenario stars', value: `${totalStars}/${maxStars}` },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Trophy size={18} className="text-crt-amber" />
        <h2 className="font-display text-xl">Records</h2>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-white/10 bg-pitch-800/50 px-3 py-2">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-chrome-muted">
              <t.icon size={11} className="text-crt-green" />
              {t.label}
            </p>
            <p className="mt-0.5 font-display text-chrome">{t.value}</p>
          </div>
        ))}
      </div>

      {/* Collection by rarity */}
      <p className="mt-4 mb-2 font-display text-xs uppercase tracking-wide text-chrome-muted">
        Collection by rarity
      </p>
      <div className="flex flex-col gap-1.5">
        {RARITIES.map((r) => {
          const have = haveByRarity[r];
          const total = totalByRarity[r];
          const pct = total ? Math.round((have / total) * 100) : 0;
          const rc = RARITY_COLORS[r];
          return (
            <div key={r} className="flex items-center gap-2">
              <span className={`w-12 shrink-0 text-[10px] font-display uppercase ${rc.text}`}>
                {r}
              </span>
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full ${rc.bar}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-12 shrink-0 text-right font-ticker text-xs text-chrome-muted">
                {have}/{total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
