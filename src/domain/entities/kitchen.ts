export type KitchenStationType = 'grill' | 'pizza' | 'drinks' | 'dessert' | 'packing';
export type KitchenPrepStatus = 'new' | 'accepted' | 'cooking' | 'ready_for_pickup' | 'completed' | 'cancelled';
export type KitchenOrderPriority = 'normal' | 'priority' | 'urgent';

export interface KitchenOrderItemChoice {
  optionName?: string;
  choiceName: string;
  extraPrice?: number;
}

export interface KitchenOrderItem {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  notes?: string;
  selectedOptions?: KitchenOrderItemChoice[];
  assignedStation: KitchenStationType;
  itemStatus: KitchenPrepStatus;
}

export interface KitchenTicket {
  id: string;
  orderId: string;
  orderNumber: string;
  orderTime: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery' | 'online' | 'reservation';
  tableNumber?: string;
  customerName?: string;
  items: KitchenOrderItem[];
  prepStatus: KitchenPrepStatus;
  priority: KitchenOrderPriority;
  estimatedPrepTimeMinutes: number;
  actualPrepTimeMinutes?: number;
  startedAt?: string;
  readyAt?: string;
  completedAt?: string;
  assignedStaff?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KitchenStation {
  id: string;
  name: string;
  stationType: KitchenStationType;
  assignedChef: string;
  chefId?: string;
  activeOrdersCount: number;
  completedOrdersToday: number;
  avgPrepTimeMinutes: number;
  status: 'normal' | 'busy' | 'overloaded';
  supportedCategories: string[];
}

export interface KitchenWasteLog {
  id: string;
  orderId?: string;
  itemOrIngredientName: string;
  quantity: number;
  unit: string;
  reason: string;
  cost: number;
  loggedBy: string;
  createdAt: string;
}

export interface KitchenPerformanceMetrics {
  activeOrdersCount: number;
  completedOrdersCount: number;
  delayedOrdersCount: number;
  avgPrepTimeMinutes: number;
  stationStats: {
    stationType: KitchenStationType;
    stationName: string;
    activeCount: number;
    avgPrepTime: number;
    status: 'normal' | 'busy' | 'overloaded';
  }[];
  chefPerformance: {
    chefName: string;
    station: string;
    itemsCompleted: number;
    avgSpeedMins: number;
  }[];
}
