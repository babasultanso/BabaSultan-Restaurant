import { translateRawUi } from '../../../i18n';
import { useAuth } from '../../context/AuthContext';
import React, { useState, useEffect } from 'react';
import { PaymentMethod, POSCheckoutPayload, CartItem, OrderType } from '../../../domain/entities/pos';
import { Customer, DeliveryZone } from '../../../types';
import { calculateTenderChange } from '../../../domain/services/posService';
import { X, DollarSign, CreditCard, Smartphone, CheckCircle2, MapPin, Truck, AlertCircle, Building2, Banknote } from 'lucide-react';

interface PaymentModalProps {
  cart: CartItem[];
  orderType: OrderType;
  tableNumber?: string;
  subtotal: number;
  tax: number;
  discountAmount: number;
  grandTotal: number;
  selectedCustomer?: Customer | null;
  cashierName: string;
  cashierUid: string;
  deliveryZones?: DeliveryZone[];
  branchDefaultDeliveryFee?: number | null;
  initialZoneId?: string;
  initialAddress?: string;
  onClose: () => void;
  onConfirmPayment: (payload: POSCheckoutPayload) => Promise<void>;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  cart,
  orderType,
  tableNumber,
  subtotal,
  tax,
  discountAmount,
  grandTotal,
  selectedCustomer,
  cashierName,
  cashierUid,
  deliveryZones,
  branchDefaultDeliveryFee,
  initialZoneId,
  initialAddress,
  onClose,
  onConfirmPayment
}) => {
  const { t } = useAuth();
  const activeZones = deliveryZones || [];

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [customerName, setCustomerName] = useState<string>(selectedCustomer?.name || '');
  const [customerPhone, setCustomerPhone] = useState<string>(selectedCustomer?.phone || '');
  
  // Delivery Specific State
  const [selectedZoneId, setSelectedZoneId] = useState<string>(
    initialZoneId || activeZones[0]?.id || ''
  );
  
  useEffect(() => {
    if (!selectedZoneId && activeZones.length > 0) {
      setSelectedZoneId(activeZones[0].id);
    }
  }, [activeZones, selectedZoneId]);

  const selectedZone = activeZones.find(z => z.id === selectedZoneId) || (activeZones.length > 0 ? activeZones[0] : null);
  
  const [deliveryAddress, setDeliveryAddress] = useState<string>(
    initialAddress || selectedCustomer?.address || ''
  );

  // Authoritative Delivery Fee calculation
  let deliveryFee = 0;
  let isDeliveryConfigured = true;

  if (orderType === 'delivery') {
    if (selectedZone) {
      const fee = typeof selectedZone.baseDeliveryFee === 'number'
        ? selectedZone.baseDeliveryFee
        : (typeof selectedZone.deliveryFee === 'number' ? selectedZone.deliveryFee : null);
      if (fee !== null && fee >= 0) {
        deliveryFee = fee;
      } else if (typeof branchDefaultDeliveryFee === 'number' && branchDefaultDeliveryFee >= 0) {
        deliveryFee = branchDefaultDeliveryFee;
      } else {
        isDeliveryConfigured = false;
      }
    } else if (typeof branchDefaultDeliveryFee === 'number' && branchDefaultDeliveryFee >= 0) {
      deliveryFee = branchDefaultDeliveryFee;
    } else {
      isDeliveryConfigured = false;
    }
  }

  const payableTotal = orderType === 'delivery' 
    ? Math.max(0, Math.round((subtotal + tax + deliveryFee - discountAmount) * 100) / 100)
    : Math.round(grandTotal * 100) / 100;

  const [amountTenderedStr, setAmountTenderedStr] = useState<string>(payableTotal.toFixed(2));
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    setAmountTenderedStr(payableTotal.toFixed(2));
  }, [payableTotal]);

  const numericTendered = parseFloat(amountTenderedStr) || 0;
  const tenderResult = calculateTenderChange(numericTendered, payableTotal, paymentMethod);

  // Suggested Cash Tender Amounts
  const quickTenders = React.useMemo(() => {
    if (payableTotal <= 0) return [0];
    const exact = payableTotal;
    const next5 = Math.ceil(payableTotal / 5) * 5;
    const next10 = Math.ceil(payableTotal / 10) * 10;
    const next20 = Math.ceil(payableTotal / 20) * 20;
    const next50 = Math.ceil(payableTotal / 50) * 50;
    const next100 = Math.ceil(payableTotal / 100) * 100;

    const set = new Set<number>([exact]);
    if (next5 >= exact) set.add(next5);
    if (next10 >= exact) set.add(next10);
    if (next20 >= exact) set.add(next20);
    if (next50 >= exact) set.add(next50);
    if (next100 >= exact) set.add(next100);

    return Array.from(set).sort((a, b) => a - b).slice(0, 5);
  }, [payableTotal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (paymentMethod === 'cash' && !tenderResult.isValid) {
      alert(`Insufficient cash tendered: Shortfall of $${tenderResult.shortfall.toFixed(2)}.`);
      return;
    }

    if (orderType === 'delivery') {
      if (!isDeliveryConfigured) {
        alert('Delivery fee is not configured for this branch. Please select a valid delivery zone or configure branch delivery settings.');
        return;
      }
      if (!customerPhone.trim()) {
        alert('Please enter a customer phone number for delivery orders.');
        return;
      }
      if (!deliveryAddress.trim()) {
        alert('Please enter a delivery address.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload: POSCheckoutPayload = {
        customerName: customerName.trim() || (orderType === 'delivery' ? 'Delivery Customer' : 'Walk-in Customer'),
        customerPhone: customerPhone.trim(),
        orderType,
        tableNumber: orderType === 'dine_in' ? tableNumber.trim() : '',
        deliveryAddress: orderType === 'delivery' ? deliveryAddress.trim() : undefined,
        deliveryZoneId: orderType === 'delivery' ? (selectedZone?.id || undefined) : undefined,
        deliveryZoneName: orderType === 'delivery' ? (selectedZone?.name || undefined) : undefined,
        deliveryFee: orderType === 'delivery' ? deliveryFee : 0,
        items: cart,
        subtotal,
        tax,
        discount: discountAmount,
        totalAmount: payableTotal,
        paymentMethod,
        amountTendered: paymentMethod === 'cash' ? tenderResult.amountTendered : (paymentMethod === 'cod' || paymentMethod === 'credit' || paymentMethod === 'unpaid' ? 0 : payableTotal),
        changeDue: paymentMethod === 'cash' ? tenderResult.changeDue : 0,
        employeeId: cashierUid || '',
        employeeName: cashierName || '',
        notes: orderNotes
      };

      await onConfirmPayment(payload);
    } catch (err: any) {
      alert(`Payment submission failed: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative text-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/30">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{t.legacyUi.posCheckoutPayment}</h3>
            <p className="text-xs text-slate-400">{t.legacyUi.selectPaymentMethod}</p>
          </div>
        </div>

        {/* Amount Due Banner */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-extrabold tracking-wider">{t.legacyUi.totalPayable}</span>
          <div className="text-3xl font-extrabold text-emerald-400">${(payableTotal || 0).toFixed(2)}</div>
          <div className="text-[10px] text-slate-500 flex flex-wrap justify-center gap-2">
            <span>Sub: ${(subtotal || 0).toFixed(2)}</span>
            <span>VAT: ${(tax || 0).toFixed(2)}</span>
            {orderType === 'delivery' && (
              <span className="text-amber-400 font-bold">
                Delivery Fee: {deliveryFee === 0 ? 'Free ($0.00)' : `+$${deliveryFee.toFixed(2)}`}
              </span>
            )}
            {(discountAmount || 0) > 0 && <span className="text-emerald-400">Disc: -${(discountAmount || 0).toFixed(2)}</span>}
          </div>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Delivery Configuration Section (Visible only when orderType === 'delivery') */}
          {orderType === 'delivery' && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <Truck className="w-4 h-4" />
                <span>{t.legacyUi.deliveryOrderConfiguration}</span>
              </div>

              {!isDeliveryConfigured && (
                <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 font-semibold text-xs leading-relaxed">
                  ⚠️ Delivery fee is not configured for this branch. Please select a valid delivery zone or configure branch delivery settings.
                </div>
              )}

              {/* Zone Selector */}
              {activeZones.length > 0 ? (
                <div>
                  <label className="text-slate-300 font-bold block mb-1">{t.legacyUi.selectDeliveryZone}</label>
                  <select
                    value={selectedZoneId}
                    onChange={e => setSelectedZoneId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-amber-500"
                  >
                    {activeZones.map(z => {
                      const zFee = typeof z.baseDeliveryFee === 'number' ? z.baseDeliveryFee : (typeof z.deliveryFee === 'number' ? z.deliveryFee : 0);
                      return (
                        <option key={z.id} value={z.id}>
                          {z.name} ({z.city}) — Fee: {zFee === 0 ? 'Free ($0.00)' : `$${zFee.toFixed(2)}`} | EST: {z.estimatedTimeMinutes} min
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  {typeof branchDefaultDeliveryFee === 'number' && branchDefaultDeliveryFee >= 0 ? (
                    <div className="flex justify-between items-center py-1 text-slate-300">
                      <span>{t.legacyUi.branchDefaultDeliveryRate}</span>
                      <span className="font-bold text-emerald-400">
                        {branchDefaultDeliveryFee === 0 ? 'Free ($0.00)' : `$${branchDefaultDeliveryFee.toFixed(2)}`}
                      </span>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Delivery Address */}
              <div>
                <label className="text-slate-300 font-bold block mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>{translateRawUi('Delivery Address')} <span className="text-rose-400">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={translateRawUi('e.g. House 42, District, Street Name')}
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-bold block">{t.legacyUi.paymentMethod}</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(orderType === 'delivery'
                ? [
                    { id: 'cash', label: 'Cash (Prepaid)', icon: DollarSign },
                    { id: 'card', label: 'Card', icon: CreditCard },
                    { id: 'mobile_money', label: 'Mobile', icon: Smartphone },
                    { id: 'cod', label: 'Cash on Delivery', icon: Truck }
                  ]
                : [
                    { id: 'cash', label: 'Cash', icon: DollarSign },
                    { id: 'card', label: 'Card', icon: CreditCard },
                    { id: 'mobile_money', label: 'Mobile', icon: Smartphone },
                    { id: 'bank', label: 'Bank Transfer', icon: Building2 }
                  ]
              ).map(m => {
                const Icon = m.icon;
                const isSel = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                    className={`p-2.5 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                      isSel
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/10'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* COD Notice */}
          {paymentMethod === 'cod' && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl text-xs space-y-1 text-amber-200">
              <div className="font-bold flex items-center gap-1.5 text-amber-400">
                <Truck className="w-4 h-4" />
                <span>{t.legacyUi.cashOnDelivery}</span>
              </div>
              <p className="text-[11px] text-amber-300/80">
                {translateRawUi('Order will be dispatched immediately. Driver will collect')} <strong className="text-white">${payableTotal.toFixed(2)}</strong> {translateRawUi('cash from the customer upon delivery.')}
              </p>
            </div>
          )}

          {/* Cash Tender & Change Due Section */}
          {paymentMethod === 'cash' && (
            <div className="space-y-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              <div className="flex justify-between items-center text-xs">
                <label className="text-slate-300 font-bold">{t.legacyUi.amountTenderedCustomer}</label>
                <span className="text-[11px] text-slate-400">Total: ${payableTotal.toFixed(2)}</span>
              </div>

              {/* Tender Input */}
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amountTenderedStr}
                  onChange={e => setAmountTenderedStr(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-white font-bold text-base focus:outline-none focus:border-emerald-500"
                  placeholder={translateRawUi('0.00')}
                />
              </div>

              {/* Quick Cash Buttons */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {quickTenders.map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmountTenderedStr(amt.toFixed(2))}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                      Math.abs(numericTendered - amt) < 0.001
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {amt === payableTotal ? `Exact ($${amt.toFixed(2)})` : `$${amt.toFixed(2)}`}
                  </button>
                ))}
              </div>

              {/* Change Due / Shortfall Indicator */}
              <div className="pt-2 border-t border-slate-800">
                {tenderResult.isValid ? (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold">{t.legacyUi.changeDueCustomer}</span>
                    <span className="text-emerald-400 font-extrabold text-sm">
                      ${tenderResult.changeDue.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Shortfall: ${tenderResult.shortfall.toFixed(2)} more needed</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Customer Name & Phone */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-300 font-bold block mb-1">{t.legacyUi.customerName}</label>
              <input
                type="text"
                placeholder={translateRawUi('Walk-in Customer')}
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-slate-300 font-bold block mb-1">
                Phone Number {orderType === 'delivery' && <span className="text-rose-400">*</span>}
              </label>
              <input
                type="text"
                required={orderType === 'delivery'}
                placeholder={orderType === 'delivery' ? 'e.g. +252 61 555 1234' : 'Optional Phone'}
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Order Notes */}
          <div>
            <label className="text-slate-300 font-bold block mb-1">{t.legacyUi.orderNotesKitchen}</label>
            <input
              type="text"
              placeholder={translateRawUi('e.g. VIP guest, extra napkin, pack separate...')}
              value={orderNotes}
              onChange={e => setOrderNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Submit Order Button */}
          <button
            type="submit"
            disabled={isSubmitting || (orderType === 'delivery' && !isDeliveryConfigured) || (paymentMethod === 'cash' && !tenderResult.isValid)}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold py-3.5 rounded-2xl transition cursor-pointer shadow-lg shadow-emerald-500/20 text-sm flex items-center justify-center gap-2 mt-2"
          >
            {isSubmitting ? (
              <span>{t.legacyUi.processingPayment}</span>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Confirm Order & Complete (${(payableTotal || 0).toFixed(2)})</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
