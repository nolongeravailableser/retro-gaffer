import { Home, Hexagon, ArrowLeftRight, LayoutPanelTop, Lock } from 'lucide-react';

/** The four stable tabs. The set NEVER mutates per mode — a mode that doesn't
 *  support a tab shows it locked with a reason instead of hiding it. */
export type Tab = 'home' | 'squad' | 'market' | 'club';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'home',   label: 'Home',   icon: Home },
  { id: 'squad',  label: 'Squad',  icon: Hexagon },
  { id: 'market', label: 'Market', icon: ArrowLeftRight },
  { id: 'club',   label: 'Club',   icon: LayoutPanelTop },
];

interface MainNavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  /** Tab the player should head to next (gets a pulsing dot), if any. */
  attentionTab?: Tab;
  /** Numeric badge on the Home tab (unread inbox/feed items). */
  homeBadge?: number;
  /** The Market is locked (Draft tournament — no transfers). Still navigable;
   *  the tab content explains why. */
  marketLocked?: boolean;
}

/** Bottom bar on mobile, top rail on desktop — 4 tabs, stable across modes. */
export default function MainNav({ active, onChange, attentionTab, homeBadge = 0, marketLocked }: MainNavProps) {
  const render = (mobile: boolean) =>
    TABS.map(({ id, label, icon: Icon }) => {
      const isActive = active === id;
      const ready = id === attentionTab;
      const badge = id === 'home' ? homeBadge : 0;
      const locked = id === 'market' && marketLocked;
      return (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-current={isActive ? 'page' : undefined}
          className={
            mobile
              ? [
                  'relative flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 pb-2 pt-2.5 font-display text-[11px] transition-colors',
                  isActive ? 'text-crt-green' : locked ? 'text-chrome-muted/50' : 'text-chrome-muted',
                ].join(' ')
              : [
                  'relative flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 font-display text-sm transition-colors',
                  isActive
                    ? 'border-crt-green text-crt-green'
                    : locked
                      ? 'border-transparent text-chrome-muted/50'
                      : 'border-transparent text-chrome-muted hover:border-white/20 hover:text-chrome',
                ].join(' ')
          }
        >
          <Icon size={mobile ? 17 : 15} className={mobile && isActive ? 'drop-shadow-[0_0_4px_rgba(0,255,128,0.6)]' : ''} />
          <span className={mobile ? 'w-full truncate text-center' : ''}>{label}</span>
          {locked && (
            <Lock size={mobile ? 9 : 10} className={mobile ? 'absolute right-[22%] top-2' : 'ml-0.5 opacity-70'} />
          )}
          {badge > 0 && (
            <span
              className={[
                'rounded-full bg-crt-amber text-center font-sans font-bold text-pitch-950',
                mobile
                  ? 'absolute right-[18%] top-1 min-w-[15px] px-1 text-[9px] leading-[15px]'
                  : 'ml-0.5 min-w-[16px] px-1 text-[10px] leading-4',
              ].join(' ')}
            >
              {badge}
            </span>
          )}
          {ready && badge === 0 && !locked && (
            <span
              className={[
                'animate-pulse rounded-full bg-crt-green shadow-glow',
                mobile ? 'absolute right-[24%] top-1.5 h-1.5 w-1.5' : 'absolute right-1 top-2 h-1.5 w-1.5',
              ].join(' ')}
            />
          )}
        </button>
      );
    });

  return (
    <>
      {/* Desktop: sticky top rail */}
      <nav className="sticky top-0 z-20 -mx-4 mb-4 hidden border-b border-white/10 bg-pitch-900/80 px-4 backdrop-blur-sm sm:flex">
        {render(false)}
      </nav>
      {/* Mobile: fixed bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/10 bg-pitch-950/95 backdrop-blur-sm sm:hidden">
        {render(true)}
      </nav>
    </>
  );
}
