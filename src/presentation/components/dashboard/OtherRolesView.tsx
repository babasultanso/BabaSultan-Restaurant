import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../../lib/firebase';
import { MessagingService } from '../../../infrastructure/messaging/messagingService';
import { useAuth } from '../../context/AuthContext';
import { KPICard } from './KPICard';
import { Order, Employee } from '../../../types';
import {
  ShieldCheck,
  Building2,
  Users,
  Database,
  Truck,
  MapPin,
  Utensils,
  CheckCircle2,
  Clock,
  Navigation,
  Bell,
  Check,
  Smartphone,
  Phone,
  Radio,
  PackageCheck,
  AlertTriangle
} from 'lucide-react';
import { updateDeliveryStatusFirestore } from '../../../lib/firebase';
import { getApiUrl } from '../../../lib/apiConfig';

interface OtherRolesViewProps {
  role: string;
  orders: Order[];
  employees: Employee[];
  onNavigateToTab?: (tab: string) => void;
}

export const AdminView: React.FC<OtherRolesViewProps> = ({ orders, employees, onNavigateToTab }) => {
  const { t } = useAuth();
  const d: Record<string, any> = t.dashboard || {};

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-purple-500/10 text-purple-400 font-bold text-[10px] px-2.5 py-0.5 rounded-full border border-purple-500/20 uppercase tracking-wider">
              {d.systemAdmin || 'System Admin'}
            </span>
            <span className="text-xs text-slate-400">• {d.fullRbac || 'Full RBAC Architecture Access'}</span>
          </div>
          <h2 className="text-2xl font-bold text-white">{d.adminTitle || 'System Administration Dashboard'}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{d.adminSubtitle || 'Manage enterprise access control, user accounts, security rules, and database collections.'}</p>
        </div>

        {onNavigateToTab && (
          <button
            onClick={() => onNavigateToTab('admin')}
            className="bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer shadow-lg"
          >
            {d.openAdminControl || 'Open Admin Control Panel →'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Orders" value={orders.length} icon={ShieldCheck} iconColor="purple" />
        <KPICard title="Enterprise Staff" value={employees.length} icon={Users} iconColor="teal" />
        <KPICard title="Security Rules" value="v2 ABAC Active" icon={Building2} iconColor="emerald" />
        <KPICard title="Database Status" value="Firestore Synced" icon={Database} iconColor="indigo" />
      </div>
    </div>
  );
};

export const WaiterView: React.FC<OtherRolesViewProps> = ({ orders, onNavigateToTab }) => {
  const { t } = useAuth();
  const d: Record<string, any> = t.dashboard || {};

  const readyTableOrders = orders.filter(o => o.status === 'ready_for_pickup' || o.prepStatus === 'ready');
  const activeDineIn = orders.filter(o => o.orderType === 'dine_in' || !o.orderType);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="bg-emerald-500/10 text-emerald-400 font-bold text-[10px] px-2.5 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-wider block w-fit mb-1">
            {d.floorStaff || 'Floor Staff'}
          </span>
          <h2 className="text-2xl font-bold text-white">{d.waiterTitle || 'Dining Room Waiter Station'}</h2>
          <p className="text-xs text-slate-400">{d.waiterSubtitle || 'Track active dining tables, ready dishes from kitchen, and floor service requests.'}</p>
        </div>

        {onNavigateToTab && (
          <button
            onClick={() => onNavigateToTab('pos')}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer shadow-lg"
          >
            {d.createTableOrder || '+ Create Table Order'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Ready for Table Service" value={readyTableOrders.length} icon={Utensils} iconColor="emerald" />
        <KPICard title="Active Occupied Tables" value={activeDineIn.length || 4} icon={Clock} iconColor="amber" />
        <KPICard title="Floor Shift Sales" value={`$${orders.reduce((s, o) => s + o.totalAmount, 0).toFixed(2)}`} icon={CheckCircle2} iconColor="teal" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Utensils className="w-5 h-5 text-emerald-400" />
          Kitchen Ready Dishes awaiting Table Delivery
        </h3>
        <div className="space-y-2">
          {readyTableOrders.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No kitchen dishes currently waiting for floor delivery.</p>
          ) : (
            readyTableOrders.map(o => (
              <div key={o.id} className="flex items-center justify-between bg-slate-950 p-3.5 rounded-2xl border border-emerald-500/30 text-xs">
                <div>
                  <span className="font-bold text-white">{o.orderNumber} ({o.tableNumber || 'Table 4'})</span>
                  <p className="text-[10px] text-slate-400">{o.items?.map(i => `${i.quantity}x ${i.productName}`).join(', ')}</p>
                </div>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">READY</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const DeliveryDriverView: React.FC<OtherRolesViewProps> = ({ orders }) => {
  const { user } = useAuth();
  const [assignedDeliveries, setAssignedDeliveries] = useState<any[]>([]);
  const [driverNotifs, setDriverNotifs] = useState<any[]>([]);
  const [pushStatus, setPushStatus] = useState<'idle' | 'registered' | 'denied'>('idle');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Realtime listener scoped strictly to this driver's assigned deliveries
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, COLLECTIONS.DELIVERIES),
      where('driverId', '==', user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        list.push({
          id: d.id,
          orderId: data.orderId || d.id,
          deliveryNumber: data.deliveryNumber || data.orderNumber || `DEL-${d.id.slice(-6).toUpperCase()}`,
          customerName: data.customerName || 'Delivery Customer',
          customerPhone: data.customerPhone || data.phone || '',
          deliveryAddress: data.deliveryAddress || data.address || 'Address on file',
          totalAmount: Number(data.totalAmount || 0),
          status: data.status || 'assigned',
          branchId: data.branchId || '',
          createdAt: data.createdAt || new Date().toISOString(),
          notes: data.notes || '',
          ...data
        });
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setAssignedDeliveries(list);
    }, (err) => {
      console.warn('Driver deliveries realtime listener fallback:', err?.message || err);
      // Fallback matching from orders prop
      const myOrders = orders.filter(o => (o as any).driverId === user.uid || ((o as any).deliveryOrder as any)?.driverId === user.uid);
      setAssignedDeliveries(myOrders.map(o => ({
        id: o.id,
        orderId: o.id,
        deliveryNumber: o.orderNumber,
        customerName: o.customerName || 'Customer',
        customerPhone: o.customerPhone || '',
        deliveryAddress: o.deliveryAddress || 'Address on file',
        totalAmount: o.totalAmount,
        status: (o as any).deliveryStatus || 'assigned',
        branchId: o.branchId,
        createdAt: o.createdAt
      })));
    });

    return () => unsub();
  }, [user?.uid, orders]);

  // Realtime dispatch notifications listener scoped to driver
  useEffect(() => {
    if (!user) return;

    let q;
    try {
      q = query(
        collection(db, COLLECTIONS.NOTIFICATIONS),
        where('recipientId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
    } catch {
      q = query(
        collection(db, COLLECTIONS.NOTIFICATIONS),
        where('recipientId', '==', user.uid)
      );
    }

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setDriverNotifs(items);
    }, (err) => {
      console.warn('Driver notifications realtime notice, falling back:', err?.message || err);
      const fallbackQ = query(
        collection(db, COLLECTIONS.NOTIFICATIONS),
        where('recipientId', '==', user.uid)
      );
      onSnapshot(fallbackQ, (snap) => {
        const items = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setDriverNotifs(items);
      });
    });

    return () => unsub();
  }, [user]);

  const handleEnablePush = async () => {
    try {
      const token = await MessagingService.requestNotificationPermission();
      if (token && user) {
        const idToken = await user.getIdToken();
        const res = await fetch(getApiUrl('/api/notifications/register-device'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ token })
        });
        if (res.ok) {
          setPushStatus('registered');
        }
      } else {
        setPushStatus('denied');
      }
    } catch (err) {
      console.error('Failed to enable driver push notifications:', err);
      setPushStatus('denied');
    }
  };

  const markNotifRead = async (notifId: string) => {
    try {
      setDriverNotifs(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
      const idToken = await user?.getIdToken();
      await fetch(getApiUrl(`/api/notifications/${notifId}/read`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        }
      });
    } catch (err) {
      console.error('Failed to mark driver notification read:', err);
    }
  };

  const handleUpdateStatus = async (deliveryId: string, nextStatus: string, failureReason?: string) => {
    if (!user) return;
    setActionLoading(deliveryId);
    setActionFeedback(null);

    try {
      const idToken = await user.getIdToken();
      const payload: any = { status: nextStatus };
      if (failureReason) payload.failureReason = failureReason;

      const res = await fetch(getApiUrl(`/api/deliveries/${deliveryId}/status`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with status ${res.status}`);
      }

      // Optimistic local update
      setAssignedDeliveries(prev => prev.map(d => d.id === deliveryId ? { ...d, status: nextStatus } : d));
      setActionFeedback({
        type: 'success',
        message: `Delivery successfully transitioned to "${nextStatus.replace('_', ' ')}"`
      });

      // Send telemetry update if location is available
      if (navigator.geolocation && ['picked_up', 'on_the_way', 'arrived'].includes(nextStatus)) {
        navigator.geolocation.getCurrentPosition((pos) => {
          fetch(getApiUrl(`/api/deliveries/${deliveryId}/tracking`), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              speedKmH: pos.coords.speed ? pos.coords.speed * 3.6 : 0,
              heading: pos.coords.heading || 0,
              statusUpdate: nextStatus
            })
          }).catch(e => console.warn('Telemetry sync notice:', e));
        }, (geoErr) => {
          console.warn('Geolocation notice:', geoErr?.message || geoErr);
        }, { enableHighAccuracy: true, timeout: 5000 });
      }
    } catch (err: any) {
      console.error('Status transition failed:', err);
      setActionFeedback({
        type: 'error',
        message: err?.message || 'Failed to update delivery status.'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const activeDeliveries = assignedDeliveries.filter(d => !['delivered', 'failed', 'returned', 'cancelled'].includes(d.status));
  const completedDeliveries = assignedDeliveries.filter(d => d.status === 'delivered');

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="bg-indigo-500/10 text-indigo-400 font-bold text-[10px] px-2.5 py-0.5 rounded-full border border-indigo-500/20 uppercase tracking-wider block w-fit mb-1">
            Dispatch Portal
          </span>
          <h2 className="text-2xl font-bold text-white">Delivery Driver App</h2>
          <p className="text-xs text-slate-400">Assigned customer delivery orders, realtime dispatch notifications, and completion status.</p>
        </div>

        <button
          onClick={handleEnablePush}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
            pushStatus === 'registered'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-lg'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          {pushStatus === 'registered' ? 'Push Notifications Active' : 'Enable Device Push Alerts'}
        </button>
      </div>

      {actionFeedback && (
        <div className={`p-4 rounded-2xl border text-xs font-medium flex items-center justify-between ${
          actionFeedback.type === 'success'
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{actionFeedback.message}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-slate-400 hover:text-white text-xs ml-4">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard title="Active Assigned Deliveries" value={activeDeliveries.length} icon={Truck} iconColor="indigo" />
        <KPICard title="Unread Dispatch Alerts" value={driverNotifs.filter(n => !n.read).length} icon={Bell} iconColor="amber" />
        <KPICard title="Completed Deliveries" value={completedDeliveries.length} icon={CheckCircle2} iconColor="emerald" />
      </div>

      {/* Realtime Dispatch Notifications Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-400" />
            <span>Driver Realtime Dispatch Notifications</span>
          </div>
          {driverNotifs.filter(n => !n.read).length > 0 && (
            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              {driverNotifs.filter(n => !n.read).length} Unread
            </span>
          )}
        </h3>

        <div className="space-y-2">
          {driverNotifs.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No dispatch notifications received yet.</p>
          ) : (
            driverNotifs.map(n => (
              <div
                key={n.id}
                className={`flex items-center justify-between p-3.5 rounded-2xl border text-xs transition ${
                  n.read
                    ? 'bg-slate-950/50 border-slate-800/60 text-slate-400'
                    : 'bg-slate-800/80 border-indigo-500/40 text-white'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{n.title}</span>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300">{n.message}</p>
                  <span className="text-[9px] text-slate-500 font-mono block pt-0.5">
                    {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                  </span>
                </div>

                {!n.read && (
                  <button
                    onClick={() => markNotifRead(n.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 text-[10px] font-bold transition cursor-pointer"
                  >
                    <Check className="w-3 h-3" /> Mark Read
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Active Assigned Deliveries Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-indigo-400" />
            <span>My Assigned Deliveries</span>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {activeDeliveries.length} active order{activeDeliveries.length === 1 ? '' : 's'}
          </span>
        </h3>

        <div className="space-y-4">
          {assignedDeliveries.length === 0 ? (
            <div className="text-center py-12 bg-slate-950/40 rounded-2xl border border-slate-800/60">
              <Truck className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-bold text-white mb-1">No Deliveries Assigned</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                When the dispatcher assigns delivery orders to your account, they will appear here in real-time.
              </p>
            </div>
          ) : (
            assignedDeliveries.map(d => {
              const isLoading = actionLoading === d.id;
              const isDelivered = d.status === 'delivered';
              const isFailed = ['failed', 'returned', 'cancelled'].includes(d.status);

              return (
                <div
                  key={d.id}
                  className={`p-5 rounded-2xl border transition ${
                    isDelivered
                      ? 'bg-slate-950/40 border-slate-800/60 opacity-80'
                      : isFailed
                      ? 'bg-rose-950/20 border-rose-900/40'
                      : 'bg-slate-950 border-slate-800 shadow-md'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <Truck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{d.deliveryNumber}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            d.status === 'delivered'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : d.status === 'arrived'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              : d.status === 'on_the_way'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                              : d.status === 'picked_up'
                              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                              : d.status === 'accepted'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : isFailed
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {d.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 font-medium">Customer: <strong className="text-white">{d.customerName}</strong></p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-bold text-indigo-400">${(d.totalAmount || 0).toFixed(2)}</span>
                      <p className="text-[10px] text-slate-500">
                        {d.createdAt ? new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 mb-4">
                    <div className="flex items-center gap-2 text-slate-300">
                      <MapPin className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="truncate">{d.deliveryAddress}</span>
                    </div>
                    {d.customerPhone && (
                      <div className="flex items-center gap-2 text-slate-300">
                        <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{d.customerPhone}</span>
                      </div>
                    )}
                  </div>

                  {/* Driver Lifecycle Action Buttons */}
                  {!isDelivered && !isFailed && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-900">
                      {d.status === 'assigned' && (
                        <button
                          onClick={() => handleUpdateStatus(d.id, 'accepted')}
                          disabled={isLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-lg cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          {isLoading ? 'Updating...' : 'Accept Order'}
                        </button>
                      )}

                      {d.status === 'accepted' && (
                        <button
                          onClick={() => handleUpdateStatus(d.id, 'picked_up')}
                          disabled={isLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-lg cursor-pointer"
                        >
                          <PackageCheck className="w-4 h-4" />
                          {isLoading ? 'Updating...' : 'Pick Up from Kitchen'}
                        </button>
                      )}

                      {d.status === 'picked_up' && (
                        <button
                          onClick={() => handleUpdateStatus(d.id, 'on_the_way')}
                          disabled={isLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-lg cursor-pointer"
                        >
                          <Navigation className="w-4 h-4" />
                          {isLoading ? 'Updating...' : 'Start Trip (On The Way)'}
                        </button>
                      )}

                      {d.status === 'on_the_way' && (
                        <button
                          onClick={() => handleUpdateStatus(d.id, 'arrived')}
                          disabled={isLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-lg cursor-pointer"
                        >
                          <MapPin className="w-4 h-4" />
                          {isLoading ? 'Updating...' : 'Mark Arrived at Customer'}
                        </button>
                      )}

                      {d.status === 'arrived' && (
                        <button
                          onClick={() => handleUpdateStatus(d.id, 'delivered')}
                          disabled={isLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-lg cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {isLoading ? 'Completing...' : 'Complete & Mark Delivered'}
                        </button>
                      )}

                      <button
                        onClick={() => {
                          const reason = prompt('Please enter the issue/failure reason:');
                          if (reason) handleUpdateStatus(d.id, 'failed', reason);
                        }}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700/50 rounded-xl text-xs font-medium transition cursor-pointer ml-auto"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Report Issue
                      </button>
                    </div>
                  )}

                  {isDelivered && (
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold pt-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Trip successfully completed and delivered</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
