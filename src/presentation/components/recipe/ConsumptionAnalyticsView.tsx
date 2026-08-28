import React, { useState, useEffect } from 'react';
import { ConsumptionStat } from '../../../domain/entities/recipe';
import { RecipeController } from '../../../controllers/RecipeController';
import { recipeDict, RecipeLang } from './translations';
import { TrendingUp, Activity, Flame, Zap, ArrowDown, ArrowUp } from 'lucide-react';

interface ConsumptionAnalyticsViewProps {
  controller: RecipeController;
  lang: RecipeLang;
}

export const ConsumptionAnalyticsView: React.FC<ConsumptionAnalyticsViewProps> = ({
  controller,
  lang
}) => {
  const t = recipeDict[lang] || recipeDict.en;

  const [stats, setStats] = useState<ConsumptionStat[]>([]);
  const [filter, setFilter] = useState<'all' | 'fast' | 'slow' | 'moderate'>('all');

  useEffect(() => {
    controller.getConsumptionAnalytics().then(setStats);
  }, [controller]);

  const filteredStats = stats.filter((s) => (filter === 'all' ? true : s.movementType === filter));

  const totalUsedCost = stats.reduce((sum, s) => sum + s.totalCost, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" />
            {t.consumption.title}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time tracking of ingredient burn rates, fast/slow moving velocity, and total cost of consumption.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === 'all' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('fast')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
              filter === 'fast' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            {t.consumption.fastMoving}
          </button>
          <button
            onClick={() => setFilter('slow')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              filter === 'slow' ? 'bg-rose-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.consumption.slowMoving}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-1">
          <p className="text-xs text-slate-400 font-bold">Total Consumption Cost</p>
          <p className="text-2xl font-black text-amber-400 font-mono">${totalUsedCost.toFixed(2)}</p>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-1">
          <p className="text-xs text-slate-400 font-bold">Tracked Ingredients</p>
          <p className="text-2xl font-black text-white font-mono">{stats.length}</p>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-1">
          <p className="text-xs text-slate-400 font-bold">Fast-Moving High Velocity Items</p>
          <p className="text-2xl font-black text-emerald-400 font-mono">
            {stats.filter((s) => s.movementType === 'fast').length} Items
          </p>
        </div>
      </div>

      {/* Analytics Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[10px] uppercase font-bold text-slate-400 bg-slate-950">
              <tr>
                <th className="p-3 rounded-l-xl">Ingredient Name</th>
                <th className="p-3">Velocity Speed</th>
                <th className="p-3">{t.consumption.avgDaily}</th>
                <th className="p-3">{t.consumption.avgMonthly}</th>
                <th className="p-3">Total Deductions</th>
                <th className="p-3 text-right rounded-r-xl">Total Cost ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredStats.map((st) => (
                <tr key={st.ingredientId} className="hover:bg-slate-950/40">
                  <td className="p-3 font-bold text-white">{st.ingredientName}</td>
                  <td className="p-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        st.movementType === 'fast'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : st.movementType === 'slow'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {st.movementType === 'fast'
                        ? t.consumption.fastMoving
                        : st.movementType === 'slow'
                        ? t.consumption.slowMoving
                        : t.consumption.moderate}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-amber-400 font-bold">
                    {st.averageDailyUsage} {st.unit}/day
                  </td>
                  <td className="p-3 font-mono text-slate-300">
                    {st.averageMonthlyUsage} {st.unit}/month
                  </td>
                  <td className="p-3 text-slate-400">{st.movementCount} Orders / Events</td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-400">
                    ${st.totalCost?.toFixed(2)}
                  </td>
                </tr>
              ))}

              {filteredStats.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No consumption data recorded for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
