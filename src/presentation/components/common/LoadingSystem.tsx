import React from 'react';
import { CircularProgress } from '@mui/material';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export const LoadingSystem: React.FC<LoadingProps> = ({ message = 'Synchronizing ERP Live Data...', fullScreen = false }) => {
  const content = (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
      <div className="relative">
        <CircularProgress size={48} sx={{ color: '#10b981' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </div>
      </div>
      <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">{message}</span>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
};
