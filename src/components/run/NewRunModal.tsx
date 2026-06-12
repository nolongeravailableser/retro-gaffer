import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Dice5, Trophy, Infinity as InfinityIcon, Briefcase, ListOrdered, Swords, AlertTriangle } from 'lucide-react';
import { MODES, type ModeId } from '@/lib/modes';
import { MUTATORS } from '@/lib/mutators';
import { useGameStore } from '@/store/useGameStore';

interface NewRunModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a run/career is started (so the app can show the squad screen). */
  onStarted?: () => void;
}

/** UI-only selection: a real mode id, or 'career' (a meta-mode of many seasons). */
type ModeChoice = ModeId | 'career';

const MODE_ICONS: Record<ModeId, React.ElementType> = {
  classic: Trophy,
  endless: InfinityIcon,
  league: ListOrdered,
  cup: Swords,
};

/** 'none' and 'random' are UI-only sentinels; everything else is a mutator id. */
type MutatorChoice = 'none' | 'random' | string;

/** Run setup: pick a mode + optional run mutator, then start (resets the run). */
export default function NewRunModal({ open, onClose, onStarted }: NewRunModalProps) {
  const startRun = useGameStore((s) => s.startRun);
  const startCareer = useGameStore((s) => s.startCareer);
  const startLeague = useGameStore((s) => s.startLeague);
  const startCup = useGameStore((s) => s.startCup);
  const runStatus = useGameStore((s) => s.runStatus);
  const round = useGameStore((s) => s.round);
  const ownedCount = useGameStore((s) => s.owned.length);
  const career = useGameStore((s) => s.career);
  const [mode, setMode] = useState<ModeChoice>('classic');
  const [choice, setChoice] = useState<MutatorChoice>('none');
  const [confirming, setConfirming] = useState(false);

  // A run worth warning about losing: in progress with picks made.
  const inProgress =
    runStatus === 'playing' && (round > 1 || ownedCount > 0 || !!career);

  // Reset the confirm step whenever the modal opens/closes.
  useEffect(() => {
    if (!open) setConfirming(false);
  }, [open]);

  const start = () => {
    if (mode === 'career') {
      startCareer();
      onStarted?.();
      onClose();
      return;
    }
    if (mode === 'league') {
      startLeague();
      onStarted?.();
      onClose();
      return;
    }
    if (mode === 'cup') {
      startCup();
      onStarted?.();
      onClose();
      return;
    }
    let mutatorId: string | null = null;
    if (choice === 'random') {
      // UI-time randomness is fine here — the run's own seeds stay deterministic.
      mutatorId = MUTATORS[Math.floor(Math.random() * MUTATORS.length)].id;
    } else if (choice !== 'none') {
      mutatorId = choice;
    }
    startRun(mode, mutatorId);
    onStarted?.();
    onClose();
  };

  // Gate the start behind a confirm step if it would wipe an active run.
  const handleStart = () => {
    if (inProgress && !confirming) {
      setConfirming(true);
      return;
    }
    start();
  };

  const selectedMutator = MUTATORS.find((m) => m.id === choice);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border-2 border-crt-dim bg-pitch-950 shadow-glow"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-crt-dim bg-pitch-900/80 px-5 py-3">
              <h2 className="font-display text-xl text-crt-green">New Run</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="text-chrome-muted hover:text-chrome"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Mode */}
              <p className="mb-2 font-display text-xs uppercase tracking-wide text-chrome-muted">
                Mode
              </p>
              <div className="mb-5 grid grid-cols-2 gap-2">
                {Object.values(MODES).map((m) => {
                  const Icon = MODE_ICONS[m.id];
                  const active = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id)}
                      className={[
                        'flex flex-col gap-1 rounded-lg border p-3 text-left transition',
                        active
                          ? 'border-crt-green bg-crt-green/15'
                          : 'border-white/10 hover:bg-white/5',
                      ].join(' ')}
                    >
                      <span
                        className={`flex items-center gap-1.5 font-display text-sm ${
                          active ? 'text-crt-green' : 'text-chrome'
                        }`}
                      >
                        <Icon size={15} />
                        {m.name}
                      </span>
                      <span className="text-[11px] leading-snug text-chrome-muted">{m.blurb}</span>
                    </button>
                  );
                })}
                {/* Career — a meta-mode of many seasons */}
                <button
                  type="button"
                  onClick={() => setMode('career')}
                  className={[
                    'col-span-2 flex flex-col gap-1 rounded-lg border p-3 text-left transition',
                    mode === 'career'
                      ? 'border-crt-green bg-crt-green/15'
                      : 'border-white/10 hover:bg-white/5',
                  ].join(' ')}
                >
                  <span
                    className={`flex items-center gap-1.5 font-display text-sm ${
                      mode === 'career' ? 'text-crt-green' : 'text-chrome'
                    }`}
                  >
                    <Briefcase size={15} />
                    Career
                  </span>
                  <span className="text-[11px] leading-snug text-chrome-muted">
                    Climb the English pyramid — each season is a league. Win promotion or
                    risk the drop, grow academy youth. Win the Premier League to win it all.
                  </span>
                </button>
              </div>

              {/* Modifier — not applicable to Career, League or Cup */}
              {mode !== 'career' && mode !== 'league' && mode !== 'cup' && (
                <>
                  <p className="mb-2 font-display text-xs uppercase tracking-wide text-chrome-muted">
                    Modifier
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <ChoiceChip label="None" active={choice === 'none'} onClick={() => setChoice('none')} />
                    <ChoiceChip
                      label="Random"
                      icon={<Dice5 size={12} />}
                      active={choice === 'random'}
                      onClick={() => setChoice('random')}
                    />
                    {MUTATORS.map((m) => (
                      <ChoiceChip
                        key={m.id}
                        label={`${m.emoji} ${m.name}`}
                        active={choice === m.id}
                        onClick={() => setChoice(m.id)}
                      />
                    ))}
                  </div>

                  {/* Selected mutator blurb */}
                  <div className="mt-3 min-h-[2.5rem] rounded-lg border border-white/10 bg-pitch-900/60 px-3 py-2 text-xs text-chrome-muted">
                    {choice === 'none' && 'No modifier — the standard ruleset.'}
                    {choice === 'random' && 'A random modifier is rolled when you start.'}
                    {selectedMutator && (
                      <span>
                        <span className="font-display text-chrome">
                          {selectedMutator.emoji} {selectedMutator.name}
                        </span>{' '}
                        — {selectedMutator.blurb}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-crt-dim bg-pitch-900/80 px-5 py-3">
              {confirming ? (
                <>
                  <span className="flex items-center gap-1.5 text-[11px] text-rose-200">
                    <AlertTriangle size={13} className="shrink-0" />
                    This ends your current run. Sure?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className="rounded-md border border-white/15 px-3 py-2 font-display text-sm text-chrome-muted hover:bg-white/5 hover:text-chrome"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={start}
                      className="flex items-center gap-1.5 rounded-md border border-rose-400/50 bg-rose-500/20 px-4 py-2 font-display text-sm text-rose-200 hover:bg-rose-500/30"
                    >
                      <Play size={15} /> End &amp; Start
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-[11px] text-chrome-muted">
                    {inProgress ? 'Ends your current run.' : 'Resets your squad & bankroll.'}
                  </span>
                  <button
                    type="button"
                    onClick={handleStart}
                    className="flex items-center gap-1.5 rounded-md border border-crt-green/50 bg-crt-green/20 px-4 py-2 font-display text-sm text-crt-green hover:bg-crt-green/30"
                  >
                    <Play size={15} /> Start Run
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function ChoiceChip({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-display transition',
        active
          ? 'border-crt-green bg-crt-green/20 text-crt-green'
          : 'border-white/10 text-chrome-muted hover:text-chrome hover:bg-white/5',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  );
}
