import React, { useState } from 'react';
import { Expense, Order } from '../../types';
import { FinancialsRepositoryImpl } from '../../data/repositories/FinancialsRepositoryImpl';
import { useAuth } from '../context/AuthContext';
import { exportToExcel } from '../../lib/reports';
import {
  DollarSign,
  TrendingUp,
  PlusCircle,
  Download,
  X,
  Building2,
  PieChart,
  Receipt,
  FileCheck2
} from 'lucide-react';

interface FinancialsViewProps {
  expenses: Expense[];
  orders: Order[];
  onRefresh?: () => void;
}

const finRepo = new FinancialsRepositoryImpl();

export const FinancialsView: React.FC<FinancialsViewProps> = ({
  expenses,
  orders,
  onRefresh
}) => {
  const { user } = useAuth();
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [amount, setAmount] = useState<number>(150);
  const [category, setCategory] = useState<string>('Utilities');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Financial calculations
  const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalCOGS = orders.reduce((sum, o) => sum + (o.cogs || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses - totalCOGS;
  const margin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await finRepo.createExpense({
        title,
        amount,
        category,
        description,
        createdBy: user?.displayName || 'Finance Manager'
      });
      setIsAddExpenseOpen(false);
      setTitle('');
      setDescription('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Expense creation error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportExcel = () => {
    const cols = ["Expense Title", "Amount ($)", "Category", "Description", "Logged By", "Date"];
    const rows = expenses.map(e => [
      e.title,
      e.amount.toFixed(2),
      e.category,
      e.description || '-',
      e.createdBy || 'Finance',
      new Date(e.createdAt).toLocaleString()
    ]);
    exportToExcel('Restaurant_Operational_Expenses', cols, rows);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Export Bar */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            Financial Ledgers & P&L Statement
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            General ledger accounting, cash flow, operational expense logging & profit margins
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddExpenseOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-2xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            Log Operational Expense
          </button>
          <button
            onClick={handleExportExcel}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-2xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Export Ledger
          </button>
        </div>
      </div>

      {/* Financial Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Gross Sales</span>
          <h3 className="text-2xl font-extrabold text-white mt-2">${totalRevenue.toFixed(2)}</h3>
          <p className="text-[10px] text-emerald-400 mt-1">From POS & Online Orders</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Kitchen COGS</span>
          <h3 className="text-2xl font-extrabold text-white mt-2">${totalCOGS.toFixed(2)}</h3>
          <p className="text-[10px] text-slate-400 mt-1">Raw Food Ingredients Cost</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Operating Expenses</span>
          <h3 className="text-2xl font-extrabold text-amber-400 mt-2">${totalExpenses.toFixed(2)}</h3>
          <p className="text-[10px] text-slate-400 mt-1">Utilities, Rent & Supplies</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Net Profit & Margin</span>
          <h3 className={`text-2xl font-extrabold mt-2 ${netProfit >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
            ${netProfit.toFixed(2)}
          </h3>
          <p className="text-[10px] text-teal-400 mt-1">{margin}% Net Profit Margin</p>
        </div>
      </div>

      {/* Expenses Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            Recorded Operating Expense Transactions
          </h3>
          <span className="text-xs text-slate-400 font-mono">{expenses.length} entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-4 px-6">Expense Title</th>
                <th className="py-4 px-6">Category</th>
                <th className="py-4 px-6">Amount ($)</th>
                <th className="py-4 px-6">Description</th>
                <th className="py-4 px-6">Logged By</th>
                <th className="py-4 px-6 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No operating expenses recorded yet. Click "Log Operational Expense" to add one.
                  </td>
                </tr>
              ) : (
                expenses.map(e => (
                  <tr key={e.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-4 px-6 font-bold text-white">{e.title}</td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-full font-mono">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-extrabold text-amber-400">${e.amount.toFixed(2)}</td>
                    <td className="py-4 px-6 text-slate-400">{e.description || '-'}</td>
                    <td className="py-4 px-6 text-slate-300">{e.createdBy || 'Staff'}</td>
                    <td className="py-4 px-6 text-right text-slate-500">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateExpense} className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative text-xs">
            <button type="button" onClick={() => setIsAddExpenseOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white">Log Operational Expense</h3>

            <div className="space-y-3">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Expense Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly Electricity Bill / Kitchen Maintenance"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="Utilities">Utilities</option>
                    <option value="Rent & Lease">Rent & Lease</option>
                    <option value="Kitchen Supplies">Kitchen Supplies</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Equipment Repair">Equipment Repair</option>
                    <option value="Licenses & Permits">Licenses & Permits</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Additional context or invoice ref number..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-3 rounded-xl transition cursor-pointer"
            >
              {isSubmitting ? 'Recording Expense...' : 'Save Expense to Ledger'}
            </button>
          </form>
        </div>
      )}

    </div>
  );
};
