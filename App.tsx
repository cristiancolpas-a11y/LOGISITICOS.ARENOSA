import React, { useState, useEffect } from 'react';
import { Vehicle } from './types';
import DocumentViewer from './components/DocumentViewer';
import SafetyModule from './components/SafetyModule';
import VisitasPOCSModule from './components/CashlessModule';

import { 
  fetchVehiclesFromSheet
} from './services/sheetService';

import { 
  RefreshCw, Menu, Loader2, Search, ShieldAlert, CreditCard, Users, Home, ChevronLeft, Truck
} from 'lucide-react';

type ActiveView = 'acis' | 'cashless' | 'people-placeholder';

const App: React.FC = () => {
  const [showEntryMenu, setShowEntryMenu] = useState(true);
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

  if (showEntryMenu) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 w-full">
        <div className="max-w-4xl w-full space-y-12">
          <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-700">
            <div className="w-20 h-20 bg-rose-600 rounded-[1.5rem] flex items-center justify-center text-white font-black text-3xl shadow-2xl shadow-rose-500/40">
              BQA
            </div>
            <div className="text-center">
              <h1 className="text-white text-4xl font-black uppercase tracking-[0.1em]">SISTEMA DE GESTION</h1>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2">Gestión y Control Operativo</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-both">
            {/* SAFETY BUTTON - Styled like Image 2 */}
            <button 
              onClick={() => setShowEntryMenu(false)}
              className="group relative bg-white/5 hover:bg-white/10 border border-white/10 p-8 rounded-[3rem] transition-all flex items-center gap-6 text-left active:scale-95"
            >
              <div className="w-20 h-20 bg-rose-600/20 rounded-3xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-lg shadow-rose-500/10">
                <ShieldAlert size={36} className="text-rose-500" />
              </div>
              <div>
                <div className="text-2xl font-black text-white uppercase tracking-tight leading-tight">Safety</div>
                <div className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-1">Gestión de Seguridad y ACIS</div>
              </div>
            </button>

            {/* PEOPLE BUTTON - Styled like Image 2 */}
            <button 
              onClick={() => {
                setShowEntryMenu(false);
                setActiveView('people-placeholder');
              }}
              className="group relative bg-white/5 hover:bg-white/10 border border-white/10 p-8 rounded-[3rem] transition-all flex items-center gap-6 text-left active:scale-95"
            >
              <div className="w-20 h-20 bg-blue-600/20 rounded-3xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/10">
                <Users size={36} className="text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-black text-white uppercase tracking-tight leading-tight">People</div>
                <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">Gestión Humana y Talento</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            <button 
              onClick={() => setShowEntryMenu(true)}
              className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all mb-4 border border-white/5"
            >
              <Home size={18}/> Menú Principal
            </button>

            {[
              { id: 'acis', label: 'ACIS', icon: <ShieldAlert size={18}/> },
              { id: 'cashless', label: 'VISITAS POCS', icon: <CreditCard size={18}/> },
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
            
            {/* BACK BUTTON - Styled like Image 3 */}
            <button 
              onClick={() => setShowEntryMenu(true)}
              className="flex items-center gap-3 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition-all group border border-slate-200 shadow-sm"
            >
              <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-[11px] font-black uppercase tracking-widest">Menú Principal</span>
            </button>

            <div className="bg-slate-50 border rounded-xl px-4 py-2 flex items-center gap-3 w-full max-w-md shadow-inner ml-2">
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
            <SafetyModule onBack={() => setShowEntryMenu(true)} vehicles={vehicles} isView={true} searchTerm={searchTerm} />
          )}
          {activeView === 'cashless' && (
            <VisitasPOCSModule onBack={() => setShowEntryMenu(true)} searchTerm={searchTerm} />
          )}
          {activeView === 'people-placeholder' && (
            <div className="fixed inset-0 bg-[#0f172a] z-[60] flex items-center justify-center p-6">
              <div className="max-w-md w-full flex flex-col items-center space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="w-32 h-32 bg-emerald-500/10 rounded-full flex items-center justify-center border-4 border-emerald-500/20 relative">
                  <div className="absolute inset-0 rounded-full animate-ping bg-emerald-500/5"></div>
                  <Users size={64} className="text-emerald-500" />
                </div>
                <div className="text-center space-y-3">
                  <h2 className="text-4xl font-black text-white uppercase tracking-tight">People</h2>
                  <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">Próximamente Disponible</p>
                </div>
                <button 
                  onClick={() => {
                    setShowEntryMenu(true);
                    setActiveView('acis');
                  }}
                  className="flex items-center gap-3 px-10 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all shadow-xl border border-white/5 active:scale-95"
                >
                  <ChevronLeft size={18} />
                  Volver al Menú
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      {viewDoc && <DocumentViewer url={viewDoc.url} title={viewDoc.title} onClose={() => setViewDoc(null)} />}
    </div>
  );
};

export default App;
