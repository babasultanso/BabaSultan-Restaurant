import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Tag,
  Building2,
  ShoppingCart,
  Clock,
  ChefHat,
  UtensilsCrossed,
  Boxes,
  Receipt,
  Users,
  BarChart3,
  Brain,
  BrainCircuit,
  Bot,
  Settings,
  UserCheck,
  ShieldCheck,
  LogOut,
  X,
  UserCog,
  HeartHandshake,
  GitFork,
  Truck,
  Activity
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  mobileOpen,
  onCloseMobile
}) => {
  const { permissions, t, logout, user, userRecord, role } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const navItems = [
    { id: 'dashboard', label: t.navigation.dashboard, icon: LayoutDashboard, permission: true },
    { id: 'products', label: t.navigation.products, icon: Tag, permission: permissions.canViewProducts ?? true },
    { id: 'admin', label: t.navigation.adminPanel, icon: Building2, permission: permissions.canAccessAdminPanel },
    { id: 'branches', label: t.navigation.branches || 'Multi-Branch HQ', icon: GitFork, permission: true },
    { id: 'delivery', label: t.navigation.delivery || 'Delivery & Logistics', icon: Truck, permission: true },
    { id: 'pos', label: t.navigation.pos, icon: ShoppingCart, permission: permissions.canAccessPOS },
    { id: 'orders', label: t.navigation.orders, icon: Clock, permission: permissions.canAccessPOS || permissions.canAccessKitchen },
    { id: 'kitchen', label: t.navigation.kitchen, icon: ChefHat, permission: permissions.canAccessKitchen },
    { id: 'recipeEngine', label: t.navigation.recipeEngine || 'Recipe & Food Costing', icon: UtensilsCrossed, permission: true },
    { id: 'inventory', label: t.navigation.inventory, icon: Boxes, permission: permissions.canAccessInventory },
    { id: 'financials', label: t.navigation.financials, icon: Receipt, permission: permissions.canAccessFinancials },
    { id: 'customers', label: t.navigation.customers, icon: HeartHandshake, permission: permissions.canAccessCustomers ?? true },
    { id: 'staff', label: t.navigation.staff, icon: Users, permission: permissions.canAccessStaff },
    { id: 'users', label: t.navigation.users, icon: UserCog, permission: permissions.canManageUsers },
    { id: 'roleMatrix', label: t.navigation.roleMatrix, icon: ShieldCheck, permission: true },
    { id: 'reports', label: t.navigation.reports, icon: BarChart3, permission: permissions.canAccessReports },
    { id: 'ai-advisor', label: t.navigation.aiAdvisor, icon: Brain, permission: permissions.canAccessAIAdvisor },
    { id: 'ai-operations', label: t.navigation.aiOperations, icon: BrainCircuit, permission: permissions.canAccessAIAdvisor },
    { id: 'ai-ceo', label: t.navigation.aiCEO, icon: Bot, permission: permissions.canAccessAIAdvisor },
    { id: 'profile', label: t.navigation.profile, icon: UserCheck, permission: true },
    { id: 'settings', label: t.navigation.settings, icon: Settings, permission: permissions.canManageBranchSettings },
    { id: 'diagnostics', label: 'System Diagnostics', icon: Activity, permission: permissions.canManageBranchSettings }
  ];

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
  };

  const content = (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">
            ERP PHASE 2 PORTAL
          </span>
          <span className="text-xs text-slate-400 font-medium">Enterprise Access</span>
        </div>
        <button onClick={onCloseMobile} className="lg:hidden text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="p-3 space-y-1 flex-1">
        {navItems
          .filter((item) => item.permission)
          .map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectView(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
      </nav>

      {/* User Info & Logout Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60 space-y-2">
        <div className="flex items-center gap-3 p-2 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
            {userRecord?.displayName ? userRecord.displayName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-xs font-bold text-white truncate">
              {userRecord?.displayName || user?.displayName || 'Enterprise User'}
            </p>
            <p className="text-[10px] text-emerald-400 font-semibold truncate capitalize">
              {t.roles[role as keyof typeof t.roles] || role}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 font-bold text-xs transition cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{t.actions.logout}</span>
        </button>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">{t.actions.logout}</h3>
            <p className="text-xs text-slate-400">{t.auth.logoutConfirm}</p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                {t.actions.cancel}
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-bold"
              >
                {t.actions.logout}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block h-screen sticky top-0">{content}</div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onCloseMobile} />
          <div className="relative z-10 w-64 h-full">{content}</div>
        </div>
      )}
    </>
  );
};
