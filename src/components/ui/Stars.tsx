import { Star } from 'lucide-react';

interface StarsProps {
  /** Stars earned, 0–3. */
  earned: number;
  total?: number;
  size?: number;
}

/** A 1–3 star rating row (filled = earned). */
export default function Stars({ earned, total = 3, size = 14 }: StarsProps) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${earned} of ${total} stars`}>
      {Array.from({ length: total }, (_, i) => (
        <Star
          key={i}
          size={size}
          className={i < earned ? 'fill-crt-amber text-crt-amber' : 'text-white/20'}
        />
      ))}
    </span>
  );
}
