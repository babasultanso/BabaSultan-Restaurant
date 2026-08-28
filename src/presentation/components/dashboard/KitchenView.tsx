import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { KPICard } from './KPICard';
import { Order } from '../../../types';
import { updateOrderStatusFirestore } from '../../../lib/firebase';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Flame,
  Check
} from 'lucide-react';

interface KitchenViewProps {
  orders: Order[];
  onNavigateToTab?: (tab: string) => void;
}

export const KitchenView: React.FC<KitchenViewProps> = ({ orders, onNavigateToTab }) => {
  const { t } = useAuth();
  const d: Record<string, any> = t.dashboard || {};

  // Kitchen Order Queues
  const newOrders = orders.filter(o => o.status === 'pending' || o.prepStatus === 'new');
  const preparingOrders = orders.filter(o => o.status === 'in_preparation' || o.prepStatus === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready_for_pickup' || o.prepStatus === 'ready');

  // Delayed Orders (> 15 minutes or target prep time exceeded)
  const delayedOrders = orders.filter(o => {
    if (o.status !== 'in_preparation' && o.prepStatus !== 'preparing') return false;
    if (!o.createdAt) return false;
    const elapsedMinutes = (Date.now() - new Date(o.createdAt).getTime()) / 60000;
    return elapsedMinutes > (o.targetPrepTimeMinutes || 15);
  });

  // Action Handler to update status in Firestore
  const handleSetPreparing = async (orderId: string) => {
    await updateOrderStatusFirestore(orderId, 'in_preparation');
  };

  const handleSetReady = async (orderId: string) => {
    await updateOrderStatusFirestore(orderId, 'ready_for_pickup');
  };

  return (
    <div className="space-y-6">
      
      {/* Kitchen Display System Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-amber-500/10 text-amber-400 font-bold text-[10px] px-2.5 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-wider">
              {d.lineChefKds || 'Line Chef KDS'}
            </span>
            <span className="text-xs text-slate-400">• {d.kitchenDisplayScreen || 'Kitchen Display Screen'}</span>
          </div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            {d.kitchenTitle || 'Kitchen Preparation Station Display'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {d.kitchenSubtitle || 'Real-time ticket queue for line chefs, station load balancing, and preparation time tracking.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 flex items-center gap-2">
            <Flame className="w-4 h-4 text-emerald-400 animate-pulse" />
            {d.stationsActive || 'STATIONS ACTIVE'}
          </span>
        </div>
      </div>

      {/* Kitchen Required Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <KPICard
          title={d.newOrdersQueue || 'New Orders Queue'}
          value={newOrders.length}
          sublabel="Awaiting grill / prep start"
          icon={Clock}
          iconColor="amber"
          badgeText="Queue"
          badgeType="warning"
        />

        <KPICard
          title={d.preparingOnStove || 'Preparing on Stove/Grill'}
          value={preparingOrders.length}
          sublabel="Active cooking tickets"
          icon={ChefHat}
          iconColor="teal"
        />

        <KPICard
          title={d.readyForPickup || 'Ready for Pickup'}
          value={readyOrders.length}
          sublabel="Staged for waiter / driver"
          icon={CheckCircle2}
          iconColor="emerald"
        />

        <KPICard
          title={d.delayedAlerts || 'Delayed Prep Alerts'}
          value={`${delayedOrders.length} Tickets`}
          sublabel={delayedOrders.length > 0 ? 'Exceeded target prep time!' : 'All orders within target time'}
          icon={AlertTriangle}
          iconColor="rose"
          badgeText={delayedOrders.length > 0 ? 'Delayed' : 'Optimal'}
          badgeType={delayedOrders.length > 0 ? 'danger' : 'success'}
        />

      </div>

      {/* 3-Column KDS Ticket Display (New | Preparing | Ready) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Column 1: New Orders */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              NEW TICKETS ({newOrders.length})
            </h3>
          </div>

          <div className="space-y-3">
            {newOrders.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No new incoming tickets.</p>
            ) : (
              newOrders.map(order => (
                <div key={order.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-white text-sm">{order.orderNumber}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{order.orderType || 'dine_in'}</span>
                  </div>

                  <div className="space-y-1 text-xs">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between font-medium text-slate-200">
                        <span>{item.quantity}x {item.productName}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleSetPreparing(order.id)}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <Play className="w-3.5 h-3.5 fill-slate-950" /> Start Preparing
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Preparing Orders */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-teal-400 flex items-center gap-2">
              <ChefHat className="w-4 h-4" />
              PREPARING ({preparingOrders.length})
            </h3>
          </div>

          <div className="space-y-3">
            {preparingOrders.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No tickets currently cooking.</p>
            ) : (
              preparingOrders.map(order => (
                <div key={order.id} className="bg-slate-950 p-4 rounded-2xl border border-teal-500/30 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-white text-sm">{order.orderNumber}</span>
                    <span className="text-[10px] text-teal-400 font-bold uppercase bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                      Cooking
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between font-medium text-slate-200">
                        <span>{item.quantity}x {item.productName}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleSetReady(order.id)}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs py-2 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <Check className="w-4 h-4" /> Mark Ready for Service
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Ready Orders */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              READY FOR SERVICE ({readyOrders.length})
            </h3>
          </div>

          <div className="space-y-3">
            {readyOrders.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No staged dishes waiting for pickup.</p>
            ) : (
              readyOrders.map(order => (
                <div key={order.id} className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-white text-sm">{order.orderNumber}</span>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      READY
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {order.items?.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                  </p>
                  <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                    Staged for: {order.customerName}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
