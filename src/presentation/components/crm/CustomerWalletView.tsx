import React, { useState, useEffect } from 'react';
import { Customer, CustomerWallet, WalletTransaction, WalletPaymentMethod } from '../../../domain/entities/customer';
import { CustomerRepositoryImpl } from '../../../data/repositories/CustomerRepositoryImpl';
import {
  Wallet,
  PlusCircle,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  RefreshCw,
  X,
  CreditCard,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { validateWalletRecharge } from '../../../domain/validation/customerValidation';

interface CustomerWalletViewProps {
  initialCustomerId?: string;
}

const repo = new CustomerRepositoryImpl();

export const CustomerWalletView: React.FC<CustomerWalletViewProps> = ({ initialCustomerId }) => {
  const [wallets, setWallets] = useState<CustomerWallet[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [showRechargeModal, setShowRechargeModal] = useState(!!initialCustomerId);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || '');
  const [rechargeAmount, setRechargeAmount] = useState<number>(50);
  const [paymentMethod, setPaymentMethod] = useState<WalletPaymentMethod>('mobile_money');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [wList, txList, cList] = await Promise.all([
        repo.fetchCustomerWallets(),
        repo.fetchWalletTransactions(),
        repo.fetchCustomers()
      ]);
      setWallets(wList);
      setTransactions(txList);
      setCustomers(cList);

      if (!selectedCustomerId && cList.length > 0) {
        setSelectedCustomerId(cList[0].id);
      }
    } catch (err) {
      console.error('Error loading wallet data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRechargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setFormErrors({ customer: 'Please select a customer' });
      return;
    }

    const validation = validateWalletRecharge(rechargeAmount, paymentMethod);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    setSubmitting(true);
    try {
      await repo.rechargeWallet(
        selectedCustomerId,
        rechargeAmount,
        paymentMethod,
        referenceNumber,
        notes,
        'Cashier / Admin'
      );

      setShowRechargeModal(false);
      setRechargeAmount(50);
      setReferenceNumber('');
      setNotes('');
      loadData();
    } catch (err) {
      console.error('Error recharging wallet:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const totalSystemBalance = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);

  const filteredWallets = wallets.filter(w => {
    const q = (searchQuery || '').toLowerCase();
    return ((w.customerName || '').toLowerCase().includes(q)) || (w.customerId || '').includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2.5">
            <Wallet className="w-6 h-6 text-amber-400" />
            <span>Customer Digital Wallet System</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Prepaid customer balances, wallet recharges, store credit refunds, and payment ledger
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 text-right">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Total System Liability</span>
            <span className="text-lg font-black text-amber-400">${(totalSystemBalance || 0).toFixed(2)}</span>
          </div>

          <button
            onClick={() => setShowRechargeModal(true)}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Recharge Customer Wallet</span>
          </button>
        </div>
      </div>

      {/* Grid: Wallet Cards & Transaction Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer Wallet Accounts */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Customer Wallet Balances ({filteredWallets.length})
            </h3>
            <button onClick={loadData} className="text-xs text-slate-400 hover:text-white">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search wallet account..."
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredWallets.map((w) => (
              <div
                key={w.id}
                className="p-4 bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-2xl flex items-center justify-between transition group"
              >
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-amber-400 transition">
                    {w.customerName}
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">Updated: {new Date(w.updatedAt).toLocaleDateString()}</p>
                </div>

                <div className="text-right">
                  <span className="text-sm font-black text-amber-400 block">${(w.balance || 0).toFixed(2)}</span>
                  <button
                    onClick={() => {
                      setSelectedCustomerId(w.customerId);
                      setShowRechargeModal(true);
                    }}
                    className="text-[10px] font-bold text-emerald-400 hover:underline"
                  >
                    + Add Funds
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Full System Wallet Transaction Ledger */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <CreditCard className="w-4 h-4 text-amber-400" />
            <span>Master Wallet Transaction Ledger</span>
          </h3>

          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
              No wallet transactions recorded yet.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                        tx.amount >= 0
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {tx.amount >= 0 ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>

                    <div>
                      <h4 className="font-bold text-white">{tx.customerName}</h4>
                      <p className="text-[10px] text-slate-400">
                        <span className="capitalize font-semibold text-slate-300">{tx.type}</span> • Method: {tx.paymentMethod || 'Wallet'} • Ref: {tx.referenceNumber || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`font-black text-sm block ${
                        (tx.amount || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {(tx.amount || 0) >= 0 ? `+$${(tx.amount || 0).toFixed(2)}` : `-$${Math.abs(tx.amount || 0).toFixed(2)}`}
                    </span>
                    <span className="text-[10px] text-slate-500">{new Date(tx.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recharge Wallet Modal */}
      {showRechargeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-amber-400" />
                <span>Recharge Customer Digital Wallet</span>
              </h3>
              <button onClick={() => setShowRechargeModal(false)} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRechargeSubmit} className="space-y-4">
              {/* Select Customer */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Select Target Customer *</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.phone || 'No Phone'})
                    </option>
                  ))}
                </select>
                {formErrors.customer && <p className="text-[10px] text-rose-400 mt-1">{formErrors.customer}</p>}
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Recharge Amount ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-base font-black text-emerald-400 focus:outline-none focus:border-amber-500"
                />
                {formErrors.amount && <p className="text-[10px] text-rose-400 mt-1">{formErrors.amount}</p>}
              </div>

              {/* Payment Method */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Payment Collection Method *</label>
                <select
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="mobile_money">Mobile Money (EVC Plus / Zaad / Sahal)</option>
                  <option value="cash">Cash Payment</option>
                  <option value="card">Credit / Debit Card</option>
                  <option value="bank_transfer">Bank Wire Transfer</option>
                </select>
              </div>

              {/* Reference Number */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Reference / Transaction Code</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. EVC-9821829"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Notes / Reason</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Deposit notes..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRechargeModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Processing...' : 'Confirm Recharge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
