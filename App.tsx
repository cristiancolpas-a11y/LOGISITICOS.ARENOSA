import React, { useState, useEffect } from 'react';
import { Vehicle } from './types';
import DocumentViewer from './components/DocumentViewer';
import SafetyModule from './components/SafetyModule';

import { 
  fetchVehiclesFromSheet
} from './services/sheetService';

import { 
  RefreshCw, Menu, Loader2, Search, ShieldAlert
} from 'lucide-react';

type ActiveView = 'acis';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>('acis');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data States
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  // UI States
  const [viewDoc, setViewDoc] = useState<{ url: string | string[] | {url: string, label?: string}[], title: string } | null>(null);

  const handleSyncData = async () => {
    setIsSyncing(true);
    try {
      const vData = await fetchVehiclesFromSheet();
      setVehicles(vData);
    } catch (error) {
      console.error("Error syncing data:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    handleSyncData();
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex w-full">
      {isSyncing && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center"><Loader2 size={48} className="text-white animate-spin" /></div>}
      
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0f172a] transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform xl:relative xl:translate-x-0`}>
        <div className="p-8 flex flex-col h-full space-y-2">
          <div className="mb-10 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-rose-500/20">BQA</div>
                <span className="text-white font-black text-xs tracking-widest uppercase">Safety</span>
             </div>
          </div>
          
          <nav className="flex-grow space-y-1 overflow-y-auto custom-scrollbar pr-2">
            {[
              { id: 'acis', label: 'ACIS', icon: <ShieldAlert size={18}/> },
            ].map(item => (
              <button 
                key={item.id}
                onClick={() => { 
                  setActiveView(item.id as ActiveView); 
                  setIsSidebarOpen(false); 
                }} 
                className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeView === item.id ? 'bg-rose-600 text-white shadow-xl' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </nav>

          <button onClick={handleSyncData} className="mt-auto w-full flex items-center justify-center gap-3 py-4 bg-white/5 text-rose-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all">
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} /> Sincronizar
          </button>
        </div>
      </aside>

      <main className="flex-grow flex flex-col h-screen overflow-hidden">
        {/* HEADER */}
        <header className="bg-white border-b p-4 flex justify-between items-center shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4 flex-grow">
            <button onClick={() => setIsSidebarOpen(true)} className="xl:hidden p-2 text-slate-600"><Menu/></button>
            <div className="bg-slate-50 border rounded-xl px-4 py-2 flex items-center gap-3 w-full max-w-md shadow-inner">
              <Search size={16} className="text-slate-400" />
              <input 
                type="text" 
                placeholder="BUSCAR..." 
                className="bg-transparent font-black uppercase text-[10px] outline-none flex-grow" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value.toUpperCase())} 
              />
            </div>
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="flex-grow p-6 md:p-8 overflow-y-auto bg-[#f8fafc] custom-scrollbar">
          {activeView === 'acis' && (
            <SafetyModule onBack={() => {}} vehicles={vehicles} isView={true} searchTerm={searchTerm} />
          )}
        </div>
      </main>
      {viewDoc && <DocumentViewer url={viewDoc.url} title={viewDoc.title} onClose={() => setViewDoc(null)} />}
    </div>
  );
};

export default App;
