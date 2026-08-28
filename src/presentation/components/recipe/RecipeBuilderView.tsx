import React, { useState } from 'react';
import { Recipe, RecipeItem, Ingredient } from '../../../domain/entities/recipe';
import { Product } from '../../../types';
import { RecipeController } from '../../../controllers/RecipeController';
import { recipeDict, RecipeLang } from './translations';
import {
  ChefHat,
  Plus,
  Trash2,
  History,
  AlertCircle,
  TrendingUp,
  DollarSign,
  PieChart,
  CheckCircle2,
  X,
  Layers
} from 'lucide-react';

interface RecipeBuilderViewProps {
  controller: RecipeController;
  recipes: Recipe[];
  ingredients: Ingredient[];
  products: Product[];
  lang: RecipeLang;
  currentUser?: string;
}

export const RecipeBuilderView: React.FC<RecipeBuilderViewProps> = ({
  controller,
  recipes,
  ingredients,
  products,
  lang,
  currentUser = 'Executive Chef'
}) => {
  const t = recipeDict[lang] || recipeDict.en;

  const [showModal, setShowModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [historyModalRecipe, setHistoryModalRecipe] = useState<Recipe | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);

  // Form State
  const [recipeName, setRecipeName] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [sellingPrice, setSellingPrice] = useState<number>(10);
  const [yieldQuantity, setYieldQuantity] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingRecipe(null);
    setRecipeName('');
    setSelectedProductId(products[0]?.id || '');
    const firstProd = products[0];
    setSellingPrice(firstProd?.price || 12);
    setYieldQuantity(1);
    setNotes('');
    setChangeReason('');
    setRecipeItems([
      {
        id: 'item_1',
        ingredientId: ingredients[0]?.id || '',
        ingredientName: ingredients[0]?.name || '',
        quantity: 100,
        unit: ingredients[0]?.usageUnit || 'g',
        costPerUnit: ingredients[0]?.costPerUsageUnit || 0.01,
        totalCost: (100 * (ingredients[0]?.costPerUsageUnit || 0.01))
      }
    ]);
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setRecipeName(recipe.recipeName);
    setSelectedProductId(recipe.productId);
    setSellingPrice(recipe.sellingPrice);
    setYieldQuantity(recipe.yieldQuantity || 1);
    setNotes(recipe.notes || '');
    setChangeReason('');
    setRecipeItems(recipe.items || []);
    setShowModal(true);
  };

  // Handle Product Change
  const handleProductSelect = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (prod) {
      if (!recipeName) setRecipeName(`${prod.name} Recipe`);
      setSellingPrice(prod.price || 12);
    }
  };

  // Add Item to Form
  const handleAddItem = () => {
    const defaultIng = ingredients[0];
    if (!defaultIng) return;
    const newItem: RecipeItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      ingredientId: defaultIng.id,
      ingredientName: defaultIng.name,
      quantity: 50,
      unit: defaultIng.usageUnit || 'g',
      costPerUnit: defaultIng.costPerUsageUnit || 0.01,
      totalCost: 50 * (defaultIng.costPerUsageUnit || 0.01)
    };
    setRecipeItems([...recipeItems, newItem]);
  };

  // Update Item in Form
  const handleUpdateItem = (index: number, fields: Partial<RecipeItem>) => {
    const updated = [...recipeItems];
    const cur = updated[index];

    let ingName = cur.ingredientName;
    let costPerUnit = cur.costPerUnit;
    let unit = cur.unit;

    if (fields.ingredientId) {
      const ing = ingredients.find((i) => i.id === fields.ingredientId);
      if (ing) {
        ingName = ing.name;
        costPerUnit = ing.costPerUsageUnit || 0.01;
        unit = ing.usageUnit || 'g';
      }
    }

    const qty = fields.quantity !== undefined ? fields.quantity : cur.quantity;
    const cpu = fields.costPerUnit !== undefined ? fields.costPerUnit : costPerUnit;
    const totalCost = Number((qty * cpu).toFixed(4));

    updated[index] = {
      ...cur,
      ...fields,
      ingredientName: ingName,
      unit,
      costPerUnit: cpu,
      totalCost
    };

    setRecipeItems(updated);
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    setRecipeItems(recipeItems.filter((_, i) => i !== index));
  };

  // Form Calculations
  const calc = controller.calculateRecipeTotals(recipeItems, sellingPrice, yieldQuantity);

  // Save Form
  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeName || !selectedProductId || recipeItems.length === 0) return;

    const prod = products.find((p) => p.id === selectedProductId);

    if (editingRecipe) {
      await controller.updateRecipe(
        editingRecipe.id,
        {
          productId: selectedProductId,
          productName: prod?.name || editingRecipe.productName,
          productCategory: prod?.category || editingRecipe.productCategory,
          recipeName,
          items: recipeItems,
          yieldQuantity,
          totalCost: calc.totalCost,
          costPerPortion: calc.costPerPortion,
          sellingPrice,
          foodCostPercentage: calc.foodCostPercentage,
          grossProfit: calc.grossProfit,
          grossProfitMargin: calc.grossProfitMargin,
          netProfit: calc.netProfit,
          notes
        },
        changeReason || 'Updated recipe parameters',
        currentUser
      );
    } else {
      await controller.createRecipe({
        productId: selectedProductId,
        productName: prod?.name || 'Menu Dish',
        productCategory: prod?.category || 'Main Course',
        recipeName,
        version: 1,
        items: recipeItems,
        yieldQuantity,
        totalCost: calc.totalCost,
        costPerPortion: calc.costPerPortion,
        sellingPrice,
        foodCostPercentage: calc.foodCostPercentage,
        grossProfit: calc.grossProfit,
        grossProfitMargin: calc.grossProfitMargin,
        netProfit: calc.netProfit,
        notes,
        isActive: true,
        createdBy: currentUser
      });
    }

    setShowModal(false);
  };

  // Open Version History Modal
  const handleOpenHistory = async (recipe: Recipe) => {
    setHistoryModalRecipe(recipe);
    const hist = await controller.fetchRecipeHistory(recipe.id);
    setHistoryList(hist);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-amber-400" />
            {t.tabs.recipes}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Build recipes with unlimited ingredients, calculate exact food cost %, and track versions.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition"
        >
          <Plus className="w-4 h-4" />
          {t.recipes.createTitle}
        </button>
      </div>

      {/* Recipes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {recipes.map((recipe) => (
          <div
            key={recipe.id}
            className="bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-3xl p-5 space-y-4 shadow-xl transition flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono font-bold">
                    v{recipe.version || 1} • {recipe.productCategory || 'Menu Item'}
                  </span>
                  <h3 className="text-sm font-bold text-white mt-1.5">{recipe.recipeName}</h3>
                  <p className="text-xs text-emerald-400 font-semibold">{recipe.productName}</p>
                </div>
                <button
                  onClick={() => handleOpenHistory(recipe)}
                  title="Version History"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition"
                >
                  <History className="w-4 h-4" />
                </button>
              </div>

              {/* Recipe Cost Metrics */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950 rounded-2xl border border-slate-800 text-center">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">{t.common.totalCost}</p>
                  <p className="text-xs font-black text-amber-400">${recipe.costPerPortion?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">{t.common.sellingPrice}</p>
                  <p className="text-xs font-black text-white">${recipe.sellingPrice?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold">{t.common.foodCostPct}</p>
                  <p
                    className={`text-xs font-black ${
                      recipe.foodCostPercentage <= 35 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {recipe.foodCostPercentage?.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Ingredients Breakdown Summary */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {recipe.items?.length || 0} Ingredients Included:
                </p>
                <div className="max-h-28 overflow-y-auto space-y-1 pr-1 no-scrollbar">
                  {recipe.items?.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs p-1.5 bg-slate-950/60 rounded-xl border border-slate-800/60"
                    >
                      <span className="text-slate-300 font-medium truncate">{item.ingredientName}</span>
                      <span className="font-mono text-amber-400 font-bold shrink-0 ml-2">
                        {item.quantity} {item.unit} (${item.totalCost?.toFixed(2)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Card Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-mono">
                Yield: {recipe.yieldQuantity || 1} Portion
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEdit(recipe)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer transition"
                >
                  {t.common.edit}
                </button>
                <button
                  onClick={() => controller.deleteRecipe(recipe.id)}
                  className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 cursor-pointer transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {recipes.length === 0 && (
          <div className="col-span-full p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
            <ChefHat className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-white">No Recipes Created Yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Click &quot;Create New Recipe&quot; above to link a menu dish with its ingredients and compute food costs.
            </p>
          </div>
        )}
      </div>

      {/* CREATE / EDIT RECIPE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-amber-400" />
                {editingRecipe ? t.recipes.editTitle : t.recipes.createTitle}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-xl bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRecipe} className="space-y-5">
              {/* Recipe Name & Linked Product */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {t.recipes.recipeName}
                  </label>
                  <input
                    type="text"
                    required
                    value={recipeName}
                    onChange={(e) => setRecipeName(e.target.value)}
                    placeholder="e.g. Gourmet Cheeseburger Recipe"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {t.recipes.linkedProduct}
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (${p.price?.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Price & Yield */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {t.common.sellingPrice} ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {t.common.yield}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={yieldQuantity}
                    onChange={(e) => setYieldQuantity(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Recipe Ingredients Builder Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    {t.recipes.ingredientsList} ({recipeItems.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs flex items-center gap-1 cursor-pointer transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t.recipes.addIngredient}
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {recipeItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-12 gap-2 items-center p-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs"
                    >
                      <div className="col-span-5">
                        <select
                          value={item.ingredientId}
                          onChange={(e) => handleUpdateItem(idx, { ingredientId: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none"
                        >
                          {ingredients.map((ing) => (
                            <option key={ing.id} value={ing.id}>
                              {ing.name} (${ing.costPerUsageUnit?.toFixed(4)}/{ing.usageUnit})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-3 flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.001"
                          required
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateItem(idx, { quantity: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none text-center"
                        />
                        <span className="text-[10px] text-slate-400 font-mono font-bold shrink-0">
                          {item.unit}
                        </span>
                      </div>

                      <div className="col-span-3 text-right">
                        <span className="font-mono text-amber-400 font-bold">
                          ${item.totalCost?.toFixed(2)}
                        </span>
                      </div>

                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-rose-400 hover:text-rose-300 p-1 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Calculation Summary Gauge */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold">{t.common.totalCost}</p>
                    <p className="text-sm font-black text-amber-400">${calc.totalCost.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold">{t.common.foodCostPct}</p>
                    <p
                      className={`text-sm font-black ${
                        calc.foodCostPercentage <= 35 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {calc.foodCostPercentage.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold">{t.common.grossProfit}</p>
                    <p className="text-sm font-black text-white">${calc.grossProfit.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold">{t.common.netProfit}</p>
                    <p className="text-sm font-black text-emerald-400">${calc.netProfit.toFixed(2)}</p>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 text-center italic">
                  {t.recipes.idealFoodCostNote}
                </p>
              </div>

              {editingRecipe && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Reason for Recipe Change (Version Log)
                  </label>
                  <input
                    type="text"
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    placeholder="e.g. Adjusted beef patty portion from 140g to 150g"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              )}

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

      {/* VERSION HISTORY MODAL */}
      {historyModalRecipe && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                {t.recipes.historyModalTitle}: {historyModalRecipe.recipeName}
              </h3>
              <button
                onClick={() => setHistoryModalRecipe(null)}
                className="text-slate-400 hover:text-white p-1 bg-slate-800 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {historyList.map((hist) => (
                <div key={hist.id} className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold font-mono text-[10px]">
                      Version {hist.version}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      {new Date(hist.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300 font-medium">
                    <span>Changed By: {hist.changedBy || 'Admin'}</span>
                    <span>
                      Food Cost: <strong className="text-amber-400">{hist.foodCostPercentage?.toFixed(1)}%</strong>
                    </span>
                  </div>

                  <p className="text-slate-400 italic text-[11px] bg-slate-900 p-2 rounded-xl border border-slate-800/80">
                    &quot;{hist.changeReason || 'No notes provided'}&quot;
                  </p>
                </div>
              ))}

              {historyList.length === 0 && (
                <p className="text-center text-slate-400 text-xs py-6">No historical versions recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
