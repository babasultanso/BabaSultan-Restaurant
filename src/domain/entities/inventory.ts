export type InventoryCategory =
  | 'Raw Materials'
  | 'Finished Products'
  | 'Packaging Materials'
  | 'Beverages'
  | 'Cleaning Supplies';

export type InventoryUnit =
  | 'kg'
  | 'g'
  | 'liters'
  | 'ml'
  | 'pcs'
  | 'boxes'
  | 'bags'
  | 'bottles'
  | 'cans'
  | 'packs';

export type InventoryItemStatus =
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'expired'
  | 'overstock';

export interface InventoryItem {
  id: string;
  itemName: string;
  itemCode: string;
  barcode: string;
  category: InventoryCategory | string;
  unit: InventoryUnit | string;
  purchaseCost: number;
  sellingCost: number;
  currentQuantity: number;
  minimumQuantity: number;
  maximumQuantity: number;
  reorderLevel: number;
  storageLocation: string;
  branchId?: string;
  branch?: string;
  supplierId?: string;
  supplierName?: string;
  expirationDate?: string; // YYYY-MM-DD
  batchNumber?: string;
  status: InventoryItemStatus;
  createdAt: string;
  updatedAt: string;
}

export type MovementType =
  | 'stock_in'
  | 'stock_out'
  | 'adjustment'
  | 'transfer'
  | 'waste'
  | 'expired'
  | 'count'
  | 'order_deduction'
  | 'order_restoration';

export interface InventoryMovement {
  id: string;
  type: MovementType;
  itemId: string;
  itemName: string;
  itemCode?: string;
  branchId?: string;
  branch?: string;
  quantity: number;
  unit: string;
  previousQuantity?: number;
  newQuantity?: number;
  reason: string;
  fromLocation?: string;
  toLocation?: string;
  referenceId?: string; // Order # or PO #
  cost?: number;
  createdBy: string;
  createdAt: string;
}

export type PurchaseOrderType =
  | 'request'
  | 'order'
  | 'goods_receiving'
  | 'invoice'
  | 'return';

export type PurchaseOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'ordered'
  | 'partially_received'
  | 'received'
  | 'completed'
  | 'cancelled';

export interface PurchaseOrderItem {
  id?: string;
  itemId: string;
  itemName: string;
  itemCode?: string;
  requestedQuantity: number;
  receivedQuantity?: number;
  unitPrice: number;
  totalAmount: number;
  unit: string;
  expirationDate?: string;
  batchNumber?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  type: PurchaseOrderType;
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  status: PurchaseOrderStatus;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  expectedDeliveryDate?: string;
  paymentDueDate?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxNumber: string;
  paymentTerms: string;
  productsSupplied: string[];
  outstandingBalance: number;
  rating: number; // 1 to 5
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId?: string;
  amount: number;
  paymentMethod: 'bank_transfer' | 'cash' | 'check' | 'card' | 'evc_plus';
  referenceNumber: string;
  paymentDate: string;
  status: 'completed' | 'pending' | 'failed';
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface InventoryAlert {
  id: string;
  type:
    | 'low_stock'
    | 'out_of_stock'
    | 'expiring_soon'
    | 'expired'
    | 'overdue_po'
    | 'overdue_payment'
    | 'discrepancy';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  referenceId?: string;
  createdAt: string;
  read: boolean;
}

export interface InventoryValuationReport {
  totalItemsCount: number;
  totalStockQuantity: number;
  totalPurchaseValuation: number;
  totalSellingValuation: number;
  potentialProfitMargin: number;
  categoryValuation: {
    category: string;
    itemCount: number;
    totalValuation: number;
  }[];
}
