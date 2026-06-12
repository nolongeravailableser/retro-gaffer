import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, ArrowRight, MapPin } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { division } from '@/lib/league';
import { careerHonours } from '@/lib/career';
import { managerReputation, reputationLabel, type Vacancy } from '@/lib/jobs';

/** How the inherited squad reads relative to its division (what you're taking on). */
function statureLabel(v: Vacancy): string {
  const base = division(v.tier).baseStrength;
  const ratio = v.strength / base;
  if (ratio >= 1.05) return 'Strong squad';
  if (ratio <= 0.92) return 'Modest squad';
  return 'Solid squad';
}

/**
 * The Job Market — shown over everything after a sacking. A manager's career is
 * never over: your reputation gates which clubs will have you, and applying for
 * one continues your career at that club (with its inherited squad + division).
 */
export default function JobMarket() {
  const jobMarket = useGameStore((s) => s.jobMarket);
  const career = useGameStore((s) => s.career);
  const managerName = useGameStore((s) => s.managerName);
  const takeJob = useGameStore((s) => s.takeJob);

  if (!jobMarket || !career) return null;
  const rep = managerReputation(careerHonours(career.history));
  const label = reputationLabel(rep);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/85 p-4">
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border-2 border-crt-amber bg-pitch-950 shadow-glow"
        >
          <div className="border-b border-crt-dim bg-pitch-900/80 px-5 py-5 text-center">
            <Briefcase className="mx-auto mb-2 text-crt-amber" size={34} />
            <h2 className="font-display text-lg text-crt-amber">On the market</h2>
            <p className="mt-1 text-sm text-chrome-muted">
              {managerName ? `${managerName}, you've` : "You've"} been sacked — but your
              career goes on. Apply for a new club.
            </p>
            <div className="mx-auto mt-3 max-w-xs">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-chrome-muted">
                <span>Reputation</span>
                <span className="text-crt-green">{label} · {rep}/100</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-pitch-800">
                <div className="h-full bg-crt-green" style={{ width: `${rep}%` }} />
              </div>
            </div>
          </div>

          <div className="space-y-2 overflow-y-auto px-4 py-4">
            {jobMarket.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-crt-dim bg-pitch-900/60 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-crt-green">{v.clubName}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-chrome-muted">
                    <MapPin size={12} className="shrink-0" />
                    {division(v.tier).name} · {statureLabel(v)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => takeJob(v)}
                  className="flex shrink-0 items-center gap-1 rounded border border-crt-amber px-3 py-1.5 text-sm text-crt-amber transition hover:bg-crt-amber hover:text-pitch-950"
                >
                  Apply <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>

          <p className="border-t border-crt-dim bg-pitch-900/40 px-5 py-2.5 text-center text-[11px] text-chrome-muted">
            Bigger clubs come calling as your reputation grows.
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
