import React, { useState } from 'react';
import { PurchaseOrder, InventoryItem } from '../../../domain/entities/inventory';
import { InventoryLang, inventoryDict } from './translations';
import { Truck, CheckCircle2, Package, Calendar, Tag, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

interface GoodsReceivingViewProps {
  purchaseOrders: PurchaseOrder[];
  inventoryItems: InventoryItem[];
  lang: InventoryLang;
  onReceiveGoods: (
    poId: string,
    receivedItems: { itemId: string; receivedQty: number; batchNumber?: string; expirationDate?: string }[],
    receivedBy: string
  ) => Promise<void>;
  selectedPOId?: string;
}

export const GoodsReceivingView: React.FC<GoodsReceivingViewProps> = ({
  purchaseOrders,
  inventoryItems,
  lang,
  onReceiveGoods,
  selectedPOId
}) => {
  const t = inventoryDict[lang] || inventoryDict.en;

  // Filter approved or partially received POs
  const receivablePOs = purchaseOrders.filter(
    (po) => po.status === 'approved' || po.status === 'ordered' || po.status === 'partially_received'
  );

  const [activePOId, setActivePOId] = useState<string>(
    selectedPOId || receivablePOs[0]?.id || ''
  );

  const activePO = purchaseOrders.find((po) => po.id === activePOId);

  // Form State for receiving line items
  const [receivingState, setReceivingState] = useState<
    Record<string, { receivedQty: number; batchNumber: string; expirationDate: string }>
  >({});

  // Initialize or handle input change
  const handleQtyChange = (itemId: string, qty: number) => {
    setReceivingState((prev) => ({
      ...prev,
      [itemId]: {
        receivedQty: qty,
        batchNumber: prev[itemId]?.batchNumber || `BATCH-${Date.now().toString().slice(-6)}`,
        expirationDate: prev[itemId]?.expirationDate || ''
      }
    }));
  };

  const handleBatchChange = (itemId: string, batch: string) => {
    setReceivingState((prev) => ({
      ...prev,
      [itemId]: {
        receivedQty: prev[itemId]?.receivedQty || 0,
        batchNumber: batch,
        expirationDate: prev[itemId]?.expirationDate || ''
      }
    }));
  };

  const handleExpChange = (itemId: string, exp: string) => {
    setReceivingState((prev) => ({
      ...prev,
      [itemId]: {
        receivedQty: prev[itemId]?.receivedQty || 0,
        batchNumber: prev[itemId]?.batchNumber || '',
        expirationDate: exp
      }
    }));
  };

  // Submit Receiving
  const handleConfirmReceiving = async () => {
    if (!activePO) return;

    const payload = Object.entries(receivingState)
      .map(([itemId, val]) => ({
        itemId,
        receivedQty: val.receivedQty,
        batchNumber: val.batchNumber,
        expirationDate: val.expirationDate
      }))
      .filter((item) => item.receivedQty > 0);

    if (payload.length === 0) {
      alert('Please enter a received quantity greater than 0 for at least one item.');
      return;
    }

    await onReceiveGoods(activePO.id, payload, 'Receiving Inspector');
    alert('Goods received successfully! Inventory stock levels updated.');
  };

  return (
    <div className="space-y-6 text-white font-sans">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-cyan-400" /> Goods Receiving Inspection & Intake
          </h3>
          <p className="text-xs text-slate-400">
            Verify supplier deliveries, assign batch numbers & expiration dates, and auto-update inventory
          </p>
        </div>

        {/* PO Selector */}
        <div className="w-full md:w-80">
          <select
            value={activePOId}
            onChange={(e) => setActivePOId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-xs text-amber-400 font-mono font-bold rounded-2xl p-3 focus:outline-none focus:border-amber-500"
          >
            {receivablePOs.length === 0 ? (
              <option value="">No Approved POs Available</option>
            ) : (
              receivablePOs.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.poNumber} — {po.supplierName} (${po.totalAmount})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Main Receiving Panel */}
      {!activePO ? (
        <div className="bg-slate-900 border border-slate-800 p-12 rounded-3xl text-center text-slate-500 text-xs">
          <ShieldCheck className="w-12 h-12 mx-auto text-slate-700 mb-2" />
          No active purchase order selected for goods receiving inspection.
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          
          {/* PO Summary Header */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4 text-xs">
            <div>
              <span className="text-slate-500 font-bold block">Purchase Order:</span>
              <span className="text-base font-black font-mono text-amber-400">{activePO.poNumber}</span>
            </div>

            <div>
              <span className="text-slate-500 font-bold block">Supplier:</span>
              <span className="font-bold text-white">{activePO.supplierName}</span>
            </div>

            <div>
              <span className="text-slate-500 font-bold block">Status:</span>
              <span className="font-black text-cyan-400 uppercase">{activePO.status}</span>
            </div>

            <div>
              <span className="text-slate-500 font-bold block">Expected Delivery:</span>
              <span className="font-mono text-slate-300">
                {activePO.expectedDeliveryDate ? new Date(activePO.expectedDeliveryDate).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>

          {/* Items Inspection Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Delivery Inspection & Intake Form
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Item Details</th>
                    <th className="p-3 text-center">Ordered Qty</th>
                    <th className="p-3 text-center">Prev Received</th>
                    <th className="p-3 text-center">Received Today *</th>
                    <th className="p-3">Batch Number</th>
                    <th className="p-3">Expiration Date</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {activePO.items?.map((item) => {
                    const prevRec = item.receivedQuantity || 0;
                    const remaining = item.requestedQuantity - prevRec;
                    const st = receivingState[item.itemId] || { receivedQty: 0, batchNumber: '', expirationDate: '' };

                    return (
                      <tr key={item.itemId} className="hover:bg-slate-800/40 transition">
                        <td className="p-3">
                          <div className="font-bold text-white">{item.itemName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.itemCode}</div>
                        </td>

                        <td className="p-3 text-center font-mono font-bold text-slate-300">
                          {item.requestedQuantity} {item.unit}
                        </td>

                        <td className="p-3 text-center font-mono text-cyan-400 font-bold">
                          {prevRec} {item.unit}
                        </td>

                        <td className="p-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max={remaining}
                            value={st.receivedQty}
                            onChange={(e) => handleQtyChange(item.itemId, parseFloat(e.target.value) || 0)}
                            className="w-24 bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono font-black text-center focus:border-amber-500 focus:outline-none"
                            placeholder="0"
                          />
                        </td>

                        <td className="p-3">
                          <input
                            type="text"
                            value={st.batchNumber}
                            onChange={(e) => handleBatchChange(item.itemId, e.target.value)}
                            className="w-36 bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
                            placeholder="BATCH-1002"
                          />
                        </td>

                        <td className="p-3">
                          <input
                            type="date"
                            value={st.expirationDate}
                            onChange={(e) => handleExpChange(item.itemId, e.target.value)}
                            className="w-36 bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Confirm Button */}
          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={handleConfirmReceiving}
              className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-xs flex items-center gap-2 cursor-pointer shadow-xl shadow-emerald-500/20"
            >
              <CheckCircle2 className="w-5 h-5" /> Confirm Goods Intake & Update Inventory
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
