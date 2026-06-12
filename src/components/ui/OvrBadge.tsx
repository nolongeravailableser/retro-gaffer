/**
 * The one headline number per player: a tier-coloured OVR badge. The same
 * scale everywhere (squad, pitch, market, draft) — design-mockups/05, rule 1.
 */
export function ovrTier(v: number): 'elite' | 'good' | 'ok' | 'low' | 'poor' {
  return v >= 85 ? 'elite' : v >= 76 ? 'good' : v >= 66 ? 'ok' : v >= 56 ? 'low' : 'poor';
}

const TIER_BG: Record<ReturnType<typeof ovrTier>, string> = {
  elite: 'bg-tier-elite',
  good: 'bg-tier-good',
  ok: 'bg-tier-ok',
  low: 'bg-tier-low',
  poor: 'bg-tier-poor',
};

interface OvrBadgeProps {
  value: number;
  /** sm = list rows / slot cards · md = sheets & market rows */
  size?: 'sm' | 'md';
  className?: string;
}

export default function OvrBadge({ value, size = 'sm', className = '' }: OvrBadgeProps) {
  return (
    <span
      title={`Overall ${value}`}
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-md font-display font-semibold text-pitch-950',
        TIER_BG[ovrTier(value)],
        size === 'sm' ? 'h-6 w-8 text-[13px]' : 'h-8 w-10 text-[17px]',
        className,
      ].join(' ')}
    >
      {value}
    </span>
  );
}
