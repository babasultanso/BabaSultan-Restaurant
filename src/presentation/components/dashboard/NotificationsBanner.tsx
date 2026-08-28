import React, { useState } from 'react';
import { Ingredient, Product, Supplier, Order } from '../../../types';
import { AlertTriangle, ShieldAlert, Clock, X, ChevronRight } from 'lucide-react';

interface NotificationsBannerProps {
  ingredients: Ingredient[];
  products: Product[];
  suppliers: Supplier[];
  orders: Order[];
  onNavigateToTab?: (tab: string) => void;
}

export const NotificationsBanner: React.FC<NotificationsBannerProps> = ({
  ingredients,
  products,
  suppliers,
  orders,
  onNavigateToTab
}) => {
  const [dismissed, setDismissed] = useState(false);

  const lowStockIngs = ingredients.filter(i => i.stock <= i.minStockAlert);
  const lowStockProds = products.filter(p => p.stock <= p.minStockAlert);
  const totalLowStock = lowStockIngs.length + lowStockProds.length;

  const overdueSuppliers = suppliers.filter(s => s.overdueAmount > 0);
  const delayedOrders = orders.filter(o => {
    if (o.status !== 'in_preparation' && o.prepStatus !== 'preparing') return false;
    if (!o.createdAt) return false;
    const mins = (Date.now() - new Date(o.createdAt).getTime()) / 60000;
    return mins > (o.targetPrepTimeMinutes || 15);
  });

  const hasAlerts = totalLowStock > 0 || overdueSuppliers.length > 0 || delayedOrders.length > 0;

  if (!hasAlerts || dismissed) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-3xl text-xs space-y-2 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="font-extrabold text-amber-300 text-sm">System Operational Alerts Attention Required</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-400 hover:text-white p-1 rounded-lg transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px]">
        {totalLowStock > 0 && (
          <div
            onClick={() => onNavigateToTab?.('inventory')}
            className="flex items-center justify-between bg-slate-900/90 p-2.5 rounded-xl border border-amber-500/20 cursor-pointer hover:border-amber-500/50 transition"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-slate-200 font-bold">{totalLowStock} Low Stock Items</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
          </div>
        )}

        {overdueSuppliers.length > 0 && (
          <div
            onClick={() => onNavigateToTab?.('staff')}
            className="flex items-center justify-between bg-slate-900/90 p-2.5 rounded-xl border border-rose-500/20 cursor-pointer hover:border-rose-500/50 transition"
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span className="text-slate-200 font-bold">{overdueSuppliers.length} Overdue Supplier Invoices</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-rose-400" />
          </div>
        )}

        {delayedOrders.length > 0 && (
          <div
            onClick={() => onNavigateToTab?.('kitchen')}
            className="flex items-center justify-between bg-slate-900/90 p-2.5 rounded-xl border border-amber-500/20 cursor-pointer hover:border-amber-500/50 transition"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-slate-200 font-bold">{delayedOrders.length} Kitchen Delayed Tickets</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
          </div>
        )}
      </div>
    </div>
  );
};
