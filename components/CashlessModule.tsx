import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { CashlessRecord } from '../types';
import { fetchCashlessFromSheet, submitCashlessEvidenceToSheet } from '../services/sheetService';
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  ChevronLeft, 
  Calendar, 
  User, 
  MapPin, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Camera,
  Upload,
  FileText,
  CheckCircle,
  LayoutDashboard,
  ClipboardCheck,
  CreditCard,
  ChevronDown,
  Map,
  BarChart as BarChartIcon,
  X,
  ExternalLink
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
  AreaChart,
  Area,
  LabelList
} from 'recharts';

interface VisitasPOCSModuleProps {
  onBack: () => void;
  searchTerm: string;
}

const VisitasPOCSModule: React.FC<VisitasPOCSModuleProps> = ({ onBack, searchTerm: externalSearchTerm }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'evidence'>('dashboard');
  const [records, setRecords] = useState<CashlessRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<string>('TODOS');
  const [selectedValidator, setSelectedValidator] = useState<string>('TODOS');
  const [selectedMonth, setSelectedMonth] = useState<string>('TODOS');
  const [selectedRating, setSelectedRating] = useState<string>('TODOS');
  const [executionFilter, setExecutionFilter] = useState<'ALL' | 'EXECUTED' | 'PENDING'>('ALL');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [viewer, setViewer] = useState<{ type: 'image' | 'map', url: string, title: string } | null>(null);

  // Evidence Form State
  const [evidenceForm, setEvidenceForm] = useState({
    codigoCliente: '',
    evidenceUrl: '',
    mapUrl: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [selectedClient, setSelectedClient] = useState<CashlessRecord | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setSearchTerm(externalSearchTerm);
  }, [externalSearchTerm]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCashlessFromSheet();
      setRecords(data);
    } catch (error) {
      console.error('Error loading cashless data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addWatermark = (dataUrl: string, location: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Set canvas size to image size
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Watermark style
        const padding = canvas.width * 0.03;
        const fontSize = Math.max(14, Math.floor(canvas.width * 0.03));
        ctx.font = `bold ${fontSize}px sans-serif`;
        
        const now = new Date();
        const timestamp = now.toLocaleString('es-CO', { 
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        
        const text = `${timestamp} | ${location}`;
        
        // Background for text (semi-transparent bar at bottom)
        const barHeight = fontSize + padding * 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

        // Text shadow for better readability
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // Draw text
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, padding, canvas.height - barHeight / 2);

        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleEvidenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceForm.codigoCliente || !evidenceForm.evidenceUrl) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await submitCashlessEvidenceToSheet(evidenceForm);
      if (success) {
        alert('Evidencia registrada con éxito');
        setEvidenceForm({
          codigoCliente: '',
          evidenceUrl: '',
          mapUrl: '',
          date: new Date().toISOString().split('T')[0]
        });
        setClientSearchTerm('');
        setSelectedClient(null);
        loadData();
        setActiveTab('dashboard');
      } else {
        alert('Error al registrar la evidencia');
      }
    } catch (error) {
      console.error('Error submitting evidence:', error);
      alert('Error en la conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsLoading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        
        // Get Location
        let locationStr = "Ubicación no disponible";
        let mapUrl = "";
        
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { 
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            });
          });
          const { latitude, longitude } = pos.coords;
          locationStr = `LAT: ${latitude.toFixed(6)} LON: ${longitude.toFixed(6)}`;
          mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        } catch (err) {
          console.error("Error getting location:", err);
        }

        const watermarked = await addWatermark(base64, locationStr);
        setEvidenceForm(prev => ({ 
          ...prev, 
          evidenceUrl: watermarked,
          mapUrl: mapUrl
        }));
        setIsLoading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const validators = ['TODOS', ...Array.from(new Set(records.map(r => r.validador).filter(v => v !== '')))];
  const riskLevels = ['TODOS', ...Array.from(new Set(records.map(r => r.nivelRiesgo).filter(r => r !== '')))];
  const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

  const isExecuted = (record: CashlessRecord) => {
    return record.visitas === '1';
  };

  const isPending = (record: CashlessRecord) => {
    return record.visitas === '0';
  };

  const getDirectDriveUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
      const id = url.match(/[-\w]{25,}/);
      if (id) {
        // Use thumbnail endpoint which is more reliable for embedding in iframes
        return `https://drive.google.com/thumbnail?id=${id[0]}&sz=w1200`;
      }
    }
    return url;
  };

  const getFilteredData = (excludeFilter?: string) => {
    return records.filter(record => {
      if (excludeFilter !== 'search') {
        const matchesSearch = 
          record.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.codigoCliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.barrio.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.municipio.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;
      }
      
      if (excludeFilter !== 'risk') {
        const matchesRisk = selectedRisk === 'TODOS' || record.nivelRiesgo === selectedRisk;
        if (!matchesRisk) return false;
      }

      if (excludeFilter !== 'validator') {
        const matchesValidator = selectedValidator === 'TODOS' || record.validador === selectedValidator;
        if (!matchesValidator) return false;
      }

      if (excludeFilter !== 'month') {
        let matchesMonth = true;
        if (selectedMonth !== 'TODOS' && record.fechaEjecucion) {
          const date = new Date(record.fechaEjecucion);
          const monthName = monthNames[date.getUTCMonth()];
          matchesMonth = monthName === selectedMonth;
        } else if (selectedMonth !== 'TODOS' && !record.fechaEjecucion) {
          matchesMonth = false;
        }
        if (!matchesMonth) return false;
      }

      if (excludeFilter !== 'execution') {
        const executed = isExecuted(record);
        if (executionFilter === 'EXECUTED' && !executed) return false;
        if (executionFilter === 'PENDING' && executed) return false;
      }

      if (excludeFilter !== 'rating') {
        const matchesRating = selectedRating === 'TODOS' || (record.calificacion || 'SIN CALIFICAR') === selectedRating;
        if (!matchesRating) return false;
      }

      return true;
    });
  };

  const baseFilteredRecords = getFilteredData();

  const stats = {
    total: baseFilteredRecords.length,
    executed: baseFilteredRecords.filter(r => isExecuted(r)).length,
    pending: baseFilteredRecords.filter(r => isPending(r)).length,
    highRisk: baseFilteredRecords.filter(r => r.nivelRiesgo.toUpperCase().includes('ALTO')).length,
    compliance: baseFilteredRecords.length > 0 
      ? (baseFilteredRecords.filter(r => isExecuted(r)).length / baseFilteredRecords.length) * 100 
      : 0,
  };

  const filteredRecords = baseFilteredRecords;

  const handleExportToExcel = () => {
    const dataToExport = filteredRecords.map(record => ({
      'CÓDIGO CLIENTE': record.codigoCliente,
      'CLIENTE': record.cliente,
      'BARRIO': record.barrio,
      'DIRECCIÓN': record.direccion,
      'MUNICIPIO': record.municipio,
      'FRECUENCIA': record.freRegularDias,
      'VISITADO': record.visitas === '1' ? 'SÍ' : 'NO',
      'RIESGO': record.nivelRiesgo,
      'ESTADO': record.validador,
      'FECHA EJECUCIÓN': record.fechaEjecucion,
      'FECHA PROGRAMACIÓN': record.fechaProgramacion,
      'CALIFICACIÓN': record.calificacion,
      'EVIDENCIA URL': record.evidenciaUrl,
      'MAPA URL': record.mapUrl
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Visitas POCS');
    
    if (dataToExport.length > 0) {
      const maxWidths = Object.keys(dataToExport[0]).map(key => {
        const headerLen = key.length;
        const maxDataLen = dataToExport.reduce((max, row) => {
          const val = row[key as keyof typeof row];
          return Math.max(max, val ? String(val).length : 0);
        }, 0);
        return { wch: Math.max(headerLen, maxDataLen) + 2 };
      });
      worksheet['!cols'] = maxWidths;
    }

    XLSX.writeFile(workbook, `Visitas_POCS_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Data for Rating Chart - Ignore rating filter to allow selection
  const ratingRecords = getFilteredData('rating');
  const ratingCounts = ratingRecords
    .filter(r => (r.calificacion || '').toUpperCase() !== 'NO VISITADO')
    .reduce((acc, r) => {
      const rating = r.calificacion || 'SIN CALIFICAR';
      acc[rating] = (acc[rating] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const ratingData = Object.keys(ratingCounts).map(name => ({
    name,
    value: ratingCounts[name]
  })).sort((a, b) => b.value - a.value);

  // Data for Execution Date Chart
  const executionRecords = getFilteredData();
  const executionCounts = executionRecords
    .filter(r => r.fechaEjecucion && (r.calificacion || '').toUpperCase() !== 'NO VISITADO')
    .reduce((acc, r) => {
      const date = r.fechaEjecucion;
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const executionData = Object.keys(executionCounts).map(date => ({
    date,
    count: executionCounts[date]
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Data for Monthly Chart - Ignore month filter to allow selection
  const monthlyRecords = getFilteredData('month');
  const monthlyCounts = monthlyRecords
    .filter(r => r.fechaEjecucion && (r.calificacion || '').toUpperCase() !== 'NO VISITADO')
    .reduce((acc, r) => {
      const date = new Date(r.fechaEjecucion);
      const monthIndex = date.getUTCMonth();
      const monthName = monthNames[monthIndex];
      acc[monthName] = (acc[monthName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  const monthlyData = monthNames
    .map(name => ({ name, count: monthlyCounts[name] || 0 }))
    .filter(m => m.count > 0 || selectedMonth === m.name);

  const getRiskColor = (risk: string) => {
    const r = risk.toUpperCase();
    if (r.includes('ALTO')) return 'text-rose-600 bg-rose-50 border-rose-100';
    if (r.includes('MEDIO')) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-emerald-600 bg-emerald-50 border-emerald-100';
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/50">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-blue-500/10 rounded-[2rem] flex items-center justify-center text-blue-600 shadow-inner">
            <ClipboardCheck size={36} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Visitas POCS</h2>
            <div className="flex gap-4 mt-2">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'dashboard' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('evidence')}
                className={`text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'evidence' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Cargar Evidencia
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-3 bg-white px-8 py-4 rounded-[1.5rem] border border-slate-200 shadow-lg hover:shadow-xl transition-all group disabled:opacity-50 active:scale-95"
          >
            <RefreshCw size={18} className={`text-slate-400 group-hover:text-blue-600 transition-colors ${isLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'}`} />
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Sincronizar</span>
          </button>
        </div>
      </div>

      {activeTab === 'dashboard' ? (
        <>
          {/* STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { id: 'ALL', label: 'Total', value: stats.total, icon: <User className="text-blue-600" />, color: 'bg-blue-50', activeColor: 'ring-blue-400' },
          { id: 'EXECUTED', label: 'Ejecutados', value: stats.executed, icon: <CheckCircle2 className="text-white" />, color: 'bg-emerald-600', activeColor: 'ring-emerald-400' },
          { id: 'PENDING', label: 'Pendientes', value: stats.pending, icon: <Clock className="text-white" />, color: 'bg-rose-600', activeColor: 'ring-rose-400' },
          { id: 'COMPLIANCE', label: '% Cumpl.', value: `${stats.compliance.toFixed(1)}%`, icon: <TrendingUp className="text-rose-600" />, color: 'bg-rose-50', activeColor: 'ring-rose-400' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => {
              if (stat.id === 'COMPLIANCE') return;
              setExecutionFilter(prev => prev === stat.id ? 'ALL' : stat.id as any);
            }}
            className={`bg-white p-4 md:p-8 rounded-3xl md:rounded-[2.5rem] border shadow-sm flex flex-col sm:flex-row items-center sm:items-center gap-3 md:gap-6 hover:shadow-md transition-all cursor-pointer relative ${
              executionFilter === stat.id ? `ring-2 ${stat.activeColor} shadow-lg scale-105 z-10` : 'hover:scale-[1.02]'
            }`}
          >
            <div className={`w-10 h-10 md:w-14 md:h-14 ${stat.color} rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 shadow-inner`}>
              {React.cloneElement(stat.icon as React.ReactElement, { size: 20 })}
            </div>
            <div className="text-center sm:text-left">
              <div className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">{stat.label}</div>
              <div className="text-lg md:text-3xl font-black text-slate-800 tracking-tight">{stat.value}</div>
            </div>
            {executionFilter === stat.id && (
              <div className="absolute top-2 right-2 md:top-4 md:right-4 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-current opacity-50 animate-pulse" />
            )}
          </motion.div>
        ))}
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Rating Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-4 md:p-8 rounded-3xl md:rounded-[2.5rem] border shadow-sm h-[350px] md:h-[450px] flex flex-col"
        >
          <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-8">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-50 rounded-xl md:rounded-2xl flex items-center justify-center text-indigo-600">
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-tight">Calificación</h3>
              <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">Distribución</p>
            </div>
            {selectedRating !== 'TODOS' && (
              <button 
                onClick={() => setSelectedRating('TODOS')}
                className="ml-auto text-[9px] md:text-[10px] font-black text-rose-600 uppercase tracking-widest bg-rose-50 px-3 py-1 rounded-full hover:bg-rose-100 transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
          <div className="flex-grow min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={ratingData} 
                layout="vertical" 
                margin={{ left: 0, right: 30 }}
                onClick={(data) => {
                  if (data && data.activeLabel) {
                    setSelectedRating(prev => prev === data.activeLabel ? 'TODOS' : data.activeLabel);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: '800', fill: '#64748b' }}
                  width={80}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20} cursor="pointer">
                  {ratingData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={selectedRating === 'TODOS' || selectedRating === entry.name ? ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b'][index % 5] : '#e2e8f0'} 
                    />
                  ))}
                  <LabelList dataKey="value" position="right" style={{ fontSize: '9px', fontWeight: '800', fill: '#64748b' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Monthly Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-4 md:p-8 rounded-3xl md:rounded-[2.5rem] border shadow-sm h-[350px] md:h-[450px] flex flex-col"
        >
          <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-8">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-50 rounded-xl md:rounded-2xl flex items-center justify-center text-blue-600">
              <BarChart size={20} />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-tight">Mensual</h3>
              <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">Visitas</p>
            </div>
            {selectedMonth !== 'TODOS' && (
              <button 
                onClick={() => setSelectedMonth('TODOS')}
                className="ml-auto text-[9px] md:text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full hover:bg-blue-100 transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
          <div className="flex-grow min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={monthlyData} 
                margin={{ top: 10, bottom: 10 }}
                onClick={(data) => {
                  if (data && data.activeLabel) {
                    setSelectedMonth(prev => prev === data.activeLabel ? 'TODOS' : data.activeLabel);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={30} cursor="pointer">
                  {monthlyData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={selectedMonth === 'TODOS' || selectedMonth === entry.name ? '#3b82f6' : '#e2e8f0'} 
                    />
                  ))}
                  <LabelList dataKey="count" position="top" style={{ fontSize: '9px', fontWeight: '800', fill: '#64748b' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Execution Date Chart - Full Width */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 bg-white p-4 md:p-8 rounded-3xl md:rounded-[2.5rem] border shadow-sm h-[350px] md:h-[400px] flex flex-col"
        >
          <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-8">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-50 rounded-xl md:rounded-2xl flex items-center justify-center text-emerald-600">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-tight">Histórico</h3>
              <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tendencia</p>
            </div>
          </div>
          <div className="flex-grow min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={executionData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                  minTickGap={20}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#10b981" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                >
                  <LabelList dataKey="count" position="top" style={{ fontSize: '9px', fontWeight: '800', fill: '#10b981' }} />
                </Area>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-4 md:p-6 rounded-[2rem] border shadow-sm flex flex-col lg:flex-row lg:items-center gap-4 md:gap-6">
        <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border w-full lg:w-auto">
          <Filter size={18} className="text-slate-400" />
          <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Filtros:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-row gap-4 w-full">
          <div className="flex flex-col gap-2 flex-1 min-w-[140px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Riesgo</label>
            <select 
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="bg-slate-50 border rounded-xl px-4 py-3 text-[11px] font-bold uppercase outline-none focus:ring-2 focus:ring-slate-200 transition-all appearance-none cursor-pointer"
            >
              {riskLevels.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2 flex-1 min-w-[140px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Validador</label>
            <select 
              value={selectedValidator}
              onChange={(e) => setSelectedValidator(e.target.value)}
              className="bg-slate-50 border rounded-xl px-4 py-3 text-[11px] font-bold uppercase outline-none focus:ring-2 focus:ring-slate-200 transition-all appearance-none cursor-pointer"
            >
              {validators.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2 flex-1 min-w-[120px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mes</label>
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-50 border rounded-xl px-4 py-3 text-[11px] font-bold uppercase outline-none focus:ring-2 focus:ring-slate-200 transition-all appearance-none cursor-pointer"
            >
              {['TODOS', ...monthNames].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2 flex-1 min-w-[120px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Calificación</label>
            <select 
              value={selectedRating}
              onChange={(e) => setSelectedRating(e.target.value)}
              className="bg-slate-50 border rounded-xl px-4 py-3 text-[11px] font-bold uppercase outline-none focus:ring-2 focus:ring-slate-200 transition-all appearance-none cursor-pointer"
            >
              {['TODOS', ...Array.from(new Set(records.map(r => r.calificacion || 'SIN CALIFICAR').filter(r => r !== '')))].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        <div className="relative w-full lg:w-80 mt-2 lg:mt-0">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="BUSCAR CLIENTE..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border rounded-2xl pl-14 pr-6 py-4 text-[11px] font-bold uppercase outline-none focus:ring-2 focus:ring-slate-200 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
        <div className="p-4 md:p-8 border-b bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-tight">Detalle</h3>
            <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">Registros</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleExportToExcel}
              disabled={isLoading || filteredRecords.length === 0}
              className="group flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed text-emerald-600 px-4 py-2 rounded-xl border border-emerald-100 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm"
            >
              <Download size={14} className="group-hover:scale-110 transition-transform" />
              <span>Exportar Excel</span>
            </button>
            <div className="text-[9px] md:text-[10px] font-black text-slate-500 bg-white px-3 md:px-4 py-1.5 md:py-2 rounded-full border shadow-sm uppercase tracking-widest">
              {filteredRecords.length} Resultados
            </div>
          </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/80 border-b">
                <th className="px-8 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest">Cliente</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest">Ubicación</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest">Riesgo</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest">Validador</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest">Programación</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest">Ejecución</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Calificación</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Evidencia</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Mapa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-8 py-32 text-center">
                    <Loader2 className="animate-spin text-slate-300 mx-auto mb-6" size={48} />
                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sincronizando información...</div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-8 py-32 text-center">
                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No se encontraron registros coincidentes</div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="text-sm font-black text-slate-800 uppercase group-hover:text-rose-600 transition-colors">{record.cliente}</div>
                      <div className="text-[10px] text-slate-400 font-bold mt-1">CÓDIGO: {record.codigoCliente}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                        <MapPin size={14} className="text-slate-400" />
                        {record.barrio}, {record.municipio}
                      </div>
                      <div className="text-[10px] text-slate-400 ml-6 mt-1 uppercase">{record.direccion}</div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border shadow-sm ${getRiskColor(record.nivelRiesgo)}`}>
                        {record.nivelRiesgo}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 text-[10px] font-black">
                          {record.validador.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="text-[11px] font-bold text-slate-600 uppercase">{record.validador}</div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                        <Calendar size={14} className="text-slate-400" />
                        {record.fechaProgramacion || '---'}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                        <CheckCircle2 size={14} className={isExecuted(record) ? 'text-emerald-500' : isPending(record) ? 'text-amber-500' : 'text-slate-300'} />
                        <span className={isExecuted(record) ? 'text-slate-700' : isPending(record) ? 'text-amber-600' : 'text-slate-400 italic'}>
                          {isExecuted(record) ? 'EJECUTADO' : isPending(record) ? 'PENDIENTE' : 'SIN ESTADO'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="inline-block px-4 py-2 bg-slate-800 text-white rounded-xl text-[11px] font-black shadow-md">
                        {record.calificacion || '---'}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      {record.evidenciaUrl ? (
                        <button 
                          onClick={() => setViewer({ type: 'image', url: record.evidenciaUrl, title: `Evidencia: ${record.cliente}` })}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[11px] font-black hover:bg-rose-100 transition-colors border border-rose-100"
                        >
                          <Camera size={14} />
                          VER
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">SIN SOPORTE</span>
                      )}
                    </td>
                    <td className="px-8 py-6 text-center">
                      {record.mapUrl ? (
                        <button 
                          onClick={() => setViewer({ type: 'map', url: record.mapUrl, title: `Ubicación: ${record.cliente}` })}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[11px] font-black hover:bg-emerald-100 transition-colors border border-emerald-100"
                        >
                          <MapPin size={14} />
                          MAPA
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">---</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto w-full"
        >
          <div className="bg-white rounded-[2.5rem] border shadow-xl overflow-hidden">
            <div className="p-8 md:p-12 border-b bg-slate-50/50">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600">
                  <Camera size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Registro de Evidencia</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Captura y carga de soportes de visita</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleEvidenceSubmit} className="p-8 md:p-12 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Client Selection */}
                <div className="space-y-4">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Seleccionar Cliente</label>
                  <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text"
                      placeholder="BUSCAR CLIENTE POR NOMBRE O CÓDIGO..."
                      autoComplete="off"
                      className="w-full bg-slate-50 border rounded-2xl pl-14 pr-6 py-4 text-[11px] font-bold uppercase outline-none focus:ring-2 focus:ring-rose-200 transition-all"
                      value={clientSearchTerm}
                      onFocus={() => setShowClientSuggestions(true)}
                      onChange={(e) => {
                        setClientSearchTerm(e.target.value);
                        setShowClientSuggestions(true);
                        if (selectedClient) {
                          setSelectedClient(null);
                          setEvidenceForm(prev => ({ ...prev, codigoCliente: '' }));
                        }
                      }}
                    />
                    
                    {/* Suggestions Dropdown */}
                    <AnimatePresence>
                      {showClientSuggestions && clientSearchTerm.length > 2 && !selectedClient && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-50 left-0 right-0 mt-2 bg-white border rounded-2xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar"
                        >
                          {records
                            .filter(r => 
                              r.cliente.toLowerCase().includes(clientSearchTerm.toLowerCase()) || 
                              r.codigoCliente.toLowerCase().includes(clientSearchTerm.toLowerCase())
                            )
                            .slice(0, 10)
                            .map((r) => (
                              <button
                                key={r.id}
                                type="button"
                                className="w-full text-left p-4 hover:bg-rose-50 border-b last:border-0 transition-colors"
                                onClick={() => {
                                  setSelectedClient(r);
                                  setEvidenceForm(prev => ({ ...prev, codigoCliente: r.codigoCliente }));
                                  setClientSearchTerm(r.cliente);
                                  setShowClientSuggestions(false);
                                }}
                              >
                                <div className="text-[11px] font-black text-slate-800 uppercase">{r.cliente}</div>
                                <div className="text-[9px] text-slate-400 font-bold mt-1">CÓDIGO: {r.codigoCliente} | {r.municipio}</div>
                              </button>
                            ))
                          }
                          {records.filter(r => 
                              r.cliente.toLowerCase().includes(clientSearchTerm.toLowerCase()) || 
                              r.codigoCliente.toLowerCase().includes(clientSearchTerm.toLowerCase())
                            ).length === 0 && (
                            <div className="p-4 text-[10px] text-slate-400 font-bold uppercase text-center">No se encontraron resultados</div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {selectedClient && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-6 bg-rose-50 rounded-2xl border border-rose-100 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-black text-rose-900 uppercase">{selectedClient.cliente}</div>
                        <div className="text-[10px] text-rose-600 font-bold mt-1 uppercase">CÓDIGO: {selectedClient.codigoCliente}</div>
                        <div className="text-[10px] text-rose-500 mt-2 uppercase">{selectedClient.direccion}</div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          setSelectedClient(null);
                          setClientSearchTerm('');
                          setEvidenceForm(prev => ({ ...prev, codigoCliente: '' }));
                        }}
                        className="p-2 text-rose-400 hover:text-rose-600 transition-colors"
                      >
                        <RefreshCw size={20} />
                      </button>
                    </motion.div>
                  )}
                </div>

                {/* Date Selection */}
                <div className="space-y-4">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Fecha de Visita</label>
                  <input 
                    type="date"
                    value={evidenceForm.date}
                    onChange={(e) => setEvidenceForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-slate-50 border rounded-2xl px-6 py-4 text-[11px] font-bold uppercase outline-none focus:ring-2 focus:ring-rose-200 transition-all"
                  />
                </div>
              </div>

              {/* Evidence Upload */}
              <div className="space-y-4">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Soporte Fotográfico</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <label className="flex flex-col items-center justify-center gap-4 p-10 border-2 border-dashed border-slate-200 rounded-[2rem] hover:border-rose-400 hover:bg-rose-50 transition-all cursor-pointer group">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-rose-600 transition-all">
                      <Camera size={32} />
                    </div>
                    <div className="text-center">
                      <div className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Tomar Foto</div>
                      <div className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Usar cámara del dispositivo</div>
                    </div>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                  </label>

                  <label className="flex flex-col items-center justify-center gap-4 p-10 border-2 border-dashed border-slate-200 rounded-[2rem] hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-blue-600 transition-all">
                      <Upload size={32} />
                    </div>
                    <div className="text-center">
                      <div className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Subir Archivo</div>
                      <div className="text-[9px] text-slate-400 font-bold mt-1 uppercase">Seleccionar de la galería</div>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>

                {evidenceForm.evidenceUrl && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-4"
                  >
                    <div className="relative rounded-[2rem] overflow-hidden border-4 border-white shadow-xl aspect-video bg-slate-100">
                      <img src={evidenceForm.evidenceUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => setEvidenceForm(prev => ({ ...prev, evidenceUrl: '', mapUrl: '' }))}
                        className="absolute top-6 right-6 p-3 bg-white/90 backdrop-blur rounded-xl text-rose-600 shadow-lg hover:bg-white transition-all"
                      >
                        <RefreshCw size={20} />
                      </button>
                    </div>

                    {evidenceForm.mapUrl && (
                      <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                          <MapPin size={20} />
                        </div>
                        <div className="flex-1">
                          <div className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Ubicación Capturada</div>
                          <a 
                            href={evidenceForm.mapUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[9px] text-emerald-600 font-bold underline uppercase"
                          >
                            Ver en Google Maps
                          </a>
                        </div>
                        <CheckCircle size={20} className="text-emerald-500" />
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              <div className="pt-6">
                <button 
                  type="submit"
                  disabled={isSubmitting || !evidenceForm.codigoCliente || !evidenceForm.evidenceUrl}
                  className="w-full bg-slate-800 text-white py-6 rounded-3xl text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="animate-spin" size={20} />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={20} />
                      Registrar Visita
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      )}

      {/* VIEWER MODAL */}
      <AnimatePresence>
        {viewer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewer(null)}
              className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 md:p-8 flex items-center justify-between border-b bg-slate-50">
                <div>
                  <h3 className="text-lg md:text-xl font-black text-slate-800 uppercase tracking-tight">{viewer.title}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Visualización de {viewer.type === 'image' ? 'evidencia fotográfica' : 'ubicación geoespacial'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <a 
                    href={viewer.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-3 bg-white text-slate-600 rounded-2xl hover:bg-slate-100 transition-all border shadow-sm"
                    title="Oír en nueva pestaña"
                  >
                    <ExternalLink size={20} />
                  </a>
                  <button 
                    onClick={() => setViewer(null)}
                    className="p-3 bg-rose-500 text-white rounded-2xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-200"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

                <div className="flex-1 overflow-auto bg-slate-200 p-4 md:p-8 flex items-center justify-center min-h-[400px]">
                {viewer.type === 'image' ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img 
                      src={getDirectDriveUrl(viewer.url)} 
                      alt={viewer.title} 
                      className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                      onError={(e) => {
                        // Fallback to direct share link if thumbnail fails
                        const target = e.target as HTMLImageElement;
                        if (!target.src.includes('uc?export=view')) {
                          const id = viewer.url.match(/[-\w]{25,}/);
                          if (id) target.src = `https://docs.google.com/uc?export=view&id=${id[0]}`;
                        }
                      }}
                    />
                  </div>
                ) : (
                  <iframe 
                    src={viewer.url.includes('google.com/maps') 
                      ? `${viewer.url}${viewer.url.includes('?') ? '&' : '?'}output=embed` 
                      : viewer.url.startsWith('http') ? viewer.url : `https://www.google.com/maps?q=${viewer.url}&output=embed`}
                    className="w-full h-full min-h-[500px] border-0 rounded-2xl shadow-2xl bg-white"
                    title="Mapa"
                    allowFullScreen
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Loader2 = ({ size, className }: { size: number, className?: string }) => (
  <RefreshCw size={size} className={`${className} animate-spin`} />
);

export default VisitasPOCSModule;
