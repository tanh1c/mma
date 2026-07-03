import React, { useEffect, useRef, Suspense } from 'react';
import { useGameStore } from './store/gameStore';
import { 
  Users, UserPlus, Calendar, Trophy, Newspaper, 
  Settings, Play, Save, Download, LayoutDashboard, Upload, FileJson
} from 'lucide-react';
import Dashboard from './pages/Dashboard';

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

function App() {
  const { currentView, setView, promotion, currentDate, advanceDays, newGame, saveGame, loadGame, exportGame, importGame } = useGameStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
               case 'roster': return <Roster />;
               case 'free-agents': return <FreeAgents />;
               case 'fighter-detail': return <FighterDetail />;
               case 'event-builder': return <EventBuilder />;
               case 'simulation': return <EventSimulation />;
               case 'rankings': return <Rankings />;
               case 'news': return <News />;
               case 'history': return <HistoryStats />;
               case 'fight-detail': return <FightDetail />;
               case 'debug': return <DebugSim />;
               default: return <Dashboard />;
             }
          })()}
       </Suspense>
    );
  };

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-200 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col">
        <div className="p-4 border-b border-neutral-800">
          <h1 className="text-xl font-black tracking-tight text-white uppercase">{promotion.name}</h1>
          <p className="text-sm text-neutral-400 font-mono mt-1">Rep: {promotion.reputation} | Fans: {promotion.fanbase.toLocaleString()}</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active={currentView === 'dashboard'} onClick={() => setView('dashboard')} />
          <NavItem icon={<Users size={18} />} label="Roster" active={currentView === 'roster'} onClick={() => setView('roster')} />
          <NavItem icon={<Calendar size={18} />} label="Book Event" active={currentView === 'event-builder'} onClick={() => setView('event-builder')} />
          <NavItem icon={<Trophy size={18} />} label="Rankings" active={currentView === 'rankings'} onClick={() => setView('rankings')} />
          <NavItem icon={<UserPlus size={18} />} label="Free Agents" active={currentView === 'free-agents'} onClick={() => setView('free-agents')} />
          <NavItem icon={<Newspaper size={18} />} label="News" active={currentView === 'news'} onClick={() => setView('news')} />
          <NavItem icon={<Download size={18} />} label="History & Stats" active={currentView === 'history'} onClick={() => setView('history')} />
          <NavItem icon={<Settings size={18} />} label="Debug Sim" active={currentView === 'debug'} onClick={() => setView('debug')} />
        </nav>

        <div className="p-4 border-t border-neutral-800 space-y-2">
          <button onClick={() => advanceDays(7)} className="w-full flex items-center justify-center gap-2 bg-neutral-100 hover:bg-white text-neutral-900 px-4 py-2 rounded-md font-bold text-sm transition-colors">
            <Play size={16} /> Advance Week
          </button>
          <div className="flex gap-2">
            <button onClick={saveGame} className="flex-1 flex items-center justify-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-white px-2 py-2 rounded-md font-medium text-xs transition-colors">
              <Save size={14} /> Save
            </button>
            <button onClick={loadGame} className="flex-1 flex items-center justify-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-white px-2 py-2 rounded-md font-medium text-xs transition-colors">
              <Download size={14} /> Load
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={exportGame} className="flex-1 flex items-center justify-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-white px-2 py-2 rounded-md font-medium text-xs transition-colors">
              <FileJson size={14} /> Export
            </button>
            <button onClick={handleImportClick} className="flex-1 flex items-center justify-center gap-1 bg-neutral-800 hover:bg-neutral-700 text-white px-2 py-2 rounded-md font-medium text-xs transition-colors">
              <Upload size={14} /> Import
            </button>
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
            />
          </div>
          <button onClick={() => { if(window.confirm('Start new game? Unsaved progress will be lost.')) newGame() }} className="w-full text-center text-xs text-neutral-500 hover:text-white pt-2">
            New Game
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-neutral-900/50 border-b border-neutral-800 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <span className="font-mono text-sm text-neutral-400 bg-neutral-800/50 px-2 py-1 rounded">
              {currentDate}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-green-400 font-mono bg-green-400/10 px-3 py-1 rounded">
              ${promotion.money.toLocaleString()}
            </div>
          </div>
        </header>

        {/* View Area */}
        <div className="flex-1 overflow-auto bg-neutral-950 p-6">
          <div className="max-w-7xl mx-auto">
            {renderView()}
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export default App;
