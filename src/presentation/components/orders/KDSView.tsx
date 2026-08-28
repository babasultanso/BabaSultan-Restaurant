import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Order, OrderStatus } from '../../../types';
import { getCanonicalBranchId } from '../../../lib/branchUtils';
import {
  KitchenTicket,
  KitchenStation,
  KitchenPrepStatus,
  KitchenOrderPriority,
  KitchenStationType,
  KitchenWasteLog
} from '../../../domain/entities/kitchen';
import { KitchenRepositoryImpl } from '../../../data/repositories/KitchenRepositoryImpl';
import { KitchenController } from '../../../controllers/KitchenController';
import { kitchenService } from '../../../domain/services/kitchenService';
import { kdsDict, KitchenLang } from '../kitchen/translations';
import { KitchenOrderDetailsModal } from '../kitchen/KitchenOrderDetailsModal';
import { StationView } from '../kitchen/StationView';
import { KitchenAnalyticsView } from '../kitchen/KitchenAnalyticsView';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Utensils,
  Flame,
  User,
  CheckCheck,
  Search,
  Filter,
  Volume2,
  VolumeX,
  Globe,
  Layers,
  ChefHat,
  BarChart3,
  Tag,
  Eye,
  Trash2,
  RefreshCw,
  Zap
} from 'lucide-react';

interface KDSViewProps {
  orders?: Order[];
  onUpdateStatus?: (orderId: string, status: OrderStatus) => Promise<void>;
}

const repo = new KitchenRepositoryImpl();
const controller = new KitchenController(repo);

export const KDSView: React.FC<KDSViewProps> = ({ orders }) => {
  const { userRecord, role, language } = useAuth();
  // Navigation Tabs: queue | station | analytics
  const [activeTab, setActiveTab] = useState<'queue' | 'station' | 'analytics'>('queue');

  // Multi-lingual support: en | ar | so
  const currentLang = (language || 'en') as KitchenLang;
  const [lang, setLang] = useState<KitchenLang>(currentLang);

  useEffect(() => {
    setLang(currentLang);
  }, [currentLang]);

  const t = kdsDict[lang] || kdsDict.en;
  const isRtl = lang === 'ar';

  // Firestore Real-time subscriptions state
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [wasteLogs, setWasteLogs] = useState<KitchenWasteLog[]>([]);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [selectedTicketForModal, setSelectedTicketForModal] = useState<KitchenTicket | null>(null);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStation, setFilterStation] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Live timer tick every second for MM:SS timer updates
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const prevTicketIdsRef = React.useRef<Set<string>>(new Set());
  const isFirstLoadRef = React.useRef<boolean>(true);

  const userBranch = userRecord?.branchId || (userRecord as any)?.branch;
  const userRoleStr = String(role || userRecord?.role || '').toLowerCase();
  const isHqUser = userRoleStr === 'owner' || (userRoleStr === 'admin' && (!userBranch || userBranch === 'all'));

  // Subscribe to Kitchen Tickets
  const [subscribeTrigger, setSubscribeTrigger] = useState(0);
  useEffect(() => {
    setSubscriptionError(null);
    const unsubTickets = controller.subscribeTickets(
      (updatedTickets) => {
        setSubscriptionError(null);
        const currentIds = updatedTickets.map(t => t.id);
        if (!isFirstLoadRef.current && audioEnabled) {
          const hasGenuinelyNewTicket = currentIds.some(id => !prevTicketIdsRef.current.has(id));
          if (hasGenuinelyNewTicket) {
            kitchenService.playNewOrderChime();
          }
        }
        isFirstLoadRef.current = false;
        prevTicketIdsRef.current = new Set(currentIds);
        setTickets(updatedTickets);
      },
      userBranch,
      isHqUser,
      (err) => {
        console.error('Kitchen tickets subscription error:', err);
        setSubscriptionError(err.message || 'Failed to sync kitchen tickets. Please check connection/permissions.');
      }
    );

    const unsubStations = controller.subscribeStations(
      (updatedStations) => {
        setStations(updatedStations);
      },
      (err) => {
        console.error('Kitchen stations subscription error:', err);
      }
    );

    controller.getWasteLogs().then(setWasteLogs).catch(console.warn);

    return () => {
      unsubTickets();
      unsubStations();
    };
  }, [audioEnabled, userBranch, isHqUser, subscribeTrigger]);

  // Authoritative Kitchen tickets directly from Firestore kitchen_orders collection
  const activeDisplayTickets: KitchenTicket[] = useMemo(() => {
    return tickets;
  }, [tickets]);

  // Filtered queue tickets
  const filteredQueueTickets = useMemo(() => {
    const canonUserBranch = getCanonicalBranchId(userRecord?.branchId || (userRecord as any)?.branch);
    const isHq = role === 'Owner' || canonUserBranch === 'all' || !canonUserBranch;

    return activeDisplayTickets.filter((ticket) => {
      // P1-10: Strict branch-scoped display
      const ticketBranch = getCanonicalBranchId((ticket as any).branchId);
      if (!isHq && canonUserBranch && ticketBranch && ticketBranch !== canonUserBranch) {
        return false;
      }

      // Hide completed/cancelled from active queue unless specifically requested via filter
      if (filterStatus === 'all') {
        if (ticket.prepStatus === 'completed' || ticket.prepStatus === 'cancelled') return false;
      } else if (filterStatus !== 'all' && ticket.prepStatus !== filterStatus) {
        return false;
      }

      // Filter by station
      if (filterStation !== 'all') {
        const hasStationItem = ticket.items.some((i) => i.assignedStation === filterStation);
        if (!hasStationItem) return false;
      }

      // Filter by search text
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesOrderNum = (ticket.orderNumber || '').toLowerCase().includes(q);
        const matchesCustomer = (ticket.customerName || '').toLowerCase().includes(q);
        const matchesItem = (ticket.items || []).some((i) => (i.productName || '').toLowerCase().includes(q));
        if (!matchesOrderNum && !matchesCustomer && !matchesItem) return false;
      }

      return true;
    });
  }, [activeDisplayTickets, filterStatus, filterStation, searchQuery]);

  // Action handlers
  const handleAdvanceStatus = async (ticketId: string, currentStatus: KitchenPrepStatus) => {
    try {
      setActionLoadingId(ticketId);
      await controller.advanceTicketStatus(ticketId, currentStatus);
    } catch (err: any) {
      console.error('Kitchen advance status error:', err);
      alert(`Kitchen status update failed: ${err.message || 'Unknown error'}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUpdatePriority = async (ticketId: string, priority: KitchenOrderPriority) => {
    try {
      await controller.setTicketPriority(ticketId, priority);
    } catch (err: any) {
      console.error('Kitchen update priority error:', err);
      alert(`Priority update failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleUpdateItemStatus = async (ticketId: string, productId: string, itemStatus: KitchenPrepStatus) => {
    try {
      await controller.setItemStatus(ticketId, productId, itemStatus);
    } catch (err: any) {
      console.error('Kitchen update item status error:', err);
      alert(`Item status update failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleLogWaste = async (wasteData: any) => {
    try {
      await controller.logWaste(wasteData);
      const updatedLogs = await controller.getWasteLogs();
      setWasteLogs(updatedLogs);
    } catch (err: any) {
      console.error('Kitchen log waste error:', err);
      alert(`Waste logging failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleUpdateStationStatus = async (stationId: string, status: 'normal' | 'busy' | 'overloaded', chefName?: string) => {
    try {
      await controller.setStationStatus(stationId, status, chefName);
    } catch (err: any) {
      console.error('Kitchen update station status error:', err);
      alert(`Station update failed: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-6 text-white font-sans">
      
      {/* KDS Top Header & Navigation Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        {/* Title & Badge */}
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/30 shadow-lg shadow-amber-500/10">
            <Flame className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-extrabold text-white">{t.kdsTitle}</h2>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Live Firestore Sync
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">{t.kdsSubtitle}</p>
          </div>
        </div>

        {/* Global Controls & Mode Switcher */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          
          {/* Sound Toggle */}
          <button
            onClick={() => {
              const nextState = !audioEnabled;
              setAudioEnabled(nextState);
              if (nextState) kitchenService.playNewOrderChime();
            }}
            className={`p-2.5 rounded-2xl border transition cursor-pointer flex items-center gap-2 text-xs font-bold ${
              audioEnabled
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-white'
            }`}
            title="Toggle Audio Notifications"
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{t.audioAlerts}</span>
          </button>

          {/* Language Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-bold">
            <Globe className="w-4 h-4 text-slate-400 ml-2 mr-1" />
            <button
              onClick={() => setLang('en')}
              className={`px-2.5 py-1 rounded-xl transition ${lang === 'en' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLang('ar')}
              className={`px-2.5 py-1 rounded-xl transition ${lang === 'ar' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              عربي
            </button>
            <button
              onClick={() => setLang('so')}
              className={`px-2.5 py-1 rounded-xl transition ${lang === 'so' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              Somali
            </button>
          </div>

          {/* Primary View Navigation Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'queue' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{t.activeOrders}</span>
            </button>

            <button
              onClick={() => setActiveTab('station')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'station' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ChefHat className="w-4 h-4" />
              <span>{t.stationScreen}</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'analytics' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>{t.kitchenAnalytics}</span>
            </button>
          </div>

        </div>

      </div>

      {/* VIEW CONTENT SWITCHER */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          
          {/* Filter & Search Bar */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Search input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full bg-slate-950 border border-slate-800 pl-10 pr-4 py-2.5 rounded-2xl text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            {/* Station Filter */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Station:
              </span>
              <select
                value={filterStation}
                onChange={(e) => setFilterStation(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
              >
                <option value="all">{t.allStations}</option>
                <option value="grill">{t.grillStation}</option>
                <option value="pizza">{t.pizzaStation}</option>
                <option value="drinks">{t.drinksStation}</option>
                <option value="dessert">{t.dessertStation}</option>
                <option value="packing">{t.packingStation}</option>
              </select>

              {/* Status Filter */}
              <span className="text-xs text-slate-400 font-semibold ml-2">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
              >
                <option value="all">{t.allStatuses}</option>
                <option value="new">{t.statusNew}</option>
                <option value="accepted">{t.statusAccepted}</option>
                <option value="cooking">{t.statusCooking}</option>
                <option value="ready_for_pickup">{t.statusReady}</option>
                <option value="completed">{t.statusCompleted}</option>
                <option value="cancelled">{t.statusCancelled}</option>
              </select>
            </div>

          </div>

          {/* Realtime Subscription Error Banner */}
          {subscriptionError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-3xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">Live Kitchen Sync Connection Issue</p>
                  <p className="text-[11px] text-rose-300">{subscriptionError}</p>
                </div>
              </div>
              <button
                onClick={() => setSubscribeTrigger(prev => prev + 1)}
                className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Sync
              </button>
            </div>
          )}

          {/* KDS Active Queue Grid */}
          {filteredQueueTickets.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500 space-y-3 shadow-xl">
              <Utensils className="w-12 h-12 mx-auto text-slate-700" />
              <h4 className="text-base font-bold text-slate-300">Kitchen Queue Clean!</h4>
              <p className="text-xs">No pending or preparing orders match your current filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredQueueTickets.map((ticket) => {
                const isDelayed = kitchenService.isOrderDelayed(ticket);
                const timerDisplay = kitchenService.formatTimerDisplay(ticket.orderTime);
                const elapsedMins = kitchenService.getElapsedTimeMinutes(ticket.orderTime);

                const isNew = ticket.prepStatus === 'new';
                const isAccepted = ticket.prepStatus === 'accepted';
                const isCooking = ticket.prepStatus === 'cooking';
                const isReady = ticket.prepStatus === 'ready_for_pickup';

                return (
                  <div
                    key={ticket.id}
                    className={`bg-slate-900 border rounded-3xl p-5 shadow-xl flex flex-col justify-between transition relative overflow-hidden ${
                      isDelayed
                        ? 'border-rose-500/80 bg-rose-500/5 shadow-rose-500/10'
                        : isReady
                        ? 'border-teal-500/60 bg-teal-500/5'
                        : isCooking
                        ? 'border-amber-500/60 bg-amber-500/5'
                        : 'border-slate-800'
                    }`}
                  >
                    {/* Delayed Warning Banner */}
                    {isDelayed && (
                      <div className="bg-rose-500 text-white text-[10px] font-black uppercase px-3 py-1 text-center tracking-wider flex items-center justify-center gap-1.5 -mx-5 -mt-5 mb-4">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{t.delayedWarning} ({elapsedMins} mins elapsed)</span>
                      </div>
                    )}

                    <div className="space-y-3">
                      
                      {/* Card Header */}
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-white text-base">#{ticket.orderNumber}</span>
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-800 text-amber-400 border border-slate-700">
                              {(ticket.orderType || 'dine_in').replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {ticket.customerName} {ticket.tableNumber ? `• Table ${ticket.tableNumber}` : ''}
                          </p>
                        </div>

                        {/* Timer Display */}
                        <div className="text-right">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-mono font-black border ${
                            isDelayed
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                              : elapsedMins > 10
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          }`}>
                            <Clock className="w-3.5 h-3.5" />
                            {timerDisplay}
                          </span>
                        </div>
                      </div>

                      {/* Priority Tag & Ticket Status */}
                      <div className="flex items-center justify-between text-xs">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          ticket.priority === 'urgent'
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 font-black'
                            : ticket.priority === 'priority'
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {ticket.priority} priority
                        </span>

                        <span className="text-[11px] font-extrabold text-slate-300 capitalize">
                          {(ticket.prepStatus || 'queued').replace('_', ' ')}
                        </span>
                      </div>

                      {/* Items List */}
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {ticket.items.map((item, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-2xl border text-xs space-y-1 transition ${
                              item.itemStatus === 'ready_for_pickup' || item.itemStatus === 'completed'
                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                : item.itemStatus === 'cooking'
                                ? 'bg-amber-500/10 border-amber-500/30'
                                : 'bg-slate-950 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold text-white">
                              <div className="flex items-center gap-2">
                                <span className="bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-lg text-xs">
                                  {item.quantity}x
                                </span>
                                <span className="text-sm">{item.productName}</span>
                              </div>
                              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-800 text-cyan-400">
                                {item.assignedStation}
                              </span>
                            </div>

                            {item.selectedOptions && item.selectedOptions.length > 0 && (
                              <div className="text-[10px] text-emerald-400 font-semibold pl-8">
                                + {item.selectedOptions.map(o => o.choiceName).join(', ')}
                              </div>
                            )}

                            {item.notes && (
                              <div className="text-[10px] text-amber-300 font-bold bg-amber-500/10 p-1.5 rounded-xl border border-amber-500/20">
                                Note: {item.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Order Special Notes */}
                      {ticket.notes && (
                        <div className="text-xs bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-amber-300 font-bold">
                          Special Note: {ticket.notes}
                        </div>
                      )}

                    </div>

                    {/* Footer Actions */}
                    <div className="pt-4 border-t border-slate-800 mt-4 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedTicketForModal(ticket)}
                        className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer text-xs flex items-center gap-1 font-bold"
                        title="View Full Ticket & Waste Log"
                      >
                        <Eye className="w-4 h-4 text-cyan-400" /> Details
                      </button>

                      <div className="flex-1">
                        {isNew && (
                          <button
                            onClick={() => handleAdvanceStatus(ticket.id, 'new')}
                            disabled={actionLoadingId === ticket.id}
                            className={`w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-2xl transition cursor-pointer text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 ${
                              actionLoadingId === ticket.id ? 'opacity-60 cursor-wait' : ''
                            }`}
                          >
                            <Flame className="w-4 h-4" /> {actionLoadingId === ticket.id ? 'Accepting...' : t.acceptOrder}
                          </button>
                        )}

                        {isAccepted && (
                          <button
                            onClick={() => handleAdvanceStatus(ticket.id, 'accepted')}
                            disabled={actionLoadingId === ticket.id}
                            className={`w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-2xl transition cursor-pointer text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 ${
                              actionLoadingId === ticket.id ? 'opacity-60 cursor-wait' : ''
                            }`}
                          >
                            <Flame className="w-4 h-4" /> {actionLoadingId === ticket.id ? 'Starting...' : t.startCooking}
                          </button>
                        )}

                        {isCooking && (
                          <button
                            onClick={() => handleAdvanceStatus(ticket.id, 'cooking')}
                            disabled={actionLoadingId === ticket.id}
                            className={`w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-black py-2.5 rounded-2xl transition cursor-pointer text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-teal-500/20 ${
                              actionLoadingId === ticket.id ? 'opacity-60 cursor-wait' : ''
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" /> {actionLoadingId === ticket.id ? 'Updating...' : t.markReady}
                          </button>
                        )}

                        {isReady && (
                          <button
                            onClick={() => handleAdvanceStatus(ticket.id, 'ready_for_pickup')}
                            disabled={actionLoadingId === ticket.id}
                            className={`w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-2.5 rounded-2xl transition cursor-pointer text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 ${
                              actionLoadingId === ticket.id ? 'opacity-60 cursor-wait' : ''
                            }`}
                          >
                            <CheckCheck className="w-4 h-4" /> {actionLoadingId === ticket.id ? 'Completing...' : t.completeOrder}
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* Station Screen View */}
      {activeTab === 'station' && (
        <StationView
          tickets={activeDisplayTickets}
          stations={stations}
          lang={lang}
          onUpdateItemStatus={handleUpdateItemStatus}
          onUpdateStationStatus={handleUpdateStationStatus}
        />
      )}

      {/* Kitchen Analytics View */}
      {activeTab === 'analytics' && (
        <KitchenAnalyticsView
          tickets={activeDisplayTickets}
          stations={stations}
          wasteLogs={wasteLogs}
          lang={lang}
        />
      )}

      {/* Modal for Order Details & Waste Log */}
      {selectedTicketForModal && (
        <KitchenOrderDetailsModal
          ticket={selectedTicketForModal}
          lang={lang}
          onClose={() => setSelectedTicketForModal(null)}
          onUpdateStatus={async (tid, st) => {
            await controller.setTicketStatus(tid, st);
          }}
          onUpdatePriority={handleUpdatePriority}
          onUpdateItemStatus={handleUpdateItemStatus}
          onLogWaste={handleLogWaste}
        />
      )}

    </div>
  );
};
