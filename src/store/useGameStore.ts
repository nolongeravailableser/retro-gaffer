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
  maxWager,
  lifeBuybackCost,
} from '@/lib/ladder';
import { wageBill, divisionMult, tierMult, wageTierMult, overall, LEAGUE_NEUTRAL_TIER } from '@/lib/wages';
import { dailyKey, dailySeed } from '@/lib/daily';
import { getBoss } from '@/lib/bosses';
import { drawEvent, type GameEvent } from '@/lib/events';
import { DEFAULT_MODE_ID, LEAGUE_TEAMS, type ModeId } from '@/lib/modes';
import {
  generateLeague,
  assignClubSquads,
  allClubOwnedIds,
  clubOf,
  playerFixture,
  simAiWeek,
  position as leaguePosition,
  totalWeeks as leagueTotalWeeks,
  seasonScale as leagueSeasonScale,
  fixtureKey,
  seasonOutcome,
  nextTier,
  division,
  CLUB_SQUAD_NEED,
  isWindowOpen,
  nextWindowOpensAt,
  BOTTOM_TIER,
  YOU,
  type LeagueState,
} from '@/lib/league';
import {
  generateCup,
  playerTie,
  resolveCupRound as resolveCupBracket,
  roundName as cupRoundName,
  CUP_SIZE,
  type CupState,
} from '@/lib/cup';
import { resolveConfig, dailyMutator } from '@/lib/mutators';
import { getScenario, buildScenarioSquad, runConfig } from '@/lib/scenarios';
import {
  generateYouth,
  ageRoster,
  youthMeta,
  reviewBonus,
  newMeta,
  resolveContracts,
  YOUTH_INTAKE,
  SCOUT_YOUTH_COST,
  type CareerState,
  type ReviewState,
} from '@/lib/career';
import {
  newFacilities,
  upgradeCost,
  isMaxed,
  matchdayIncome,
  youthBonus,
  injuryReduction,
  facilityUpkeep,
  type FacilityId,
} from '@/lib/stadium';
import {
  transferFee,
  marketSellValue,
  poachFee,
  isFreeAgent,
  rivalBids,
  CAREER_STARTING_BANKROLL,
  type BidderClub,
} from '@/lib/market';
import { relicBuyDiscount, relicHasFreeRefresh } from '@/lib/relics';
import {
  nextSharpness,
  nextFatigue,
  DEFAULT_FOCUS,
  type TrainingFocus,
} from '@/lib/training';
import {
  pushMessages,
  resultMessage,
  injuryMessage,
  boardMessage,
  offerMessage,
  departureMessage,
  moraleMessage,
  expectationMessage,
  confidenceWarning,
  type InboxMessage,
} from '@/lib/inbox';
import { morale as playerMorale, moraleBand } from '@/lib/morale';
import { boardConfidence, confidenceBand, boardExpectation } from '@/lib/board';
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
import { accrueHistory, avgRating } from '@/lib/ratings';

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

/**
 * The division tier that drives transfer-market valuations, or null when a run
 * has no market (Classic/Endless/Scenario use the roguelike draft shop instead).
 * Career → its current tier; standalone League → the neutral mid tier.
 */
function marketTierOf(s: {
  career: CareerState | null;
  league: LeagueState | null;
  cup?: CupState | null;
}): number | null {
  if (s.career) return s.career.tier;
  if (s.league) return LEAGUE_NEUTRAL_TIER;
  if (s.cup) return LEAGUE_NEUTRAL_TIER; // Cup builds a squad via the FM market too
  return null;
}

/** Whether the transfer window is open right now (market modes). Non-market
 *  states (no league) are always "open" — they don't use windows. */
function windowOpenFor(s: { league: LeagueState | null }): boolean {
  if (!s.league) return true;
  return isWindowOpen(s.league.matchweek, leagueTotalWeeks(s.league));
}

/** A user-facing "window closed" notice naming when it reopens. */
function windowClosedNotice(s: { league: LeagueState | null }): string {
  if (!s.league) return 'Transfer window closed';
  const weeks = leagueTotalWeeks(s.league);
  const at = nextWindowOpensAt(s.league.matchweek, weeks);
  return at
    ? `Transfer window closed — reopens matchweek ${at}.`
    : 'Transfer window closed for the rest of the season.';
}

/** A fresh league with AI clubs' squads drafted from the pool (Phase B). */
function leagueWithSquads(seed: string | number, strength: number): LeagueState {
  const lg = generateLeague(seed, strength, LEAGUE_TEAMS);
  assignClubSquads(lg.clubs, POOL);
  return lg;
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
  /** Active League-Season state (table/fixtures/results), or null. */
  league: LeagueState | null;
  /** Active Cup knockout state (bracket), or null. */
  cup: CupState | null;
  /** FM-style club inbox (Career/League): results, injuries, board notes, bids.
   *  Newest first; empty outside the simulation modes. */
  inbox: InboxMessage[];
  /** Weekly training focus (Career/League). Tilts the squad subtly each match. */
  training: TrainingFocus;
  /** Per-player match sharpness 0–100 (rises starting, decays benched). Career/League. */
  sharpness: Record<string, number>;
  /** Per-player fatigue 0–100 (accrues starting, recovers resting). Career/League. */
  fatigue: Record<string, number>;
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
    /** Facility running costs (career only; 0 otherwise). */
    upkeep: number;
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
  /** Sign any available player from the Career/League transfer market at their fee. */
  signPlayer: (id: string, agreedFee?: number) => void;
  /** Fill empty XI slots with the best free agents (Career/League market). */
  autoFillSquad: () => void;
  /** Set the weekly training focus (Career/League). */
  setTraining: (focus: TrainingFocus) => void;
  /** Mark every inbox message as read (called when the Inbox tab is opened). */
  markInboxRead: () => void;
  /** Accept an incoming transfer bid (inbox `offer` message): cash in + player leaves. */
  acceptOffer: (messageId: string) => void;
  /** Reject an incoming transfer bid: keep the player, mark the message handled. */
  rejectOffer: (messageId: string) => void;
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
  /** Start a League Season (round-robin division with a table). */
  startLeague: () => void;
  /** Begin a new standalone Cup knockout. */
  startCup: () => void;
  /** Start an authored scenario by id (prebuilt squad + fixed start state). */
  startScenario: (id: string) => void;
  /** Begin a new Career: multiple seasons, persistent squad, board objectives. */
  startCareer: () => void;
  /** Pay to reveal an academy prospect's exact potential during the review. */
  scoutYouth: (youthId: string) => void;
  /** Renew an expiring player's contract in the review (toggle on/off). */
  renewContract: (playerId: string) => void;
  /** Spend bankroll to upgrade a club facility one level (career only). */
  upgradeFacility: (id: FacilityId) => void;
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

/** Base AI strength (ATK+DEF) for a League division — clubs spread around it. */
const LEAGUE_BASE_STRENGTH = 1300;

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
    league: null as LeagueState | null,
    cup: null as CupState | null,
    inbox: [] as InboxMessage[],
    training: DEFAULT_FOCUS as TrainingFocus,
    sharpness: {} as Record<string, number>,
    fatigue: {} as Record<string, number>,
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
    league: s.league,
    cup: s.cup,
    inbox: s.inbox,
    training: s.training,
    sharpness: s.sharpness,
    fatigue: s.fatigue,
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

const ORDINALS = ['th', 'st', 'nd', 'rd'];
/** 1 → "1st", 2 → "2nd", 11 → "11th". */
function ordinal(n: number): string {
  const v = n % 100;
  return n + (ORDINALS[(v - 20) % 10] ?? ORDINALS[v] ?? ORDINALS[0]);
}

/**
 * Resolve one League matchweek: record the player's result + the simulated AI
 * fixtures into the table, advance the matchweek, end the season — no lives.
 * Reuses the FM finances (tier-scaled rewards + rating wages).
 *
 * In **Career** (`s.career` set) the league is one rung of the pyramid: a
 * finished season runs promotion/relegation (`seasonOutcome`) — winning the top
 * tier wins the run, the drop zone in the bottom tier ends it (sacked), and
 * anything else opens the between-seasons review (aging + academy). Standalone
 * League is a single season: 1st = champions, otherwise "season over".
 */
function resolveLeagueRound(s: GameState, result: MatchResult): Partial<GameState> {
  const league = s.league!;
  const mw = league.matchweek;
  const pf = playerFixture(league, mw);
  const config = runConfig(s);

  // Record results (player is side A; orient into the fixture's home/away).
  const results = { ...league.results };
  if (pf) {
    results[fixtureKey(pf)] =
      pf.home === YOU
        ? { home: result.score.a, away: result.score.b }
        : { home: result.score.b, away: result.score.a };
  }
  Object.assign(results, simAiWeek(league, mw, s.runSeed));
  const nextMw = mw + 1;
  const newLeague: LeagueState = { ...league, results, matchweek: nextMw };

  // Economy — a season is played in ONE division, so prize money/income scale
  // by the pyramid TIER (flat across matchweeks), plus rating-based wages.
  const outcome = result.outcome;
  const newStreak = outcome === 'win' ? s.streak + 1 : 0;
  const weeks = leagueTotalWeeks(league);
  // Season-length normalizer: a home-and-away season has 2× the matchweeks, so
  // each game's economy is scaled so a SEASON nets the same as the old single
  // round-robin (the tuned balance is invariant to fixture count).
  const scale = leagueSeasonScale(league);
  const dm = tierMult(s.career ? s.career.tier : LEAGUE_NEUTRAL_TIER);
  const reward = Math.round(MATCH_REWARD[outcome] * dm * scale);
  // Career-only facilities: the stadium adds flat matchday income (folded into
  // the round income figure the UI already shows).
  const matchday = s.career ? matchdayIncome(s.career.facilities.stadium) : 0;
  const roundIncome = Math.round((config.roundIncome * dm + matchday) * scale);
  const intr = Math.round(interest(s.bankroll) * scale);
  const sb = outcome === 'win' ? Math.round(streakBonus(newStreak) * scale) : 0;
  // Career: wages scale with the division (PL wages in the PL) so an open-ended
  // dynasty's economy plateaus instead of running away. Standalone League ×1.
  const wageMult = s.career ? wageTierMult(s.career.tier) : 1;
  const wage = Math.round(
    wageBill(s.owned.map(getPlayer).filter((p): p is Player => !!p)) * wageMult * scale
  );
  // Career: facility running costs — the money sink that keeps wealth meaningful
  // at the top (a big club costs real cash to run every week).
  const upkeep = s.career ? Math.round(facilityUpkeep(s.career.facilities, dm) * scale) : 0;
  const wagerDelta = outcome === 'win' ? s.wager : outcome === 'loss' ? -s.wager : 0;
  const bankroll = Math.max(0, s.bankroll + reward + roundIncome + intr + sb - wage - upkeep + wagerDelta);

  // Discipline & fitness (same rules as the ladder). The medical centre shaves
  // rounds off new injuries (career only) — a bad enough knock can heal at once.
  const suspensions = result.suspensions ?? [];
  const med = s.career ? injuryReduction(s.career.facilities.medical) : 0;
  const newInjuries: Record<string, number> = {};
  for (const [id, r] of Object.entries(s.injuries)) if (r > 1) newInjuries[id] = r - 1;
  // Collect this week's genuine new injuries (post-medical-reduction) for the inbox.
  const injuryMsgs: InboxMessage[] = [];
  for (const inj of result.injuries ?? []) {
    const rounds = inj.rounds - med;
    if (rounds > 0) {
      newInjuries[inj.playerId] = Math.max(newInjuries[inj.playerId] ?? 0, rounds);
      const name = getPlayer(inj.playerId)?.name ?? 'A player';
      injuryMsgs.push(injuryMessage(mw, inj.playerId, name, rounds));
    }
  }

  // Training conditions: starters gain sharpness + fatigue; everyone else recovers
  // fatigue and loses a little sharpness. Pruned to the current squad (sold/Bosman
  // players drop out). Folds into match strength via the modifier pipeline (App).
  const startedSet = new Set(s.xi.filter((id): id is string => !!id));
  const sharpness: Record<string, number> = {};
  const fatigue: Record<string, number> = {};
  for (const id of s.owned) {
    const played = startedSet.has(id);
    sharpness[id] = nextSharpness(s.sharpness[id], played);
    fatigue[id] = nextFatigue(s.fatigue[id], played, s.training);
  }

  const key = outcome === 'win' ? 'w' : outcome === 'loss' ? 'l' : 'd';
  const record = { ...s.record, [key]: s.record[key] + 1 };

  // Player histories accrue here too (starting XI).
  const xiPlayers = s.xi
    .map((id) => (id ? getPlayer(id) : null))
    .filter((p): p is Player => !!p);
  const playerHistory = accrueHistory(s.playerHistory, result.events, xiPlayers, {
    goalsConceded: result.score.b,
    outcome,
    seed: `M-${s.runSeed}-${mw}`,
  });

  // Resolve the season verdict: terminal status, the careerBest this banks, an
  // optional between-seasons review, and the end-of-season notice.
  const done = nextMw > weeks;
  const pos = leaguePosition(newLeague, YOU);
  const clubs = league.clubs.length;
  const career = s.career;

  let runStatus: GameState['runStatus'] = 'playing';
  let careerBest = s.careerBest;
  let careerReview: ReviewState | null = null;
  let seasonNote: string | null = null;
  let careerOut: CareerState | undefined;

  if (done && career) {
    // CAREER: a finished season climbs/drops the pyramid.
    const outcomeSeason = seasonOutcome(career.tier, pos, clubs);
    const divName = division(career.tier).name;
    // Log the just-finished season for the history timeline + honours.
    careerOut = {
      ...career,
      history: [
        ...career.history,
        { season: career.season, tier: career.tier, finishPos: pos, clubs, outcome: outcomeSeason },
      ],
    };
    if (outcomeSeason === 'champion') {
      // Won the top division — the ultimate. Career ends in glory.
      runStatus = 'won';
      careerBest = Math.max(s.careerBest, career.season);
      seasonNote = `🏆 CHAMPIONS OF ENGLAND! You won the ${divName}!`;
    } else if (outcomeSeason === 'sacked') {
      // Relegated out of the bottom tier — nowhere lower. Sacked; career over.
      runStatus = 'lost';
      careerBest = Math.max(s.careerBest, career.season - 1);
      seasonNote = `Relegated from the ${divName}. The board has sacked you.`;
    } else {
      // Promoted / stayed / relegated (but survived) → between-seasons review.
      careerBest = Math.max(s.careerBest, career.season);
      careerReview = {
        season: career.season,
        finishPos: pos,
        clubs,
        fromTier: career.tier,
        toTier: nextTier(career.tier, outcomeSeason),
        outcome: outcomeSeason,
        bonus: reviewBonus(outcomeSeason),
        youth: generateYouth(
          `${s.runSeed}-youth-${career.season}`,
          YOUTH_INTAKE + youthBonus(career.facilities.academy)
        ),
        scouted: [],
        renewed: [],
      };
    }
  } else if (done) {
    // STANDALONE LEAGUE: a single season. 1st = champions, else season over.
    runStatus = pos === 1 ? 'won' : 'lost';
    seasonNote =
      pos === 1
        ? '🏆 Champions! You won the league!'
        : `Season over — finished ${ordinal(pos)} of ${clubs}.`;
  }

  // Achievements: a league has no bosses and no elimination (lives are
  // meaningless), so those snapshot fields are inert. Career seasons feed the
  // Dynasty badge via the careerBest this resolve banks.
  const squadValue = s.owned.reduce((sum, id) => sum + (getPlayer(id)?.cost ?? 0), 0);
  const unlocked = newlyUnlocked(s.achievements, {
    result,
    outcome,
    round: mw,
    runStatus,
    boss: false,
    lives: Number.MAX_SAFE_INTEGER,
    bankroll,
    streak: newStreak,
    squadValue,
    scenario: null,
    daily: false,
    endless: false,
    careerSeasons: careerBest,
  });
  const achievements = unlocked.length ? [...s.achievements, ...unlocked] : s.achievements;
  const achievementNote = unlocked.length
    ? `🏆 Unlocked: ${unlocked.map((id) => getAchievement(id)?.name ?? id).join(' · ')}`
    : null;

  // --- Inbox: post this matchweek's result, any injuries, and a season verdict
  // so the player has a persistent record (FM-style). Stamped with the matchweek.
  const newMsgs: InboxMessage[] = [];
  if (pf) {
    const oppId = pf.home === YOU ? pf.away : pf.home;
    const oppName = league.clubs.find((c) => c.id === oppId)?.name ?? 'the opposition';
    newMsgs.push(resultMessage(mw, oppName, result.score.a, result.score.b));
  }
  newMsgs.push(...injuryMsgs);
  if (seasonNote) newMsgs.push(boardMessage(mw, 'Season verdict', seasonNote));

  // Incoming bids: while the window is open, rival clubs may bid for your better
  // players — seeded on a SEPARATE stream so match/AI determinism is untouched.
  // Stamped for the upcoming matchweek, so they only land when you can act on
  // them. Buyers are biased toward clubs short in that role; players with an open
  // bid are skipped.
  if (!done && isWindowOpen(nextMw, weeks)) {
    const ownedPlayers = s.owned.map(getPlayer).filter((p): p is Player => !!p);
    const openOffers = new Set(
      s.inbox.filter((m) => m.kind === 'offer' && !m.resolved && m.offer).map((m) => m.offer!.playerId)
    );
    const bidders: BidderClub[] = league.clubs
      .filter((c) => c.id !== YOU)
      .map((c) => {
        const counts: Record<string, number> = {};
        for (const id of c.squad ?? []) {
          const role = getPlayer(id)?.role;
          if (role) counts[role] = (counts[role] ?? 0) + 1;
        }
        const needsRoles = (Object.keys(CLUB_SQUAD_NEED) as Player['role'][]).filter(
          (r) => (counts[r] ?? 0) < CLUB_SQUAD_NEED[r]
        );
        return { id: c.id, name: c.name, strength: c.strength, needsRoles };
      });
    const bids = rivalBids(ownedPlayers, bidders, marketTierOf(s) ?? LEAGUE_NEUTRAL_TIER, `${s.runSeed}-offer-${nextMw}`, openOffers);
    for (const b of bids) newMsgs.push(offerMessage(nextMw, b));
  }

  // Morale (man-management): flag at most ONE newly-unhappy player per matchweek
  // (frozen out / poor form), deduped by a stable id so it never spams. Morale is
  // derived from the just-updated form (avg rating) + sharpness.
  if (!done) {
    const flagged = new Set(
      s.inbox.filter((m) => m.kind === 'morale').map((m) => m.id)
    );
    const unhappy = s.owned
      .map((id) => {
        const h = playerHistory[id];
        const m = playerMorale(h ? avgRating(h) : null, sharpness[id]);
        return { id, m };
      })
      .filter((x) => moraleBand(x.m) === 'unhappy' && !flagged.has(`morale-${x.id}`))
      .sort((a, b) => a.m - b.m)[0];
    if (unhappy) {
      const name = getPlayer(unhappy.id)?.name ?? 'A player';
      newMsgs.push(moraleMessage(nextMw, unhappy.id, name));
    }
  }

  // Board confidence (Career): if the mood sours mid-season, the board warns you
  // (once per season). Derived from league position + form; no hard sacking here.
  if (!done && career) {
    const conf = boardConfidence(pos, clubs, record);
    const alreadyWarned = s.inbox.some((m) => m.id === `board-warn-${career.season}`);
    if (confidenceBand(conf) === 'under-pressure' && !alreadyWarned) {
      newMsgs.push(confidenceWarning(nextMw, career.season));
    }
  }

  const inbox = pushMessages(s.inbox, newMsgs);

  return {
    league: newLeague,
    inbox,
    round: nextMw,
    bankroll,
    streak: newStreak,
    record,
    suspensions,
    injuries: newInjuries,
    sharpness,
    fatigue,
    playerHistory,
    achievements,
    careerReview,
    careerBest,
    ...(careerOut && { career: careerOut }),
    wager: 0,
    runStatus,
    peakBankroll: Math.max(s.peakBankroll, bankroll),
    bestStreak: Math.max(s.bestStreak, newStreak),
    lastIncome: { reward, income: roundIncome, interest: intr, streak: sb, wage, upkeep, wager: wagerDelta },
    notice: seasonNote ?? achievementNote,
    noticeKind: 'success',
    selectedPlayerId: null,
  };
}

/**
 * Resolve a Cup tie (standalone knockout). Your tie uses the real-engine result;
 * the rest of the round is simmed and survivors advance. Lose your tie and the
 * run is over; win the final and you lift the trophy. Light economy (a short
 * sprint): match reward + round income + interest − wages, plus discipline +
 * player-history accrual.
 */
function resolveCupRoundState(s: GameState, result: MatchResult): Partial<GameState> {
  const cup = s.cup!;
  const config = runConfig(s);
  const tie = playerTie(cup);
  const playerResult =
    tie && tie.home === YOU
      ? { home: result.score.a, away: result.score.b }
      : { home: result.score.b, away: result.score.a };
  const { alive, results, playerThrough } = resolveCupBracket(cup, playerResult, `${s.runSeed}-cup`);

  // Economy — a short sprint: no facilities/tiers, just the core flow.
  const outcome = result.outcome;
  const newStreak = outcome === 'win' ? s.streak + 1 : 0;
  const reward = MATCH_REWARD[outcome];
  const roundIncome = config.roundIncome;
  const intr = interest(s.bankroll);
  const sb = outcome === 'win' ? streakBonus(newStreak) : 0;
  const wage = Math.round(wageBill(s.owned.map(getPlayer).filter((p): p is Player => !!p)));
  const wagerDelta = outcome === 'win' ? s.wager : outcome === 'loss' ? -s.wager : 0;
  const bankroll = Math.max(0, s.bankroll + reward + roundIncome + intr + sb - wage + wagerDelta);

  // Discipline & fitness (same as the ladder).
  const suspensions = result.suspensions ?? [];
  const newInjuries: Record<string, number> = {};
  for (const [id, r] of Object.entries(s.injuries)) if (r > 1) newInjuries[id] = r - 1;
  for (const inj of result.injuries ?? []) {
    if (inj.rounds > 0) newInjuries[inj.playerId] = Math.max(newInjuries[inj.playerId] ?? 0, inj.rounds);
  }

  const key = outcome === 'win' ? 'w' : outcome === 'loss' ? 'l' : 'd';
  const record = { ...s.record, [key]: s.record[key] + 1 };
  const xiPlayers = s.xi.map((id) => (id ? getPlayer(id) : null)).filter((p): p is Player => !!p);
  const playerHistory = accrueHistory(s.playerHistory, result.events, xiPlayers, {
    goalsConceded: result.score.b,
    outcome,
    seed: `M-${s.runSeed}-cup-${cup.round}`,
  });

  const thisRoundName = cupRoundName(cup.round, cup.rounds);
  const nextRound = cup.round + 1;
  const wonCup = playerThrough && nextRound > cup.rounds;
  let runStatus: GameState['runStatus'] = 'playing';
  let note: string;
  if (!playerThrough) {
    runStatus = 'lost';
    note = `Knocked out of the Cup in the ${thisRoundName}.`;
  } else if (wonCup) {
    runStatus = 'won';
    note = '🏆 CUP WINNERS! You lifted the trophy!';
  } else {
    note = `Through to the ${cupRoundName(nextRound, cup.rounds)}!`;
  }

  const newCup: CupState = { ...cup, alive, results, round: playerThrough ? nextRound : cup.round };

  return {
    cup: newCup,
    round: nextRound,
    bankroll,
    streak: newStreak,
    record,
    suspensions,
    injuries: newInjuries,
    playerHistory,
    wager: 0,
    runStatus,
    peakBankroll: Math.max(s.peakBankroll, bankroll),
    bestStreak: Math.max(s.bestStreak, newStreak),
    lastIncome: { reward, income: roundIncome, interest: intr, streak: sb, wage, upkeep: 0, wager: wagerDelta },
    notice: note,
    noticeKind: runStatus === 'lost' ? 'info' : 'success',
    selectedPlayerId: null,
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
        const s0 = get();
        const player = getPlayer(id);
        if (!player || !s0.owned.includes(id)) return;
        // Career/League: selling is window-gated too (no business out of window).
        if (marketTierOf(s0) !== null && !windowOpenFor(s0)) {
          set({ notice: windowClosedNotice(s0), noticeKind: 'error' });
          return;
        }
        set((s) => {
          // Career/League sell at division-scaled market value (free agents have
          // no resale); Classic/other use the flat 80%-of-cost rule.
          const mt = marketTierOf(s);
          const proceeds = mt !== null ? marketSellValue(player, mt) : sellValue(player);
          return {
            bankroll: s.bankroll + proceeds,
            owned: s.owned.filter((o) => o !== id),
            xi: s.xi.map((slot) => (slot === id ? null : slot)),
            bench: s.bench.filter((b) => b !== id),
            selectedPlayerId: s.selectedPlayerId === id ? null : s.selectedPlayerId,
            notice: null,
          };
        });
      },

      // Sign a player from the Career/League market. Unattached players cost
      // their transfer fee (free agents — sub-64 overall — are free); a player at
      // a rival club is POACHED for a premium, which removes him from that club
      // and weakens them in the table. Auto-assigns into the XI. No-op elsewhere.
      signPlayer: (id, agreedFee) => {
        const s = get();
        const mt = marketTierOf(s);
        if (mt === null) return;
        if (!windowOpenFor(s)) {
          set({ notice: windowClosedNotice(s), noticeKind: 'error' });
          return;
        }
        const player = getPlayer(id);
        if (!player || s.owned.includes(id)) return;
        const club = s.league ? clubOf(s.league, id) : null;
        // The fee is the negotiated figure when one was agreed (the modal's commit
        // step), else the headline asking price. Never below 0.
        const baseFee = club ? poachFee(player, mt) : transferFee(player, mt);
        const fee = agreedFee != null ? Math.max(0, Math.round(agreedFee)) : baseFee;
        const check = checkBuy(s.bankroll, s.owned.length, { ...player, cost: fee });
        if (!check.ok) {
          set({ notice: check.reason ?? 'Cannot sign', noticeKind: 'error' });
          return;
        }
        // Auto-assign: first empty matching XI slot, else bench.
        const newXi = [...s.xi];
        let placedInXi = false;
        for (let i = 0; i < XI_SIZE; i++) {
          if (newXi[i] === null && slotRole(s.formation, i) === player.role) {
            newXi[i] = id;
            placedInXi = true;
            break;
          }
        }
        const newBench = [...s.bench];
        let placedOnBench = false;
        if (!placedInXi && newBench.length < BENCH_SIZE) {
          newBench.push(id);
          placedOnBench = true;
        }
        // Poaching: take the player off the rival's books and dent their strength
        // (a key signing genuinely weakens them). The rival REACTS — they re-sign
        // the best available replacement of that role from the open market, so
        // they're dented but not gutted, and that player leaves the pool (the
        // market tightens, FM-style — a living transfer market).
        let league = s.league;
        let resignedName: string | null = null;
        if (club && league) {
          const hit = Math.round((player.stats.attack + player.stats.defense) * 1.2);
          const ownedAfter = new Set([...s.owned, id]);
          const taken = allClubOwnedIds(league);
          const replacement = POOL
            .filter(
              (p) =>
                p.role === player.role &&
                p.id !== id &&
                !ownedAfter.has(p.id) &&
                !taken.has(p.id)
            )
            .sort(
              (a, b) =>
                b.stats.attack + b.stats.defense - (a.stats.attack + a.stats.defense)
            )[0];
          const restore = replacement
            ? Math.round((replacement.stats.attack + replacement.stats.defense) * 0.9)
            : 0;
          resignedName = replacement?.name ?? null;
          league = {
            ...league,
            clubs: league.clubs.map((c) =>
              c.id === club.id
                ? {
                    ...c,
                    squad: [
                      ...(c.squad ?? []).filter((x) => x !== id),
                      ...(replacement ? [replacement.id] : []),
                    ],
                    strength: Math.max(300, c.strength - hit + restore),
                  }
                : c
            ),
          };
        }
        set({
          bankroll: s.bankroll - fee,
          owned: [...s.owned, id],
          collection: addToCollection(s.collection, id),
          xi: placedInXi ? newXi : s.xi,
          bench: placedOnBench ? newBench : s.bench,
          league,
          // Career: a signing comes with a contract (Bosman bookkeeping).
          ...(s.career && {
            career: { ...s.career, meta: { ...s.career.meta, [id]: newMeta() } },
          }),
          notice: club
            ? `Poached ${player.name} from ${club.name} for £${fee}M!${resignedName ? ` (they replaced him with ${resignedName}.)` : ''}`
            : `Signed ${player.name}${fee === 0 ? ' on a free transfer' : ` for £${fee}M`}!`,
          noticeKind: 'success',
        });
      },

      // One-tap squad fill for the Career/League market: drop the best available
      // FREE AGENT into every empty XI slot (£0), guaranteeing a legal — if
      // humble — side. The manager then spends the budget on quality upgrades.
      autoFillSquad: () =>
        set((s) => {
          if (marketTierOf(s) === null) return {};
          if (!windowOpenFor(s)) return { notice: windowClosedNotice(s), noticeKind: 'error' };
          const ownedSet = new Set(s.owned);
          // Rival-owned players aren't free agents — exclude them from the fill.
          const taken = s.league ? allClubOwnedIds(s.league) : new Set<string>();
          const newXi = [...s.xi];
          const newOwned = [...s.owned];
          const signed: string[] = [];
          for (let i = 0; i < XI_SIZE; i++) {
            if (newXi[i] !== null || newOwned.length >= ROSTER_CAP) continue;
            const role = slotRole(s.formation, i);
            const cand = POOL
              .filter((p) => p.role === role && isFreeAgent(p) && !ownedSet.has(p.id) && !taken.has(p.id))
              .sort((a, b) => overall(b) - overall(a))[0];
            if (cand) {
              newXi[i] = cand.id;
              newOwned.push(cand.id);
              ownedSet.add(cand.id);
              signed.push(cand.id);
            }
          }
          if (!signed.length) return { notice: 'Squad already filled', noticeKind: 'info' };
          return {
            xi: newXi,
            owned: newOwned,
            collection: addToCollection(s.collection, ...signed),
            // Career: each free-agent signing comes on a contract.
            ...(s.career && {
              career: {
                ...s.career,
                meta: { ...s.career.meta, ...Object.fromEntries(signed.map((id) => [id, newMeta()])) },
              },
            }),
            notice: `Signed ${signed.length} free agent${signed.length > 1 ? 's' : ''} to complete the XI.`,
            noticeKind: 'success',
          };
        }),

      setTraining: (focus) => set({ training: focus }),

      markInboxRead: () =>
        set((s) =>
          s.inbox.some((m) => !m.read)
            ? { inbox: s.inbox.map((m) => (m.read ? m : { ...m, read: true })) }
            : {}
        ),

      // Accept a rival's bid for one of your players (an inbox `offer` message):
      // bank the fee, the player leaves your squad, and the buyer's squad +
      // strength rise (a real sale that reshapes the table). Mirrors poaching.
      acceptOffer: (messageId) =>
        set((s) => {
          const msg = s.inbox.find((m) => m.id === messageId);
          if (!msg?.offer || msg.resolved) return {};
          // Selling is window-gated — you can't complete a deal out of window.
          if (!windowOpenFor(s)) return { notice: windowClosedNotice(s), noticeKind: 'error' };
          const { playerId, clubId, fee, playerName } = msg.offer;
          if (!s.owned.includes(playerId)) {
            // The player is already gone — just retire the stale offer.
            return { inbox: s.inbox.map((m) => (m.id === messageId ? { ...m, read: true, resolved: 'rejected' as const } : m)) };
          }
          const player = getPlayer(playerId);
          let league = s.league;
          if (league && player) {
            const lift = Math.round((player.stats.attack + player.stats.defense) * 1.2);
            league = {
              ...league,
              clubs: league.clubs.map((c) =>
                c.id === clubId
                  ? { ...c, squad: [...(c.squad ?? []), playerId], strength: c.strength + lift }
                  : c
              ),
            };
          }
          return {
            bankroll: s.bankroll + fee,
            owned: s.owned.filter((o) => o !== playerId),
            xi: s.xi.map((slot) => (slot === playerId ? null : slot)),
            bench: s.bench.filter((b) => b !== playerId),
            selectedPlayerId: s.selectedPlayerId === playerId ? null : s.selectedPlayerId,
            league,
            inbox: s.inbox.map((m) =>
              m.id === messageId ? { ...m, read: true, resolved: 'accepted' as const } : m
            ),
            notice: `Sold ${playerName} for £${fee}M.`,
            noticeKind: 'success',
          };
        }),

      rejectOffer: (messageId) =>
        set((s) => {
          const msg = s.inbox.find((m) => m.id === messageId);
          if (!msg?.offer || msg.resolved) return {};
          return {
            inbox: s.inbox.map((m) =>
              m.id === messageId ? { ...m, read: true, resolved: 'rejected' as const } : m
            ),
            notice: `Turned down ${msg.offer.clubName}'s bid for ${msg.offer.playerName}.`,
            noticeKind: 'info',
          };
        }),

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
          // Cup + League resolve on their own paths (bracket / table, no lives).
          if (s.cup) return resolveCupRoundState(s, result);
          if (s.league) return resolveLeagueRound(s, result);
          const config = runConfig(s);
          const boss = getBoss(s.round, config.bosses);
          // Boss sudden-death: a draw against an unbeaten side is a defeat.
          const outcome =
            boss?.suddenDeath && result.outcome === 'draw' ? 'loss' : result.outcome;
          const key = outcome === 'win' ? 'w' : outcome === 'loss' ? 'l' : 'd';
          const newStreak = outcome === 'win' ? s.streak + 1 : 0;

          // Prize money + round income scale with the division (lower leagues
          // pay less); wages are the rating-based squad bill (FM-style).
          const dm = divisionMult(s.round, config.maxRounds);
          const reward = Math.round(MATCH_REWARD[outcome] * dm);
          const roundIncome = Math.round(config.roundIncome * dm);
          const intr = interest(s.bankroll);
          const sb = outcome === 'win' ? streakBonus(newStreak) : 0;
          const wage = Math.round(
            wageBill(s.owned.map(getPlayer).filter((p): p is Player => !!p))
          );
          // Gaffer's Gamble: win the stake, lose the stake, draw pushes.
          const wagerDelta =
            outcome === 'win' ? s.wager : outcome === 'loss' ? -s.wager : 0;
          const payout = reward + roundIncome + intr + sb - wage + wagerDelta;
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
          // (Career runs resolve on the league path above; this path is the
          // finite climbs — Classic / Endless / Daily / Scenario.)
          const finalRound = s.round >= config.maxRounds;
          let statusAfter: 'playing' | 'won' | 'lost' = 'playing';
          if (lives <= 0) {
            statusAfter = 'lost';
          } else if (finalRound) {
            statusAfter = outcome === 'win' || config.finalMustWin === false ? 'won' : 'lost';
          }
          const careerSeasons = s.careerBest;

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
              income: roundIncome,
              interest: intr,
              streak: sb,
              wage,
              upkeep: 0, // facility upkeep is career-only (league path)
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
          const scoredKey = config.scored ? 'endless' : s.daily ? 'daily' : null;
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

      // Start a League Season: a fresh league-mode run + a generated division.
      startLeague: () =>
        set((s) => {
          const fresh = freshRun(null, 'league', null);
          const league = leagueWithSquads(fresh.runSeed, LEAGUE_BASE_STRENGTH);
          return {
            ...fresh,
            // The transfer market sets prices; you start with a modest kitty and
            // fill out the side with free agents (see lib/market.ts).
            bankroll: CAREER_STARTING_BANKROLL,
            peakBankroll: CAREER_STARTING_BANKROLL,
            league,
            best: s.best,
            scenarioStars: s.scenarioStars,
            careerBest: s.careerBest,
          };
        }),

      startCup: () =>
        set((s) => {
          const fresh = freshRun(null, 'cup', null);
          const cup = generateCup(fresh.runSeed, LEAGUE_BASE_STRENGTH, CUP_SIZE);
          return {
            ...fresh,
            // Build a squad from the FM market (free agents + signings).
            bankroll: CAREER_STARTING_BANKROLL,
            peakBankroll: CAREER_STARTING_BANKROLL,
            cup,
            best: s.best,
            scenarioStars: s.scenarioStars,
            careerBest: s.careerBest,
          };
        }),

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

      // Begin a Career: enter the bottom of the pyramid (National League) for
      // season 1. Each season is a league in the club's current division; finish
      // high to climb, finish in the drop zone to fall — win the top tier to win
      // it all. (freshRun clears the prior career's aged/youth overlay.)
      startCareer: () =>
        set((s) => {
          const fresh = freshRun(null, 'league', null);
          const tier = BOTTOM_TIER;
          const league = leagueWithSquads(fresh.runSeed, division(tier).baseStrength);
          return {
            ...fresh,
            // Modest opening transfer kitty — field the side with free agents
            // (overall < 64) and spend this on a few quality upgrades.
            bankroll: CAREER_STARTING_BANKROLL,
            peakBankroll: CAREER_STARTING_BANKROLL,
            league,
            career: { season: 1, tier, meta: {}, roster: {}, facilities: newFacilities(), history: [] },
            careerReview: null,
            // The board lays out its expectation for the opening season.
            inbox: [expectationMessage(1, 1, boardExpectation(tier))],
            best: s.best,
            scenarioStars: s.scenarioStars,
            careerBest: s.careerBest,
          };
        }),

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

      // Renew an expiring player's contract during the between-seasons review.
      // A toggle — tap again to cancel. Renewing keeps him; not renewing lets the
      // deal run out and he leaves on a free (Bosman) when the season rolls over.
      renewContract: (playerId) =>
        set((s) => {
          const review = s.careerReview;
          if (!review || !s.owned.includes(playerId)) return {};
          const on = review.renewed.includes(playerId);
          return {
            careerReview: {
              ...review,
              renewed: on
                ? review.renewed.filter((id) => id !== playerId)
                : [...review.renewed, playerId],
            },
          };
        }),

      // Reinvest in the club: upgrade a facility one level (career only). Levels
      // persist across seasons; typically done from the between-seasons review.
      upgradeFacility: (id) =>
        set((s) => {
          if (!s.career) return {};
          const level = s.career.facilities[id];
          if (isMaxed(level)) return { notice: 'Facility already at max level', noticeKind: 'error' };
          const cost = upgradeCost(id, level);
          if (s.bankroll < cost) return { notice: 'Not enough funds', noticeKind: 'error' };
          return {
            bankroll: s.bankroll - cost,
            career: {
              ...s.career,
              facilities: { ...s.career.facilities, [id]: level + 1 },
            },
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
          // Run contracts down a season: renewed players reset, the rest lose a
          // year, and anyone whose deal expired (and wasn't renewed) leaves on a
          // free (Bosman). Departed players stay in the roster overlay (registered)
          // so they reappear in the market — they've just left YOUR club.
          const contracts = resolveContracts(s.owned, aged.meta, new Set(review.renewed));
          const departedSet = new Set(contracts.departed);
          let owned = s.owned.filter((id) => !departedSet.has(id));
          const meta = { ...contracts.meta };
          const roster = { ...prev.roster, ...aged.roster };
          // Strip departed players from the XI / bench.
          const xi: (string | null)[] = s.xi.map((slot) => (slot && departedSet.has(slot) ? null : slot));
          const bench = s.bench.filter((id) => !departedSet.has(id));

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

          const departedNames = contracts.departed.map((id) => getPlayer(id)?.name ?? 'A player');

          const nextSeason = prev.season + 1;
          // Apply promotion/relegation: the review already resolved which tier we
          // play in next. A fresh league is generated for that division.
          const tier = review.toTier;
          // Inbox: out-of-contract departures (Bosman) + the new season's board
          // expectation (scaled to the division you'll play in).
          const inbox = pushMessages(s.inbox, [
            ...(departedNames.length ? [departureMessage(1, nextSeason, departedNames)] : []),
            expectationMessage(1, nextSeason, boardExpectation(tier)),
          ]);
          const startLives = resolveConfig(s.mode, s.mutator).startingLives;
          const seed = nextSeed(s.shopSeed);
          const league = leagueWithSquads(seed, division(tier).baseStrength);
          const divName = division(tier).name;
          const move =
            review.outcome === 'promoted'
              ? `Promoted to the ${divName}!`
              : review.outcome === 'relegated'
                ? `Relegated to the ${divName}.`
                : `Another season in the ${divName}.`;

          return {
            career: {
              season: nextSeason,
              tier,
              meta,
              roster,
              facilities: prev.facilities,
              history: prev.history, // resolveLeagueRound already logged the finished season
            },
            careerReview: null,
            league,
            owned,
            xi,
            bench,
            inbox,
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
            notice: departedNames.length
              ? `${departedNames.length} left on free transfers. ${chosen ? `${chosen.name} joins the academy. ` : ''}${move}`
              : chosen
                ? `${chosen.name} joins the academy. ${move}`
                : move,
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
        if (!state) return;
        const roster = state.career?.roster;
        if (roster) registerPlayers(Object.values(roster));
        // A legacy (pre-pyramid) career has a tier but no league yet — generate
        // one for its division so the league-resolve path has state to work with.
        if (state.career && !state.league) {
          state.league = leagueWithSquads(state.runSeed, division(state.career.tier).baseStrength);
          state.round = state.league.matchweek;
        }
        // A pre-Phase-B league has clubs but no squads — draft them so the
        // transfer market's poach/free-agent split works (idempotent: only when
        // none are set, so it never undoes mid-season poaching).
        if (state.league && !state.league.clubs.some((c) => c.squad)) {
          assignClubSquads(state.league.clubs, POOL);
        }
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
