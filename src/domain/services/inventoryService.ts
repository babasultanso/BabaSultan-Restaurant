import {
  InventoryItem,
  PurchaseOrder,
  Supplier,
  InventoryAlert,
  InventoryValuationReport,
  InventoryCategory
} from '../entities/inventory';

export class InventoryService {
  /**
   * Automatically detect alerts across inventory items, purchase orders, and supplier accounts
   */
  generateAlerts(
    items: InventoryItem[],
    purchaseOrders: PurchaseOrder[] = [],
    suppliers: Supplier[] = []
  ): InventoryAlert[] {
    const alerts: InventoryAlert[] = [];
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    // 1. Inventory Item Alerts
    items.forEach((item) => {
      // Out of Stock
      if (item.currentQuantity <= 0) {
        alerts.push({
          id: `alert_out_${item.id}`,
          type: 'out_of_stock',
          title: `Out of Stock: ${item.itemName}`,
          message: `Item code ${item.itemCode} is completely out of stock. Reorder level is ${item.reorderLevel} ${item.unit}.`,
          severity: 'critical',
          referenceId: item.id,
          createdAt: new Date().toISOString(),
          read: false
        });
      }
      // Low Stock
      else if (item.currentQuantity <= item.minimumQuantity) {
        alerts.push({
          id: `alert_low_${item.id}`,
          type: 'low_stock',
          title: `Low Stock Warning: ${item.itemName}`,
          message: `Current qty (${item.currentQuantity} ${item.unit}) is below minimum required (${item.minimumQuantity} ${item.unit}).`,
          severity: 'warning',
          referenceId: item.id,
          createdAt: new Date().toISOString(),
          read: false
        });
      }

      // Expired or Expiring Soon
      if (item.expirationDate) {
        const expTime = new Date(item.expirationDate).getTime();
        if (!isNaN(expTime)) {
          if (expTime < now) {
            alerts.push({
              id: `alert_exp_${item.id}`,
              type: 'expired',
              title: `EXPIRED ITEM: ${item.itemName}`,
              message: `Batch #${item.batchNumber || 'N/A'} expired on ${item.expirationDate}. Immediate disposal required.`,
              severity: 'critical',
              referenceId: item.id,
              createdAt: new Date().toISOString(),
              read: false
            });
          } else if (expTime - now <= sevenDaysMs) {
            const daysLeft = Math.ceil((expTime - now) / (24 * 60 * 60 * 1000));
            alerts.push({
              id: `alert_exp_soon_${item.id}`,
              type: 'expiring_soon',
              title: `Expiring Soon (${daysLeft} days): ${item.itemName}`,
              message: `Item expires on ${item.expirationDate}. Current stock: ${item.currentQuantity} ${item.unit}.`,
              severity: 'warning',
              referenceId: item.id,
              createdAt: new Date().toISOString(),
              read: false
            });
          }
        }
      }
    });

    // 2. Overdue Purchase Orders
    purchaseOrders.forEach((po) => {
      if (
        po.status !== 'completed' &&
        po.status !== 'cancelled' &&
        po.expectedDeliveryDate
      ) {
        const delTime = new Date(po.expectedDeliveryDate).getTime();
        if (!isNaN(delTime) && delTime < now) {
          alerts.push({
            id: `alert_po_overdue_${po.id}`,
            type: 'overdue_po',
            title: `Overdue Delivery: PO #${po.poNumber}`,
            message: `Purchase order to ${po.supplierName} was expected on ${po.expectedDeliveryDate}.`,
            severity: 'warning',
            referenceId: po.id,
            createdAt: new Date().toISOString(),
            read: false
          });
        }
      }
    });

    // 3. Overdue Supplier Payments
    suppliers.forEach((sup) => {
      if (sup.outstandingBalance > 500) {
        alerts.push({
          id: `alert_sup_pay_${sup.id}`,
          type: 'overdue_payment',
          title: `High Outstanding Balance: ${sup.companyName}`,
          message: `Supplier balance due: $${sup.outstandingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}. Payment terms: ${sup.paymentTerms}.`,
          severity: 'info',
          referenceId: sup.id,
          createdAt: new Date().toISOString(),
          read: false
        });
      }
    });

    return alerts;
  }

  /**
   * Calculate detailed inventory valuation and margin analysis
   */
  calculateValuation(items: InventoryItem[]): InventoryValuationReport {
    let totalItemsCount = items.length;
    let totalStockQuantity = 0;
    let totalPurchaseValuation = 0;
    let totalSellingValuation = 0;

    const categoryMap: Record<string, { count: number; val: number }> = {};

    items.forEach((i) => {
      totalStockQuantity += i.currentQuantity;
      const purchaseVal = i.currentQuantity * (i.purchaseCost || 0);
      const sellingVal = i.currentQuantity * (i.sellingCost || 0);

      totalPurchaseValuation += purchaseVal;
      totalSellingValuation += sellingVal;

      const catName = i.category || 'Other';
      if (!categoryMap[catName]) {
        categoryMap[catName] = { count: 0, val: 0 };
      }
      categoryMap[catName].count += 1;
      categoryMap[catName].val += purchaseVal;
    });

    const potentialProfit = Math.max(0, totalSellingValuation - totalPurchaseValuation);
    const potentialProfitMargin =
      totalSellingValuation > 0 ? (potentialProfit / totalSellingValuation) * 100 : 0;

    const categoryValuation = Object.entries(categoryMap).map(([cat, data]) => ({
      category: cat,
      itemCount: data.count,
      totalValuation: data.val
    }));

    return {
      totalItemsCount,
      totalStockQuantity,
      totalPurchaseValuation,
      totalSellingValuation,
      potentialProfitMargin,
      categoryValuation
    };
  }

  /**
   * CSV Export Generator
   */
  exportToCsv(filename: string, rows: Record<string, any>[]): void {
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        headers.join(','),
        ...rows.map((row) =>
          headers
            .map((h) => {
              const val = row[h] !== undefined && row[h] !== null ? String(row[h]).replace(/"/g, '""') : '';
              return `"${val}"`;
            })
            .join(',')
        )
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Print / PDF Export Helper
   */
  exportToPrintPdf(title: string, headers: string[], rows: (string | number)[][]): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; color: #1e293b; }
            h1 { font-size: 20px; font-weight: 800; margin-bottom: 8px; color: #0f172a; }
            p { font-size: 12px; color: #64748b; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th { background-color: #0f172a; color: #ffffff; text-align: left; padding: 8px 12px; font-weight: 700; border: 1px solid #334155; }
            td { padding: 8px 12px; border: 1px solid #cbd5e1; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          <h1>BabaSultan POS Enterprise — ${title}</h1>
          <p>Generated on: ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
          <div class="footer">
            Confidential — Enterprise Inventory Management System
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}

export const inventoryService = new InventoryService();
