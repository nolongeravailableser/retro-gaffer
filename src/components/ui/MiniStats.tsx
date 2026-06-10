import type { Player } from '@/lib/types';
import { deriveStats, STAT_LABELS, type ExtendedStatKey } from '@/lib/stats';
import { statTier } from '@/lib/playerMeta';

interface MiniStatsProps {
  player: Player;
}

/** Which six of the eight stats to surface per card (full set in the tooltip). */
const OUTFIELD: ExtendedStatKey[] = ['pace', 'shooting', 'passing', 'defending', 'physical', 'composure'];
const KEEPER: ExtendedStatKey[] = ['goalkeeping', 'defending', 'passing', 'physical', 'composure', 'discipline'];

/**
 * Compact 3×2 grid of the extended stats, tier-coloured. These aren't
 * decorative: each one drives a lever in the match sim (creation, conversion,
 * stopping, the keeper's last line, the 75'+ window, cards, injuries).
 */
export default function MiniStats({ player }: MiniStatsProps) {
  const s = deriveStats(player);
  const keys = player.role === 'GK' ? KEEPER : OUTFIELD;
  const fullTooltip = (Object.keys(STAT_LABELS) as ExtendedStatKey[])
    .map((k) => `${STAT_LABELS[k]} ${s[k]}`)
    .join(' · ');

  return (
    <div className="grid grid-cols-3 gap-x-2 gap-y-0.5" title={fullTooltip}>
      {keys.map((k) => (
        <span key={k} className="flex items-baseline justify-between font-ticker text-[10px]">
          <span className="text-chrome-muted/80">{STAT_LABELS[k]}</span>
          <span className={`tabular-nums ${statTier(s[k]).text}`}>{s[k]}</span>
        </span>
      ))}
    </div>
  );
}
