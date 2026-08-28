import React from 'react';
import { getMogadishuDateString } from '../../../lib/dateUtils';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart as PieIcon,
  BarChart2,
  Clock,
  Flame,
  Users,
  Award,
  UtensilsCrossed,
  PackageCheck,
  Percent,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Order, Product, Ingredient, Expense, Employee, Supplier, Customer } from '../../../types';

interface BIAnalyticsDashboardProps {
  orders: Order[];
  products: Product[];
  ingredients: Ingredient[];
  expenses: Expense[];
  employees: Employee[];
  suppliers: Supplier[];
  customers: Customer[];
}

const COLORS = ['#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6', '#06b6d4'];

export const BIAnalyticsDashboard: React.FC<BIAnalyticsDashboardProps> = ({
  orders,
  products,
  ingredients,
  expenses,
  employees,
  suppliers,
  customers,
}) => {
  // 1. Core Financial Calculations
  const completedOrders = orders.filter((o) => o.status === 'completed' || o.paymentStatus === 'paid');
  const grossSales = completedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalCogs = completedOrders.reduce((sum, o) => sum + (o.cogs || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalPayroll = employees.reduce((sum, e) => sum + (e.salary || 0), 0);

  const grossProfit = grossSales - totalCogs;
  const netProfit = grossProfit - totalExpenses - totalPayroll;
  const netProfitMargin = grossSales > 0 ? (netProfit / grossSales) * 100 : 0;

  const foodCostPercentage = grossSales > 0 ? (totalCogs / grossSales) * 100 : 0;
  const laborCostPercentage = grossSales > 0 ? (totalPayroll / grossSales) * 100 : 0;

  // Inventory Asset Valuation
  const ingredientsValuation = ingredients.reduce(
    (sum, i) => sum + (i.stock || 0) * (i.costPerUnit || 0),
    0
  );
  const productsValuation = products.reduce((sum, p) => sum + (p.stock || 0) * (p.cost || 0), 0);
  const totalInventoryValue = ingredientsValuation + productsValuation;
  const inventoryTurnover = totalInventoryValue > 0 ? totalCogs / totalInventoryValue : 0;

  // Customer Growth & Retention
  const totalUniqueCustomers = new Set(orders.map((o) => o.customerName || 'Walk-in')).size;
  const customerOrderCounts: { [name: string]: number } = {};
  orders.forEach((o) => {
    const name = o.customerName || 'Walk-in';
    if (name !== 'Walk-in') {
      customerOrderCounts[name] = (customerOrderCounts[name] || 0) + 1;
    }
  });
  const repeatCustomers = Object.values(customerOrderCounts).filter((count) => count > 1).length;
  const totalRegisteredCustomers = Object.keys(customerOrderCounts).length;
  const retentionRate =
    totalRegisteredCustomers > 0 ? (repeatCustomers / totalRegisteredCustomers) * 100 : 0;

  // 2. Sales Period Breakdown (Daily, Weekly, Monthly, Yearly)
  const todayStr = getMogadishuDateString();

  const dailySales = completedOrders
    .filter((o) => (o.createdAt || '').startsWith(todayStr))
    .reduce((s, o) => s + o.totalAmount, 0);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklySales = completedOrders
    .filter((o) => new Date(o.createdAt || 0) >= weekAgo)
    .reduce((s, o) => s + o.totalAmount, 0);

  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const monthlySales = completedOrders
    .filter((o) => new Date(o.createdAt || 0) >= monthAgo)
    .reduce((s, o) => s + o.totalAmount, 0);

  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const yearlySales = completedOrders
    .filter((o) => new Date(o.createdAt || 0) >= yearStart)
    .reduce((s, o) => s + o.totalAmount, 0);

  // 3. Hourly Sales, Peak Hours & Slow Hours
  const hourlyDataMap: { [hour: number]: { sales: number; count: number } } = {};
  for (let i = 0; i < 24; i++) {
    hourlyDataMap[i] = { sales: 0, count: 0 };
  }

  completedOrders.forEach((o) => {
    const d = new Date(o.createdAt || Date.now());
    const hour = d.getHours();
    hourlyDataMap[hour].sales += o.totalAmount || 0;
    hourlyDataMap[hour].count += 1;
  });

  const hourlyChartData = Object.keys(hourlyDataMap).map((h) => {
    const hour = parseInt(h, 10);
    const label = `${hour.toString().padStart(2, '0')}:00`;
    return {
      hour: label,
      sales: hourlyDataMap[hour].sales,
      orders: hourlyDataMap[hour].count,
    };
  });

  // Identify Peak and Slow Hours
  let maxHourlySales = -1;
  let peakHourStr = 'N/A';
  let minHourlySales = Infinity;
  let slowHourStr = 'N/A';

  Object.entries(hourlyDataMap).forEach(([h, data]) => {
    const hourNum = parseInt(h, 10);
    const label = `${hourNum.toString().padStart(2, '0')}:00 - ${(hourNum + 1)
      .toString()
      .padStart(2, '0')}:00`;

    if (data.sales > maxHourlySales && data.sales > 0) {
      maxHourlySales = data.sales;
      peakHourStr = label;
    }
    if (data.sales < minHourlySales && data.sales > 0) {
      minHourlySales = data.sales;
      slowHourStr = label;
    }
  });

  // 4. Product Performance (Best & Worst Selling)
  const productSalesMap: { [pName: string]: { qty: number; revenue: number } } = {};
  orders.forEach((o) => {
    (o.items || []).forEach((item) => {
      const name = item.productName || 'Dish Item';
      if (!productSalesMap[name]) {
        productSalesMap[name] = { qty: 0, revenue: 0 };
      }
      productSalesMap[name].qty += item.quantity || 1;
      productSalesMap[name].revenue += item.totalPrice || item.unitPrice * item.quantity || 0;
    });
  });

  const sortedProducts = Object.entries(productSalesMap).map(([name, data]) => ({
    name,
    qty: data.qty,
    revenue: data.revenue,
  }));

  sortedProducts.sort((a, b) => b.qty - a.qty);
  const bestSellingProducts = sortedProducts.slice(0, 5);
  const worstSellingProducts = [...sortedProducts].reverse().slice(0, 5);

  // 5. Category Performance
  const categorySalesMap: { [cat: string]: number } = {};
  orders.forEach((o) => {
    (o.items || []).forEach((item) => {
      // Find matching product category
      const prod = products.find((p) => p.id === item.productId || p.name === item.productName);
      const cat = prod?.category || 'General Menu';
      categorySalesMap[cat] =
        (categorySalesMap[cat] || 0) + (item.totalPrice || item.unitPrice * item.quantity || 0);
    });
  });

  const categoryChartData = Object.entries(categorySalesMap).map(([name, value]) => ({
    name,
    value,
  }));

  // 6. Payment Method Distribution
  const paymentMethodMap: { [method: string]: number } = {};
  completedOrders.forEach((o) => {
    const method = (o.paymentMethod || 'cash').toUpperCase();
    paymentMethodMap[method] = (paymentMethodMap[method] || 0) + o.totalAmount;
  });

  const paymentChartData = Object.entries(paymentMethodMap).map(([name, value]) => ({
    name,
    value,
  }));

  // 7. Time Trend Data (Revenue vs COGS vs Profit)
  const dateMap: { [date: string]: { revenue: number; cogs: number; profit: number } } = {};
  completedOrders.forEach((o) => {
    const d = (o.createdAt || new Date().toISOString()).split('T')[0];
    if (!dateMap[d]) dateMap[d] = { revenue: 0, cogs: 0, profit: 0 };
    dateMap[d].revenue += o.totalAmount || 0;
    dateMap[d].cogs += o.cogs || 0;
    dateMap[d].profit += o.profit || (o.totalAmount - (o.cogs || 0));
  });

  const trendChartData = Object.entries(dateMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([date, data]) => ({
      date: date.slice(5),
      Revenue: data.revenue,
      COGS: data.cogs,
      Profit: data.profit,
    }));

  return (
    <div className="space-y-6">
      {/* 1. Executive Sales Periods & Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sales Periods Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-400 font-semibold">Daily Sales (Today)</p>
              <h3 className="text-2xl font-black text-emerald-400 mt-1">${dailySales.toFixed(2)}</h3>
            </div>
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-between text-[11px] text-slate-400">
            <span>Weekly: <strong className="text-white">${weeklySales.toFixed(0)}</strong></span>
            <span>Monthly: <strong className="text-white">${monthlySales.toFixed(0)}</strong></span>
          </div>
        </div>

        {/* Profitability Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-400 font-semibold">Net Profit & Margin</p>
              <h3 className={`text-2xl font-black mt-1 ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${netProfit.toFixed(2)}
              </h3>
            </div>
            <div className={`p-2.5 rounded-2xl border ${netProfit >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-between text-[11px] text-slate-400">
            <span>Gross Profit: <strong className="text-white">${grossProfit.toFixed(0)}</strong></span>
            <span>Margin: <strong className={netProfitMargin >= 15 ? 'text-emerald-400' : 'text-amber-400'}>{netProfitMargin.toFixed(1)}%</strong></span>
          </div>
        </div>

        {/* Food & Labor Cost Benchmarking */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-400 font-semibold">Food Cost & Labor %</p>
              <div className="flex items-center gap-3 mt-1">
                <div>
                  <span className="text-xs text-slate-400">Food:</span>
                  <p className={`text-lg font-bold ${foodCostPercentage <= 35 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {foodCostPercentage.toFixed(1)}%
                  </p>
                </div>
                <div className="w-px h-6 bg-slate-800" />
                <div>
                  <span className="text-xs text-slate-400">Labor:</span>
                  <p className={`text-lg font-bold ${laborCostPercentage <= 30 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {laborCostPercentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400 flex justify-between">
            <span>Target Food &lt; 35%</span>
            <span>Target Labor &lt; 30%</span>
          </div>
        </div>

        {/* Inventory Value & Turnover */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-slate-400 font-semibold">Inventory Valuation</p>
              <h3 className="text-2xl font-black text-indigo-400 mt-1">${totalInventoryValue.toFixed(2)}</h3>
            </div>
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
              <PackageCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-between text-[11px] text-slate-400">
            <span>Turnover Ratio: <strong className="text-white">{inventoryTurnover.toFixed(2)}x</strong></span>
            <span>Ingredients: <strong className="text-white">${ingredientsValuation.toFixed(0)}</strong></span>
          </div>
        </div>
      </div>

      {/* 2. Peak Hours & Slow Hours Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 border border-amber-500/30 rounded-3xl p-5 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 rounded-2xl text-amber-400 border border-amber-500/30">
              <Flame className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <p className="text-xs text-amber-400 font-bold uppercase tracking-wider">Identified Peak Hours</p>
              <h4 className="text-lg font-black text-white mt-0.5">{peakHourStr}</h4>
              <p className="text-xs text-slate-400 mt-0.5">Highest order velocity & sales generation</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Peak Revenue</p>
            <p className="text-lg font-bold text-amber-400">${maxHourlySales > 0 ? maxHourlySales.toFixed(2) : '0.00'}</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-slate-900 via-blue-950/30 to-slate-900 border border-blue-500/30 rounded-3xl p-5 flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400 border border-blue-500/30">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-blue-400 font-bold uppercase tracking-wider">Identified Slow Hours</p>
              <h4 className="text-lg font-black text-white mt-0.5">{slowHourStr !== 'N/A' ? slowHourStr : 'Late Night / Off-Peak'}</h4>
              <p className="text-xs text-slate-400 mt-0.5">Ideal window for kitchen prep & staff shifts</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Slow Revenue</p>
            <p className="text-lg font-bold text-blue-400">${minHourlySales !== Infinity ? minHourlySales.toFixed(2) : '0.00'}</p>
          </div>
        </div>
      </div>

      {/* 3. Recharts Line & Area Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales & Profit Trend */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              14-Day Sales Revenue & Profit Trend
            </h3>
            <span className="text-xs text-slate-400">Real-time Firestore</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="Revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="Profit" stroke="#3b82f6" fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Sales Bar Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-amber-400" />
              Hourly Sales Distribution (00:00 - 23:00)
            </h3>
            <span className="text-xs text-amber-400 font-semibold">Peak Hours Peak</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="hour" stroke="#64748b" fontSize={10} interval={2} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="sales" name="Sales ($)" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. Peak Hours Heat Map Component */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              Peak Hours Heat Map (24-Hour Intensity Grid)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Hourly order volume and revenue generation matrix across operational hours
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-950 border border-slate-800 rounded" /> Zero</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-900/60 rounded" /> Low</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-600/80 rounded" /> Moderate</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-rose-600/90 rounded" /> Peak</span>
          </div>
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-12 md:grid-cols-24 gap-1.5 pt-2">
          {hourlyChartData.map((item, idx) => {
            let bgClass = 'bg-slate-950 border-slate-800/80 text-slate-500';
            if (item.sales > 0 && item.sales < (maxHourlySales * 0.3)) {
              bgClass = 'bg-emerald-900/40 border-emerald-500/30 text-emerald-300';
            } else if (item.sales >= (maxHourlySales * 0.3) && item.sales < (maxHourlySales * 0.7)) {
              bgClass = 'bg-amber-900/50 border-amber-500/40 text-amber-300';
            } else if (item.sales >= (maxHourlySales * 0.7)) {
              bgClass = 'bg-rose-900/60 border-rose-500/50 text-rose-200 font-bold shadow-lg shadow-rose-900/30';
            }

            return (
              <div
                key={idx}
                className={`p-2 rounded-xl border text-center transition hover:scale-105 cursor-pointer flex flex-col justify-between ${bgClass}`}
                title={`Hour ${item.hour}: $${item.sales.toFixed(2)} (${item.orders} orders)`}
              >
                <span className="text-[10px] font-mono opacity-80">{item.hour}</span>
                <span className="text-xs font-black mt-1">${item.sales > 0 ? item.sales.toFixed(0) : '0'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Best Selling vs Worst Selling Products & Category Share */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Best Selling Products */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-400" /> Best Selling Products
          </h3>
          <div className="space-y-2.5">
            {bestSellingProducts.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No sales recorded yet</p>
            ) : (
              bestSellingProducts.map((p, idx) => (
                <div key={idx} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/20">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-white">{p.name}</p>
                      <p className="text-[10px] text-slate-400">{p.qty} units sold</p>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-400">${p.revenue.toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Worst Selling / Slow Moving Products */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-400" /> Worst Selling Products
          </h3>
          <div className="space-y-2.5">
            {worstSellingProducts.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No low velocity products</p>
            ) : (
              worstSellingProducts.map((p, idx) => (
                <div key={idx} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-rose-500/10 text-rose-400 font-bold text-xs flex items-center justify-center border border-rose-500/20">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-white">{p.name}</p>
                      <p className="text-[10px] text-slate-400">{p.qty} units sold</p>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-rose-400">${p.revenue.toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Category Performance Pie Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-indigo-400" /> Category Performance
          </h3>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryChartData.length > 0 ? categoryChartData : [{ name: 'Default', value: 100 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 6. Customer Growth & Retention metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold">Total Customer Base</p>
            <h4 className="text-2xl font-black text-white mt-1">{totalUniqueCustomers}</h4>
            <p className="text-[11px] text-emerald-400 mt-1">Unique Buyers Recorded</p>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold">Repeat / Retention Rate</p>
            <h4 className="text-2xl font-black text-indigo-400 mt-1">{retentionRate.toFixed(1)}%</h4>
            <p className="text-[11px] text-slate-400 mt-1">{repeatCustomers} Returning Customers</p>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-semibold">Average Ticket Value</p>
            <h4 className="text-2xl font-black text-amber-400 mt-1">
              ${completedOrders.length > 0 ? (grossSales / completedOrders.length).toFixed(2) : '0.00'}
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">{completedOrders.length} Total Orders</p>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
        </div>
      </div>
    </div>
  );
};
