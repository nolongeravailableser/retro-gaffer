import { motion } from 'framer-motion';
import { Coins, ShoppingCart, Sparkles } from 'lucide-react';
import type { Player } from '@/lib/types';
import { ROLE_STYLES } from '@/components/ui/roleStyles';
import { RARITY_STYLES } from '@/components/ui/rarityStyles';

interface ShopCardProps {
  player: Player | null;
  /** Can the manager afford + fit this player right now? */
  affordable: boolean;
  onBuy: () => void;
}

/** A single shop offer with a Buy CTA. Renders a "sold" placeholder when empty. */
export default function ShopCard({ player, affordable, onBuy }: ShopCardProps) {
  if (!player) {
    return (
      <div className="flex min-h-[9.5rem] items-center justify-center rounded-lg border border-dashed border-white/15 bg-pitch-900/40 p-3 text-xs text-chrome-muted">
        Sold
      </div>
    );
  }

  const role = ROLE_STYLES[player.role];
  const rarity = RARITY_STYLES[player.rarity];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, rotateX: -12 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex flex-col rounded-lg border p-3 shadow-card ${rarity.frame}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-lg leading-tight">{player.name}</p>
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

      <div className="mt-2 flex items-center justify-between font-display text-sm">
        <span className="text-rose-300">ATK {player.stats.attack}</span>
        <span className="text-sky-300">DEF {player.stats.defense}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {player.tags.slice(0, 3).map((t) => (
          <span
            key={t}
            className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-chrome-muted"
          >
            {t}
          </span>
        ))}
      </div>

      <motion.button
        type="button"
        onClick={onBuy}
        disabled={!affordable}
        whileTap={affordable ? { scale: 0.97 } : undefined}
        data-testid={`buy-${player.id}`}
        className={[
          'mt-3 flex items-center justify-center gap-1.5 rounded-md py-2 font-display text-sm transition',
          affordable
            ? 'bg-crt-green/20 text-crt-green hover:bg-crt-green/30 border border-crt-green/40'
            : 'cursor-not-allowed border border-white/10 bg-white/5 text-chrome-muted',
        ].join(' ')}
      >
        {affordable ? <ShoppingCart size={14} /> : <Sparkles size={14} />}
        Buy
        <span className="flex items-center gap-0.5">
          <Coins size={12} />£{player.cost}M
        </span>
      </motion.button>
    </motion.div>
  );
}
