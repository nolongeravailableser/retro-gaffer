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

function RatingRow({ r }: { r: PlayerRating }) {
  const rs = ROLE_STYLES[r.role];
  return (
    <li className="flex items-center gap-2 px-2 py-1 font-ticker text-sm">
      <span className={`w-8 shrink-0 rounded border px-1 text-center text-[10px] font-display ${rs.text} ${rs.bg} ${rs.border}`}>
        {r.role}
      </span>
      <span className="min-w-0 flex-1 truncate font-display text-xs text-chrome">
        {r.name}
        {r.motm && <Star size={11} className="ml-1 inline text-crt-amber" fill="currentColor" />}
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
    </li>
  );
}

/** A single key-event line in the timeline. */
function TimelineRow({ e }: { e: MatchEvent }) {
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
    <li className={`flex items-center gap-2 px-2 py-0.5 text-sm ${mine ? '' : 'flex-row-reverse text-right'}`}>
      <span className="w-8 shrink-0 font-ticker text-xs text-chrome-muted tabular-nums">{e.minute}'</span>
      <span className="shrink-0">{icon}</span>
      <span className={`min-w-0 flex-1 truncate font-display text-xs ${nameCls}`}>{detail}</span>
    </li>
  );
}

/**
 * Post-match report: a both-sides key-events timeline plus side-A player
 * ratings. In `finished:false` mode it shows just the live ratings strip.
 */
export default function MatchReport({ events, squad, ctx, teamAName, finished }: MatchReportProps) {
  const ratings = matchRatings(events, squad, ctx)
    .slice()
    .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  const keyEvents = events.filter((e) => KEY_KINDS.has(e.kind));

  if (!finished) {
    // Compact live ratings — visible while the match plays.
    return (
      <div className="rounded-lg border border-white/10 bg-pitch-900/60 p-2" data-testid="live-ratings">
        <p className="mb-1 px-1 text-[10px] uppercase tracking-wide text-chrome-muted">Live player ratings</p>
        <ul className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
          {ratings.map((r) => (
            <RatingRow key={r.playerId} r={r} />
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3" data-testid="match-report">
      {/* Key events timeline */}
      <div className="rounded-lg border border-white/10 bg-pitch-900/60 px-2 py-2.5">
        <p className="mb-1.5 px-1 font-display text-sm uppercase tracking-wide text-chrome-muted">
          Match Report
        </p>
        {keyEvents.length === 0 ? (
          <p className="px-2 py-1 text-xs text-chrome-muted">A quiet game — no goals or cards.</p>
        ) : (
          <ul className="space-y-0.5">
            {keyEvents.map((e, i) => (
              <TimelineRow key={i} e={e} />
            ))}
          </ul>
        )}
      </div>

      {/* Player ratings */}
      <div className="rounded-lg border border-white/10 bg-pitch-900/60 px-2 py-2.5">
        <p className="mb-1.5 px-1 font-display text-sm uppercase tracking-wide text-chrome-muted">
          {teamAName} — Player Ratings
        </p>
        <ul className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
          {ratings.map((r) => (
            <RatingRow key={r.playerId} r={r} />
          ))}
        </ul>
      </div>
    </div>
  );
}
