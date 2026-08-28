import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  InventoryItem,
  InventoryMovement,
  PurchaseOrder,
  Supplier,
  SupplierPayment,
  InventoryAlert
} from '../../../domain/entities/inventory';
import { InventoryRepositoryImpl } from '../../../data/repositories/InventoryRepositoryImpl';
import { InventoryController } from '../../../controllers/InventoryController';
import { InventoryLang, inventoryDict } from './translations';
import { InventoryDashboard } from './InventoryDashboard';
import { InventoryListView } from './InventoryListView';
import { StockMovementView } from './StockMovementView';
import { PurchaseOrdersView } from './PurchaseOrdersView';
import { GoodsReceivingView } from './GoodsReceivingView';
import { SupplierListView } from './SupplierListView';
import { InventoryReportsView } from './InventoryReportsView';

import {
  LayoutDashboard,
  Package,
  Clock,
  ShoppingBag,
  Truck,
  Users,
  BarChart3,
  Globe,
  Bell,
  X,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

interface InventoryManagementSystemProps {
  userRole?: string;
  userBranch?: string;
}

export const InventoryManagementSystem: React.FC<InventoryManagementSystemProps> = ({
  userRole = 'Admin',
  userBranch = 'Main Branch'
}) => {
  const { language, userRecord, role } = useAuth();
  // Controller instantiation
  const controller = useMemo(() => new InventoryController(new InventoryRepositoryImpl()), []);

  const effectiveRole = String(role || userRecord?.role || userRole || '').toLowerCase().trim();
  const rawUserBranch = userRecord?.branchId || (userRecord as any)?.branch || userBranch;
  const isHqUser = effectiveRole === 'owner' || (effectiveRole === 'admin' && (!rawUserBranch || rawUserBranch === 'all'));
  const effectiveBranchId = isHqUser ? undefined : rawUserBranch;

  // Language state
  const currentLang = (language || 'en') as InventoryLang;
  const [lang, setLang] = useState<InventoryLang>(currentLang);

  useEffect(() => {
    setLang(currentLang);
  }, [currentLang]);

  const t = inventoryDict[lang] || inventoryDict.en;
  const isRtl = lang === 'ar';

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'list' | 'movements' | 'purchases' | 'receiving' | 'suppliers' | 'reports'
  >('dashboard');

  // Firestore Subscriptions State
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Quick Movement Modal
  const [quickMovType, setQuickMovType] = useState<
    'stock_in' | 'stock_out' | 'adjustment' | 'transfer' | 'waste' | null
  >(null);

  // Selected PO for Receiving
  const [selectedReceivingPOId, setSelectedReceivingPOId] = useState<string | undefined>(undefined);

  // Live Subscriptions on Mount
  useEffect(() => {
    const unsubItems = controller.subscribeInventoryItems(setItems, effectiveBranchId);
    const unsubMovements = controller.subscribeMovements(setMovements, effectiveBranchId);
    const unsubPOs = controller.subscribePurchaseOrders(setPurchaseOrders, effectiveBranchId);
    const unsubSuppliers = controller.subscribeSuppliers(setSuppliers, effectiveBranchId);

    return () => {
      unsubItems();
      unsubMovements();
      unsubPOs();
      unsubSuppliers();
    };
  }, [controller, effectiveBranchId]);

  // Compute Alerts
  const alerts = useMemo(
    () => controller.getAlerts(items, purchaseOrders, suppliers),
    [controller, items, purchaseOrders, suppliers]
  );

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-slate-950 text-white font-sans p-4 md:p-8 space-y-6"
    >
      
      {/* Top Header & Navigation Bar */}
      <header className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          {/* Brand & Subtitle */}
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-tight">{t.inventoryTitle}</h1>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono font-bold">
                  Phase 7 • {userBranch}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{t.inventorySubtitle}</p>
            </div>
          </div>

          {/* Right Controls: Role Badge & Language Switcher */}
          <div className="flex items-center gap-3 self-end lg:self-center">
            
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold">{userRole} Access</span>
            </div>

            {/* Language Dropdown */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-2xl text-xs">
              <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
              <button
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer ${
                  lang === 'en' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang('ar')}
                className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer ${
                  lang === 'ar' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                عربي
              </button>
              <button
                onClick={() => setLang('so')}
                className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer ${
                  lang === 'so' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                SO
              </button>
            </div>

          </div>

        </div>

        {/* Tab Navigation Menu */}
        <nav className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-800/80 no-scrollbar">
          
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'dashboard'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> {t.dashboardTab}
          </button>

          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'list'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Package className="w-4 h-4" /> {t.inventoryListTab}
            <span className="px-1.5 py-0.2 bg-slate-800 text-amber-400 rounded-full text-[10px] font-mono">
              {items.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('movements')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'movements'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-4 h-4" /> {t.stockMovementTab}
          </button>

          <button
            onClick={() => setActiveTab('purchases')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'purchases'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> {t.purchaseOrdersTab}
          </button>

          <button
            onClick={() => setActiveTab('receiving')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'receiving'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Truck className="w-4 h-4" /> {t.goodsReceivingTab}
          </button>

          <button
            onClick={() => setActiveTab('suppliers')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'suppliers'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" /> {t.suppliersTab}
            <span className="px-1.5 py-0.2 bg-slate-800 text-cyan-400 rounded-full text-[10px] font-mono">
              {suppliers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'reports'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" /> {t.reportsTab}
          </button>

        </nav>

      </header>

      {/* Main Content Area */}
      <main>
        {activeTab === 'dashboard' && (
          <InventoryDashboard
            items={items}
            movements={movements}
            purchaseOrders={purchaseOrders}
            suppliers={suppliers}
            alerts={alerts}
            lang={lang}
            userRole={userRole}
            onOpenQuickMovement={(type) => {
              setQuickMovType(type);
              setActiveTab('movements');
            }}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
          />
        )}

        {activeTab === 'list' && (
          <InventoryListView
            items={items}
            lang={lang}
            userRole={userRole}
            onAddItem={async (item) => { await controller.addInventoryItem(item); }}
            onUpdateItem={async (id, item) => { await controller.updateInventoryItem(id, item); }}
            onDeleteItem={async (id) => { await controller.deleteInventoryItem(id); }}
            onQuickAdjust={async (itemId, newQty, reason) => {
              await controller.performStockAdjustment(itemId, newQty, reason, 'Inventory Manager');
            }}
          />
        )}

        {activeTab === 'movements' && (
          <StockMovementView
            movements={movements}
            items={items}
            lang={lang}
            userRole={userRole}
            onRecordMovement={async (m) => { await controller.recordStockMovement(m); }}
            initialMovementType={quickMovType || undefined}
          />
        )}

        {activeTab === 'purchases' && (
          <PurchaseOrdersView
            purchaseOrders={purchaseOrders}
            suppliers={suppliers}
            inventoryItems={items}
            lang={lang}
            userRole={userRole}
            onCreatePO={async (po) => { await controller.createPurchaseOrder(po); }}
            onApprovePO={async (id, approvedBy) => { await controller.approvePurchaseOrder(id, approvedBy); }}
            onNavigateToReceiving={(poId) => {
              setSelectedReceivingPOId(poId);
              setActiveTab('receiving');
            }}
          />
        )}

        {activeTab === 'receiving' && (
          <GoodsReceivingView
            purchaseOrders={purchaseOrders}
            inventoryItems={items}
            lang={lang}
            selectedPOId={selectedReceivingPOId}
            onReceiveGoods={async (poId, receivedItems, receivedBy) => {
              await controller.receiveGoods(poId, receivedItems, receivedBy);
            }}
          />
        )}

        {activeTab === 'suppliers' && (
          <SupplierListView
            suppliers={suppliers}
            lang={lang}
            userRole={userRole}
            onAddSupplier={async (s) => { await controller.addSupplier(s); }}
            onUpdateSupplier={async (id, s) => { await controller.updateSupplier(id, s); }}
            onDeleteSupplier={async (id) => { await controller.deleteSupplier(id); }}
            onRecordPayment={async (p) => { await controller.recordSupplierPayment(p); }}
          />
        )}

        {activeTab === 'reports' && (
          <InventoryReportsView
            items={items}
            movements={movements}
            purchaseOrders={purchaseOrders}
            suppliers={suppliers}
            lang={lang}
          />
        )}
      </main>

    </div>
  );
};
