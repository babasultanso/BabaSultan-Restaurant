import { translations } from '../../../i18n/translations';
import { translateRawUi } from '../../../i18n/rawUi';
import React, { useState } from 'react';
import {
  PurchaseOrder,
  Supplier,
  InventoryItem,
  PurchaseOrderItem,
  PurchaseReturn
} from '../../../domain/entities/inventory';
import { InventoryLang, inventoryDict } from '../../../i18n';
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
  AlertCircle,
  RotateCcw
} from 'lucide-react';

interface PurchaseOrdersViewProps {
  purchaseOrders: PurchaseOrder[];
  purchaseReturns?: PurchaseReturn[];
  suppliers: Supplier[];
  inventoryItems: InventoryItem[];
  lang: InventoryLang;
  userRole?: string;
  onCreatePO: (po: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onApprovePO: (id: string, approvedBy: string) => Promise<void>;
  onNavigateToReceiving: (poId: string) => void;
  onCreatePurchaseReturn?: (data: {
    itemId: string;
    supplierId?: string;
    supplierName?: string;
    poId?: string;
    quantity: number;
    unitCost?: number;
    reason: string;
  }) => Promise<void>;
}

export const PurchaseOrdersView: React.FC<PurchaseOrdersViewProps> = ({
  purchaseOrders,
  purchaseReturns = [],
  suppliers,
  inventoryItems,
  lang,
  userRole,
  onCreatePO,
  onApprovePO,
  onNavigateToReceiving,
  onCreatePurchaseReturn
}) => {
  const t = { ...(inventoryDict[lang] || inventoryDict.en), legacyUi: translations[lang].legacyUi };
  const isReadOnly = userRole === 'Kitchen' || userRole === 'Cashier';
  const canApprove = userRole === 'Owner' || userRole === 'Admin' || userRole === 'Manager';

  // State
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

  // Return Form State
  const [retSupplierId, setRetSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [retPoId, setRetPoId] = useState<string>('');
  const [retItemId, setRetItemId] = useState<string>(inventoryItems[0]?.id || '');
  const [retQty, setRetQty] = useState<number>(1);
  const [retUnitCost, setRetUnitCost] = useState<number>(inventoryItems[0]?.purchaseCost || 0);
  const [retReason, setRetReason] = useState<string>('Damaged or defective supplier goods returned');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState<boolean>(false);

  const handleOpenReturnModal = (po?: PurchaseOrder) => {
    const defaultItem = inventoryItems[0];
    setRetSupplierId(po?.supplierId || suppliers[0]?.id || '');
    setRetPoId(po?.id || '');
    setRetItemId(po?.items?.[0]?.itemId || defaultItem?.id || '');
    setRetQty(1);
    setRetUnitCost(po?.items?.[0]?.unitPrice ?? defaultItem?.purchaseCost ?? 0);
    setRetReason('Damaged or defective supplier goods returned');
    setIsReturnModalOpen(true);
  };

  const handleSubmitPurchaseReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreatePurchaseReturn) return;
    if (!retItemId || retQty <= 0) {
      alert('Please select an inventory item and enter a valid positive return quantity.');
      return;
    }
    setIsSubmittingReturn(true);
    try {
      const sup = suppliers.find((s) => s.id === retSupplierId);
      await onCreatePurchaseReturn({
        itemId: retItemId,
        supplierId: retSupplierId || undefined,
        supplierName: sup?.companyName,
        poId: retPoId || undefined,
        quantity: Number(retQty),
        unitCost: Number(retUnitCost),
        reason: retReason.trim() || 'Damaged or defective supplier goods returned'
      });
      setIsReturnModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to record purchase return.');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

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
        requestedQuantity: 0,
        unitPrice: item.purchaseCost || 0,
        totalAmount: 10 * (item.purchaseCost || 0),
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
    if (poItems.some((item) => item.requestedQuantity <= 0 || item.unitPrice <= 0)) {
      alert('Each purchase-order line must have a positive quantity and unit price.');
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
          <h3 className="text-sm font-extrabold text-white">{t.legacyUi.purchaseProcurementWorkflow}</h3>
          <p className="text-xs text-slate-400">{t.legacyUi.manageSupplierPurchases}</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-white rounded-2xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
          >
            <option value="all">{t.legacyUi.allStatuses}</option>
            <option value="pending_approval">{t.legacyUi.pendingApproval}</option>
            <option value="approved">{translateRawUi('Approved')}</option>
            <option value="ordered">{translateRawUi('Ordered')}</option>
            <option value="completed">{t.legacyUi.completedReceived}</option>
          </select>

          {!isReadOnly && (
            <div className="flex items-center gap-2">
              {onCreatePurchaseReturn && (
                <button
                  onClick={() => handleOpenReturnModal()}
                  className="bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-extrabold px-3.5 py-2.5 rounded-2xl transition cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" /> {translateRawUi('Record Supplier Return')}
                </button>
              )}
              <button
                onClick={handleOpenCreate}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-2xl transition cursor-pointer text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" /> {t.createPO}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Purchase Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPOs.length === 0 ? (
          <div className="col-span-full bg-slate-900 border border-slate-800 p-12 rounded-3xl text-center text-slate-500 text-xs">
            <Truck className="w-10 h-10 mx-auto text-slate-700 mb-2" />
            {translateRawUi('No purchase orders found. Click "New Purchase Order" to create one.')}
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
                    <span className="text-slate-400">{translateRawUi('Supplier:')}</span>
                    <span className="font-bold text-white">{po.supplierName}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{t.legacyUi.totalItemsColon}</span>
                    <span className="font-mono font-bold text-white">{po.items?.length || 0} line items</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{t.legacyUi.totalAmountColon}</span>
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
                      <CheckCircle2 className="w-4 h-4" /> {translateRawUi('Approve PO')}
                    </button>
                  )}

                  {isApproved && (
                    <button
                      onClick={() => onNavigateToReceiving(po.id)}
                      className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-2xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/20"
                    >
                      <Truck className="w-4 h-4" /> {t.legacyUi.receiveGoods} <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isCompleted && (
                    <div className="w-full flex items-center justify-between gap-2">
                      <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> {translateRawUi('Goods Fully Received')}
                      </span>
                      {!isReadOnly && onCreatePurchaseReturn && (
                        <button
                          onClick={() => handleOpenReturnModal(po)}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> {translateRawUi('Return Goods')}
                        </button>
                      )}
                    </div>
                  )}

                </div>

              </div>
            );
          })
        )}
      </div>

      {/* Purchase Returns & Vendor Debit Notes Ledger */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-rose-400" />
              {translateRawUi('Purchase Returns & Vendor Debit Notes (Inventory + AP + GL)')}
            </h4>
            <p className="text-xs text-slate-400">
              {translateRawUi('Authoritative supplier returns automatically deduct stock, reduce vendor payable balances, and post GL Debit Notes.')}
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 font-mono font-bold text-xs">
            {purchaseReturns.length} {translateRawUi('Return Note(s)')}
          </span>
        </div>

        {purchaseReturns.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            {translateRawUi('No supplier purchase returns recorded yet.')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">{translateRawUi('Debit Note #')}</th>
                  <th className="py-3 px-4">{translateRawUi('Date')}</th>
                  <th className="py-3 px-4">{translateRawUi('Supplier')}</th>
                  <th className="py-3 px-4">{translateRawUi('Returned Item')}</th>
                  <th className="py-3 px-4 text-right">{translateRawUi('Qty Returned')}</th>
                  <th className="py-3 px-4 text-right">{translateRawUi('Credit Value')}</th>
                  <th className="py-3 px-4">{translateRawUi('Reason')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {purchaseReturns.map((pr) => (
                  <tr key={pr.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-rose-400">{pr.returnNumber}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{pr.date}</td>
                    <td className="py-3 px-4 font-bold text-white">{pr.supplierName}</td>
                    <td className="py-3 px-4 text-slate-200">{pr.itemName}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-300">
                      -{pr.quantity} {pr.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-400">
                      ${Number(pr.totalCost || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{pr.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Record Supplier Purchase Return / Debit Note */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-extrabold text-white">{translateRawUi('Record Supplier Purchase Return (Debit Note)')}</h3>
              </div>
              <button onClick={() => setIsReturnModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPurchaseReturn} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{translateRawUi('Supplier')}</label>
                  <select
                    value={retSupplierId}
                    onChange={(e) => setRetSupplierId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white"
                  >
                    <option value="">{translateRawUi('Select Supplier')}</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.companyName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">{translateRawUi('Linked Purchase Order (Optional)')}</label>
                  <select
                    value={retPoId}
                    onChange={(e) => setRetPoId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white font-mono"
                  >
                    <option value="">{translateRawUi('None / Direct Return')}</option>
                    {purchaseOrders.map((po) => (
                      <option key={po.id} value={po.id}>{po.poNumber} ({po.supplierName})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">{translateRawUi('Inventory Item to Return *')}</label>
                <select
                  required
                  value={retItemId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setRetItemId(id);
                    const found = inventoryItems.find((i) => i.id === id);
                    if (found) setRetUnitCost(found.purchaseCost || 0);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white"
                >
                  {inventoryItems.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.itemName} (In Stock: {inv.currentQuantity} {inv.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{translateRawUi('Return Quantity *')}</label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="any"
                    value={retQty}
                    onChange={(e) => setRetQty( parseFloat(e.target.value) || 0 )}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">{translateRawUi('Unit Cost Credit ($)')}</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={retUnitCost}
                    onChange={(e) => setRetUnitCost( parseFloat(e.target.value) || 0 )}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">{translateRawUi('Return Reason / Inspection Notes *')}</label>
                <input
                  type="text"
                  required
                  value={retReason}
                  onChange={(e) => setRetReason(e.target.value)}
                  placeholder={translateRawUi('e.g. Damaged packaging, spoiled batch, wrong specification')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white"
                />
              </div>

              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                <span className="text-slate-400 font-bold">{translateRawUi('Total Vendor Debit Note Credit:')}</span>
                <span className="text-base font-black font-mono text-emerald-400">
                  ${(Math.max(0, retQty) * Math.max(0, retUnitCost)).toFixed(2)}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-4 py-2 rounded-2xl bg-slate-800 text-slate-300 font-bold"
                >
                  {translateRawUi('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReturn}
                  className="px-5 py-2 rounded-2xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-black cursor-pointer"
                >
                  {isSubmittingReturn ? translateRawUi('Processing...') : translateRawUi('Post Purchase Return')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Purchase Order */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white">{t.legacyUi.createNewPurchaseOrder}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPO} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{t.legacyUi.supplierRequired}</label>
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
                  <label className="block text-slate-400 font-bold mb-1">{t.legacyUi.expectedDeliveryDate}</label>
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
                  <label className="text-slate-300 font-extrabold">{t.legacyUi.lineItemsRequired}</label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl text-[11px] font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> {translateRawUi('Add Line Item')}
                  </button>
                </div>

                {poItems.length === 0 ? (
                  <div className="p-6 bg-slate-950 border border-dashed border-slate-800 rounded-2xl text-center text-slate-500">
                    {translateRawUi('No items added yet. Click "+ Add Line Item".')}
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
                                  unitPrice: match.purchaseCost || 0,
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
                            placeholder={translateRawUi('Qty')}
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
                            placeholder={translateRawUi('Unit Cost $')}
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
                <span className="font-extrabold text-slate-300">{t.legacyUi.estimatedPoTotal}</span>
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
                  {translateRawUi('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  {translateRawUi('Submit Purchase Order')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
