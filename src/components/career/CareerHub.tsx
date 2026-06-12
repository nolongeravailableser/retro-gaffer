import {
  Trophy, Crown, ArrowUpCircle, ArrowDownCircle, Minus, Star, Briefcase, History, Hammer,
} from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { careerHonours, type SeasonRecord } from '@/lib/career';
import { managerReputation, reputationLabel } from '@/lib/jobs';
import {
  division, position as leaguePosition, table as leagueTable, totalWeeks,
  PROMOTION_SPOTS, RELEGATION_SPOTS, TOP_TIER, BOTTOM_TIER, YOU,
} from '@/lib/league';
import { DEFAULT_KIT } from '@/lib/kits';
import { boardConfidence, confidenceBand, confidenceLabel } from '@/lib/board';
import CrestBadge from '@/components/ui/CrestBadge';
import PyramidLadder from './PyramidLadder';
import FacilitiesPanel from './FacilitiesPanel';

const ord = (n: number) => {
  const v = n % 100;
  return n + (['th', 'st', 'nd', 'rd'][(v - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][v] ?? 'th');
};

/** Visual treatment for a finished season's outcome. */
function outcomeBadge(outcome: SeasonRecord['outcome']) {
  switch (outcome) {
    case 'champion': return { Icon: Crown, color: 'text-crt-amber', label: 'Champions' };
    case 'promoted': return { Icon: ArrowUpCircle, color: 'text-crt-green', label: 'Promoted' };
    case 'relegated': return { Icon: ArrowDownCircle, color: 'text-rose-300', label: 'Relegated' };
    case 'sacked': return { Icon: ArrowDownCircle, color: 'text-rose-400', label: 'Sacked' };
    default: return { Icon: Minus, color: 'text-chrome-muted', label: 'Stayed up' };
  }
}

/**
 * The Career Hub — a dynasty's home: club identity, the pyramid ladder, the
 * current season's promotion/relegation outlook, club facility development, an
 * honours cabinet and the full season-by-season history. Career mode only.
 */
export default function CareerHub() {
  const career = useGameStore((s) => s.career);
  const league = useGameStore((s) => s.league);
  const clubName = useGameStore((s) => s.clubName) ?? 'Your XI';
  const managerName = useGameStore((s) => s.managerName);
  const kit = useGameStore((s) => s.kit) ?? DEFAULT_KIT;

  if (!career) return null;

  const div = division(career.tier);
  const honours = careerHonours(career.history);
  const bestTier = Math.min(career.tier, honours.highestTier);
  const rep = managerReputation(honours);

  // Live current-season outlook from the table.
  let pos = 0;
  let clubs = 0;
  let played = 0;
  let weeks = 0;
  let row: ReturnType<typeof leagueTable>[number] | undefined;
  if (league) {
    pos = leaguePosition(league, YOU);
    clubs = league.clubs.length;
    weeks = totalWeeks(league);
    played = Math.min(league.matchweek - 1, weeks);
    row = leagueTable(league).find((r) => r.teamId === YOU);
  }

  const inRelegation = pos > clubs - RELEGATION_SPOTS;
  const inPromotion = pos > 0 && pos <= PROMOTION_SPOTS;
  const outlook = !league
    ? { label: '—', color: 'text-chrome-muted', ring: 'border-white/10' }
    : inRelegation
      ? career.tier === BOTTOM_TIER
        ? { label: 'Drop zone — sack risk', color: 'text-rose-300', ring: 'border-rose-400/40 bg-rose-500/10' }
        : { label: 'Relegation zone', color: 'text-rose-300', ring: 'border-rose-400/40 bg-rose-500/10' }
      : career.tier === TOP_TIER
        ? pos === 1
          ? { label: 'Title race — top!', color: 'text-crt-amber', ring: 'border-crt-amber/40 bg-crt-amber/10' }
          : { label: 'In the top flight', color: 'text-chrome', ring: 'border-white/10' }
        : inPromotion
          ? { label: 'Promotion places', color: 'text-crt-green', ring: 'border-crt-green/40 bg-crt-green/10' }
          : { label: 'Mid-table', color: 'text-chrome', ring: 'border-white/10' };

  const pct = weeks > 0 ? Math.round((played / weeks) * 100) : 0;

  return (
    <div className="flex flex-col gap-4" data-testid="career-hub">
      {/* Club identity */}
      <div className="flex items-center gap-3 rounded-xl border border-crt-green/30 bg-gradient-to-br from-crt-green/10 to-transparent p-4">
        <CrestBadge name={clubName} kit={kit} size={44} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg text-chrome">{clubName}</h2>
          <p className="text-xs text-chrome-muted">
            {managerName ? `${managerName} · ` : ''}Season {career.season} · {div.name}
            {honours.championOfEngland && (
              <span className="ml-1.5 text-crt-amber">· Champions of England 🏆</span>
            )}
          </p>
          {/* Manager reputation — the standing that follows you across clubs and
              gates which jobs you can take after a sacking. */}
          <div className="mt-2" data-testid="manager-reputation">
            <div className="mb-1 flex justify-between font-ticker text-[10px] text-chrome-muted">
              <span>Manager reputation</span>
              <span className="text-crt-amber">{reputationLabel(rep)} · {rep}/100</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-crt-amber" style={{ width: `${rep}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Pyramid + this-season outlook */}
      <div className="grid gap-4 sm:grid-cols-2">
        <PyramidLadder tier={career.tier} clubName={clubName} kit={kit} />

        <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-pitch-900/70 p-3">
          <span className="font-display text-sm uppercase tracking-wide text-chrome">This Season</span>
          {league ? (
            <>
              <div className={`rounded-lg border px-3 py-2 ${outlook.ring}`}>
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-2xl text-chrome">{ord(pos)}</span>
                  <span className={`font-display text-xs ${outlook.color}`}>{outlook.label}</span>
                </div>
                <span className="font-ticker text-[11px] text-chrome-muted">
                  of {clubs} · {div.name}
                </span>
              </div>
              {row && (
                <p className="font-ticker text-xs text-chrome-muted">
                  {row.won}W · {row.drawn}D · {row.lost}L · {row.points} pts · GD{' '}
                  {row.gd > 0 ? `+${row.gd}` : row.gd}
                </p>
              )}
              {row &&
                (() => {
                  const conf = boardConfidence(pos, clubs, { w: row.won, d: row.drawn, l: row.lost });
                  const band = confidenceBand(conf);
                  const tone =
                    band === 'secure'
                      ? 'bg-crt-green'
                      : band === 'stable'
                        ? 'bg-crt-green/70'
                        : band === 'shaky'
                          ? 'bg-crt-amber'
                          : 'bg-rose-400';
                  return (
                    <div data-testid="board-confidence">
                      <div className="mb-1 flex justify-between font-ticker text-[10px] text-chrome-muted">
                        <span>Board confidence</span>
                        <span className="capitalize">{confidenceLabel(band)}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div className={`h-full rounded-full ${tone}`} style={{ width: `${conf}%` }} />
                      </div>
                    </div>
                  );
                })()}
              <div>
                <div className="mb-1 flex justify-between font-ticker text-[10px] text-chrome-muted">
                  <span>Matchweek {Math.min(league.matchweek, weeks)}/{weeks}</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-crt-green" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-chrome-muted">Season starting…</p>
          )}
        </div>
      </div>

      {/* Honours cabinet */}
      <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-3">
        <p className="mb-2 flex items-center gap-1.5 font-display text-sm text-chrome">
          <Trophy size={15} className="text-crt-amber" /> Honours
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { Icon: Crown, label: 'Div. titles', value: honours.divisionTitles, color: 'text-crt-amber' },
            { Icon: Trophy, label: 'Cups', value: honours.cupTitles, color: 'text-crt-amber' },
            { Icon: ArrowUpCircle, label: 'Promotions', value: honours.promotions, color: 'text-crt-green' },
            { Icon: Star, label: 'Top tier', value: division(bestTier).name, color: 'text-chrome' },
            { Icon: Briefcase, label: 'Clubs managed', value: honours.clubsManaged, color: 'text-chrome' },
          ].map((h) => (
            <div key={h.label} className="rounded-lg border border-white/10 bg-white/[0.02] p-2 text-center">
              <h.Icon size={16} className={`mx-auto ${h.color}`} />
              <p className="mt-1 truncate font-display text-sm text-chrome">{h.value}</p>
              <p className="font-ticker text-[10px] uppercase tracking-wide text-chrome-muted">{h.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Club development */}
      <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-3">
        <p className="mb-2 flex items-center gap-1.5 font-display text-sm text-chrome">
          <Hammer size={15} className="text-crt-green" /> Club Development
        </p>
        <FacilitiesPanel bare />
        <p className="mt-2 font-ticker text-[10px] text-chrome-muted">
          Reinvest any time — upgrades apply from the next matchweek and persist across seasons.
        </p>
      </div>

      {/* History timeline */}
      <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-3">
        <p className="mb-2 flex items-center gap-1.5 font-display text-sm text-chrome">
          <History size={15} className="text-chrome" /> Career History
        </p>
        {career.history.length === 0 ? (
          <p className="font-ticker text-xs text-chrome-muted">
            Your first season is underway. Finish it to begin the story.
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {career.history.map((rec) => {
              const b = outcomeBadge(rec.outcome);
              return (
                <li
                  key={rec.season}
                  className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5"
                >
                  <span className="w-10 shrink-0 font-ticker text-[11px] text-chrome-muted">
                    S{rec.season}
                  </span>
                  <span className="flex-1 truncate font-display text-xs text-chrome">
                    {rec.club ?? division(rec.tier).name}
                    {rec.club && (
                      <span className="ml-1 font-ticker text-[10px] text-chrome-muted">
                        {division(rec.tier).name}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-ticker text-[11px] text-chrome-muted">
                    {ord(rec.finishPos)}/{rec.clubs}
                  </span>
                  <span className={`flex shrink-0 items-center gap-1 font-display text-[11px] ${b.color}`}>
                    <b.Icon size={13} /> {b.label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
