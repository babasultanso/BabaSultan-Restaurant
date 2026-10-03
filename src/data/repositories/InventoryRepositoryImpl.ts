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
import { db, COLLECTIONS, recordInventoryMovementFirestore, getAuthToken, getEffectiveBranchId, getEffectiveBranchScope } from '../../lib/firebase';
import { getApiUrl } from '../../lib/apiConfig';
import { IInventoryRepository } from '../../domain/repositories/IInventoryRepository';
import {
  InventoryItem,
  InventoryMovement,
  PurchaseOrder,
  Supplier,
  SupplierPayment,
  PurchaseReturn,
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
      const effectiveBranch = branchId || getEffectiveBranchScope();
      const q = effectiveBranch && effectiveBranch !== 'all'
        ? query(collection(db, COLLECTIONS.INVENTORY), where('branchId', '==', effectiveBranch))
        : query(collection(db, COLLECTIONS.INVENTORY), orderBy('itemName', 'asc'));
      const snap = await getDocs(q);
      const items: InventoryItem[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        if (!data.isDeleted && !data.isArchived && data.status !== 'deleted') {
          items.push({ id: d.id, ...data } as InventoryItem);
        }
      });
      if (effectiveBranch && effectiveBranch !== 'all') {
        items.sort((a, b) => String(a.itemName || '').localeCompare(String(b.itemName || '')));
      }
      return items;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.INVENTORY);
      throw err;
    }
  }

  subscribeInventoryItems(callback: (items: InventoryItem[]) => void, branchId?: string): () => void {
    const effectiveBranch = branchId || getEffectiveBranchScope();
    const q = effectiveBranch && effectiveBranch !== 'all'
      ? query(collection(db, COLLECTIONS.INVENTORY), where('branchId', '==', effectiveBranch))
      : query(collection(db, COLLECTIONS.INVENTORY), orderBy('itemName', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        const items: InventoryItem[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          if (!data.isDeleted && !data.isArchived && data.status !== 'deleted') {
            items.push({ id: d.id, ...data } as InventoryItem);
          }
        });
        if (effectiveBranch && effectiveBranch !== 'all') {
          items.sort((a, b) => String(a.itemName || '').localeCompare(String(b.itemName || '')));
        }
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

      const idempotencyKey = (itemData as any).idempotencyKey || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await fetch(getApiUrl('/api/inventory/items'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ itemData: { ...itemData, status, idempotencyKey } })
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
      const idempotencyKey = (updateData as any).idempotencyKey || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await fetch(getApiUrl(`/api/inventory/items/${id}/update`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ ...updateData, idempotencyKey })
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
      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await fetch(getApiUrl(`/api/inventory/items/${id}/delete`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ idempotencyKey })
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
      const effectiveBranch = branchId || getEffectiveBranchScope();
      const q = effectiveBranch && effectiveBranch !== 'all'
        ? query(collection(db, COLLECTIONS.INVENTORY_MOVEMENTS), where('branchId', '==', effectiveBranch), orderBy('createdAt', 'desc'))
        : query(collection(db, COLLECTIONS.INVENTORY_MOVEMENTS), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const movements: InventoryMovement[] = [];
      snap.forEach((d) => movements.push({ id: d.id, ...d.data() } as InventoryMovement));
      return movements;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.INVENTORY_MOVEMENTS);
      throw err;
    }
  }

  subscribeMovements(callback: (movements: InventoryMovement[]) => void, branchId?: string): () => void {
    const effectiveBranch = branchId || getEffectiveBranchScope();
    const q = effectiveBranch && effectiveBranch !== 'all'
      ? query(collection(db, COLLECTIONS.INVENTORY_MOVEMENTS), where('branchId', '==', effectiveBranch))
      : query(collection(db, COLLECTIONS.INVENTORY_MOVEMENTS), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const list: InventoryMovement[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as InventoryMovement));
        if (effectiveBranch && effectiveBranch !== 'all') {
          list.sort((a, b) => new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime());
        }
        callback(list);
      },
      (err) => handleFirestoreError(err, OperationType.GET, COLLECTIONS.INVENTORY_MOVEMENTS)
    );
  }

  async recordMovement(movementData: Omit<InventoryMovement, 'id' | 'createdAt'>): Promise<InventoryMovement> {
    try {
      const movementId = await recordInventoryMovementFirestore({ ...movementData, itemType: 'inventory' } as any);
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
      const effectiveBranch = branchId || getEffectiveBranchScope();
      const q = effectiveBranch && effectiveBranch !== 'all'
        ? query(collection(db, COLLECTIONS.PURCHASE_ORDERS), where('branchId', '==', effectiveBranch), orderBy('createdAt', 'desc'))
        : query(collection(db, COLLECTIONS.PURCHASE_ORDERS), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list: PurchaseOrder[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as PurchaseOrder));
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.PURCHASE_ORDERS);
      throw err;
    }
  }

  subscribePurchaseOrders(callback: (orders: PurchaseOrder[]) => void, branchId?: string): () => void {
    const effectiveBranch = branchId || getEffectiveBranchScope();
    const q = effectiveBranch && effectiveBranch !== 'all'
      ? query(collection(db, COLLECTIONS.PURCHASE_ORDERS), where('branchId', '==', effectiveBranch), orderBy('createdAt', 'desc'))
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
      const idempotencyKey = (poData as any).idempotencyKey || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await fetch(getApiUrl('/api/purchases/orders'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ poData: { ...poData, idempotencyKey } })
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
      const idempotencyKey = (poData as any).idempotencyKey || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await fetch(getApiUrl(`/api/purchases/orders/${id}/update`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ ...poData, idempotencyKey })
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
      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await fetch(getApiUrl(`/api/purchases/orders/${id}/approve`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ approvedBy, idempotencyKey })
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
      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await fetch(getApiUrl('/api/purchases/receive'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ poId, receivedItems, receivedBy, idempotencyKey })
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
      // Supplier documents in the canonical collection use `name`; older documents
      // may use `companyName`. Do not orderBy a field that may be absent because
      // Firestore omits documents missing that ordered field. Filter by branch only
      // and sort the normalized result in memory.
      const effectiveBranch = branchId || getEffectiveBranchScope();
      const q = effectiveBranch && effectiveBranch !== 'all'
        ? query(collection(db, COLLECTIONS.SUPPLIERS), where('branchId', '==', effectiveBranch))
        : collection(db, COLLECTIONS.SUPPLIERS);
      const snap = await getDocs(q);
      const list: Supplier[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.isDeleted || data.isArchived || data.isActive === false || data.status === 'deleted') return;
        const name = String(data.companyName ?? data.name ?? '').trim();
        list.push({ id: d.id, ...data, name, companyName: name } as unknown as Supplier);
      });
      list.sort((a, b) => String(a.companyName ?? a.name ?? '').localeCompare(String(b.companyName ?? b.name ?? '')));
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.SUPPLIERS);
      throw err;
    }
  }

  subscribeSuppliers(callback: (suppliers: Supplier[]) => void, branchId?: string): () => void {
    const effectiveBranch = branchId || getEffectiveBranchScope();
    const q = effectiveBranch && effectiveBranch !== 'all'
      ? query(collection(db, COLLECTIONS.SUPPLIERS), where('branchId', '==', effectiveBranch))
      : collection(db, COLLECTIONS.SUPPLIERS);
    return onSnapshot(
      q,
      (snap) => {
        const list: Supplier[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (data.isDeleted || data.isArchived || data.isActive === false || data.status === 'deleted') return;
          const name = String(data.companyName ?? data.name ?? '').trim();
          list.push({ id: d.id, ...data, name, companyName: name } as unknown as Supplier);
        });
        list.sort((a, b) => String(a.companyName ?? a.name ?? '').localeCompare(String(b.companyName ?? b.name ?? '')));
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
      const branchId = getEffectiveBranchId((supplierData as any).branchId || (supplierData as any).branch);
      const sName = (supplierData as any).companyName || (supplierData as any).name || 'Supplier';
      const contact = (supplierData as any).contactPerson || (supplierData as any).contactName || '';
      const {
        pendingAmount: _pending,
        overdueAmount: _overdue,
        outstandingBalance: _outstanding,
        ...safeSupplierData
      } = supplierData as any;
      const sup: Supplier = {
        ...safeSupplierData,
        name: sName,
        companyName: sName,
        contactPerson: contact,
        contactName: contact,
        pendingAmount: 0,
        overdueAmount: 0,
        outstandingBalance: 0,
        branchId,
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
      const {
        pendingAmount: _pending,
        overdueAmount: _overdue,
        outstandingBalance: _outstanding,
        branchId: _branchId,
        ...safeSupplierData
      } = supplierData as any;
      await updateDoc(supRef, cleanUndefined({
        ...safeSupplierData,
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
      const now = new Date().toISOString();
      await updateDoc(supRef, {
        isDeleted: true,
        isActive: false,
        isArchived: true,
        status: 'deleted',
        deletedAt: now,
        updatedAt: now
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.SUPPLIERS}/${id}`);
      throw err;
    }
  }

  // Supplier Payments
  async fetchSupplierPayments(supplierId?: string, branchId?: string, isHQ?: boolean): Promise<SupplierPayment[]> {
    try {
      const effectiveBranch = branchId || getEffectiveBranchScope();
      const isBranchScoped = !isHQ && effectiveBranch && effectiveBranch !== 'all';
      let q = query(collection(db, COLLECTIONS.SUPPLIER_PAYMENTS), orderBy('paymentDate', 'desc'));
      if (isBranchScoped && supplierId) {
        q = query(collection(db, COLLECTIONS.SUPPLIER_PAYMENTS), where('branchId', '==', effectiveBranch), where('supplierId', '==', supplierId), orderBy('paymentDate', 'desc'));
      } else if (isBranchScoped) {
        q = query(collection(db, COLLECTIONS.SUPPLIER_PAYMENTS), where('branchId', '==', effectiveBranch), orderBy('paymentDate', 'desc'));
      } else if (supplierId) {
        q = query(collection(db, COLLECTIONS.SUPPLIER_PAYMENTS), where('supplierId', '==', supplierId), orderBy('paymentDate', 'desc'));
      }
      const snap = await getDocs(q);
      const list: SupplierPayment[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as SupplierPayment));
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, COLLECTIONS.SUPPLIER_PAYMENTS);
      throw err;
    }
  }

  async recordSupplierPayment(paymentData: Omit<SupplierPayment, 'id' | 'createdAt'>): Promise<SupplierPayment> {
    try {
      const token = await getAuthToken();
      const idempotencyKey = (paymentData as any).idempotencyKey || `supplier-payment:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
      const res = await fetch(getApiUrl('/api/purchases/supplier-payment'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ ...paymentData, idempotencyKey })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Supplier payment recording failed (${res.status})`);
      }
      const data = await res.json();
      return {
        ...paymentData,
        id: data.id,
        createdAt: data.createdAt || new Date().toISOString()
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.SUPPLIER_PAYMENTS);
      throw err;
    }
  }

  async fetchPurchaseReturns(branchId?: string): Promise<PurchaseReturn[]> {
    try {
      const token = await getAuthToken();
      const effectiveBranch = branchId || getEffectiveBranchScope();
      const queryParam = effectiveBranch ? `?branchId=${encodeURIComponent(effectiveBranch)}` : '';
      const res = await fetch(getApiUrl(`/api/purchases/returns${queryParam}`), {
        method: 'GET',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to fetch purchase returns (${res.status})`);
      }
      const data = await res.json();
      return Array.isArray(data.purchaseReturns) ? data.purchaseReturns : [];
    } catch (err) {
      console.warn('fetchPurchaseReturns error:', err);
      return [];
    }
  }

  async createPurchaseReturn(returnData: {
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
    const token = await getAuthToken();
    const idempotencyKey = `purchase-return:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    const res = await fetch(getApiUrl('/api/purchases/returns'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        returnData: {
          ...returnData,
          branchId: returnData.branchId || getEffectiveBranchId()
        },
        idempotencyKey
      })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Purchase return failed (${res.status})`);
    }
    const data = await res.json();
    return data.purchaseReturn as PurchaseReturn;
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
