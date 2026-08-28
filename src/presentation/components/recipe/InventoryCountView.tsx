import React, { useState, useEffect } from 'react';
import { Ingredient, StockCount, StockCountItem } from '../../../domain/entities/recipe';
import { RecipeController } from '../../../controllers/RecipeController';
import { recipeDict, RecipeLang } from './translations';
import { ClipboardList, Plus, CheckCircle2, AlertCircle, Save, Check } from 'lucide-react';

interface InventoryCountViewProps {
  controller: RecipeController;
  ingredients: Ingredient[];
  lang: RecipeLang;
  currentUser?: string;
}

export const InventoryCountView: React.FC<InventoryCountViewProps> = ({
  controller,
  ingredients,
  lang,
  currentUser = 'Inventory Manager'
}) => {
  const t = recipeDict[lang] || recipeDict.en;

  const [stockCounts, setStockCounts] = useState<StockCount[]>([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Count Sheet State
  const [countItems, setCountItems] = useState<StockCountItem[]>([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    controller.fetchStockCounts().then(setStockCounts);
  }, [controller]);

  const handleStartCount = () => {
    const items: StockCountItem[] = ingredients.map((ing) => ({
      ingredientId: ing.id,
      ingredientName: ing.name,
      unit: ing.usageUnit,
      expectedQuantity: ing.currentStockUsageUnit || 0,
      actualQuantity: ing.currentStockUsageUnit || 0,
      difference: 0,
      costPerUnit: ing.costPerUsageUnit || 0.01,
      lossValue: 0,
      notes: ''
    }));
    setCountItems(items);
    setNotes('');
    setShowNewModal(true);
  };

  const handleActualChange = (index: number, actualVal: number) => {
    const updated = [...countItems];
    const item = updated[index];
    const diff = actualVal - item.expectedQuantity;
    const lossValue = diff < 0 ? Math.abs(diff) * item.costPerUnit : 0;

    updated[index] = {
      ...item,
      actualQuantity: actualVal,
      difference: diff,
      lossValue: Number(lossValue.toFixed(2))
    };
    setCountItems(updated);
  };

  const handleSaveCount = async (status: 'draft' | 'completed') => {
    const totalExpectedValue = countItems.reduce(
      (sum, i) => sum + i.expectedQuantity * i.costPerUnit,
      0
    );
    const totalActualValue = countItems.reduce(
      (sum, i) => sum + i.actualQuantity * i.costPerUnit,
      0
    );
    const totalDiscrepancyValue = countItems.reduce((sum, i) => sum + i.lossValue, 0);

    const created = await controller.createStockCount({
      countNumber: `STK-${Math.floor(10000 + Math.random() * 90000)}`,
      countDate: new Date().toISOString(),
      status,
      items: countItems,
      totalExpectedValue,
      totalActualValue,
      totalDiscrepancyValue,
      notes,
      createdBy: currentUser
    });

    if (status === 'completed') {
      await controller.applyStockCountAdjustment(created.id, currentUser);
      setSuccessMsg(t.stockCount.adjustedSuccess);
      setTimeout(() => setSuccessMsg(''), 4000);
    }

    setShowNewModal(false);
    const updated = await controller.fetchStockCounts();
    setStockCounts(updated);
  };

  const handleApplyAdjustment = async (countId: string) => {
    await controller.applyStockCountAdjustment(countId, currentUser);
    setSuccessMsg(t.stockCount.adjustedSuccess);
    setTimeout(() => setSuccessMsg(''), 4000);
    const updated = await controller.fetchStockCounts();
    setStockCounts(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-amber-400" />
            {t.stockCount.title}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Perform physical ingredient audits, detect loss discrepancies, and automatically adjust stock levels.
          </p>
        </div>

        <button
          onClick={handleStartCount}
          className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition"
        >
          <Plus className="w-4 h-4" />
          {t.stockCount.newCount}
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-400 font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Stock Counts History */}
      <div className="space-y-4">
        {stockCounts.map((sc) => (
          <div
            key={sc.id}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-slate-800 text-amber-400 text-xs font-mono font-bold">
                  {sc.countNumber}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {new Date(sc.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    sc.status === 'adjusted'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {sc.status}
                </span>

                {sc.status !== 'adjusted' && (
                  <button
                    onClick={() => handleApplyAdjustment(sc.id)}
                    className="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer transition"
                  >
                    {t.stockCount.applyAdjustment}
                  </button>
                )}
              </div>
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950 rounded-2xl border border-slate-800 text-center">
              <div>
                <p className="text-[10px] text-slate-400 font-bold">{t.stockCount.expectedQty} Value</p>
                <p className="text-xs font-black text-white">${sc.totalExpectedValue?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold">{t.stockCount.actualQty} Value</p>
                <p className="text-xs font-black text-amber-400">${sc.totalActualValue?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold">{t.stockCount.lossValue}</p>
                <p className="text-xs font-black text-rose-400">${sc.totalDiscrepancyValue?.toFixed(2)}</p>
              </div>
            </div>

            {/* Items Discrepancy Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[10px] uppercase font-bold text-slate-400 bg-slate-950">
                  <tr>
                    <th className="p-2.5 rounded-l-xl">Ingredient</th>
                    <th className="p-2.5">Expected</th>
                    <th className="p-2.5">Actual Count</th>
                    <th className="p-2.5">Difference</th>
                    <th className="p-2.5 text-right rounded-r-xl">Discrepancy Loss ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sc.items?.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-950/40">
                      <td className="p-2.5 font-bold text-white">{item.ingredientName}</td>
                      <td className="p-2.5 text-slate-300 font-mono">
                        {item.expectedQuantity} {item.unit}
                      </td>
                      <td className="p-2.5 text-amber-400 font-mono font-bold">
                        {item.actualQuantity} {item.unit}
                      </td>
                      <td
                        className={`p-2.5 font-mono font-bold ${
                          item.difference < 0
                            ? 'text-rose-400'
                            : item.difference > 0
                            ? 'text-emerald-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {item.difference > 0 ? `+${item.difference}` : item.difference} {item.unit}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-rose-400">
                        {item.lossValue > 0 ? `$${item.lossValue.toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {stockCounts.length === 0 && (
          <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-400 text-xs">
            No stock count audits performed yet. Click &quot;New Stock Count&quot; to begin audit.
          </div>
        )}
      </div>

      {/* NEW STOCK COUNT MODAL SHEET */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-amber-400" />
                {t.stockCount.newCount} Sheet
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-white p-1 bg-slate-800 rounded-xl"
              >
                ✕
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
              <table className="w-full text-xs text-left">
                <thead className="text-[10px] uppercase font-bold text-slate-400 bg-slate-950 sticky top-0">
                  <tr>
                    <th className="p-2.5">Ingredient</th>
                    <th className="p-2.5">Expected Stock</th>
                    <th className="p-2.5">Actual Physical Count</th>
                    <th className="p-2.5">Discrepancy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {countItems.map((item, idx) => (
                    <tr key={item.ingredientId} className="hover:bg-slate-950">
                      <td className="p-2.5 font-bold text-white">{item.ingredientName}</td>
                      <td className="p-2.5 text-slate-300 font-mono">
                        {item.expectedQuantity} {item.unit}
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            value={item.actualQuantity}
                            onChange={(e) =>
                              handleActualChange(idx, parseFloat(e.target.value) || 0)
                            }
                            className="w-28 bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-xs text-amber-400 font-mono font-bold text-center focus:outline-none focus:border-amber-500"
                          />
                          <span className="text-slate-400 text-[10px]">{item.unit}</span>
                        </div>
                      </td>
                      <td
                        className={`p-2.5 font-mono font-bold ${
                          item.difference < 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {item.difference > 0 ? `+${item.difference}` : item.difference} {item.unit}
                        {item.lossValue > 0 && ` (-$${item.lossValue.toFixed(2)})`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">{t.common.notes}</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Audit notes or comments..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleSaveCount('draft')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => handleSaveCount('completed')}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-amber-500/20"
              >
                Save &amp; Apply Stock Adjustment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
