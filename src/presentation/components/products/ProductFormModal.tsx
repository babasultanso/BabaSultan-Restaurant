import React, { useState, useEffect } from 'react';
import { Product, Category, Ingredient, RecipeIngredient, ProductOption } from '../../../types';
import { useAuth } from '../../context/AuthContext';
import { validateProductForm, ValidationError } from '../../../lib/validation/productValidation';
import { compressAndOptimizeImage } from '../../../infrastructure/storage/imageService';
import {
  X,
  Plus,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Tag,
  Boxes,
  Barcode,
  Flame,
  FileText,
  DollarSign,
  Sliders,
  Layers,
  Sparkles
} from 'lucide-react';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit: Product | null;
  categories: Category[];
  availableIngredients: Ingredient[];
  onSaveProduct: (productData: Partial<Product>, isEdit: boolean) => Promise<void>;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  categories,
  availableIngredients,
  onSaveProduct
}) => {
  const { t } = useAuth();
  const [activeTab, setActiveTab] = useState<'basic' | 'pricing' | 'images' | 'recipe' | 'options'>('basic');
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (productToEdit) {
      setFormData({ ...productToEdit });
    } else {
      setFormData({
        name: '',
        nameEn: '',
        nameAr: '',
        nameSo: '',
        description: '',
        shortDescription: '',
        imageUrl: '',
        images: [],
        category: categories[0]?.name || 'Main Course',
        categoryId: categories[0]?.id || 'cat_main',
        price: 0,
        discountPrice: 0,
        cost: 0,
        tax: 0,
        prepTimeMinutes: 15,
        availabilityStatus: 'enabled',
        isFeatured: false,
        sku: '',
        barcode: '',
        stock: 0,
        minStockAlert: 10,
        unit: 'Portion',
        salesCount: 0,
        ingredients: [],
        calories: 0,
        options: []
      });
    }
    setErrors([]);
    setActiveTab('basic');
  }, [productToEdit, categories, isOpen]);

  if (!isOpen) return null;

  const getFieldError = (field: string) => errors.find((e) => e.field === field)?.message;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await compressAndOptimizeImage(file);
      setFormData((prev) => ({ ...prev, imageUrl: result.dataUrl }));
    } catch (err) {
      alert('Failed to process image upload');
    }
  };

  const handleAddGalleryImage = (url: string) => {
    const current = formData.images || [];
    setFormData((prev) => ({ ...prev, images: [...current, url] }));
  };

  const handleRemoveGalleryImage = (index: number) => {
    const current = formData.images || [];
    setFormData((prev) => ({ ...prev, images: current.filter((_, i) => i !== index) }));
  };

  const handleAddRecipeIngredient = () => {
    if (availableIngredients.length === 0) return;
    const firstIng = availableIngredients[0];
    const current = formData.ingredients || [];
    const newRecipeItem: RecipeIngredient = {
      ingredientId: firstIng.id,
      ingredientName: firstIng.name,
      requiredQuantity: 0.1,
      unit: firstIng.unit || 'kg'
    };
    setFormData((prev) => ({ ...prev, ingredients: [...current, newRecipeItem] }));
  };

  const handleUpdateRecipeIngredient = (index: number, field: keyof RecipeIngredient, value: any) => {
    const current = [...(formData.ingredients || [])];
    if (field === 'ingredientId') {
      const targetIng = availableIngredients.find((i) => i.id === value);
      current[index] = {
        ...current[index],
        ingredientId: value,
        ingredientName: targetIng?.name || 'Ingredient',
        unit: targetIng?.unit || 'kg'
      };
    } else {
      current[index] = { ...current[index], [field]: value };
    }
    setFormData((prev) => ({ ...prev, ingredients: current }));
  };

  const handleRemoveRecipeIngredient = (index: number) => {
    const current = formData.ingredients || [];
    setFormData((prev) => ({ ...prev, ingredients: current.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateProductForm(formData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      // Switch to basic or relevant tab
      if (validationErrors.some((e) => ['nameEn', 'nameAr', 'nameSo', 'category', 'sku'].includes(e.field))) {
        setActiveTab('basic');
      } else if (validationErrors.some((e) => ['price', 'discountPrice', 'prepTimeMinutes'].includes(e.field))) {
        setActiveTab('pricing');
      }
      return;
    }

    setLoading(true);
    try {
      const payload: Partial<Product> = {
        ...formData,
        name: formData.nameEn || formData.name || 'Unnamed Dish'
      };
      await onSaveProduct(payload, !!productToEdit);
      onClose();
    } catch (err: any) {
      alert(`Error saving product: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {productToEdit ? `Edit Product: ${productToEdit.nameEn || productToEdit.name}` : 'Add New Restaurant Product'}
              </h2>
              <p className="text-xs text-slate-400">Configure multi-lingual details, prices, images, recipes & options</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 bg-slate-950/40 border-b border-slate-800 flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'basic', label: '1. Basic Info (Multi-lingual)', icon: FileText },
            { id: 'pricing', label: '2. Pricing & Stock', icon: DollarSign },
            { id: 'images', label: '3. Images & Gallery', icon: ImageIcon },
            { id: 'recipe', label: '4. Recipe & Ingredients', icon: Boxes },
            { id: 'options', label: '5. Options & Variants', icon: Sliders }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-emerald-400 border-t border-x border-slate-800 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">

          {/* TAB 1: BASIC INFORMATION */}
          {activeTab === 'basic' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    English Name *
                  </label>
                  <input
                    type="text"
                    value={formData.nameEn || ''}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Camel Meat Rice Special"
                  />
                  {getFieldError('nameEn') && (
                    <p className="text-[10px] text-rose-400 mt-1">{getFieldError('nameEn')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Arabic Name (اسم الوجبة) *
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={formData.nameAr || ''}
                    onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    placeholder="مثال: أرز باللحم الإبل الصومالي"
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
                    value={formData.nameSo || ''}
                    onChange={(e) => setFormData({ ...formData, nameSo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Bariis Iskukaris oo Geel ah"
                  />
                  {getFieldError('nameSo') && (
                    <p className="text-[10px] text-rose-400 mt-1">{getFieldError('nameSo')}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Menu Category *
                  </label>
                  <select
                    value={formData.categoryId || ''}
                    onChange={(e) => {
                      const selectedCat = categories.find((c) => c.id === e.target.value);
                      setFormData({
                        ...formData,
                        categoryId: e.target.value,
                        category: selectedCat?.name || selectedCat?.nameEn || 'Main Course'
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameEn || c.name} ({c.nameAr || 'عربي'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    value={formData.sku || ''}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    placeholder="e.g. SKU-BAR-002"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Barcode
                  </label>
                  <input
                    type="text"
                    value={formData.barcode || ''}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    placeholder="e.g. 600123456002"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Short Description
                </label>
                <input
                  type="text"
                  value={formData.shortDescription || ''}
                  onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Catchy tagline for POS terminal & digital menu"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Detailed Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Ingredients, marinade details, cooking method..."
                />
              </div>
            </div>
          )}

          {/* TAB 2: PRICING & STOCK */}
          {activeTab === 'pricing' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Regular Selling Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price || 0}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-bold"
                  />
                  {getFieldError('price') && (
                    <p className="text-[10px] text-rose-400 mt-1">{getFieldError('price')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Discounted Promo Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.discountPrice || 0}
                    onChange={(e) => setFormData({ ...formData, discountPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-emerald-400 focus:outline-none focus:border-emerald-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cost Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost || 0}
                    onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={typeof formData.tax === 'number' ? formData.tax * 100 : 0}
                    onChange={(e) => setFormData({ ...formData, tax: (parseFloat(e.target.value) || 0) / 100 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Prep Time (Minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.prepTimeMinutes || 15}
                    onChange={(e) => setFormData({ ...formData, prepTimeMinutes: parseInt(e.target.value) || 15 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Availability Status
                  </label>
                  <select
                    value={formData.availabilityStatus || 'enabled'}
                    onChange={(e) => setFormData({ ...formData, availabilityStatus: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="enabled">Enabled (Available)</option>
                    <option value="disabled">Disabled (Hidden)</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    value={formData.stock || 0}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Unit Type
                  </label>
                  <input
                    type="text"
                    value={formData.unit || 'Portion'}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Portion, Cup, Glass"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Estimated Calories (kcal)
                  </label>
                  <input
                    type="number"
                    value={formData.calories || 0}
                    onChange={(e) => setFormData({ ...formData, calories: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                    <input
                      type="checkbox"
                      checked={formData.isFeatured ?? false}
                      onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-800 focus:ring-0"
                    />
                    <span>Highlight as Featured Chef Special</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: IMAGES & GALLERY */}
          {activeTab === 'images' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Primary Product Image URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={formData.imageUrl || ''}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    placeholder="https://images.unsplash.com/..."
                  />
                  <label className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl cursor-pointer transition flex items-center gap-2 text-xs font-bold">
                    <ImageIcon className="w-4 h-4" />
                    <span>Upload & Compress</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Image Preview Banner */}
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center gap-4">
                {formData.imageUrl ? (
                  <img
                    src={formData.imageUrl}
                    alt="Preview"
                    className="w-20 h-20 rounded-xl object-cover border border-slate-800 bg-slate-900"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                )}
                <div>
                  <h4 className="text-xs font-bold text-white">Product Image Preview</h4>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {formData.imageUrl
                      ? 'Custom product image is set and will be displayed in POS and KDS.'
                      : 'No image uploaded yet. A neutral placeholder icon will be displayed.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RECIPE & INGREDIENT LINKING */}
          {activeTab === 'recipe' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-emerald-400">Recipe Ingredients & Automatic Inventory Connection</h3>
                  <p className="text-[10px] text-slate-400">Linking raw ingredients will automatically deduct stock upon order completion</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddRecipeIngredient}
                  className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-xl flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Link Ingredient</span>
                </button>
              </div>

              <div className="space-y-2">
                {(formData.ingredients || []).length === 0 ? (
                  <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-500 text-xs">
                    No raw ingredients linked to this product yet. Click "Link Ingredient" to connect inventory items.
                  </div>
                ) : (
                  (formData.ingredients || []).map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      <div className="md:col-span-5">
                        <select
                          value={item.ingredientId}
                          onChange={(e) => handleUpdateRecipeIngredient(idx, 'ingredientId', e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                        >
                          {availableIngredients.map((ing) => (
                            <option key={ing.id} value={ing.id}>
                              {ing.name} ({ing.stock} {ing.unit} available)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-4 flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-bold">Qty / Portion:</span>
                        <input
                          type="number"
                          step="0.01"
                          value={item.requiredQuantity || 0.1}
                          onChange={(e) => handleUpdateRecipeIngredient(idx, 'requiredQuantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-bold"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <span className="text-xs text-slate-300 font-semibold">{item.unit || 'kg'}</span>
                      </div>

                      <div className="md:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveRecipeIngredient(idx)}
                          className="p-1.5 text-rose-400 hover:text-rose-300 rounded-xl hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: OPTIONS & VARIANTS SUMMARY */}
          {activeTab === 'options' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Configured Product Options ({formData.options?.length || 0})</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Sizes, Add-ons, and Custom Variants for this menu item</p>
                </div>
              </div>

              {(formData.options || []).length === 0 ? (
                <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-500 text-xs">
                  No custom option groups configured on this product yet. You can manage global and custom option groups using the Options Manager.
                </div>
              ) : (
                <div className="space-y-2">
                  {(formData.options || []).map((opt, i) => (
                    <div key={i} className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
                      <span className="font-bold text-white">{opt.nameEn} ({opt.type})</span>
                      <span className="text-slate-400">{opt.choices?.length || 0} choices</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </form>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-semibold">SKU: {formData.sku}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Saving...' : productToEdit ? 'Update Product' : 'Create Product'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
