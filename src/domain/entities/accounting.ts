export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'COGS' | 'Expense';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId?: string;
  parentName?: string;
  balance: number;
  currency: string;
  isSystem: boolean;
  description?: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
}

export type JournalSource = 
  | 'Manual' 
  | 'Sales' 
  | 'Purchases' 
  | 'Expense' 
  | 'Payroll' 
  | 'Refund' 
  | 'SupplierPayment' 
  | 'InventoryAdjustment';

export interface JournalLine {
  id?: string;
  journalEntryId?: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  reference: string;
  description: string;
  source: JournalSource;
  status: 'Draft' | 'Posted' | 'Voided';
  totalDebit: number;
  totalCredit: number;
  lines: JournalLine[];
  branchId?: string;
  branch?: string;
  createdBy: string;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  journalEntryId: string;
  entryNumber: string;
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  createdAt: string;
}

export type ExpenseCategory = 
  | 'Rent' 
  | 'Electricity' 
  | 'Water' 
  | 'Internet' 
  | 'Gas' 
  | 'Salaries' 
  | 'Marketing' 
  | 'Maintenance' 
  | 'Transportation' 
  | 'Miscellaneous';

export interface AccountingExpense {
  id: string;
  expenseNumber: string;
  category: ExpenseCategory;
  title: string;
  amount: number;
  taxAmount: number;
  vendorId?: string;
  vendorName?: string;
  paymentMethod: 'Cash' | 'Bank' | 'Accounts Payable';
  expenseAccountId: string;
  paidFromAccountId: string;
  date: string;
  status: 'Paid' | 'Pending' | 'Cancelled';
  notes?: string;
  receiptImage?: string;
  branchId?: string;
  branch?: string;
  createdAt: string;
}

export interface AccountingRevenue {
  id: string;
  revenueNumber: string;
  category: 'Restaurant Sales' | 'Catering' | 'Delivery' | 'Other Revenue';
  amount: number;
  taxAmount: number;
  customerId?: string;
  customerName?: string;
  paymentMethod: 'Cash' | 'Bank' | 'Accounts Receivable';
  revenueAccountId: string;
  depositToAccountId: string;
  date: string;
  notes?: string;
  branchId?: string;
  branch?: string;
  createdAt: string;
}

export interface ARPayment {
  id: string;
  date: string;
  amount: number;
  paymentMethod: 'Cash' | 'Bank';
  reference?: string;
  notes?: string;
}

export interface ReceivableItem {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  status: 'Unpaid' | 'Partial' | 'Paid' | 'Overdue';
  payments: ARPayment[];
  branchId?: string;
  branch?: string;
  createdAt: string;
}

export interface APPayment {
  id: string;
  date: string;
  amount: number;
  paymentMethod: 'Cash' | 'Bank';
  reference?: string;
  notes?: string;
}

export interface PayableItem {
  id: string;
  billNumber: string;
  supplierId: string;
  supplierName: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  status: 'Unpaid' | 'Partial' | 'Paid' | 'Overdue';
  payments: APPayment[];
  branchId?: string;
  branch?: string;
  createdAt: string;
}

export interface CashRegister {
  id: string;
  registerName: string;
  branchName: string;
  branchId?: string;
  branch?: string;
  openedBy: string;
  openedAt: string;
  closedBy?: string;
  closedAt?: string;
  openingBalance: number;
  cashSales: number;
  cashPayouts: number;
  expectedClosingBalance: number;
  actualClosingBalance?: number;
  difference?: number;
  status: 'Open' | 'Closed' | 'Reconciled';
  notes?: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  swiftCode?: string;
  branchName?: string;
  branchId?: string;
  branch?: string;
  currentBalance: number;
  currency: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  type: 'Deposit' | 'Withdrawal' | 'TransferIn' | 'TransferOut' | 'Fee';
  amount: number;
  date: string;
  reference: string;
  description: string;
  reconciled: boolean;
  branchId?: string;
  branch?: string;
  createdAt: string;
}

export interface TaxConfig {
  id: string;
  name: string;
  code: string;
  rate: number; // e.g. 5 for 5%
  type: 'Sales' | 'Purchase' | 'Both';
  isDefault: boolean;
  status: 'Active' | 'Inactive';
  branchId?: string;
  branch?: string;
}

export interface FinancialStatements {
  profitAndLoss: {
    revenue: { accountCode: string; accountName: string; amount: number }[];
    totalRevenue: number;
    cogs: { accountCode: string; accountName: string; amount: number }[];
    totalCOGS: number;
    grossProfit: number;
    expenses: { accountCode: string; accountName: string; amount: number }[];
    totalExpenses: number;
    netProfit: number;
  };
  balanceSheet: {
    assets: { accountCode: string; accountName: string; amount: number }[];
    totalAssets: number;
    liabilities: { accountCode: string; accountName: string; amount: number }[];
    totalLiabilities: number;
    equity: { accountCode: string; accountName: string; amount: number }[];
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
    isBalanced: boolean;
  };
  trialBalance: {
    accountCode: string;
    accountName: string;
    type: AccountType;
    debitBalance: number;
    creditBalance: number;
  }[];
  totalTrialDebit: number;
  totalTrialCredit: number;
  isTrialBalanced: boolean;
}
