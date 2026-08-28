import React, { useState } from 'react';
import { Product, Ingredient, InventoryMovement } from '../../types';
import { InventoryRepositoryImpl } from '../../data/repositories/InventoryRepositoryImpl';
import { useAuth } from '../context/AuthContext';
import {
  Package,
  AlertTriangle,
  PlusCircle,
  X,
  CheckCircle2,
  Sliders,
  History,
  Layers,
  Search
} from 'lucide-react';

interface InventoryViewProps {
  products: Product[];
  ingredients: Ingredient[];
  movements: InventoryMovement[];
  onRefresh?: () => void;
}

const inventoryRepo = new InventoryRepositoryImpl();

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  ingredients,
  movements,
  onRefresh
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'ingredients' | 'products' | 'movements'>('ingredients');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isAddIngredientOpen, setIsAddIngredientOpen] = useState<boolean>(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState<boolean>(false);
  const [adjustItem, setAdjustItem] = useState<{ id: string; name: string; type: 'product' | 'ingredient'; currentStock: number } | null>(null);

  // Form states
  const [newStockVal, setNewStockVal] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('Physical Stock Count');

  const [ingName, setIngName] = useState<string>('');
  const [ingStock, setIngStock] = useState<number>(10);
  const [ingUnit, setIngUnit] = useState<string>('kg');
  const [ingMinAlert, setIngMinAlert] = useState<number>(5);
  const [ingCost, setIngCost] = useState<number>(2.50);
  const [ingSupplier, setIngSupplier] = useState<string>('Primary Wholesale Ltd');

  const [prodName, setProdName] = useState<string>('');
  const [prodCat, setProdCat] = useState<string>('Main Course');
  const [prodPrice, setProdPrice] = useState<number>(14.99);
  const [prodCost, setProdCost] = useState<number>(5.00);
  const [prodStock, setProdStock] = useState<number>(25);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const lowIngredients = ingredients.filter(i => i.stock <= i.minStockAlert);
  const lowProducts = products.filter(p => p.stock <= p.minStockAlert);

  const handleAdjustSave = async () => {
    if (!adjustItem) return;
    setIsSubmitting(true);
    try {
      await inventoryRepo.recordMovement({
        type: 'adjustment',
        itemId: adjustItem.id,
        itemName: adjustItem.name,
        quantity: newStockVal,
        unit: 'units',
        reason: adjustReason || 'Manual adjustment',
        createdBy: user?.displayName || 'Inventory Manager'
      });
      setAdjustItem(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Stock adjustment error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await inventoryRepo.addInventoryItem({
        itemName: ingName,
        itemCode: `ING-${Math.floor(1000 + Math.random() * 9000)}`,
        barcode: `BAR-${Math.floor(10000 + Math.random() * 90000)}`,
        category: 'Raw Materials',
        currentQuantity: ingStock,
        unit: ingUnit,
        purchaseCost: ingCost,
        sellingCost: 0,
        minimumQuantity: ingMinAlert,
        maximumQuantity: 500,
        reorderLevel: ingMinAlert + 5,
        storageLocation: 'Main Kitchen Storage',
        supplierName: ingSupplier,
        status: 'in_stock'
      });
      setIsAddIngredientOpen(false);
      setIngName('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Error creating ingredient: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await inventoryRepo.addInventoryItem({
        itemName: prodName,
        itemCode: `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
        barcode: `BAR-${Math.floor(10000 + Math.random() * 90000)}`,
        category: 'Finished Products',
        currentQuantity: prodStock,
        unit: 'portions',
        purchaseCost: prodCost,
        sellingCost: prodPrice,
        minimumQuantity: 5,
        maximumQuantity: 100,
        reorderLevel: 10,
        storageLocation: 'Display Counter',
        status: 'in_stock'
      });
      setIsAddProductOpen(false);
      setProdName('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Error creating dish: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Quick Action Trigger Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-400" />
            Kitchen Inventory & Menu Catalog
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time stock control, threshold alerts & automatic sales deductions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddIngredientOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3.5 py-2 rounded-2xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            Add Raw Ingredient
          </button>
          <button
            onClick={() => setIsAddProductOpen(true)}
            className="bg-teal-600 hover:bg-teal-500 text-white font-bold px-3.5 py-2 rounded-2xl text-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Add Menu Dish
          </button>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('ingredients')}
            className={`px-4 py-2 rounded-xl transition font-bold cursor-pointer ${
              activeTab === 'ingredients' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Raw Kitchen Ingredients ({ingredients.length})
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-xl transition font-bold cursor-pointer ${
              activeTab === 'products' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Menu Dishes ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-4 py-2 rounded-xl transition font-bold cursor-pointer ${
              activeTab === 'movements' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Stock Movement Log ({movements.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search inventory items..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Stock Alerts Banner */}
      {(lowIngredients.length > 0 || lowProducts.length > 0) && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300">
              <strong>Stock Threshold Warning:</strong> {lowIngredients.length + lowProducts.length} items below minimum reserve limit.
            </p>
          </div>
        </div>
      )}

      {/* Ingredients Table */}
      {activeTab === 'ingredients' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-4 px-6">Ingredient</th>
                  <th className="py-4 px-6">Stock Level</th>
                  <th className="py-4 px-6">Alert Limit</th>
                  <th className="py-4 px-6">Unit Cost</th>
                  <th className="py-4 px-6">Supplier</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {ingredients
                  .filter(ing => (ing.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()))
                  .map(ing => {
                    const isLow = ing.stock <= ing.minStockAlert;
                    return (
                      <tr key={ing.id} className="hover:bg-slate-800/40 transition text-xs">
                        <td className="py-4 px-6 font-bold text-white">{ing.name}</td>
                        <td className="py-4 px-6 font-extrabold text-emerald-400">
                          {ing.stock} {ing.unit}
                        </td>
                        <td className="py-4 px-6 text-slate-400">{ing.minStockAlert} {ing.unit}</td>
                        <td className="py-4 px-6 font-semibold">${(ing.costPerUnit || 0).toFixed(2)}</td>
                        <td className="py-4 px-6 text-slate-400">{ing.supplierName}</td>
                        <td className="py-4 px-6">
                          {isLow ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 w-fit">
                              <AlertTriangle className="w-3 h-3" /> Reorder Needed
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                              Optimal
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => {
                              setAdjustItem({ id: ing.id, name: ing.name, type: 'ingredient', currentStock: ing.stock });
                              setNewStockVal(ing.stock);
                            }}
                            className="bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 font-bold px-3 py-1.5 rounded-xl transition text-[11px] cursor-pointer"
                          >
                            Adjust Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Menu Dishes Table */}
      {activeTab === 'products' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-4 px-6">Dish Name</th>
                  <th className="py-4 px-6">Category</th>
                  <th className="py-4 px-6">Price</th>
                  <th className="py-4 px-6">COGS Cost</th>
                  <th className="py-4 px-6">Stock</th>
                  <th className="py-4 px-6">Sales Count</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {products
                  .filter(p => (p.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()))
                  .map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition text-xs">
                      <td className="py-4 px-6 font-bold text-white">{p.name}</td>
                      <td className="py-4 px-6 text-slate-400">{p.category}</td>
                      <td className="py-4 px-6 font-extrabold text-emerald-400">${(p.price || 0).toFixed(2)}</td>
                      <td className="py-4 px-6 text-slate-400">${(p.cost || 0).toFixed(2)}</td>
                      <td className="py-4 px-6 font-bold text-white">{p.stock} portions</td>
                      <td className="py-4 px-6 text-slate-400">{p.salesCount} sold</td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => {
                            setAdjustItem({ id: p.id, name: p.name, type: 'product', currentStock: p.stock });
                            setNewStockVal(p.stock);
                          }}
                          className="bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 font-bold px-3 py-1.5 rounded-xl transition text-[11px] cursor-pointer"
                        >
                          Adjust Stock
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Movements Table */}
      {activeTab === 'movements' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-4 px-6">Item Name</th>
                  <th className="py-4 px-6">Type</th>
                  <th className="py-4 px-6">Quantity</th>
                  <th className="py-4 px-6">Reason / Source</th>
                  <th className="py-4 px-6">Logged By</th>
                  <th className="py-4 px-6 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {movements.map(m => (
                  <tr key={m.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-6 font-bold text-white">{m.itemName}</td>
                    <td className="py-4 px-6 font-mono text-emerald-400 uppercase">{m.type}</td>
                    <td className="py-4 px-6 font-extrabold text-white">{m.quantity}</td>
                    <td className="py-4 px-6 text-slate-400">{m.reason}</td>
                    <td className="py-4 px-6 text-slate-300">{m.createdBy}</td>
                    <td className="py-4 px-6 text-right text-slate-500">
                      {new Date(m.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
            <button onClick={() => setAdjustItem(null)} className="absolute right-4 top-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white">Adjust Stock Count</h3>
            <p className="text-xs text-slate-400">{adjustItem.name} ({adjustItem.type})</p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">New Stock Quantity</label>
                <input
                  type="number"
                  value={newStockVal}
                  onChange={e => setNewStockVal(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Reason for Adjustment</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              disabled={isSubmitting}
              onClick={handleAdjustSave}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-3 rounded-xl text-xs transition cursor-pointer"
            >
              {isSubmitting ? 'Saving Stock...' : 'Confirm Stock Adjustment'}
            </button>
          </div>
        </div>
      )}

      {/* Add Raw Ingredient Modal */}
      {isAddIngredientOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateIngredient} className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative text-xs">
            <button type="button" onClick={() => setIsAddIngredientOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white">Add Raw Kitchen Ingredient</h3>

            <div className="space-y-3">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Ingredient Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Olive Oil / Fresh Tomatoes"
                  value={ingName}
                  onChange={e => setIngName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Initial Stock</label>
                  <input
                    type="number"
                    value={ingStock}
                    onChange={e => setIngStock(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Unit</label>
                  <input
                    type="text"
                    value={ingUnit}
                    onChange={e => setIngUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Min Alert Threshold</label>
                  <input
                    type="number"
                    value={ingMinAlert}
                    onChange={e => setIngMinAlert(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Cost Per Unit ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ingCost}
                    onChange={e => setIngCost(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Supplier Name</label>
                <input
                  type="text"
                  value={ingSupplier}
                  onChange={e => setIngSupplier(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-3 rounded-xl transition cursor-pointer"
            >
              {isSubmitting ? 'Adding Ingredient...' : 'Save Raw Ingredient'}
            </button>
          </form>
        </div>
      )}

      {/* Add Menu Dish Modal */}
      {isAddProductOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateProduct} className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative text-xs">
            <button type="button" onClick={() => setIsAddProductOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white">Add Menu Dish</h3>

            <div className="space-y-3">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Dish Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wagyu Burger Special"
                  value={prodName}
                  onChange={e => setProdName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Category</label>
                <select
                  value={prodCat}
                  onChange={e => setProdCat(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="Main Course">Main Course</option>
                  <option value="Appetizers">Appetizers</option>
                  <option value="Beverages">Beverages</option>
                  <option value="Desserts">Desserts</option>
                  <option value="Sides">Sides</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={prodPrice}
                    onChange={e => setProdPrice(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={prodCost}
                    onChange={e => setProdCost(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Stock</label>
                  <input
                    type="number"
                    value={prodStock}
                    onChange={e => setProdStock(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-extrabold py-3 rounded-xl transition cursor-pointer"
            >
              {isSubmitting ? 'Adding Dish...' : 'Save Menu Dish'}
            </button>
          </form>
        </div>
      )}

    </div>
  );
};
