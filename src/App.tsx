import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trophy, Sparkles, Play, Swords, X } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useGameStore, getPlayer } from '@/store/useGameStore';
import { computeChemistry } from '@/lib/chemistry';
import type { MatchResult, Player } from '@/lib/types';
import { XI_SIZE } from '@/lib/types';
import type { MatchTeam } from '@/lib/engine';
import { buildRoundOpponent } from '@/lib/ladder';
import { runConfig } from '@/lib/scenarios';
import { journeyFor } from '@/lib/journey';
import { effectiveStrength, mergeModifiers } from '@/lib/effects';
import { relicModifiers } from '@/lib/relics';
import { importTeam, readChallengeCode, type OpponentTeam } from '@/lib/codec';
import { consumeLoadError } from '@/store/persistence';
import Pitch from '@/components/pitch/Pitch';
import Bench from '@/components/pitch/Bench';
import FormationSelector from '@/components/pitch/FormationSelector';
import ChemistryPanel from '@/components/pitch/ChemistryPanel';
import Shop from '@/components/shop/Shop';
import ScoutPanel from '@/components/shop/ScoutPanel';
import FeaturedBanner from '@/components/shop/FeaturedBanner';
import SquadList from '@/components/squad/SquadList';
import AvailabilityStrip from '@/components/squad/AvailabilityStrip';
import SeasonPanel from '@/components/season/SeasonPanel';
import EventBanner from '@/components/season/EventBanner';
import SavePanel from '@/components/save/SavePanel';
import MatchView from '@/components/match/MatchView';
import NewRunModal from '@/components/run/NewRunModal';
import RunOverModal from '@/components/run/RunOverModal';
import JourneyBar from '@/components/run/JourneyBar';
import OnboardingModal from '@/components/run/OnboardingModal';
import ClubSettings from '@/components/run/ClubSettings';
import ScenariosPanel from '@/components/scenarios/ScenariosPanel';
import CareerReview from '@/components/career/CareerReview';
import RecordsPanel from '@/components/records/RecordsPanel';
import PvpPanel from '@/components/pvp/PvpPanel';
import Hud from '@/components/ui/Hud';
import TabNav, { type Tab } from '@/components/nav/TabNav';

type MatchMode = 'ladder' | 'pvp';

export default function App() {
  const xi = useGameStore((s) => s.xi);
  const round = useGameStore((s) => s.round);
  const runSeed = useGameStore((s) => s.runSeed);
  const runStatus = useGameStore((s) => s.runStatus);
  const mode = useGameStore((s) => s.mode);
  const mutator = useGameStore((s) => s.mutator);
  const scenario = useGameStore((s) => s.scenario);
  const roundMods = useGameStore((s) => s.roundMods);
  const relics = useGameStore((s) => s.relics);
  const placeInSlot = useGameStore((s) => s.placeInSlot);
  const sendToBench = useGameStore((s) => s.sendToBench);
  const resolveRound = useGameStore((s) => s.resolveRound);
  const awardMatch = useGameStore((s) => s.awardMatch);

  const suspensions = useGameStore((s) => s.suspensions);
  const injuries = useGameStore((s) => s.injuries);
  const owned = useGameStore((s) => s.owned);
  const formation = useGameStore((s) => s.formation);
  const career = useGameStore((s) => s.career);
  const clubName = useGameStore((s) => s.clubName);
  const managerName = useGameStore((s) => s.managerName);
  const onboarded = useGameStore((s) => s.onboarded);
  const [activeTab, setActiveTab] = useState<Tab>('formation');
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [opponent, setOpponent] = useState<MatchTeam | null>(null);
  const [matchSeed, setMatchSeed] = useState<string | null>(null);
  const [matchMode, setMatchMode] = useState<MatchMode>('ladder');
  const [challenge, setChallenge] = useState<OpponentTeam | null>(null);
  const [newRunOpen, setNewRunOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const onDragEnd = (e: DragEndEvent) => {
    const playerId = e.active.data.current?.playerId as string | undefined;
    const over = e.over?.id;
    if (!playerId || over == null) return;
    if (typeof over === 'string' && over.startsWith('slot:')) {
      placeInSlot(playerId, Number(over.slice(5)));
    } else if (over === 'bench') {
      sendToBench(playerId);
    }
  };

  useEffect(() => {
    const code = readChallengeCode(window.location.search);
    if (!code) return;
    const result = importTeam(code);
    if (result.ok) setChallenge(result.team);
  }, []);

  useEffect(() => {
    if (consumeLoadError()) {
      useGameStore.setState({ notice: 'Saved game was corrupted — started fresh.' });
    }
  }, []);

  const { chemistry, multipliers, filled, playerTeam } = useMemo(() => {
    const starters = xi
      .map((id) => getPlayer(id))
      .filter((p): p is Player => !!p);
    const chemistry = computeChemistry(starters);
    const multipliers = new Map<string, number>(
      chemistry.perPlayer.map((c) => [c.player.id, c.multiplier])
    );
    const mods = mergeModifiers(roundMods, relicModifiers(relics));
    const { attack, defense } = effectiveStrength(chemistry.perPlayer, mods);
    const playerTeam: MatchTeam | null =
      starters.length > 0
        ? { name: clubName ?? 'Your XI', attack, defense, squad: starters }
        : null;
    return { chemistry, multipliers, filled: starters.length, playerTeam };
  }, [xi, roundMods, relics, clubName]);

  const config = useMemo(
    () => runConfig({ scenario, mode, mutator }),
    [scenario, mode, mutator]
  );

  const roundOpponent = useMemo<MatchTeam | null>(
    () =>
      playerTeam && runStatus === 'playing'
        ? buildRoundOpponent(playerTeam.attack, playerTeam.defense, round, runSeed, {
            roundTarget: config.roundTarget,
            bosses: config.bosses,
          })
        : null,
    [playerTeam, round, runSeed, runStatus, config]
  );

  const ready = filled === XI_SIZE;

  const playRound = () => {
    if (!roundOpponent) return;
    setOpponent(roundOpponent);
    setMatchSeed(`M-${runSeed}-${round}`);
    setMatchMode('ladder');
    setMatchOpen(true);
  };

  const playExhibition = (opp: OpponentTeam) => {
    setOpponent(opp);
    setMatchSeed(`P-${Date.now()}`);
    setMatchMode('pvp');
    setMatchOpen(true);
  };

  const onMatchComplete = useCallback(
    (result: MatchResult) => {
      if (matchMode === 'ladder') resolveRound(result);
      else awardMatch(result);
    },
    [matchMode, resolveRound, awardMatch]
  );

  const dismissChallenge = () => {
    setChallenge(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  // Where the player is in the core loop (SIGN → PICK → KICK OFF). Drives the
  // journey bar, the nav attention dot, and stage-aware routing — the next
  // action is always obvious and one tap away.
  const journey = useMemo(() => {
    const fieldable = owned
      .map(getPlayer)
      .filter(
        (p): p is Player => !!p && !suspensions.includes(p.id) && !injuries[p.id]
      );
    return journeyFor(fieldable, formation, filled);
  }, [owned, suspensions, injuries, formation, filled]);

  const showJourney = runStatus === 'playing' && !matchOpen;
  /** The tab the current stage wants the player on. */
  const stageTab: Tab =
    journey.stage === 'sign' ? 'transfers' : journey.stage === 'pick' ? 'formation' : 'season';
  const attentionTab = showJourney && stageTab !== activeTab ? stageTab : undefined;

  const onJourneyGo = () => {
    if (journey.stage === 'play' && activeTab === 'season') {
      playRound();
      return;
    }
    setActiveTab(stageTab);
  };

  return (
    // pb-20 on mobile to clear the fixed bottom nav; sm:pb-0 on desktop
    <div className="mx-auto min-h-full max-w-5xl px-4 pb-20 sm:pb-8">
      <header className="pt-5 pb-4 flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2 text-crt-green animate-flicker">
          <Trophy size={20} />
          <h1 className="font-display text-2xl tracking-wide sm:text-3xl">
            RETRO GAFFER
          </h1>
          <Sparkles size={20} />
        </div>
        {clubName && (
          <p className="-mt-1 font-display text-sm text-chrome">
            {clubName}
            {managerName && <span className="text-chrome-muted"> · {managerName}</span>}
          </p>
        )}
        <Hud onNewRun={() => setNewRunOpen(true)} />
      </header>

      <TabNav active={activeTab} onChange={setActiveTab} attentionTab={attentionTab} />

      {/* The core-loop guide: sign → pick → kick off, one obvious action per stage */}
      {showJourney && (
        <JourneyBar
          journey={journey}
          filled={filled}
          round={round}
          onTargetTab={activeTab === stageTab}
          careerSeason={career?.season ?? null}
          onGo={onJourneyGo}
        />
      )}

      {challenge && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 px-4 py-3">
          <span className="flex items-center gap-2 text-sm">
            <Swords size={18} className="text-fuchsia-300" />
            <span className="font-display text-fuchsia-200">{challenge.name}</span>
            <span className="text-chrome-muted">
              challenges you — ATK {challenge.attack} · DEF {challenge.defense}
            </span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => ready && playExhibition(challenge)}
              disabled={!ready}
              data-testid="play-challenge"
              className="flex items-center gap-1.5 rounded-md border border-fuchsia-400/50 bg-fuchsia-500/20 px-3 py-1.5 font-display text-sm text-fuchsia-100 hover:bg-fuchsia-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play size={14} /> {ready ? 'Play challenge' : `Fill your XI (${filled}/${XI_SIZE})`}
            </button>
            <button
              type="button"
              onClick={dismissChallenge}
              aria-label="Dismiss challenge"
              className="text-chrome-muted hover:text-chrome"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        {activeTab === 'formation' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_288px]">
            {/* Squad list — first on mobile (immediately visible), right column on desktop */}
            <div className="order-first lg:order-last lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:sticky lg:top-[3.5rem] flex flex-col gap-3">
              <AvailabilityStrip hideWhenClear />
              <SquadList multipliers={multipliers} />
            </div>
            {/* Pitch — below squad list on mobile, left column on desktop */}
            <div className="order-last lg:order-first flex flex-col gap-4 min-w-0">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-pitch-900/70 px-4 py-2.5">
                <FormationSelector />
              </div>
              <Pitch multipliers={multipliers} />
              <Bench />
              <ChemistryPanel
                chemistry={chemistry}
                filled={filled}
                attack={playerTeam?.attack}
                defense={playerTeam?.defense}
              />
            </div>
          </div>
        )}

        {activeTab === 'transfers' && (
          <div className="flex flex-col gap-4">
            <FeaturedBanner />
            <Shop />
            <ScoutPanel />
          </div>
        )}

        {activeTab === 'season' && (
          <div className="flex flex-col gap-4">
            <EventBanner />
            <AvailabilityStrip />
            <SeasonPanel
              roundOpponent={roundOpponent}
              canPlay={ready}
              filled={filled}
              onPlay={playRound}
            />
          </div>
        )}

        {activeTab === 'challenges' && (
          <ScenariosPanel onStart={() => setActiveTab('formation')} />
        )}

        {activeTab === 'pvp' && (
          <PvpPanel canPlay={ready} onPlayImported={playExhibition} />
        )}

        {activeTab === 'records' && <RecordsPanel />}

        {activeTab === 'club' && (
          <div className="flex flex-col gap-4">
            <ClubSettings onReplayTutorial={() => setTutorialOpen(true)} />
            <SavePanel />
          </div>
        )}
      </DndContext>

      <footer className="mt-8 text-center font-ticker text-sm text-chrome-muted">
        Climb the pyramid · draft · build chemistry · survive the season.
      </footer>

      <MatchView
        open={matchOpen}
        onClose={() => {
          setMatchOpen(false);
          // A finished run is handled by the RunOverModal overlay (shown over any
          // tab). Otherwise, if players need attention (bans/injuries), jump to the
          // squad so the manager can re-pick before the next round.
          if (runStatus !== 'playing') return;
          const hasPending =
            suspensions.length > 0 || Object.keys(injuries).length > 0;
          if (hasPending) setActiveTab('formation');
        }}
        playerTeam={playerTeam}
        opponent={opponent}
        seed={matchSeed}
        tuning={config.engine}
        ladder={matchMode === 'ladder'}
        onComplete={onMatchComplete}
      />

      <NewRunModal
        open={newRunOpen}
        onClose={() => setNewRunOpen(false)}
        // Land where the journey starts: an empty squad begins on Transfers
        // (sign players); a prebuilt one (career season 2+) on Tactics.
        onStarted={() =>
          setActiveTab(useGameStore.getState().owned.length === 0 ? 'transfers' : 'formation')
        }
      />

      <CareerReview />
      <RunOverModal onNewRun={() => setNewRunOpen(true)} />
      {(!onboarded || tutorialOpen) && (
        <OnboardingModal
          tutorialOnly={onboarded}
          onClose={() => setTutorialOpen(false)}
        />
      )}
    </div>
  );
}
