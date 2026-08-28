import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Product, Order, Customer, SelectedOptionChoice, OrderType, DeliveryZone } from '../../types';
import { SYSTEM_CONFIG } from '../../constants';
import { CartItem, POSCheckoutPayload, ReceiptData } from '../../domain/entities/pos';
import { db, COLLECTIONS, createOrderFirestore, holdOrderFirestore, fetchHoldOrdersFirestore, fetchTablesFirestore, fetchCustomersFirestore } from '../../lib/firebase';
import { createDeliveryOrder } from '../../lib/deliveryService';
import { useAuth } from '../context/AuthContext';
import { calculateCartTotals } from '../../domain/services/posService';
import { ProductOptionModal } from './pos/ProductOptionModal';
import { CustomerModal } from './pos/CustomerModal';
import { HoldOrdersModal } from './pos/HoldOrdersModal';
import { PaymentModal } from './pos/PaymentModal';
import { ReceiptModal } from './pos/ReceiptModal';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  CreditCard,
  Utensils,
  X,
  Package,
  Clock,
  User,
  Tag,
  PauseCircle,
  UserCheck,
  Percent,
  SlidersHorizontal,
  Flame,
  Truck,
  Globe,
  Bookmark
} from 'lucide-react';

interface POSViewProps {
  products: Product[];
  onOrderCompleted?: () => void;
}

export const POSView: React.FC<POSViewProps> = ({ products, onOrderCompleted }) => {
  const { user, userRecord, role, t, language, loading: authLoading } = useAuth();

  // Check if current user has Owner / HQ authority (where backend permits explicit or all-branch access)
  const isHQUser = ['Owner', 'owner'].includes(role || '') || 
                   ['Owner', 'owner'].includes(userRecord?.role || '') || 
                   userRecord?.branchId === 'all';

  const currentBranchId = userRecord?.branchId || '';

  // Checkout is guarded until authenticated user, trusted user record, and branchId are loaded
  const isBranchLoaded = !authLoading && Boolean(user) && Boolean(userRecord) && (isHQUser || Boolean(userRecord?.branchId && userRecord.branchId.trim().length > 0));

  // Search & Category Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('dine_in');
  const [tableNumber, setTableNumber] = useState<string>('T-01');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Discount & Tax State (Starts in explicit loading state until authoritative tax config is retrieved)
  const [taxRatePercent, setTaxRatePercent] = useState<number | null>(null);
  const [isTaxLoading, setIsTaxLoading] = useState<boolean>(true);
  const [taxConfigError, setTaxConfigError] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');

  // Delivery configuration state
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [branchDeliveryFee, setBranchDeliveryFee] = useState<number | null>(null);

  // Modals
  const [activeProductForOption, setActiveProductForOption] = useState<Product | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState<boolean>(false);
  const [isHoldModalOpen, setIsHoldModalOpen] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [completedReceipt, setCompletedReceipt] = useState<ReceiptData | null>(null);

  // Held Orders Counter
  const [heldOrdersCount, setHeldOrdersCount] = useState<number>(0);

  // Refresh held orders count
  const refreshHoldCount = () => {
    fetchHoldOrdersFirestore()
      .then(res => setHeldOrdersCount(res.length))
      .catch(() => {});
  };

  useEffect(() => {
    refreshHoldCount();
  }, []);

  // Dynamically load delivery zones and branch delivery settings
  useEffect(() => {
    let isMounted = true;
    const loadDeliverySettings = async () => {
      try {
        const effectiveBranch = currentBranchId || 'branch_hq_01';
        
        // Load branch settings
        const branchSnap = await getDocs(query(collection(db, COLLECTIONS.BRANCHES)));
        if (!branchSnap.empty && isMounted) {
          const branches = branchSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
          const b = branches.find(br => br.id === effectiveBranch || br.code === effectiveBranch || br.id === 'branch_hq_01');
          if (b && typeof b.defaultDeliveryFee === 'number') {
            setBranchDeliveryFee(b.defaultDeliveryFee);
          } else if (b && typeof b.deliveryFee === 'number') {
            setBranchDeliveryFee(b.deliveryFee);
          }
        }

        // Load delivery zones
        const zonesSnap = await getDocs(query(collection(db, COLLECTIONS.DELIVERY_ZONES)));
        if (!zonesSnap.empty && isMounted) {
          const allZones = zonesSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as DeliveryZone));
          const filtered = isHQUser
            ? allZones
            : allZones.filter(z => z.branchId === effectiveBranch || z.branchId === 'branch_hq_01' || !z.branchId);
          setDeliveryZones(filtered);
        }
      } catch (err) {
        console.warn('Could not load delivery settings in POS:', err);
      }
    };
    loadDeliverySettings();
    return () => { isMounted = false; };
  }, [currentBranchId, isHQUser]);

  // Dynamically load active authoritative tax configuration for current branch
  useEffect(() => {
    let isMounted = true;
    const loadBranchTaxRate = async () => {
      setIsTaxLoading(true);
      setTaxConfigError(null);
      try {
        const effectiveBranch = isHQUser ? (currentBranchId || 'branch_hq_01') : (currentBranchId || 'branch_hq_01');

        // 1. First check branch document for tax configuration
        const branchSnap = await getDocs(query(collection(db, COLLECTIONS.BRANCHES)));
        if (!branchSnap.empty && isMounted) {
          const branches = branchSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
          const b = branches.find(br => br.id === effectiveBranch || br.code === effectiveBranch || br.id === 'branch_hq_01') || branches[0];
          
          if (b) {
            if (b.taxEnabled === false || b.taxEnabled === 'false') {
              if (isMounted) {
                setTaxRatePercent(0);
                setIsTaxLoading(false);
                setTaxConfigError(null);
              }
              return;
            }
            if (typeof b.taxRate === 'number' && Number.isFinite(b.taxRate)) {
              if (isMounted) {
                setTaxRatePercent(b.taxRate);
                setIsTaxLoading(false);
                setTaxConfigError(null);
              }
              return;
            }
          }
        }

        // 2. Next check taxes collection
        const taxesColl = collection(db, COLLECTIONS.TAXES);
        const snap = await getDocs(taxesColl);
        if (!snap.empty && isMounted) {
          const activeTaxes = snap.docs
            .map(d => d.data() as any)
            .filter(t => t.isActive !== false && t.status !== 'Inactive');

          let resolvedTax: any = null;

          if (isHQUser) {
            resolvedTax = activeTaxes.find(t => t.branchId === effectiveBranch) ||
                          activeTaxes.find(t => t.branchId === 'all' || !t.branchId || t.isDefault) ||
                          activeTaxes[0];
          } else if (currentBranchId) {
            resolvedTax = activeTaxes.find(t => t.branchId === currentBranchId) ||
                          activeTaxes.find(t => t.branchId === 'all' || !t.branchId || t.isDefault) ||
                          activeTaxes[0];
          }

          if (resolvedTax && typeof resolvedTax.rate === 'number' && Number.isFinite(resolvedTax.rate)) {
            if (isMounted) {
              setTaxRatePercent(resolvedTax.rate);
              setIsTaxLoading(false);
              setTaxConfigError(null);
            }
            return;
          }
        }

        // 3. Authoritative standard default tax rate (5%)
        if (isMounted) {
          setTaxRatePercent(5.0);
          setIsTaxLoading(false);
          setTaxConfigError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to load authoritative tax configuration:', err);
          // Fallback to standard 5% tax if network transient error
          setTaxRatePercent(5.0);
          setIsTaxLoading(false);
          setTaxConfigError(null);
        }
      }
    };
    loadBranchTaxRate();
    return () => { isMounted = false; };
  }, [currentBranchId, isHQUser]);

  // Categories list
  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  // Search & filter matching products
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const q = (searchQuery || '').toLowerCase();
    const matchesSearch =
      (p.name || '').toLowerCase().includes(q) ||
      (p.nameEn || '').toLowerCase().includes(q) ||
      (p.nameAr || '').toLowerCase().includes(q) ||
      (p.nameSo || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  // Calculate cart totals (using authoritative tax rate once loaded)
  const effectiveTaxRate = taxRatePercent ?? 0;
  const cartTotals = calculateCartTotals(cart, effectiveTaxRate, discountValue, discountType);

  // Product Click Handler
  const handleProductClick = (product: Product) => {
    if (product.stock <= 0 || product.availabilityStatus === 'out_of_stock' || product.availabilityStatus === 'disabled') {
      return;
    }

    // If product has options, open Option Selector Modal
    if (product.options && product.options.length > 0) {
      setActiveProductForOption(product);
    } else {
      // Add directly to cart
      setCart(prev => {
        const existing = prev.find(i => i.product.id === product.id && !i.selectedOptions?.length);
        if (existing) {
          if (existing.quantity >= product.stock) return prev;
          return prev.map(i =>
            i.product.id === product.id && !i.selectedOptions?.length
              ? { ...i, quantity: i.quantity + 1, totalPrice: (i.quantity + 1) * i.unitPrice }
              : i
          );
        }
        return [
          ...prev,
          {
            product,
            quantity: 1,
            unitPrice: product.price,
            totalPrice: product.price
          }
        ];
      });
    }
  };

  // Option Modal Confirm Callback
  const handleOptionConfirm = (
    product: Product,
    quantity: number,
    selectedOptions: SelectedOptionChoice[],
    itemNotes: string,
    calculatedUnitPrice: number
  ) => {
    setCart(prev => [
      ...prev,
      {
        product,
        quantity,
        selectedOptions,
        selectedNotes: itemNotes,
        unitPrice: calculatedUnitPrice,
        totalPrice: calculatedUnitPrice * quantity
      }
    ]);
    setActiveProductForOption(null);
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev =>
      prev
        .map((item, idx) => {
          if (idx === index) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.product.stock) return item;
            return {
              ...item,
              quantity: newQty,
              totalPrice: newQty * item.unitPrice
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, idx) => idx !== index));
  };

  // Hold / Park Order
  const handleHoldOrder = async () => {
    if (cart.length === 0) return;
    const holdName = prompt('Enter a reference label for this held order:', selectedCustomer ? selectedCustomer.name : `Table ${tableNumber}`);
    if (!holdName) return;

    try {
      await holdOrderFirestore({
        holdName,
        customerName: selectedCustomer?.name || 'Walk-in Customer',
        customerPhone: selectedCustomer?.phone || '',
        orderType,
        tableNumber: orderType === 'dine_in' ? tableNumber : '',
        items: cart.map(i => ({
          productId: i.product.id,
          productName: i.product.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          unitCost: typeof i.product.cost === 'number' ? i.product.cost : 0,
          totalPrice: i.totalPrice,
          selectedOptions: i.selectedOptions,
          notes: i.selectedNotes
        })),
        subtotal: cartTotals.subtotal,
        tax: cartTotals.tax,
        discountAmount: cartTotals.discountAmount,
        totalAmount: cartTotals.grandTotal,
        createdBy: user?.displayName || 'Cashier',
        createdAt: new Date().toISOString()
      });

      // Clear current cart
      setCart([]);
      setSelectedCustomer(null);
      refreshHoldCount();
      alert('Order successfully held/parked!');
    } catch (err: any) {
      alert(`Failed to hold order: ${err.message}`);
    }
  };

  // Resume Order Callback
  const handleResumeOrder = (heldOrder: any) => {
    const resumedCartItems: CartItem[] = heldOrder.items.map((i: any) => {
      const matchProd = products.find(p => p.id === i.productId) || {
        id: i.productId,
        name: i.productName,
        price: i.unitPrice,
        cost: i.unitCost,
        stock: 99,
        category: 'Main Course',
        availabilityStatus: 'enabled',
        salesCount: 0
      };
      return {
        product: matchProd as Product,
        quantity: i.quantity,
        selectedOptions: i.selectedOptions,
        selectedNotes: i.notes,
        unitPrice: i.unitPrice,
        totalPrice: i.totalPrice
      };
    });

    setCart(resumedCartItems);
    setOrderType(heldOrder.orderType || 'dine_in');
    if (heldOrder.tableNumber) setTableNumber(heldOrder.tableNumber);
    refreshHoldCount();
  };

  // Complete Payment Callback
  const handleConfirmPayment = async (payload: POSCheckoutPayload) => {
    // Strictly verify that branch user has a loaded branchId before submitting
    if (authLoading || !user || !userRecord || (!isHQUser && (!userRecord.branchId || userRecord.branchId.trim() === ''))) {
      alert('Your branch information is not loaded. Please refresh or sign in again.');
      return;
    }

    const timestamp = new Date().toISOString();
    const dateCode = new Date().toISOString().replace(/[-:T.]/g, '').slice(2, 10);
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${dateCode}-${randomSeq}`;

    const calculatedCOGS = cart.reduce((sum, item) => {
      const itemCost = (typeof item.product.cost === 'number' ? item.product.cost : 0) * item.quantity;
      return sum + itemCost;
    }, 0);

    const profit = payload.totalAmount - calculatedCOGS;
    const isDelivery = payload.orderType === 'delivery';

    try {
      const fullOrder = await createOrderFirestore({
        orderNumber,
        customerId: selectedCustomer?.id,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        customerAddress: payload.deliveryAddress || selectedCustomer?.address,
        orderType: payload.orderType,
        deliveryAddress: payload.deliveryAddress || selectedCustomer?.address,
        deliveryZoneId: payload.deliveryZoneId,
        deliveryZoneName: payload.deliveryZoneName,
        deliveryFee: payload.deliveryFee,
        tableNumber: payload.tableNumber,
        items: cart.map(i => ({
          productId: i.product.id,
          productName: i.product.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          unitCost: typeof i.product.cost === 'number' ? i.product.cost : 0,
          totalPrice: i.totalPrice,
          selectedOptions: i.selectedOptions,
          notes: i.selectedNotes
        })),
        subtotal: payload.subtotal,
        tax: payload.tax,
        discountAmount: payload.discount,
        totalAmount: payload.totalAmount,
        paidAmount: payload.totalAmount,
        paymentAmount: payload.totalAmount,
        amountTendered: payload.amountTendered || payload.totalAmount,
        changeDue: payload.changeDue || 0,
        cogs: calculatedCOGS,
        profit,
        employeeId: user?.uid || 'emp-pos',
        employeeName: user?.displayName || 'Senior Cashier',
        status: 'pending',
        deliveryStatus: isDelivery ? 'unassigned' : undefined,
        paymentMethod: payload.paymentMethod,
        paymentStatus: 'paid',
        branchId: userRecord?.branchId,
        branch: userRecord?.branch,
        createdAt: timestamp
      });

      // Server creates delivery record automatically when orderType === 'delivery'

      const receipt: ReceiptData = {
        orderId: fullOrder.id,
        orderNumber: fullOrder.orderNumber || orderNumber,
        timestamp,
        cashierName: user?.displayName || 'Cashier',
        orderType: payload.orderType,
        tableNumber: payload.tableNumber,
        customerName: payload.customerName,
        items: cart,
        subtotal: fullOrder.subtotal,
        tax: fullOrder.tax,
        discount: fullOrder.discountAmount,
        totalAmount: fullOrder.totalAmount,
        paymentMethod: payload.paymentMethod,
        amountTendered: payload.amountTendered,
        changeDue: payload.changeDue
      };

      setCompletedReceipt(receipt);
      setIsPaymentModalOpen(false);

      // Reset POS Cart
      setCart([]);
      setSelectedCustomer(null);
      setDiscountValue(0);

      if (onOrderCompleted) onOrderCompleted();
    } catch (err: any) {
      alert(`Payment / Order Error: ${err.message || 'Unable to complete order. Please check stock and details.'}`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* POS Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-emerald-400" />
            {t.pos.title}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t.pos.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Held Orders Button */}
          <button
            onClick={() => setIsHoldModalOpen(true)}
            className="px-4 py-2 rounded-2xl bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 border border-amber-500/30 text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-md"
          >
            <PauseCircle className="w-4 h-4" />
            <span>{t.pos.heldOrders} ({heldOrdersCount})</span>
          </button>

          {/* Cashier Badge */}
          <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-2 rounded-2xl border border-slate-800 text-xs text-slate-300">
            <User className="w-4 h-4 text-emerald-400" />
            <span>{t.pos.cashier}: <strong className="text-white">{user?.displayName || t.pos.cashier}</strong></span>
          </div>
        </div>
      </div>

      {/* POS Terminal Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Product Search, Category Tabs & Catalog Grid */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Search Bar & Categories */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder={t.pos.searchPlaceholder}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex overflow-x-auto gap-1.5 no-scrollbar py-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat === 'All' ? t.pos.allCategories : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Catalog Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.map(p => {
              const isOutOfStock = p.stock <= 0 || p.availabilityStatus === 'out_of_stock' || p.availabilityStatus === 'disabled';
              const itemsInCart = cart.filter(i => i.product.id === p.id);
              const totalCartQty = itemsInCart.reduce((s, i) => s + i.quantity, 0);

              return (
                <div
                  key={p.id}
                  onClick={() => handleProductClick(p)}
                  className={`bg-slate-900 border rounded-2xl p-4 transition flex flex-col justify-between relative cursor-pointer group ${
                    isOutOfStock
                      ? 'opacity-50 border-slate-800 cursor-not-allowed'
                      : totalCartQty > 0
                      ? 'border-emerald-500/80 bg-emerald-500/5 shadow-lg shadow-emerald-500/10'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-2">
                      <span className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                        {p.category}
                      </span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        isOutOfStock
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : p.stock <= (p.minStockAlert || 5)
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {isOutOfStock ? t.pos.outOfStock : `${p.stock} ${t.pos.leftInStock}`}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-white group-hover:text-emerald-400 transition line-clamp-1">
                      {language === 'ar' && p.nameAr ? p.nameAr : language === 'so' && p.nameSo ? p.nameSo : p.name}
                    </h4>
                    {p.nameAr && language !== 'ar' && <p className="text-[10px] text-slate-400 line-clamp-1">{p.nameAr}</p>}
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/60">
                    <span className="text-sm font-extrabold text-emerald-400">
                      ${(p.price || 0).toFixed(2)}
                    </span>
                    <button
                      disabled={isOutOfStock}
                      className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                        totalCartQty > 0
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-200 group-hover:bg-emerald-500 group-hover:text-slate-950'
                      }`}
                    >
                      {totalCartQty > 0 ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{totalCartQty}</span>
                        </>
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Right Column: Active Terminal Cart Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-2xl space-y-4">
          <div className="space-y-4">
            
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-400" />
                {t.pos.currentCart}
              </h3>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full font-bold border border-emerald-500/20">
                {cart.length} {t.pos.itemsCount}
              </span>
            </div>

            {/* Order Types Selector */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              {[
                { id: 'dine_in', label: t.pos.dineIn },
                { id: 'takeaway', label: t.pos.takeout },
                { id: 'delivery', label: t.pos.delivery },
                { id: 'online', label: t.pos.online },
                { id: 'reservation', label: t.pos.reserve }
              ].map(type => (
                <button
                  key={type.id}
                  onClick={() => setOrderType(type.id as OrderType)}
                  className={`py-1.5 rounded-xl text-[10px] font-bold transition cursor-pointer ${
                    orderType === type.id
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>

            {/* Customer & Table Selector Bar */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Customer selector */}
              <button
                onClick={() => setIsCustomerModalOpen(true)}
                className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 hover:border-slate-700 text-left transition cursor-pointer flex items-center justify-between group"
              >
                <div className="truncate">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">{t.pos.customerLabel}</span>
                  <span className="text-white font-bold truncate block group-hover:text-emerald-400">
                    {selectedCustomer ? selectedCustomer.name : t.pos.walkInGuest}
                  </span>
                </div>
                <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              </button>

              {/* Table selector (if Dine In) */}
              {orderType === 'dine_in' ? (
                <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">{t.pos.tableLabel}</span>
                    <select
                      value={tableNumber}
                      onChange={e => setTableNumber(e.target.value)}
                      className="bg-transparent text-emerald-400 font-extrabold focus:outline-none text-xs"
                    >
                      {['T-01', 'T-02', 'T-03', 'T-04', 'T-05', 'VIP-1', 'VIP-2', 'Patio-1'].map(tbl => (
                        <option key={tbl} value={tbl} className="bg-slate-900 text-white">{tbl}</option>
                      ))}
                    </select>
                  </div>
                  <Utensils className="w-4 h-4 text-emerald-400" />
                </div>
              ) : orderType === 'delivery' ? (
                <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-2xl flex items-center justify-between text-amber-400">
                  <div className="truncate pr-1">
                    <span className="text-[10px] text-amber-500 block uppercase font-bold">Delivery Address</span>
                    <span className="text-white text-[11px] font-bold truncate block">
                      {selectedCustomer?.address || 'Set in Checkout'}
                    </span>
                  </div>
                  <Truck className="w-4 h-4 shrink-0" />
                </div>
              ) : (
                <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 flex items-center justify-between opacity-60">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">{t.pos.noTableNeeded}</span>
                </div>
              )}
            </div>

            {/* Cart Items Scroll Container */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Package className="w-10 h-10 mx-auto text-slate-700" />
                  <p className="text-xs">{t.pos.cartEmpty}</p>
                  <p className="text-[10px] text-slate-600">{t.pos.selectDishes}</p>
                </div>
              ) : (
                cart.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs"
                  >
                    <div className="flex-1 pr-2">
                      <h5 className="font-bold text-white line-clamp-1">{item.product.name}</h5>
                      <span className="text-slate-400 text-[10px]">
                        ${(item.unitPrice || 0).toFixed(2)} × {item.quantity}
                      </span>
                      {item.selectedOptions && item.selectedOptions.length > 0 && (
                        <p className="text-[9px] text-emerald-400 font-semibold line-clamp-1">
                          + {item.selectedOptions.map(o => o.choiceName).join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-900 rounded-xl border border-slate-800 p-0.5">
                        <button
                          onClick={() => updateQuantity(idx, -1)}
                          className="p-1 hover:bg-slate-800 rounded-lg text-slate-300 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 font-bold text-emerald-400 text-xs">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(idx, 1)}
                          className="p-1 hover:bg-slate-800 rounded-lg text-slate-300 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="font-extrabold text-white w-14 text-right">
                        ${(item.totalPrice || 0).toFixed(2)}
                      </span>

                      <button
                        onClick={() => removeFromCart(idx)}
                        className="text-slate-500 hover:text-rose-400 transition p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Discount Control */}
            {cart.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1 font-semibold">
                    <Tag className="w-3.5 h-3.5 text-amber-400" /> {t.pos.applyDiscount}:
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="0"
                      value={discountValue || ''}
                      onChange={e => setDiscountValue(Number(e.target.value))}
                      className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-1 text-white font-bold text-xs text-right focus:outline-none focus:border-emerald-500"
                    />
                    <select
                      value={discountType}
                      onChange={e => setDiscountType(e.target.value as any)}
                      className="bg-slate-950 text-emerald-400 font-bold border border-slate-800 px-2 py-1 rounded-xl text-xs"
                    >
                      <option value="percentage">%</option>
                      <option value="fixed">$</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Cart Totals Summary & Action Buttons */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>{t.pos.subtotal}</span>
                <span className="text-white font-medium">${(cartTotals?.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>
                  {t.pos.vat}{' '}
                  {isTaxLoading ? (
                    <span className="text-slate-500 italic">(Loading...)</span>
                  ) : taxConfigError ? (
                    <span className="text-rose-400">(Config Error)</span>
                  ) : (
                    <span>({taxRatePercent}%)</span>
                  )}
                </span>
                <span className="text-white font-medium">${(cartTotals?.tax || 0).toFixed(2)}</span>
              </div>
              {(cartTotals?.discountAmount || 0) > 0 && (
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>{t.pos.discount}</span>
                  <span>-${(cartTotals?.discountAmount || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-800">
                <span>{t.pos.grandTotal}</span>
                <span className="text-emerald-400">${(cartTotals?.grandTotal || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Warning if tax configuration error */}
            {taxConfigError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-medium text-center">
                {taxConfigError}
              </div>
            )}

            {/* Warning if branch is missing for branch user */}
            {!authLoading && !isBranchLoaded && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-medium text-center">
                User branch is not loaded. Please refresh or sign in again.
              </div>
            )}

            {/* Action Row: Hold Order & Proceed to Payment */}
            <div className="grid grid-cols-3 gap-2">
              <button
                disabled={cart.length === 0}
                onClick={handleHoldOrder}
                className="bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-30 border border-amber-500/30 text-amber-400 font-bold py-3 rounded-2xl transition cursor-pointer text-xs flex items-center justify-center gap-1"
              >
                <Bookmark className="w-4 h-4" />
                <span>{t.pos.holdButton}</span>
              </button>

              <button
                disabled={cart.length === 0 || authLoading || !isBranchLoaded || isTaxLoading || Boolean(taxConfigError) || taxRatePercent === null}
                onClick={() => {
                  if (!isBranchLoaded) {
                    alert('Your branch information is not loaded. Please refresh or sign in again.');
                    return;
                  }
                  if (taxConfigError || taxRatePercent === null) {
                    alert('Cannot checkout without an active tax configuration. Please configure taxes in Settings.');
                    return;
                  }
                  setIsPaymentModalOpen(true);
                }}
                className="col-span-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-extrabold py-3 rounded-2xl transition cursor-pointer shadow-lg shadow-emerald-500/20 text-xs flex items-center justify-center gap-2"
                title={!isBranchLoaded ? 'Your branch information is not loaded.' : taxConfigError ? 'Tax configuration error' : undefined}
              >
                <CreditCard className="w-4 h-4" />
                <span>{t.pos.payButton} (${(cartTotals?.grandTotal || 0).toFixed(2)})</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Product Options Modal */}
      {activeProductForOption && (
        <ProductOptionModal
          product={activeProductForOption}
          onClose={() => setActiveProductForOption(null)}
          onConfirm={handleOptionConfirm}
        />
      )}

      {/* Customer Modal */}
      {isCustomerModalOpen && (
        <CustomerModal
          onClose={() => setIsCustomerModalOpen(false)}
          onSelectCustomer={cust => setSelectedCustomer(cust)}
        />
      )}

      {/* Held Orders Modal */}
      {isHoldModalOpen && (
        <HoldOrdersModal
          onClose={() => setIsHoldModalOpen(false)}
          onResumeOrder={handleResumeOrder}
        />
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <PaymentModal
          cart={cart}
          orderType={orderType}
          tableNumber={tableNumber}
          subtotal={cartTotals.subtotal}
          tax={cartTotals.tax}
          discountAmount={cartTotals.discountAmount}
          grandTotal={cartTotals.grandTotal}
          selectedCustomer={selectedCustomer}
          cashierName={user?.displayName || 'Senior Cashier'}
          cashierUid={user?.uid || 'emp-pos'}
          deliveryZones={deliveryZones}
          branchDefaultDeliveryFee={branchDeliveryFee}
          onClose={() => setIsPaymentModalOpen(false)}
          onConfirmPayment={handleConfirmPayment}
        />
      )}

      {/* Receipt & Invoice Modal */}
      {completedReceipt && (
        <ReceiptModal
          receipt={completedReceipt}
          onClose={() => setCompletedReceipt(null)}
        />
      )}

    </div>
  );
};
