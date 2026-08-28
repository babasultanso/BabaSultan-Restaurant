import React, { useState } from 'react';
import { Order, OrderItem } from '../../../types';
import { updateOrderFirestore } from '../../../lib/firebase';
import { X, Plus, Minus, Trash2, CheckCircle2, Save } from 'lucide-react';

interface EditOrderModalProps {
  order: Order;
  onClose: () => void;
  onSaved: () => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  order,
  onClose,
  onSaved
}) => {
  const [items, setItems] = useState<OrderItem[]>(order.items || []);
  const [tableNumber, setTableNumber] = useState<string>(order.tableNumber || '');
  const [orderNotes, setOrderNotes] = useState<string>(order.notes || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const updateQuantity = (idx: number, delta: number) => {
    setItems(prev =>
      prev
        .map((item, i) => {
          if (i === idx) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              totalPrice: newQty * item.unitPrice
            };
          }
          return item;
        })
        .filter(Boolean) as OrderItem[]
    );
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const effectiveTaxRate = order.subtotal && order.subtotal > 0 && typeof order.tax === 'number'
      ? order.tax / order.subtotal
      : 0;
    const tax = Number((subtotal * effectiveTaxRate).toFixed(2));
    const discount = order.discountAmount || 0;
    const totalAmount = Math.max(0, subtotal + tax - discount);
    const cogs = items.reduce((sum, item) => sum + ((item.unitCost || 0) * item.quantity), 0);
    const profit = totalAmount - cogs;

    return { subtotal, tax, totalAmount, cogs, profit };
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('Order must contain at least one item.');
      return;
    }
    setIsSubmitting(true);

    try {
      const { subtotal, tax, totalAmount, cogs, profit } = calculateTotals();

      await updateOrderFirestore(order.id, {
        items,
        tableNumber,
        notes: orderNotes,
        subtotal,
        tax,
        totalAmount,
        cogs,
        profit
      });

      onSaved();
      onClose();
    } catch (err: any) {
      alert(`Failed to save order updates: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative text-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="pb-3 border-b border-slate-800">
          <h3 className="text-lg font-bold text-white">Edit Order #{order.orderNumber}</h3>
          <p className="text-xs text-slate-400">Modify items, quantities, table assignment & order notes</p>
        </div>

        <form onSubmit={handleSaveOrder} className="space-y-4 text-xs">
          
          {/* Table Selector */}
          <div>
            <label className="text-slate-300 font-bold block mb-1">Table Number</label>
            <input
              type="text"
              placeholder="e.g. T-01 / VIP-1"
              value={tableNumber}
              onChange={e => setTableNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Items List */}
          <div className="space-y-2">
            <label className="text-slate-300 font-bold block">Order Items</label>
            <div className="space-y-2 max-h-52 overflow-y-auto no-scrollbar pr-1">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-slate-800"
                >
                  <div className="flex-1 pr-2">
                    <h5 className="font-bold text-white">{item.productName}</h5>
                    <span className="text-[10px] text-slate-400">${(item.unitPrice || 0).toFixed(2)} each</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-900 rounded-xl border border-slate-800 p-0.5">
                      <button
                        type="button"
                        onClick={() => updateQuantity(idx, -1)}
                        className="p-1 hover:bg-slate-800 rounded-lg text-slate-300 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2.5 font-bold text-emerald-400">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(idx, 1)}
                        className="p-1 hover:bg-slate-800 rounded-lg text-slate-300 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <span className="font-bold text-white w-14 text-right">${(item.totalPrice || 0).toFixed(2)}</span>

                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Notes */}
          <div>
            <label className="text-slate-300 font-bold block mb-1">Order Notes</label>
            <input
              type="text"
              placeholder="e.g. Extra spicy, pack separately..."
              value={orderNotes}
              onChange={e => setOrderNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Updated Totals */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1 font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal:</span>
              <span>${(totals.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Tax {totals.subtotal > 0 && totals.tax ? `(${((totals.tax / totals.subtotal) * 100).toFixed(0)}% VAT)` : '(VAT)'}:</span>
              <span>${(totals.tax || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-emerald-400 pt-1 border-t border-slate-800">
              <span>New Grand Total:</span>
              <span>${(totals.totalAmount || 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-3 rounded-2xl transition cursor-pointer shadow-lg shadow-emerald-500/20 text-xs flex items-center justify-center gap-2 mt-2"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'Updating Order...' : 'Save Changes'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
