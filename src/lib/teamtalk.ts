/**
 * Half-time team talks — the interactive match's decision layer. A talk is a
 * bounded multiplier on side A's strengths for the second half. Pure: the
 * choice selects between deterministic continuations (each second-half segment
 * is seeded independently), so Daily fairness is untouched — talks are
 * decisions, exactly like squad building.
 */

import type { MatchTeam } from './engine';

export interface TeamTalk {
  id: 'attack' | 'steady' | 'park';
  name: string;
  emoji: string;
  blurb: string;
  atk: number;
  def: number;
}

export const TEAM_TALKS: TeamTalk[] = [
  {
    id: 'attack',
    name: 'All-out attack',
    emoji: '🔥',
    blurb: 'Throw men forward: +15% attack, −8% defence.',
    atk: 1.15,
    def: 0.92,
  },
  {
    id: 'steady',
    name: 'Stay the course',
    emoji: '🤝',
    blurb: 'No changes — trust the shape.',
    atk: 1,
    def: 1,
  },
  {
    id: 'park',
    name: 'Park the bus',
    emoji: '🧱',
    blurb: 'Protect what we have: +15% defence, −8% attack.',
    atk: 0.92,
    def: 1.15,
  },
];

/** Apply a talk to side A's team values (rounded; 'steady' is identity). */
export function applyTalk(team: MatchTeam, talk: TeamTalk): MatchTeam {
  if (talk.atk === 1 && talk.def === 1) return team;
  return {
    ...team,
    attack: Math.round(team.attack * talk.atk),
    defense: Math.round(team.defense * talk.def),
  };
}
