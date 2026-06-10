import { motion } from 'framer-motion';
import { Coins, ShoppingCart, Sparkles, Ban } from 'lucide-react';
import type { Player } from '@/lib/types';
import { ROLE_STYLES } from '@/components/ui/roleStyles';
import { RARITY_STYLES } from '@/components/ui/rarityStyles';
import { positionLabel, leagueCode } from '@/lib/playerMeta';
import StatBar from '@/components/ui/StatBar';
import MiniStats from '@/components/ui/MiniStats';

/** What signing this player would add to the current XI's chemistry. */
export interface ChemPreview {
  /** The bonus % the player would personally earn (0 if none). */
  bonusPct: number;
  /** Synergy tags this player would share with the current XI. */
  tags: string[];
}

interface ShopCardProps {
  player: Player | null;
  /** Can the manager afford + fit this player right now? */
  affordable: boolean;
  /** Reason the buy is blocked (shown when not affordable). */
  blockedReason?: string;
  /** Speculative chemistry contribution if added to the current XI. */
  chem?: ChemPreview;
  onBuy: () => void;
}

/** A single shop offer with a Buy CTA. Renders a "sold" placeholder when empty. */
export default function ShopCard({ player, affordable, blockedReason, chem, onBuy }: ShopCardProps) {
  if (!player) {
    return (
      <div className="flex min-h-[9.5rem] items-center justify-center rounded-lg border border-dashed border-white/15 bg-pitch-900/40 p-3 text-xs text-chrome-muted">
        Sold
      </div>
    );
  }

  const role = ROLE_STYLES[player.role];
  const rarity = RARITY_STYLES[player.rarity];
  const pos = positionLabel(player.position);
  const league = leagueCode(player.league);

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
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-chrome-muted">
            {player.peak_season ?? player.era}
            <span className={`rounded px-1 text-[9px] uppercase tracking-wide ${rarity.chip}`}>
              {rarity.label}
            </span>
            {league && (
              <span className="rounded bg-white/5 px-1 text-[9px] uppercase tracking-wide text-chrome-muted">
                {league}
              </span>
            )}
          </p>
          {player.club && (
            <p className="truncate text-[11px] text-chrome-muted/80">
              {player.club}
              {player.nationality ? ` · ${player.nationality}` : ''}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span
            className={`rounded border px-1.5 py-0.5 font-display text-xs ${role.text} ${role.border}`}
          >
            {player.role}
          </span>
          {pos && <span className="text-[9px] text-chrome-muted/70">{pos}</span>}
        </div>
      </div>

      {/* Rated stat bars */}
      <div className="mt-2.5 flex flex-col gap-1.5">
        <StatBar label="ATK" value={player.stats.attack} labelClass="text-rose-300/80" />
        <StatBar label="DEF" value={player.stats.defense} labelClass="text-sky-300/80" />
      </div>

      {/* Extended profile — every number drives the sim */}
      <div className="mt-2 border-t border-white/5 pt-1.5">
        <MiniStats player={player} />
      </div>

      {/* Chemistry preview — what this signing adds to the current XI */}
      {chem && chem.bonusPct > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1 rounded-md border border-crt-green/30 bg-crt-green/10 px-2 py-1">
          <Sparkles size={11} className="shrink-0 text-crt-green" />
          <span className="font-display text-[10px] text-crt-green">+{chem.bonusPct}% chem</span>
          {chem.tags.slice(0, 2).map((t) => (
            <span key={t} className="text-[9px] text-crt-green/70">
              {t}
            </span>
          ))}
        </div>
      )}

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
        title={!affordable ? blockedReason : undefined}
        className={[
          'mt-3 flex items-center justify-center gap-1.5 rounded-md py-2 font-display text-sm transition',
          affordable
            ? 'bg-crt-green/20 text-crt-green hover:bg-crt-green/30 border border-crt-green/40'
            : 'cursor-not-allowed border border-white/10 bg-white/5 text-chrome-muted',
        ].join(' ')}
      >
        {affordable ? (
          <>
            <ShoppingCart size={14} />
            Buy
            <span className="flex items-center gap-0.5">
              <Coins size={12} />£{player.cost}M
            </span>
          </>
        ) : (
          <>
            <Ban size={14} />
            {blockedReason ?? 'Unavailable'}
          </>
        )}
      </motion.button>
    </motion.div>
  );
}
