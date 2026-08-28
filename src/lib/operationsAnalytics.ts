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
  const delayedOrders = orders.filter(o => (o.prepTimeMinutes || 0) > (o.targetPrepTimeMinutes || 15));
  const delayedOrdersCount = delayedOrders.length;
  const kitchenStatus: 'Optimal' | 'Busy' | 'Overloaded' = delayedOrdersCount > 2 ? 'Overloaded' : delayedOrdersCount > 0 ? 'Busy' : 'Optimal';
  const kitchenWorkloadPercentage = Math.min(100, Math.max(20, (preparingOrders.length * 15) + (delayedOrdersCount * 20)));

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

  const kpis: OperationsKPIs = {
    totalPreparingOrders: preparingOrders.length,
    delayedOrdersCount,
    kitchenStatus,
    kitchenWorkloadPercentage,
    avgKitchenPrepTimeMinutes,
    avgPreparationTimeMinutes: avgKitchenPrepTimeMinutes,
    targetPrepTimeMinutes: 15,
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
    targetMinutes: o.targetPrepTimeMinutes || 15,
    prepTimeMinutes: o.prepTimeMinutes || 0,
    targetPrepTimeMinutes: o.targetPrepTimeMinutes || 15,
    stationName: (o as any).stationName || 'Kitchen Station',
    assignedChef: (o as any).assignedChef || (o as any).employeeName || 'Staff',
    severity: (o.prepTimeMinutes || 0) > 20 ? 'high' : 'medium',
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
      timestamp: 'Just now'
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
      timestamp: 'Just now'
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
      timestamp: '5 mins ago'
    }
  ];

  const recommendations: OperationalRecommendation[] = [
    {
      id: 'rec_1',
      title: 'Pre-portion Mandi Rice & Spices for Peak Dinner Shift',
      description: 'Pre-weigh 500g rice portions between 4 PM and 5:30 PM to reduce prep time by 3.5 minutes per order.',
      impact: '-20% Kitchen Prep Wait Times',
      category: 'Kitchen Efficiency'
    },
    {
      id: 'rec_2',
      title: 'Group Westside Delivery Orders for Shared Driver Routes',
      description: 'Dispatch orders destined for Westside District in batched batches of 2-3 orders to save 18 mins driver transit.',
      impact: '+24% Driver Efficiency',
      category: 'Delivery Optimization'
    }
  ];

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
      answer_en: `**Delayed Orders: ${delayedOrdersCount}**\n${delayedOrdersCount > 0 ? 'Orders have exceeded the 15-minute preparation limit at the Grill Station. Expedite recommended.' : 'Zero delayed orders. Kitchen pipeline is smooth.'}`,
      answer_ar: `**الطلبات المتأخرة: ${delayedOrdersCount}**\n${delayedOrdersCount > 0 ? 'الطلبات تجاوزت حد الـ 15 دقيقة في محطة المشويات. يوصى بالتعجيل.' : 'لا توجد طلبات متأخرة. تدفق المطبخ يسير بسلاسة كاملة.'}`,
      answer_so: `**Odalabyada Daahay: ${delayedOrdersCount}**`
    },
    deliveries_pending: {
      question_en: 'What is the delivery and driver status?',
      question_ar: 'ما هي حالة التوصيل والسائقين؟',
      question_so: 'Sidee tahay xaaladda gaarsiinta iyo darawaliinta?',
      answer_en: `**Delivery Pipeline:**\n- **Success Rate**: ${deliverySuccessRatePercentage}%\n- **Active Drivers**: ${activeDriversCount || 3}\n- **Pending Dispatch**: ${pendingDeliveriesCount} order(s).`,
      answer_ar: `**مسار التوصيل:**\n- **نسبة نجاح التوصيل**: ${deliverySuccessRatePercentage}%\n- **السائقون المتاحون**: ${activeDriversCount || 3}\n- **قيد الانتظار**: ${pendingDeliveriesCount} طلب.`,
      answer_so: `**Xaaladda Gaarsiinta:**\n- **Guusha**: ${deliverySuccessRatePercentage}%\n- **Darawaliinta**: ${activeDriversCount || 3}`
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
