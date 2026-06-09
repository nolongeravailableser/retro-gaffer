import { motion } from 'framer-motion';
import { Coins, Sparkles } from 'lucide-react';
import type { Player } from '@/lib/types';
import { ROLE_STYLES } from '@/components/ui/roleStyles';
import { RARITY_STYLES } from '@/components/ui/rarityStyles';

interface PlayerCardProps {
  player: Player;
  selected?: boolean;
  /** Multiplier from active chemistry (1 = none). Shows a boost chip if > 1. */
  multiplier?: number;
  /** Small status label shown bottom-right, e.g. "ON PITCH" / "BENCH". */
  status?: string;
  /** Dim the card (e.g. already placed and not selectable here). */
  dimmed?: boolean;
  onClick?: () => void;
}

/** A FUT-style roster card. Used in the pool tray and bench. */
export default function PlayerCard({
  player,
  selected = false,
  multiplier = 1,
  status,
  dimmed = false,
  onClick,
}: PlayerCardProps) {
  const role = ROLE_STYLES[player.role];
  const rarity = RARITY_STYLES[player.rarity];
  const boosted = multiplier > 1;
  const boostPct = Math.round((multiplier - 1) * 100);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      aria-pressed={selected}
      data-testid={`card-${player.id}`}
      className={[
        'group w-full rounded-lg border p-3 text-left shadow-card transition hover:brightness-110',
        rarity.frame,
        selected ? `ring-2 ring-crt-green/70 shadow-glow !border-crt-green` : '',
        dimmed ? 'opacity-45 saturate-50' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-lg leading-tight">
            {player.name}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-chrome-muted">
            {player.peak_season ?? player.era}
            <span className={`rounded px-1 text-[9px] uppercase tracking-wide ${rarity.chip}`}>
              {rarity.label}
            </span>
          </p>
          {player.club && (
            <p className="truncate text-[11px] text-chrome-muted/80">
              {player.club}
              {player.nationality ? ` · ${player.nationality}` : ''}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 font-display text-xs ${role.text} ${role.border}`}
        >
          {player.role}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between font-display text-sm">
        <span className="text-rose-300">ATK {player.stats.attack}</span>
        <span className="text-sky-300">DEF {player.stats.defense}</span>
        <span className="flex items-center gap-1 text-crt-amber">
          <Coins size={13} />£{player.cost}M
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {player.tags.map((t) => (
          <span
            key={t}
            className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-chrome-muted"
          >
            {t}
          </span>
        ))}
      </div>

      {(boosted || status) && (
        <div className="mt-2 flex items-center justify-between">
          {boosted ? (
            <span className="flex items-center gap-1 rounded bg-crt-green/15 px-1.5 py-0.5 text-[10px] font-semibold text-crt-green">
              <Sparkles size={11} />+{boostPct}% CHEM
            </span>
          ) : (
            <span />
          )}
          {status && (
            <span className="text-[10px] uppercase tracking-wide text-chrome-muted">
              {status}
            </span>
          )}
        </div>
      )}
    </motion.button>
  );
}
