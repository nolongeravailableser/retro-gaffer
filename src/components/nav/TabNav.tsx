import { Layout, ArrowLeftRight, Trophy, MoreHorizontal } from 'lucide-react';

export type Tab = 'formation' | 'transfers' | 'season' | 'more';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'formation', label: 'Tactics',   icon: Layout },
  { id: 'transfers', label: 'Transfers', icon: ArrowLeftRight },
  { id: 'season',    label: 'Season',    icon: Trophy },
  { id: 'more',      label: 'More',      icon: MoreHorizontal },
];

interface TabNavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  /** When true, flag the Season tab as "ready to play" (a pulsing dot). */
  seasonReady?: boolean;
}

export default function TabNav({ active, onChange, seasonReady }: TabNavProps) {
  return (
    <>
      {/* Desktop: horizontal bar below header */}
      <nav className="hidden sm:flex border-b border-white/10 bg-pitch-900/80 backdrop-blur-sm mb-5 -mx-4 px-4 sticky top-0 z-20">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          const ready = id === 'season' && seasonReady;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={[
                'relative flex items-center gap-2 px-4 py-3 text-sm font-display border-b-2 transition-colors',
                isActive
                  ? 'border-crt-green text-crt-green'
                  : 'border-transparent text-chrome-muted hover:text-chrome hover:border-white/20',
              ].join(' ')}
            >
              <Icon size={15} />
              {label}
              {ready && (
                <span className="absolute right-1.5 top-2 h-1.5 w-1.5 animate-pulse rounded-full bg-crt-green shadow-glow" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Mobile: fixed bottom bar */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 flex border-t border-white/10 bg-pitch-950/95 backdrop-blur-sm">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          const ready = id === 'season' && seasonReady;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={[
                'relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-display transition-colors',
                isActive ? 'text-crt-green' : 'text-chrome-muted',
              ].join(' ')}
            >
              <Icon size={18} className={isActive ? 'drop-shadow-[0_0_4px_rgba(0,255,128,0.6)]' : ''} />
              {label}
              {ready && (
                <span className="absolute right-[22%] top-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-crt-green shadow-glow" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
