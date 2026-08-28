import React, { useState, useEffect } from 'react';
import { Product, Order, Expense, Employee, Supplier, Ingredient } from '../../types';
import { Category, Customer, Branch, Revenue, AISetting, UserPermission } from '../../domain/entities/admin';
import { AdminRepositoryImpl } from '../../data/repositories/AdminRepositoryImpl';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  Package,
  Layers,
  ShoppingBag,
  Users,
  Building2,
  DollarSign,
  TrendingUp,
  Sliders,
  Lock,
  BarChart3,
  PlusCircle,
  X,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  Bot
} from 'lucide-react';

interface AdminPanelViewProps {
  products: Product[];
  orders: Order[];
  expenses: Expense[];
  employees: Employee[];
  suppliers: Supplier[];
  ingredients: Ingredient[];
  onRefresh?: () => void;
}

const adminRepo = new AdminRepositoryImpl();

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  products,
  orders,
  expenses,
  employees,
  suppliers,
  ingredients,
  onRefresh
}) => {
  const { userRecord, user } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'analytics' | 'products' | 'categories' | 'orders' | 'customers' |
    'employees' | 'inventory' | 'suppliers' | 'expenses' | 'revenues' |
    'reports' | 'branches' | 'ai_settings' | 'permissions'
  >('analytics');

  // Async Admin Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [aiSettings, setAiSettings] = useState<AISetting | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [custName, setCustName] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPhone, setCustPhone] = useState('');

  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchLoc, setBranchLoc] = useState('');

  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);
  const [revSource, setRevSource] = useState('Catering Event');
  const [revAmount, setRevAmount] = useState(500);
  const [revPayMethod, setRevPayMethod] = useState('bank_transfer');
  const [revBranchId, setRevBranchId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [catList, custList, branchList, revList, aiConf, permList] = await Promise.all([
        adminRepo.fetchCategories(),
        adminRepo.fetchCustomers(),
        adminRepo.fetchBranches(),
        adminRepo.fetchRevenues(),
        adminRepo.fetchAISettings(),
        adminRepo.fetchUserPermissions()
      ]);
      setCategories(catList);
      setCustomers(custList);
      setBranches(branchList);
      setRevenues(revList);
      setAiSettings(aiConf);
      setPermissions(permList);
    } catch (err: any) {
      console.warn("Failed loading admin data, using local state fallback:", err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  // Handlers
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await adminRepo.createCategory({
        name: newCatName,
        slug: (newCatName || 'category').toLowerCase().replace(/\s+/g, '-'),
        description: newCatDesc,
        itemCount: 0
      });
      setIsCategoryModalOpen(false);
      setNewCatName('');
      setNewCatDesc('');
      loadAdminData();
    } catch (err: any) {
      alert(`Category creation failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await adminRepo.createCustomer({
        name: custName,
        email: custEmail,
        phone: custPhone,
        totalOrders: 0,
        totalSpent: 0,
        loyaltyPoints: 100,
        createdAt: new Date().toISOString()
      });
      setIsCustomerModalOpen(false);
      setCustName('');
      setCustEmail('');
      loadAdminData();
    } catch (err: any) {
      alert(`Customer creation failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await adminRepo.createBranch({
        name: branchName,
        code: branchCode,
        location: branchLoc,
        managerName: 'Branch Manager',
        status: 'active',
        dailyRevenue: 0,
        createdAt: new Date().toISOString()
      });
      setIsBranchModalOpen(false);
      setBranchName('');
      setBranchCode('');
      loadAdminData();
    } catch (err: any) {
      alert(`Branch creation failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordRevenue = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const authoritativeBranchId = revBranchId || (userRecord?.branchId && userRecord.branchId !== 'all' ? userRecord.branchId : (branches.find(b => b.status === 'active')?.id || 'branch_hq_01'));
      await adminRepo.recordRevenue({
        source: revSource,
        amount: revAmount,
        paymentMethod: revPayMethod,
        referenceNumber: `REV-${Math.floor(10000 + Math.random() * 90000)}`,
        branchId: authoritativeBranchId,
        createdAt: new Date().toISOString()
      });
      setIsRevenueModalOpen(false);
      loadAdminData();
    } catch (err: any) {
      alert(`Revenue record failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAISettings = async () => {
    if (!aiSettings) return;
    setIsSubmitting(true);
    try {
      await adminRepo.updateAISettings(aiSettings);
      alert("AI Configuration synchronized successfully with Cloud Firestore!");
    } catch (err: any) {
      alert(`AI Settings update failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Analytics Metrics
  const totalSales = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalExpensesAmt = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalCOGS = orders.reduce((sum, o) => sum + (o.cogs || 0), 0);
  const netProfit = totalSales - totalExpensesAmt - totalCOGS;

  const adminNavs = [
    { id: 'analytics', label: 'Live Analytics', icon: BarChart3 },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'categories', label: 'Categories', icon: Layers },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'suppliers', label: 'Suppliers', icon: Building2 },
    { id: 'expenses', label: 'Expenses', icon: DollarSign },
    { id: 'revenues', label: 'Revenues', icon: TrendingUp },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'branches', label: 'Branches', icon: Building2 },
    { id: 'ai_settings', label: 'AI Settings', icon: Bot },
    { id: 'permissions', label: 'Permissions', icon: Lock }
  ];

  return (
    <div className="space-y-6">
      
      {/* Admin Panel Header */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            Executive Enterprise Administration Control Center
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-branch synchronization, product catalogs, permissions & AI engine settings
          </p>
        </div>

        <button
          onClick={loadAdminData}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3.5 py-2 rounded-2xl text-xs transition flex items-center gap-2 cursor-pointer border border-slate-700"
        >
          <RefreshCw className={`w-4 h-4 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
          Sync Firebase
        </button>
      </div>

      {/* Admin Sub-navigation Tabs */}
      <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 text-xs overflow-x-auto gap-1">
        {adminNavs.map(nav => {
          const Icon = nav.icon;
          const isActive = activeTab === nav.id;
          return (
            <button
              key={nav.id}
              onClick={() => setActiveTab(nav.id as any)}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer ${
                isActive ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {nav.label}
            </button>
          );
        })}
      </div>

      {/* 1. Live Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Gross Sales</span>
              <h3 className="text-2xl font-extrabold text-white mt-2">${(totalSales || 0).toFixed(2)}</h3>
              <span className="text-[10px] text-emerald-400 mt-1 block">Live Firestore Revenue Sync</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Kitchen COGS</span>
              <h3 className="text-2xl font-extrabold text-amber-400 mt-2">${(totalCOGS || 0).toFixed(2)}</h3>
              <span className="text-[10px] text-slate-400 mt-1 block">Raw Ingredient Cost</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Operating Expenses</span>
              <h3 className="text-2xl font-extrabold text-rose-400 mt-2">${(totalExpensesAmt || 0).toFixed(2)}</h3>
              <span className="text-[10px] text-slate-400 mt-1 block">Overhead & Salaries</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Net Profit</span>
              <h3 className={`text-2xl font-extrabold mt-2 ${netProfit >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                ${(netProfit || 0).toFixed(2)}
              </h3>
              <span className="text-[10px] text-teal-400 mt-1 block">Net Profit Margin</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white mb-3">Enterprise Health Metrics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Orders</span>
                <span className="text-lg font-extrabold text-emerald-400">{orders.length}</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Menu Dishes</span>
                <span className="text-lg font-extrabold text-emerald-400">{products.length}</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Registered Staff</span>
                <span className="text-lg font-extrabold text-emerald-400">{employees.length}</span>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Active Branches</span>
                <span className="text-lg font-extrabold text-emerald-400">{branches.length || 1}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Products Tab */}
      {activeTab === 'products' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Product Catalog Management</h3>
            <span className="text-xs text-slate-400 font-mono">{products.length} menu items</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Dish Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Retail Price</th>
                  <th className="py-3 px-4">Unit Cost</th>
                  <th className="py-3 px-4">Stock</th>
                  <th className="py-3 px-4">Sales Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-bold text-white">{p.name}</td>
                    <td className="py-3 px-4 text-slate-400">{p.category}</td>
                    <td className="py-3 px-4 font-extrabold text-emerald-400">${(p.price || 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-slate-400">${(p.cost || 0).toFixed(2)}</td>
                    <td className="py-3 px-4 font-bold text-white">{p.stock}</td>
                    <td className="py-3 px-4 text-slate-400">{p.salesCount || 0} sold</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Categories Tab */}
      {activeTab === 'categories' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Menu Categories</h3>
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" /> Add Category
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {categories.map(cat => (
              <div key={cat.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-bold text-white">{cat.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">{cat.description || 'Standard category'}</p>
                </div>
                <button
                  onClick={() => adminRepo.deleteCategory(cat.id).then(() => loadAdminData())}
                  className="text-slate-500 hover:text-rose-400 cursor-pointer p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Orders Tab */}
      {activeTab === 'orders' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white">Order Pipeline Supervision</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">#{o.orderNumber}</td>
                    <td className="py-3 px-4 font-medium text-white">{o.customerName || 'Walk-in'}</td>
                    <td className="py-3 px-4 font-extrabold text-white">${(o.totalAmount || 0).toFixed(2)}</td>
                    <td className="py-3 px-4 font-bold uppercase text-emerald-400">{o.status}</td>
                    <td className="py-3 px-4 text-right text-slate-500">{new Date(o.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Customers Tab */}
      {activeTab === 'customers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Customer Loyalty Directory</h3>
            <button
              onClick={() => setIsCustomerModalOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" /> Add Customer
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Loyalty Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {customers.map(c => (
                  <tr key={c.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-bold text-white">{c.name}</td>
                    <td className="py-3 px-4 text-slate-400">{c.email}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{c.phone}</td>
                    <td className="py-3 px-4 font-extrabold text-emerald-400">{c.loyaltyPoints} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Employees Tab */}
      {activeTab === 'employees' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white">Staff Roster</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {employees.map(e => (
              <div key={e.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <h4 className="text-sm font-bold text-white">{e.name}</h4>
                <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {e.role}
                </span>
                <p className="text-xs text-slate-400 mt-2">Salary: ${e.salary}/mo</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white">Raw Kitchen Inventory</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Ingredient</th>
                  <th className="py-3 px-4">Stock Level</th>
                  <th className="py-3 px-4">Unit Cost</th>
                  <th className="py-3 px-4">Supplier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {ingredients.map(ing => (
                  <tr key={ing.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-bold text-white">{ing.name}</td>
                    <td className="py-3 px-4 font-extrabold text-emerald-400">{ing.stock} {ing.unit}</td>
                    <td className="py-3 px-4 text-slate-400">${(ing.costPerUnit || 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-slate-400">{ing.supplierName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. Suppliers Tab */}
      {activeTab === 'suppliers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white">Vendors & Suppliers</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {suppliers.map(s => (
              <div key={s.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <h4 className="text-sm font-bold text-white">{s.name}</h4>
                <p className="text-xs text-slate-400 mt-1">Contact: {s.contactPerson} ({s.phone})</p>
                <p className="text-xs text-amber-400 font-bold mt-2">Payables: ${(s.pendingAmount || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 9. Expenses Tab */}
      {activeTab === 'expenses' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white">Operational Expenses Ledger</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Amount ($)</th>
                  <th className="py-3 px-4 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {expenses.map(e => (
                  <tr key={e.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-bold text-white">{e.title}</td>
                    <td className="py-3 px-4 text-slate-400">{e.category}</td>
                    <td className="py-3 px-4 font-extrabold text-amber-400">${(e.amount || 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-slate-500">{new Date(e.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 10. Revenues Tab */}
      {activeTab === 'revenues' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Supplementary Revenues Log</h3>
            <button
              onClick={() => setIsRevenueModalOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" /> Record Revenue
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Ref #</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Amount ($)</th>
                  <th className="py-3 px-4 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {revenues.map(r => (
                  <tr key={r.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">{r.referenceNumber}</td>
                    <td className="py-3 px-4 font-medium text-white">{r.source}</td>
                    <td className="py-3 px-4 font-extrabold text-teal-400">${(r.amount || 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 11. Reports Tab */}
      {activeTab === 'reports' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h3 className="text-base font-bold text-white mb-2">Executive Reports</h3>
          <p className="text-xs text-slate-400">Access the full PDF & Excel report exporter from the main navigation tab.</p>
        </div>
      )}

      {/* 12. Branches Tab */}
      {activeTab === 'branches' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Restaurant Branches</h3>
            <button
              onClick={() => setIsBranchModalOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" /> Add Branch
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {branches.map(b => (
              <div key={b.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-start">
                  <h4 className="text-sm font-bold text-white">{b.name} ({b.code})</h4>
                  <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {b.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{b.location}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 13. AI Settings Tab */}
      {activeTab === 'ai_settings' && aiSettings && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5 max-w-xl text-xs">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-emerald-400" /> AI Advisor Core Settings
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-slate-400 font-bold block mb-1">Gemini Model Alias</label>
              <input
                type="text"
                value={aiSettings.model}
                onChange={e => setAiSettings({ ...aiSettings, model: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 font-bold block mb-1">Language Mode</label>
              <select
                value={aiSettings.languageMode}
                onChange={e => setAiSettings({ ...aiSettings, languageMode: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              >
                <option value="auto">Auto Detect (Multilingual)</option>
                <option value="en">English Only</option>
                <option value="ar">Arabic Only</option>
                <option value="so">Somali Only</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 font-bold block mb-1">System Directive Addon</label>
              <textarea
                rows={3}
                value={aiSettings.systemPromptAddon || ''}
                onChange={e => setAiSettings({ ...aiSettings, systemPromptAddon: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white resize-none"
              />
            </div>
          </div>

          <button
            onClick={handleSaveAISettings}
            disabled={isSubmitting}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-3 rounded-xl transition cursor-pointer"
          >
            {isSubmitting ? 'Saving Configuration...' : 'Save & Sync AI Settings'}
          </button>
        </div>
      )}

      {/* 14. User Permissions Tab */}
      {activeTab === 'permissions' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white">RBAC Role Permissions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {permissions.map(p => (
              <div key={p.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-white">{p.userName}</h4>
                  <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {p.role}
                  </span>
                </div>
                <p className="text-slate-400">{p.email}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddCategory} className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative text-xs">
            <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white">Add Menu Category</h3>
            <input
              type="text"
              required
              placeholder="Category Name"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
            <button type="submit" className="w-full bg-emerald-500 text-slate-950 font-bold py-3 rounded-xl">Save Category</button>
          </form>
        </div>
      )}

    </div>
  );
};
