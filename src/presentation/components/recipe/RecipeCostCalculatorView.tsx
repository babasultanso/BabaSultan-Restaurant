import React, { useState, useEffect } from 'react';
import { Recipe } from '../../../domain/entities/recipe';
import { recipeDict, RecipeLang } from './translations';
import { Calculator, AlertTriangle, RefreshCw, AlertCircle } from 'lucide-react';

interface RecipeCostCalculatorViewProps {
  recipes: Recipe[];
  lang: RecipeLang;
}

export const RecipeCostCalculatorView: React.FC<RecipeCostCalculatorViewProps> = ({
  recipes,
  lang
}) => {
  const t = recipeDict[lang] || recipeDict.en;

  const [selectedRecipeId, setSelectedRecipeId] = useState(recipes && recipes.length > 0 ? recipes[0].id : '');
  const activeRecipe = recipes.find((r) => r.id === selectedRecipeId) || (recipes.length > 0 ? recipes[0] : null);

  const [scenarioPrice, setScenarioPrice] = useState<number>(0);
  const [scenarioCostMultiplier, setScenarioCostMultiplier] = useState<number>(100); // 100% = normal authoritative cost

  useEffect(() => {
    if (activeRecipe) {
      setScenarioPrice(activeRecipe.sellingPrice || 0);
      setScenarioCostMultiplier(100);
    } else {
      setScenarioPrice(0);
      setScenarioCostMultiplier(100);
    }
  }, [activeRecipe?.id, activeRecipe?.sellingPrice]);

  // Recalculate based on authoritative base cost and What-If scenario inputs
  const originalCost = activeRecipe?.totalCost || 0;
  const scenarioCost = originalCost * (scenarioCostMultiplier / 100);
  const foodCostPct = scenarioPrice > 0 ? (scenarioCost / scenarioPrice) * 100 : 0;
  const grossProfit = scenarioPrice - scenarioCost;
  const grossMargin = scenarioPrice > 0 ? (grossProfit / scenarioPrice) * 100 : 0;

  const handleSelectRecipe = (id: string) => {
    setSelectedRecipeId(id);
    const rec = recipes.find((r) => r.id === id);
    if (rec) {
      setScenarioPrice(rec.sellingPrice || 0);
      setScenarioCostMultiplier(100);
    }
  };

  if (!recipes || recipes.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 p-12 rounded-3xl text-center">
        <Calculator className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-white mb-1">
          {lang === 'ar' ? 'لا توجد وصفات لتحليل السيناريوهات' : 'No Recipes Found for Scenario Analysis'}
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          {lang === 'ar'
            ? 'يرجى إنشاء وصفة طعام في قسم إدارة الوصفات لعرض وتحليل تكلفة الطعام وحساب هوامش الربح الافتراضية.'
            : 'Please add recipes in the Recipe Management tab to analyze food cost and profit margins.'}
        </p>
      </div>
    );
  }

  if (!activeRecipe) {
    return null;
  }

  const hasMissingPrice = !activeRecipe.sellingPrice || activeRecipe.sellingPrice === 0;
  const hasMissingCost = !activeRecipe.totalCost || activeRecipe.totalCost === 0;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-2">
        <h2 className="text-base font-black text-white flex items-center gap-2">
          <Calculator className="w-5 h-5 text-amber-400" />
          {lang === 'ar' ? 'تحليل سيناريو افتراضي (What-If Scenario Analysis)' : 'What-If Scenario Cost Analysis'}
        </h2>
        <p className="text-xs text-slate-400">
          {lang === 'ar'
            ? 'نمذجة رياضية لاختبار أثر تغير أسعار الموردين أو تعديل أسعار البيع على هامش الربح وتكلفة الطعام بناءً على بيانات الوصفة الحقيقية.'
            : 'Interactive what-if mathematical modeling to test price elasticity and ingredient inflation based on authoritative recipe data.'}
        </p>
      </div>

      {(hasMissingPrice || hasMissingCost) && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-2xl text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">
              {lang === 'ar' ? 'تنبيه تكوين الوصفة' : 'Recipe Configuration Notice'}
            </div>
            <p className="text-amber-400/80 mt-0.5">
              {hasMissingPrice && (lang === 'ar' ? 'هذه الوصفة ليس لها سعر بيع مسجل. يرجى إدخال سعر تجريبي في شريط التمرير أدناه أو تعديل الوصفة.' : 'This recipe has no registered selling price. Set a what-if price in the controls below or update the recipe.')}
              {hasMissingCost && (lang === 'ar' ? ' تكلفة مكونات الوصفة تساوي 0، يرجى مراجعة أسعار المكونات.' : ' Ingredient total cost is 0, please check recipe ingredient prices.')}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              {lang === 'ar' ? 'اختر الوصفة للتحليل' : 'Select Recipe for What-If Analysis'}
            </label>
            <select
              value={selectedRecipeId}
              onChange={(e) => handleSelectRecipe(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.recipeName} (${(r.sellingPrice || 0).toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className="text-slate-300">{(t.calculator as any).scenarioPrice || 'What-If Selling Price'}:</span>
                <span className="text-amber-400 font-mono text-sm">${scenarioPrice.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={scenarioPrice}
                onChange={(e) => setScenarioPrice(parseFloat(e.target.value) || 0)}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-2">
                <span className="text-slate-300">
                  {lang === 'ar' ? 'تغير تكلفة المكونات (تضخم الموردين):' : 'Ingredient Cost Inflation / Change:'}
                </span>
                <span className="text-emerald-400 font-mono text-sm">{scenarioCostMultiplier}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="250"
                step="5"
                value={scenarioCostMultiplier}
                onChange={(e) => setScenarioCostMultiplier(parseInt(e.target.value) || 100)}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                100% = {lang === 'ar' ? 'التكلفة الحقيقية المسجلة' : 'Authoritative Base Cost'} (${originalCost.toFixed(2)}).
              </p>
            </div>

            <button
              onClick={() => {
                setScenarioPrice(activeRecipe.sellingPrice || 0);
                setScenarioCostMultiplier(100);
              }}
              className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {lang === 'ar' ? 'إعادة التعيين إلى البيانات الحقيقية' : 'Reset to Authoritative Data'}
            </button>
          </div>
        </div>

        {/* Results Visualizer Column */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white">{activeRecipe.recipeName}</h3>
                <p className="text-xs text-slate-400">Linked to {activeRecipe.productName || 'Menu Item'}</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold font-mono ${
                  foodCostPct <= 30
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : foodCostPct <= 35
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {foodCostPct.toFixed(1)}% Food Cost
              </span>
            </div>

            {/* Metric Gauges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                <p className="text-xs text-slate-400 font-bold">{(t.calculator as any).scenarioCost || 'Scenario Cost'} / Portion</p>
                <p className="text-xl font-black text-amber-400 font-mono">${scenarioCost.toFixed(2)}</p>
                <p className="text-[10px] text-slate-500">Base Cost: ${originalCost.toFixed(2)}</p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                <p className="text-xs text-slate-400 font-bold">Gross Profit / Portion</p>
                <p className="text-xl font-black text-emerald-400 font-mono">${grossProfit.toFixed(2)}</p>
                <p className="text-[10px] text-slate-500">Margin: {grossMargin.toFixed(1)}%</p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                <p className="text-xs text-slate-400 font-bold">Estimated Profit for 100 Meals</p>
                <p className="text-xl font-black text-white font-mono">${(grossProfit * 100).toFixed(2)}</p>
                <p className="text-[10px] text-slate-500">Revenue: ${(scenarioPrice * 100).toFixed(2)}</p>
              </div>
            </div>

            {/* Visual Profit Bar Breakdown */}
            <div className="mt-8 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>Revenue Breakdown:</span>
                <span>${scenarioPrice.toFixed(2)} Total</span>
              </div>

              <div className="h-6 w-full bg-slate-950 rounded-xl overflow-hidden flex border border-slate-800">
                <div
                  style={{ width: `${Math.min(100, Math.max(0, foodCostPct))}%` }}
                  className="bg-amber-500 h-full flex items-center justify-center text-[10px] font-black text-slate-950"
                  title="Ingredient Cost"
                >
                  {foodCostPct > 15 && `${foodCostPct.toFixed(0)}% Cost`}
                </div>
                <div
                  style={{ width: `${Math.max(0, Math.min(100, 100 - foodCostPct))}%` }}
                  className="bg-emerald-500 h-full flex items-center justify-center text-[10px] font-black text-slate-950"
                  title="Gross Profit"
                >
                  {(100 - foodCostPct) > 15 && `${(100 - foodCostPct).toFixed(0)}% Profit`}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 text-xs text-slate-400 flex items-start gap-3 mt-6">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p>
              <strong>Profitability Tip:</strong> If ingredient inflation pushes Food Cost above 35%, consider raising the selling price to ${scenarioCost > 0 ? ((scenarioCost / 0.30)).toFixed(2) : '0.00'} to keep your food cost target at 30%.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

