export type Language = 'en' | 'ar' | 'so' | 'auto';

export interface SelectedOptionChoice {
  optionId: string;
  optionName: string;
  choiceId: string;
  choiceName: string;
  priceModifier: number;
}

export interface OrderItem {
  id?: string;
  productId: string;
  productName: string;
  nameEn?: string;
  nameAr?: string;
  nameSo?: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  totalPrice: number;
  selectedOptions?: SelectedOptionChoice[];
  notes?: string;
}

export type OrderType = 'dine_in' | 'takeaway' | 'delivery' | 'online' | 'reservation';

export type OrderStatus = 'new' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'cancelled' | 'held' | 'received' | 'in_preparation' | 'ready_for_pickup' | 'out_for_delivery' | 'pending';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type PaymentMethod = 'cash' | 'card' | 'mobile_payment' | 'online' | 'mobile_money' | 'split';

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  tableId?: string;
  tableNumber?: string;
  employeeId: string;
  employeeName: string;
  type?: string;
  orderType: OrderType;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  discountPercent?: number;
  taxRate?: number;
  tax: number;
  taxAmount?: number;
  totalAmount: number;
  cogs: number; // Cost of Goods Sold
  profit: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  amountTendered?: number;
  paidAmount?: number;
  paymentAmount?: number;
  changeDue?: number;
  deliveryAddress?: string;
  deliveryZoneId?: string;
  deliveryZoneName?: string;
  deliveryFee?: number;
  notes?: string;
  branch?: string;
  branchId?: string;
  createdAt: string; // ISO String
  updatedAt?: string;
  completedAt?: string;

  // Operational & Delivery Fields
  prepStatus?: 'new' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  prepTimeMinutes?: number;
  targetPrepTimeMinutes?: number;
  assignedChef?: string;
  assignedDriver?: string;
  deliveryTimeMinutes?: number;
  deliveryStatus?: DeliveryStatus | 'in_transit';
  rating?: number;
  complaint?: string;
  splitBills?: {
    splitId: string;
    customerName: string;
    items: OrderItem[];
    amount: number;
    paymentStatus: PaymentStatus;
    paymentMethod?: PaymentMethod;
  }[];
}

export type {
  CustomerGender,
  CustomerLanguage,
  CustomerStatus,
  MembershipLevel,
  FavoriteProductSummary,
  CustomerOrderSummary,
  Customer,
  CustomerWallet,
  WalletTransactionType,
  WalletPaymentMethod,
  WalletTransaction,
  CustomerPoints,
  PointsLog,
  CustomerReward,
  ClaimedReward,
  CustomerCoupon,
  NotificationChannel,
  NotificationStatus,
  CustomerNotification,
  CustomerAnalyticsData
} from './domain/entities/customer';

export type {
  EmployeeRole,
  EmploymentStatus,
  GenderType,
  BankAccountDetails,
  EmergencyContact,
  Employee,
  AttendanceStatus,
  AttendanceRecord,
  ShiftType,
  Shift,
  PayrollStatus,
  PayrollRecord,
  LeaveType,
  LeaveWorkflowStatus,
  LeaveApprovalStep,
  LeaveRequest,
  PerformanceRecord,
  DocumentType,
  EmployeeDocument,
  HRNotificationType,
  HRNotification,
  HRMAnalyticsData
} from './domain/entities/hrm';

export interface DiningTable {
  id: string;
  tableNumber: string;
  section: 'indoor' | 'terrace' | 'vip' | 'patio' | string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved';
  currentOrderId?: string;
  currentOrderNumber?: string;
  assignedWaiter?: string;
  updatedAt?: string;
}

export interface Payment {
  id: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  referenceNumber?: string;
  notes?: string;
  processedBy: string;
  createdAt: string;
}

export interface HoldOrder {
  id: string;
  holdName: string;
  customerName?: string;
  customerPhone?: string;
  orderType: OrderType;
  tableNumber?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discountAmount: number;
  totalAmount: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export type DriverStatus = 'active' | 'inactive' | 'on_break' | 'off_duty' | 'available' | 'in_transit' | 'offline';
export type DriverAvailability = 'available' | 'on_delivery' | 'in_transit' | 'offline';
export type VehicleType = 'motorcycle' | 'car' | 'bicycle' | 'scooter' | 'van';

export interface DeliveryDriver {
  id: string;
  fullName: string;
  name?: string;
  phone?: string;
  employeeId: string;
  phoneNumber: string;
  vehicleType: VehicleType;
  vehicle?: string;
  vehicleNumber: string;
  licenseNumber: string;
  status: DriverStatus;
  availability: DriverAvailability;
  activeDeliveries?: number;
  completedDeliveries?: number;
  avgDeliveryTimeMinutes?: number;
  currentLocation?: {
    lat: number;
    lng: number;
    address?: string;
    lastUpdated?: string;
  };
  branchId?: string;
  branchName?: string;
  rating?: number;
  totalDeliveries?: number;
  failedDeliveries?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface KitchenStation {
  id: string;
  name: string;
  stationType: 'grill' | 'fries_appetizers' | 'beverages' | 'bakery' | 'mains';
  assignedChef: string;
  activeOrdersCount: number;
  avgPrepTimeMinutes: number;
  status: 'normal' | 'busy' | 'overloaded';
}

export interface EmployeeAttendance {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'on_leave';
  checkInTime?: string;
  lateMinutes?: number;
  overtimeHours?: number;
  shift: string;
}

export interface Reservation {
  id: string;
  customerName: string;
  phone: string;
  partySize: number;
  reservationTime: string;
  status: 'confirmed' | 'seated' | 'completed' | 'cancelled';
  tableNumber: string;
  branch: string;
}

export interface BranchOperation {
  id: string;
  branchName: string;
  managerName: string;
  status: 'open' | 'busy' | 'closing_soon';
  activeTables: number;
  maxTables: number;
  occupancyRate: number;
  dailySales: number;
  activeOrders: number;
}

export interface CustomerFeedback {
  id: string;
  orderId: string;
  customerName: string;
  rating: number; // 1-5
  complaint?: string;
  compliments?: string;
  category: 'speed' | 'food_quality' | 'driver_service' | 'cleanliness' | 'other';
  status: 'open' | 'resolved';
  createdAt: string;
}

export interface EquipmentItem {
  id: string;
  name: string;
  department: 'kitchen' | 'beverage' | 'delivery' | 'cashier';
  status: 'operational' | 'needs_maintenance' | 'broken';
  branchId?: string;
  branch?: string;
  lastServiced: string;
  nextServiceDue: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  ingredientName: string;
  requiredQuantity: number;
  unit: string;
}

export interface RecipeItem {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
  wastePercent?: number;
  notes?: string;
}

export interface Recipe {
  id: string;
  productId: string;
  productName: string;
  productCategory?: string;
  recipeName: string;
  version: number;
  branchId?: string;
  branch?: string;
  items: RecipeItem[];
  yieldQuantity: number;
  totalCost: number;
  costPerPortion: number;
  sellingPrice: number;
  foodCostPercentage: number;
  grossProfit: number;
  grossProfitMargin: number;
  netProfit: number;
  notes?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductOptionChoice {
  id: string;
  name?: string;
  nameEn: string;
  nameAr?: string;
  nameSo?: string;
  priceModifier: number;
  isDefault?: boolean;
}

export interface ProductOption {
  id: string;
  productId?: string;
  name?: string;
  nameEn: string;
  nameAr?: string;
  nameSo?: string;
  type: 'size' | 'variant' | 'addon' | 'custom';
  selectionType: 'single' | 'multiple';
  isRequired: boolean;
  choices: ProductOptionChoice[];
}

export interface Category {
  id: string;
  name: string;
  nameEn: string;
  nameAr?: string;
  nameSo?: string;
  description?: string;
  imageUrl?: string;
  order: number;
  isActive: boolean;
  branchId?: string;
  branch?: string;
  productCount?: number;
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  nameEn?: string;
  nameAr?: string;
  nameSo?: string;
  description?: string;
  shortDescription?: string;
  imageUrl?: string;
  images?: string[];
  category: string;
  categoryId?: string;
  branchId?: string;
  branch?: string;
  price: number;
  discountPrice?: number;
  cost: number;
  tax?: number;
  prepTimeMinutes?: number;
  availabilityStatus?: 'enabled' | 'disabled' | 'out_of_stock';
  isFeatured?: boolean;
  sku?: string;
  barcode?: string;
  stock: number;
  minStockAlert: number;
  unit: string;
  salesCount: number;
  ingredients?: RecipeIngredient[];
  calories?: number;
  notes?: string;
  options?: ProductOption[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  stock: number;
  unit: string;
  minStockAlert: number;
  costPerUnit: number;
  branchId?: string;
  branch?: string;
  supplierId: string;
  supplierName: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: 'utilities' | 'supplies' | 'rent' | 'maintenance' | 'marketing' | 'delivery' | 'other';
  description?: string;
  branchId?: string;
  branch?: string;
  createdBy: string;
  createdAt: string;
}

export interface Purchase {
  id: string;
  supplierId: string;
  supplierName: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalCost: number;
  status: 'completed' | 'pending' | 'overdue';
  branchId?: string;
  branch?: string;
  dueDate?: string;
  createdAt: string;
}

export interface SalaryPayment {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  period: string; // e.g. "July 2026"
  status: 'paid' | 'pending';
  branchId?: string;
  branch?: string;
  paidDate: string;
}

export type Salary = SalaryPayment;

export interface Supplier {
  id: string;
  name: string;
  companyName?: string;
  contactPerson: string;
  phone: string;
  itemsSupplied: string;
  pendingAmount: number;
  overdueAmount: number;
}

export interface InventoryMovement {
  id: string;
  type: 'in' | 'out' | 'adjustment';
  itemType: 'product' | 'ingredient';
  itemId: string;
  itemName: string;
  quantity: number;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface CustomerRefund {
  id: string;
  orderId?: string;
  customerName: string;
  amount: number;
  reason: string;
  paymentMethod?: 'cash' | 'bank' | 'mobile_money' | string;
  createdBy?: string;
  createdAt: string;
}

export interface BankTransaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'fee';
  amount: number;
  reference?: string;
  referenceNumber?: string;
  description: string;
  accountName: string;
  createdBy?: string;
  createdAt: string;
}

export interface FinancialAccount {
  id: string;
  name: string;
  type: 'cash' | 'bank';
  balance: number;
  accountNumber?: string;
  updatedAt: string;
}

export interface CPAMetrics {
  dailySales: number;
  weeklySales: number;
  monthlySales: number;
  yearlySales: number;

  grossRevenue: number;
  customerRefundsTotal: number;
  netRevenue: number;

  cogs: number; // Cost of Goods Sold
  foodCostPercentage: number; // (COGS / Sales) * 100

  laborCost: number;
  laborCostPercentage: number; // (Labor / Net Revenue) * 100

  deliveryCost: number;
  operatingExpenses: number;
  totalExpenses: number;

  grossProfit: number; // Net Revenue - COGS
  netProfit: number; // Net Revenue - Total Expenses
  netProfitMargin: number; // (Net Profit / Net Revenue) * 100

  cashBalance: number;
  bankBalance: number;
  totalLiquidity: number;

  inventoryValuation: number; // Asset value of current stock

  accountsReceivable: number; // Pending customer payments
  accountsPayable: number; // Pending supplier payments
  overdueAccountsPayable: number;

  taxEstimatedVAT: number; // Sales tax / VAT estimated
  taxEstimatedCorporate: number; // Income tax estimated

  anomalies: CPAAnomaly[];
  recommendations: CPARecommendation[];
  predictedMonthlyProfit: number;
  predictedFutureExpenses: number;
}

export interface CPAAnomaly {
  id: string;
  type: 'unusual_expense' | 'cash_shortage' | 'inventory_loss' | 'accounting_mistake' | 'overdue_payable';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  suggestedAction: string;
}

export interface CPARecommendation {
  id: string;
  category: 'cost_reduction' | 'pricing_strategy' | 'cashflow' | 'inventory';
  title: string;
  description: string;
  potentialSavingsOrGain: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  detectedLanguage?: 'en' | 'ar' | 'so';
  actionTaken?: string;
  actionPayload?: any;
  suggestedQuestions?: string[];
  timestamp: string;
}

export interface UserRecord {
  uid: string;
  email: string;
  displayName: string;
  role: 'Owner' | 'Admin' | 'Manager' | 'Accountant' | 'Cashier' | 'Kitchen' | 'Waiter' | 'Delivery Driver';
  branch: string;
  branchId?: string;
  status: 'active' | 'suspended' | 'pending';
  emailVerified: boolean;
  photoURL?: string;
  createdAt: string;
  lastLoginAt?: string;
  phoneNumber?: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: 'Owner' | 'Admin' | 'Manager' | 'Accountant' | 'Cashier' | 'Kitchen' | 'Waiter' | 'Delivery Driver';
  action: string;
  details: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

// Re-export Phase 7 Inventory Entities & Phase 8 Customer Entities
export * from './domain/entities/inventory';
export * from './domain/entities/customer';

// Phase 13 Multi-Branch Management Interfaces
export type BranchStatus = 'active' | 'inactive' | 'maintenance' | 'closed';
export type BranchHierarchyType = 'head_office' | 'flagship' | 'standard' | 'express';

export interface Branch {
  id: string;
  name: string;
  code: string;
  logo?: string;
  address: string;
  city: string;
  country: string;
  gpsLocation?: string;
  phone: string;
  email: string;
  workingHours: string;
  timeZone: string;
  currency: string;
  taxRate?: number;
  taxId?: string;
  status: BranchStatus;
  hierarchyType: BranchHierarchyType;
  isHeadOffice?: boolean;
  managerId?: string;
  managerName?: string;
  parentBranchId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BranchSettings {
  id: string;
  branchId: string;
  autoApproveTransfers: boolean;
  allowNegativeStock: boolean;
  receiptHeader?: string;
  receiptFooter?: string;
  maxDiscountPercent: number;
  enableDelivery: boolean;
  enableDineIn: boolean;
  updatedAt?: string;
}

export type TransferType = 'inventory' | 'product' | 'cash' | 'employee';
export type TransferStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';

export interface TransferItem {
  itemId: string;
  itemName: string;
  type: 'ingredient' | 'product';
  quantity: number;
  unit: string;
  unitCost: number;
}

export interface BranchTransfer {
  id: string;
  transferNumber: string;
  transferType: TransferType;
  sourceBranchId: string;
  sourceBranchName: string;
  destinationBranchId: string;
  destinationBranchName: string;
  items?: TransferItem[];
  cashAmount?: number;
  employeeId?: string;
  employeeName?: string;
  isPermanentEmployeeTransfer?: boolean;
  reason: string;
  status: TransferStatus;
  requestedBy: string;
  approvedBy?: string;
  rejectionReason?: string;
  createdAt: string;
  completedAt?: string;
}

export interface BranchInventoryItem {
  id: string;
  branchId: string;
  branchName: string;
  itemId: string;
  itemType: 'ingredient' | 'product';
  itemName: string;
  stock: number;
  minStockAlert: number;
  unit: string;
  costPerUnit: number;
  lastUpdated: string;
}

export interface BranchReportData {
  id: string;
  branchId: string;
  branchName: string;
  period: 'today' | 'this_week' | 'this_month' | 'this_year';
  totalSales: number;
  totalOrders: number;
  totalExpenses: number;
  netProfit: number;
  cogs: number;
  totalEmployees: number;
  inventoryValuation: number;
  generatedAt: string;
}

// Phase 14 Delivery Management & Logistics Interfaces

export type DeliveryStatus = 
  | 'unassigned'
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'picked_up'
  | 'on_the_way'
  | 'arrived'
  | 'delivered'
  | 'failed'
  | 'returned'
  | 'cancelled';

export interface DeliveryOrder {
  id: string;
  deliveryNumber: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryZoneId?: string;
  deliveryZoneName?: string;
  gpsLocation?: {
    lat: number;
    lng: number;
  };
  currentLat?: number;
  currentLng?: number;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  branchId?: string;
  branchName?: string;
  status: DeliveryStatus;
  subtotal: number;
  deliveryFee: number;
  tipAmount?: number;
  totalAmount: number;
  paymentMethod: 'cash' | 'evc_plus' | 'card' | 'zaad';
  paymentStatus: 'pending' | 'paid';
  itemsCount: number;
  itemsSummary?: string;
  assignedAt?: string;
  acceptedAt?: string;
  pickedUpAt?: string;
  onTheWayAt?: string;
  arrivedAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  failureReason?: string;
  estimatedDeliveryTimeMinutes: number;
  actualDeliveryTimeMinutes?: number;
  customerRating?: number;
  customerFeedback?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DeliveryTracking {
  id: string;
  deliveryId: string;
  driverId: string;
  lat: number;
  lng: number;
  speedKmH?: number;
  heading?: number;
  timestamp: string;
  statusUpdate?: DeliveryStatus;
  note?: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  code: string;
  city: string;
  coverageRadiusKm: number;
  baseDeliveryFee: number;
  deliveryFee?: number;
  deliveryFeeEnabled?: boolean;
  minOrderAmount: number;
  estimatedTimeMinutes: number;
  isActive: boolean;
  branchId?: string;
  branchName?: string;
  createdAt: string;
}

export interface DeliveryReportData {
  id: string;
  period: 'today' | 'this_week' | 'this_month';
  totalDeliveries: number;
  completedDeliveries: number;
  failedDeliveries: number;
  avgDeliveryTimeMinutes: number;
  totalDeliveryFeesCollected: number;
  totalDriverPayouts: number;
  topDriverName?: string;
  customerSatisfactionRating: number;
  generatedAt: string;
}

export interface DeliveryNotification {
  id: string;
  deliveryId: string;
  title: string;
  message: string;
  type: 'driver_assigned' | 'driver_arrived' | 'order_delivered' | 'delivery_delayed';
  targetUser: 'customer' | 'driver' | 'admin';
  createdAt: string;
  read: boolean;
}

export type {
  JournalLine,
  JournalEntry,
  Account,
  AccountType,
  LedgerEntry,
  AccountingExpense,
  AccountingRevenue
} from './domain/entities/accounting';



