import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, COLLECTIONS, addExpenseFirestore, addBankTransactionFirestore } from '../../lib/firebase';
import { IFinancialsRepository } from '../../domain/repositories/IFinancialsRepository';
import { NewExpensePayload, BankTransactionPayload, FinancialSummary } from '../../domain/entities/financials';
import { Expense, Order } from '../../types';

export class FinancialsRepositoryImpl implements IFinancialsRepository {
  async fetchExpenses(branchId?: string): Promise<Expense[]> {
    const q = branchId && branchId !== 'all'
      ? query(collection(db, COLLECTIONS.EXPENSES), where('branchId', '==', branchId))
      : collection(db, COLLECTIONS.EXPENSES);
    const snap = await getDocs(q);
    const list: Expense[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as Expense));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createExpense(payload: NewExpensePayload, branchId?: string): Promise<Expense> {
    const effectiveBranchId = (payload as any).branchId || branchId || '';
    const data = {
      ...payload,
      category: ((payload.category || '').toLowerCase() as any) || 'other',
      createdAt: new Date().toISOString(),
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {})
    };
    const expenseId = await addExpenseFirestore(data as any);
    return { id: expenseId, ...data } as Expense;
  }

  async fetchFinancialSummary(branchId?: string): Promise<FinancialSummary> {
    const ordersQuery = branchId && branchId !== 'all'
      ? query(collection(db, COLLECTIONS.ORDERS), where('branchId', '==', branchId))
      : collection(db, COLLECTIONS.ORDERS);
    const expensesQuery = branchId && branchId !== 'all'
      ? query(collection(db, COLLECTIONS.EXPENSES), where('branchId', '==', branchId))
      : collection(db, COLLECTIONS.EXPENSES);

    const ordersSnap = await getDocs(ordersQuery);
    const expensesSnap = await getDocs(expensesQuery);

    let totalRevenue = 0;
    let totalCOGS = 0;
    ordersSnap.forEach(d => {
      const data = d.data() as Order;
      totalRevenue += data.totalAmount || 0;
      totalCOGS += data.cogs || 0;
    });

    let totalExpenses = 0;
    expensesSnap.forEach(d => {
      const data = d.data() as Expense;
      totalExpenses += data.amount || 0;
    });

    const netProfit = totalRevenue - totalExpenses - totalCOGS;
    const profitMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    
    const selectedTax = await this.getActiveTaxConfig(branchId);
    const taxRate = selectedTax.rate / 100;
    const taxLiability = totalRevenue * taxRate;

    return {
      totalRevenue,
      totalExpenses,
      totalCOGS,
      netProfit,
      profitMarginPercent,
      taxLiability
    };
  }

  async getActiveTaxConfig(branchId?: string): Promise<any> {
    const taxesSnap = await getDocs(collection(db, COLLECTIONS.TAXES));
    if (taxesSnap.empty) {
      throw new Error('No active tax configuration found.');
    }
    const activeTaxes = taxesSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(t => t.isActive !== false && t.status !== 'Inactive');
    
    if (activeTaxes.length === 0) {
      throw new Error('No active tax configuration found.');
    }

    let selectedTax: any = null;
    if (branchId && branchId !== 'all') {
      selectedTax = activeTaxes.find(t => t.branchId === branchId);
      if (!selectedTax) {
        throw new Error(`No active tax configuration found for branch ${branchId}.`);
      }
    } else {
      selectedTax = activeTaxes.find(t => t.branchId === 'all' || !t.branchId || t.isDefault);
      if (!selectedTax) {
        throw new Error('No active tax configuration found.');
      }
    }

    if (!selectedTax || typeof selectedTax.rate !== 'number' || !Number.isFinite(selectedTax.rate)) {
      throw new Error('Authoritative tax rate is invalid or missing.');
    }
    return selectedTax;
  }

  async addBankTransaction(payload: BankTransactionPayload): Promise<void> {
    await addBankTransactionFirestore(payload as any);
  }
}
