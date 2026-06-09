import { motion } from 'framer-motion';
import { X, Plus, Sparkles } from 'lucide-react';
import type { Player, Role } from '@/lib/types';
import { ROLE_STYLES } from '@/components/ui/roleStyles';

interface SlotProps {
  role: Role;
  player?: Player;
  selected: boolean;
  multiplier: number;
  /** A player is picked up AND this slot is a legal destination. */
  eligibleTarget: boolean;
  /** A player is picked up but this slot's role doesn't match. */
  blockedTarget: boolean;
  onClick: () => void;
  onRemove: () => void;
  slotIndex: number;
}

/** A single position on the 4-4-2 board. */
export default function Slot({
  role,
  player,
  selected,
  multiplier,
  eligibleTarget,
  blockedTarget,
  onClick,
  onRemove,
  slotIndex,
}: SlotProps) {
  const style = ROLE_STYLES[role];
  const boosted = multiplier > 1;
  const boostPct = Math.round((multiplier - 1) * 100);

  return (
    <div className="relative">
      <motion.button
        type="button"
        onClick={onClick}
        whileTap={{ scale: 0.96 }}
        data-testid={`slot-${slotIndex}`}
        aria-label={player ? `${player.name} (${role})` : `Empty ${style.label} slot`}
        className={[
          'flex h-[4.75rem] w-[4.25rem] flex-col items-center justify-center rounded-lg border-2 px-1 text-center transition sm:h-28 sm:w-32 sm:px-2',
          player
            ? `${style.border} bg-pitch-800/90 shadow-card`
            : 'border-dashed border-white/20 bg-pitch-900/40',
          selected ? 'ring-2 ring-crt-green shadow-glow' : '',
          eligibleTarget ? 'border-crt-green/70 bg-crt-green/10' : '',
          blockedTarget ? 'opacity-30' : '',
        ].join(' ')}
      >
        {player ? (
          <>
            <span
              className={`rounded border px-1 text-[10px] font-display ${style.text} ${style.border}`}
            >
              {role}
            </span>
            <span className="mt-1 line-clamp-2 font-display text-[11px] leading-tight sm:text-sm">
              {player.name}
            </span>
            <span className="mt-0.5 flex items-center gap-1 font-display text-[10px] sm:mt-1 sm:gap-1.5 sm:text-[11px]">
              <span className="text-rose-300">{player.stats.attack}</span>
              <span className="text-chrome-muted">/</span>
              <span className="text-sky-300">{player.stats.defense}</span>
            </span>
            {boosted && (
              <span className="mt-0.5 flex items-center gap-0.5 text-[10px] font-semibold text-crt-green">
                <Sparkles size={9} />+{boostPct}%
              </span>
            )}
          </>
        ) : (
          <>
            <Plus size={16} className="text-white/30" />
            <span className={`mt-1 font-display text-xs ${style.text}`}>{role}</span>
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
    </div>
  );
}
