import React, { useState, useEffect } from 'react';
import { DiningTable, Order } from '../../../types';
import { fetchTablesFirestore, updateTableStatusFirestore } from '../../../lib/firebase';
import {
  Utensils,
  CheckCircle2,
  Users,
  Layers,
  Split,
  Plus,
  X,
  AlertCircle
} from 'lucide-react';

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

  // Split Bill Modal State
  const [splitModalTable, setSplitModalTable] = useState<DiningTable | null>(null);
  const [splitCount, setSplitCount] = useState<number>(2);

  const loadTables = () => {
    setIsLoading(true);
    fetchTablesFirestore()
      .then(res => setTables(res))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadTables();
  }, []);

  const sections = ['all', 'indoor', 'terrace', 'vip', 'patio'];

  const filteredTables = tables.filter(
    t => selectedSection === 'all' || (t.section || '').toLowerCase() === (selectedSection || '').toLowerCase()
  );

  const handleToggleStatus = async (table: DiningTable) => {
    const nextStatus = table.status === 'available' ? 'occupied' : 'available';
    try {
      await updateTableStatusFirestore(table.tableNumber, nextStatus);
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
            Dining Room & Table Layout
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time table occupation status, seating capacity & bill splitting
          </p>
        </div>

        {/* Section Tabs */}
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
              {sec}
            </button>
          ))}
        </div>
      </div>

      {/* Tables Grid */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-500">Loading table floor plan...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredTables.map(tbl => {
            const isOccupied = tbl.status === 'occupied';
            const isReserved = tbl.status === 'reserved';
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
                      {tbl.section}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      isOccupied
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : isReserved
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {tbl.status}
                    </span>
                  </div>

                  <div className="mt-3 text-center space-y-1">
                    <h4 className="text-xl font-extrabold text-white">{tbl.tableNumber}</h4>
                    <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{tbl.capacity} Seats</span>
                    </div>
                  </div>

                  {linkedOrder && (
                    <div className="mt-2 bg-slate-950 p-2 rounded-2xl border border-slate-800 text-center text-xs">
                      <span className="text-slate-400 text-[10px] block">Order #{linkedOrder.orderNumber}</span>
                      <span className="font-extrabold text-emerald-400">${(linkedOrder.totalAmount || 0).toFixed(2)}</span>
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
                    {isOccupied ? 'Release Table' : 'Mark Occupied'}
                  </button>

                  {isOccupied && linkedOrder && (
                    <button
                      onClick={() => setSplitModalTable(tbl)}
                      className="w-full py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-emerald-400 text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Split className="w-3 h-3" />
                      <span>Split Bill</span>
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
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/30">
                <Split className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Split Bill — Table {splitModalTable.tableNumber}</h4>
                <p className="text-xs text-slate-400">Calculate equal payments per guest</p>
              </div>
            </div>

            {(() => {
              const order = orders.find(o => o.tableNumber === splitModalTable.tableNumber || o.id === splitModalTable.currentOrderId);
              const total = order ? order.totalAmount : 0;
              const perGuest = total / splitCount;

              return (
                <div className="space-y-4 text-xs">
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1 text-center">
                    <span className="text-slate-400 text-[10px]">Total Order Amount</span>
                    <div className="text-2xl font-extrabold text-white">${(total || 0).toFixed(2)}</div>
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Number of Guests / Pays</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSplitCount(c => Math.max(2, c - 1))}
                        className="p-2 bg-slate-800 rounded-xl text-white font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="flex-1 text-center font-extrabold text-emerald-400 text-sm bg-slate-950 py-2 rounded-xl border border-slate-800">
                        {splitCount} Guests
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
                    <span className="text-emerald-400 text-[10px] font-bold uppercase">Each Guest Pays</span>
                    <div className="text-2xl font-extrabold text-emerald-400">${(perGuest || 0).toFixed(2)}</div>
                  </div>

                  <button
                    onClick={() => {
                      alert(`Bill split calculated: ${splitCount} payments of $${perGuest.toFixed(2)} each.`);
                      setSplitModalTable(null);
                    }}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-3 rounded-2xl text-xs transition cursor-pointer"
                  >
                    Confirm Split Calculation
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

    </div>
  );
};
