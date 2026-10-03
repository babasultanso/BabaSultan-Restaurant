import jsPDF from 'jspdf';
import autoTableFunc from 'jspdf-autotable';
import { Order, Expense, Product, Ingredient, Employee, Purchase, Supplier, CPAMetrics, CustomerRefund, BankTransaction, SalaryPayment } from '../types';

import { employeeMonthlyPayrollEquivalent } from './payroll';
export function getEmployeePayrollStatus(
  employee: Employee,
  salaries?: SalaryPayment[],
  period?: string
): 'PAID' | 'PARTIAL' | 'UNPAID' {
  if (!salaries || salaries.length === 0) return 'UNPAID';

  const currentPeriod = (period || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })).trim().toLowerCase();

  // Match employee by id or name
  const matching = salaries.filter(s =>
    Boolean((s.employeeId && employee.id && s.employeeId === employee.id) ||
    (s.employeeName && employee.name && s.employeeName.trim().toLowerCase() === employee.name.trim().toLowerCase()))
  );

  if (matching.length === 0) return 'UNPAID';

  // If there are records for the specific period, prioritize them; otherwise use matching records
  const periodSpecific = matching.filter(s => s.period && s.period.trim().toLowerCase() === currentPeriod);
  const relevantRecords = periodSpecific.length > 0 ? periodSpecific : matching;

  const paidRecords = relevantRecords.filter(s => s.status === 'paid');
  if (paidRecords.length === 0) return 'UNPAID';

  const totalPaid = paidRecords.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
  const expectedSalary = Number(employee.salary || 0);

  if (expectedSalary > 0) {
    if (totalPaid >= expectedSalary) return 'PAID';
    if (totalPaid > 0) return 'PARTIAL';
    return 'UNPAID';
  }

  return totalPaid > 0 ? 'PAID' : 'UNPAID';
}

export function downloadPDFReport(title: string, subtitle: string, dataSections: Array<{ heading: string; columns: string[]; rows: (string | number)[][] }>) {
  const doc = new jsPDF();

  // Title & Header
  doc.setFillColor(24, 43, 73); // Deep Navy Primary
  doc.rect(0, 0, 210, 30, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(title, 14, 18);

  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()} | Certified CPA AI Accountant`, 14, 25);

  let currentY = 40;

  if (subtitle) {
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(11);
    doc.text(subtitle, 14, currentY);
    currentY += 10;
  }

  dataSections.forEach((section) => {
    doc.setFontSize(13);
    doc.setTextColor(24, 43, 73);
    doc.text(section.heading, 14, currentY);
    currentY += 5;

    autoTableFunc(doc, {
      startY: currentY,
      head: [section.columns],
      body: section.rows,
      theme: 'striped',
      headStyles: { fillColor: [24, 43, 73], textColor: [255, 255, 255] },
      styles: { fontSize: 9 }
    });

    // @ts-ignore
    currentY = doc.lastAutoTable.finalY + 12;
  });

  doc.save(`${(title || 'report').toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`);
}

export function downloadInvoicePDF(order: Order) {
  const doc = new jsPDF();

  // Header
  doc.setFillColor(16, 185, 129); // Emerald Accent
  doc.rect(0, 0, 210, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('RESTAURANT INVOICE', 14, 20);

  doc.setFontSize(10);
  doc.text(`Invoice No: ${order.orderNumber} | Date: ${new Date(order.createdAt).toLocaleDateString()}`, 14, 28);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(11);
  doc.text(`Customer Name: ${order.customerName || 'Walk-in Customer'}`, 14, 45);
  doc.text(`Server / Cashier: ${order.employeeName || 'Staff'}`, 14, 52);
  doc.text(`Payment Method: ${(order.paymentMethod || 'cash').toUpperCase()}`, 14, 59);

  const tableRows = (order.items || []).map(item => [
    item.productName || 'Item',
    (item.quantity ?? 0).toString(),
    `$${(item.unitPrice || 0).toFixed(2)}`,
    `$${(item.totalPrice || 0).toFixed(2)}`
  ]);

  autoTableFunc(doc, {
    startY: 68,
    head: [['Item Name', 'Qty', 'Unit Price', 'Total']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [24, 43, 73], textColor: [255, 255, 255] }
  });

  // @ts-ignore
  const finalY = doc.lastAutoTable.finalY + 15;

  doc.setFontSize(14);
  doc.setTextColor(24, 43, 73);
  doc.text(`Grand Total: $${order.totalAmount.toFixed(2)}`, 130, finalY);

  doc.save(`Invoice_${order.orderNumber}.pdf`);
}

export function sanitizeCSVCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);
  // Neutralize CSV / Spreadsheet formula injection characters
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'` + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function sanitizeFilename(name: string): string {
  return String(name || 'export').replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '_').slice(0, 80);
}

export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function exportToExcel(filename: string, columns: string[], rows: (string | number)[][]) {
  // UTF-8 BOM for Arabic/Somali & Excel encoding compatibility
  let csvContent = '\uFEFF';
  csvContent += columns.map(col => sanitizeCSVCell(col)).join(',') + '\n';

  rows.forEach(row => {
    csvContent += row.map(cell => sanitizeCSVCell(cell)).join(',') + '\n';
  });

  if (typeof document === 'undefined') return csvContent;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  const safeName = sanitizeFilename(filename);
  link.setAttribute('download', `${safeName}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToCSV(filename: string, columns: string[], rows: (string | number)[][]) {
  exportToExcel(filename, columns, rows);
}

export function printReportWindow(title: string, subtitle: string, sections: Array<{ heading: string; columns: string[]; rows: (string | number)[][] }>) {
  const printWindow = window.open('', '_blank', 'width=1000,height=800');
  if (!printWindow) return;

  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${safeTitle}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 24px; }
          .title { font-size: 24px; font-weight: bold; color: #0f172a; margin: 0; }
          .subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }
          .section { margin-bottom: 28px; }
          .section-title { font-size: 16px; font-weight: bold; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
          th { background-color: #0f172a; color: #ffffff; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; }
          td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">${safeTitle}</h1>
          <div class="subtitle">${safeSubtitle} | Generated: ${escapeHtml(new Date().toLocaleString())}</div>
        </div>
        ${sections.map(sec => `
          <div class="section">
            <div class="section-title">${escapeHtml(sec.heading)}</div>
            <table>
              <thead>
                <tr>
                  ${sec.columns.map(col => `<th>${escapeHtml(col)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${sec.rows.map(row => `
                  <tr>
                    ${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}
        <div class="footer">
          Restaurant ERP & Analytics BI Module • Confidential Internal Report
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

export function generateCPAReport(
  type: string,
  metrics: CPAMetrics,
  raw: {
    orders: Order[];
    expenses: Expense[];
    purchases: Purchase[];
    salaries: SalaryPayment[];
    products: Product[];
    ingredients: Ingredient[];
    employees: Employee[];
    suppliers: Supplier[];
    refunds: CustomerRefund[];
    bankTransactions: BankTransaction[];
  },
  format: 'pdf' | 'excel' | 'csv'
) {
  let title = 'Financial Report';
  let subtitle = 'Official Certified Public Accountant Audit Statement';
  const sections: Array<{ heading: string; columns: string[]; rows: (string | number)[][] }> = [];

  if (type === 'daily' || type === 'weekly' || type === 'monthly' || type === 'yearly' || type === 'audit') {
    title = type === 'audit' ? 'COMPREHENSIVE CPA FINANCIAL AUDIT REPORT' : `${type.toUpperCase()} CPA FINANCIAL REPORT`;
    subtitle = `Audit Period: ${type.toUpperCase()} | Real-time Firestore Ledger Data`;

    const periodSales = type === 'daily'
      ? metrics.dailySales
      : type === 'weekly'
      ? metrics.weeklySales
      : type === 'monthly' || type === 'audit'
      ? metrics.monthlySales
      : metrics.yearlySales;

    sections.push({
      heading: 'Executive Financial Summary',
      columns: ['KPI Metric', 'Amount ($)', 'Benchmarking / Analysis'],
      rows: [
        ['Sales Revenue', `$${(Number(periodSales) || 0).toFixed(2)}`, 'Gross Sales Collected'],
        ['Customer Refunds', `-$${(Number(metrics.customerRefundsTotal) || 0).toFixed(2)}`, 'Recorded Customer Refunds'],
        ['Net Revenue', `$${(Number(metrics.netRevenue) || 0).toFixed(2)}`, 'Gross Revenue minus Customer Refunds'],
        ['Cost of Goods Sold (COGS)', `$${(Number(metrics.cogs) || 0).toFixed(2)}`, `Food Cost %: ${(Number(metrics.foodCostPercentage) || 0).toFixed(1)}% (Target < 35%)`],
        ['Gross Profit', `$${(Number(metrics.grossProfit) || 0).toFixed(2)}`, 'Net Revenue - COGS'],
        ['Operating & Labor Expenses', `$${(Number(metrics.totalExpenses) || 0).toFixed(2)}`, `Labor %: ${(Number(metrics.laborCostPercentage) || 0).toFixed(1)}%`],
        ['Net Operating Profit', `$${(Number(metrics.netProfit) || 0).toFixed(2)}`, `Margin: ${(Number(metrics.netProfitMargin) || 0).toFixed(1)}%`]
      ]
    });

    if (type === 'audit') {
      sections.push({
        heading: 'Liquidity & Tax Compliance Summary',
        columns: ['Control Item', 'Balance / Liability ($)', 'Status'],
        rows: [
          ['Physical Cash Register & Safe', `$${(Number(metrics.cashBalance) || 0).toFixed(2)}`, 'Cash on Hand'],
          ['Commercial Bank Corporate Account', `$${(Number(metrics.bankBalance) || 0).toFixed(2)}`, 'Operating Bank'],
          ['Total Liquid Capital', `$${(Number(metrics.totalLiquidity) || 0).toFixed(2)}`, 'Combined Liquidity'],
          ['Recorded VAT / Sales Tax Payable', `$${(Number(metrics.taxEstimatedVAT) || 0).toFixed(2)}`, 'Authoritative VAT']
        ]
      });
    }
  } else if (type === 'pnl') {
    title = 'PROFIT AND LOSS STATEMENT (P&L)';
    subtitle = 'GAAP Standard CPA Income Statement';

    sections.push({
      heading: 'Revenue & Cost of Goods Sold',
      columns: ['Category', 'Amount ($)'],
      rows: [
        ['Gross Food & Beverage Sales', `$${metrics.grossRevenue.toFixed(2)}`],
        ['Less: Customer Refunds & Allowances', `-$${metrics.customerRefundsTotal.toFixed(2)}`],
        ['NET SALES REVENUE', `$${metrics.netRevenue.toFixed(2)}`],
        ['Cost of Raw Ingredients & Beverages (COGS)', `-$${metrics.cogs.toFixed(2)}`],
        ['GROSS PROFIT', `$${metrics.grossProfit.toFixed(2)}`]
      ]
    });

    sections.push({
      heading: 'Operating Expenses Breakdown',
      columns: ['Operating Expense Item', 'Amount ($)'],
      rows: [
        ['Payroll & Employee Salaries', `$${metrics.laborCost.toFixed(2)}`],
        ['Utilities & Power Generator Fuel', `$${metrics.operatingExpenses.toFixed(2)}`],
        ['Delivery & Logistics Charges', `$${metrics.deliveryCost.toFixed(2)}`],
        ['TOTAL OPERATING EXPENSES', `$${metrics.totalExpenses.toFixed(2)}`]
      ]
    });

    const vatRateDisplay = metrics.netRevenue > 0 && metrics.taxEstimatedVAT > 0
      ? `${((metrics.taxEstimatedVAT / metrics.netRevenue) * 100).toFixed(0)}%`
      : 'Authoritative VAT';

    sections.push({
      heading: 'Net Profit Before Tax',
      columns: ['Item', 'Amount ($)'],
      rows: [
        ['NET OPERATING PROFIT', `$${metrics.netProfit.toFixed(2)}`],
        [`Estimated VAT / Sales Tax Payable (${vatRateDisplay})`, `$${metrics.taxEstimatedVAT.toFixed(2)}`],
        ['Estimated Corporate Income Tax (Configured / Provided)', `$${metrics.taxEstimatedCorporate.toFixed(2)}`]
      ]
    });
  } else if (type === 'cashflow') {
    title = 'CASH FLOW STATEMENT';
    subtitle = 'Direct Cash & Bank Liquidity Movements';

    sections.push({
      heading: 'Liquidity Positions',
      columns: ['Account Name', 'Current Balance ($)', 'Type'],
      rows: [
        ['Physical Cash Register & Safe', `$${metrics.cashBalance.toFixed(2)}`, 'Cash on Hand'],
        ['Commercial Bank Corporate Account', `$${metrics.bankBalance.toFixed(2)}`, 'Operating Bank'],
        ['TOTAL LIQUIDITY', `$${metrics.totalLiquidity.toFixed(2)}`, 'Total Liquid Capital']
      ]
    });
  } else if (type === 'expenses') {
    title = 'EXPENSE AUDIT REPORT';
    subtitle = 'All Operational & Capital Expenses';

    sections.push({
      heading: 'Recorded Expenses',
      columns: ['Title', 'Category', 'Amount ($)', 'Created By', 'Date'],
      rows: raw.expenses.map(e => [e.title, e.category, `$${(Number(e.amount) || 0).toFixed(2)}`, e.createdBy, new Date(e.createdAt).toLocaleDateString()])
    });
  } else if (type === 'sales') {
    title = 'SALES & REVENUE REPORT';
    subtitle = 'Customer Orders & Payment Methods';

    sections.push({
      heading: 'Completed Orders',
      columns: ['Order #', 'Customer', 'Amount ($)', 'COGS ($)', 'Profit ($)', 'Payment'],
      rows: raw.orders.filter(o => o.status === 'completed' || o.status === 'delivered' || o.prepStatus === 'delivered').map(o => {
        const amt = Number(o.totalAmount) || 0;
        const cogs = Number(o.cogs ?? (o as any).costOfGoodsSold) || 0;
        const profit = typeof o.profit === 'number' && !isNaN(o.profit) ? o.profit : (amt - cogs);
        return [
          o.orderNumber || o.id || 'Order',
          o.customerName || 'Walk-in',
          `$${amt.toFixed(2)}`,
          `$${cogs.toFixed(2)}`,
          `$${profit.toFixed(2)}`,
          (o.paymentMethod || 'cash').toUpperCase()
        ];
      })
    });
  } else if (type === 'inventory_cost') {
    title = 'INVENTORY COST & VALUATION REPORT';
    subtitle = 'Asset Value of Dishes & Kitchen Raw Ingredients';

    sections.push({
      heading: 'Raw Ingredients Inventory',
      columns: ['Ingredient Name', 'Stock Qty', 'Unit Cost ($)', 'Total Asset Value ($)', 'Supplier'],
      rows: raw.ingredients.map(i => {
        const stock = Number(i.currentStockUsageUnit ?? i.stock) || 0;
        const unitCost = Number(i.costPerUsageUnit ?? i.costPerUnit ?? (i as any).unitCost) || 0;
        return [
          i.name,
          `${stock} ${i.usageUnit || i.unit || ''}`.trim(),
          `$${unitCost.toFixed(2)}`,
          `$${(stock * unitCost).toFixed(2)}`,
          i.supplierName || 'Default Supplier'
        ];
      })
    });

    if (Array.isArray(raw.products) && raw.products.length > 0) {
      sections.push({
        heading: 'Products & Menu Stock Inventory',
        columns: ['Product Name', 'Category', 'Stock Qty', 'Unit Cost ($)', 'Total Asset Value ($)'],
        rows: raw.products.map(p => {
          const stock = Number(p.stock) || 0;
          const unitCost = Number(p.cost ?? (p as any).costPrice) || 0;
          return [
            p.name,
            p.category || 'General',
            `${stock}`,
            `$${unitCost.toFixed(2)}`,
            `$${(stock * unitCost).toFixed(2)}`
          ];
        })
      });
    }
  } else if (type === 'payroll') {
    title = 'PAYROLL & SALARY REPORT';
    subtitle = 'Staff Remuneration & Disbursements';

    const currentPeriod = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    sections.push({
      heading: 'Employee Salary Payments',
      columns: ['Employee Name', 'Role', 'Salary / Cycle ($)', 'Monthly Payroll Equivalent ($)', 'Period', 'Status'],
      rows: raw.employees.map(e => [
        e.name,
        e.role,
        `$${Number(e.salary || 0).toFixed(2)} / ${(e.payFrequency || 'monthly').toUpperCase()}`,
        `$${employeeMonthlyPayrollEquivalent(e).toFixed(2)}`,
        currentPeriod,
        getEmployeePayrollStatus(e, raw.salaries, currentPeriod)
      ])
    });
  } else if (type === 'tax') {
    title = 'TAX LIABILITY & COMPLIANCE REPORT';
    subtitle = 'Estimated VAT & Corporate Income Tax Computations';

    const vatRateReportDisplay = metrics.netRevenue > 0 && metrics.taxEstimatedVAT > 0
      ? `${((metrics.taxEstimatedVAT / metrics.netRevenue) * 100).toFixed(0)}%`
      : 'Authoritative VAT';

    sections.push({
      heading: 'Tax Calculations',
      columns: ['Tax Type', 'Tax Base Amount ($)', 'Rate', 'Tax Liability ($)'],
      rows: [
        ['Value Added Tax (VAT)', `$${metrics.netRevenue.toFixed(2)}`, vatRateReportDisplay, `$${metrics.taxEstimatedVAT.toFixed(2)}`],
        ['Corporate Net Income Tax (Configured / Provided)', `$${metrics.netProfit.toFixed(2)}`, 'Configured / Provided rate', `$${metrics.taxEstimatedCorporate.toFixed(2)}`]
      ]
    });
  }

  if (format === 'pdf') {
    downloadPDFReport(title, subtitle, sections);
  } else {
    // Flatten rows for Excel/CSV export
    const exportCols = ['Section', 'Field', 'Value / Details'];
    const exportRows: (string | number)[][] = [];

    sections.forEach(s => {
      s.rows.forEach(r => {
        exportRows.push([s.heading, r[0], r.slice(1).join(' | ')]);
      });
    });

    exportToExcel((title || 'report').toLowerCase().replace(/\s+/g, '_'), exportCols, exportRows);
  }
  return { title, subtitle, sections };
}

