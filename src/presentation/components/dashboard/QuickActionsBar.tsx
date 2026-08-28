import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  UserRole
} from '../../../constants';
import {
  ShieldCheck,
  Plus,
  ShoppingCart,
  Receipt,
  Boxes,
  Bot
} from 'lucide-react';

interface QuickActionsBarProps {
  activeRoleView: string;
  onChangeRoleView: (role: string) => void;
  onNavigateToTab?: (tab: string) => void;
  onOpenAIQuery?: () => void;
}

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({
  activeRoleView,
  onChangeRoleView,
  onNavigateToTab,
  onOpenAIQuery
}) => {
  const { role, permissions, t, language } = useAuth();

  const getRoleLabel = (roleKey: UserRole, fallback: string) => {
    if (t.roles && t.roles[roleKey]) {
      return t.roles[roleKey];
    }
    return fallback;
  };

  const roleViews: { id: string; label: string; roleKey: UserRole }[] = [
    { id: 'owner', label: getRoleLabel('Owner', 'Owner'), roleKey: 'Owner' },
    { id: 'manager', label: getRoleLabel('Manager', 'Manager'), roleKey: 'Manager' },
    { id: 'accountant', label: getRoleLabel('Accountant', 'Accountant'), roleKey: 'Accountant' },
    { id: 'cashier', label: getRoleLabel('Cashier', 'Cashier'), roleKey: 'Cashier' },
    { id: 'kitchen', label: getRoleLabel('Kitchen', 'Kitchen Staff'), roleKey: 'Kitchen' },
    { id: 'waiter', label: getRoleLabel('Waiter', 'Waiter'), roleKey: 'Waiter' },
    { id: 'delivery', label: getRoleLabel('Delivery Driver', 'Delivery Driver'), roleKey: 'Delivery Driver' },
    { id: 'admin', label: getRoleLabel('Admin', 'Admin'), roleKey: 'Admin' }
  ];

  const viewAsText = language === 'ar' ? 'عرض كـ:' : language === 'so' ? 'Ku Eeg:' : 'View As:';
  const posOrderText = language === 'ar' ? '+ طلب جديد' : language === 'so' ? '+ Dalab Mp' : '+ POS Order';
  const logExpenseText = language === 'ar' ? '+ تسجيل مصروف' : language === 'so' ? '+ Qor Kharash' : '+ Log Expense';
  const stockMovementText = language === 'ar' ? 'حركة المخزون' : language === 'so' ? 'Mawqifka Alaabta' : 'Stock Movement';
  const aiAdvisorText = language === 'ar' ? 'المستشار الذكي' : language === 'so' ? 'Garaadka AI' : 'AI Advisor';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-4">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        
        {/* Role View Switcher Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-none">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> {viewAsText}
            </span>
            {roleViews.map(rv => {
              const isActive = (activeRoleView || '').toLowerCase() === rv.id;
              return (
                <button
                  key={rv.id}
                  onClick={() => {
                    onChangeRoleView(rv.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  {rv.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Operational Shortcuts */}
        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto">
          {onNavigateToTab && (
            <>
              <button
                onClick={() => onNavigateToTab('pos')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                <span>{posOrderText}</span>
              </button>

              <button
                onClick={() => onNavigateToTab('financials')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5 text-indigo-400" />
                <span>{logExpenseText}</span>
              </button>

              <button
                onClick={() => onNavigateToTab('inventory')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Boxes className="w-3.5 h-3.5 text-amber-400" />
                <span>{stockMovementText}</span>
              </button>
            </>
          )}

          {onOpenAIQuery && (
            <button
              onClick={onOpenAIQuery}
              className="bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap shadow-md cursor-pointer"
            >
              <Bot className="w-4 h-4" />
              <span>{aiAdvisorText}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
