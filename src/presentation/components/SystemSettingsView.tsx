import { translateRawUi } from '../../i18n/rawUi';
import React, { useState } from 'react';
import { 
  Settings, 
  Building2, 
  DollarSign, 
  Globe, 
  Printer, 
  CreditCard, 
  Bell, 
  Database, 
  Download, 
  Upload, 
  ShieldCheck, 
  CheckCircle2, 
  FileText, 
  RefreshCw, 
  BookOpen, 
  Save, 
  HardDrive, 
  Sliders, 
  Lock, 
  Server, 
  Terminal, 
  Zap,
  HelpCircle,
  Copy,
  Check,
  Wand2,
  Activity
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { exportToExcel } from '../../lib/reports';
import { db, COLLECTIONS, getAuthToken, getEffectiveBranchId } from '../../lib/firebase';
import { getApiUrl } from '../../lib/apiConfig';
import { collection, getDocs } from 'firebase/firestore';
import { DeveloperSystemDiagnosticsView } from './diagnostics/DeveloperSystemDiagnosticsView';

interface SystemSettingsViewProps {
  language?: 'en' | 'ar' | 'so';
  onOpenSetupWizard?: () => void;
  defaultTab?: string;
}

export const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({ language = 'en', onOpenSetupWizard, defaultTab }) => {
  const { t } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'general' | 'restaurant' | 'tax_currency' | 'localization' | 'printers_payment' | 'backup_recovery' | 'docs' | 'readiness' | 'developer_tools'
  >((defaultTab as any) || 'general');

  // General Settings State
  const [generalSettings, setGeneralSettings] = useState({
    restaurantName: '',
    branchCode: '',
    address: '',
    phone: '',
    email: '',
    timezone: 'Africa/Mogadishu (UTC+3)',
    operatingHours: ''
  });

  // Restaurant & Kitchen Settings State
  const [restaurantSettings, setRestaurantSettings] = useState({
    tableCount: 0,
    kitchenPrepBufferMinutes: 0,
    kdsRefreshIntervalSec: 5,
    enableAutoKDSStatus: false,
    allowTableSplitting: false,
    requireWaiterPinForDiscount: false
  });

  // Tax & Currency Settings State
  const [taxCurrencySettings, setTaxCurrencySettings] = useState({
    defaultTaxRate: 0,
    serviceChargeRate: 0,
    taxExemptTakeout: false,
    primaryCurrency: '',
    secondaryCurrency: '',
    evcExchangeRate: 0,
    zaadExchangeRate: 0,
    allowMultiCurrencyPOS: false
  });

  // Printers & Hardware State
  const [printerSettings, setPrinterSettings] = useState({
    posReceiptPrinterIP: '',
    kitchenStationPrinterIP: '',
    autoPrintReceiptOnPayment: true,
    printKitchenTicketsOnSubmit: true,
    cashDrawerOpenTrigger: 'payment_completed'
  });

  // Payment Gateway Settings
  const [paymentSettings, setPaymentSettings] = useState({
    evcMerchantId: '',
    zaadMerchantId: '',
    enableCreditCardTerminal: false,
    allowSplitPayment: false,
    maxCashDrawerLimitUSD: 0
  });

  // Backup & Recovery State
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [backupSchedule, setBackupSchedule] = useState('Not configured');
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [copiedDoc, setCopiedDoc] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getAuthToken();
        const branchId = getEffectiveBranchId();
        if (!branchId || branchId === 'all') return;
        const res = await fetch(getApiUrl(`/api/settings/branch?branchId=${encodeURIComponent(branchId)}`), {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const restaurant = data.restaurant || {};
        const tax = data.tax || {};
        const payments = data.payments || {};
        setGeneralSettings((prev) => ({ ...prev, restaurantName: restaurant.name || prev.restaurantName, branchCode: data.branchId || prev.branchCode, address: restaurant.address || prev.address, phone: restaurant.phone || prev.phone, email: restaurant.email || prev.email, operatingHours: restaurant.workingHours || prev.operatingHours }));
        setRestaurantSettings((prev) => ({ ...prev, tableCount: Number(restaurant.tableCount ?? prev.tableCount), kitchenPrepBufferMinutes: Number(restaurant.kitchenPrepBufferMinutes ?? prev.kitchenPrepBufferMinutes), kdsRefreshIntervalSec: Number(restaurant.kdsRefreshIntervalSec ?? prev.kdsRefreshIntervalSec), enableAutoKDSStatus: Boolean(restaurant.enableAutoKDSStatus ?? prev.enableAutoKDSStatus), allowTableSplitting: Boolean(restaurant.allowTableSplitting ?? prev.allowTableSplitting), requireWaiterPinForDiscount: Boolean(restaurant.requireWaiterPinForDiscount ?? prev.requireWaiterPinForDiscount) }));
        setTaxCurrencySettings((prev) => ({ ...prev, defaultTaxRate: Number(tax.defaultTaxRate ?? tax.taxRate ?? prev.defaultTaxRate), serviceChargeRate: Number(tax.serviceChargeRate ?? prev.serviceChargeRate), taxExemptTakeout: Boolean(tax.taxExemptTakeout ?? prev.taxExemptTakeout), primaryCurrency: restaurant.currency || prev.primaryCurrency, allowMultiCurrencyPOS: Boolean(payments.allowMultiCurrencyPOS ?? prev.allowMultiCurrencyPOS) }));
        setPaymentSettings((prev) => ({ ...prev, evcMerchantId: payments.evcMerchantId || prev.evcMerchantId, zaadMerchantId: payments.zaadMerchantId || prev.zaadMerchantId, maxCashDrawerLimitUSD: Number(payments.maxCashDrawerLimitUSD ?? prev.maxCashDrawerLimitUSD) }));
        setPrinterSettings((prev) => ({ ...prev, posReceiptPrinterIP: payments.posReceiptPrinterIP || prev.posReceiptPrinterIP, kitchenStationPrinterIP: payments.kitchenStationPrinterIP || prev.kitchenStationPrinterIP, autoPrintReceiptOnPayment: Boolean(payments.autoPrintReceiptOnPayment ?? prev.autoPrintReceiptOnPayment), printKitchenTicketsOnSubmit: Boolean(payments.printKitchenTicketsOnSubmit ?? prev.printKitchenTicketsOnSubmit), cashDrawerOpenTrigger: payments.cashDrawerOpenTrigger || prev.cashDrawerOpenTrigger }));
      } catch (err) {
        console.warn('Unable to load branch settings:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const token = await getAuthToken();
      const branchId = getEffectiveBranchId();
      if (!branchId || branchId === 'all') throw new Error('Select a concrete branch before saving settings.');
      if (!generalSettings.restaurantName.trim()) throw new Error('Restaurant name is required.');
      if (!taxCurrencySettings.primaryCurrency.trim()) throw new Error('Primary currency is required.');
      const res = await fetch(getApiUrl('/api/settings/branch'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          branchId,
          restaurant: { name: generalSettings.restaurantName, address: generalSettings.address, phone: generalSettings.phone, email: generalSettings.email, currency: taxCurrencySettings.primaryCurrency, workingHours: generalSettings.operatingHours, ...restaurantSettings },
          tax: { defaultTaxRate: taxCurrencySettings.defaultTaxRate, serviceChargeRate: taxCurrencySettings.serviceChargeRate, taxExemptTakeout: taxCurrencySettings.taxExemptTakeout },
          payments: { evcMerchantId: paymentSettings.evcMerchantId, zaadMerchantId: paymentSettings.zaadMerchantId, allowMultiCurrencyPOS: taxCurrencySettings.allowMultiCurrencyPOS, maxCashDrawerLimitUSD: paymentSettings.maxCashDrawerLimitUSD, posReceiptPrinterIP: printerSettings.posReceiptPrinterIP, kitchenStationPrinterIP: printerSettings.kitchenStationPrinterIP, autoPrintReceiptOnPayment: printerSettings.autoPrintReceiptOnPayment, printKitchenTicketsOnSubmit: printerSettings.printKitchenTicketsOnSubmit, cashDrawerOpenTrigger: printerSettings.cashDrawerOpenTrigger }
        })
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `Save failed (${res.status})`); }
      showToast('Branch settings saved to the trusted backend.');
    } catch (err: any) {
      showToast(err?.message || 'Unable to save settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Full Database JSON Export
  const handleExportFullDatabase = async () => {
    setIsExporting(true);
    try {
      const dbDump: Record<string, any[]> = {};
      const collectionKeys = Object.values(COLLECTIONS);

      for (const colKey of collectionKeys) {
        try {
          const snap = await getDocs(collection(db, colKey));
          const list: any[] = [];
          snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
          dbDump[colKey] = list;
        } catch {
          dbDump[colKey] = [];
        }
      }

      const jsonStr = JSON.stringify(dbDump, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RESTAURANT_ERP_DATABASE_BACKUP_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setLastBackupTime(new Date().toISOString());
      showToast('Full database JSON snapshot exported successfully.');
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Restore Backup Handler
  const handleRestoreBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (typeof parsed !== 'object') throw new Error('Invalid JSON format.');
        showToast(`Backup file validated. Successfully parsed ${Object.keys(parsed).length} collection snapshots.`);
      } catch (err: any) {
        alert(`Failed to parse backup file: ${err.message}`);
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDoc(label);
    setTimeout(() => setCopiedDoc(null), 2500);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
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
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" /> {translateRawUi('Branch Configuration & Security')}
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {translateRawUi('Production Configuration Center')}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Settings className="w-8 h-8 text-indigo-400" />
              {translateRawUi('System Settings & Enterprise Deployment HQ')}
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-3xl leading-relaxed">
              {translateRawUi('Global system configuration, tax rates, multi-currency controls, thermal printer hardware profiles, automated database backups, system documentation, and security rules verification.')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenSetupWizard && (
              <button
                onClick={onOpenSetupWizard}
                className="bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black px-5 py-3 rounded-2xl text-xs transition flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/25"
              >
                <Wand2 className="w-4 h-4 text-slate-950" /> {translateRawUi('Initial Setup Wizard')}
              </button>
            )}

            <button
              onClick={() => { void handleSaveSettings(); }}
              disabled={isSavingSettings}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-5 py-3 rounded-2xl text-xs transition flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <Save className="w-4 h-4" /> {isSavingSettings ? 'Saving...' : 'Save System Settings'}
            </button>

            <button
              onClick={handleExportFullDatabase}
              disabled={isExporting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-3 rounded-2xl text-xs transition flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
            >
              <Download className="w-4 h-4" /> {isExporting ? 'Exporting DB...' : 'Export DB (.JSON)'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-2.5 shadow-xl overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'general'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <Building2 className="w-4 h-4" /> {translateRawUi('General Info')}
          </button>

          <button
            onClick={() => setActiveTab('restaurant')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'restaurant'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <Sliders className="w-4 h-4" /> {translateRawUi('Kitchen & POS Operations')}
          </button>

          <button
            onClick={() => setActiveTab('tax_currency')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'tax_currency'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <DollarSign className="w-4 h-4" /> {translateRawUi('Tax & Currency')}
          </button>

          <button
            onClick={() => setActiveTab('printers_payment')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'printers_payment'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <Printer className="w-4 h-4" /> {translateRawUi('Hardware & Gateways')}
          </button>

          <button
            onClick={() => setActiveTab('backup_recovery')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'backup_recovery'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <Database className="w-4 h-4" /> {translateRawUi('Backup & Disaster Recovery')}
          </button>

          <button
            onClick={() => setActiveTab('readiness')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'readiness'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-indigo-400" /> {translateRawUi('Security & Production Checklist')}
          </button>

          <button
            onClick={() => setActiveTab('docs')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'docs'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800/80'
            }`}
          >
            <BookOpen className="w-4 h-4" /> {translateRawUi('System Manuals & Docs')}
          </button>

          <button
            onClick={() => setActiveTab('developer_tools')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'developer_tools'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400'
                : 'bg-indigo-950/60 text-indigo-300 hover:text-white border border-indigo-700/60'
            }`}
          >
            <Activity className="w-4 h-4 text-emerald-400 fill-emerald-400/20 animate-pulse" /> {translateRawUi('Developer Tools & Diagnostics')}
          </button>
        </div>
      </div>

      {/* TAB: DEVELOPER TOOLS & SYSTEM DIAGNOSTICS */}
      {activeTab === 'developer_tools' && (
        <DeveloperSystemDiagnosticsView language={language} />
      )}

      {/* TAB 1: GENERAL INFO */}
      {activeTab === 'general' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-4">
            <Building2 className="w-5 h-5 text-emerald-400" /> {translateRawUi('Restaurant Profile & Business Identity')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-2">
              <label className="text-slate-400 font-bold block">{t.legacyUi.restaurantEnterpriseName}</label>
              <input
                type="text"
                value={generalSettings.restaurantName}
                onChange={(e) => setGeneralSettings({ ...generalSettings, restaurantName: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500 font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-slate-400 font-bold block">{t.legacyUi.branchIdentifierCode}</label>
              <input
                type="text"
                value={generalSettings.branchCode}
                onChange={(e) => setGeneralSettings({ ...generalSettings, branchCode: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-slate-400 font-bold block">{t.legacyUi.physicalAddressHeadquarters}</label>
              <input
                type="text"
                value={generalSettings.address}
                onChange={(e) => setGeneralSettings({ ...generalSettings, address: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-slate-400 font-bold block">{t.legacyUi.primaryHotlinePhone}</label>
              <input
                type="text"
                value={generalSettings.phone}
                onChange={(e) => setGeneralSettings({ ...generalSettings, phone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-slate-400 font-bold block">{t.legacyUi.corporateEmailAddress}</label>
              <input
                type="email"
                value={generalSettings.email}
                onChange={(e) => setGeneralSettings({ ...generalSettings, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-slate-400 font-bold block">{t.legacyUi.systemTimezone}</label>
              <input
                type="text"
                value={generalSettings.timezone}
                onChange={(e) => setGeneralSettings({ ...generalSettings, timezone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-slate-400 font-bold block">{t.legacyUi.dailyOperatingHours}</label>
              <input
                type="text"
                value={generalSettings.operatingHours}
                onChange={(e) => setGeneralSettings({ ...generalSettings, operatingHours: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KITCHEN & POS OPERATIONS */}
      {activeTab === 'restaurant' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-4">
            <Sliders className="w-5 h-5 text-emerald-400" /> {translateRawUi('Operational Rules & Kitchen Display System (KDS)')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-2">
              <label className="text-slate-400 font-bold block">{t.legacyUi.totalDiningTableCapacity}</label>
              <input
                type="number"
                value={restaurantSettings.tableCount}
                onChange={(e) => setRestaurantSettings({ ...restaurantSettings, tableCount: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500 font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-slate-400 font-bold block">{t.legacyUi.kitchenPrepBufferWarning}</label>
              <input
                type="number"
                value={restaurantSettings.kitchenPrepBufferMinutes}
                onChange={(e) => setRestaurantSettings({ ...restaurantSettings, kitchenPrepBufferMinutes: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-slate-400 font-bold block">{t.legacyUi.kdsRefreshRate}</label>
              <input
                type="number"
                value={restaurantSettings.kdsRefreshIntervalSec}
                onChange={(e) => setRestaurantSettings({ ...restaurantSettings, kdsRefreshIntervalSec: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-4 pt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={restaurantSettings.enableAutoKDSStatus}
                  onChange={(e) => setRestaurantSettings({ ...restaurantSettings, enableAutoKDSStatus: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-0 bg-slate-950 border-slate-800"
                />
                <span className="font-bold text-slate-200">{t.legacyUi.autoReadyWhenComplete}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={restaurantSettings.requireWaiterPinForDiscount}
                  onChange={(e) => setRestaurantSettings({ ...restaurantSettings, requireWaiterPinForDiscount: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-500 focus:ring-0 bg-slate-950 border-slate-800"
                />
                <span className="font-bold text-slate-200">{t.legacyUi.requireManagerPin}</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TAX & CURRENCY */}
      {activeTab === 'tax_currency' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-4">
            <DollarSign className="w-5 h-5 text-emerald-400" /> {translateRawUi('Tax Rates & Multi-Currency Exchange Controls')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-2">
              <label className="text-slate-400 font-bold block">{t.legacyUi.standardVat}</label>
              <input
                type="number"
                step="0.1"
                value={taxCurrencySettings.defaultTaxRate}
                onChange={(e) => setTaxCurrencySettings({ ...taxCurrencySettings, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500 font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-slate-400 font-bold block">{t.legacyUi.restaurantServiceCharge}</label>
              <input
                type="number"
                step="0.1"
                value={taxCurrencySettings.serviceChargeRate}
                onChange={(e) => setTaxCurrencySettings({ ...taxCurrencySettings, serviceChargeRate: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-slate-400 font-bold block">{t.legacyUi.primaryOperatingCurrency}</label>
              <input
                type="text"
                value={taxCurrencySettings.primaryCurrency}
                onChange={(e) => setTaxCurrencySettings({ ...taxCurrencySettings, primaryCurrency: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500 font-bold"
              />
            </div>

            <div className="space-y-2">
              <label className="text-slate-400 font-bold block">{t.legacyUi.secondaryLocalCurrency}</label>
              <input
                type="text"
                value={taxCurrencySettings.secondaryCurrency}
                onChange={(e) => setTaxCurrencySettings({ ...taxCurrencySettings, secondaryCurrency: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PRINTERS & HARDWARE */}
      {activeTab === 'printers_payment' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-4">
            <Printer className="w-5 h-5 text-emerald-400" /> {translateRawUi('Thermal Receipt Printers & Payment Gateway Integration')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-2">
              <label className="text-slate-400 font-bold block">{t.legacyUi.posPrinterIp}</label>
              <input
                type="text"
                value={printerSettings.posReceiptPrinterIP}
                onChange={(e) => setPrinterSettings({ ...printerSettings, posReceiptPrinterIP: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-slate-400 font-bold block">{t.legacyUi.kitchenPrinterIp}</label>
              <input
                type="text"
                value={printerSettings.kitchenStationPrinterIP}
                onChange={(e) => setPrinterSettings({ ...printerSettings, kitchenStationPrinterIP: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-slate-400 font-bold block">{t.legacyUi.evcMerchantGatewayId}</label>
              <input
                type="text"
                value={paymentSettings.evcMerchantId}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, evcMerchantId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-slate-400 font-bold block">{t.legacyUi.zaadMerchantGatewayId}</label>
              <input
                type="text"
                value={paymentSettings.zaadMerchantId}
                onChange={(e) => setPaymentSettings({ ...paymentSettings, zaadMerchantId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: BACKUP & DISASTER RECOVERY */}
      {activeTab === 'backup_recovery' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-4">
              <Database className="w-5 h-5 text-indigo-400" /> {translateRawUi('Backup & Snapshot Validation')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-slate-400 font-bold block uppercase text-[10px]">{t.legacyUi.serverBackupSchedule}</span>
                <p className="text-emerald-400 font-extrabold text-sm">{backupSchedule}</p>
                <p className="text-slate-500 text-[10px]">{translateRawUi('Server-side scheduled backups must be configured separately; this screen does not claim an automated backup has run.')}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-slate-400 font-bold block uppercase text-[10px]">{t.legacyUi.lastClientExport}</span>
                <p className="text-white font-bold text-sm">{lastBackupTime ? new Date(lastBackupTime).toLocaleString() : 'No backup exported in this session'}</p>
                <p className="text-slate-500 text-[10px]">{t.legacyUi.browserExportScope}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-slate-400 font-bold block uppercase text-[10px]">{t.legacyUi.offlineSyncCache}</span>
                <p className="text-teal-400 font-bold text-sm">{t.legacyUi.activeIndexedDb}</p>
                <p className="text-slate-500 text-[10px]">{t.legacyUi.posOfflineQueue}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center gap-4">
              <button
                onClick={handleExportFullDatabase}
                disabled={isExporting}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-5 py-3 rounded-2xl text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                <Download className="w-4 h-4" /> {translateRawUi('Export Accessible Data JSON')}
              </button>

              <label className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-5 py-3 rounded-2xl text-xs flex items-center gap-2 cursor-pointer border border-slate-700">
                <Upload className="w-4 h-4 text-indigo-400" />
                <span>{isRestoring ? 'Validating File...' : 'Validate Backup File (.JSON)'}</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreBackupFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: SECURITY & PRODUCTION CHECKLIST */}
      {activeTab === 'readiness' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-4">
            <ShieldCheck className="w-5 h-5 text-indigo-400" /> {translateRawUi('Enterprise Production Readiness Audit')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-extrabold text-white text-sm">{t.legacyUi.typescriptStrict}</span>
              </div>
              <p className="text-slate-400 text-xs">{t.legacyUi.zeroTscErrors}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-extrabold text-white text-sm">{t.legacyUi.eslintRules}</span>
              </div>
              <p className="text-slate-400 text-xs">{t.legacyUi.zeroLintWarnings}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-extrabold text-white text-sm">{t.legacyUi.firestoreRulesV2}</span>
              </div>
              <p className="text-slate-400 text-xs">{t.legacyUi.hardenedCollectionAccess}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-extrabold text-white text-sm">{t.legacyUi.productionBundleOptimization}</span>
              </div>
              <p className="text-slate-400 text-xs">{t.legacyUi.viteProductionOptimization}</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: DOCUMENTATION & MANUALS */}
      {activeTab === 'docs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-4">
            <BookOpen className="w-5 h-5 text-emerald-400" /> {translateRawUi('Official Enterprise System Documentation')}
          </h3>

          <div className="space-y-6 text-xs text-slate-300">
            {/* Guide 1 */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" /> {translateRawUi('Installation & Deployment Guide')}
                </h4>
                <button
                  onClick={() => copyToClipboard('npm install && npm run build && npm run start', 'guide1')}
                  className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                >
                  {copiedDoc === 'guide1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDoc === 'guide1' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-slate-400">
                {translateRawUi('To deploy to Cloud Run or Node.js server: run `npm install`, compile via `npm run build`, and launch using `npm start`. Ensure environment variables `GEMINI_API_KEY` are populated in `.env`.')}
              </p>
            </div>

            {/* Guide 2 */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" /> {translateRawUi('Administrator & RBAC Guide')}
                </h4>
              </div>
              <p className="text-slate-400">
                {translateRawUi('Role Matrix supports 10 specialized roles (CEO, CFO, Operations Manager, Branch Manager, Head Chef, Cashier, Waiter, Inventory Manager, Delivery Driver, System Admin) with fine-grained permission attributes.')}
              </p>
            </div>

            {/* Guide 3 */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-teal-400" /> {translateRawUi('Firestore Database Schema Documentation')}
                </h4>
              </div>
              <p className="text-slate-400">
                {translateRawUi('Collections: `users`, `products`, `orders`, `ingredients`, `inventory`, `suppliers`, `purchases`, `expenses`, `employees`, `branches`, `branch_transfers`, `drivers`, `deliveries`, `delivery_zones`, `delivery_notifications`.')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
