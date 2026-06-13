import { motion, useReducedMotion } from 'framer-motion';
import { Star, Square } from 'lucide-react';
import type { MatchEvent, Player } from '@/lib/types';
import { matchRatings, type RatingContext, type PlayerRating } from '@/lib/ratings';
import { ROLE_STYLES } from '@/components/ui/roleStyles';

interface MatchReportProps {
  /** Events to read — a live prefix (ratings update live) or the full match. */
  events: MatchEvent[];
  /** Side-A XI that took the field. */
  squad: Player[];
  ctx: RatingContext;
  teamAName: string;
  /** Full report (key-events timeline + ratings); false = compact live ratings. */
  finished: boolean;
}

/** Colour a rating like a school report: green great → rose poor. */
function ratingClass(r: number): string {
  if (r >= 8) return 'bg-crt-green/20 text-crt-green border-crt-green/40';
  if (r >= 7) return 'bg-lime-500/15 text-lime-300 border-lime-400/40';
  if (r >= 6) return 'bg-crt-amber/15 text-crt-amber border-crt-amber/40';
  return 'bg-rose-500/15 text-rose-300 border-rose-400/40';
}

const KEY_KINDS = new Set(['goal', 'yellow', 'red', 'injury']);

const ROW_CLS = 'flex items-center gap-2 px-2 py-1 font-ticker text-sm';

/** Stagger timing for the finished-report cascade. */
const listVariants = { show: { transition: { staggerChildren: 0.035 } } };
const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 520, damping: 30 } },
};

/** The inner content of a rating row — shared by the plain and animated rows.
 *  `pop` springs the MOTM star in (finished report only; the live strip
 *  re-renders every event, so it stays static). */
function RatingContent({ r, pop }: { r: PlayerRating; pop: boolean }) {
  const rs = ROLE_STYLES[r.role];
  return (
    <>
      <span className={`w-8 shrink-0 rounded border px-1 text-center text-[10px] font-display ${rs.text} ${rs.bg} ${rs.border}`}>
        {r.role}
      </span>
      <span className="min-w-0 flex-1 truncate font-display text-xs text-chrome">
        {r.name}
        {r.motm &&
          (pop ? (
            <motion.span
              className="ml-1 inline-block"
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 18, delay: 0.15 }}
            >
              <Star size={11} className="inline text-crt-amber" fill="currentColor" />
            </motion.span>
          ) : (
            <Star size={11} className="ml-1 inline text-crt-amber" fill="currentColor" />
          ))}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-[11px]">
        {r.goals > 0 && <span title="goals" className="text-crt-green">⚽{r.goals > 1 ? `×${r.goals}` : ''}</span>}
        {r.assists > 0 && <span title="assists" className="text-sky-300">🅰{r.assists > 1 ? `×${r.assists}` : ''}</span>}
        {r.yellows > 0 && <Square size={9} className="text-crt-amber" fill="currentColor" />}
        {r.red && <Square size={9} className="text-rose-400" fill="currentColor" />}
      </span>
      <span className={`w-9 shrink-0 rounded border text-center font-display text-xs tabular-nums ${ratingClass(r.rating)}`}>
        {r.rating.toFixed(1)}
      </span>
    </>
  );
}

/** Row class for a timeline line — opponent events mirror to the right. */
const timelineRowCls = (e: MatchEvent) =>
  `flex items-center gap-2 px-2 py-0.5 text-sm ${e.side === 'A' ? '' : 'flex-row-reverse text-right'}`;

/** The inner content of a key-event timeline line (no <li> wrapper). */
function TimelineContent({ e }: { e: MatchEvent }) {
  const mine = e.side === 'A';
  const nameCls = mine ? 'text-chrome' : 'text-chrome-muted';
  let icon = '•';
  let detail = e.playerName ?? '';
  if (e.kind === 'goal') {
    icon = '⚽';
    detail = `${e.playerName ?? ''}${e.assist ? `  (assist: ${e.assist})` : ''}`;
  } else if (e.kind === 'yellow') {
    icon = '🟨';
  } else if (e.kind === 'red') {
    icon = '🟥';
  } else if (e.kind === 'injury') {
    icon = '➕';
  }
  return (
    <>
      <span className="w-8 shrink-0 font-ticker text-xs text-chrome-muted tabular-nums">{e.minute}'</span>
      <span className="shrink-0">{icon}</span>
      <span className={`min-w-0 flex-1 truncate font-display text-xs ${nameCls}`}>{detail}</span>
    </>
  );
}

/**
 * Post-match report: a both-sides key-events timeline plus side-A player
 * ratings. In `finished:false` mode it shows just the live ratings strip.
 */
export default function MatchReport({ events, squad, ctx, teamAName, finished }: MatchReportProps) {
  const reduce = useReducedMotion();
  const ratings = matchRatings(events, squad, ctx)
    .slice()
    .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  const keyEvents = events.filter((e) => KEY_KINDS.has(e.kind));
  // Animate only the one-time full-time report; the live strip re-renders on
  // every event, so it stays static (animating it would flicker constantly).
  const anim = finished && !reduce;

  if (!finished) {
    // Compact live ratings — visible while the match plays.
    return (
      <div className="rounded-lg border border-white/10 bg-pitch-900/60 p-2" data-testid="live-ratings">
        <p className="mb-1 px-1 text-[10px] uppercase tracking-wide text-chrome-muted">Live player ratings</p>
        <ul className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
          {ratings.map((r) => (
            <li key={r.playerId} className={ROW_CLS}>
              <RatingContent r={r} pop={false} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3" data-testid="match-report">
      {/* Key events timeline — cascades in at full-time */}
      <div className="rounded-lg border border-white/10 bg-pitch-900/60 px-2 py-2.5">
        <p className="mb-1.5 px-1 font-display text-sm uppercase tracking-wide text-chrome-muted">
          Match Report
        </p>
        {keyEvents.length === 0 ? (
          <p className="px-2 py-1 text-xs text-chrome-muted">A quiet game — no goals or cards.</p>
        ) : anim ? (
          <motion.ul className="space-y-0.5" variants={listVariants} initial="hidden" animate="show">
            {keyEvents.map((e, i) => (
              <motion.li key={i} className={timelineRowCls(e)} variants={itemVariants}>
                <TimelineContent e={e} />
              </motion.li>
            ))}
          </motion.ul>
        ) : (
          <ul className="space-y-0.5">
            {keyEvents.map((e, i) => (
              <li key={i} className={timelineRowCls(e)}>
                <TimelineContent e={e} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Player ratings — staggered pop-in */}
      <div className="rounded-lg border border-white/10 bg-pitch-900/60 px-2 py-2.5">
        <p className="mb-1.5 px-1 font-display text-sm uppercase tracking-wide text-chrome-muted">
          {teamAName} — Player Ratings
        </p>
        {anim ? (
          <motion.ul
            className="grid grid-cols-1 gap-0.5 sm:grid-cols-2"
            variants={listVariants}
            initial="hidden"
            animate="show"
          >
            {ratings.map((r) => (
              <motion.li key={r.playerId} className={ROW_CLS} variants={itemVariants}>
                <RatingContent r={r} pop />
              </motion.li>
            ))}
          </motion.ul>
        ) : (
          <ul className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
            {ratings.map((r) => (
              <li key={r.playerId} className={ROW_CLS}>
                <RatingContent r={r} pop={false} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
