import React from 'react';
import { Product, Category } from '../../../types';
import { useAuth } from '../../context/AuthContext';
import { productService } from '../../../domain/services/productService';
import {
  X,
  Clock,
  Tag,
  Boxes,
  Barcode,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  DollarSign
} from 'lucide-react';

interface ProductDetailsModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  product,
  isOpen,
  onClose,
  categories
}) => {
  const { language } = useAuth();

  if (!isOpen || !product) return null;

  const pricing = productService.calculateEffectivePrice(product);
  const status = product.availabilityStatus || 'enabled';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Image Banner */}
        <div className="relative h-48 bg-slate-950 overflow-hidden">
          <img
            src={product.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
          
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-slate-950/80 hover:bg-slate-900 text-white rounded-xl backdrop-blur-md transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
            <div>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                {product.category}
              </span>
              <h2 className="text-xl font-bold text-white mt-1">{product.nameEn || product.name}</h2>
              {product.nameAr && <p className="text-xs text-slate-300 font-medium dir-rtl">{product.nameAr}</p>}
            </div>

            <div className="text-right bg-slate-950/80 backdrop-blur-md p-3 rounded-2xl border border-slate-800">
              {pricing.hasDiscount ? (
                <div>
                  <span className="text-xs text-slate-400 line-through mr-2">${pricing.originalPrice.toFixed(2)}</span>
                  <span className="text-lg font-extrabold text-emerald-400">${pricing.currentPrice.toFixed(2)}</span>
                </div>
              ) : (
                <span className="text-lg font-extrabold text-emerald-400">${pricing.currentPrice.toFixed(2)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Status Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <span className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
              status === 'enabled' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
              status === 'out_of_stock' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
              'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Status: {(status || 'ENABLED').toUpperCase()}</span>
            </span>

            {product.isFeatured && (
              <span className="px-3 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-xl text-xs font-bold flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" />
                <span>Featured Dish</span>
              </span>
            )}

            <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Prep Time: {product.prepTimeMinutes || 15} Mins</span>
            </span>

            {product.calories && (
              <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium">
                🔥 {product.calories} kcal
              </span>
            )}
          </div>

          {/* Descriptions */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</h4>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
              {product.description || product.shortDescription || 'No description provided for this menu item.'}
            </p>
          </div>

          {/* Multi-Lingual Names Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl">
              <span className="text-[10px] text-slate-400 block font-semibold">English Name</span>
              <p className="text-xs font-bold text-white mt-1">{product.nameEn || product.name}</p>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl">
              <span className="text-[10px] text-slate-400 block font-semibold">Arabic Name</span>
              <p className="text-xs font-bold text-white mt-1 dir-rtl">{product.nameAr || 'غير محدد'}</p>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl">
              <span className="text-[10px] text-slate-400 block font-semibold">Somali Name</span>
              <p className="text-xs font-bold text-white mt-1">{product.nameSo || 'Aan la cayimin'}</p>
            </div>
          </div>

          {/* Technical ERP Fields */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">SKU Code</span>
              <p className="text-xs font-mono font-bold text-slate-200">{product.sku || 'N/A'}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">Barcode</span>
              <p className="text-xs font-mono font-bold text-slate-200">{product.barcode || 'N/A'}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">Cost Price</span>
              <p className="text-xs font-bold text-emerald-400">${(product.cost || 0).toFixed(2)}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">Stock Quantity</span>
              <p className="text-xs font-bold text-slate-200">{product.stock} {product.unit || 'Units'}</p>
            </div>
          </div>

          {/* Recipe Ingredients Linkage */}
          {product.ingredients && product.ingredients.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Boxes className="w-4 h-4 text-emerald-400" />
                <span>Recipe & Inventory Linkage (Auto-Deducted)</span>
              </h4>
              <div className="space-y-2">
                {product.ingredients.map((ing, i) => (
                  <div key={i} className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{ing.ingredientName}</span>
                    <span className="text-emerald-400 font-bold">{ing.requiredQuantity} {ing.unit} per dish</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Options */}
          {product.options && product.options.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>Configured Options & Add-ons</span>
              </h4>
              <div className="space-y-2">
                {product.options.map((opt, i) => (
                  <div key={i} className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{opt.nameEn} ({opt.type})</span>
                      <span className="text-[10px] text-slate-400">{opt.isRequired ? 'Mandatory' : 'Optional'}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {opt.choices.map(c => (
                        <span key={c.id} className="px-2 py-1 bg-slate-900 text-[10px] font-medium text-slate-300 rounded-lg border border-slate-800">
                          {c.nameEn} {c.priceModifier > 0 && `(+$${c.priceModifier})`}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
          >
            Close Details
          </button>
        </div>

      </div>
    </div>
  );
};
