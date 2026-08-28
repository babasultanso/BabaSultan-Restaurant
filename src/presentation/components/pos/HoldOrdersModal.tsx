import React, { useState, useEffect } from 'react';
import { HoldOrder } from '../../../types';
import { fetchHoldOrdersFirestore, deleteHoldOrderFirestore } from '../../../lib/firebase';
import { X, Play, Trash2, Clock, PauseCircle, Package } from 'lucide-react';

interface HoldOrdersModalProps {
  onClose: () => void;
  onResumeOrder: (holdOrder: HoldOrder) => void;
}

export const HoldOrdersModal: React.FC<HoldOrdersModalProps> = ({
  onClose,
  onResumeOrder
}) => {
  const [holdOrders, setHoldOrders] = useState<HoldOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchHoldOrdersFirestore()
      .then(res => setHoldOrders(res))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleDeleteHold = async (holdId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to discard this held order?')) return;
    try {
      await deleteHoldOrderFirestore(holdId);
      setHoldOrders(prev => prev.filter(h => h.id !== holdId));
    } catch (err: any) {
      alert(`Failed to delete hold order: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative text-slate-100 max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/30">
            <PauseCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Parked / Held Orders</h3>
            <p className="text-xs text-slate-400">Resume held order into cart to finish checkout</p>
          </div>
        </div>

        {/* Hold List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading held orders...</div>
          ) : holdOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Package className="w-10 h-10 mx-auto text-slate-700" />
              <p className="text-xs">No held orders found</p>
              <p className="text-[10px] text-slate-600">You can hold an active cart using the &quot;Hold Order&quot; button in POS</p>
            </div>
          ) : (
            holdOrders.map(hold => (
              <div
                key={hold.id}
                className="p-4 bg-slate-950 rounded-2xl border border-slate-800 hover:border-emerald-500/50 transition flex items-center justify-between gap-4 group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white text-sm">{hold.holdName || 'Held Cart'}</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-amber-500/20">
                      {(hold.orderType || 'dine_in').replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(hold.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span>Items: <strong className="text-white">{hold.items.length}</strong></span>
                    {hold.tableNumber && <span>Table: <strong className="text-emerald-400">{hold.tableNumber}</strong></span>}
                  </div>

                  <p className="text-xs text-emerald-400 font-extrabold pt-0.5">
                    ${(hold.totalAmount || 0).toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      await deleteHoldOrderFirestore(hold.id);
                      onResumeOrder(hold);
                      onClose();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-500/10"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume</span>
                  </button>

                  <button
                    onClick={e => handleDeleteHold(hold.id, e)}
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
