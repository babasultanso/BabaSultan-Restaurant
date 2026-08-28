import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import { getApiUrl } from '../../lib/apiConfig';
import { useAuth } from '../context/AuthContext';
import { USER_ROLES, UserRole, LANGUAGES, SupportedLanguage } from '../../constants';
import {
  Globe,
  UserCheck,
  Moon,
  Sun,
  Bell,
  Shield,
  Menu as MenuIcon,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Info,
  X,
  Wand2
} from 'lucide-react';

interface HeaderProps {
  onMobileMenuToggle: () => void;
  onOpenSetupWizard?: () => void;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'warning' | 'info' | 'success';
  read: boolean;
  recipientId?: string;
  branchId?: string;
}

export const Header: React.FC<HeaderProps> = ({ onMobileMenuToggle, onOpenSetupWizard }) => {
  const { user, userRecord, role, language, setLanguage, themeMode, toggleTheme, logout, t } = useAuth();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!user) return;

    const isManagementRole = ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager'].includes(userRecord?.role || role || '');
    let q;
    if (isManagementRole) {
      if (userRecord?.branchId && !['Owner', 'Admin'].includes(userRecord?.role || '')) {
        q = query(
          collection(db, COLLECTIONS.NOTIFICATIONS),
          where('branchId', '==', userRecord.branchId)
        );
      } else {
        q = query(
          collection(db, COLLECTIONS.NOTIFICATIONS),
          orderBy('createdAt', 'desc'),
          limit(25)
        );
      }
    } else {
      q = query(
        collection(db, COLLECTIONS.NOTIFICATIONS),
        where('recipientId', '==', user.uid)
      );
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const items: NotificationItem[] = snapshot.docs.map(docSnap => {
        const d = docSnap.data();
        let notifType: 'warning' | 'info' | 'success' = 'info';
        if (d.priority === 'high' || d.type?.includes('STOCK') || d.type?.includes('CANCELLED')) {
          notifType = 'warning';
        } else if (d.type?.includes('COMPLETED') || d.type?.includes('ASSIGNED')) {
          notifType = 'success';
        }
        return {
          id: docSnap.id,
          title: d.title || 'System Notification',
          message: d.message || '',
          time: d.createdAt ? new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
          type: notifType,
          read: Boolean(d.read),
          recipientId: d.recipientId,
          branchId: d.branchId,
          createdAt: d.createdAt
        };
      }).filter(item => {
        if (!isManagementRole && item.recipientId && item.recipientId !== user.uid) return false;
        if (item.branchId && userRecord?.branchId && item.branchId !== userRecord.branchId && !['Owner', 'Admin'].includes(userRecord.role)) return false;
        return true;
      }).sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      setNotifications(items);
    }, (err) => {
      console.warn('Realtime notifications listener notice:', err?.message || err);
    });

    return () => unsub();
  }, [user, userRecord]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = async (notifId: string) => {
    try {
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
      const token = await user?.getIdToken();
      await fetch(getApiUrl(`/api/notifications/${notifId}/read`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const item of unread) {
      markRead(item.id);
    }
  };

  const removeNotification = (id: string) => {
    markRead(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <MenuIcon className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
            ERP
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-white tracking-wide">{t.appName}</h1>
            <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-widest">
              Commercial Edition
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Role Display */}
        <div className="relative">
          <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 rounded-xl px-2 sm:px-2.5 py-1.5 text-xs text-white cursor-default transition">
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-semibold text-[11px] sm:text-xs truncate max-w-[80px] sm:max-w-none">{t.roles[role as keyof typeof t.roles] || role}</span>
          </div>
        </div>

        {/* Language Selector */}
        <div className="relative group">
          <div className="flex items-center gap-1 bg-slate-800/90 border border-slate-700/80 rounded-xl px-2 sm:px-2.5 py-1.5 text-xs text-slate-300 hover:border-emerald-500/50 transition">
            <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold uppercase text-[11px] sm:text-xs">{language}</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-slate-900 text-white">
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Initial Setup Wizard Button */}
        {onOpenSetupWizard && (
          <button
            onClick={onOpenSetupWizard}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 hover:border-emerald-400 text-xs font-bold transition cursor-pointer shadow-sm shadow-emerald-500/10"
            title="Launch Guided 10-Step Setup Wizard"
          >
            <Wand2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Setup Wizard</span>
          </button>
        )}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:text-white hover:border-amber-500/50 transition cursor-pointer"
          title={`Switch to ${themeMode === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {themeMode === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-emerald-400" />}
        </button>

        {/* Notifications Button & Popover */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className="relative p-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:text-white hover:border-emerald-500/50 transition cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute ltr:right-0 ltr:left-auto rtl:left-0 rtl:right-auto mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">System Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[10px] text-slate-400 hover:text-amber-400 transition"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border text-xs relative transition ${
                      item.read
                        ? 'bg-slate-950/40 border-slate-800/60 text-slate-400'
                        : 'bg-slate-800/80 border-slate-700 text-slate-200'
                    }`}
                  >
                    <button
                      onClick={() => removeNotification(item.id)}
                      className="absolute top-2 right-2 text-slate-500 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>

                    <div className="flex items-start gap-2">
                      {item.type === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      ) : item.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      )}

                      <div className="space-y-0.5 pr-4">
                        <p className="font-bold text-white text-[11px]">{item.title}</p>
                        <p className="text-[10px] leading-relaxed">{item.message}</p>
                        <span className="text-[9px] text-slate-500 block pt-1 font-mono">{item.time}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {notifications.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No active notifications.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar Button & Menu Dropdown */}
        <div className="relative pl-2 border-l border-slate-800">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xs font-bold hover:border-emerald-400 transition cursor-pointer"
            title="User Profile Menu"
          >
            <UserCheck className="w-4 h-4" />
          </button>

          {showProfileMenu && (
            <div className="absolute ltr:right-0 ltr:left-auto rtl:left-0 rtl:right-auto mt-2 w-64 max-w-[calc(100vw-2rem)] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 p-4 space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-sm">
                  {userRecord?.displayName?.substring(0, 2).toUpperCase() || 'US'}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">
                    {userRecord?.displayName || 'Executive User'}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono truncate max-w-[140px]">
                    {user?.email || 'admin@restaurant-erp.internal'}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-bold border border-emerald-500/20">
                    {role} • Flagship Branch
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">System Status</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                </div>
              </div>

              <button
                onClick={logout}
                className="w-full p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
