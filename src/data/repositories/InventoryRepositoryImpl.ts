import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  writeBatch
} from 'firebase/firestore';
import { db, COLLECTIONS, recordInventoryMovementFirestore, getAuthToken } from '../../lib/firebase';
import { getApiUrl } from '../../lib/apiConfig';
import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import {
  InventoryItem,
  InventoryMovement,
  PurchaseOrder,
  Supplier,
  SupplierPayment,
  InventoryItemStatus
} from '../../domain/entities/inventory';

function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefined) as unknown as T;
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        res[key] = cleanUndefined(val);
      }
    }
    return res as T;
  }
  return obj;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.warn('Firestore Inventory Note: ', JSON.stringify(errInfo));
}

export class InventoryRepositoryImpl implements IInventoryRepository {
  // Inventory Items
  async fetchInventoryItems(branchId?: string): Promise<InventoryItem[]> {
    try {
      const q = branchId && branchId !== 'all'
        ? query(collection(db, COLLECTIONS.INVENTORY), where('branchId', '==', branchId), orderBy('itemName', 'asc'))
        : query(collection(db, COLLECTIONS.INVENTORY), orderBy('itemName', 'asc'));
      const snap = await getDocs(q);
      const items: InventoryItem[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() } as InventoryItem));
      return items;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.INVENTORY);
      return [];
    }
  }

  subscribeInventoryItems(callback: (items: InventoryItem[]) => void, branchId?: string): () => void {
    const q = branchId && branchId !== 'all'
      ? query(collection(db, COLLECTIONS.INVENTORY), where('branchId', '==', branchId), orderBy('itemName', 'asc'))
      : query(collection(db, COLLECTIONS.INVENTORY), orderBy('itemName', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        const items: InventoryItem[] = [];
        snap.forEach((d) => items.push({ id: d.id, ...d.data() } as InventoryItem));
        callback(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, COLLECTIONS.INVENTORY);
        callback([]);
      }
    );
  }

  async addInventoryItem(itemData: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<InventoryItem> {
    try {
      const token = await getAuthToken();
      const status = this.calculateStatus(
        itemData.currentQuantity,
        itemData.minimumQuantity,
        itemData.maximumQuantity,
        itemData.expirationDate
      );

      const res = await fetch(getApiUrl('/api/inventory/items'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ itemData: { ...itemData, status } })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Add Inventory Item Failed (${res.status})`);
      }

      const data = await res.json();
      return data.item;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.INVENTORY);
      throw err;
    }
  }

  async updateInventoryItem(id: string, updateData: Partial<InventoryItem>): Promise<void> {
    try {
      const token = await getAuthToken();
      const res = await fetch(getApiUrl(`/api/inventory/items/${id}/update`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(updateData)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Update Inventory Item Failed (${res.status})`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.INVENTORY}/${id}`);
      throw err;
    }
  }

  async deleteInventoryItem(id: string): Promise<void> {
    try {
      const token = await getAuthToken();
      const res = await fetch(getApiUrl(`/api/inventory/items/${id}/delete`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Delete Inventory Item Failed (${res.status})`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.INVENTORY}/${id}`);
      throw err;
    }
  }

  // Stock Movements
  async fetchMovements(branchId?: string): Promise<InventoryMovement[]> {
    try {
      const q = branchId && branchId !== 'all'
        ? query(collection(db, COLLECTIONS.INVENTORY_MOVEMENTS), where('branchId', '==', branchId), orderBy('createdAt', 'desc'))
        : query(collection(db, COLLECTIONS.INVENTORY_MOVEMENTS), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const movements: InventoryMovement[] = [];
      snap.forEach((d) => movements.push({ id: d.id, ...d.data() } as InventoryMovement));
      return movements;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.INVENTORY_MOVEMENTS);
      return [];
    }
  }

  subscribeMovements(callback: (movements: InventoryMovement[]) => void, branchId?: string): () => void {
    const q = branchId && branchId !== 'all'
      ? query(collection(db, COLLECTIONS.INVENTORY_MOVEMENTS), where('branchId', '==', branchId), orderBy('createdAt', 'desc'))
      : query(collection(db, COLLECTIONS.INVENTORY_MOVEMENTS), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const list: InventoryMovement[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as InventoryMovement));
        callback(list);
      },
      (err) => handleFirestoreError(err, OperationType.GET, COLLECTIONS.INVENTORY_MOVEMENTS)
    );
  }

  async recordMovement(movementData: Omit<InventoryMovement, 'id' | 'createdAt'>): Promise<InventoryMovement> {
    try {
      const movementId = await recordInventoryMovementFirestore(movementData as any);
      return {
        ...movementData,
        id: movementId,
        createdAt: new Date().toISOString()
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.INVENTORY_MOVEMENTS);
      throw err;
    }
  }

  // Purchasing
  async fetchPurchaseOrders(branchId?: string): Promise<PurchaseOrder[]> {
    try {
      const q = branchId && branchId !== 'all'
        ? query(collection(db, COLLECTIONS.PURCHASE_ORDERS), where('branchId', '==', branchId), orderBy('createdAt', 'desc'))
        : query(collection(db, COLLECTIONS.PURCHASE_ORDERS), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list: PurchaseOrder[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as PurchaseOrder));
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.PURCHASE_ORDERS);
      return [];
    }
  }

  subscribePurchaseOrders(callback: (orders: PurchaseOrder[]) => void, branchId?: string): () => void {
    const q = branchId && branchId !== 'all'
      ? query(collection(db, COLLECTIONS.PURCHASE_ORDERS), where('branchId', '==', branchId), orderBy('createdAt', 'desc'))
      : query(collection(db, COLLECTIONS.PURCHASE_ORDERS), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const list: PurchaseOrder[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as PurchaseOrder));
        callback(list);
      },
      (err) => handleFirestoreError(err, OperationType.GET, COLLECTIONS.PURCHASE_ORDERS)
    );
  }

  async createPurchaseOrder(poData: Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>): Promise<PurchaseOrder> {
    try {
      const token = await getAuthToken();
      const res = await fetch(getApiUrl('/api/purchases/orders'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ poData })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Create Purchase Order Failed (${res.status})`);
      }

      const data = await res.json();
      return data.purchaseOrder;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.PURCHASE_ORDERS);
      throw err;
    }
  }

  async updatePurchaseOrder(id: string, poData: Partial<PurchaseOrder>): Promise<void> {
    try {
      const token = await getAuthToken();
      const res = await fetch(getApiUrl(`/api/purchases/orders/${id}/update`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(poData)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Update Purchase Order Failed (${res.status})`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.PURCHASE_ORDERS}/${id}`);
      throw err;
    }
  }

  async approvePurchaseOrder(id: string, approvedBy: string): Promise<void> {
    try {
      const token = await getAuthToken();
      const res = await fetch(getApiUrl(`/api/purchases/orders/${id}/approve`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ approvedBy })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Approve Purchase Order Failed (${res.status})`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.PURCHASE_ORDERS}/${id}`);
      throw err;
    }
  }

  async receiveGoods(
    poId: string,
    receivedItems: { itemId: string; receivedQty: number; batchNumber?: string; expirationDate?: string }[],
    receivedBy: string
  ): Promise<void> {
    try {
      const token = await getAuthToken();
      const res = await fetch(getApiUrl('/api/purchases/receive'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ poId, receivedItems, receivedBy })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Goods Receiving Failed (${res.status})`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.PURCHASE_ORDERS}/${poId}/receive`);
      throw err;
    }
  }

  // Suppliers
  async fetchSuppliers(branchId?: string): Promise<Supplier[]> {
    try {
      const q = branchId && branchId !== 'all'
        ? query(collection(db, COLLECTIONS.SUPPLIERS), where('branchId', '==', branchId), orderBy('companyName', 'asc'))
        : query(collection(db, COLLECTIONS.SUPPLIERS), orderBy('companyName', 'asc'));
      const snap = await getDocs(q);
      const list: Supplier[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Supplier));
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.SUPPLIERS);
      return [];
    }
  }

  subscribeSuppliers(callback: (suppliers: Supplier[]) => void, branchId?: string): () => void {
    const q = branchId && branchId !== 'all'
      ? query(collection(db, COLLECTIONS.SUPPLIERS), where('branchId', '==', branchId), orderBy('companyName', 'asc'))
      : query(collection(db, COLLECTIONS.SUPPLIERS), orderBy('companyName', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        const list: Supplier[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Supplier));
        callback(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, COLLECTIONS.SUPPLIERS);
        callback([]);
      }
    );
  }

  async addSupplier(supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Supplier> {
    try {
      const newRef = doc(collection(db, COLLECTIONS.SUPPLIERS));
      const now = new Date().toISOString();
      const sup: Supplier = {
        ...supplierData,
        id: newRef.id,
        createdAt: now,
        updatedAt: now
      };
      await setDoc(newRef, cleanUndefined(sup));
      return sup;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.SUPPLIERS);
      throw err;
    }
  }

  async updateSupplier(id: string, supplierData: Partial<Supplier>): Promise<void> {
    try {
      const supRef = doc(db, COLLECTIONS.SUPPLIERS, id);
      await updateDoc(supRef, cleanUndefined({
        ...supplierData,
        updatedAt: new Date().toISOString()
      }) as any);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${COLLECTIONS.SUPPLIERS}/${id}`);
      throw err;
    }
  }

  async deleteSupplier(id: string): Promise<void> {
    try {
      const supRef = doc(db, COLLECTIONS.SUPPLIERS, id);
      await deleteDoc(supRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.SUPPLIERS}/${id}`);
      throw err;
    }
  }

  // Supplier Payments
  async fetchSupplierPayments(supplierId?: string): Promise<SupplierPayment[]> {
    try {
      let q = query(collection(db, COLLECTIONS.SUPPLIER_PAYMENTS), orderBy('paymentDate', 'desc'));
      if (supplierId) {
        q = query(collection(db, COLLECTIONS.SUPPLIER_PAYMENTS), where('supplierId', '==', supplierId), orderBy('paymentDate', 'desc'));
      }
      const snap = await getDocs(q);
      const list: SupplierPayment[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as SupplierPayment));
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.SUPPLIER_PAYMENTS);
      return [];
    }
  }

  async recordSupplierPayment(paymentData: Omit<SupplierPayment, 'id' | 'createdAt'>): Promise<SupplierPayment> {
    try {
      const token = await getAuthToken();
      const res = await fetch(getApiUrl('/api/purchases/supplier-payment'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(paymentData)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Supplier payment recording failed (${res.status})`);
      }
      const data = await res.json();
      return {
        ...paymentData,
        id: data.id || 'sup_pay_' + Date.now(),
        createdAt: new Date().toISOString()
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.SUPPLIER_PAYMENTS);
      throw err;
    }
  }

  // Helper status calculation
  private calculateStatus(qty: number, min: number, max: number, expirationDate?: string): InventoryItemStatus {
    if (expirationDate) {
      const exp = new Date(expirationDate).getTime();
      if (!isNaN(exp) && exp < Date.now()) {
        return 'expired';
      }
    }
    if (qty <= 0) return 'out_of_stock';
    if (qty <= min) return 'low_stock';
    if (max > 0 && qty >= max) return 'overstock';
    return 'in_stock';
  }
}
