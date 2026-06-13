import { useCallback, useEffect, useMemo, useState } from 'react';
import { Play, Swords, X, Lock } from 'lucide-react';
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
import { generateOpponent } from '@/lib/opponent';
import { playerFixture, YOU } from '@/lib/league';
import { playerTie as cupPlayerTie, careerCupDue } from '@/lib/cup';
import { runConfig } from '@/lib/scenarios';
import { journeyFor } from '@/lib/journey';
import { effectiveStrength, mergeModifiers } from '@/lib/effects';
import { focusModifiers, conditionModifiers } from '@/lib/training';
import { moraleModifiers, morale as playerMorale } from '@/lib/morale';
import { captainOf, leadershipModifiers } from '@/lib/squad';
import { overall } from '@/lib/wages';
import { avgRating } from '@/lib/ratings';
import { slotPosition } from '@/lib/formations';
import { positionFit } from '@/lib/positions';
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
import FixtureHero from '@/components/home/FixtureHero';
import LeagueTable from '@/components/league/LeagueTable';
import EventBanner from '@/components/season/EventBanner';
import MatchView from '@/components/match/MatchView';
import NewRunModal from '@/components/run/NewRunModal';
import RunOverModal from '@/components/run/RunOverModal';
import JourneyBar from '@/components/run/JourneyBar';
import OnboardingModal from '@/components/run/OnboardingModal';
import StartMenu from '@/components/run/StartMenu';
import DraftRoom from '@/components/run/DraftRoom';
import JobMarket from '@/components/career/JobMarket';
import TransferMarket from '@/components/shop/TransferMarket';
import InboxPanel from '@/components/inbox/InboxPanel';
import TrainingPanel from '@/components/training/TrainingPanel';
import CupBracket from '@/components/cup/CupBracket';
import { unreadCount } from '@/lib/inbox';
import CareerReview from '@/components/career/CareerReview';
import ClubTab from '@/components/club/ClubTab';
import CoachMark from '@/components/ui/CoachMark';
import TopBar from '@/components/nav/TopBar';
import MainNav, { type Tab } from '@/components/nav/MainNav';

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
  const bench = useGameStore((s) => s.bench);
  const owned = useGameStore((s) => s.owned);
  const formation = useGameStore((s) => s.formation);
  const career = useGameStore((s) => s.career);
  const league = useGameStore((s) => s.league);
  const cup = useGameStore((s) => s.cup);
  const training = useGameStore((s) => s.training);
  const sharpness = useGameStore((s) => s.sharpness);
  const fatigue = useGameStore((s) => s.fatigue);
  const playerHistory = useGameStore((s) => s.playerHistory);
  const inbox = useGameStore((s) => s.inbox);
  const markInboxRead = useGameStore((s) => s.markInboxRead);
  const clubName = useGameStore((s) => s.clubName);
  const onboarded = useGameStore((s) => s.onboarded);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [opponent, setOpponent] = useState<MatchTeam | null>(null);
  const [matchSeed, setMatchSeed] = useState<string | null>(null);
  const [matchMode, setMatchMode] = useState<MatchMode>('ladder');
  // Captured at kick-off: was this match a cup knockout? (The store's cup state
  // advances on resolve, so deriving it live would flip at full-time.)
  const [matchKnockout, setMatchKnockout] = useState(false);
  const [challenge, setChallenge] = useState<OpponentTeam | null>(null);
  const [newRunOpen, setNewRunOpen] = useState(false);
  // Front door (Pillar 2): on load the manager lands on the Start Menu and
  // resumes / starts a run from there. The club identity returns here any time.
  const [showStartMenu, setShowStartMenu] = useState(true);

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
    // Out-of-position factor per player, from where each sits in the formation.
    const posMult: Record<string, number> = {};
    xi.forEach((id, slot) => {
      const p = id ? getPlayer(id) : null;
      if (p) posMult[p.id] = positionFit(p, slotPosition(formation, slot));
    });
    let mods = mergeModifiers(roundMods, relicModifiers(relics));
    // Career/League: fold in the weekly training focus + each starter's
    // sharpness/fatigue condition (bounded, subtle). Classic is untouched.
    if (career || league) {
      const ids = starters.map((p) => p.id);
      mods = mergeModifiers(mods, focusModifiers(training));
      mods = mergeModifiers(mods, conditionModifiers(ids, sharpness, fatigue));
      const ratingOf = (id: string) => { const h = playerHistory[id]; return h ? avgRating(h) : null; };
      mods = mergeModifiers(
        mods,
        moraleModifiers(ids, ratingOf, (id) => sharpness[id])
      );
      // Captain (most influential starter) leads the dressing room — his mood
      // lifts or drags the whole side a touch.
      const captain = captainOf(starters, overall);
      const captainMorale = captain ? playerMorale(ratingOf(captain.id), sharpness[captain.id]) : null;
      mods = mergeModifiers(mods, leadershipModifiers(captainMorale));
    }
    const { attack, defense } = effectiveStrength(chemistry.perPlayer, mods, posMult);
    const playerTeam: MatchTeam | null =
      starters.length > 0
        ? { name: clubName ?? 'Your XI', attack, defense, squad: starters }
        : null;
    return { chemistry, multipliers, filled: starters.length, playerTeam };
  }, [xi, formation, roundMods, relics, clubName, career, league, training, sharpness, fatigue, playerHistory]);

  const config = useMemo(
    () => runConfig({ scenario, mode, mutator }),
    [scenario, mode, mutator]
  );

  const roundOpponent = useMemo<MatchTeam | null>(() => {
    if (!playerTeam || runStatus !== 'playing') return null;
    // Cup: face this round's knockout opponent. In standalone Cup mode the cup IS
    // the run; in a Career it's only your match when a tie is due this matchweek
    // (an interleaved midweek game) — otherwise fall through to the league fixture.
    const cupTie = !!cup && (!career || (!!league && careerCupDue(cup, league.matchweek)));
    if (cup && cupTie) {
      const tie = cupPlayerTie(cup);
      if (!tie) return null;
      const oppId = tie.home === YOU ? tie.away : tie.home;
      const club = cup.clubs.find((c) => c.id === oppId);
      if (!club) return null;
      const half = Math.round(club.strength / 2);
      return {
        ...generateOpponent(half, half, `${runSeed}-C${cup.round}-${oppId}`),
        name: club.name,
      };
    }
    // League: face this matchweek's fixture opponent (its club's strength).
    if (league) {
      const pf = playerFixture(league, league.matchweek);
      if (!pf) return null;
      const oppId = pf.home === YOU ? pf.away : pf.home;
      const club = league.clubs.find((c) => c.id === oppId);
      if (!club) return null;
      const half = Math.round(club.strength / 2);
      return {
        ...generateOpponent(half, half, `${runSeed}-L${league.matchweek}-${oppId}`),
        name: club.name,
      };
    }
    return buildRoundOpponent(playerTeam.attack, playerTeam.defense, round, runSeed, {
      roundTarget: config.roundTarget,
      bosses: config.bosses,
    });
  }, [playerTeam, round, runSeed, runStatus, config, league, cup, career]);

  const ready = filled === XI_SIZE;

  const playRound = () => {
    if (!roundOpponent) return;
    setOpponent(roundOpponent);
    setMatchSeed(`M-${runSeed}-${round}`);
    setMatchMode('ladder');
    setMatchKnockout(!!cup && (!career || (!!league && careerCupDue(cup, league.matchweek))));
    setMatchOpen(true);
  };

  const playExhibition = (opp: OpponentTeam) => {
    setOpponent(opp);
    setMatchSeed(`P-${Date.now()}`);
    setMatchMode('pvp');
    setMatchKnockout(false);
    setMatchOpen(true);
  };

  const onMatchComplete = useCallback(
    (result: MatchResult) => {
      if (matchMode === 'ladder') resolveRound(result);
      else awardMatch(result);
    },
    [matchMode, resolveRound, awardMatch]
  );

  // Substitution support: fit bench players who could come on mid-match, and a
  // strength recompute (chemistry + active modifiers) for the substituted XI.
  const benchPlayers = useMemo(
    () =>
      bench
        .map(getPlayer)
        .filter(
          (p): p is Player => !!p && !suspensions.includes(p.id) && !injuries[p.id]
        ),
    [bench, suspensions, injuries]
  );
  const rebuildStrength = useCallback(
    (starters: Player[]) => {
      const chem = computeChemistry(starters);
      const mods = mergeModifiers(roundMods, relicModifiers(relics));
      return effectiveStrength(chem.perPlayer, mods);
    },
    [roundMods, relics]
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

  // The Inbox is a Career/League feature; it renders on the Home tab.
  const showInbox = !!(career || league);
  const inboxUnread = unreadCount(inbox);

  // Classic Draft League is a focused closed tournament — the Market is locked
  // (no transfers in or out) and the Club tab slims down to Settings. The tab
  // SET never changes (4 stable tabs), only the content explains itself.
  const draftTournament = mode === 'classic' && !career && !!league;

  // Opening the Home tab marks the feed read (clears the badge).
  useEffect(() => {
    if (activeTab === 'home' && showInbox && inboxUnread > 0) markInboxRead();
  }, [activeTab, showInbox, inboxUnread, markInboxRead]);

  const showJourney = runStatus === 'playing' && !matchOpen;
  /** The tab the current stage wants the player on. */
  const stageTab: Tab =
    journey.stage === 'sign' ? 'market' : journey.stage === 'pick' ? 'squad' : 'home';
  const attentionTab = showJourney && stageTab !== activeTab ? stageTab : undefined;

  const onJourneyGo = () => {
    if (journey.stage === 'play' && activeTab === 'home') {
      playRound();
      return;
    }
    setActiveTab(stageTab);
  };

  return (
    // pb-20 on mobile to clear the fixed bottom nav; sm:pb-0 on desktop
    <div className="mx-auto min-h-full max-w-5xl px-4 pb-20 sm:pb-8">
      <TopBar
        onNewRun={() => setNewRunOpen(true)}
        onTutorial={() => setTutorialOpen(true)}
        onMainMenu={() => setShowStartMenu(true)}
      />

      <MainNav
        active={activeTab}
        onChange={setActiveTab}
        attentionTab={attentionTab}
        homeBadge={showInbox && activeTab !== 'home' ? inboxUnread : 0}
        marketLocked={draftTournament}
      />

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
        {activeTab === 'home' && (
          <div className="flex flex-col gap-4">
            {runStatus === 'playing' && (
              <CoachMark id="home">
                <b className="text-chrome">This is match day.</b> Check the edge bar to see if
                you're favoured, set your stake, and kick off from the big button above.
                Win/Draw/Loss show exactly what each result pays before you commit.
              </CoachMark>
            )}
            <EventBanner />
            <AvailabilityStrip hideWhenClear />
            {runStatus === 'playing' ? (
              // The fixture hero — the JourneyBar above owns the kick-off CTA.
              <FixtureHero roundOpponent={roundOpponent} playerTeam={playerTeam} />
            ) : (
              // Dismissed-RunOverModal fallback: the end-of-run summary card.
              <SeasonPanel
                roundOpponent={roundOpponent}
                canPlay={ready}
                filled={filled}
                hidePlay
                onPlay={playRound}
              />
            )}
            {league && <LeagueTable />}
            {cup && <CupBracket />}
            {showInbox && <InboxPanel />}
          </div>
        )}

        {activeTab === 'squad' && (
          <div className="flex flex-col gap-4">
          <CoachMark id="squad">
            <b className="text-chrome">Your tactics board.</b> Tap a player in the list for
            details, then tap a pitch slot to field him — or just hit <b className="text-crt-green">Auto-Pick</b>.
            The number on each card is his overall; the green pip is a chemistry link
            (players sharing a club, nation or era boost each other).
          </CoachMark>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_minmax(320px,1fr)]">
            {/* Pitch FIRST on every viewport — it's the decision surface.
                New signings are handled by auto-assign + the toast, not by
                reordering the whole screen (design-mockups/02-squad.html). */}
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-pitch-900/70 px-4 py-2.5">
                <FormationSelector />
                {/* Live team strength — feedback at the moment of the decision */}
                <span className="flex items-center gap-1.5 font-data text-[11px] text-chrome-muted">
                  <span className="rounded-full border border-white/10 bg-surface-1 px-2 py-0.5">
                    ATK <span className="text-chrome">{playerTeam?.attack ?? 0}</span>
                  </span>
                  <span className="rounded-full border border-white/10 bg-surface-1 px-2 py-0.5">
                    DEF <span className="text-chrome">{playerTeam?.defense ?? 0}</span>
                  </span>
                  <span
                    className="rounded-full border border-crt-green/30 bg-crt-green/10 px-2 py-0.5 text-crt-green"
                    title="Active chemistry links — starters sharing a tag"
                  >
                    ⚡ {chemistry.synergies.length} link{chemistry.synergies.length !== 1 ? 's' : ''}
                  </span>
                </span>
              </div>
              <Pitch multipliers={multipliers} />
              <Bench />
              <ChemistryPanel
                chemistry={chemistry}
                filled={filled}
                attack={playerTeam?.attack}
                defense={playerTeam?.defense}
              />
              {(career || league) && <TrainingPanel />}
            </div>
            {/* Roster — right column on desktop, below the pitch on mobile */}
            <div className="flex flex-col gap-3 lg:sticky lg:top-[3.5rem] lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
              <AvailabilityStrip hideWhenClear />
              <SquadList multipliers={multipliers} />
            </div>
          </div>
          </div>
        )}

        {activeTab === 'market' && (
          <div className="flex flex-col gap-4">
            {!draftTournament && (
              <CoachMark id="market">
                <b className="text-chrome">Your first signings.</b> Players sharing a club,
                nation or era link up for a chemistry boost — the green % shows what a
                signing adds to your current XI. Short on cash? Free agents always cost £0,
                or let <b className="text-crt-green">Fill (free)</b> build a legal side in one tap.
              </CoachMark>
            )}
            {draftTournament ? (
              // Locked, not hidden — the tab stays put and explains itself.
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 bg-surface-1 px-6 py-10 text-center">
                <Lock size={22} className="text-chrome-muted" />
                <p className="font-display text-chrome">No transfers in a Draft tournament</p>
                <p className="max-w-sm text-xs text-chrome-muted">
                  Your drafted 16 is your squad for the whole season — no buying, no
                  selling. Pick your XI on the Squad tab and play the league.
                </p>
              </div>
            ) : career || league || cup ? (
              // Career/League/Cup use the FM-style transfer market; Classic & co.
              // keep the roguelike draft shop (featured agent + scouting).
              <TransferMarket />
            ) : (
              <>
                <FeaturedBanner />
                <Shop />
                <ScoutPanel />
              </>
            )}
          </div>
        )}

        {activeTab === 'club' && (
          <ClubTab
            canPlay={ready}
            onPlayImported={playExhibition}
            onScenarioStart={() => setActiveTab('squad')}
            onReplayTutorial={() => setTutorialOpen(true)}
            draftTournament={draftTournament}
          />
        )}
      </DndContext>

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
          if (hasPending) setActiveTab('squad');
        }}
        playerTeam={playerTeam}
        opponent={opponent}
        seed={matchSeed}
        tuning={config.engine}
        ladder={matchMode === 'ladder'}
        knockout={matchKnockout}
        interactive={matchMode === 'ladder'}
        benchPlayers={benchPlayers}
        rebuildStrength={rebuildStrength}
        onComplete={onMatchComplete}
      />

      <NewRunModal
        open={newRunOpen}
        onClose={() => setNewRunOpen(false)}
        // Land where the journey starts: an empty squad begins on the Market
        // (sign players); a prebuilt one (career season 2+) on the Squad.
        onStarted={() => {
          setActiveTab(useGameStore.getState().owned.length === 0 ? 'market' : 'squad');
          setShowStartMenu(false);
        }}
      />

      <CareerReview />
      <RunOverModal onNewRun={() => setNewRunOpen(true)} />
      {/* Classic draft (z-65): snake-draft your squad against the AI clubs. */}
      <DraftRoom />
      {/* Sacked → the Job Market (z-65, above the run-over overlay). A manager's
          career is never over; apply for a club matching your reputation. */}
      <JobMarket />
      {/* The front door (z-55): one-click Resume + New Career (difficulty) +
          Quick Classic + the demoted modes. Hidden while a match is open. */}
      {showStartMenu && !matchOpen && (
        <StartMenu
          onEnter={(tab) => {
            if (tab) setActiveTab(tab);
            setShowStartMenu(false);
          }}
          onMoreModes={() => setNewRunOpen(true)}
          onTutorial={() => setTutorialOpen(true)}
        />
      )}
      {(!onboarded || tutorialOpen) && (
        <OnboardingModal
          tutorialOnly={onboarded}
          onClose={() => setTutorialOpen(false)}
        />
      )}
    </div>
  );
}
