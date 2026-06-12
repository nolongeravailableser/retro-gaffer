import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import CareerHub from '@/components/career/CareerHub';
import RecordsPanel from '@/components/records/RecordsPanel';
import ScenariosPanel from '@/components/scenarios/ScenariosPanel';
import PvpPanel from '@/components/pvp/PvpPanel';
import DailyLeaderboard from '@/components/records/DailyLeaderboard';
import ClubSettings from '@/components/run/ClubSettings';
import SavePanel from '@/components/save/SavePanel';
import { dailyKey } from '@/lib/daily';
import type { OpponentTeam } from '@/lib/codec';

type Pill = 'club' | 'records' | 'challenges' | 'compete' | 'settings';

interface ClubTabProps {
  /** PvP needs a full XI to play an imported opponent. */
  canPlay: boolean;
  onPlayImported: (opp: OpponentTeam) => void;
  /** Starting a scenario routes back to the squad. */
  onScenarioStart: () => void;
  onReplayTutorial: () => void;
  /** Draft tournament: a focused closed run — only Settings applies. */
  draftTournament: boolean;
}

/**
 * The Club tab hosts the meta screens behind a pill sub-nav (Club / Records /
 * Challenges / Compete / Settings) — one tap deeper than the old top-level
 * tabs, so they stop competing with the core loop for nav space
 * (design-mockups/06-club.html).
 */
export default function ClubTab({
  canPlay,
  onPlayImported,
  onScenarioStart,
  onReplayTutorial,
  draftTournament,
}: ClubTabProps) {
  const career = useGameStore((s) => s.career);

  const pills: { id: Pill; label: string }[] = draftTournament
    ? [{ id: 'settings', label: 'Settings' }]
    : [
        ...(career ? [{ id: 'club' as Pill, label: 'Club' }] : []),
        { id: 'records', label: 'Records' },
        { id: 'challenges', label: 'Challenges' },
        { id: 'compete', label: 'Compete' },
        { id: 'settings', label: 'Settings' },
      ];

  const [pill, setPill] = useState<Pill>(career ? 'club' : 'records');

  // Keep the active pill valid when the mode changes underneath us.
  useEffect(() => {
    if (!pills.some((p) => p.id === pill)) setPill(pills[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftTournament, career]);

  return (
    <div className="flex flex-col gap-4">
      {pills.length > 1 && (
        <div className="flex w-max max-w-full gap-1 overflow-x-auto rounded-full border border-white/10 bg-surface-1 p-1">
          {pills.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPill(p.id)}
              className={[
                'shrink-0 rounded-full px-4 py-1.5 font-display text-[13px] transition-colors',
                pill === p.id ? 'bg-surface-3 text-crt-green' : 'text-chrome-muted hover:text-chrome',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {pill === 'club' && career && <CareerHub />}
      {pill === 'records' && <RecordsPanel />}
      {pill === 'challenges' && <ScenariosPanel onStart={onScenarioStart} />}
      {pill === 'compete' && (
        <div className="flex flex-col gap-4">
          <PvpPanel canPlay={canPlay} onPlayImported={onPlayImported} />
          <DailyLeaderboard day={dailyKey()} />
        </div>
      )}
      {pill === 'settings' && (
        <div className="flex flex-col gap-4">
          <ClubSettings onReplayTutorial={onReplayTutorial} />
          <SavePanel />
        </div>
      )}
    </div>
  );
}
