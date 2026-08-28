import React, { useState } from 'react';
import {
  InventoryItem,
  InventoryMovement,
  PurchaseOrder,
  Supplier,
  InventoryValuationReport
} from '../../../domain/entities/inventory';
import { InventoryLang, inventoryDict } from './translations';
import { inventoryService } from '../../../domain/services/inventoryService';
import {
  BarChart2,
  FileSpreadsheet,
  FileText,
  Printer,
  Download,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  Layers,
  PieChart
} from 'lucide-react';

interface InventoryReportsViewProps {
  items: InventoryItem[];
  movements: InventoryMovement[];
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  lang: InventoryLang;
}

export const InventoryReportsView: React.FC<InventoryReportsViewProps> = ({
  items,
  movements,
  purchaseOrders,
  suppliers,
  lang
}) => {
  const t = inventoryDict[lang] || inventoryDict.en;

  const [activeReport, setActiveReport] = useState<
    'valuation' | 'movements' | 'purchases' | 'suppliers' | 'waste' | 'expiry'
  >('valuation');

  // Valuation report calculation
  const valuationData = inventoryService.calculateValuation(items);

  // Waste records
  const wasteMovements = movements.filter((m) => m.type === 'waste' || m.type === 'expired');

  // Expiring items
  const now = Date.now();
  const expiringItems = items.filter((i) => {
    if (!i.expirationDate) return false;
    const exp = new Date(i.expirationDate).getTime();
    return !isNaN(exp) && exp < now + 14 * 24 * 60 * 60 * 1000;
  });

  // Export handlers
  const handleExportCsv = () => {
    if (activeReport === 'valuation') {
      const rows = items.map((i) => ({
        'Item Code': i.itemCode,
        'Item Name': i.itemName,
        Category: i.category,
        Quantity: i.currentQuantity,
        Unit: i.unit,
        'Purchase Cost ($)': i.purchaseCost,
        'Total Valuation ($)': (i.currentQuantity * (i.purchaseCost || 0)).toFixed(2),
        Status: i.status
      }));
      inventoryService.exportToCsv('inventory_valuation_report', rows);
    } else if (activeReport === 'movements') {
      const rows = movements.map((m) => ({
        Type: m.type,
        Item: m.itemName,
        Quantity: m.quantity,
        Unit: m.unit,
        Reason: m.reason,
        User: m.createdBy,
        Date: new Date(m.createdAt).toLocaleString()
      }));
      inventoryService.exportToCsv('stock_movements_audit_log', rows);
    } else if (activeReport === 'suppliers') {
      const rows = suppliers.map((s) => ({
        Supplier: s.companyName,
        Contact: s.contactPerson,
        Phone: s.phone,
        'Payment Terms': s.paymentTerms,
        'Outstanding Balance ($)': s.outstandingBalance
      }));
      inventoryService.exportToCsv('suppliers_balance_report', rows);
    }
  };

  const handleExportPdf = () => {
    if (activeReport === 'valuation') {
      const headers = ['Code', 'Item Name', 'Category', 'Qty', 'Unit Cost', 'Total Valuation', 'Status'];
      const rows = items.map((i) => [
        i.itemCode,
        i.itemName,
        i.category,
        `${i.currentQuantity} ${i.unit}`,
        `$${(i.purchaseCost || 0).toFixed(2)}`,
        `$${(i.currentQuantity * (i.purchaseCost || 0)).toFixed(2)}`,
        i.status
      ]);
      inventoryService.exportToPrintPdf('Inventory Valuation & Stock Summary Report', headers, rows);
    } else if (activeReport === 'movements') {
      const headers = ['Type', 'Item Name', 'Qty', 'Reason', 'User', 'Date'];
      const rows = movements.map((m) => [
        m.type,
        m.itemName,
        `${m.quantity} ${m.unit}`,
        m.reason,
        m.createdBy || 'System',
        new Date(m.createdAt).toLocaleDateString()
      ]);
      inventoryService.exportToPrintPdf('Stock Movement Audit Log Report', headers, rows);
    }
  };

  return (
    <div className="space-y-6 text-white font-sans">
      
      {/* Report Selection Tabs */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveReport('valuation')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeReport === 'valuation'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            <BarChart2 className="w-4 h-4" /> Valuation & Stock
          </button>

          <button
            onClick={() => setActiveReport('movements')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeReport === 'movements'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" /> Movement Audit
          </button>

          <button
            onClick={() => setActiveReport('suppliers')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeReport === 'suppliers'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" /> Supplier Balances
          </button>

          <button
            onClick={() => setActiveReport('waste')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeReport === 'waste'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-4 h-4" /> Waste & Spoilage
          </button>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <FileSpreadsheet className="w-4 h-4" /> {t.exportExcel}
          </button>

          <button
            onClick={handleExportPdf}
            className="px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold text-xs flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <Printer className="w-4 h-4" /> {t.exportPdf}
          </button>
        </div>

      </div>

      {/* Valuation Report Section */}
      {activeReport === 'valuation' && (
        <div className="space-y-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-1">
              <span className="text-xs text-slate-400 font-bold">Total Items Cataloged</span>
              <h4 className="text-2xl font-black text-white">{valuationData.totalItemsCount}</h4>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-1">
              <span className="text-xs text-slate-400 font-bold">Total Purchase Cost Valuation</span>
              <h4 className="text-2xl font-black text-emerald-400">
                ${valuationData.totalPurchaseValuation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h4>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-1">
              <span className="text-xs text-slate-400 font-bold">Potential Selling Value</span>
              <h4 className="text-2xl font-black text-amber-400">
                ${valuationData.totalSellingValuation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h4>
            </div>
          </div>

          {/* Category Breakdown Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h4 className="text-sm font-extrabold text-white">Inventory Valuation by Category</h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-center">Item Count</th>
                    <th className="p-3 text-right">Category Cost Valuation ($)</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {valuationData.categoryValuation.map((cat, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-white">{cat.category}</td>
                      <td className="p-3 text-center font-mono font-bold">{cat.itemCount}</td>
                      <td className="p-3 text-right font-mono font-black text-emerald-400">
                        ${cat.totalValuation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Movements Audit Report Section */}
      {activeReport === 'movements' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h4 className="text-sm font-extrabold text-white">Full Movement Audit Trail ({movements.length} records)</h4>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Type</th>
                  <th className="p-3">Item Name</th>
                  <th className="p-3 text-center">Qty</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">User</th>
                  <th className="p-3 text-right">Date</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60 font-medium">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/40">
                    <td className="p-3 uppercase font-black text-amber-400">{m.type}</td>
                    <td className="p-3 font-bold text-white">{m.itemName}</td>
                    <td className="p-3 text-center font-mono font-bold">{m.quantity} {m.unit}</td>
                    <td className="p-3 text-slate-300">{m.reason}</td>
                    <td className="p-3 text-slate-400">{m.createdBy}</td>
                    <td className="p-3 text-right font-mono text-slate-500">
                      {new Date(m.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Supplier Balances Section */}
      {activeReport === 'suppliers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h4 className="text-sm font-extrabold text-white">Supplier Outstanding Payables Summary</h4>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Supplier Name</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Payment Terms</th>
                  <th className="p-3 text-right">Outstanding Balance ($)</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60 font-medium">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-white">{s.companyName}</td>
                    <td className="p-3 text-slate-300">{s.contactPerson} ({s.phone})</td>
                    <td className="p-3 font-semibold">{s.paymentTerms}</td>
                    <td className="p-3 text-right font-mono font-black text-rose-400">
                      ${(s.outstandingBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Waste Section */}
      {activeReport === 'waste' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h4 className="text-sm font-extrabold text-white">Waste & Spoilage Log</h4>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3">Item Name</th>
                  <th className="p-3 text-center">Wasted Qty</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Logged By</th>
                  <th className="p-3 text-right">Date</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60 font-medium">
                {wasteMovements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      No waste or spoilage records found.
                    </td>
                  </tr>
                ) : (
                  wasteMovements.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-white">{w.itemName}</td>
                      <td className="p-3 text-center font-mono font-bold text-rose-400">
                        {w.quantity} {w.unit}
                      </td>
                      <td className="p-3 text-slate-300">{w.reason}</td>
                      <td className="p-3 text-slate-400">{w.createdBy}</td>
                      <td className="p-3 text-right font-mono text-slate-500">
                        {new Date(w.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
