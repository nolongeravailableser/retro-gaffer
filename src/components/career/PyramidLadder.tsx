import { Crown, ChevronUp, ChevronDown } from 'lucide-react';
import CrestBadge from '@/components/ui/CrestBadge';
import { DIVISIONS, TOP_TIER } from '@/lib/league';
import type { Kit } from '@/lib/kits';

interface PyramidLadderProps {
  /** The club's current tier (1 = summit … BOTTOM_TIER = base). */
  tier: number;
  clubName: string;
  kit: Kit;
}

/**
 * The English football pyramid as a climbable ladder — the summit (Premier
 * League) on top, your current rung lit up with the club crest, and the tiers
 * you've yet to conquer fading above. Makes "how far to the top" tangible.
 */
export default function PyramidLadder({ tier, clubName, kit }: PyramidLadderProps) {
  // Summit first (tier 1 at the top of the visual).
  const rungs = [...DIVISIONS].sort((a, b) => a.tier - b.tier);
  const toSummit = tier - TOP_TIER;

  return (
    <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-sm uppercase tracking-wide text-chrome">The Pyramid</span>
        <span className="font-ticker text-[11px] text-chrome-muted">
          {toSummit === 0 ? 'At the summit' : `${toSummit} ${toSummit === 1 ? 'tier' : 'tiers'} to the summit`}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {rungs.map((d) => {
          const here = d.tier === tier;
          const above = d.tier < tier; // higher division = yet to reach
          const isSummit = d.tier === TOP_TIER;
          return (
            <div
              key={d.tier}
              className={[
                'flex items-center gap-2 rounded-lg border px-3 py-2 transition',
                here
                  ? 'border-crt-green bg-crt-green/15 shadow-glow'
                  : above
                    ? 'border-white/10 bg-white/[0.03] opacity-70'
                    : 'border-white/5 bg-white/[0.02] opacity-50',
              ].join(' ')}
            >
              <span className="w-4 shrink-0 text-center">
                {isSummit ? (
                  <Crown size={14} className={here ? 'text-crt-amber' : 'text-chrome-muted'} />
                ) : above ? (
                  <ChevronUp size={13} className="text-chrome-muted" />
                ) : (
                  <ChevronDown size={13} className="text-chrome-muted/60" />
                )}
              </span>

              <span
                className={[
                  'flex-1 font-display text-sm',
                  here ? 'text-crt-green' : isSummit ? 'text-chrome' : 'text-chrome-muted',
                ].join(' ')}
              >
                {d.name}
              </span>

              {here && (
                <span className="flex items-center gap-1.5">
                  <CrestBadge name={clubName} kit={kit} size={18} />
                  <span className="rounded-full border border-crt-green/40 bg-crt-green/10 px-1.5 py-0.5 font-ticker text-[10px] text-crt-green">
                    YOU
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
