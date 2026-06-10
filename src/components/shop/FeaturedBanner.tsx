import { Sparkles, Coins, Check } from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { featuredPlayerId, featuredCost, FEATURED_DISCOUNT } from '@/lib/featured';
import { dailyKey } from '@/lib/daily';
import { ROLE_STYLES } from '@/components/ui/roleStyles';
import { RARITY_STYLES } from '@/components/ui/rarityStyles';
import { positionLabel, leagueCode } from '@/lib/playerMeta';
import StatBar from '@/components/ui/StatBar';

/** A discounted, daily-rotating marquee signing — same for everyone that day. */
export default function FeaturedBanner() {
  const bankroll = useGameStore((s) => s.bankroll);
  const owned = useGameStore((s) => s.owned);
  const signFeatured = useGameStore((s) => s.signFeatured);

  const player = getPlayer(featuredPlayerId(dailyKey()));
  if (!player) return null;

  const cost = featuredCost(player.cost);
  const already = owned.includes(player.id);
  const affordable = bankroll >= cost;
  const role = ROLE_STYLES[player.role];
  const rarity = RARITY_STYLES[player.rarity];
  const pos = positionLabel(player.position);
  const league = leagueCode(player.league);

  return (
    <div className={`rounded-xl border p-4 ${rarity.frame}`}>
      <p className="mb-2 flex items-center gap-1.5 font-display text-xs uppercase tracking-wide text-crt-amber">
        <Sparkles size={13} />
        Featured Free Agent · {Math.round(FEATURED_DISCOUNT * 100)}% off today
      </p>

      <div className="flex items-center gap-3">
        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-display ${role.text} ${role.border}`}>
          {player.role}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg leading-tight">{player.name}</p>
          <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-chrome-muted">
            <span className={`rounded px-1 text-[9px] uppercase tracking-wide ${rarity.chip}`}>{rarity.label}</span>
            {pos && <span>{pos}</span>}
            {league && <span>{league}</span>}
          </p>
          <div className="mt-1.5 flex flex-col gap-1">
            <StatBar label="ATK" value={player.stats.attack} labelClass="text-rose-300/80" compact />
            <StatBar label="DEF" value={player.stats.defense} labelClass="text-sky-300/80" compact />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={signFeatured}
        disabled={already || !affordable}
        data-testid="sign-featured"
        className={[
          'mt-3 flex w-full items-center justify-center gap-1.5 rounded-md py-2 font-display text-sm transition',
          already
            ? 'cursor-default border border-white/10 bg-white/5 text-chrome-muted'
            : affordable
              ? 'border border-crt-green/40 bg-crt-green/20 text-crt-green hover:bg-crt-green/30'
              : 'cursor-not-allowed border border-white/10 bg-white/5 text-chrome-muted',
        ].join(' ')}
      >
        {already ? (
          <><Check size={14} /> Signed</>
        ) : (
          <>
            <Coins size={13} /> Sign £{cost}M
            <span className="text-chrome-muted line-through">£{player.cost}M</span>
          </>
        )}
      </button>
    </div>
  );
}
