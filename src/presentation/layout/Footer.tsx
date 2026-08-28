import React from 'react';
import { SYSTEM_CONFIG } from '../../constants';
import { useAuth } from '../context/AuthContext';

export const Footer: React.FC = () => {
  const { userRecord } = useAuth();
  const userRole = (userRecord?.role || '').toLowerCase().trim();
  const isHqUser = userRole === 'owner' || (userRole === 'admin' && (!userRecord?.branchId || userRecord?.branchId === 'all'));
  
  const branchLabel = isHqUser
    ? 'All Branches (HQ)'
    : (userRecord?.branchId ? `Branch: ${userRecord.branchId}` : 'Branch configuration required');

  return (
    <footer className="bg-slate-900 border-t border-slate-800/80 px-6 py-4 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-semibold text-slate-300">{SYSTEM_CONFIG.APP_NAME}</span>
        <span className="text-slate-600">|</span>
        <span>{SYSTEM_CONFIG.VERSION}</span>
      </div>

      <div className="flex items-center gap-4 text-[11px] text-slate-500">
        <span>Context: <strong className="text-slate-400">{branchLabel}</strong></span>
        <span>Currency: <strong className="text-emerald-400">{SYSTEM_CONFIG.CURRENCY_SYMBOL} {SYSTEM_CONFIG.CURRENCY}</strong></span>
        <span>Build Status: <strong className="text-emerald-400">PRODUCTION READY</strong></span>
      </div>
    </footer>
  );
};
