import { RefreshCw, Sparkles, Lock, LockOpen } from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { checkBuy, ROSTER_CAP } from '@/lib/economy';
import { PACKS, getPack } from '@/lib/packs';
import ShopCard from './ShopCard';

/** The transfer market: themed packs + 3 offers + a paid refresh. */
export default function Shop() {
  const shop = useGameStore((s) => s.shop);
  const bankroll = useGameStore((s) => s.bankroll);
  const owned = useGameStore((s) => s.owned);
  const packId = useGameStore((s) => s.pack);
  const shopLocked = useGameStore((s) => s.shopLocked);
  const buy = useGameStore((s) => s.buy);
  const refreshShop = useGameStore((s) => s.refreshShop);
  const setPack = useGameStore((s) => s.setPack);
  const toggleLock = useGameStore((s) => s.toggleLock);

  const pack = getPack(packId);
  const canRefresh = bankroll >= pack.cost;

  return (
    <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
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
          </button>
          <button
            type="button"
            onClick={refreshShop}
            disabled={!canRefresh}
            data-testid="refresh-shop"
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

      <p className="mb-3 text-[11px] text-chrome-muted">{pack.blurb}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {shop.map((id, i) => {
          const player = getPlayer(id) ?? null;
          const affordable =
            !!player && checkBuy(bankroll, owned.length, player).ok;
          return (
            <ShopCard
              key={id ?? `empty-${i}`}
              player={player}
              affordable={affordable}
              onBuy={() => buy(i)}
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
