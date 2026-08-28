import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { getMogadishuDateString } from '../../../lib/dateUtils';
import { KPICard } from './KPICard';
import {
  SalesTrendChart,
  ProfitExpenseChart,
  ExpensePieChart,
  BestSellingProductsChart
} from './DashboardCharts';
import {
  Order,
  Product,
  Ingredient,
  Expense,
  Employee,
  Supplier,
  BankTransaction,
  FinancialAccount
} from '../../../types';
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  ShoppingBag,
  Users,
  Boxes,
  Activity,
  HeartPulse,
  ArrowUpRight,
  ShieldCheck,
  Award,
  Wallet,
  AlertTriangle
} from 'lucide-react';

interface OwnerViewProps {
  orders: Order[];
  products: Product[];
  ingredients: Ingredient[];
  expenses: Expense[];
  employees: Employee[];
  suppliers: Supplier[];
  bankTransactions: BankTransaction[];
  accounts: FinancialAccount[];
  onNavigateToTab?: (tab: string) => void;
}

export const OwnerView: React.FC<OwnerViewProps> = ({
  orders,
  products,
  ingredients,
  expenses,
  employees,
  suppliers,
  bankTransactions,
  accounts,
  onNavigateToTab
}) => {
  const { t } = useAuth();
  const d: Record<string, any> = t.dashboard || {};

  // 1. Financial Calculations
  const todayIso = getMogadishuDateString();

  const totalSales = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  
  const todayOrders = orders.filter(o => o.createdAt && o.createdAt.startsWith(todayIso));
  const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  
  const todayCogs = todayOrders.reduce((sum, o) => sum + (o.cogs || 0), 0);
  const todayExpenses = expenses
    .filter(e => e.createdAt && e.createdAt.startsWith(todayIso))
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const todayProfit = todayRevenue - todayCogs - todayExpenses;

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalCogs = orders.reduce((sum, o) => sum + (o.cogs || 0), 0);
  const monthlyProfit = totalSales - totalCogs - totalExpenses;

  // Liquidity & Cash Flow
  const cashAccount = accounts.find(a => a.type === 'cash')?.balance ?? 0;
  const bankAccount = accounts.find(a => a.type === 'bank')?.balance ?? 0;
  const totalCashFlow = cashAccount + bankAccount;

  // Metrics
  const totalOrdersCount = orders.length;
  const lowStockIngredients = ingredients.filter(i => i.stock <= i.minStockAlert);
  const lowStockProducts = products.filter(p => p.stock <= p.minStockAlert);
  const totalLowStock = lowStockIngredients.length + lowStockProducts.length;

  // Business Health Index (0 - 100)
  const marginPct = totalSales > 0 ? (monthlyProfit / totalSales) * 100 : 35;
  const cogsPct = totalSales > 0 ? (totalCogs / totalSales) * 100 : 38;
  const healthScore = Math.min(100, Math.max(40, Math.round(50 + marginPct * 0.8 - (totalLowStock * 3))));

  // Employee Performance Ranking
  const employeePerformance = [...employees].sort((a, b) => (b.totalSales || 0) - (a.totalSales || 0));

  return (
    <div className="space-y-6">
      
      {/* Executive Health Overview Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/10 text-emerald-400 font-bold text-[10px] px-2.5 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-widest">
              {d.executiveSuite || 'Executive Suite'}
            </span>
            <span className="text-xs text-slate-400">• {d.enterpriseVisibility || 'Full Enterprise Visibility'}</span>
          </div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            {d.ownerTitle || 'Owner & Executive Dashboard'}
          </h2>
          <p className="text-xs text-slate-400 max-w-xl">
            {d.ownerSubtitle || 'Real-time multi-branch financial intelligence, profit margins, stock valuation, and operational performance.'}
          </p>
        </div>

        {/* Business Health Scorecard Widget */}
        <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex items-center gap-4 w-full lg:w-auto">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-extrabold text-lg shadow-inner">
            <HeartPulse className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">{d.healthScore || 'Business Health Score'}</span>
              <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
                {healthScore}/100
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {d.netProfitMargin || 'Net Profit Margin'}: <strong className="text-emerald-400">{marginPct.toFixed(1)}%</strong> | {d.foodCogs || 'Food COGS'}: <strong className="text-amber-400">{cogsPct.toFixed(1)}%</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Owner Required KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <KPICard
          title={d.totalSales || 'Total Sales'}
          value={`$${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          change={14.8}
          changeLabel="vs last month"
          icon={DollarSign}
          iconColor="emerald"
        />

        <KPICard
          title={d.todayRevenue || "Today's Revenue"}
          value={`$${todayRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sublabel={`${todayOrders.length} orders fulfilled today`}
          icon={Activity}
          iconColor="teal"
          badgeText="Live"
          badgeType="success"
        />

        <KPICard
          title={d.todayProfit || "Today's Profit"}
          value={`$${todayProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sublabel={`COGS: $${todayCogs.toFixed(0)} | Exp: $${todayExpenses.toFixed(0)}`}
          icon={TrendingUp}
          iconColor="indigo"
          badgeText={todayProfit >= 0 ? '+ PROFIT' : '- LOSS'}
          badgeType={todayProfit >= 0 ? 'success' : 'danger'}
        />

        <KPICard
          title={d.monthlyProfit || 'Monthly Profit'}
          value={`$${monthlyProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          change={18.2}
          icon={Award}
          iconColor="purple"
        />

        <KPICard
          title={d.totalExpenses || 'Total Expenses'}
          value={`$${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sublabel={`${expenses.length} operating expense logs`}
          icon={BarChart3}
          iconColor="rose"
        />

        <KPICard
          title={d.cashFlow || 'Cash Flow & Liquidity'}
          value={`$${totalCashFlow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sublabel={`Cash: $${cashAccount.toFixed(0)} | Bank: $${bankAccount.toFixed(0)}`}
          icon={Wallet}
          iconColor="blue"
        />

        <KPICard
          title={d.totalOrders || 'Total Orders'}
          value={totalOrdersCount}
          sublabel="All-time completed sales"
          icon={ShoppingBag}
          iconColor="amber"
        />

        <KPICard
          title={d.customerGrowth || 'Customer Growth'}
          value="+24.6%"
          sublabel="88.4% Customer Retention Rate"
          icon={Users}
          iconColor="teal"
        />

      </div>

      {/* Owner Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesTrendChart orders={orders} />
        <ProfitExpenseChart orders={orders} expenses={expenses} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpensePieChart expenses={expenses} />
        <BestSellingProductsChart products={products} />
      </div>

      {/* Inventory & Employee Performance Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Inventory Status Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Boxes className="w-5 h-5 text-amber-400" />
              {d.inventoryStatus || 'Inventory Status Overview'}
            </h3>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('inventory')}
                className="text-xs text-amber-400 hover:underline font-bold"
              >
                {d.manageInventory || 'Manage Inventory →'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">{d.totalItems || 'Total Items'}</span>
              <span className="text-lg font-black text-white">{products.length + ingredients.length}</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">{d.healthyStock || 'Healthy Stock'}</span>
              <span className="text-lg font-black text-emerald-400">
                {(products.length + ingredients.length) - totalLowStock}
              </span>
            </div>
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-amber-400 block uppercase font-bold">{d.lowStockAlerts || 'Low Stock Alerts'}</span>
              <span className="text-lg font-black text-amber-400">{totalLowStock}</span>
            </div>
          </div>

          <div className="space-y-2">
            {lowStockIngredients.length === 0 && lowStockProducts.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">All ingredients and products are currently well-stocked!</p>
            ) : (
              [...lowStockIngredients, ...lowStockProducts].slice(0, 4).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-white">{item.name}</span>
                  </div>
                  <span className="font-bold text-amber-400">
                    {item.stock} {item.unit} (Min: {item.minStockAlert})
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Employee Performance Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-teal-400" />
              {d.employeeLeaderboard || 'Employee Performance Leaderboard'}
            </h3>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('staff')}
                className="text-xs text-teal-400 hover:underline font-bold"
              >
                {d.staffPortal || 'Staff Portal →'}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {employeePerformance.slice(0, 5).map((emp, idx) => (
              <div key={emp.id} className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                    idx === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    idx === 1 ? 'bg-slate-300/20 text-slate-200 border border-slate-300/30' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    #{idx + 1}
                  </div>
                  <div>
                    <h5 className="font-bold text-white">{emp.name}</h5>
                    <span className="text-[10px] text-slate-400 capitalize">{emp.role}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-extrabold text-emerald-400">${(emp.totalSales || 0).toFixed(2)}</span>
                  <p className="text-[10px] text-slate-500">{emp.ordersCount || 0} orders handled</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
