import { motion, useReducedMotion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { analyzeMatch, type AnalysisFactor } from '@/lib/matchAnalysis';
import type { MatchResult, Player } from '@/lib/types';

interface MatchVerdictProps {
  result: MatchResult;
  teamA: { name: string; squad: Player[] };
  teamB: { name: string; squad: Player[] };
}

const TONE = {
  good: { icon: TrendingUp, cls: 'text-crt-green', dot: 'bg-crt-green' },
  bad: { icon: TrendingDown, cls: 'text-rose-300', dot: 'bg-rose-400' },
  neutral: { icon: Minus, cls: 'text-chrome-muted', dot: 'bg-chrome-muted/60' },
} as const;

function FactorRow({ f, i, reduce }: { f: AnalysisFactor; i: number; reduce: boolean | null }) {
  const t = TONE[f.tone];
  const Icon = t.icon;
  return (
    <motion.li
      className="flex items-start gap-2 text-[12px] leading-snug text-chrome"
      initial={reduce ? false : { opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.12 + i * 0.06 }}
    >
      <Icon size={13} className={`mt-0.5 shrink-0 ${t.cls}`} />
      <span>{f.text}</span>
    </motion.li>
  );
}

/**
 * The post-match verdict — a plain-English read of WHY the result happened,
 * derived from the deterministic engine (xG, finishing, the squads' stat
 * profiles, red cards). Shown at full-time above the timeline.
 */
export default function MatchVerdict({ result, teamA, teamB }: MatchVerdictProps) {
  const reduce = useReducedMotion();
  const analysis = analyzeMatch(result, teamA, teamB);

  return (
    <motion.div
      className="mt-3 rounded-lg border border-white/10 bg-pitch-900/60 px-3 py-3"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
    >
      <p className="mb-1.5 font-data text-[9px] uppercase tracking-widest text-chrome-muted/70">
        The verdict
      </p>
      <p className="mb-2 font-display text-sm text-chrome">{analysis.headline}</p>
      <ul className="space-y-1">
        {analysis.factors.map((f, i) => (
          <FactorRow key={f.text} f={f} i={i} reduce={reduce} />
        ))}
      </ul>
    </motion.div>
  );
}
