import React, { useState } from 'react';
import { Category } from '../../../types';
import { useAuth } from '../../context/AuthContext';
import { validateCategoryForm, ValidationError } from '../../../lib/validation/productValidation';
import { compressAndOptimizeImage } from '../../../infrastructure/storage/imageService';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Layers
} from 'lucide-react';

interface CategoryManagementModalProps {
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSaveCategory: (categoryData: Partial<Category>, isEdit: boolean) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onReorderCategories: (orderedList: { id: string; order: number }[]) => Promise<void>;
}

export const CategoryManagementModal: React.FC<CategoryManagementModalProps> = ({
  categories,
  isOpen,
  onClose,
  onSaveCategory,
  onDeleteCategory,
  onReorderCategories
}) => {
  const { t, language } = useAuth();
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setEditingCategory({
      name: '',
      nameEn: '',
      nameAr: '',
      nameSo: '',
      description: '',
      imageUrl: '',
      order: categories.length + 1,
      isActive: true
    });
    setIsCreating(true);
    setErrors([]);
  };

  const handleStartEdit = (cat: Category) => {
    setEditingCategory({ ...cat });
    setIsCreating(false);
    setErrors([]);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await compressAndOptimizeImage(file);
      setEditingCategory(prev => prev ? { ...prev, imageUrl: result.dataUrl } : null);
    } catch (err) {
      alert('Failed to process image upload');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    const validationErrors = validateCategoryForm(editingCategory);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const payload: Partial<Category> = {
        ...editingCategory,
        name: editingCategory.nameEn || editingCategory.name
      };
      await onSaveCategory(payload, !isCreating);
      setEditingCategory(null);
      setIsCreating(false);
    } catch (err: any) {
      alert(`Error saving category: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const moveCategory = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const list = [...categories];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    const reordered = list.map((c, i) => ({ id: c.id, order: i + 1 }));
    await onReorderCategories(reordered);
  };

  const getFieldError = (field: string) => errors.find(e => e.field === field)?.message;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Menu Categories Management</h2>
              <p className="text-xs text-slate-400">Organize and sort your restaurant menu categories</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {editingCategory ? (
            /* Category Form */
            <form onSubmit={handleSubmit} className="space-y-5 bg-slate-950/80 p-5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-emerald-400">
                  {isCreating ? 'Add New Category' : `Edit Category: ${editingCategory.nameEn || ''}`}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              {/* Multi-lingual Category Names */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    English Name *
                  </label>
                  <input
                    type="text"
                    value={editingCategory.nameEn || ''}
                    onChange={(e) => setEditingCategory({ ...editingCategory, nameEn: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Main Course"
                  />
                  {getFieldError('nameEn') && (
                    <p className="text-[10px] text-rose-400 mt-1">{getFieldError('nameEn')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Arabic Name (اسم الفئة) *
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={editingCategory.nameAr || ''}
                    onChange={(e) => setEditingCategory({ ...editingCategory, nameAr: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    placeholder="مثال: الأطباق الرئيسية"
                  />
                  {getFieldError('nameAr') && (
                    <p className="text-[10px] text-rose-400 mt-1">{getFieldError('nameAr')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Somali Name *
                  </label>
                  <input
                    type="text"
                    value={editingCategory.nameSo || ''}
                    onChange={(e) => setEditingCategory({ ...editingCategory, nameSo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Cuntada Waaweyn"
                  />
                  {getFieldError('nameSo') && (
                    <p className="text-[10px] text-rose-400 mt-1">{getFieldError('nameSo')}</p>
                  )}
                </div>
              </div>

              {/* Description & Order */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={editingCategory.description || ''}
                    onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Short summary of items in this category"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={editingCategory.order || 1}
                    onChange={(e) => setEditingCategory({ ...editingCategory, order: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Category Image & Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category Image URL or Upload
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingCategory.imageUrl || ''}
                      onChange={(e) => setEditingCategory({ ...editingCategory, imageUrl: e.target.value })}
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                      placeholder="https://..."
                    />
                    <label className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl cursor-pointer transition">
                      <ImageIcon className="w-4 h-4" />
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                    <input
                      type="checkbox"
                      checked={editingCategory.isActive ?? true}
                      onChange={(e) => setEditingCategory({ ...editingCategory, isActive: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-800 focus:ring-0"
                    />
                    <span>Active Status (Visible on Menu)</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{loading ? 'Saving...' : 'Save Category'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Category List View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Active Categories ({categories.length})
                </span>
                <button
                  onClick={handleStartAdd}
                  className="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-xl flex items-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Category</span>
                </button>
              </div>

              <div className="space-y-2">
                {categories.map((cat, index) => (
                  <div
                    key={cat.id}
                    className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl flex items-center justify-between gap-4 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1 text-slate-500">
                        <button
                          disabled={index === 0}
                          onClick={() => moveCategory(index, 'up')}
                          className="hover:text-emerald-400 disabled:opacity-30 disabled:hover:text-slate-500"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={index === categories.length - 1}
                          onClick={() => moveCategory(index, 'down')}
                          className="hover:text-emerald-400 disabled:opacity-30 disabled:hover:text-slate-500"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {cat.imageUrl ? (
                        <img
                          src={cat.imageUrl}
                          alt={cat.name}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-800 bg-slate-900"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl border border-slate-800 bg-slate-900 flex items-center justify-center text-slate-500">
                          <Layers className="w-5 h-5" />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white">{cat.nameEn || cat.name}</h4>
                          {cat.nameAr && <span className="text-[10px] text-slate-400 font-mono">({cat.nameAr})</span>}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate max-w-xs">{cat.description || 'No description'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        cat.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {cat.isActive ? 'Active' : 'Inactive'}
                      </span>

                      <button
                        onClick={() => handleStartEdit(cat)}
                        className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={async () => {
                          if (confirm(`Are you sure you want to delete category "${cat.nameEn || cat.name}"?`)) {
                            await onDeleteCategory(cat.id);
                          }
                        }}
                        className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
