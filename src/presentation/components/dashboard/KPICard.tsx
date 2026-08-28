import React from 'react';
import { LucideIcon, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  sublabel?: string;
  change?: number; // e.g. +12.5 or -3.2
  changeLabel?: string;
  icon: LucideIcon;
  iconColor?: 'emerald' | 'teal' | 'amber' | 'rose' | 'indigo' | 'blue' | 'purple';
  progress?: number; // 0 to 100
  badgeText?: string;
  badgeType?: 'success' | 'warning' | 'danger' | 'info';
  onClick?: () => void;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  sublabel,
  change,
  changeLabel = 'vs last period',
  icon: Icon,
  iconColor = 'emerald',
  progress,
  badgeText,
  badgeType = 'info',
  onClick
}) => {
  const colorMap = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
  };

  const badgeStyles = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  };

  return (
    <div
      onClick={onClick}
      className={`bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg relative overflow-hidden transition-all duration-200 ${
        onClick ? 'hover:border-slate-700 cursor-pointer hover:scale-[1.01]' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 truncate">{title}</span>
        <div className={`p-2.5 rounded-2xl border ${colorMap[iconColor]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-2xl font-extrabold text-white tracking-tight truncate">{value}</h3>
          {badgeText && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeStyles[badgeType]}`}>
              {badgeText}
            </span>
          )}
        </div>

        {/* Change or sublabel */}
        <div className="mt-2 flex items-center justify-between text-[11px]">
          {change !== undefined ? (
            <div
              className={`flex items-center gap-1 font-bold ${
                change > 0 ? 'text-emerald-400' : change < 0 ? 'text-rose-400' : 'text-slate-400'
              }`}
            >
              {change > 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : change < 0 ? (
                <ArrowDownRight className="w-3.5 h-3.5" />
              ) : (
                <Minus className="w-3.5 h-3.5" />
              )}
              <span>{change > 0 ? `+${change}%` : `${change}%`}</span>
              <span className="text-slate-500 font-normal ml-0.5">{changeLabel}</span>
            </div>
          ) : sublabel ? (
            <span className="text-slate-400 text-[10px] font-medium">{sublabel}</span>
          ) : null}
        </div>

        {/* Optional Progress Bar */}
        {progress !== undefined && (
          <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                progress > 75 ? 'bg-emerald-400' : progress > 40 ? 'bg-amber-400' : 'bg-rose-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
