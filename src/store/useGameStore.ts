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
import { POOL, getPlayer, registerPlayers, clearOverlay } from '@/data/pool';
import type { Player } from '@/lib/types';
import { XI_SIZE, BENCH_SIZE } from '@/lib/types';
import {
  DEFAULT_FORMATION,
  getFormation,
  slotRole,
  slotPosition,
  roleCounts,
} from '@/lib/formations';
import { canFillSlot, canPlay } from '@/lib/positions';
import { positionLabel } from '@/lib/playerMeta';
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
import { getScenario, buildScenarioSquad, runConfig } from '@/lib/scenarios';
import {
  boardTarget,
  boardMet,
  generateYouth,
  ageRoster,
  youthMeta,
  CAREER_BONUS,
  TRIUMPH_BONUS,
  SCOUT_YOUTH_COST,
  type CareerState,
  type ReviewState,
} from '@/lib/career';
import { relicBuyDiscount, relicHasFreeRefresh } from '@/lib/relics';
import { NO_MODIFIERS, type MatchModifiers } from '@/lib/effects';
import { Rng } from '@/lib/rng';
import {
  SHOP_SIZE,
  ROSTER_CAP,
  MATCH_REWARD,
  PITY_THRESHOLD,
  RARITY_RANK,
  checkBuy,
  checkRefresh,
  sellValue,
  drawShop,
} from '@/lib/economy';
import { getBrief } from '@/lib/scouting';
import { pickBestXI, planAutoBuy, AUTO_BUY_RESERVE, type ShopOffer } from '@/lib/autopick';
import { sanitizeKit, type Kit } from '@/lib/kits';
import { newlyUnlocked, getAchievement } from '@/lib/achievements';
import { featuredPlayerId, featuredCost } from '@/lib/featured';
import { runScore } from '@/lib/score';
import type { Rarity } from '@/lib/types';
import type { MatchResult, PlayerHistory } from '@/lib/types';
import { accrueHistory } from '@/lib/ratings';

export { getPlayer };

/** Is this slot index legal for the given player's role in this formation? */
export function isSlotEligible(
  playerId: string,
  slotIndex: number,
  formationId: string
): boolean {
  const p = getPlayer(playerId);
  return !!p && canFillSlot(p, slotPosition(formationId, slotIndex));
}

type ShopSlots = (string | null)[];

/** Tone of a transient notice toast. */
export type NoticeKind = 'error' | 'success' | 'info';

function padShop(ids: string[]): ShopSlots {
  return Array.from({ length: SHOP_SIZE }, (_, i) => ids[i] ?? null);
}

/** Pick the higher-tier of two optional rarity guarantees. */
function higherRarity(a?: Rarity, b?: Rarity): Rarity | undefined {
  if (!a) return b;
  if (!b) return a;
  return RARITY_RANK[a] >= RARITY_RANK[b] ? a : b;
}

/** Roll the shop slots for a pack at a given seed (deterministic, no advance). */
function rollSlots(
  owned: Iterable<string>,
  seed: number,
  packId: string,
  extraGuarantee?: Rarity,
  mustMatch?: (p: Player) => boolean
): ShopSlots {
  const pack = getPack(packId);
  const rng = new Rng(seed);
  const pool = POOL.filter(pack.filter);
  const guarantee = higherRarity(pack.guarantee, extraGuarantee);
  const ids = drawShop(pool, new Set(owned), rng, SHOP_SIZE, guarantee, mustMatch);
  return padShop(ids);
}

/** Derive the next shop seed (advances the deterministic chain on refresh). */
function nextSeed(seed: number): number {
  return new Rng(seed).int(1, 0x7fffffff);
}

const isGoldPlus = (id: string | null): boolean => {
  const r = id ? getPlayer(id)?.rarity : undefined;
  return r === 'gold' || r === 'icon';
};

/** Merge ids into the all-time collection (returns same ref if unchanged). */
function addToCollection(collection: string[], ...ids: string[]): string[] {
  const set = new Set(collection);
  const before = set.size;
  for (const id of ids) set.add(id);
  return set.size === before ? collection : [...set];
}

/**
 * Roll a shop with bad-luck protection. When `dryStreak` has reached the pity
 * threshold the roll is forced to include a gold-or-better; the returned
 * `dryStreak` resets on any gold+ on offer, else increments.
 */
function rollWithPity(
  owned: Iterable<string>,
  seed: number,
  packId: string,
  dryStreak: number,
  mustMatch?: (p: Player) => boolean
): { shop: ShopSlots; dryStreak: number } {
  const forceGold = dryStreak >= PITY_THRESHOLD ? ('gold' as Rarity) : undefined;
  const shop = rollSlots(owned, seed, packId, forceGold, mustMatch);
  return { shop, dryStreak: shop.some(isGoldPlus) ? 0 : dryStreak + 1 };
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
  /** Consecutive refreshes with no gold+ on offer (drives pity protection). */
  dryStreak: number;
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
  /** Tone of the current notice — drives the toast's colour/icon/lifetime. */
  noticeKind: NoticeKind;
  /** Career record across the run. */
  record: { w: number; d: number; l: number };

  // --- season ladder ---
  /** Active game mode id (drives the ruleset via resolveConfig). */
  mode: ModeId;
  /** Active run mutator id (Rule of the Day / chosen modifier), or null. */
  mutator: string | null;
  /** Active scenario id (authored challenge), or null for a normal run. */
  scenario: string | null;
  /** Best stars earned per scenario id — career progress, persisted across runs. */
  scenarioStars: Record<string, number>;
  /** Active Career/Dynasty meta-state, or null outside Career mode. */
  career: CareerState | null;
  /** Between-seasons review (board verdict + youth intake), or null. */
  careerReview: ReviewState | null;
  /** Most seasons completed in a single career — persisted across careers. */
  careerBest: number;
  /** Every player id ever signed — an all-time "club legends" collection. */
  collection: string[];
  /** Best score per scored mode ('endless', 'daily') — persisted across runs. */
  bestScore: Record<string, number>;
  /** Player's club name (the team's display name). null → falls back to 'Your XI'. */
  clubName: string | null;
  /** Player's manager name (flavour / identity). */
  managerName: string | null;
  /** Whether the first-time onboarding (club setup + tutorial) has been completed. */
  onboarded: boolean;
  /** The club's designed kit (colours + pattern). null → classic default strip. */
  kit: Kit | null;
  /** Unlocked achievement ids — all-time, persisted across runs. */
  achievements: string[];
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
  /** Date key of the last Daily that ran to a result — guards score-grinding. */
  dailyCompleted: string | null;
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
  /** Cumulative per-player stats for this run (apps/goals/assists/rating/cards). */
  playerHistory: Record<string, PlayerHistory>;

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
  /** Dispatch a scout (paid): guarantee a brief-matching player in the shop. */
  scoutShop: (briefId: string) => void;
  /** Sign today's discounted Featured Free Agent. */
  signFeatured: () => void;
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
  /** One-click: field the strongest available XI (chemistry-aware). */
  autoPickXI: () => void;
  /** One-click: sign current offers that fill the XI's missing roles. */
  autoBuy: () => void;

  clearNotice: () => void;
  newGame: () => void;
  /** Start a run in a chosen mode with an optional mutator. */
  startRun: (modeId: ModeId, mutatorId?: string | null) => void;
  /** Start an authored scenario by id (prebuilt squad + fixed start state). */
  startScenario: (id: string) => void;
  /** Begin a new Career: multiple seasons, persistent squad, board objectives. */
  startCareer: () => void;
  /** Pay to reveal an academy prospect's exact potential during the review. */
  scoutYouth: (youthId: string) => void;
  /** Resolve the between-seasons review and begin the next season. */
  advanceCareerSeason: (youthId?: string | null) => void;
  /** Start today's deterministic Daily Challenge. */
  newDailyRun: () => void;
  /** Complete first-time onboarding (or rename later): set club + manager name (+ kit). */
  completeOnboarding: (clubName: string, managerName: string, kit?: Kit) => void;
  /** Update the club kit (validated; malformed input is ignored). */
  setKit: (kit: Kit) => void;
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
  // A fresh run never inherits a previous career's aged/youth players.
  clearOverlay();
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
    scenario: null as string | null,
    career: null as CareerState | null,
    careerReview: null as ReviewState | null,
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
    noticeKind: 'info' as NoticeKind,
    record: { w: 0, d: 0, l: 0 },
    dryStreak: 0,
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
    playerHistory: {} as Record<string, PlayerHistory>,
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
    scenario: s.scenario,
    scenarioStars: s.scenarioStars,
    career: s.career,
    careerReview: s.careerReview,
    careerBest: s.careerBest,
    collection: s.collection,
    bestScore: s.bestScore,
    clubName: s.clubName,
    managerName: s.managerName,
    onboarded: s.onboarded,
    kit: s.kit,
    achievements: s.achievements,
    bankroll: s.bankroll,
    owned: s.owned,
    shop: s.shop,
    shopSeed: s.shopSeed,
    pack: s.pack,
    dryStreak: s.dryStreak,
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
    dailyCompleted: s.dailyCompleted,
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
    playerHistory: s.playerHistory,
  };
}

// One-time: carry the legacy v7 save onto the new stable key before rehydration.
importLegacySave();

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      pool: POOL,
      best: { round: 0 },
      scenarioStars: {},
      careerBest: 0,
      collection: [],
      bestScore: {},
      dailyCompleted: null,
      clubName: null,
      managerName: null,
      onboarded: false,
      kit: null,
      achievements: [],
      ...freshRun(),

      buy: (shopIndex) => {
        const { shop, bankroll, owned, relics, xi, bench, formation, collection } = get();
        const id = shop[shopIndex];
        const player = getPlayer(id);
        if (!id || !player) return;
        const cost = Math.max(0, player.cost - relicBuyDiscount(relics));
        // Validate against the discounted cost.
        const check = checkBuy(bankroll, owned.length, { ...player, cost });
        if (!check.ok) {
          set({ notice: check.reason ?? 'Cannot buy', noticeKind: 'error' });
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
          collection: addToCollection(collection, id),
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
        const { bankroll, owned, shopSeed, pack, relics, freeRefreshUsed, dryStreak } = get();
        // Lucky Boots: first refresh each round is free.
        const free = relicHasFreeRefresh(relics) && !freeRefreshUsed;
        const cost = free ? 0 : getPack(pack).cost;
        const check = checkRefresh(bankroll, cost);
        if (!check.ok) {
          set({ notice: check.reason ?? 'Cannot refresh', noticeKind: 'error' });
          return;
        }
        const seed = nextSeed(shopSeed);
        const rolled = rollWithPity(owned, seed, pack, dryStreak);
        set({
          bankroll: bankroll - cost,
          shop: rolled.shop,
          dryStreak: rolled.dryStreak,
          shopSeed: seed,
          freeRefreshUsed: freeRefreshUsed || free,
          notice: null,
        });
      },

      // Sign today's Featured Free Agent at a discount (deterministic per date).
      signFeatured: () => {
        const { bankroll, owned, collection } = get();
        const id = featuredPlayerId(dailyKey());
        const player = getPlayer(id);
        if (!player || owned.includes(id)) return;
        const cost = featuredCost(player.cost);
        const check = checkBuy(bankroll, owned.length, { ...player, cost });
        if (!check.ok) {
          set({ notice: check.reason ?? 'Cannot sign', noticeKind: 'error' });
          return;
        }
        set({
          bankroll: bankroll - cost,
          owned: [...owned, id],
          collection: addToCollection(collection, id),
          notice: `Signed ${player.name}!`,
          noticeKind: 'success',
        });
      },

      // Scout Discovery Network: a paid, targeted refresh that guarantees a
      // player matching the brief — turns "1-in-500 fluke" into intentional
      // discovery. Casts a wide net (full pool), so it switches to All-Stars.
      scoutShop: (briefId) => {
        const { bankroll, owned, shopSeed, dryStreak } = get();
        const brief = getBrief(briefId);
        if (!brief) return;
        if (bankroll < brief.cost) {
          set({ notice: 'Not enough funds', noticeKind: 'error' });
          return;
        }
        const seed = nextSeed(shopSeed);
        const rolled = rollWithPity(owned, seed, 'all', dryStreak, brief.match);
        const found = rolled.shop.some((id) => {
          const p = getPlayer(id);
          return p ? brief.match(p) : false;
        });
        set({
          bankroll: bankroll - brief.cost,
          pack: 'all',
          shop: rolled.shop,
          dryStreak: rolled.dryStreak,
          shopSeed: seed,
          notice: found
            ? `${brief.emoji} Scout found a ${brief.label.toLowerCase()}.`
            : `No ${brief.label.toLowerCase()} available to scout.`,
          noticeKind: found ? 'success' : 'info',
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
          const config = runConfig(s);
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

          // Resolve what the run status WILL be (mirrors the branching below)
          // so achievement checks can see a terminal won/lost on this round.
          const finalRound = s.round >= config.maxRounds;
          let statusAfter: 'playing' | 'won' | 'lost' = 'playing';
          if (s.career) {
            const sacked = lives <= 0;
            const seasonOver = sacked || finalRound;
            const met =
              seasonOver &&
              boardMet(s.career.season, sacked ? s.round : config.maxRounds, !sacked && outcome === 'win');
            if (seasonOver && !met) statusAfter = 'lost';
          } else if (lives <= 0) {
            statusAfter = 'lost';
          } else if (finalRound) {
            statusAfter = outcome === 'win' || config.finalMustWin === false ? 'won' : 'lost';
          }
          // Seasons completed toward Dynasty — mirrors EXACTLY what the career
          // branches below will write to careerBest: a met review banks the
          // current season; a sacking still banks the seasons already survived
          // (season − 1). Keeping this in sync matters: a manager sacked in
          // season 5 has completed 4 and must unlock Dynasty NOW, not next career.
          const careerSeasons = s.career
            ? statusAfter === 'lost'
              ? Math.max(s.careerBest, s.career.season - 1)
              : lives <= 0 || finalRound
                ? Math.max(s.careerBest, s.career.season)
                : s.careerBest
            : s.careerBest;

          const squadValue = s.owned.reduce((sum, id) => sum + (getPlayer(id)?.cost ?? 0), 0);
          const unlocked = newlyUnlocked(s.achievements, {
            result,
            outcome,
            round: s.round,
            runStatus: statusAfter,
            boss: !!boss,
            lives,
            bankroll,
            streak: newStreak,
            squadValue,
            scenario: s.scenario,
            daily: s.daily !== null,
            endless: !Number.isFinite(config.maxRounds),
            careerSeasons,
          });
          const achievements = unlocked.length
            ? [...s.achievements, ...unlocked]
            : s.achievements;
          const achievementNote = unlocked.length
            ? `🏆 Unlocked: ${unlocked.map((id) => getAchievement(id)?.name ?? id).join(' · ')}`
            : null;

          // Player histories: credit this match to the XI that started it
          // (goals/assists/cards/rating). Seed mirrors App's match seed so the
          // recorded ratings match what the report showed.
          const xiPlayers = s.xi
            .map((id) => (id ? getPlayer(id) : null))
            .filter((p): p is Player => !!p);
          const playerHistory = accrueHistory(s.playerHistory, result.events, xiPlayers, {
            goalsConceded: result.score.b,
            outcome: result.outcome,
            seed: `M-${s.runSeed}-${s.round}`,
          });

          const base = {
            bankroll,
            record,
            streak: newStreak,
            lives,
            shield,
            wager: 0,
            achievements,
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
            notice: achievementNote ?? shieldNote,
            noticeKind: 'success' as NoticeKind,
            suspensions,
            injuries: newInjuries,
            playerHistory,
          };

          // Run over? Record the career-best DIVISION — but only for the finite
          // climb modes (Classic / Daily / Career). Endless (round 40 = "Champion")
          // and scenarios (a 1-match final) would otherwise pollute the crown and
          // permanently suppress the "NEW CAREER BEST" banner in Classic.
          const tracksBest = !config.scored && !s.scenario;
          const endReached = (reached: number) =>
            tracksBest ? { best: { round: Math.max(s.best.round, reached) } } : {};

          // Scored modes (Endless / Daily) bank a personal best on a terminal run.
          const scoredKey = s.career ? null : config.scored ? 'endless' : s.daily ? 'daily' : null;
          const bestScoreUpdate = (status: 'won' | 'lost') => {
            if (!scoredKey) return {};
            // A Daily counts ONCE per day — replays are practice and don't
            // re-bank a score (keeps the day's result comparable).
            if (scoredKey === 'daily' && s.dailyCompleted === s.daily) return {};
            const sc = runScore({
              round: s.round,
              runStatus: status,
              peakBankroll: Math.max(s.peakBankroll, bankroll),
              bestStreak: Math.max(s.bestStreak, newStreak),
              record,
              maxRounds: config.maxRounds,
            });
            const update: Partial<GameState> = {
              bestScore: { ...s.bestScore, [scoredKey]: Math.max(s.bestScore[scoredKey] ?? 0, sc) },
            };
            if (scoredKey === 'daily') update.dailyCompleted = s.daily;
            return update;
          };

          // CAREER MODE: a season ends (sacked OR reached the final) but the game
          // does not — the board reviews you. You're only fired if you went out
          // BEFORE meeting their target division.
          if (s.career) {
            const career = s.career;
            const sacked = lives <= 0;
            const seasonOver = sacked || s.round >= config.maxRounds;
            if (seasonOver) {
              const triumph = !sacked && outcome === 'win';
              const reached = sacked ? s.round : config.maxRounds;
              const met = boardMet(career.season, reached, triumph);
              if (!met) {
                // Fired before meeting expectations — the career ends here.
                return {
                  ...base,
                  runStatus: 'lost' as const,
                  careerBest: Math.max(s.careerBest, career.season - 1),
                  ...endReached(reached),
                };
              }
              // Met the demand → between-seasons review (run stays 'playing').
              const review: ReviewState = {
                season: career.season,
                targetRound: career.targetRound,
                reached,
                triumph,
                bonus: triumph ? TRIUMPH_BONUS : CAREER_BONUS,
                youth: generateYouth(`${s.runSeed}-youth-${career.season}`, 2),
                scouted: [],
              };
              return {
                ...base,
                careerReview: review,
                careerBest: Math.max(s.careerBest, career.season),
                ...endReached(reached),
              };
            }
            // Season continues — fall through to the normal round advance.
          }

          if (lives <= 0)
            return { ...base, runStatus: 'lost' as const, ...endReached(s.round), ...bestScoreUpdate('lost') };
          if (s.round >= config.maxRounds) {
            // Classic: the final must be WON. Survival scenarios: reaching the
            // final round alive is enough (finalMustWin === false).
            const survived = outcome === 'win' || config.finalMustWin === false;
            const reached = Number.isFinite(config.maxRounds) ? config.maxRounds : s.round;
            if (!survived)
              return { ...base, runStatus: 'lost' as const, ...endReached(reached), ...bestScoreUpdate('lost') };
            // Grade the scenario, banking the best stars earned across attempts.
            let scenarioStars = s.scenarioStars;
            const sc = getScenario(s.scenario);
            if (sc) {
              const earned = sc.stars({
                livesRemaining: lives,
                startingLives: config.startingLives,
                peakBankroll: Math.max(s.peakBankroll, bankroll),
                lastScoreA: result.score.a,
                lastScoreB: result.score.b,
              });
              scenarioStars = {
                ...s.scenarioStars,
                [sc.id]: Math.max(s.scenarioStars[sc.id] ?? 0, earned),
              };
            }
            return { ...base, runStatus: 'won' as const, scenarioStars, ...endReached(reached), ...bestScoreUpdate('won') };
          }

          // Advance: draw the next round's event + reset the free refresh.
          const nextRound = s.round + 1;
          const starters = s.xi.filter((x): x is string => !!x);
          const ev = drawEvent(nextRound, s.runSeed, starters, s.relics, config.eventRates);
          // An unclaimed relic offer is never silently lost: it carries over until
          // the player claims or dismisses it (the relic is a permanent reward).
          const unclaimedRelic =
            s.event?.kind === 'relic' && (s.event.relicChoices?.length ?? 0) > 0
              ? s.event
              : null;
          const nextEvent = unclaimedRelic ?? ev;
          const advance = {
            round: nextRound,
            event: nextEvent,
            roundMods: nextEvent.mods,
            freeRefreshUsed: false,
          };
          // Unless the shop is locked, the next round also gets a fresh roll.
          if (s.shopLocked) return { ...base, ...advance };
          const seed = nextSeed(s.shopSeed);
          const rolled = rollWithPity(s.owned, seed, s.pack, s.dryStreak);
          return {
            ...base,
            ...advance,
            shop: rolled.shop,
            dryStreak: rolled.dryStreak,
            shopSeed: seed,
          };
        }),

      setWager: (amount) =>
        set((s) => ({
          wager: Math.max(0, Math.min(Math.floor(amount), maxWager(s.bankroll))),
        })),

      buyLife: () =>
        set((s) => {
          if (s.runStatus !== 'playing' || s.lives >= runConfig(s).startingLives) return {};
          const cost = lifeBuybackCost(s.lifeBuybacks);
          if (s.bankroll < cost) return { notice: 'Not enough funds', noticeKind: 'error' };
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
        const wantPos = slotPosition(state.formation, slotIndex);
        if (!canFillSlot(player, wantPos)) {
          // Eligible by neither exact position nor coarse role — explain why.
          set({
            notice: `${player.name} (${player.role}) can't play ${positionLabel(wantPos)}`,
            noticeKind: 'error',
          });
          return;
        }
        if (!canPlay(player, wantPos)) {
          // Fillable on coarse-role cover, but out of position — warn (still allowed).
          set({
            notice: `${player.name} is out of position at ${positionLabel(wantPos)} — −10%`,
            noticeKind: 'info',
          });
        }
        // Suspended or injured players can't take the field.
        if (state.suspensions.includes(id)) {
          set({ notice: `${player.name} is suspended`, noticeKind: 'error' });
          return;
        }
        if (state.injuries[id]) {
          set({ notice: `${player.name} is injured (${state.injuries[id]}R)`, noticeKind: 'error' });
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
          set({ notice: 'Bench full — remove a sub or assign one to the pitch', noticeKind: 'error' });
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

      // One-click strongest XI: role-weighted stats + chemistry refinement,
      // skipping suspended/injured players (lib/autopick — pure & deterministic).
      autoPickXI: () =>
        set((s) => {
          if (s.owned.length === 0) {
            return { notice: 'No players to pick — sign some first', noticeKind: 'error' as NoticeKind };
          }
          const result = pickBestXI(
            s.owned,
            s.formation,
            { suspensions: s.suspensions, injuries: s.injuries },
            getPlayer
          );
          const full = result.filled === XI_SIZE;
          return {
            xi: result.xi,
            bench: result.bench,
            selectedPlayerId: null,
            notice: full
              ? 'Auto-picked your strongest XI'
              : `Auto-picked ${result.filled}/${XI_SIZE} — sign more players to fill the gaps`,
            noticeKind: (full ? 'success' : 'info') as NoticeKind,
          };
        }),

      // One-click need-driven signings from the CURRENT offers only (never
      // chains paid refreshes, never spends below the reserve).
      autoBuy: () => {
        const s = get();
        const discount = relicBuyDiscount(s.relics);
        const offers: ShopOffer[] = [];
        s.shop.forEach((id, index) => {
          const player = getPlayer(id);
          if (player) offers.push({ index, player, cost: Math.max(0, player.cost - discount) });
        });
        const starters = s.xi.map((id) => getPlayer(id)).filter((p): p is Player => !!p);
        // Needs count only FIELDABLE players — an injured-out keeper is a real
        // gap, so Auto-Sign will buy emergency cover (matches the journey bar).
        const ownedPlayers = s.owned
          .map((id) => getPlayer(id))
          .filter(
            (p): p is Player => !!p && !s.suspensions.includes(p.id) && !s.injuries[p.id]
          );
        const plan = planAutoBuy(
          offers,
          ownedPlayers,
          starters,
          s.formation,
          s.bankroll,
          s.owned.length,
          ROSTER_CAP,
          AUTO_BUY_RESERVE
        );
        if (plan.length === 0) {
          const required = roleCounts(s.formation);
          const have = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
          for (const p of ownedPlayers) have[p.role]++;
          const gaps = (['GK', 'DEF', 'MID', 'FWD'] as const).filter((r) => have[r] < required[r]);
          set({
            notice:
              gaps.length === 0
                ? 'Squad already covers every role — nothing to sign'
                : `No affordable ${gaps.join('/')} in these offers — try a refresh or scout`,
            noticeKind: 'info',
          });
          return;
        }
        // Reuse buy() per planned slot: it re-validates and auto-assigns.
        for (const b of plan) get().buy(b.index);
        const spent = plan.reduce((t, b) => t + b.cost, 0);
        const names = plan.map((b) => b.player.name).join(', ');
        set({ notice: `Auto-signed ${names} (£${spent}M)`, noticeKind: 'success' });
      },

      clearNotice: () => set({ notice: null }),

      // Preserve career progress (best division, scenario stars) across runs.
      newGame: () =>
        set((s) => ({
          ...freshRun(null),
          best: s.best,
          scenarioStars: s.scenarioStars,
          careerBest: s.careerBest,
        })),

      // Start a chosen mode + optional mutator (the New Run flow).
      startRun: (modeId, mutatorId = null) =>
        set((s) => ({
          ...freshRun(null, modeId, mutatorId),
          best: s.best,
          scenarioStars: s.scenarioStars,
          careerBest: s.careerBest,
        })),

      // Start an authored scenario: a fresh run overridden with its fixed state.
      startScenario: (id) =>
        set((s) => {
          const sc = getScenario(id);
          if (!sc) return {};
          const fresh = freshRun(null, 'classic', null);
          const { owned, xi } = buildScenarioSquad(sc.formation, sc.squad);
          return {
            ...fresh,
            best: s.best,
            scenarioStars: s.scenarioStars,
            careerBest: s.careerBest,
            scenario: id,
            bankroll: sc.config.startingBankroll,
            lives: sc.config.startingLives,
            round: sc.startRound,
            formation: sc.formation,
            relics: [...sc.relics],
            owned,
            xi,
            bench: [],
            collection: addToCollection(s.collection, ...owned),
            // Re-roll the shop excluding the prebuilt squad.
            shop: rollSlots(owned, fresh.shopSeed, 'all'),
          };
        }),

      // Daily Gauntlet: deterministic seed AND a deterministic Rule of the Day.
      newDailyRun: () =>
        set((s) => {
          const key = dailyKey();
          return {
            ...freshRun(key, 'classic', dailyMutator(key)),
            best: s.best,
            scenarioStars: s.scenarioStars,
            careerBest: s.careerBest,
          };
        }),

      // Begin a Career: a fresh classic-rules run wrapped in a season-1 board demand.
      startCareer: () =>
        set((s) => ({
          ...freshRun(null, 'classic', null),
          best: s.best,
          scenarioStars: s.scenarioStars,
          careerBest: s.careerBest,
          career: { season: 1, targetRound: boardTarget(1), meta: {}, roster: {} },
          careerReview: null,
        })),

      // Pay to scout a prospect — reveals their exact potential in the review.
      scoutYouth: (youthId) =>
        set((s) => {
          const review = s.careerReview;
          if (!review || review.scouted.includes(youthId)) return {};
          if (!review.youth.some((y) => y.id === youthId)) return {};
          if (s.bankroll < SCOUT_YOUTH_COST) return { notice: 'Not enough funds', noticeKind: 'error' };
          return {
            bankroll: s.bankroll - SCOUT_YOUTH_COST,
            careerReview: { ...review, scouted: [...review.scouted, youthId] },
            notice: null,
          };
        }),

      // Close the review and roll into the next season: age the squad, fold in the
      // chosen academy youth, pay the board bonus, reset the climb, keep the squad.
      advanceCareerSeason: (youthId = null) =>
        set((s) => {
          if (!s.career || !s.careerReview) return {};
          const review = s.careerReview;
          const prev = s.career;

          // Age the existing squad (youth grow, veterans decline).
          const aged = ageRoster(s.owned, prev.meta, getPlayer);
          let owned = [...s.owned];
          const meta = { ...aged.meta };
          const roster = { ...prev.roster, ...aged.roster };

          // Fold in the chosen academy prospect (joins at full freshness).
          const chosen = youthId ? review.youth.find((y) => y.id === youthId) : null;
          let collection = s.collection;
          if (chosen) {
            owned.push(chosen.id);
            meta[chosen.id] = youthMeta();
            roster[chosen.id] = chosen;
            collection = addToCollection(s.collection, chosen.id);
          }
          registerPlayers(Object.values(roster));

          const nextSeason = prev.season + 1;
          const target = boardTarget(nextSeason);
          const startLives = resolveConfig(s.mode, s.mutator).startingLives;
          const seed = nextSeed(s.shopSeed);

          return {
            career: { season: nextSeason, targetRound: target, meta, roster },
            careerReview: null,
            owned,
            collection,
            bankroll: s.bankroll + review.bonus,
            round: 1,
            lives: startLives,
            streak: 0,
            runStatus: 'playing' as const,
            suspensions: [],
            injuries: {},
            wager: 0,
            shield: false,
            event: null,
            roundMods: NO_MODIFIERS,
            freeRefreshUsed: false,
            lastIncome: null,
            shop: rollSlots(owned, seed, s.pack),
            shopSeed: seed,
            notice: chosen
              ? `${chosen.name} joins the academy. Season ${nextSeason}: reach round ${target} or you're sacked.`
              : `Season ${nextSeason}: reach round ${target} or you're sacked.`,
            noticeKind: 'info',
          };
        }),

      completeOnboarding: (clubName, managerName, kit) =>
        set((s) => ({
          clubName: clubName.trim() ? clubName.trim().slice(0, 24) : null,
          managerName: managerName.trim() ? managerName.trim().slice(0, 24) : null,
          onboarded: true,
          kit: kit ? sanitizeKit(kit) ?? s.kit : s.kit,
        })),

      setKit: (kit) =>
        set((s) => ({ kit: sanitizeKit(kit) ?? s.kit })),

      exportSave: () => encodeSave(saveSlice(get())),

      importSave: (code) => {
        const result = decodeSave(code);
        if (!result.ok) return result.error;
        // Rebuild the career overlay so aged/youth players resolve after import.
        clearOverlay();
        const career = (result.state as Partial<GameState>).career;
        if (career?.roster) registerPlayers(Object.values(career.roster));
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
      // Re-register a persisted career's aged/youth players into the pool overlay.
      onRehydrateStorage: () => (state) => {
        const roster = state?.career?.roster;
        if (roster) registerPlayers(Object.values(roster));
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
      useGameStore.setState({ notice: 'Run synced from another tab.', noticeKind: 'info' });
    }
  });
}

export { ROSTER_CAP };
