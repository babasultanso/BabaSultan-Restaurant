import React, { useState, useEffect } from 'react';
import { CustomerAnalyticsData } from '../../../domain/entities/customer';
import { CustomerRepositoryImpl } from '../../../data/repositories/CustomerRepositoryImpl';
import {
  BarChart3,
  Users,
  TrendingUp,
  UserCheck,
  UserMinus,
  Wallet,
  Crown,
  Award,
  DollarSign,
  RefreshCw
} from 'lucide-react';

const repo = new CustomerRepositoryImpl();

export const CRMAnalyticsView: React.FC = () => {
  const [analytics, setAnalytics] = useState<CustomerAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await repo.getAnalyticsData();
      setAnalytics(data);
    } catch (err) {
      console.error('Error loading CRM analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-3xl">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-2" />
        <p className="text-xs">Computing CRM Intelligence & Customer Lifetime Metrics...</p>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-5 rounded-3xl">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            <span>CRM & Customer Retention Intelligence</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Customer Growth, Churn Rate, Lifetime Value (CLV), and VIP Spending Performance
          </p>
        </div>

        <button
          onClick={loadAnalytics}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4 text-emerald-400" />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* 6 Metric Highlight Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Customers</span>
          <span className="text-xl font-black text-white">{analytics.totalCustomers}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Active Members</span>
          <span className="text-xl font-black text-emerald-400">{analytics.activeCustomers}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Retention Rate</span>
          <span className="text-xl font-black text-blue-400">{(analytics.retentionRate || 0).toFixed(1)}%</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Churn Rate</span>
          <span className="text-xl font-black text-rose-400">{(analytics.churnRate || 0).toFixed(1)}%</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Wallet Balance</span>
          <span className="text-xl font-black text-amber-400">${(analytics.totalWalletBalance || 0).toFixed(2)}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Avg CLV</span>
          <span className="text-xl font-black text-purple-400">${(analytics.avgCustomerLifetimeValue || 0).toFixed(2)}</span>
        </div>
      </div>

      {/* Top 5 Spending VIP Customers Ranking Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <Crown className="w-4 h-4 text-amber-400" />
          <span>Top 5 Highest Lifetime Spending Customers</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Customer Name</th>
                <th className="py-2.5 px-3">Loyalty Tier</th>
                <th className="py-2.5 px-3">Phone Number</th>
                <th className="py-2.5 px-3">Total Orders</th>
                <th className="py-2.5 px-3 text-right">Lifetime Spending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {analytics.topCustomers.map((c, index) => (
                <tr key={c.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-extrabold text-[10px] flex items-center justify-center">
                      #{index + 1}
                    </span>
                    <span>{c.fullName}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                      {c.membershipLevel || 'Bronze'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-400">{c.phone || 'N/A'}</td>
                  <td className="py-3 px-3 text-slate-300 font-semibold">{c.totalOrders || 0} orders</td>
                  <td className="py-3 px-3 text-right font-black text-emerald-400">
                    ${(c.totalSpending || c.totalSpent || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
