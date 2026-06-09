import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Dice5, Trophy, Infinity as InfinityIcon } from 'lucide-react';
import { MODES, type ModeId } from '@/lib/modes';
import { MUTATORS } from '@/lib/mutators';
import { useGameStore } from '@/store/useGameStore';

interface NewRunModalProps {
  open: boolean;
  onClose: () => void;
}

const MODE_ICONS: Record<ModeId, React.ElementType> = {
  classic: Trophy,
  endless: InfinityIcon,
};

/** 'none' and 'random' are UI-only sentinels; everything else is a mutator id. */
type MutatorChoice = 'none' | 'random' | string;

/** Run setup: pick a mode + optional run mutator, then start (resets the run). */
export default function NewRunModal({ open, onClose }: NewRunModalProps) {
  const startRun = useGameStore((s) => s.startRun);
  const [mode, setMode] = useState<ModeId>('classic');
  const [choice, setChoice] = useState<MutatorChoice>('none');

  const start = () => {
    let mutatorId: string | null = null;
    if (choice === 'random') {
      // UI-time randomness is fine here — the run's own seeds stay deterministic.
      mutatorId = MUTATORS[Math.floor(Math.random() * MUTATORS.length)].id;
    } else if (choice !== 'none') {
      mutatorId = choice;
    }
    startRun(mode, mutatorId);
    onClose();
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
              </div>

              {/* Modifier */}
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
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-crt-dim bg-pitch-900/80 px-5 py-3">
              <span className="text-[11px] text-chrome-muted">Resets your squad &amp; bankroll.</span>
              <button
                type="button"
                onClick={start}
                className="flex items-center gap-1.5 rounded-md border border-crt-green/50 bg-crt-green/20 px-4 py-2 font-display text-sm text-crt-green hover:bg-crt-green/30"
              >
                <Play size={15} /> Start Run
              </button>
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
