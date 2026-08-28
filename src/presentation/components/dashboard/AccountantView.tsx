import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { KPICard } from './KPICard';
import { ProfitExpenseChart, ExpensePieChart } from './DashboardCharts';
import { Order, Expense, Purchase, Supplier, CustomerRefund, BankTransaction, FinancialAccount } from '../../../types';
import {
  DollarSign,
  BarChart3,
  Receipt,
  FileSpreadsheet,
  Building2,
  Wallet,
  AlertCircle,
  TrendingUp,
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react';

interface AccountantViewProps {
  orders: Order[];
  expenses: Expense[];
  purchases: Purchase[];
  suppliers: Supplier[];
  refunds: CustomerRefund[];
  bankTransactions: BankTransaction[];
  accounts: FinancialAccount[];
  onNavigateToTab?: (tab: string) => void;
}

export const AccountantView: React.FC<AccountantViewProps> = ({
  orders,
  expenses,
  purchases,
  suppliers,
  refunds,
  bankTransactions,
  accounts,
  onNavigateToTab
}) => {
  const { t } = useAuth();
  const d: Record<string, any> = t.dashboard || {};

  // 1. Revenue Calculations
  const grossRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalRefunds = refunds.reduce((sum, r) => sum + (r.amount || 0), 0);
  const netRevenue = grossRevenue - totalRefunds;

  // 2. Expenses & COGS
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const cogs = orders.reduce((sum, o) => sum + (o.cogs || 0), 0);

  // 3. Profit & Loss
  const grossProfit = netRevenue - cogs;
  const netProfit = grossProfit - totalExpenses;
  const profitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

  // 4. Supplier Accounts Payable
  const totalSupplierPending = suppliers.reduce((sum, s) => sum + (s.pendingAmount || 0), 0);
  const totalSupplierOverdue = suppliers.reduce((sum, s) => sum + (s.overdueAmount || 0), 0);

  // 5. Cash & Bank Balance
  const cashBalance = accounts.find(a => a.type === 'cash')?.balance ?? 0;
  const bankBalance = accounts.find(a => a.type === 'bank')?.balance ?? 0;
  const totalLiquidity = cashBalance + bankBalance;

  // Recorded Tax / VAT
  const recordedVAT = orders.reduce((sum, o) => sum + (o.tax || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Accountant Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-indigo-500/10 text-indigo-400 font-bold text-[10px] px-2.5 py-0.5 rounded-full border border-indigo-500/20 uppercase tracking-wider">
              {d.financialControl || 'Financial Control & CPA Suite'}
            </span>
            <span className="text-xs text-slate-400">• {d.generalLedgerAudit || 'General Ledger & Audit Trail'}</span>
          </div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            {d.accountantTitle || 'Accounting & Financial Performance Dashboard'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {d.accountantSubtitle || 'Audit P&L Statements, revenue recognition, supplier accounts payable, bank reconciliation, and estimated tax liabilities.'}
          </p>
        </div>

        {onNavigateToTab && (
          <button
            onClick={() => onNavigateToTab('financials')}
            className="bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-lg cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> {d.fullLedger || 'Full Financial Ledger'}
          </button>
        )}
      </div>

      {/* Accountant Required Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <KPICard
          title={d.netRevenue || 'Net Revenue'}
          value={`$${netRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sublabel={`Gross: $${grossRevenue.toFixed(0)} | Refunds: -$${totalRefunds.toFixed(0)}`}
          icon={DollarSign}
          iconColor="emerald"
        />

        <KPICard
          title={d.operatingExpenses || 'Total Operational Expenses'}
          value={`$${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sublabel={`${expenses.length} Expense Entries`}
          icon={BarChart3}
          iconColor="rose"
        />

        <KPICard
          title="Net Profit & Loss"
          value={`$${netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sublabel={`Net Margin: ${profitMargin.toFixed(1)}%`}
          icon={TrendingUp}
          iconColor={netProfit >= 0 ? 'teal' : 'rose'}
          badgeText={netProfit >= 0 ? 'Net Profit' : 'Net Deficit'}
          badgeType={netProfit >= 0 ? 'success' : 'danger'}
        />

        <KPICard
          title="Cash & Liquidity Balance"
          value={`$${totalLiquidity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sublabel={`Cash Safe: $${cashBalance.toFixed(0)} | Bank: $${bankBalance.toFixed(0)}`}
          icon={Wallet}
          iconColor="blue"
        />

        <KPICard
          title="Accounts Payable (Suppliers)"
          value={`$${totalSupplierPending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sublabel={`Overdue: $${totalSupplierOverdue.toFixed(0)}`}
          icon={Building2}
          iconColor="amber"
          badgeText={totalSupplierOverdue > 0 ? 'Overdue Invoices' : 'Pending'}
          badgeType={totalSupplierOverdue > 0 ? 'danger' : 'warning'}
        />

        <KPICard
          title="Pending Receivables"
          value="$350.00"
          sublabel="Uncollected customer orders"
          icon={Receipt}
          iconColor="indigo"
        />

        <KPICard
          title="Recorded Tax / VAT"
          value={`$${recordedVAT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sublabel="Sales Tax Liability Recorded"
          icon={AlertCircle}
          iconColor="purple"
        />

      </div>

      {/* Financial Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProfitExpenseChart orders={orders} expenses={expenses} />
        <ExpensePieChart expenses={expenses} />
      </div>

      {/* Accounts Payable & Bank Accounts Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Supplier Accounts Payable Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-400" />
              Supplier Accounts Payable & Overdue Invoices
            </h3>
          </div>

          <div className="space-y-2">
            {suppliers.map(sup => (
              <div key={sup.id} className="flex items-center justify-between bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs">
                <div>
                  <h5 className="font-bold text-white">{sup.name}</h5>
                  <p className="text-[10px] text-slate-400">{sup.itemsSupplied} • {sup.contactPerson}</p>
                </div>

                <div className="text-right">
                  <span className="font-bold text-amber-400">${(sup.pendingAmount || 0).toFixed(2)}</span>
                  {(sup.overdueAmount || 0) > 0 && (
                    <p className="text-[10px] font-bold text-rose-400 flex items-center gap-1 justify-end">
                      <ShieldAlert className="w-3 h-3" /> Overdue: ${(sup.overdueAmount || 0).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bank & Cash Balances Summary */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Wallet className="w-5 h-5 text-blue-400" />
            Liquid Capital & Financial Account Balances
          </h3>

          <div className="space-y-3">
            {accounts.map(acc => (
              <div key={acc.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">{acc.name}</span>
                  <span className="font-extrabold text-sm text-emerald-400">${(acc.balance || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="capitalize">Type: {acc.type}</span>
                  <span>{acc.accountNumber || 'Primary Vault'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
