import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Trophy, ThumbsUp, ArrowUpCircle, ArrowDownCircle, ArrowUp, Coins,
  GraduationCap, ArrowRight, Check, Search, Hammer,
} from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { potentialStars, isExpiring, SCOUT_YOUTH_COST } from '@/lib/career';
import { division } from '@/lib/league';
import { overall } from '@/lib/wages';
import { renewalCost } from '@/lib/market';
import { FileSignature, RefreshCw } from 'lucide-react';
import type { Player } from '@/lib/types';
import FacilitiesPanel from './FacilitiesPanel';
import { ROLE_STYLES } from '@/components/ui/roleStyles';
import StatBar from '@/components/ui/StatBar';
import Stars from '@/components/ui/Stars';

const ord = (n: number) => {
  const v = n % 100;
  return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][v] ?? 'th');
};

// Deterministic confetti spread for the promotion flourish (no RNG needed).
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 53) % 100,
  delay: (i % 9) * 0.04,
  drift: ((i * 37) % 40) - 20,
  rot: (i * 67) % 360,
  color: ['#39ff14', '#ffcc00', '#ff4d4d', '#4da6ff'][i % 4],
}));

/** Between-seasons promotion/relegation summary + academy intake + facilities. */
export default function CareerReview() {
  const review = useGameStore((s) => s.careerReview);
  const advance = useGameStore((s) => s.advanceCareerSeason);
  const scoutYouth = useGameStore((s) => s.scoutYouth);
  const renewContract = useGameStore((s) => s.renewContract);
  const facilities = useGameStore((s) => s.career?.facilities ?? null);
  const meta = useGameStore((s) => s.career?.meta ?? {});
  const owned = useGameStore((s) => s.owned);
  const bankroll = useGameStore((s) => s.bankroll);
  const [picked, setPicked] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  if (!review) return null;

  // Players whose deal expires this summer — renew them or they leave on a free.
  const expiring = owned
    .filter((id) => isExpiring(meta[id]))
    .map((id) => getPlayer(id))
    .filter((p): p is Player => !!p)
    .sort((a, b) => overall(b) - overall(a));

  const nextSeason = review.season + 1;
  const fromDiv = division(review.fromTier).name;

  // Signing-on bonuses (renew at the division just played). The running total is
  // what rolling the season over will charge; renewing is gated on the bankroll.
  const renewCostOf = (p: Player) => renewalCost(p, review.fromTier);
  const renewTotal = review.renewed.reduce((sum, id) => {
    const p = getPlayer(id);
    return sum + (p && isExpiring(meta[id]) ? renewCostOf(p) : 0);
  }, 0);
  const toDiv = division(review.toTier).name;
  const promoted = review.outcome === 'promoted';
  const relegated = review.outcome === 'relegated';
  const verdict = promoted ? 'PROMOTED!' : relegated ? 'RELEGATED' : 'SEASON COMPLETE';
  const VerdictIcon = promoted ? ArrowUpCircle : relegated ? ArrowDownCircle : ThumbsUp;
  const accent = promoted ? 'text-crt-green' : relegated ? 'text-rose-300' : 'text-crt-amber';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border-2 border-crt-dim bg-pitch-950 shadow-glow"
      >
        {/* Header — promotion/relegation verdict (promotions get a flourish) */}
        <div className="relative overflow-hidden border-b border-crt-dim bg-pitch-900/80 px-5 py-4 text-center">
          {/* Confetti burst — only when promoted, and never under reduced motion */}
          {promoted && !reduceMotion && (
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              {CONFETTI.map((c, i) => (
                <motion.span
                  key={i}
                  className="absolute top-0 h-1.5 w-1.5 rounded-[1px]"
                  style={{ left: `${c.left}%`, backgroundColor: c.color }}
                  initial={{ y: -12, opacity: 0, rotate: 0 }}
                  animate={{ y: 130, x: c.drift, opacity: [0, 1, 1, 0], rotate: c.rot + 360 }}
                  transition={{ duration: 1.3, delay: c.delay, ease: 'easeIn' }}
                />
              ))}
            </div>
          )}

          <motion.div
            className={`relative mx-auto mb-1 flex items-center justify-center gap-2 ${accent}`}
            initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 14 }}
          >
            {promoted ? <Trophy size={24} /> : <VerdictIcon size={22} />}
            <h2 className="font-display text-xl">{verdict}</h2>
          </motion.div>

          {/* Promotion: an animated rise up the pyramid (fromDiv → toDiv) */}
          {promoted ? (
            <motion.div
              className="relative mt-1 flex items-center justify-center gap-2 text-sm"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              <span className="font-display text-chrome-muted/70 line-through decoration-chrome-muted/40">
                {fromDiv}
              </span>
              <motion.span
                className="text-crt-green"
                animate={reduceMotion ? undefined : { y: [2, -3, 2] }}
                transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
              >
                <ArrowUp size={16} />
              </motion.span>
              <motion.span
                className="font-display text-crt-green"
                initial={reduceMotion ? false : { y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.25, type: 'spring', stiffness: 300, damping: 16 }}
              >
                {toDiv}
              </motion.span>
            </motion.div>
          ) : (
            <p className="relative text-xs text-chrome-muted">
              Season {review.season} — finished{' '}
              <span className="font-display">{ord(review.finishPos)}</span> of {review.clubs} in the{' '}
              <span className="font-display">{fromDiv}</span>
              {relegated ? <> — down to the <span className="font-display">{toDiv}</span>.</> : <>.</>}
            </p>
          )}

          {promoted && (
            <p className="relative mt-0.5 text-[11px] text-chrome-muted">
              Finished <span className="font-display">{ord(review.finishPos)}</span> of {review.clubs}.
            </p>
          )}

          <p className="relative mt-2 inline-flex items-center gap-1.5 rounded-full border border-crt-amber/40 bg-crt-amber/15 px-3 py-1 font-display text-sm text-crt-amber">
            <Coins size={14} /> +£{review.bonus}M end-of-season reward
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
              const isScouted = review.scouted.includes(y.id);
              const trueStars = potentialStars(y.potential ?? 50);
              // Unscouted: show a fuzzy range around the true rating.
              const lo = Math.max(1, trueStars - 1);
              const hi = Math.min(5, trueStars + 1);
              return (
                <div
                  key={y.id}
                  onClick={() => setPicked(sel ? null : y.id)}
                  className={[
                    'flex items-center gap-3 rounded-lg border p-3 text-left transition cursor-pointer select-none',
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
                    {/* Potential: revealed by scouting, else a fuzzy range. */}
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-chrome-muted">
                      <span className="uppercase tracking-wide">Potential</span>
                      {isScouted ? (
                        <Stars earned={trueStars} total={5} size={11} />
                      ) : (
                        <>
                          <span
                            className="flex items-center gap-1"
                            title={`Potential ${lo}–${hi}★ — scout to reveal the exact rating`}
                          >
                            <Stars earned={lo} total={hi} size={11} />
                            <span className="font-display text-chrome-muted">?</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); scoutYouth(y.id); }}
                            disabled={bankroll < SCOUT_YOUTH_COST}
                            data-testid={`scout-youth-${y.id}`}
                            className="flex items-center gap-0.5 rounded border border-crt-green/40 px-1.5 py-0.5 font-display text-crt-green hover:bg-crt-green/15 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Search size={9} /> Scout £{SCOUT_YOUTH_COST}M
                          </button>
                        </>
                      )}
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
                </div>
              );
            })}
          </div>

          {/* Expiring contracts — renew or lose them on a Bosman free */}
          {expiring.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 flex items-center gap-1.5 font-display text-sm text-chrome">
                <FileSignature size={16} className="text-crt-amber" />
                Expiring Contracts
              </p>
              <p className="mb-3 text-[11px] text-chrome-muted">
                These deals run out this summer. Renewing costs a one-off signing-on bonus
                (free agents re-sign for nothing); anyone you don't keep leaves on a free (Bosman).
              </p>
              <div className="flex flex-col gap-2" data-testid="expiring-contracts">
                {expiring.map((p) => {
                  const rs = ROLE_STYLES[p.role];
                  const renew = review.renewed.includes(p.id);
                  const cost = renewCostOf(p);
                  return (
                    <div
                      key={p.id}
                      className={[
                        'flex items-center gap-3 rounded-lg border p-2.5 transition',
                        renew ? 'border-crt-green/40 bg-crt-green/5' : 'border-crt-amber/25 bg-pitch-950/40',
                      ].join(' ')}
                    >
                      <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-display ${rs.text} ${rs.bg} ${rs.border}`}>
                        {p.position ?? p.role}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm text-chrome">{p.name}</p>
                        <p className="font-ticker text-[10px] text-chrome-muted">
                          OVR {overall(p)} · {cost > 0 ? `£${cost}M to renew` : 'free to re-sign'} ·{' '}
                          {renew ? (
                            <span className="text-crt-green">renewing — stays at the club</span>
                          ) : (
                            <span className="text-crt-amber">expiring — will leave on a free</span>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => renewContract(p.id)}
                        data-testid={`renew-${p.id}`}
                        className={[
                          'flex shrink-0 items-center gap-1 rounded border px-2.5 py-1 font-display text-[11px] transition',
                          renew
                            ? 'border-crt-green/50 bg-crt-green/15 text-crt-green'
                            : 'border-white/15 text-chrome-muted hover:bg-white/5',
                        ].join(' ')}
                      >
                        {renew
                          ? <><Check size={12} /> {cost > 0 ? `£${cost}M` : 'Renewed'}</>
                          : <><RefreshCw size={12} /> Renew</>}
                      </button>
                    </div>
                  );
                })}
              </div>
              {renewTotal > 0 && (
                <p className="mt-2 text-right font-ticker text-[11px] text-chrome-muted" data-testid="renewal-total">
                  Signing-on bonuses: <span className="text-crt-amber">£{renewTotal}M</span>
                  {' '}· <span className={bankroll - renewTotal < 0 ? 'text-crt-red' : 'text-chrome'}>£{Math.max(0, bankroll - renewTotal)}M</span> left
                </p>
              )}
            </div>
          )}

          {/* Club development — reinvest the bonus into facilities */}
          {facilities && (
            <div className="mt-5">
              <p className="mb-2 flex items-center gap-1.5 font-display text-sm text-chrome">
                <Hammer size={16} className="text-crt-green" />
                Club Development
              </p>
              <FacilitiesPanel bare />
            </div>
          )}
        </div>

        {/* Footer — next season */}
        <div className="flex items-center justify-between gap-3 border-t border-crt-dim bg-pitch-900/80 px-5 py-3">
          <span className="text-[11px] text-chrome-muted">
            Next: Season {nextSeason} · {toDiv}
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
