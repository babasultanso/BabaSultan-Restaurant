import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMogadishuDateString } from '../../../lib/dateUtils';
import { KPICard } from './KPICard';
import { Order, Product, Ingredient, CustomerFeedback } from '../../../types';
import {
  Clock,
  ChefHat,
  Truck,
  UserCheck,
  AlertTriangle,
  DollarSign,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Plus,
  Play
} from 'lucide-react';

interface ManagerViewProps {
  orders: Order[];
  products: Product[];
  ingredients: Ingredient[];
  feedbacks?: CustomerFeedback[];
  onNavigateToTab?: (tab: string) => void;
}

export const ManagerView: React.FC<ManagerViewProps> = ({
  orders,
  products,
  ingredients,
  feedbacks = [],
  onNavigateToTab
}) => {
  const { t } = useAuth();
  const d: Record<string, any> = t.dashboard || {};

  const todayIso = getMogadishuDateString();

  // 1. Metrics Calculations
  const activeOrders = orders.filter(o => o.status === 'in_preparation' || o.status === 'pending' || o.status === 'ready_for_pickup' || o.prepStatus === 'preparing');
  const todayOrders = orders.filter(o => o.createdAt && o.createdAt.startsWith(todayIso));
  const dailySales = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const kitchenOrders = orders.filter(o => o.status === 'in_preparation' || o.prepStatus === 'preparing');
  const deliveryOrders = orders.filter(o => o.orderType === 'delivery' || o.status === 'out_for_delivery');

  // Stock Alerts
  const lowStockIngredients = ingredients.filter(i => i.stock <= i.minStockAlert);
  const lowStockProducts = products.filter(p => p.stock <= p.minStockAlert);
  const totalStockAlerts = lowStockIngredients.length + lowStockProducts.length;

  return (
    <div className="space-y-6">
      
      {/* Manager Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-teal-500/10 text-teal-400 font-bold text-[10px] px-2.5 py-0.5 rounded-full border border-teal-500/20 uppercase tracking-wider">
              {d.shiftOperations || 'Shift Operations'}
            </span>
            <span className="text-xs text-slate-400">• {d.managerControlRoom || 'Manager Control Room'}</span>
          </div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            {d.managerTitle || 'Restaurant Operations & Manager Dashboard'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {d.managerSubtitle || 'Real-time kitchen order queue, line chef station load, delivery status, staff attendance, and stock alerts.'}
          </p>
        </div>

        {onNavigateToTab && (
          <button
            onClick={() => onNavigateToTab('pos')}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" /> {d.openPos || 'Open POS Terminal'}
          </button>
        )}
      </div>

      {/* Manager KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <KPICard
          title={d.activeOrdersQueue || 'Active Orders Queue'}
          value={activeOrders.length}
          sublabel="Pending or In Preparation"
          icon={Clock}
          iconColor="amber"
          badgeText="Active"
          badgeType="warning"
        />

        <KPICard
          title="Kitchen KDS Status"
          value={`${kitchenOrders.length} Cooking`}
          sublabel="Avg Prep Time: 12.4 min"
          icon={ChefHat}
          iconColor="teal"
        />

        <KPICard
          title="Delivery Drivers Status"
          value={`${deliveryOrders.length} In Transit`}
          sublabel="3 Drivers Available On-Call"
          icon={Truck}
          iconColor="indigo"
        />

        <KPICard
          title="Employee Attendance"
          value="100% Present"
          sublabel="4 Active Staff Checked In Today"
          icon={UserCheck}
          iconColor="emerald"
        />

        <KPICard
          title={d.lowStockAlerts || 'Low Stock Alerts'}
          value={`${totalStockAlerts} Items`}
          sublabel={totalStockAlerts > 0 ? 'Urgent reorder required' : 'Stock levels optimal'}
          icon={AlertTriangle}
          iconColor="rose"
          badgeText={totalStockAlerts > 0 ? 'Alert' : 'Normal'}
          badgeType={totalStockAlerts > 0 ? 'danger' : 'success'}
        />

        <KPICard
          title={d.dailyRevenue || 'Daily Revenue'}
          value={`$${dailySales.toFixed(2)}`}
          sublabel={`${todayOrders.length} orders settled`}
          icon={DollarSign}
          iconColor="emerald"
        />

        <KPICard
          title="Customer Satisfaction"
          value="4.8 / 5.0"
          sublabel="Based on 48 reviews"
          icon={MessageSquare}
          iconColor="purple"
        />

      </div>

      {/* Active Orders & Kitchen Display Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              Live Kitchen & POS Active Orders
            </h3>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('kitchen')}
                className="text-xs text-amber-400 hover:underline font-bold"
              >
                View Kitchen Display System →
              </button>
            )}
          </div>

          <div className="space-y-3">
            {activeOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No active orders currently in preparation. All orders are fulfilled!
              </div>
            ) : (
              activeOrders.map(order => (
                <div key={order.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-white text-sm">{order.orderNumber}</span>
                      <span className="text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                        {order.status || 'in_prep'}
                      </span>
                      <span className="text-[10px] text-slate-400">• {order.orderType || 'dine_in'}</span>
                    </div>
                    <span className="font-extrabold text-emerald-400">${(order.totalAmount || 0).toFixed(2)}</span>
                  </div>

                  <p className="text-xs text-slate-300">
                    {order.items?.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                    <span>Customer: {order.customerName}</span>
                    <span>Staff: {order.employeeName}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Customer Feedback Feed */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            Recent Customer Feedback
          </h3>

          <div className="space-y-3">
            {feedbacks.length === 0 ? (
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 text-center text-slate-500 text-xs font-medium">
                No customer feedback recorded yet.
              </div>
            ) : (
              feedbacks.map(fb => (
                <div key={fb.id} className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{fb.customerName}</span>
                    <div className="flex items-center text-amber-400 font-bold">
                      {'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}
                    </div>
                  </div>

                  <p className="text-slate-300 italic text-[11px]">
                    "{fb.complaint || fb.compliments}"
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                    <span>Order: {fb.orderId}</span>
                    <span className={`font-bold capitalize ${fb.status === 'resolved' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {fb.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
