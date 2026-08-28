import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { QuickActionsBar } from './dashboard/QuickActionsBar';
import { NotificationsBanner } from './dashboard/NotificationsBanner';
import { OwnerView } from './dashboard/OwnerView';
import { ManagerView } from './dashboard/ManagerView';
import { AccountantView } from './dashboard/AccountantView';
import { CashierView } from './dashboard/CashierView';
import { KitchenView } from './dashboard/KitchenView';
import { AdminView, WaiterView, DeliveryDriverView } from './dashboard/OtherRolesView';
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
} from '../../types';

interface DashboardViewProps {
  orders: Order[];
  products: Product[];
  ingredients: Ingredient[];
  expenses: Expense[];
  purchases?: Purchase[];
  employees?: Employee[];
  salaries?: SalaryPayment[];
  suppliers?: Supplier[];
  movements?: InventoryMovement[];
  refunds?: CustomerRefund[];
  bankTransactions?: BankTransaction[];
  accounts?: FinancialAccount[];
  onNavigateToTab?: (tab: string) => void;
  onOpenAIQuery?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  products,
  ingredients,
  expenses,
  purchases = [],
  employees = [],
  salaries = [],
  suppliers = [],
  movements = [],
  refunds = [],
  bankTransactions = [],
  accounts = [],
  onNavigateToTab,
  onOpenAIQuery
}) => {
  const { role } = useAuth();
  
  // Active role view perspective state
  const [activeRoleView, setActiveRoleView] = useState<string>(() => {
    return role ? role.toLowerCase().replace(/\s+/g, '') : 'owner';
  });

  // Keep synced with role changes
  useEffect(() => {
    if (role) {
      const normalized = role.toLowerCase().replace(/\s+/g, '');
      if (normalized === 'deliverydriver') {
        setActiveRoleView('delivery');
      } else {
        setActiveRoleView(normalized);
      }
    }
  }, [role]);

  return (
    <div className="space-y-6">
      
      {/* 1. Quick Action & Role Switcher Bar */}
      <QuickActionsBar
        activeRoleView={activeRoleView}
        onChangeRoleView={setActiveRoleView}
        onNavigateToTab={onNavigateToTab}
        onOpenAIQuery={onOpenAIQuery}
      />

      {/* 2. Operational System Alerts Banner */}
      <NotificationsBanner
        ingredients={ingredients}
        products={products}
        suppliers={suppliers}
        orders={orders}
        onNavigateToTab={onNavigateToTab}
      />

      {/* 3. Role-Specific Executive Dashboard Router */}
      {activeRoleView === 'owner' && (
        <OwnerView
          orders={orders}
          products={products}
          ingredients={ingredients}
          expenses={expenses}
          employees={employees}
          suppliers={suppliers}
          bankTransactions={bankTransactions}
          accounts={accounts}
          onNavigateToTab={onNavigateToTab}
        />
      )}

      {activeRoleView === 'manager' && (
        <ManagerView
          orders={orders}
          products={products}
          ingredients={ingredients}
          onNavigateToTab={onNavigateToTab}
        />
      )}

      {activeRoleView === 'accountant' && (
        <AccountantView
          orders={orders}
          expenses={expenses}
          purchases={purchases}
          suppliers={suppliers}
          refunds={refunds}
          bankTransactions={bankTransactions}
          accounts={accounts}
          onNavigateToTab={onNavigateToTab}
        />
      )}

      {activeRoleView === 'cashier' && (
        <CashierView
          orders={orders}
          onNavigateToTab={onNavigateToTab}
        />
      )}

      {activeRoleView === 'kitchen' && (
        <KitchenView
          orders={orders}
          onNavigateToTab={onNavigateToTab}
        />
      )}

      {activeRoleView === 'waiter' && (
        <WaiterView
          role={role}
          orders={orders}
          employees={employees}
          onNavigateToTab={onNavigateToTab}
        />
      )}

      {activeRoleView === 'delivery' && (
        <DeliveryDriverView
          role={role}
          orders={orders}
          employees={employees}
          onNavigateToTab={onNavigateToTab}
        />
      )}

      {activeRoleView === 'admin' && (
        <AdminView
          role={role}
          orders={orders}
          employees={employees}
          onNavigateToTab={onNavigateToTab}
        />
      )}

    </div>
  );
};
