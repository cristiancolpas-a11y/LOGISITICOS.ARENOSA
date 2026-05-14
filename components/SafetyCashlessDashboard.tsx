import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area, LabelList
} from 'recharts';
import { 
  Filter, Search, RefreshCw, AlertTriangle, Users, TrendingUp, CreditCard, 
  MapPin, Clock, ShieldAlert, Zap, Target, TrendingDown, LayoutDashboard,
  Calendar, FileText, Smartphone, Download, Info, ChevronLeft
} from 'lucide-react';
import { CashlessDashboardRecord } from '../types';
import { fetchCashlessDashboardFromSheet } from '../services/sheetService';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  onBack: () => void;
}

const COLORS = {
  blue: '#3b82f6',
  cyan: '#06b6d4',
  emerald: '#10b981',
  rose: '#f43f5e',
  amber: '#f59e0b',
  slate: '#94a3b8',
  darkBg: '#0f172a',
  cardBg: '#1e293b',
  neonBlue: '#60a5fa',
  neonRed: '#fb7185',
  neonYellow: '#fbbf24',
  neonGreen: '#34d399'
};

const SafetyCashlessDashboard: React.FC<Props> = ({ onBack }) => {
  const [data, setData] = useState<CashlessDashboardRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  
  // Filters
  const [selectedCentro, setSelectedCentro] = useState<string>('TODOS');
  const [selectedTransportista, setSelectedTransportista] = useState<string>('TODOS');
  const [selectedResponsable, setSelectedResponsable] = useState<string>('TODOS');
  const [selectedMes, setSelectedMes] = useState<string>('TODOS');
  const [selectedDia, setSelectedDia] = useState<string>('TODOS');
  const [selectedSemana, setSelectedSemana] = useState<string>('TODOS');
  const [selectedRuta, setSelectedRuta] = useState<string>('TODOS');
  const [selectedAlerta, setSelectedAlerta] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const records = await fetchCashlessDashboardFromSheet();
      
      // Filter for AV74 ONLY as requested
      const av74Records = records.filter(r => r.centro === 'AV74');
      
      // Normaliza alertas: Solo '1' es alerta
      const processedRecords = av74Records.map(r => ({
        ...r,
        alerta: String(r.alerta) === '1' ? 'CON ALERTA' : 'SIN ALERTA'
      }));
      setData(processedRecords);
      setLastRefreshed(new Date());
    } catch (error) {
      console.error("Error loading cashless dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000); // 5 min
    return () => clearInterval(interval);
  }, []);

  // Base function for cross-filtering: gets data filtered by all dimensions EXCEPT the one specified
  const getFilteredSubset = (excludeDimension?: string) => {
    return data.filter(r => {
      const matchCentro = (excludeDimension === 'centro' || selectedCentro === 'TODOS') || r.centro === selectedCentro;
      const matchTransportista = (excludeDimension === 'transportista' || selectedTransportista === 'TODOS') || r.transportista === selectedTransportista;
      const matchResponsable = (excludeDimension === 'responsable' || selectedResponsable === 'TODOS') || r.responsableRuta === selectedResponsable;
      const matchMes = (excludeDimension === 'mes' || selectedMes === 'TODOS') || String(r.mes) === selectedMes;
      // Allow match by either day number (dropdown) or full date string (chart click)
      const matchDia = (excludeDimension === 'dia' || selectedDia === 'TODOS') || 
                       String(r.dia) === selectedDia || 
                       r.fecha === selectedDia;
      
      const dayNum = parseInt(r.dia);
      let weekNumber = 1;
      if (dayNum > 7 && dayNum <= 14) weekNumber = 2;
      else if (dayNum > 14 && dayNum <= 21) weekNumber = 3;
      else if (dayNum > 21) weekNumber = 4;
      const weekLabel = `SEM ${weekNumber}`;
      const matchSemana = (excludeDimension === 'semana' || selectedSemana === 'TODOS') || weekLabel === selectedSemana;

      const matchRuta = (excludeDimension === 'ruta' || selectedRuta === 'TODOS') || r.ruta === selectedRuta;
      const matchAlerta = (excludeDimension === 'alerta' || selectedAlerta === 'TODOS') || (selectedAlerta === 'CON ALERTA' ? r.alerta !== 'SIN ALERTA' && r.alerta !== '' : r.alerta === 'SIN ALERTA');
      
      const matchSearch = (excludeDimension === 'search' || !searchTerm) || 
        r.nombreCliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.clienteId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.ruta.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.responsableRuta.toLowerCase().includes(searchTerm.toLowerCase());

      return matchCentro && matchTransportista && matchResponsable && matchMes && matchDia && matchSemana && matchRuta && matchAlerta && matchSearch;
    });
  };

  const filteredData = useMemo(() => getFilteredSubset(), [data, selectedCentro, selectedTransportista, selectedResponsable, selectedMes, selectedDia, selectedSemana, selectedRuta, selectedAlerta, searchTerm]);

  // Unique values for filters
  const filterOptions = useMemo(() => {
    return {
      centros: ['TODOS', ...Array.from(new Set(data.map(r => r.centro))).sort()],
      transportistas: ['TODOS', ...Array.from(new Set(data.map(r => r.transportista))).sort()],
      responsables: ['TODOS', ...Array.from(new Set(data.map(r => r.responsableRuta))).sort()],
      meses: ['TODOS', ...Array.from(new Set(data.map(r => String(r.mes)))).sort((a,b) => Number(a)-Number(b))],
      dias: ['TODOS', ...Array.from(new Set(data.map(r => String(r.dia)))).sort((a,b) => Number(a)-Number(b))],
      rutas: ['TODOS', ...Array.from(new Set(data.map(r => r.ruta))).sort()]
    };
  }, [data]);

  // KPI Calculations (Total dashboard context)
  const stats = useMemo(() => {
    const d = filteredData;
    const totalClients = new Set(d.map(r => r.clienteId)).size;
    const totalVisits = d.length;
    const totalAlerts = d.filter(r => r.alerta !== 'SIN ALERTA' && r.alerta !== '').length;
    const totalCollected = d.reduce((acc, r) => acc + r.importe, 0);
    const clientsWithBreach = new Set(d.filter(r => r.alerta !== 'SIN ALERTA' && r.alerta !== '').map(r => r.clienteId)).size;
    
    // Critical Responsibles (Top by alerts)
    const respMap = d.reduce<Record<string, number>>((acc, r) => {
      if (r.alerta !== 'SIN ALERTA' && r.alerta !== '') {
        acc[r.responsableRuta] = (acc[r.responsableRuta] || 0) + 1;
      }
      return acc;
    }, {});
    const criticalRespCount = Object.keys(respMap).length;

    // High Risk Routes
    const routeMap = d.reduce<Record<string, number>>((acc, r) => {
      if (r.alerta !== 'SIN ALERTA' && r.alerta !== '') {
        acc[r.ruta] = (acc[r.ruta] || 0) + 1;
      }
      return acc;
    }, {});
    const highRiskRoutes = (Object.entries(routeMap) as [string, number][]).filter(([_, count]) => count > 5).length;

    const avgPayment = totalVisits > 0 ? totalCollected / totalVisits : 0;

    return {
      totalClients,
      totalVisits,
      totalAlerts,
      totalCollected,
      clientsWithBreach,
      criticalRespCount,
      highRiskRoutes,
      avgPayment
    };
  }, [filteredData]);

  // Chart Data: Top Offenders Responsibles (Independent Filter)
  const topResponsables = useMemo(() => {
    const d = getFilteredSubset('responsable');
    const map = d.reduce<Record<string, { name: string, alerts: number, amount: number, breaches: number }>>((acc, r) => {
      if (!acc[r.responsableRuta]) {
        acc[r.responsableRuta] = { name: r.responsableRuta, alerts: 0, amount: 0, breaches: 0 };
      }
      if (r.alerta !== 'SIN ALERTA' && r.alerta !== '') {
        acc[r.responsableRuta].alerts += 1;
        acc[r.responsableRuta].amount += r.importe;
      }
      acc[r.responsableRuta].breaches += 1;
      return acc;
    }, {});

    return (Object.values(map) as { name: string, alerts: number, amount: number, breaches: number }[])
      .sort((a, b) => b.alerts - a.alerts)
      .slice(0, 10);
  }, [data, selectedCentro, selectedTransportista, selectedMes, selectedDia, selectedSemana, selectedRuta, selectedAlerta, searchTerm]);

  // Chart Data: Top Offenders Clients (Independent Filter)
  const topClients = useMemo(() => {
    const d = getFilteredSubset('search');
    const map = d.reduce<Record<string, { id: string, name: string, alerts: number, amount: number, reincidencias: number }>>((acc, r) => {
      if (!acc[r.clienteId]) {
        acc[r.clienteId] = { id: r.clienteId, name: r.nombreCliente, alerts: 0, amount: 0, reincidencias: 0 };
      }
      if (r.alerta !== 'SIN ALERTA' && r.alerta !== '') {
        acc[r.clienteId].alerts += 1;
        acc[r.clienteId].amount += r.importe;
      }
      acc[r.clienteId].reincidencias += 1;
      return acc;
    }, {});

    return (Object.values(map) as { id: string, name: string, alerts: number, amount: number, reincidencias: number }[])
      .sort((a, b) => b.alerts - a.alerts)
      .slice(0, 10);
  }, [data, selectedCentro, selectedTransportista, selectedResponsable, selectedMes, selectedDia, selectedSemana, selectedRuta, selectedAlerta]);

  // Chart Data: Donut Alertas
  const alertData = useMemo(() => {
    const sin = filteredData.filter(r => r.alerta === 'SIN ALERTA').length;
    const con = filteredData.length - sin;
    return [
      { name: 'SIN ALERTA', value: sin, color: COLORS.neonGreen },
      { name: 'CON ALERTA', value: con, color: COLORS.neonRed }
    ];
  }, [filteredData]);

  // Trend Data (Daily Recaudo)
  const trendData = useMemo(() => {
    const d = getFilteredSubset().filter(r => r.alerta === 'CON ALERTA');
    const map = d.reduce<Record<string, { date: string, amount: number }>>((acc, r) => {
      const date = r.fecha || 'N/A';
      if (!acc[date]) acc[date] = { date, amount: 0 };
      acc[date].amount += r.importe;
      return acc;
    }, {});

    return (Object.values(map) as { date: string, amount: number }[]).sort((a,b) => a.date.localeCompare(b.date));
  }, [data, selectedCentro, selectedTransportista, selectedResponsable, selectedMes, selectedDia, selectedSemana, selectedRuta, selectedAlerta, searchTerm]);

  // Chart Data: Monthly Alerts (Independent Filter)
  const monthlyAlertsData = useMemo(() => {
    const d = getFilteredSubset('mes');
    const map = d.reduce<Record<string, { month: string, alerts: number }>>((acc, r) => {
      const monthStr = r.mes || 'N/A';
      if (!acc[monthStr]) acc[monthStr] = { month: monthStr, alerts: 0 };
      if (r.alerta === 'CON ALERTA') {
        acc[monthStr].alerts += 1;
      }
      return acc;
    }, {});

    return (Object.values(map) as { month: string, alerts: number }[]).sort((a, b) => Number(a.month) - Number(b.month));
  }, [data, selectedCentro, selectedTransportista, selectedResponsable, selectedDia, selectedSemana, selectedRuta, selectedAlerta, searchTerm]);

  // Chart Data: Weekly Alerts (Independent Filter)
  const weeklyAlertsData = useMemo(() => {
    const d = getFilteredSubset('semana');
    const map = d.reduce<Record<string, { week: string, alerts: number }>>((acc, r) => {
      const day = parseInt(r.dia);
      let weekNumber = 1;
      if (day > 7 && day <= 14) weekNumber = 2;
      else if (day > 14 && day <= 21) weekNumber = 3;
      else if (day > 21) weekNumber = 4;
      
      const weekLabel = `SEM ${weekNumber}`;
      if (!acc[weekLabel]) acc[weekLabel] = { week: weekLabel, alerts: 0 };
      if (r.alerta === 'CON ALERTA') acc[weekLabel].alerts += 1;
      return acc;
    }, {});

    return (Object.values(map) as { week: string, alerts: number }[]).sort((a,b) => a.week.localeCompare(b.week));
  }, [data, selectedCentro, selectedTransportista, selectedResponsable, selectedMes, selectedDia, selectedRuta, selectedAlerta, searchTerm]);

  // Chart Data: Daily Alerts
  const dailyAlertsData = useMemo(() => {
    const d = getFilteredSubset();
    const map = d.reduce<Record<string, { date: string, alerts: number }>>((acc, r) => {
      const date = r.fecha || 'N/A';
      if (!acc[date]) acc[date] = { date, alerts: 0 };
      if (r.alerta === 'CON ALERTA') acc[date].alerts += 1;
      return acc;
    }, {});

    return (Object.values(map) as { date: string, alerts: number }[]).sort((a,b) => a.date.localeCompare(b.date));
  }, [data, selectedCentro, selectedTransportista, selectedResponsable, selectedMes, selectedDia, selectedSemana, selectedRuta, selectedAlerta, searchTerm]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
  };

  const getAlertColor = (alerta: string) => {
    if (alerta === 'SIN ALERTA') return 'text-emerald-400';
    if (!alerta || alerta === '') return 'text-slate-400';
    return 'text-rose-400 font-bold';
  };

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-slate-200 overflow-hidden font-sans">
      {/* HEADER SECTION */}
      <div className="px-8 py-6 bg-slate-900/50 border-b border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 shrink-0 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="p-3 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-2xl transition-all shadow-xl text-slate-400 hover:text-white"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <LayoutDashboard className="text-blue-500" size={32} />
              <h1 className="text-3xl font-black text-white uppercase tracking-tighter">
                CLIENTES <span className="text-blue-500">CASHLESS</span>
              </h1>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">MONITOREO TIEMPO REAL</span>
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-l pl-4 border-slate-700 flex items-center gap-2">
                <Calendar size={12} /> {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Buscar cliente, ruta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-800/50 border border-white/5 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 outline-none w-64 transition-all"
            />
          </div>
          <button 
            onClick={loadData}
            className="p-2.5 bg-slate-800/50 border border-white/5 text-slate-400 rounded-xl hover:text-blue-400 hover:border-blue-500/30 transition-all group"
          >
            <RefreshCw size={20} className={isLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
          </button>
          <div className="flex flex-col items-end">
             <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">REFRESCADO</span>
             <span className="text-xs font-bold text-blue-400">{lastRefreshed.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* FILTERS DRAWER */}
      <div className="px-8 py-4 bg-slate-900/30 border-b border-white/5 flex flex-wrap gap-4 shrink-0 overflow-x-auto custom-scrollbar">
        {[
          { label: 'Centro', value: selectedCentro, setter: setSelectedCentro, options: filterOptions.centros },
          { label: 'Transportista', value: selectedTransportista, setter: setSelectedTransportista, options: filterOptions.transportistas },
          { label: 'Responsable', value: selectedResponsable, setter: setSelectedResponsable, options: filterOptions.responsables },
          { label: 'Mes', value: selectedMes, setter: setSelectedMes, options: filterOptions.meses },
          { label: 'Día', value: selectedDia, setter: setSelectedDia, options: filterOptions.dias },
          { label: 'Semana', value: selectedSemana, setter: setSelectedSemana, options: ['TODOS', 'SEM 1', 'SEM 2', 'SEM 3', 'SEM 4'] },
          { label: 'Ruta', value: selectedRuta, setter: setSelectedRuta, options: filterOptions.rutas },
          { label: 'Alerta', value: selectedAlerta, setter: setSelectedAlerta, options: ['TODOS', 'CON ALERTA', 'SIN ALERTA'] }
        ].map((filter, i) => (
          <div key={i} className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">{filter.label}</label>
            <select
              value={filter.value}
              onChange={(e) => filter.setter(e.target.value)}
              className="bg-slate-800/80 border border-white/5 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-300 outline-none focus:ring-1 focus:ring-blue-500/50 transition-all cursor-pointer hover:bg-slate-700/80"
            >
              {filter.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        ))}
        
        <button 
          onClick={() => {
            setSelectedCentro('TODOS');
            setSelectedTransportista('TODOS');
            setSelectedResponsable('TODOS');
            setSelectedMes('TODOS');
            setSelectedDia('TODOS');
            setSelectedSemana('TODOS');
            setSelectedRuta('TODOS');
            setSelectedAlerta('TODOS');
            setSearchTerm('');
          }}
          className="mt-auto mb-1 px-4 py-1.5 bg-slate-800 border border-white/5 rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white hover:bg-rose-500/20 hover:border-rose-500/30 transition-all"
        >
          Limpiar
        </button>
      </div>

      <div className="flex-grow overflow-auto bg-[#0a0f1d] custom-scrollbar p-8">
        <div className="max-w-[1600px] mx-auto space-y-8">
          
          {/* KPI CARDS SECTION */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
            {[
              { label: 'Alertas Totales', value: stats.totalAlerts, icon: <AlertTriangle />, color: 'rose', critical: stats.totalAlerts > 0 },
              { label: 'Clientes Incumpl.', value: stats.clientsWithBreach, icon: <Users />, color: 'rose' },
              { label: 'Resp. Críticos', value: stats.criticalRespCount, icon: <ShieldAlert />, color: 'amber' }
            ].map((kpi, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`bg-[#1e293b]/60 backdrop-blur-xl border border-white/5 p-4 rounded-2xl flex flex-col justify-between group hover:border-blue-500/30 transition-all relative overflow-hidden`}
              >
                <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full blur-3xl opacity-5 bg-${kpi.color}-500 group-hover:opacity-20 transition-opacity`} />
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg bg-${kpi.color}-500/10 text-${kpi.color}-400 group-hover:scale-110 transition-transform`}>
                    {React.cloneElement(kpi.icon as React.ReactElement, { size: 18 })}
                  </div>
                  {kpi.critical && (
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  )}
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{kpi.label}</span>
                  <div className={`text-xl font-black text-white mt-1 uppercase`}>{kpi.value}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* MAIN VISUALS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            
            {/* TOP OFFENDERS - RESPONSABLES */}
            <div className="bg-[#1e293b]/40 border border-white/5 rounded-3xl p-6 flex flex-col h-[400px]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Top Incumplimientos — Responsables</h3>
                </div>
                <Info className="text-slate-600 cursor-help" size={16} />
              </div>
              <div className="flex-grow">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={topResponsables} 
                    layout="vertical" 
                    margin={{ left: 20, right: 30 }}
                    onClick={(state) => {
                      if (state && state.activeLabel) {
                        setSelectedResponsable(prev => prev === state.activeLabel ? 'TODOS' : state.activeLabel as string);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      tick={{ fill: COLORS.slate, fontSize: 10, fontWeight: 'bold' }}
                      width={120}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ReTooltip 
                      contentStyle={{ backgroundColor: COLORS.cardBg, borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Bar 
                      dataKey="alerts" 
                      name="Alertas"
                      fill={COLORS.neonRed} 
                      radius={[0, 4, 4, 0]}
                      barSize={12}
                    >
                      <LabelList dataKey="alerts" position="right" fill={COLORS.slate} fontSize={10} offset={10} />
                      {topResponsables.map((entry, index) => (
                        <Cell key={index} fill={entry.alerts > 15 ? COLORS.neonRed : entry.alerts > 5 ? COLORS.neonYellow : COLORS.neonBlue} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* TOP OFFENDERS - CLIENTES */}
            <div className="bg-[#1e293b]/40 border border-white/5 rounded-3xl p-6 flex flex-col h-[400px]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-cyan-500 rounded-full" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Top Incumplimientos — Clientes</h3>
                </div>
                <Users className="text-slate-600" size={16} />
              </div>
              <div className="flex-grow space-y-4 overflow-y-auto custom-scrollbar pr-2">
                {topClients.map((client, i) => (
                   <div 
                    key={i} 
                    onClick={() => {
                      setSearchTerm(prev => prev === client.id ? '' : client.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all group cursor-pointer ${searchTerm === client.id ? 'bg-cyan-500/20 border-cyan-500/50' : 'bg-white/5 border-white/5 hover:border-cyan-500/30'}`}
                   >
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-black text-xs">
                          {i + 1}
                        </div>
                        <div>
                          <div className="text-[11px] font-black text-white uppercase truncate max-w-[180px]">{client.name}</div>
                          <div className="text-[9px] font-bold text-slate-500">ID: {client.id}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                           <span className="text-[10px] font-black text-rose-400">{client.alerts} ALERTAS</span>
                           <span className="text-[9px] font-bold text-slate-500">{client.reincidencias} REINCID.</span>
                        </div>
                        <div className="w-10 h-10 rounded-full border-2 border-slate-700 flex items-center justify-center relative">
                           <div className="absolute inset-0 rounded-full border-2 border-rose-500 border-t-transparent animate-spin opacity-20" />
                           <span className="text-[10px] font-bold text-white">{Math.min(100, Math.round((client.alerts/10)*100))}%</span>
                        </div>
                      </div>
                   </div>
                ))}
              </div>
            </div>

            {/* ANALISIS DE MONTOS & ALERTAS DONUT */}
            <div className="grid grid-rows-2 gap-8 h-[400px]">
              <div className="bg-[#1e293b]/40 border border-white/5 rounded-3xl p-6 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                   <TrendingUp size={64} className="text-blue-500" />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-3">
                  <TrendingUp className="text-emerald-500" size={18} /> Dinero en efectivo
                </h3>
                <div className="flex-grow">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                      data={trendData}
                      onClick={(state) => {
                        if (state && state.activeLabel) {
                          const val = String(state.activeLabel);
                          setSelectedDia(prev => prev === val ? 'TODOS' : val);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <defs>
                        <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" hide />
                      <ReTooltip 
                        contentStyle={{ backgroundColor: COLORS.cardBg, borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff', fontSize: '11px' }}
                        labelStyle={{ color: COLORS.slate, fontWeight: 'bold', marginBottom: '4px' }}
                        formatter={(value: number) => [formatCurrency(value), 'Monto']}
                      />
                      <Area type="monotone" dataKey="amount" name="Monto" stroke={COLORS.blue} fillOpacity={1} fill="url(#colorAmt)" strokeWidth={3}>
                        <LabelList dataKey="amount" position="top" fill={COLORS.slate} fontSize={8} formatter={(v: number) => `$${(v/1000000).toFixed(1)}M`} />
                      </Area>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#1e293b]/40 border border-white/5 rounded-3xl p-6 flex items-center gap-6">
                <div className="w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={alertData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {alertData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ReTooltip 
                        contentStyle={{ backgroundColor: COLORS.cardBg, borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff', fontSize: '11px' }}
                        formatter={(value: number) => [value, 'Registros']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-3">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Alertas Operativas</h3>
                  {alertData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[10px] font-bold text-slate-300 uppercase">{item.name}</span>
                      </div>
                      <span className="text-sm font-black text-white">{item.value}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-white/5">
                    <div className="text-[9px] font-bold text-slate-500 uppercase">Índice de Alerta</div>
                    <div className="text-lg font-black text-rose-500">
                      {((alertData[1].value / (alertData[0].value + alertData[1].value || 1)) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* LOWER SECTION GRID */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* ALERTAS MENSUALES */}
            <div className="bg-[#1e293b]/40 border border-white/5 rounded-3xl p-6 flex flex-col h-[350px]">
              <h3 className="text-sm font-black text-white uppercase tracking-wider mb-6 flex items-center gap-3">
                <Calendar className="text-blue-500" size={18} /> Alertas Mensuales
              </h3>
              <div className="flex-grow">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={monthlyAlertsData}
                    onClick={(state) => {
                      if (state && state.activeLabel) {
                        const val = String(state.activeLabel);
                        setSelectedMes(prev => prev === val ? 'TODOS' : val);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: COLORS.slate, fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: COLORS.slate, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <ReTooltip 
                      contentStyle={{ backgroundColor: COLORS.cardBg, borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                      labelStyle={{ color: COLORS.slate, fontWeight: 'bold', marginBottom: '4px' }}
                      formatter={(value: number) => [value, 'Alertas']}
                    />
                    <Bar dataKey="alerts" name="Alertas" fill={COLORS.blue} radius={[4, 4, 0, 0]} barSize={40}>
                      <LabelList dataKey="alerts" position="top" fill={COLORS.slate} fontSize={10} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ALERTAS SEMANALES */}
            <div className="bg-[#1e293b]/40 border border-white/5 rounded-3xl p-6 flex flex-col h-[350px]">
              <h3 className="text-sm font-black text-white uppercase tracking-wider mb-6 flex items-center gap-3">
                <Target className="text-cyan-500" size={18} /> Alertas Semanales
              </h3>
              <div className="flex-grow">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={weeklyAlertsData}
                    onClick={(state) => {
                      if (state && state.activeLabel) {
                        const val = String(state.activeLabel);
                        setSelectedSemana(prev => prev === val ? 'TODOS' : val);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: COLORS.slate, fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: COLORS.slate, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <ReTooltip 
                      contentStyle={{ backgroundColor: COLORS.cardBg, borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                      labelStyle={{ color: COLORS.slate, fontWeight: 'bold', marginBottom: '4px' }}
                      formatter={(value: number) => [value, 'Alertas']}
                    />
                    <Bar dataKey="alerts" name="Alertas" fill={COLORS.cyan} radius={[4, 4, 0, 0]} barSize={40}>
                      <LabelList dataKey="alerts" position="top" fill={COLORS.slate} fontSize={10} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

             {/* ALERTAS DIARIAS */}
             <div className="bg-[#1e293b]/40 border border-white/5 rounded-3xl p-6 flex flex-col h-[350px]">
                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-6 flex items-center gap-3">
                  <Clock className="text-rose-500" size={18} /> Alertas Diarias
                </h3>
                <div className="flex-grow">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                      data={dailyAlertsData}
                      onClick={(state) => {
                        if (state && state.activeLabel) {
                          const val = String(state.activeLabel);
                          setSelectedDia(prev => prev === val ? 'TODOS' : val);
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <defs>
                        <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.neonRed} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={COLORS.neonRed} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: COLORS.slate, fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: COLORS.slate, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <ReTooltip 
                        contentStyle={{ backgroundColor: COLORS.cardBg, borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        itemStyle={{ color: COLORS.neonRed, fontSize: '11px', fontWeight: 'bold' }}
                        labelStyle={{ color: COLORS.slate, fontWeight: 'bold', marginBottom: '4px' }}
                        formatter={(value: number) => [value, 'Alertas']}
                      />
                      <Area type="monotone" dataKey="alerts" name="Alertas" stroke={COLORS.neonRed} fillOpacity={1} fill="url(#colorAlerts)" strokeWidth={3}>
                         <LabelList dataKey="alerts" position="top" fill={COLORS.slate} fontSize={10} />
                      </Area>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
             </div>
          </div>

          {/* OPERATIONAL TABLE SECTION */}
          <div className="bg-[#1e293b]/40 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="px-8 py-6 border-b border-white/5 bg-slate-800/20 flex flex-col md:flex-row items-center justify-between gap-4">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400">
                    <FileText size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">Detalle Operativo</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total: {filteredData.length} Registros</p>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <button className="px-4 py-2 bg-slate-800 border border-white/5 rounded-xl text-[10px] font-black text-slate-300 uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center gap-2">
                    <Download size={14} /> Exportar CSV
                  </button>
               </div>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
               <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/50">
                      <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Fecha / Ruta</th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Cliente</th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">PLACA</th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">RR</th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">Importe</th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Alerta</th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Transportista</th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">Filtros</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-20 text-center">
                           <RefreshCw className="animate-spin text-blue-500 mx-auto mb-4" size={32} />
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Procesando registros operativos...</p>
                        </td>
                      </tr>
                    ) : filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-20 text-center">
                           <ShieldAlert className="text-slate-700 mx-auto mb-4" size={48} />
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">No se encontraron datos para los filtros seleccionados</p>
                        </td>
                      </tr>
                    ) : (
                      filteredData.slice(0, 50).map((row) => (
                        <tr key={row.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="px-6 py-4">
                             <div className="text-[11px] font-black text-white">{row.fecha}</div>
                             <div className="text-[9px] font-bold text-slate-500 uppercase">RUTA: {row.ruta}</div>
                          </td>
                          <td className="px-6 py-4">
                             <div className="text-[11px] font-black text-blue-400 uppercase truncate max-w-[200px]">{row.nombreCliente}</div>
                             <div className="text-[9px] font-bold text-slate-500">ID: {row.clienteId}</div>
                          </td>
                          <td className="px-6 py-4">
                             <div className="text-[11px] font-black text-white">{row.placa}</div>
                          </td>
                          <td className="px-6 py-4">
                             <div className="text-[10px] font-bold text-slate-300 uppercase">{row.rr}</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className="text-[11px] font-black text-emerald-400">{formatCurrency(row.importe)}</div>
                             <div className="text-[9px] font-bold text-slate-600 uppercase">{row.recibo}</div>
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex justify-center">
                               <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-current bg-opacity-10 ${getAlertColor(row.alerta)}`}>
                                 {row.alerta || 'PENDIENTE'}
                               </div>
                             </div>
                          </td>
                          <td className="px-6 py-4">
                             <div className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[120px]">{row.transportista}</div>
                          </td>
                          <td className="px-6 py-4">
                             <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-800 px-2 py-1 rounded">{row.filtros}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
               </table>
            </div>
            {filteredData.length > 50 && (
              <div className="px-8 py-4 bg-slate-900/50 text-center border-t border-white/5">
                 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Mostrando primeros 50 de {filteredData.length} registros</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default SafetyCashlessDashboard;
