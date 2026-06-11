import { useMemo, useState } from 'react';
import { Search, Users, Wand2, BadgePoundSterling } from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { POOL } from '@/data/pool';
import { overall } from '@/lib/wages';
import { transferFee, isFreeAgent } from '@/lib/market';
import { LEAGUE_NEUTRAL_TIER } from '@/lib/wages';
import { division } from '@/lib/league';
import { computeChemistry } from '@/lib/chemistry';
import { ROSTER_CAP } from '@/lib/economy';
import type { Player, Role } from '@/lib/types';
import { ROLE_STYLES } from '@/components/ui/roleStyles';

type RoleFilter = 'ALL' | Role;
const ROLE_FILTERS: RoleFilter[] = ['ALL', 'GK', 'DEF', 'MID', 'FWD'];
const MAX_ROWS = 60;

/**
 * The Career/League transfer market: a browsable, searchable, filterable list of
 * every available player priced at market value — with a free-agent tier you can
 * always dip into. Replaces the roguelike draft shop in the simulation modes.
 */
export default function TransferMarket() {
  const owned = useGameStore((s) => s.owned);
  const xi = useGameStore((s) => s.xi);
  const bankroll = useGameStore((s) => s.bankroll);
  const career = useGameStore((s) => s.career);
  const signPlayer = useGameStore((s) => s.signPlayer);
  const autoFillSquad = useGameStore((s) => s.autoFillSquad);

  const [role, setRole] = useState<RoleFilter>('ALL');
  const [freeOnly, setFreeOnly] = useState(false);
  const [query, setQuery] = useState('');

  const tier = career?.tier ?? LEAGUE_NEUTRAL_TIER;
  const divName = career ? division(career.tier).name : 'League';

  const starters = useMemo(
    () => xi.map((id) => getPlayer(id)).filter((p): p is Player => !!p),
    [xi]
  );

  const ownedSet = useMemo(() => new Set(owned), [owned]);

  const { rows, total } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const avail = POOL.filter((p) => {
      if (ownedSet.has(p.id)) return false;
      if (role !== 'ALL' && p.role !== role) return false;
      if (freeOnly && !isFreeAgent(p)) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
    // Affordable players first (the best you can actually sign on this budget —
    // including free agents), then the rest; each group best-rated first. So a
    // new manager sees signable targets, not just unaffordable galácticos.
    avail.sort((a, b) => {
      const aff = (transferFee(b, tier) <= bankroll ? 1 : 0) - (transferFee(a, tier) <= bankroll ? 1 : 0);
      return aff || overall(b) - overall(a);
    });
    return { rows: avail.slice(0, MAX_ROWS), total: avail.length };
  }, [ownedSet, role, freeOnly, query, tier, bankroll]);

  const full = owned.length >= ROSTER_CAP;

  return (
    <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-4" data-testid="transfer-market">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl">Transfer Market</h2>
        <div className="flex items-center gap-2">
          <span className="font-ticker text-xs text-chrome-muted">{divName} prices</span>
          <button
            type="button"
            onClick={autoFillSquad}
            data-testid="auto-fill"
            title="Fill empty XI slots with the best free agents (£0) — a legal side in one tap"
            className="flex items-center gap-1 rounded-md border border-crt-green/40 bg-crt-green/10 px-2 py-1.5 text-xs font-display text-crt-green transition hover:bg-crt-green/20"
          >
            <Wand2 size={13} />
            <span className="hidden sm:inline">Fill (free)</span>
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {ROLE_FILTERS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={[
                'rounded-full border px-2.5 py-1 text-xs font-display transition',
                role === r
                  ? 'border-crt-green bg-crt-green/20 text-crt-green'
                  : 'border-white/10 text-chrome-muted hover:text-chrome hover:bg-white/5',
              ].join(' ')}
            >
              {r === 'ALL' ? 'All' : r}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setFreeOnly((v) => !v)}
          className={[
            'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-display transition',
            freeOnly
              ? 'border-crt-green bg-crt-green/20 text-crt-green'
              : 'border-white/10 text-chrome-muted hover:text-chrome hover:bg-white/5',
          ].join(' ')}
        >
          <BadgePoundSterling size={12} /> Free agents
        </button>
        <div className="relative ml-auto flex items-center">
          <Search size={13} className="absolute left-2 text-chrome-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players…"
            data-testid="market-search"
            className="w-40 rounded-md border border-white/10 bg-pitch-950 py-1 pl-7 pr-2 text-xs text-chrome placeholder:text-chrome-muted focus:border-crt-green/50 focus:outline-none"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-1.5">
        {rows.map((p) => {
          const fee = transferFee(p, tier);
          const free = fee === 0;
          const rs = ROLE_STYLES[p.role];
          const withC = computeChemistry([...starters, p]);
          const pc = withC.perPlayer.find((x) => x.player.id === p.id);
          const bonus = pc ? Math.round((pc.multiplier - 1) * 100) : 0;
          const affordable = bankroll >= fee && !full;
          return (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-pitch-950/40 px-2.5 py-1.5"
            >
              <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-display ${rs.text} ${rs.bg} ${rs.border}`}>
                {p.position ?? p.role}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm text-chrome">{p.name}</p>
                <p className="truncate font-ticker text-[10px] text-chrome-muted">
                  {p.club} · {p.era}
                  {bonus > 0 && <span className="ml-1 text-crt-green">✦+{bonus}%</span>}
                </p>
              </div>
              <div className="shrink-0 text-right font-ticker text-[10px] text-chrome-muted">
                <span className="text-rose-300/80">{p.stats.attack}</span>
                {' · '}
                <span className="text-sky-300/80">{p.stats.defense}</span>
                <div className="font-display text-chrome">OVR {overall(p)}</div>
              </div>
              <button
                type="button"
                onClick={() => signPlayer(p.id)}
                disabled={!affordable}
                data-testid={`sign-${p.id}`}
                title={full ? 'Squad full' : affordable ? `Sign for ${free ? 'free' : `£${fee}M`}` : `Need £${fee}M`}
                className={[
                  'flex w-20 shrink-0 items-center justify-center rounded border px-2 py-1 font-display text-[11px] transition',
                  free
                    ? 'border-crt-green/50 text-crt-green hover:bg-crt-green/15'
                    : 'border-crt-amber/40 text-crt-amber hover:bg-crt-amber/10',
                  !affordable && 'cursor-not-allowed opacity-40',
                ].join(' ')}
              >
                {free ? 'Free' : `£${fee}M`}
              </button>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="py-6 text-center text-xs text-chrome-muted">No players match your filters.</p>
        )}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-chrome-muted">
        <Users size={12} />
        Showing {rows.length} of {total} available · Squad {owned.length}/{ROSTER_CAP} · free agents
        (under 64 OVR) cost nothing.
      </p>
    </div>
  );
}
