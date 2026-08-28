import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, setDoc } from 'firebase/firestore';
import { db, COLLECTIONS, getAuthToken } from '../../lib/firebase';
import { getApiUrl } from '../../lib/apiConfig';
import { IAdminRepository } from '../../domain/repositories/IAdminRepository';
import { Category, Customer, Branch, Revenue, AISetting, UserPermission } from '../../domain/entities/admin';
import { handleFirestoreError, OperationType } from '../../infrastructure/firebase/errorHandler';

export class AdminRepositoryImpl implements IAdminRepository {
  async fetchCategories(): Promise<Category[]> {
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.CATEGORIES));
      const list: Category[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Category));
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, COLLECTIONS.CATEGORIES);
      return [];
    }
  }

  async createCategory(category: Omit<Category, 'id'>): Promise<Category> {
    const data = { ...category, createdAt: new Date().toISOString() };
    try {
      const ref = await addDoc(collection(db, COLLECTIONS.CATEGORIES), data);
      return { id: ref.id, ...data };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, COLLECTIONS.CATEGORIES);
      return { id: `cat-${Date.now()}`, ...data };
    }
  }

  async deleteCategory(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.CATEGORIES, id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.CATEGORIES);
    }
  }

  async fetchCustomers(): Promise<Customer[]> {
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.CUSTOMERS));
      const list: Customer[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Customer));
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, COLLECTIONS.CUSTOMERS);
      return [];
    }
  }

  async createCustomer(customer: Omit<Customer, 'id'>): Promise<Customer> {
    const data = { ...customer, createdAt: new Date().toISOString() };
    try {
      const ref = await addDoc(collection(db, COLLECTIONS.CUSTOMERS), data);
      return { id: ref.id, ...data };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, COLLECTIONS.CUSTOMERS);
      return { id: `cust-${Date.now()}`, ...data };
    }
  }

  async fetchBranches(): Promise<Branch[]> {
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.BRANCHES));
      const list: Branch[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Branch));
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, COLLECTIONS.BRANCHES);
      return [];
    }
  }

  async createBranch(branch: Omit<Branch, 'id'>): Promise<Branch> {
    const data = { ...branch, createdAt: new Date().toISOString() };
    try {
      const ref = await addDoc(collection(db, COLLECTIONS.BRANCHES), data);
      return { id: ref.id, ...data };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, COLLECTIONS.BRANCHES);
      return { id: `branch-${Date.now()}`, ...data };
    }
  }

  async toggleBranchStatus(id: string, status: 'active' | 'inactive'): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTIONS.BRANCHES, id), { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, COLLECTIONS.BRANCHES);
    }
  }

  async fetchRevenues(): Promise<Revenue[]> {
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.REVENUES));
      const list: Revenue[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Revenue));
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, COLLECTIONS.REVENUES);
      return [];
    }
  }

  async recordRevenue(revenue: Omit<Revenue, 'id'>): Promise<Revenue> {
    const data = { ...revenue, createdAt: new Date().toISOString() };
    try {
      const token = await getAuthToken();
      const res = await fetch(getApiUrl('/api/accounting/revenues'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Record Revenue Failed (${res.status})`);
      }
      const result = await res.json();
      return { id: result.id || `rev-${Date.now()}`, ...data };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, COLLECTIONS.REVENUES);
      return { id: `rev-${Date.now()}`, ...data };
    }
  }

  async fetchAISettings(): Promise<AISetting> {
    const defaultConfig: AISetting = {
      id: 'default-ai-settings',
      model: 'gemini-3.6-flash',
      temperature: 0.2,
      autoReorderEnabled: true,
      smartPricingEnabled: true,
      languageMode: 'auto',
      systemPromptAddon: 'Optimizing ERP performance and profit margin.',
      updatedAt: new Date().toISOString()
    };
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.AI_SETTINGS));
      if (!snap.empty) {
        const firstDoc = snap.docs[0];
        return { id: firstDoc.id, ...firstDoc.data() } as AISetting;
      }
      return defaultConfig;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, COLLECTIONS.AI_SETTINGS);
      return defaultConfig;
    }
  }

  async updateAISettings(settings: Partial<AISetting>): Promise<void> {
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.AI_SETTINGS));
      if (!snap.empty) {
        const docId = snap.docs[0].id;
        await updateDoc(doc(db, COLLECTIONS.AI_SETTINGS, docId), { ...settings, updatedAt: new Date().toISOString() });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, COLLECTIONS.AI_SETTINGS);
    }
  }

  async fetchUserPermissions(): Promise<UserPermission[]> {
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.PERMISSIONS));
      const list: UserPermission[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as UserPermission));
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, COLLECTIONS.PERMISSIONS);
      return [];
    }
  }

  async updateUserPermission(permissionId: string, role: UserPermission['role'], permissions: UserPermission['permissions']): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTIONS.PERMISSIONS, permissionId), {
        role,
        permissions,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, COLLECTIONS.PERMISSIONS);
    }
  }
}
