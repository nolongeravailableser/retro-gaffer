import { useMemo, useState } from 'react';
import { Search, Users, Wand2, Lock } from 'lucide-react';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { POOL } from '@/data/pool';
import { overall, LEAGUE_NEUTRAL_TIER } from '@/lib/wages';
import { transferFee, poachFee, isFreeAgent } from '@/lib/market';
import { division, isWindowOpen, nextWindowOpensAt } from '@/lib/league';
import { computeChemistry } from '@/lib/chemistry';
import { ROSTER_CAP } from '@/lib/economy';
import type { Player, Role } from '@/lib/types';
import { ROLE_STYLES } from '@/components/ui/roleStyles';
import NegotiationModal from './NegotiationModal';

type RoleFilter = 'ALL' | Role;
const ROLE_FILTERS: RoleFilter[] = ['ALL', 'GK', 'DEF', 'MID', 'FWD'];
type Avail = 'all' | 'free' | 'clubs';
const MAX_ROWS = 60;

/**
 * The Career/League transfer market: a browsable, searchable, filterable list of
 * every player — free agents you can sign for nothing, unattached players at
 * market value, and rivals' players you can POACH (for a premium, weakening
 * them). Replaces the roguelike draft shop in the simulation modes.
 */
export default function TransferMarket() {
  const owned = useGameStore((s) => s.owned);
  const xi = useGameStore((s) => s.xi);
  const bankroll = useGameStore((s) => s.bankroll);
  const career = useGameStore((s) => s.career);
  const league = useGameStore((s) => s.league);
  const autoFillSquad = useGameStore((s) => s.autoFillSquad);

  const [role, setRole] = useState<RoleFilter>('ALL');
  const [avail, setAvail] = useState<Avail>('all');
  const [query, setQuery] = useState('');
  const [negotiating, setNegotiating] = useState<Player | null>(null);

  const tier = career?.tier ?? LEAGUE_NEUTRAL_TIER;
  const divName = career ? division(career.tier).name : 'League';

  // Transfer window: signings/sales are only allowed while it's open.
  const weeks = league ? league.clubs.length - 1 : 0;
  const windowOpen = league ? isWindowOpen(league.matchweek, weeks) : true;
  const reopensAt = league ? nextWindowOpensAt(league.matchweek, weeks) : null;

  const starters = useMemo(
    () => xi.map((id) => getPlayer(id)).filter((p): p is Player => !!p),
    [xi]
  );
  const ownedSet = useMemo(() => new Set(owned), [owned]);

  // Map each rival-owned player id → its club name (poach targets).
  const clubByPlayer = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of league?.clubs ?? []) {
      for (const id of c.squad ?? []) m.set(id, c.name);
    }
    return m;
  }, [league]);

  const feeOf = (p: Player) => (clubByPlayer.has(p.id) ? poachFee(p, tier) : transferFee(p, tier));

  const { rows, total } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = POOL.filter((p) => {
      if (ownedSet.has(p.id)) return false;
      if (role !== 'ALL' && p.role !== role) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      const atClub = clubByPlayer.has(p.id);
      if (avail === 'free' && (atClub || !isFreeAgent(p))) return false;
      if (avail === 'clubs' && !atClub) return false;
      return true;
    });
    // Affordable first (the best you can actually sign now), then best-rated.
    list.sort((a, b) => {
      const aff = (feeOf(b) <= bankroll ? 1 : 0) - (feeOf(a) <= bankroll ? 1 : 0);
      return aff || overall(b) - overall(a);
    });
    return { rows: list.slice(0, MAX_ROWS), total: list.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownedSet, role, avail, query, tier, bankroll, clubByPlayer]);

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
            disabled={!windowOpen}
            data-testid="auto-fill"
            title={windowOpen ? 'Fill empty XI slots with the best free agents (£0) — a legal side in one tap' : 'Transfer window closed'}
            className="flex items-center gap-1 rounded-md border border-crt-green/40 bg-crt-green/10 px-2 py-1.5 text-xs font-display text-crt-green transition hover:bg-crt-green/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Wand2 size={13} />
            <span className="hidden sm:inline">Fill (free)</span>
          </button>
        </div>
      </div>

      {/* Transfer-window status */}
      {league &&
        (windowOpen ? (
          <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-crt-green/25 bg-crt-green/5 px-3 py-1.5 font-ticker text-[11px] text-crt-green">
            <span className="h-1.5 w-1.5 rounded-full bg-crt-green" />
            Transfer window open · matchweek {league.matchweek}
          </div>
        ) : (
          <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-crt-amber/30 bg-crt-amber/5 px-3 py-1.5 font-ticker text-[11px] text-crt-amber" data-testid="window-closed">
            <Lock size={12} />
            Transfer window closed{reopensAt ? ` — reopens matchweek ${reopensAt}` : ' for the rest of the season'}. Browse now, deal then.
          </div>
        ))}

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
        <div className="flex items-center gap-1">
          {([['all', 'Everyone'], ['free', 'Free agents'], ['clubs', 'At clubs']] as [Avail, string][]).map(
            ([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAvail(key)}
                className={[
                  'rounded-full border px-2.5 py-1 text-xs font-display transition',
                  avail === key
                    ? 'border-crt-green bg-crt-green/20 text-crt-green'
                    : 'border-white/10 text-chrome-muted hover:text-chrome hover:bg-white/5',
                ].join(' ')}
              >
                {label}
              </button>
            )
          )}
        </div>
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
          const atClub = clubByPlayer.get(p.id);
          const fee = feeOf(p);
          const free = fee === 0;
          const rs = ROLE_STYLES[p.role];
          const withC = computeChemistry([...starters, p]);
          const pc = withC.perPlayer.find((x) => x.player.id === p.id);
          const bonus = pc ? Math.round((pc.multiplier - 1) * 100) : 0;
          const affordable = bankroll >= fee && !full;
          const signable = affordable && windowOpen;
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
                  {atClub ? <span className="text-fuchsia-300">↪ {atClub}</span> : `${p.club} · ${p.era}`}
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
                onClick={() => setNegotiating(p)}
                disabled={!signable}
                data-testid={`sign-${p.id}`}
                title={
                  !windowOpen
                    ? 'Transfer window closed'
                    : full
                      ? 'Squad full'
                      : affordable
                        ? atClub ? `Negotiate a poach (~£${fee}M)` : free ? 'Agree terms (free)' : `Open negotiations (~£${fee}M)`
                        : `Need £${fee}M`
                }
                className={[
                  'flex w-20 shrink-0 items-center justify-center rounded border px-2 py-1 font-display text-[11px] transition',
                  atClub
                    ? 'border-fuchsia-400/50 text-fuchsia-200 hover:bg-fuchsia-500/15'
                    : free
                      ? 'border-crt-green/50 text-crt-green hover:bg-crt-green/15'
                      : 'border-crt-amber/40 text-crt-amber hover:bg-crt-amber/10',
                  !signable && 'cursor-not-allowed opacity-40',
                ].join(' ')}
              >
                {atClub ? `£${fee}M` : free ? 'Free' : `£${fee}M`}
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
        Showing {rows.length} of {total} · Squad {owned.length}/{ROSTER_CAP} · free agents (under 64 OVR)
        are free; <span className="text-fuchsia-300">poaching</span> a rival weakens them.
      </p>

      {negotiating && (
        <NegotiationModal
          key={negotiating.id}
          player={negotiating}
          onClose={() => setNegotiating(null)}
        />
      )}
    </div>
  );
}
