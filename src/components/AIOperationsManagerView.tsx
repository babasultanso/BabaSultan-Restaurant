import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import { useAuth } from '../presentation/context/AuthContext';
import { 
  db, 
  COLLECTIONS, 
  updateOrderStatusFirestore, 
  updateStationStatusFirestore, 
  assignDriverToOrderFirestore, 
  resolveCustomerFeedbackFirestore,
  addOrderFirestore 
} from '../lib/firebase';
import { 
  Order, 
  Product, 
  Ingredient, 
  Expense, 
  Employee, 
  Supplier, 
  DeliveryDriver, 
  KitchenStation, 
  EmployeeAttendance, 
  Reservation, 
  BranchOperation, 
  CustomerFeedback, 
  EquipmentItem, 
  Language,
  ChatMessage 
} from '../types';
import { 
  calculateOperationsAnalytics, 
  OperationsKPIs, 
  DelayedOrderAlert, 
  OperationalSmartAlert, 
  OperationalRecommendation 
} from '../lib/operationsAnalytics';
import { 
  Activity, 
  AlertTriangle, 
  Clock, 
  Users, 
  Truck, 
  UtensilsCrossed, 
  PackageCheck, 
  Smile, 
  Bot, 
  Send, 
  Volume2, 
  CheckCircle2, 
  RefreshCw, 
  ArrowRight, 
  Zap, 
  ChevronRight, 
  Sparkles, 
  Flame, 
  ShieldAlert, 
  Check, 
  UserCheck, 
  Phone, 
  Wrench, 
  Building2, 
  MessageSquareText, 
  HelpCircle,
  Timer
} from 'lucide-react';

interface Props {
  language: Language;
}

export const AIOperationsManagerView: React.FC<Props> = ({ language: initialLanguage }) => {
  const { userRecord, role } = useAuth();
  const [currentLang, setCurrentLang] = useState<Language>(initialLanguage || 'en');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'kitchen' | 'staff' | 'delivery' | 'customer' | 'assistant'>('dashboard');

  // Firestore Real-time Collections
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [attendance, setAttendance] = useState<EmployeeAttendance[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [branches, setBranches] = useState<BranchOperation[]>([]);
  const [feedbacks, setFeedbacks] = useState<CustomerFeedback[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // AI Chat Assistant State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'assistant',
      text: currentLang === 'ar' 
        ? 'مرحباً! أنا مدير العمليات الذكي بالمطبخ والنظام. يسعدني مساعدتك في متابعة طلبات المطبخ، التوصيل، الموظفين، وإدارة المخزون مباشرة.'
        : currentLang === 'so'
        ? 'Ku soo dhawoow! Anigu waxaan ahay Maamulaha AI ee Shaqada Maqaayadda. Waxaan kaa caawinayaa la socodka jikada, gaarsiinta, iyo shaqaalaha.'
        : 'Welcome! I am your AI Restaurant Operations Manager. I monitor your kitchen workload, order delivery pipeline, employee shifts, and inventory in real time.',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [inputQuestion, setInputQuestion] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Firestore Real-time Listeners with Branch Isolation
  useEffect(() => {
    setIsLoading(true);

    const userRoleStr = (userRecord?.role || role || '').toLowerCase().trim();
    const isHqUser = userRoleStr === 'owner' || (userRoleStr === 'admin' && (!userRecord?.branchId || userRecord?.branchId === 'all'));
    const userBranch = userRecord?.branchId || (userRecord as any)?.branch;
    const isBranchScoped = !isHqUser && Boolean(userBranch) && userBranch !== 'all';

    const handleErr = (col: string, err: any) => {
      console.warn(`Operations manager listener error on ${col}:`, err);
      setIsLoading(false);
    };

    const buildBranchQuery = (collectionName: string) => {
      return isBranchScoped
        ? query(collection(db, collectionName), where('branchId', '==', userBranch))
        : query(collection(db, collectionName));
    };

    const unsubOrders = onSnapshot(buildBranchQuery(COLLECTIONS.ORDERS), (snap) => {
      const list: Order[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Order));
      setOrders(list);
    }, err => handleErr('ORDERS', err));

    const unsubProducts = onSnapshot(buildBranchQuery(COLLECTIONS.PRODUCTS), (snap) => {
      const list: Product[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Product));
      setProducts(list);
    }, err => handleErr('PRODUCTS', err));

    const unsubIngredients = onSnapshot(buildBranchQuery(COLLECTIONS.INGREDIENTS), (snap) => {
      const list: Ingredient[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Ingredient));
      setIngredients(list);
    }, err => handleErr('INGREDIENTS', err));

    const unsubExpenses = onSnapshot(buildBranchQuery(COLLECTIONS.EXPENSES), (snap) => {
      const list: Expense[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Expense));
      setExpenses(list);
    }, err => handleErr('EXPENSES', err));

    const unsubEmployees = onSnapshot(buildBranchQuery(COLLECTIONS.EMPLOYEES), (snap) => {
      const list: Employee[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Employee));
      setEmployees(list);
    }, err => handleErr('EMPLOYEES', err));

    const unsubSuppliers = onSnapshot(buildBranchQuery(COLLECTIONS.SUPPLIERS), (snap) => {
      const list: Supplier[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Supplier));
      setSuppliers(list);
    }, err => handleErr('SUPPLIERS', err));

    const unsubDrivers = onSnapshot(buildBranchQuery(COLLECTIONS.DRIVERS), (snap) => {
      const list: DeliveryDriver[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as DeliveryDriver));
      setDrivers(list);
    }, err => handleErr('DRIVERS', err));

    const unsubStations = onSnapshot(buildBranchQuery(COLLECTIONS.STATIONS), (snap) => {
      const list: KitchenStation[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as KitchenStation));
      setStations(list);
    }, err => handleErr('STATIONS', err));

    const unsubAttendance = onSnapshot(buildBranchQuery(COLLECTIONS.ATTENDANCE), (snap) => {
      const list: EmployeeAttendance[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as EmployeeAttendance));
      setAttendance(list);
    }, err => handleErr('ATTENDANCE', err));

    const unsubReservations = onSnapshot(buildBranchQuery(COLLECTIONS.RESERVATIONS), (snap) => {
      const list: Reservation[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Reservation));
      setReservations(list);
    }, err => handleErr('RESERVATIONS', err));

    const unsubBranches = onSnapshot(collection(db, COLLECTIONS.BRANCHES), (snap) => {
      const list: BranchOperation[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as BranchOperation));
      setBranches(list);
    }, err => handleErr('BRANCHES', err));

    const unsubFeedbacks = onSnapshot(buildBranchQuery(COLLECTIONS.FEEDBACKS), (snap) => {
      const list: CustomerFeedback[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as CustomerFeedback));
      setFeedbacks(list);
    }, err => handleErr('FEEDBACKS', err));

    const unsubEquipment = onSnapshot(buildBranchQuery(COLLECTIONS.EQUIPMENT), (snap) => {
      const list: EquipmentItem[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as EquipmentItem));
      setEquipment(list);
      setIsLoading(false);
    }, err => handleErr('EQUIPMENT', err));

    return () => {
      unsubOrders();
      unsubProducts();
      unsubIngredients();
      unsubExpenses();
      unsubEmployees();
      unsubSuppliers();
      unsubDrivers();
      unsubStations();
      unsubAttendance();
      unsubReservations();
      unsubBranches();
      unsubFeedbacks();
      unsubEquipment();
    };
  }, [userRecord?.branchId, userRecord?.role, role]);

  // Compute Operations Analytics from real data package
  const dataPackage = {
    orders,
    products,
    ingredients,
    expenses,
    employees,
    suppliers,
    drivers,
    stations,
    attendance,
    reservations,
    branches,
    feedbacks,
    equipment
  };

  const analytics = calculateOperationsAnalytics(dataPackage);
  const { kpis, delayedOrderAlerts, smartAlerts, recommendations, operationalQuestions } = analytics;

  // Show Toast Success
  const showToast = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 4000);
  };

  // Execute Operational Actions
  const handleExpediteOrder = async (orderId: string) => {
    await updateOrderStatusFirestore(orderId, 'ready_for_pickup');
    showToast(`Order #${orderId} marked as READY for serving!`);
  };

  const handleDeliverOrder = async (orderId: string) => {
    await updateOrderStatusFirestore(orderId, 'completed');
    showToast(`Order #${orderId} delivered successfully!`);
  };

  const handleBalanceStation = async (stationId: string) => {
    await updateStationStatusFirestore(stationId, 'normal', 'Youssef Hassan & Hamza Nur');
    showToast(`Kitchen station workload re-balanced successfully!`);
  };

  const handleAssignDriver = async (orderId: string, driverId: string, driverName: string) => {
    await assignDriverToOrderFirestore(orderId, driverId, driverName);
    showToast(`Assigned ${driverName} to Order #${orderId}`);
  };

  const handleResolveFeedback = async (feedbackId: string) => {
    await resolveCustomerFeedbackFirestore(feedbackId);
    showToast(`Customer complaint marked as resolved with courtesy voucher issued!`);
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

  // Quick Preset AI Questions
  const handleAskPresetQuestion = (key: keyof typeof operationalQuestions) => {
    const q = operationalQuestions[key];
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

  // Handle Free-text Chat Input
  const handleSendQuestion = () => {
    if (!inputQuestion || !inputQuestion.trim()) return;
    const queryLower = (inputQuestion || '').toLowerCase();

    let reply = '';
    if (queryLower.includes('kitchen') || queryLower.includes('مطبخ') || queryLower.includes('jikada')) {
      reply = operationalQuestions.kitchen_performance[currentLang === 'ar' ? 'answer_ar' : currentLang === 'so' ? 'answer_so' : 'answer_en'];
    } else if (queryLower.includes('late') || queryLower.includes('متأخر') || queryLower.includes('daahay')) {
      reply = operationalQuestions.employee_late[currentLang === 'ar' ? 'answer_ar' : currentLang === 'so' ? 'answer_so' : 'answer_en'];
    } else if (queryLower.includes('delayed') || queryLower.includes('تأخير') || queryLower.includes('odalab')) {
      reply = operationalQuestions.orders_delayed[currentLang === 'ar' ? 'answer_ar' : currentLang === 'so' ? 'answer_so' : 'answer_en'];
    } else if (queryLower.includes('delivery') || queryLower.includes('توصيل') || queryLower.includes('gaarsiin')) {
      reply = operationalQuestions.deliveries_pending[currentLang === 'ar' ? 'answer_ar' : currentLang === 'so' ? 'answer_so' : 'answer_en'];
    } else if (queryLower.includes('reorder') || queryLower.includes('ingredient') || queryLower.includes('مكونات') || queryLower.includes('kaydka')) {
      reply = operationalQuestions.reorder_ingredients_today[currentLang === 'ar' ? 'answer_ar' : currentLang === 'so' ? 'answer_so' : 'answer_en'];
    } else {
      reply = currentLang === 'ar' 
        ? `بناءً على بيانات المطبخ المباشرة: لدينا ${kpis.totalPreparingOrders} طلب قيد التحضير، أداء المطبخ **${kpis.kitchenStatus}** (${kpis.kitchenWorkloadPercentage}%)، وحضور الموظفين **${kpis.attendanceRatePercentage}%**.`
        : currentLang === 'so'
        ? `Sida ku xusan xogta jikada: Waxaa la diyaarinayaa ${kpis.totalPreparingOrders} odalab, xaaladda jikada waa **${kpis.kitchenStatus}** (${kpis.kitchenWorkloadPercentage}%).`
        : `Based on real-time Firestore operations data: We currently have ${kpis.totalPreparingOrders} preparing orders, kitchen workload capacity is **${kpis.kitchenWorkloadPercentage}%** (${kpis.kitchenStatus}), staff attendance is **${kpis.attendanceRatePercentage}%**, and driver delivery success rate is **${kpis.deliverySuccessRatePercentage}%**.`;
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
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="font-semibold text-sm">{actionSuccessMsg}</span>
        </div>
      )}

      {/* Main Header & Command Control */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-indigo-400" /> AI Executive Operations Command
              </span>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Real-Time Firestore Sync
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Activity className="w-8 h-8 text-indigo-400" /> 
              {currentLang === 'ar' ? 'مدير عمليات المطبخ والنظام الذكي' : currentLang === 'so' ? 'Maamulaha AI ee Shaqada Maqaayadda' : 'AI Restaurant Operations Manager'}
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Real-time multi-department supervisor monitoring kitchen workload, order prep delays, driver dispatch, staff shifts, and customer complaints directly from live Firestore collections.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Language Selector */}
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-1">
              <button
                onClick={() => setCurrentLang('en')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  currentLang === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setCurrentLang('ar')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  currentLang === 'ar' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                العربية
              </button>
              <button
                onClick={() => setCurrentLang('so')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  currentLang === 'so' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Soomaali
              </button>
            </div>

            <button
              onClick={() => showToast('Refreshed live Firestore operational data pipelines!')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Sync All Departments
            </button>
          </div>
        </div>

        {/* Live Department Health Badges Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <span className="text-xs text-slate-400 block font-medium">Kitchen Workload</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-base font-bold text-white">{kpis.kitchenWorkloadPercentage}%</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                kpis.kitchenStatus === 'Overloaded' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                kpis.kitchenStatus === 'Busy' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {kpis.kitchenStatus}
              </span>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <span className="text-xs text-slate-400 block font-medium">Active Kitchen Orders</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-base font-bold text-indigo-400">{kpis.totalPreparingOrders} preparing</span>
              <span className="text-[10px] text-amber-400 font-bold">{kpis.delayedOrdersCount} delayed</span>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <span className="text-xs text-slate-400 block font-medium">Staff Attendance</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-base font-bold text-emerald-400">{kpis.attendanceRatePercentage}%</span>
              <span className="text-[10px] text-slate-400">{kpis.presentEmployeesCount}/{kpis.totalEmployees} Staff</span>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <span className="text-xs text-slate-400 block font-medium">Delivery Success Rate</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-base font-bold text-teal-400">{kpis.deliverySuccessRatePercentage}%</span>
              <span className="text-[10px] text-slate-400">{kpis.inTransitDriversCount} Drivers Active</span>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <span className="text-xs text-slate-400 block font-medium">Customer Rating</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-base font-bold text-amber-400">★ {kpis.avgCustomerRating} / 5.0</span>
              <span className="text-[10px] text-slate-400">{kpis.customerSatisfactionPercentage}% Satisfied</span>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <span className="text-xs text-slate-400 block font-medium">Low Stock Alerts</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-base font-bold text-rose-400">{kpis.criticalLowStockCount} items</span>
              <span className="text-[10px] text-rose-400 underline cursor-pointer" onClick={() => setActiveTab('dashboard')}>Reorder</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Smart Alerts Banner */}
      {smartAlerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" /> Operational Smart Alerts ({smartAlerts.length})
            </h2>
            <span className="text-xs text-slate-500">Auto-detected by AI Operations Manager</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {smartAlerts.map(alert => (
              <div 
                key={alert.id}
                className={`p-4 rounded-xl border transition-all ${
                  alert.severity === 'critical' ? 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200' :
                  alert.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200' :
                  'bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-4 h-4 ${
                      alert.severity === 'critical' ? 'text-rose-500' : 'text-amber-500'
                    }`} />
                    <h3 className="font-bold text-xs uppercase tracking-wide">{alert.title}</h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900/10 dark:bg-slate-900/40">
                    {alert.timestamp}
                  </span>
                </div>

                <p className="text-xs mt-2 font-medium leading-relaxed opacity-90">{alert.message}</p>

                <div className="mt-3 pt-3 border-t border-slate-900/10 dark:border-slate-800/40 flex items-center justify-between text-xs">
                  <span className="font-semibold">{alert.metricLabel}</span>
                  <button 
                    onClick={() => {
                      if (alert.department === 'kitchen') setActiveTab('kitchen');
                      else if (alert.department === 'orders') setActiveTab('dashboard');
                      else if (alert.department === 'staff') setActiveTab('staff');
                      else if (alert.department === 'delivery') setActiveTab('delivery');
                      else setActiveTab('assistant');
                      showToast(`Navigated to resolve ${alert.title}`);
                    }}
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Action <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          <Activity className="w-4 h-4" /> Command Center
        </button>

        <button
          onClick={() => setActiveTab('kitchen')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
            activeTab === 'kitchen' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Flame className="w-4 h-4" /> Kitchen & KDS
          {kpis.delayedOrdersCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
              {kpis.delayedOrdersCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
            activeTab === 'staff' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" /> Staff & Roster
        </button>

        <button
          onClick={() => setActiveTab('delivery')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
            activeTab === 'delivery' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Truck className="w-4 h-4" /> Delivery Dispatch
        </button>

        <button
          onClick={() => setActiveTab('customer')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
            activeTab === 'customer' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Smile className="w-4 h-4" /> Customer Service
        </button>

        <button
          onClick={() => setActiveTab('assistant')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
            activeTab === 'assistant' 
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' 
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Bot className="w-4 h-4 text-amber-300" /> Voice & Chat AI Assistant
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EXECUTIVE COMMAND CENTER */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Delayed Orders Auto-Detection Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" /> Real-time Order Preparation & Delay Detector
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Orders exceeding the target preparation threshold ({kpis.targetPrepTimeMinutes} minutes) are flagged automatically.
                </p>
              </div>
              <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30">
                {delayedOrderAlerts.length} Orders Delayed
              </span>
            </div>

            {delayedOrderAlerts.length === 0 ? (
              <div className="bg-slate-800/40 rounded-xl p-8 text-center border border-slate-800">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
                <p className="text-sm font-semibold text-slate-200">All kitchen orders are running within schedule!</p>
                <p className="text-xs text-slate-400 mt-1">Average kitchen preparation time is currently {kpis.avgPreparationTimeMinutes} mins.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="p-3 rounded-l-xl">Order #</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Items Summary</th>
                      <th className="p-3">Elapsed Time</th>
                      <th className="p-3">Chef Station</th>
                      <th className="p-3 text-right rounded-r-xl">Manager Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {delayedOrderAlerts.map(ord => (
                      <tr key={ord.orderId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-bold text-indigo-400">{ord.orderNumber}</td>
                        <td className="p-3 font-medium text-white">{ord.customerName}</td>
                        <td className="p-3 text-slate-300 max-w-xs truncate">{ord.itemsSummary}</td>
                        <td className="p-3 font-bold">
                          <span className={`px-2 py-1 rounded-full text-[11px] flex items-center gap-1 w-fit ${
                            ord.severity === 'high' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            <Timer className="w-3 h-3" /> {ord.elapsedMinutes} mins (Target {ord.targetMinutes}m)
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">{ord.assignedChef}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleExpediteOrder(ord.orderId)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors shadow-sm"
                          >
                            Expedite & Mark Ready
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* AI Operational Recommendations */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-indigo-500" /> AI Operations Optimizations & Recommendations
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map(rec => (
                <div key={rec.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        {(rec.category || 'General').replace('_', ' ')}
                      </span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Impact: {rec.impact}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{rec.title}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{rec.description}</p>
                  </div>

                  <button
                    onClick={() => {
                      showToast(`Executed action: ${rec.title}`);
                    }}
                    className="mt-4 w-full bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    Apply Optimization <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: KITCHEN & KDS (KITCHEN DISPLAY SYSTEM) */}
      {/* ========================================================================= */}
      {activeTab === 'kitchen' && (
        <div className="space-y-6">
          {/* Kitchen Workload & Stations Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stations.map(st => (
              <div key={st.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-indigo-500" /> {st.name}
                  </h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    st.status === 'overloaded' ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                  }`}>
                    {(st.status || 'normal').toUpperCase()}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Chef Assigned:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-200">{st.assignedChef}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Tickets:</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{st.activeOrdersCount} orders</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Prep Time:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{st.avgPrepTimeMinutes} mins</span>
                  </div>
                </div>

                {st.status === 'overloaded' && (
                  <button
                    onClick={() => handleBalanceStation(st.id)}
                    className="mt-4 w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
                  >
                    Balance & Re-assign Workload
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* KDS Active Tickets Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white">
            <h3 className="text-base font-bold flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-amber-500" /> Live Kitchen Display System (KDS Tickets)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders.filter(o => o.status === 'pending' || o.prepStatus === 'preparing' || o.prepStatus === 'new').map(ord => {
                const elapsedFromCreated = ord.createdAt ? Math.max(1, Math.round((Date.now() - new Date(ord.createdAt).getTime()) / 60000)) : 0;
                const prepMinutes = ord.prepTimeMinutes || elapsedFromCreated;
                const isDelayed = prepMinutes > (ord.targetPrepTimeMinutes || 15);

                return (
                  <div key={ord.id} className={`p-4 rounded-xl border flex flex-col justify-between ${
                    isDelayed ? 'bg-rose-950/30 border-rose-600/40' : 'bg-slate-800 border-slate-700'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-indigo-400">{ord.orderNumber}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isDelayed ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {prepMinutes} mins elapsed
                        </span>
                      </div>

                      <div className="text-xs text-slate-300 font-medium mb-2">
                        Customer: <span className="text-white font-semibold">{ord.customerName}</span>
                      </div>

                      <div className="border-t border-slate-700 pt-2 space-y-1">
                        {ord.items.map((item, idx) => (
                          <div key={idx} className="text-xs text-slate-200 flex justify-between">
                            <span>{item.quantity}x {item.productName}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleExpediteOrder(ord.id)}
                      className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow"
                    >
                      <Check className="w-4 h-4" /> Mark Order Ready
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STAFF & ROSTER */}
      {/* ========================================================================= */}
      {activeTab === 'staff' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-indigo-500" /> Real-time Staff Attendance & Late Arrival Tracker
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase">
                  <tr>
                    <th className="p-3">Employee Name</th>
                    <th className="p-3">Shift</th>
                    <th className="p-3">Check-In Time</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Overtime</th>
                    <th className="p-3 text-right">Schedule Recommendation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {attendance.map(att => (
                    <tr key={att.id}>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{att.employeeName}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{att.shift}</td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">{att.checkInTime || 'N/A'}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          att.status === 'present' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                          att.status === 'late' ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 font-extrabold' :
                          'bg-slate-500/20 text-slate-600'
                        }`}>
                          {(att.status || 'present').toUpperCase()} {att.lateMinutes ? `(${att.lateMinutes}m late)` : ''}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">{att.overtimeHours || 0} hrs</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => showToast(`Optimized shift schedule for ${att.employeeName}`)}
                          className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
                        >
                          Optimize Shift
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DELIVERY DISPATCH */}
      {/* ========================================================================= */}
      {activeTab === 'delivery' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Truck className="w-5 h-5 text-indigo-500" /> Active Delivery Drivers Roster
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {drivers.map(drv => (
                <div key={drv.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{drv.name}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      drv.status === 'available' ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/20 text-amber-600'
                    }`}>
                      {(drv.status || 'available').replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    <p>Vehicle: <span className="font-semibold text-slate-800 dark:text-slate-200">{drv.vehicle}</span></p>
                    <p>Rating: <span className="font-bold text-amber-500">★ {drv.rating}</span></p>
                    <p>Avg Delivery Time: <span className="font-semibold">{drv.avgDeliveryTimeMinutes} mins</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CUSTOMER SERVICE & COMPLAINTS */}
      {/* ========================================================================= */}
      {activeTab === 'customer' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Smile className="w-5 h-5 text-indigo-500" /> Customer Complaints & Resolution Center
            </h3>

            <div className="space-y-3">
              {feedbacks.map(fb => (
                <div key={fb.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{fb.customerName}</span>
                      <span className="text-xs font-bold text-amber-500">★ {fb.rating} / 5</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        fb.status === 'open' ? 'bg-rose-500/20 text-rose-500' : 'bg-emerald-500/20 text-emerald-500'
                      }`}>
                        {(fb.status || 'open').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{fb.complaint || fb.compliments}</p>
                  </div>

                  {fb.status === 'open' && (
                    <button
                      onClick={() => handleResolveFeedback(fb.id)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                    >
                      Resolve & Issue Voucher
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: VOICE & CHAT AI ASSISTANT */}
      {/* ========================================================================= */}
      {activeTab === 'assistant' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl space-y-6">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Bot className="w-6 h-6 text-indigo-400" /> AI Operations Voice & Chat Assistant (EN / AR / SO)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Ask operational questions regarding kitchen performance, employee lateness, delayed orders, pending deliveries, or raw ingredient reorders.
            </p>
          </div>

          {/* Quick Preset Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button
              onClick={() => handleAskPresetQuestion('kitchen_performance')}
              className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-left text-xs font-bold text-indigo-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
            >
              <Flame className="w-4 h-4 text-amber-400" /> How is the kitchen performing today?
            </button>

            <button
              onClick={() => handleAskPresetQuestion('employee_late')}
              className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-left text-xs font-bold text-rose-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
            >
              <UserCheck className="w-4 h-4 text-rose-400" /> Which employee is late?
            </button>

            <button
              onClick={() => handleAskPresetQuestion('orders_delayed')}
              className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-left text-xs font-bold text-amber-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
            >
              <Timer className="w-4 h-4 text-amber-400" /> Which orders are delayed?
            </button>

            <button
              onClick={() => handleAskPresetQuestion('deliveries_pending')}
              className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-left text-xs font-bold text-teal-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
            >
              <Truck className="w-4 h-4 text-teal-400" /> How many deliveries pending?
            </button>

            <button
              onClick={() => handleAskPresetQuestion('reorder_ingredients_today')}
              className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-left text-xs font-bold text-emerald-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
            >
              <PackageCheck className="w-4 h-4 text-emerald-400" /> Do I need to reorder ingredients today?
            </button>
          </div>

          {/* Chat Messages Log */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 h-80 overflow-y-auto space-y-4">
            {chatMessages.map(msg => (
              <div 
                key={msg.id} 
                className={`flex gap-3 text-xs ${
                  msg.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}

                <div className={`p-3.5 rounded-2xl max-w-xl leading-relaxed ${
                  msg.sender === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none font-medium' 
                    : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none whitespace-pre-line'
                }`}>
                  <p>{msg.text}</p>
                  <span className="text-[10px] opacity-60 block mt-1 text-right">{msg.timestamp}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendQuestion()}
              placeholder="Ask the AI Operations Manager a question..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />

            <button
              onClick={handleSendQuestion}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold p-3 rounded-xl cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
