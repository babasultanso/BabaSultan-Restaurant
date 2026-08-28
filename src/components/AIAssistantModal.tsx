import React, { useState, useRef, useEffect } from 'react';
import { auth } from '../lib/firebase';
import { getApiUrl } from '../lib/apiConfig';
import { ChatMessage, Language } from '../types';
import { translations, detectLanguage } from '../lib/i18n';
import {
  Bot,
  X,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  RefreshCw,
  Zap
} from 'lucide-react';
import { downloadPDFReport, exportToExcel } from '../lib/reports';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  firestoreData: any;
  onExecuteAction: (actionType: string, payload: any) => Promise<void>;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  language,
  firestoreData,
  onExecuteAction
}) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [executedActionIds, setExecutedActionIds] = useState<Record<string, boolean>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);

  const activeLang = language === 'auto' ? 'en' : language;
  const t = translations[activeLang];

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Welcome Greeting
      const welcomeMessage: ChatMessage = {
        id: 'msg_welcome',
        sender: 'assistant',
        text: activeLang === 'ar'
          ? "مرحباً بك! أنا مساعدك التجاري الذكي والمدير المالي لمطعمك. أستطيع الإجابة على أسئلة المبيعات، الأرباح، المصروفات، المخزون، وتنفيذ القرارات المالية فوراً بلغة عربية، صومالية، أو إنجليزية."
          : activeLang === 'so'
          ? "Kusoo dhawaow! Waxaan ahay Kaaliyahaaga AI ee Maqaayadda iyo Menejerka Maaliyadda. Waxaan kaa caawin karaa faa'iidada, dalabyada, kharashyada, kaydka jikada, iyo fulinta go'aamada maaliyadeed."
          : "Welcome! I am your AI Business Manager & Financial Accountant. I analyze live Firestore data to calculate profits, expenses, inventory, employee sales, and execute ERP business actions in English, Arabic, or Somali.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedQuestions: [
          t.profitToday,
          t.completedOrdersToday,
          t.todayExpensesQuery,
          t.lowIngredientsQuery,
          t.predictSalesQuery,
          t.detectAbnormalExpenses,
          t.suggestIncreaseProfit
        ]
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, activeLang]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = textToSend || inputPrompt;
    if (!prompt.trim() || isLoading) return;

    const detected = detectLanguage(prompt);

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: prompt,
      detectedLanguage: detected,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const token = await auth.currentUser?.getIdToken().catch(() => null);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(getApiUrl('/api/ai-chat'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt,
          language: language === 'auto' ? detected : language,
          currentData: firestoreData
        })
      });

      const resData = await response.json();

      const assistantMsg: ChatMessage = {
        id: `asst_${Date.now()}`,
        sender: 'assistant',
        text: resData.reply || 'No response generated.',
        detectedLanguage: resData.detectedLanguage || detected,
        actionTaken: resData.actionTaken,
        actionPayload: resData.actionPayload,
        suggestedQuestions: resData.suggestedQuestions || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ Communication error with AI Manager: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAction = async (msgId: string, actionType: string, payload: any) => {
    try {
      await onExecuteAction(actionType, payload);
      setExecutedActionIds(prev => ({ ...prev, [msgId]: true }));
    } catch (err: any) {
      alert(`Failed to execute action: ${err.message}`);
    }
  };

  const handleExportPDFFromChat = () => {
    const dateStr = new Date().toLocaleDateString();
    const rows = (firestoreData.orders || []).map((o: any) => [
      o.orderNumber,
      o.customerName || 'Walk-in',
      `$${o.totalAmount.toFixed(2)}`,
      `$${o.profit.toFixed(2)}`,
      o.paymentMethod,
      new Date(o.createdAt).toLocaleTimeString()
    ]);

    downloadPDFReport(
      'AI Executive Sales & Financial Audit',
      `Live Firestore Audit generated on ${dateStr}`,
      [
        {
          heading: "Completed Orders & Revenue Breakdown",
          columns: ["Order #", "Customer", "Total Amount", "Net Profit", "Payment", "Time"],
          rows
        }
      ]
    );
  };

  const handleExportExcelFromChat = () => {
    const columns = ["Order #", "Customer", "Total Amount", "COGS", "Net Profit", "Employee", "Date"];
    const rows = (firestoreData.orders || []).map((o: any) => [
      o.orderNumber,
      o.customerName || 'Walk-in',
      o.totalAmount,
      o.cogs,
      o.profit,
      o.employeeName,
      new Date(o.createdAt).toLocaleString()
    ]);

    exportToExcel('AI_Firestore_Financial_Report', columns, rows);
  };

  const quickPromptsList = [
    t.profitToday,
    t.completedOrdersToday,
    t.todayExpensesQuery,
    t.topProductsQuery,
    t.lowIngredientsQuery,
    t.topEmployeeQuery,
    t.supplierReorderQuery,
    t.financialReportQuery,
    t.monthProfitQuery,
    t.predictSalesQuery,
    t.detectAbnormalExpenses,
    t.suggestIncreaseProfit,
    t.suggestReduceCosts
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        
        {/* Drawer Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-md">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {t.aiAssistant}
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Real Firestore Sync
                </span>
              </h2>
              <p className="text-xs text-slate-400">Multi-lingual: English • العربية • Af Soomaali</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDFFromChat}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Download PDF Financial Audit"
            >
              <FileText className="w-5 h-5 text-emerald-400" />
            </button>
            <button
              onClick={handleExportExcelFromChat}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Export Excel Worksheet"
            >
              <FileSpreadsheet className="w-5 h-5 text-teal-400" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Prompts Carousel */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800/80 overflow-x-auto no-scrollbar flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
          {quickPromptsList.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              disabled={isLoading}
              className="text-xs whitespace-nowrap bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 px-3 py-1.5 rounded-full transition hover:border-emerald-500/40 disabled:opacity-50 cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isExecuted = executedActionIds[msg.id];

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                  isUser
                    ? 'bg-emerald-600 text-white rounded-br-none'
                    : 'bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-bl-none'
                }`}>
                  
                  {/* Language Badge if detected */}
                  {msg.detectedLanguage && (
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-2 font-mono uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Language: {msg.detectedLanguage === 'ar' ? 'العربية' : msg.detectedLanguage === 'so' ? 'Af Soomaali' : 'English'}
                    </div>
                  )}

                  {/* Text Content */}
                  <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                    {msg.text}
                  </div>

                  {/* Proposed Automated Action Card */}
                  {msg.actionTaken && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30 text-xs">
                      <div className="flex items-center justify-between text-emerald-400 font-semibold mb-1">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-emerald-400" />
                          Automated Action Proposed: {msg.actionTaken}
                        </span>
                      </div>
                      <pre className="p-2 bg-slate-950 rounded text-[11px] text-slate-300 overflow-x-auto mb-2 border border-slate-800">
                        {JSON.stringify(msg.actionPayload, null, 2)}
                      </pre>

                      {!isExecuted ? (
                        <button
                          onClick={() => handleConfirmAction(msg.id, msg.actionTaken!, msg.actionPayload)}
                          className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Apply Action to Firestore
                        </button>
                      ) : (
                        <div className="text-emerald-400 font-semibold flex items-center justify-center gap-1.5 py-1">
                          <CheckCircle2 className="w-4 h-4" />
                          Applied to Firestore Database!
                        </div>
                      )}
                    </div>
                  )}

                  {/* Follow up suggestions */}
                  {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700/60 flex flex-wrap gap-1.5">
                      {msg.suggestedQuestions.map((q, qIdx) => (
                        <button
                          key={qIdx}
                          onClick={() => handleSendMessage(q)}
                          disabled={isLoading}
                          className="text-[11px] bg-slate-700/60 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-md transition text-left cursor-pointer"
                        >
                          💡 {q}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="text-[10px] text-right mt-2 text-slate-400 opacity-80">
                    {msg.timestamp}
                  </div>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-lg bg-slate-700 text-slate-200 flex items-center justify-center shrink-0 mt-1 font-bold text-xs">
                    YOU
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-3 text-slate-400 text-xs p-3 bg-slate-800/40 rounded-xl border border-slate-800">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Analyzing live Firestore data & computing financial Advisor response...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Chat Input Bar */}
        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder={t.askAI}
              disabled={isLoading}
              className="flex-1 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition"
            />
            <button
              type="submit"
              disabled={isLoading || !inputPrompt.trim()}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold p-3 rounded-xl transition cursor-pointer"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          <p className="text-[10px] text-slate-500 text-center mt-2">
            Ask in English, Arabic (العربية), or Somali (Af Soomaali). AI executes real Firestore ERP transactions.
          </p>
        </div>

      </div>
    </div>
  );
};
