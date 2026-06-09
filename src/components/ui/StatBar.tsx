import { statTier } from '@/lib/playerMeta';

interface StatBarProps {
  /** Short label, e.g. "ATK" / "DEF". */
  label: string;
  /** 0–99 value. */
  value: number;
  /** Accent for the label text (defaults to muted). */
  labelClass?: string;
  /** Compact mode shrinks the bar height + type for dense rows. */
  compact?: boolean;
}

/**
 * FM-style rated stat: label + number + a filled bar coloured by tier.
 * Gives a bare 0–99 number instant context (Elite / Strong / Solid / …).
 */
export default function StatBar({ label, value, labelClass, compact }: StatBarProps) {
  const tier = statTier(value);
  const pct = Math.max(4, Math.min(100, value));

  return (
    <div className="flex items-center gap-1.5" title={`${label} ${value} · ${tier.word}`}>
      <span
        className={`shrink-0 font-display ${compact ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-wide ${
          labelClass ?? 'text-chrome-muted'
        }`}
      >
        {label}
      </span>
      <div
        className={`relative flex-1 overflow-hidden rounded-full bg-white/10 ${
          compact ? 'h-1' : 'h-1.5'
        }`}
      >
        <div
          className={`h-full rounded-full ${tier.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`shrink-0 text-right font-ticker tabular-nums ${
          compact ? 'text-[10px] w-5' : 'text-xs w-6'
        } ${tier.text}`}
      >
        {value}
      </span>
    </div>
  );
}
