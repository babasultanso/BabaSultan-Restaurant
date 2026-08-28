import React, { useState, useEffect } from 'react';
import { Product, Category, Ingredient, ProductOption } from '../../../types';
import { useAuth } from '../../context/AuthContext';
import { productRepository } from '../../../infrastructure/firebase/productRepository';
import { categoryRepository } from '../../../infrastructure/firebase/categoryRepository';
import { productService } from '../../../domain/services/productService';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db, COLLECTIONS, logActivityFirestore } from '../../../lib/firebase';
import { ProductFormModal } from './ProductFormModal';
import { CategoryManagementModal } from './CategoryManagementModal';
import { ProductOptionsModal } from './ProductOptionsModal';
import { ProductDetailsModal } from './ProductDetailsModal';
import {
  Search,
  Plus,
  Filter,
  Grid,
  List,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sliders,
  Flame,
  Clock,
  Tag,
  DollarSign,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
  Sparkles
} from 'lucide-react';

export const ProductManagementView: React.FC = () => {
  const { user, permissions, role, language, t } = useAuth();
  
  // Localized Labels
  const titleText = language === 'ar' ? 'إدارة المنتجات وقائمة الطعام' : language === 'so' ? 'Maamulka Cuntada & Menu-ga' : 'Product & Restaurant Menu Management';
  const subtitleText = language === 'ar' ? 'إدارة الوجبات والتصنيفات والأسعار والخيارات المتعددة للغات' : language === 'so' ? 'Maamul cuntada, noocyada, qiimaha iyo xiriirinta inventory-ga' : 'Manage multi-lingual dishes, categories, pricing, options & recipe inventory connections';
  const manageCategoriesText = language === 'ar' ? 'إدارة التصنيفات' : language === 'so' ? 'Maamul Noocyada' : 'Manage Categories';
  const productOptionsText = language === 'ar' ? 'خيارات الوجبات' : language === 'so' ? 'Xulashooyinka Cuntada' : 'Product Options';
  const addProductText = language === 'ar' ? 'إضافة وجبة جديدة' : language === 'so' ? 'Kudar Cunto Cusub' : 'Add New Product';
  const totalProductsText = language === 'ar' ? 'إجمالي المنتجات' : language === 'so' ? 'Warta Cuntooyinka' : 'Total Products';
  const activeMenuItemsText = language === 'ar' ? 'الوجبات النشطة' : language === 'so' ? 'Cuntooyinka Aktiv-ka' : 'Active Menu Items';
  const lowStockAlertsText = language === 'ar' ? 'تنبيهات المخزون' : language === 'so' ? 'Digiinaha Stock-ka' : 'Low Stock Alerts';
  const featuredSpecialsText = language === 'ar' ? 'العروض المميزة' : language === 'so' ? 'Cuntooyinka Gaarka Ah' : 'Featured Specials';
  
  // Real-time Firestore State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');
  const [isFeaturedOnly, setIsFeaturedOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modal Control States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<Product | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const canManage = permissions?.canManageProducts ?? true;
  const canView = permissions?.canViewProducts ?? true;

  // Subscribe to Firestore collections in real time
  useEffect(() => {
    setLoading(true);

    const unsubProducts = onSnapshot(query(collection(db, COLLECTIONS.PRODUCTS)), (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
      setProducts(items);
      setLoading(false);
    }, (err) => {
      console.warn('Products snapshot error:', err);
      setLoading(false);
    });

    const unsubCategories = onSnapshot(query(collection(db, COLLECTIONS.CATEGORIES)), (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
      items.sort((a, b) => (a.order || 0) - (b.order || 0));
      setCategories(items);
    }, (err) => {
      console.warn('Categories snapshot error:', err);
    });

    const unsubIngredients = onSnapshot(query(collection(db, COLLECTIONS.INGREDIENTS)), (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ingredient));
      setIngredients(items);
    }, (err) => {
      console.warn('Ingredients snapshot error:', err);
    });

    return () => {
      unsubProducts();
      unsubCategories();
      unsubIngredients();
    };
  }, []);

  if (!canView) {
    return (
      <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl max-w-xl mx-auto my-12">
        <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">Access Restricted</h3>
        <p className="text-xs text-slate-400">Your role ({role}) does not have permissions to view restaurant product management.</p>
      </div>
    );
  }

  // Filter products using domain service
  const filteredProducts = productService.filterAndSearchProducts(
    products,
    searchTerm,
    selectedCategory,
    availabilityFilter,
    isFeaturedOnly
  );

  // Metrics calculation
  const totalProducts = products.length;
  const activeProductsCount = products.filter((p) => p.availabilityStatus === 'enabled' || !p.availabilityStatus).length;
  const lowStockCount = products.filter((p) => p.stock <= (p.minStockAlert || 10)).length;
  const featuredCount = products.filter((p) => p.isFeatured).length;

  // Handlers
  const handleOpenAddProduct = () => {
    setProductToEdit(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (p: Product) => {
    setProductToEdit(p);
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (data: Partial<Product>, isEdit: boolean) => {
    if (isEdit && productToEdit) {
      await productRepository.updateProduct(productToEdit.id, data);
      await logActivityFirestore({
        action: 'UPDATE_PRODUCT',
        details: `Updated product ${data.nameEn || data.name}`
      });
    } else {
      await productRepository.addProduct(data as Omit<Product, 'id'>);
      await logActivityFirestore({
        action: 'ADD_PRODUCT',
        details: `Created new menu product ${data.nameEn || data.name}`
      });
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete product "${name}"? This action cannot be undone.`)) {
      await productRepository.deleteProduct(id);
      await logActivityFirestore({
        action: 'DELETE_PRODUCT',
        details: `Deleted product ID ${id}`
      });
    }
  };

  const handleToggleAvailability = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'enabled' ? 'disabled' : 'enabled';
    await productRepository.toggleAvailability(id, nextStatus as any);
  };

  // Category Save Handler
  const handleSaveCategory = async (catData: Partial<Category>, isEdit: boolean) => {
    if (isEdit && catData.id) {
      await categoryRepository.updateCategory(catData.id, catData);
    } else {
      await categoryRepository.addCategory(catData as Omit<Category, 'id'>);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    await categoryRepository.deleteCategory(id);
  };

  const handleReorderCategories = async (orderedList: { id: string; order: number }[]) => {
    await categoryRepository.reorderCategories(orderedList);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Phase 4 • Restaurant Menu & Catalog Engine</span>
          </div>
          <h1 className="text-xl font-extrabold text-white">{titleText}</h1>
          <p className="text-xs text-slate-400 mt-1">
            {subtitleText}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-2xl border border-slate-700 flex items-center gap-2 transition"
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>{manageCategoriesText}</span>
          </button>

          <button
            onClick={() => setIsOptionsModalOpen(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-2xl border border-slate-700 flex items-center gap-2 transition"
          >
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>{productOptionsText}</span>
          </button>

          {canManage && (
            <button
              onClick={handleOpenAddProduct}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-2xl shadow-lg shadow-emerald-500/10 flex items-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>{addProductText}</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{totalProductsText}</span>
            <span className="text-2xl font-extrabold text-white">{totalProducts}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{activeMenuItemsText}</span>
            <span className="text-2xl font-extrabold text-emerald-400">{activeProductsCount}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{lowStockAlertsText}</span>
            <span className="text-2xl font-extrabold text-amber-400">{lowStockCount}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center justify-center">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{featuredSpecialsText}</span>
            <span className="text-2xl font-extrabold text-white">{featuredCount}</span>
          </div>
        </div>
      </div>

      {/* Category Pills Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            selectedCategory === 'all'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
          }`}
        >
          All Categories ({products.length})
        </button>

        {categories.map((c) => {
          const count = products.filter((p) => p.categoryId === c.id || p.category === c.name).length;
          const isSelected = selectedCategory === c.id || selectedCategory === c.name;
          const catName = productService.getLocalizedCategoryName(c, language as any);

          return (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition whitespace-nowrap flex items-center gap-2 ${
                isSelected
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
              }`}
            >
              <span>{catName}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Bar */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Dish Name (English, Arabic, Somali), SKU, Barcode, or ingredients..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Statuses</option>
            <option value="enabled">Enabled Only</option>
            <option value="disabled">Disabled Only</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>

          <button
            onClick={() => setIsFeaturedOnly(!isFeaturedOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
              isFeaturedOnly
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Featured</span>
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'grid' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'table' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-16 text-center text-slate-500 text-xs">
          Loading restaurant menu database...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-16 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
          <Tag className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">No products match your filter criteria</h3>
          <p className="text-xs text-slate-400">Try adjusting your search keywords or category filters.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map((product) => {
            const pricing = productService.calculateEffectivePrice(product);
            const status = product.availabilityStatus || 'enabled';
            const localizedName = productService.getLocalizedName(product, language as any);

            return (
              <div
                key={product.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl overflow-hidden shadow-xl transition flex flex-col group"
              >
                {/* Image Banner */}
                <div className="relative h-44 bg-slate-950 overflow-hidden">
                  <img
                    src={product.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />

                  {/* Category Pill */}
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-slate-950/80 backdrop-blur-md text-emerald-400 border border-slate-800">
                    {product.category}
                  </span>

                  {/* Featured Badge */}
                  {product.isFeatured && (
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-500/80 text-slate-950 backdrop-blur-md flex items-center gap-1">
                      <Flame className="w-3 h-3" />
                      <span>Featured</span>
                    </span>
                  )}

                  {/* Availability Badge */}
                  <div className="absolute bottom-3 left-3">
                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold ${
                      status === 'enabled' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      status === 'out_of_stock' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {(status || 'ENABLED').toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition">{product.nameEn || product.name}</h3>
                        {product.nameAr && <p className="text-xs text-slate-400 font-medium dir-rtl">{product.nameAr}</p>}
                      </div>

                      <div className="text-right">
                        {pricing.hasDiscount ? (
                          <div>
                            <span className="text-[10px] text-slate-500 line-through block">${pricing.originalPrice.toFixed(2)}</span>
                            <span className="text-sm font-extrabold text-emerald-400">${pricing.currentPrice.toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="text-sm font-extrabold text-emerald-400">${pricing.currentPrice.toFixed(2)}</span>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-2">
                      {product.shortDescription || product.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Meta Pills */}
                  <div className="pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-[10px] text-slate-400 font-mono">
                    <div>
                      <span className="block text-slate-500 text-[9px]">SKU</span>
                      <span className="font-bold text-slate-300 truncate block">{product.sku}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 text-[9px]">PREP</span>
                      <span className="font-bold text-slate-300 block">{product.prepTimeMinutes || 15} min</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 text-[9px]">STOCK</span>
                      <span className={`font-bold block ${product.stock <= (product.minStockAlert || 10) ? 'text-amber-400' : 'text-slate-300'}`}>
                        {product.stock} {product.unit || 'Portion'}
                      </span>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="pt-2 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleToggleAvailability(product.id, status)}
                      className={`p-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                        status === 'enabled'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                      title="Toggle Active Status"
                    >
                      {status === 'enabled' ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setSelectedDetailProduct(product);
                          setIsDetailsModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-white bg-slate-950 border border-slate-800 rounded-xl transition"
                        title="View Full Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {canManage && (
                        <>
                          <button
                            onClick={() => handleOpenEditProduct(product)}
                            className="p-2 text-slate-400 hover:text-emerald-400 bg-slate-950 border border-slate-800 rounded-xl transition"
                            title="Edit Product"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteProduct(product.id, product.nameEn || product.name)}
                            className="p-2 text-rose-400 hover:bg-rose-500/10 bg-slate-950 border border-slate-800 rounded-xl transition"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="p-4">Dish</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">SKU / Barcode</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4">Prep Time</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProducts.map((p) => {
                  const pricing = productService.calculateEffectivePrice(p);
                  const status = p.availabilityStatus || 'enabled';

                  return (
                    <tr key={p.id} className="hover:bg-slate-950/40 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'}
                            alt={p.name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-800 bg-slate-950"
                          />
                          <div>
                            <span className="font-bold text-white block">{p.nameEn || p.name}</span>
                            {p.nameAr && <span className="text-[10px] text-slate-400 block dir-rtl">{p.nameAr}</span>}
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-950 text-emerald-400 border border-slate-800">
                          {p.category}
                        </span>
                      </td>

                      <td className="p-4 font-mono text-[11px]">
                        <div>{p.sku}</div>
                        <div className="text-slate-500 text-[10px]">{p.barcode || '-'}</div>
                      </td>

                      <td className="p-4">
                        {pricing.hasDiscount ? (
                          <div>
                            <span className="text-[10px] text-slate-500 line-through mr-1">${pricing.originalPrice.toFixed(2)}</span>
                            <span className="font-extrabold text-emerald-400">${pricing.currentPrice.toFixed(2)}</span>
                          </div>
                        ) : (
                          <span className="font-extrabold text-emerald-400">${pricing.currentPrice.toFixed(2)}</span>
                        )}
                      </td>

                      <td className="p-4 font-bold">
                        <span className={p.stock <= (p.minStockAlert || 10) ? 'text-amber-400' : 'text-slate-200'}>
                          {p.stock} {p.unit || 'Portion'}
                        </span>
                      </td>

                      <td className="p-4 text-slate-400">
                        {p.prepTimeMinutes || 15} Mins
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold ${
                          status === 'enabled' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          status === 'out_of_stock' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {(status || 'ENABLED').toUpperCase()}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedDetailProduct(p);
                              setIsDetailsModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {canManage && (
                            <>
                              <button
                                onClick={() => handleOpenEditProduct(p)}
                                className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg transition"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteProduct(p.id, p.nameEn || p.name)}
                                className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals Integration */}
      <ProductFormModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        productToEdit={productToEdit}
        categories={categories}
        availableIngredients={ingredients}
        onSaveProduct={handleSaveProduct}
      />

      <CategoryManagementModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        onSaveCategory={handleSaveCategory}
        onDeleteCategory={handleDeleteCategory}
        onReorderCategories={handleReorderCategories}
      />

      <ProductOptionsModal
        isOpen={isOptionsModalOpen}
        onClose={() => setIsOptionsModalOpen(false)}
        options={[]}
        onSaveOptions={async () => {}}
      />

      <ProductDetailsModal
        product={selectedDetailProduct}
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        categories={categories}
      />

    </div>
  );
};
