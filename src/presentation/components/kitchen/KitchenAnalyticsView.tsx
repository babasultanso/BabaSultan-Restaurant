import React, { useState, useEffect } from 'react';
import { KitchenTicket, KitchenStation, KitchenWasteLog } from '../../../domain/entities/kitchen';
import { kitchenService } from '../../../domain/services/kitchenService';
import { kdsDict, KitchenLang } from './translations';
import {
  Clock,
  AlertCircle,
  Flame,
  ChefHat,
  TrendingUp,
  Award,
  Trash2,
  BarChart3,
  CheckCircle2,
  Users,
  Activity,
  Calendar
} from 'lucide-react';

interface KitchenAnalyticsViewProps {
  tickets: KitchenTicket[];
  stations: KitchenStation[];
  wasteLogs: KitchenWasteLog[];
  lang: KitchenLang;
}

export const KitchenAnalyticsView: React.FC<KitchenAnalyticsViewProps> = ({
  tickets,
  stations,
  wasteLogs,
  lang
}) => {
  const t = kdsDict[lang] || kdsDict.en;
  const isRtl = lang === 'ar';

  const metrics = kitchenService.calculatePerformanceMetrics(tickets, stations, wasteLogs);

  const totalWasteCost = wasteLogs.reduce((sum, w) => sum + (w.cost || 0), 0);

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/30">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white">{t.kitchenAnalytics} & Performance Dashboard</h3>
            <p className="text-xs text-slate-400">Preparation speed, station workload, chef throughput & waste auditing</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-800 text-xs">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-slate-400">Kitchen Operational Status:</span>
          <span className="font-extrabold text-emerald-400">OPTIMAL</span>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400">{t.avgPrepTime}</p>
            <h4 className="text-2xl font-black text-white mt-1">{metrics.avgPrepTimeMinutes} <span className="text-xs text-amber-400">mins</span></h4>
            <p className="text-[10px] text-emerald-400 font-semibold mt-1">Target: &lt; 15 mins</p>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400">{t.activeOrders}</p>
            <h4 className="text-2xl font-black text-white mt-1">{metrics.activeOrdersCount} <span className="text-xs text-cyan-400">tickets</span></h4>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">Completed today: {metrics.completedOrdersCount}</p>
          </div>
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-2xl border border-cyan-500/20">
            <Flame className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400">{t.delayedCount}</p>
            <h4 className="text-2xl font-black text-rose-400 mt-1">{metrics.delayedOrdersCount}</h4>
            <p className="text-[10px] text-rose-400 font-semibold mt-1">
              {metrics.activeOrdersCount > 0 ? `${Math.round((metrics.delayedOrdersCount / metrics.activeOrdersCount) * 100)}% active delayed` : '0% delay rate'}
            </p>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl border border-rose-500/20">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400">Total Kitchen Waste</p>
            <h4 className="text-2xl font-black text-white mt-1">${(totalWasteCost || 0).toFixed(2)}</h4>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">{wasteLogs.length} waste incidents recorded</p>
          </div>
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/20">
            <Trash2 className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Station Performance Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h4 className="text-base font-extrabold text-white flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-amber-400" /> Kitchen Station Load & Efficiency
          </h4>
          <span className="text-xs text-slate-400">Real-time workstation distribution</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.stationStats.map((st, idx) => (
            <div key={idx} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-white text-sm">{st.stationName}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                  st.status === 'overloaded'
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    : st.status === 'busy'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}>
                  {st.status}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Active Tickets: <strong className="text-white">{st.activeCount}</strong></span>
                <span>Avg Speed: <strong className="text-amber-400">{st.avgPrepTime} mins</strong></span>
              </div>

              {/* Progress bar visual */}
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all ${
                    st.status === 'overloaded' ? 'bg-rose-500' : st.status === 'busy' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(15, st.activeCount * 25))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chef & Staff Throughput Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-base font-extrabold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-400" /> Line Chef Performance
            </h4>
            <span className="text-xs text-slate-400">Daily throughput</span>
          </div>

          <div className="space-y-3">
            {metrics.chefPerformance.map((chef, idx) => (
              <div key={idx} className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <h5 className="font-extrabold text-white text-sm">{chef.chefName}</h5>
                  <p className="text-slate-400 text-[11px] mt-0.5">{chef.station}</p>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-slate-400 text-[10px]">Prepared</p>
                    <p className="font-black text-emerald-400 text-sm">{chef.itemsCompleted} dishes</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-[10px]">Avg Speed</p>
                    <p className="font-black text-amber-400 text-sm">{chef.avgSpeedMins}m</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Kitchen Waste Audit Log */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-base font-extrabold text-white flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-400" /> Recent Kitchen Waste Audit
            </h4>
            <span className="text-xs text-slate-400">Ingredient / Dish Loss</span>
          </div>

          {wasteLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No waste incidents logged today. Excellent kitchen discipline!
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {wasteLogs.map((waste) => (
                <div key={waste.id} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-white">
                      <span>{waste.itemOrIngredientName}</span>
                      <span className="bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-md text-[10px] border border-rose-500/30">
                        {waste.quantity} {waste.unit}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{waste.reason} • By {waste.loggedBy}</p>
                  </div>

                  <span className="font-extrabold text-rose-400 text-xs">
                    -${(waste.cost || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
