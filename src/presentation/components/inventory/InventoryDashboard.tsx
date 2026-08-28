import React, { useState } from 'react';
import {
  InventoryItem,
  PurchaseOrder,
  Supplier,
  InventoryAlert,
  InventoryMovement
} from '../../../domain/entities/inventory';
import { InventoryLang, inventoryDict } from './translations';
import {
  Package,
  AlertTriangle,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Truck,
  Users,
  Clock,
  PlusCircle,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  XCircle,
  FileSpreadsheet,
  Zap,
  BarChart2
} from 'lucide-react';

interface InventoryDashboardProps {
  items: InventoryItem[];
  movements: InventoryMovement[];
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  alerts: InventoryAlert[];
  lang: InventoryLang;
  onOpenQuickMovement: (type: 'stock_in' | 'stock_out' | 'adjustment' | 'transfer' | 'waste') => void;
  onNavigateTab: (tab: string) => void;
  userRole?: string;
}

export const InventoryDashboard: React.FC<InventoryDashboardProps> = ({
  items,
  movements,
  purchaseOrders,
  suppliers,
  alerts,
  lang,
  onOpenQuickMovement,
  onNavigateTab,
  userRole
}) => {
  const t = inventoryDict[lang] || inventoryDict.en;

  // Calculate Metrics
  const totalItemsCount = items.length;
  const totalValuation = items.reduce((acc, i) => acc + i.currentQuantity * (i.purchaseCost || 0), 0);
  const lowStockItems = items.filter((i) => i.currentQuantity > 0 && i.currentQuantity <= i.minimumQuantity);
  const outOfStockItems = items.filter((i) => i.currentQuantity <= 0);
  const expiredItems = items.filter((i) => {
    if (!i.expirationDate) return false;
    const exp = new Date(i.expirationDate).getTime();
    return !isNaN(exp) && exp < Date.now();
  });

  const pendingPOs = purchaseOrders.filter((p) => p.status === 'pending_approval' || p.status === 'approved' || p.status === 'ordered');
  const totalPayables = suppliers.reduce((acc, s) => acc + (s.outstandingBalance || 0), 0);

  // Category breakdown
  const categoryCounts: Record<string, number> = {};
  items.forEach((i) => {
    const cat = i.category || 'Other';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  return (
    <div className="space-y-6 text-white font-sans">
      
      {/* Top Banner Alerts */}
      {alerts.length > 0 && (
        <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-5 shadow-2xl space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">{t.alertsHeader}</h3>
                <p className="text-xs text-slate-400">
                  {alerts.length} critical notification(s) require immediate attention
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('list')}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs hover:bg-amber-400 transition cursor-pointer"
            >
              Resolve in Catalog
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.slice(0, 6).map((al) => (
              <div
                key={al.id}
                className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${
                  al.severity === 'critical'
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : al.severity === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">{al.title}</div>
                  <div className="text-[11px] opacity-90">{al.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Items */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400">{t.totalItems}</span>
            <h4 className="text-2xl font-black text-white">{totalItemsCount}</h4>
            <span className="text-[10px] text-slate-500">Across 5 Categories</span>
          </div>
          <div className="p-3.5 bg-cyan-500/10 text-cyan-400 rounded-2xl border border-cyan-500/20">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Stock Valuation */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400">{t.stockValuation}</span>
            <h4 className="text-2xl font-black text-emerald-400">
              ${totalValuation.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h4>
            <span className="text-[10px] text-emerald-500 font-bold">Total Cost Value</span>
          </div>
          <div className="p-3.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Low / Out of Stock */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400">{t.lowStockAlerts}</span>
            <div className="flex items-center gap-2">
              <h4 className="text-2xl font-black text-amber-400">{lowStockItems.length}</h4>
              <span className="text-xs font-bold text-rose-400">({outOfStockItems.length} Out)</span>
            </div>
            <span className="text-[10px] text-amber-500 font-bold">Requires Restocking</span>
          </div>
          <div className="p-3.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Pending POs & Payables */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400">{t.pendingPOs}</span>
            <h4 className="text-2xl font-black text-cyan-400">{pendingPOs.length}</h4>
            <span className="text-[10px] text-rose-400 font-bold">
              Payables: ${totalPayables.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-3.5 bg-cyan-500/10 text-cyan-400 rounded-2xl border border-cyan-500/20">
            <Truck className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Quick Action Dock */}
      {userRole !== 'Kitchen' && userRole !== 'Cashier' && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-3">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" /> Quick Stock Operations
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <button
              onClick={() => onOpenQuickMovement('stock_in')}
              className="p-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" /> {t.quickStockIn}
            </button>

            <button
              onClick={() => onOpenQuickMovement('stock_out')}
              className="p-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" /> {t.quickStockOut}
            </button>

            <button
              onClick={() => onOpenQuickMovement('adjustment')}
              className="p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> {t.quickAdjustment}
            </button>

            <button
              onClick={() => onOpenQuickMovement('transfer')}
              className="p-3 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Truck className="w-4 h-4" /> {t.quickTransfer}
            </button>

            <button
              onClick={() => onOpenQuickMovement('waste')}
              className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <XCircle className="w-4 h-4 text-rose-400" /> Log Waste
            </button>
          </div>
        </div>
      )}

      {/* Category Distribution & Recent Movements Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Low Stock Items Progress Panel */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-4 col-span-1">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-amber-400" /> Critical Stock Levels
            </h4>
            <button
              onClick={() => onNavigateTab('list')}
              className="text-xs text-amber-400 hover:underline font-bold"
            >
              View All
            </button>
          </div>

          {lowStockItems.length === 0 && outOfStockItems.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              All inventory items are well-stocked above reorder thresholds!
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {[...outOfStockItems, ...lowStockItems].slice(0, 7).map((item) => {
                const percent = item.minimumQuantity > 0 ? Math.min(100, Math.round((item.currentQuantity / item.minimumQuantity) * 100)) : 0;
                return (
                  <div key={item.id} className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-white">{item.itemName}</span>
                      <span className={item.currentQuantity <= 0 ? 'text-rose-400 font-black' : 'text-amber-400'}>
                        {item.currentQuantity} {item.unit} / Min {item.minimumQuantity}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.currentQuantity <= 0 ? 'bg-rose-500 w-full' : 'bg-amber-500'
                        }`}
                        style={{ width: item.currentQuantity <= 0 ? '100%' : `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Stock Movement Audit Trail */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-4 col-span-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" /> Recent Stock Movements
            </h4>
            <button
              onClick={() => onNavigateTab('movements')}
              className="text-xs text-cyan-400 hover:underline font-bold"
            >
              Movement Log
            </button>
          </div>

          {movements.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No stock movements recorded yet.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {movements.slice(0, 7).map((m) => {
                const isIncoming = m.type === 'stock_in' || m.type === 'order_restoration';
                return (
                  <div key={m.id} className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl font-bold ${
                        isIncoming ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {isIncoming ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="font-bold text-white">{m.itemName}</div>
                        <div className="text-[10px] text-slate-500">{m.reason} • {m.createdBy}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`font-mono font-black ${isIncoming ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isIncoming ? '+' : '-'}{m.quantity} {m.unit}
                      </span>
                      <div className="text-[10px] text-slate-500">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
