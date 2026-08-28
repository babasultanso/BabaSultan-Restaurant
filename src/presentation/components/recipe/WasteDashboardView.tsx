import React, { useState } from 'react';
import { Ingredient, WasteRecord, WasteReason } from '../../../domain/entities/recipe';
import { RecipeController } from '../../../controllers/RecipeController';
import { recipeDict, RecipeLang } from './translations';
import { Trash2, AlertTriangle, Plus, DollarSign, PieChart, ShieldAlert, X } from 'lucide-react';

interface WasteDashboardViewProps {
  controller: RecipeController;
  ingredients: Ingredient[];
  wasteRecords: WasteRecord[];
  lang: RecipeLang;
  currentUser?: string;
}

export const WasteDashboardView: React.FC<WasteDashboardViewProps> = ({
  controller,
  ingredients,
  wasteRecords,
  lang,
  currentUser = 'Kitchen Staff'
}) => {
  const t = recipeDict[lang] || recipeDict.en;

  const [showModal, setShowModal] = useState(false);
  const [selectedIngredientId, setSelectedIngredientId] = useState(ingredients[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(100);
  const [reason, setReason] = useState<WasteReason>('expired');
  const [notes, setNotes] = useState('');

  const selectedIng = ingredients.find((i) => i.id === selectedIngredientId) || ingredients[0];

  const handleRecordWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIng || quantity <= 0) return;

    const costPerUnit = selectedIng.costPerUsageUnit || 0.01;
    const totalCost = Number((quantity * costPerUnit).toFixed(2));

    await controller.recordWaste({
      ingredientId: selectedIng.id,
      ingredientName: selectedIng.name,
      quantity,
      unit: selectedIng.usageUnit,
      costPerUnit,
      totalCost,
      reason,
      notes,
      recordedBy: currentUser
    });

    setShowModal(false);
    setQuantity(100);
    setNotes('');
  };

  const totalWasteCost = wasteRecords.reduce((sum, w) => sum + (w.totalCost || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-400" />
            {t.waste.title}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Log ingredient waste due to expiration, spoilage, or prep loss, and automatically deduct from inventory stock.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-rose-500/20 cursor-pointer transition"
        >
          <Plus className="w-4 h-4" />
          {t.waste.recordWaste}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-1">
          <p className="text-xs text-slate-400 font-bold">{t.waste.wasteCost}</p>
          <p className="text-2xl font-black text-rose-400 font-mono">${totalWasteCost.toFixed(2)}</p>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-1">
          <p className="text-xs text-slate-400 font-bold">Total Incidents Recorded</p>
          <p className="text-2xl font-black text-white font-mono">{wasteRecords.length}</p>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-1">
          <p className="text-xs text-slate-400 font-bold">Primary Loss Reason</p>
          <p className="text-base font-bold text-amber-400 uppercase tracking-wider mt-1">
            Expired &amp; Prep Loss
          </p>
        </div>
      </div>

      {/* Waste Records Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white">Recent Ingredient Waste Logs</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-[10px] uppercase font-bold text-slate-400 bg-slate-950">
              <tr>
                <th className="p-3 rounded-l-xl">Date &amp; Time</th>
                <th className="p-3">Ingredient</th>
                <th className="p-3">Quantity</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Recorded By</th>
                <th className="p-3 text-right rounded-r-xl">Total Cost ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {wasteRecords.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-950/40">
                  <td className="p-3 text-slate-400 text-[11px]">
                    {new Date(rec.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3 font-bold text-white">{rec.ingredientName}</td>
                  <td className="p-3 font-mono text-amber-400 font-bold">
                    {rec.quantity} {rec.unit}
                  </td>
                  <td className="p-3">
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-bold text-[10px] uppercase border border-rose-500/20">
                      {t.waste.reasons[rec.reason] || rec.reason}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300">{rec.recordedBy}</td>
                  <td className="p-3 text-right font-mono font-bold text-rose-400">
                    ${rec.totalCost?.toFixed(2)}
                  </td>
                </tr>
              ))}

              {wasteRecords.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No waste logs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD WASTE MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                {t.waste.recordWaste}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 bg-slate-800 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordWaste} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Select Ingredient</label>
                <select
                  value={selectedIngredientId}
                  onChange={(e) => setSelectedIngredientId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                >
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.currentStockUsageUnit} {i.usageUnit} available)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Wasted Quantity ({selectedIng?.usageUnit})
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">{t.waste.reason}</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as WasteReason)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="expired">{t.waste.reasons.expired}</option>
                    <option value="spoiled">{t.waste.reasons.spoiled}</option>
                    <option value="cooking_loss">{t.waste.reasons.cooking_loss}</option>
                    <option value="preparation_waste">{t.waste.reasons.preparation_waste}</option>
                    <option value="damage">{t.waste.reasons.damage}</option>
                    <option value="unknown">{t.waste.reasons.unknown}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">{t.common.notes}</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Details regarding waste incident..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">Total Loss Value:</span>
                <span className="font-mono text-rose-400 font-bold">
                  ${((quantity || 0) * (selectedIng?.costPerUsageUnit || 0.01)).toFixed(2)}
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
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-rose-500/20"
                >
                  Log &amp; Deduct Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
