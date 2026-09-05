import { 
  Order, 
  Product, 
  Ingredient, 
  Expense, 
  Employee, 
  Supplier, 
  DeliveryDriver, 
  KitchenStation, 
  EmployeeAttendance, 
  Reservation, 
  BranchOperation, 
  CustomerFeedback, 
  EquipmentItem 
} from '../types';
import { getMogadishuDateString } from './dateUtils';

export interface OperationsKPIs {
  totalPreparingOrders: number;
  delayedOrdersCount: number;
  kitchenStatus: 'Optimal' | 'Busy' | 'Overloaded';
  kitchenWorkloadPercentage: number;
  avgKitchenPrepTimeMinutes: number;
  avgPreparationTimeMinutes: number;
  targetPrepTimeMinutes: number;
  deliverySuccessRatePercentage: number;
  activeDriversCount: number;
  inTransitDriversCount: number;
  pendingDeliveriesCount: number;
  attendanceRatePercentage: number;
  presentEmployeesCount: number;
  totalEmployees: number;
  lateEmployeesCount: number;
  lowStockItemsCount: number;
  criticalLowStockCount: number;
  avgCustomerRating: number;
  customerSatisfactionPercentage: number;
  openCustomerComplaintsCount: number;
}

export interface DelayedOrderAlert {
  orderId: string;
  orderNumber: string;
  customerName: string;
  orderType: string;
  itemsSummary: string;
  elapsedMinutes: number;
  targetMinutes: number;
  prepTimeMinutes: number;
  targetPrepTimeMinutes: number;
  stationName: string;
  assignedChef: string;
  severity: 'high' | 'medium' | 'low';
  status: string;
}

export interface OperationalSmartAlert {
  id: string;
  type: 'kitchen' | 'delivery' | 'staff' | 'inventory' | 'customer';
  department: 'kitchen' | 'orders' | 'staff' | 'delivery' | 'assistant';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  message: string;
  metricLabel: string;
  actionText: string;
  timestamp: string;
  actionPayload?: any;
}

export interface OperationalRecommendation {
  id: string;
  title: string;
  description: string;
  impact: string;
  category: 'Kitchen Efficiency' | 'Delivery Optimization' | 'Staff Re-balancing' | 'Inventory Alert';
}

export interface OperationsDataPackage {
  orders: Order[];
  products: Product[];
  ingredients: Ingredient[];
  expenses?: Expense[];
  employees: Employee[];
  suppliers?: Supplier[];
  drivers?: DeliveryDriver[];
  stations?: KitchenStation[];
  attendance?: EmployeeAttendance[];
  reservations?: Reservation[];
  branches?: BranchOperation[];
  feedbacks?: CustomerFeedback[];
  equipment?: EquipmentItem[];
}

export function calculateOperationsAnalytics(data: OperationsDataPackage) {
  const {
    orders = [],
    products = [],
    ingredients = [],
    employees = [],
    drivers = [],
    attendance = [],
    feedbacks = []
  } = data;

  const todayStr = getMogadishuDateString();

  // Kitchen Metrics
  const preparingOrders = orders.filter(o => o.status === 'preparing' || o.prepStatus === 'preparing');
  const delayedOrders = orders.filter(o => Number.isFinite(Number(o.prepTimeMinutes)) && Number.isFinite(Number(o.targetPrepTimeMinutes)) && Number(o.prepTimeMinutes) > Number(o.targetPrepTimeMinutes));
  const delayedOrdersCount = delayedOrders.length;
  const kitchenStatus: 'Optimal' | 'Busy' | 'Overloaded' = delayedOrdersCount > 2 ? 'Overloaded' : delayedOrdersCount > 0 ? 'Busy' : 'Optimal';
  const kitchenWorkloadPercentage = preparingOrders.length === 0 && delayedOrdersCount === 0
    ? 0
    : Math.min(100, (preparingOrders.length * 15) + (delayedOrdersCount * 20));

  const prepOrders = orders.filter(o => (o.prepTimeMinutes || 0) > 0);
  const avgKitchenPrepTimeMinutes = prepOrders.length > 0
    ? Math.round(prepOrders.reduce((sum, o) => sum + (o.prepTimeMinutes || 0), 0) / prepOrders.length)
    : 0;

  // Delivery Metrics
  const totalDeliveries = orders.filter(o => o.orderType === 'delivery').length;
  const failedDeliveries = orders.filter(o => o.deliveryStatus === 'failed').length;
  const deliverySuccessRatePercentage = totalDeliveries > 0 ? Math.round(((totalDeliveries - failedDeliveries) / totalDeliveries) * 100) : 0;
  const activeDriversCount = drivers.filter(d => d.status === 'available' || d.status === 'in_transit').length;
  const inTransitDriversCount = drivers.filter(d => d.status === 'in_transit').length;
  const pendingDeliveriesCount = orders.filter(o => o.orderType === 'delivery' && (o.deliveryStatus === 'pending' || o.deliveryStatus === 'assigned')).length;

  // Staff Attendance Metrics
  const presentCount = attendance.filter(a => a.status === 'present').length;
  const lateCount = attendance.filter(a => a.status === 'late').length;
  const totalStaff = employees.length;
  const attendanceRatePercentage = totalStaff > 0 ? Math.round(((presentCount + lateCount) / totalStaff) * 100) : 0;

  // Inventory Stockouts
  const lowStockItemsCount = products.filter(p => p.stock <= p.minStockAlert).length + ingredients.filter(i => i.stock <= i.minStockAlert).length;
  const criticalLowStockCount = lowStockItemsCount;

  // Customer Feedback & Ratings
  const openCustomerComplaintsCount = feedbacks.filter(f => f.status === 'open').length;
  const ratedOrders = orders.filter(o => typeof o.rating === 'number' && o.rating > 0);
  const avgCustomerRating = ratedOrders.length > 0 
    ? Number((ratedOrders.reduce((sum, o) => sum + (o.rating || 0), 0) / ratedOrders.length).toFixed(1)) 
    : 0;
  const customerSatisfactionPercentage = ratedOrders.length > 0 ? Math.round((avgCustomerRating / 5) * 100) : 0;

  const configuredPrepTargets = orders
    .map(o => Number(o.targetPrepTimeMinutes))
    .filter(v => Number.isFinite(v) && v > 0);
  const targetPrepTimeMinutes = configuredPrepTargets.length > 0
    ? Math.round(configuredPrepTargets.reduce((sum, v) => sum + v, 0) / configuredPrepTargets.length)
    : 0;

  const kpis: OperationsKPIs = {
    totalPreparingOrders: preparingOrders.length,
    delayedOrdersCount,
    kitchenStatus,
    kitchenWorkloadPercentage,
    avgKitchenPrepTimeMinutes,
    avgPreparationTimeMinutes: avgKitchenPrepTimeMinutes,
    targetPrepTimeMinutes,
    deliverySuccessRatePercentage,
    activeDriversCount,
    inTransitDriversCount,
    pendingDeliveriesCount,
    attendanceRatePercentage,
    presentEmployeesCount: presentCount,
    totalEmployees: totalStaff,
    lateEmployeesCount: lateCount,
    lowStockItemsCount,
    criticalLowStockCount,
    avgCustomerRating,
    customerSatisfactionPercentage,
    openCustomerComplaintsCount
  };

  const delayedOrderAlerts: DelayedOrderAlert[] = delayedOrders.slice(0, 5).map(o => ({
    orderId: o.id,
    orderNumber: (o as any).orderNumber || `ORD-${o.id.slice(-4)}`,
    customerName: o.customerName || 'Walk-in Guest',
    orderType: o.orderType,
    itemsSummary: o.items ? o.items.map(i => `${i.quantity}x ${i.productName}`).join(', ') : 'Assorted Dishes',
    elapsedMinutes: o.prepTimeMinutes || 0,
    targetMinutes: Number.isFinite(Number(o.targetPrepTimeMinutes)) ? Number(o.targetPrepTimeMinutes) : 0,
    prepTimeMinutes: o.prepTimeMinutes || 0,
    targetPrepTimeMinutes: Number.isFinite(Number(o.targetPrepTimeMinutes)) ? Number(o.targetPrepTimeMinutes) : 0,
    stationName: (o as any).stationName || 'Kitchen Station',
    assignedChef: (o as any).assignedChef || (o as any).employeeName || 'Staff',
    severity: Number.isFinite(Number(o.targetPrepTimeMinutes)) && Number.isFinite(Number(o.prepTimeMinutes)) && Number(o.prepTimeMinutes) > Number(o.targetPrepTimeMinutes) * 1.5 ? 'high' : 'medium',
    status: o.status
  }));

  const smartAlerts: OperationalSmartAlert[] = [
    {
      id: 'alert_kitchen_delay',
      type: 'kitchen',
      department: 'kitchen',
      severity: delayedOrdersCount > 0 ? 'warning' : 'info',
      title: 'Kitchen Preparation Speed',
      description: delayedOrdersCount > 0 
        ? `${delayedOrdersCount} order(s) exceeded target prep time. Re-balance workload across prep stations.`
        : 'All active kitchen stations operating at optimal prep speed.',
      message: delayedOrdersCount > 0 
        ? `${delayedOrdersCount} orders delayed in kitchen prep queue.`
        : 'Kitchen station throughput running optimally.',
      metricLabel: `${delayedOrdersCount} Delayed Orders`,
      actionText: 'Re-balance Stations',
      timestamp: new Date().toISOString()
    },
    {
      id: 'alert_delivery_capacity',
      type: 'delivery',
      department: 'delivery',
      severity: pendingDeliveriesCount > 3 ? 'warning' : 'info',
      title: 'Active Delivery Pipeline',
      description: `${pendingDeliveriesCount} orders pending dispatch across ${activeDriversCount} active driver(s).`,
      message: `${pendingDeliveriesCount} pending orders awaiting driver assignment.`,
      metricLabel: `${pendingDeliveriesCount} Pending Orders`,
      actionText: 'Assign Drivers',
      timestamp: new Date().toISOString()
    },
    {
      id: 'alert_inventory_low',
      type: 'inventory',
      department: 'orders',
      severity: lowStockItemsCount > 0 ? 'warning' : 'info',
      title: 'Low Stock Ingredients',
      description: `${lowStockItemsCount} critical ingredients below minimum safety threshold.`,
      message: `${lowStockItemsCount} items require immediate supplier purchase order.`,
      metricLabel: `${lowStockItemsCount} Stock Alerts`,
      actionText: 'Generate Purchase Orders',
      timestamp: new Date().toISOString()
    }
  ];

  const recommendations: OperationalRecommendation[] = [];
  if (delayedOrdersCount > 0) {
    recommendations.push({
      id: 'rec_kitchen_delay', title: 'Re-balance kitchen workload',
      description: `${delayedOrdersCount} recorded order(s) exceeded their configured prep-time target. Review station allocation and staffing using current workload data.`,
      impact: 'Impact to be measured from actual prep-time results', category: 'Kitchen Efficiency'
    });
  }
  if (pendingDeliveriesCount > activeDriversCount && activeDriversCount >= 0) {
    recommendations.push({
      id: 'rec_delivery_capacity', title: 'Review delivery capacity',
      description: `${pendingDeliveriesCount} pending delivery order(s) versus ${activeDriversCount} active driver(s).`,
      impact: 'Impact depends on actual dispatch times and route data', category: 'Delivery Optimization'
    });
  }

  const operationalQuestions = {
    kitchen_performance: {
      question_en: 'How is the kitchen performing right now?',
      question_ar: 'كيف يسير أداء المطبخ حالياً؟',
      question_so: 'Sidee tahay shaqada jikada hadda?',
      answer_en: `**Kitchen Status: ${kitchenStatus.toUpperCase()} (${kitchenWorkloadPercentage}% Capacity)**\n- **Active Orders in Prep**: ${preparingOrders.length}\n- **Delayed Orders**: ${delayedOrdersCount}\n- **Avg Prep Time**: ${avgKitchenPrepTimeMinutes} minutes.`,
      answer_ar: `**حالة المطبخ: ${kitchenStatus === 'Optimal' ? 'ممتاز وطبيعي' : kitchenStatus === 'Busy' ? 'مشغول' : 'مزدحم'} (${kitchenWorkloadPercentage}% من الطاقة)**\n- **الطلبات قيد التحضير**: ${preparingOrders.length}\n- **الطلبات المتأخرة**: ${delayedOrdersCount}\n- **متوسط زمن التحضير**: ${avgKitchenPrepTimeMinutes} دقيقة.`,
      answer_so: `**Xaaladda Jikada: ${kitchenStatus} (${kitchenWorkloadPercentage}%)**\n- **Odalabyada la diyaarinayo**: ${preparingOrders.length}\n- **Kuwa daahay**: ${delayedOrdersCount}\n- **Celceliska wakhtiga**: ${avgKitchenPrepTimeMinutes} daqiiqo.`
    },
    employee_late: {
      question_en: 'Which employees arrived late today?',
      question_ar: 'من هم الموظفون المتأخرون اليوم؟',
      question_so: 'Shaqaalaha daahay maanta waa kuwee?',
      answer_en: `**Staff Attendance Overview:**\n- **Overall Attendance Rate**: ${attendanceRatePercentage}%\n- **Late Arrivals**: ${lateCount} employee(s) logged late arrival for morning opening.`,
      answer_ar: `**ملخص حضور الكادر:**\n- **نسبة الحضور الإجمالية**: ${attendanceRatePercentage}%\n- **المتأخرون**: ${lateCount} موظفاً سجلوا وصولاً متأخراً في الوردية الصباحية.`,
      answer_so: `**Xogta Shaqaalaha:**\n- **Boqolkiiba imaanshaha**: ${attendanceRatePercentage}%\n- **Shaqaalaha daahay**: ${lateCount} shaqaale.`
    },
    orders_delayed: {
      question_en: 'Are there any delayed orders in the kitchen?',
      question_ar: 'هل توجد طلبات متأخرة في المطبخ؟',
      question_so: 'Ma jiraan odalabyo ku daahay jikada?',
      answer_en: `**Delayed Orders: ${delayedOrdersCount}**\n${delayedOrdersCount > 0 ? 'Orders have exceeded their configured preparation targets. Expedite and rebalance station workload.' : 'Zero delayed orders. Kitchen pipeline is smooth.'}`,
      answer_ar: `**الطلبات المتأخرة: ${delayedOrdersCount}**\n${delayedOrdersCount > 0 ? 'الطلبات تجاوزت أهداف زمن التحضير المهيأة لها. يوصى بالتعجيل وإعادة توزيع العمل بين المحطات.' : 'لا توجد طلبات متأخرة. تدفق المطبخ يسير بسلاسة كاملة.'}`,
      answer_so: `**Odalabyada Daahay: ${delayedOrdersCount}**`
    },
    deliveries_pending: {
      question_en: 'What is the delivery and driver status?',
      question_ar: 'ما هي حالة التوصيل والسائقين؟',
      question_so: 'Sidee tahay xaaladda gaarsiinta iyo darawaliinta?',
      answer_en: `**Delivery Pipeline:**\n- **Success Rate**: ${deliverySuccessRatePercentage}%\n- **Active Drivers**: ${activeDriversCount}\n- **Pending Dispatch**: ${pendingDeliveriesCount} order(s).`,
      answer_ar: `**مسار التوصيل:**\n- **نسبة نجاح التوصيل**: ${deliverySuccessRatePercentage}%\n- **السائقون المتاحون**: ${activeDriversCount}\n- **قيد الانتظار**: ${pendingDeliveriesCount} طلب.`,
      answer_so: `**Xaaladda Gaarsiinta:**\n- **Guusha**: ${deliverySuccessRatePercentage}%\n- **Darawaliinta**: ${activeDriversCount}`
    },
    reorder_ingredients_today: {
      question_en: 'Which ingredients need reordering today?',
      question_ar: 'ما هي المكونات التي تحتاج إعادة طلب اليوم؟',
      question_so: 'Maaddooyinka u baahan dib u dalbasho maanta?',
      answer_en: `**Inventory Safety Check:**\n- **Low Stock Count**: ${lowStockItemsCount} items below safety buffers.\n- **Action**: Purchase orders prepared for raw meat, basmati rice, and cooking oil.`,
      answer_ar: `**فحص أمان المخزون:**\n- **الأصناف المنخفضة**: ${lowStockItemsCount} صنفاً تحت حد الأمان.\n- **الإجراء**: أوامر الشراء جاهزة للحوم والأرز وزيوت الطهي.`,
      answer_so: `**Xaaladda Kaydka:**\n- ${lowStockItemsCount} maaddo oo hooseeya.`
    }
  };

  return {
    kpis,
    delayedOrderAlerts,
    smartAlerts,
    recommendations,
    operationalQuestions
  };
}
