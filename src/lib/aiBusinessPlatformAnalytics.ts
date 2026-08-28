import { 
  Order, 
  Product, 
  Ingredient, 
  Expense, 
  Purchase, 
  Employee, 
  SalaryPayment, 
  Supplier, 
  DeliveryDriver, 
  KitchenStation, 
  EmployeeAttendance, 
  Reservation, 
  BranchOperation, 
  CustomerFeedback, 
  EquipmentItem, 
  BankTransaction,
  Customer
} from '../types';
import { getMogadishuDateString } from './dateUtils';

export interface AIPlatformDataPackage {
  orders: Order[];
  products: Product[];
  ingredients: Ingredient[];
  expenses: Expense[];
  purchases: Purchase[];
  employees: Employee[];
  salaries: SalaryPayment[];
  suppliers: Supplier[];
  drivers?: DeliveryDriver[];
  stations?: KitchenStation[];
  attendance?: EmployeeAttendance[];
  reservations?: Reservation[];
  branches?: BranchOperation[];
  feedbacks?: CustomerFeedback[];
  equipment?: EquipmentItem[];
  bankTransactions?: BankTransaction[];
  customers?: Customer[];
}

export interface AIAlert {
  id: string;
  type: 'profit_drop' | 'sales_drop' | 'expense_increase' | 'low_stock' | 'waste_increase' | 'complaint_spike' | 'kitchen_delay';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  recommendedFix: string;
  timestamp: string;
}

export function calculateAIBusinessPlatformAnalytics(data: AIPlatformDataPackage) {
  const {
    orders = [],
    products = [],
    ingredients = [],
    expenses = [],
    purchases = [],
    employees = [],
    salaries = [],
    suppliers = [],
    drivers = [],
    stations = [],
    attendance = [],
    reservations = [],
    branches = [],
    feedbacks = [],
    equipment = [],
    bankTransactions = [],
    customers = []
  } = data;

  const todayStr = getMogadishuDateString();

  // 1. REVENUE, PROFIT & EXPENSES
  const completedOrders = orders.filter(o => o.status === 'completed' || o.prepStatus === 'delivered');
  const todayOrders = orders.filter(o => o.createdAt && o.createdAt.startsWith(todayStr));
  const todayCompleted = todayOrders.filter(o => o.status === 'completed' || o.prepStatus === 'delivered');

  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const todayRevenue = todayCompleted.reduce((sum, o) => sum + o.totalAmount, 0);

  const totalCOGS = completedOrders.reduce((sum, o) => sum + (o.cogs || 0), 0);
  const todayCOGS = todayCompleted.reduce((sum, o) => sum + (o.cogs || 0), 0);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0) + salaries.reduce((sum, s) => sum + s.amount, 0);
  const todayExpenses = expenses.filter(e => e.createdAt && e.createdAt.startsWith(todayStr)).reduce((sum, e) => sum + e.amount, 0);

  const grossProfit = totalRevenue - totalCOGS;
  const netProfit = grossProfit - totalExpenses;

  const todayGrossProfit = todayRevenue - todayCOGS;
  const todayNetProfit = todayGrossProfit - todayExpenses;

  const liquidBalance = bankTransactions.reduce((acc, t) => {
    return t.type === 'deposit' ? acc + t.amount : acc - t.amount;
  }, 0);

  // 2. ACCOUNTANT ANALYTICS & MISTAKE DETECTION
  const accountingAnomalies: Array<{ id: string; title: string; issue: string; fix: string; severity: 'high' | 'medium' }> = [];

  // Check for unassigned expense categories or unusually large single expenses
  expenses.forEach(e => {
    if (e.amount > 500) {
      accountingAnomalies.push({
        id: `anom_exp_${e.id}`,
        title: 'Unusually Large Expense Single Line Item',
        issue: `Expense "${e.title}" of $${e.amount.toFixed(2)} exceeds standard single $500 threshold.`,
        fix: 'Review supporting invoice tax receipt and verify authorization.',
        severity: 'high'
      });
    }
  });

  // Check negative margin items
  products.forEach(p => {
    if (p.cost && p.price && p.cost >= p.price) {
      accountingAnomalies.push({
        id: `anom_prod_${p.id}`,
        title: 'Negative or Zero Margin Product',
        issue: `Product "${p.name}" has cost ($${p.cost}) higher or equal to selling price ($${p.price}).`,
        fix: 'Increase retail price or renegotiate raw ingredient supplier costs.',
        severity: 'high'
      });
    }
  });

  // Check pending supplier invoices overdue
  purchases.filter(p => p.status === 'pending' || p.status === 'overdue').forEach(p => {
    accountingAnomalies.push({
      id: `anom_pur_${p.id}`,
      title: 'Pending Supplier Account Payable',
      issue: `Purchase Order from ${p.supplierName} for $${p.totalCost.toFixed(2)} remains unpaid.`,
      fix: 'Settle invoice or schedule installment payment to prevent supplier hold.',
      severity: 'medium'
    });
  });

  // 3. OPERATIONS MANAGER ANALYTICS
  const prepOrders = completedOrders.filter(o => (o.prepTimeMinutes || 0) > 0);
  const avgPrepTimeMinutes = prepOrders.length > 0 
    ? Math.round(prepOrders.reduce((sum, o) => sum + (o.prepTimeMinutes || 0), 0) / prepOrders.length) 
    : 0;
  const waitOrders = completedOrders.filter(o => (o.deliveryTimeMinutes || o.prepTimeMinutes || 0) > 0);
  const avgWaitTimeMinutes = waitOrders.length > 0 
    ? Math.round(waitOrders.reduce((sum, o) => sum + (o.deliveryTimeMinutes || o.prepTimeMinutes || 0), 0) / waitOrders.length) 
    : 0;

  const operationalRecommendations = [
    {
      title: 'Kitchen Station Batching',
      detail: avgPrepTimeMinutes > 0
        ? `Average recorded kitchen prep time is ${avgPrepTimeMinutes} min across completed orders.`
        : 'Track live ticket prep duration on KDS to establish kitchen station throughput baselines.',
      impact: avgPrepTimeMinutes > 15 ? 'High Delay Risk' : (avgPrepTimeMinutes > 0 ? 'Optimal Flow' : 'Awaiting Data')
    },
    {
      title: 'Delivery Driver Scheduling',
      detail: drivers.length > 0 
        ? `Active fleet of ${drivers.length} registered driver(s).` 
        : 'No delivery drivers registered.',
      impact: drivers.length > 0 
        ? `${drivers.filter(d => d.status === 'available').length} available now` 
        : 'Action Required'
    }
  ];

  // 4. SALES ANALYST
  const productSalesMap: Record<string, { name: string; count: number; revenue: number; stock: number }> = {};
  
  // Initialize with products
  products.forEach(p => {
    productSalesMap[p.id] = { name: p.name, count: 0, revenue: 0, stock: p.stock || 0 };
  });

  completedOrders.forEach(o => {
    (o.items || []).forEach(item => {
      if (productSalesMap[item.productId]) {
        productSalesMap[item.productId].count += item.quantity;
        productSalesMap[item.productId].revenue += item.totalPrice;
      } else {
        productSalesMap[item.productId] = {
          name: item.productName || 'Menu Item',
          count: item.quantity,
          revenue: item.totalPrice,
          stock: 0
        };
      }
    });
  });

  const productList = Object.values(productSalesMap);
  const bestSellingProducts = [...productList].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const worstSellingProducts = [...productList].sort((a, b) => a.count - b.count).slice(0, 5);

  // Peak Hours calculation (24-hour array)
  const hourlySales = Array.from({ length: 24 }, (_, hour) => {
    const hourOrders = completedOrders.filter(o => {
      if (!o.createdAt) return false;
      const d = new Date(o.createdAt);
      return d.getHours() === hour;
    });
    const rev = hourOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    return {
      hourLabel: `${hour % 12 || 12} ${hour >= 12 ? 'PM' : 'AM'}`,
      orderCount: hourOrders.length,
      revenue: rev
    };
  });

  const activeHours = hourlySales.filter(h => h.orderCount > 0);
  const peakHourItem = activeHours.length > 0 ? [...activeHours].sort((a, b) => b.revenue - a.revenue)[0] : null;
  const slowHourItem = activeHours.length > 0 ? [...activeHours].sort((a, b) => a.revenue - b.revenue)[0] : null;

  // 5. INVENTORY ANALYST
  const lowStockIngredients = ingredients.filter(i => i.stock <= (i.minStockAlert || 5));
  const overstockedIngredients = ingredients.filter(i => i.stock > (i.minStockAlert || 5) * 4);
  const totalInventoryValuation = ingredients.reduce((sum, i) => sum + (i.stock * (i.costPerUnit || 0)), 0) +
                                   products.reduce((sum, p) => sum + ((p.stock || 0) * (p.cost || (p.price || 0) * 0.5)), 0);

  const purchasingRecommendations = suppliers.map(s => {
    const suppIngs = ingredients.filter(i => i.supplierName === s.name || i.supplierId === s.id);
    const lowCount = suppIngs.filter(i => i.stock <= (i.minStockAlert || 5)).length;
    return {
      supplierId: s.id,
      supplierName: s.name,
      contactPerson: s.contactPerson || 'N/A',
      phone: s.phone || 'N/A',
      lowItemsCount: lowCount,
      suggestedOrderValuation: suppIngs.reduce((sum, i) => sum + (Math.max(0, (i.minStockAlert || 5) * 2 - i.stock) * (i.costPerUnit || 0)), 0)
    };
  }).filter(r => r.suggestedOrderValuation > 0 || r.lowItemsCount > 0);

  // 6. CUSTOMER ANALYST
  const customerList = customers;

  const totalCustomerCount = customerList.length;
  const vipCount = customerList.filter((c: any) => c.membershipLevel === 'VIP' || c.status === 'vip' || (c.totalOrders || c.orderSummary?.totalOrders || 0) >= 20).length;

  const ratedFeedbacks = feedbacks.filter(f => typeof f.rating === 'number' && f.rating > 0);
  const customerSatisfactionScore = ratedFeedbacks.length > 0 
    ? Math.round((ratedFeedbacks.filter(f => f.rating >= 4).length / ratedFeedbacks.length) * 100)
    : (completedOrders.length > 0 ? 100 : 0);

  // 7. FORECASTING ENGINES
  const projectedNextDaySales = Math.round((todayRevenue > 0 ? todayRevenue : (completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0)) * 1.08);
  const projected7DaySales = projectedNextDaySales * 7;
  const projected30DaySales = projectedNextDaySales * 30;

  const projectedMonthlyExpenses = Math.round(totalExpenses > 0 ? totalExpenses * 1.02 : 0);
  const projectedMonthlyProfit = projected30DaySales - projectedMonthlyExpenses;

  // 8. AUTOMATED REAL-TIME AI ALERTS
  const alerts: AIAlert[] = [];

  if (todayNetProfit < 0 && todayOrders.length > 0) {
    alerts.push({
      id: 'alt_profit_drop',
      type: 'profit_drop',
      severity: 'critical',
      title: 'Net Profit Deficit Detected Today',
      message: `Today's net profit is -$${Math.abs(todayNetProfit).toFixed(2)} due to overhead expenses exceeding daily revenue.`,
      recommendedFix: 'Promote high-margin combo menu items during peak evening hours.',
      timestamp: new Date().toLocaleTimeString()
    });
  }

  if (lowStockIngredients.length > 0) {
    alerts.push({
      id: 'alt_low_stock',
      type: 'low_stock',
      severity: 'warning',
      title: 'Critical Inventory Reorder Level',
      message: `${lowStockIngredients.length} kitchen ingredients have dropped below minimum stock levels.`,
      recommendedFix: 'Auto-generate purchase orders for top suppliers immediately.',
      timestamp: new Date().toLocaleTimeString()
    });
  }

  if (expenses.some(e => e.createdAt && e.createdAt.startsWith(todayStr) && e.amount > 300)) {
    alerts.push({
      id: 'alt_exp_spike',
      type: 'expense_increase',
      severity: 'warning',
      title: 'Daily Operating Expense Surge',
      message: 'Unusually high single expense recorded today.',
      recommendedFix: 'Verify ledger authorization with department manager.',
      timestamp: new Date().toLocaleTimeString()
    });
  }

  if (feedbacks.some(f => f.rating <= 2)) {
    alerts.push({
      id: 'alt_complaint',
      type: 'complaint_spike',
      severity: 'warning',
      title: 'Customer Satisfaction Complaint Logged',
      message: 'Low rating feedback received regarding order wait time or food temperature.',
      recommendedFix: 'Issue complimentary loyalty bonus points to customer.',
      timestamp: new Date().toLocaleTimeString()
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: 'alt_healthy',
      type: 'profit_drop',
      severity: 'info',
      title: 'Optimal ERP Operational State',
      message: 'All core modules (Sales, Kitchen, Inventory, Staff) are performing within optimal target ranges.',
      recommendedFix: 'Maintain current inventory turnover and staff shift coverage.',
      timestamp: new Date().toLocaleTimeString()
    });
  }

  // BUSINESS HEALTH SCORE
  const healthScore = Math.min(100, Math.max(40, Math.round(
    (todayNetProfit >= 0 ? 25 : 10) +
    (lowStockIngredients.length === 0 ? 20 : 10) +
    (customerSatisfactionScore * 0.25) +
    (completedOrders.length > 0 ? 20 : 10) +
    (accountingAnomalies.length === 0 ? 10 : 5)
  )));

  let healthRating = 'Good';
  if (healthScore >= 90) healthRating = 'Excellent';
  else if (healthScore >= 75) healthRating = 'Good';
  else if (healthScore >= 60) healthRating = 'Average';
  else healthRating = 'Poor';

  return {
    healthScore,
    healthRating,
    todayRevenue,
    todayExpenses,
    todayNetProfit,
    todayGrossProfit,
    totalRevenue,
    totalExpenses,
    netProfit,
    liquidBalance,
    todayOrdersCount: todayOrders.length,
    todayCompletedCount: todayCompleted.length,
    
    // Accountant
    accountingAnomalies,

    // Operations
    avgPrepTimeMinutes,
    avgWaitTimeMinutes,
    operationalRecommendations,

    // Sales Analyst
    bestSellingProducts,
    worstSellingProducts,
    hourlySales,
    peakHourLabel: peakHourItem?.hourLabel || 'N/A',
    slowHourLabel: slowHourItem?.hourLabel || 'N/A',

    // Inventory Analyst
    lowStockIngredients,
    overstockedIngredients,
    totalInventoryValuation,
    purchasingRecommendations,

    // Customer Analyst
    totalCustomerCount,
    vipCount,
    customerSatisfactionScore,
    customerList,

    // Forecasting
    projectedNextDaySales,
    projected7DaySales,
    projected30DaySales,
    projectedMonthlyExpenses,
    projectedMonthlyProfit,

    // Alerts
    alerts
  };
}
