import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Award,
  BookOpen,
  Bug,
  CalendarDays,
  CircleAlert,
  ChevronRight,
  CircleDollarSign,
  FileClock,
  Globe2,
  Handshake,
  LayoutDashboard,
  Menu,
  Newspaper,
  Play,
  PlusCircle,
  Settings,
  Trophy,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import type { GameView } from '../store/gameStore';
import { useSettingsStore } from '../store/settingsStore';
import { formatCurrency, formatDate } from '../lib/localization';

export const APP_NAV_GROUPS: Array<{ label: string; items: Array<{ label: string; view: GameView; icon: typeof LayoutDashboard }> }> = [
  {
    label: 'Promotion',
    items: [
      { label: 'Dashboard', view: 'dashboard', icon: LayoutDashboard },
      { label: 'Inbox', view: 'inbox', icon: CircleAlert },
      { label: 'Calendar', view: 'calendar', icon: CalendarDays },
      { label: 'Book Event', view: 'event-builder', icon: PlusCircle }
    ]
  },
  {
    label: 'Competition',
    items: [
      { label: 'Roster', view: 'roster', icon: Users },
      { label: 'Free Agents', view: 'free-agents', icon: UserPlus },
      { label: 'Contract Market', view: 'contract-market', icon: Handshake },
      { label: 'Promotion Finances', view: 'promotion-finances', icon: CircleDollarSign },
      { label: 'Rankings', view: 'rankings', icon: Trophy },
      { label: 'Tournaments', view: 'tournaments', icon: Award },
      { label: 'Leagues', view: 'leagues', icon: Globe2 }
    ]
  },
  {
    label: 'Records',
    items: [
      { label: 'Social Hub', view: 'news', icon: Newspaper },
      { label: 'History & Stats', view: 'history', icon: FileClock },
      { label: 'MMA Guide', view: 'mma-guide', icon: BookOpen },
      { label: 'Debug Sim', view: 'debug', icon: Bug },
      { label: 'Settings', view: 'settings', icon: Settings }
    ]
  }
];

type AppShellProps = {
  currentView: GameView;
  onNavigate: (view: GameView) => void;
  title: string;
  date: string;
  money: number;
  reputation: number;
  onAdvanceWeek: () => void;
  utilities: ReactNode;
  children: ReactNode;
  freeAgentsLabel: string;
  locked: boolean;
  lockProgress: { value: number; max: number };
};

export function AppShell({ currentView, onNavigate, title, date, money, reputation, onAdvanceWeek, utilities, children, locked, lockProgress }: AppShellProps) {
  const { t } = useTranslation('translation');
  const language = useSettingsStore(state => state.language);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = (view: GameView) => {
    onNavigate(view);
    setIsOpen(false);
  };
  const groupLabel = (label: string) => label === 'Promotion' ? t($ => $.navigation.promotion) : label === 'Competition' ? t($ => $.navigation.competition) : t($ => $.navigation.records);
  const navLabel = (view: GameView) => {
    switch (view) {
      case 'dashboard': return t($ => $.navigation.dashboard);
      case 'inbox': return t($ => $.navigation.inbox);
      case 'calendar': return t($ => $.navigation.calendar);
      case 'event-builder': return t($ => $.navigation.bookEvent);
      case 'roster': return t($ => $.navigation.roster);
      case 'free-agents': return t($ => $.navigation.freeAgents);
      case 'contract-market': return t($ => $.navigation.contractMarket);
      case 'promotion-finances': return t($ => $.navigation.promotionFinances);
      case 'rankings': return t($ => $.navigation.rankings);
      case 'tournaments': return t($ => $.navigation.tournaments);
      case 'leagues': return t($ => $.navigation.leagues);
      case 'news': return t($ => $.navigation.socialHub);
      case 'history': return t($ => $.navigation.historyStats);
      case 'mma-guide': return t($ => $.navigation.mmaGuide);
      case 'debug': return t($ => $.navigation.debugSim);
      case 'settings': return t($ => $.navigation.settings);
      default: return view;
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  const navigation = (mobile = false) => (
    <nav className="h-full space-y-5 overflow-y-auto custom-scrollbar" aria-label={t($ => $.shell.gameNavigation)}>
      {APP_NAV_GROUPS.map(group => (
        <div key={group.label}>
          <p className="px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-600">{groupLabel(group.label)}</p>
          <div className="mt-2 space-y-1">
            {group.items.map(item => {
              const Icon = item.icon;
              const active = currentView === item.view;
              const label = navLabel(item.view);
              return <button
                key={item.view}
                type="button"
                title={label}
                aria-current={active ? 'page' : undefined}
                onClick={() => navigate(item.view)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-full px-3 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${active ? 'bg-white text-black' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
              >
                <Icon size={16} strokeWidth={1.7} />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={14} />}
              </button>;
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="min-w-0 flex-1 border-b border-[#2a2c31] px-5 py-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">{t($ => $.shell.promotionControl)}</p>
      <h1 className="mt-2 truncate text-xl font-normal tracking-[-0.04em] text-white">{title}</h1>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-neutral-500">{t($ => $.shell.reputation, { value: reputation })}</p>
    </div>
  );

  return <>
    <div className="flex min-h-svh bg-[#0a0a0a] text-white" inert={locked || undefined} aria-busy={locked || undefined}>
    <aside className="hidden h-svh w-60 shrink-0 flex-col border-r border-[#2a2c31] bg-[#0d0e10] md:flex">
      {brand}
      <div className="min-h-0 flex-1 p-3">{navigation()}</div>
      <div className="border-t border-[#2a2c31] p-3">{utilities}</div>
    </aside>

    {isOpen && <button type="button" aria-label={t($ => $.shell.closeNavigation)} className="fixed inset-0 z-40 bg-black/70 md:hidden" onClick={() => setIsOpen(false)} />}
    {isOpen && <aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[#2a2c31] bg-[#0d0e10] md:hidden">
      <div className="flex items-center justify-between">{brand}<button type="button" onClick={() => setIsOpen(false)} className="mr-4 min-h-11 min-w-11 rounded-full text-neutral-400 hover:bg-white/5 hover:text-white" aria-label={t($ => $.shell.closeNavigation)}><X size={18} /></button></div>
      <div className="min-h-0 flex-1 p-3">{navigation(true)}</div>
      <div className="border-t border-[#2a2c31] p-3" onClick={event => {
        if ((event.target as Element).closest('[data-navigation-action]')) setIsOpen(false);
      }}>{utilities}</div>
    </aside>}

    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-[#2a2c31] bg-[#0a0a0a]/95 px-4 backdrop-blur md:px-6">
        <button type="button" onClick={() => setIsOpen(true)} className="min-h-11 min-w-11 rounded-full text-neutral-400 hover:bg-white/5 hover:text-white md:hidden" aria-label={t($ => $.shell.openNavigation)}><Menu size={18} /></button>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">{formatDate(date, language)}</p>
          <p className="truncate text-sm text-neutral-300 md:hidden">{title}</p>
        </div>
        <div className="hidden items-center gap-2 border-l border-[#2a2c31] pl-4 sm:flex"><CircleDollarSign size={15} className="text-neutral-500" /><span className="font-mono text-sm text-white">{formatCurrency(money, language)}</span></div>
        <button type="button" onClick={onAdvanceWeek} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-3 text-sm text-black transition-colors hover:bg-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-4"><Play size={14} fill="currentColor" /> <span className="hidden sm:inline">{t($ => $.shell.advanceWeek)}</span><span className="sm:hidden">{t($ => $.shell.advance)}</span></button>
      </header>
      <main className="h-[calc(100svh-4rem)] overflow-y-auto custom-scrollbar"><div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div></main>
    </div>
    </div>
    {locked && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 px-4" role="status" aria-live="polite">
      <div className="w-full max-w-sm rounded border border-[#2a2c31] bg-[#101114] p-5 text-white">
        <p className="text-sm font-semibold">{t($ => $.dashboard.observer.simulating)} {lockProgress.value}/{lockProgress.max}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-800" role="progressbar" aria-valuemin={0} aria-valuemax={lockProgress.max} aria-valuenow={lockProgress.value}>
          <div className="h-full bg-white transition-[width]" style={{ width: `${lockProgress.max ? lockProgress.value / lockProgress.max * 100 : 0}%` }} />
        </div>
      </div>
    </div>}
  </>;
}
