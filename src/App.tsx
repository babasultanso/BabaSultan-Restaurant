import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  db,
  COLLECTIONS,
  executeAIActionFirestore,
  addExpenseFirestore,
  addPurchaseFirestore,
  addSalaryFirestore,
  recordInventoryMovementFirestore,
  updateProductStockFirestore,
  addRefundFirestore,
  addBankTransactionFirestore
} from './lib/firebase';
import {
  Order,
  Product,
  Ingredient,
  Expense,
  Purchase,
  Employee,
  SalaryPayment,
  Supplier,
  InventoryMovement,
  CustomerRefund,
  BankTransaction,
  FinancialAccount
} from './types';

// Auth & Foundation Architecture
import { AuthProvider, useAuth } from './presentation/context/AuthContext';
import { Layout } from './presentation/layout/Layout';
import { ProtectedRoute } from './presentation/components/common/ProtectedRoute';
import { RoleGuard } from './presentation/components/common/RoleGuard';
import { ErrorBoundary } from './presentation/components/common/ErrorBoundary';
import { handleFirestoreError, OperationType } from './infrastructure/firebase/errorHandler';

// Phase 2 Auth Components
import { UserManagementView } from './presentation/components/auth/UserManagementView';
import { ProfilePage } from './presentation/components/auth/ProfilePage';
import { RolePermissionsView } from './presentation/components/auth/RolePermissionsView';

// Phase 4 Product Management Components
import { ProductManagementView } from './presentation/components/products/ProductManagementView';

// Modules & Views
import { DashboardView } from './presentation/components/DashboardView';
import { POSView } from './presentation/components/POSView';
import { OrdersView } from './presentation/components/OrdersView';
import { KDSView } from './presentation/components/orders/KDSView';
import { updateOrderStatusFirestore } from './lib/firebase';
import { InventoryView } from './presentation/components/InventoryView';
import { InventoryManagementSystem } from './presentation/components/inventory/InventoryManagementSystem';
import { RecipeEngineMainView } from './presentation/components/recipe/RecipeEngineMainView';
import { CustomerManagementView } from './presentation/components/crm/CustomerManagementView';
import { FinancialsView } from './presentation/components/FinancialsView';
import { AccountingManagementView } from './presentation/components/accounting/AccountingManagementView';
import { StaffAndSuppliersView } from './presentation/components/StaffAndSuppliersView';
import { HRMManagementView } from './presentation/components/hrm/HRMManagementView';
import { ReportsView } from './presentation/components/ReportsView';
import { AdminPanelView } from './presentation/components/AdminPanelView';
import { BranchManagementView } from './presentation/components/branch/BranchManagementView';
import { DeliveryManagementView } from './presentation/components/delivery/DeliveryManagementView';
import { DeliveryDriverView } from './presentation/components/dashboard/OtherRolesView';
import { SystemSettingsView } from './presentation/components/SystemSettingsView';
import { InitialSetupWizardModal } from './presentation/components/setup/InitialSetupWizardModal';
import { AIBusinessPlatformView } from './presentation/components/AIBusinessPlatformView';
import { AIFinancialAdvisorView } from './components/AIFinancialAdvisorView';
import { AIOperationsManagerView } from './components/AIOperationsManagerView';
import { AICEOView } from './components/AICEOView';
import { AIAssistantModal } from './components/AIAssistantModal';

import { Bot, Sparkles, Database, CheckCircle2, ShieldCheck } from 'lucide-react';

function ERPAppContent() {
  const { user, userRecord, language, t } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);

  // Live Firestore State
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [isOrdersLoading, setIsOrdersLoading] = useState<boolean>(true);
  const [ordersRetryCount, setOrdersRetryCount] = useState<number>(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaries, setSalaries] = useState<SalaryPayment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [refunds, setRefunds] = useState<CustomerRefund[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);

  // 1. Subscribe to Firestore Collections in Real-Time
  useEffect(() => {
    const userRoleStr = (userRecord?.role || '').toLowerCase().trim();
    const isHqUser = userRoleStr === 'owner' || (userRoleStr === 'admin' && (!userRecord?.branchId || userRecord?.branchId === 'all'));
    const userBranch = userRecord?.branchId || (userRecord as any)?.branch;
    const isBranchScoped = !isHqUser && Boolean(userBranch) && userBranch !== 'all';

    setIsOrdersLoading(true);
    setOrdersError(null);

    const ordersQuery = isBranchScoped
      ? query(collection(db, COLLECTIONS.ORDERS), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.ORDERS));

    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(docs);
      setOrdersError(null);
      setIsOrdersLoading(false);
    }, (err) => {
      console.warn('Orders listener notice:', err?.message || err);
      setOrdersError(err?.message || 'Orders realtime unavailable.');
      setIsOrdersLoading(false);
    });

    const productsQuery = isBranchScoped
      ? query(collection(db, COLLECTIONS.PRODUCTS), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.PRODUCTS));

    const unsubProducts = onSnapshot(productsQuery, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (err) => {
      console.warn('Products listener notice:', err?.message || err);
    });

    const ingredientsQuery = isBranchScoped
      ? query(collection(db, COLLECTIONS.INGREDIENTS), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.INGREDIENTS));

    const unsubIngredients = onSnapshot(ingredientsQuery, (snapshot) => {
      setIngredients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ingredient)));
    }, (err) => {
      console.warn('Ingredients listener notice:', err?.message || err);
    });

    const expensesQuery = isBranchScoped
      ? query(collection(db, COLLECTIONS.EXPENSES), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.EXPENSES));

    const unsubExpenses = onSnapshot(expensesQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setExpenses(docs);
    }, (err) => {
      console.warn('Expenses listener notice:', err?.message || err);
    });

    const purchasesQuery = isBranchScoped
      ? query(collection(db, COLLECTIONS.PURCHASES), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.PURCHASES));

    const unsubPurchases = onSnapshot(purchasesQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase));
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPurchases(docs);
    }, (err) => {
      console.warn('Purchases listener notice:', err?.message || err);
    });

    const employeesQuery = isBranchScoped
      ? query(collection(db, COLLECTIONS.EMPLOYEES), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.EMPLOYEES));

    const unsubEmployees = onSnapshot(employeesQuery, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    }, (err) => {
      console.warn('Employees listener notice:', err?.message || err);
    });

    const salariesQuery = isBranchScoped
      ? query(collection(db, COLLECTIONS.SALARIES), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.SALARIES));

    const unsubSalaries = onSnapshot(salariesQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalaryPayment));
      docs.sort((a, b) => new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime());
      setSalaries(docs);
    }, (err) => {
      console.warn('Salaries listener notice:', err?.message || err);
    });

    const suppliersQuery = isBranchScoped
      ? query(collection(db, COLLECTIONS.SUPPLIERS), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.SUPPLIERS));

    const unsubSuppliers = onSnapshot(suppliersQuery, (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    }, (err) => {
      console.warn('Suppliers listener notice:', err?.message || err);
    });

    const movementsQuery = isBranchScoped
      ? query(collection(db, COLLECTIONS.MOVEMENTS), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.MOVEMENTS));

    const unsubMovements = onSnapshot(movementsQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryMovement));
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMovements(docs);
    }, (err) => {
      console.warn('Movements listener notice:', err?.message || err);
    });

    const refundsQuery = isBranchScoped
      ? query(collection(db, COLLECTIONS.REFUNDS), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.REFUNDS));

    const unsubRefunds = onSnapshot(refundsQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerRefund));
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRefunds(docs);
    }, (err) => {
      console.warn('Refunds listener notice:', err?.message || err);
    });

    const bankTxQuery = isBranchScoped
      ? query(collection(db, COLLECTIONS.BANK_TRANSACTIONS), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.BANK_TRANSACTIONS));

    const unsubBankTx = onSnapshot(bankTxQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankTransaction));
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBankTransactions(docs);
    }, (err) => {
      console.warn('Bank Transactions listener notice:', err?.message || err);
    });

    const accountsQuery = isBranchScoped
      ? query(collection(db, COLLECTIONS.ACCOUNTS), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.ACCOUNTS));

    const unsubAccounts = onSnapshot(accountsQuery, (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FinancialAccount)));
    }, (err) => {
      console.warn('Accounts listener notice:', err?.message || err);
    });

    return () => {
      unsubOrders();
      unsubProducts();
      unsubIngredients();
      unsubExpenses();
      unsubPurchases();
      unsubEmployees();
      unsubSalaries();
      unsubSuppliers();
      unsubMovements();
      unsubRefunds();
      unsubBankTx();
      unsubAccounts();
    };
  }, [userRecord?.branchId, userRecord?.role, ordersRetryCount]);

  // AI Assistant Automated Action Handler (Server-Authoritative via Trusted Backend API)
  const handleExecuteAIAction = async (actionType: string, payload: any) => {
    if (!user || !userRecord) {
      alert('Authentication required to execute AI automated ledger operations.');
      return;
    }

    try {
      await executeAIActionFirestore(actionType, payload);
    } catch (err: any) {
      console.error(`Execution of AI action (${actionType}) failed:`, err);
      alert(`Transaction Failed: Could not execute ${actionType}. ${err?.message || ''}`);
    }
  };

  const firestoreStateBundle = {
    orders,
    products,
    ingredients,
    expenses,
    purchases,
    employees,
    salaries,
    suppliers,
    inventory_movements: movements,
    refunds,
    bank_transactions: bankTransactions,
    accounts
  };

  return (
    <ProtectedRoute>
      <Layout currentView={currentView} onSelectView={setCurrentView} onOpenSetupWizard={() => setIsSetupWizardOpen(true)}>
        {/* View Router */}
        {currentView === 'dashboard' && (
          <DashboardView
            orders={orders}
            products={products}
            ingredients={ingredients}
            expenses={expenses}
            purchases={purchases}
            employees={employees}
            salaries={salaries}
            suppliers={suppliers}
            movements={movements}
            refunds={refunds}
            bankTransactions={bankTransactions}
            accounts={accounts}
            onNavigateToTab={(v) => setCurrentView(v)}
            onOpenAIQuery={() => setIsAIAssistantOpen(true)}
          />
        )}

        {currentView === 'products' && (
          <ProductManagementView />
        )}

        {currentView === 'admin' && (
          <RoleGuard permissionKey="canAccessAdminPanel">
            <AdminPanelView
              products={products}
              orders={orders}
              expenses={expenses}
              employees={employees}
              suppliers={suppliers}
              ingredients={ingredients}
            />
          </RoleGuard>
        )}

        {currentView === 'users' && (
          <RoleGuard permissionKey="canManageUsers">
            <UserManagementView />
          </RoleGuard>
        )}

        {currentView === 'profile' && (
          <ProfilePage />
        )}

        {currentView === 'roleMatrix' && (
          <RolePermissionsView />
        )}

        {currentView === 'branches' && (
          <ErrorBoundary
            fallbackTitle="Branch Management Notice"
            fallbackDescription="Unable to render Branch Management view due to a data or network issue."
          >
            <BranchManagementView
              initialOrders={orders}
              initialExpenses={expenses}
              initialEmployees={employees}
              initialIngredients={ingredients}
              initialProducts={products}
              initialCustomers={[]}
              language={language === 'ar' ? 'ar' : language === 'so' ? 'so' : 'en'}
            />
          </ErrorBoundary>
        )}

        {currentView === 'delivery' && (
          ((userRecord?.role || '').toLowerCase().trim() === 'delivery driver' || (userRecord?.role || '').toLowerCase().trim() === 'driver') ? (
            <DeliveryDriverView
              role={userRecord?.role || 'Delivery Driver'}
              orders={orders}
              employees={employees}
            />
          ) : (
            <DeliveryManagementView
              language={language === 'ar' ? 'ar' : language === 'so' ? 'so' : 'en'}
            />
          )
        )}

        {currentView === 'pos' && (
          <RoleGuard permissionKey="canAccessPOS">
            <POSView products={products} onOrderCompleted={() => setCurrentView('orders')} />
          </RoleGuard>
        )}

        {currentView === 'orders' && (
          <OrdersView
            orders={orders}
            ordersError={ordersError}
            isLoading={isOrdersLoading}
            onRetry={() => setOrdersRetryCount(c => c + 1)}
          />
        )}

        {currentView === 'kitchen' && (
          <RoleGuard permissionKey="canAccessKitchen">
            <KDSView
              orders={orders}
              onUpdateStatus={async (orderId, status) => {
                await updateOrderStatusFirestore(orderId, status);
              }}
            />
          </RoleGuard>
        )}

        {currentView === 'recipeEngine' && (
          <RecipeEngineMainView
            products={products}
            defaultLang={language === 'ar' ? 'ar' : language === 'so' ? 'so' : 'en'}
          />
        )}

        {currentView === 'inventory' && (
          <RoleGuard permissionKey="canAccessInventory">
            <InventoryManagementSystem />
          </RoleGuard>
        )}

        {currentView === 'customers' && (
          <RoleGuard permissionKey="canAccessCustomers">
            <CustomerManagementView />
          </RoleGuard>
        )}

        {currentView === 'financials' && (
          <RoleGuard permissionKey="canAccessFinancials">
            <AccountingManagementView />
          </RoleGuard>
        )}

        {currentView === 'staff' && (
          <RoleGuard permissionKey="canAccessStaff">
            <StaffAndSuppliersView
              employees={employees}
              suppliers={suppliers}
              salaries={salaries}
            />
          </RoleGuard>
        )}

        {currentView === 'reports' && (
          <RoleGuard permissionKey="canAccessReports">
            <ReportsView
              orders={orders}
              products={products}
              ingredients={ingredients}
              expenses={expenses}
              employees={employees}
              suppliers={suppliers}
              purchases={purchases}
            />
          </RoleGuard>
        )}

        {currentView === 'ai-advisor' && (
          <RoleGuard permissionKey="canAccessAIAdvisor">
            <AIBusinessPlatformView
              initialOrders={orders}
              initialProducts={products}
              initialIngredients={ingredients}
              initialExpenses={expenses}
              initialEmployees={employees}
              initialSuppliers={suppliers}
              initialPurchases={purchases}
              language={language === 'ar' ? 'ar' : language === 'so' ? 'so' : 'en'}
            />
          </RoleGuard>
        )}

        {currentView === 'ai-operations' && (
          <RoleGuard permissionKey="canAccessAIAdvisor">
            <AIOperationsManagerView language={language} />
          </RoleGuard>
        )}

        {currentView === 'ai-ceo' && (
          <RoleGuard permissionKey="canAccessAIAdvisor">
            <AICEOView language={language} />
          </RoleGuard>
        )}

        {(currentView === 'settings' || currentView === 'diagnostics') && (
          <RoleGuard permissionKey="canManageBranchSettings">
            <SystemSettingsView
              language={language}
              onOpenSetupWizard={() => setIsSetupWizardOpen(true)}
              defaultTab={currentView === 'diagnostics' ? 'developer_tools' : undefined}
            />
          </RoleGuard>
        )}

        {/* Initial Setup Wizard Modal */}
        <InitialSetupWizardModal
          isOpen={isSetupWizardOpen}
          onClose={() => setIsSetupWizardOpen(false)}
        />

        {/* Floating AI Assistant Trigger */}
        <button
          onClick={() => setIsAIAssistantOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 font-extrabold p-4 rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition flex items-center gap-2 border border-emerald-300/40 cursor-pointer"
        >
          <Bot className="w-6 h-6 animate-pulse" />
          <span className="hidden sm:inline text-sm">
            {language === 'ar' ? 'مساعد الذكاء الاصطناعي' : language === 'so' ? 'Garaadka AI CEO' : 'Ask AI Manager'}
          </span>
          <Sparkles className="w-4 h-4 text-slate-950" />
        </button>

        {/* AI Assistant Modal */}
        <AIAssistantModal
          isOpen={isAIAssistantOpen}
          onClose={() => setIsAIAssistantOpen(false)}
          language={language}
          firestoreData={firestoreStateBundle}
          onExecuteAction={handleExecuteAIAction}
        />
      </Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ERPAppContent />
    </AuthProvider>
  );
}
