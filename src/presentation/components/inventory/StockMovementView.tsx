import { translations } from '../../../i18n/translations';
import { translateRawUi } from '../../../i18n/rawUi';
import React, { useState } from 'react';
import { InventoryMovement, InventoryItem } from '../../../domain/entities/inventory';
import { InventoryLang, inventoryDict } from '../../../i18n';
import {
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Truck,
  XCircle,
  Clock,
  Plus,
  Filter,
  Search,
  CheckCircle,
  Layers,
  X
} from 'lucide-react';

interface StockMovementViewProps {
  movements: InventoryMovement[];
  items: InventoryItem[];
  lang: InventoryLang;
  userRole?: string;
  onRecordMovement: (movement: Omit<InventoryMovement, 'id' | 'createdAt'>) => Promise<void>;
  initialMovementType?: 'stock_in' | 'stock_out' | 'adjustment' | 'transfer' | 'waste';
}

export const StockMovementView: React.FC<StockMovementViewProps> = ({
  movements,
  items,
  lang,
  userRole,
  onRecordMovement,
  initialMovementType
}) => {
  const t = { ...(inventoryDict[lang] || inventoryDict.en), legacyUi: translations[lang].legacyUi };
  const normalizedRole = String(userRole || '').trim().toLowerCase();
  const canRecordMovement = ['owner', 'admin', 'manager', 'accountant'].includes(normalizedRole);
  const isReadOnly = !canRecordMovement;

  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(!!initialMovementType);
  const [selectedItemId, setSelectedItemId] = useState<string>(items[0]?.id || '');
  const [movType, setMovType] = useState<'stock_in' | 'stock_out' | 'adjustment' | 'transfer' | 'waste'>(
    initialMovementType || 'stock_in'
  );
  const [quantity, setQuantity] = useState<number>(0);
  const [reason, setReason] = useState<string>('');
  const [fromLocation, setFromLocation] = useState<string>('');
  const [toLocation, setToLocation] = useState<string>('');

  // Filter Movements
  const filteredMovements = movements.filter((m) => {
    if (filterType !== 'all' && m.type !== filterType) return false;
    if (searchQuery && searchQuery.trim()) {
      const q = (searchQuery || '').toLowerCase();
      const matchName = (m.itemName || '').toLowerCase().includes(q);
      const matchCode = m.itemCode?.toLowerCase().includes(q);
      const matchReason = m.reason?.toLowerCase().includes(q);
      const matchUser = m.createdBy?.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchReason && !matchUser) return false;
    }
    return true;
  });

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const item = items.find((i) => i.id === selectedItemId);
    if (!item) return;

    const prevQty = item.currentQuantity;
    let newQty = prevQty;

    if (movType === 'stock_in') newQty = prevQty + quantity;
    if (movType === 'stock_out' || movType === 'waste') newQty = Math.max(0, prevQty - quantity);
    if (movType === 'adjustment') newQty = quantity;

    await onRecordMovement({
      type: movType,
      itemId: item.id,
      itemName: item.itemName,
      itemCode: item.itemCode,
      quantity,
      unit: item.unit,
      previousQuantity: prevQty,
      newQuantity: newQty,
      fromLocation: movType === 'transfer' ? fromLocation : undefined,
      toLocation: movType === 'transfer' ? toLocation : undefined,
      reason: reason || `Manual ${(movType || 'stock_in').replace('_', ' ')} recorded`,
      createdBy: 'Inventory Manager'
    });

    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 text-white font-sans">
      
      {/* Header & Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={translateRawUi('Search movement by item, reason, user...')}
            className="w-full bg-slate-950 border border-slate-800 pl-10 pr-4 py-2.5 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        {/* Filters & Trigger */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-white rounded-2xl px-3 py-2.5 focus:outline-none focus:border-amber-500"
          >
            <option value="all">{t.legacyUi.allMovementTypes}</option>
            <option value="stock_in">{t.legacyUi.stockIn}</option>
            <option value="stock_out">{t.legacyUi.stockOut}</option>
            <option value="adjustment">{translateRawUi('Adjustment')}</option>
            <option value="transfer">{translateRawUi('Transfer')}</option>
            <option value="waste">{translateRawUi('Waste')}</option>
            <option value="expired">{t.legacyUi.expiredDisposal}</option>
          </select>

          {canRecordMovement && (
            <button
              onClick={() => {
                setMovType('stock_in');
                setIsModalOpen(true);
              }}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-2xl transition cursor-pointer text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" /> {translateRawUi('Record Movement')}
            </button>
          )}

        </div>

      </div>

      {/* Movement History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4">{translateRawUi('Type')}</th>
                <th className="p-4">{t.legacyUi.itemName}</th>
                <th className="p-4 text-center">{t.legacyUi.qtyChange}</th>
                <th className="p-4 text-center">{t.legacyUi.prevNewQty}</th>
                <th className="p-4">{t.legacyUi.reasonLocations}</th>
                <th className="p-4">{t.legacyUi.recordedBy}</th>
                <th className="p-4 text-right">{translateRawUi('Timestamp')}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    <Clock className="w-10 h-10 mx-auto text-slate-700 mb-2" />
                    {translateRawUi('No stock movements recorded matching your criteria.')}
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => {
                  const isIncoming = m.type === 'stock_in' || m.type === 'order_restoration';
                  const isTransfer = m.type === 'transfer';
                  const isWaste = m.type === 'waste' || m.type === 'expired';

                  return (
                    <tr key={m.id} className="hover:bg-slate-800/40 transition">
                      
                      {/* Movement Type Badge */}
                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 w-fit border ${
                            isIncoming
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : isWaste
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : isTransfer
                              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {isIncoming ? (
                            <ArrowDownLeft className="w-3 h-3" />
                          ) : isWaste ? (
                            <XCircle className="w-3 h-3" />
                          ) : isTransfer ? (
                            <Truck className="w-3 h-3" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          {(m.type || 'stock_in').replace('_', ' ')}
                        </span>
                      </td>

                      {/* Item Name */}
                      <td className="p-4">
                        <div className="font-bold text-white text-sm">{m.itemName}</div>
                        {m.itemCode && <div className="text-[10px] font-mono text-slate-400">{m.itemCode}</div>}
                      </td>

                      {/* Qty Change */}
                      <td className="p-4 text-center font-mono font-black text-sm">
                        <span className={isIncoming ? 'text-emerald-400' : 'text-rose-400'}>
                          {isIncoming ? '+' : '-'}{m.quantity} {m.unit}
                        </span>
                      </td>

                      {/* Before / After */}
                      <td className="p-4 text-center font-mono text-xs text-slate-400">
                        {m.previousQuantity !== undefined ? (
                          <span>{m.previousQuantity} → <strong className="text-white">{m.newQuantity}</strong></span>
                        ) : (
                          <span>—</span>
                        )}
                      </td>

                      {/* Reason & Locations */}
                      <td className="p-4 text-slate-300">
                        <div>{m.reason}</div>
                        {isTransfer && (
                          <div className="text-[10px] text-cyan-400 font-mono mt-0.5">
                            {m.fromLocation} → {m.toLocation}
                          </div>
                        )}
                      </td>

                      {/* User */}
                      <td className="p-4 text-slate-400 font-semibold">{m.createdBy || 'System'}</td>

                      {/* Timestamp */}
                      <td className="p-4 text-right font-mono text-slate-500 text-[11px]">
                        {new Date(m.createdAt).toLocaleString()}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Movement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white">{t.legacyUi.recordStockMovement}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              
              <div>
                <label className="block text-slate-400 font-bold mb-1">{t.legacyUi.selectItemRequired}</label>
                <select
                  required
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:border-amber-500 focus:outline-none"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.itemName} ({i.itemCode}) — Stock: {i.currentQuantity} {i.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">{t.legacyUi.movementTypeRequired}</label>
                <select
                  value={movType}
                  onChange={(e) => setMovType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="stock_in">{t.legacyUi.stockInPurchase}</option>
                  <option value="stock_out">{t.legacyUi.stockOutKitchen}</option>
                  <option value="adjustment">{t.legacyUi.physicalStockAdjustment}</option>
                  <option value="transfer">{t.legacyUi.internalWarehouseTransfer}</option>
                  <option value="waste">{t.legacyUi.damageSpoilageWaste}</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">{t.legacyUi.quantityRequired}</label>
                <input
                  type="number"
                  required
                  min="0.1"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white text-base font-mono font-black focus:border-amber-500 focus:outline-none"
                />
              </div>

              {movType === 'transfer' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">{t.legacyUi.fromLocation}</label>
                    <input
                      type="text"
                      value={fromLocation}
                      onChange={(e) => setFromLocation(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">{t.legacyUi.toLocation}</label>
                    <input
                      type="text"
                      value={toLocation}
                      onChange={(e) => setToLocation(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-2.5 text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-400 font-bold mb-1">{t.legacyUi.reasonReferenceNotes}</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={translateRawUi('e.g., Weekly kitchen preparation stock issue')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:border-amber-500 focus:outline-none"
                />
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
                  className="px-5 py-2 rounded-2xl bg-amber-500 text-slate-950 font-black cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  {translateRawUi('Commit Movement')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
