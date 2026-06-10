import { useState } from 'react';
import { Shield, Check, GraduationCap } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { DEFAULT_KIT, type Kit } from '@/lib/kits';
import KitPicker from './KitPicker';

interface ClubSettingsProps {
  /** Reopen the onboarding tutorial carousel. */
  onReplayTutorial: () => void;
}

/** Identity settings: rename your club/manager and replay the tutorial. */
export default function ClubSettings({ onReplayTutorial }: ClubSettingsProps) {
  const clubName = useGameStore((s) => s.clubName);
  const managerName = useGameStore((s) => s.managerName);
  const storeKit = useGameStore((s) => s.kit);
  const setStoreKit = useGameStore((s) => s.setKit);
  const completeOnboarding = useGameStore((s) => s.completeOnboarding);

  const [club, setClub] = useState(clubName ?? '');
  const [manager, setManager] = useState(managerName ?? '');
  const [saved, setSaved] = useState(false);

  // Kit edits apply IMMEDIATELY (they're non-destructive and freely
  // reversible) — tab-switching can never silently discard a design.
  const kit = storeKit ?? DEFAULT_KIT;
  const onKitChange = (k: Kit) => setStoreKit(k);

  const dirty =
    club.trim() !== (clubName ?? '') || manager.trim() !== (managerName ?? '');

  const save = () => {
    completeOnboarding(club, manager);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-pitch-900/70 p-4">
      <h2 className="mb-1 flex items-center gap-2 font-display text-xl">
        <Shield size={18} /> Your Club
      </h2>
      <p className="mb-3 text-[11px] text-chrome-muted">
        Your club and manager name show up on the teamsheet and in shared codes.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="font-display text-[11px] uppercase tracking-wide text-chrome-muted">
            Club name
          </span>
          <input
            value={club}
            onChange={(e) => setClub(e.target.value.slice(0, 24))}
            placeholder="Your XI"
            maxLength={24}
            data-testid="settings-club-name"
            className="rounded-md border border-white/15 bg-pitch-950 px-3 py-2 font-display text-sm text-chrome placeholder:text-chrome-muted/50 focus:border-crt-green/60 focus:outline-none"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="font-display text-[11px] uppercase tracking-wide text-chrome-muted">
            Manager name
          </span>
          <input
            value={manager}
            onChange={(e) => setManager(e.target.value.slice(0, 24))}
            placeholder="The Gaffer"
            maxLength={24}
            data-testid="settings-manager-name"
            className="rounded-md border border-white/15 bg-pitch-950 px-3 py-2 font-display text-sm text-chrome placeholder:text-chrome-muted/50 focus:border-crt-green/60 focus:outline-none"
          />
        </label>
      </div>

      {/* Kit designer */}
      <div className="mt-4 rounded-lg border border-white/10 bg-pitch-950/40 p-3">
        <p className="mb-2 font-display text-[11px] uppercase tracking-wide text-chrome-muted">
          Club kit <span className="normal-case text-chrome-muted/70">— changes apply instantly</span>
        </p>
        <KitPicker value={kit} onChange={onKitChange} compact />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onReplayTutorial}
          className="flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-xs font-display text-chrome-muted transition hover:bg-white/5 hover:text-chrome"
        >
          <GraduationCap size={14} /> Replay tutorial
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!dirty && !saved}
          data-testid="settings-save-club"
          className="flex items-center gap-1.5 rounded-md border border-crt-green/50 bg-crt-green/20 px-4 py-1.5 font-display text-sm text-crt-green transition hover:bg-crt-green/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saved ? <Check size={14} /> : null}
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}
