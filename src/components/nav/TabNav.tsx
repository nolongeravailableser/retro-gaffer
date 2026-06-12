import { Layout, ArrowLeftRight, Mail, Trophy, Target, Swords, BarChart3, Shield } from 'lucide-react';

export type Tab =
  | 'formation'
  | 'transfers'
  | 'inbox'
  | 'season'
  | 'challenges'
  | 'pvp'
  | 'records'
  | 'club';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'formation',  label: 'Tactics',    icon: Layout },
  { id: 'transfers',  label: 'Transfers',  icon: ArrowLeftRight },
  { id: 'inbox',      label: 'Inbox',      icon: Mail },
  { id: 'season',     label: 'Season',     icon: Trophy },
  { id: 'challenges', label: 'Challenges', icon: Target },
  { id: 'pvp',        label: 'Compete',    icon: Swords },
  { id: 'records',    label: 'Records',    icon: BarChart3 },
  { id: 'club',       label: 'Club',       icon: Shield },
];

interface TabNavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  /** Tab the player should head to next (gets a pulsing dot), if any. */
  attentionTab?: Tab;
  /** Show the Inbox tab (Career/League only — Classic keeps 7 tabs). */
  showInbox?: boolean;
  /** Unread inbox count — renders a numeric badge on the Inbox tab. */
  inboxUnread?: number;
  /** Tabs to hide entirely (e.g. the focused Draft-tournament mode). */
  hiddenTabs?: Tab[];
}

export default function TabNav({ active, onChange, attentionTab, showInbox, inboxUnread = 0, hiddenTabs }: TabNavProps) {
  const hidden = new Set(hiddenTabs);
  const tabs = TABS.filter((t) => (t.id !== 'inbox' || showInbox) && !hidden.has(t.id));
  return (
    <>
      {/* Desktop: horizontal bar below header (scrolls if the viewport is narrow) */}
      <nav className="hidden sm:flex overflow-x-auto border-b border-white/10 bg-pitch-900/80 backdrop-blur-sm mb-5 -mx-4 px-4 sticky top-0 z-20">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          const ready = id === attentionTab;
          const unread = id === 'inbox' ? inboxUnread : 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={[
                'relative flex shrink-0 items-center gap-2 px-3.5 py-3 text-sm font-display border-b-2 transition-colors',
                isActive
                  ? 'border-crt-green text-crt-green'
                  : 'border-transparent text-chrome-muted hover:text-chrome hover:border-white/20',
              ].join(' ')}
            >
              <Icon size={15} />
              {label}
              {unread > 0 && (
                <span className="ml-0.5 rounded-full bg-crt-amber px-1.5 text-[10px] font-bold text-pitch-950">
                  {unread}
                </span>
              )}
              {ready && unread === 0 && (
                <span className="absolute right-1 top-2 h-1.5 w-1.5 animate-pulse rounded-full bg-crt-green shadow-glow" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Mobile: fixed bottom bar */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 flex border-t border-white/10 bg-pitch-950/95 backdrop-blur-sm">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          const ready = id === attentionTab;
          const unread = id === 'inbox' ? inboxUnread : 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={[
                // Up to 8 tabs at 375px ≈ 46px each — icon-led, single-line micro label.
                'relative flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-2.5 text-[9px] font-display transition-colors',
                isActive ? 'text-crt-green' : 'text-chrome-muted',
              ].join(' ')}
            >
              <Icon size={17} className={isActive ? 'drop-shadow-[0_0_4px_rgba(0,255,128,0.6)]' : ''} />
              <span className="w-full truncate text-center">{label}</span>
              {unread > 0 && (
                <span className="absolute right-[12%] top-1 min-w-[14px] rounded-full bg-crt-amber px-1 text-center text-[9px] font-bold leading-[14px] text-pitch-950">
                  {unread}
                </span>
              )}
              {ready && unread === 0 && (
                <span className="absolute right-[18%] top-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-crt-green shadow-glow" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
