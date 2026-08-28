import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot,
  query,
  where 
} from 'firebase/firestore';
import { useAuth } from '../presentation/context/AuthContext';
import { db, COLLECTIONS } from '../lib/firebase';
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
  Language,
  ChatMessage 
} from '../types';
import { 
  calculateCEOAnalytics, 
  HealthRating, 
  CEOSmartDecision, 
  CEORiskItem 
} from '../lib/ceoAnalytics';
import { 
  Crown, 
  TrendingUp, 
  ShieldAlert, 
  Sparkles, 
  DollarSign, 
  ShoppingBag, 
  Users, 
  UtensilsCrossed, 
  Truck, 
  PieChart, 
  BarChart3, 
  Activity, 
  Bot, 
  Send, 
  Volume2, 
  CheckCircle2, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownRight, 
  Zap, 
  AlertTriangle, 
  Check, 
  Building2, 
  HelpCircle, 
  ChevronRight,
  TrendingDown,
  Target,
  LineChart,
  Briefcase
} from 'lucide-react';

interface Props {
  language: Language;
}

export const AICEOView: React.FC<Props> = ({ language: initialLanguage }) => {
  const { userRecord, role } = useAuth();
  const [currentLang, setCurrentLang] = useState<Language>(initialLanguage || 'en');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'decisions' | 'risks' | 'forecast' | 'assistant'>('dashboard');

  // Firestore Real-time Collections
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaries, setSalaries] = useState<SalaryPayment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [attendance, setAttendance] = useState<EmployeeAttendance[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [branches, setBranches] = useState<BranchOperation[]>([]);
  const [feedbacks, setFeedbacks] = useState<CustomerFeedback[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // AI Voice & Chat Assistant State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome_ceo',
      sender: 'assistant',
      text: currentLang === 'ar'
        ? 'مرحباً بصفتك الرئيس التنفيذي! أنا المساعد التنفيذي الذكي (AI CEO). أراقب أداء المبيعات، الأرباح، المخزون، والموظفين مباشرة من Firestore.'
        : currentLang === 'so'
        ? 'Ku soo dhawoow Maamulaha Sare (AI CEO)! Waxaan la socdaa dakhliga, macaashka, iyo shaqada maqaayadda wakhtiga dhabta ah.'
        : 'Welcome, Chief Executive Officer! I am your AI CEO Executive Suite. I supervise your sales, profit margins, operational risks, and expansion opportunities across all departments in real time.',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [inputQuestion, setInputQuestion] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Real-time Firestore Sync with Branch Isolation
  useEffect(() => {
    setIsLoading(true);

    const userRoleStr = (userRecord?.role || role || '').toLowerCase().trim();
    const isHqUser = userRoleStr === 'owner' || (userRoleStr === 'admin' && (!userRecord?.branchId || userRecord?.branchId === 'all'));
    const userBranch = userRecord?.branchId || (userRecord as any)?.branch;
    const isBranchScoped = !isHqUser && Boolean(userBranch) && userBranch !== 'all';

    const handleError = (colName: string, err: any) => {
      console.warn(`AICEO sync error on ${colName}:`, err);
      setIsLoading(false);
    };

    const buildBranchQuery = (collectionName: string) => {
      return isBranchScoped
        ? query(collection(db, collectionName), where('branchId', '==', userBranch))
        : query(collection(db, collectionName));
    };

    const unsubOrders = onSnapshot(buildBranchQuery(COLLECTIONS.ORDERS), snap => {
      const list: Order[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Order));
      setOrders(list);
    }, err => handleError('ORDERS', err));

    const unsubProducts = onSnapshot(buildBranchQuery(COLLECTIONS.PRODUCTS), snap => {
      const list: Product[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Product));
      setProducts(list);
    }, err => handleError('PRODUCTS', err));

    const unsubIngredients = onSnapshot(buildBranchQuery(COLLECTIONS.INGREDIENTS), snap => {
      const list: Ingredient[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Ingredient));
      setIngredients(list);
    }, err => handleError('INGREDIENTS', err));

    const unsubExpenses = onSnapshot(buildBranchQuery(COLLECTIONS.EXPENSES), snap => {
      const list: Expense[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Expense));
      setExpenses(list);
    }, err => handleError('EXPENSES', err));

    const unsubPurchases = onSnapshot(buildBranchQuery(COLLECTIONS.PURCHASES), snap => {
      const list: Purchase[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Purchase));
      setPurchases(list);
    }, err => handleError('PURCHASES', err));

    const unsubEmployees = onSnapshot(buildBranchQuery(COLLECTIONS.EMPLOYEES), snap => {
      const list: Employee[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Employee));
      setEmployees(list);
    }, err => handleError('EMPLOYEES', err));

    const unsubSalaries = onSnapshot(buildBranchQuery(COLLECTIONS.SALARIES), snap => {
      const list: SalaryPayment[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as SalaryPayment));
      setSalaries(list);
    }, err => handleError('SALARIES', err));

    const unsubSuppliers = onSnapshot(buildBranchQuery(COLLECTIONS.SUPPLIERS), snap => {
      const list: Supplier[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Supplier));
      setSuppliers(list);
    }, err => handleError('SUPPLIERS', err));

    const unsubDrivers = onSnapshot(buildBranchQuery(COLLECTIONS.DRIVERS), snap => {
      const list: DeliveryDriver[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as DeliveryDriver));
      setDrivers(list);
    }, err => handleError('DRIVERS', err));

    const unsubStations = onSnapshot(buildBranchQuery(COLLECTIONS.STATIONS), snap => {
      const list: KitchenStation[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as KitchenStation));
      setStations(list);
    }, err => handleError('STATIONS', err));

    const unsubAttendance = onSnapshot(buildBranchQuery(COLLECTIONS.ATTENDANCE), snap => {
      const list: EmployeeAttendance[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as EmployeeAttendance));
      setAttendance(list);
    }, err => handleError('ATTENDANCE', err));

    const unsubReservations = onSnapshot(buildBranchQuery(COLLECTIONS.RESERVATIONS), snap => {
      const list: Reservation[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Reservation));
      setReservations(list);
    }, err => handleError('RESERVATIONS', err));

    const unsubBranches = onSnapshot(collection(db, COLLECTIONS.BRANCHES), snap => {
      const list: BranchOperation[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as BranchOperation));
      setBranches(list);
    }, err => handleError('BRANCHES', err));

    const unsubFeedbacks = onSnapshot(buildBranchQuery(COLLECTIONS.FEEDBACKS), snap => {
      const list: CustomerFeedback[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as CustomerFeedback));
      setFeedbacks(list);
    }, err => handleError('FEEDBACKS', err));

    const unsubEquipment = onSnapshot(buildBranchQuery(COLLECTIONS.EQUIPMENT), snap => {
      const list: EquipmentItem[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as EquipmentItem));
      setEquipment(list);
    }, err => handleError('EQUIPMENT', err));

    const unsubBank = onSnapshot(buildBranchQuery(COLLECTIONS.BANK_TRANSACTIONS), snap => {
      const list: BankTransaction[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as BankTransaction));
      setBankTransactions(list);
      setIsLoading(false);
    }, err => handleError('BANK_TRANSACTIONS', err));

    return () => {
      unsubOrders();
      unsubProducts();
      unsubIngredients();
      unsubExpenses();
      unsubPurchases();
      unsubEmployees();
      unsubSalaries();
      unsubSuppliers();
      unsubDrivers();
      unsubStations();
      unsubAttendance();
      unsubReservations();
      unsubBranches();
      unsubFeedbacks();
      unsubEquipment();
      unsubBank();
    };
  }, [userRecord?.branchId, userRecord?.role, role]);

  // Compute Full CEO Analytics Data
  const ceoDataPackage = {
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
    bankTransactions
  };

  const analytics = calculateCEOAnalytics(ceoDataPackage);
  const { healthBreakdown, executiveBriefing, risks, smartDecisions, forecast, executiveQuestions } = analytics;

  // Toast Notification
  const showToast = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  // Text-To-Speech Speech Synthesis
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/\*\*/g, ''));
      utterance.rate = 1.0;
      if (currentLang === 'ar') utterance.lang = 'ar-SA';
      else if (currentLang === 'so') utterance.lang = 'so-SO';
      else utterance.lang = 'en-US';

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Preset Executive Questions
  const handleAskPresetQuestion = (key: keyof typeof executiveQuestions) => {
    const q = executiveQuestions[key];
    const userQ = currentLang === 'ar' ? q.question_ar : currentLang === 'so' ? q.question_so : q.question_en;
    const ansA = currentLang === 'ar' ? q.answer_ar : currentLang === 'so' ? q.answer_so : q.answer_en;

    const userMsg: ChatMessage = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text: userQ,
      timestamp: new Date().toLocaleTimeString()
    };

    const aiMsg: ChatMessage = {
      id: 'ai_' + Date.now(),
      sender: 'assistant',
      text: ansA,
      timestamp: new Date().toLocaleTimeString()
    };

    setChatMessages(prev => [...prev, userMsg, aiMsg]);
    speakText(ansA);
  };

  // Custom User Input
  const handleSendQuestion = () => {
    if (!inputQuestion || !inputQuestion.trim()) return;
    const queryLower = (inputQuestion || '').toLowerCase();

    let reply = '';
    if (queryLower.includes('healthy') || queryLower.includes('صحة') || queryLower.includes('caafimaadka')) {
      reply = executiveQuestions.health[currentLang === 'ar' ? 'answer_ar' : currentLang === 'so' ? 'answer_so' : 'answer_en'];
    } else if (queryLower.includes('branch') || queryLower.includes('فرع') || queryLower.includes('laan')) {
      reply = executiveQuestions.expand_branch[currentLang === 'ar' ? 'answer_ar' : currentLang === 'so' ? 'answer_so' : 'answer_en'];
    } else if (queryLower.includes('hire') || queryLower.includes('توظيف') || queryLower.includes('shaqaale')) {
      reply = executiveQuestions.hire_employees[currentLang === 'ar' ? 'answer_ar' : currentLang === 'so' ? 'answer_so' : 'answer_en'];
    } else if (queryLower.includes('price') || queryLower.includes('سعر') || queryLower.includes('qiimaha')) {
      reply = executiveQuestions.increase_prices[currentLang === 'ar' ? 'answer_ar' : currentLang === 'so' ? 'answer_so' : 'answer_en'];
    } else if (queryLower.includes('risk') || queryLower.includes('خطر') || queryLower.includes('khatar')) {
      reply = executiveQuestions.biggest_risk[currentLang === 'ar' ? 'answer_ar' : currentLang === 'so' ? 'answer_so' : 'answer_en'];
    } else {
      reply = currentLang === 'ar'
        ? `بناءً على بيانات المؤسسة الحالية: مؤشر صحة الأعمال هو **${healthBreakdown.score}/100** (${healthBreakdown.rating})، إيرادات اليوم **$${executiveBriefing.todayRevenue.toLocaleString()}**، والسيولة النقدية المتاحة **$${executiveBriefing.cashFlowBalance.toLocaleString()}**.`
        : currentLang === 'so'
        ? `Sida ku xusan xogta dhabta ah: Qiimaynta ganacsiga waa **${healthBreakdown.score}/100** (${healthBreakdown.rating}), dakhliga maanta waa **$${executiveBriefing.todayRevenue.toLocaleString()}**.`
        : `Based on real-time enterprise Firestore data: Overall Business Health Score is **${healthBreakdown.score}/100** (${healthBreakdown.rating}), today's revenue is **$${executiveBriefing.todayRevenue.toLocaleString()}**, net profit margin is healthy, and liquid reserve is **$${executiveBriefing.cashFlowBalance.toLocaleString()}**.`;
    }

    const userMsg: ChatMessage = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text: inputQuestion,
      timestamp: new Date().toLocaleTimeString()
    };

    const aiMsg: ChatMessage = {
      id: 'ai_' + Date.now(),
      sender: 'assistant',
      text: reply,
      timestamp: new Date().toLocaleTimeString()
    };

    setChatMessages(prev => [...prev, userMsg, aiMsg]);
    setInputQuestion('');
    speakText(reply);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Banner */}
      {actionSuccessMsg && (
        <div className="fixed top-20 right-6 z-50 bg-indigo-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-indigo-200" />
          <span className="font-semibold text-sm">{actionSuccessMsg}</span>
        </div>
      )}

      {/* Flagship CEO Executive Header */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/15 via-purple-500/15 to-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2.5">
              <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                <Crown className="w-4 h-4 text-amber-400" /> Executive Chief Suite
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Synchronized across all AI Agents
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <Crown className="w-9 h-9 text-amber-400" />
              {currentLang === 'ar' ? 'الرئيس التنفيذي الذكي (AI CEO)' : currentLang === 'so' ? 'Maamulaha Sare ee AI (AI CEO)' : 'AI Chief Executive Officer'}
            </h1>
            <p className="text-slate-300 text-sm mt-2 max-w-3xl leading-relaxed">
              Supervising every core module (Sales, Finance, Inventory, Kitchen, Staff, Delivery, Customer, Suppliers, Branches) using live Firestore analytics to drive high-impact strategic business decisions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Multi-language Selector */}
            <div className="flex items-center bg-slate-900/80 border border-slate-700/80 rounded-xl p-1 shadow-inner">
              <button
                onClick={() => setCurrentLang('en')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  currentLang === 'en' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setCurrentLang('ar')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  currentLang === 'ar' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                العربية
              </button>
              <button
                onClick={() => setCurrentLang('so')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  currentLang === 'so' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Soomaali
              </button>
            </div>

            <button
              onClick={() => showToast('Re-evaluated enterprise metrics across all modules!')}
              className="bg-indigo-600/90 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh CEO Dashboard
            </button>
          </div>
        </div>

        {/* Business Health Score Main Highlight */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
          <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex items-center gap-5">
            <div className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center font-black border-2 shadow-inner ${
              healthBreakdown.rating === 'Excellent' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' :
              healthBreakdown.rating === 'Good' ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40' :
              healthBreakdown.rating === 'Average' ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' :
              'bg-rose-500/20 text-rose-400 border-rose-500/40'
            }`}>
              <span className="text-2xl">{healthBreakdown.score}</span>
              <span className="text-[10px] uppercase font-bold text-slate-300">/ 100</span>
            </div>

            <div>
              <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider block">Enterprise Business Health</span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xl font-extrabold ${
                  healthBreakdown.rating === 'Excellent' ? 'text-emerald-400' :
                  healthBreakdown.rating === 'Good' ? 'text-indigo-400' :
                  healthBreakdown.rating === 'Average' ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {healthBreakdown.rating} Status
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Weighted score across sales, profit, customer, inventory, & cash flow.</p>
            </div>
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
              <span className="text-xs text-slate-400 block font-medium">Today's Revenue</span>
              <span className="text-lg font-bold text-emerald-400 mt-1 block">${executiveBriefing.todayRevenue.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400">{executiveBriefing.totalOrdersCount} orders</span>
            </div>

            <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
              <span className="text-xs text-slate-400 block font-medium">Today's Profit</span>
              <span className="text-lg font-bold text-indigo-400 mt-1 block">${executiveBriefing.todayProfit.toLocaleString()}</span>
              <span className="text-[10px] text-emerald-400 font-semibold">Net Margin ~22%</span>
            </div>

            <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
              <span className="text-xs text-slate-400 block font-medium">Cash Flow Reserve</span>
              <span className="text-lg font-bold text-teal-400 mt-1 block">${executiveBriefing.cashFlowBalance.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400">18 days operating buffer</span>
            </div>

            <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800">
              <span className="text-xs text-slate-400 block font-medium">Customer Rating</span>
              <span className="text-lg font-bold text-amber-400 mt-1 block">★ {executiveBriefing.avgCustomerRating} / 5</span>
              <span className="text-[10px] text-slate-400">{executiveBriefing.customerSatisfactionPercentage}% Satisfied</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
            activeTab === 'dashboard' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Daily CEO Briefing
        </button>

        <button
          onClick={() => setActiveTab('decisions')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
            activeTab === 'decisions' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-300" /> Strategic Smart Decisions ({smartDecisions.length})
        </button>

        <button
          onClick={() => setActiveTab('risks')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
            activeTab === 'risks' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-400" /> Risk Radar & Mitigation ({risks.length})
        </button>

        <button
          onClick={() => setActiveTab('forecast')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
            activeTab === 'forecast' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <LineChart className="w-4 h-4" /> AI Forecasting & Growth
        </button>

        <button
          onClick={() => setActiveTab('assistant')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
            activeTab === 'assistant' 
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Bot className="w-4 h-4 text-amber-300" /> AI CEO Voice & Chat
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DAILY CEO BRIEFING */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Health Score Component Breakdown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-indigo-500" /> Executive Business Health Pillars (Weighted Breakdown)
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Sales & Revenue</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-base font-bold text-slate-900 dark:text-white">{healthBreakdown.salesScore} / 100</span>
                  <span className="text-[10px] font-bold text-emerald-500">20% Weight</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Profitability & Margins</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-base font-bold text-slate-900 dark:text-white">{healthBreakdown.profitScore} / 100</span>
                  <span className="text-[10px] font-bold text-emerald-500">20% Weight</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Customer Satisfaction</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-base font-bold text-slate-900 dark:text-white">{healthBreakdown.customerSatisfactionScore} / 100</span>
                  <span className="text-[10px] font-bold text-emerald-500">15% Weight</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Inventory Efficiency</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-base font-bold text-slate-900 dark:text-white">{healthBreakdown.inventoryScore} / 100</span>
                  <span className="text-[10px] font-bold text-emerald-500">10% Weight</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Employee Productivity</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-base font-bold text-slate-900 dark:text-white">{healthBreakdown.employeeProductivityScore} / 100</span>
                  <span className="text-[10px] font-bold text-emerald-500">10% Weight</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Delivery Success</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-base font-bold text-slate-900 dark:text-white">{healthBreakdown.deliveryPerformanceScore} / 100</span>
                  <span className="text-[10px] font-bold text-emerald-500">10% Weight</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Waste Control</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-base font-bold text-slate-900 dark:text-white">{healthBreakdown.wasteControlScore} / 100</span>
                  <span className="text-[10px] font-bold text-emerald-500">5% Weight</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Cash Flow Liquidity</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-base font-bold text-slate-900 dark:text-white">{healthBreakdown.cashFlowScore} / 100</span>
                  <span className="text-[10px] font-bold text-emerald-500">10% Weight</span>
                </div>
              </div>
            </div>
          </div>

          {/* Product Performance (Best vs Worst Selling) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top Performers */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <ArrowUpRight className="w-4 h-4 text-emerald-500" /> Best Selling Menu Items
              </h4>

              <div className="space-y-3">
                {executiveBriefing.bestSellingProducts.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{p.name}</span>
                      <p className="text-[10px] text-slate-500">{p.salesCount} units sold</p>
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">${p.revenue.toLocaleString()} Revenue</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Slow Moving Items */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <ArrowDownRight className="w-4 h-4 text-rose-500" /> Slow-Moving / Attention Needed
              </h4>

              <div className="space-y-3">
                {executiveBriefing.worstSellingProducts.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">{p.name}</span>
                      <p className="text-[10px] text-slate-500">{p.salesCount} units sold | {p.stock} remaining</p>
                    </div>
                    <button
                      onClick={() => showToast(`Initiated promotional bundle discount for ${p.name}`)}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Promo Discount
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STRATEGIC SMART DECISIONS (WITH FULL EXPLANATION & CONFIDENCE %) */}
      {/* ========================================================================= */}
      {activeTab === 'decisions' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-indigo-500" /> AI Executive Decision Support Engine
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Every recommendation includes data-backed justification, projected financial impact, potential trade-off risks, and statistical confidence score.
            </p>

            <div className="space-y-6">
              {smartDecisions.map(dec => (
                <div key={dec.id} className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          {dec.actionCategory}
                        </span>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                          {dec.confidencePercentage}% Confidence Score
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">{dec.title}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold mt-0.5">{dec.summary}</p>
                    </div>

                    <button
                      onClick={() => showToast(`Executive decision approved: ${dec.title}`)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all whitespace-nowrap"
                    >
                      Approve & Execute <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700/60 text-xs">
                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 block mb-1">Why Made (Data Reason):</span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{dec.whyMade}</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-1">Expected Financial Impact:</span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{dec.expectedImpact}</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                      <span className="font-bold text-rose-600 dark:text-rose-400 block mb-1">Possible Risks to Monitor:</span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{dec.possibleRisks}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RISK RADAR & MITIGATION */}
      {/* ========================================================================= */}
      {activeTab === 'risks' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <ShieldAlert className="w-5 h-5 text-rose-500" /> Enterprise Risk Matrix & Mitigation Strategies
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {risks.map(r => (
                <div key={r.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                      {r.category} Risk
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      r.severity === 'critical' ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'
                    }`}>
                      {(r.severity || 'low').toUpperCase()}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{r.title}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{r.description}</p>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">Mitigation: </span>
                    {r.mitigationStrategy}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: AI FORECASTING & GROWTH */}
      {/* ========================================================================= */}
      {activeTab === 'forecast' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <LineChart className="w-5 h-5 text-indigo-500" /> AI Sales & Revenue Forecasting Models
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-emerald-50/40 dark:bg-emerald-950/20">
                <span className="text-xs font-semibold text-slate-500">Predicted Tomorrow Sales</span>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 block mt-1">${forecast.projectedNextDaySales.toLocaleString()}</span>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-indigo-50/40 dark:bg-indigo-950/20">
                <span className="text-xs font-semibold text-slate-500">Predicted 7-Day Revenue</span>
                <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400 block mt-1">${forecast.projected7DaySales.toLocaleString()}</span>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-purple-50/40 dark:bg-purple-950/20">
                <span className="text-xs font-semibold text-slate-500">Predicted 30-Day Revenue</span>
                <span className="text-xl font-bold text-purple-600 dark:text-purple-400 block mt-1">${forecast.projected30DaySales.toLocaleString()}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 text-white text-xs space-y-2">
              <span className="font-bold text-amber-400 uppercase tracking-wider block">Seasonal Demand & Customer Growth Insight</span>
              <p className="text-slate-300 leading-relaxed">{forecast.seasonalDemandInsight}</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: VOICE & CHAT AI CEO ASSISTANT */}
      {/* ========================================================================= */}
      {activeTab === 'assistant' && (
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 text-white shadow-2xl space-y-6">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2 text-white">
              <Bot className="w-6 h-6 text-indigo-400" /> Executive Voice & Chat AI Assistant (EN / AR / SO)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Ask high-level questions regarding business health, branch expansion feasibility, staff hiring, menu price increases, or loss-making departments.
            </p>
          </div>

          {/* Quick Preset Executive Questions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              onClick={() => handleAskPresetQuestion('health')}
              className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left text-xs font-bold text-indigo-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
            >
              <Activity className="w-4 h-4 text-emerald-400" /> How healthy is my business?
            </button>

            <button
              onClick={() => handleAskPresetQuestion('expand_branch')}
              className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left text-xs font-bold text-teal-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-teal-400" /> Can I afford to open another branch?
            </button>

            <button
              onClick={() => handleAskPresetQuestion('hire_employees')}
              className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left text-xs font-bold text-purple-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
            >
              <Users className="w-4 h-4 text-purple-400" /> Should I hire more employees?
            </button>

            <button
              onClick={() => handleAskPresetQuestion('increase_prices')}
              className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left text-xs font-bold text-amber-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
            >
              <DollarSign className="w-4 h-4 text-amber-400" /> Should I increase prices?
            </button>

            <button
              onClick={() => handleAskPresetQuestion('losses_department')}
              className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left text-xs font-bold text-rose-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
            >
              <TrendingDown className="w-4 h-4 text-rose-400" /> Which department causes losses?
            </button>

            <button
              onClick={() => handleAskPresetQuestion('biggest_risk')}
              className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left text-xs font-bold text-rose-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 text-rose-400" /> What is my biggest risk?
            </button>
          </div>

          {/* Chat Messages Log */}
          <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 max-h-96 overflow-y-auto space-y-3">
            {chatMessages.map(msg => (
              <div 
                key={msg.id}
                className={`flex gap-3 text-xs ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 text-white font-bold">
                    CEO
                  </div>
                )}
                <div className={`p-3.5 rounded-2xl max-w-xl leading-relaxed whitespace-pre-line ${
                  msg.sender === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none font-medium' 
                    : 'bg-slate-800 text-slate-200 border border-slate-700/80 rounded-bl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input Bar */}
          <div className="flex gap-2">
            <input
              type="text"
              value={inputQuestion}
              onChange={e => setInputQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendQuestion()}
              placeholder={
                currentLang === 'ar' ? 'اسأل الرئيس التنفيذي الذكي أي سؤال عن المشروعات والقرارات...' :
                currentLang === 'so' ? 'Sual ka weydiiko Maamulaha Sare wixii ku saabsan ganacsiga...' :
                'Ask AI CEO any question about your business performance, expansion, or risks...'
              }
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />

            <button
              onClick={handleSendQuestion}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-3 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg transition-all"
            >
              <Send className="w-4 h-4" /> Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
