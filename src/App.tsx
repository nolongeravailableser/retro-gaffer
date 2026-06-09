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
import { getMode } from '@/lib/modes';
import { effectiveStrength, mergeModifiers } from '@/lib/effects';
import { relicModifiers } from '@/lib/relics';
import { importTeam, readChallengeCode, type OpponentTeam } from '@/lib/codec';
import { consumeLoadError } from '@/store/persistence';
import Pitch from '@/components/pitch/Pitch';
import Bench from '@/components/pitch/Bench';
import FormationSelector from '@/components/pitch/FormationSelector';
import ChemistryPanel from '@/components/pitch/ChemistryPanel';
import Shop from '@/components/shop/Shop';
import SquadList from '@/components/squad/SquadList';
import AvailabilityStrip from '@/components/squad/AvailabilityStrip';
import SeasonPanel from '@/components/season/SeasonPanel';
import EventBanner from '@/components/season/EventBanner';
import SavePanel from '@/components/save/SavePanel';
import MatchView from '@/components/match/MatchView';
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
  const roundMods = useGameStore((s) => s.roundMods);
  const relics = useGameStore((s) => s.relics);
  const placeInSlot = useGameStore((s) => s.placeInSlot);
  const sendToBench = useGameStore((s) => s.sendToBench);
  const resolveRound = useGameStore((s) => s.resolveRound);
  const awardMatch = useGameStore((s) => s.awardMatch);

  const suspensions = useGameStore((s) => s.suspensions);
  const injuries = useGameStore((s) => s.injuries);
  const [activeTab, setActiveTab] = useState<Tab>('formation');
  const [matchOpen, setMatchOpen] = useState(false);
  const [opponent, setOpponent] = useState<MatchTeam | null>(null);
  const [matchSeed, setMatchSeed] = useState<string | null>(null);
  const [matchMode, setMatchMode] = useState<MatchMode>('ladder');
  const [challenge, setChallenge] = useState<OpponentTeam | null>(null);

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
        ? { name: 'Your XI', attack, defense, squad: starters }
        : null;
    return { chemistry, multipliers, filled: starters.length, playerTeam };
  }, [xi, roundMods, relics]);

  const config = useMemo(() => getMode(mode), [mode]);

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
        <Hud />
      </header>

      <TabNav active={activeTab} onChange={setActiveTab} />

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
            <Shop />
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

        {activeTab === 'more' && (
          <div className="flex flex-col gap-4">
            <PvpPanel canPlay={ready} onPlayImported={playExhibition} />
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
          const hasPending =
            suspensions.length > 0 || Object.keys(injuries).length > 0;
          if (hasPending) setActiveTab('formation');
        }}
        playerTeam={playerTeam}
        opponent={opponent}
        seed={matchSeed}
        tuning={config.engine}
        onComplete={onMatchComplete}
      />
    </div>
  );
}
