import { Dice5 } from 'lucide-react';
import { KIT_PALETTE, KIT_PATTERNS, type Kit, type KitPattern } from '@/lib/kits';

interface KitPickerProps {
  value: Kit;
  onChange: (kit: Kit) => void;
  /** Compact mode tightens spacing for embedding in settings panels. */
  compact?: boolean;
}

const PATTERN_LABELS: Record<KitPattern, string> = {
  solid: 'Solid',
  stripes: 'Stripes',
  hoops: 'Hoops',
  sash: 'Sash',
  halves: 'Halves',
};

/** The classic shirt silhouette (body + sleeves), reused for clip + outline. */
const SHIRT_PATH =
  'M38 6 Q50 16 62 6 L70 10 L80 18 L96 30 L86 44 L76 36 L76 84 L24 84 L24 36 L14 44 L4 30 L20 18 L30 10 Z';

/** SVG shirt rendering a kit's colours + pattern. */
export function KitShirt({ kit, size = 96 }: { kit: Kit; size?: number }) {
  const { primary, secondary, pattern } = kit;
  return (
    <svg
      viewBox="0 0 100 90"
      width={size}
      height={size * 0.9}
      role="img"
      aria-label={`${pattern} kit, ${primary} shirt with ${secondary} accent`}
    >
      <defs>
        <clipPath id={`shirt-${primary}-${secondary}-${pattern}`}>
          <path d={SHIRT_PATH} />
        </clipPath>
      </defs>
      <path d={SHIRT_PATH} fill={primary} />
      <g clipPath={`url(#shirt-${primary}-${secondary}-${pattern})`}>
        {pattern === 'stripes' && (
          <>
            <rect x={30} y={0} width={9} height={90} fill={secondary} />
            <rect x={46} y={0} width={9} height={90} fill={secondary} />
            <rect x={62} y={0} width={9} height={90} fill={secondary} />
          </>
        )}
        {pattern === 'hoops' && (
          <>
            <rect x={0} y={26} width={100} height={9} fill={secondary} />
            <rect x={0} y={46} width={100} height={9} fill={secondary} />
            <rect x={0} y={66} width={100} height={9} fill={secondary} />
          </>
        )}
        {pattern === 'sash' && (
          <rect x={-20} y={36} width={150} height={13} fill={secondary} transform="rotate(-38 50 45)" />
        )}
        {pattern === 'halves' && <rect x={50} y={0} width={50} height={90} fill={secondary} />}
        {/* Collar + cuffs always take the accent so 'solid' still shows it. */}
        <path d="M38 6 Q50 16 62 6 L58 4 Q50 12 42 4 Z" fill={secondary} />
        <rect x={4} y={26} width={12} height={6} fill={secondary} transform="rotate(-37 10 29)" />
        <rect x={84} y={26} width={12} height={6} fill={secondary} transform="rotate(37 90 29)" />
      </g>
      <path d={SHIRT_PATH} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={2} />
    </svg>
  );
}

/** Swatch-row + pattern-chip kit designer with a live shirt preview. */
export default function KitPicker({ value, onChange, compact = false }: KitPickerProps) {
  const randomize = () => {
    // UI-time randomness only — never touches run seeds.
    const primary = KIT_PALETTE[Math.floor(Math.random() * KIT_PALETTE.length)];
    let secondary = KIT_PALETTE[Math.floor(Math.random() * KIT_PALETTE.length)];
    if (secondary === primary) secondary = KIT_PALETTE[(KIT_PALETTE.indexOf(primary) + 5) % KIT_PALETTE.length];
    const pattern = KIT_PATTERNS[Math.floor(Math.random() * KIT_PATTERNS.length)];
    onChange({ primary, secondary, pattern });
  };

  const swatchRow = (label: string, key: 'primary' | 'secondary') => (
    <div>
      <p className="mb-1 font-display text-[10px] uppercase tracking-wide text-chrome-muted">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {KIT_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange({ ...value, [key]: c })}
            aria-label={`${label} ${c}`}
            data-testid={`kit-${key}-${c.slice(1)}`}
            className={[
              'h-6 w-6 rounded-full border-2 transition',
              value[key] === c ? 'border-crt-green scale-110' : 'border-white/20 hover:border-white/50',
            ].join(' ')}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className={`flex ${compact ? 'flex-col gap-3 sm:flex-row sm:items-start' : 'flex-col gap-3'}`}>
      <div className="flex flex-col items-center gap-1.5 self-center sm:self-start">
        <KitShirt kit={value} size={compact ? 72 : 96} />
        <button
          type="button"
          onClick={randomize}
          className="flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[10px] font-display text-chrome-muted transition hover:bg-white/5 hover:text-chrome"
        >
          <Dice5 size={11} /> Surprise me
        </button>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        {swatchRow('Shirt colour', 'primary')}
        {swatchRow('Accent colour', 'secondary')}
        <div>
          <p className="mb-1 font-display text-[10px] uppercase tracking-wide text-chrome-muted">
            Pattern
          </p>
          <div className="flex flex-wrap gap-1.5">
            {KIT_PATTERNS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onChange({ ...value, pattern: p })}
                data-testid={`kit-pattern-${p}`}
                className={[
                  'rounded-full border px-2.5 py-1 text-xs font-display transition',
                  value.pattern === p
                    ? 'border-crt-green bg-crt-green/20 text-crt-green'
                    : 'border-white/10 text-chrome-muted hover:bg-white/5 hover:text-chrome',
                ].join(' ')}
              >
                {PATTERN_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
