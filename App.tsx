import React, { useState, useEffect } from 'react';
import { Vehicle } from './types';
import DocumentViewer from './components/DocumentViewer';
import ACISModule from './components/ACISModule';
import VisitasPOCSModule from './components/CashlessModule';
import PeopleModule from './components/PeopleModule';
import ExamenesMedicosModule from './components/ExamenesMedicosModule';

import { 
  fetchVehiclesFromSheet
} from './services/sheetService';

import { 
  RefreshCw, Loader2, Search, ShieldAlert, CreditCard, Home, ChevronLeft, Stethoscope, ChevronRight
} from 'lucide-react';

type ActiveView = 'acis' | 'cashless' | 'people-placeholder' | 'examenes-medicos';

const App: React.FC = () => {
  const [showEntryMenu, setShowEntryMenu] = useState(true);
  const [safetySubMenu, setSafetySubMenu] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>('acis');
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
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 w-full overflow-x-hidden relative">
        {/* Animated Background Orbs */}
        <div className="absolute top-0 -left-40 w-96 h-96 bg-rose-500/10 rounded-full blur-[100px] animate-pulse pointer-events-none" />
        <div className="absolute bottom-0 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />

        <div className="max-w-4xl w-full space-y-12 relative z-10">
          <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-700">
            <div className="w-20 h-20 bg-rose-600 rounded-[2rem] flex items-center justify-center text-white font-black text-3xl shadow-2xl shadow-rose-500/40 border-4 border-white/10 group hover:rotate-12 transition-transform cursor-pointer">
              BQA
            </div>
            <div className="text-center">
              <h1 className="text-white text-4xl md:text-5xl font-black uppercase tracking-tighter">SISTEMA DE <span className="text-rose-500">GESTIÓN</span></h1>
              <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-[0.4em] mt-3 opacity-60">Gestión y Control Operativo Avanzado</p>
            </div>
          </div>

          {!safetySubMenu ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-both">
              {/* SAFETY BUTTON */}
              <button 
                onClick={() => setSafetySubMenu(true)}
                className="group relative bg-[#0a1121] hover:bg-white/[0.03] border-2 border-rose-500/60 p-10 rounded-[3.5rem] transition-all flex flex-col items-start gap-8 text-left active:scale-[0.98] shadow-3xl shadow-black/80 overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-rose-500/15 rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-1000"></div>
                <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-[1.8rem] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-2xl relative z-10">
                  <ShieldAlert size={40} className="text-rose-500" />
                </div>
                <div className="relative z-10">
                  <div className="text-3xl font-black text-white uppercase tracking-tight leading-none mb-4">Safety</div>
                  <div className="text-sm font-medium text-slate-400 leading-relaxed max-w-[280px]">Gestión integral de seguridad industrial, reportes ACIS y control de riesgos del personal.</div>
                </div>
                <div className="mt-4 text-[11px] font-black uppercase tracking-[0.3em] text-rose-500 flex items-center gap-3 group-hover:translate-x-3 transition-transform relative z-10 bg-rose-500/10 px-6 py-2 rounded-full border border-rose-500/20">
                  Ingresar Ahora <ChevronRight size={14} />
                </div>
              </button>

              {/* PEOPLE BUTTON */}
              <button 
                onClick={() => {
                  setShowEntryMenu(false);
                  setActiveView('people-placeholder');
                }}
                className="group relative bg-[#0a1121] hover:bg-white/[0.03] border-2 border-blue-500/60 p-10 rounded-[3.5rem] transition-all flex flex-col items-start gap-8 text-left active:scale-[0.98] shadow-3xl shadow-black/80 overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/15 rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-1000"></div>
                <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-[1.8rem] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-2xl overflow-hidden p-4 relative z-10">
                  <img 
                    src="https://lh3.googleusercontent.com/d/1RpVUh4KZ0s0tBpPynwFuwjiVqT0ddSDM" 
                    alt="People Logo" 
                    className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                  />
                </div>
                <div className="relative z-10">
                  <div className="text-3xl font-black text-white uppercase tracking-tight leading-none mb-4">People</div>
                  <div className="text-sm font-medium text-slate-400 leading-relaxed max-w-[280px]">Gestión humana, plan de mentoría y bienestar de los colaboradores de la organización.</div>
                </div>
                <div className="mt-4 text-[11px] font-black uppercase tracking-[0.3em] text-blue-500 flex items-center gap-3 group-hover:translate-x-3 transition-transform relative z-10 bg-blue-500/10 px-6 py-2 rounded-full border border-blue-500/20">
                  Ingresar Ahora <ChevronRight size={14} />
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setSafetySubMenu(false)}
                  className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-white transition-all border border-white/10 shadow-xl group"
                >
                  <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                </button>
                <div className="flex flex-col">
                  <h2 className="text-3xl font-black text-white uppercase tracking-tight">Módulos Safety</h2>
                  <p className="text-rose-500 text-[11px] font-black uppercase tracking-[0.3em] mt-1 opacity-80">Seleccione una especialidad</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { 
                    id: 'acis', 
                    label: 'ACIS', 
                    description: 'Reporte y gestión de actos e inseguras detectadas.',
                    icon: <ShieldAlert />, 
                    color: 'rose' 
                  },
                  { 
                    id: 'cashless', 
                    label: 'VISITAS POCS', 
                    description: 'Seguimiento y auditoría de visitas estratégicas.',
                    icon: <CreditCard />, 
                    color: 'blue' 
                  },
                  { 
                    id: 'examenes-medicos', 
                    label: 'EXÁMENES MÉDICOS', 
                    description: 'Control de aptitud médica y seguimiento de vigencias.',
                    icon: <Stethoscope />, 
                    color: 'emerald' 
                  },
                ].map(item => (
                  <button 
                    key={item.id}
                    onClick={() => {
                      setActiveView(item.id as ActiveView);
                      setShowEntryMenu(false);
                      setSafetySubMenu(false);
                    }}
                    className={`group relative bg-[#0a1121] hover:bg-white/[0.03] border-2 border-${item.color}-500/40 p-10 rounded-[3rem] transition-all flex flex-col items-start gap-6 text-left active:scale-[0.98] shadow-3xl shadow-black/80 overflow-hidden h-full`}
                  >
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-${item.color}-500/15 rounded-full blur-2xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000`}></div>
                    <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-2xl relative z-10">
                      {React.cloneElement(item.icon as React.ReactElement, { className: `text-${item.color}-500`, size: 32 })}
                    </div>
                    <div className="relative z-10">
                      <div className="text-xl font-black text-white uppercase tracking-tight mb-3 leading-none">{item.label}</div>
                      <div className="text-xs font-medium text-slate-400 leading-relaxed text-pretty">{item.description}</div>
                    </div>
                    <div className={`mt-auto text-[10px] font-black uppercase tracking-[0.3em] text-${item.color}-500 flex items-center gap-2 group-hover:translate-x-2 transition-transform relative z-10 pt-4`}>
                      Explorar <ChevronRight size={12} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const isPeopleView = activeView === 'people-placeholder';

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col w-full">
      {isSyncing && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center"><Loader2 size={48} className="text-white animate-spin" /></div>}
      
      <main className="flex-grow flex flex-col h-screen overflow-hidden">
        {/* HEADER */}
        {!isPeopleView && (
          <header className="bg-white border-b p-4 flex justify-between items-center shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-4 flex-grow px-4">
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

            <div className="flex items-center gap-4 px-4">
              <button 
                onClick={handleSyncData} 
                className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all border border-rose-100 shadow-sm"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} /> Sincronizar
              </button>
            </div>
          </header>
        )}

        {/* CONTENT AREA */}
        <div className={`flex-grow overflow-y-auto bg-[#f8fafc] custom-scrollbar ${isPeopleView ? 'p-0' : 'p-6 md:p-12 lg:p-20'}`}>
          {activeView === 'acis' && (
            <ACISModule onBack={() => setShowEntryMenu(true)} vehicles={vehicles} searchTerm={searchTerm} />
          )}
          {activeView === 'cashless' && (
            <VisitasPOCSModule onBack={() => setShowEntryMenu(true)} searchTerm={searchTerm} />
          )}
          {activeView === 'examenes-medicos' && (
            <ExamenesMedicosModule searchTerm={searchTerm} />
          )}
          {activeView === 'people-placeholder' && (
            <PeopleModule onBack={() => {
              setShowEntryMenu(true);
              setActiveView('acis');
            }} />
          )}
        </div>
      </main>
      {viewDoc && <DocumentViewer url={viewDoc.url} title={viewDoc.title} onClose={() => setViewDoc(null)} />}
    </div>
  );
};

export default App;
