import jsPDF from 'jspdf';
import autoTableFunc from 'jspdf-autotable';
import { Order, Expense, Product, Ingredient, Employee, Purchase, Supplier, CPAMetrics, CustomerRefund, BankTransaction, SalaryPayment } from '../types';

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
    (item.quantity || 1).toString(),
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

export function exportToExcel(filename: string, columns: string[], rows: (string | number)[][]) {
  // UTF-8 BOM for Arabic/Somali & Excel encoding compatibility
  let csvContent = '\uFEFF';
  csvContent += columns.map(col => `"${col.replace(/"/g, '""')}"`).join(',') + '\n';

  rows.forEach(row => {
    csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${Date.now()}.csv`);
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

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
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
          <h1 class="title">${title}</h1>
          <div class="subtitle">${subtitle} | Generated: ${new Date().toLocaleString()}</div>
        </div>
        ${sections.map(sec => `
          <div class="section">
            <div class="section-title">${sec.heading}</div>
            <table>
              <thead>
                <tr>
                  ${sec.columns.map(col => `<th>${col}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${sec.rows.map(row => `
                  <tr>
                    ${row.map(cell => `<td>${cell}</td>`).join('')}
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

  if (type === 'daily' || type === 'weekly' || type === 'monthly' || type === 'yearly') {
    title = `${type.toUpperCase()} CPA FINANCIAL REPORT`;
    subtitle = `Audit Period: ${type.toUpperCase()} | Real-time Firestore Ledger Data`;

    sections.push({
      heading: 'Executive Financial Summary',
      columns: ['KPI Metric', 'Amount ($)', 'Benchmarking / Analysis'],
      rows: [
        ['Sales Revenue', `$${(type === 'daily' ? metrics.dailySales : type === 'weekly' ? metrics.weeklySales : type === 'monthly' ? metrics.monthlySales : metrics.yearlySales).toFixed(2)}`, 'Gross Sales Collected'],
        ['Net Revenue', `$${metrics.netRevenue.toFixed(2)}`, 'Gross Revenue minus Customer Refunds'],
        ['Cost of Goods Sold (COGS)', `$${metrics.cogs.toFixed(2)}`, `Food Cost %: ${metrics.foodCostPercentage.toFixed(1)}% (Target < 35%)`],
        ['Gross Profit', `$${metrics.grossProfit.toFixed(2)}`, 'Net Revenue - COGS'],
        ['Operating & Labor Expenses', `$${metrics.totalExpenses.toFixed(2)}`, `Labor %: ${metrics.laborCostPercentage.toFixed(1)}%`],
        ['Net Operating Profit', `$${metrics.netProfit.toFixed(2)}`, `Margin: ${metrics.netProfitMargin.toFixed(1)}%`]
      ]
    });
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
        ['Estimated Corporate Income Tax (15%)', `$${metrics.taxEstimatedCorporate.toFixed(2)}`]
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
      rows: raw.expenses.map(e => [e.title, e.category, `$${e.amount.toFixed(2)}`, e.createdBy, new Date(e.createdAt).toLocaleDateString()])
    });
  } else if (type === 'sales') {
    title = 'SALES & REVENUE REPORT';
    subtitle = 'Customer Orders & Payment Methods';

    sections.push({
      heading: 'Completed Orders',
      columns: ['Order #', 'Customer', 'Amount ($)', 'COGS ($)', 'Profit ($)', 'Payment'],
      rows: raw.orders.filter(o => o.status === 'completed').map(o => [
        o.orderNumber || o.id || 'Order',
        o.customerName || 'Walk-in',
        `$${(o.totalAmount || 0).toFixed(2)}`,
        `$${(o.cogs || 0).toFixed(2)}`,
        `$${(o.profit || 0).toFixed(2)}`,
        (o.paymentMethod || 'cash').toUpperCase()
      ])
    });
  } else if (type === 'inventory_cost') {
    title = 'INVENTORY COST & VALUATION REPORT';
    subtitle = 'Asset Value of Dishes & Kitchen Raw Ingredients';

    sections.push({
      heading: 'Raw Ingredients Inventory',
      columns: ['Ingredient Name', 'Stock Qty', 'Unit Cost ($)', 'Total Asset Value ($)', 'Supplier'],
      rows: raw.ingredients.map(i => [
        i.name,
        `${i.stock} ${i.unit}`,
        `$${i.costPerUnit.toFixed(2)}`,
        `$${(i.stock * i.costPerUnit).toFixed(2)}`,
        i.supplierName
      ])
    });
  } else if (type === 'payroll') {
    title = 'PAYROLL & SALARY REPORT';
    subtitle = 'Staff Remuneration & Disbursements';

    sections.push({
      heading: 'Employee Salary Payments',
      columns: ['Employee Name', 'Role', 'Monthly Salary ($)', 'Period', 'Status'],
      rows: raw.employees.map(e => [
        e.name,
        e.role,
        `$${e.salary.toFixed(2)}`,
        new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        'PAID'
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
        ['Corporate Net Income Tax', `$${metrics.netProfit.toFixed(2)}`, '15%', `$${metrics.taxEstimatedCorporate.toFixed(2)}`]
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
}

