import { motion, useReducedMotion } from 'framer-motion';
import { buildShotMap, channelPhrase } from '@/lib/shotmap';
import type { VizScene } from '@/lib/matchviz';

interface ShotMapProps {
  scenes: readonly VizScene[];
  /** Your club + opponent names for the legend / summary. */
  teamAName: string;
  teamBName: string;
}

const W = 220;
const H = 132;

/**
 * "Where it was won" — a mini shot map: every goal (filled) and chance (hollow)
 * plotted at the spot it ended, yours attacking right, theirs attacking left,
 * with a one-line channel read per side. Derived from the same viz timeline the
 * 2D pitch plays, so it always matches what the user just watched.
 */
export default function ShotMap({ scenes, teamAName, teamBName }: ShotMapProps) {
  const reduce = useReducedMotion();
  const { shots, yours, theirs } = buildShotMap(scenes);

  if (shots.length === 0) return null;

  return (
    <motion.div
      className="mt-3 rounded-lg border border-white/10 bg-pitch-900/60 px-3 py-3"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
    >
      <p className="mb-2 font-data text-[9px] uppercase tracking-widest text-chrome-muted/70">
        Where it was won
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Shot map">
        {/* Pitch */}
        <rect x="1" y="1" width={W - 2} height={H - 2} rx="4" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.12)" />
        <line x1={W / 2} y1="1" x2={W / 2} y2={H - 1} stroke="rgba(255,255,255,0.1)" />
        <circle cx={W / 2} cy={H / 2} r="16" fill="none" stroke="rgba(255,255,255,0.1)" />
        {/* Goals at each end */}
        <rect x="1" y={H / 2 - 14} width="4" height="28" fill="rgba(255,255,255,0.12)" />
        <rect x={W - 5} y={H / 2 - 14} width="4" height="28" fill="rgba(255,255,255,0.12)" />

        {/* Shots */}
        {shots.map((s, i) => {
          const cx = s.x * W;
          const cy = s.y * H;
          const yours = s.side === 'A';
          const color = yours ? 'var(--crt-green, #39ff14)' : '#e879f9';
          return s.goal ? (
            <circle key={i} cx={cx} cy={cy} r="4.5" fill={color} stroke="#0b0f0b" strokeWidth="1" />
          ) : (
            <circle key={i} cx={cx} cy={cy} r="3.2" fill="none" stroke={color} strokeWidth="1.4" opacity="0.85" />
          );
        })}
      </svg>

      {/* Per-side read */}
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <p className="text-chrome">
          <span className="font-display text-crt-green">{teamAName}</span>
          <span className="text-chrome-muted">
            {' '}— {yours.goals}⚽ {yours.chances} chance{yours.chances !== 1 ? 's' : ''}
            {yours.channel && yours.goals + yours.chances >= 2 && `, ${channelPhrase(yours.channel)}`}
          </span>
        </p>
        <p className="text-right text-chrome">
          <span className="font-display text-fuchsia-300">{teamBName}</span>
          <span className="text-chrome-muted">
            {' '}— {theirs.goals}⚽ {theirs.chances} chance{theirs.chances !== 1 ? 's' : ''}
            {theirs.channel && theirs.goals + theirs.chances >= 2 && `, ${channelPhrase(theirs.channel)}`}
          </span>
        </p>
      </div>
    </motion.div>
  );
}
