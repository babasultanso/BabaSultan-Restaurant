import React, { useState } from 'react';
import { KitchenTicket, KitchenPrepStatus, KitchenOrderPriority } from '../../../domain/entities/kitchen';
import { kdsDict, KitchenLang } from './translations';
import {
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  Flame,
  User,
  Utensils,
  Tag,
  Trash2,
  CheckCheck,
  Zap,
  DollarSign
} from 'lucide-react';

interface KitchenOrderDetailsModalProps {
  ticket: KitchenTicket;
  lang: KitchenLang;
  onClose: () => void;
  onUpdateStatus: (ticketId: string, status: KitchenPrepStatus) => Promise<void>;
  onUpdatePriority: (ticketId: string, priority: KitchenOrderPriority) => Promise<void>;
  onUpdateItemStatus: (ticketId: string, productId: string, itemStatus: KitchenPrepStatus) => Promise<void>;
  onLogWaste: (wasteData: { itemName: string; quantity: number; unit: string; reason: string; cost: number }) => Promise<void>;
}

export const KitchenOrderDetailsModal: React.FC<KitchenOrderDetailsModalProps> = ({
  ticket,
  lang,
  onClose,
  onUpdateStatus,
  onUpdatePriority,
  onUpdateItemStatus,
  onLogWaste
}) => {
  const t = kdsDict[lang] || kdsDict.en;
  const isRtl = lang === 'ar';

  const [showWasteForm, setShowWasteForm] = useState(false);
  const [wasteItem, setWasteItem] = useState('');
  const [wasteQty, setWasteQty] = useState<number>(1);
  const [wasteReason, setWasteReason] = useState('Burned / Damaged during preparation');
  const [wasteCost, setWasteCost] = useState<number>(5.00);
  const [submittingWaste, setSubmittingWaste] = useState(false);

  const handleWasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteItem.trim() || wasteQty <= 0) return;
    try {
      setSubmittingWaste(true);
      await onLogWaste({
        itemName: wasteItem,
        quantity: wasteQty,
        unit: 'units',
        reason: wasteReason,
        cost: wasteCost
      });
      alert('Kitchen waste log saved to Firestore!');
      setShowWasteForm(false);
      setWasteItem('');
    } catch (err: any) {
      alert(`Failed to save waste log: ${err.message}`);
    } finally {
      setSubmittingWaste(false);
    }
  };

  const elapsedMins = Math.floor((Date.now() - new Date(ticket.orderTime).getTime()) / 60000);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className="bg-slate-900 border border-slate-800 text-white rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
            <Flame className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-extrabold text-white">#{ticket.orderNumber}</h3>
              <span className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-slate-800 text-amber-400 border border-amber-500/20">
                {(ticket.orderType || 'dine_in').replace('_', ' ')}
              </span>
              {ticket.tableNumber && (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {t.table}: {ticket.tableNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {t.customer}: {ticket.customerName || 'Walk-in Guest'} • Placed {elapsedMins} mins ago ({new Date(ticket.orderTime).toLocaleTimeString()})
            </p>
          </div>
        </div>

        {/* Priority Selector */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-amber-400" /> Ticket Priority:
          </span>
          <div className="flex items-center gap-2">
            {(['normal', 'priority', 'urgent'] as KitchenOrderPriority[]).map((p) => {
              const active = ticket.priority === p;
              return (
                <button
                  key={p}
                  onClick={() => onUpdatePriority(ticket.id, p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold capitalize transition cursor-pointer border ${
                    active
                      ? p === 'urgent'
                        ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/20'
                        : p === 'priority'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                        : 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ticket Items Breakdown */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Utensils className="w-4 h-4 text-emerald-400" /> Dish Items & Station Routing
          </h4>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {ticket.items.map((item, idx) => {
              const isItemReady = item.itemStatus === 'ready_for_pickup' || item.itemStatus === 'completed';
              const isItemCooking = item.itemStatus === 'cooking';

              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition ${
                    isItemReady
                      ? 'bg-emerald-500/5 border-emerald-500/30'
                      : isItemCooking
                      ? 'bg-amber-500/5 border-amber-500/30'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-lg text-xs">
                        {item.quantity}x
                      </span>
                      <span className="font-extrabold text-sm text-white">{item.productName}</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-800 text-cyan-400 border border-slate-700">
                        Station: {item.assignedStation}
                      </span>
                    </div>

                    {item.selectedOptions && item.selectedOptions.length > 0 && (
                      <div className="text-xs text-emerald-400 font-semibold pl-8">
                        + {item.selectedOptions.map(o => o.choiceName).join(', ')}
                      </div>
                    )}

                    {item.notes && (
                      <div className="text-xs text-amber-300 font-bold bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 pl-8">
                        {t.specialNotes}: {item.notes}
                      </div>
                    )}
                  </div>

                  {/* Individual Item Status Actions */}
                  <div className="flex items-center gap-2">
                    {item.itemStatus === 'new' && (
                      <button
                        onClick={() => onUpdateItemStatus(ticket.id, item.productId, 'cooking')}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1"
                      >
                        <Flame className="w-3.5 h-3.5" /> Cook
                      </button>
                    )}

                    {item.itemStatus === 'cooking' && (
                      <button
                        onClick={() => onUpdateItemStatus(ticket.id, item.productId, 'ready_for_pickup')}
                        className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                      </button>
                    )}

                    {isItemReady && (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                        <CheckCheck className="w-3.5 h-3.5" /> Ready
                      </span>
                    )}

                    <button
                      onClick={() => {
                        setWasteItem(item.productName);
                        setShowWasteForm(true);
                      }}
                      title="Report waste/spill for this dish"
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition cursor-pointer text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        {ticket.notes && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl text-xs text-amber-300 font-bold">
            {t.specialNotes}: {ticket.notes}
          </div>
        )}

        {/* Waste Logging Form */}
        {showWasteForm && (
          <form onSubmit={handleWasteSubmit} className="bg-slate-950 p-4 rounded-2xl border border-rose-500/30 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h5 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" /> Log Kitchen Waste for #{ticket.orderNumber}
              </h5>
              <button
                type="button"
                onClick={() => setShowWasteForm(false)}
                className="text-slate-500 hover:text-white text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">{t.wasteItem}</label>
                <input
                  type="text"
                  value={wasteItem}
                  onChange={(e) => setWasteItem(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-medium focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">{t.wasteQty}</label>
                <input
                  type="number"
                  min="1"
                  value={wasteQty}
                  onChange={(e) => setWasteQty(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-medium focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">{t.wasteReason}</label>
                <select
                  value={wasteReason}
                  onChange={(e) => setWasteReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-medium focus:outline-none focus:border-rose-500"
                >
                  <option value="Burned during preparation">Burned during preparation</option>
                  <option value="Dropped / Spilled dish">Dropped / Spilled dish</option>
                  <option value="Customer order cancellation">Customer order cancellation</option>
                  <option value="Quality check rejection">Quality check rejection</option>
                  <option value="Expired ingredient">Expired ingredient</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">{t.wasteCost}</label>
                <input
                  type="number"
                  step="0.50"
                  value={wasteCost}
                  onChange={(e) => setWasteCost(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-medium focus:outline-none focus:border-rose-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingWaste}
              className="w-full bg-rose-500 hover:bg-rose-400 text-white font-extrabold py-2 rounded-xl transition cursor-pointer text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-500/20"
            >
              <Trash2 className="w-4 h-4" />
              <span>{submittingWaste ? 'Saving...' : t.submitWaste}</span>
            </button>
          </form>
        )}

        {/* Global Workflow Action Buttons */}
        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => {
              onUpdateStatus(ticket.id, 'cancelled');
              onClose();
            }}
            className="px-4 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition cursor-pointer"
          >
            Cancel Order
          </button>

          <div className="flex items-center gap-2">
            {ticket.prepStatus === 'new' && (
              <button
                onClick={() => {
                  onUpdateStatus(ticket.id, 'accepted');
                  onClose();
                }}
                className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition cursor-pointer shadow-lg shadow-amber-500/20"
              >
                {t.acceptOrder}
              </button>
            )}

            {ticket.prepStatus === 'accepted' && (
              <button
                onClick={() => {
                  onUpdateStatus(ticket.id, 'cooking');
                  onClose();
                }}
                className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition cursor-pointer shadow-lg shadow-amber-500/20"
              >
                {t.startCooking}
              </button>
            )}

            {ticket.prepStatus === 'cooking' && (
              <button
                onClick={() => {
                  onUpdateStatus(ticket.id, 'ready_for_pickup');
                  onClose();
                }}
                className="px-5 py-2.5 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-extrabold transition cursor-pointer shadow-lg shadow-teal-500/20"
              >
                {t.markReady}
              </button>
            )}

            {ticket.prepStatus === 'ready_for_pickup' && (
              <button
                onClick={() => {
                  onUpdateStatus(ticket.id, 'completed');
                  onClose();
                }}
                className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                {t.completeOrder}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
