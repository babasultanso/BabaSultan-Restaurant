import React, { useState } from 'react';
import { KitchenTicket, KitchenStation, KitchenStationType, KitchenPrepStatus } from '../../../domain/entities/kitchen';
import { kdsDict, KitchenLang } from './translations';
import {
  Flame,
  CheckCircle2,
  Clock,
  User,
  Utensils,
  Layers,
  AlertCircle,
  ChefHat,
  Sparkles,
  CheckCheck
} from 'lucide-react';

interface StationViewProps {
  tickets: KitchenTicket[];
  stations: KitchenStation[];
  lang: KitchenLang;
  onUpdateItemStatus: (ticketId: string, productId: string, itemStatus: KitchenPrepStatus) => Promise<void>;
  onUpdateStationStatus: (stationId: string, status: 'normal' | 'busy' | 'overloaded', chefName?: string) => Promise<void>;
}

export const StationView: React.FC<StationViewProps> = ({
  tickets,
  stations,
  lang,
  onUpdateItemStatus,
  onUpdateStationStatus
}) => {
  const t = kdsDict[lang] || kdsDict.en;
  const isRtl = lang === 'ar';

  const [selectedStationType, setSelectedStationType] = useState<KitchenStationType>('grill');

  const currentStation = stations.find(s => s.stationType === selectedStationType) || {
    id: 'st_1',
    name: 'Grill Station',
    stationType: 'grill' as KitchenStationType,
    assignedChef: 'Chef Youssef Hassan',
    activeOrdersCount: 0,
    completedOrdersToday: 30,
    avgPrepTimeMinutes: 14,
    status: 'normal' as const,
    supportedCategories: []
  };

  // Filter tickets that contain items assigned to this station and are not completed/cancelled
  const activeStationTickets = tickets.filter(ticket => {
    if (ticket.prepStatus === 'completed' || ticket.prepStatus === 'cancelled') return false;
    return ticket.items.some(item => item.assignedStation === selectedStationType);
  });

  const getStationColor = (type: KitchenStationType) => {
    switch (type) {
      case 'grill':
        return 'from-amber-600 to-orange-700 text-amber-400 border-amber-500/30';
      case 'pizza':
        return 'from-rose-600 to-red-700 text-rose-400 border-rose-500/30';
      case 'drinks':
        return 'from-cyan-600 to-blue-700 text-cyan-400 border-cyan-500/30';
      case 'dessert':
        return 'from-pink-600 to-purple-700 text-pink-400 border-pink-500/30';
      case 'packing':
        return 'from-emerald-600 to-teal-700 text-emerald-400 border-emerald-500/30';
      default:
        return 'from-slate-700 to-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-6">
      
      {/* Station Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-900 p-2 rounded-2xl border border-slate-800">
        {(['grill', 'pizza', 'drinks', 'dessert', 'packing'] as KitchenStationType[]).map((stType) => {
          const stObj = stations.find(s => s.stationType === stType);
          const active = selectedStationType === stType;
          const labelKey = stType === 'grill' ? 'grillStation' : stType === 'pizza' ? 'pizzaStation' : stType === 'drinks' ? 'drinksStation' : stType === 'dessert' ? 'dessertStation' : 'packingStation';
          
          const stationItemCount = tickets.filter(
            t => t.prepStatus !== 'completed' && t.prepStatus !== 'cancelled' && t.items.some(i => i.assignedStation === stType && i.itemStatus !== 'completed' && i.itemStatus !== 'ready_for_pickup')
          ).length;

          return (
            <button
              key={stType}
              onClick={() => setSelectedStationType(stType)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-extrabold transition cursor-pointer border ${
                active
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              <ChefHat className="w-4 h-4" />
              <span>{t[labelKey] || stType}</span>
              {stationItemCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  active ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {stationItemCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Station Banner & Status Control */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-2xl bg-gradient-to-br ${getStationColor(selectedStationType)} border shadow-lg`}>
            <ChefHat className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-extrabold text-white">{currentStation.name}</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
                currentStation.status === 'overloaded'
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse'
                  : currentStation.status === 'busy'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}>
                {currentStation.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <span>Assigned Chef: <strong className="text-amber-400">{currentStation.assignedChef || 'Line Chef'}</strong></span>
              <span>• Avg Prep: <strong className="text-white">{currentStation.avgPrepTimeMinutes ? `${currentStation.avgPrepTimeMinutes} mins` : 'N/A'}</strong></span>
            </p>
          </div>
        </div>

        {/* Quick Status Toggle */}
        <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800 text-xs">
          <span className="text-slate-400 font-semibold px-2">Station Load:</span>
          {(['normal', 'busy', 'overloaded'] as const).map((st) => (
            <button
              key={st}
              onClick={() => onUpdateStationStatus(currentStation.id, st)}
              className={`px-3 py-1.5 rounded-xl font-bold uppercase transition cursor-pointer text-[10px] ${
                currentStation.status === st
                  ? st === 'overloaded'
                    ? 'bg-rose-500 text-white'
                    : st === 'busy'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Station Tickets Board */}
      {activeStationTickets.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500 space-y-3">
          <Utensils className="w-12 h-12 mx-auto text-slate-700" />
          <h4 className="text-base font-bold text-slate-300">No Active Items for {currentStation.name}!</h4>
          <p className="text-xs">All dish items assigned to this station are prepared or cleared.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeStationTickets.map(ticket => {
            const stationItems = ticket.items.filter(i => i.assignedStation === selectedStationType);
            const elapsedMins = Math.floor((Date.now() - new Date(ticket.orderTime).getTime()) / 60000);

            return (
              <div
                key={ticket.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Ticket Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-white text-base">#{ticket.orderNumber}</span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-amber-400">
                          {(ticket.orderType || 'dine_in').replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {ticket.customerName} {ticket.tableNumber ? `• Table ${ticket.tableNumber}` : ''}
                      </p>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                      elapsedMins >= 15
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      <Clock className="w-3 h-3" /> {elapsedMins}m
                    </span>
                  </div>

                  {/* Station Specific Items */}
                  <div className="space-y-2">
                    {stationItems.map((item, idx) => {
                      const isReady = item.itemStatus === 'ready_for_pickup' || item.itemStatus === 'completed';
                      const isCooking = item.itemStatus === 'cooking';

                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-2xl border transition text-xs space-y-2 ${
                            isReady
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : isCooking
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

                          {/* Item Action Controls */}
                          <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
                            {item.itemStatus === 'new' && (
                              ticket.prepStatus === 'new' ? (
                                <button
                                  disabled
                                  title="Order must be accepted in Queue before cooking items"
                                  className="w-full bg-slate-800/80 text-slate-500 border border-slate-700/50 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 cursor-not-allowed opacity-75"
                                >
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-500/70" /> Accept Order First
                                </button>
                              ) : (
                                <button
                                  onClick={() => onUpdateItemStatus(ticket.id, item.productId, 'cooking')}
                                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2 rounded-xl transition cursor-pointer text-xs flex items-center justify-center gap-1 shadow-md"
                                >
                                  <Flame className="w-3.5 h-3.5" /> Start Cooking
                                </button>
                              )
                            )}

                            {item.itemStatus === 'cooking' && (
                              <button
                                onClick={() => onUpdateItemStatus(ticket.id, item.productId, 'ready_for_pickup')}
                                className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-black py-2 rounded-xl transition cursor-pointer text-xs flex items-center justify-center gap-1 shadow-md"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Mark Item Ready
                              </button>
                            )}

                            {isReady && (
                              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 py-1">
                                <CheckCheck className="w-4 h-4" /> Dish Ready
                              </span>
                            )}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
