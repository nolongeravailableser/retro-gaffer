import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, ThumbsUp, Coins, GraduationCap, ArrowRight, Check } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { ladderTier } from '@/lib/ladder';
import { boardTarget } from '@/lib/career';
import { ROLE_STYLES } from '@/components/ui/roleStyles';
import StatBar from '@/components/ui/StatBar';

/** Between-seasons board review + academy intake. Shown when a season completes. */
export default function CareerReview() {
  const review = useGameStore((s) => s.careerReview);
  const advance = useGameStore((s) => s.advanceCareerSeason);
  const [picked, setPicked] = useState<string | null>(null);

  if (!review) return null;

  const nextSeason = review.season + 1;
  const nextTarget = boardTarget(nextSeason);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border-2 border-crt-dim bg-pitch-950 shadow-glow"
      >
        {/* Header — board verdict */}
        <div className="border-b border-crt-dim bg-pitch-900/80 px-5 py-4 text-center">
          <div className="mx-auto mb-1 flex items-center justify-center gap-2 text-crt-green">
            {review.triumph ? <Trophy size={24} /> : <ThumbsUp size={20} />}
            <h2 className="font-display text-xl">
              {review.triumph ? 'CHAMPIONS!' : 'BOARD SATISFIED'}
            </h2>
          </div>
          <p className="text-xs text-chrome-muted">
            Season {review.season} — reached {ladderTier(review.reached)}, the board asked for{' '}
            {ladderTier(review.targetRound)}.
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-crt-amber/40 bg-crt-amber/15 px-3 py-1 font-display text-sm text-crt-amber">
            <Coins size={14} /> +£{review.bonus}M board reward
          </p>
        </div>

        {/* Academy intake */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-2 flex items-center gap-1.5 font-display text-sm text-chrome">
            <GraduationCap size={16} className="text-crt-green" />
            Academy Intake
          </p>
          <p className="mb-3 text-[11px] text-chrome-muted">
            Promote one prospect to your squad — they'll develop over the coming seasons. Or
            pass and keep the wage bill down.
          </p>

          <div className="flex flex-col gap-2">
            {review.youth.map((y) => {
              const rs = ROLE_STYLES[y.role];
              const sel = picked === y.id;
              return (
                <button
                  key={y.id}
                  type="button"
                  onClick={() => setPicked(sel ? null : y.id)}
                  className={[
                    'flex items-center gap-3 rounded-lg border p-3 text-left transition',
                    sel ? 'border-crt-green bg-crt-green/10' : 'border-white/10 hover:bg-white/5',
                  ].join(' ')}
                >
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-display ${rs.text} ${rs.bg} ${rs.border}`}
                  >
                    {y.role}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm text-chrome">{y.name}</p>
                    <div className="mt-1 flex flex-col gap-0.5">
                      <StatBar label="ATK" value={y.stats.attack} labelClass="text-rose-300/70" compact />
                      <StatBar label="DEF" value={y.stats.defense} labelClass="text-sky-300/70" compact />
                    </div>
                  </div>
                  <span
                    className={[
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                      sel ? 'border-crt-green bg-crt-green/20 text-crt-green' : 'border-white/20 text-transparent',
                    ].join(' ')}
                  >
                    <Check size={12} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer — next season */}
        <div className="flex items-center justify-between gap-3 border-t border-crt-dim bg-pitch-900/80 px-5 py-3">
          <span className="text-[11px] text-chrome-muted">
            Next: Season {nextSeason} · reach {ladderTier(nextTarget)}
          </span>
          <button
            type="button"
            onClick={() => advance(picked)}
            data-testid="advance-season"
            className="flex items-center gap-1.5 rounded-md border border-crt-green/50 bg-crt-green/20 px-4 py-2 font-display text-sm text-crt-green hover:bg-crt-green/30"
          >
            {picked ? 'Sign & Continue' : 'Continue'}
            <ArrowRight size={15} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
