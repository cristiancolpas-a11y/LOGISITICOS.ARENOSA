import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  ChevronLeft, 
  RefreshCw, 
  Plus, 
  Search, 
  Filter, 
  Download,
  ShieldAlert, 
  User, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight,
  ChevronDown,
  Activity,
  ClipboardList,
  Eye,
  FileSearch,
  Zap,
  HardHat,
  Construction
} from 'lucide-react';
import { motion } from 'motion/react';
import { SafetyRecord, Vehicle, StaffMember } from '../types';
import { fetchSafetyReportsFromSheet, fetchStaffFromSheet } from '../services/sheetService';
import { SafetyForm } from './SafetyForm';

interface ACISModuleProps {
  onBack: () => void;
  vehicles: Vehicle[];
  searchTerm: string;
}

const MONTHS: (keyof StaffMember['goals'])[] = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const ACISModule: React.FC<ACISModuleProps> = ({ onBack, vehicles, searchTerm: externalSearchTerm }) => {
  const [records, setRecords] = useState<SafetyRecord[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'records' | 'compliance'>('records');
  const [selectedMonth, setSelectedMonth] = useState<keyof StaffMember['goals']>(MONTHS[new Date().getMonth()]);
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [viewMode, setViewMode] = useState<'detail' | 'summary'>('summary');
  const [complianceSortField, setComplianceSortField] = useState<string>('percentage');
  const [complianceSortDirection, setComplianceSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedComplianceArea, setSelectedComplianceArea] = useState<string>('TODOS');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [recordsData, staffData] = await Promise.all([
        fetchSafetyReportsFromSheet(),
        fetchStaffFromSheet()
      ]);
      setRecords(recordsData);
      setStaff(staffData);
    } catch (error) {
      console.error('Error loading ACIS data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getMonthFromDate = (dateStr: string): keyof StaffMember['goals'] | null => {
    if (!dateStr) return null;
    const cleanDate = dateStr.trim().toUpperCase();
    for (const month of MONTHS) {
      if (cleanDate.includes(month)) return month;
    }
    const date = new Date(cleanDate);
    if (!isNaN(date.getTime())) return MONTHS[date.getMonth()];
    return null;
  };

  const getDayFromDate = (dateStr: string): number | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date.getDate();
    return null;
  };

  const filteredRecords = records.filter(record => {
    const contractorLower = String(record.contractor || '').toLowerCase();
    const hcNameLower = String(record.hcName || '').toLowerCase();
    if (contractorLower.includes('no es logisticos') || hcNameLower.includes('no es logistico')) return false;
    
    const recordMonth = getMonthFromDate(record.dateRaised);
    if (recordMonth !== selectedMonth) return false;

    if (selectedDay !== null) {
      const recordDay = getDayFromDate(record.dateRaised);
      if (recordDay !== selectedDay) return false;
    }
    
    if (externalSearchTerm) {
      const searchLower = externalSearchTerm.toLowerCase();
      return (
        record.location.toLowerCase().includes(searchLower) ||
        record.reportedBy.toLowerCase().includes(searchLower) ||
        record.hcName.toLowerCase().includes(searchLower) ||
        record.area.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const handleExportToExcel = () => {
    const dataToExport = filteredRecords.map(record => ({
      'FECHA': record.dateRaised,
      'AREA': record.area,
      'UBICACIÓN': record.location,
      'REPORTADO POR': record.reportedBy,
      'HC NAME': record.hcName,
      'CONTRATISTA': record.contractor,
      'DESCRIPCIÓN': record.description,
      'TIPO': record.type,
      'ESTADO': record.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reportes ACIS');
    XLSX.writeFile(workbook, `Reportes_ACIS_${selectedMonth}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const complianceData = staff.map(member => {
    const memberRecords = records.filter(r => {
      const contractorLower = String(r.contractor || '').toLowerCase();
      if (contractorLower.includes('no es logisticos')) return false;
      const recordMonth = getMonthFromDate(r.dateRaised);
      const matchesIdentity = (r.reporterQR && r.reporterQR === member.qr) || (r.reportedBy && r.reportedBy.toLowerCase().includes(member.nombre.toLowerCase()));
      return matchesIdentity && recordMonth === selectedMonth;
    });

    const totalQRs = memberRecords.length;
    const goal = (member.goals as any)[selectedMonth] || 0;
    const percentage = goal > 0 ? (totalQRs / goal) * 100 : 0;

    return { ...member, totalQRs, goal, percentage };
  }).filter(m => selectedComplianceArea === 'TODOS' || m.area === selectedComplianceArea);

  const stats = {
    totalMeta: staff.filter(m => String(m.qr || '').trim() !== '').length,
    realizados: filteredRecords.length,
    compliance: activeTab === 'compliance' 
      ? complianceData.reduce((acc, m) => acc + m.percentage, 0) / (complianceData.length || 1)
      : (filteredRecords.length / (staff.filter(m => m.qr).length || 1)) * 100
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* HEADER CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/50">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-rose-500/10 rounded-[2rem] flex items-center justify-center text-rose-600 shadow-inner">
            <ShieldAlert size={36} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Módulo ACIS</h1>
            <div className="flex gap-4 mt-2">
              <button 
                onClick={() => setActiveTab('records')}
                className={`text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'records' ? 'text-rose-600 border-b-2 border-rose-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Registros Diarios
              </button>
              <button 
                onClick={() => setActiveTab('compliance')}
                className={`text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'compliance' ? 'text-rose-600 border-b-2 border-rose-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Tablero Cumplimiento
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl">
            {['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEP', 'OCT', 'NOV', 'DIC'].map((m, i) => (
              <button
                key={m}
                onClick={() => {
                  const fullMonth = MONTHS[i];
                  setSelectedMonth(fullMonth);
                  setSelectedDay(null);
                }}
                className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${
                  selectedMonth === MONTHS[i] ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {m.substring(0, 3)}
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => setIsFormOpen(true)}
            className="flex items-center gap-3 px-8 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-[1.5rem] transition-all font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-500/30 active:scale-95"
          >
            <Plus size={16} /> Nuevo Reporte
          </button>

          <button 
            onClick={handleExportToExcel}
            className="flex items-center gap-3 px-8 py-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-[1.5rem] transition-all font-black uppercase tracking-widest text-[10px] shadow-lg shadow-slate-200/50 active:scale-95"
          >
            <Download size={16} /> Exportar Excel
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: 'Meta Mensual', value: stats.totalMeta, icon: ClipboardList, color: 'slate' },
          { label: 'Reportes Realizados', value: stats.realizados, icon: Activity, color: 'emerald' },
          { label: '% Adherencia', value: `${stats.compliance.toFixed(1)}%`, icon: Zap, color: 'rose' }
        ].map(stat => (
          <div key={stat.label} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40 flex items-center gap-6 hover:translate-y-[-4px] transition-all duration-300">
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

      {/* MAIN CONTENT AREA */}
      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl shadow-slate-200/40 overflow-hidden">
        {activeTab === 'records' ? (
          <div className="flex flex-col">
             <div className="p-8 border-b bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Reportes de Seguridad</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Historial detallado para {selectedMonth}</p>
                </div>
                <div className="flex items-center gap-3">
                   <div className="px-5 py-2 bg-white rounded-full border shadow-sm text-[10px] font-black uppercase text-slate-500 tracking-widest">
                     {filteredRecords.length} Registros
                   </div>
                </div>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                      <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Ubicación</th>
                      <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Reportado Por</th>
                      <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Nombre HC</th>
                      <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Sede</th>
                      <th className="px-8 py-6 text-[11px) font-black text-slate-400 uppercase tracking-widest text-center">Validador</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecords.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-all group">
                        <td className="px-8 py-6 font-bold text-slate-600">{r.dateRaised}</td>
                        <td className="px-8 py-6 text-slate-500 uppercase font-black text-[11px]">{r.location}</td>
                        <td className="px-8 py-6 font-black text-slate-800 uppercase text-[12px]">{r.reportedBy}</td>
                        <td className="px-8 py-6 text-slate-500 italic">{r.hcName}</td>
                        <td className="px-8 py-6"><span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500">{r.area}</span></td>
                        <td className="px-8 py-6 text-center">
                           <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto border-2 ${Number(r.validator) === 1 ? 'bg-emerald-500 border-white text-white shadow-emerald-200 shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
                             {Number(r.validator) === 1 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        ) : (
          <div className="flex flex-col">
             {/* Compliance similar to records but for staff */}
             <div className="p-8 border-b bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Reporte de Adherencia</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Cumplimiento por Padrino / HC</p>
                </div>
                <div className="flex items-center gap-3">
                   <select 
                    value={selectedComplianceArea}
                    onChange={e => setSelectedComplianceArea(e.target.value)}
                    className="bg-white border rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest shadow-sm outline-none"
                   >
                     <option value="TODOS">TODAS LAS AREAS</option>
                     {Array.from(new Set(staff.map(m => m.area))).filter(Boolean).map(a => <option key={a} value={a}>{a}</option>)}
                   </select>
                </div>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
                      <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Área</th>
                      <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Meta</th>
                      <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Realizados</th>
                      <th className="px-8 py-6 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Cumplimiento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {complianceData.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition-all group">
                        <td className="px-8 py-6">
                           <div className="font-black text-slate-800 uppercase text-sm group-hover:text-rose-600 transition-colors">{m.nombre}</div>
                           <div className="text-[10px] text-slate-400 font-bold">CEDULA: {m.cedula}</div>
                        </td>
                        <td className="px-8 py-6 text-slate-500 uppercase font-black text-[11px]">{m.area}</td>
                        <td className="px-8 py-6 text-center font-bold text-slate-400">{m.goal}</td>
                        <td className="px-8 py-6 text-center font-black text-slate-900">{m.totalQRs}</td>
                        <td className="px-8 py-6 text-center">
                           <div className="flex items-center justify-center gap-3">
                              <div className="flex-grow max-w-[100px] h-2 bg-slate-100 rounded-full overflow-hidden">
                                 <div 
                                  className={`h-full transition-all duration-1000 ${m.percentage >= 100 ? 'bg-emerald-500' : m.percentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                  style={{ width: `${Math.min(m.percentage, 100)}%` }}
                                 />
                              </div>
                              <span className={`text-xs font-black ${m.percentage >= 100 ? 'text-emerald-600' : m.percentage >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                                 {m.percentage.toFixed(1)}%
                              </span>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        )}
      </div>

      <SafetyForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        onSuccess={loadData}
        vehicles={vehicles}
      />
    </div>
  );
};

export default ACISModule;
