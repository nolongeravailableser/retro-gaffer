import { hashSeed } from '@/lib/rng';
import type { Kit } from '@/lib/kits';

interface CrestBadgeProps {
  /** Club name — seeds the shield shape, charge and monogram. */
  name: string;
  kit: Kit;
  size?: number;
}

const SHIELDS = [
  // Classic heater shield
  'M50 4 L92 16 L92 52 Q92 78 50 96 Q8 78 8 52 L8 16 Z',
  // Round-bottomed Spanish shield
  'M50 4 L92 12 L92 60 Q92 88 50 96 Q8 88 8 60 L8 12 Z',
  // Pointed banner
  'M12 6 L88 6 L88 64 L50 96 L12 64 Z',
];

/**
 * A deterministic club crest: shield shape + charge picked from the club-name
 * hash, painted in the kit's colours, with the club monogram. Same name + kit
 * → same crest, forever. Pure SVG, no assets.
 */
export default function CrestBadge({ name, kit, size = 24 }: CrestBadgeProps) {
  const h = hashSeed(`crest-${name}`);
  const shield = SHIELDS[h % SHIELDS.length];
  const charge = (h >>> 4) % 4;
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  const uid = `crest-${h}-${kit.primary.slice(1)}-${kit.secondary.slice(1)}`;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={`${name} crest`}
      className="shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
    >
      <defs>
        <clipPath id={uid}>
          <path d={shield} />
        </clipPath>
      </defs>
      <path d={shield} fill={kit.primary} />
      <g clipPath={`url(#${uid})`}>
        {charge === 0 && ( // bend (diagonal band)
          <rect x={-30} y={40} width={160} height={22} fill={kit.secondary} transform="rotate(-32 50 50)" />
        )}
        {charge === 1 && ( // chief (top band)
          <rect x={0} y={0} width={100} height={30} fill={kit.secondary} />
        )}
        {charge === 2 && ( // pale (vertical band)
          <rect x={38} y={0} width={24} height={100} fill={kit.secondary} />
        )}
        {charge === 3 && ( // chevron
          <path d="M50 30 L88 66 L76 78 L50 53 L24 78 L12 66 Z" fill={kit.secondary} />
        )}
      </g>
      <path d={shield} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={4} />
      <text
        x={50}
        y={62}
        textAnchor="middle"
        fontFamily="Oswald, system-ui, sans-serif"
        fontWeight={700}
        fontSize={42}
        fill="#ffffff"
        stroke="rgba(0,0,0,0.65)"
        strokeWidth={2.5}
        paintOrder="stroke"
      >
        {initial}
      </text>
    </svg>
  );
}
