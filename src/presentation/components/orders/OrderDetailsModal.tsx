import React, { useState } from 'react';
import { Order, OrderStatus } from '../../../types';
import { KitchenTicket } from '../../../domain/entities/kitchen';
import { DeliveryOrder } from '../../../types';
import { downloadPDFInvoice } from '../../../domain/services/receiptService';
import {
  X,
  Printer,
  Download,
  Edit,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  User,
  Utensils,
  DollarSign,
  FileText,
  Flame,
  AlertTriangle,
  MapPin,
  Phone,
  ShieldCheck
} from 'lucide-react';

interface OrderDetailsModalProps {
  order: Order;
  kitchenTicket?: KitchenTicket | null;
  deliveryRecord?: DeliveryOrder | null;
  onClose: () => void;
  onUpdateStatus?: (orderId: string, status: OrderStatus) => Promise<void>;
  onCancelOrder?: (orderId: string, reason?: string) => Promise<void>;
  onEditOrder?: (order: Order) => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  kitchenTicket,
  deliveryRecord,
  onClose,
  onUpdateStatus,
  onCancelOrder,
  onEditOrder
}) => {
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [showCancelPrompt, setShowCancelPrompt] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('');

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      alert('Please enter a cancellation reason.');
      return;
    }
    setIsCancelling(true);
    try {
      if (onCancelOrder) {
        await onCancelOrder(order.id, cancelReason);
      } else if (onUpdateStatus) {
        await onUpdateStatus(order.id, 'cancelled');
      }
      setShowCancelPrompt(false);
      onClose();
    } catch (err: any) {
      alert(`Cancellation failed: ${err?.message || err}`);
    } finally {
      setIsCancelling(false);
    }
  };

  const isDeliveryOrder = order.orderType === 'delivery' || order.type === 'delivery' || Boolean(deliveryRecord);
  const isCancelled = order.status === 'cancelled';
  const isCompleted = order.status === 'completed';
  const isEditable = !isCancelled && !isCompleted;

  // Helper for Order Status Badge
  const getOrderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'completed':
        return <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase">Completed</span>;
      case 'ready_for_pickup':
      case 'ready':
        return <span className="px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30 text-[10px] font-bold uppercase">Ready</span>;
      case 'in_preparation':
      case 'preparing':
        return <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase animate-pulse">In Preparation</span>;
      case 'confirmed':
        return <span className="px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] font-bold uppercase">Confirmed</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold uppercase">Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold uppercase">New Order</span>;
    }
  };

  // Helper for Kitchen Prep Status Badge
  const getKitchenBadge = () => {
    const status = kitchenTicket?.prepStatus || order.prepStatus;
    if (!status && !kitchenTicket) {
      return <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold uppercase">No Ticket</span>;
    }
    switch (status) {
      case 'completed':
        return <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase">Kitchen Completed</span>;
      case 'ready_for_pickup':
        return <span className="px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30 text-[10px] font-bold uppercase">Food Ready</span>;
      case 'cooking':
        return <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase animate-pulse">Cooking</span>;
      case 'accepted':
        return <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold uppercase">Accepted</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold uppercase">Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold uppercase">New Ticket</span>;
    }
  };

  // Helper for Delivery Status Badge
  const getDeliveryBadge = () => {
    const status = deliveryRecord?.status || order.deliveryStatus;
    if (!status && !isDeliveryOrder) {
      return <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold uppercase">Not Delivery</span>;
    }
    switch (status) {
      case 'delivered':
        return <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase">Delivered</span>;
      case 'arrived':
        return <span className="px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30 text-[10px] font-bold uppercase">Driver Arrived</span>;
      case 'on_the_way':
      case 'in_transit':
        return <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-bold uppercase">Out for Delivery</span>;
      case 'picked_up':
        return <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase">Picked Up</span>;
      case 'accepted':
        return <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold uppercase">Driver Accepted</span>;
      case 'assigned':
        return <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-bold uppercase">Driver Assigned</span>;
      case 'failed':
      case 'returned':
      case 'cancelled':
        return <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold uppercase">Delivery Failed</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold uppercase">Unassigned</span>;
    }
  };

  // Helper for Payment Status Badge
  const getPaymentBadge = () => {
    switch (order.paymentStatus) {
      case 'paid':
        return <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase">Paid ({order.paymentMethod || 'cash'})</span>;
      case 'refunded':
        return <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold uppercase">Refunded</span>;
      case 'failed':
        return <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold uppercase">Payment Failed</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase">Payment Pending</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative text-slate-100 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 cursor-pointer transition"
          aria-label="Close Modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-extrabold text-white">Order #{order.orderNumber}</h3>
              <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-emerald-500/20">
                {order.orderType?.replace('_', ' ') || order.type || 'dine_in'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Created on {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onEditOrder && isEditable && (
              <button
                onClick={() => {
                  onEditOrder(order);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5 text-emerald-400" />
                <span>Edit Order</span>
              </button>
            )}
          </div>
        </div>

        {/* 4-Card Status Summary Grid: Order, Kitchen, Delivery, Payment */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider block">Order State</span>
            <div className="mt-1.5">{getOrderStatusBadge(order.status)}</div>
          </div>

          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-400" /> Kitchen Progress
            </span>
            <div className="mt-1.5">{getKitchenBadge()}</div>
          </div>

          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1">
              <Truck className="w-3 h-3 text-purple-400" /> Delivery Progress
            </span>
            <div className="mt-1.5">{getDeliveryBadge()}</div>
          </div>

          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-emerald-400" /> Payment State
            </span>
            <div className="mt-1.5">{getPaymentBadge()}</div>
          </div>
        </div>

        {/* Info Cards Grid: Customer, Location / Table, Driver / Staff */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-slate-400 font-semibold block text-[10px] uppercase">Customer</span>
            <span className="text-white font-extrabold block">{order.customerName || 'Walk-in Customer'}</span>
            {order.customerPhone && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Phone className="w-3 h-3 text-emerald-400" /> {order.customerPhone}
              </span>
            )}
          </div>

          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-slate-400 font-semibold block text-[10px] uppercase">
              {isDeliveryOrder ? 'Delivery Destination' : 'Table / Location'}
            </span>
            <span className="text-emerald-400 font-extrabold block">
              {isDeliveryOrder
                ? (order.deliveryAddress || deliveryRecord?.deliveryAddress || 'Delivery Address Provided')
                : (order.tableNumber ? `Table ${order.tableNumber}` : 'Takeout / Direct')}
            </span>
            {isDeliveryOrder && order.deliveryZoneName && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-teal-400" /> Zone: {order.deliveryZoneName}
              </span>
            )}
          </div>

          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
            <span className="text-slate-400 font-semibold block text-[10px] uppercase">
              {isDeliveryOrder && (deliveryRecord?.driverName || order.assignedDriver) ? 'Assigned Driver' : 'Staff / Cashier'}
            </span>
            <span className="text-white font-extrabold block">
              {isDeliveryOrder && (deliveryRecord?.driverName || order.assignedDriver)
                ? (deliveryRecord?.driverName || order.assignedDriver)
                : (order.employeeName || 'Staff Member')}
            </span>
            {isDeliveryOrder && deliveryRecord?.driverPhone && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Phone className="w-3 h-3 text-purple-400" /> {deliveryRecord.driverPhone}
              </span>
            )}
          </div>
        </div>

        {/* Itemized Dishes List */}
        <div className="space-y-2">
          <span className="text-slate-400 font-bold uppercase text-[10px] block">Ordered Items ({order.items?.length || 0})</span>
          <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar pr-1">
            {order.items?.map((item, idx) => (
              <div key={idx} className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 text-xs flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 font-bold text-white">
                    <span className="bg-emerald-500/20 text-emerald-400 font-extrabold px-2 py-0.5 rounded-lg text-[10px]">
                      {item.quantity}x
                    </span>
                    <span>{item.productName}</span>
                  </div>
                  {item.selectedOptions && item.selectedOptions.length > 0 && (
                    <p className="text-[10px] text-emerald-400 pl-7 mt-0.5">
                      + {item.selectedOptions.map(o => o.choiceName).join(', ')}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-[10px] text-amber-300 italic pl-7">Note: {item.notes}</p>
                  )}
                </div>

                <span className="font-mono font-extrabold text-white">${(item.totalPrice || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Breakdown (Independent accounting) */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5 text-xs font-mono">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal:</span>
            <span>${(typeof order.subtotal === 'number' ? order.subtotal : (order.totalAmount || 0)).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Recorded Tax:</span>
            <span>${(typeof order.tax === 'number' ? order.tax : 0).toFixed(2)}</span>
          </div>
          {isDeliveryOrder && (order.deliveryFee || deliveryRecord?.deliveryFee || 0) > 0 && (
            <div className="flex justify-between text-slate-400">
              <span>Delivery Fee:</span>
              <span>${(order.deliveryFee || deliveryRecord?.deliveryFee || 0).toFixed(2)}</span>
            </div>
          )}
          {(order.discountAmount || 0) > 0 && (
            <div className="flex justify-between text-emerald-400">
              <span>Discount Applied:</span>
              <span>-${(order.discountAmount || 0).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-slate-800">
            <span>Grand Total Amount:</span>
            <span className="text-emerald-400">${(order.totalAmount || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-teal-400 pt-1 font-sans font-bold">
            <span>Calculated Net Profit:</span>
            <span>${(order.profit || (order.totalAmount || 0) * 0.55).toFixed(2)}</span>
          </div>
        </div>

        {/* Cancel Confirmation Prompt */}
        {showCancelPrompt && (
          <div className="bg-rose-950/40 border border-rose-500/30 p-4 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
              <AlertTriangle className="w-4 h-4" />
              <span>Cancel Order #{order.orderNumber}</span>
            </div>
            <p className="text-[11px] text-slate-300">
              This will safely cancel the order and trigger automatic cancellation reversal journal entries.
            </p>
            <input
              type="text"
              placeholder="Enter cancellation reason..."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              className="w-full bg-slate-900 border border-rose-500/30 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCancelPrompt(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
              >
                Back
              </button>
              <button
                disabled={isCancelling}
                onClick={handleCancel}
                className="px-3 py-1.5 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 cursor-pointer disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
          <div>
            {!showCancelPrompt && isEditable && (
              <button
                onClick={() => setShowCancelPrompt(true)}
                className="px-3.5 py-2 rounded-xl bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Cancel Order</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer flex items-center gap-2"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Print Ticket</span>
            </button>
            <button
              onClick={() => downloadPDFInvoice(order)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <Download className="w-4 h-4" />
              <span>Invoice PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
