import React, { useState, useEffect, useMemo } from 'react';
import { RecipeRepositoryImpl } from '../../../data/repositories/RecipeRepositoryImpl';
import { RecipeController } from '../../../controllers/RecipeController';
import { Recipe, Ingredient, UnitConversion, WasteRecord } from '../../../domain/entities/recipe';
import { Product } from '../../../types';
import { recipeDict, RecipeLang } from './translations';

import { RecipeBuilderView } from './RecipeBuilderView';
import { IngredientManagerView } from './IngredientManagerView';
import { RecipeCostCalculatorView } from './RecipeCostCalculatorView';
import { InventoryCountView } from './InventoryCountView';
import { WasteDashboardView } from './WasteDashboardView';
import { ConsumptionAnalyticsView } from './ConsumptionAnalyticsView';
import { ForecastingView } from './ForecastingView';
import { UnitConversionsView } from './UnitConversionsView';

import {
  ChefHat,
  Package,
  Calculator,
  ClipboardList,
  Trash2,
  Activity,
  TrendingUp,
  Scale,
  Sparkles,
  Database,
  CheckCircle2,
  Globe
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';

interface RecipeEngineMainViewProps {
  products: Product[];
  currentUser?: string;
  defaultLang?: RecipeLang;
}

export const RecipeEngineMainView: React.FC<RecipeEngineMainViewProps> = ({
  products,
  currentUser = 'Executive Chef',
  defaultLang
}) => {
  const { language, setLanguage, userRecord, role } = useAuth();
  const effectiveRole = String(role || userRecord?.role || '').toLowerCase().trim();
  const rawUserBranch = userRecord?.branchId || (userRecord as any)?.branch;
  const isHqUser = effectiveRole === 'owner' || (effectiveRole === 'admin' && (!rawUserBranch || rawUserBranch === 'all'));
  const effectiveBranchId = isHqUser ? undefined : rawUserBranch;

  const currentLang = (defaultLang || language) as RecipeLang;
  const [lang, setLang] = useState<RecipeLang>(currentLang);

  useEffect(() => {
    setLang(currentLang);
  }, [currentLang]);

  const handleLanguageSwitch = (newLang: RecipeLang) => {
    setLang(newLang);
    setLanguage(newLang);
  };
  const [activeTab, setActiveTab] = useState<
    | 'recipes'
    | 'ingredients'
    | 'costCalculator'
    | 'stockCount'
    | 'waste'
    | 'consumption'
    | 'forecasting'
    | 'conversions'
  >('recipes');

  // Controller Singleton Reference
  const controller = useMemo(() => new RecipeController(new RecipeRepositoryImpl()), []);

  // Real-time State
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [conversions, setConversions] = useState<UnitConversion[]>([]);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);

  // 1. Subscribe to Real-Time Data
  useEffect(() => {
    const unsubRecipes = controller.subscribeRecipes(setRecipes, effectiveBranchId);
    const unsubIngredients = controller.subscribeIngredients(setIngredients, effectiveBranchId);
    const unsubConversions = controller.subscribeUnitConversions(setConversions);
    const unsubWaste = controller.subscribeWasteRecords(setWasteRecords, effectiveBranchId);

    return () => {
      unsubRecipes();
      unsubIngredients();
      unsubConversions();
      unsubWaste();
    };
  }, [controller, effectiveBranchId]);

  const t = recipeDict[lang] || recipeDict.en;

  // Header Calculations
  const avgFoodCost =
    recipes.length > 0
      ? (recipes.reduce((sum, r) => sum + (r.foodCostPercentage || 0), 0) / recipes.length).toFixed(1)
      : '0.0';

  const totalInventoryValuation = ingredients
    .reduce((sum, ing) => sum + (ing.currentStockUsageUnit || 0) * (ing.costPerUsageUnit || 0), 0)
    .toFixed(2);

  const totalWaste = wasteRecords.reduce((sum, w) => sum + (w.totalCost || 0), 0).toFixed(2);

  const tabsConfig = [
    { id: 'recipes', label: t.tabs.recipes, icon: ChefHat },
    { id: 'ingredients', label: t.tabs.ingredients, icon: Package },
    { id: 'costCalculator', label: t.tabs.costCalculator, icon: Calculator },
    { id: 'stockCount', label: t.tabs.stockCount, icon: ClipboardList },
    { id: 'waste', label: t.tabs.waste, icon: Trash2 },
    { id: 'consumption', label: t.tabs.consumption, icon: Activity },
    { id: 'forecasting', label: t.tabs.forecasting, icon: TrendingUp },
    { id: 'conversions', label: t.tabs.conversions, icon: Scale }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Language Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-black tracking-widest uppercase">
                PHASE 16 ENGINE
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase">
                AUTO DEDUCTION ACTIVE
              </span>
            </div>
            <h1 className="text-2xl font-black text-white flex items-center gap-3">
              <ChefHat className="w-7 h-7 text-amber-400" />
              {t.title}
            </h1>
            <p className="text-xs text-slate-400 mt-1">{t.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Language Switcher */}
            <div className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
              <Globe className="w-4 h-4 text-slate-400 ml-1.5" />
              <button
                onClick={() => handleLanguageSwitch('en')}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                  lang === 'en' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => handleLanguageSwitch('ar')}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                  lang === 'ar' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                عربي
              </button>
              <button
                onClick={() => handleLanguageSwitch('so')}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                  lang === 'so' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                SO
              </button>
            </div>
          </div>
        </div>

        {/* Global KPI Metrics Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
          <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Total Recipes</p>
            <p className="text-lg font-black text-white font-mono mt-0.5">{recipes.length}</p>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Average Food Cost %</p>
            <p className="text-lg font-black text-amber-400 font-mono mt-0.5">{avgFoodCost}%</p>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Inventory Valuation</p>
            <p className="text-lg font-black text-emerald-400 font-mono mt-0.5">${totalInventoryValuation}</p>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Total Waste Recorded</p>
            <p className="text-lg font-black text-rose-400 font-mono mt-0.5">${totalWaste}</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        {tabsConfig.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer transition ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* View Content Router */}
      <div className="space-y-6">
        {activeTab === 'recipes' && (
          <RecipeBuilderView
            controller={controller}
            recipes={recipes}
            ingredients={ingredients}
            products={products}
            lang={lang}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'ingredients' && (
          <IngredientManagerView
            controller={controller}
            ingredients={ingredients}
            recipes={recipes}
            lang={lang}
          />
        )}

        {activeTab === 'costCalculator' && (
          <RecipeCostCalculatorView recipes={recipes} lang={lang} />
        )}

        {activeTab === 'stockCount' && (
          <InventoryCountView
            controller={controller}
            ingredients={ingredients}
            lang={lang}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'waste' && (
          <WasteDashboardView
            controller={controller}
            ingredients={ingredients}
            wasteRecords={wasteRecords}
            lang={lang}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'consumption' && (
          <ConsumptionAnalyticsView controller={controller} lang={lang} />
        )}

        {activeTab === 'forecasting' && (
          <ForecastingView controller={controller} lang={lang} />
        )}

        {activeTab === 'conversions' && (
          <UnitConversionsView controller={controller} lang={lang} />
        )}
      </div>
    </div>
  );
};
