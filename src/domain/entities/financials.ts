export interface NewExpensePayload {
  title: string;
  amount: number;
  category: string;
  description?: string;
  createdBy: string;
}

export interface BankTransactionPayload {
  accountName: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  category: string;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  totalCOGS: number;
  netProfit: number;
  profitMarginPercent: number;
  taxLiability: number;
}
