import { IInventoryRepository } from '../domain/repositories/IInventoryRepository';
import {
  InventoryItem,
  InventoryMovement,
  PurchaseOrder,
  Supplier,
  SupplierPayment,
  PurchaseReturn,
  InventoryAlert,
  InventoryValuationReport
} from '../domain/entities/inventory';
import { inventoryService } from '../domain/services/inventoryService';

export class InventoryController {
  constructor(private repo: IInventoryRepository) {}

  // Subscriptions
  subscribeInventoryItems(callback: (items: InventoryItem[]) => void, branchId?: string): () => void {
    return this.repo.subscribeInventoryItems(callback, branchId);
  }

  subscribeMovements(callback: (movements: InventoryMovement[]) => void, branchId?: string): () => void {
    return this.repo.subscribeMovements(callback, branchId);
  }

  subscribePurchaseOrders(callback: (orders: PurchaseOrder[]) => void, branchId?: string): () => void {
    return this.repo.subscribePurchaseOrders(callback, branchId);
  }

  subscribeSuppliers(callback: (suppliers: Supplier[]) => void, branchId?: string): () => void {
    return this.repo.subscribeSuppliers(callback, branchId);
  }

  // Items
  async getInventoryItems(branchId?: string): Promise<InventoryItem[]> {
    return this.repo.fetchInventoryItems(branchId);
  }

  async addInventoryItem(item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<InventoryItem> {
    return this.repo.addInventoryItem(item);
  }

  async updateInventoryItem(id: string, item: Partial<InventoryItem>): Promise<void> {
    return this.repo.updateInventoryItem(id, item);
  }

  async deleteInventoryItem(id: string): Promise<void> {
    return this.repo.deleteInventoryItem(id);
  }

  // Stock Operations & Adjustments
  async recordStockMovement(movement: Omit<InventoryMovement, 'id' | 'createdAt'>): Promise<InventoryMovement> {
    return this.repo.recordMovement(movement);
  }

  async performStockAdjustment(
    itemId: string,
    newQuantity: number,
    reason: string,
    adjustedBy: string,
    branchId?: string
  ): Promise<void> {
    const items = await this.repo.fetchInventoryItems(branchId);
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new Error('Inventory item not found');

    const prevQty = item.currentQuantity;
    await this.repo.recordMovement({
      type: 'adjustment',
      itemType: 'inventory',
      mode: 'set',
      itemId,
      itemName: item.itemName,
      itemCode: item.itemCode,
      quantity: newQuantity,
      unit: item.unit,
      previousQuantity: prevQty,
      newQuantity: newQuantity,
      reason: reason || 'Manual Stock Count / Adjustment',
      createdBy: adjustedBy,
      branchId: item.branchId || branchId
    });
  }

  async performStockTransfer(
    itemId: string,
    quantity: number,
    fromLocation: string,
    toLocation: string,
    transferredBy: string,
    branchId?: string
  ): Promise<void> {
    const items = await this.repo.fetchInventoryItems(branchId);
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new Error('Inventory item not found');
    if (quantity <= 0) throw new Error('Transfer quantity must be positive');
    if (item.currentQuantity < quantity) throw new Error(`Insufficient stock for transfer. Current: ${item.currentQuantity}, requested: ${quantity}`);

    await this.repo.updateInventoryItem(itemId, { storageLocation: toLocation });

    await this.repo.recordMovement({
      type: 'transfer',
      itemId,
      itemName: item.itemName,
      itemCode: item.itemCode,
      quantity,
      unit: item.unit,
      fromLocation,
      toLocation,
      reason: `Stock Transfer from ${fromLocation} to ${toLocation}`,
      createdBy: transferredBy,
      itemType: 'inventory',
      branchId: item.branchId || branchId
    });
  }

  async recordInventoryWaste(
    itemId: string,
    quantity: number,
    reason: string,
    recordedBy: string,
    branchId?: string
  ): Promise<void> {
    const items = await this.repo.fetchInventoryItems(branchId);
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new Error('Inventory item not found');
    if (quantity <= 0) throw new Error('Waste quantity must be positive');

    const newQty = Math.max(0, item.currentQuantity - quantity);

    await this.repo.recordMovement({
      type: 'waste',
      itemType: 'inventory',
      itemId,
      itemName: item.itemName,
      itemCode: item.itemCode,
      quantity,
      unit: item.unit,
      previousQuantity: item.currentQuantity,
      newQuantity: newQty,
      reason: `Waste Logged: ${reason}`,
      cost: quantity * (item.purchaseCost || 0),
      createdBy: recordedBy,
      branchId: item.branchId || branchId
    });
  }

  // Purchasing & Orders
  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    return this.repo.fetchPurchaseOrders();
  }

  async createPurchaseOrder(po: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<PurchaseOrder> {
    return this.repo.createPurchaseOrder(po);
  }

  async approvePurchaseOrder(id: string, approvedBy: string): Promise<void> {
    return this.repo.approvePurchaseOrder(id, approvedBy);
  }

  async receiveGoods(
    poId: string,
    receivedItems: { itemId: string; receivedQty: number; batchNumber?: string; expirationDate?: string }[],
    receivedBy: string
  ): Promise<void> {
    return this.repo.receiveGoods(poId, receivedItems, receivedBy);
  }

  async getPurchaseReturns(branchId?: string): Promise<PurchaseReturn[]> {
    return this.repo.fetchPurchaseReturns(branchId);
  }

  async createPurchaseReturn(data: {
    itemId: string;
    supplierId?: string;
    supplierName?: string;
    poId?: string;
    quantity: number;
    unitCost?: number;
    reason: string;
    date?: string;
    branchId?: string;
  }): Promise<PurchaseReturn> {
    return this.repo.createPurchaseReturn(data);
  }

  // Suppliers
  async getSuppliers(): Promise<Supplier[]> {
    return this.repo.fetchSuppliers();
  }

  async addSupplier(supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Supplier> {
    return this.repo.addSupplier(supplier);
  }

  async updateSupplier(id: string, supplier: Partial<Supplier>): Promise<void> {
    return this.repo.updateSupplier(id, supplier);
  }

  async deleteSupplier(id: string): Promise<void> {
    return this.repo.deleteSupplier(id);
  }

  async fetchSupplierPayments(supplierId?: string, branchId?: string, isHQ?: boolean): Promise<SupplierPayment[]> {
    return this.repo.fetchSupplierPayments(supplierId, branchId, isHQ);
  }

  async recordSupplierPayment(payment: Omit<SupplierPayment, 'id' | 'createdAt'>): Promise<SupplierPayment> {
    return this.repo.recordSupplierPayment(payment);
  }

  // Analytics & Reports
  getAlerts(items: InventoryItem[], pos: PurchaseOrder[], suppliers: Supplier[]): InventoryAlert[] {
    return inventoryService.generateAlerts(items, pos, suppliers);
  }

  getValuationReport(items: InventoryItem[]): InventoryValuationReport {
    return inventoryService.calculateValuation(items);
  }

  exportCsv(filename: string, rows: Record<string, any>[]): void {
    inventoryService.exportToCsv(filename, rows);
  }

  exportPdf(title: string, headers: string[], rows: (string | number)[][]): void {
    inventoryService.exportToPrintPdf(title, headers, rows);
  }
}
