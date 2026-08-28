import React from 'react';
import { ShieldAlert, RefreshCw, Home } from 'lucide-react';

interface ErrorPageProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export const ErrorPage: React.FC<ErrorPageProps> = ({
  title = 'Access Restricted or Module Error',
  description = 'Your user role does not possess permissions to view or alter this module.',
  onRetry
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 max-w-lg mx-auto text-center space-y-5 shadow-2xl my-12">
      <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">{description}</p>
      </div>

      <div className="flex items-center justify-center gap-3 pt-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Retry Action
          </button>
        )}
      </div>
    </div>
  );
};
