import React, { useState, useEffect } from 'react';
import { Customer, CustomerWallet, CustomerPoints, WalletTransaction } from '../../../domain/entities/customer';
import { CustomerRepositoryImpl } from '../../../data/repositories/CustomerRepositoryImpl';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Award,
  Wallet,
  ShoppingBag,
  Clock,
  TrendingUp,
  DollarSign,
  Send,
  PlusCircle,
  RotateCcw,
  XCircle,
  Heart,
  UserCheck,
  Globe,
  FileText
} from 'lucide-react';
import { CustomerMessagingModal } from './CustomerMessagingModal';

interface CustomerDetailsViewProps {
  customer: Customer;
  onBack: () => void;
  onOpenWalletModal: (customerId: string) => void;
}

const repo = new CustomerRepositoryImpl();

export const CustomerDetailsView: React.FC<CustomerDetailsViewProps> = ({
  customer,
  onBack,
  onOpenWalletModal
}) => {
  const [wallet, setWallet] = useState<CustomerWallet | null>(null);
  const [points, setPoints] = useState<CustomerPoints | null>(null);
  const [walletTxs, setWalletTxs] = useState<WalletTransaction[]>([]);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const [w, p, txs] = await Promise.all([
        repo.fetchCustomerWallet(customer.id),
        repo.fetchCustomerPoints(customer.id),
        repo.fetchWalletTransactions(customer.id)
      ]);
      setWallet(w);
      setPoints(p);
      setWalletTxs(txs);
    } catch (err) {
      console.error('Error loading customer details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [customer.id]);

  return (
    <div className="space-y-6">
      {/* Back Navigation & Main Customer Banner */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Customer Directory</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onOpenWalletModal(customer.id)}
            className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-bold flex items-center gap-2 cursor-pointer"
          >
            <Wallet className="w-4 h-4" />
            <span>Manage Wallet Balance</span>
          </button>

          <button
            onClick={() => setShowMessageModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Send Direct Message</span>
          </button>
        </div>
      </div>

      {/* Customer 360 Profile Hero Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-5">
            <img
              src={
                customer.profilePhoto ||
                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80'
              }
              alt={customer.fullName}
              className="w-20 h-20 rounded-3xl object-cover border-2 border-emerald-500/30 shadow-xl"
            />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-black text-white">{customer.fullName}</h1>
                <span className="px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  {customer.membershipLevel || 'Bronze Member'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-1 gap-x-4 text-xs text-slate-400 mt-2">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  {customer.phone || 'N/A'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  {customer.email || 'N/A'}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  {customer.city || 'Mogadishu'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Balance & Points Summary */}
          <div className="flex items-center gap-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
            <div className="px-4 text-center border-r border-slate-800">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Wallet Balance</span>
              <span className="text-lg font-black text-amber-400">${(wallet?.balance || 0).toFixed(2)}</span>
            </div>

            <div className="px-4 text-center">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest block">Loyalty Points</span>
              <span className="text-lg font-black text-purple-400">{points?.currentPointsBalance || 0} pts</span>
            </div>
          </div>
        </div>

        {/* 6 Key CRM Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Total Spending</span>
            <span className="text-base font-black text-emerald-400">${(customer.totalSpending || customer.totalSpent || 0).toFixed(2)}</span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Total Orders</span>
            <span className="text-base font-black text-white">{customer.totalOrders || 0}</span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Avg Order Value</span>
            <span className="text-base font-black text-blue-400">${(customer.averageOrderValue || 0).toFixed(2)}</span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Order Frequency</span>
            <span className="text-base font-black text-slate-200">Every {customer.orderFrequencyDays || 7} Days</span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Cancelled Orders</span>
            <span className="text-base font-black text-rose-400">{customer.cancelledOrders || 0}</span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Refund History</span>
            <span className="text-base font-black text-amber-400">{customer.refundHistoryCount || 0} Refunds</span>
          </div>
        </div>
      </div>

      {/* Grid Layout: Profile Information & Wallet Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Customer Demographic Info */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Demographics & Contact</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-500">Gender:</span>
                <span className="text-slate-200 capitalize font-medium">{customer.gender || 'Unspecified'}</span>
              </div>

              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-500">Date of Birth:</span>
                <span className="text-slate-200 font-medium">{customer.dateOfBirth || 'Not provided'}</span>
              </div>

              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-500">Preferred Language:</span>
                <span className="text-slate-200 font-medium uppercase">{customer.preferredLanguage || 'SO'}</span>
              </div>

              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-500">Registration Date:</span>
                <span className="text-slate-200 font-medium">
                  {customer.registrationDate ? new Date(customer.registrationDate).toLocaleDateString() : 'N/A'}
                </span>
              </div>

              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-500">Last Order Date:</span>
                <span className="text-slate-200 font-medium">
                  {customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString() : 'Never'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block mb-1">Delivery Address:</span>
                <span className="text-slate-200 font-medium block bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  {customer.address || 'No primary delivery address specified.'}
                </span>
              </div>

              {customer.notes && (
                <div>
                  <span className="text-slate-500 block mb-1">Preferences & Notes:</span>
                  <span className="text-amber-300 font-medium block bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-[11px]">
                    {customer.notes}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Favorite Products */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Heart className="w-4 h-4 text-rose-400" />
              <span>Favorite Products</span>
            </h3>

            {customer.favoriteProducts && customer.favoriteProducts.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {customer.favoriteProducts.map((p: any, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold"
                  >
                    {typeof p === 'string' ? p : p.productName}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No recorded favorite dishes yet.</p>
            )}
          </div>
        </div>

        {/* Right Columns: Wallet Activity Ledger & Recent Orders */}
        <div className="lg:col-span-2 space-y-6">
          {/* Wallet Ledger */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-amber-400" />
                <span>Wallet Transaction Ledger</span>
              </h3>
              <button
                onClick={() => onOpenWalletModal(customer.id)}
                className="text-xs text-emerald-400 hover:underline font-bold"
              >
                + Recharge
              </button>
            </div>

            {walletTxs.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No wallet transactions recorded for this customer.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {walletTxs.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <span className="font-bold text-white block capitalize">{tx.type} ({tx.paymentMethod || 'Wallet'})</span>
                      <span className="text-[10px] text-slate-500 block">
                        {new Date(tx.createdAt).toLocaleString()} • Ref: {tx.referenceNumber || 'N/A'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`font-black block text-xs ${
                          (tx.amount || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {(tx.amount || 0) >= 0 ? `+$${(tx.amount || 0).toFixed(2)}` : `-$${Math.abs(tx.amount || 0).toFixed(2)}`}
                      </span>
                      <span className="text-[10px] text-slate-500">Bal: ${(tx.balanceAfter || 0).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Last 20 Orders Summary Placeholder */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <ShoppingBag className="w-4 h-4 text-blue-400" />
              <span>Order History (Last 20 Orders)</span>
            </h3>

            <div className="p-8 text-center text-slate-500 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <Clock className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs font-semibold text-slate-400">Total Lifetime Orders Recorded: {customer.totalOrders || 0}</p>
              <p className="text-[11px] text-slate-500">All customer orders synchronized in real-time with POS Order Pipeline.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Send Direct Message Modal */}
      {showMessageModal && (
        <CustomerMessagingModal
          customer={customer}
          onClose={() => setShowMessageModal(false)}
          onSent={loadDetails}
        />
      )}
    </div>
  );
};
