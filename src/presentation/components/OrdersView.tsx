import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db, COLLECTIONS, updateOrderStatusFirestore } from '../../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Order, OrderStatus, DeliveryOrder } from '../../types';
import { KitchenTicket } from '../../domain/entities/kitchen';
import { KDSView } from './orders/KDSView';
import { TableManagementView } from './orders/TableManagementView';
import { CustomerHistoryView } from './orders/CustomerHistoryView';
import { OrderDetailsModal } from './orders/OrderDetailsModal';
import { EditOrderModal } from './orders/EditOrderModal';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  DollarSign,
  Utensils,
  Search,
  Filter,
  Eye,
  Flame,
  Users,
  Layers,
  Edit,
  Plus,
  RefreshCw,
  AlertTriangle,
  MapPin,
  Phone,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

interface OrdersViewProps {
  orders: Order[];
  ordersError?: string | null;
  isLoading?: boolean;
  onRetry?: () => void;
  onRefresh?: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  ordersError,
  isLoading = false,
  onRetry,
  onRefresh
}) => {
  const { userRecord, role, t } = useAuth();
  const [activeTab, setActiveTab] = useState<'pipeline' | 'kds' | 'tables' | 'customers'>('pipeline');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Order Modals
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<Order | null>(null);

  // Authoritative Kitchen & Delivery live maps
  const [kitchenOrdersMap, setKitchenOrdersMap] = useState<Record<string, KitchenTicket>>({});
  const [deliveriesMap, setDeliveriesMap] = useState<Record<string, DeliveryOrder>>({});
  const [realtimeSubError, setRealtimeSubError] = useState<string | null>(null);

  // Branch isolation
  const userRoleStr = String(role || userRecord?.role || '').toLowerCase().trim();
  const userBranch = userRecord?.branchId || (userRecord as any)?.branch;
  const isHqUser = userRoleStr === 'owner' || (userRoleStr === 'admin' && (!userBranch || userBranch === 'all'));
  const isBranchScoped = !isHqUser && Boolean(userBranch) && userBranch !== 'all';

  // 1. Subscribe to Kitchen Orders in Real-Time (Authoritative Kitchen Status)
  useEffect(() => {
    try {
      const kQuery = isBranchScoped
        ? query(collection(db, COLLECTIONS.KITCHEN_ORDERS), where('branchId', '==', userBranch))
        : query(collection(db, COLLECTIONS.KITCHEN_ORDERS));

      const unsubKitchen = onSnapshot(
        kQuery,
        (snap) => {
          const map: Record<string, KitchenTicket> = {};
          snap.forEach((doc) => {
            const data = doc.data();
            map[doc.id] = {
              id: doc.id,
              orderId: data.orderId || doc.id,
              orderNumber: data.orderNumber || doc.id.slice(-4),
              orderTime: data.orderTime || data.createdAt || new Date().toISOString(),
              prepStatus: data.prepStatus || 'new',
              items: data.items || [],
              tableNumber: data.tableNumber || '',
              customerName: data.customerName || 'Guest',
              orderType: data.orderType || 'dine_in',
              priority: data.priority || 'normal',
              estimatedPrepTimeMinutes: data.estimatedPrepTimeMinutes || 15,
              branchId: data.branchId || '',
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || data.createdAt || new Date().toISOString(),
              notes: data.notes || ''
            } as KitchenTicket;
          });
          setKitchenOrdersMap(map);
        },
        (err) => {
          console.warn('OrdersView kitchen_orders listener notice:', err);
        }
      );

      return () => unsubKitchen();
    } catch (err: any) {
      console.warn('Kitchen orders subscription failed:', err);
    }
  }, [userBranch, isBranchScoped]);

  // 2. Subscribe to Deliveries in Real-Time (Authoritative Delivery Status)
  useEffect(() => {
    try {
      const dQuery = isBranchScoped
        ? query(collection(db, COLLECTIONS.DELIVERIES), where('branchId', '==', userBranch))
        : query(collection(db, COLLECTIONS.DELIVERIES));

      const unsubDeliveries = onSnapshot(
        dQuery,
        (snap) => {
          const map: Record<string, DeliveryOrder> = {};
          snap.forEach((doc) => {
            const data = doc.data();
            const orderId = data.orderId || doc.id;
            map[orderId] = {
              id: doc.id,
              orderId: orderId,
              orderNumber: data.orderNumber || orderId.slice(-4),
              deliveryNumber: data.deliveryNumber || `DEL-${doc.id.slice(-4)}`,
              customerName: data.customerName || 'Customer',
              customerPhone: data.customerPhone || '',
              deliveryAddress: data.deliveryAddress || '',
              deliveryZoneId: data.deliveryZoneId || '',
              deliveryZoneName: data.deliveryZoneName || '',
              driverId: data.driverId,
              driverName: data.driverName,
              driverPhone: data.driverPhone,
              status: data.status || 'unassigned',
              branchId: data.branchId || '',
              deliveryFee: data.deliveryFee || 0,
              subtotal: data.subtotal || 0,
              totalAmount: data.totalAmount || data.total || 0,
              paymentMethod: data.paymentMethod || 'cash',
              paymentStatus: data.paymentStatus || 'unpaid',
              itemsCount: data.itemsCount || (data.items ? data.items.length : 1),
              estimatedDeliveryTimeMinutes: data.estimatedDeliveryTimeMinutes || 30,
              createdAt: data.createdAt || new Date().toISOString()
            } as DeliveryOrder;
          });
          setDeliveriesMap(map);
        },
        (err) => {
          console.warn('OrdersView deliveries listener notice:', err);
        }
      );

      return () => unsubDeliveries();
    } catch (err: any) {
      console.warn('Deliveries subscription failed:', err);
    }
  }, [userBranch, isBranchScoped]);

  // Filter Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // 1. Status Filter
      const matchesStatus =
        filterStatus === 'all' ||
        o.status === filterStatus ||
        (filterStatus === 'in_preparation' && o.status === 'preparing') ||
        (filterStatus === 'ready_for_pickup' && o.status === 'ready');

      // 2. Type Filter
      const orderType = o.orderType || o.type || 'dine_in';
      const matchesType = filterType === 'all' || orderType === filterType;

      // 3. Search Query
      const q = (searchQuery || '').toLowerCase().trim();
      if (!q) return matchesStatus && matchesType;

      const delivery = deliveriesMap[o.id];
      const matchesSearch =
        (o.orderNumber || '').toLowerCase().includes(q) ||
        (o.customerName || '').toLowerCase().includes(q) ||
        (o.customerPhone || '').toLowerCase().includes(q) ||
        String(o.tableNumber || '').toLowerCase().includes(q) ||
        (o.deliveryAddress || delivery?.deliveryAddress || '').toLowerCase().includes(q) ||
        (delivery?.driverName || o.assignedDriver || '').toLowerCase().includes(q);

      return matchesStatus && matchesType && matchesSearch;
    });
  }, [orders, filterStatus, filterType, searchQuery, deliveriesMap]);

  // Handle Safe Order Cancellation (Routed to secure backend)
  const handleCancelOrder = async (orderId: string, reason?: string) => {
    try {
      await updateOrderStatusFirestore(orderId, 'cancelled', reason);
      if (selectedOrderDetails && selectedOrderDetails.id === orderId) {
        setSelectedOrderDetails({ ...selectedOrderDetails, status: 'cancelled' });
      }
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Order cancellation failed: ${err.message}`);
    }
  };

  // Authoritative Order Status Badge
  const getOrderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
        );
      case 'ready_for_pickup':
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30 text-[10px] font-bold uppercase tracking-wider">
            <Clock className="w-3 h-3" />
            Ready
          </span>
        );
      case 'in_preparation':
      case 'preparing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider animate-pulse">
            <Flame className="w-3 h-3" />
            In Preparation
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3" />
            Confirmed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wider">
            <AlertCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] font-bold uppercase tracking-wider">
            <Clock className="w-3 h-3" />
            New Order
          </span>
        );
    }
  };

  // Authoritative Kitchen Status Badge (from kitchen_orders collection)
  const getKitchenStatusBadge = (orderId: string, fallbackStatus?: string) => {
    const ticket = kitchenOrdersMap[orderId];
    const prepStatus = ticket?.prepStatus || fallbackStatus;
    if (!prepStatus && !ticket) return null;

    switch (prepStatus) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Kitchen: Completed
          </span>
        );
      case 'ready_for_pickup':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-950/60 text-teal-300 border border-teal-500/30 text-[10px] font-semibold">
            <Clock className="w-2.5 h-2.5" />
            Kitchen: Food Ready
          </span>
        );
      case 'cooking':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-300 border border-amber-500/30 text-[10px] font-semibold animate-pulse">
            <Flame className="w-2.5 h-2.5" />
            Kitchen: Cooking
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-950/60 text-blue-300 border border-blue-500/30 text-[10px] font-semibold">
            <Clock className="w-2.5 h-2.5" />
            Kitchen: Accepted
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-950/60 text-rose-300 border border-rose-500/30 text-[10px] font-semibold">
            <AlertCircle className="w-2.5 h-2.5" />
            Kitchen: Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 text-slate-300 border border-slate-700 text-[10px] font-semibold">
            <Clock className="w-2.5 h-2.5" />
            Kitchen: New Ticket
          </span>
        );
    }
  };

  // Authoritative Delivery Status Badge (from deliveries collection)
  const getDeliveryStatusBadge = (order: Order) => {
    const delivery = deliveriesMap[order.id];
    const isDelivery = order.orderType === 'delivery' || order.type === 'delivery' || Boolean(delivery);
    if (!isDelivery) return null;

    const delStatus = delivery?.status || order.deliveryStatus || 'unassigned';

    switch (delStatus) {
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
            Delivery: Delivered
          </span>
        );
      case 'arrived':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-950/60 text-teal-300 border border-teal-500/30 text-[10px] font-semibold">
            <MapPin className="w-2.5 h-2.5 text-teal-400" />
            Delivery: Driver Arrived
          </span>
        );
      case 'on_the_way':
      case 'in_transit':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-950/60 text-purple-300 border border-purple-500/30 text-[10px] font-semibold animate-pulse">
            <Truck className="w-2.5 h-2.5 text-purple-400" />
            Delivery: Out for Delivery
          </span>
        );
      case 'picked_up':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-300 border border-amber-500/30 text-[10px] font-semibold">
            <Truck className="w-2.5 h-2.5 text-amber-400" />
            Delivery: Picked Up
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 text-[10px] font-semibold">
            <Truck className="w-2.5 h-2.5 text-cyan-400" />
            Delivery: Driver Accepted
          </span>
        );
      case 'assigned':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold">
            <Truck className="w-2.5 h-2.5 text-indigo-400" />
            Delivery: Driver Assigned
          </span>
        );
      case 'failed':
      case 'returned':
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-950/60 text-rose-300 border border-rose-500/30 text-[10px] font-semibold">
            <AlertCircle className="w-2.5 h-2.5 text-rose-400" />
            Delivery: Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-700 text-[10px] font-semibold">
            <Truck className="w-2.5 h-2.5 text-slate-400" />
            Delivery: Unassigned
          </span>
        );
    }
  };

  // Authoritative Payment Status Badge (Independent)
  const getPaymentStatusBadge = (order: Order) => {
    switch (order.paymentStatus) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase">
            <DollarSign className="w-2.5 h-2.5" />
            Paid
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold uppercase">
            <AlertCircle className="w-2.5 h-2.5" />
            Refunded
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold uppercase">
            <AlertCircle className="w-2.5 h-2.5" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase">
            <Clock className="w-2.5 h-2.5" />
            Pending
          </span>
        );
    }
  };

  // Type Badge
  const getOrderTypeBadge = (order: Order) => {
    const orderType = order.orderType || order.type || 'dine_in';
    switch (orderType) {
      case 'delivery':
        return (
          <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-bold uppercase flex items-center gap-1">
            <Truck className="w-2.5 h-2.5" /> Delivery
          </span>
        );
      case 'takeaway':
      case 'takeout':
        return (
          <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-400 border border-teal-500/30 text-[10px] font-bold uppercase flex items-center gap-1">
            <ShoppingBag className="w-2.5 h-2.5" /> Takeout
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold uppercase flex items-center gap-1">
            <Utensils className="w-2.5 h-2.5" /> Dine-in
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Navigation */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-emerald-400" />
            {t?.orders?.title || 'Order Monitoring & Tracking'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t?.orders?.subtitle || 'Realtime authoritative order, kitchen prep, and delivery tracking'}
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-3.5 py-2 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'pipeline'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{t?.orders?.pipeline || 'Order Tracking'}</span>
          </button>

          <button
            onClick={() => setActiveTab('kds')}
            className={`px-3.5 py-2 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'kds'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>{t?.orders?.kds || 'Kitchen Display'}</span>
          </button>

          <button
            onClick={() => setActiveTab('tables')}
            className={`px-3.5 py-2 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'tables'
                ? 'bg-teal-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>{t?.orders?.tables || 'Dining Tables'}</span>
          </button>

          <button
            onClick={() => setActiveTab('customers')}
            className={`px-3.5 py-2 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'customers'
                ? 'bg-purple-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{t?.orders?.customerLog || 'Customer History'}</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          {/* Realtime Error Banner */}
          {(ordersError || realtimeSubError) && (
            <div className="bg-rose-950/40 border border-rose-500/40 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-rose-300">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                <div>
                  <span className="font-bold text-rose-200 block">Orders realtime connection unavailable</span>
                  <span className="text-[11px] text-rose-300/80">
                    {ordersError || realtimeSubError || 'Please check your connection and branch permissions.'}
                  </span>
                </div>
              </div>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold transition cursor-pointer flex items-center gap-1.5 text-xs flex-shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Connection</span>
                </button>
              )}
            </div>
          )}

          {/* Controls Bar: Filters & Search */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by Order #, Customer, Phone, Table, Address, Driver..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              {/* Order Type Dropdown Filter */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs font-semibold whitespace-nowrap">Type:</span>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition cursor-pointer"
                >
                  <option value="all">All Types</option>
                  <option value="dine_in">Dine-in</option>
                  <option value="takeaway">Takeout</option>
                  <option value="delivery">Delivery</option>
                </select>

                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    title="Refresh Data"
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Status Filter Pills (Real Project Statuses) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 text-xs">
              <span className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mr-1">Status:</span>
              {[
                { id: 'all', label: 'All Orders' },
                { id: 'new', label: 'New' },
                { id: 'confirmed', label: 'Confirmed' },
                { id: 'in_preparation', label: 'In Preparation' },
                { id: 'ready_for_pickup', label: 'Ready' },
                { id: 'completed', label: 'Completed' },
                { id: 'cancelled', label: 'Cancelled' }
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setFilterStatus(s.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer text-[11px] ${
                    filterStatus === s.id
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border border-slate-800/80 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Tracking Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            {isLoading && orders.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mx-auto mb-2" />
                <p>Loading live orders...</p>
              </div>
            ) : orders.length === 0 && !ordersError ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="font-bold text-slate-300 text-sm">No orders found</p>
                <p className="text-slate-500 mt-1">Orders created in POS or online will appear here automatically in real time.</p>
              </div>
            ) : filteredOrders.length === 0 && orders.length > 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <Filter className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="font-bold text-slate-300 text-sm">No orders match the selected filter</p>
                <p className="text-slate-500 mt-1">Try resetting the status filter or search query.</p>
                <button
                  onClick={() => {
                    setFilterStatus('all');
                    setFilterType('all');
                    setSearchQuery('');
                  }}
                  className="mt-3 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300 border-collapse">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">Order #</th>
                      <th className="py-3.5 px-4">Type</th>
                      <th className="py-3.5 px-4">Customer / Destination</th>
                      <th className="py-3.5 px-4 text-center">Items</th>
                      <th className="py-3.5 px-4">Total</th>
                      <th className="py-3.5 px-4">Payment</th>
                      <th className="py-3.5 px-4">Order State</th>
                      <th className="py-3.5 px-4">Operational Progress</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredOrders.map((order) => {
                      const delivery = deliveriesMap[order.id];
                      const isDelivery = order.orderType === 'delivery' || order.type === 'delivery' || Boolean(delivery);

                      return (
                        <tr
                          key={order.id}
                          className="hover:bg-slate-850 transition duration-150 group"
                        >
                          {/* Order Number & Created Time */}
                          <td className="py-3.5 px-4 font-mono font-bold text-white">
                            <div>
                              <span className="text-emerald-400">#{order.orderNumber}</span>
                              <span className="block text-[10px] text-slate-400 font-sans font-normal mt-0.5">
                                {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </td>

                          {/* Type */}
                          <td className="py-3.5 px-4">
                            {getOrderTypeBadge(order)}
                          </td>

                          {/* Customer / Location / Destination */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <span className="font-bold text-white block">
                                {order.customerName || 'Walk-in Customer'}
                              </span>
                              {isDelivery ? (
                                <span className="text-[11px] text-purple-300 flex items-center gap-1 truncate max-w-[200px]">
                                  <MapPin className="w-3 h-3 flex-shrink-0 text-purple-400" />
                                  {order.deliveryAddress || delivery?.deliveryAddress || 'Address on file'}
                                </span>
                              ) : order.tableNumber ? (
                                <span className="text-[11px] text-teal-300 flex items-center gap-1">
                                  <Utensils className="w-3 h-3 flex-shrink-0 text-teal-400" />
                                  Table {order.tableNumber}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">Direct Order</span>
                              )}
                            </div>
                          </td>

                          {/* Items Count */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="bg-slate-800 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold text-slate-200 border border-slate-700">
                              {order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0}
                            </span>
                          </td>

                          {/* Total Amount */}
                          <td className="py-3.5 px-4 font-mono font-extrabold text-white">
                            <div>
                              <span>${(order.totalAmount || 0).toFixed(2)}</span>
                              <span className="block text-[10px] text-teal-400 font-sans font-semibold">
                                +${(order.profit || (order.totalAmount || 0) * 0.55).toFixed(2)} net
                              </span>
                            </div>
                          </td>

                          {/* Payment State (Independent) */}
                          <td className="py-3.5 px-4">
                            {getPaymentStatusBadge(order)}
                          </td>

                          {/* Order State */}
                          <td className="py-3.5 px-4">
                            {getOrderStatusBadge(order.status)}
                          </td>

                          {/* Operational Progress (Kitchen & Delivery) */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              {getKitchenStatusBadge(order.id, order.prepStatus)}
                              {getDeliveryStatusBadge(order)}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => setSelectedOrderDetails(order)}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-white font-bold text-xs transition cursor-pointer inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Details</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* KDS Tab */}
      {activeTab === 'kds' && (
        <KDSView
          orders={orders}
          onUpdateStatus={async (id, s) => {
            await handleCancelOrder(id);
          }}
        />
      )}

      {/* Tables Tab */}
      {activeTab === 'tables' && (
        <TableManagementView orders={orders} />
      )}

      {/* Customers Tab */}
      {activeTab === 'customers' && (
        <CustomerHistoryView orders={orders} />
      )}

      {/* Order Details Modal */}
      {selectedOrderDetails && (
        <OrderDetailsModal
          order={selectedOrderDetails}
          kitchenTicket={kitchenOrdersMap[selectedOrderDetails.id]}
          deliveryRecord={deliveriesMap[selectedOrderDetails.id]}
          onClose={() => setSelectedOrderDetails(null)}
          onCancelOrder={handleCancelOrder}
          onEditOrder={(order) => {
            setSelectedOrderForEdit(order);
          }}
        />
      )}

      {/* Edit Order Modal */}
      {selectedOrderForEdit && (
        <EditOrderModal
          order={selectedOrderForEdit}
          onClose={() => setSelectedOrderForEdit(null)}
          onSaved={() => {
            setSelectedOrderForEdit(null);
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
};
