import React from 'react';
import { CreditCard, Rocket, Clock } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  onBack?: () => void;
}

const CashlessComingSoon: React.FC<Props> = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white rounded-[3rem] shadow-xl border-2 border-dashed border-slate-200">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-24 h-24 bg-blue-50 rounded-[2rem] flex items-center justify-center mb-8 shadow-inner"
      >
        <CreditCard size={48} className="text-blue-500 animate-pulse" />
      </motion.div>
      
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tight mb-4">
          GESTIÓN <span className="text-blue-600">CASHLESS</span>
        </h2>
        <div className="inline-flex items-center gap-2 px-6 py-2 bg-amber-50 text-amber-600 rounded-full text-[11px] font-black uppercase tracking-widest border border-amber-100 mb-8 shadow-sm">
          <Clock size={14} /> PRÓXIMAMENTE
        </div>
        
        <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-md mx-auto">
          Estamos desarrollando una plataforma integral para la gestión y control de pagos electrónicos y transacciones sin efectivo.
        </p>
      </motion.div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 w-full max-w-2xl"
      >
        {[
          { label: 'CONTROL TOTAL', icon: <CreditCard size={20} /> },
          { label: 'TRANSACCIONES', icon: <Rocket size={20} /> },
          { label: 'AUDITORÍA', icon: <Clock size={20} /> }
        ].map((item, i) => (
          <div key={i} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center gap-3">
            <div className="text-blue-500 opacity-60">{item.icon}</div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</div>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default CashlessComingSoon;
