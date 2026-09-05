import { translateRawUi } from '../../../i18n/rawUi';
import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Building2,
  FileText,
  PlusCircle,
  Download,
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Landmark,
  ArrowRightLeft,
  PieChart,
  Scale,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Users,
  Briefcase,
  Percent,
  Printer,
  ChevronRight,
  X,
  Plus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getMogadishuDateString } from '../../../lib/dateUtils';
import { AccountingController } from '../../../controllers/AccountingController';
import {
  Account,
  AccountType,
  JournalEntry,
  LedgerEntry,
  AccountingExpense,
  AccountingRevenue,
  ReceivableItem,
  PayableItem,
  CashRegister,
  BankAccount,
  TaxConfig,
  FinancialStatements,
  ExpenseCategory
} from '../../../domain/entities/accounting';

const controller = new AccountingController();

export const AccountingManagementView: React.FC = () => {
  const { user, userRecord, t, language, dir } = useAuth();
  const isRtl = dir === 'rtl';

  // Active Sub-Tab
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'accounts'
    | 'journals'
    | 'ledger'
    | 'receivables'
    | 'payables'
    | 'expenses'
    | 'cashbank'
    | 'taxes'
    | 'reports'
  >('dashboard');

  // Core State
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [expenses, setExpenses] = useState<AccountingExpense[]>([]);
  const [revenues, setRevenues] = useState<AccountingRevenue[]>([]);
  const [receivables, setReceivables] = useState<ReceivableItem[]>([]);
  const [payables, setPayables] = useState<PayableItem[]>([]);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [taxes, setTaxes] = useState<TaxConfig[]>([]);
  const [financials, setFinancials] = useState<FinancialStatements | null>(null);

  // Filters & Selected State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedAccountType, setSelectedAccountType] = useState<string>('ALL');
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState<string>('');

  // Modals state
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [isJournalModalOpen, setIsJournalModalOpen] = useState<boolean>(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [isReceivableModalOpen, setIsReceivableModalOpen] = useState<boolean>(false);
  const [isPayableModalOpen, setIsPayableModalOpen] = useState<boolean>(false);
  const [isARPaymentModalOpen, setIsARPaymentModalOpen] = useState<boolean>(false);
  const [isAPPaymentModalOpen, setIsAPPaymentModalOpen] = useState<boolean>(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [isOpenRegisterModalOpen, setIsOpenRegisterModalOpen] = useState<boolean>(false);
  const [isCloseRegisterModalOpen, setIsCloseRegisterModalOpen] = useState<boolean>(false);

  // Forms State
  // 1. Account Form
  const [newAccCode, setNewAccCode] = useState<string>('');
  const [newAccName, setNewAccName] = useState<string>('');
  const [newAccType, setNewAccType] = useState<AccountType>('Expense');
  const [newAccDesc, setNewAccDesc] = useState<string>('');

  // 2. Journal Entry Form
  const [jeDate, setJeDate] = useState<string>(getMogadishuDateString());
  const [jeReference, setJeReference] = useState<string>('');
  const [jeDescription, setJeDescription] = useState<string>('');
  const [jeLines, setJeLines] = useState<{ accountId: string; debit: number; credit: number; memo: string }[]>([
    { accountId: '', debit: 0, credit: 0, memo: '' },
    { accountId: '', debit: 0, credit: 0, memo: '' }
  ]);

  // 3. Expense Form
  const [expTitle, setExpTitle] = useState<string>('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('Rent');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expMethod, setExpMethod] = useState<'Cash' | 'Bank'>('Cash');
  const [expAccount, setExpAccount] = useState<string>('');
  const [expVendor, setExpVendor] = useState<string>('');

  // 4. AR Payment Form
  const [selectedReceivable, setSelectedReceivable] = useState<ReceivableItem | null>(null);
  const [arPayAmount, setArPayAmount] = useState<number>(0);
  const [arPayMethod, setArPayMethod] = useState<'Cash' | 'Bank'>('Cash');

  // 5. AP Payment Form
  const [selectedPayable, setSelectedPayable] = useState<PayableItem | null>(null);
  const [apPayAmount, setApPayAmount] = useState<number>(0);
  const [apPayMethod, setApPayMethod] = useState<'Cash' | 'Bank'>('Cash');

  // 6. Transfer Form
  const [transferFrom, setTransferFrom] = useState<string>('');
  const [transferTo, setTransferTo] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferRef, setTransferRef] = useState<string>('');

  // 7. Cash Register Form
  const [openRegisterName, setOpenRegisterName] = useState<string>('Main POS Register');
  const [openRegisterFloat, setOpenRegisterFloat] = useState<number>(0);
  const [selectedRegisterToClose, setSelectedRegisterToClose] = useState<CashRegister | null>(null);
  const [closeActualCash, setCloseActualCash] = useState<number>(0);

  const userRole = (userRecord?.role || '').toLowerCase().trim();
  const isHqUser = userRole === 'owner' || (userRole === 'admin' && (!userRecord?.branchId || userRecord?.branchId === 'all'));
  const effectiveBranchId = isHqUser ? undefined : userRecord?.branchId;

  // Load Data
  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        accs,
        jnl,
        ldg,
        exp,
        rev,
        rec,
        pay,
        crs,
        bnk,
        txs,
        fin
      ] = await Promise.all([
        controller.fetchAccounts(),
        controller.fetchJournalEntries(effectiveBranchId),
        controller.fetchLedger(undefined, undefined, undefined, effectiveBranchId),
        controller.fetchExpenses(effectiveBranchId),
        controller.fetchRevenues(effectiveBranchId),
        controller.fetchReceivables(effectiveBranchId),
        controller.fetchPayables(effectiveBranchId),
        controller.fetchCashRegisters(effectiveBranchId),
        controller.fetchBankAccounts(),
        controller.fetchTaxes(effectiveBranchId),
        controller.fetchFinancialStatements(undefined, undefined, effectiveBranchId)
      ]);

      setAccounts(accs);
      setJournals(jnl);
      setLedger(ldg);
      setExpenses(exp);
      setRevenues(rev);
      setReceivables(rec);
      setPayables(pay);
      setCashRegisters(crs);
      setBankAccounts(bnk);
      setTaxes(txs);
      setFinancials(fin);

      if (accs.length > 0 && !expAccount) {
        const defaultExpAcc = accs.find(a => a.type === 'Expense');
        if (defaultExpAcc) setExpAccount(defaultExpAcc.id);
      }
      if (accs.length > 0 && !selectedLedgerAccountId) {
        setSelectedLedgerAccountId(accs[0].id);
      }
    } catch (err: any) {
      console.warn('Error loading accounting data:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Flash Message Helper
  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Handlers
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await controller.addAccount({
        code: newAccCode,
        name: newAccName,
        type: newAccType,
        description: newAccDesc,
        isSystem: false,
        status: 'Active',
        currency: 'USD'
      });
      setIsAccountModalOpen(false);
      setNewAccCode('');
      setNewAccName('');
      setNewAccDesc('');
      flashSuccess('Account successfully added to Chart of Accounts.');
      await loadAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validLines = jeLines.map(l => {
        const acc = accounts.find(a => a.id === l.accountId);
        return {
          id: `line-${Math.random()}`,
          journalEntryId: '',
          accountId: l.accountId,
          accountCode: acc?.code || '',
          accountName: acc?.name || '',
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          memo: l.memo
        };
      });

      const activeBranchId = userRecord?.branchId && userRecord.branchId !== 'all' ? userRecord.branchId : undefined;
      const activeBranchName = userRecord?.branch || undefined;

      await controller.addJournalEntry({
        date: jeDate,
        reference: jeReference || 'Manual Entry',
        description: jeDescription || 'General Journal Entry',
        source: 'Manual',
        status: 'Posted',
        totalDebit: validLines.reduce((s, l) => s + l.debit, 0),
        totalCredit: validLines.reduce((s, l) => s + l.credit, 0),
        lines: validLines,
        branchId: activeBranchId,
        branch: activeBranchName,
        createdBy: user?.displayName || 'Accountant'
      });

      setIsJournalModalOpen(false);
      setJeReference('');
      setJeDescription('');
      setJeLines([
        { accountId: '', debit: 0, credit: 0, memo: '' },
        { accountId: '', debit: 0, credit: 0, memo: '' }
      ]);
      flashSuccess('Balanced Journal Entry posted to General Ledger successfully.');
      await loadAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const activeBranchId = userRecord?.branchId && userRecord.branchId !== 'all' ? userRecord.branchId : undefined;
      const activeBranchName = userRecord?.branch || undefined;
      const payAcc = accounts.find(a => a.code === (expMethod === 'Bank' ? '1020' : '1010'))?.id || accounts[0]?.id;
      await controller.recordExpense({
        title: expTitle,
        category: expCategory,
        amount: Number(expAmount),
        taxAmount: 0,
        paymentMethod: expMethod,
        expenseAccountId: expAccount || accounts.find(a => a.type === 'Expense')?.id || '',
        paidFromAccountId: payAcc,
        vendorName: expVendor,
        date: getMogadishuDateString(),
        branchId: activeBranchId,
        branch: activeBranchName,
        status: 'Paid'
      });
      setIsExpenseModalOpen(false);
      setExpTitle('');
      setExpVendor('');
      flashSuccess('Expense recorded and double-entry transaction posted.');
      await loadAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRecordARPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceivable) return;
    try {
      await controller.addARPayment(selectedReceivable.id, {
        amount: Number(arPayAmount),
        paymentMethod: arPayMethod,
        date: getMogadishuDateString(),
        notes: 'Customer balance settlement'
      });
      setIsARPaymentModalOpen(false);
      setSelectedReceivable(null);
      flashSuccess('Customer receivable payment recorded successfully.');
      await loadAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRecordAPPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayable) return;
    try {
      await controller.addAPPayment(selectedPayable.id, {
        amount: Number(apPayAmount),
        paymentMethod: apPayMethod,
        date: getMogadishuDateString(),
        notes: 'Supplier bill payment'
      });
      setIsAPPaymentModalOpen(false);
      setSelectedPayable(null);
      flashSuccess('Supplier bill payment recorded successfully.');
      await loadAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await controller.transfer(
        transferFrom,
        transferTo,
        Number(transferAmount),
        transferRef || 'INTERNAL-XFER',
        'Inter-account money transfer'
      );
      setIsTransferModalOpen(false);
      flashSuccess('Fund transfer executed and posted to ledger.');
      await loadAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const activeBranchId = userRecord?.branchId && userRecord.branchId !== 'all'
        ? userRecord.branchId
        : '';
      const activeBranchName = userRecord?.branch || '';
      await controller.openRegister(
        openRegisterName,
        activeBranchName,
        Number(openRegisterFloat),
        user?.displayName || '',
        activeBranchId
      );
      setIsOpenRegisterModalOpen(false);
      flashSuccess('Cash Register opened for today shift.');
      await loadAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCloseRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegisterToClose) return;
    try {
      await controller.closeRegister(
        selectedRegisterToClose.id,
        Number(closeActualCash),
        user?.displayName || '',
        'End of shift cash drawer reconciliation'
      );
      setIsCloseRegisterModalOpen(false);
      setSelectedRegisterToClose(null);
      flashSuccess('Cash register closed and reconciled.');
      await loadAllData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // CSV Export
  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).map(v => `"${v}"`).join(','));
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute UI Metrics
  const totalAssets = accounts.filter(a => a.type === 'Asset').reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = accounts.filter(a => a.type === 'Liability').reduce((s, a) => s + a.balance, 0);
  const totalEquity = accounts.filter(a => a.type === 'Equity').reduce((s, a) => s + a.balance, 0);
  const totalReceivables = receivables.reduce((s, r) => s + (r.remainingBalance || 0), 0);
  const totalPayables = payables.reduce((s, p) => s + (p.remainingBalance || 0), 0);
  const cashOnHand = accounts.find(a => a.code === '1010')?.balance || 0;
  const bankBalance = bankAccounts.reduce((s, b) => s + (b.currentBalance || 0), 0);

  return (
    <div className={`p-4 md:p-8 max-w-7xl mx-auto space-y-6 ${isRtl ? 'rtl' : 'ltr'}`}>
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <Landmark className="w-4 h-4" />
            <span>{t.legacyUi.erpPhase10}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">{t.accounting?.title || 'Accounting & Finance System'}</h1>
          <p className="text-xs text-slate-400">
            {t.accounting?.subtitle || 'Comprehensive ledger, journals, cash/bank management, accounts receivable, payable & compliance reports.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsJournalModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t.accounting?.newJournal || 'New Journal Entry'}</span>
          </button>
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition cursor-pointer"
          >
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span>{t.accounting?.recordExpense || 'Record Expense'}</span>
          </button>
          <button
            onClick={loadAllData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
            title={translateRawUi('Refresh Accounting Data')}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-2xl text-xs font-medium flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-2xl text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl overflow-x-auto">
        {[
          { id: 'dashboard', label: t.accounting?.dashboard || 'Dashboard', icon: PieChart },
          { id: 'accounts', label: t.accounting?.chartOfAccounts || 'Chart of Accounts', icon: Layers },
          { id: 'journals', label: t.accounting?.journalEntries || 'Journal Entries', icon: FileText },
          { id: 'ledger', label: t.accounting?.generalLedger || 'General Ledger', icon: Scale },
          { id: 'receivables', label: t.accounting?.receivables || 'Accounts Receivable', icon: ArrowUpRight },
          { id: 'payables', label: t.accounting?.payables || 'Accounts Payable', icon: ArrowDownRight },
          { id: 'expenses', label: t.accounting?.expenses || 'Expenses', icon: Receipt },
          { id: 'cashbank', label: t.accounting?.cashBank || 'Cash & Bank', icon: CreditCard },
          { id: 'taxes', label: t.accounting?.taxes || 'Taxes', icon: Percent },
          { id: 'reports', label: t.accounting?.reports || 'Financial Reports', icon: Printer }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                <span>{t.legacyUi.totalAssets}</span>
                <Landmark className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-extrabold text-white">${totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] text-slate-500 font-medium">{t.legacyUi.cashBankArInventory}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                <span>{t.legacyUi.totalLiabilities}</span>
                <CreditCard className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-2xl font-extrabold text-white">${totalLiabilities.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] text-slate-500 font-medium">{t.legacyUi.apAndSalesTaxLiabilities}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                <span>{t.legacyUi.netProfitYtd}</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <p className={`text-2xl font-extrabold ${(financials?.profitAndLoss.netProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${(financials?.profitAndLoss.netProfit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-slate-500 font-medium">{t.legacyUi.revenuesMinusCosts}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                <span>{t.legacyUi.cashBankBalance}</span>
                <DollarSign className="w-4 h-4 text-sky-400" />
              </div>
              <p className="text-2xl font-extrabold text-white">${((cashOnHand || 0) + (bankBalance || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <p className="text-[10px] text-slate-500 font-medium">Cash Till: ${(cashOnHand || 0).toFixed(2)} | Bank: ${(bankBalance || 0).toFixed(2)}</p>
            </div>
          </div>

          {/* Double-Entry Equilibrium Card & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-400" />
                  <span>{t.legacyUi.doubleEntryTrialBalanceCheck}</span>
                </h2>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${financials?.isTrialBalanced ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'}`}>
                  {financials?.isTrialBalanced ? 'Balanced Equilibrium' : 'Trial Unbalanced'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">{t.legacyUi.totalLedgerDebits}</p>
                  <p className="text-lg font-bold text-white">${(financials?.totalTrialDebit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">{t.legacyUi.totalLedgerCredits}</p>
                  <p className="text-lg font-bold text-white">${(financials?.totalTrialCredit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* Working Capital Breakdown */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-300">{t.legacyUi.receivablesPayablesOverview}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">{t.legacyUi.customerReceivables}</span>
                      <span className="text-sm font-bold text-emerald-400">${(totalReceivables || 0).toFixed(2)}</span>
                    </div>
                    <button onClick={() => setActiveTab('receivables')} className="text-xs text-slate-400 hover:text-white">
                      {translateRawUi('View')}
                    </button>
                  </div>
                  <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">{t.legacyUi.supplierPayables}</span>
                      <span className="text-sm font-bold text-rose-400">${(totalPayables || 0).toFixed(2)}</span>
                    </div>
                    <button onClick={() => setActiveTab('payables')} className="text-xs text-slate-400 hover:text-white">
                      {translateRawUi('View')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-400" />
                <span>{t.legacyUi.accountingWorkflows}</span>
              </h2>

              <div className="space-y-2.5">
                <button
                  onClick={() => setIsJournalModalOpen(true)}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span>{t.legacyUi.createManualJournalEntry}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>

                <button
                  onClick={() => setIsAccountModalOpen(true)}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-sky-400" />
                    <span>{t.legacyUi.addNewLedgerAccount}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>

                <button
                  onClick={() => setIsTransferModalOpen(true)}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                    <span>{t.legacyUi.cashBankFundTransfer}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>

                <button
                  onClick={() => setIsOpenRegisterModalOpen(true)}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="w-4 h-4 text-purple-400" />
                    <span>{t.legacyUi.openCashTillShift}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CHART OF ACCOUNTS */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder={translateRawUi('Search account by code/name...')}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <select
                value={selectedAccountType}
                onChange={e => setSelectedAccountType(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">{t.legacyUi.allAccountTypes}</option>
                <option value="Asset">{translateRawUi('Assets')}</option>
                <option value="Liability">{translateRawUi('Liabilities')}</option>
                <option value="Equity">{translateRawUi('Equity')}</option>
                <option value="Revenue">{translateRawUi('Revenue')}</option>
                <option value="COGS">{translateRawUi('COGS')}</option>
                <option value="Expense">{translateRawUi('Expenses')}</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => exportToCSV(accounts, 'Chart_of_Accounts')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.legacyUi.exportCsv}</span>
              </button>

              <button
                onClick={() => setIsAccountModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>{t.legacyUi.addAccount}</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">{translateRawUi('Code')}</th>
                    <th className="p-4">{t.legacyUi.accountName}</th>
                    <th className="p-4">{translateRawUi('Type')}</th>
                    <th className="p-4">{translateRawUi('Description')}</th>
                    <th className="p-4 text-right">{translateRawUi('Balance')}</th>
                    <th className="p-4">{translateRawUi('Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {accounts
                    .filter(a => {
                      const matchesSearch =
                        (a.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
                        (a.code || '').includes(searchTerm || '');
                      const matchesType =
                        selectedAccountType === 'ALL' || a.type === selectedAccountType;
                      return matchesSearch && matchesType;
                    })
                    .map(acc => (
                      <tr key={acc.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-4 font-mono font-bold text-emerald-400">{acc.code}</td>
                        <td className="p-4 font-bold text-white">{acc.name}</td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              acc.type === 'Asset'
                                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                : acc.type === 'Liability'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : acc.type === 'Revenue'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : acc.type === 'Expense' || acc.type === 'COGS'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            }`}
                          >
                            {acc.type}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400 text-[11px]">{acc.description || 'N/A'}</td>
                        <td className="p-4 text-right font-mono font-bold text-white">
                          ${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                            {acc.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: JOURNAL ENTRIES */}
      {activeTab === 'journals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>{t.legacyUi.postedJournalEntries}</span>
            </h2>

            <div className="flex items-center gap-2">
              <button
                onClick={() => exportToCSV(journals, 'Journal_Entries')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.legacyUi.exportCsv}</span>
              </button>

              <button
                onClick={() => setIsJournalModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>{t.legacyUi.newEntry}</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {journals.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center text-slate-500 text-xs font-medium">
                {translateRawUi('No journal entries posted yet.')}
              </div>
            ) : (
              journals.map(j => (
                <div key={j.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3 shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                        {j.entryNumber}
                      </span>
                      <span className="text-xs font-bold text-white">{j.description}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Ref: {j.reference}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-400 font-medium">{j.date}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                        {j.status}
                      </span>
                    </div>
                  </div>

                  {/* Lines Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-800/40">
                        <tr>
                          <th className="py-1">{translateRawUi('Account')}</th>
                          <th className="py-1">{translateRawUi('Memo')}</th>
                          <th className="py-1 text-right">{t.legacyUi.debitUsd}</th>
                          <th className="py-1 text-right">{t.legacyUi.creditUsd}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/30 font-medium text-slate-300">
                        {j.lines?.map((line, idx) => (
                          <tr key={idx}>
                            <td className="py-1.5 font-bold text-white">
                              {line.accountCode} - {line.accountName}
                            </td>
                            <td className="py-1.5 text-slate-400 text-[11px]">{line.memo || '-'}</td>
                            <td className="py-1.5 text-right font-mono text-emerald-400">
                              {(line.debit || 0) > 0 ? `$${(line.debit || 0).toFixed(2)}` : '-'}
                            </td>
                            <td className="py-1.5 text-right font-mono text-sky-400">
                              {(line.credit || 0) > 0 ? `$${(line.credit || 0).toFixed(2)}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: GENERAL LEDGER */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-xs text-slate-400 font-bold whitespace-nowrap">{t.legacyUi.selectAccountColon}</label>
              <select
                value={selectedLedgerAccountId}
                onChange={e => setSelectedLedgerAccountId(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500 w-full sm:w-72"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name} ({a.type})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => exportToCSV(ledger, 'General_Ledger')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.legacyUi.exportLedger}</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">{t.legacyUi.dateLabel}</th>
                    <th className="p-4">{t.legacyUi.entryNumber}</th>
                    <th className="p-4">{translateRawUi('Reference')}</th>
                    <th className="p-4">{translateRawUi('Description')}</th>
                    <th className="p-4 text-right">{t.legacyUi.debitUsd}</th>
                    <th className="p-4 text-right">{t.legacyUi.creditUsd}</th>
                    <th className="p-4 text-right">{t.legacyUi.runningBalance}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {ledger
                    .filter(l => !selectedLedgerAccountId || l.accountId === selectedLedgerAccountId)
                    .map(l => (
                      <tr key={l.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-4 font-mono text-slate-400">{l.date}</td>
                        <td className="p-4 font-mono font-bold text-emerald-400">{l.entryNumber}</td>
                        <td className="p-4 font-bold text-white">{l.reference || '-'}</td>
                        <td className="p-4 text-slate-300">{l.description}</td>
                        <td className="p-4 text-right font-mono text-emerald-400">
                          {l.debit > 0 ? `$${l.debit.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-4 text-right font-mono text-sky-400">
                          {l.credit > 0 ? `$${l.credit.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-white">
                          ${(l.runningBalance || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ACCOUNTS RECEIVABLE */}
      {activeTab === 'receivables' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white">{t.legacyUi.accountsReceivableCustomerBalances}</h2>
              <p className="text-[10px] text-slate-400">{t.legacyUi.trackCustomerInvoices}</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">{t.legacyUi.invoiceNumber}</th>
                    <th className="p-4">{t.legacyUi.customerName}</th>
                    <th className="p-4">{t.legacyUi.issueDate}</th>
                    <th className="p-4">{t.legacyUi.dueDate}</th>
                    <th className="p-4 text-right">{t.legacyUi.totalUsd}</th>
                    <th className="p-4 text-right">{t.legacyUi.paidUsd}</th>
                    <th className="p-4 text-right">{t.legacyUi.remainingUsd}</th>
                    <th className="p-4">{translateRawUi('Status')}</th>
                    <th className="p-4 text-right">{translateRawUi('Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {receivables.map(r => (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4 font-mono font-bold text-emerald-400">{r.invoiceNumber}</td>
                      <td className="p-4 font-bold text-white">{r.customerName}</td>
                      <td className="p-4 text-slate-400">{r.issueDate}</td>
                      <td className="p-4 text-slate-400">{r.dueDate}</td>
                      <td className="p-4 text-right font-mono text-white">${(r.totalAmount || 0).toFixed(2)}</td>
                      <td className="p-4 text-right font-mono text-emerald-400">${(r.paidAmount || 0).toFixed(2)}</td>
                      <td className="p-4 text-right font-mono font-bold text-rose-400">${(r.remainingBalance || 0).toFixed(2)}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'Paid'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : r.status === 'Partial'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {r.remainingBalance > 0 && (
                          <button
                            onClick={() => {
                              setSelectedReceivable(r);
                              setArPayAmount(r.remainingBalance);
                              setIsARPaymentModalOpen(true);
                            }}
                            className="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-[11px] transition"
                          >
                            {translateRawUi('Receive Payment')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: ACCOUNTS PAYABLE */}
      {activeTab === 'payables' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white">{t.legacyUi.accountsPayableSupplierBills}</h2>
              <p className="text-[10px] text-slate-400">{t.legacyUi.trackSupplierBills}</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">{t.legacyUi.billNumber}</th>
                    <th className="p-4">{t.legacyUi.supplierName}</th>
                    <th className="p-4">{t.legacyUi.issueDate}</th>
                    <th className="p-4">{t.legacyUi.dueDate}</th>
                    <th className="p-4 text-right">{t.legacyUi.totalUsd}</th>
                    <th className="p-4 text-right">{t.legacyUi.paidUsd}</th>
                    <th className="p-4 text-right">{t.legacyUi.remainingUsd}</th>
                    <th className="p-4">{translateRawUi('Status')}</th>
                    <th className="p-4 text-right">{translateRawUi('Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {payables.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4 font-mono font-bold text-amber-400">{p.billNumber}</td>
                      <td className="p-4 font-bold text-white">{p.supplierName}</td>
                      <td className="p-4 text-slate-400">{p.issueDate}</td>
                      <td className="p-4 text-slate-400">{p.dueDate}</td>
                      <td className="p-4 text-right font-mono text-white">${(p.totalAmount || 0).toFixed(2)}</td>
                      <td className="p-4 text-right font-mono text-emerald-400">${(p.paidAmount || 0).toFixed(2)}</td>
                      <td className="p-4 text-right font-mono font-bold text-rose-400">${(p.remainingBalance || 0).toFixed(2)}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === 'Paid'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : p.status === 'Partial'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {p.remainingBalance > 0 && (
                          <button
                            onClick={() => {
                              setSelectedPayable(p);
                              setApPayAmount(p.remainingBalance);
                              setIsAPPaymentModalOpen(true);
                            }}
                            className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] transition"
                          >
                            {translateRawUi('Pay Bill')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: EXPENSES */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              <span>{t.legacyUi.categorizedExpenseRecords}</span>
            </h2>

            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>{t.legacyUi.recordExpense}</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">{t.legacyUi.expenseNumber}</th>
                    <th className="p-4">{translateRawUi('Title')}</th>
                    <th className="p-4">{translateRawUi('Category')}</th>
                    <th className="p-4">{t.legacyUi.paymentSource}</th>
                    <th className="p-4">{t.legacyUi.vendorLabel}</th>
                    <th className="p-4 text-right">{t.legacyUi.amountUsd}</th>
                    <th className="p-4">{t.legacyUi.dateLabel}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {expenses.map(e => (
                    <tr key={e.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4 font-mono font-bold text-emerald-400">{e.expenseNumber}</td>
                      <td className="p-4 font-bold text-white">{e.title}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">
                          {e.category}
                        </span>
                      </td>
                      <td className="p-4 text-slate-300">{e.paymentMethod}</td>
                      <td className="p-4 text-slate-400">{e.vendorName || '-'}</td>
                      <td className="p-4 text-right font-mono font-bold text-rose-400">
                        ${(e.amount || 0).toFixed(2)}
                      </td>
                      <td className="p-4 text-slate-400">{e.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: CASH & BANK */}
      {activeTab === 'cashbank' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bank Accounts List */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-sky-400" />
                  <span>{t.legacyUi.corporateBankAccounts}</span>
                </h2>
                <button
                  onClick={() => setIsTransferModalOpen(true)}
                  className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  {translateRawUi('Transfer Funds')}
                </button>
              </div>

              <div className="space-y-3">
                {bankAccounts.map(b => (
                  <div key={b.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">{b.bankName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">Account: {b.accountNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-emerald-400">${b.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                      <p className="text-[10px] text-slate-500 font-bold">{b.currency}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cash Register Shift Management */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-400" />
                  <span>{t.legacyUi.cashRegisterTillShifts}</span>
                </h2>
                <button
                  onClick={() => setIsOpenRegisterModalOpen(true)}
                  className="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold transition"
                >
                  {translateRawUi('Open Shift')}
                </button>
              </div>

              <div className="space-y-3">
                {cashRegisters.map(c => (
                  <div key={c.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{c.registerName}</span>
                        <span
                          className={`px-2 py-0.2 rounded-full text-[9px] font-bold ${
                            c.status === 'Open'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">Opened by: {c.openedBy}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs font-bold text-white">Float: ${(c.openingBalance || 0).toFixed(2)}</p>
                        <p className="text-[10px] text-emerald-400 font-medium">Sales: +${(c.cashSales || 0).toFixed(2)}</p>
                      </div>

                      {c.status === 'Open' && (
                        <button
                          onClick={() => {
                            setSelectedRegisterToClose(c);
                            setCloseActualCash(c.expectedClosingBalance);
                            setIsCloseRegisterModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold"
                        >
                          {translateRawUi('Close Shift')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: TAXES */}
      {activeTab === 'taxes' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">{t.legacyUi.taxConfigurations}</h2>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-4">{t.legacyUi.taxName}</th>
                    <th className="p-4">{translateRawUi('Code')}</th>
                    <th className="p-4 text-right">{t.legacyUi.ratePercent}</th>
                    <th className="p-4">{t.legacyUi.appliesTo}</th>
                    <th className="p-4">{translateRawUi('Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {taxes.map(t => (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4 font-bold text-white">{t.name}</td>
                      <td className="p-4 font-mono text-emerald-400">{t.code}</td>
                      <td className="p-4 text-right font-mono font-bold text-white">{t.rate}%</td>
                      <td className="p-4 text-slate-300">{t.type}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 10: FINANCIAL REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Profit & Loss Statement */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>{t.legacyUi.profitLossStatement}</span>
                </h2>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{translateRawUi('Print')}</span>
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {/* Revenue */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-bold text-white">
                    <span>{t.legacyUi.operatingRevenues}</span>
                    <span className="text-emerald-400">${(financials?.profitAndLoss.totalRevenue || 0).toFixed(2)}</span>
                  </div>
                  {financials?.profitAndLoss.revenue.map(r => (
                    <div key={r.accountCode} className="flex items-center justify-between text-[11px] text-slate-400 pl-3">
                      <span>{r.accountCode} - {r.accountName}</span>
                      <span>${(r.amount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* COGS */}
                <div className="space-y-1 border-t border-slate-800 pt-2">
                  <div className="flex items-center justify-between font-bold text-white">
                    <span>{t.legacyUi.cogs}</span>
                    <span className="text-amber-400">${(financials?.profitAndLoss.totalCOGS || 0).toFixed(2)}</span>
                  </div>
                  {financials?.profitAndLoss.cogs.map(c => (
                    <div key={c.accountCode} className="flex items-center justify-between text-[11px] text-slate-400 pl-3">
                      <span>{c.accountCode} - {c.accountName}</span>
                      <span>${(c.amount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Gross Profit */}
                <div className="flex items-center justify-between font-extrabold text-white bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span>{t.legacyUi.grossProfit}</span>
                  <span className="text-emerald-400">${(financials?.profitAndLoss.grossProfit || 0).toFixed(2)}</span>
                </div>

                {/* Expenses */}
                <div className="space-y-1 border-t border-slate-800 pt-2">
                  <div className="flex items-center justify-between font-bold text-white">
                    <span>{t.legacyUi.operatingExpensesLabel}</span>
                    <span className="text-rose-400">${(financials?.profitAndLoss.totalExpenses || 0).toFixed(2)}</span>
                  </div>
                  {financials?.profitAndLoss.expenses.map(e => (
                    <div key={e.accountCode} className="flex items-center justify-between text-[11px] text-slate-400 pl-3">
                      <span>{e.accountCode} - {e.accountName}</span>
                      <span>${(e.amount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Net Profit */}
                <div className="flex items-center justify-between font-black text-sm text-white bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/30">
                  <span>{t.legacyUi.netProfitLoss}</span>
                  <span className={(financials?.profitAndLoss.netProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    ${(financials?.profitAndLoss.netProfit || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Balance Sheet Statement */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-sky-400" />
                  <span>{t.legacyUi.balanceSheetStatement}</span>
                </h2>
                <button onClick={() => window.print()} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white">
                  <Printer className="w-3.5 h-3.5" />
                  <span>{translateRawUi('Print')}</span>
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {/* Assets */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between font-bold text-white">
                    <span>{t.legacyUi.totalAssets}</span>
                    <span className="text-emerald-400">${(financials?.balanceSheet.totalAssets || 0).toFixed(2)}</span>
                  </div>
                  {financials?.balanceSheet.assets.map(a => (
                    <div key={a.accountCode} className="flex items-center justify-between text-[11px] text-slate-400 pl-3">
                      <span>{a.accountCode} - {a.accountName}</span>
                      <span>${(a.amount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Liabilities */}
                <div className="space-y-1 border-t border-slate-800 pt-2">
                  <div className="flex items-center justify-between font-bold text-white">
                    <span>{t.legacyUi.totalLiabilities}</span>
                    <span className="text-rose-400">${(financials?.balanceSheet.totalLiabilities || 0).toFixed(2)}</span>
                  </div>
                  {financials?.balanceSheet.liabilities.map(l => (
                    <div key={l.accountCode} className="flex items-center justify-between text-[11px] text-slate-400 pl-3">
                      <span>{l.accountCode} - {l.accountName}</span>
                      <span>${(l.amount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Equity */}
                <div className="space-y-1 border-t border-slate-800 pt-2">
                  <div className="flex items-center justify-between font-bold text-white">
                    <span>{t.legacyUi.totalEquity}</span>
                    <span className="text-sky-400">${(financials?.balanceSheet.totalEquity || 0).toFixed(2)}</span>
                  </div>
                  {financials?.balanceSheet.equity.map(eq => (
                    <div key={eq.accountCode} className="flex items-center justify-between text-[11px] text-slate-400 pl-3">
                      <span>{eq.accountCode} - {eq.accountName}</span>
                      <span>${(eq.amount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Verification Check */}
                <div className="flex items-center justify-between font-bold text-xs text-white bg-slate-950 p-3 rounded-2xl border border-slate-800">
                  <span>{t.legacyUi.liabilitiesEquity}</span>
                  <span>${(financials?.balanceSheet.totalLiabilitiesAndEquity || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD ACCOUNT */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">{t.legacyUi.createLedgerAccount2}</h3>
              <button onClick={() => setIsAccountModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">{t.legacyUi.accountCodeExample}</label>
                <input
                  type="text"
                  required
                  placeholder={translateRawUi('6110')}
                  value={newAccCode}
                  onChange={e => setNewAccCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">{t.legacyUi.accountName}</label>
                <input
                  type="text"
                  required
                  placeholder={translateRawUi('Software Subscriptions')}
                  value={newAccName}
                  onChange={e => setNewAccName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">{t.legacyUi.accountType}</label>
                <select
                  value={newAccType}
                  onChange={e => setNewAccType(e.target.value as AccountType)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Asset">{translateRawUi('Asset')}</option>
                  <option value="Liability">{translateRawUi('Liability')}</option>
                  <option value="Equity">{translateRawUi('Equity')}</option>
                  <option value="Revenue">{translateRawUi('Revenue')}</option>
                  <option value="COGS">{translateRawUi('COGS')}</option>
                  <option value="Expense">{translateRawUi('Expense')}</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">{translateRawUi('Description')}</label>
                <textarea
                  rows={2}
                  placeholder={translateRawUi('Optional account notes...')}
                  value={newAccDesc}
                  onChange={e => setNewAccDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  {translateRawUi('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold"
                >
                  {translateRawUi('Create Account')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: NEW JOURNAL ENTRY */}
      {isJournalModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">{t.legacyUi.postBalancedJournal}</h3>
              <button onClick={() => setIsJournalModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateJournal} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">{t.legacyUi.dateLabel}</label>
                  <input
                    type="date"
                    required
                    value={jeDate}
                    onChange={e => setJeDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">{translateRawUi('Reference')}</label>
                  <input
                    type="text"
                    placeholder={translateRawUi('INV-1001 or Voucher')}
                    value={jeReference}
                    onChange={e => setJeReference(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">{translateRawUi('Description')}</label>
                  <input
                    type="text"
                    required
                    placeholder={translateRawUi('Payroll accrued / Adjustment')}
                    value={jeDescription}
                    onChange={e => setJeDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Dynamic Line Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300">{t.legacyUi.journalLineItems}</span>
                  <button
                    type="button"
                    onClick={() => setJeLines([...jeLines, { accountId: '', debit: 0, credit: 0, memo: '' }])}
                    className="text-emerald-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.legacyUi.addLine}</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {jeLines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="col-span-5">
                        <select
                          required
                          value={line.accountId}
                          onChange={e => {
                            const updated = [...jeLines];
                            updated[idx].accountId = e.target.value;
                            setJeLines(updated);
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-xs"
                        >
                          <option value="">{t.legacyUi.selectAccountEllipsis}</option>
                          {accounts.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.code} - {a.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          placeholder={t.legacyUi.debitUsd}
                          value={line.debit || ''}
                          onChange={e => {
                            const updated = [...jeLines];
                            updated[idx].debit = parseFloat(e.target.value) || 0;
                            setJeLines(updated);
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 font-mono text-xs"
                        />
                      </div>

                      <div className="col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          placeholder={t.legacyUi.creditUsd}
                          value={line.credit || ''}
                          onChange={e => {
                            const updated = [...jeLines];
                            updated[idx].credit = parseFloat(e.target.value) || 0;
                            setJeLines(updated);
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-sky-400 font-mono text-xs"
                        />
                      </div>

                      <div className="col-span-1 text-right">
                        {jeLines.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setJeLines(jeLines.filter((_, i) => i !== idx))}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Checker */}
              {(() => {
                const totDeb = jeLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
                const totCred = jeLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
                const isBalanced = Math.abs(totDeb - totCred) < 0.01 && totDeb > 0;
                return (
                  <div className={`p-3 rounded-xl border flex items-center justify-between font-mono text-xs font-bold ${isBalanced ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                    <span>Debits: ${totDeb.toFixed(2)} | Credits: ${totCred.toFixed(2)}</span>
                    <span>{isBalanced ? 'BALANCED' : 'UNBALANCED'}</span>
                  </div>
                );
              })()}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsJournalModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  {translateRawUi('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold"
                >
                  {translateRawUi('Post Journal Entry')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RECORD EXPENSE */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">{t.legacyUi.recordOperatingExpense}</h3>
              <button onClick={() => setIsExpenseModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleRecordExpense} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">{t.legacyUi.expenseTitle2}</label>
                <input
                  type="text"
                  required
                  placeholder={translateRawUi('Generator Diesel Fuel')}
                  value={expTitle}
                  onChange={e => setExpTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">{translateRawUi('Category')}</label>
                  <select
                    value={expCategory}
                    onChange={e => setExpCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Rent">{translateRawUi('Rent')}</option>
                    <option value="Electricity">{translateRawUi('Electricity')}</option>
                    <option value="Water">{translateRawUi('Water')}</option>
                    <option value="Internet">{translateRawUi('Internet')}</option>
                    <option value="Gas">{translateRawUi('Gas')}</option>
                    <option value="Salaries">{translateRawUi('Salaries')}</option>
                    <option value="Marketing">{translateRawUi('Marketing')}</option>
                    <option value="Maintenance">{translateRawUi('Maintenance')}</option>
                    <option value="Transportation">{translateRawUi('Transportation')}</option>
                    <option value="Miscellaneous">{translateRawUi('Miscellaneous')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">{t.legacyUi.amountUsd}</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={expAmount}
                    onChange={e => setExpAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">{t.legacyUi.paymentMethod}</label>
                <select
                  value={expMethod}
                  onChange={e => setExpMethod(e.target.value as 'Cash' | 'Bank')}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Cash">{t.legacyUi.cashOnHandTill}</option>
                  <option value="Bank">{t.legacyUi.bankAccount}</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">{t.legacyUi.vendorPayee}</label>
                <input
                  type="text"
                  placeholder={translateRawUi('e.g. Utility Company')}
                  value={expVendor}
                  onChange={e => setExpVendor(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  {translateRawUi('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold"
                >
                  {translateRawUi('Save & Post Expense')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: AR PAYMENT */}
      {isARPaymentModalOpen && selectedReceivable && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">{t.legacyUi.recordCustomerPayment}</h3>
              <button onClick={() => setIsARPaymentModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleRecordARPayment} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <p className="text-slate-400 font-medium">Invoice #{selectedReceivable.invoiceNumber}</p>
                <p className="text-sm font-bold text-white">{selectedReceivable.customerName}</p>
                <p className="text-xs text-rose-400 font-bold font-mono">Remaining Balance: ${(selectedReceivable.remainingBalance || 0).toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">{t.legacyUi.paymentAmountUsd}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={arPayAmount}
                  onChange={e => setArPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">{t.legacyUi.depositInto}</label>
                <select
                  value={arPayMethod}
                  onChange={e => setArPayMethod(e.target.value as 'Cash' | 'Bank')}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="Cash">{t.legacyUi.cashTill}</option>
                  <option value="Bank">{t.legacyUi.bankAccount}</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsARPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  {translateRawUi('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold"
                >
                  {translateRawUi('Submit Payment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: AP PAYMENT */}
      {isAPPaymentModalOpen && selectedPayable && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">{t.legacyUi.recordSupplierBillPayment}</h3>
              <button onClick={() => setIsAPPaymentModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleRecordAPPayment} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <p className="text-slate-400 font-medium">Bill #{selectedPayable.billNumber}</p>
                <p className="text-sm font-bold text-white">{selectedPayable.supplierName}</p>
                <p className="text-xs text-rose-400 font-bold font-mono">Bill Remaining: ${(selectedPayable.remainingBalance || 0).toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">{t.legacyUi.paymentAmountUsd}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={apPayAmount}
                  onChange={e => setApPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">{t.legacyUi.paidFrom}</label>
                <select
                  value={apPayMethod}
                  onChange={e => setApPayMethod(e.target.value as 'Cash' | 'Bank')}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="Cash">{t.legacyUi.cashTill}</option>
                  <option value="Bank">{t.legacyUi.bankAccount}</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAPPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  {translateRawUi('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold"
                >
                  {translateRawUi('Execute Payment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: FUND TRANSFER */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">{t.legacyUi.cashBankFundTransfer}</h3>
              <button onClick={() => setIsTransferModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">{t.legacyUi.transferFromAccount}</label>
                <select
                  required
                  value={transferFrom}
                  onChange={e => setTransferFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="">{t.legacyUi.selectSourceAccount}</option>
                  {accounts.filter(a => a.type === 'Asset').map(a => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name} (${a.balance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">{t.legacyUi.transferToAccount}</label>
                <select
                  required
                  value={transferTo}
                  onChange={e => setTransferTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="">{t.legacyUi.selectDestinationAccount}</option>
                  {accounts.filter(a => a.type === 'Asset' && a.id !== transferFrom).map(a => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name} (${a.balance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">{t.legacyUi.amountUsd}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={transferAmount}
                  onChange={e => setTransferAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">{t.legacyUi.transferReference}</label>
                <input
                  type="text"
                  placeholder={translateRawUi('BANK-DEP-099')}
                  value={transferRef}
                  onChange={e => setTransferRef(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  {translateRawUi('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold"
                >
                  {translateRawUi('Execute Transfer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: OPEN REGISTER */}
      {isOpenRegisterModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">{t.legacyUi.openCashTillRegister}</h3>
              <button onClick={() => setIsOpenRegisterModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleOpenRegister} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">{t.legacyUi.registerName}</label>
                <input
                  type="text"
                  required
                  value={openRegisterName}
                  onChange={e => setOpenRegisterName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">{t.legacyUi.openingCashFloat}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={openRegisterFloat}
                  onChange={e => setOpenRegisterFloat(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpenRegisterModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  {translateRawUi('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold"
                >
                  {translateRawUi('Open Shift')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 8: CLOSE REGISTER */}
      {isCloseRegisterModalOpen && selectedRegisterToClose && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">{t.legacyUi.closeReconcileShift}</h3>
              <button onClick={() => setIsCloseRegisterModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCloseRegister} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <p className="text-white font-bold">{selectedRegisterToClose.registerName}</p>
                <p className="text-slate-400">Opening Float: ${(selectedRegisterToClose.openingBalance || 0).toFixed(2)}</p>
                <p className="text-emerald-400 font-bold">Expected Cash: ${(selectedRegisterToClose.expectedClosingBalance || 0).toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">{t.legacyUi.actualPhysicalCashCount}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={closeActualCash}
                  onChange={e => setCloseActualCash(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>

              {(() => {
                const diff = closeActualCash - selectedRegisterToClose.expectedClosingBalance;
                return (
                  <div className={`p-2.5 rounded-xl border text-xs font-mono font-bold ${diff === 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                    Difference: {diff >= 0 ? `+$${diff.toFixed(2)}` : `-$${Math.abs(diff).toFixed(2)}`}
                  </div>
                );
              })()}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCloseRegisterModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  {translateRawUi('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-500 text-white font-bold"
                >
                  {translateRawUi('Confirm & Close Shift')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
