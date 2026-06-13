import { motion } from 'framer-motion';
import { X, Plus, Ban, HeartCrack } from 'lucide-react';
import type { Player, Position, Role } from '@/lib/types';
import { ROLE_STYLES } from '@/components/ui/roleStyles';
import { positionShort } from '@/lib/playerMeta';
import { overall } from '@/lib/wages';
import OvrBadge from '@/components/ui/OvrBadge';

interface SlotProps {
  role: Role;
  /** Nominal position of this slot (drives the pill label). */
  position?: Position;
  player?: Player;
  selected: boolean;
  multiplier: number;
  /** A player is picked up AND this slot is a legal destination. */
  eligibleTarget: boolean;
  /** A player is picked up but this slot's role doesn't match. */
  blockedTarget: boolean;
  /** The fielded player is suspended — can't play this round. */
  suspended?: boolean;
  /** Rounds the fielded player is injured for (0/undefined = fit). */
  injuredRounds?: number;
  /** The fielded player is playing out of position (−10%). */
  outOfPosition?: boolean;
  onClick: () => void;
  onRemove: () => void;
  slotIndex: number;
}

/** A single position on the tactical board. */
export default function Slot({
  role,
  position,
  player,
  selected,
  multiplier,
  eligibleTarget,
  blockedTarget,
  suspended,
  injuredRounds,
  outOfPosition,
  onClick,
  onRemove,
  slotIndex,
}: SlotProps) {
  const style = ROLE_STYLES[role];
  const boosted = multiplier > 1;
  const boostPct = Math.round((multiplier - 1) * 100);
  const unavailable = !!player && (suspended || !!injuredRounds);
  const label = position ? positionShort(position) : role;

  return (
    <div className="relative">
      <motion.button
        type="button"
        onClick={onClick}
        whileTap={{ scale: 0.96 }}
        data-testid={`slot-${slotIndex}`}
        aria-label={player ? `${player.name} (${role})` : `Empty ${style.label} slot`}
        className={[
          'flex h-[5.5rem] w-[3.5rem] flex-col items-center justify-center gap-1 rounded-lg border-2 px-0.5 py-1 text-center transition sm:h-28 sm:w-32 sm:px-2',
          player
            ? `${style.border} bg-pitch-800/90 shadow-card`
            : 'border-dashed border-white/20 bg-pitch-900/40',
          selected ? 'ring-2 ring-crt-green shadow-glow' : '',
          eligibleTarget ? 'border-crt-green/70 bg-crt-green/10' : '',
          blockedTarget ? 'opacity-30' : '',
          unavailable ? 'ring-2 ring-rose-500/70' : '',
        ].join(' ')}
      >
        {player ? (
          <>
            <span
              className={
                outOfPosition
                  ? 'rounded border px-1 text-[10px] font-display border-crt-amber/60 text-crt-amber'
                  : `rounded border px-1 text-[10px] font-display ${style.text} ${style.border}`
              }
              title={outOfPosition ? 'Out of position — −10%' : undefined}
            >
              {label}{outOfPosition ? ' !' : ''}
            </span>
            <span className="line-clamp-2 font-display text-[11px] leading-tight sm:text-sm">
              {player.name}
            </span>
            <OvrBadge value={overall(player)} />
          </>
        ) : (
          <>
            <Plus size={16} className="text-white/30" />
            <span className={`font-display text-xs ${style.text}`}>{label}</span>
          </>
        )}
      </motion.button>

      {player && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${player.name}`}
          className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full border border-white/20 bg-pitch-950 text-chrome-muted hover:text-rose-300"
        >
          <X size={12} />
        </button>
      )}

      {/* Chemistry pip — the link bonus, readable at slot scale. */}
      {player && boosted && (
        <span
          title={`Chemistry +${boostPct}%`}
          className="absolute -bottom-1.5 -right-1.5 rounded-full bg-tier-elite px-1.5 py-px font-data text-[9px] font-bold text-pitch-950"
        >
          +{boostPct}%
        </span>
      )}

      {/* Unavailable badge — this starter can't actually take the field. */}
      {suspended ? (
        <span className="absolute -left-1.5 -top-1.5 flex items-center gap-0.5 rounded-full border border-rose-400/60 bg-pitch-950 px-1 py-0.5 text-[8px] font-display text-rose-300">
          <Ban size={8} /> BAN
        </span>
      ) : injuredRounds ? (
        <span className="absolute -left-1.5 -top-1.5 flex items-center gap-0.5 rounded-full border border-orange-400/60 bg-pitch-950 px-1 py-0.5 text-[8px] font-display text-orange-300">
          <HeartCrack size={8} /> {injuredRounds}R
        </span>
      ) : null}
    </div>
  );
}
