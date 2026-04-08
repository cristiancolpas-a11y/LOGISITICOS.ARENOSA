
import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  Settings,
  Plus,
  Wrench,
  Truck,
  PenTool,
  Map,
  Search,
  Filter,
  RefreshCw,
  Image as ImageIcon,
  Cpu,
  ShieldAlert
} from 'lucide-react';
import { SafetyRecord, Vehicle, StaffMember } from '../types';
import { fetchSafetyReportsFromSheet, fetchStaffFromSheet } from '../services/sheetService';
import { SafetyForm } from './SafetyForm';

interface SafetyModuleProps {
  onBack: () => void;
  vehicles: Vehicle[];
  isView?: boolean;
  searchTerm?: string;
}

const SAFETY_AREAS = [
  { id: 'ACIS', name: 'ACIS', icon: ShieldAlert, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' }
];

const MONTHS: (keyof StaffMember['goals'])[] = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const SafetyModule: React.FC<SafetyModuleProps> = ({ onBack, vehicles, isView = false, searchTerm: externalSearchTerm = '' }) => {
  const [activeArea, setActiveArea] = useState<string | null>(SAFETY_AREAS.length === 1 ? SAFETY_AREAS[0].id : null);
  const [records, setRecords] = useState<SafetyRecord[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'records' | 'compliance'>('records');
  const [selectedMonth, setSelectedMonth] = useState<keyof StaffMember['goals']>(MONTHS[new Date().getMonth()]);
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [viewMode, setViewMode] = useState<'detail' | 'summary'>('summary');
  const [complianceSortField, setComplianceSortField] = useState<string>('percentage');
  const [complianceSortDirection, setComplianceSortDirection] = useState<'asc' | 'desc'>('desc');

  const searchTerm = externalSearchTerm || internalSearchTerm;

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
      console.error('Error loading safety data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const getMonthFromDate = (dateStr: string): keyof StaffMember['goals'] | null => {
    if (!dateStr) return null;
    
    const cleanDate = dateStr.trim().toUpperCase();
    
    // Check if the string itself contains a month name
    for (const month of MONTHS) {
      if (cleanDate.includes(month)) return month;
    }

    // Try parsing common formats (DD/MM/YYYY, YYYY-MM-DD)
    const parts = cleanDate.split(/[\/\-\s]/);
    if (parts.length >= 3) {
      let day, month, year;
      
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      } else {
        // DD/MM/YYYY
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
      }
      
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return MONTHS[date.getMonth()];
      }
    }

    // Fallback to standard parsing
    const date = new Date(cleanDate);
    if (!isNaN(date.getTime())) {
      return MONTHS[date.getMonth()];
    }

    return null;
  };

  const getDayFromDate = (dateStr: string): number | null => {
    if (!dateStr) return null;
    
    const cleanDate = dateStr.trim();
    
    // Try parsing common formats (DD/MM/YYYY, YYYY-MM-DD)
    const parts = cleanDate.split(/[\/\-\s]/);
    if (parts.length >= 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        return parseInt(parts[2], 10);
      } else {
        // DD/MM/YYYY
        return parseInt(parts[0], 10);
      }
    }

    // Fallback to standard parsing
    const date = new Date(cleanDate);
    if (!isNaN(date.getTime())) {
      return date.getDate();
    }

    return null;
  };

  const filteredRecords = records.filter(record => {
    // Exclude "no es logisticos"
    const contractorLower = String(record.contractor || '').toLowerCase();
    const hcNameLower = String(record.hcName || '').toLowerCase();
    if (contractorLower.includes('no es logisticos') || hcNameLower.includes('no es logistico')) return false;

    // Filter by selected month
    const recordMonth = getMonthFromDate(record.dateRaised);
    if (recordMonth !== selectedMonth) return false;

    // Filter by selected day
    if (selectedDay !== null) {
      const recordDay = getDayFromDate(record.dateRaised);
      if (recordDay !== selectedDay) return false;
    }
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        record.location.toLowerCase().includes(searchLower) ||
        record.reportedBy.toLowerCase().includes(searchLower) ||
        record.hcName.toLowerCase().includes(searchLower) ||
        record.area.toLowerCase().includes(searchLower) ||
        record.contractor.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  const calculateCompliance = () => {
    return staff.map(member => {
      const memberRecords = records.filter(r => {
        // Exclude "no es logisticos"
        const contractorLower = String(r.contractor || '').toLowerCase();
        const hcNameLower = String(r.hcName || '').toLowerCase();
        if (contractorLower.includes('no es logisticos') || hcNameLower.includes('no es logistico')) return false;

        // Filter by contractor (Logisticos.co only) - more lenient check
        const rContractor = String(r.contractor || '').toLowerCase().trim();
        if (rContractor !== '' && !rContractor.includes('logisticos')) return false;

        const recordMonth = getMonthFromDate(r.dateRaised);
        
        // Normalize QRs and Names for robust comparison
        const rQR = String(r.reporterQR || '').trim().toLowerCase();
        const mQR = String(member.qr || '').trim().toLowerCase();
        const rName = String(r.reportedBy || '').trim().toLowerCase();
        const mName = String(member.nombre || '').trim().toLowerCase();
        
        // Match by QR (preferred) or by Name (fallback)
        const matchesQR = rQR !== '' && mQR !== '' && rQR === mQR;
        const matchesName = rName !== '' && mName !== '' && (rName.includes(mName) || mName.includes(rName));
        
        const matchesIdentity = matchesQR || matchesName;
        const matchesMonth = recordMonth === selectedMonth;

        return matchesIdentity && matchesMonth;
      });

      const totalQRs = memberRecords.length;
      
      // Access goal using uppercase month key
      const goal = (member.goals as any)[selectedMonth] || 0;
      const percentage = goal > 0 ? (totalQRs / goal) * 100 : 0;

      // Debugging log (visible in browser console)
      if (totalQRs > 0) {
        console.log(`Match found for ${member.nombre}: ${totalQRs} records in ${selectedMonth}`);
      }

      return {
        ...member,
        totalQRs,
        goal,
        percentage
      };
    });
  };

  const complianceData = calculateCompliance()
    .filter(m => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          m.nombre.toLowerCase().includes(searchLower) ||
          m.cedula.toLowerCase().includes(searchLower) ||
          m.area.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const aValue = (a as any)[complianceSortField];
      const bValue = (b as any)[complianceSortField];
      
      if (typeof aValue === 'string') {
        return complianceSortDirection === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      
      return complianceSortDirection === 'asc' 
        ? (aValue as number) - (bValue as number) 
        : (bValue as number) - (aValue as number);
    });

  const handleComplianceSort = (field: string) => {
    if (complianceSortField === field) {
      setComplianceSortDirection(complianceSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setComplianceSortField(field);
      setComplianceSortDirection('desc');
    }
  };

  const getSemaforoColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-[#52c41a] text-white'; // Verde
    if (percentage >= 80) return 'bg-[#a0d911] text-white'; // Verde Lima
    if (percentage >= 60) return 'bg-[#fadb14] text-slate-900'; // Amarillo
    if (percentage >= 40) return 'bg-[#faad14] text-white'; // Ámbar
    if (percentage >= 20) return 'bg-[#fa8c16] text-white'; // Naranja
    if (percentage >= 10) return 'bg-[#fa541c] text-white'; // Naranja Rojizo
    return 'bg-[#f5222d] text-white'; // Rojo
  };

  const renderComplianceView = () => {
    const totalRealizados = complianceData.reduce((acc, m) => acc + m.totalQRs, 0);
    const totalMeta = complianceData.reduce((acc, m) => acc + m.goal, 0);
    const totalPendientes = Math.max(0, totalMeta - totalRealizados);
    const totalPorcentaje = totalMeta > 0 ? (totalRealizados / totalMeta) * 100 : 0;

    return (
      <div className="flex flex-col h-full space-y-6">
        {/* Compliance Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 shrink-0">
          <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Meta del Mes</span>
            <span className="text-4xl font-black text-slate-900">{totalMeta}</span>
          </div>
          <div className="bg-emerald-500 border border-emerald-600 rounded-[2rem] p-6 shadow-md flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-2">Realizados</span>
            <span className="text-4xl font-black text-white">{totalRealizados}</span>
          </div>
          <div className="bg-rose-500 border border-rose-600 rounded-[2rem] p-6 shadow-md flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-black text-rose-100 uppercase tracking-widest mb-2">Pendientes</span>
            <span className="text-4xl font-black text-white">{totalPendientes}</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">% Adherencia</span>
            <div className="flex flex-col items-center gap-2">
              <span className={`text-4xl font-black ${totalPorcentaje >= 100 ? 'text-emerald-600' : totalPorcentaje >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                {totalPorcentaje.toFixed(1)}%
              </span>
              <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${totalPorcentaje >= 100 ? 'bg-emerald-500' : totalPorcentaje >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${Math.min(totalPorcentaje, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-grow overflow-auto border border-slate-200 rounded-[2rem] bg-white shadow-sm custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
            <tr>
              <th 
                className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-rose-600 transition-colors"
                onClick={() => handleComplianceSort('nombre')}
              >
                <div className="flex items-center gap-1">
                  Nombre
                  {complianceSortField === 'nombre' && (
                    <span>{complianceSortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-rose-600 transition-colors"
                onClick={() => handleComplianceSort('cedula')}
              >
                <div className="flex items-center gap-1">
                  Cédula
                  {complianceSortField === 'cedula' && (
                    <span>{complianceSortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-rose-600 transition-colors"
                onClick={() => handleComplianceSort('area')}
              >
                <div className="flex items-center gap-1">
                  Área
                  {complianceSortField === 'area' && (
                    <span>{complianceSortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center cursor-pointer hover:text-rose-600 transition-colors"
                onClick={() => handleComplianceSort('totalQRs')}
              >
                <div className="flex items-center justify-center gap-1">
                  QR Hechos
                  {complianceSortField === 'totalQRs' && (
                    <span>{complianceSortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center cursor-pointer hover:text-rose-600 transition-colors"
                onClick={() => handleComplianceSort('goal')}
              >
                <div className="flex items-center justify-center gap-1">
                  Meta
                  {complianceSortField === 'goal' && (
                    <span>{complianceSortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center cursor-pointer hover:text-rose-600 transition-colors"
                onClick={() => handleComplianceSort('percentage')}
              >
                <div className="flex items-center justify-center gap-1">
                  Cumplimiento
                  {complianceSortField === 'percentage' && (
                    <span>{complianceSortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-20 text-center">
                  <RefreshCw className="animate-spin text-rose-500 mx-auto mb-4" size={32} />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando cumplimiento...</p>
                </td>
              </tr>
            ) : complianceData.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-20 text-center">
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No se encontraron datos de personal</p>
                </td>
              </tr>
            ) : (
              complianceData.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50 transition-colors group text-xs border-b border-slate-100">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-700 uppercase">{member.nombre}</div>
                    <div className="text-[10px] text-slate-400 italic">QR: {member.qr}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-600 font-medium">{member.cedula}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-600 font-medium uppercase">{member.area}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="font-bold text-slate-700">{member.totalQRs}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="font-bold text-slate-400">{member.goal}</div>
                  </td>
                  <td className={`px-6 py-4 text-center font-black text-sm ${getSemaforoColor(member.percentage)}`}>
                    {member.percentage.toFixed(1)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
    );
  };

  const renderSafetyView = () => {
    const area = SAFETY_AREAS.find(a => a.id === activeArea) || SAFETY_AREAS[0];
    if (!area) return null;

    // Meta is the total number of staff members with a QR code
    const relevantStaff = staff.filter(m => String(m.qr || '').trim() !== '');
    const totalMeta = relevantStaff.length;
    
    // Realizados is the total number of reports in filteredRecords
    const totalRealizados = filteredRecords.length;
    const totalPendientes = Math.max(0, totalMeta - totalRealizados);
    const totalPorcentaje = totalMeta > 0 ? (totalRealizados / totalMeta) * 100 : 0;

    interface SummaryItem {
      hcName: string;
      reportType: string;
      count: number;
      validated: number;
    }

    const summaryData = filteredRecords.reduce((acc, record) => {
      const key = `${record.hcName}-${record.reportType}`;
      if (!acc[key]) {
        acc[key] = {
          hcName: record.hcName,
          reportType: record.reportType,
          count: 0,
          validated: 0
        };
      }
      acc[key].count += 1;
      if (Number(record.validator) === 1) acc[key].validated += 1;
      return acc;
    }, {} as Record<string, SummaryItem>);

    const sortedSummary: SummaryItem[] = (Object.values(summaryData) as SummaryItem[]).sort((a, b) => b.count - a.count);

    return (
      <div className="flex flex-col h-full space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {!isView && (
              <button 
                onClick={() => setActiveArea(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
              >
                <ChevronLeft size={24} />
              </button>
            )}
            <div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                <area.icon className={area.color} size={28} />
                {area.name}
              </h2>
              <div className="flex gap-4 mt-1">
                <button 
                  onClick={() => setActiveTab('records')}
                  className={`text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === 'records' ? 'text-rose-600 border-b-2 border-rose-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Registros
                </button>
                <button 
                  onClick={() => setActiveTab('compliance')}
                  className={`text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === 'compliance' ? 'text-rose-600 border-b-2 border-rose-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Cumplimiento
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto custom-scrollbar max-w-xs md:max-w-none">
              {MONTHS.map(month => (
                <button
                  key={month}
                  onClick={() => {
                    setSelectedMonth(month);
                    setSelectedDay(null);
                  }}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shrink-0 ${
                    selectedMonth === month 
                      ? 'bg-white text-rose-600 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {month.substring(0, 3)}
                </button>
              ))}
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto custom-scrollbar max-w-xs md:max-w-none">
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shrink-0 ${
                    selectedDay === day 
                      ? 'bg-white text-rose-600 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto custom-scrollbar max-w-xs md:max-w-none">
              <button
                onClick={() => setViewMode('detail')}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shrink-0 ${
                  viewMode === 'detail' 
                    ? 'bg-white text-rose-600 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Detalle
              </button>
              <button
                onClick={() => setViewMode('summary')}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shrink-0 ${
                  viewMode === 'summary' 
                    ? 'bg-white text-rose-600 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Resumen
              </button>
            </div>
            
            {activeTab === 'records' && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setInternalSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none w-48 transition-all"
                />
              </div>
            )}
            <button 
              onClick={loadData}
              disabled={isLoading}
              className="p-2 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-rose-600 hover:border-rose-200 transition-all disabled:opacity-50"
            >
              <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={() => setIsFormOpen(true)}
              className="px-4 py-2 bg-rose-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-rose-700 transition-all flex items-center gap-2"
            >
              <Plus size={16} /> Nuevo
            </button>
          </div>
        </div>

        {activeTab === 'records' ? (
          <div className="flex flex-col gap-6 h-full overflow-hidden">
            {/* Compliance Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 shrink-0">
              <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Meta Diaria</span>
                <span className="text-4xl font-black text-slate-900">{totalMeta}</span>
              </div>
              <div className="bg-emerald-500 border border-emerald-600 rounded-[2rem] p-6 shadow-md flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-2">Realizados</span>
                <span className="text-4xl font-black text-white">{totalRealizados}</span>
              </div>
              <div className="bg-rose-500 border border-rose-600 rounded-[2rem] p-6 shadow-md flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-black text-rose-100 uppercase tracking-widest mb-2">Pendientes</span>
                <span className="text-4xl font-black text-white">{totalPendientes}</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">% Adherencia</span>
                <div className="flex flex-col items-center gap-2">
                  <span className={`text-4xl font-black ${totalPorcentaje >= 100 ? 'text-emerald-600' : totalPorcentaje >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {totalPorcentaje.toFixed(1)}%
                  </span>
                  <div className="w-32 bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${totalPorcentaje >= 100 ? 'bg-emerald-500' : totalPorcentaje >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                      style={{ width: `${Math.min(totalPorcentaje, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-grow overflow-auto border border-slate-200 rounded-[2rem] bg-white shadow-sm custom-scrollbar">
              {viewMode === 'detail' ? (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ubicación</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reporte de</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">QR</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">NOMBRE HC</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Area 2</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Validador</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-20 text-center">
                          <RefreshCw className="animate-spin text-rose-500 mx-auto mb-4" size={32} />
                          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando registros...</p>
                        </td>
                      </tr>
                    ) : filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-20 text-center">
                          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No se encontraron registros</p>
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-slate-50 transition-colors group text-xs">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-700">{record.dateRaised}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-slate-600 font-medium">{record.location}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-slate-600 font-medium">{record.reportType}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-[10px] text-slate-400 italic">{record.reporterQR}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-slate-600 font-medium">{record.hcName}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-[10px] text-slate-400 uppercase">{record.area2}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`font-bold ${Number(record.validator) === 1 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {record.validator}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre HC</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Reporte</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Total Realizados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoading ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-20 text-center">
                          <RefreshCw className="animate-spin text-rose-500 mx-auto mb-4" size={32} />
                          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando resumen...</p>
                        </td>
                      </tr>
                    ) : sortedSummary.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-20 text-center">
                          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay datos para resumir</p>
                        </td>
                      </tr>
                    ) : (
                      sortedSummary.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors group text-xs">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-700 uppercase">{item.hcName}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-slate-600 font-medium">{item.reportType}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="font-black text-slate-900 text-lg">{item.count}</div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
          </div>
        </div>
      ) : renderComplianceView()}
    </div>
    );
  };

  return (
    <div className={`flex-grow ${isView ? '' : 'bg-[#0f172a]'} flex flex-col h-full overflow-hidden`}>
      <div className={`${isView ? 'h-full' : 'max-w-7xl mx-auto w-full p-8'} flex flex-col h-full`}>
        {!isView && (
          <div className="flex items-center justify-between mb-8 shrink-0">
            <div>
              <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Safety</h1>
              <p className="text-rose-500 font-bold uppercase tracking-widest text-xs mt-2">Control de Seguridad y Prevención</p>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={loadData}
                disabled={isLoading}
                className="px-6 py-3 bg-white/5 text-slate-300 rounded-xl font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 border border-white/10 disabled:opacity-50"
              >
                <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} /> Sincronizar
              </button>
              <button 
                onClick={() => setIsFormOpen(true)}
                className="px-6 py-3 bg-rose-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center gap-2"
              >
                <Plus size={18} /> Nueva Novedad
              </button>
              <button 
                onClick={onBack}
                className="px-6 py-3 bg-white/5 text-white rounded-xl font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2 border border-white/10"
              >
                <ChevronLeft size={18} /> Volver al Menú
              </button>
            </div>
          </div>
        )}

        <div className="flex-grow overflow-hidden">
          {renderSafetyView()}
        </div>
      </div>

      <SafetyForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        onSuccess={loadData}
        defaultWorkshop={activeArea || undefined}
        vehicles={vehicles}
      />
    </div>
  );
};

export default SafetyModule;
