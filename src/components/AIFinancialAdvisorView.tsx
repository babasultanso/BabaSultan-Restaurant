import React, { useState, useMemo } from 'react';
import { auth } from '../lib/firebase';
import { getApiUrl } from '../lib/apiConfig';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Sparkles, 
  Calculator, 
  Clock, 
  Package, 
  Users, 
  BarChart3, 
  PieChart as PieChartIcon, 
  ArrowUpRight, 
  ArrowDownRight, 
  Send, 
  Bot, 
  FileSpreadsheet, 
  Download, 
  Lightbulb, 
  HelpCircle, 
  Zap, 
  Filter, 
  RefreshCw,
  ShoppingBag,
  Award,
  ChevronRight,
  X
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
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
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
  FinancialAccount,
  ChatMessage
} from '../types';
import { calculateCFOAnalytics, CFODataPackage } from '../lib/cfoAnalytics';
import { generateCPAReport } from '../lib/reports';

interface AIFinancialAdvisorViewProps {
  orders: Order[];
  products: Product[];
  ingredients: Ingredient[];
  expenses: Expense[];
  purchases: Purchase[];
  employees: Employee[];
  salaries: SalaryPayment[];
  suppliers: Supplier[];
  refunds: CustomerRefund[];
  bankTransactions: BankTransaction[];
  accounts: FinancialAccount[];
  inventoryMovements?: InventoryMovement[];
  onOpenAIQuery?: (query: string) => void;
  onAddExpense?: (exp: any) => Promise<any>;
  onAddPurchase?: (pur: any) => Promise<any>;
  onAddRefund?: (ref: any) => Promise<any>;
  onAddBankTransaction?: (tx: any) => Promise<any>;
  onUpdateStock?: (prodId: string, newStock: number) => Promise<any>;
}

export const AIFinancialAdvisorView: React.FC<AIFinancialAdvisorViewProps> = ({
  orders,
  products,
  ingredients,
  expenses,
  purchases,
  employees,
  salaries,
  suppliers,
  refunds,
  bankTransactions,
  accounts,
  inventoryMovements = [],
  onOpenAIQuery,
  onAddExpense,
  onAddPurchase,
  onAddRefund,
  onAddBankTransaction,
  onUpdateStock
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'performance' | 'predictions' | 'recommendations' | 'questions' | 'chat'>('dashboard');
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>('increase_profit');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'assistant',
      text: 'Greetings. I am your AI Chief Financial Officer (CFO). I have analyzed your live restaurant financial data from Firestore. How can I assist with your executive strategy today?',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [pendingConfirmAction, setPendingConfirmAction] = useState<{
    actionType: string;
    payload: any;
    title: string;
    description: string;
  } | null>(null);

  // Compute live analytics package
  const dataPackage: CFODataPackage = {
    orders,
    products,
    ingredients,
    expenses,
    purchases,
    employees,
    salaries,
    suppliers,
    inventory_movements: inventoryMovements,
    refunds,
    bank_transactions: bankTransactions,
    accounts
  };

  const analytics = useMemo(() => calculateCFOAnalytics(dataPackage), [
    orders, products, ingredients, expenses, purchases, employees, salaries, suppliers, inventoryMovements, refunds, bankTransactions, accounts
  ]);

  const { kpis, performanceIssues, forecast, recommendations, alerts, businessQuestionAnswers } = analytics;

  // Calculate Overall CFO Financial Health Score (0-100)
  const cfoHealthScore = useMemo(() => {
    let score = 75;
    if (kpis.netMarginPercentage >= 20) score += 10;
    else if (kpis.netMarginPercentage < 10) score -= 15;

    if (kpis.foodCostPercentage <= 30) score += 5;
    else if (kpis.foodCostPercentage > 35) score -= 10;

    if (kpis.revenueGrowthWeekOverWeek > 0) score += 5;
    else score -= 5;

    if (kpis.lowStockItemsCount === 0) score += 5;
    else score -= Math.min(10, kpis.lowStockItemsCount * 2);

    return Math.max(20, Math.min(100, score));
  }, [kpis]);

  // Request Confirmation for CFO Action
  const handleRequestActionConfirmation = (rec: any) => {
    let actionType = rec.actionType || 'ADD_EXPENSE';
    let payload = rec.actionPayload || {};

    if (rec.actionType === 'UPDATE_STOCK') {
      actionType = 'UPDATE_STOCK';
      payload = {
        productId: rec.actionPayload?.productId || products[0]?.id || 'prod_1',
        newStock: Number(rec.actionPayload?.newStock ?? 50),
        reason: rec.description || 'CFO Recommended Stock Adjustment'
      };
    } else if (rec.actionType === 'REGISTER_PURCHASE') {
      actionType = 'REGISTER_PURCHASE';
      payload = {
        itemName: rec.actionPayload?.itemName || 'Inventory Reorder',
        quantity: Number(rec.actionPayload?.quantity) || 10,
        unit: rec.actionPayload?.unit || 'kg',
        unitPrice: Number(rec.actionPayload?.unitPrice) || 10,
        totalCost: Number(rec.actionPayload?.totalCost) || 100,
        supplierId: rec.actionPayload?.supplierId,
        supplierName: rec.actionPayload?.supplierName || suppliers[0]?.name || 'Primary Supplier',
        status: (rec.actionPayload?.status || 'completed') as any
      };
    } else if (rec.actionType === 'ADD_EXPENSE') {
      actionType = 'ADD_EXPENSE';
      payload = {
        title: rec.actionPayload?.title || rec.title || 'Operational Expense',
        amount: Number(rec.actionPayload?.amount) || 100,
        category: rec.actionPayload?.category || 'supplies',
        description: rec.actionPayload?.description || `CFO Auto-Action: ${rec.title || 'Expense'}`
      };
    }

    setPendingConfirmAction({
      actionType,
      payload,
      title: rec.title || `Execute ${actionType.replace('_', ' ')}`,
      description: rec.description || rec.recommendedAction || 'Execute verified double-entry ledger mutation via server-authoritative endpoint.'
    });
  };

  // Authoritatively Execute Action via Server Endpoint
  const handleConfirmAndExecute = async () => {
    if (!pendingConfirmAction) return;

    setIsExecutingAction(true);
    setActionErrorMsg(null);
    try {
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Idempotency-Key': `ai_act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(getApiUrl('/api/ai/execute-action'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          actionType: pendingConfirmAction.actionType,
          payload: pendingConfirmAction.payload,
          userConfirmed: true,
          confirmed: true
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Server execution failed (${response.status})`);
      }

      setActionSuccessMsg(`Successfully executed action: "${pendingConfirmAction.title}".`);
      setPendingConfirmAction(null);
      setTimeout(() => setActionSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('AI Execute Action error:', err);
      setActionErrorMsg(`Action execution failed: ${err.message || 'Server error'}`);
      setTimeout(() => setActionErrorMsg(null), 5000);
    } finally {
      setIsExecutingAction(false);
    }
  };

  // Handle AI Chat Submit
  const handleSendChat = async (promptToSend?: string) => {
    const text = promptToSend || chatInput;
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString()
    };

    setChatMessages(prev => [...prev, userMsg]);
    if (!promptToSend) setChatInput('');
    setIsAiLoading(true);

    try {
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(getApiUrl('/api/ai-chat'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: text,
          language: 'auto',
          currentData: dataPackage
        })
      });

      const data = await response.json();
      if (data.reply) {
        const assistantMsg: ChatMessage = {
          id: `ast_${Date.now()}`,
          sender: 'assistant',
          text: data.reply,
          detectedLanguage: data.detectedLanguage,
          actionTaken: data.actionTaken,
          actionPayload: data.actionPayload,
          suggestedQuestions: data.suggestedQuestions,
          timestamp: new Date().toLocaleTimeString()
        };
        setChatMessages(prev => [...prev, assistantMsg]);
      } else {
        throw new Error('No reply from AI CFO server.');
      }
    } catch (err) {
      const fallbackMsg: ChatMessage = {
        id: `ast_err_${Date.now()}`,
        sender: 'assistant',
        text: `**CFO Analysis Strategy:** Based on your live Firestore data, monthly revenue stands at $${kpis.monthlyRevenue.toFixed(2)} with a net profit of $${kpis.netProfit.toFixed(2)} (${kpis.netMarginPercentage.toFixed(1)}% net margin). Food costs currently account for ${kpis.foodCostPercentage.toFixed(1)}% of sales. To maximize returns, focus on price optimization for top sellers and inventory reorders for ${kpis.lowStockItemsCount} low stock items.`,
        timestamp: new Date().toLocaleTimeString()
      };
      setChatMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Colors for charts
  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  // Expense Pie Chart Data
  const expensePieData = [
    { name: 'Food Costs (COGS)', value: Math.round(kpis.foodCosts) },
    { name: 'Labor & Salaries', value: Math.round(kpis.laborCosts) },
    { name: 'Utilities', value: Math.round(kpis.utilityCosts) },
    { name: 'Rent', value: Math.round(kpis.rentCosts) },
    { name: 'Delivery', value: Math.round(kpis.deliveryCosts) },
    { name: 'Other Operating', value: Math.round(Math.max(0, kpis.operatingCosts - kpis.utilityCosts - kpis.rentCosts - kpis.deliveryCosts)) }
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6 pb-12">
      
      {/* Action Toast Alert */}
      {actionSuccessMsg && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-slate-950" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* CFO Executive Top Banner & Health Index */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20 shrink-0">
              <Calculator className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-black text-white tracking-tight">AI Chief Financial Officer (CFO)</h2>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Real Firestore Analytics
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Powered by Gemini
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-1 max-w-2xl">
                Real-time executive financial modeling, predictive sales & profit forecasting, cost optimizations, and automated strategic advisory for your restaurant enterprise.
              </p>
            </div>
          </div>

          {/* CFO Financial Health Score */}
          <div className="flex items-center gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800 shrink-0">
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">CFO Health Index</p>
              <div className="flex items-baseline gap-1.5 justify-end mt-0.5">
                <span className="text-3xl font-black text-emerald-400">{cfoHealthScore}</span>
                <span className="text-xs font-bold text-slate-500">/ 100</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {cfoHealthScore >= 80 ? 'Optimal Growth' : cfoHealthScore >= 60 ? 'Moderate Margin' : 'Attention Required'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-emerald-500/30 border-t-emerald-400 flex items-center justify-center text-emerald-400 font-bold text-sm">
              <Award className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* CFO Navigation Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-800/80 overflow-x-auto no-scrollbar">
          {[
            { id: 'dashboard', label: 'Executive Dashboard', icon: BarChart3 },
            { id: 'performance', label: `Diagnostics & Alerts (${performanceIssues.length + alerts.length})`, icon: ShieldAlert, badge: alerts.length > 0 ? alerts.length : null },
            { id: 'predictions', label: 'Predictive Forecasts', icon: TrendingUp },
            { id: 'recommendations', label: `Strategies (${recommendations.length})`, icon: Lightbulb },
            { id: 'questions', label: 'Ask Business Questions', icon: HelpCircle },
            { id: 'chat', label: 'AI CFO Chat', icon: Bot }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive 
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' 
                    : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EXECUTIVE DASHBOARD */}
      {/* ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          
          {/* Executive KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 1. Revenue KPI */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Monthly Net Revenue</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white mt-2">
                ${kpis.monthlyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="flex items-center justify-between mt-3 text-xs">
                <div className={`flex items-center gap-1 font-bold ${kpis.revenueGrowthWeekOverWeek >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {kpis.revenueGrowthWeekOverWeek >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  <span>{Math.abs(kpis.revenueGrowthWeekOverWeek).toFixed(1)}% WoW</span>
                </div>
                <span className="text-slate-500">Today: ${kpis.dailyRevenue.toFixed(0)}</span>
              </div>
            </div>

            {/* 2. Profit KPI */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Net Profit & Margin</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white mt-2">
                ${kpis.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="flex items-center justify-between mt-3 text-xs">
                <span className={`font-bold px-2 py-0.5 rounded ${
                  kpis.netMarginStatus === 'healthy' ? 'bg-emerald-500/20 text-emerald-400' :
                  kpis.netMarginStatus === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {kpis.netMarginPercentage.toFixed(1)}% Net Margin
                </span>
                <span className="text-slate-500">Target: {kpis.targetNetMargin}%</span>
              </div>
            </div>

            {/* 3. Food Cost Ratio */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Food Cost % (COGS)</span>
                <Package className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-white mt-2">
                {kpis.foodCostPercentage.toFixed(1)}%
              </div>
              <div className="flex items-center justify-between mt-3 text-xs">
                <span className={`font-bold ${kpis.foodCostPercentage <= 30 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  Total COGS: ${kpis.foodCosts.toFixed(0)}
                </span>
                <span className="text-slate-500">Target: &lt;30%</span>
              </div>
            </div>

            {/* 4. Total Liquidity & Cash Flow */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Total Treasury Liquidity</span>
                <Calculator className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-black text-white mt-2">
                ${kpis.totalLiquidity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="flex items-center justify-between mt-3 text-xs">
                <span className="text-slate-400">Cash: ${kpis.cashBalance.toFixed(0)}</span>
                <span className="text-slate-400">Bank: ${kpis.bankBalance.toFixed(0)}</span>
              </div>
            </div>

          </div>

          {/* Secondary KPIs Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            
            <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl text-center">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Labor Cost %</p>
              <p className="text-lg font-black text-white mt-1">{kpis.laborCostPercentage.toFixed(1)}%</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Target: &lt; 28%</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl text-center">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Inventory Asset Value</p>
              <p className="text-lg font-black text-emerald-400 mt-1">${kpis.totalInventoryValuation.toFixed(0)}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{kpis.lowStockItemsCount} low stock items</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl text-center">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Completed Orders</p>
              <p className="text-lg font-black text-white mt-1">{kpis.totalCompletedOrders}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Avg: ${kpis.averageOrderValue.toFixed(2)}</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl text-center">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Spoilage & Waste Loss</p>
              <p className="text-lg font-black text-amber-400 mt-1">${kpis.spoilageWasteLoss.toFixed(0)}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{kpis.wastePercentageOfCOGS.toFixed(1)}% of COGS</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl text-center">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Revenue / Employee</p>
              <p className="text-lg font-black text-white mt-1">${kpis.revenuePerEmployee.toFixed(0)}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{kpis.activeEmployeeCount} active staff</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl text-center">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Est. Tax Obligations</p>
              <p className="text-lg font-black text-indigo-400 mt-1">${(kpis.estimatedVAT + kpis.estimatedCorporateTax).toFixed(0)}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Recorded VAT + 20% Corp</p>
            </div>

          </div>

          {/* Interactive Financial Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Sales & Profit Trends Chart */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Revenue & Profit Trajectory (Last 7 Days)
                  </h3>
                  <p className="text-xs text-slate-400">Calculated from live completed Firestore orders</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">● Sales</span>
                  <span className="flex items-center gap-1 text-teal-300 font-bold">● Net Profit</span>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecast.historicalDailyTrends}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2DD4BF" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#2DD4BF" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} />
                    <YAxis stroke="#94A3B8" fontSize={12} tickFormatter={v => `$${v}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: '#FFF' }}
                      formatter={(val: any) => [`$${val}`, '']}
                    />
                    <Area type="monotone" dataKey="sales" name="Revenue" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                    <Area type="monotone" dataKey="profit" name="Net Profit" stroke="#2DD4BF" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Expense Structure Breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                <PieChartIcon className="w-5 h-5 text-amber-400" />
                Cost Structure Distribution
              </h3>
              <p className="text-xs text-slate-400 mb-4">Total Expenses: ${kpis.totalExpenses.toFixed(2)}</p>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {expensePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: '#FFF' }}
                      formatter={(val: any) => [`$${val}`, 'Amount']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                {expensePieData.map((item, idx) => (
                  <div key={item.name} className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Hourly Peak & Quiet Sales Distribution */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-400" />
                  Hourly Order Volume & Peak Hours Distribution
                </h3>
                <p className="text-xs text-slate-400">Used for labor scheduling & kitchen prep optimization</p>
              </div>
              <div className="text-xs text-indigo-400 font-bold bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                Peak Time: {forecast.peakHours[0]?.hourLabel || '1:00 PM'} ({forecast.peakHours[0]?.orderCount || 0} orders)
              </div>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecast.peakHours}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="hourLabel" stroke="#94A3B8" fontSize={12} />
                  <YAxis stroke="#94A3B8" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: '#FFF' }}
                  />
                  <Bar dataKey="orderCount" name="Orders" fill="#6366F1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DIAGNOSTICS & ALERTS */}
      {/* ========================================================================= */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          
          {/* Section Title */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <ShieldAlert className="w-6 h-6 text-amber-400" />
                Performance Diagnostics & Anomaly Alerts
              </h3>
              <p className="text-xs text-slate-400">Automated financial anomaly detection and operational risk warnings</p>
            </div>
            <button 
              onClick={() => generateCPAReport('audit', kpis as any, { orders, expenses, purchases, salaries, products, ingredients, employees, suppliers, refunds, bankTransactions }, 'pdf')}
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Export Diagnostic Audit PDF
            </button>
          </div>

          {/* Active Critical Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Critical CFO Threshold Alerts</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {alerts.map((alt) => (
                  <div 
                    key={alt.id}
                    className={`p-4 rounded-xl border flex items-start gap-3.5 shadow-lg ${
                      alt.severity === 'critical' 
                        ? 'bg-red-500/10 border-red-500/30 text-red-200' 
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                    }`}
                  >
                    <AlertTriangle className={`w-6 h-6 shrink-0 mt-0.5 ${alt.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-bold text-white">{alt.title}</h5>
                        <span className="text-[10px] font-mono opacity-70">{alt.timestamp}</span>
                      </div>
                      <p className="text-xs opacity-90 leading-relaxed">{alt.message}</p>
                      <div className="pt-2 flex items-center justify-between text-xs">
                        <span className="font-mono bg-slate-950/50 px-2 py-0.5 rounded border border-white/10">{alt.thresholdMet}</span>
                        <button 
                          onClick={() => setActiveTab('recommendations')}
                          className="font-bold underline text-white hover:text-emerald-300 cursor-pointer"
                        >
                          View Corrective Action →
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance Issues List */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-400" />
              Detected Operational Inefficiencies ({performanceIssues.length})
            </h4>

            {performanceIssues.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                No major operational inefficiencies or anomalies detected. All metrics are within optimal parameters.
              </div>
            ) : (
              <div className="space-y-4">
                {performanceIssues.map((issue) => (
                  <div key={issue.id} className="bg-slate-950/80 border border-slate-800/80 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700 transition">
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          issue.severity === 'high' ? 'bg-red-500' : issue.severity === 'medium' ? 'bg-amber-500' : 'bg-indigo-500'
                        }`} />
                        <h5 className="text-sm font-bold text-white">{issue.title}</h5>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {issue.metricValue}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed pl-5">{issue.description}</p>
                      <p className="text-xs text-emerald-400 pl-5 font-semibold">
                        💡 CFO Action: {issue.recommendedAction}
                      </p>
                    </div>

                    <button
                      onClick={() => handleRequestActionConfirmation(issue)}
                      className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-bold px-4 py-2 rounded-lg text-xs shrink-0 cursor-pointer transition flex items-center justify-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5" /> Execute Corrective Action
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PREDICTIVE FORECASTS */}
      {/* ========================================================================= */}
      {activeTab === 'predictions' && (
        <div className="space-y-6">
          
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
                Predictive Sales & Profit Forecasting
              </h3>
              <p className="text-xs text-slate-400">Statistical projections based on historical run-rate and day-of-week seasonality</p>
            </div>

            {/* Projected Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                <p className="text-xs text-slate-400 font-semibold uppercase">Next Day Sales Forecast</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">${forecast.nextDaySales.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Projected tomorrow</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                <p className="text-xs text-slate-400 font-semibold uppercase">Next 7-Day Sales Forecast</p>
                <p className="text-2xl font-black text-white mt-1">${forecast.nextWeekSales.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Weekly projection</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                <p className="text-xs text-slate-400 font-semibold uppercase">Next 30-Day Sales Forecast</p>
                <p className="text-2xl font-black text-indigo-400 mt-1">${forecast.nextMonthSales.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Monthly trajectory</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                <p className="text-xs text-slate-400 font-semibold uppercase">Projected Monthly Profit</p>
                <p className="text-2xl font-black text-teal-300 mt-1">${forecast.projectedMonthlyProfit.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">After projected expenses</p>
              </div>
            </div>

            {/* 7-Day Predictive Chart */}
            <div className="pt-4">
              <h4 className="text-sm font-bold text-white mb-3">7-Day Forward Predictive Sales Curve</h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecast.forecastDaily7Days}>
                    <defs>
                      <linearGradient id="colorPredSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} />
                    <YAxis stroke="#94A3B8" fontSize={12} tickFormatter={v => `$${v}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: '#FFF' }}
                    />
                    <Area type="monotone" dataKey="predictedSales" name="Predicted Sales" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorPredSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Inventory Stockout Risk Warnings */}
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Predicted Ingredient Stockouts (Next 5 Days)
              </h4>

              {forecast.inventoryShortageRisks.length === 0 ? (
                <p className="text-xs text-slate-400">All ingredient inventory stocks have more than 5 days of reserve buffer.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {forecast.inventoryShortageRisks.map(item => (
                    <div key={item.itemId} className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/30 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-white">{item.itemName}</p>
                        <p className="text-[11px] text-slate-400">{item.currentStock} {item.unit} remaining</p>
                      </div>
                      <span className="text-xs font-bold px-2 py-1 rounded bg-amber-500/20 text-amber-300">
                        {item.daysRemaining} days left
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: STRATEGIC RECOMMENDATIONS */}
      {/* ========================================================================= */}
      {activeTab === 'recommendations' && (
        <div className="space-y-6">
          
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Lightbulb className="w-6 h-6 text-amber-400" />
                CFO Strategic Action Recommendations
              </h3>
              <p className="text-xs text-slate-400">Data-driven tactics to expand net margins, lower cost structures, and streamline operations</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map((rec) => (
              <div key={rec.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {(rec.category || 'General').replace('_', ' ')}
                    </span>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-800">
                      +${rec.estimatedFinancialGain.toFixed(0)} Gain
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-white">{rec.title}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{rec.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold">Impact: <strong className="text-white">{rec.impactScore}</strong></span>
                  <button
                    onClick={() => handleRequestActionConfirmation(rec)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20 transition"
                  >
                    <Zap className="w-4 h-4" />
                    <span>{rec.actionLabel}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: ASK BUSINESS QUESTIONS */}
      {/* ========================================================================= */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          
          <div>
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-indigo-400" />
              Executive Business Questions Launcher
            </h3>
            <p className="text-xs text-slate-400">Instant CFO financial answers derived strictly from your live Firestore database</p>
          </div>

          {/* Questions Selection Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Object.keys(businessQuestionAnswers).map((qKey) => {
              const qObj = businessQuestionAnswers[qKey];
              const isSelected = selectedQuestion === qKey;
              return (
                <button
                  key={qKey}
                  onClick={() => setSelectedQuestion(qKey)}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    isSelected 
                      ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-500/10' 
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-bold leading-snug">{qObj.question}</span>
                  <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`} />
                </button>
              );
            })}
          </div>

          {/* Selected Question Detail Card */}
          {selectedQuestion && businessQuestionAnswers[selectedQuestion] && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h4 className="text-lg font-black text-white flex items-center gap-2">
                  <Bot className="w-5 h-5 text-emerald-400" />
                  {businessQuestionAnswers[selectedQuestion].question}
                </h4>
                <button
                  onClick={() => handleSendChat(businessQuestionAnswers[selectedQuestion].question)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Ask Deep AI Version
                </button>
              </div>

              {/* Key Metrics Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {businessQuestionAnswers[selectedQuestion].keyMetrics.map((km, i) => (
                  <span key={i} className="text-xs font-mono font-bold bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 text-emerald-400">
                    {km}
                  </span>
                ))}
              </div>

              {/* Answer Content */}
              <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-line bg-slate-950/70 p-5 rounded-xl border border-slate-800/80 font-sans">
                {businessQuestionAnswers[selectedQuestion].answer}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: AI CFO LIVE CHAT */}
      {/* ========================================================================= */}
      {activeTab === 'chat' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
          
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 font-bold">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Live AI CFO Advisory Room</h3>
                <p className="text-xs text-slate-400">Ask custom scenarios, financial modeling, or strategy questions in English, Arabic, or Somali</p>
              </div>
            </div>
            <button 
              onClick={() => setChatMessages([{
                id: 'msg_clear',
                sender: 'assistant',
                text: 'Chat session reset. I am ready for your next financial scenario inquiry.',
                timestamp: new Date().toLocaleTimeString()
              }])}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Clear Room
            </button>
          </div>

          {/* Chat Messages Display */}
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 no-scrollbar">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-1 border border-emerald-500/30">
                    CFO
                  </div>
                )}
                <div
                  className={`max-w-2xl p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-emerald-500 text-slate-950 font-semibold rounded-tr-none'
                      : 'bg-slate-950 text-slate-200 border border-slate-800 rounded-tl-none space-y-3'
                  }`}
                >
                  <div className="whitespace-pre-line">{msg.text}</div>
                  
                  {/* AI Suggested Action Proposal Card (Requires Explicit User Confirmation) */}
                  {msg.actionTaken && msg.actionPayload && (
                    <div className="mt-3 p-3.5 rounded-xl bg-slate-900 border border-emerald-500/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5" /> Suggested Action Proposal: {String(msg.actionTaken).replace('_', ' ')}
                        </span>
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                          Pending User Authorization
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        {JSON.stringify(msg.actionPayload, null, 2)}
                      </p>
                      <button
                        onClick={() => handleRequestActionConfirmation({
                          actionType: msg.actionTaken,
                          actionPayload: msg.actionPayload,
                          title: `AI Action: ${String(msg.actionTaken).replace('_', ' ')}`,
                          description: 'Authoritative execution of AI proposed financial/inventory mutation.'
                        })}
                        className="w-full mt-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow"
                      >
                        <Zap className="w-3.5 h-3.5" /> Review & Authorize Action
                      </button>
                    </div>
                  )}

                  {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                    <div className="pt-3 border-t border-slate-800 space-y-1.5">
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Suggested CFO Follow-ups:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggestedQuestions.map((sq, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSendChat(sq)}
                            className="text-xs bg-slate-900 hover:bg-slate-800 text-emerald-400 px-2.5 py-1 rounded-lg border border-slate-800 cursor-pointer"
                          >
                            {sq}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={`text-[10px] opacity-60 text-right ${msg.sender === 'user' ? 'text-slate-900' : 'text-slate-500'}`}>
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {isAiLoading && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-slate-950 p-3 rounded-xl border border-slate-800 w-max animate-pulse">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>AI CFO is modeling Firestore financial projections...</span>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="Ask CFO e.g., 'What if food prices increase by 10% next month?'..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={() => handleSendChat()}
              disabled={isAiLoading || !chatInput.trim()}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold px-5 py-3 rounded-xl text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <Send className="w-4 h-4" />
              <span>Ask</span>
            </button>
          </div>

        </div>
      )}

      {/* Action Error Alert */}
      {actionErrorMsg && (
        <div className="fixed top-20 right-6 z-50 bg-red-600 text-white font-bold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-white" />
          <span>{actionErrorMsg}</span>
        </div>
      )}

      {/* Explicit User Confirmation Modal for AI Financial Actions */}
      {pendingConfirmAction && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Authorize Financial Mutation</h3>
                  <p className="text-xs text-slate-400">Server-Authoritative General Ledger Action</p>
                </div>
              </div>
              <button
                onClick={() => setPendingConfirmAction(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Action Type</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {pendingConfirmAction.actionType}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-semibold">{pendingConfirmAction.title}</p>
                <p className="text-xs text-slate-400">{pendingConfirmAction.description}</p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Payload Parameters:</span>
                <pre className="text-[11px] font-mono text-emerald-400 overflow-x-auto p-2 bg-slate-900 rounded border border-slate-800">
                  {JSON.stringify(pendingConfirmAction.payload, null, 2)}
                </pre>
              </div>

              <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>This will execute an authoritative double-entry journal posting to the ERP General Ledger.</span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingConfirmAction(null)}
                disabled={isExecutingAction}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAndExecute}
                disabled={isExecutingAction}
                className="px-5 py-2.5 rounded-xl text-xs font-black text-slate-950 bg-emerald-500 hover:bg-emerald-400 flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {isExecutingAction ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Authorizing & Executing...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Confirm & Authorize Action</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
