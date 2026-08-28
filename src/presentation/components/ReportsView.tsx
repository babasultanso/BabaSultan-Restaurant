import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Order, Product, Ingredient, Expense, Employee, Supplier, Purchase, Customer } from '../../types';
import { FilterBar, ReportFilters } from './reports/FilterBar';
import { BIAnalyticsDashboard } from './reports/BIAnalyticsDashboard';
import { SpecializedReportModule, ReportType } from './reports/SpecializedReportModule';
import {
  BarChart3,
  FileSpreadsheet,
  Printer,
  Download,
  Building2,
  TrendingUp,
  DollarSign,
  PieChart,
  Users,
  Package,
  UserCheck,
  Truck,
  Utensils,
  CreditCard,
  FileText,
} from 'lucide-react';
import { downloadPDFReport, exportToExcel, printReportWindow } from '../../lib/reports';

interface ReportsViewProps {
  orders: Order[];
  products: Product[];
  ingredients: Ingredient[];
  expenses: Expense[];
  employees: Employee[];
  suppliers: Supplier[];
  purchases: Purchase[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  orders: initialOrders,
  products: initialProducts,
  ingredients: initialIngredients,
  expenses: initialExpenses,
  employees: initialEmployees,
  suppliers: initialSuppliers,
  purchases: initialPurchases,
}) => {
  const { userRecord, role } = useAuth();
  // 1. Real-Time Firestore Sync & Local Fallback State
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [purchases, setPurchases] = useState<Purchase[]>(initialPurchases);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Subscribe to real-time collections with branch isolation
  useEffect(() => {
    const userRoleStr = (userRecord?.role || role || '').toLowerCase().trim();
    const isHqUser = userRoleStr === 'owner' || (userRoleStr === 'admin' && (!userRecord?.branchId || userRecord?.branchId === 'all'));
    const userBranch = userRecord?.branchId || (userRecord as any)?.branch;
    const isBranchScoped = !isHqUser && Boolean(userBranch) && userBranch !== 'all';

    const buildBranchQuery = (collectionName: string) => {
      return isBranchScoped
        ? query(collection(db, collectionName), where('branchId', '==', userBranch))
        : query(collection(db, collectionName));
    };

    const unsubOrders = onSnapshot(
      buildBranchQuery(COLLECTIONS.ORDERS),
      (snap) => {
        const list: Order[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Order));
        if (list.length > 0) setOrders(list);
      },
      (err) => console.warn('ReportsView orders sync warning:', err)
    );

    const unsubProducts = onSnapshot(
      buildBranchQuery(COLLECTIONS.PRODUCTS),
      (snap) => {
        const list: Product[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Product));
        if (list.length > 0) setProducts(list);
      },
      (err) => console.warn('ReportsView products sync warning:', err)
    );

    const unsubIngredients = onSnapshot(
      buildBranchQuery(COLLECTIONS.INGREDIENTS),
      (snap) => {
        const list: Ingredient[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Ingredient));
        if (list.length > 0) setIngredients(list);
      },
      (err) => console.warn('ReportsView ingredients sync warning:', err)
    );

    const unsubExpenses = onSnapshot(
      buildBranchQuery(COLLECTIONS.EXPENSES),
      (snap) => {
        const list: Expense[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Expense));
        if (list.length > 0) setExpenses(list);
      },
      (err) => console.warn('ReportsView expenses sync warning:', err)
    );

    const unsubEmployees = onSnapshot(
      buildBranchQuery(COLLECTIONS.EMPLOYEES),
      (snap) => {
        const list: Employee[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Employee));
        if (list.length > 0) setEmployees(list);
      },
      (err) => console.warn('ReportsView employees sync warning:', err)
    );

    const unsubCustomers = onSnapshot(
      buildBranchQuery(COLLECTIONS.CUSTOMERS),
      (snap) => {
        const list: Customer[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Customer));
        setCustomers(list);
      },
      (err) => console.warn('ReportsView customers sync warning:', err)
    );

    return () => {
      unsubOrders();
      unsubProducts();
      unsubIngredients();
      unsubExpenses();
      unsubEmployees();
      unsubCustomers();
    };
  }, [userRecord?.branchId, userRecord?.role, role]);

  // Sync initial props if updated
  useEffect(() => {
    if (initialOrders.length > 0) setOrders(initialOrders);
    if (initialProducts.length > 0) setProducts(initialProducts);
    if (initialIngredients.length > 0) setIngredients(initialIngredients);
    if (initialExpenses.length > 0) setExpenses(initialExpenses);
    if (initialEmployees.length > 0) setEmployees(initialEmployees);
    if (initialSuppliers.length > 0) setSuppliers(initialSuppliers);
    if (initialPurchases.length > 0) setPurchases(initialPurchases);
  }, [
    initialOrders,
    initialProducts,
    initialIngredients,
    initialExpenses,
    initialEmployees,
    initialSuppliers,
    initialPurchases,
  ]);

  // 2. Navigation State
  const [activeTab, setActiveTab] = useState<'bi' | 'specialized'>('bi');
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('sales');

  // 3. Filter Controls State
  const [filters, setFilters] = useState<ReportFilters>({
    datePreset: 'all',
    startDate: '',
    endDate: '',
    branch: 'all',
    employee: 'all',
    category: 'all',
    customer: 'all',
  });

  const handleResetFilters = () => {
    setFilters({
      datePreset: 'all',
      startDate: '',
      endDate: '',
      branch: 'all',
      employee: 'all',
      category: 'all',
      customer: 'all',
    });
  };

  // Derive filter lists
  const availableBranches = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.branch) set.add(o.branch);
    });
    if (set.size === 0) {
      set.add('Main Branch');
      set.add('Downtown Express');
      set.add('Airport Terminal');
    }
    return Array.from(set);
  }, [orders]);

  const availableEmployees = useMemo(() => {
    return employees.map((e) => ({ id: e.id, name: e.name }));
  }, [employees]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const availableCustomers = useMemo(() => {
    return customers.map((c) => ({ id: c.id, name: c.name }));
  }, [customers]);

  // 4. Apply Filters to Collections
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const orderDate = (o.createdAt || '').split('T')[0];

      // Date filter
      if (filters.startDate && orderDate < filters.startDate) return false;
      if (filters.endDate && orderDate > filters.endDate) return false;

      // Branch filter
      if (filters.branch !== 'all' && o.branch && o.branch !== filters.branch) return false;

      // Employee filter
      if (
        filters.employee !== 'all' &&
        (o.employeeName || '').toLowerCase() !== (filters.employee || '').toLowerCase()
      )
        return false;

      // Customer filter
      if (
        filters.customer !== 'all' &&
        (o.customerName || '').toLowerCase() !== (filters.customer || '').toLowerCase()
      )
        return false;

      // Category filter (if order has items matching category)
      if (filters.category !== 'all') {
        const hasMatchingCategory = (o.items || []).some((item) => {
          const prod = products.find((p) => p.id === item.productId || p.name === item.productName);
          return prod?.category === filters.category;
        });
        if (!hasMatchingCategory) return false;
      }

      return true;
    });
  }, [orders, products, filters]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const expDate = (e.createdAt || '').split('T')[0];
      if (filters.startDate && expDate < filters.startDate) return false;
      if (filters.endDate && expDate > filters.endDate) return false;
      return true;
    });
  }, [expenses, filters]);

  // 5. Global Export Master Excel & Print
  const handleExportMasterExcel = () => {
    const columns = ['Module', 'Reference / Item Name', 'Amount / Metric', 'Category / Details'];
    const rows = [
      ...filteredOrders.map((o) => [
        'Sales Order',
        o.orderNumber || o.id?.slice(0, 6) || 'Order',
        `$${(o.totalAmount || 0).toFixed(2)}`,
        `Customer: ${o.customerName || 'Walk-in'} | Payment: ${(o.paymentMethod || 'cash').toUpperCase()}`,
      ]),
      ...filteredExpenses.map((e) => [
        'Expense',
        e.title || 'Expense',
        `$${(e.amount || 0).toFixed(2)}`,
        `Category: ${e.category} | Created by: ${e.createdBy || 'Admin'}`,
      ]),
      ...ingredients.map((i) => [
        'Inventory Ingredient',
        i.name,
        `${i.stock || 0} ${i.unit || ''}`,
        `Valuation: $${((i.stock || 0) * (i.costPerUnit || 0)).toFixed(2)} | Supplier: ${i.supplierName}`,
      ]),
      ...employees.map((e) => [
        'Staff Performance',
        e.name,
        `$${(e.totalSales || 0).toFixed(2)} sales`,
        `Role: ${e.role} | Salary: $${(e.salary || 0).toFixed(2)}`,
      ]),
    ];

    exportToExcel('Full_Restaurant_BI_Master_Audit', columns, rows);
  };

  const handlePrintFullAudit = () => {
    const totalRev = filteredOrders.reduce((a, b) => a + (b.totalAmount || 0), 0);
    const totalCogs = filteredOrders.reduce((a, b) => a + (b.cogs || 0), 0);
    const totalExp = filteredExpenses.reduce((a, b) => a + (b.amount || 0), 0);
    const netProfit = totalRev - totalCogs - totalExp;

    printReportWindow(
      'Executive Business Intelligence Audit',
      `Period: ${filters.datePreset.toUpperCase()} | Firestore Database Ledger`,
      [
        {
          heading: 'Executive Financial Summary',
          columns: ['KPI Line Item', 'Amount ($USD)', 'Notes'],
          rows: [
            ['Gross Sales Revenue', `$${(totalRev || 0).toFixed(2)}`, 'Total Completed Sales Inflow'],
            ['Cost of Goods Sold (COGS)', `$${(totalCogs || 0).toFixed(2)}`, 'Raw Material Food Cost'],
            ['Operating Expenses', `$${(totalExp || 0).toFixed(2)}`, 'Overhead & Utility Costs'],
            ['Net Operating Income', `$${(netProfit || 0).toFixed(2)}`, 'Bottom-line Profit Position'],
          ],
        },
        {
          heading: 'Filter Parameters Applied',
          columns: ['Filter Name', 'Selected Value'],
          rows: [
            ['Date Range Preset', filters.datePreset.toUpperCase()],
            ['Branch Filter', filters.branch],
            ['Employee Filter', filters.employee],
            ['Category Filter', filters.category],
            ['Customer Filter', filters.customer],
          ],
        },
      ]
    );
  };

  // 12 Specialized Report Tabs Info
  const reportTabs: { type: ReportType; label: string; icon: React.ElementType }[] = [
    { type: 'sales', label: 'Sales Report', icon: DollarSign },
    { type: 'orders', label: 'Orders Velocity', icon: BarChart3 },
    { type: 'customers', label: 'Customers & LTV', icon: Users },
    { type: 'inventory', label: 'Inventory Assets', icon: Package },
    { type: 'employees', label: 'Employee Performance', icon: UserCheck },
    { type: 'suppliers', label: 'Suppliers & POs', icon: Building2 },
    { type: 'kitchen', label: 'Kitchen Operations', icon: Utensils },
    { type: 'delivery', label: 'Delivery & Fleet', icon: Truck },
    { type: 'expenses', label: 'Expenses Audit', icon: CreditCard },
    { type: 'revenue', label: 'Revenue & Taxes', icon: TrendingUp },
    { type: 'profit', label: 'Gross & Net Profit', icon: PieChart },
    { type: 'cashflow', label: 'Cash Flow Stream', icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Executive Business Intelligence & Analytics Module
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time Firestore analytics, peak hours heatmaps, cost benchmarking & multi-format export center
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePrintFullAudit}
            className="bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 font-bold px-3.5 py-2.5 rounded-2xl text-xs transition flex items-center gap-2 cursor-pointer border border-slate-700/60"
          >
            <Printer className="w-4 h-4" /> Print Master Statement
          </button>
          <button
            onClick={handleExportMasterExcel}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-2xl text-xs transition flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Master Excel (.XLSX)
          </button>
        </div>
      </div>

      {/* 2. Global Filter Bar */}
      <FilterBar
        filters={filters}
        onChangeFilters={setFilters}
        branches={availableBranches}
        employees={availableEmployees}
        categories={availableCategories}
        customers={availableCustomers}
        onReset={handleResetFilters}
      />

      {/* 3. Primary Section Navigation (BI Dashboards vs 12 Specialized Reports) */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('bi')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'bi'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          BI Visual Dashboards & Heatmaps
        </button>

        <button
          onClick={() => setActiveTab('specialized')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'specialized'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          12 Specialized Report Modules
        </button>
      </div>

      {/* 4. Active Tab Rendering */}
      {activeTab === 'bi' ? (
        <BIAnalyticsDashboard
          orders={filteredOrders}
          products={products}
          ingredients={ingredients}
          expenses={filteredExpenses}
          employees={employees}
          suppliers={suppliers}
          customers={customers}
        />
      ) : (
        <div className="space-y-6">
          {/* Sub-navigation bar for 12 Specialized Reports */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3 shadow-xl overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              {reportTabs.map((tab) => {
                const Icon = tab.icon;
                const isSelected = selectedReportType === tab.type;
                return (
                  <button
                    key={tab.type}
                    onClick={() => setSelectedReportType(tab.type)}
                    className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-md'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Specialized Report Container */}
          <SpecializedReportModule
            reportType={selectedReportType}
            orders={filteredOrders}
            products={products}
            ingredients={ingredients}
            expenses={filteredExpenses}
            employees={employees}
            suppliers={suppliers}
            purchases={purchases}
            customers={customers}
          />
        </div>
      )}
    </div>
  );
};
