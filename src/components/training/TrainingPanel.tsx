import { Dumbbell, Sword, Shield, Scale, HeartPulse, Armchair, Star } from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import {
  TRAINING_FOCI,
  sharpnessBand,
  fatigueBand,
  type TrainingFocus,
} from '@/lib/training';
import { morale as playerMorale } from '@/lib/morale';
import { captainOf, dressingRoomMood, moodLabel } from '@/lib/squad';
import { overall } from '@/lib/wages';
import { avgRating } from '@/lib/ratings';
import type { Player } from '@/lib/types';

const FOCUS_ICON: Record<TrainingFocus, React.ElementType> = {
  attacking: Sword,
  balanced: Scale,
  defensive: Shield,
  fitness: HeartPulse,
};

/**
 * Weekly training focus + a squad condition readout (Career/League). The focus
 * subtly tilts the squad each match; sharpness/fatigue reward a settled XI and
 * rotation respectively.
 */
export default function TrainingPanel() {
  const training = useGameStore((s) => s.training);
  const setTraining = useGameStore((s) => s.setTraining);
  const owned = useGameStore((s) => s.owned);
  const sharpness = useGameStore((s) => s.sharpness);
  const fatigue = useGameStore((s) => s.fatigue);
  const playerHistory = useGameStore((s) => s.playerHistory);

  const squad = owned.map(getPlayer).filter((p): p is Player => !!p);
  const tired = squad.filter((p) => fatigueBand(fatigue[p.id]) === 'tired').length;
  const rusty = squad.filter((p) => sharpnessBand(sharpness[p.id]) === 'rusty').length;

  // Dressing-room dynamics: a captain (squad leader) + the collective mood.
  const moraleOf = (p: Player) => {
    const h = playerHistory[p.id];
    return playerMorale(h ? avgRating(h) : null, sharpness[p.id]);
  };
  const captain = captainOf(squad, overall);
  const mood = dressingRoomMood(squad.map(moraleOf));
  const moodTone =
    mood === 'buzzing' ? 'text-crt-green' : mood === 'settled' ? 'text-chrome' : mood === 'tense' ? 'text-crt-amber' : 'text-rose-300';

  return (
    <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-4" data-testid="training-panel">
      <div className="mb-3 flex items-center gap-2">
        <Dumbbell size={18} className="text-crt-green" />
        <h2 className="font-display text-xl">Training</h2>
        <span className="ml-auto font-ticker text-[11px] text-chrome-muted">
          {rusty > 0 && <span className="text-crt-amber">{rusty} rusty</span>}
          {rusty > 0 && tired > 0 && ' · '}
          {tired > 0 && <span className="text-rose-300">{tired} tired</span>}
          {rusty === 0 && tired === 0 && 'squad in good shape'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TRAINING_FOCI.map((f) => {
          const Icon = FOCUS_ICON[f.id];
          const active = training === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setTraining(f.id)}
              data-testid={`focus-${f.id}`}
              title={f.blurb}
              className={[
                'flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center transition',
                active
                  ? 'border-crt-green bg-crt-green/15 text-crt-green'
                  : 'border-white/10 text-chrome-muted hover:bg-white/5 hover:text-chrome',
              ].join(' ')}
            >
              <Icon size={16} />
              <span className="font-display text-xs">{f.label}</span>
            </button>
          );
        })}
      </div>

      {/* Dressing room: captain + collective mood */}
      {squad.length > 0 && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-pitch-950/40 px-3 py-2" data-testid="dressing-room">
          <span className="flex items-center gap-1.5 font-ticker text-[11px] text-chrome-muted">
            <Armchair size={13} /> Dressing room:{' '}
            <span className={`font-display ${moodTone}`}>{moodLabel(mood)}</span>
          </span>
          {captain && (
            <span className="flex items-center gap-1 font-ticker text-[11px] text-chrome-muted">
              <Star size={12} className="text-crt-amber" /> Captain:{' '}
              <span className="text-chrome">{captain.name}</span>
            </span>
          )}
        </div>
      )}

      <p className="mt-2.5 font-ticker text-[11px] text-chrome-muted">
        {TRAINING_FOCI.find((f) => f.id === training)?.blurb} A settled XI stays sharp; rest tired
        players to keep them fresh.
      </p>
    </div>
  );
}
