import React, { useState, useEffect } from 'react';
import { IngredientForecast } from '../../../domain/entities/recipe';
import { RecipeController } from '../../../controllers/RecipeController';
import { recipeDict, RecipeLang } from './translations';
import { TrendingUp, AlertTriangle, CheckCircle2, ShoppingCart, Calendar, ArrowRight } from 'lucide-react';

interface ForecastingViewProps {
  controller: RecipeController;
  lang: RecipeLang;
}

export const ForecastingView: React.FC<ForecastingViewProps> = ({ controller, lang }) => {
  const t = recipeDict[lang] || recipeDict.en;

  const [forecasts, setForecasts] = useState<IngredientForecast[]>([]);

  useEffect(() => {
    controller.getIngredientForecasts().then(setForecasts);
  }, [controller]);

  const urgentCount = forecasts.filter((f) => f.reorderStatus === 'urgent').length;
  const warningCount = forecasts.filter((f) => f.reorderStatus === 'warning').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            {t.forecasting.title}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Predict inventory stock depletion dates based on order velocity and auto-generate purchase order quantities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {urgentCount > 0 && (
            <span className="px-3 py-1.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              {urgentCount} Urgent Reorders Required
            </span>
          )}
        </div>
      </div>

      {/* Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {forecasts.map((fc) => (
          <div
            key={fc.ingredientId}
            className={`bg-slate-900 border rounded-3xl p-5 space-y-4 shadow-xl flex flex-col justify-between transition ${
              fc.reorderStatus === 'urgent'
                ? 'border-rose-500/50 shadow-rose-950/20'
                : fc.reorderStatus === 'warning'
                ? 'border-amber-500/50 shadow-amber-950/20'
                : 'border-slate-800'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">{fc.ingredientName}</h3>
                  <p className="text-xs text-slate-400">Current Stock: {fc.currentStock} {fc.unit}</p>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    fc.reorderStatus === 'urgent'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : fc.reorderStatus === 'warning'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : fc.reorderStatus === 'overstocked'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {fc.reorderStatus}
                </span>
              </div>

              {/* Days Remaining Meter */}
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400">{t.forecasting.daysRemaining}:</span>
                  <span
                    className={`font-mono text-sm font-black ${
                      fc.daysRemaining <= 3
                        ? 'text-rose-400'
                        : fc.daysRemaining <= 7
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {fc.daysRemaining} Days
                  </span>
                </div>

                <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                  <div
                    style={{ width: `${Math.min(100, (fc.daysRemaining / 30) * 100)}%` }}
                    className={`h-full rounded-full ${
                      fc.daysRemaining <= 3
                        ? 'bg-rose-500'
                        : fc.daysRemaining <= 7
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                  />
                </div>
              </div>

              {/* Reorder Recommendation */}
              <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">{t.forecasting.suggestedReorder}:</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {fc.suggestedReorderQuantity} {fc.unit}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 italic pt-1 border-t border-slate-800/80">
                  {fc.purchaseRecommendation}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-mono">
                30-day forecast: {fc.expectedConsumptionNext30Days} {fc.unit}
              </span>
              <button className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] flex items-center gap-1 cursor-pointer transition">
                <ShoppingCart className="w-3.5 h-3.5" />
                Auto PO
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
