import React, { useState } from 'react';
import { ProductOption, ProductOptionChoice } from '../../../types';
import { validateOptionForm, ValidationError } from '../../../lib/validation/productValidation';
import {
  X,
  Plus,
  Trash2,
  Sliders,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

interface ProductOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: ProductOption[];
  onSaveOptions: (updatedOptions: ProductOption[]) => Promise<void>;
}

export const ProductOptionsModal: React.FC<ProductOptionsModalProps> = ({
  isOpen,
  onClose,
  options,
  onSaveOptions
}) => {
  const [optionList, setOptionList] = useState<ProductOption[]>(options || []);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingOption, setEditingOption] = useState<Partial<ProductOption> | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleStartAddOption = () => {
    setEditingOption({
      id: `opt_${Date.now()}`,
      nameEn: '',
      nameAr: '',
      nameSo: '',
      type: 'addon',
      selectionType: 'single',
      isRequired: false,
      choices: [
        { id: `c_1`, nameEn: 'Regular', nameAr: 'عادي', nameSo: 'Caadi', priceModifier: 0, isDefault: true }
      ]
    });
    setEditingIndex(null);
    setErrors([]);
  };

  const handleStartEditOption = (index: number) => {
    setEditingOption({ ...optionList[index] });
    setEditingIndex(index);
    setErrors([]);
  };

  const handleAddChoice = () => {
    if (!editingOption) return;
    const choices = editingOption.choices || [];
    const newChoice: ProductOptionChoice = {
      id: `c_${Date.now()}_${choices.length + 1}`,
      nameEn: 'New Choice',
      nameAr: '',
      nameSo: '',
      priceModifier: 0
    };
    setEditingOption({ ...editingOption, choices: [...choices, newChoice] });
  };

  const handleUpdateChoice = (cIndex: number, field: keyof ProductOptionChoice, value: any) => {
    if (!editingOption || !editingOption.choices) return;
    const updated = [...editingOption.choices];
    updated[cIndex] = { ...updated[cIndex], [field]: value };
    setEditingOption({ ...editingOption, choices: updated });
  };

  const handleDeleteChoice = (cIndex: number) => {
    if (!editingOption || !editingOption.choices) return;
    const updated = editingOption.choices.filter((_, i) => i !== cIndex);
    setEditingOption({ ...editingOption, choices: updated });
  };

  const handleSaveCurrentOption = () => {
    if (!editingOption) return;
    const validationErrors = validateOptionForm(editingOption);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    const updatedList = [...optionList];
    if (editingIndex !== null) {
      updatedList[editingIndex] = editingOption as ProductOption;
    } else {
      updatedList.push(editingOption as ProductOption);
    }

    setOptionList(updatedList);
    setEditingOption(null);
    setEditingIndex(null);
  };

  const handleDeleteOption = (index: number) => {
    const updatedList = optionList.filter((_, i) => i !== index);
    setOptionList(updatedList);
  };

  const handleFinalSave = async () => {
    setLoading(true);
    try {
      await onSaveOptions(optionList);
      onClose();
    } catch (err: any) {
      alert(`Error saving product options: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Product Options & Custom Variants</h2>
              <p className="text-xs text-slate-400">Configure Sizes, Add-ons, Variants, and Price Modifiers</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">

          {editingOption ? (
            /* Option Group Form */
            <div className="space-y-5 bg-slate-950/80 p-5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-emerald-400">
                  {editingIndex !== null ? 'Edit Option Group' : 'Add New Option Group'}
                </h3>
                <button
                  onClick={() => setEditingOption(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Back to List
                </button>
              </div>

              {/* Names */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Option Name (English) *
                  </label>
                  <input
                    type="text"
                    value={editingOption.nameEn || ''}
                    onChange={(e) => setEditingOption({ ...editingOption, nameEn: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Size or Extra Cheese"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Arabic Name (اسم الخيار)
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={editingOption.nameAr || ''}
                    onChange={(e) => setEditingOption({ ...editingOption, nameAr: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    placeholder="مثال: الحجم"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Somali Name
                  </label>
                  <input
                    type="text"
                    value={editingOption.nameSo || ''}
                    onChange={(e) => setEditingOption({ ...editingOption, nameSo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Cabbirka"
                  />
                </div>
              </div>

              {/* Type & Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Option Group Type
                  </label>
                  <select
                    value={editingOption.type || 'addon'}
                    onChange={(e) => setEditingOption({ ...editingOption, type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="size">Size (Small, Medium, Large)</option>
                    <option value="addon">Add-on (Extra topping, sauce)</option>
                    <option value="variant">Variant (Chicken, Beef, Veg)</option>
                    <option value="custom">Custom Option Group</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Selection Rule
                  </label>
                  <select
                    value={editingOption.selectionType || 'single'}
                    onChange={(e) => setEditingOption({ ...editingOption, selectionType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="single">Single Select (Radio button)</option>
                    <option value="multiple">Multiple Select (Checkboxes)</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                    <input
                      type="checkbox"
                      checked={editingOption.isRequired ?? false}
                      onChange={(e) => setEditingOption({ ...editingOption, isRequired: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-800 focus:ring-0"
                    />
                    <span>Selection Mandatory (Required)</span>
                  </label>
                </div>
              </div>

              {/* Choice Items List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">
                    Choices & Price Modifiers (+/- $)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddChoice}
                    className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-lg flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Choice</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {(editingOption.choices || []).map((c, cIdx) => (
                    <div key={c.id || cIdx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                      <div className="md:col-span-4">
                        <input
                          type="text"
                          value={c.nameEn || ''}
                          onChange={(e) => handleUpdateChoice(cIdx, 'nameEn', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                          placeholder="English Name"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <input
                          type="text"
                          dir="rtl"
                          value={c.nameAr || ''}
                          onChange={(e) => handleUpdateChoice(cIdx, 'nameAr', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                          placeholder="الاسم بالعربية"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400 font-bold">$+</span>
                          <input
                            type="number"
                            step="0.10"
                            value={c.priceModifier || 0}
                            onChange={(e) => handleUpdateChoice(cIdx, 'priceModifier', parseFloat(e.target.value) || 0)}
                            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                          />
                        </div>
                      </div>
                      <div className="md:col-span-2 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => handleDeleteChoice(cIdx)}
                          className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingOption(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCurrentOption}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition"
                >
                  Confirm Option Group
                </button>
              </div>
            </div>
          ) : (
            /* Option Group List */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Configured Option Groups ({optionList.length})
                </span>
                <button
                  onClick={handleStartAddOption}
                  className="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-xl flex items-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Option Group</span>
                </button>
              </div>

              {optionList.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-500 text-xs">
                  No custom options added yet. Click "Add Option Group" to set up Sizes, Add-ons, or Variants.
                </div>
              ) : (
                <div className="space-y-3">
                  {optionList.map((opt, idx) => (
                    <div key={opt.id || idx} className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-white">{opt.nameEn}</h4>
                            {opt.nameAr && <span className="text-[10px] text-slate-400">({opt.nameAr})</span>}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-emerald-400 uppercase">
                              {opt.type}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Rule: {opt.selectionType === 'single' ? 'Single Choice' : 'Multiple Choices'} • {opt.isRequired ? 'Mandatory' : 'Optional'}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStartEditOption(idx)}
                            className="px-3 py-1 bg-slate-900 border border-slate-800 hover:text-white text-xs text-slate-300 rounded-xl"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteOption(idx)}
                            className="p-1.5 text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 rounded-xl"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800/80">
                        {opt.choices.map((c) => (
                          <span key={c.id} className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-medium text-slate-300 flex items-center gap-1.5">
                            <span>{c.nameEn}</span>
                            {c.priceModifier > 0 && (
                              <span className="text-emerald-400 font-bold">(+${c.priceModifier.toFixed(2)})</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
          >
            Cancel
          </button>
          <button
            onClick={handleFinalSave}
            disabled={loading}
            className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{loading ? 'Saving Changes...' : 'Save Product Options'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
