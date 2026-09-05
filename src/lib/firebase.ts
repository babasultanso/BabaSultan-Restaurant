import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  runTransaction,
  enableMultiTabIndexedDbPersistence,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import defaultFirebaseConfig from '../../firebase-applet-config.json';
import { handleFirestoreError, OperationType } from '../infrastructure/firebase/errorHandler';
import {
  Order,
  OrderStatus,
  Product,
  Category,
  ProductOption,
  ProductOptionChoice,
  RecipeIngredient,
  Ingredient,
  Recipe,
  EquipmentItem,
  Expense,
  Purchase,
  Employee,
  SalaryPayment,
  Supplier,
  InventoryMovement,
  CustomerRefund,
  BankTransaction,
  FinancialAccount,
  UserRecord,
  ActivityLog,
  Customer,
  DiningTable,
  Payment,
  HoldOrder,
  JournalLine,
  JournalEntry,
  DeliveryDriver
} from '../types';
import { getApiUrl } from './apiConfig';
export { getApiUrl };

// Build active Firebase config using explicit environment values when supplied.
// VITE_FIREBASE_PROJECT_ID is required for production builds.
// Production builds must explicitly name their Firebase project to prevent a bundled
// test configuration from silently becoming the production data source.
const env = (import.meta as any).env || {};
const requiredProductionFirebaseEnv = [
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
] as const;
if (env.PROD) {
  const missing = requiredProductionFirebaseEnv.filter((name) => !env[name] || String(env[name]).trim() === '');
  if (missing.length > 0) {
    throw new Error(`Missing required Firebase production configuration: ${missing.join(', ')}`);
  }
}
const resolvedFirebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || defaultFirebaseConfig.measurementId
};

const app = initializeApp(resolvedFirebaseConfig);

export const auth = getAuth(app);

export async function getAuthToken(): Promise<string> {
  try {
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken();
    }
  } catch (e) {
    console.warn('Failed to retrieve auth token:', e);
  }
  return '';
}

// Initialize Firestore using named database ID from config or env if provided
const firestoreDbId = env.VITE_FIREBASE_DATABASE_ID || (!env.PROD ? (defaultFirebaseConfig as any).firestoreDatabaseId : undefined);
export const db = firestoreDbId ? getFirestore(app, firestoreDbId) : getFirestore(app);



// Enable Official Firestore Offline Persistence
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      enableIndexedDbPersistence(db).catch((e) => {
        console.warn('Firestore offline persistence notice:', e);
      });
    } else if (err.code === 'unimplemented') {
      console.warn('Browser does not support multi-tab Firestore offline persistence');
    }
  });
}

// Collection References
export const COLLECTIONS = {
  USERS: 'users',
  ACTIVITY_LOGS: 'activity_logs',
  ORDERS: 'orders',
  PRODUCTS: 'products',
  INGREDIENTS: 'ingredients',
  EXPENSES: 'expenses',
  PURCHASES: 'purchases',
  EMPLOYEES: 'employees',
  SALARIES: 'salaries',
  SUPPLIERS: 'suppliers',
  MOVEMENTS: 'inventory_movements',
  INVENTORY_MOVEMENTS: 'inventory_movements',
  REFUNDS: 'refunds',
  BANK_TRANSACTIONS: 'bank_transactions',
  ACCOUNTS: 'accounts',
  CATEGORIES: 'categories',
  CUSTOMERS: 'customers',
  BRANCHES: 'branches',
  RECIPES: 'recipes',
  REVENUES: 'revenues',
  AI_SETTINGS: 'ai_settings',
  PERMISSIONS: 'permissions',
  PRODUCT_OPTIONS: 'product_options',

  // Operations Manager Collections
  DELIVERY_DRIVERS: 'drivers',
  STATIONS: 'kitchen_stations',
  ATTENDANCE: 'employee_attendance',
  RESERVATIONS: 'reservations',
  FEEDBACKS: 'customer_feedbacks',
  EQUIPMENT: 'equipment_items',

  // Phase 5 Collections
  PAYMENTS: 'payments',
  TABLES: 'dining_tables',
  HOLD_ORDERS: 'hold_orders',

  // Phase 6 Collections
  KITCHEN_ORDERS: 'kitchen_orders',
  KITCHEN_WASTE: 'kitchen_waste',
  NOTIFICATIONS: 'notifications',
  NOTIFICATION_TOKENS: 'notification_tokens',

  // Phase 7 Collections
  INVENTORY: 'inventory',
  PURCHASE_ORDERS: 'purchase_orders',
  PURCHASE_ITEMS: 'purchase_items',
  SUPPLIER_PAYMENTS: 'supplier_payments',

  // Phase 8 CRM Collections
  CUSTOMER_WALLETS: 'customer_wallets',
  WALLET_TRANSACTIONS: 'wallet_transactions',
  CUSTOMER_POINTS: 'customer_points',
  CUSTOMER_REWARDS: 'customer_rewards',
  CUSTOMER_COUPONS: 'customer_coupons',
  CUSTOMER_NOTIFICATIONS: 'customer_notifications',

  // Phase 9 HRM Collections
  HRM_EMPLOYEES: 'employees',
  HRM_ATTENDANCE: 'employee_attendance',
  HRM_SHIFTS: 'shifts',
  HRM_PAYROLL: 'payroll',
  HRM_LEAVE_REQUESTS: 'leave_requests',
  HRM_EMPLOYEE_DOCUMENTS: 'employee_documents',
  HRM_PERFORMANCE: 'performance',
  HRM_EMPLOYEE_NOTIFICATIONS: 'employee_notifications',

  // Phase 10 Accounting Collections
  JOURNAL_ENTRIES: 'journal_entries',
  JOURNAL_LINES: 'journal_lines',
  LEDGER: 'ledger',
  CASH_REGISTERS: 'cash_registers',
  BANK_ACCOUNTS: 'bank_accounts',
  RECEIVABLES: 'receivables',
  PAYABLES: 'payables',
  TAXES: 'taxes',
  FINANCIAL_REPORTS: 'financial_reports',

  // Phase 13 Multi-Branch Collections
  BRANCH_SETTINGS: 'branch_settings',
  BRANCH_TRANSFERS: 'branch_transfers',
  BRANCH_INVENTORY: 'branch_inventory',
  BRANCH_REPORTS: 'branch_reports',
  EMPLOYEE_TRANSFERS: 'employee_transfers',
  CASH_TRANSFERS: 'cash_transfers',

  // Phase 14 Delivery Management & Logistics Collections
  DRIVERS: 'drivers',
  DELIVERIES: 'deliveries',
  DELIVERY_TRACKING: 'delivery_tracking',
  DELIVERY_ZONES: 'delivery_zones',
  DELIVERY_REPORTS: 'delivery_reports',
  DELIVERY_NOTIFICATIONS: 'delivery_notifications'
};

// Firestore Action Helpers required by user request:

export async function executeAIActionFirestore(actionType: string, payload: any) {
  const token = await getAuthToken();
  const response = await fetch(getApiUrl('/api/ai/execute-action'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ actionType, payload })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `AI Action Execution Failed (${response.status})`);
  }

  return await response.json();
}

export async function addExpenseFirestore(data: Omit<Expense, 'id' | 'createdAt'>) {
  const token = await getAuthToken();
  const idempotencyKey = (data as any).idempotencyKey || `expense:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const response = await fetch(getApiUrl('/api/expenses'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ expenseData: { ...data, idempotencyKey } })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Expense Creation Failed (${response.status})`);
  }

  const result = await response.json();
  return result.id;
}

export async function addPurchaseFirestore(data: Omit<Purchase, 'id' | 'createdAt'>) {
  const token = await getAuthToken();
  const idempotencyKey = (data as any).idempotencyKey || `purchase:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const response = await fetch(getApiUrl('/api/purchases'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ purchaseData: { ...data, idempotencyKey } })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Purchase Registration Failed (${response.status})`);
  }

  const result = await response.json();
  return result.id;
}

export async function addSalaryFirestore(data: Omit<SalaryPayment, 'id' | 'paidDate'>) {
  const token = await getAuthToken();
  const idempotencyKey = (data as any).idempotencyKey || `salary:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const response = await fetch(getApiUrl('/api/salaries'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ salaryData: { ...data, idempotencyKey } })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Salary Disbursement Failed (${response.status})`);
  }

  const result = await response.json();
  return result.id;
}

export async function recordInventoryMovementFirestore(data: Omit<InventoryMovement, 'id' | 'createdAt'> & { itemType?: 'inventory' | 'ingredient' | 'product' }) {
  const token = await getAuthToken();
  const idempotencyKey = globalThis.crypto?.randomUUID?.() || `inventory-movement:${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const movementData = {
    ...data,
    itemType: data.itemType || 'inventory',
    idempotencyKey
  };
  const response = await fetch(getApiUrl('/api/inventory/adjust'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ movementData })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Inventory Adjustment Failed (${response.status})`);
  }

  const result = await response.json();
  return result.id;
}

export async function updateProductStockFirestore(productId: string, newStock: number) {
  const token = await getAuthToken();
  const idempotencyKey = `product-stock:${productId}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const response = await fetch(getApiUrl('/api/inventory/stock'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ productId, newStock, idempotencyKey })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Stock Update Failed (${response.status})`);
  }
}

export async function addOrderFirestore(data: Omit<Order, 'id' | 'createdAt'>) {
  return createOrderFirestore(data as any).then(order => order.id);
}

export async function addRefundFirestore(data: Omit<CustomerRefund, 'id' | 'createdAt'>) {
  if (!data.orderId) {
    throw new Error('Order ID is required to process a refund.');
  }

  const token = await getAuthToken();
  const idempotencyKey = (data as any).idempotencyKey || `REF-${data.orderId}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const response = await fetch(getApiUrl(`/api/orders/${data.orderId}/refund`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      amount: data.amount,
      reason: data.reason,
      paymentMethod: (data as any).paymentMethod,
      idempotencyKey
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Refund Processing Failed (${response.status})`);
  }

  const result = await response.json();
  return result.refundId;
}

export async function addBankTransactionFirestore(data: Omit<BankTransaction, 'id' | 'createdAt'>) {
  const token = await getAuthToken();
  const idempotencyKey = (data as any).idempotencyKey || `bank-transaction:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const response = await fetch(getApiUrl('/api/bank-transactions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ bankTransactionData: { ...data, idempotencyKey } })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Bank Transaction Failed (${response.status})`);
  }

  const result = await response.json();
  return result.id;
}

export async function updateAccountBalanceFirestore(accountId: string, newBalance: number) {
  // Account balances are managed automatically on the server via trusted financial endpoints
  return;
}

// Operational Actions
export async function assignDriverToOrderFirestore(orderId: string, driverId: string, driverName: string) {
  await assignDeliveryDriverFirestore(orderId, driverId, driverName);
}

export async function resolveCustomerFeedbackFirestore(feedbackId: string) {
  const feedbackRef = doc(db, COLLECTIONS.FEEDBACKS, feedbackId);
  await updateDoc(feedbackRef, { status: 'resolved' });
}

// ==========================================
// Phase 2: User Management & Activity Logs
// ==========================================

export async function logActivityFirestore(logData: { action: string; details?: string; [key: string]: any }) {
  try {
    const token = await getAuthToken();
    const payload = {
      action: logData.action,
      details: logData.details || ''
    };
    const response = await fetch(getApiUrl('/api/audit/activity'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn('Activity log recording via backend failed:', errorData.error);
      return null;
    }
    const result = await response.json();
    return result.log || null;
  } catch (err) {
    console.warn('Failed to record activity log via backend:', err);
    return null;
  }
}

export async function upsertUserRecordFirestore(userRecord: UserRecord) {
  const userRef = doc(db, COLLECTIONS.USERS, userRecord.uid);
  await setDoc(userRef, userRecord, { merge: true });
}

export async function updateUserRoleFirestore(uid: string, role: any, _updatedBy?: string) {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  await updateDoc(userRef, { role });
  await logActivityFirestore({
    action: 'UPDATE_ROLE',
    details: `Updated role for user ${uid} to ${role}`
  });
}

export async function updateUserStatusFirestore(uid: string, status: 'active' | 'suspended' | 'pending', _updatedBy?: string) {
  const userRef = doc(db, COLLECTIONS.USERS, uid);
  await updateDoc(userRef, { status });
  await logActivityFirestore({
    action: 'UPDATE_STATUS',
    details: `Updated status for user ${uid} to ${status}`
  });
}

// ==========================================
// Phase 4: Product & Restaurant Menu Management
// ==========================================

export function getEffectiveBranchId(preferredBranchId?: string): string {
  if (preferredBranchId && preferredBranchId.trim() !== '') {
    return preferredBranchId.trim();
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('user_profile');
      if (stored) {
        const u = JSON.parse(stored);
        if (u.branchId && u.branchId.trim() !== '') return u.branchId.trim();
        if (u.branch && u.branch.trim() !== '') return u.branch.trim();
      }
    } catch {}
  }
  throw new Error('Branch ID is required for this operation. No valid branch context found.');
}

export async function addProductFirestore(data: Omit<Product, 'id'>, branchIdOverride?: string) {
  const createdAt = new Date().toISOString();
  const effectiveBranchId = getEffectiveBranchId(data.branchId || branchIdOverride);
  const docRef = await addDoc(collection(db, COLLECTIONS.PRODUCTS), {
    ...data,
    branchId: effectiveBranchId,
    branch: data.branch || effectiveBranchId,
    availabilityStatus: data.availabilityStatus || 'enabled',
    createdAt,
    updatedAt: createdAt
  });
  return docRef.id;
}

export async function updateProductFirestore(productId: string, data: Partial<Product>) {
  const idempotencyKey = globalThis.crypto?.randomUUID?.() || `product-update:${productId}:${Date.now()}`;
  const { stock, currentStock, quantityOnHand, reservedStock, salesCount, branchId, ...safeData } = data as any;
  if (stock !== undefined) {
    const token = await getAuthToken();
    const res = await fetch(getApiUrl('/api/inventory/stock'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ productId, newStock: Number(stock), idempotencyKey })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to update product stock: HTTP ${res.status}`);
    }
  }

  if (Object.keys(safeData).length > 0) {
    const productRef = doc(db, COLLECTIONS.PRODUCTS, productId);
    await updateDoc(productRef, {
      ...safeData,
      updatedAt: new Date().toISOString()
    });
  }
}

export async function deleteProductFirestore(productId: string) {
  const productRef = doc(db, COLLECTIONS.PRODUCTS, productId);
  await updateDoc(productRef, {
    isActive: false,
    isArchived: true,
    deletedAt: new Date().toISOString(),
    availabilityStatus: 'disabled'
  });
}

export async function toggleProductAvailabilityFirestore(productId: string, status: 'enabled' | 'disabled' | 'out_of_stock') {
  const productRef = doc(db, COLLECTIONS.PRODUCTS, productId);
  await updateDoc(productRef, {
    availabilityStatus: status,
    updatedAt: new Date().toISOString()
  });
}

// Category Operations
export async function addCategoryFirestore(data: Omit<Category, 'id'>, branchIdOverride?: string) {
  const createdAt = new Date().toISOString();
  const effectiveBranchId = getEffectiveBranchId(data.branchId || branchIdOverride);
  const docRef = await addDoc(collection(db, COLLECTIONS.CATEGORIES), {
    ...data,
    branchId: effectiveBranchId,
    branch: data.branch || effectiveBranchId,
    createdAt
  });
  return docRef.id;
}

export async function updateCategoryFirestore(categoryId: string, data: Partial<Category>) {
  const catRef = doc(db, COLLECTIONS.CATEGORIES, categoryId);
  await updateDoc(catRef, data);
}

export async function deleteCategoryFirestore(categoryId: string) {
  const catRef = doc(db, COLLECTIONS.CATEGORIES, categoryId);
  await updateDoc(catRef, {
    isActive: false,
    isArchived: true,
    deletedAt: new Date().toISOString()
  });
}

export async function reorderCategoriesFirestore(categories: { id: string; order: number }[]) {
  const batch = writeBatch(db);
  categories.forEach(item => {
    const catRef = doc(db, COLLECTIONS.CATEGORIES, item.id);
    batch.update(catRef, { order: item.order });
  });
  await batch.commit();
}

// Recipe & Ingredient Operations
export async function addRecipeFirestore(recipe: Omit<Recipe, 'id'>, branchIdOverride?: string) {
  const token=await getAuthToken(); const idempotencyKey=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const effectiveBranchId=getEffectiveBranchId(recipe.branchId||branchIdOverride);
  const response=await fetch(getApiUrl('/api/recipes'),{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':idempotencyKey,...(token?{'Authorization':`Bearer ${token}`}:{})},body:JSON.stringify({recipeData:{...recipe,branchId:effectiveBranchId}})}); const data=await response.json().catch(()=>({})); if(!response.ok)throw new Error(data.error||`Recipe creation failed (${response.status})`); return (data.recipe||data).id;
}

export async function updateRecipeFirestore(recipeId: string, data: Partial<Recipe>) {
  const token=await getAuthToken(); const idempotencyKey=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const response=await fetch(getApiUrl(`/api/recipes/${encodeURIComponent(recipeId)}/update`),{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':idempotencyKey,...(token?{'Authorization':`Bearer ${token}`}:{})},body:JSON.stringify({recipeData:data})}); const out=await response.json().catch(()=>({})); if(!response.ok)throw new Error(out.error||`Recipe update failed (${response.status})`);
}

export async function deleteRecipeFirestore(recipeId: string) {
  const token=await getAuthToken(); const idempotencyKey=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const response=await fetch(getApiUrl(`/api/recipes/${encodeURIComponent(recipeId)}`),{method:'DELETE',headers:{'Content-Type':'application/json','Idempotency-Key':idempotencyKey,...(token?{'Authorization':`Bearer ${token}`}:{})}}); const out=await response.json().catch(()=>({})); if(!response.ok)throw new Error(out.error||`Recipe deletion failed (${response.status})`);
}

export async function addIngredientFirestore(ingredient: Omit<Ingredient, 'id'>, branchIdOverride?: string) {
  const createdAt = new Date().toISOString();
  const effectiveBranchId = getEffectiveBranchId(ingredient.branchId || branchIdOverride);
  const docRef = await addDoc(collection(db, COLLECTIONS.INGREDIENTS), {
    ...ingredient,
    branchId: effectiveBranchId,
    branch: ingredient.branch || effectiveBranchId,
    createdAt,
    updatedAt: createdAt
  });
  return docRef.id;
}

export async function updateIngredientFirestore(ingredientId: string, data: Partial<Ingredient>) {
  const { stock, currentStock, currentStockUsageUnit, ...safeData } = data as any;
  if (stock !== undefined || currentStock !== undefined || currentStockUsageUnit !== undefined) {
    const qty = Number(stock ?? currentStock ?? currentStockUsageUnit);
    if (!Number.isFinite(qty) || qty < 0) throw new Error('Ingredient stock must be a finite non-negative number.');
    const token = await getAuthToken();
    const idempotencyKey = globalThis.crypto?.randomUUID?.() || `ingredient-stock:${ingredientId}:${Date.now()}`;
    const res = await fetch(getApiUrl('/api/inventory/adjust'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ itemType: 'ingredient', itemId: ingredientId, mode: 'set', quantity: qty, reason: 'Ingredient stock set from management', idempotencyKey })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to set ingredient stock: HTTP ${res.status}`);
    }
  }
  if (Object.keys(safeData).length > 0) {
    const ingredientRef = doc(db, COLLECTIONS.INGREDIENTS, ingredientId);
    await updateDoc(ingredientRef, { ...safeData, updatedAt: new Date().toISOString() });
  }
}

export async function deleteIngredientFirestore(ingredientId: string) {
  const ingRef = doc(db, COLLECTIONS.INGREDIENTS, ingredientId);
  await updateDoc(ingRef, {
    isActive: false,
    isArchived: true,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

// Equipment Operations
export async function addEquipmentItemFirestore(item: Omit<EquipmentItem, 'id'>, branchIdOverride?: string) {
  const effectiveBranchId = getEffectiveBranchId(item.branchId || branchIdOverride);
  const docRef = await addDoc(collection(db, COLLECTIONS.EQUIPMENT), {
    ...item,
    branchId: effectiveBranchId,
    branch: item.branch || effectiveBranchId
  });
  return docRef.id;
}

export async function updateEquipmentItemFirestore(itemId: string, data: Partial<EquipmentItem>) {
  const equipRef = doc(db, COLLECTIONS.EQUIPMENT, itemId);
  await updateDoc(equipRef, data);
}

export async function deleteEquipmentItemFirestore(itemId: string) {
  const equipRef = doc(db, COLLECTIONS.EQUIPMENT, itemId);
  await deleteDoc(equipRef);
}

// Product Options Operations
export async function addProductOptionFirestore(data: Omit<ProductOption, 'id'>) {
  const token = await getAuthToken();
  const branchId = getEffectiveBranchId((data as any).branchId);
  const idempotencyKey = `product-option-create:${branchId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const res = await fetch(getApiUrl('/api/product-options'), { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,'Idempotency-Key':idempotencyKey}, body:JSON.stringify({ optionData:{...data,branchId,idempotencyKey} }) });
  if(!res.ok){ let message='Failed to create product option.'; try{message=(await res.json())?.error||message;}catch{} throw new Error(message); }
  return String((await res.json()).id);
}

export async function updateProductOptionFirestore(optionId: string, data: Partial<ProductOption>) {
  const token = await getAuthToken(); const idempotencyKey=`product-option-update:${optionId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const res=await fetch(getApiUrl(`/api/product-options/${encodeURIComponent(optionId)}`),{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,'Idempotency-Key':idempotencyKey},body:JSON.stringify({...data,idempotencyKey})});
  if(!res.ok){let message='Failed to update product option.';try{message=(await res.json())?.error||message;}catch{}throw new Error(message);}
}

export async function deleteProductOptionFirestore(optionId: string) {
  const token = await getAuthToken(); const idempotencyKey=`product-option-delete:${optionId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const res=await fetch(getApiUrl(`/api/product-options/${encodeURIComponent(optionId)}`),{method:'DELETE',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,'Idempotency-Key':idempotencyKey},body:JSON.stringify({idempotencyKey})});
  if(!res.ok){let message='Failed to delete product option.';try{message=(await res.json())?.error||message;}catch{}throw new Error(message);}
}

/**
 * Automatic stock deduction for linked ingredients upon order completion
 */
export async function deductProductIngredientsStockFirestore(productId: string, soldQuantity: number, orderId?: string) {
  // Stock deductions are processed atomically on the server via /api/pos/complete or /api/inventory/adjust
  return;
}

export async function restoreProductIngredientsStockFirestore(productId: string, returnedQuantity: number, orderId?: string) {
  // Stock restorations are processed atomically on the server via /api/orders/:orderId/cancel or /api/inventory/adjust
  return;
}

// ==========================================
// PHASE 5: ORDER & POS FIRESTORE HELPERS
// ==========================================

function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefined) as unknown as T;
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        res[key] = cleanUndefined(val);
      }
    }
    return res as T;
  }
  return obj;
}

export function routeProductToStation(productName: string, category?: string): 'grill' | 'pizza' | 'drinks' | 'dessert' | 'packing' {
  const combined = `${productName} ${category || ''}`.toLowerCase();
  
  if (
    combined.includes('pizza') ||
    combined.includes('bakery') ||
    combined.includes('pie') ||
    combined.includes('pastry') ||
    combined.includes('canjeero') ||
    combined.includes('sambusa') ||
    combined.includes('samosa')
  ) {
    return 'pizza';
  }

  if (
    combined.includes('tea') ||
    combined.includes('shaah') ||
    combined.includes('juice') ||
    combined.includes('coffee') ||
    combined.includes('drink') ||
    combined.includes('soda') ||
    combined.includes('water') ||
    combined.includes('beverage') ||
    combined.includes('milk')
  ) {
    return 'drinks';
  }

  if (
    combined.includes('dessert') ||
    combined.includes('cake') ||
    combined.includes('ice cream') ||
    combined.includes('halwa') ||
    combined.includes('sweet') ||
    combined.includes('pancake') ||
    combined.includes('crepe')
  ) {
    return 'dessert';
  }

  if (
    combined.includes('grill') ||
    combined.includes('suqaar') ||
    combined.includes('camel') ||
    combined.includes('mandi') ||
    combined.includes('lamb') ||
    combined.includes('chicken') ||
    combined.includes('steak') ||
    combined.includes('meat') ||
    combined.includes('kebab') ||
    combined.includes('bbq') ||
    combined.includes('bariis') ||
    combined.includes('rice')
  ) {
    return 'grill';
  }

  return 'packing';
}

export async function createOrderFirestore(orderData: Omit<Order, 'id'>): Promise<Order> {
  const token = await getAuthToken();
  const idempotencyKey = (orderData as any).idempotencyKey || (globalThis.crypto?.randomUUID ? `POS-${globalThis.crypto.randomUUID()}` : `POS-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  // Never forward client-authoritative financial/operational state to checkout.
  // The trusted backend derives these values from the canonical catalog and branch configuration.
  const {
    status: _clientStatus,
    paymentStatus: _clientPaymentStatus,
    deliveryStatus: _clientDeliveryStatus,
    paidAmount: _clientPaidAmount,
    paymentAmount: _clientPaymentAmount,
    changeDue: _clientChangeDue,
    amountTendered: _clientAmountTendered,
    cogs: _clientCogs,
    profit: _clientProfit,
    pointsEarnedAtCheckout: _clientPointsEarned,
    loyaltyPointsEarned: _clientLoyaltyPoints,
    idempotencyKey: _clientIdempotencyKey,
    ...clientIntent
  } = orderData as any;

  const enrichedOrderData: any = { ...clientIntent };
  // Cash tender is an input; the server computes paidAmount/changeDue.
  if (String(orderData.paymentMethod || '').toLowerCase() === 'cash' && orderData.amountTendered !== undefined) {
    enrichedOrderData.amountTendered = orderData.amountTendered;
  }

  const response = await fetch(getApiUrl('/api/pos/complete'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ orderData: enrichedOrderData, idempotencyKey })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const fallbackMessage = response.status === 403
      ? 'Access denied: User is not assigned to this branch or unauthorized.'
      : `POS Checkout Failed (${response.status})`;
    throw new Error(errorData.error || fallbackMessage);
  }

  const result = await response.json();
  return result.order;
}

export async function postPOSSaleAccountingJournalFirestore(order: Order): Promise<string | null> {
  // Accounting journals are generated atomically on the server via /api/pos/complete
  return null;
}

export async function postCancellationReversalJournalFirestore(order: Order, reason?: string): Promise<string | null> {
  // Cancellation reversal journals are generated atomically on the server via /api/orders/:orderId/cancel
  return null;
}

export async function updateOrderFirestore(orderId: string, data: Partial<Order>): Promise<void> {
  const token = await getAuthToken();
  const idempotencyKey = globalThis.crypto?.randomUUID?.() || `order-update:${orderId}:${Date.now()}`;
  const response = await fetch(getApiUrl(`/api/orders/${orderId}/update`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ ...data, idempotencyKey })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Order Update Failed (${response.status})`);
  }
}

export async function updateOrderStatusFirestore(orderId: string, status: OrderStatus, reason?: string): Promise<void> {
  const orderRef = doc(db, COLLECTIONS.ORDERS, orderId);

  if (status === 'cancelled') {
    const token = await getAuthToken();
    const idempotencyKey = globalThis.crypto?.randomUUID?.() || `order-cancel:${orderId}:${Date.now()}`;
    const response = await fetch(getApiUrl(`/api/orders/${orderId}/cancel`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ reason: reason || 'Order Cancellation', idempotencyKey })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Order Cancellation Failed (${response.status})`);
    }

    return;
  } else {
    // Order lifecycle is distinct from Kitchen lifecycle. Route order status
    // changes to the trusted order-update endpoint rather than translating an
    // order state into a kitchen state.
    const token = await getAuthToken();
    const idempotencyKey = globalThis.crypto?.randomUUID?.() || `order-status:${orderId}:${Date.now()}`;
    const response = await fetch(getApiUrl(`/api/orders/${orderId}/update`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ status, reason: reason || 'Order status update', idempotencyKey })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Order Status Update Failed (${response.status})`);
    }
  }
}

export async function updateKitchenStatusFirestore(ticketId: string, status: string): Promise<void> {
  const token = await getAuthToken();
  const response = await fetch(getApiUrl(`/api/kitchen/${ticketId}/status`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ status })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Kitchen Status Update Failed (${response.status})`);
  }
}

export async function updateKitchenTicketFirestore(ticketId: string, updates: Record<string, any>): Promise<void> {
  const token = await getAuthToken();
  const response = await fetch(getApiUrl(`/api/kitchen/${ticketId}/update`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Kitchen Ticket Update Failed (${response.status})`);
  }
}

export async function updateStationStatusFirestore(stationId: string, status: 'normal' | 'busy' | 'overloaded', chefName?: string): Promise<void> {
  const token = await getAuthToken();
  const response = await fetch(getApiUrl(`/api/kitchen/stations/${stationId}/status`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ status, chefName })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Station Status Update Failed (${response.status})`);
  }
}

export async function rechargeWalletFirestore(payload: { customerId: string; amount: number; paymentMethod?: string; notes?: string; customerName?: string; idempotencyKey?: string }): Promise<any> {
  const token = await getAuthToken();
  const idempKey = payload.idempotencyKey || `recharge_${payload.customerId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const response = await fetch(getApiUrl('/api/crm/wallet/recharge'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempKey,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Wallet Recharge Failed (${response.status})`);
  }
  return response.json();
}

export async function deductWalletFirestore(payload: { customerId: string; amount: number; orderId?: string; notes?: string; idempotencyKey?: string }): Promise<any> {
  const token = await getAuthToken();
  const idempKey = payload.idempotencyKey || `deduct_${payload.customerId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const response = await fetch(getApiUrl('/api/crm/wallet/deduct'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempKey,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Wallet Deduction Failed (${response.status})`);
  }
  return response.json();
}

export async function refundToWalletFirestore(payload: { customerId: string; amount: number; orderId: string; reason?: string; idempotencyKey?: string }): Promise<any> {
  const token = await getAuthToken();
  const idempKey = payload.idempotencyKey || `refund_${payload.customerId}_${payload.orderId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const response = await fetch(getApiUrl('/api/crm/wallet/refund'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempKey,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Wallet Refund Failed (${response.status})`);
  }
  return response.json();
}

export async function updateDeliveryStatusFirestore(deliveryId: string, status: string, driverId?: string, failureReason?: string): Promise<void> {
  const token = await getAuthToken();
  const response = await fetch(getApiUrl(`/api/deliveries/${deliveryId}/status`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ status, driverId, failureReason })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Delivery Status Update Failed (${response.status})`);
  }
}

export async function assignDeliveryDriverFirestore(deliveryId: string, driverId: string, driverName?: string, driverPhone?: string): Promise<void> {
  const token = await getAuthToken();
  const response = await fetch(getApiUrl(`/api/deliveries/${deliveryId}/assign`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ driverId, driverName, driverPhone })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Delivery Driver Assignment Failed (${response.status})`);
  }
}

export async function deleteOrderFirestore(orderId: string, reason?: string): Promise<void> {
  // Direct client deletion of orders is forbidden to maintain immutable financial audit trails.
  // Route order cancellation through the trusted backend instead.
  await updateOrderStatusFirestore(orderId, 'cancelled', reason || 'Order cancellation requested');
}

// Hold Orders
export async function holdOrderFirestore(holdData: Omit<HoldOrder, 'id'>): Promise<HoldOrder> {
  const newRef = doc(collection(db, COLLECTIONS.HOLD_ORDERS));
  const fullHold: HoldOrder = {
    ...holdData,
    id: newRef.id
  };

  try {
    await setDoc(newRef, cleanUndefined(fullHold));
  } catch (err) {
    console.warn('Firestore holdOrder notice:', err);
  }

  return fullHold;
}

export async function fetchHoldOrdersFirestore(): Promise<HoldOrder[]> {
  try {
    const q = query(collection(db, COLLECTIONS.HOLD_ORDERS), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as HoldOrder));
    }
  } catch (err) {
    console.warn('Firestore fetchHoldOrders notice:', err);
  }
  return [];
}

export async function deleteHoldOrderFirestore(holdId: string): Promise<void> {
  try {
    const holdRef = doc(db, COLLECTIONS.HOLD_ORDERS, holdId);
    await deleteDoc(holdRef);
  } catch (err) {
    console.warn('Firestore deleteHoldOrder notice:', err);
  }
}

// Initial Setup Wizard -> Trusted Backend Persist
export interface InitialSetupData {
  restaurant: {
    name: string;
    nameEn?: string;
    nameAr?: string;
    nameSo?: string;
    slogan?: string;
    phone?: string;
    email?: string;
    address?: string;
    currency: string;
    defaultLanguage?: string;
    workingHours?: string;
    logoUrl?: string;
    taxRegNumber?: string;
  };
  branch: {
    name: string;
    code: string;
    city: string;
    address: string;
    managerName: string;
    managerPhone: string;
    tableCount: number;
    isPrimary: boolean;
  };
  admin: {
    name: string;
    email: string;
    role: string;
    phone: string;
    pin: string;
  };
  employees: Array<{
    name: string;
    role: string;
    email: string;
    phone: string;
    salary: number;
    shift: string;
  }>;
  suppliers: Array<{
    name: string;
    contactName: string;
    phone: string;
    email: string;
    category: string;
  }>;
  inventory: Array<{
    name: string;
    nameAr?: string;
    nameSo?: string;
    unit: string;
    minAlertStock: number;
    costPerUnit: number;
    currentQuantity: number;
    category: string;
  }>;
  recipes: Array<{
    productId: string;
    productName: string;
    ingredients: Array<{
      ingredientId: string;
      ingredientName: string;
      quantityRequired: number;
      unit: string;
    }>;
  }>;
  products: Array<{
    name: string;
    nameAr?: string;
    nameSo?: string;
    category: string;
    price: number;
    cost: number;
    imageUrl?: string;
    prepTimeMinutes?: number;
  }>;
  tax: {
    taxName: string;
    taxRate: number;
    serviceCharge?: number;
    discountSettings?: string;
    trnNumber: string;
    isInclusive: boolean;
  };
  payments: {
    cashEnabled: boolean;
    cardEnabled: boolean;
    evcPlusEnabled?: boolean;
    zaadEnabled?: boolean;
    sahalEnabled?: boolean;
    eDahabEnabled?: boolean;
    paypalEnabled?: boolean;
    bankTransferEnabled: boolean;
    defaultPosMethod: string;
    merchantId?: string;
  };
}

export async function saveInitialSetupWizardData(setupData: InitialSetupData): Promise<{ mode: 'firestore'; success: boolean }> {
  const token = await getAuthToken();
  if (!token) throw new Error('Authentication is required to complete initial setup.');
  const idempotencyKey = `initial-setup:${setupData.branch.code || 'HQ-MAIN'}:${setupData.admin.email || 'admin'}:${Date.now()}`;
  const response = await fetch(getApiUrl('/api/setup/initial'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(setupData)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Initial setup failed (${response.status})`);
  return { mode: 'firestore', success: true };
}


// Dining Tables Helpers
export async function fetchTablesFirestore(branchId?: string): Promise<DiningTable[]> {
  try {
    const effectiveBranchId = getEffectiveBranchId(branchId);
    const tablesQuery = effectiveBranchId === 'all'
      ? query(collection(db, COLLECTIONS.TABLES))
      : query(collection(db, COLLECTIONS.TABLES), where('branchId', '==', effectiveBranchId));
    const snap = await getDocs(tablesQuery);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DiningTable));
  } catch (err) {
    console.error('Error fetching tables from Firestore:', err);
    return [];
  }
}

export async function updateTableStatusFirestore(tableNumber: string, status: string, orderId?: string, branchId?: string): Promise<void> {
  const effectiveBranchId = getEffectiveBranchId(branchId);
  const q = query(collection(db, COLLECTIONS.TABLES), where('branchId', '==', effectiveBranchId), where('tableNumber', '==', tableNumber));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const docRef = snap.docs[0].ref;
    await updateDoc(docRef, {
      status,
      ...(orderId ? { currentOrderId: orderId } : {}),
      updatedAt: new Date().toISOString()
    });
  } else {
    // Create table document if not found
    const newRef = doc(collection(db, COLLECTIONS.TABLES));
    await setDoc(newRef, {
      id: newRef.id,
      tableNumber,
      branchId: effectiveBranchId,
      section: 'indoor',
      capacity: 4,
      status,
      currentOrderId: orderId || null,
      updatedAt: new Date().toISOString()
    });
  }
}

// Customers Helpers
export async function fetchCustomersFirestore(): Promise<Customer[]> {
  try {
    const branchId = getEffectiveBranchId();
    const snap = await getDocs(query(collection(db, COLLECTIONS.CUSTOMERS), where('branchId', '==', branchId)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
  } catch (err) {
    console.error('Error fetching customers from Firestore:', err);
    return [];
  }
}

export async function addCustomerFirestore(data: Omit<Customer, 'id'>): Promise<Customer> {
  const newRef = doc(collection(db, COLLECTIONS.CUSTOMERS));
  const branchId = getEffectiveBranchId(data.branchId || (data as any).branch);
  const customer: Customer = {
    ...data,
    branchId,
    id: newRef.id
  };
  await setDoc(newRef, customer);
  return customer;
}
