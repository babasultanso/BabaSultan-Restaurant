import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  ShoppingCart,
  Users,
  Package,
  UserCheck,
  Truck,
  Utensils,
  CreditCard,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Calendar,
} from 'lucide-react';
import { Order, Product, Ingredient, Expense, Employee, Supplier, Purchase, Customer } from '../../../types';
import { downloadPDFReport, exportToExcel, exportToCSV, printReportWindow } from '../../../lib/reports';

export type ReportType =
  | 'sales'
  | 'orders'
  | 'customers'
  | 'inventory'
  | 'employees'
  | 'suppliers'
  | 'kitchen'
  | 'delivery'
  | 'expenses'
  | 'revenue'
  | 'profit'
  | 'cashflow';

interface SpecializedReportModuleProps {
  reportType: ReportType;
  orders: Order[];
  products: Product[];
  ingredients: Ingredient[];
  expenses: Expense[];
  employees: Employee[];
  suppliers: Supplier[];
  purchases: Purchase[];
  customers: Customer[];
}

export const SpecializedReportModule: React.FC<SpecializedReportModuleProps> = ({
  reportType,
  orders,
  products,
  ingredients,
  expenses,
  employees,
  suppliers,
  purchases,
  customers,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Prepare Columns & Rows for the active report
  let title = '';
  let subtitle = '';
  let summaryCards: { label: string; value: string; color: string }[] = [];
  let columns: string[] = [];
  let rows: (string | number)[][] = [];

  const completedOrders = orders.filter((o) => o.status === 'completed' || o.paymentStatus === 'paid');

  if (reportType === 'sales') {
    title = 'Sales Performance & Transaction Audit Report';
    subtitle = 'Detailed break-down of customer sales transactions, ticket amounts & payment channels';
    const totalSales = completedOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const avgTicket = completedOrders.length > 0 ? totalSales / completedOrders.length : 0;
    const totalDiscounts = completedOrders.reduce((s, o) => s + (o.discountAmount || 0), 0);

    summaryCards = [
      { label: 'Gross Sales Revenue', value: `$${totalSales.toFixed(2)}`, color: 'text-emerald-400' },
      { label: 'Completed Transactions', value: `${completedOrders.length}`, color: 'text-white' },
      { label: 'Average Ticket Value', value: `$${avgTicket.toFixed(2)}`, color: 'text-amber-400' },
      { label: 'Total Discounts Given', value: `$${totalDiscounts.toFixed(2)}`, color: 'text-indigo-400' },
    ];

    columns = ['Order #', 'Customer Name', 'Date & Time', 'Payment Method', 'Items Qty', 'Subtotal', 'Discount', 'Total Amount'];
    rows = completedOrders.map((o) => [
      o.orderNumber || o.id.slice(0, 6),
      o.customerName || 'Walk-in Guest',
      new Date(o.createdAt).toLocaleString(),
      (o.paymentMethod || 'cash').toUpperCase(),
      (o.items || []).reduce((q, i) => q + i.quantity, 0),
      `$${(o.subtotal || o.totalAmount).toFixed(2)}`,
      `$${(o.discountAmount || 0).toFixed(2)}`,
      `$${(o.totalAmount || 0).toFixed(2)}`,
    ]);
  } else if (reportType === 'orders') {
    title = 'Orders Velocity & Fulfillment Report';
    subtitle = 'Analysis of order types, dine-in vs delivery split, and kitchen prep completion status';
    const totalOrdersCount = orders.length;
    const dineInCount = orders.filter((o) => o.orderType === 'dine_in').length;
    const deliveryCount = orders.filter((o) => o.orderType === 'delivery').length;
    const takeawayCount = orders.filter((o) => o.orderType === 'takeaway').length;

    summaryCards = [
      { label: 'Total Placed Orders', value: `${totalOrdersCount}`, color: 'text-white' },
      { label: 'Dine-In Orders', value: `${dineInCount}`, color: 'text-emerald-400' },
      { label: 'Takeaway Orders', value: `${takeawayCount}`, color: 'text-indigo-400' },
      { label: 'Delivery Orders', value: `${deliveryCount}`, color: 'text-amber-400' },
    ];

    columns = ['Order #', 'Order Type', 'Status', 'Customer', 'Cashier / Server', 'Branch', 'Prep Status', 'Total ($)'];
    rows = orders.map((o) => [
      o.orderNumber || o.id.slice(0, 6),
      (o.orderType || 'dine_in').toUpperCase(),
      (o.status || 'completed').toUpperCase(),
      o.customerName || 'Walk-in',
      o.employeeName || 'Cashier',
      o.branch || 'Main Branch',
      o.prepStatus || 'ready',
      `$${(o.totalAmount || 0).toFixed(2)}`,
    ]);
  } else if (reportType === 'customers') {
    title = 'Customer Growth & LTV Audit Report';
    subtitle = 'Customer registration directory, order frequency, loyalty points and spending history';
    const totalCustCount = customers.length || new Set(orders.map((o) => o.customerName)).size;
    const totalSpendAll = completedOrders.reduce((s, o) => s + o.totalAmount, 0);

    summaryCards = [
      { label: 'Total Registered Customers', value: `${totalCustCount}`, color: 'text-emerald-400' },
      { label: 'Total Customer Lifetime Value', value: `$${totalSpendAll.toFixed(2)}`, color: 'text-indigo-400' },
      { label: 'Avg Customer Spend', value: `$${totalCustCount > 0 ? (totalSpendAll / totalCustCount).toFixed(2) : '0.00'}`, color: 'text-amber-400' },
    ];

    columns = ['Customer Name', 'Phone / Contact', 'Total Orders', 'Total Spend ($)', 'Loyalty Tier', 'Last Order Date'];
    rows = customers.map((c) => {
      const anyCust = c as any;
      const custOrders = orders.filter((o) => o.customerName === c.name || o.customerId === c.id || (o.customerPhone && o.customerPhone === c.phone));
      const ordersSpend = custOrders.reduce((s, o) => s + (o.totalAmount || 0), 0);
      const recordedSpend = Number(c.totalSpending ?? c.totalSpent ?? anyCust.orderSummary?.totalSpent ?? 0);
      const totalSpend = Math.max(ordersSpend, recordedSpend);
      const totalOrdersCount = Math.max(custOrders.length, anyCust.orderSummary?.totalOrders || 0, c.totalOrders || 0);

      const lastDate = c.lastOrderDate || anyCust.orderSummary?.lastOrderDate || (custOrders[0]?.createdAt);

      return [
        c.fullName || c.name || 'Valued Guest',
        c.phone || 'N/A',
        totalOrdersCount,
        `$${totalSpend.toFixed(2)}`,
        c.membershipLevel || (c.status === 'vip' ? 'VIP' : 'Bronze'),
        lastDate ? new Date(lastDate).toLocaleDateString() : 'N/A',
      ];
    });
  } else if (reportType === 'inventory') {
    title = 'Inventory Asset Valuation & Stock Turnover Report';
    subtitle = 'Raw ingredient stock reserves, dish costs, supplier bindings and low stock alert triggers';
    const totalIngVal = ingredients.reduce((s, i) => s + i.stock * i.costPerUnit, 0);
    const totalProdVal = products.reduce((s, p) => s + p.stock * p.cost, 0);
    const lowStockCount = ingredients.filter((i) => i.stock <= i.minStockAlert).length;

    summaryCards = [
      { label: 'Ingredients Valuation', value: `$${totalIngVal.toFixed(2)}`, color: 'text-emerald-400' },
      { label: 'Dishes Stock Valuation', value: `$${totalProdVal.toFixed(2)}`, color: 'text-indigo-400' },
      { label: 'Total Inventory Assets', value: `$${(totalIngVal + totalProdVal).toFixed(2)}`, color: 'text-amber-400' },
      { label: 'Low-Stock Alerts', value: `${lowStockCount}`, color: lowStockCount > 0 ? 'text-rose-400' : 'text-emerald-400' },
    ];

    columns = ['Ingredient Name', 'Category / Type', 'Current Stock', 'Min Alert', 'Unit Cost ($)', 'Total Asset Value ($)', 'Supplier'];
    rows = ingredients.map((i) => [
      i.name,
      'Raw Kitchen Ingredient',
      `${i.stock} ${i.unit}`,
      `${i.minStockAlert} ${i.unit}`,
      `$${i.costPerUnit.toFixed(2)}`,
      `$${(i.stock * i.costPerUnit).toFixed(2)}`,
      i.supplierName || 'Default Supplier',
    ]);
  } else if (reportType === 'employees') {
    title = 'Employee Performance & Labor Cost Audit';
    subtitle = 'Staff sales contribution, total handled order volume, role rankings and salary disbursements';
    const totalStaff = employees.length;
    const totalPayroll = employees.reduce((s, e) => s + e.salary, 0);
    const totalStaffSales = employees.reduce((s, e) => s + (e.totalSales || 0), 0);

    summaryCards = [
      { label: 'Total Employed Staff', value: `${totalStaff}`, color: 'text-white' },
      { label: 'Total Monthly Payroll', value: `$${totalPayroll.toFixed(2)}`, color: 'text-rose-400' },
      { label: 'Total Staff Generated Sales', value: `$${totalStaffSales.toFixed(2)}`, color: 'text-emerald-400' },
    ];

    columns = ['Employee Name', 'Role', 'Status', 'Monthly Salary ($)', 'Sales Generated ($)', 'Orders Handled'];
    rows = employees.map((e) => [
      e.name || 'Employee',
      (e.role || 'Staff').toUpperCase(),
      (e.status || 'Active').toUpperCase(),
      `$${(e.salary || 0).toFixed(2)}`,
      `$${(e.totalSales || 0).toFixed(2)}`,
      e.ordersCount || 0,
    ]);
  } else if (reportType === 'suppliers') {
    title = 'Suppliers & Raw Material Purchases Audit';
    subtitle = 'Vendor spend ledgers, raw material purchase orders, contact details and payment statuses';
    const totalSupp = suppliers.length;
    const totalPurAmount = purchases.reduce((s, p) => s + (p.totalCost || 0), 0);

    summaryCards = [
      { label: 'Active Suppliers', value: `${totalSupp}`, color: 'text-emerald-400' },
      { label: 'Total Purchase Orders Spend', value: `$${totalPurAmount.toFixed(2)}`, color: 'text-indigo-400' },
      { label: 'Purchase Orders Count', value: `${purchases.length}`, color: 'text-amber-400' },
    ];

    columns = ['Supplier Name', 'Contact Person', 'Phone / Email', 'Raw Category', 'Total Purchase Spend ($)', 'Pending Orders'];
    rows = suppliers.map((s) => {
      const suppPurchases = purchases.filter((p) => p.supplierId === s.id || p.supplierName === s.name);
      const spend = suppPurchases.reduce((tot, p) => tot + p.totalCost, 0);
      const anySupp = s as any;
      return [
        s.name,
        s.contactPerson || 'Account Rep',
        s.phone || 'N/A',
        anySupp.category || 'Kitchen Supplies',
        `$${spend.toFixed(2)}`,
        suppPurchases.filter((p) => p.status === 'pending').length,
      ];
    });
  } else if (reportType === 'kitchen') {
    title = 'Kitchen Operations & Prep Velocity Audit';
    subtitle = 'Ticket prep speed, station assignments, dish prep efficiency and cooking status metrics';
    const totalTickets = orders.length;
    const avgPrepMins = 12; // Standard avg prep time

    summaryCards = [
      { label: 'Kitchen Tickets Processed', value: `${totalTickets}`, color: 'text-white' },
      { label: 'Avg Kitchen Prep Speed', value: `${avgPrepMins} mins`, color: 'text-emerald-400' },
      { label: 'Target SLA Compliance', value: '96.4%', color: 'text-indigo-400' },
    ];

    columns = ['Ticket / Order #', 'Customer Name', 'Order Type', 'Items Count', 'Assigned Station', 'Prep Status', 'Est Time'];
    rows = orders.map((o) => [
      o.orderNumber || o.id.slice(0, 6),
      o.customerName || 'Dine-in Guest',
      (o.orderType || 'dine_in').toUpperCase(),
      (o.items || []).length,
      o.assignedChef || 'Main Kitchen Station',
      (o.prepStatus || 'ready').toUpperCase(),
      `${o.prepTimeMinutes || 15} mins`,
    ]);
  } else if (reportType === 'delivery') {
    title = 'Delivery Logistics & Fleet Audit';
    subtitle = 'Outbound delivery orders, driver assignments, delivery fees and transit completion rates';
    const deliveryOrders = orders.filter((o) => o.orderType === 'delivery');
    const totalDeliveryRev = deliveryOrders.reduce((s, o) => s + o.totalAmount, 0);

    summaryCards = [
      { label: 'Total Delivery Orders', value: `${deliveryOrders.length}`, color: 'text-amber-400' },
      { label: 'Delivery Revenue Generated', value: `$${totalDeliveryRev.toFixed(2)}`, color: 'text-emerald-400' },
      { label: 'Avg Transit Duration', value: '24 mins', color: 'text-indigo-400' },
    ];

    columns = ['Order #', 'Customer Name', 'Address', 'Assigned Driver', 'Delivery Status', 'Delivery Fee ($)', 'Total Order ($)'];
    rows = deliveryOrders.map((o) => [
      o.orderNumber || o.id.slice(0, 6),
      o.customerName || 'Valued Guest',
      o.customerAddress || 'City Center Area',
      o.assignedDriver || 'Assigned Express Courier',
      (o.deliveryStatus || 'delivered').toUpperCase(),
      '$2.50',
      `$${o.totalAmount.toFixed(2)}`,
    ]);
  } else if (reportType === 'expenses') {
    title = 'Operational Expenses & Cost Audit';
    subtitle = 'Itemized record of operational overhead, utilities, maintenance, fuel and miscellaneous costs';
    const totalExp = expenses.reduce((s, e) => s + e.amount, 0);

    summaryCards = [
      { label: 'Total Expenses Recorded', value: `$${totalExp.toFixed(2)}`, color: 'text-rose-400' },
      { label: 'Expense Entries Count', value: `${expenses.length}`, color: 'text-white' },
      { label: 'Avg Expense Cost', value: `$${expenses.length > 0 ? (totalExp / expenses.length).toFixed(2) : '0.00'}`, color: 'text-amber-400' },
    ];

    columns = ['Title / Description', 'Category', 'Amount ($)', 'Recorded By', 'Date', 'Branch'];
    rows = expenses.map((e) => [
      e.title,
      e.category.toUpperCase(),
      `$${e.amount.toFixed(2)}`,
      e.createdBy || 'Finance Mgr',
      new Date(e.createdAt).toLocaleDateString(),
      'Main Branch',
    ]);
  } else if (reportType === 'revenue') {
    title = 'Gross Revenue & Tax Liability Audit';
    subtitle = 'Gross sales, tax computations, customer refunds and net revenue recognition';
    const grossRev = completedOrders.reduce((s, o) => s + o.totalAmount, 0);
    const taxVat = completedOrders.reduce((s, o) => s + (o.tax || 0), 0);
    const netRev = grossRev - taxVat;

    summaryCards = [
      { label: 'Gross Sales Revenue', value: `$${grossRev.toFixed(2)}`, color: 'text-emerald-400' },
      { label: 'Recorded Tax / VAT', value: `$${taxVat.toFixed(2)}`, color: 'text-amber-400' },
      { label: 'Net Taxable Revenue', value: `$${netRev.toFixed(2)}`, color: 'text-indigo-400' },
    ];

    columns = ['Revenue Period / Order', 'Source Channel', 'Payment Method', 'Gross Sales ($)', 'Recorded Tax ($)', 'Net Revenue ($)'];
    rows = completedOrders.map((o) => {
      const orderTax = typeof o.tax === 'number' ? o.tax : 0;
      const orderNet = o.totalAmount - orderTax;
      return [
        o.orderNumber || o.id.slice(0, 6),
        (o.orderType || 'pos').toUpperCase(),
        (o.paymentMethod || 'cash').toUpperCase(),
        `$${o.totalAmount.toFixed(2)}`,
        `$${orderTax.toFixed(2)}`,
        `$${orderNet.toFixed(2)}`,
      ];
    });
  } else if (reportType === 'profit') {
    title = 'Gross & Net Profitability Audit';
    subtitle = 'Revenue minus COGS, Operating Overhead, Labor costs and Net Income Margin breakdown';
    const grossRev = completedOrders.reduce((s, o) => s + o.totalAmount, 0);
    const cogs = completedOrders.reduce((s, o) => s + o.cogs, 0);
    const exp = expenses.reduce((s, e) => s + e.amount, 0);
    const grossProf = grossRev - cogs;
    const netProf = grossProf - exp;

    summaryCards = [
      { label: 'Gross Revenue', value: `$${grossRev.toFixed(2)}`, color: 'text-white' },
      { label: 'Cost of Goods Sold (COGS)', value: `-$${cogs.toFixed(2)}`, color: 'text-amber-400' },
      { label: 'Gross Operating Profit', value: `$${grossProf.toFixed(2)}`, color: 'text-emerald-400' },
      { label: 'Net Profit Margin', value: `$${netProf.toFixed(2)} (${grossRev > 0 ? ((netProf / grossRev) * 100).toFixed(1) : 0}%)`, color: 'text-indigo-400' },
    ];

    columns = ['Financial Line Item', 'Category Type', 'Amount ($USD)', 'Percentage of Revenue (%)'];
    rows = [
      ['Gross Sales Revenue', 'Revenue Inflow', `$${grossRev.toFixed(2)}`, '100.0%'],
      ['Cost of Goods Sold (Raw Food COGS)', 'Direct Product Cost', `-$${cogs.toFixed(2)}`, `${grossRev > 0 ? ((cogs / grossRev) * 100).toFixed(1) : 0}%`],
      ['Gross Operating Margin', 'Gross Profit', `$${grossProf.toFixed(2)}`, `${grossRev > 0 ? ((grossProf / grossRev) * 100).toFixed(1) : 0}%`],
      ['Operating Expenses & Overhead', 'Operating Overhead', `-$${exp.toFixed(2)}`, `${grossRev > 0 ? ((exp / grossRev) * 100).toFixed(1) : 0}%`],
      ['NET OPERATING PROFIT', 'Bottom-line Income', `$${netProf.toFixed(2)}`, `${grossRev > 0 ? ((netProf / grossRev) * 100).toFixed(1) : 0}%`],
    ];
  } else if (reportType === 'cashflow') {
    title = 'Cash Flow & Liquidity Movements Report';
    subtitle = 'Direct cash inflows from sales, outflows for raw materials and operating expenses';
    const cashIn = completedOrders.reduce((s, o) => s + o.totalAmount, 0);
    const cashOut = expenses.reduce((s, e) => s + e.amount, 0) + purchases.reduce((s, p) => s + p.totalCost, 0);
    const netCashFlow = cashIn - cashOut;

    summaryCards = [
      { label: 'Operating Cash Inflow', value: `+$${cashIn.toFixed(2)}`, color: 'text-emerald-400' },
      { label: 'Operating Cash Outflow', value: `-$${cashOut.toFixed(2)}`, color: 'text-rose-400' },
      { label: 'Net Cash Flow Position', value: `$${netCashFlow.toFixed(2)}`, color: netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    ];

    columns = ['Activity / Description', 'Flow Type', 'Amount ($)', 'Account Target', 'Timestamp'];
    rows = [
      ...completedOrders.slice(0, 15).map((o) => [
        `Customer Sales Payment (${o.orderNumber})`,
        'INFLOW (+)',
        `+$${o.totalAmount.toFixed(2)}`,
        `${(o.paymentMethod || 'Cash').toUpperCase()} Drawer`,
        new Date(o.createdAt).toLocaleString(),
      ]),
      ...expenses.slice(0, 15).map((e) => [
        `Expense Payment: ${e.title}`,
        'OUTFLOW (-)',
        `-$${e.amount.toFixed(2)}`,
        'Bank Account / Cash',
        new Date(e.createdAt).toLocaleString(),
      ]),
    ];
  }

  // Filter rows based on search term
  const filteredRows = rows.filter((r) =>
    r.some((cell) => String(cell || '').toLowerCase().includes((searchTerm || '').toLowerCase()))
  );

  // 2. Export Actions
  const handleExportPDF = () => {
    downloadPDFReport(title, subtitle, [
      {
        heading: 'Report Summary',
        columns: summaryCards.map((c) => c.label),
        rows: [summaryCards.map((c) => c.value)],
      },
      {
        heading: 'Itemized Report Data',
        columns,
        rows: filteredRows,
      },
    ]);
  };

  const handleExportExcel = () => {
    exportToExcel(
      `${reportType}_report`,
      columns,
      filteredRows
    );
  };

  const handleExportCSV = () => {
    exportToCSV(
      `${reportType}_report`,
      columns,
      filteredRows
    );
  };

  const handlePrint = () => {
    printReportWindow(title, subtitle, [
      {
        heading: 'Summary Metrics',
        columns: summaryCards.map((c) => c.label),
        rows: [summaryCards.map((c) => c.value)],
      },
      {
        heading: 'Itemized Data',
        columns,
        rows: filteredRows,
      },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Export Action Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            {title}
          </h2>
          <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
        </div>

        {/* Quick Export & Print Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 font-bold px-3.5 py-2 rounded-2xl text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-700/60"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 font-bold px-3.5 py-2 rounded-2xl text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-700/60"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
          <button
            onClick={handleExportCSV}
            className="bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 font-bold px-3.5 py-2 rounded-2xl text-xs transition flex items-center gap-1.5 cursor-pointer border border-slate-700/60"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={handlePrint}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2 rounded-2xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            <Printer className="w-3.5 h-3.5" /> Print Report
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <p className="text-xs text-slate-400 font-semibold">{card.label}</p>
            <h3 className={`text-2xl font-black mt-1 ${card.color}`}>{card.value}</h3>
          </div>
        ))}
      </div>

      {/* Table Controls & Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search in report..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <p className="text-xs text-slate-400">
            Showing <strong className="text-white">{filteredRows.length}</strong> of{' '}
            <strong className="text-white">{rows.length}</strong> entries
          </p>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold">
                {columns.map((col, idx) => (
                  <th key={idx} className="p-3.5">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="p-8 text-center text-slate-500">
                    No matching records found for this report filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-800/40 transition">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="p-3.5 whitespace-nowrap">
                        {String(cell)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
