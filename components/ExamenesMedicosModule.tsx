import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Calendar, 
  User, 
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  Heart,
  ClipboardList,
  Microscope,
  Syringe,
  Activity,
  Pill,
  ChevronDown,
  Ambulance,
  FlaskConical,
  UserRoundCheck,
  BriefcaseMedical,
  Droplets,
  Plus,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';
import { MedicalRecord } from '../types';
import { fetchMedicalExamsFromSheet } from '../services/sheetService';

const CHART_COLORS = ['#0e7490', '#f97316', '#15803d', '#0891b2', '#7c3aed', '#db2777', '#ca8a04', '#475569'];

const SectionBanner: React.FC<{ title: string }> = ({ title }) => (
  <div className="relative w-full h-16 flex items-center mb-10">
    <div className="absolute inset-0 bg-[#0e5d7a] flex items-center justify-center px-16 shadow-lg">
      <h2 className="text-white font-black text-xl uppercase tracking-[0.2em] text-center">{title}</h2>
    </div>
    <div className="absolute right-[-20px] top-0 bottom-0 w-12 bg-[#0e5d7a] clip-path-arrow" style={{ clipPath: 'polygon(0% 0%, 100% 50%, 0% 100%)' }} />
    <div className="absolute left-[-20px] top-0 bottom-0 w-12 bg-[#0e5d7a] clip-path-arrow-left" style={{ clipPath: 'polygon(100% 0%, 0% 50%, 100% 100%)' }} />
    
    <div className="absolute right-[-60px] top-0 bottom-0 w-10 bg-[#0e5d7a] opacity-80" style={{ clipPath: 'polygon(0% 0%, 100% 50%, 0% 100%)' }} />
  </div>
);

const CustomBarChart = ({ data, title, horizontal = false }: { data: any[], title: string, horizontal?: boolean }) => (
  <div className={`bg-white p-6 rounded-3xl border border-slate-200 shadow-xl ${horizontal ? 'h-[500px]' : 'h-[400px]'} flex flex-col`}>
    <h3 className="text-center font-black text-slate-800 uppercase tracking-widest text-[10px] mb-6">{title}</h3>
    <div className="flex-grow">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={data} 
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 20, right: 60, left: 40, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={!horizontal} horizontal={horizontal} stroke="#e2e8f0" />
          {horizontal ? (
            <>
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={120}
                tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }}
              />
            </>
          ) : (
            <>
              <XAxis 
                dataKey="name" 
                angle={-25} 
                textAnchor="end" 
                interval={0} 
                tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700 }} 
              />
              <YAxis tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
            </>
          )}
          <Tooltip 
            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 800 }}
            cursor={{ fill: '#f8fafc' }}
          />
          <Bar dataKey="value" radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
            <LabelList dataKey="value" position={horizontal ? "right" : "top"} style={{ fill: '#1e293b', fontSize: 10, fontWeight: 900 }} />
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const ExamenesMedicosModule: React.FC<{ searchTerm: string }> = ({ searchTerm: externalSearchTerm }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'dashboard'>('home');
  const [records, setRecords] = useState<MedicalRecord[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchMedicalExamsFromSheet();
      setRecords(data);
    } catch (error) {
      console.error("Error loading medical exams:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getAggregatedData = (field: keyof MedicalRecord) => {
    const counts: Record<string, number> = {};
    records.forEach(r => {
      const val = (r[field] as string)?.trim() || '(EN BLANCO)';
      counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const filteredRecords = records.filter(record => {
    const search = (externalSearchTerm || searchTerm).toLowerCase();
    return (
      record.name.toLowerCase().includes(search) ||
      record.month.toLowerCase().includes(search) ||
      record.rawStatus.toLowerCase().includes(search)
    );
  });

  const getStatusStyle = (status: MedicalRecord['status']) => {
    switch (status) {
      case 'VIGENTE': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'POR VENCER': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'VENCIDO': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
    }
  };

  const handleExportToExcel = () => {
    const dataToExport = filteredRecords.map(record => ({
      'Nombre empleado': record.name,
      'Fecha de Ingreso': record.joiningDate,
      'Mes': record.month,
      'Fecha de éxamen realizado': record.lastExamDate,
      'Fecha de vencimiento': record.expiryDate,
      'Dias disponible': record.daysRemaining,
      'status': record.rawStatus
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Exámenes Médicos');
    XLSX.writeFile(workbook, `Examenes_Medicos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <AnimatePresence mode="wait">
        {activeTab === 'home' ? (
          <motion.div 
            key="home-view"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden bg-[#0a1121] rounded-[4rem] border border-white/10 shadow-3xl shadow-black/80"
          >
            {/* Top Branding Bar */}
            <div className="bg-gradient-to-r from-blue-900/40 via-blue-800/20 to-transparent p-6 md:p-10 flex items-center justify-between relative z-10">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 group">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full border-2 border-white/40 flex items-center justify-center">
                      <User size={18} className="text-white" />
                    </div>
                    <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-rose-600 rounded-full border-2 border-[#0a1121]" />
                    <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-rose-600 rounded-full border-2 border-[#0a1121]" />
                  </div>
                  <span className="text-white font-serif font-black text-2xl tracking-tighter uppercase">DPO <span className="text-slate-300">2.0</span></span>
                </div>
                <div className="h-10 w-px bg-white/10 md:block hidden" />
                <h2 className="text-white font-black text-2xl md:text-3xl uppercase tracking-[0.2em] leading-none md:block hidden">
                  Gerenciador de <span className="text-blue-500">Exámenes</span> Médicos
                </h2>
                <div className="flex items-center gap-4 ml-8 bg-black/20 p-1.5 rounded-2xl border border-white/5 backdrop-blur-sm">
                  <button 
                    onClick={() => setActiveTab('home')}
                    className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                      activeTab === 'home' 
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Incio
                  </button>
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                      activeTab === 'dashboard' 
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Dashboard
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-5 bg-black/40 backdrop-blur-xl px-10 py-5 rounded-3xl border border-white/10 shadow-2xl group transition-all hover:bg-black/60">
                <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10,40 C10,15 90,15 90,40 C90,34 75,26 50,26 C25,26 10,34 10,40 Z" />
                    <path d="M10,60 C10,85 90,85 90,60 C90,66 75,74 50,74 C25,74 10,66 10,60 Z" />
                    <g transform="translate(50, 50)">
                      <circle cx="0" cy="-10" r="6" />
                      <circle cx="-10" cy="8" r="6" />
                      <circle cx="10" cy="8" r="6" />
                      <path d="M-12,0 C-12,-8 12,-8 12,0" fill="none" stroke="white" strokeWidth="2" opacity="0.3" />
                    </g>
                  </svg>
                </div>
                <div className="flex flex-col leading-none">
                  <div className="flex items-baseline">
                    <span className="text-white font-black text-3xl uppercase tracking-tighter">SAFE</span>
                  </div>
                  <span className="text-slate-400 font-bold text-[10px] tracking-[0.4em] uppercase mt-2 opacity-80">TOGETHER</span>
                </div>
              </div>
            </div>

            {/* Central Illustration Area */}
            <div className="px-6 py-20 md:py-32 flex flex-col items-center justify-center text-center relative">
              {/* Background Auras */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

              {/* Floating Icons Circle */}
              <div className="relative w-80 h-80 md:w-[550px] md:h-[550px] flex items-center justify-center">
                {/* The Circular Orbit Ring (Light Blue) */}
                <div className="absolute inset-0 border-[3px] border-dashed border-blue-200/50 rounded-full" />

                {/* Centered Doctor Graphic - Reverted per user request */}
                <div className="relative w-64 h-64 md:w-80 md:h-80 bg-[#3a92d0] rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col items-center justify-end overflow-hidden z-10 border-[10px] border-white ring-4 ring-blue-400/20">
                  <div className="absolute inset-0 bg-gradient-to-t from-blue-900/10 to-transparent" />
                  
                  <div className="flex flex-col items-center translate-y-10 md:translate-y-12 relative px-4 text-white">
                    <motion.div
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                      className="relative flex flex-col items-center"
                    >
                      {/* Professional Doctor Illustration */}
                      <div className="w-22 h-26 md:w-28 md:h-32 bg-[#fcd5b5] rounded-b-[40%] rounded-t-[50%] relative z-20 shadow-md">
                        <div className="absolute top-[45%] -left-2 w-4 h-6 bg-[#fcd5b5] rounded-full" />
                        <div className="absolute top-[45%] -right-2 w-4 h-6 bg-[#fcd5b5] rounded-full" />
                      </div>
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-28 md:w-34 h-16 bg-[#3d2b1f] rounded-t-[3.5rem] z-30 shadow-sm" />
                      <div className="w-56 h-56 md:w-72 md:h-72 bg-white rounded-t-[6rem] relative z-10 shadow-2xl flex flex-col items-center">
                        <div className="absolute top-0 w-12 md:w-16 h-8 bg-blue-100 rounded-b-xl" />
                        <div className="absolute top-0 w-5 md:w-6 h-14 bg-blue-700 rounded-b-lg shadow-sm" />
                        <div className="absolute top-0 w-36 md:w-44 h-28 border-b-[6px] border-x-[6px] border-slate-700 rounded-b-[4.5rem] opacity-90 z-20">
                           <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-6 h-6 bg-slate-200 border-2 border-slate-700 rounded-full" />
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>

                {/* Orbiting Icons - 10 Icons exactly as the image (High Detail) */}
                {[
                  { icon: Heart, color: 'rose', angle: 0, label: 'Heart' },          // 12 o'clock
                  { icon: Microscope, color: 'blue', angle: 36, label: 'Test Tube' }, // 1:30
                  { icon: FlaskConical, color: 'rose', angle: 72, label: 'Flask' },   // 3 o'clock
                  { icon: User, color: 'emerald', angle: 108, label: 'Nurse' },      // 4:30
                  { icon: Activity, color: 'blue', angle: 144, label: 'Patient' },    // 6 o'clock
                  { icon: BriefcaseMedical, color: 'rose', angle: 180, label: 'Kit' },// 7:30
                  { icon: Syringe, color: 'rose', angle: 216, label: 'Syringe' },    // 9 o'clock
                  { icon: Droplets, color: 'rose', angle: 252, label: 'Blood' },     // 10:30
                  { icon: Pill, color: 'amber', angle: 288, label: 'Pills' },        // 11:30
                  { icon: Ambulance, color: 'rose', angle: 324, label: 'Ambulance' }, // 11 o'clock
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    className="absolute z-20"
                    initial={{ scale: 0 }}
                    animate={{ 
                      scale: 1,
                      x: Math.cos(((item.angle - 90) * Math.PI) / 180) * (window.innerWidth > 768 ? 260 : 160),
                      y: Math.sin(((item.angle - 90) * Math.PI) / 180) * (window.innerWidth > 768 ? 260 : 160),
                    }}
                    transition={{ duration: 1, delay: idx * 0.08, type: "spring", damping: 12 }}
                  >
                    <div className="relative group">
                      <div className="w-14 h-14 md:w-20 md:h-20 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-full border-2 border-blue-50 flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-110">
                         {/* Light Blue background inner circle */}
                         <div className="absolute inset-1.5 rounded-full bg-blue-50/70" />
                         {/* The Icon */}
                         <span className={`relative z-10 text-${item.color}-500`}>
                           {React.createElement(item.icon, { size: window.innerWidth > 768 ? 32 : 24, strokeWidth: 2.5 })}
                         </span>
                      </div>
                      {/* Nurse icon specific cross detail if needed */}
                      {item.label === 'Nurse' && (
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-3 bg-white border border-slate-100 rounded-t-full shadow-sm flex items-center justify-center">
                           <div className="w-3 h-0.5 bg-rose-500 rounded-full" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="mt-20 md:mt-32 relative z-30"
              >
                <h1 className="md:hidden text-white font-black text-3xl uppercase tracking-widest mb-4">
                  Gerenciador de <span className="text-blue-500">Exámenes</span> Médicos
                </h1>
              </motion.div>
            </div>

            {/* Bottom Slogan Banner */}
            <div className="bg-[#0f172a] border-t border-white/10 p-8 flex flex-col items-center justify-center relative z-10">
              <div className="bg-blue-600/10 border border-blue-500/30 px-8 py-4 rounded-2xl backdrop-blur-md">
                <p className="text-white text-xs md:text-sm font-black uppercase tracking-[0.4em] text-center leading-relaxed">
                  Nuestro compromiso es tu bienestar <span className="text-blue-400 mx-2">|</span> CD ARENOSA
                </p>
              </div>
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="mt-6 text-blue-500"
              >
                <ChevronDown size={24} />
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="dashboard-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="space-y-12 bg-slate-100/80 -mx-6 md:-mx-12 lg:-mx-20 -my-20 p-6 md:p-12 lg:p-20 min-h-screen relative overflow-hidden"
          >
            {/* Background decorative elements for better "adaptation" */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10 w-full max-w-[1600px] mx-auto space-y-12">
            {/* PERSISTENT NAVIGATION FOR DASHBOARD VIEW */}
            <div className="flex items-center justify-between bg-slate-900/5 backdrop-blur-sm p-6 rounded-[2.5rem] border border-slate-200/60 shadow-sm mb-8">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4 bg-slate-900 px-6 py-3 rounded-2xl border border-slate-800 group shadow-lg">
                  <span className="text-white font-serif font-black text-2xl tracking-tighter uppercase">DPO <span className="text-slate-400">2.0</span></span>
                </div>
                <div className="h-10 w-px bg-slate-200 md:block hidden" />
                <div className="flex items-center gap-4 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                  <button 
                    onClick={() => setActiveTab('home')}
                    className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                      activeTab === 'home' 
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Incio
                  </button>
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                      activeTab === 'dashboard' 
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Dashboard
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-5 bg-white px-8 py-4 rounded-3xl border border-slate-200 shadow-sm transition-all hover:border-blue-400/30">
                <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full fill-blue-600" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10,40 C10,15 90,15 90,40 C90,34 75,26 50,26 C25,26 10,34 10,40 Z" />
                    <path d="M10,60 C10,85 90,85 90,60 C90,66 75,74 50,74 C25,74 10,66 10,60 Z" />
                    <g transform="translate(50, 50)">
                      <circle cx="0" cy="-10" r="6" />
                      <circle cx="-10" cy="8" r="6" />
                      <circle cx="10" cy="8" r="6" />
                    </g>
                  </svg>
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-slate-900 font-black text-xl uppercase tracking-tighter">SAFE</span>
                  <span className="text-slate-400 font-bold text-[8px] tracking-[0.3em] uppercase mt-1">TOGETHER</span>
                </div>
              </div>
            </div>

            {/* HEADER CONTROLS */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/50">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center text-emerald-600 shadow-inner">
                  <Stethoscope size={36} />
                </div>
                <div>
                  <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Exámenes Médicos</h1>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    Control de Salud Operacional
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 flex-grow max-w-2xl px-8">
                <div className="relative flex-grow">
                  <Search size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Buscar por nombre, ID o contratista..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 pl-16 pr-8 py-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-inner"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={handleExportToExcel}
                  className="flex items-center gap-3 px-6 py-4 bg-slate-50 hover:bg-slate-100 rounded-2xl text-slate-600 transition-all font-black uppercase tracking-widest text-[10px] border border-slate-200 shadow-sm active:scale-95"
                >
                  <Download size={16} /> Exportar Reporte
                </button>
                <button 
                  onClick={loadData}
                  disabled={isLoading}
                  className="flex items-center gap-3 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl transition-all font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/30 active:scale-95 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} 
                  Sincronizar Datos
                </button>
              </div>
            </div>

            {/* STATS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { 
                  label: 'Vigentes', 
                  value: records.filter(r => r.status === 'VIGENTE').length.toString(), 
                  icon: CheckCircle2, 
                  color: 'emerald' 
                },
                { 
                  label: 'Prox. Vencimiento', 
                  value: records.filter(r => r.status === 'POR VENCER').length.toString(), 
                  icon: Clock, 
                  color: 'amber' 
                },
                { 
                  label: 'Vencidos', 
                  value: records.filter(r => r.status === 'VENCIDO').length.toString(), 
                  icon: AlertTriangle, 
                  color: 'rose' 
                }
              ].map(stat => (
                <div key={stat.label} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-lg shadow-slate-100 flex items-center gap-6 hover:translate-y-[-4px] transition-all duration-300">
                  <div className={`w-16 h-16 bg-${stat.color}-500/10 rounded-3xl flex items-center justify-center text-${stat.color}-600`}>
                    <stat.icon size={32} />
                  </div>
                  <div>
                    <div className="text-3xl font-black text-slate-900">{stat.value}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* CHARTS CONTAINER */}
            <div className="px-10 mt-12 space-y-16">
              {/* Row 1: Main Overviews */}
              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <CustomBarChart 
                    data={getAggregatedData('month')} 
                    title="EXAMENES POR MES" 
                  />
                  <CustomBarChart 
                    data={getAggregatedData('position')} 
                    title="DISTRIBUCIÓN SEGÚN EL CARGO" 
                    horizontal
                  />
                </div>
              </div>

              {/* SECTION BREAK: INFORMACIÓN DE LOS EXAMENES */}
              <div className="pt-8">
                <SectionBanner title="INFORMACIÓN DE LOS EXAMENES" />
                <div className="bg-slate-100/30 p-12 rounded-[4rem] border border-slate-200/40 shadow-inner mt-4">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    <div className="lg:col-span-5">
                      <CustomBarChart 
                        data={getAggregatedData('area')} 
                        title="EXAMEN SEGUN EL AREA" 
                      />
                    </div>
                    <div className="lg:col-span-5">
                      <CustomBarChart 
                        data={getAggregatedData('examType')} 
                        title="TIPO DE EXAMEN" 
                      />
                    </div>
                    {/* Mascot placed next to "TIPO DE EXAMEN" */}
                    <div className="lg:col-span-2 flex flex-col items-center justify-end h-full">
                      <div className="relative group w-full flex flex-col items-center">
                        <img 
                          src="https://lh3.googleusercontent.com/d/1-8itPFDkhxsnY_ah-c-sj6-WavvC49Cv=w1001" 
                          alt="Mascota Logísticos" 
                          className="w-full h-auto object-contain hover:scale-110 transition-transform duration-700 relative z-10"
                          referrerPolicy="no-referrer"
                        />
                        <div className="mt-2 text-center opacity-40 group-hover:opacity-100 transition-opacity">
                          <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Safe Agent</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RECOMENDACIONES DE LOS EXAMENES SECTION */}
            <div className="px-10 mb-12 bg-slate-100/30 py-12 rounded-[3.5rem] border border-slate-200/40">
              <SectionBanner title="RECOMENDACIONES DE LOS EXAMENES" />
              <div className="grid grid-cols-1 gap-8">
                <CustomBarChart 
                  data={getAggregatedData('weightRec')} 
                  title="RECOMENDACIONES PARA EL CONTROL DE PESO" 
                  horizontal
                />
                <CustomBarChart 
                  data={getAggregatedData('laboralRec')} 
                  title="RECOMENDACIONES LABORALES" 
                  horizontal
                />
              </div>
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-200/40 overflow-hidden">
              <div className="p-8 border-b bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Listado de Personal</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <User size={12} className="text-emerald-500" />
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Seguimiento de Aptitud Médica</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-6 py-2 bg-white rounded-full border border-slate-200 shadow-sm">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                    {filteredRecords.length} Colaboradores
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                      <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Nombre empleado (0)</th>
                      <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Fecha de Ingreso (1)</th>
                      <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Mes (2)</th>
                      <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Fecha de éxamen realizado (3)</th>
                      <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Fecha de vencimiento (4)</th>
                      <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Dias disponible (5)</th>
                      <th className="px-10 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">status (6)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs">
                    {filteredRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50/80 transition-all group">
                        <td className="px-10 py-8">
                          <div className="font-black text-slate-800 uppercase text-sm group-hover:text-emerald-600 transition-colors">{record.name}</div>
                        </td>
                        <td className="px-10 py-8 text-slate-600 font-bold tracking-tight"> {record.joiningDate} </td>
                        <td className="px-10 py-8">
                          <span className="text-[10px] bg-slate-100 text-slate-500 font-black px-3 py-1.5 rounded-lg uppercase tracking-wider border border-slate-200 shadow-sm">{record.month}</span>
                        </td>
                        <td className="px-10 py-8">
                          <div className="flex items-center gap-3 text-slate-600 font-semibold bg-slate-50 w-fit px-4 py-2 rounded-xl border border-slate-100">
                            <Calendar size={14} className="text-slate-400" />
                            {record.lastExamDate}
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <div className="flex items-center gap-3 text-slate-900 font-black bg-emerald-500/5 w-fit px-4 py-2 rounded-xl border border-emerald-500/10">
                            <FileText size={14} className="text-emerald-500" />
                            {record.expiryDate}
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <div className="text-slate-400 font-bold italic bg-slate-50/50 p-3 rounded-xl border border-dashed border-slate-200 text-[10px] leading-relaxed max-w-[220px]">
                            {record.daysRemaining}
                          </div>
                        </td>
                        <td className="px-10 py-8 flex justify-center">
                          <div className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border w-fit shadow-sm text-slate-900 font-black bg-white`}>
                            {record.rawStatus}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExamenesMedicosModule;
