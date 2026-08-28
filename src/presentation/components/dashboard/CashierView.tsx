import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMogadishuDateString } from '../../../lib/dateUtils';
import { KPICard } from './KPICard';
import { OrdersVolumeChart } from './DashboardCharts';
import { Order } from '../../../types';
import {
  ShoppingCart,
  CheckCircle2,
  Clock,
  DollarSign,
  CreditCard,
  Banknote,
  Smartphone,
  Plus,
  Receipt
} from 'lucide-react';

interface CashierViewProps {
  orders: Order[];
  onNavigateToTab?: (tab: string) => void;
}

export const CashierView: React.FC<CashierViewProps> = ({ orders, onNavigateToTab }) => {
  const { t } = useAuth();
  const d: Record<string, any> = t.dashboard || {};

  const todayIso = getMogadishuDateString();
  const todayOrders = orders.filter(o => o.createdAt && o.createdAt.startsWith(todayIso));

  // Cashier metrics
  const newOrders = orders.filter(o => o.status === 'pending');
  const completedOrdersToday = todayOrders.filter(o => o.status === 'completed');
  const dailySales = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  // Payment Method Breakdown
  const cashSales = todayOrders
    .filter(o => o.paymentMethod === 'cash')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const cardSales = todayOrders
    .filter(o => o.paymentMethod === 'card')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const mobileSales = todayOrders
    .filter(o => o.paymentMethod === 'mobile_money')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Cashier Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-emerald-500/10 text-emerald-400 font-bold text-[10px] px-2.5 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-wider">
              {d.terminalActive || 'Terminal Active'}
            </span>
            <span className="text-xs text-slate-400">• {d.shiftCashierCounter || 'Shift Cashier Counter'}</span>
          </div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            {d.cashierTitle || 'Front Counter Cashier & POS Terminal'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {d.cashierSubtitle || 'Monitor real-time customer settlement queue, payment method totals, and shift register totals.'}
          </p>
        </div>

        {onNavigateToTab && (
          <button
            onClick={() => onNavigateToTab('pos')}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm px-5 py-3 rounded-2xl transition flex items-center gap-2 shadow-xl shadow-emerald-500/20 cursor-pointer"
          >
            <Plus className="w-5 h-5" /> {d.launchPos || 'Launch POS Checkout'}
          </button>
        )}
      </div>

      {/* Cashier Required Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <KPICard
          title={d.newOrdersQueue || 'New Orders Queue'}
          value={newOrders.length}
          sublabel="Awaiting payment & kitchen dispatch"
          icon={Clock}
          iconColor="amber"
          badgeText="New"
          badgeType="warning"
        />

        <KPICard
          title={d.completedOrdersToday || 'Completed Orders Today'}
          value={completedOrdersToday.length}
          sublabel="Successfully settled transactions"
          icon={CheckCircle2}
          iconColor="emerald"
        />

        <KPICard
          title={d.dailySalesTotal || 'Daily Sales Total'}
          value={`$${dailySales.toFixed(2)}`}
          sublabel={`${todayOrders.length} settled tickets`}
          icon={DollarSign}
          iconColor="teal"
        />

        <KPICard
          title="Cash Drawer Shift Estimate"
          value={`$${(cashSales + 150).toFixed(2)}`}
          sublabel="Base Float: $150.00"
          icon={Banknote}
          iconColor="blue"
        />

      </div>

      {/* Payment Method Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Cash Register</span>
              <span className="text-xl font-extrabold text-white">${cashSales.toFixed(2)}</span>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-bold">
            {todayOrders.length > 0 ? `${Math.round((cashSales / dailySales) * 100 || 0)}%` : '0%'}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Card Transactions</span>
              <span className="text-xl font-extrabold text-white">${cardSales.toFixed(2)}</span>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-bold">
            {todayOrders.length > 0 ? `${Math.round((cardSales / dailySales) * 100 || 0)}%` : '0%'}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Mobile Money (Evc/Zaad)</span>
              <span className="text-xl font-extrabold text-white">${mobileSales.toFixed(2)}</span>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-bold">
            {todayOrders.length > 0 ? `${Math.round((mobileSales / dailySales) * 100 || 0)}%` : '0%'}
          </span>
        </div>
      </div>

      {/* Orders Feed & Status Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-400" />
              Recent Shift Transactions Feed
            </h3>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('pos')}
                className="text-xs text-emerald-400 font-bold hover:underline"
              >
                + New Transaction
              </button>
            )}
          </div>

          <div className="space-y-2">
            {todayOrders.slice(0, 6).map(order => (
              <div key={order.id} className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{order.orderNumber}</span>
                    <span className="text-[10px] text-slate-400 uppercase bg-slate-800 px-2 py-0.5 rounded-full">
                      {order.paymentMethod}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{order.customerName} • {order.items?.length || 1} items</p>
                </div>

                <div className="text-right">
                  <span className="font-extrabold text-emerald-400">${(order.totalAmount || 0).toFixed(2)}</span>
                  <p className="text-[10px] text-slate-500">
                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <OrdersVolumeChart orders={orders} />

      </div>

    </div>
  );
};
