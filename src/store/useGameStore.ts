import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  SAVE_KEY,
  CURRENT_VERSION,
  migrateSave,
  isValidSave,
  safeStorage,
  importLegacySave,
  externalSaveChange,
} from './persistence';
import { encodeSave, decodeSave } from '@/lib/savecode';
import { POOL, getPlayer } from '@/data/pool';
import type { Player } from '@/lib/types';
import { XI_SIZE, BENCH_SIZE } from '@/lib/types';
import {
  DEFAULT_FORMATION,
  getFormation,
  slotRole,
} from '@/lib/formations';
import { getPack } from '@/lib/packs';
import {
  interest,
  streakBonus,
  wageBill,
  maxWager,
  lifeBuybackCost,
} from '@/lib/ladder';
import { dailyKey, dailySeed } from '@/lib/daily';
import { getBoss } from '@/lib/bosses';
import { drawEvent, type GameEvent } from '@/lib/events';
import { DEFAULT_MODE_ID, type ModeId } from '@/lib/modes';
import { resolveConfig, dailyMutator } from '@/lib/mutators';
import { relicBuyDiscount, relicHasFreeRefresh } from '@/lib/relics';
import { NO_MODIFIERS, type MatchModifiers } from '@/lib/effects';
import { Rng } from '@/lib/rng';
import {
  SHOP_SIZE,
  ROSTER_CAP,
  MATCH_REWARD,
  checkBuy,
  checkRefresh,
  sellValue,
  drawShop,
} from '@/lib/economy';
import type { MatchResult } from '@/lib/types';

export { getPlayer };

/** Is this slot index legal for the given player's role in this formation? */
export function isSlotEligible(
  playerId: string,
  slotIndex: number,
  formationId: string
): boolean {
  const p = getPlayer(playerId);
  return !!p && slotRole(formationId, slotIndex) === p.role;
}

type ShopSlots = (string | null)[];

function padShop(ids: string[]): ShopSlots {
  return Array.from({ length: SHOP_SIZE }, (_, i) => ids[i] ?? null);
}

/** Roll the shop slots for a pack at a given seed (deterministic, no advance). */
function rollSlots(owned: Iterable<string>, seed: number, packId: string): ShopSlots {
  const pack = getPack(packId);
  const rng = new Rng(seed);
  const pool = POOL.filter(pack.filter);
  const ids = drawShop(pool, new Set(owned), rng, SHOP_SIZE, pack.guarantee);
  return padShop(ids);
}

/** Derive the next shop seed (advances the deterministic chain on refresh). */
function nextSeed(seed: number): number {
  return new Rng(seed).int(1, 0x7fffffff);
}

interface GameState {
  pool: Player[];
  bankroll: number;
  /** Ids the manager owns (placed, benched, or unassigned). */
  owned: string[];
  /** Current shop offers; null = bought/empty until refresh. */
  shop: ShopSlots;
  /** Seed the current shop was rolled from. */
  shopSeed: number;
  /** Active shop pack id (themed draw pool). */
  pack: string;
  /** Active formation id (e.g. '442'); maps each XI slot to a required role. */
  formation: string;
  /** Starting XI: index → playerId | null, indexed by the formation's slots. */
  xi: (string | null)[];
  /** Bench player ids (max BENCH_SIZE). */
  bench: string[];
  /** Picked-up player for click-to-assign, or null. */
  selectedPlayerId: string | null;
  /** Transient toast for blocked actions (e.g. "Not enough funds"). */
  notice: string | null;
  /** Career record across the run. */
  record: { w: number; d: number; l: number };

  // --- season ladder ---
  /** Active game mode id (drives the ruleset via resolveConfig). */
  mode: ModeId;
  /** Active run mutator id (Rule of the Day / chosen modifier), or null. */
  mutator: string | null;
  /** Current round (1-based). */
  round: number;
  /** Lives remaining; 0 ends the run. */
  lives: number;
  /** Consecutive wins. */
  streak: number;
  /** Run state. */
  runStatus: 'playing' | 'won' | 'lost';
  /** Fixed seed for this run's ladder opponents. */
  runSeed: number;
  /** Daily-challenge date key (e.g. '2026-06-09'), or null for a casual run. */
  daily: string | null;
  /** Breakdown of the last round's payout (for the UI). */
  lastIncome: {
    reward: number;
    income: number;
    interest: number;
    streak: number;
    wage: number;
    wager: number;
  } | null;
  /** Stake placed on the upcoming match (Gaffer's Gamble). */
  wager: number;
  /** How many lives have been bought back this run (escalates the price). */
  lifeBuybacks: number;
  /** A clean-sheet shield that absorbs the next defeat. */
  shield: boolean;
  /** Best win streak reached this run. */
  bestStreak: number;
  /** Highest bankroll reached this run. */
  peakBankroll: number;
  /** Keep the shop frozen across the next round advance. */
  shopLocked: boolean;
  /** Career-best run, persisted across runs (highest round reached). */
  best: { round: number };

  // --- discipline & fitness ---
  /** Player IDs banned for the upcoming match (red card last game). Cleared after the match. */
  suspensions: string[];
  /** playerId → rounds remaining injured. Decremented after each resolved round. */
  injuries: Record<string, number>;

  // --- events & relics (Pillar 4) ---
  /** Owned persistent relics. */
  relics: string[];
  /** Modifiers in force for the current round's match. */
  roundMods: MatchModifiers;
  /** The current round's drawn event (tabloid headline), or null. */
  event: GameEvent | null;
  /** Whether this round's free refresh (Lucky Boots) has been used. */
  freeRefreshUsed: boolean;

  // economy
  buy: (shopIndex: number) => void;
  sell: (id: string) => void;
  refreshShop: () => void;
  /** Switch the shop pack; re-rolls from the current seed for free. */
  setPack: (id: string) => void;
  /** Toggle the shop lock (freezes it across the next round). */
  toggleLock: () => void;
  /** Claim one of the relics offered by the current event. */
  claimRelic: (id: string) => void;
  /** Dismiss the current event banner. */
  dismissEvent: () => void;
  /** Apply a finished exhibition (PvP) match: pay the reward, update record. */
  awardMatch: (result: MatchResult) => void;
  /** Resolve a finished ladder round: payout + interest + lives + advance. */
  resolveRound: (result: MatchResult) => void;
  /** Set the pre-match wager (clamped to half the current bankroll). */
  setWager: (amount: number) => void;
  /** Buy back one lost life at the escalating price. */
  buyLife: () => void;

  /** Switch formation, re-slotting placed players by role where possible. */
  setFormation: (id: string) => void;

  // selection + placement
  selectPlayer: (id: string | null) => void;
  slotClicked: (slotIndex: number) => void;
  placeInSlot: (id: string, slotIndex: number) => void;
  sendToBench: (id: string) => void;
  removeFromSlot: (slotIndex: number) => void;
  removeFromBench: (id: string) => void;
  benchAll: () => void;

  clearNotice: () => void;
  newGame: () => void;
  /** Start a run in a chosen mode with an optional mutator. */
  startRun: (modeId: ModeId, mutatorId?: string | null) => void;
  /** Start today's deterministic Daily Challenge. */
  newDailyRun: () => void;
  /** Serialize the current run to a portable save code. */
  exportSave: () => string;
  /** Load a run from a save code; returns an error string or null on success. */
  importSave: (code: string) => string | null;
}

const emptyXi = (): (string | null)[] => Array(XI_SIZE).fill(null);

/** Fresh-run economic state, with the opening shop already rolled. */
function freshRun(
  daily: string | null = null,
  modeId: ModeId = DEFAULT_MODE_ID,
  mutatorId: string | null = null
) {
  const config = resolveConfig(modeId, mutatorId);
  // Daily challenge: both seeds derive from the date so everyone gets the same
  // opening shop + ladder. Casual: independent random seeds.
  const shopSeed = daily
    ? dailySeed(daily)
    : (Date.now() & 0x7fffffff) || 1;
  const runSeed = daily
    ? dailySeed(daily) ^ 0x5f3759df
    : ((Date.now() >>> 1) & 0x7fffffff) || 7;
  return {
    mode: modeId,
    mutator: mutatorId,
    bankroll: config.startingBankroll,
    owned: [] as string[],
    shop: rollSlots([], shopSeed, 'all'),
    shopSeed,
    daily,
    pack: 'all',
    formation: DEFAULT_FORMATION,
    xi: emptyXi(),
    bench: [] as string[],
    selectedPlayerId: null,
    notice: null,
    record: { w: 0, d: 0, l: 0 },
    round: 1,
    lives: config.startingLives,
    streak: 0,
    runStatus: 'playing' as const,
    runSeed,
    lastIncome: null,
    bestStreak: 0,
    peakBankroll: config.startingBankroll,
    shopLocked: false,
    wager: 0,
    lifeBuybacks: 0,
    shield: false,
    suspensions: [] as string[],
    injuries: {} as Record<string, number>,
    relics: [] as string[],
    roundMods: NO_MODIFIERS,
    event: null as GameEvent | null,
    freeRefreshUsed: false,
  };
}

/** The durable run slice — persisted AND exported as a save code. */
function saveSlice(s: GameState) {
  return {
    mode: s.mode,
    mutator: s.mutator,
    bankroll: s.bankroll,
    owned: s.owned,
    shop: s.shop,
    shopSeed: s.shopSeed,
    pack: s.pack,
    formation: s.formation,
    xi: s.xi,
    bench: s.bench,
    record: s.record,
    round: s.round,
    lives: s.lives,
    streak: s.streak,
    runStatus: s.runStatus,
    runSeed: s.runSeed,
    daily: s.daily,
    bestStreak: s.bestStreak,
    peakBankroll: s.peakBankroll,
    shopLocked: s.shopLocked,
    best: s.best,
    relics: s.relics,
    roundMods: s.roundMods,
    event: s.event,
    freeRefreshUsed: s.freeRefreshUsed,
    wager: s.wager,
    lifeBuybacks: s.lifeBuybacks,
    shield: s.shield,
    suspensions: s.suspensions,
    injuries: s.injuries,
  };
}

// One-time: carry the legacy v7 save onto the new stable key before rehydration.
importLegacySave();

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      pool: POOL,
      best: { round: 0 },
      ...freshRun(),

      buy: (shopIndex) => {
        const { shop, bankroll, owned, relics, xi, bench, formation } = get();
        const id = shop[shopIndex];
        const player = getPlayer(id);
        if (!id || !player) return;
        const cost = Math.max(0, player.cost - relicBuyDiscount(relics));
        // Validate against the discounted cost.
        const check = checkBuy(bankroll, owned.length, { ...player, cost });
        if (!check.ok) {
          set({ notice: check.reason ?? 'Cannot buy' });
          return;
        }
        const nextShop = [...shop];
        nextShop[shopIndex] = null;

        // Auto-assign: try first empty XI slot matching the player's role, then bench.
        const newXi = [...xi];
        let placedInXi = false;
        for (let i = 0; i < XI_SIZE; i++) {
          if (newXi[i] === null && slotRole(formation, i) === player.role) {
            newXi[i] = id;
            placedInXi = true;
            break;
          }
        }
        const newBench = [...bench];
        let placedOnBench = false;
        if (!placedInXi && newBench.length < BENCH_SIZE) {
          newBench.push(id);
          placedOnBench = true;
        }

        set({
          bankroll: bankroll - cost,
          owned: [...owned, id],
          shop: nextShop,
          xi: placedInXi ? newXi : xi,
          bench: placedOnBench ? newBench : bench,
          notice: null,
        });
      },

      sell: (id) => {
        const { owned } = get();
        const player = getPlayer(id);
        if (!player || !owned.includes(id)) return;
        set((s) => ({
          bankroll: s.bankroll + sellValue(player),
          owned: s.owned.filter((o) => o !== id),
          xi: s.xi.map((slot) => (slot === id ? null : slot)),
          bench: s.bench.filter((b) => b !== id),
          selectedPlayerId: s.selectedPlayerId === id ? null : s.selectedPlayerId,
          notice: null,
        }));
      },

      refreshShop: () => {
        const { bankroll, owned, shopSeed, pack, relics, freeRefreshUsed } = get();
        // Lucky Boots: first refresh each round is free.
        const free = relicHasFreeRefresh(relics) && !freeRefreshUsed;
        const cost = free ? 0 : getPack(pack).cost;
        const check = checkRefresh(bankroll, cost);
        if (!check.ok) {
          set({ notice: check.reason ?? 'Cannot refresh' });
          return;
        }
        const seed = nextSeed(shopSeed);
        set({
          bankroll: bankroll - cost,
          shop: rollSlots(owned, seed, pack),
          shopSeed: seed,
          freeRefreshUsed: freeRefreshUsed || free,
          notice: null,
        });
      },

      setPack: (id) => {
        const { owned, shopSeed } = get();
        // Free re-roll from the current seed (browsing, not a paid refresh).
        set({ pack: id, shop: rollSlots(owned, shopSeed, id), notice: null });
      },

      awardMatch: (result) =>
        set((s) => {
          const key =
            result.outcome === 'win' ? 'w' : result.outcome === 'loss' ? 'l' : 'd';
          return {
            bankroll: s.bankroll + MATCH_REWARD[result.outcome],
            record: { ...s.record, [key]: s.record[key] + 1 },
            notice: null,
          };
        }),

      resolveRound: (result) =>
        set((s) => {
          if (s.runStatus !== 'playing') return {};
          const config = resolveConfig(s.mode, s.mutator);
          const boss = getBoss(s.round, config.bosses);
          // Boss sudden-death: a draw against an unbeaten side is a defeat.
          const outcome =
            boss?.suddenDeath && result.outcome === 'draw' ? 'loss' : result.outcome;
          const key = outcome === 'win' ? 'w' : outcome === 'loss' ? 'l' : 'd';
          const newStreak = outcome === 'win' ? s.streak + 1 : 0;

          const reward = MATCH_REWARD[outcome];
          const intr = interest(s.bankroll);
          const sb = outcome === 'win' ? streakBonus(newStreak) : 0;
          const wage = wageBill(s.owned.length);
          // Gaffer's Gamble: win the stake, lose the stake, draw pushes.
          const wagerDelta =
            outcome === 'win' ? s.wager : outcome === 'loss' ? -s.wager : 0;
          const payout = reward + config.roundIncome + intr + sb - wage + wagerDelta;
          const bankroll = Math.max(0, s.bankroll + payout);

          // Clean-sheet shield: a win to nil banks a shield; a defeat spends it
          // (absorbing the whole life cost, even a boss's −2).
          const cleanSheet = outcome === 'win' && result.score.b === 0;
          let shield = s.shield;
          let lifeCost = outcome === 'loss' ? boss?.lifeCost ?? 1 : 0;
          let shieldNote: string | null = null;
          if (outcome === 'loss' && shield) {
            lifeCost = 0;
            shield = false;
            shieldNote = 'Clean-sheet shield absorbed the defeat!';
          } else if (cleanSheet) {
            shield = true;
          }
          const lives = s.lives - lifeCost;
          const record = { ...s.record, [key]: s.record[key] + 1 };

          // Apply discipline/fitness from this match.
          // Suspensions: clear old ban (served this match), set new one-game bans.
          const suspensions = result.suspensions ?? [];
          // Injuries: decrement all counters, remove cleared ones, add new ones.
          const newInjuries: Record<string, number> = {};
          for (const [id, rounds] of Object.entries(s.injuries)) {
            if (rounds > 1) newInjuries[id] = rounds - 1;
          }
          for (const inj of result.injuries ?? []) {
            newInjuries[inj.playerId] = Math.max(newInjuries[inj.playerId] ?? 0, inj.rounds);
          }

          const base = {
            bankroll,
            record,
            streak: newStreak,
            lives,
            shield,
            wager: 0,
            bestStreak: Math.max(s.bestStreak, newStreak),
            peakBankroll: Math.max(s.peakBankroll, bankroll),
            lastIncome: {
              reward,
              income: config.roundIncome,
              interest: intr,
              streak: sb,
              wage,
              wager: wagerDelta,
            },
            notice: shieldNote,
            suspensions,
            injuries: newInjuries,
          };

          // Run over? Record the career best (won counts as the full climb).
          const endReached = (reached: number) => ({
            best: { round: Math.max(s.best.round, reached) },
          });
          if (lives <= 0)
            return { ...base, runStatus: 'lost' as const, ...endReached(s.round) };
          if (s.round >= config.maxRounds)
            // The final must be WON, not merely survived — beat the Invincibles.
            return outcome === 'win'
              ? { ...base, runStatus: 'won' as const, ...endReached(config.maxRounds) }
              : { ...base, runStatus: 'lost' as const, ...endReached(config.maxRounds) };

          // Advance: draw the next round's event + reset the free refresh.
          const nextRound = s.round + 1;
          const starters = s.xi.filter((x): x is string => !!x);
          const ev = drawEvent(nextRound, s.runSeed, starters, s.relics, config.eventRates);
          const advance = {
            round: nextRound,
            event: ev,
            roundMods: ev.mods,
            freeRefreshUsed: false,
          };
          // Unless the shop is locked, the next round also gets a fresh roll.
          if (s.shopLocked) return { ...base, ...advance };
          const seed = nextSeed(s.shopSeed);
          return {
            ...base,
            ...advance,
            shop: rollSlots(s.owned, seed, s.pack),
            shopSeed: seed,
          };
        }),

      setWager: (amount) =>
        set((s) => ({
          wager: Math.max(0, Math.min(Math.floor(amount), maxWager(s.bankroll))),
        })),

      buyLife: () =>
        set((s) => {
          if (s.runStatus !== 'playing' || s.lives >= resolveConfig(s.mode, s.mutator).startingLives) return {};
          const cost = lifeBuybackCost(s.lifeBuybacks);
          if (s.bankroll < cost) return { notice: 'Not enough funds' };
          return {
            bankroll: s.bankroll - cost,
            lives: s.lives + 1,
            lifeBuybacks: s.lifeBuybacks + 1,
            notice: null,
          };
        }),

      toggleLock: () => set((s) => ({ shopLocked: !s.shopLocked })),

      claimRelic: (id) =>
        set((s) => {
          if (!s.event?.relicChoices?.includes(id) || s.relics.includes(id)) return {};
          return { relics: [...s.relics, id], event: null };
        }),

      dismissEvent: () => set({ event: null }),

      selectPlayer: (id) =>
        set((s) => ({
          selectedPlayerId: s.selectedPlayerId === id ? null : id,
        })),

      slotClicked: (slotIndex) => {
        const { selectedPlayerId, xi } = get();
        if (selectedPlayerId) {
          get().placeInSlot(selectedPlayerId, slotIndex);
          return;
        }
        const occupant = xi[slotIndex];
        if (occupant) get().selectPlayer(occupant);
      },

      setFormation: (id) => {
        const formation = getFormation(id);
        set((s) => {
          if (id === s.formation) return {};
          // Greedily re-slot placed players into same-role slots of the new shape.
          const placedByRole: Record<string, string[]> = {};
          for (const pid of s.xi) {
            if (!pid) continue;
            const role = getPlayer(pid)!.role;
            (placedByRole[role] ??= []).push(pid);
          }
          const xi: (string | null)[] = Array(XI_SIZE).fill(null);
          for (let i = 0; i < XI_SIZE; i++) {
            const need = formation.slots[i];
            const queue = placedByRole[need];
            if (queue && queue.length) xi[i] = queue.shift()!;
          }
          // Anyone who no longer fits drops to the bench (if room) else the squad.
          const bench = [...s.bench];
          for (const role of Object.keys(placedByRole)) {
            for (const pid of placedByRole[role]) {
              if (bench.length < BENCH_SIZE && !bench.includes(pid)) bench.push(pid);
            }
          }
          return { formation: id, xi, bench, selectedPlayerId: null };
        });
      },

      placeInSlot: (id, slotIndex) => {
        const player = getPlayer(id);
        const state = get();
        if (!player || !state.owned.includes(id)) return;
        if (slotRole(state.formation, slotIndex) !== player.role) return; // eligibility
        // Suspended or injured players can't take the field.
        if (state.suspensions.includes(id)) {
          set({ notice: `${player.name} is suspended` });
          return;
        }
        if (state.injuries[id]) {
          set({ notice: `${player.name} is injured (${state.injuries[id]}R)` });
          return;
        }

        set((s) => {
          const xi = [...s.xi];
          let bench = s.bench.filter((b) => b !== id);

          const fromSlot = xi.findIndex((slot) => slot === id);
          const displaced = xi[slotIndex];
          xi[slotIndex] = id;

          if (fromSlot >= 0 && fromSlot !== slotIndex) {
            xi[fromSlot] = displaced ?? null; // swap between slots
          } else if (displaced && fromSlot === -1) {
            if (bench.length < BENCH_SIZE) bench = [...bench, displaced];
            // else displaced returns to the unassigned squad
          }

          return { xi, bench, selectedPlayerId: null };
        });
      },

      sendToBench: (id) => {
        const { bench, owned } = get();
        if (!owned.includes(id)) return;
        if (bench.includes(id)) {
          set({ selectedPlayerId: null });
          return;
        }
        if (bench.length >= BENCH_SIZE) {
          set({ notice: 'Bench full' });
          return;
        }
        set((s) => ({
          xi: s.xi.map((slot) => (slot === id ? null : slot)),
          bench: [...s.bench, id],
          selectedPlayerId: null,
        }));
      },

      removeFromSlot: (slotIndex) =>
        set((s) => {
          const xi = [...s.xi];
          xi[slotIndex] = null;
          return { xi, selectedPlayerId: null };
        }),

      removeFromBench: (id) =>
        set((s) => ({
          bench: s.bench.filter((b) => b !== id),
          selectedPlayerId: null,
        })),

      // Pull everyone off the pitch back into the squad (unassigned); keep bench.
      benchAll: () => set({ xi: emptyXi(), selectedPlayerId: null }),

      clearNotice: () => set({ notice: null }),

      // Preserve the career best across runs.
      newGame: () => set((s) => ({ ...freshRun(null), best: s.best })),

      // Start a chosen mode + optional mutator (the New Run flow).
      startRun: (modeId, mutatorId = null) =>
        set((s) => ({ ...freshRun(null, modeId, mutatorId), best: s.best })),

      // Daily Gauntlet: deterministic seed AND a deterministic Rule of the Day.
      newDailyRun: () =>
        set((s) => {
          const key = dailyKey();
          return { ...freshRun(key, 'classic', dailyMutator(key)), best: s.best };
        }),

      exportSave: () => encodeSave(saveSlice(get())),

      importSave: (code) => {
        const result = decodeSave(code);
        if (!result.ok) return result.error;
        set({ ...result.state, selectedPlayerId: null, notice: null });
        return null;
      },
    }),
    {
      name: SAVE_KEY,
      version: CURRENT_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => saveSlice(s as GameState),
      migrate: (persisted, version) => migrateSave(persisted, version) as never,
      // Additive fields are filled from the fresh defaults; a structurally
      // broken save is discarded so the game starts clean (flagged for the UI).
      merge: (persisted, current) => {
        if (!isValidSave(persisted)) return current;
        return { ...current, ...(persisted as Partial<GameState>) };
      },
    }
  )
);

// Cross-tab sync: when ANOTHER tab saves, converge this tab to it (rather than
// clobbering each other). The dedup guard in externalSaveChange prevents loops.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (externalSaveChange(e.key, e.newValue)) {
      void useGameStore.persist.rehydrate();
      useGameStore.setState({ notice: 'Run synced from another tab.' });
    }
  });
}

export { ROSTER_CAP };
