import React, { useState, useEffect } from 'react';
import { UnitConversion } from '../../../domain/entities/recipe';
import { RecipeController } from '../../../controllers/RecipeController';
import { recipeDict, RecipeLang } from './translations';
import { Scale, Plus, Trash2, ArrowRightLeft, CheckCircle2 } from 'lucide-react';

interface UnitConversionsViewProps {
  controller: RecipeController;
  lang: RecipeLang;
}

export const UnitConversionsView: React.FC<UnitConversionsViewProps> = ({ controller, lang }) => {
  const t = recipeDict[lang] || recipeDict.en;

  const [conversions, setConversions] = useState<UnitConversion[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [fromUnit, setFromUnit] = useState('box');
  const [toUnit, setToUnit] = useState('pcs');
  const [factor, setFactor] = useState<number>(24);
  const [description, setDescription] = useState('');

  useEffect(() => {
    const unsub = controller.subscribeUnitConversions(setConversions);
    return () => unsub();
  }, [controller]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (factor <= 0) return;

    await controller.createUnitConversion({
      fromUnit,
      toUnit,
      factor,
      description: description || `1 ${fromUnit} = ${factor} ${toUnit}`
    });

    setShowModal(false);
    setDescription('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-400" />
            {t.conversions.title}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Define custom packaging and metric conversion multipliers used by the recipe &amp; inventory deduction engine.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition"
        >
          <Plus className="w-4 h-4" />
          {t.conversions.addConversion}
        </button>
      </div>

      {/* Conversion Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {conversions.map((conv) => (
          <div
            key={conv.id}
            className="bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-3xl p-5 space-y-4 shadow-xl transition flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-slate-800 text-amber-400 text-xs font-mono font-bold flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  {conv.fromUnit} ➔ {conv.toUnit}
                </span>
                <button
                  onClick={() => controller.deleteUnitConversion(conv.id)}
                  className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 cursor-pointer transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-1">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Conversion Factor
                </p>
                <p className="text-xl font-black text-white font-mono">
                  1 {conv.fromUnit} = {conv.factor} {conv.toUnit}
                </p>
              </div>

              <p className="text-xs text-slate-400 italic text-center">{conv.description}</p>
            </div>
          </div>
        ))}

        {conversions.length === 0 && (
          <div className="col-span-full p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-400 text-xs">
            No custom conversion rules created yet. Default metric rules (kg to g, L to ml) are active automatically.
          </div>
        )}
      </div>

      {/* ADD CONVERSION MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-400" />
                {t.conversions.addConversion}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 bg-slate-800 rounded-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {t.conversions.fromUnit}
                  </label>
                  <input
                    type="text"
                    required
                    value={fromUnit}
                    onChange={(e) => setFromUnit(e.target.value)}
                    placeholder="e.g. box"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {t.conversions.toUnit}
                  </label>
                  <input
                    type="text"
                    required
                    value={toUnit}
                    onChange={(e) => setToUnit(e.target.value)}
                    placeholder="e.g. pcs"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  {t.conversions.factor}
                </label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  required
                  value={factor}
                  onChange={(e) => setFactor(parseFloat(e.target.value) || 1)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono font-bold text-amber-400"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  1 {fromUnit || 'From'} = {factor} {toUnit || 'To'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">{t.common.notes}</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. 1 Bakery Box contains 24 sesame buns"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
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
