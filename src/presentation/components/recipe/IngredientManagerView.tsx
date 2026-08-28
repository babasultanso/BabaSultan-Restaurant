import React, { useState } from 'react';
import { Ingredient, Recipe } from '../../../domain/entities/recipe';
import { RecipeController } from '../../../controllers/RecipeController';
import { recipeDict, RecipeLang } from './translations';
import { UnitConversionEngine } from '../../../lib/unitConversionEngine';
import {
  Package,
  Plus,
  Trash2,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  UtensilsCrossed,
  X,
  Edit2
} from 'lucide-react';

interface IngredientManagerViewProps {
  controller: RecipeController;
  ingredients: Ingredient[];
  recipes: Recipe[];
  lang: RecipeLang;
}

export const IngredientManagerView: React.FC<IngredientManagerViewProps> = ({
  controller,
  ingredients,
  recipes,
  lang
}) => {
  const t = recipeDict[lang] || recipeDict.en;

  const [showModal, setShowModal] = useState(false);
  const [editingIng, setEditingIng] = useState<Ingredient | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Form Fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Produce');
  const [purchaseUnit, setPurchaseUnit] = useState('kg');
  const [usageUnit, setUsageUnit] = useState('g');
  const [conversionFactor, setConversionFactor] = useState<number>(1000);
  const [currentStockUsageUnit, setCurrentStockUsageUnit] = useState<number>(10000);
  const [minStockUsageUnit, setMinStockUsageUnit] = useState<number>(2000);
  const [purchaseCost, setPurchaseCost] = useState<number>(10);
  const [supplierName, setSupplierName] = useState('');

  const handleOpenCreate = () => {
    setEditingIng(null);
    setCode(`ING-${Math.floor(100 + Math.random() * 900)}`);
    setName('');
    setCategory('Produce');
    setPurchaseUnit('kg');
    setUsageUnit('g');
    setConversionFactor(1000);
    setCurrentStockUsageUnit(10000);
    setMinStockUsageUnit(2000);
    setPurchaseCost(12);
    setSupplierName('');
    setShowModal(true);
  };

  const handleOpenEdit = (ing: Ingredient) => {
    setEditingIng(ing);
    setCode(ing.code);
    setName(ing.name);
    setCategory(ing.category);
    setPurchaseUnit(ing.purchaseUnit);
    setUsageUnit(ing.usageUnit);
    setConversionFactor(ing.conversionFactor || 1);
    setCurrentStockUsageUnit(ing.currentStockUsageUnit || 0);
    setMinStockUsageUnit(ing.minStockUsageUnit || 10);
    setPurchaseCost(ing.purchaseCost || 0);
    setSupplierName(ing.supplierName || '');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || conversionFactor <= 0) return;

    if (editingIng) {
      await controller.updateIngredient(editingIng.id, {
        code,
        name,
        category,
        purchaseUnit,
        usageUnit,
        conversionFactor,
        currentStockUsageUnit,
        minStockUsageUnit,
        purchaseCost,
        supplierName
      });
    } else {
      const calculatedCostPerUsageUnit = conversionFactor > 0 ? purchaseCost / conversionFactor : purchaseCost;
      await controller.createIngredient({
        code,
        name,
        category,
        purchaseUnit,
        usageUnit,
        conversionFactor,
        currentStockUsageUnit,
        minStockUsageUnit,
        purchaseCost,
        costPerUsageUnit: calculatedCostPerUsageUnit,
        supplierName,
        status: 'in_stock'
      });
    }

    setShowModal(false);
  };

  const filtered = ingredients.filter((ing) => {
    const q = (search || '').toLowerCase();
    const matchSearch =
      (ing.name || '').toLowerCase().includes(q) ||
      (ing.code || '').toLowerCase().includes(q);
    const matchCat = categoryFilter === 'ALL' || ing.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const categories = Array.from(new Set(ingredients.map((i) => i.category || 'General')));

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.common.search}
            className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2 text-xs text-white focus:outline-none focus:border-amber-500 w-48 sm:w-64"
          />

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-xs text-white focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition"
        >
          <Plus className="w-4 h-4" />
          {t.ingredients.createTitle}
        </button>
      </div>

      {/* Ingredients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((ing) => {
          // Find if this ingredient is used in any recipes to calculate "Meals Remaining"
          let usagePerMeal = 0;
          let linkedRecipeName = '';

          recipes.forEach((r) => {
            const foundItem = r.items?.find((i) => i.ingredientId === ing.id);
            if (foundItem && foundItem.quantity > 0) {
              usagePerMeal = foundItem.quantity;
              linkedRecipeName = r.productName;
            }
          });

          const mealsRemaining =
            usagePerMeal > 0
              ? UnitConversionEngine.getMealsRemaining(
                  ing.currentStockUsageUnit,
                  ing.usageUnit,
                  usagePerMeal,
                  ing.usageUnit
                )
              : null;

          return (
            <div
              key={ing.id}
              className="bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-3xl p-5 space-y-4 shadow-xl transition flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono font-bold">
                      {ing.code} • {ing.category}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1.5">{ing.name}</h3>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      ing.status === 'out_of_stock'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : ing.status === 'low_stock'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {(ing.status || 'in_stock').replace('_', ' ')}
                  </span>
                </div>

                {/* Stock & Cost breakdown */}
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950 rounded-2xl border border-slate-800 text-center">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold">{t.ingredients.purchaseUnit}</p>
                    <p className="text-xs font-black text-white">
                      ${ing.purchaseCost?.toFixed(2)} / {ing.purchaseUnit}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold">{t.ingredients.costPerUsageUnit}</p>
                    <p className="text-xs font-black text-amber-400">
                      ${ing.costPerUsageUnit?.toFixed(4)} / {ing.usageUnit}
                    </p>
                  </div>
                </div>

                {/* Stock Levels */}
                <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Stock On Hand:</span>
                    <span className="font-mono text-white font-bold">
                      {ing.currentStockUsageUnit?.toLocaleString()} {ing.usageUnit}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Conversion Factor:</span>
                    <span className="font-mono text-slate-300">
                      1 {ing.purchaseUnit} = {ing.conversionFactor} {ing.usageUnit}
                    </span>
                  </div>

                  {mealsRemaining !== null && (
                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800/80">
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                        {t.ingredients.mealsRemaining}:
                      </span>
                      <span className="font-mono text-emerald-400 font-extrabold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                        {mealsRemaining} Meals ({linkedRecipeName})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono">
                  {ing.supplierName || 'Primary Supplier'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(ing)}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white cursor-pointer transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => controller.deleteIngredient(ing.id)}
                    className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 cursor-pointer transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                {editingIng ? t.ingredients.editTitle : t.ingredients.createTitle}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 bg-slate-800 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {t.ingredients.code}
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {t.ingredients.name}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {t.common.category}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="Meat">Meat</option>
                    <option value="Produce">Produce</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Liquids">Liquids</option>
                    <option value="Spices">Spices</option>
                    <option value="Packaging">Packaging</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {t.ingredients.purchaseUnit}
                  </label>
                  <select
                    value={purchaseUnit}
                    onChange={(e) => setPurchaseUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="kg">kg (Kilogram)</option>
                    <option value="L">L (Liter)</option>
                    <option value="box">Box</option>
                    <option value="carton">Carton</option>
                    <option value="bag">Bag</option>
                    <option value="tray">Tray</option>
                    <option value="pcs">Pieces</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {t.ingredients.usageUnit}
                  </label>
                  <select
                    value={usageUnit}
                    onChange={(e) => setUsageUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="g">g (Gram)</option>
                    <option value="ml">ml (Milliliter)</option>
                    <option value="pcs">pcs (Piece)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {t.ingredients.conversionFactor}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={conversionFactor}
                    onChange={(e) => setConversionFactor(parseFloat(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    1 {purchaseUnit} = {conversionFactor} {usageUnit}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {t.ingredients.purchaseCost} ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={purchaseCost}
                    onChange={(e) => setPurchaseCost(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Initial Stock ({usageUnit})
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={currentStockUsageUnit}
                    onChange={(e) => setCurrentStockUsageUnit(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {t.ingredients.minAlert} ({usageUnit})
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={minStockUsageUnit}
                    onChange={(e) => setMinStockUsageUnit(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">Calculated Cost / {usageUnit}:</span>
                <span className="font-mono text-amber-400 font-bold">
                  ${(conversionFactor > 0 ? purchaseCost / conversionFactor : purchaseCost).toFixed(4)}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
