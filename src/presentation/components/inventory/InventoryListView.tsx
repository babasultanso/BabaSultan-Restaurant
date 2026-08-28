import React, { useState, useMemo } from 'react';
import { InventoryItem, InventoryCategory, InventoryItemStatus } from '../../../domain/entities/inventory';
import { InventoryLang, inventoryDict } from './translations';
import {
  Package,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  Barcode,
  AlertTriangle,
  RefreshCw,
  X,
  Check,
  Eye,
  Layers,
  ArrowUpDown,
  Tag
} from 'lucide-react';

interface InventoryListViewProps {
  items: InventoryItem[];
  lang: InventoryLang;
  userRole?: string;
  onAddItem: (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateItem: (id: string, item: Partial<InventoryItem>) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onQuickAdjust: (itemId: string, newQty: number, reason: string) => Promise<void>;
}

export const InventoryListView: React.FC<InventoryListViewProps> = ({
  items,
  lang,
  userRole,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onQuickAdjust
}) => {
  const t = inventoryDict[lang] || inventoryDict.en;
  const isReadOnly = userRole === 'Kitchen' || userRole === 'Cashier';

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');

  const [viewingBarcodeItem, setViewingBarcodeItem] = useState<InventoryItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    itemName: '',
    itemCode: '',
    barcode: '',
    category: 'Raw Materials' as InventoryCategory,
    unit: 'kg',
    purchaseCost: 0,
    sellingCost: 0,
    currentQuantity: 0,
    minimumQuantity: 10,
    maximumQuantity: 100,
    reorderLevel: 15,
    storageLocation: 'Main Warehouse',
    supplierName: '',
    expirationDate: '',
    batchNumber: ''
  });

  // Filtered List
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;

      if (searchQuery && searchQuery.trim()) {
        const q = (searchQuery || '').toLowerCase();
        const matchesName = (item.itemName || '').toLowerCase().includes(q);
        const matchesCode = (item.itemCode || '').toLowerCase().includes(q);
        const matchesBarcode = item.barcode?.toLowerCase().includes(q);
        const matchesSupplier = item.supplierName?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesBarcode && !matchesSupplier) return false;
      }

      return true;
    });
  }, [items, selectedCategory, selectedStatus, searchQuery]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      itemName: '',
      itemCode: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      barcode: `690${Math.floor(100000000 + Math.random() * 900000000)}`,
      category: 'Raw Materials',
      unit: 'kg',
      purchaseCost: 0,
      sellingCost: 0,
      currentQuantity: 0,
      minimumQuantity: 10,
      maximumQuantity: 200,
      reorderLevel: 15,
      storageLocation: 'Main Dry Storage',
      supplierName: 'Global Food Wholesale Ltd',
      expirationDate: '',
      batchNumber: `BATCH-${Date.now().toString().slice(-6)}`
    });
    setIsFormOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      itemName: item.itemName,
      itemCode: item.itemCode,
      barcode: item.barcode || '',
      category: (item.category as InventoryCategory) || 'Raw Materials',
      unit: item.unit || 'kg',
      purchaseCost: item.purchaseCost || 0,
      sellingCost: item.sellingCost || 0,
      currentQuantity: item.currentQuantity || 0,
      minimumQuantity: item.minimumQuantity || 0,
      maximumQuantity: item.maximumQuantity || 0,
      reorderLevel: item.reorderLevel || 0,
      storageLocation: item.storageLocation || '',
      supplierName: item.supplierName || '',
      expirationDate: item.expirationDate || '',
      batchNumber: item.batchNumber || ''
    });
    setIsFormOpen(true);
  };

  // Submit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemName || !formData.itemCode) return;

    if (editingItem) {
      await onUpdateItem(editingItem.id, formData);
    } else {
      await onAddItem({
        ...formData,
        status: 'in_stock'
      });
    }

    setIsFormOpen(false);
  };

  // Submit Quick Adjustment
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;
    await onQuickAdjust(adjustingItem.id, adjustQty, adjustReason || 'Manual Inventory Adjustment');
    setAdjustingItem(null);
  };

  return (
    <div className="space-y-6 text-white font-sans">
      
      {/* Top Search & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full bg-slate-950 border border-slate-800 pl-10 pr-4 py-2.5 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        {/* Filters & Action Button */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-white rounded-2xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
          >
            <option value="all">{t.filterCategory}</option>
            <option value="Raw Materials">{t.catRawMaterials}</option>
            <option value="Finished Products">{t.catFinishedProducts}</option>
            <option value="Packaging Materials">{t.catPackagingMaterials}</option>
            <option value="Beverages">{t.catBeverages}</option>
            <option value="Cleaning Supplies">{t.catCleaningSupplies}</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-white rounded-2xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
          >
            <option value="all">{t.filterStatus}</option>
            <option value="in_stock">{t.statusInStock}</option>
            <option value="low_stock">{t.statusLowStock}</option>
            <option value="out_of_stock">{t.statusOutOfStock}</option>
            <option value="expired">{t.statusExpired}</option>
            <option value="overstock">{t.statusOverstock}</option>
          </select>

          {/* Add Item Button */}
          {!isReadOnly && (
            <button
              onClick={handleOpenAdd}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-2xl transition cursor-pointer text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" /> {t.addNewItem}
            </button>
          )}

        </div>

      </div>

      {/* Inventory Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4">{t.itemName}</th>
                <th className="p-4">{t.category}</th>
                <th className="p-4 text-center">{t.currentQuantity}</th>
                <th className="p-4 text-right">{t.purchaseCost}</th>
                <th className="p-4 text-right">{t.sellingCost}</th>
                <th className="p-4">{t.storageLocation}</th>
                <th className="p-4">{t.status}</th>
                <th className="p-4 text-center">{t.actions}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    <Package className="w-10 h-10 mx-auto text-slate-700 mb-2" />
                    No inventory items found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isLow = item.status === 'low_stock';
                  const isOut = item.status === 'out_of_stock';
                  const isExpired = item.status === 'expired';

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      
                      {/* Name & Code */}
                      <td className="p-4">
                        <div className="font-bold text-white text-sm">{item.itemName}</div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-amber-400">{item.itemCode}</span>
                          {item.barcode && (
                            <button
                              onClick={() => setViewingBarcodeItem(item)}
                              className="flex items-center gap-1 hover:text-white"
                              title="Click to view Barcode"
                            >
                              <Barcode className="w-3 h-3 text-slate-500" />
                              <span className="font-mono">{item.barcode}</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                          {item.category}
                        </span>
                      </td>

                      {/* Quantity & Unit */}
                      <td className="p-4 text-center font-mono font-black text-sm">
                        <span className={isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-emerald-400'}>
                          {item.currentQuantity}
                        </span>
                        <span className="text-xs text-slate-500 font-normal ml-1">{item.unit}</span>
                      </td>

                      {/* Costs */}
                      <td className="p-4 text-right font-mono font-bold text-slate-300">
                        ${(item.purchaseCost || 0).toFixed(2)}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-emerald-400">
                        ${(item.sellingCost || 0).toFixed(2)}
                      </td>

                      {/* Location & Batch */}
                      <td className="p-4 text-slate-300">
                        <div>{item.storageLocation || 'Main Store'}</div>
                        {item.batchNumber && (
                          <div className="text-[10px] text-slate-500">Batch: {item.batchNumber}</div>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            isExpired
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                              : isOut
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : isLow
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {(item.status || 'in_stock').replace('_', ' ')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          
                          {/* Adjust Stock */}
                          {!isReadOnly && (
                            <button
                              onClick={() => {
                                setAdjustingItem(item);
                                setAdjustQty(item.currentQuantity);
                                setAdjustReason('');
                              }}
                              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 transition cursor-pointer"
                              title="Quick Stock Adjustment"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Edit */}
                          {!isReadOnly && (
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 transition cursor-pointer"
                              title="Edit Item Details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete */}
                          {!isReadOnly && userRole === 'Owner' && (
                            <button
                              onClick={async () => {
                                if (confirm(`Are you sure you want to delete ${item.itemName}?`)) {
                                  await onDeleteItem(item.id);
                                }
                              }}
                              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-rose-400 transition cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Add/Edit Item Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-6 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-extrabold text-white">
                {editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Item Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.itemName}
                    onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:border-amber-500 focus:outline-none"
                    placeholder="e.g., Premium Basmati Rice"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Item Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.itemCode}
                    onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Barcode</label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:border-amber-500 focus:outline-none font-mono"
                    placeholder="EAN-13 / UPC"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as InventoryCategory })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="Raw Materials">Raw Materials</option>
                    <option value="Finished Products">Finished Products</option>
                    <option value="Packaging Materials">Packaging Materials</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Cleaning Supplies">Cleaning Supplies</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Unit of Measure</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="kg">Kilograms (kg)</option>
                    <option value="g">Grams (g)</option>
                    <option value="liters">Liters (liters)</option>
                    <option value="ml">Milliliters (ml)</option>
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="boxes">Boxes</option>
                    <option value="bags">Bags</option>
                    <option value="bottles">Bottles</option>
                    <option value="cans">Cans</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Purchase Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchaseCost}
                    onChange={(e) => setFormData({ ...formData, purchaseCost: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Current Quantity</label>
                  <input
                    type="number"
                    value={formData.currentQuantity}
                    onChange={(e) => setFormData({ ...formData, currentQuantity: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Min Quantity (Low Alert)</label>
                  <input
                    type="number"
                    value={formData.minimumQuantity}
                    onChange={(e) => setFormData({ ...formData, minimumQuantity: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Storage Location</label>
                  <input
                    type="text"
                    value={formData.storageLocation}
                    onChange={(e) => setFormData({ ...formData, storageLocation: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:border-amber-500 focus:outline-none"
                    placeholder="e.g., Cold Storage #2"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Expiration Date</label>
                  <input
                    type="date"
                    value={formData.expirationDate}
                    onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  {editingItem ? 'Update Item' : 'Save Item'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Quick Adjustment Modal */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white">Stock Adjustment — {adjustingItem.itemName}</h3>
              <button onClick={() => setAdjustingItem(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">
                  Previous Quantity: <span className="text-white">{adjustingItem.currentQuantity} {adjustingItem.unit}</span>
                </label>
                <label className="block text-slate-400 font-bold mb-1">New Physical Count Quantity *</label>
                <input
                  type="number"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white text-base font-mono font-black focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Reason for Adjustment *</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g., Weekly Physical Cycle Count Discrepancy"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                  className="px-4 py-2 rounded-2xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-2xl bg-amber-500 text-slate-950 font-black"
                >
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Barcode View Modal */}
      {viewingBarcodeItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center space-y-4">
            <h3 className="text-sm font-extrabold text-white">{viewingBarcodeItem.itemName}</h3>
            <p className="text-xs text-slate-400">Code: {viewingBarcodeItem.itemCode}</p>

            <div className="bg-white p-6 rounded-2xl inline-block shadow-inner">
              <div className="font-mono text-black font-black text-2xl tracking-[0.3em] border-y-2 border-black py-3">
                |||| ||| ||||| ||||
              </div>
              <div className="font-mono text-black text-xs font-bold mt-2">
                {viewingBarcodeItem.barcode || viewingBarcodeItem.itemCode}
              </div>
            </div>

            <button
              onClick={() => setViewingBarcodeItem(null)}
              className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
            >
              Close Barcode
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
