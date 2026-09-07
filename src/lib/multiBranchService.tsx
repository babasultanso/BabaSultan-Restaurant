import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where,
  writeBatch
} from 'firebase/firestore';
import { db, COLLECTIONS, getAuthToken } from './firebase';
import { getApiUrl } from './apiConfig';
import { 
  Branch, 
  BranchStatus, 
  BranchHierarchyType, 
  BranchTransfer, 
  TransferStatus, 
  TransferItem, 
  Order, 
  Expense, 
  Employee, 
  Ingredient, 
  Product, 
  Customer 
} from '../types';

// Branch Firestore Actions
export async function createBranch(branchData: Omit<Branch, 'id' | 'createdAt'>): Promise<string> {
  const newRef = doc(collection(db, COLLECTIONS.BRANCHES));
  const newBranch: Branch = {
    ...branchData,
    id: newRef.id,
    branchId: newRef.id,
    createdAt: new Date().toISOString()
  };
  await setDoc(newRef, newBranch);
  return newRef.id;
}

export async function updateBranch(branchId: string, updates: Partial<Branch>): Promise<void> {
  const ref = doc(db, COLLECTIONS.BRANCHES, branchId);
  await updateDoc(ref, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
}

export async function disableBranch(branchId: string): Promise<void> {
  await updateBranch(branchId, { status: 'inactive' });
}

export async function deleteBranch(branchId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.BRANCHES, branchId);
  await updateDoc(ref, {
    status: 'inactive',
    isDeleted: true,
    updatedAt: new Date().toISOString()
  });
}

// Branch Inter-Transfer Actions
export async function createBranchTransfer(
  transferData: Omit<BranchTransfer, 'id' | 'transferNumber' | 'createdAt' | 'status'>
): Promise<string> {
  const sourceBranchId = String(transferData.sourceBranchId || '').trim();
  const destinationBranchId = String(transferData.destinationBranchId || '').trim();
  if (!sourceBranchId || !destinationBranchId || sourceBranchId === destinationBranchId) throw new Error('Valid, different source and destination branches are required.');
  if ((transferData.transferType === 'inventory' || transferData.transferType === 'product') && (!Array.isArray(transferData.items) || transferData.items.length === 0)) throw new Error('Inventory/product transfer requires at least one real item.');
  if (transferData.transferType === 'employee' && !transferData.employeeId) throw new Error('Employee transfer requires employeeId.');
  if (transferData.transferType === 'cash' && (!(Number(transferData.cashAmount) > 0))) throw new Error('Cash transfer requires a positive cashAmount.');
  for (const item of transferData.items || []) if (!item.itemId || !(Number(item.quantity) > 0)) throw new Error('Every transfer item requires a real itemId and positive quantity.');
  const token = await getAuthToken();
  const idempotencyKey = `branch-transfer-create:${sourceBranchId}:${destinationBranchId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const res = await fetch(getApiUrl('/api/branch-transfers'), { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,'Idempotency-Key':idempotencyKey}, body:JSON.stringify({ transferData:{...transferData,idempotencyKey} }) });
  if (!res.ok) { let message='Branch transfer creation failed.'; try { message=(await res.json())?.error||message; } catch {} throw new Error(message); }
  const data=await res.json(); return String(data.id || data.transfer?.id);
}

export async function approveBranchTransfer(transferId: string, approverName: string): Promise<void> {
  const token = await getAuthToken();
  const idempotencyKey = `branch-transfer-approve:${transferId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const res = await fetch(getApiUrl(`/api/branch-transfers/${encodeURIComponent(transferId)}/approve`), { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,'Idempotency-Key':idempotencyKey}, body:JSON.stringify({ approverName }) });
  if (!res.ok) { let message='Branch transfer approval failed.'; try { message=(await res.json())?.error || message; } catch {} throw new Error(message); }
}

export async function rejectBranchTransfer(transferId: string, approverName: string, reason: string): Promise<void> {
  const token = await getAuthToken();
  const idempotencyKey = `branch-transfer-reject:${transferId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const res = await fetch(getApiUrl(`/api/branch-transfers/${encodeURIComponent(transferId)}/reject`), { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,'Idempotency-Key':idempotencyKey}, body:JSON.stringify({ approverName, reason }) });
  if (!res.ok) { let message='Branch transfer rejection failed.'; try { message=(await res.json())?.error || message; } catch {} throw new Error(message); }
}

// Consolidated Multi-Branch Analytics Engine
export interface ConsolidatedAnalyticsPackage {
  branches: Branch[];
  orders: Order[];
  expenses: Expense[];
  employees: Employee[];
  ingredients: Ingredient[];
  products: Product[];
  customers: Customer[];
  transfers: BranchTransfer[];
}

export function calculateConsolidatedBranchAnalytics(pkg: ConsolidatedAnalyticsPackage) {
  const safeArray = <T,>(arr: any): T[] => (Array.isArray(arr) ? arr.filter(Boolean) : []);
  
  const branches = safeArray<Branch>(pkg?.branches);
  const orders = safeArray<Order>(pkg?.orders);
  const expenses = safeArray<Expense>(pkg?.expenses);
  const employees = safeArray<Employee>(pkg?.employees);
  const ingredients = safeArray<Ingredient>(pkg?.ingredients);
  const products = safeArray<Product>(pkg?.products);
  const customers = safeArray<Customer>(pkg?.customers);
  const transfers = safeArray<BranchTransfer>(pkg?.transfers);

  const totalBranchesCount = branches.length;
  const activeBranchesCount = branches.filter((b) => b?.status === 'active').length;

  // Completed Orders across all branches
  const completedOrders = orders.filter((o) => o?.status === 'completed' || o?.prepStatus === 'delivered');

  const totalConsolidatedSales = completedOrders.reduce((sum, o) => sum + (typeof o?.totalAmount === 'number' && !isNaN(o.totalAmount) ? o.totalAmount : 0), 0);
  const totalConsolidatedOrders = completedOrders.length;
  const totalConsolidatedExpenses = expenses.reduce((sum, e) => sum + (typeof e?.amount === 'number' && !isNaN(e.amount) ? e.amount : 0), 0);
  
  // Calculate COGS - using strictly actual order COGS when available (no 45% estimation)
  const totalConsolidatedCOGS = completedOrders.reduce((sum, o) => sum + (typeof o?.cogs === 'number' && !isNaN(o.cogs) ? o.cogs : 0), 0);
  const grossProfit = totalConsolidatedSales - totalConsolidatedCOGS;
  const totalConsolidatedProfit = grossProfit - totalConsolidatedExpenses;

  // Total Inventory Valuation across branches
  const totalInventoryValuation = ingredients.reduce((sum, i) => sum + ((typeof i?.stock === 'number' ? i.stock : 0) * (typeof i?.costPerUnit === 'number' ? i.costPerUnit : 0)), 0) +
                                   products.reduce((sum, p) => sum + ((typeof p?.stock === 'number' ? p.stock : 0) * (typeof p?.cost === 'number' ? p.cost : 0)), 0);

  // Total Employees
  const totalEmployeesCount = employees.length;

  // Branch Performance Ranking Table
  const branchMetrics = branches.map((b) => {
    const bId = b?.id || '';
    const bName = b?.name || 'Unnamed Branch';
    const bCode = b?.code || 'BR-00';
    const bCity = b?.city || 'Main City';

    // Filter orders for this branch by branch ID or branch name matching
    const bOrders = completedOrders.filter((o) => {
      const oBranchId = (o as any)?.branchId;
      const oBranchName = (o as any)?.branch;
      return (oBranchId && oBranchId === bId) || (oBranchName && (oBranchName === bName || bName.includes(oBranchName)));
    });
    
    const branchSales = bOrders.reduce((sum, o) => sum + (typeof o?.totalAmount === 'number' && !isNaN(o.totalAmount) ? o.totalAmount : 0), 0);
    const branchOrdersCount = bOrders.length;

    const bExpenses = expenses.filter((e) => {
      const eBranchId = (e as any)?.branchId;
      const eBranchName = (e as any)?.branch;
      return (eBranchId && eBranchId === bId) || (eBranchName && (eBranchName === bName || bName.includes(eBranchName)));
    });
    const branchExpenses = bExpenses.reduce((sum, e) => sum + (typeof e?.amount === 'number' && !isNaN(e.amount) ? e.amount : 0), 0);

    const branchCOGS = bOrders.reduce((sum, o) => sum + (typeof o?.cogs === 'number' && !isNaN(o.cogs) ? o.cogs : 0), 0);
    const branchNetProfit = branchSales - branchCOGS - branchExpenses;

    const bEmployees = employees.filter((emp) => {
      const empBranchId = (emp as any)?.branchId;
      const empBranchName = emp?.branch;
      return (empBranchId && empBranchId === bId) || (empBranchName && (empBranchName === bName || bName.includes(empBranchName)));
    });
    const employeeCount = bEmployees.length;

    return {
      branchId: bId,
      branchName: bName,
      branchCode: bCode,
      city: bCity,
      status: b?.status || 'active',
      isHeadOffice: !!b?.isHeadOffice,
      sales: typeof branchSales === 'number' && !isNaN(branchSales) ? branchSales : 0,
      ordersCount: typeof branchOrdersCount === 'number' && !isNaN(branchOrdersCount) ? branchOrdersCount : 0,
      expenses: typeof branchExpenses === 'number' && !isNaN(branchExpenses) ? branchExpenses : 0,
      netProfit: typeof branchNetProfit === 'number' && !isNaN(branchNetProfit) ? branchNetProfit : 0,
      employeeCount: typeof employeeCount === 'number' && !isNaN(employeeCount) ? employeeCount : 0,
      inventoryValuation: totalBranchesCount > 0 ? totalInventoryValuation / totalBranchesCount : 0,
      profitMargin: branchSales > 0 ? Math.round((branchNetProfit / branchSales) * 100) : 0
    };
  });

  // Sort by Sales for Ranking
  const rankedBranches = [...branchMetrics].sort((a, b) => b.sales - a.sales);
  const topBranch = rankedBranches[0] || null;
  const lowestBranch = rankedBranches[rankedBranches.length - 1] || null;

  // Inter-Branch Transfers summary
  const pendingTransfers = transfers.filter((t) => t?.status === 'pending');
  const completedTransfers = transfers.filter((t) => t?.status === 'completed' || t?.status === 'approved');

  return {
    totalBranchesCount,
    activeBranchesCount,
    totalConsolidatedSales: typeof totalConsolidatedSales === 'number' && !isNaN(totalConsolidatedSales) ? totalConsolidatedSales : 0,
    totalConsolidatedOrders: typeof totalConsolidatedOrders === 'number' && !isNaN(totalConsolidatedOrders) ? totalConsolidatedOrders : 0,
    totalConsolidatedExpenses: typeof totalConsolidatedExpenses === 'number' && !isNaN(totalConsolidatedExpenses) ? totalConsolidatedExpenses : 0,
    totalConsolidatedProfit: typeof totalConsolidatedProfit === 'number' && !isNaN(totalConsolidatedProfit) ? totalConsolidatedProfit : 0,
    totalInventoryValuation: typeof totalInventoryValuation === 'number' && !isNaN(totalInventoryValuation) ? totalInventoryValuation : 0,
    totalEmployeesCount,
    totalCustomersCount: customers.length,
    rankedBranches,
    topBranch,
    lowestBranch,
    pendingTransfers,
    completedTransfers
  };
}
