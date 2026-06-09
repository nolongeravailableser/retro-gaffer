import { Target, Play, Trophy } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { SCENARIOS } from '@/lib/scenarios';
import Stars from '@/components/ui/Stars';

interface ScenariosPanelProps {
  /** Called after a scenario run is started (e.g. to switch tabs). */
  onStart?: () => void;
}

/** Authored challenge puzzles with star grading. */
export default function ScenariosPanel({ onStart }: ScenariosPanelProps) {
  const startScenario = useGameStore((s) => s.startScenario);
  const scenarioStars = useGameStore((s) => s.scenarioStars);
  const activeScenario = useGameStore((s) => s.scenario);

  const play = (id: string) => {
    startScenario(id);
    onStart?.();
  };

  return (
    <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-4">
      <div className="mb-1 flex items-center gap-2">
        <Target size={18} className="text-crt-green" />
        <h2 className="font-display text-xl">Scenarios</h2>
      </div>
      <p className="mb-3 text-[11px] text-chrome-muted">
        Authored challenges — fixed squads, fixed stakes. Earn up to ★★★.
      </p>

      <div className="flex flex-col gap-2.5">
        {SCENARIOS.map((sc) => {
          const best = scenarioStars[sc.id] ?? 0;
          const active = activeScenario === sc.id;
          return (
            <div
              key={sc.id}
              className={[
                'rounded-lg border p-3',
                active ? 'border-crt-green/50 bg-crt-green/5' : 'border-white/10 bg-pitch-800/40',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-display text-sm text-chrome">
                    <span>{sc.emoji}</span>
                    {sc.name}
                    {best === 3 && <Trophy size={13} className="text-crt-amber" />}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-chrome-muted">{sc.blurb}</p>
                </div>
                <Stars earned={best} />
              </div>

              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0 text-[11px]">
                  <p className="flex items-center gap-1 text-chrome-muted">
                    <Target size={11} className="shrink-0 text-crt-green/70" />
                    <span className="truncate">{sc.objective}</span>
                  </p>
                  <p className="mt-0.5 text-chrome-muted/70">{sc.starText}</p>
                </div>
                <button
                  type="button"
                  onClick={() => play(sc.id)}
                  data-testid={`scenario-${sc.id}`}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-crt-green/40 bg-crt-green/15 px-3 py-1.5 font-display text-xs text-crt-green hover:bg-crt-green/25"
                >
                  <Play size={13} />
                  {active ? 'Restart' : 'Play'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
