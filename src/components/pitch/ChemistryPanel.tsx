import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Shield, Sparkles, Users } from 'lucide-react';
import { tagLabel, type ChemistryResult } from '@/lib/chemistry';
import { XI_SIZE } from '@/lib/types';

interface ChemistryPanelProps {
  chemistry: ChemistryResult;
  filled: number;
  /** Effective match strength after event/relic modifiers (defaults to raw). */
  attack?: number;
  defense?: number;
}

/** Live team strength + active synergies. Explains *why* the numbers move. */
export default function ChemistryPanel({
  chemistry,
  filled,
  attack,
  defense,
}: ChemistryPanelProps) {
  const { totalAttack, totalDefense, synergies } = chemistry;
  const shownAttack = attack ?? Math.round(totalAttack);
  const shownDefense = defense ?? Math.round(totalDefense);

  return (
    <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl">Team Strength</h2>
        <span className="flex items-center gap-1 text-xs text-chrome-muted">
          <Users size={13} />
          {filled}/{XI_SIZE}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StrengthStat
          icon={<Swords size={15} />}
          label="Attack"
          value={shownAttack}
          accent="text-rose-300"
        />
        <StrengthStat
          icon={<Shield size={15} />}
          label="Defense"
          value={shownDefense}
          accent="text-sky-300"
        />
      </div>

      <div className="mt-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-chrome-muted">
          <Sparkles size={13} className="text-crt-green" />
          Active Synergies
        </p>
        {synergies.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 px-3 py-2 text-sm text-chrome-muted">
            No synergies yet — field 2+ starters sharing a tag for +10%.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {synergies.map((s) => (
                <motion.li
                  key={s.tag}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="flex items-center justify-between rounded-lg border border-crt-green/30 bg-crt-green/10 px-3 py-1.5"
                >
                  <span className="font-display text-sm text-crt-green">
                    {tagLabel(s.tag)}
                  </span>
                  <span className="text-xs text-chrome-muted">
                    ×{s.count} · +{s.count >= 2 ? 10 : 0}%
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

function StrengthStat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-pitch-800/60 p-3">
      <div className={`flex items-center gap-1.5 ${accent}`}>
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <motion.p
        key={value}
        initial={{ scale: 1.15, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mt-1 font-display text-3xl text-crt-green"
      >
        {value}
      </motion.p>
    </div>
  );
}
