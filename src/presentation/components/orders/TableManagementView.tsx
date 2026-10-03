import React, { useState, useEffect } from 'react';
import { translateRawUi } from '../../../i18n';
import { DiningTable, Order } from '../../../types';
import { useAuth } from '../../context/AuthContext';
import { fetchTablesFirestore, updateTableStatusFirestore, getAuthToken, getApiUrl } from '../../../lib/firebase';
import { getMogadishuDateString } from '../../../lib/dateUtils';
import {
  Utensils,
  CheckCircle2,
  Users,
  Layers,
  Split,
  Plus,
  X,
  AlertCircle,
  Calendar,
  Clock,
  Phone
} from 'lucide-react';

interface TableReservation {
  id: string;
  reservationCode: string;
  customerName: string;
  customerPhone: string;
  tableNumber: number;
  partySize: number;
  reservationDate: string;
  reservationTime: string;
  durationMinutes: number;
  status: 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  branchId?: string;
  createdBy?: string;
  createdAt: string;
}

interface TableManagementViewProps {
  orders: Order[];
  onOpenOrderModal?: (order: Order) => void;
}

export const TableManagementView: React.FC<TableManagementViewProps> = ({
  orders,
  onOpenOrderModal
}) => {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { userRecord, t} = useAuth();
  const currentBranchId = userRecord?.branchId || '';

  // Split Bill Modal State
  const [splitModalTable, setSplitModalTable] = useState<DiningTable | null>(null);
  const [splitCount, setSplitCount] = useState<number>(2);

  // Reservations State
  const [reservations, setReservations] = useState<TableReservation[]>([]);
  const [selectedResDate, setSelectedResDate] = useState<string>(getMogadishuDateString());
  const [isResModalOpen, setIsResModalOpen] = useState<boolean>(false);
  const [resCustomerName, setResCustomerName] = useState<string>('');
  const [resCustomerPhone, setResCustomerPhone] = useState<string>('');
  const [resTableNumber, setResTableNumber] = useState<number>(1);
  const [resPartySize, setResPartySize] = useState<number>(2);
  const [resDate, setResDate] = useState<string>(getMogadishuDateString());
  const [resTime, setResTime] = useState<string>('19:00');
  const [resDuration, setResDuration] = useState<number>(90);
  const [resNotes, setResNotes] = useState<string>('');
  const [isSubmittingRes, setIsSubmittingRes] = useState<boolean>(false);

  const loadReservations = async () => {
    try {
      const token = await getAuthToken();
      const q = currentBranchId ? `?branchId=${encodeURIComponent(currentBranchId)}` : '';
      const resp = await fetch(getApiUrl(`/api/reservations${q}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (resp.ok) {
        const data = await resp.json();
        setReservations(Array.isArray(data.reservations) ? data.reservations : []);
      }
    } catch (e) {
      console.warn('Failed to load table reservations:', e);
    }
  };

  const loadTables = () => {
    setIsLoading(true);
    fetchTablesFirestore(currentBranchId)
      .then(res => setTables(res))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadTables();
    loadReservations();
  }, [currentBranchId]);

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resCustomerName.trim()) return;
    setIsSubmittingRes(true);
    try {
      const token = await getAuthToken();
      const idempotencyKey = `res-create:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const resp = await fetch(getApiUrl('/api/reservations'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          reservationData: {
            customerName: resCustomerName.trim(),
            customerPhone: resCustomerPhone.trim(),
            tableNumber: Number(resTableNumber),
            partySize: Number(resPartySize),
            reservationDate: resDate,
            reservationTime: resTime,
            durationMinutes: Number(resDuration),
            notes: resNotes.trim(),
            branchId: currentBranchId || undefined
          },
          idempotencyKey
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || `Failed to create reservation (${resp.status})`);
      }
      setIsResModalOpen(false);
      setResCustomerName('');
      setResCustomerPhone('');
      setResNotes('');
      await loadReservations();
    } catch (err: any) {
      alert(err?.message || 'Failed to create table reservation.');
    } finally {
      setIsSubmittingRes(false);
    }
  };

  const handleUpdateReservationStatus = async (resItem: TableReservation, nextStatus: TableReservation['status']) => {
    try {
      const token = await getAuthToken();
      const idempotencyKey = `res-status:${resItem.id}:${nextStatus}:${Date.now()}`;
      const resp = await fetch(getApiUrl(`/api/reservations/${encodeURIComponent(resItem.id)}/status`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ status: nextStatus, idempotencyKey })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.error || `Failed to update reservation status (${resp.status})`);
      }
      if (nextStatus === 'seated') {
        const tblLabel = `T-${resItem.tableNumber}`;
        const matchTbl = tables.find(t => t.tableNumber === tblLabel || String(t.tableNumber) === String(resItem.tableNumber));
        if (matchTbl && matchTbl.status !== 'occupied') {
          await updateTableStatusFirestore(matchTbl.tableNumber, 'occupied', undefined, currentBranchId).catch(() => {});
          loadTables();
        }
      }
      await loadReservations();
    } catch (err: any) {
      alert(err?.message || 'Failed to update reservation status.');
    }
  };

  const sections = ['all', 'indoor', 'terrace', 'vip', 'patio'];
  const sectionLabelKeys: Record<string, string> = {
    all: 'All',
    indoor: 'Indoor',
    terrace: 'Terrace',
    vip: 'VIP',
    patio: 'Patio'
  };

  const filteredTables = tables.filter(
    t => selectedSection === 'all' || (t.section || '').toLowerCase() === (selectedSection || '').toLowerCase()
  );

  const handleToggleStatus = async (table: DiningTable) => {
    // Check if table has an active uncompleted order
    const linkedOrder = orders.find(
      o => (o.id === table.currentOrderId || o.tableNumber === table.tableNumber) &&
           o.status !== 'completed' && o.status !== 'cancelled'
    );

    if (table.status === 'occupied' && linkedOrder && linkedOrder.paymentStatus !== 'paid') {
      alert(`${translateRawUi('Cannot release or change table status while order')} #${linkedOrder.orderNumber} ${translateRawUi('is active and unpaid.')}`);
      return;
    }

    const nextStatus = table.status === 'occupied' ? 'available' : 'occupied';
    try {
      await updateTableStatusFirestore(table.tableNumber, nextStatus, nextStatus === 'occupied' ? table.currentOrderId : undefined, currentBranchId);
      loadTables();
    } catch (err: any) {
      alert(`Failed to update table status: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Table Management Top Banner */}
      <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Utensils className="w-5 h-5 text-emerald-400" />
            {translateRawUi('Dining Room & Table Layout')}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {translateRawUi('Real-time table occupation status, seating capacity & bill splitting')}
          </p>
        </div>

        {/* Section Tabs & Book Reservation Button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs overflow-x-auto">
            {sections.map(sec => (
              <button
                key={sec}
                onClick={() => setSelectedSection(sec)}
                className={`px-3 py-1.5 rounded-xl font-bold capitalize transition cursor-pointer ${
                  selectedSection === sec
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {translateRawUi(sectionLabelKeys[sec] || sec)}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsResModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-4 py-2 rounded-2xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
          >
            <Calendar className="w-4 h-4" />
            <span>{translateRawUi('New Reservation')}</span>
          </button>
        </div>
      </div>

      {/* Tables Grid */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-500">{t.legacyUi.loadingFloorPlan}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredTables.map(tbl => {
            const isOccupied = tbl.status === 'occupied';
            const tblNumInt = parseInt(String(tbl.tableNumber).replace(/\D/g, ''), 10);
            const activeRes = reservations.find(
              r =>
                r.reservationDate === selectedResDate &&
                (r.status === 'confirmed' || r.status === 'seated') &&
                Number(r.tableNumber) === tblNumInt
            );
            const isReserved = tbl.status === 'reserved' || Boolean(activeRes && !isOccupied);
            const linkedOrder = orders.find(o => o.id === tbl.currentOrderId || o.tableNumber === tbl.tableNumber);

            return (
              <div
                key={tbl.id}
                className={`p-4 rounded-3xl border transition flex flex-col justify-between space-y-3 relative group ${
                  isOccupied
                    ? 'bg-rose-500/10 border-rose-500/40 text-white'
                    : isReserved
                    ? 'bg-amber-500/10 border-amber-500/40 text-white'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {translateRawUi(sectionLabelKeys[tbl.section?.toLowerCase()] || tbl.section)}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      isOccupied
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : isReserved
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {translateRawUi(tbl.status)}
                    </span>
                  </div>

                  <div className="mt-3 text-center space-y-1">
                    <h4 className="text-xl font-extrabold text-white">{tbl.tableNumber}</h4>
                    <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{tbl.capacity} {translateRawUi('Seats')}</span>
                    </div>
                  </div>

                  {linkedOrder && (
                    <div className="mt-2 bg-slate-950 p-2 rounded-2xl border border-slate-800 text-center text-xs">
                      <span className="text-slate-400 text-[10px] block">{translateRawUi('Order')} #{linkedOrder.orderNumber}</span>
                      <span className="font-extrabold text-emerald-400">${(linkedOrder.totalAmount || 0).toFixed(2)}</span>
                    </div>
                  )}

                  {activeRes && (
                    <div className="mt-2 bg-amber-500/10 p-2 rounded-2xl border border-amber-500/30 text-center text-[11px]">
                      <span className="text-amber-300 font-bold block truncate">{activeRes.customerName}</span>
                      <span className="font-mono text-amber-400 text-[10px]">{activeRes.reservationTime} • {activeRes.partySize}p</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                  <button
                    onClick={() => handleToggleStatus(tbl)}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isOccupied
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    {isOccupied ? translateRawUi('Release Table') : translateRawUi('Mark Occupied')}
                  </button>

                  {isOccupied && linkedOrder && (
                    <button
                      onClick={() => setSplitModalTable(tbl)}
                      className="w-full py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-emerald-400 text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Split className="w-3 h-3" />
                      <span>{translateRawUi('Split Bill')}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Split Bill Modal */}
      {splitModalTable && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative text-slate-100">
            <button
              onClick={() => setSplitModalTable(null)}
              className="absolute end-4 top-4 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/30">
                <Split className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">{translateRawUi('Split Bill')} — {translateRawUi('Table')} {splitModalTable.tableNumber}</h4>
                <p className="text-xs text-slate-400">{t.legacyUi.calculateEqualGuestPayments}</p>
              </div>
            </div>

            {(() => {
              const order = orders.find(o => o.tableNumber === splitModalTable.tableNumber || o.id === splitModalTable.currentOrderId);
              const total = order ? order.totalAmount : 0;
              const perGuest = total / splitCount;

              return (
                <div className="space-y-4 text-xs">
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1 text-center">
                    <span className="text-slate-400 text-[10px]">{translateRawUi('Total Order Amount')}</span>
                    <div className="text-2xl font-extrabold text-white">${(total || 0).toFixed(2)}</div>
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">{translateRawUi('Number of Guests / Pays')}</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSplitCount(c => Math.max(2, c - 1))}
                        className="p-2 bg-slate-800 rounded-xl text-white font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="flex-1 text-center font-extrabold text-emerald-400 text-sm bg-slate-950 py-2 rounded-xl border border-slate-800">
                        {splitCount} {translateRawUi('Guests')}
                      </span>
                      <button
                        onClick={() => setSplitCount(c => c + 1)}
                        className="p-2 bg-slate-800 rounded-xl text-white font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/30 text-center space-y-0.5">
                    <span className="text-emerald-400 text-[10px] font-bold uppercase">{t.legacyUi.eachGuestPays}</span>
                    <div className="text-2xl font-extrabold text-emerald-400">${(perGuest || 0).toFixed(2)}</div>
                  </div>

                  <button
                    onClick={() => {
                      alert(`Bill split calculated: ${splitCount} payments of $${perGuest.toFixed(2)} each.`);
                      setSplitModalTable(null);
                    }}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-3 rounded-2xl text-xs transition cursor-pointer"
                  >
                    {translateRawUi('Confirm Split Calculation')}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Table Reservations & Floor Booking Queue */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              {translateRawUi('Table Reservations & Floor Booking Schedule')}
            </h4>
            <p className="text-xs text-slate-400">
              {translateRawUi('Conflict-checked dining room bookings with time-window enforcement and instant guest seating.')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedResDate}
              onChange={(e) => setSelectedResDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
            />
            <button
              onClick={() => setIsResModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> {translateRawUi('Book Table')}
            </button>
          </div>
        </div>

        {reservations.filter(r => !selectedResDate || r.reservationDate === selectedResDate).length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            {translateRawUi('No table reservations scheduled for')} {selectedResDate}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">{translateRawUi('Code')}</th>
                  <th className="py-3 px-4">{translateRawUi('Guest')}</th>
                  <th className="py-3 px-4">{translateRawUi('Table')}</th>
                  <th className="py-3 px-4">{translateRawUi('Party')}</th>
                  <th className="py-3 px-4">{translateRawUi('Date & Time')}</th>
                  <th className="py-3 px-4">{translateRawUi('Status')}</th>
                  <th className="py-3 px-4 text-right">{translateRawUi('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {reservations
                  .filter(r => !selectedResDate || r.reservationDate === selectedResDate)
                  .map((resItem) => (
                    <tr key={resItem.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-amber-400">{resItem.reservationCode}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-white block">{resItem.customerName}</span>
                        {resItem.customerPhone && (
                          <span className="text-[10px] text-slate-400 font-mono">{resItem.customerPhone}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-extrabold text-emerald-400">T-{resItem.tableNumber}</td>
                      <td className="py-3 px-4 font-bold">{resItem.partySize} {translateRawUi('Guests')}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {resItem.reservationDate} • {resItem.reservationTime} ({resItem.durationMinutes}m)
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          resItem.status === 'confirmed'
                            ? 'bg-amber-500/20 text-amber-300'
                            : resItem.status === 'seated'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : resItem.status === 'completed'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {resItem.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        {resItem.status === 'confirmed' && (
                          <>
                            <button
                              onClick={() => handleUpdateReservationStatus(resItem, 'seated')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] cursor-pointer"
                            >
                              {translateRawUi('Seat Guest')}
                            </button>
                            <button
                              onClick={() => handleUpdateReservationStatus(resItem, 'cancelled')}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-[10px] cursor-pointer"
                            >
                              {translateRawUi('Cancel')}
                            </button>
                          </>
                        )}
                        {resItem.status === 'seated' && (
                          <button
                            onClick={() => handleUpdateReservationStatus(resItem, 'completed')}
                            className="px-2.5 py-1 rounded-lg bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold text-[10px] cursor-pointer"
                          >
                            {translateRawUi('Complete')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Table Reservation Modal */}
      {isResModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative text-slate-100">
            <button
              onClick={() => setIsResModalOpen(false)}
              className="absolute end-4 top-4 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/30">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">{translateRawUi('Book Table Reservation')}</h4>
                <p className="text-xs text-slate-400">{translateRawUi('Reserve dining table with time-slot conflict check')}</p>
              </div>
            </div>

            <form onSubmit={handleCreateReservation} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{translateRawUi('Guest Name *')}</label>
                  <input
                    type="text"
                    required
                    value={resCustomerName}
                    onChange={(e) => setResCustomerName(e.target.value)}
                    placeholder={translateRawUi('Full Name')}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{translateRawUi('Phone Number')}</label>
                  <input
                    type="text"
                    value={resCustomerPhone}
                    onChange={(e) => setResCustomerPhone(e.target.value)}
                    placeholder="+252..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{translateRawUi('Table # *')}</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="50"
                    value={resTableNumber}
                    onChange={(e) => setResTableNumber(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{translateRawUi('Party Size *')}</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="30"
                    value={resPartySize}
                    onChange={(e) => setResPartySize(parseInt(e.target.value, 10) || 2)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{translateRawUi('Duration (m)')}</label>
                  <input
                    type="number"
                    required
                    min="30"
                    max="360"
                    step="15"
                    value={resDuration}
                    onChange={(e) => setResDuration(parseInt(e.target.value, 10) || 90)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{translateRawUi('Reservation Date *')}</label>
                  <input
                    type="date"
                    required
                    value={resDate}
                    onChange={(e) => setResDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{translateRawUi('Arrival Time *')}</label>
                  <input
                    type="time"
                    required
                    value={resTime}
                    onChange={(e) => setResTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">{translateRawUi('Special Requests / VIP Notes')}</label>
                <input
                  type="text"
                  value={resNotes}
                  onChange={(e) => setResNotes(e.target.value)}
                  placeholder={translateRawUi('e.g. Window table, birthday dinner, high chair')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsResModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  {translateRawUi('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRes}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold cursor-pointer"
                >
                  {isSubmittingRes ? translateRawUi('Booking...') : translateRawUi('Confirm Reservation')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
