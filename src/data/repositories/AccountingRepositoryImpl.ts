import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db, COLLECTIONS, addExpenseFirestore, getAuthToken, getEffectiveBranchId } from '../../lib/firebase';
import { getMogadishuDateString } from '../../lib/dateUtils';
import {
  Account,
  AccountType,
  JournalEntry,
  JournalLine,
  LedgerEntry,
  AccountingExpense,
  AccountingRevenue,
  ReceivableItem,
  PayableItem,
  CashRegister,
  BankAccount,
  BankTransaction,
  TaxConfig,
  FinancialStatements,
  ARPayment,
  APPayment
} from '../../domain/entities/accounting';
import { IAccountingRepository } from '../../domain/repositories/IAccountingRepository';
import { getApiUrl } from '../../lib/apiConfig';

async function authFetch(url: string, options: RequestInit = {}) {
  const token = await getAuthToken();
  const targetUrl = getApiUrl(url);
  const method = String(options.method || 'GET').toUpperCase();
  const incomingHeaders = new Headers(options.headers || {});
  if (method !== 'GET' && method !== 'HEAD' && !incomingHeaders.has('Idempotency-Key')) {
    const key = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    incomingHeaders.set('Idempotency-Key', `accounting:${key}`);
  }
  incomingHeaders.set('Content-Type', 'application/json');
  if (token) incomingHeaders.set('Authorization', `Bearer ${token}`);
  const res = await fetch(targetUrl, {
    ...options,
    headers: incomingHeaders
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export class AccountingRepositoryImpl implements IAccountingRepository {
  // --- CHART OF ACCOUNTS ---
  async getAccounts(): Promise<Account[]> {
    try {
      const branchId = getEffectiveBranchId();
      const q = branchId === 'all'
        ? collection(db, COLLECTIONS.ACCOUNTS)
        : query(collection(db, COLLECTIONS.ACCOUNTS), where('branchId', '==', branchId));
      const snap = await getDocs(q);
      if (snap.empty) {
        return [];
      }
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Account));
    } catch (err: any) {
      console.error('Error in getAccounts:', err?.message || err);
      throw err;
    }
  }

  async createAccount(accountData: Omit<Account, 'id' | 'createdAt' | 'balance'>): Promise<Account> {
    return authFetch('/api/accounting/accounts', {
      method: 'POST',
      body: JSON.stringify(accountData)
    });
  }

  async updateAccount(id: string, updates: Partial<Account>): Promise<void> {
    await authFetch(`/api/accounting/accounts/${id}`, {
      method: 'POST',
      body: JSON.stringify(updates)
    });
  }

  // --- JOURNAL ENTRIES & LEDGER ---
  async getJournalEntries(branchId?: string): Promise<JournalEntry[]> {
    try {
      const q = branchId && branchId !== 'all'
        ? query(collection(db, COLLECTIONS.JOURNAL_ENTRIES), where('branchId', '==', branchId))
        : query(collection(db, COLLECTIONS.JOURNAL_ENTRIES));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as JournalEntry));
    } catch (err: any) {
      console.error('Error in getJournalEntries:', err?.message || err);
      throw err;
    }
  }

  async createJournalEntry(entryData: Omit<JournalEntry, 'id' | 'createdAt' | 'entryNumber'>): Promise<JournalEntry> {
    return authFetch('/api/accounting/journal-entries', {
      method: 'POST',
      body: JSON.stringify(entryData)
    });
  }

  async getLedger(accountId?: string, startDate?: string, endDate?: string, branchId?: string): Promise<LedgerEntry[]> {
    try {
      const q = branchId && branchId !== 'all'
        ? query(collection(db, COLLECTIONS.LEDGER), where('branchId', '==', branchId))
        : query(collection(db, COLLECTIONS.LEDGER));
      const snap = await getDocs(q);
      let entries = snap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEntry));

      if (accountId) {
        entries = entries.filter(e => e.accountId === accountId);
      }
      if (startDate) {
        entries = entries.filter(e => e.date >= startDate);
      }
      if (endDate) {
        entries = entries.filter(e => e.date <= endDate);
      }

      return entries.sort((a, b) => a.date.localeCompare(b.date));
    } catch (err: any) {
      console.error('Error in getLedger:', err?.message || err);
      throw err;
    }
  }

  // --- EXPENSES ---
  async getExpenses(branchId?: string): Promise<AccountingExpense[]> {
    try {
      const q = branchId && branchId !== 'all'
        ? query(collection(db, COLLECTIONS.EXPENSES), where('branchId', '==', branchId))
        : query(collection(db, COLLECTIONS.EXPENSES));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountingExpense));
    } catch (err: any) {
      console.error('Error in getExpenses:', err?.message || err);
      throw err;
    }
  }

  async createExpense(expenseData: Omit<AccountingExpense, 'id' | 'createdAt' | 'expenseNumber'>): Promise<AccountingExpense> {
    const expenseNumber = `EXP-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date().toISOString();

    const payload = {
      ...expenseData,
      expenseNumber,
      createdAt: now
    };

    const expenseId = await addExpenseFirestore(payload as any);
    return { id: expenseId, ...payload };
  }

  // --- REVENUES ---
  async getRevenues(branchId?: string): Promise<AccountingRevenue[]> {
    try {
      const q = branchId && branchId !== 'all'
        ? query(collection(db, COLLECTIONS.REVENUES), where('branchId', '==', branchId))
        : query(collection(db, COLLECTIONS.REVENUES));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountingRevenue));
    } catch (err: any) {
      console.error('Error in getRevenues:', err?.message || err);
      throw err;
    }
  }

  async createRevenue(revenueData: Omit<AccountingRevenue, 'id' | 'createdAt' | 'revenueNumber'>): Promise<AccountingRevenue> {
    return authFetch('/api/accounting/revenues', {
      method: 'POST',
      body: JSON.stringify(revenueData)
    });
  }

  // --- ACCOUNTS RECEIVABLE ---
  async getReceivables(branchId?: string): Promise<ReceivableItem[]> {
    try {
      const q = branchId && branchId !== 'all'
        ? query(collection(db, COLLECTIONS.RECEIVABLES), where('branchId', '==', branchId))
        : query(collection(db, COLLECTIONS.RECEIVABLES));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as ReceivableItem));
    } catch (err: any) {
      console.error('Error in getReceivables:', err?.message || err);
      throw err;
    }
  }

  async createReceivable(itemData: Omit<ReceivableItem, 'id' | 'createdAt' | 'paidAmount' | 'remainingBalance' | 'status' | 'payments'>): Promise<ReceivableItem> {
    return authFetch('/api/accounting/receivables', {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
  }

  async recordARPayment(receivableId: string, payment: { amount: number; paymentMethod: 'Cash' | 'Bank'; date: string; reference?: string; notes?: string }): Promise<void> {
    await authFetch(`/api/accounting/receivables/${receivableId}/payment`, {
      method: 'POST',
      body: JSON.stringify(payment)
    });
  }

  // --- ACCOUNTS PAYABLE ---
  async getPayables(branchId?: string): Promise<PayableItem[]> {
    try {
      const q = branchId && branchId !== 'all'
        ? query(collection(db, COLLECTIONS.PAYABLES), where('branchId', '==', branchId))
        : query(collection(db, COLLECTIONS.PAYABLES));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as PayableItem));
    } catch (err: any) {
      console.error('Error in getPayables:', err?.message || err);
      throw err;
    }
  }

  async createPayable(itemData: Omit<PayableItem, 'id' | 'createdAt' | 'paidAmount' | 'remainingBalance' | 'status' | 'payments'>): Promise<PayableItem> {
    return authFetch('/api/accounting/payables', {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
  }

  async recordAPPayment(payableId: string, payment: { amount: number; paymentMethod: 'Cash' | 'Bank'; date: string; reference?: string; notes?: string }): Promise<void> {
    await authFetch(`/api/accounting/payables/${payableId}/payment`, {
      method: 'POST',
      body: JSON.stringify(payment)
    });
  }

  // --- CASH & BANK ---
  async getCashRegisters(branchId?: string): Promise<CashRegister[]> {
    try {
      const q = branchId && branchId !== 'all'
        ? query(collection(db, COLLECTIONS.CASH_REGISTERS), where('branchId', '==', branchId))
        : query(collection(db, COLLECTIONS.CASH_REGISTERS));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as CashRegister));
    } catch (err: any) {
      console.error('Error in getCashRegisters:', err?.message || err);
      throw err;
    }
  }

  async openCashRegister(registerName: string, branchName: string, openingBalance: number, openedBy: string, branchId?: string): Promise<CashRegister> {
    return authFetch('/api/accounting/cash-registers/open', {
      method: 'POST',
      body: JSON.stringify({ registerName, branchName, openingBalance, openedBy, branchId })
    });
  }

  async closeCashRegister(id: string, actualClosingBalance: number, closedBy: string, notes?: string): Promise<void> {
    await authFetch('/api/accounting/cash-registers/close', {
      method: 'POST',
      body: JSON.stringify({ id, actualClosingBalance, closedBy, notes })
    });
  }

  async getBankAccounts(): Promise<BankAccount[]> {
    try {
      const branchId = getEffectiveBranchId();
      const q = branchId === 'all'
        ? collection(db, COLLECTIONS.BANK_ACCOUNTS)
        : query(collection(db, COLLECTIONS.BANK_ACCOUNTS), where('branchId', '==', branchId));
      const snap = await getDocs(q);
      if (snap.empty) {
        return [];
      }
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as BankAccount));
    } catch (err: any) {
      console.error('Error in getBankAccounts:', err?.message || err);
      throw err;
    }
  }

  async createBankAccount(accountData: Omit<BankAccount, 'id' | 'createdAt' | 'currentBalance'>, initialBalance = 0): Promise<BankAccount> {
    return authFetch('/api/accounting/bank-accounts', {
      method: 'POST',
      body: JSON.stringify({ ...accountData, initialBalance })
    });
  }

  async getBankTransactions(bankAccountId?: string, branchId?: string): Promise<BankTransaction[]> {
    try {
      const q = branchId && branchId !== 'all'
        ? query(collection(db, COLLECTIONS.BANK_TRANSACTIONS), where('branchId', '==', branchId))
        : query(collection(db, COLLECTIONS.BANK_TRANSACTIONS));
      const snap = await getDocs(q);
      let items = snap.docs.map(d => ({ id: d.id, ...d.data() } as BankTransaction));
      if (bankAccountId) {
        items = items.filter(t => t.bankAccountId === bankAccountId);
      }
      return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (err: any) {
      console.error('Error in getBankTransactions:', err?.message || err);
      throw err;
    }
  }

  async transferFunds(fromAccountId: string, toAccountId: string, amount: number, reference: string, description: string): Promise<void> {
    const accounts = await this.getAccounts();
    const fromAcc = accounts.find(a => a.id === fromAccountId);
    const toAcc = accounts.find(a => a.id === toAccountId);

    if (!fromAcc || !toAcc) {
      throw new Error('Invalid account selected for transfer');
    }

    if (fromAcc.balance < amount) {
      throw new Error(`Insufficient funds in source account ${fromAcc.name}! Balance: $${fromAcc.balance}`);
    }

    // Post balanced Journal Entry via server endpoint
    await this.createJournalEntry({
      date: getMogadishuDateString(),
      reference,
      description: `Fund Transfer: ${fromAcc.name} -> ${toAcc.name} (${description})`,
      source: 'Manual',
      status: 'Posted',
      createdBy: 'Accounting System',
      totalDebit: amount,
      totalCredit: amount,
      lines: [
        { id: `l1-${Date.now()}`, journalEntryId: '', accountId: toAcc.id, accountCode: toAcc.code, accountName: toAcc.name, debit: amount, credit: 0, memo: `Deposit into ${toAcc.name}` },
        { id: `l2-${Date.now()}`, journalEntryId: '', accountId: fromAcc.id, accountCode: fromAcc.code, accountName: fromAcc.name, debit: 0, credit: amount, memo: `Transfer out from ${fromAcc.name}` }
      ]
    });
  }

  // --- TAX ---
  async getTaxes(branchId?: string): Promise<TaxConfig[]> {
    try {
      if (!branchId || branchId === 'all') return [];
      const q = query(collection(db, COLLECTIONS.TAXES), where('branchId', '==', branchId));
      const snap = await getDocs(q);
      if (snap.empty) {
        return [];
      }
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as TaxConfig));
    } catch (err: any) {
      console.error('Error in getTaxes:', err?.message || err);
      throw err;
    }
  }

  async createTax(taxData: Omit<TaxConfig, 'id'>): Promise<TaxConfig> {
    return authFetch('/api/accounting/taxes', {
      method: 'POST',
      body: JSON.stringify(taxData)
    });
  }

  async updateTax(id: string, updates: Partial<TaxConfig>): Promise<void> {
    await authFetch(`/api/accounting/taxes/${id}`, {
      method: 'POST',
      body: JSON.stringify(updates)
    });
  }

  // --- FINANCIAL STATEMENTS ---
  async getFinancialStatements(startDate?: string, endDate?: string, branchId?: string): Promise<FinancialStatements> {
    const accounts = await this.getAccounts();
    const linesQuery = branchId && branchId !== 'all'
      ? query(collection(db, COLLECTIONS.JOURNAL_LINES), where('branchId', '==', branchId))
      : query(collection(db, COLLECTIONS.JOURNAL_LINES));
    const linesSnap = await getDocs(linesQuery);
    const allLines = linesSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    const lineDate = (l: any) => new Date(String(l.date || l.createdAt || ''));
    const inPeriod = (l: any) => {
      const d = lineDate(l);
      if (!Number.isFinite(d.getTime())) return false;
      if (start && d < start) return false;
      if (end) {
        const inclusiveEnd = new Date(end);
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(endDate || ''))) inclusiveEnd.setHours(23, 59, 59, 999);
        if (d > inclusiveEnd) return false;
      }
      return true;
    };
    const periodLines = (startDate || endDate) ? allLines.filter(inPeriod) : allLines;

    const deltaFor = (a: Account, l: any) => {
      const debit = Number(l.debit || 0);
      const credit = Number(l.credit || 0);
      const debitNature = ['Asset', 'COGS', 'Expense'].includes(a.type);
      return debitNature ? debit - credit : credit - debit;
    };
    const asOfBalance = (a: Account) => {
      let balance = Number(a.balance || 0);
      if (!end) return balance;
      for (const l of allLines) {
        if (String(l.accountId) !== String(a.id)) continue;
        const d = lineDate(l);
        if (Number.isFinite(d.getTime()) && d > end) balance -= deltaFor(a, l);
      }
      return Number.isFinite(balance) ? balance : 0;
    };
    const periodAmountByAccount = new Map<string, number>();
    for (const l of periodLines) {
      const id = String(l.accountId || '');
      const account = accounts.find(a => String(a.id) === id);
      if (!account) continue;
      const debit = Number(l.debit || 0);
      const credit = Number(l.credit || 0);
      if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0 || (debit > 0 && credit > 0)) continue;
      periodAmountByAccount.set(id, (periodAmountByAccount.get(id) || 0) + deltaFor(account, l));
    }

    const revenuesList = accounts.filter(a => a.type === 'Revenue').map(a => ({ accountCode: a.code, accountName: a.name, amount: Math.max(0, -(periodAmountByAccount.get(a.id) || 0)) }));
    const totalRevenue = revenuesList.reduce((s, r) => s + r.amount, 0);
    const cogsList = accounts.filter(a => a.type === 'COGS').map(a => ({ accountCode: a.code, accountName: a.name, amount: Math.max(0, periodAmountByAccount.get(a.id) || 0) }));
    const totalCOGS = cogsList.reduce((s, c) => s + c.amount, 0);
    const grossProfit = totalRevenue - totalCOGS;
    const expensesList = accounts.filter(a => a.type === 'Expense').map(a => ({ accountCode: a.code, accountName: a.name, amount: Math.max(0, periodAmountByAccount.get(a.id) || 0) }));
    const totalExpenses = expensesList.reduce((s, e) => s + e.amount, 0);
    const netProfit = grossProfit - totalExpenses;

    const assetsList = accounts.filter(a => a.type === 'Asset').map(a => ({ accountCode: a.code, accountName: a.name, amount: asOfBalance(a) }));
    const totalAssets = assetsList.reduce((s, a) => s + a.amount, 0);
    const liabilitiesList = accounts.filter(a => a.type === 'Liability').map(a => ({ accountCode: a.code, accountName: a.name, amount: asOfBalance(a) }));
    const totalLiabilities = liabilitiesList.reduce((s, l) => s + l.amount, 0);
    const equityList = accounts.filter(a => a.type === 'Equity').map(a => ({ accountCode: a.code, accountName: a.name, amount: asOfBalance(a) }));
    if (Math.abs(netProfit) > 0.005) equityList.push({ accountCode: 'CURRENT_EARNINGS', accountName: 'Current Period Earnings', amount: netProfit });
    const totalEquity = equityList.reduce((s, e) => s + e.amount, 0);
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    const isBalanced = Math.round(totalAssets * 100) === Math.round(totalLiabilitiesAndEquity * 100);

    const trialBalance = accounts.map(a => {
      const balance = asOfBalance(a);
      let debitBalance = 0;
      let creditBalance = 0;
      if (['Asset', 'COGS', 'Expense'].includes(a.type)) {
        if (balance >= 0) debitBalance = balance; else creditBalance = Math.abs(balance);
      } else {
        if (balance >= 0) creditBalance = balance; else debitBalance = Math.abs(balance);
      }
      return { accountCode: a.code, accountName: a.name, type: a.type, debitBalance, creditBalance };
    });
    const totalTrialDebit = trialBalance.reduce((s, t) => s + t.debitBalance, 0);
    const totalTrialCredit = trialBalance.reduce((s, t) => s + t.creditBalance, 0);
    const isTrialBalanced = Math.round(totalTrialDebit * 100) === Math.round(totalTrialCredit * 100);

    return {
      profitAndLoss: { revenue: revenuesList, totalRevenue, cogs: cogsList, totalCOGS, grossProfit, expenses: expensesList, totalExpenses, netProfit },
      balanceSheet: { assets: assetsList, totalAssets, liabilities: liabilitiesList, totalLiabilities, equity: equityList, totalEquity, totalLiabilitiesAndEquity, isBalanced },
      trialBalance, totalTrialDebit, totalTrialCredit, isTrialBalanced
    };
  }
}
