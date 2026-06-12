/**
 * Operational difficulty (Career) — the keystone of the management challenge.
 *
 * Difficulty dictates CLUB LIMITATIONS and the COMPETITIVE LEVEL — how patient the
 * board is, how tight your budget is, how volatile the market is, and how strong the
 * division around you plays (it scales AI strength, not match-AI cleverness). Like
 * `ModeConfig`, it's pure DATA threaded through the existing systems, no forked logic.
 *
 * `standard` keeps the neutral ×1 ECONOMY/MARKET and never sacks you on form, but its
 * competition is tuned for a real contest (`aiStrengthMult` 1.07: promotions are
 * earned, the title is hard). Easy softens the pitch + the board; Hardcore stiffens
 * both. The dials wire in across the pillars:
 *   - graceSeasons / sackThreshold → board sacking (here + resolveLeagueRound)
 *   - startBankrollMult            → startCareer opening kitty
 *   - wageBudgetMult               → hard wage ceiling (Pillar 1, finances)
 *   - aiStrengthMult               → AI club strength (the climb's difficulty)
 *   - agentInflation               → negotiation demands (negotiation polish)
 *   - rivalAggression              → rival poaching/bidding pressure (market)
 */

export type DifficultyId = 'easy' | 'standard' | 'hardcore';

export interface DifficultyConfig {
  id: DifficultyId;
  name: string;
  /** One-line pitch for the start menu. */
  blurb: string;
  /** Plain-English lines for the in-UI explainer matrix. */
  effects: string[];

  // --- board oversight -----------------------------------------------------
  /** Seasons of immunity before low confidence can get you sacked. */
  graceSeasons: number;
  /** Board confidence (0–100) below which you're sacked. 0 = relegation-only
   *  (today's behaviour — the board never fires you on form alone). */
  sackThreshold: number;

  // --- financial limitation ------------------------------------------------
  /** Scales the opening transfer kitty (`CAREER_STARTING_BANKROLL`). */
  startBankrollMult: number;
  /** Hard wage ceiling = `wageBudget(...)` × this. Lower = tighter. (Wired with
   *  the finances pillar; ≥ ~1.4 is effectively non-binding.) */
  wageBudgetMult: number;

  // --- competitive level ---------------------------------------------------
  /** Scales the AI clubs' strength (the division base) you face in Career/League.
   *  >1 = a tougher division (harder to climb, easier to be relegated); <1 = a
   *  softer one. Standard is 1 (today's behaviour — the balance sim is untouched). */
  aiStrengthMult: number;

  // --- market volatility ---------------------------------------------------
  /** Multiplier on agent wage/fee demands in negotiation. */
  agentInflation: number;
  /** How hard rivals poach you + bid for your stars (scales bid pressure). */
  rivalAggression: number;

  // --- the job market (after a sacking) ------------------------------------
  /** How many vacancies you're offered when sacked (more = easier to land well). */
  jobOffers: number;
  /** Reputation docked when generating those offers — a harsh regime damages your
   *  standing more, so the clubs that come calling are humbler. */
  repPenaltyOnSack: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyConfig> = {
  easy: {
    id: 'easy',
    name: 'Easy',
    blurb: 'A patient board, deep pockets, and a calm market.',
    effects: [
      'A softer division — you should outclass most rivals',
      'Board never sacks you on form — only relegation from the bottom tier ends a career',
      'Generous opening budget (×1.5)',
      'Relaxed wage ceiling',
      'Agents ask for less; rivals rarely raid your squad',
    ],
    graceSeasons: 99,
    sackThreshold: 0,
    startBankrollMult: 1.5,
    wageBudgetMult: 1.4,
    aiStrengthMult: 0.95,
    agentInflation: 0.9,
    rivalAggression: 0.5,
    jobOffers: 5,
    repPenaltyOnSack: 0,
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    blurb: 'A fair challenge. Drop out of the bottom tier and you’re finished.',
    effects: [
      'A genuine contest — promotions are earned and the title is hard-won',
      'Relegation from the National League ends your career',
      'Balanced budget and market',
      'The board grumbles when you slip, but won’t fire you on form',
    ],
    graceSeasons: 2,
    sackThreshold: 0,
    startBankrollMult: 1.0,
    wageBudgetMult: 1.0,
    aiStrengthMult: 1.07,
    agentInflation: 1.0,
    rivalAggression: 1.0,
    jobOffers: 4,
    repPenaltyOnSack: 0,
  },
  hardcore: {
    id: 'hardcore',
    name: 'Hardcore',
    blurb: 'Ruthless board, tight budgets, volatile agents. Underperform and you’re out.',
    effects: [
      'A brutal division — every promotion is a fight, relegation always looming',
      'The board sacks you for a season of sustained low confidence',
      'Lean opening budget (×0.7) and a hard wage ceiling',
      'Agents drive a hard bargain; rivals circle your best players',
      'Fewer job offers after a sacking — humbler clubs come calling',
    ],
    graceSeasons: 2,
    sackThreshold: 22,
    startBankrollMult: 0.7,
    wageBudgetMult: 0.75,
    aiStrengthMult: 1.18,
    agentInflation: 1.2,
    rivalAggression: 1.5,
    jobOffers: 2,
    repPenaltyOnSack: 15,
  },
};

export const DEFAULT_DIFFICULTY: DifficultyId = 'standard';

/** Resolve a difficulty config by id, falling back to Standard for unknown ids. */
export function getDifficulty(id: string | null | undefined): DifficultyConfig {
  return DIFFICULTIES[(id as DifficultyId)] ?? DIFFICULTIES[DEFAULT_DIFFICULTY];
}

/**
 * Whether the board fires you at this season's end given the difficulty, your
 * end-of-season confidence (0–100) and the season number (1-based). False during
 * the grace period and whenever the difficulty has no confidence teeth
 * (sackThreshold ≤ 0). Promotion/relegation verdicts are handled by the caller —
 * this is the "fired on form" check on top of them.
 */
export function canSack(
  cfg: DifficultyConfig,
  confidence: number,
  season: number
): boolean {
  if (cfg.sackThreshold <= 0) return false; // relegation-only
  if (season <= cfg.graceSeasons) return false; // immunity window
  return confidence < cfg.sackThreshold;
}

/**
 * The hard wage ceiling (£m/round) for a difficulty, given the club's soft wage
 * budget. Easy is lenient (≥ budget, rarely binds); Hardcore tightens below it.
 * A signing whose wages would push the bill over this is refused.
 */
export function wageCap(softBudget: number, cfg: DifficultyConfig): number {
  return softBudget * cfg.wageBudgetMult;
}
