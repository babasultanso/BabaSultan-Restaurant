import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { Order, Product, Expense } from '../../../types';

interface DashboardChartsProps {
  orders: Order[];
  products: Product[];
  expenses: Expense[];
}

const COLORS = ['#10b981', '#14b8a6', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6', '#06b6d4'];

export const SalesTrendChart: React.FC<{ orders: Order[] }> = ({ orders }) => {
  // Aggregate sales by date (or hours for today)
  const salesByDate: Record<string, { date: string; sales: number; profit: number; count: number }> = {};

  orders.forEach(o => {
    const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Today';
    if (!salesByDate[dateStr]) {
      salesByDate[dateStr] = { date: dateStr, sales: 0, profit: 0, count: 0 };
    }
    salesByDate[dateStr].sales += o.totalAmount || 0;
    salesByDate[dateStr].profit += o.profit || ((o.totalAmount || 0) - (o.cogs || 0));
    salesByDate[dateStr].count += 1;
  });

  const data = Object.values(salesByDate).slice(-7);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-white">Sales & Revenue Trend</h4>
          <p className="text-[10px] text-slate-400">Daily revenue and gross profit accumulation</p>
        </div>
        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
          Live Firestore Synced
        </span>
      </div>

      <div className="h-64 w-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500">
            No sales data recorded yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                labelStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
              />
              <Area type="monotone" dataKey="sales" name="Revenue ($)" stroke="#10b981" fillOpacity={1} fill="url(#colorSales)" strokeWidth={2} />
              <Area type="monotone" dataKey="profit" name="Gross Profit ($)" stroke="#14b8a6" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export const ProfitExpenseChart: React.FC<{ orders: Order[]; expenses: Expense[] }> = ({ orders, expenses }) => {
  const totalRev = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const totalExp = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const cogs = orders.reduce((s, o) => s + (o.cogs || 0), 0);
  const netProfit = totalRev - totalExp - cogs;

  const data = [
    { category: 'Gross Revenue', amount: Math.round(totalRev) },
    { category: 'COGS (Food)', amount: Math.round(cogs) },
    { category: 'Expenses', amount: Math.round(totalExp) },
    { category: 'Net Profit', amount: Math.max(0, Math.round(netProfit)) }
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-white">Profit & Loss Breakdown</h4>
          <p className="text-[10px] text-slate-400">Comparison of Revenue vs Costs vs Net Margin</p>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="category" stroke="#64748b" tick={{ fontSize: 10 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
            />
            <Bar dataKey="amount" name="Amount ($)" radius={[8, 8, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : index === 1 ? '#f59e0b' : index === 2 ? '#f43f5e' : '#14b8a6'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const ExpensePieChart: React.FC<{ expenses: Expense[] }> = ({ expenses }) => {
  const categoryTotals: Record<string, number> = {};

  expenses.forEach(e => {
    const cat = e.category || 'other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (e.amount || 0);
  });

  const data = Object.entries(categoryTotals).map(([name, value]) => ({
    name: (name || '').toUpperCase(),
    value: Math.round(value)
  }));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
      <div>
        <h4 className="text-sm font-bold text-white">Expense Distribution</h4>
        <p className="text-[10px] text-slate-400">Breakdown of operational spend categories</p>
      </div>

      <div className="h-64 w-full flex items-center justify-center">
        {data.length === 0 ? (
          <div className="text-xs text-slate-500">No expenses recorded yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
                formatter={(value) => <span className="text-slate-300 font-medium">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export const BestSellingProductsChart: React.FC<{ products: Product[] }> = ({ products }) => {
  const sorted = [...products].filter(p => (p.salesCount || 0) > 0).sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0)).slice(0, 5);

  const data = sorted.map(p => ({
    name: p.name.length > 18 ? `${p.name.substring(0, 18)}...` : p.name,
    sales: p.salesCount || 0,
    revenue: Math.round((p.salesCount || 0) * (p.price || 0))
  }));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
      <div>
        <h4 className="text-sm font-bold text-white">Best Selling Products</h4>
        <p className="text-[10px] text-slate-400">Top dishes by recorded sales volume</p>
      </div>

      <div className="h-64 w-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500">
            No product sales recorded yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" stroke="#94a3b8" tick={{ fontSize: 10 }} width={110} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
              />
              <Bar dataKey="sales" name="Orders Sold" fill="#10b981" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export const OrdersVolumeChart: React.FC<{ orders: Order[] }> = ({ orders }) => {
  const statusCounts = {
    completed: orders.filter(o => o.status === 'completed').length,
    in_prep: orders.filter(o => o.status === 'in_preparation' || o.prepStatus === 'preparing').length,
    pending: orders.filter(o => o.status === 'pending').length,
    delivery: orders.filter(o => o.orderType === 'delivery').length
  };

  const data = [
    { name: 'Completed', count: statusCounts.completed },
    { name: 'In Preparation', count: statusCounts.in_prep },
    { name: 'Pending Queue', count: statusCounts.pending },
    { name: 'Delivery', count: statusCounts.delivery }
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
      <div>
        <h4 className="text-sm font-bold text-white">Orders Volume & Queue Status</h4>
        <p className="text-[10px] text-slate-400">Real-time status distribution across fulfillment pipeline</p>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
            />
            <Bar dataKey="count" name="Orders Count" fill="#6366f1" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
