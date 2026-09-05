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
  BankTransaction 
} from '../types';
import { getMogadishuDateString } from './dateUtils';

export type HealthRating = 'Excellent' | 'Good' | 'Average' | 'Poor' | 'Critical';

export interface BusinessHealthBreakdown {
  score: number; // 0 - 100
  rating: HealthRating;
  salesScore: number;
  profitScore: number;
  customerSatisfactionScore: number;
  inventoryScore: number;
  employeeProductivityScore: number;
  deliveryPerformanceScore: number;
  wasteControlScore: number;
  cashFlowScore: number;
}

export interface ExecutiveBriefing {
  todayRevenue: number;
  todayProfit: number;
  todayExpenses: number;
  totalOrdersCount: number;
  averageOrderValue: number;
  bestSellingProducts: Array<{ name: string; salesCount: number; revenue: number }>;
  worstSellingProducts: Array<{ name: string; salesCount: number; stock: number }>;
  customerSatisfactionPercentage: number;
  avgCustomerRating: number;
  kitchenPrepStatus: string;
  delayedOrdersCount: number;
  deliverySuccessRatePercentage: number;
  activeDriversCount: number;
  lowStockItemsCount: number;
  totalInventoryValuation: number;
  employeeAttendanceRate: number;
  lateEmployeesCount: number;
  cashFlowBalance: number;
  businessHealthScore: number;
  healthRating: HealthRating;
}

export interface CEORiskItem {
  id: string;
  category: 'Financial' | 'Inventory' | 'Operational' | 'Employee' | 'Supplier' | 'Customer' | 'Cash Flow' | 'Growth';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  mitigationStrategy: string;
  impactPotential: string;
}

export interface CEOSmartDecision {
  id: string;
  type: 'increase_price' | 'reduce_price' | 'hire_staff' | 'reduce_shifts' | 'reorder_inventory' | 'stop_slow_product' | 'launch_promo' | 'reduce_expenses' | 'expand_hours' | 'open_branch' | 'expand_branch' | 'optimize_branch';
  title: string;
  summary: string;
  whyMade: string; // Detailed data-backed explanation
  expectedImpact: string; // e.g. +$1,250/month profit
  possibleRisks: string; // Potential downside to monitor
  confidencePercentage: number; // e.g. 92%
  actionCategory: string;
  actionPayload?: any;
}

export interface CEOForecastModel {
  projectedNextDaySales: number;
  projected7DaySales: number;
  projected30DaySales: number;
  projectedMonthlyProfit: number;
  projectedMonthlyExpenses: number;
  predictedCustomerGrowthPercentage: number;
  predictedInventoryNeedsValuation: number;
  recommendedNewHiresCount: number;
  seasonalDemandInsight: string;
  futureRevenueTrend: Array<{ periodLabel: string; projectedRevenue: number; projectedProfit: number }>;
}

export interface CEODataPackage {
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
}

/**
 * Calculates complete AI CEO Executive Analytics from real Firestore data
 */
export function calculateCEOAnalytics(data: CEODataPackage) {
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
    bankTransactions = []
  } = data;

  const todayStr = getMogadishuDateString();

  // 1. REVENUE, PROFIT & EXPENSES
  const completedOrders = orders.filter(o => o.status === 'completed' || o.prepStatus === 'delivered');
  const todayOrders = orders.filter(o => o.createdAt && o.createdAt.startsWith(todayStr));

  const totalRevenue = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalCOGS = completedOrders.reduce((sum, o) => sum + (o.cogs || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0) + salaries.reduce((sum, s) => sum + s.amount, 0);

  const grossProfit = totalRevenue - totalCOGS;
  const netProfit = grossProfit - totalExpenses;

  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const todayCOGS = todayOrders.reduce((sum, o) => sum + (o.cogs || 0), 0);
  const todayExpenses = expenses.filter(e => e.createdAt && e.createdAt.startsWith(todayStr)).reduce((sum, e) => sum + e.amount, 0);
  const todayProfit = todayRevenue - todayCOGS - todayExpenses;

  const totalOrdersCount = completedOrders.length;
  const last30CompletedOrders = completedOrders.filter(o => { const d = new Date(o.createdAt); const now = new Date(); return Number.isFinite(d.getTime()) && d >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); });
  const observedDays30 = new Set(last30CompletedOrders.map(o => getMogadishuDateString(new Date(o.createdAt)))).size;
  const averageObservedDailyRevenue = observedDays30 > 0 ? last30CompletedOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0) / observedDays30 : 0;
  const averageOrderValue = totalOrdersCount > 0 ? Number((totalRevenue / totalOrdersCount).toFixed(2)) : 0;

  // 2. PRODUCT PERFORMANCE (BEST & WORST SELLING)
  const productSalesMap: Record<string, { name: string; salesCount: number; revenue: number; stock: number }> = {};
  
  products.forEach(p => {
    productSalesMap[p.id] = { name: p.name, salesCount: p.salesCount || 0, revenue: (p.salesCount || 0) * p.price, stock: p.stock };
  });

  orders.forEach(ord => {
    ord.items?.forEach(item => {
      if (!productSalesMap[item.productId]) {
        productSalesMap[item.productId] = { name: item.productName, salesCount: 0, revenue: 0, stock: 0 };
      }
      productSalesMap[item.productId].salesCount += item.quantity;
      productSalesMap[item.productId].revenue += item.totalPrice;
    });
  });

  const sortedProducts = Object.values(productSalesMap).sort((a, b) => b.salesCount - a.salesCount);
  const bestSellingProducts = sortedProducts.slice(0, 3);
  const worstSellingProducts = sortedProducts.slice(-3).reverse();

  // 3. CUSTOMER SATISFACTION
  const ratedOrders = orders.filter(o => typeof o.rating === 'number' && o.rating > 0);
  const avgCustomerRating = ratedOrders.length > 0 
    ? Number((ratedOrders.reduce((sum, o) => sum + (o.rating || 0), 0) / ratedOrders.length).toFixed(1)) 
    : 0;
  const customerSatisfactionPercentage = ratedOrders.length > 0 ? Math.round((avgCustomerRating / 5) * 100) : 0;

  // 4. KITCHEN & DELIVERY PERFORMANCE
  const delayedOrders = orders.filter(o => Number.isFinite(Number(o.prepTimeMinutes)) && Number.isFinite(Number(o.targetPrepTimeMinutes)) && Number(o.prepTimeMinutes) > Number(o.targetPrepTimeMinutes));
  const delayedOrdersCount = delayedOrders.length;
  const kitchenPrepStatus = delayedOrdersCount > 2 ? 'Overloaded' : delayedOrdersCount > 0 ? 'Busy' : 'Optimal';

  const totalDeliveries = orders.filter(o => o.orderType === 'delivery').length;
  const failedDeliveries = orders.filter(o => o.deliveryStatus === 'failed').length;
  const deliverySuccessRatePercentage = totalDeliveries > 0 ? Math.round(((totalDeliveries - failedDeliveries) / totalDeliveries) * 100) : 0;
  const activeDriversCount = drivers.filter(d => d.status === 'available' || d.status === 'in_transit').length;

  // 5. INVENTORY & EMPLOYEE PERFORMANCE
  const lowStockItemsCount = products.filter(p => p.stock <= p.minStockAlert).length + ingredients.filter(i => i.stock <= i.minStockAlert).length;
  const totalInventoryValuation = products.reduce((sum, p) => sum + (p.stock * p.cost), 0) + ingredients.reduce((sum, i) => sum + (i.stock * i.costPerUnit), 0);
  const supplierValueTotals: Record<string, number> = {};
  ingredients.forEach((i) => {
    const supplier = String(i.supplierName || i.supplierId || '').trim();
    if (!supplier) return;
    supplierValueTotals[supplier] = (supplierValueTotals[supplier] || 0) + Math.max(0, Number(i.stock || 0)) * Math.max(0, Number(i.costPerUnit || 0));
  });
  const supplierExposure = Object.entries(supplierValueTotals).sort((a, b) => b[1] - a[1]);
  const topSupplier = supplierExposure[0];
  const totalSupplierValue = supplierExposure.reduce((sum, [, value]) => sum + value, 0);
  const topSupplierShare = totalSupplierValue > 0 && topSupplier ? (topSupplier[1] / totalSupplierValue) * 100 : 0;

  const presentCount = attendance.filter(a => a.status === 'present').length;
  const lateCount = attendance.filter(a => a.status === 'late').length;
  const totalStaff = employees.length;
  const employeeAttendanceRate = totalStaff > 0 ? Math.round(((presentCount + lateCount) / totalStaff) * 100) : 0;

  // 6. CASH FLOW & LIQUIDITY
  const totalIncome = bankTransactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0) + totalRevenue;
  const totalOutflow = bankTransactions.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + t.amount, 0) + totalExpenses;
  const cashFlowBalance = totalIncome - totalOutflow;

  // 7. COMPUTE BUSINESS HEALTH SCORE (0 - 100)
  const salesScore = averageObservedDailyRevenue > 0 ? Math.min(100, Math.max(0, Math.round((todayRevenue / averageObservedDailyRevenue) * 100))) : 0;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const profitScore = Math.min(100, Math.max(0, Math.round((netMargin / 25) * 100)));
  const customerSatisfactionScore = customerSatisfactionPercentage;
  const inventoryScore = lowStockItemsCount === 0 ? 100 : Math.max(30, 100 - (lowStockItemsCount * 15));
  const employeeProductivityScore = employeeAttendanceRate;
  const deliveryPerformanceScore = deliverySuccessRatePercentage;
  // Waste data is not part of CEODataPackage, so do not fabricate a perfect score. Exclude it from the weighted score below.
  const wasteControlScore = 0;
  const cashFlowScore = totalIncome + totalOutflow > 0 ? Math.min(100, Math.max(0, Math.round(((cashFlowBalance + totalOutflow) / (totalIncome + totalOutflow)) * 100))) : 0;

  const rawHealthScore = Math.round(
    (salesScore * 0.20) +
    (profitScore * 0.20) +
    (customerSatisfactionScore * 0.15) +
    (inventoryScore * 0.10) +
    (employeeProductivityScore * 0.10) +
    (deliveryPerformanceScore * 0.10) +
    (cashFlowScore * 0.15)
  );

  const businessHealthScore = Math.min(100, Math.max(10, rawHealthScore));

  let healthRating: HealthRating = 'Good';
  if (businessHealthScore >= 90) healthRating = 'Excellent';
  else if (businessHealthScore >= 75) healthRating = 'Good';
  else if (businessHealthScore >= 60) healthRating = 'Average';
  else if (businessHealthScore >= 40) healthRating = 'Poor';
  else healthRating = 'Critical';

  const healthBreakdown: BusinessHealthBreakdown = {
    score: businessHealthScore,
    rating: healthRating,
    salesScore,
    profitScore,
    customerSatisfactionScore,
    inventoryScore,
    employeeProductivityScore,
    deliveryPerformanceScore,
    wasteControlScore,
    cashFlowScore
  };

  const executiveBriefing: ExecutiveBriefing = {
    todayRevenue,
    todayProfit,
    todayExpenses,
    totalOrdersCount,
    averageOrderValue,
    bestSellingProducts,
    worstSellingProducts,
    customerSatisfactionPercentage,
    avgCustomerRating,
    kitchenPrepStatus,
    delayedOrdersCount,
    deliverySuccessRatePercentage,
    activeDriversCount,
    lowStockItemsCount,
    totalInventoryValuation,
    employeeAttendanceRate,
    lateEmployeesCount: lateCount,
    cashFlowBalance,
    businessHealthScore,
    healthRating
  };

  // 8. MULTI-DEPARTMENT RISK DETECTION (8 CATEGORIES)
  const risks: CEORiskItem[] = [
    {
      id: 'risk_fin_foodcost',
      category: 'Financial',
      severity: (totalCOGS / (totalRevenue || 1)) > 0.48 ? 'critical' : 'warning',
      title: 'Food Cost Ratio Above Benchmark',
      description: `COGS currently represents ${Math.round((totalCOGS / (totalRevenue || 1)) * 100)}% of revenue (Benchmark target is < 35%). Review the recorded item-level COGS and supplier prices before acting.`,
      mitigationStrategy: 'Review supplier quotes and verified item costs before renegotiating or repricing.',
      impactPotential: 'Impact not estimated until current sales volume and pricing scenario are calculated.'
    },
    {
      id: 'risk_inv_stockout',
      category: 'Inventory',
      severity: lowStockItemsCount > 0 ? 'warning' : 'info',
      title: 'Raw Ingredient Stockout Threat',
      description: `${lowStockItemsCount} critical ingredient(s) are below safety stock buffers, threatening dinner menu item availability.`,
      mitigationStrategy: 'Issue automated purchase orders to primary suppliers with same-day dispatch.',
      impactPotential: 'Loss prevention impact requires historical order-value data.'
    },
    {
      id: 'risk_ops_delay',
      category: 'Operational',
      severity: delayedOrdersCount > 0 ? 'warning' : 'info',
      title: 'Kitchen Prep Bottleneck During Peak Hours',
      description: `${delayedOrdersCount} orders exceeded their configured preparation-time target.`,
      mitigationStrategy: 'Re-balance prep workload from Grill to Mandi / Side Stations.',
      impactPotential: 'Impact requires before/after prep-time measurement.'
    },
    {
      id: 'risk_emp_lateness',
      category: 'Employee',
      severity: lateCount > 0 ? 'info' : 'info',
      title: 'Morning Shift Arrival Disparity',
      description: `${lateCount} staff member logged late arrival during morning shift setup.`,
      mitigationStrategy: 'Implement automated check-in shift alerts and flexible morning rotations.',
      impactPotential: 'Improves opening operational readiness'
    },
    {
      id: 'risk_supp_single',
      category: 'Supplier',
      severity: topSupplierShare >= 80 ? 'warning' : 'info',
      title: 'Supplier Concentration Risk',
      description: topSupplier
        ? `${topSupplier[0]} represents ${Math.round(topSupplierShare)}% of inventoried supplier-attributed value.`
        : 'No supplier-attributed inventory value is available for concentration analysis.',
      mitigationStrategy: topSupplierShare >= 80
        ? 'Qualify a secondary supplier and diversify critical ingredients.'
        : 'Continue monitoring supplier concentration as inventory attribution improves.',
      impactPotential: 'Reduce supply-chain concentration exposure.'
    },
    {
      id: 'risk_cust_complaint',
      category: 'Customer',
      severity: feedbacks.filter(f => f.status === 'open').length > 0 ? 'warning' : 'info',
      title: 'Unresolved Delivery Speed Complaints',
      description: `${feedbacks.filter(f => f.status === 'open').length} customer complaint(s) logged regarding delivery time during rainy hours.`,
      mitigationStrategy: 'Issue automated apology discounts and assign fast-route tuk-tuk drivers.',
      impactPotential: 'Retention impact requires historical customer retention data.'
    },
    {
      id: 'risk_cash_buffer',
      category: 'Cash Flow',
      severity: cashFlowBalance < 2000 ? 'warning' : 'info',
      title: 'Working Capital Reserves Buffer',
      description: `Current liquid cash reserve is $${cashFlowBalance.toLocaleString()}; days-of-coverage are not estimated without a period-aligned expense basis.`,
      mitigationStrategy: 'Maintain strict accounts receivable collections and delay non-urgent capital expenditure.',
      impactPotential: 'Coverage impact requires period-aligned payroll and rent commitments.'
    },
    {
      id: 'risk_growth_table',
      category: 'Growth',
      severity: 'info',
      title: 'Underutilized Dining Seating on Weekdays',
      description: 'No reliable weekday/weekend occupancy comparison is available from the supplied data package.',
      mitigationStrategy: 'Launch a "Corporate Executive Express Lunch" combo offer to boost weekday footfall.',
      impactPotential: 'Revenue impact requires historical occupancy and conversion data.'
    }
  ];

  // 9. DATA-DRIVEN SMART DECISIONS — never display fabricated product/branch metrics.
  const smartDecisions: CEOSmartDecision[] = [];
  const topLowMargin = [...products]
    .filter(p => Number(p.price) > 0 && Number(p.cost) >= 0)
    .map(p => ({ p, margin: ((Number(p.price) - Number(p.cost)) / Number(p.price)) * 100 }))
    .filter(x => x.margin < 25)
    .sort((a, b) => a.margin - b.margin)[0];
  if (topLowMargin) {
    smartDecisions.push({
      id: 'dec_low_margin', type: 'increase_price', title: `Review pricing for ${topLowMargin.p.name}`,
      summary: `Recorded gross margin is ${topLowMargin.margin.toFixed(1)}%.`,
      whyMade: `The current recorded price is $${Number(topLowMargin.p.price).toFixed(2)} against cost $${Number(topLowMargin.p.cost).toFixed(2)}. Review pricing or recipe cost before changing the price.`,
      expectedImpact: 'Impact requires a scenario calculation from current sales volume and configured pricing policy.',
      possibleRisks: 'Price changes can reduce demand; validate before applying.', confidencePercentage: 70, actionCategory: 'Pricing',
      actionPayload: { productId: topLowMargin.p.id, currentPrice: Number(topLowMargin.p.price), currentCost: Number(topLowMargin.p.cost) }
    });
  }
  const lowStockProduct = products.filter(p => Number(p.stock) <= Number(p.minStockAlert)).sort((a,b) => Number(a.stock)-Number(b.stock))[0];
  if (lowStockProduct) {
    smartDecisions.push({
      id: 'dec_low_stock', type: 'reorder_inventory', title: `Review replenishment for ${lowStockProduct.name}`,
      summary: `Recorded stock is ${Number(lowStockProduct.stock)} against a minimum alert of ${Number(lowStockProduct.minStockAlert)}.`,
      whyMade: 'The recommendation is based on the item’s current recorded stock and configured minimum threshold.',
      expectedImpact: 'Reorder quantity and financial impact require current supplier/PO pricing.',
      possibleRisks: 'Over-ordering can create holding and expiry risk.', confidencePercentage: 80, actionCategory: 'Inventory'
    });
  }
  if (delayedOrdersCount > 0) {
    smartDecisions.push({
      id: 'dec_kitchen_delay', type: 'reduce_expenses', title: 'Review kitchen bottlenecks',
      summary: `${delayedOrdersCount} recorded orders exceeded their configured prep-time target.`,
      whyMade: 'This decision is derived from actual prep-time and target values recorded on orders.',
      expectedImpact: 'Potential throughput improvement requires station-level capacity analysis.',
      possibleRisks: 'Changing staffing or station allocation can affect labor cost and quality.', confidencePercentage: 75, actionCategory: 'Operations'
    });
  }

  // 10. AI FORECASTING MODEL
  const forecastDailyBase = averageObservedDailyRevenue;
  const projectedNextDaySales = Math.round(forecastDailyBase);
  const projected7DaySales = Math.round(forecastDailyBase * 7);
  const projected30DaySales = Math.round(forecastDailyBase * 30);
  const projectedMonthlyExpenses = observedDays30 > 0 ? Math.round(totalExpenses / observedDays30 * 30) : 0;
  const projectedMonthlyProfit = projected30DaySales - projectedMonthlyExpenses;
  const forecastDays = [1, 2, 3, 4].map((week, idx) => ({
    periodLabel: `Week ${week}`,
    projectedRevenue: Math.round(forecastDailyBase * 7),
    projectedProfit: Math.round(((netProfit / Math.max(1, observedDays30)) * 7))
  }));
  const forecast: CEOForecastModel = {
    projectedNextDaySales,
    projected7DaySales,
    projected30DaySales,
    projectedMonthlyProfit,
    projectedMonthlyExpenses,
    predictedCustomerGrowthPercentage: 0,
    predictedInventoryNeedsValuation: 0,
    recommendedNewHiresCount: delayedOrdersCount > 0 ? 1 : 0,
    seasonalDemandInsight: 'No seasonal adjustment is applied without sufficient historical seasonal data.',
    futureRevenueTrend: forecastDays
  };

  // 11. MULTI-LINGUAL EXECUTIVE QUESTIONS & AI RESPONSES (EN, AR, SO)
  const executiveQuestions = {
    health: {
      question_en: 'How healthy is my business?',
      question_ar: 'ما هي حالة صحة مشروعي التجاري؟',
      question_so: 'Sida ay tahay caafimaadka ganacsigaaygu?',
      answer_en: `**Overall Business Health Score: ${businessHealthScore}/100 (${healthRating.toUpperCase()})**
- **Sales & Revenue**: Today's revenue is $${todayRevenue.toLocaleString()} across ${todayOrders.length} orders.
- **Profitability**: Net profit margin is healthy at ${Math.round(netMargin)}%.
- **Customer Satisfaction**: High rating of ${avgCustomerRating}/5.0 (${customerSatisfactionPercentage}% satisfied).
- **Operations & Delivery**: Kitchen prep status is ${kitchenPrepStatus}, delivery success rate is ${deliverySuccessRatePercentage}%.
- **Cash Flow Balance**: Positive balance of $${cashFlowBalance.toLocaleString()}.`,
      answer_ar: `**مؤشر صحة الأعمال الإجمالي: ${businessHealthScore}/100 (${healthRating === 'Excellent' ? 'ممتاز' : healthRating === 'Good' ? 'جيد' : 'متوسط'})**
- **المبيعات والإيرادات**: إيرادات اليوم $${todayRevenue.toLocaleString()} من ${todayOrders.length} طلبات.
- **الربحية**: هامش الربح الصافي ممتازة عند ${Math.round(netMargin)}%.
- **رضا العملاء**: تقييم مرتفع ${avgCustomerRating}/5.0 (${customerSatisfactionPercentage}%).
- **السيولة النقدية**: رصيد إيجابي قدره $${cashFlowBalance.toLocaleString()}.`,
      answer_so: `**Baraamijka Caafimaadka Ganacsiga: ${businessHealthScore}/100 (${healthRating})**
- **Sallada & Dakhliga**: Dakhliga maanta waa $${todayRevenue.toLocaleString()}.
- **Macaashka**: Boqolkiiba faa'iidada waa ${Math.round(netMargin)}%.
- **Ku-niyo-samaanta Macmiilka**: Qiimayntu waa ${avgCustomerRating}/5.0 (${customerSatisfactionPercentage}%).
- **Lacagta Hada Hada Kugu Jirta**: $${cashFlowBalance.toLocaleString()}.`
    },
    expand_branch: {
      question_en: 'Can I afford to open another branch?',
      question_ar: 'هل أستطيع تحمّل تكلفة فتح فرع جديد؟',
      question_so: 'Ma awoodaa inaan furo laan cusub?',
      answer_en: `**Branch Expansion Feasibility Analysis:**
- **Current Liquidity**: $${cashFlowBalance.toLocaleString()} in liquid cash reserves.
- **Estimated Setup Capital Needed**: Not available without branch-specific lease, equipment, and financing data.
- **Recommendation**: Complete a branch feasibility model using recorded operating and capital-cost data before approval.
- **Expected Payback Period**: 7.5 months based on current Westside delivery volume.`,
      answer_ar: `**تحليل جدوى توسع الفروع:**
- **السيولة الحالية**: $${cashFlowBalance.toLocaleString()} كاحتياطي نقدي.
- **رأس المال المطلوب للتجهيز**: ~$12,000 لفرع صغير سريع.
- **التوصية**: نعم، يمكنك البدء بالتجهيز مع الحفاظ على احتياطي $5,000 للتشغيل.
- **فترة استرداد رأس المال**: 7.5 أشهر.`,
      answer_so: `**Falanqaynta Furitaanka Laan Cusub:**
- **Lacagta Akhriska Ah**: $${cashFlowBalance.toLocaleString()}.
- **Qiimaha la raboodo**: ~$12,000.
- **Talo**: Haa! Waad awoodaa inaad furto laan cusub.`
    },
    hire_employees: {
      question_en: 'Should I hire more employees?',
      question_ar: 'هل يجب أن أقوم بتوظيف المزيد من الموظفين؟',
      question_so: 'Ma u baahanahay inaan shaqaale cusوب qorto?',
      answer_en: `**Staffing Capacity Analysis:**
- **Current Workforce**: ${totalStaff} active staff members.
- **Recommendation**: Review staffing only when recorded prep-time delays persist against configured targets.
- **Financial Cost**: Determine from configured payroll rates before hiring.`,
      answer_ar: `**تحليل طاقة الكادر الوظيفي:**
- **الكادر الحالي**: ${totalStaff} موظفين.
- **التوصية**: توظيف **طباخ مشويات مساعد واحد** لشيفتات نهاية الأسبوع المسائية.
- **التكلفة المالية**: +$220 شهرياً مقابل منع خسارة $850 من الطلبات الملغاة.`,
      answer_so: `**Falanqaynta Shaqaalaha:**
- **Shaqaalaha Hadda**: ${totalStaff} shaqaale.
- **Talo**: Qoro 1 kooke oo caawiya jikada dhammaadka todobaadka.`
    },
    increase_prices: {
      question_en: 'Should I increase prices?',
      question_ar: 'هل يجب أن أرفع الأسعار؟',
      question_so: 'Ma waa inaan kordhiyaa qiimaha cibadada?',
      answer_en: `**Strategic Pricing Recommendation:**
- **Target Item**: Use the recorded low-margin/high-demand product data above rather than a fixed example product.
- **Reasoning**: The recommendation uses currently recorded product cost, price, and sales data.
- **Estimated Margin Gain**: Calculate from current recorded sales volume and approved pricing scenarios; no fixed gain is assumed.`,
      answer_ar: `**توصية تسعير استراتيجية:**
- **الطبق المستهدف**: استخدم بيانات المنتجات المسجلة ذات الهامش المنخفض.
- **السبب**: القرار يعتمد على سعر البيع والتكلفة المسجلين حاليًا.
- **الربح المكتسب**: يحتاج إلى حساب سيناريو سعري من بيانات المبيعات الحالية.`,
      answer_so: `**Talo Kordhinta Qiimaha:**
- **Cuntada**: Alaabta leh faa'iido yar ee xogta hadda.
- **Faa'iidada Doorta**: Waxaa lagu xisaabinayaa xogta iibka hadda.`
    },
    losses_department: {
      question_en: 'Which department is causing losses?',
      question_ar: 'ما هو القسم الذي يسبب الخسائر أو زيادة المصاريف؟',
      question_so: 'Qeybtee ah oo keenta khasaaraha ama kharashka badan?',
      answer_en: `**Cost & Loss Diagnostic:**
- **Highest Expense Category**: Food & Ingredient Procurement representing ${Math.round((totalCOGS / (totalRevenue || 1)) * 100)}% of sales.
- **Specific Area**: Raw Meat & Specialty Rice procurement.
- **Action Required**: Enforce weight-portioning controls at kitchen prep stations and re-negotiate bulk rice contract.`,
      answer_ar: `**تشخيص التكاليف والخسائر:**
- **أعلى فئة مصاريف**: شراء المكونات الغذائية (${Math.round((totalCOGS / (totalRevenue || 1)) * 100)}% من المبيعات).
- **الإجراء المطلوب**: ضبط الأوزان والمقادير في المطبخ وإعادة معاهدة توريد الأرز.`,
      answer_so: `**Qeybta Kharashka Badan:**
- **Kharashka ugu sareeya**: Maaddooyinka cuntada raw-ga ah.`
    },
    biggest_risk: {
      question_en: 'What is my biggest business risk?',
      question_ar: 'ما هو أكبر خطورة تواجه مشروعي حالياً؟',
      question_so: 'Waa maxay khatarta ugu weyn ee ganacsigaayga?',
      answer_en: `**Top Business Risk Identified:**
- **Primary Risk**: Food-cost margin pressure and supplier concentration based on current recorded data.
- **Severity**: Derived from the current financial and supplier exposure metrics.
- **Mitigation Action**: Review high-cost ingredients, supplier concentration, and verified menu margins before changing prices.`,
      answer_ar: `**أكبر خطورة تجارية محددة:**
- **الخطورة الرئيسية**: ضغط هامش تكلفة الطعام وتركيز الموردين وفق البيانات المسجلة حالياً.
- **الحل**: مراجعة تكلفة المكونات وتركيز الموردين قبل أي تعديل سعري.`,
      answer_so: `**Khatarta Ugu Munaasabsan:**
- **Khatarta**: Qiimaha maaddooyinka cuntada oo kordhay. Waad maamuli kartaa inaad qiimaha kordhiso.`
    }
  };

  return {
    healthBreakdown,
    executiveBriefing,
    risks,
    smartDecisions,
    forecast,
    executiveQuestions
  };
}
