import React, { useState, useEffect } from 'react';
import { CashlessRecord } from '../types';
import { fetchCashlessFromSheet } from '../services/sheetService';
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
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

interface CashlessModuleProps {
  onBack: () => void;
  searchTerm: string;
}

const CashlessModule: React.FC<CashlessModuleProps> = ({ onBack, searchTerm: externalSearchTerm }) => {
  const [records, setRecords] = useState<CashlessRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<string>('TODOS');
  const [selectedValidator, setSelectedValidator] = useState<string>('TODOS');
  const [selectedMonth, setSelectedMonth] = useState<string>('TODOS');

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

  const validators = ['TODOS', ...Array.from(new Set(records.map(r => r.validador).filter(v => v !== '')))];
  const riskLevels = ['TODOS', ...Array.from(new Set(records.map(r => r.nivelRiesgo).filter(r => r !== '')))];
  const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

  const filteredRecords = records.filter(record => {
    const matchesSearch = 
      record.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.codigoCliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.barrio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.municipio.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRisk = selectedRisk === 'TODOS' || record.nivelRiesgo === selectedRisk;
    const matchesValidator = selectedValidator === 'TODOS' || record.validador === selectedValidator;

    let matchesMonth = true;
    if (selectedMonth !== 'TODOS' && record.fechaEjecucion) {
      const date = new Date(record.fechaEjecucion);
      const monthName = monthNames[date.getUTCMonth()];
      matchesMonth = monthName === selectedMonth;
    } else if (selectedMonth !== 'TODOS' && !record.fechaEjecucion) {
      matchesMonth = false;
    }

    return matchesSearch && matchesRisk && matchesValidator && matchesMonth;
  });

  const stats = {
    total: filteredRecords.length,
    executed: filteredRecords.filter(r => r.fechaEjecucion !== '').length,
    pending: filteredRecords.filter(r => r.fechaEjecucion === '').length,
    highRisk: filteredRecords.filter(r => r.nivelRiesgo.toUpperCase().includes('ALTO')).length,
    compliance: filteredRecords.length > 0 
      ? (filteredRecords.filter(r => r.fechaEjecucion !== '').length / filteredRecords.length) * 100 
      : 0,
  };

  // Data for Rating Chart
  const ratingCounts = filteredRecords
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
  const executionCounts = filteredRecords
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

  // Data for Monthly Chart
  const monthlyCounts = filteredRecords
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
    .filter(m => m.count > 0);

  const getRiskColor = (risk: string) => {
    const r = risk.toUpperCase();
    if (r.includes('ALTO')) return 'text-rose-600 bg-rose-50 border-rose-100';
    if (r.includes('MEDIO')) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-emerald-600 bg-emerald-50 border-emerald-100';
  };

  return (
    <div className="flex flex-col space-y-8 pb-12">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Módulo Cashless</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Seguimiento de Clientes y Visitas</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={loadData}
            disabled={isLoading}
            className="p-3 bg-slate-50 border rounded-xl text-slate-600 hover:bg-slate-100 transition-all shadow-sm"
          >
            <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={onBack}
            className="px-8 py-3 bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-700 transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
          >
            <ChevronLeft size={16} /> Volver
          </button>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Clientes', value: stats.total, icon: <User className="text-blue-600" />, color: 'bg-blue-50' },
          { label: 'Ejecutados', value: stats.executed, icon: <CheckCircle2 className="text-emerald-600" />, color: 'bg-emerald-50' },
          { label: 'Pendientes', value: stats.pending, icon: <Clock className="text-amber-600" />, color: 'bg-amber-50' },
          { label: '% Cumplimiento', value: `${stats.compliance.toFixed(1)}%`, icon: <TrendingUp className="text-rose-600" />, color: 'bg-rose-50' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-8 rounded-[2.5rem] border shadow-sm flex items-center gap-6 hover:shadow-md transition-shadow"
          >
            <div className={`w-14 h-14 ${stat.color} rounded-2xl flex items-center justify-center shrink-0`}>
              {stat.icon}
            </div>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</div>
              <div className="text-3xl font-black text-slate-800 tracking-tight">{stat.value}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Rating Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-[2.5rem] border shadow-sm h-[450px] flex flex-col"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <TrendingUp size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Calificación</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Distribución de resultados</p>
            </div>
          </div>
          <div className="flex-grow min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratingData} layout="vertical" margin={{ left: 10, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontBold: 800, fill: '#64748b' }}
                  width={100}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                  {ratingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b'][index % 5]} />
                  ))}
                  <LabelList dataKey="value" position="right" style={{ fontSize: '10px', fontWeight: '800', fill: '#64748b' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Monthly Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-[2.5rem] border shadow-sm h-[450px] flex flex-col"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <BarChart size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Mensual</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Visitas por mes</p>
            </div>
          </div>
          <div className="flex-grow min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40}>
                  <LabelList dataKey="count" position="top" style={{ fontSize: '10px', fontWeight: '800', fill: '#64748b' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Execution Date Chart - Full Width */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border shadow-sm h-[400px] flex flex-col"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <Calendar size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Histórico Diario</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tendencia de ejecución</p>
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
                  minTickGap={40}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#10b981" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-6 rounded-[2rem] border shadow-sm flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl border">
          <Filter size={18} className="text-slate-400" />
          <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Panel de Filtros:</span>
        </div>

        <div className="flex flex-col gap-2 min-w-[180px]">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nivel de Riesgo</label>
          <select 
            value={selectedRisk}
            onChange={(e) => setSelectedRisk(e.target.value)}
            className="bg-slate-50 border rounded-xl px-5 py-3 text-[11px] font-bold uppercase outline-none focus:ring-2 focus:ring-slate-200 transition-all appearance-none cursor-pointer"
          >
            {riskLevels.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-2 min-w-[180px]">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Validador Asignado</label>
          <select 
            value={selectedValidator}
            onChange={(e) => setSelectedValidator(e.target.value)}
            className="bg-slate-50 border rounded-xl px-5 py-3 text-[11px] font-bold uppercase outline-none focus:ring-2 focus:ring-slate-200 transition-all appearance-none cursor-pointer"
          >
            {validators.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-2 min-w-[150px]">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mes Ejecución</label>
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-50 border rounded-xl px-5 py-3 text-[11px] font-bold uppercase outline-none focus:ring-2 focus:ring-slate-200 transition-all appearance-none cursor-pointer"
          >
            {['TODOS', ...monthNames].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="flex-grow"></div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="BUSCAR POR CLIENTE O CÓDIGO..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border rounded-2xl pl-14 pr-6 py-4 text-[11px] font-bold uppercase outline-none focus:ring-2 focus:ring-slate-200 transition-all shadow-inner"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
        <div className="p-8 border-b bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Detalle de Registros</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Listado completo de clientes y visitas</p>
          </div>
          <div className="text-[10px] font-black text-slate-500 bg-white px-4 py-2 rounded-full border shadow-sm uppercase tracking-widest">
            {filteredRecords.length} Resultados
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-8 py-32 text-center">
                    <Loader2 className="animate-spin text-slate-300 mx-auto mb-6" size={48} />
                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Sincronizando información...</div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-32 text-center">
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
                        <CheckCircle2 size={14} className={record.fechaEjecucion ? 'text-emerald-500' : 'text-slate-300'} />
                        <span className={record.fechaEjecucion ? 'text-slate-700' : 'text-slate-400 italic'}>
                          {record.fechaEjecucion || 'PENDIENTE'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="inline-block px-4 py-2 bg-slate-800 text-white rounded-xl text-[11px] font-black shadow-md">
                        {record.calificacion || '---'}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Loader2 = ({ size, className }: { size: number, className?: string }) => (
  <RefreshCw size={size} className={`${className} animate-spin`} />
);

export default CashlessModule;
