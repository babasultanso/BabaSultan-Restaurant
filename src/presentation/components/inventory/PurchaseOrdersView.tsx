import React, { useState } from 'react';
import {
  PurchaseOrder,
  Supplier,
  InventoryItem,
  PurchaseOrderItem
} from '../../../domain/entities/inventory';
import { InventoryLang, inventoryDict } from './translations';
import { getMogadishuDateString } from '../../../lib/dateUtils';
import {
  Truck,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  DollarSign,
  UserCheck,
  ChevronRight,
  Trash2,
  X,
  AlertCircle
} from 'lucide-react';

interface PurchaseOrdersViewProps {
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  inventoryItems: InventoryItem[];
  lang: InventoryLang;
  userRole?: string;
  onCreatePO: (po: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onApprovePO: (id: string, approvedBy: string) => Promise<void>;
  onNavigateToReceiving: (poId: string) => void;
}

export const PurchaseOrdersView: React.FC<PurchaseOrdersViewProps> = ({
  purchaseOrders,
  suppliers,
  inventoryItems,
  lang,
  userRole,
  onCreatePO,
  onApprovePO,
  onNavigateToReceiving
}) => {
  const t = inventoryDict[lang] || inventoryDict.en;
  const isReadOnly = userRole === 'Kitchen' || userRole === 'Cashier';
  const canApprove = userRole === 'Owner' || userRole === 'Admin' || userRole === 'Manager';

  // State
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [poItems, setPoItems] = useState<PurchaseOrderItem[]>([]);

  // Open Create Modal
  const handleOpenCreate = () => {
    if (suppliers.length === 0) {
      alert('Please add at least one supplier before creating a purchase order.');
      return;
    }
    setSelectedSupplierId(suppliers[0]?.id || '');
    setExpectedDeliveryDate(
      getMogadishuDateString(Date.now() + 5 * 24 * 60 * 60 * 1000)
    );
    setNotes('');
    setPoItems([]);
    setIsModalOpen(true);
  };

  // Add Item Row to PO
  const handleAddItemRow = () => {
    if (inventoryItems.length === 0) return;
    const item = inventoryItems[0];
    setPoItems([
      ...poItems,
      {
        itemId: item.id,
        itemName: item.itemName,
        itemCode: item.itemCode,
        requestedQuantity: 10,
        unitPrice: item.purchaseCost || 5.0,
        totalAmount: 10 * (item.purchaseCost || 5.0),
        unit: item.unit
      }
    ]);
  };

  // Calculate PO Total
  const totalPOAmount = poItems.reduce((acc, row) => acc + row.requestedQuantity * row.unitPrice, 0);

  // Submit PO
  const handleSubmitPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (poItems.length === 0) {
      alert('Please add at least one item to the purchase order.');
      return;
    }

    const supplier = suppliers.find((s) => s.id === selectedSupplierId);

    await onCreatePO({
      poNumber: `PO-${Math.floor(10000 + Math.random() * 90000)}`,
      type: 'order',
      supplierId: selectedSupplierId,
      supplierName: supplier?.companyName || 'Supplier',
      items: poItems.map((pi) => ({
        ...pi,
        receivedQuantity: 0,
        totalAmount: pi.requestedQuantity * pi.unitPrice
      })),
      subtotal: totalPOAmount,
      taxAmount: 0,
      totalAmount: totalPOAmount,
      paidAmount: 0,
      status: 'pending_approval',
      approvalStatus: 'pending',
      expectedDeliveryDate,
      notes,
      createdBy: 'Purchasing Manager'
    });

    setIsModalOpen(false);
  };

  // Filter POs
  const filteredPOs = purchaseOrders.filter((po) => {
    if (filterStatus !== 'all' && po.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6 text-white font-sans">
      
      {/* Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-extrabold text-white">Purchase Orders & Procurement Workflow</h3>
          <p className="text-xs text-slate-400">Manage supplier purchase requests, approvals, and order tracking</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-white rounded-2xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="ordered">Ordered</option>
            <option value="completed">Completed / Received</option>
          </select>

          {!isReadOnly && (
            <button
              onClick={handleOpenCreate}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-2xl transition cursor-pointer text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" /> {t.createPO}
            </button>
          )}
        </div>
      </div>

      {/* Purchase Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPOs.length === 0 ? (
          <div className="col-span-full bg-slate-900 border border-slate-800 p-12 rounded-3xl text-center text-slate-500 text-xs">
            <Truck className="w-10 h-10 mx-auto text-slate-700 mb-2" />
            No purchase orders found. Click "New Purchase Order" to create one.
          </div>
        ) : (
          filteredPOs.map((po) => {
            const isPending = po.status === 'pending_approval';
            const isApproved = po.status === 'approved' || po.status === 'ordered';
            const isCompleted = po.status === 'completed';

            return (
              <div
                key={po.id}
                className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition"
              >
                
                {/* Header info */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-mono font-black text-amber-400 text-sm">{po.poNumber}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        isPending
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : isCompleted
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                      }`}
                    >
                      {(po.status || 'pending').replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Supplier:</span>
                    <span className="font-bold text-white">{po.supplierName}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Total Items:</span>
                    <span className="font-mono font-bold text-white">{po.items?.length || 0} line items</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Total Amount:</span>
                    <span className="font-mono font-black text-emerald-400 text-base">
                      ${po.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {po.expectedDeliveryDate && (
                    <div className="text-[11px] text-slate-500">
                      Expected: {new Date(po.expectedDeliveryDate).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {/* Items Summary */}
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs space-y-1">
                  {po.items?.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-[11px] text-slate-300">
                      <span>{item.itemName}</span>
                      <span className="font-mono text-slate-400">{item.requestedQuantity} {item.unit}</span>
                    </div>
                  ))}
                  {(po.items?.length || 0) > 3 && (
                    <div className="text-[10px] text-amber-400 font-bold text-right">
                      +{(po.items?.length || 0) - 3} more item(s)...
                    </div>
                  )}
                </div>

                {/* Actions Dock */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  
                  {isPending && canApprove && (
                    <button
                      onClick={() => onApprovePO(po.id, 'Store Manager')}
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve PO
                    </button>
                  )}

                  {isApproved && (
                    <button
                      onClick={() => onNavigateToReceiving(po.id)}
                      className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-2xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/20"
                    >
                      <Truck className="w-4 h-4" /> Receive Goods <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isCompleted && (
                    <span className="text-center w-full text-[11px] text-emerald-400 font-bold flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Goods Fully Received
                    </span>
                  )}

                </div>

              </div>
            );
          })
        )}
      </div>

      {/* MODAL: Create Purchase Order */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white">Create New Purchase Order</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPO} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Supplier *</label>
                  <select
                    required
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:border-amber-500 focus:outline-none"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.companyName} ({s.contactPerson})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Items Table in PO */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-extrabold">Line Items *</label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl text-[11px] font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Line Item
                  </button>
                </div>

                {poItems.length === 0 ? (
                  <div className="p-6 bg-slate-950 border border-dashed border-slate-800 rounded-2xl text-center text-slate-500">
                    No items added yet. Click "+ Add Line Item".
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {poItems.map((row, idx) => (
                      <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-2xl grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5">
                          <select
                            value={row.itemId}
                            onChange={(e) => {
                              const match = inventoryItems.find((i) => i.id === e.target.value);
                              if (match) {
                                const newItems = [...poItems];
                                newItems[idx] = {
                                  ...newItems[idx],
                                  itemId: match.id,
                                  itemName: match.itemName,
                                  itemCode: match.itemCode,
                                  unitPrice: match.purchaseCost || 5.0,
                                  unit: match.unit
                                };
                                setPoItems(newItems);
                              }
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white"
                          >
                            {inventoryItems.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.itemName} ({inv.itemCode})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-3">
                          <input
                            type="number"
                            min="1"
                            value={row.requestedQuantity}
                            onChange={(e) => {
                              const newItems = [...poItems];
                              newItems[idx].requestedQuantity = parseFloat(e.target.value) || 0;
                              setPoItems(newItems);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-mono"
                            placeholder="Qty"
                          />
                        </div>

                        <div className="col-span-3">
                          <input
                            type="number"
                            step="0.01"
                            value={row.unitPrice}
                            onChange={(e) => {
                              const newItems = [...poItems];
                              newItems[idx].unitPrice = parseFloat(e.target.value) || 0;
                              setPoItems(newItems);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-mono"
                            placeholder="Unit Cost $"
                          />
                        </div>

                        <div className="col-span-1 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setPoItems(poItems.filter((_, i) => i !== idx));
                            }}
                            className="p-2 text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total Summary */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                <span className="font-extrabold text-slate-300">Estimated PO Total:</span>
                <span className="text-xl font-black font-mono text-emerald-400">
                  ${totalPOAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-2xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  Submit Purchase Order
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
