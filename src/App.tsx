import React, { useEffect, useRef, Suspense, useMemo, useState } from 'react';
import { useGameStore } from './store/gameStore';
import { Download, FileJson, Save, Upload } from 'lucide-react';
import { AppShell } from './components/AppShell';
import { Button } from './components/ui';
import Dashboard from './pages/Dashboard';

const FREE_AGENTS_NAV_LABEL = 'Sign Fighters';

const Roster = React.lazy(() => import('./pages/Roster'));
const FreeAgents = React.lazy(() => import('./pages/FreeAgents'));
const Rankings = React.lazy(() => import('./pages/Rankings'));
const News = React.lazy(() => import('./pages/News'));
const FighterDetail = React.lazy(() => import('./pages/FighterDetail'));
const EventBuilder = React.lazy(() => import('./pages/EventBuilder'));
const EventSimulation = React.lazy(() => import('./pages/EventSimulation'));
const DebugSim = React.lazy(() => import('./pages/DebugSim'));
const HistoryStats = React.lazy(() => import('./pages/HistoryStats'));
const FightDetail = React.lazy(() => import('./pages/FightDetail').then(module => ({ default: module.FightDetail })));
const Tournaments = React.lazy(() => import('./pages/Tournaments'));
const CalendarPage = React.lazy(() => import('./pages/Calendar'));
const MmaGuide = React.lazy(() => import('./pages/MmaGuide'));
const Inbox = React.lazy(() => import('./pages/Inbox'));
const SettingsPage = React.lazy(() => import('./pages/Settings'));

function App() {
  const { currentView, setView, promotion, currentDate, fighters, events, advanceDays, newGame, saveGame, loadGame, exportGame, importGame } = useGameStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const searchResults = useMemo(() => query ? [
    ...Object.values(fighters).filter(fighter => `${fighter.firstName} ${fighter.lastName} ${fighter.nickname}`.toLowerCase().includes(query)).slice(0, 4).map(fighter => ({ id: fighter.id, label: `${fighter.firstName} ${fighter.lastName}`, type: 'Fighter' as const })),
    ...Object.values(events).filter(event => !event.isCompleted && event.name.toLowerCase().includes(query)).slice(0, 4).map(event => ({ id: event.id, label: event.name, type: 'Event' as const }))
  ] : [], [query, fighters, events]);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        importGame(content);
      };
      reader.readAsText(file);
    }
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderView = () => {
    return (
       <Suspense fallback={<div className="flex-1 flex items-center justify-center p-8"><p className="text-neutral-500 font-mono animate-pulse">Loading View...</p></div>}>
          {(() => {
             switch (currentView) {
               case 'dashboard': return <Dashboard />;
               case 'inbox': return <Inbox />;
               case 'roster': return <Roster />;
               case 'free-agents': return <FreeAgents />;
               case 'fighter-detail': return <FighterDetail />;
               case 'event-builder': return <EventBuilder />;
               case 'simulation': return <EventSimulation />;
               case 'rankings': return <Rankings />;
               case 'news': return <News />;
               case 'history': return <HistoryStats />;
               case 'fight-detail': return <FightDetail />;
               case 'tournaments': return <Tournaments />;
               case 'debug': return <DebugSim />;
               case 'calendar': return <CalendarPage />;
               case 'mma-guide': return <MmaGuide />;
               case 'settings': return <SettingsPage />;
               default: return <Dashboard />;
             }
          })()}
       </Suspense>
    );
  };

  return <AppShell
    currentView={currentView}
    onNavigate={view => setView(view)}
    title={promotion.name}
    date={currentDate}
    money={promotion.money}
    reputation={promotion.reputation}
    freeAgentsLabel={FREE_AGENTS_NAV_LABEL}
    onAdvanceWeek={() => advanceDays(7)}
    utilities={<div className="space-y-2">
      <div className="relative"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find fighter or event" aria-label="Quick search" className="h-10 w-full rounded border border-neutral-800 bg-neutral-950 px-3 text-xs text-white outline-none focus:border-neutral-500" />{searchResults.length > 0 && <div className="absolute bottom-11 z-20 w-full overflow-hidden rounded border border-neutral-700 bg-[#101114] shadow-xl">{searchResults.map(result => <button key={`${result.type}-${result.id}`} type="button" data-navigation-action onClick={() => { setView(result.type === 'Fighter' ? 'fighter-detail' : 'event-builder', result.type === 'Fighter' ? { fighterId: result.id } : { eventId: result.id }); setSearch(''); }} className="block w-full border-b border-neutral-800 px-3 py-2 text-left text-xs text-neutral-300 last:border-0 hover:bg-white/5 hover:text-white"><span className="mr-2 font-mono text-[9px] uppercase text-neutral-500">{result.type}</span>{result.label}</button>)}</div>}</div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={saveGame} className="flex min-h-10 items-center justify-center gap-1 px-2 text-xs"><Save size={14} /> Save</Button>
        <Button variant="secondary" onClick={loadGame} className="flex min-h-10 items-center justify-center gap-1 px-2 text-xs"><Download size={14} /> Load</Button>
        <Button variant="secondary" onClick={exportGame} className="flex min-h-10 items-center justify-center gap-1 px-2 text-xs"><FileJson size={14} /> Export</Button>
        <Button variant="secondary" onClick={handleImportClick} className="flex min-h-10 items-center justify-center gap-1 px-2 text-xs"><Upload size={14} /> Import</Button>
      </div>
      <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
      <Button variant="quiet" onClick={() => { if (window.confirm('Start new game? Unsaved progress will be lost.')) newGame(); }} className="w-full text-xs">New Game</Button>
    </div>}
  >
    {renderView()}
  </AppShell>;
}

export default App;
