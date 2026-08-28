import { NewExpensePayload, BankTransactionPayload, FinancialSummary } from '../entities/financials';
import { Expense } from '../../types';

export interface IFinancialsRepository {
  fetchExpenses(branchId?: string): Promise<Expense[]>;
  createExpense(payload: NewExpensePayload, branchId?: string): Promise<Expense>;
  fetchFinancialSummary(branchId?: string): Promise<FinancialSummary>;
  addBankTransaction(payload: BankTransactionPayload): Promise<void>;
  getActiveTaxConfig(branchId?: string): Promise<any>;
}
