import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Users } from 'lucide-react';
import { tagLabel, type ChemistryResult } from '@/lib/chemistry';
import { XI_SIZE } from '@/lib/types';

interface ChemistryPanelProps {
  chemistry: ChemistryResult;
  filled: number;
}

/**
 * Active chemistry synergies — which shared tags are lighting up the XI and
 * what each adds. Team ATK/DEF live in the strength chips beside the formation
 * picker (design-mockups/02: "strength is a toolbar chip, not a panel below the
 * fold"), so this panel focuses on the *why* behind the numbers.
 */
export default function ChemistryPanel({ chemistry, filled }: ChemistryPanelProps) {
  const { synergies } = chemistry;

  return (
    <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 font-display text-xl">
          <Sparkles size={16} className="text-crt-green" />
          Chemistry
        </h2>
        <span className="flex items-center gap-1 text-xs text-chrome-muted">
          <Users size={13} />
          {filled}/{XI_SIZE}
        </span>
      </div>

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
                <span className="font-display text-sm text-crt-green">{tagLabel(s.tag)}</span>
                <span className="text-xs text-chrome-muted">
                  ×{s.count} · +{s.count >= 2 ? 10 : 0}%
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
