import { Building2, Dumbbell, HeartPulse, Hammer } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import {
  FACILITIES, FACILITY_IDS, MAX_LEVEL, upgradeCost, isMaxed,
  matchdayIncome, youthBonus, injuryReduction, facilityUpkeep, type FacilityId,
} from '@/lib/stadium';
import { tierMult } from '@/lib/wages';

const FACILITY_ICON: Record<FacilityId, typeof Building2> = {
  stadium: Building2,
  academy: Dumbbell,
  medical: HeartPulse,
};

/** The current in-season effect of a facility, phrased for the player. */
function effectLabel(id: FacilityId, level: number): string {
  if (id === 'stadium') return `+£${matchdayIncome(level)}M matchday income`;
  if (id === 'academy') {
    const extra = youthBonus(level);
    return extra > 0 ? `+${extra} academy prospect${extra > 1 ? 's' : ''}` : 'standard intake';
  }
  const r = injuryReduction(level);
  return r > 0 ? `injuries −${r} round${r > 1 ? 's' : ''}` : 'no injury relief';
}

interface FacilitiesPanelProps {
  /** Hide the section heading (the hub supplies its own). */
  bare?: boolean;
}

/**
 * Club facilities with in-place upgrades — shared by the Career Hub (mid-season)
 * and the between-seasons review. Reads/writes the store directly.
 */
export default function FacilitiesPanel({ bare = false }: FacilitiesPanelProps) {
  const facilities = useGameStore((s) => s.career?.facilities ?? null);
  const tier = useGameStore((s) => s.career?.tier ?? null);
  const bankroll = useGameStore((s) => s.bankroll);
  const upgradeFacility = useGameStore((s) => s.upgradeFacility);
  if (!facilities || tier === null) return null;

  const upkeep = facilityUpkeep(facilities, tierMult(tier));

  return (
    <div>
      {!bare && (
        <p className="mb-2 flex items-center gap-1.5 font-display text-sm text-chrome">
          <Hammer size={16} className="text-crt-green" />
          Club Development
        </p>
      )}
      <div className="flex flex-col gap-2">
        {FACILITY_IDS.map((id) => {
          const info = FACILITIES[id];
          const level = facilities[id];
          const Icon = FACILITY_ICON[id];
          const maxed = isMaxed(level);
          const cost = maxed ? 0 : upgradeCost(id, level);
          const affordable = bankroll >= cost;
          return (
            <div
              key={id}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-pitch-900/40 p-3"
            >
              <Icon size={18} className="shrink-0 text-crt-green" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-display text-sm text-chrome">{info.name}</p>
                  <span className="font-ticker text-[10px] text-crt-amber">{effectLabel(id, level)}</span>
                </div>
                <p className="truncate text-[11px] text-chrome-muted">{info.blurb}</p>
                <div className="mt-1 flex items-center gap-1">
                  {Array.from({ length: MAX_LEVEL }, (_, i) => (
                    <span
                      key={i}
                      className={['h-1.5 w-5 rounded-full', i < level ? 'bg-crt-green' : 'bg-white/15'].join(' ')}
                    />
                  ))}
                  <span className="ml-1 text-[10px] text-chrome-muted">Lvl {level}/{MAX_LEVEL}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => upgradeFacility(id)}
                disabled={maxed || !affordable}
                data-testid={`upgrade-${id}`}
                title={maxed ? 'Maxed out' : affordable ? `Upgrade for £${cost}M` : `Need £${cost}M`}
                className="flex shrink-0 items-center gap-0.5 rounded border border-crt-green/40 px-2 py-1 font-display text-[11px] text-crt-green hover:bg-crt-green/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {maxed ? 'MAX' : <>£{cost}M</>}
              </button>
            </div>
          );
        })}
      </div>
      {upkeep > 0 && (
        <p className="mt-2 text-right font-ticker text-[10px] text-chrome-muted">
          Running costs: <span className="text-rose-300">−£{upkeep}M</span> / matchweek
        </p>
      )}
    </div>
  );
}
