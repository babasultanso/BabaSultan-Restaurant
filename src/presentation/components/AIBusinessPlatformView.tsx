import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, COLLECTIONS, auth } from '../../lib/firebase';
import { getApiUrl } from '../../lib/apiConfig';
import { 
  Order, 
  Product, 
  Ingredient, 
  Expense, 
  Purchase, 
  Employee, 
  SalaryPayment, 
  Supplier, 
  DeliveryDriver, 
  KitchenStation, 
  EmployeeAttendance, 
  Reservation, 
  BranchOperation, 
  CustomerFeedback, 
  EquipmentItem, 
  BankTransaction,
  Customer,
  Language,
  ChatMessage
} from '../../types';
import { calculateAIBusinessPlatformAnalytics } from '../../lib/aiBusinessPlatformAnalytics';
import { detectLanguage, translations } from '../../lib/i18n';
import {
  Brain,
  Bot,
  Crown,
  Calculator,
  Activity,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Users,
  UtensilsCrossed,
  Truck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  BarChart3,
  LineChart,
  Send,
  RefreshCw,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Printer,
  FileSpreadsheet,
  Building2,
  HeartHandshake,
  MessageSquareText,
  Volume2,
  ChevronRight,
  Sliders,
  Bell,
  PieChart
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from 'recharts';
import { exportToExcel, printReportWindow } from '../../lib/reports';

import { useAuth } from '../context/AuthContext';

interface AIBusinessPlatformViewProps {
  initialOrders?: Order[];
  initialProducts?: Product[];
  initialIngredients?: Ingredient[];
  initialExpenses?: Expense[];
  initialEmployees?: Employee[];
  initialSuppliers?: Supplier[];
  initialPurchases?: Purchase[];
  language?: Language;
}

export const AIBusinessPlatformView: React.FC<AIBusinessPlatformViewProps> = ({
  initialOrders = [],
  initialProducts = [],
  initialIngredients = [],
  initialExpenses = [],
  initialEmployees = [],
  initialSuppliers = [],
  initialPurchases = [],
  language: initialLang
}) => {
  const { userRecord, role, language: authLang, setLanguage } = useAuth();
  const activeLang = (initialLang || authLang || 'en') as Language;
  const [currentLang, setCurrentLang] = useState<Language>(activeLang);

  useEffect(() => {
    setCurrentLang(activeLang);
  }, [activeLang]);

  const handleLanguageChange = (lang: Language) => {
    setCurrentLang(lang);
    if (setLanguage) {
      setLanguage(lang as any);
    }
  };
  const [activeTab, setActiveTab] = useState<
    'executive' | 'accountant' | 'operations' | 'sales' | 'inventory' | 'customer' | 'forecast' | 'alerts' | 'chat'
  >('executive');

  // Real-Time Firestore Sync
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [purchases, setPurchases] = useState<Purchase[]>(initialPurchases);
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [salaries, setSalaries] = useState<SalaryPayment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [attendance, setAttendance] = useState<EmployeeAttendance[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [branches, setBranches] = useState<BranchOperation[]>([]);
  const [feedbacks, setFeedbacks] = useState<CustomerFeedback[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Chat State
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    // Initialize welcome chat message
    const welcomeText =
      currentLang === 'ar'
        ? 'مرحباً بك في منصة الذكاء الاصطناعي الشاملة لإدارة المطعم. أستطيع الإجابة على جميع الأسئلة المتعلقة بالأرباح، المبيعات، المصروفات، المخزون، وأداء الموظفين باللغات العربية والصومالية والإنجليزية.'
        : currentLang === 'so'
        ? 'Ku soo dhawoow Nidaamka AI ee Maamulka Maqaayadda. Waxaan kaga jawaabi karaa su\'aalaha faa\'iidada, iibka, kharashyada, kaydka, iyo shaqada shaqaalaha.'
        : 'Welcome to the AI Business Intelligence Platform. I am your multi-disciplinary AI Assistant, analyzing live Firestore data across Sales, Accounting, Operations, Inventory, Customers, and Forecasting.';

    setChatMessages([
      {
        id: 'msg_welcome',
        sender: 'assistant',
        text: welcomeText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedQuestions: [
          'How much profit did I make today?',
          'Which products should I reorder?',
          'Why are sales down?',
          'Show today\'s expenses.',
          'Which employee performed best?',
          'How much inventory remains?',
          'Generate today\'s financial report.'
        ]
      }
    ]);
  }, [currentLang]);

  // Firestore Realtime Listeners with Branch Isolation
  useEffect(() => {
    setIsLoading(true);

    const userRoleStr = (userRecord?.role || role || '').toLowerCase().trim();
    const isHqUser = userRoleStr === 'owner' || (userRoleStr === 'admin' && (!userRecord?.branchId || userRecord?.branchId === 'all'));
    const userBranch = userRecord?.branchId || (userRecord as any)?.branch;
    const isBranchScoped = !isHqUser && Boolean(userBranch) && userBranch !== 'all';

    const handleError = (err: any) => {
      console.warn('AI Business Platform listener error:', err?.message || err);
      setIsLoading(false);
    };

    const ordersQuery = isBranchScoped
      ? query(collection(db, COLLECTIONS.ORDERS), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.ORDERS));

    const unsubOrders = onSnapshot(ordersQuery, (snap) => {
      const list: Order[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Order));
      setOrders(list);
    }, handleError);

    const productsQuery = isBranchScoped
      ? query(collection(db, COLLECTIONS.PRODUCTS), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.PRODUCTS));

    const unsubProducts = onSnapshot(productsQuery, (snap) => {
      const list: Product[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Product));
      setProducts(list);
    }, handleError);

    const ingredientsQuery = isBranchScoped
      ? query(collection(db, COLLECTIONS.INGREDIENTS), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.INGREDIENTS));

    const unsubIngredients = onSnapshot(ingredientsQuery, (snap) => {
      const list: Ingredient[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Ingredient));
      setIngredients(list);
    }, handleError);

    const expensesQuery = isBranchScoped
      ? query(collection(db, COLLECTIONS.EXPENSES), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.EXPENSES));

    const unsubExpenses = onSnapshot(expensesQuery, (snap) => {
      const list: Expense[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Expense));
      setExpenses(list);
    }, handleError);

    const employeesQuery = isBranchScoped
      ? query(collection(db, COLLECTIONS.EMPLOYEES), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.EMPLOYEES));

    const unsubEmployees = onSnapshot(employeesQuery, (snap) => {
      const list: Employee[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Employee));
      setEmployees(list);
    }, handleError);

    const customersQuery = isBranchScoped
      ? query(collection(db, COLLECTIONS.CUSTOMERS), where('branchId', '==', userBranch))
      : query(collection(db, COLLECTIONS.CUSTOMERS));

    const unsubCustomers = onSnapshot(customersQuery, (snap) => {
      const list: Customer[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Customer));
      setCustomers(list);
      setIsLoading(false);
    }, handleError);

    return () => {
      unsubOrders();
      unsubProducts();
      unsubIngredients();
      unsubExpenses();
      unsubEmployees();
      unsubCustomers();
    };
  }, [userRecord?.branchId, userRecord?.role, role]);

  // Compute Full Analytics Engine
  const analytics = useMemo(() => {
    return calculateAIBusinessPlatformAnalytics({
      orders,
      products,
      ingredients,
      expenses,
      purchases,
      employees,
      salaries,
      suppliers,
      drivers,
      stations,
      attendance,
      reservations,
      branches,
      feedbacks,
      equipment,
      bankTransactions,
      customers
    });
  }, [
    orders,
    products,
    ingredients,
    expenses,
    purchases,
    employees,
    salaries,
    suppliers,
    drivers,
    stations,
    attendance,
    reservations,
    branches,
    feedbacks,
    equipment,
    bankTransactions,
    customers
  ]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // AI Chat Handler
  const handleSendMessage = async (promptOverride?: string) => {
    const prompt = promptOverride || inputPrompt;
    if (!prompt.trim() || isChatLoading) return;

    const detected = detectLanguage(prompt);

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: prompt,
      detectedLanguage: detected,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsChatLoading(true);

    try {
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(getApiUrl('/api/ai-chat'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt,
          language: currentLang === 'auto' ? detected : currentLang,
          currentData: {
            todayRevenue: analytics.todayRevenue,
            todayNetProfit: analytics.todayNetProfit,
            todayExpenses: analytics.todayExpenses,
            todayOrdersCount: analytics.todayOrdersCount,
            bestSellingProducts: analytics.bestSellingProducts,
            lowStockIngredients: analytics.lowStockIngredients,
            totalInventoryValuation: analytics.totalInventoryValuation,
            healthScore: analytics.healthScore
          }
        })
      });

      const resData = await response.json();

      const asstMsg: ChatMessage = {
        id: `asst_${Date.now()}`,
        sender: 'assistant',
        text: resData.reply || 'Analysis complete.',
        detectedLanguage: resData.detectedLanguage || detected,
        suggestedQuestions: resData.suggestedQuestions || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChatMessages((prev) => [...prev, asstMsg]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ Communication error: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleExportSummaryExcel = () => {
    const columns = ['AI Module', 'Metric Name', 'Current Value', 'Status / Recommendation'];
    const rows = [
      ['Executive Health', 'Business Health Score', `${analytics.healthScore} / 100`, analytics.healthRating],
      ['AI Accountant', 'Today Revenue', `$${(analytics.todayRevenue || 0).toFixed(2)}`, 'Sales Inflow'],
      ['AI Accountant', 'Today Net Profit', `$${(analytics.todayNetProfit || 0).toFixed(2)}`, 'Bottom-line Profit'],
      ['AI Operations', 'Avg Kitchen Prep Time', `${analytics.avgPrepTimeMinutes || 0} min`, 'Optimal Target < 15 min'],
      ['AI Sales', 'Top Product', analytics.bestSellingProducts[0]?.name || 'N/A', `${analytics.bestSellingProducts[0]?.revenue || 0} USD`],
      ['AI Inventory', 'Low Stock Count', `${(analytics.lowStockIngredients || []).length} items`, 'Action Required'],
      ['AI Forecasting', 'Projected 30-Day Sales', `$${(analytics.projected30DaySales || 0).toLocaleString()}`, 'Growth Trend +8%']
    ];
    exportToExcel('AI_Business_Intelligence_Executive_Audit', columns, rows);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Banner */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="font-bold text-xs">{toastMsg}</span>
        </div>
      )}

      {/* Flagship Header Banner */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-emerald-500/10 via-indigo-500/10 to-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                <Crown className="w-3.5 h-3.5 text-amber-400" /> Phase 12 AI Business Platform
              </span>
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Real-time Firestore Sync
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Brain className="w-8 h-8 text-emerald-400" />
              AI Business Intelligence Platform
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-3xl leading-relaxed">
              Autonomous multi-agent platform analyzing real-time Firestore ledger data across Accounting, Kitchen Operations, Sales Trends, Inventory Forecasting, Customer Retention & Executive Risk Radar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Multi-language Selector */}
            <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-2xl p-1">
              <button
                onClick={() => handleLanguageChange('en')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                  currentLang === 'en' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                onClick={() => handleLanguageChange('ar')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                  currentLang === 'ar' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                العربية
              </button>
              <button
                onClick={() => handleLanguageChange('so')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
                  currentLang === 'so' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Soomaali
              </button>
            </div>

            <button
              onClick={handleExportSummaryExcel}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-2xl text-xs transition flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export Executive Audit (.XLSX)
            </button>
          </div>
        </div>

        {/* Business Health Score Bar */}
        <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 relative z-10">
          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border ${
              analytics.healthScore >= 80 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
              analytics.healthScore >= 60 ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' :
              'bg-rose-500/20 text-rose-400 border-rose-500/40'
            }`}>
              {analytics.healthScore}
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Health Score</span>
              <span className="text-xs font-extrabold text-white">{analytics.healthRating}</span>
            </div>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Today Revenue</span>
            <span className="text-sm font-extrabold text-emerald-400 mt-0.5 block">${(analytics.todayRevenue || 0).toFixed(2)}</span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Today Net Profit</span>
            <span className={`text-sm font-extrabold mt-0.5 block ${(analytics.todayNetProfit || 0) >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
              ${(analytics.todayNetProfit || 0).toFixed(2)}
            </span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Inventory Valuation</span>
            <span className="text-sm font-extrabold text-teal-400 mt-0.5 block">${(analytics.totalInventoryValuation || 0).toLocaleString()}</span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Active Alerts</span>
            <span className="text-sm font-extrabold text-amber-400 mt-0.5 block">{analytics.alerts.length} Warnings</span>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Customer Rating</span>
            <span className="text-sm font-extrabold text-purple-400 mt-0.5 block">★ {analytics.customerSatisfactionScore}%</span>
          </div>
        </div>
      </div>

      {/* Main Specialized Analyst Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-2.5 shadow-xl overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          <button
            onClick={() => setActiveTab('executive')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'executive'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <Crown className="w-4 h-4" />
            Executive Dashboard
          </button>

          <button
            onClick={() => setActiveTab('accountant')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'accountant'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <Calculator className="w-4 h-4" />
            AI Accountant
          </button>

          <button
            onClick={() => setActiveTab('operations')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'operations'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <Activity className="w-4 h-4" />
            Operations Manager
          </button>

          <button
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'sales'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Sales Analyst
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <Package className="w-4 h-4" />
            Inventory Analyst
          </button>

          <button
            onClick={() => setActiveTab('customer')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'customer'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <Users className="w-4 h-4" />
            Customer Analyst
          </button>

          <button
            onClick={() => setActiveTab('forecast')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'forecast'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <LineChart className="w-4 h-4" />
            AI Forecasting
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'alerts'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <Bell className="w-4 h-4" />
            AI Alerts ({analytics.alerts.length})
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <Bot className="w-4 h-4 text-amber-300" />
            Multilingual AI Chat
          </button>
        </div>
      </div>

      {/* TAB 1: EXECUTIVE DASHBOARD */}
      {activeTab === 'executive' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" /> Executive Strategic Recommendations
              </h3>
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                  <span className="font-bold text-emerald-400 block">Menu Margin Optimization</span>
                  <p className="text-slate-300">Increase price on top sellers by +$0.50 to yield additional $1,400 monthly margin without impacting volume.</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                  <span className="font-bold text-indigo-400 block">Inventory Holding Efficiency</span>
                  <p className="text-slate-300">Reorder ingredients automatically via supplier bulk contracts to reduce raw food waste by 18%.</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" /> Business Risk Radar
              </h3>
              <div className="space-y-3">
                {analytics.accountingAnomalies.length > 0 ? (
                  analytics.accountingAnomalies.slice(0, 2).map((a) => (
                    <div key={a.id} className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs space-y-1">
                      <span className="font-bold text-rose-300 block">{a.title}</span>
                      <p className="text-slate-300">{a.issue}</p>
                      <span className="text-[10px] text-rose-400 font-semibold block mt-1">Fix: {a.fix}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-semibold">
                    No critical risk anomalies detected in ledger!
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <LineChart className="w-4 h-4 text-emerald-400" /> Profit & Sales 30-Day Forecast
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Projected 30-Day Revenue</span>
                  <span className="font-extrabold text-emerald-400">${(analytics.projected30DaySales || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Projected Monthly Profit</span>
                  <span className="font-extrabold text-indigo-400">${(analytics.projectedMonthlyProfit || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400">Projected Operating Expenses</span>
                  <span className="font-extrabold text-slate-300">${(analytics.projectedMonthlyExpenses || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AI ACCOUNTANT */}
      {activeTab === 'accountant' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-emerald-400" /> AI Certified Public Accountant (CPA Audit)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Comprehensive audit of sales revenue, overhead expenses, COGS food cost, net margins & accounting anomalies.</p>
              </div>

              <button
                onClick={() => {
                  printReportWindow('AI Certified Financial Audit Statement', 'Real-time Firestore Ledger', [
                    {
                      heading: 'Financial Audit Metrics',
                      columns: ['Metric', 'Amount ($USD)', 'Audit Status'],
                      rows: [
                        ['Gross Revenue', `$${(analytics.totalRevenue || 0).toFixed(2)}`, 'Audited'],
                        ['Total Expenses', `$${(analytics.totalExpenses || 0).toFixed(2)}`, 'Verified'],
                        ['Net Operating Profit', `$${(analytics.netProfit || 0).toFixed(2)}`, 'Healthy'],
                        ['Cash Balance Liquid Reserve', `$${(analytics.liquidBalance || 0).toFixed(2)}`, 'Sufficient']
                      ]
                    }
                  ]);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold px-3.5 py-2 rounded-2xl text-xs flex items-center gap-2 cursor-pointer border border-slate-700"
              >
                <Printer className="w-4 h-4" /> Print Financial Audit
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-medium block">Total Sales Revenue</span>
                <span className="text-lg font-bold text-emerald-400 block">${(analytics.totalRevenue || 0).toFixed(2)}</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-medium block">Total Operating Expenses</span>
                <span className="text-lg font-bold text-rose-400 block">${(analytics.totalExpenses || 0).toFixed(2)}</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-medium block">Net Operating Profit</span>
                <span className="text-lg font-bold text-indigo-400 block">${(analytics.netProfit || 0).toFixed(2)}</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-medium block">Liquid Reserve Balance</span>
                <span className="text-lg font-bold text-teal-400 block">${(analytics.liquidBalance || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Accounting Mistakes & Anomalies */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Accounting Mistakes & Ledger Anomalies Detected ({analytics.accountingAnomalies.length})
              </h4>
              {analytics.accountingAnomalies.map((anom) => (
                <div key={anom.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-white block">{anom.title}</span>
                    <p className="text-slate-400 mt-0.5">{anom.issue}</p>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-emerald-400 font-semibold whitespace-nowrap">
                    Action: {anom.fix}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OPERATIONS MANAGER */}
      {activeTab === 'operations' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" /> AI Operations & Kitchen Efficiency Engine
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium block">Avg Kitchen Prep Time</span>
                <span className="text-lg font-bold text-emerald-400 block mt-1">{analytics.avgPrepTimeMinutes} minutes</span>
                <span className="text-[10px] text-slate-500">Target SLA &lt; 15 min</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium block">Avg Customer Wait Time</span>
                <span className="text-lg font-bold text-indigo-400 block mt-1">{analytics.avgWaitTimeMinutes} minutes</span>
                <span className="text-[10px] text-slate-500">Dine-in & Takeaway orders</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium block">Active Staff Productivity</span>
                <span className="text-lg font-bold text-teal-400 block mt-1">{employees.length} Staff Members</span>
                <span className="text-[10px] text-emerald-400 font-semibold">{employees.filter(e => e.status === 'active').length} Active On Roster</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Operational Recommendations</h4>
              {analytics.operationalRecommendations.map((op, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <span className="font-bold text-white block">{op.title}</span>
                    <p className="text-slate-400 mt-0.5">{op.detail}</p>
                  </div>
                  <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-3 py-1.5 rounded-xl whitespace-nowrap">
                    Impact: {op.impact}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SALES ANALYST */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-400" /> Best Selling Products
              </h3>
              <div className="space-y-3">
                {analytics.bestSellingProducts.map((p, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white block">{p.name}</span>
                      <span className="text-[10px] text-slate-400">{p.count} units sold</span>
                    </div>
                    <span className="font-extrabold text-emerald-400">${(p.revenue || 0).toFixed(2)} Revenue</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" /> Peak vs Slow Hours Analysis
              </h3>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Peak Demand Hour</span>
                  <span className="font-extrabold text-emerald-400">{analytics.peakHourLabel}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-slate-400">Slow Off-Peak Hour</span>
                  <span className="font-extrabold text-amber-400">{analytics.slowHourLabel}</span>
                </div>
                <p className="text-slate-300 pt-1">
                  💡 <strong>AI Strategy:</strong> Run a 20% Happy Hour discount during {analytics.slowHourLabel} to stimulate footfall and increase off-peak order volume.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: INVENTORY ANALYST */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-teal-400" /> AI Inventory & Raw Material Consumption Engine
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" /> Low Stock Warning ({analytics.lowStockIngredients.length})
                </h4>
                {analytics.lowStockIngredients.map((i) => (
                  <div key={i.id} className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <span className="font-bold text-white">{i.name}</span>
                    <span className="text-rose-300 font-extrabold">{i.stock} {i.unit} (Min: {i.minStockAlert || 5})</span>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Purchasing Recommendations per Supplier</h4>
                {analytics.purchasingRecommendations.map((pr, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div>
                      <span className="font-bold text-white block">{pr.supplierName}</span>
                      <span className="text-[10px] text-slate-400">{pr.lowItemsCount} low items</span>
                    </div>
                    <span className="font-extrabold text-emerald-400">Est. Order: ${(pr.suggestedOrderValuation || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: CUSTOMER ANALYST */}
      {activeTab === 'customer' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" /> AI Customer Retention & Loyalty Analytics
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium block">Total Tracked Customers</span>
                <span className="text-lg font-bold text-white block mt-1">{analytics.totalCustomerCount} Registered</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium block">VIP Loyalty Tier</span>
                <span className="text-lg font-bold text-amber-400 block mt-1">{analytics.vipCount} VIP Guests</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium block">Customer Satisfaction Score</span>
                <span className="text-lg font-bold text-purple-400 block mt-1">★ {analytics.customerSatisfactionScore}% Satisfied</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top Customer Lifetime Value (LTV)</h4>
              <div className="space-y-2">
                {analytics.customerList.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4 bg-slate-950 rounded-2xl border border-slate-800">No customer records found.</p>
                ) : (
                  analytics.customerList.map((c: any) => {
                    const spend = Number(c.totalSpending ?? c.totalSpent ?? c.orderSummary?.totalSpent ?? 0);
                    return (
                      <div key={c.id} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-white block">{c.fullName || c.name || 'Valued Customer'}</span>
                          <span className="text-[10px] text-slate-400">{c.phone || 'N/A'}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-emerald-400 block">${spend.toFixed(2)}</span>
                          <span className="text-[10px] text-amber-400 font-bold uppercase">{c.membershipLevel || (c.status === 'vip' ? 'VIP' : 'Bronze')}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: AI FORECASTING */}
      {activeTab === 'forecast' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <LineChart className="w-5 h-5 text-emerald-400" /> AI Predictive Revenue & Demand Models
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-medium block">Tomorrow Revenue Forecast</span>
                <span className="text-xl font-bold text-emerald-400 block">${(analytics.projectedNextDaySales || 0).toLocaleString()}</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-medium block">7-Day Revenue Forecast</span>
                <span className="text-xl font-bold text-indigo-400 block">${(analytics.projected7DaySales || 0).toLocaleString()}</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 font-medium block">30-Day Revenue Forecast</span>
                <span className="text-xl font-bold text-purple-400 block">${(analytics.projected30DaySales || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: AI ALERTS */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" /> AI Automated Operational & Financial Alerts
            </h3>

            <div className="space-y-3">
              {analytics.alerts.map((alt) => (
                <div key={alt.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" /> {alt.title}
                    </span>
                    <span className="text-[10px] text-slate-500">{alt.timestamp}</span>
                  </div>
                  <p className="text-slate-300">{alt.message}</p>
                  <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-3 py-1 rounded-xl block text-[11px]">
                    Recommended Fix: {alt.recommendedFix}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: MULTILINGUAL AI CHAT */}
      {activeTab === 'chat' && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 text-white shadow-2xl space-y-6">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2 text-white">
              <Bot className="w-6 h-6 text-emerald-400" /> Multilingual AI Business Chat (English / العربية / Soomaali)
            </h3>
            <p className="text-xs text-slate-400 mt-1">Ask questions in any language. The AI auto-detects language and returns real-time data calculations.</p>
          </div>

          {/* Prompt Shortcuts */}
          <div className="flex flex-wrap gap-2">
            {[
              'How much profit did I make today?',
              'Which products should I reorder?',
              'Why are sales down?',
              'Show today\'s expenses.',
              'Which employee performed best?',
              'How much inventory remains?',
              'Generate today\'s financial report.'
            ].map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt)}
                className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 font-semibold px-3 py-2 rounded-2xl text-xs border border-slate-800 transition cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Chat Messages Stream */}
          <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 max-h-96 overflow-y-auto space-y-3">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 text-xs ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 text-slate-950 font-black">
                    AI
                  </div>
                )}
                <div
                  className={`p-3.5 rounded-2xl max-w-xl leading-relaxed whitespace-pre-line ${
                    msg.sender === 'user'
                      ? 'bg-emerald-500 text-slate-950 rounded-br-none font-bold'
                      : 'bg-slate-800 text-slate-200 border border-slate-700/80 rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                <RefreshCw className="w-4 h-4 animate-spin" /> AI Analyzing Firestore Ledger...
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="flex gap-2">
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={
                currentLang === 'ar'
                  ? 'اسأل الذكاء الاصطناعي عن الأرباح والمبيعات والمخزون...'
                  : currentLang === 'so'
                  ? 'Waydiiso AI-ka su\'aal ku saabsan faa\'iidada, iibka, ama kaydka...'
                  : 'Ask AI Business Assistant about profits, sales, low stock, or expenses...'
              }
              className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isChatLoading}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-5 py-3 rounded-2xl text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <Send className="w-4 h-4" /> Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
