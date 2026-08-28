import {
  InventoryItem,
  InventoryMovement,
  PurchaseOrder,
  Supplier,
  SupplierPayment,
  InventoryAlert
} from '../entities/inventory';

export interface IInventoryRepository {
  // Inventory Items
  fetchInventoryItems(branchId?: string): Promise<InventoryItem[]>;
  subscribeInventoryItems(callback: (items: InventoryItem[]) => void, branchId?: string): () => void;
  addInventoryItem(item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<InventoryItem>;
  updateInventoryItem(id: string, item: Partial<InventoryItem>): Promise<void>;
  deleteInventoryItem(id: string): Promise<void>;

  // Stock Movements
  fetchMovements(branchId?: string): Promise<InventoryMovement[]>;
  subscribeMovements(callback: (movements: InventoryMovement[]) => void, branchId?: string): () => void;
  recordMovement(movement: Omit<InventoryMovement, 'id' | 'createdAt'>): Promise<InventoryMovement>;

  // Purchasing
  fetchPurchaseOrders(branchId?: string): Promise<PurchaseOrder[]>;
  subscribePurchaseOrders(callback: (orders: PurchaseOrder[]) => void, branchId?: string): () => void;
  createPurchaseOrder(order: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<PurchaseOrder>;
  updatePurchaseOrder(id: string, order: Partial<PurchaseOrder>): Promise<void>;
  approvePurchaseOrder(id: string, approvedBy: string): Promise<void>;
  receiveGoods(poId: string, receivedItems: { itemId: string; receivedQty: number; batchNumber?: string; expirationDate?: string }[], receivedBy: string): Promise<void>;

  // Suppliers
  fetchSuppliers(branchId?: string): Promise<Supplier[]>;
  subscribeSuppliers(callback: (suppliers: Supplier[]) => void, branchId?: string): () => void;
  addSupplier(supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Supplier>;
  updateSupplier(id: string, supplier: Partial<Supplier>): Promise<void>;
  deleteSupplier(id: string): Promise<void>;

  // Supplier Payments
  fetchSupplierPayments(supplierId?: string): Promise<SupplierPayment[]>;
  recordSupplierPayment(payment: Omit<SupplierPayment, 'id' | 'createdAt'>): Promise<SupplierPayment>;
}
