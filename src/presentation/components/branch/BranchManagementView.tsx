import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../../lib/firebase';
import { 
  Branch, 
  BranchStatus, 
  BranchHierarchyType, 
  BranchTransfer, 
  TransferType, 
  TransferStatus, 
  Order, 
  Expense, 
  Employee, 
  Ingredient, 
  Product, 
  Customer, 
  Language 
} from '../../../types';
import { 
  createBranch, 
  updateBranch, 
  disableBranch, 
  deleteBranch, 
  createBranchTransfer, 
  approveBranchTransfer, 
  rejectBranchTransfer, 
  calculateConsolidatedBranchAnalytics
} from '../../../lib/multiBranchService';
import { exportToExcel, printReportWindow } from '../../../lib/reports';
import {
  Building2,
  GitFork,
  Plus,
  Edit,
  Trash2,
  Power,
  ArrowRightLeft,
  Crown,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MapPin,
  Phone,
  Mail,
  Clock,
  Printer,
  FileSpreadsheet,
  BarChart3,
  Search,
  Filter,
  ShieldAlert,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Globe,
  Tag,
  Coins,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import { useAuth } from '../../context/AuthContext';

interface BranchManagementViewProps {
  initialBranches?: Branch[];
  initialOrders?: Order[];
  initialExpenses?: Expense[];
  initialEmployees?: Employee[];
  initialIngredients?: Ingredient[];
  initialProducts?: Product[];
  initialCustomers?: Customer[];
  language?: Language;
}

export const BranchManagementView: React.FC<BranchManagementViewProps> = ({
  initialBranches = [],
  initialOrders = [],
  initialExpenses = [],
  initialEmployees = [],
  initialIngredients = [],
  initialProducts = [],
  initialCustomers = [],
  language
}) => {
  const { language: authLang, role } = useAuth();
  const isManagementRole = ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager'].includes(role || '');
  const activeLang = (language || authLang || 'en') as Language;
  const [currentLang, setCurrentLang] = useState<Language>(activeLang);

  useEffect(() => {
    setCurrentLang(activeLang);
  }, [activeLang]);
  const [activeTab, setActiveTab] = useState<
    'central_hq' | 'branch_list' | 'individual_branch' | 'transfers' | 'comparison'
  >('central_hq');

  // Real-Time Firestore Sync
  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [transfers, setTransfers] = useState<BranchTransfer[]>([]);

  // Selected Branch for Individual Branch Dashboard
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  // Modals & Forms State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);

  // Branch Form
  const [branchForm, setBranchForm] = useState<{
    name: string;
    code: string;
    logo: string;
    address: string;
    city: string;
    country: string;
    gpsLocation: string;
    phone: string;
    email: string;
    workingHours: string;
    timeZone: string;
    currency: string;
    taxRate: number;
    taxId: string;
    status: BranchStatus;
    hierarchyType: BranchHierarchyType;
    isHeadOffice: boolean;
    managerName: string;
  }>({
    name: '',
    code: '',
    logo: '',
    address: '',
    city: '',
    country: '',
    gpsLocation: '',
    phone: '',
    email: '',
    workingHours: '08:00 AM - 11:00 PM',
    timeZone: 'Africa/Mogadishu (UTC+3)',
    currency: 'USD',
    taxRate: 5.0,
    taxId: '',
    status: 'active',
    hierarchyType: 'standard',
    isHeadOffice: false,
    managerName: ''
  });

  // Transfer Form
  const [transferForm, setTransferForm] = useState<{
    transferType: TransferType;
    sourceBranchId: string;
    destinationBranchId: string;
    reason: string;
    cashAmount: number;
    employeeName: string;
    isPermanentEmployeeTransfer: boolean;
    transferItemName: string;
    transferItemQty: number;
  }>({
    transferType: 'inventory',
    sourceBranchId: '',
    destinationBranchId: '',
    reason: '',
    cashAmount: 0,
    employeeName: '',
    isPermanentEmployeeTransfer: true,
    transferItemName: '',
    transferItemQty: 1
  });

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const safeNum = (val: any) => (typeof val === 'number' && !isNaN(val) ? val : 0);

  const normalizeBranch = (id: string, data: any): Branch => ({
    id,
    name: data?.name || 'Unnamed Branch',
    code: data?.code || 'BR-00',
    logo: data?.logo || '',
    address: data?.address || '',
    city: data?.city || 'Main City',
    country: data?.country || 'Somalia',
    gpsLocation: data?.gpsLocation || '',
    phone: data?.phone || '',
    email: data?.email || '',
    workingHours: data?.workingHours || '08:00 AM - 10:00 PM',
    timeZone: data?.timeZone || 'Africa/Mogadishu (UTC+3)',
    currency: data?.currency || 'USD',
    taxRate: typeof data?.taxRate === 'number' ? data.taxRate : 5.0,
    taxId: data?.taxId || '',
    status: (data?.status as BranchStatus) || 'active',
    hierarchyType: (data?.hierarchyType as BranchHierarchyType) || 'standard',
    isHeadOffice: !!data?.isHeadOffice,
    managerName: data?.managerName || '',
    createdAt: data?.createdAt || new Date().toISOString()
  });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Realtime Listeners
  useEffect(() => {
    const handleBranchErr = (err: any) => {
      console.warn('Branch management listener warning:', err?.message || err);
    };

    const unsubBranches = onSnapshot(query(collection(db, COLLECTIONS.BRANCHES)), (snap) => {
      const list: Branch[] = [];
      snap.forEach((d) => list.push(normalizeBranch(d.id, d.data())));
      setBranches(list);
      if (list.length > 0 && !selectedBranchId) {
        setSelectedBranchId(list[0].id);
      }
    }, handleBranchErr);

    const unsubOrders = onSnapshot(query(collection(db, COLLECTIONS.ORDERS)), (snap) => {
      const list: Order[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Order));
      if (list.length > 0) setOrders(list);
    }, handleBranchErr);

    const unsubExpenses = onSnapshot(query(collection(db, COLLECTIONS.EXPENSES)), (snap) => {
      const list: Expense[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Expense));
      if (list.length > 0) setExpenses(list);
    }, handleBranchErr);

    const unsubEmployees = onSnapshot(query(collection(db, COLLECTIONS.EMPLOYEES)), (snap) => {
      const list: Employee[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Employee));
      if (list.length > 0) setEmployees(list);
    }, handleBranchErr);

    const unsubTransfers = onSnapshot(query(collection(db, COLLECTIONS.BRANCH_TRANSFERS)), (snap) => {
      const list: BranchTransfer[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as BranchTransfer));
      setTransfers(list);
    }, handleBranchErr);

    return () => {
      unsubBranches();
      unsubOrders();
      unsubExpenses();
      unsubEmployees();
      unsubTransfers();
    };
  }, [role]);

  // Compute Consolidated Analytics
  const analytics = useMemo(() => {
    return calculateConsolidatedBranchAnalytics({
      branches,
      orders,
      expenses,
      employees,
      ingredients,
      products,
      customers,
      transfers
    });
  }, [branches, orders, expenses, employees, ingredients, products, customers, transfers]);

  // Selected Branch Data for Individual Dashboard
  const currentBranch = useMemo(() => {
    return branches.find((b) => b.id === selectedBranchId) || branches[0];
  }, [branches, selectedBranchId]);

  const currentBranchMetrics = useMemo(() => {
    if (!currentBranch) return null;
    return analytics.rankedBranches.find((r) => r.branchId === currentBranch.id);
  }, [analytics, currentBranch]);

  // Handle Branch Form Submit (Create / Edit)
  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBranch) {
        await updateBranch(editingBranch.id, branchForm);
        showToast(`Branch "${branchForm.name}" updated successfully.`);
      } else {
        await createBranch(branchForm);
        showToast(`New Branch "${branchForm.name}" created successfully.`);
      }
      setShowCreateModal(false);
      setEditingBranch(null);
    } catch (err: any) {
      alert(`Error saving branch: ${err.message}`);
    }
  };

  // Open Edit Modal
  const openEditModal = (b: Branch) => {
    setEditingBranch(b);
    setBranchForm({
      name: b.name,
      code: b.code,
      logo: b.logo || '',
      address: b.address,
      city: b.city,
      country: b.country,
      gpsLocation: b.gpsLocation || '',
      phone: b.phone,
      email: b.email,
      workingHours: b.workingHours,
      timeZone: b.timeZone,
      currency: b.currency,
      taxRate: b.taxRate,
      taxId: b.taxId || '',
      status: b.status,
      hierarchyType: b.hierarchyType,
      isHeadOffice: !!b.isHeadOffice,
      managerName: b.managerName || ''
    });
    setShowCreateModal(true);
  };

  // Handle Disable / Enable
  const handleToggleStatus = async (b: Branch) => {
    const newStatus: BranchStatus = b.status === 'active' ? 'inactive' : 'active';
    await updateBranch(b.id, { status: newStatus });
    showToast(`Branch "${b.name}" set to ${newStatus}.`);
  };

  // Handle Delete
  const handleDeleteBranch = async (b: Branch) => {
    if (confirm(`Are you sure you want to delete branch "${b.name}"?`)) {
      await deleteBranch(b.id);
      showToast(`Branch "${b.name}" deleted.`);
    }
  };

  // Handle Create Transfer
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferForm.sourceBranchId === transferForm.destinationBranchId) {
      alert('Source and Destination branches must be different!');
      return;
    }

    const sourceB = branches.find((b) => b.id === transferForm.sourceBranchId);
    const destB = branches.find((b) => b.id === transferForm.destinationBranchId);

    try {
      await createBranchTransfer({
        transferType: transferForm.transferType,
        sourceBranchId: transferForm.sourceBranchId,
        sourceBranchName: sourceB?.name || 'Branch Source',
        destinationBranchId: transferForm.destinationBranchId,
        destinationBranchName: destB?.name || 'Branch Dest',
        reason: transferForm.reason || 'Inter-branch Operational Allocation',
        cashAmount: transferForm.transferType === 'cash' ? transferForm.cashAmount : undefined,
        employeeName: transferForm.transferType === 'employee' ? transferForm.employeeName : undefined,
        isPermanentEmployeeTransfer: transferForm.isPermanentEmployeeTransfer,
        items:
          transferForm.transferType === 'inventory' || transferForm.transferType === 'product'
            ? [
                {
                  itemId: 'item_' + Date.now(),
                  itemName: transferForm.transferItemName || 'Stock Package',
                  type: transferForm.transferType === 'product' ? 'product' : 'ingredient',
                  quantity: transferForm.transferItemQty || 1,
                  unit: 'units',
                  unitCost: 15
                }
              ]
            : undefined,
        requestedBy: 'HQ Admin'
      });

      showToast('Inter-branch transfer request generated successfully.');
      setShowTransferModal(false);
    } catch (err: any) {
      alert(`Error creating transfer: ${err.message}`);
    }
  };

  // Handle Approve / Reject Transfer
  const handleApproveTransfer = async (transferId: string) => {
    await approveBranchTransfer(transferId, 'Head Office Manager');
    showToast('Transfer approved and ledger adjusted.');
  };

  const handleRejectTransfer = async (transferId: string) => {
    const reason = prompt('Enter rejection reason:') || 'Administrative decision';
    await rejectBranchTransfer(transferId, 'Head Office Manager', reason);
    showToast('Transfer request rejected.');
  };

  // Export Excel
  const handleExportExcel = () => {
    const columns = ['Branch Name', 'Code', 'City', 'Hierarchy', 'Status', 'Sales ($)', 'Expenses ($)', 'Net Profit ($)', 'Employees'];
    const rows = analytics.rankedBranches.map((r) => [
      r.branchName,
      r.branchCode,
      r.city || '',
      r.isHeadOffice ? 'Head Office' : 'Branch',
      r.status || 'active',
      `$${safeNum(r.sales).toFixed(2)}`,
      `$${safeNum(r.expenses).toFixed(2)}`,
      `$${safeNum(r.netProfit).toFixed(2)}`,
      safeNum(r.employeeCount)
    ]);
    exportToExcel('Multi_Branch_Consolidated_Performance_Report', columns, rows);
  };

  // Filtered branches for list view
  const filteredBranches = branches.filter((b) => {
    const q = (searchQuery || '').toLowerCase();
    const name = (b?.name || '').toLowerCase();
    const city = (b?.city || '').toLowerCase();
    const code = (b?.code || '').toLowerCase();
    return name.includes(q) || city.includes(q) || code.includes(q);
  });

  const COLORS = ['#10B981', '#6366F1', '#F59E0B', '#EF4444', '#14B8A6'];

  return (
    <div className="space-y-6 pb-12">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="font-bold text-xs">{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                <Crown className="w-3.5 h-3.5 text-amber-400" /> Phase 13 Multi-Branch Management
              </span>
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                <GitFork className="w-3.5 h-3.5 text-indigo-400" /> {analytics.totalBranchesCount} Active Outlets
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Building2 className="w-8 h-8 text-emerald-400" />
              Head Office Multi-Branch Enterprise HQ
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-3xl leading-relaxed">
              Consolidated multi-branch architecture. Real-time sales consolidation, inter-branch inventory & cash transfers, employee roster management, financial comparison & ranking models.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isManagementRole && (
              <button
                onClick={() => {
                  setEditingBranch(null);
                  setBranchForm({
                    name: '',
                    code: `BR-0${branches.length + 1}`,
                    logo: '',
                    address: '',
                    city: 'Mogadishu',
                    country: 'Somalia',
                    gpsLocation: '',
                    phone: '+252 61 ',
                    email: '',
                    workingHours: '08:00 AM - 11:00 PM',
                    timeZone: 'Africa/Mogadishu (UTC+3)',
                    currency: 'USD',
                    taxRate: 5.0,
                    taxId: '',
                    status: 'active',
                    hierarchyType: 'standard',
                    isHeadOffice: false,
                    managerName: ''
                  });
                  setShowCreateModal(true);
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-2xl text-xs transition flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" /> Add New Branch
              </button>
            )}

            {isManagementRole && (
              <button
                onClick={() => setShowTransferModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-4 py-2.5 rounded-2xl text-xs transition flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                <ArrowRightLeft className="w-4 h-4" /> Inter-Branch Transfer
              </button>
            )}

            <button
              onClick={handleExportExcel}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-4 py-2.5 rounded-2xl text-xs transition flex items-center gap-2 cursor-pointer border border-slate-700"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export HQ Audit (.XLSX)
            </button>
          </div>
        </div>

        {/* Consolidated KPI Ribbon */}
        <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 relative z-10">
          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Consolidated Sales</span>
            <span className="text-sm font-extrabold text-emerald-400 mt-0.5 block">${safeNum(analytics?.totalConsolidatedSales).toFixed(2)}</span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Consolidated Profit</span>
            <span className="text-sm font-extrabold text-indigo-400 mt-0.5 block">${safeNum(analytics?.totalConsolidatedProfit).toFixed(2)}</span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Orders</span>
            <span className="text-sm font-extrabold text-white mt-0.5 block">{safeNum(analytics?.totalConsolidatedOrders)} Orders</span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Inventory Valuation</span>
            <span className="text-sm font-extrabold text-teal-400 mt-0.5 block">${safeNum(analytics?.totalInventoryValuation).toLocaleString()}</span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Workforce</span>
            <span className="text-sm font-extrabold text-purple-400 mt-0.5 block">{safeNum(analytics?.totalEmployeesCount)} Employees</span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Pending Transfers</span>
            <span className="text-sm font-extrabold text-amber-400 mt-0.5 block">{(analytics?.pendingTransfers || []).length} Requests</span>
          </div>
        </div>
      </div>

      {/* Main Specialized Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-2.5 shadow-xl overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          <button
            onClick={() => setActiveTab('central_hq')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'central_hq'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <Crown className="w-4 h-4" />
            Head Office Central Dashboard
          </button>

          <button
            onClick={() => setActiveTab('branch_list')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'branch_list'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Branch Directory & Status ({branches.length})
          </button>

          <button
            onClick={() => setActiveTab('individual_branch')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'individual_branch'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Individual Branch Dashboard
          </button>

          <button
            onClick={() => setActiveTab('transfers')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'transfers'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Inter-Branch Transfers ({transfers.length})
          </button>

          <button
            onClick={() => setActiveTab('comparison')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'comparison'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Consolidated Comparison & Ranking
          </button>
        </div>
      </div>

      {/* TAB 1: HEAD OFFICE CENTRAL DASHBOARD */}
      {activeTab === 'central_hq' && (
        <div className="space-y-6">
          {/* Top Branch & Lowest Branch Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {analytics.topBranch && (
              <div className="bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-500/30 rounded-3xl p-6 relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black px-3 py-1 rounded-full uppercase flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-amber-400" /> #1 Top Performing Branch
                  </span>
                  <span className="text-xs font-bold text-emerald-400">{analytics.topBranch.branchCode}</span>
                </div>
                <h3 className="text-xl font-extrabold text-white">{analytics.topBranch.branchName}</h3>
                <p className="text-xs text-slate-300 mt-1">{analytics.topBranch.city}, Somalia • Head Office Flagship</p>

                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-emerald-500/20 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Revenue</span>
                    <span className="font-extrabold text-emerald-400 text-sm">${safeNum(analytics.topBranch.sales).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Net Profit</span>
                    <span className="font-extrabold text-indigo-400 text-sm">${safeNum(analytics.topBranch.netProfit).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Orders Handled</span>
                    <span className="font-extrabold text-white text-sm">{safeNum(analytics.topBranch.ordersCount)}</span>
                  </div>
                </div>
              </div>
            )}

            {analytics.lowestBranch && (
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black px-3 py-1 rounded-full uppercase flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Needs Growth Support
                  </span>
                  <span className="text-xs font-bold text-slate-400">{analytics.lowestBranch.branchCode}</span>
                </div>
                <h3 className="text-xl font-extrabold text-white">{analytics.lowestBranch.branchName}</h3>
                <p className="text-xs text-slate-400 mt-1">{analytics.lowestBranch.city} • Express Outlet</p>

                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Revenue</span>
                    <span className="font-extrabold text-amber-400 text-sm">${safeNum(analytics.lowestBranch.sales).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Net Profit</span>
                    <span className="font-extrabold text-slate-300 text-sm">${safeNum(analytics.lowestBranch.netProfit).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Active Staff</span>
                    <span className="font-extrabold text-white text-sm">{safeNum(analytics.lowestBranch.employeeCount)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Branch Performance Ranking Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-400" /> Branch Performance Ranking & Consolidation
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Real-time ranking based on sales volume, net margin, and order completion efficiency.</p>
              </div>

              <button
                onClick={() => {
                  printReportWindow('Head Office Multi-Branch Consolidated Audit', 'Enterprise Branch Rankings', [
                    {
                      heading: 'Branch Ranking Summary',
                      columns: ['Rank', 'Branch Name', 'Code', 'Sales ($)', 'Profit ($)', 'Status'],
                      rows: analytics.rankedBranches.map((r, i) => [
                        `#${i + 1}`,
                        r.branchName,
                        r.branchCode,
                        `$${r.sales.toFixed(2)}`,
                        `$${r.netProfit.toFixed(2)}`,
                        r.status
                      ])
                    }
                  ]);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer border border-slate-700"
              >
                <Printer className="w-4 h-4" /> Print Rankings
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-3 px-3">Rank</th>
                    <th className="py-3 px-3">Branch Details</th>
                    <th className="py-3 px-3">Location</th>
                    <th className="py-3 px-3">Sales Volume</th>
                    <th className="py-3 px-3">Net Profit</th>
                    <th className="py-3 px-3">Margin %</th>
                    <th className="py-3 px-3">Staff</th>
                    <th className="py-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {analytics.rankedBranches.map((r, index) => (
                    <tr key={r.branchId} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3 font-extrabold text-emerald-400">#{index + 1}</td>
                      <td className="py-3 px-3 font-bold text-white">
                        <div className="flex items-center gap-2">
                          {r.isHeadOffice && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                          <span>{r.branchName}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({r.branchCode})</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-300">{r.city || ''}</td>
                      <td className="py-3 px-3 font-extrabold text-emerald-400">${safeNum(r.sales).toFixed(2)}</td>
                      <td className="py-3 px-3 font-extrabold text-indigo-400">${safeNum(r.netProfit).toFixed(2)}</td>
                      <td className="py-3 px-3 font-bold text-amber-400">{safeNum(r.profitMargin)}%</td>
                      <td className="py-3 px-3 text-slate-300">{safeNum(r.employeeCount)} staff</td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          r.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BRANCH DIRECTORY & STATUS */}
      {activeTab === 'branch_list' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-4">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search branches by name, city, or code..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="text-xs text-slate-400 font-semibold whitespace-nowrap">
              Showing {filteredBranches.length} of {branches.length} branches
            </div>
          </div>

          {filteredBranches.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400 space-y-3">
              <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-bold text-white">No Branches Found</p>
              <p className="text-xs text-slate-400">No branch records match your search query or no branches exist yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBranches.map((b) => (
              <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 hover:border-slate-700 transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center font-black text-emerald-400 text-sm overflow-hidden">
                      {b.logo ? (
                        <img src={b.logo} alt={b.name} className="w-full h-full object-cover" />
                      ) : (
                        (b.code || 'BR').slice(0, 3)
                      )}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-white text-sm flex items-center gap-1.5">
                        {b.name}
                        {b.isHeadOffice && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono block">{b.code} • {(b.hierarchyType || 'STANDARD').toUpperCase()}</span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                    b.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}>
                    {b.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300 pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{b.address}, {b.city}, {b.country}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{b.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{b.workingHours}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>Manager: {b.managerName || 'Unassigned'}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setSelectedBranchId(b.id);
                      setActiveTab('individual_branch');
                    }}
                    className="flex-1 bg-slate-950 hover:bg-slate-800 text-emerald-400 font-bold py-2 rounded-xl text-xs text-center border border-slate-800 cursor-pointer"
                  >
                    View Branch Dashboard
                  </button>

                  {isManagementRole && (
                    <>
                      <button
                        onClick={() => openEditModal(b)}
                        className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 cursor-pointer"
                        title="Edit Branch"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleToggleStatus(b)}
                        className={`p-2 rounded-xl border cursor-pointer ${
                          b.status === 'active'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                        }`}
                        title={b.status === 'active' ? 'Disable Branch' : 'Enable Branch'}
                      >
                        <Power className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteBranch(b)}
                        className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 cursor-pointer"
                        title="Delete Branch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* TAB 3: INDIVIDUAL BRANCH DASHBOARD */}
      {activeTab === 'individual_branch' && (
        <div className="space-y-6">
          {/* Branch Selector Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Building2 className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase">Select Branch to View:</span>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2 text-xs font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code}) - {b.city}
                  </option>
                ))}
              </select>
            </div>

            {currentBranch && (
              <div className="text-xs text-slate-400 font-semibold">
                Status: <span className="text-emerald-400 uppercase font-bold">{currentBranch.status}</span> • Currency: {currentBranch.currency} • Tax Rate: {currentBranch.taxRate}%
              </div>
            )}
          </div>

          {currentBranchMetrics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-1">
                <span className="text-xs text-slate-400 font-bold block uppercase">Branch Total Sales</span>
                <span className="text-xl font-black text-emerald-400">${safeNum(currentBranchMetrics.sales).toFixed(2)}</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-1">
                <span className="text-xs text-slate-400 font-bold block uppercase">Branch Net Profit</span>
                <span className="text-xl font-black text-indigo-400">${safeNum(currentBranchMetrics.netProfit).toFixed(2)}</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-1">
                <span className="text-xs text-slate-400 font-bold block uppercase">Orders Completed</span>
                <span className="text-xl font-black text-white">{safeNum(currentBranchMetrics.ordersCount)} Orders</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-1">
                <span className="text-xs text-slate-400 font-bold block uppercase">Branch Workforce</span>
                <span className="text-xl font-black text-purple-400">{safeNum(currentBranchMetrics.employeeCount)} Staff</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: INTER-BRANCH TRANSFERS HUB */}
      {activeTab === 'transfers' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-indigo-400" /> Inter-Branch Transfer Hub & Approval Workflow
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Manage inventory re-allocation, cash balancing & temporary or permanent employee re-assignments.</p>
              </div>

              {isManagementRole && (
                <button
                  onClick={() => setShowTransferModal(true)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2 rounded-2xl text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Request New Transfer
                </button>
              )}
            </div>

            {/* Pending Transfers List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Pending Transfer Approvals ({(analytics?.pendingTransfers || []).length})
              </h4>

              {(analytics?.pendingTransfers || []).length === 0 ? (
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                  No pending inter-branch transfer requests at this moment.
                </div>
              ) : (
                (analytics?.pendingTransfers || []).map((t) => (
                  <div key={t.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-emerald-400">{t.transferNumber}</span>
                        <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">{t.transferType}</span>
                      </div>
                      <p className="text-slate-300 mt-1">
                        <strong>From:</strong> {t.sourceBranchName} → <strong>To:</strong> {t.destinationBranchName}
                      </p>
                      <p className="text-slate-400 mt-0.5 font-sans">Reason: {t.reason}</p>
                    </div>

                    {isManagementRole && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveTransfer(t.id)}
                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-3 py-1.5 rounded-xl text-xs cursor-pointer shadow-sm"
                        >
                          Approve & Execute
                        </button>

                        <button
                          onClick={() => handleRejectTransfer(t.id)}
                          className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer border border-rose-500/30"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CONSOLIDATED COMPARISON & RANKING */}
      {activeTab === 'comparison' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" /> Multi-Branch Sales & Margin Comparison Chart
            </h3>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.rankedBranches}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="branchCode" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                  <Legend />
                  <Bar dataKey="sales" name="Sales Revenue ($)" fill="#10B981" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="netProfit" name="Net Profit ($)" fill="#6366F1" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT BRANCH MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                {editingBranch ? `Edit Branch: ${editingBranch.name}` : 'Create New Outlet / Branch'}
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBranch} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Branch Name *</label>
                  <input
                    type="text"
                    required
                    value={branchForm.name}
                    onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                    placeholder="e.g. Hargeisa Downtown"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Branch Code *</label>
                  <input
                    type="text"
                    required
                    value={branchForm.code}
                    onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })}
                    placeholder="e.g. BR-HAR-01"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={branchForm.city}
                    onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Country *</label>
                  <input
                    type="text"
                    required
                    value={branchForm.country}
                    onChange={(e) => setBranchForm({ ...branchForm, country: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Address *</label>
                  <input
                    type="text"
                    required
                    value={branchForm.address}
                    onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={branchForm.phone}
                    onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Working Hours</label>
                  <input
                    type="text"
                    value={branchForm.workingHours}
                    onChange={(e) => setBranchForm({ ...branchForm, workingHours: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={branchForm.taxRate}
                    onChange={(e) => setBranchForm({ ...branchForm, taxRate: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20"
                >
                  Save Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INTER-BRANCH TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                New Inter-Branch Transfer Request
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Transfer Type</label>
                <select
                  value={transferForm.transferType}
                  onChange={(e) => setTransferForm({ ...transferForm, transferType: e.target.value as TransferType })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="inventory">Kitchen Inventory (Ingredients)</option>
                  <option value="product">Finished Products</option>
                  <option value="cash">Cash / Vault Funds</option>
                  <option value="employee">Employee Re-assignment</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Source Branch *</label>
                  <select
                    required
                    value={transferForm.sourceBranchId}
                    onChange={(e) => setTransferForm({ ...transferForm, sourceBranchId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Select Source</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Destination Branch *</label>
                  <select
                    required
                    value={transferForm.destinationBranchId}
                    onChange={(e) => setTransferForm({ ...transferForm, destinationBranchId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Select Destination</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {transferForm.transferType === 'cash' ? (
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Cash Amount ($USD)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={transferForm.cashAmount}
                    onChange={(e) => setTransferForm({ ...transferForm, cashAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              ) : transferForm.transferType === 'employee' ? (
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Employee Name</label>
                  <input
                    type="text"
                    required
                    value={transferForm.employeeName}
                    onChange={(e) => setTransferForm({ ...transferForm, employeeName: e.target.value })}
                    placeholder="e.g. Hassan Ahmed"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Item Description</label>
                    <input
                      type="text"
                      required
                      value={transferForm.transferItemName}
                      onChange={(e) => setTransferForm({ ...transferForm, transferItemName: e.target.value })}
                      placeholder="e.g. Basmati Rice 25kg"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Quantity</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={transferForm.transferItemQty}
                      onChange={(e) => setTransferForm({ ...transferForm, transferItemQty: parseInt(e.target.value) || 1 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-400 font-bold mb-1">Transfer Justification / Reason *</label>
                <textarea
                  required
                  rows={2}
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  placeholder="Reason for inter-branch transfer..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-emerald-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20"
                >
                  Submit Transfer Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
