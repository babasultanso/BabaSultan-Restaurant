import React, { useState } from 'react';
import { ReceiptData } from '../../../domain/entities/pos';
import { downloadPDFInvoice } from '../../../domain/services/receiptService';
import { X, Printer, Download, CheckCircle2, Utensils, User, Clock, FileText } from 'lucide-react';

interface ReceiptModalProps {
  receipt: ReceiptData;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  receipt,
  onClose
}) => {
  const [activeView, setActiveView] = useState<'customer' | 'kitchen'>('customer');

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    downloadPDFInvoice(receipt);
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

        {/* Status Badge */}
        <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 text-xs font-bold">
          <CheckCircle2 className="w-5 h-5" />
          <span>Order #{receipt.orderNumber} Completed Successfully!</span>
        </div>

        {/* View Switcher Tabs (Customer Receipt vs Kitchen Ticket) */}
        <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveView('customer')}
            className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeView === 'customer'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Customer Receipt</span>
          </button>
          <button
            onClick={() => setActiveView('kitchen')}
            className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeView === 'kitchen'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Kitchen Ticket (KDS)</span>
          </button>
        </div>

        {/* Receipt Paper Frame */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 font-mono text-xs text-slate-200 space-y-3 print:bg-white print:text-black">
          
          {activeView === 'customer' ? (
            /* Customer Receipt Format */
            <>
              <div className="text-center space-y-1 border-b border-dashed border-slate-800 pb-3">
                <h4 className="font-extrabold text-sm text-white">RESTAURANT ERP RECEIPT</h4>
                <p className="text-[10px] text-slate-400">Order #{receipt.orderNumber}</p>
                <p className="text-[10px] text-slate-500">{new Date(receipt.timestamp).toLocaleString()}</p>
              </div>

              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-800 pb-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <span className="text-white font-bold">{receipt.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Order Type:</span>
                  <span className="text-emerald-400 font-bold uppercase">{(receipt.orderType || 'dine_in').replace('_', ' ')}</span>
                </div>
                {receipt.tableNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Table #:</span>
                    <span className="text-white font-bold">{receipt.tableNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Cashier:</span>
                  <span className="text-white font-bold">{receipt.cashierName}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 border-b border-dashed border-slate-800 pb-3">
                {receipt.items.map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex justify-between font-bold">
                      <span>{item.quantity}x {item.product?.name || 'Item'}</span>
                      <span>${(item.totalPrice || 0).toFixed(2)}</span>
                    </div>
                    {item.selectedNotes && (
                      <p className="text-[10px] text-amber-400 italic">Note: {item.selectedNotes}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span>${(receipt.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>VAT {receipt.taxRate ? `(${(receipt.taxRate * 100).toFixed(0)}%)` : (receipt.subtotal > 0 && receipt.tax ? `(${((receipt.tax / receipt.subtotal) * 100).toFixed(0)}%)` : '')}:</span>
                  <span>${(receipt.tax || 0).toFixed(2)}</span>
                </div>
                {(receipt.discount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount:</span>
                    <span>-${(receipt.discount || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-slate-800">
                  <span>TOTAL PAID:</span>
                  <span className="text-emerald-400">${(receipt.totalAmount || 0).toFixed(2)}</span>
                </div>
                {receipt.amountTendered !== undefined && (
                  <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                    <span>Tendered ({receipt.paymentMethod ? receipt.paymentMethod.toUpperCase() : 'CASH'}): ${(receipt.amountTendered || 0).toFixed(2)}</span>
                    <span>Change: ${(receipt.changeDue || 0).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Kitchen Ticket Format */
            <>
              <div className="text-center space-y-1 border-b border-dashed border-amber-500/40 pb-3">
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase">
                  KITCHEN DISPATCH TICKET
                </span>
                <h4 className="font-extrabold text-base text-white mt-1">ORDER #{receipt.orderNumber}</h4>
                <div className="flex justify-center gap-3 text-[10px] text-slate-400">
                  <span>Type: <strong className="text-amber-400 uppercase">{receipt.orderType}</strong></span>
                  {receipt.tableNumber && <span>Table: <strong className="text-white">{receipt.tableNumber}</strong></span>}
                </div>
              </div>

              <div className="space-y-3 border-b border-dashed border-slate-800 pb-3">
                {receipt.items.map((item, idx) => (
                  <div key={idx} className="bg-slate-900 p-2 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center gap-2 font-extrabold text-white text-sm">
                      <span className="bg-amber-500 text-slate-950 px-2 py-0.5 rounded text-xs">
                        {item.quantity}x
                      </span>
                      <span>{item.product.name}</span>
                    </div>
                    {item.selectedNotes && (
                      <p className="text-xs text-amber-300 font-bold bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                        Kitchen Instruction: {item.selectedNotes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handlePrint}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>Print Receipt</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-3 rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <Download className="w-4 h-4" />
            <span>PDF Invoice</span>
          </button>
        </div>
      </div>
    </div>
  );
};
