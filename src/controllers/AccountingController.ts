import { AccountingRepositoryImpl } from '../data/repositories/AccountingRepositoryImpl';
import {
  Account,
  JournalEntry,
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
  AccountingPeriod
} from '../domain/entities/accounting';

export class AccountingController {
  private repo = new AccountingRepositoryImpl();

  async fetchAccounts(): Promise<Account[]> {
    return await this.repo.getAccounts();
  }

  async addAccount(data: Omit<Account, 'id' | 'createdAt' | 'balance'>): Promise<Account> {
    if (!data.code || !data.name) {
      throw new Error('Account code and name are required.');
    }
    return await this.repo.createAccount(data);
  }

  async fetchJournalEntries(branchId?: string): Promise<JournalEntry[]> {
    return await this.repo.getJournalEntries(branchId);
  }

  async addJournalEntry(entry: Omit<JournalEntry, 'id' | 'createdAt' | 'entryNumber'>): Promise<JournalEntry> {
    if (!entry.lines || entry.lines.length < 2) {
      throw new Error('A journal entry requires at least 2 line items.');
    }
    return await this.repo.createJournalEntry(entry);
  }

  async fetchLedger(accountId?: string, startDate?: string, endDate?: string, branchId?: string): Promise<LedgerEntry[]> {
    return await this.repo.getLedger(accountId, startDate, endDate, branchId);
  }

  async fetchExpenses(branchId?: string): Promise<AccountingExpense[]> {
    return await this.repo.getExpenses(branchId);
  }

  async recordExpense(data: Omit<AccountingExpense, 'id' | 'createdAt' | 'expenseNumber'>): Promise<AccountingExpense> {
    if (!data.title || data.amount <= 0) {
      throw new Error('Expense title and positive amount are required.');
    }
    return await this.repo.createExpense(data);
  }

  async fetchRevenues(branchId?: string): Promise<AccountingRevenue[]> {
    return await this.repo.getRevenues(branchId);
  }

  async recordRevenue(data: Omit<AccountingRevenue, 'id' | 'createdAt' | 'revenueNumber'>): Promise<AccountingRevenue> {
    if (data.amount <= 0) {
      throw new Error('Revenue amount must be greater than zero.');
    }
    return await this.repo.createRevenue(data);
  }

  async fetchReceivables(branchId?: string): Promise<ReceivableItem[]> {
    return await this.repo.getReceivables(branchId);
  }

  async addReceivable(data: Omit<ReceivableItem, 'id' | 'createdAt' | 'paidAmount' | 'remainingBalance' | 'status' | 'payments'>): Promise<ReceivableItem> {
    return await this.repo.createReceivable(data);
  }

  async addARPayment(receivableId: string, payment: { amount: number; paymentMethod: 'Cash' | 'Bank'; date: string; reference?: string; notes?: string }): Promise<void> {
    if (payment.amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }
    await this.repo.recordARPayment(receivableId, payment);
  }

  async fetchPayables(branchId?: string): Promise<PayableItem[]> {
    return await this.repo.getPayables(branchId);
  }

  async addPayable(data: Omit<PayableItem, 'id' | 'createdAt' | 'paidAmount' | 'remainingBalance' | 'status' | 'payments'>): Promise<PayableItem> {
    return await this.repo.createPayable(data);
  }

  async addAPPayment(payableId: string, payment: { amount: number; paymentMethod: 'Cash' | 'Bank'; date: string; reference?: string; notes?: string }): Promise<void> {
    if (payment.amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }
    await this.repo.recordAPPayment(payableId, payment);
  }

  async fetchCashRegisters(branchId?: string): Promise<CashRegister[]> {
    return await this.repo.getCashRegisters(branchId);
  }

  async openRegister(registerName: string, branchName: string, openingBalance: number, openedBy: string, branchId?: string): Promise<CashRegister> {
    return await this.repo.openCashRegister(registerName, branchName, openingBalance, openedBy, branchId);
  }

  async closeRegister(id: string, actualClosingBalance: number, closedBy: string, notes?: string): Promise<void> {
    await this.repo.closeCashRegister(id, actualClosingBalance, closedBy, notes);
  }

  async fetchBankAccounts(): Promise<BankAccount[]> {
    return await this.repo.getBankAccounts();
  }

  async addBankAccount(data: Omit<BankAccount, 'id' | 'createdAt' | 'currentBalance'>, initialBalance?: number): Promise<BankAccount> {
    return await this.repo.createBankAccount(data, initialBalance);
  }

  async fetchBankTransactions(bankAccountId?: string, branchId?: string): Promise<BankTransaction[]> {
    return await this.repo.getBankTransactions(bankAccountId, branchId);
  }

  async recordBankTransaction(txData: {
    bankAccountId: string;
    type: 'deposit' | 'withdrawal' | 'fee';
    amount: number;
    reference?: string;
    description?: string;
    date?: string;
    branchId?: string;
  }): Promise<any> {
    if (!txData.bankAccountId) {
      throw new Error('Bank account is required.');
    }
    if (!Number.isFinite(txData.amount) || txData.amount <= 0) {
      throw new Error('Transaction amount must be positive.');
    }
    return await this.repo.recordBankTransaction(txData);
  }

  async transfer(fromAccountId: string, toAccountId: string, amount: number, reference: string, description: string): Promise<void> {
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive.');
    }
    await this.repo.transferFunds(fromAccountId, toAccountId, amount, reference, description);
  }

  async fetchTaxes(branchId?: string): Promise<TaxConfig[]> {
    return await this.repo.getTaxes(branchId);
  }

  async addTax(data: Omit<TaxConfig, 'id'>): Promise<TaxConfig> {
    return await this.repo.createTax(data);
  }

  async fetchFinancialStatements(startDate?: string, endDate?: string, branchId?: string): Promise<FinancialStatements> {
    return await this.repo.getFinancialStatements(startDate, endDate, branchId);
  }

  async fetchAccountingPeriods(branchId?: string): Promise<AccountingPeriod[]> {
    return await this.repo.getAccountingPeriods(branchId);
  }

  async saveAccountingPeriod(period: {
    id?: string;
    name: string;
    startDate: string;
    endDate: string;
    status: 'Open' | 'Closed' | 'Locked';
    branchId?: string;
    notes?: string;
  }): Promise<AccountingPeriod> {
    if (!period.name || !period.startDate || !period.endDate) {
      throw new Error('Period name, start date, and end date are required.');
    }
    return await this.repo.saveAccountingPeriod(period);
  }

  async changeAccountingPeriodStatus(id: string, status: 'Open' | 'Closed' | 'Locked'): Promise<AccountingPeriod> {
    return await this.repo.updateAccountingPeriodStatus(id, status);
  }
}
