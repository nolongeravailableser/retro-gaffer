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
import type { MatchTeam } from '@/lib/engine';
import { buildRoundOpponent } from '@/lib/ladder';
import { effectiveStrength, mergeModifiers } from '@/lib/effects';
import { relicModifiers } from '@/lib/relics';
import { importTeam, readChallengeCode, type OpponentTeam } from '@/lib/codec';
import { consumeLoadError } from '@/store/persistence';
import Pitch from '@/components/pitch/Pitch';
import Bench from '@/components/pitch/Bench';
import FormationSelector from '@/components/pitch/FormationSelector';
import ChemistryPanel from '@/components/pitch/ChemistryPanel';
import Shop from '@/components/shop/Shop';
import SquadPanel from '@/components/squad/SquadPanel';
import SeasonPanel from '@/components/season/SeasonPanel';
import EventBanner from '@/components/season/EventBanner';
import SavePanel from '@/components/save/SavePanel';
import MatchView from '@/components/match/MatchView';
import PvpPanel from '@/components/pvp/PvpPanel';
import Hud from '@/components/ui/Hud';

type MatchMode = 'ladder' | 'pvp';

export default function App() {
  const xi = useGameStore((s) => s.xi);
  const round = useGameStore((s) => s.round);
  const runSeed = useGameStore((s) => s.runSeed);
  const runStatus = useGameStore((s) => s.runStatus);
  const roundMods = useGameStore((s) => s.roundMods);
  const relics = useGameStore((s) => s.relics);
  const placeInSlot = useGameStore((s) => s.placeInSlot);
  const sendToBench = useGameStore((s) => s.sendToBench);
  const resolveRound = useGameStore((s) => s.resolveRound);
  const awardMatch = useGameStore((s) => s.awardMatch);

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

  // Read a shared challenge code from the URL on first load.
  useEffect(() => {
    const code = readChallengeCode(window.location.search);
    if (!code) return;
    const result = importTeam(code);
    if (result.ok) setChallenge(result.team);
  }, []);

  // If the saved game was corrupted, it was discarded — let the player know.
  useEffect(() => {
    if (consumeLoadError()) {
      useGameStore.setState({ notice: 'Saved game was corrupted — started fresh.' });
    }
  }, []);

  // Derive starters + chemistry + the match team from the XI. Memoized on the
  // XI contents so identity stays stable across unrelated re-renders.
  const { chemistry, multipliers, filled, playerTeam } = useMemo(() => {
    const starters = xi
      .map((id) => getPlayer(id))
      .filter((p): p is Player => !!p);
    const chemistry = computeChemistry(starters);
    const multipliers = new Map<string, number>(
      chemistry.perPlayer.map((c) => [c.player.id, c.multiplier])
    );
    // Apply event modifiers + relic modifiers to get effective match strength.
    const mods = mergeModifiers(roundMods, relicModifiers(relics));
    const { attack, defense } = effectiveStrength(chemistry.perPlayer, mods);
    const playerTeam: MatchTeam | null =
      starters.length > 0
        ? { name: 'Your XI', attack, defense, squad: starters }
        : null;
    return { chemistry, multipliers, filled: starters.length, playerTeam };
  }, [xi, roundMods, relics]);

  // This round's ladder opponent (stable across re-renders).
  const roundOpponent = useMemo<MatchTeam | null>(
    () =>
      playerTeam && runStatus === 'playing'
        ? buildRoundOpponent(playerTeam.attack, playerTeam.defense, round, runSeed)
        : null,
    [playerTeam, round, runSeed, runStatus]
  );

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
    <div className="mx-auto min-h-full max-w-7xl px-4 py-6">
      <header className="mb-6 flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2 text-crt-green animate-flicker">
          <Trophy size={20} />
          <h1 className="font-display text-2xl tracking-wide sm:text-3xl">
            RETRO GAFFER
          </h1>
          <Sparkles size={20} />
        </div>
        <Hud />
      </header>

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
              onClick={() => filled > 0 && playExhibition(challenge)}
              disabled={filled === 0}
              data-testid="play-challenge"
              className="flex items-center gap-1.5 rounded-md border border-fuchsia-400/50 bg-fuchsia-500/20 px-3 py-1.5 font-display text-sm text-fuchsia-100 hover:bg-fuchsia-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play size={14} /> {filled > 0 ? 'Play challenge' : 'Field a team first'}
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
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_22rem]">
          {/* Left: formation, board, bench, and the season */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-pitch-900/70 px-4 py-2.5">
              <FormationSelector />
            </div>
            <Pitch multipliers={multipliers} />
            <Bench />
            <EventBanner />
            <SeasonPanel
              roundOpponent={roundOpponent}
              canPlay={filled > 0}
              onPlay={playRound}
            />
          </div>

          {/* Right: strength panel, market, squad, PvP */}
          <div className="flex flex-col gap-4">
            <ChemistryPanel
              chemistry={chemistry}
              filled={filled}
              attack={playerTeam?.attack}
              defense={playerTeam?.defense}
            />
            <Shop />
            <SquadPanel multipliers={multipliers} />
            <PvpPanel canPlay={filled > 0} onPlayImported={playExhibition} />
            <SavePanel />
          </div>
        </div>
      </DndContext>

      <footer className="mt-8 text-center font-ticker text-sm text-chrome-muted">
        Climb the pyramid · draft · build chemistry · survive the season.
      </footer>

      <MatchView
        open={matchOpen}
        onClose={() => setMatchOpen(false)}
        playerTeam={playerTeam}
        opponent={opponent}
        seed={matchSeed}
        onComplete={onMatchComplete}
      />
    </div>
  );
}
