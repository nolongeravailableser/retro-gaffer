import { useMemo, useState } from 'react';
import { RefreshCw, Sparkles, Lock, LockOpen, ArrowDownUp } from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { checkBuy, ROSTER_CAP } from '@/lib/economy';
import { computeChemistry } from '@/lib/chemistry';
import { PACKS, getPack } from '@/lib/packs';
import type { Player } from '@/lib/types';
import ShopCard, { type ChemPreview } from './ShopCard';

type SortKey = 'default' | 'cost' | 'attack' | 'defense';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Offered' },
  { key: 'cost', label: 'Cost' },
  { key: 'attack', label: 'ATK' },
  { key: 'defense', label: 'DEF' },
];

/** The transfer market: themed packs + 3 offers + a paid refresh. */
export default function Shop() {
  const shop = useGameStore((s) => s.shop);
  const bankroll = useGameStore((s) => s.bankroll);
  const owned = useGameStore((s) => s.owned);
  const xi = useGameStore((s) => s.xi);
  const packId = useGameStore((s) => s.pack);
  const shopLocked = useGameStore((s) => s.shopLocked);
  const buy = useGameStore((s) => s.buy);
  const refreshShop = useGameStore((s) => s.refreshShop);
  const setPack = useGameStore((s) => s.setPack);
  const toggleLock = useGameStore((s) => s.toggleLock);

  const [sort, setSort] = useState<SortKey>('default');

  const pack = getPack(packId);
  const canRefresh = bankroll >= pack.cost;

  // Current starters drive the speculative "what if I sign him" chemistry.
  const starters = useMemo(
    () => xi.map((id) => getPlayer(id)).filter((p): p is Player => !!p),
    [xi]
  );

  // Each offer paired with its index (so buy() still targets the right slot)
  // and a chemistry preview, optionally re-sorted for comparison.
  const offers = useMemo(() => {
    const list = shop.map((id, index) => {
      const player = id ? getPlayer(id) ?? null : null;
      let chem: ChemPreview | undefined;
      if (player) {
        const withC = computeChemistry([...starters, player]);
        const pc = withC.perPlayer.find((x) => x.player.id === player.id);
        const bonusPct = pc ? Math.round((pc.multiplier - 1) * 100) : 0;
        chem = { bonusPct, tags: pc?.sharedTags ?? [] };
      }
      return { player, index, chem };
    });

    if (sort === 'default') return list;
    const val = (p: Player | null) =>
      !p ? -1 : sort === 'cost' ? p.cost : p.stats[sort];
    // Keep sold (null) slots at the end; sort the rest descending.
    return [...list].sort((a, b) => val(b.player) - val(a.player));
  }, [shop, starters, sort]);

  return (
    <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-xl">Transfer Market</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLock}
            data-testid="lock-shop"
            aria-pressed={shopLocked}
            title={shopLocked ? 'Shop locked — holds across rounds' : 'Lock shop across rounds'}
            className={[
              'flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-display transition',
              shopLocked
                ? 'border-crt-amber/60 bg-crt-amber/15 text-crt-amber'
                : 'border-white/10 text-chrome-muted hover:text-chrome',
            ].join(' ')}
          >
            {shopLocked ? <Lock size={13} /> : <LockOpen size={13} />}
            <span className="hidden sm:inline">{shopLocked ? 'Locked' : 'Lock'}</span>
          </button>
          <button
            type="button"
            onClick={refreshShop}
            disabled={!canRefresh}
            data-testid="refresh-shop"
            title={canRefresh ? `Re-roll the market for £${pack.cost}M` : `Need £${pack.cost}M to refresh`}
            className={[
              'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-display transition',
              canRefresh
                ? 'border-crt-amber/40 text-crt-amber hover:bg-crt-amber/10'
                : 'cursor-not-allowed border-white/10 text-chrome-muted',
            ].join(' ')}
          >
            <RefreshCw size={13} />
            Refresh £{pack.cost}M
          </button>
        </div>
      </div>

      {/* Pack selector */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        {PACKS.map((p) => {
          const active = p.id === packId;
          const premium = !!p.guarantee;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPack(p.id)}
              data-testid={`pack-${p.id}`}
              title={p.blurb}
              className={[
                'flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-display transition',
                active
                  ? 'border-crt-green bg-crt-green/20 text-crt-green'
                  : 'border-white/10 text-chrome-muted hover:text-chrome hover:bg-white/5',
                premium && !active ? 'border-fuchsia-400/40 text-fuchsia-200' : '',
              ].join(' ')}
            >
              {premium && <Sparkles size={11} />}
              {p.name}
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] text-chrome-muted">{pack.blurb}</p>
        {/* Sort offers for quick comparison */}
        <div className="flex shrink-0 items-center gap-1">
          <ArrowDownUp size={11} className="text-chrome-muted" />
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className={[
                'rounded px-1.5 py-0.5 text-[10px] font-display transition',
                sort === s.key
                  ? 'bg-crt-green/20 text-crt-green'
                  : 'text-chrome-muted hover:text-chrome hover:bg-white/5',
              ].join(' ')}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {offers.map(({ player, index, chem }) => {
          const check = player
            ? checkBuy(bankroll, owned.length, player)
            : { ok: false as const };
          return (
            <ShopCard
              key={player?.id ?? `empty-${index}`}
              player={player}
              affordable={!!player && check.ok}
              blockedReason={'reason' in check ? check.reason : undefined}
              chem={chem}
              onBuy={() => buy(index)}
            />
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-chrome-muted">
        Squad {owned.length}/{ROSTER_CAP} · sell players for 80% of value.
      </p>
    </div>
  );
}
