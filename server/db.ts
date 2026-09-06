import { cert, initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import firebaseConfig from '../firebase-applet-config.json';

export function getFirebaseProjectId(): string {
  const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (isProduction) {
    const explicitProductionId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
    if (!explicitProductionId) {
      throw new Error('FIREBASE_PROJECT_ID is required in production; refusing implicit project selection or bundled-project fallback.');
    }
    return explicitProductionId;
  }

  const explicit =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.VITE_FIREBASE_PROJECT_ID;

  if (explicit && explicit.trim()) return explicit.trim();
  return firebaseConfig.projectId;
}

export function getFirebaseApiKey(): string {
  const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (isProduction) {
    const explicit = String(process.env.FIREBASE_API_KEY || '').trim();
    if (!explicit) throw new Error('FIREBASE_API_KEY is required in production for REST auth fallback.');
    return explicit;
  }
  return (
    process.env.VITE_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    firebaseConfig.apiKey ||
    ''
  );
}

export class InMemoryFirestoreMock {
  private store: Map<string, Map<string, any>> = new Map();

  constructor() {
    const coreAccounts: Array<[string, { id: string; code: string; name: string; type: string; balance: number; branchId: string }]> = [
      ['acc_cash', { id: 'acc_cash', code: '1010', name: 'Cash on Hand (Register)', type: 'Asset', balance: 0, branchId: 'all' }],
      ['acc_bank', { id: 'acc_bank', code: '1020', name: 'Primary Bank', type: 'Asset', balance: 0, branchId: 'all' }],
      ['acc_inventory', { id: 'acc_inventory', code: '1030', name: 'Food & Beverage Inventory Asset', type: 'Asset', balance: 0, branchId: 'all' }],
      ['acc_ar', { id: 'acc_ar', code: '1200', name: 'Accounts Receivable', type: 'Asset', balance: 0, branchId: 'all' }],
      ['acc_ap', { id: 'acc_ap', code: '2010', name: 'Accounts Payable', type: 'Liability', balance: 0, branchId: 'all' }],
      ['acc_equity', { id: 'acc_equity', code: '3000', name: 'Owner Equity', type: 'Equity', balance: 0, branchId: 'all' }],
      ['acc_revenue', { id: 'acc_revenue', code: '4010', name: 'Sales Revenue', type: 'Revenue', balance: 0, branchId: 'all' }],
      ['acc_cogs', { id: 'acc_cogs', code: '5010', name: 'Cost of Goods Sold', type: 'COGS', balance: 0, branchId: 'all' }],
      ['acc_expense', { id: 'acc_expense', code: '6100', name: 'General Expense', type: 'Expense', balance: 0, branchId: 'all' }],
      ['acc_payroll_expense', { id: 'acc_payroll_expense', code: '6120', name: 'Salaries & Wages Expense', type: 'Expense', balance: 0, branchId: 'all' }],
      ['acc_bank_fees', { id: 'acc_bank_fees', code: '6200', name: 'Bank Charges & Merchant Fees', type: 'Expense', balance: 0, branchId: 'all' }],
      ['acc_tax', { id: 'acc_tax', code: '2100', name: 'Tax Payable', type: 'Liability', balance: 0, branchId: 'all' }],
      ['acc_delivery_revenue', { id: 'acc_delivery_revenue', code: '4020', name: 'Delivery Revenue', type: 'Revenue', balance: 0, branchId: 'all' }],
      ['acc_driver_expense', { id: 'acc_driver_expense', code: '6110', name: 'Driver Earnings Expense', type: 'Expense', balance: 0, branchId: 'all' }],
      ['acc_driver_payable', { id: 'acc_driver_payable', code: '2020', name: 'Driver Payable', type: 'Liability', balance: 0, branchId: 'all' }],
      ['acc_wallet_liability', { id: 'acc_wallet_liability', code: '2030', name: 'Customer Wallet Liability', type: 'Liability', balance: 0, branchId: 'all' }]
    ];
    const accountMap = this.getColMap('accounts');
    for (const [id, data] of coreAccounts) accountMap.set(id, JSON.parse(JSON.stringify(data)));
  }

  private getColMap(colName: string): Map<string, any> {
    if (!this.store.has(colName)) {
      this.store.set(colName, new Map());
    }
    return this.store.get(colName)!;
  }

  collection(colName: string) {
    const self = this;
    return {
      doc(docId?: string) {
        const id = docId || `id_${Math.random().toString(36).substring(2, 9)}`;
        const docRef = {
          id,
          path: `${colName}/${id}`,
          get ref() { return docRef; },
          async get() {
            const data = self.getColMap(colName).get(id);
            return {
              id,
              ref: docRef,
              exists: data !== undefined,
              data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined)
            };
          },
          async set(data: any, options?: { merge?: boolean }) {
            if (options?.merge) {
              const existing = self.getColMap(colName).get(id) || {};
              self.getColMap(colName).set(id, { ...existing, ...JSON.parse(JSON.stringify(data)) });
            } else {
              self.getColMap(colName).set(id, JSON.parse(JSON.stringify(data)));
            }
          },
          async update(data: any) {
            const existing = self.getColMap(colName).get(id);
            if (!existing) {
              self.getColMap(colName).set(id, JSON.parse(JSON.stringify(data)));
            } else {
              self.getColMap(colName).set(id, { ...existing, ...JSON.parse(JSON.stringify(data)) });
            }
          },
          async delete() {
            self.getColMap(colName).delete(id);
          }
        };
        return docRef;
      },
      async get() {
        const docs = Array.from(self.getColMap(colName).entries()).map(([id, data]) => {
          const docRef = self.collection(colName).doc(id);
          return {
            id,
            ref: docRef,
            exists: true,
            data: () => JSON.parse(JSON.stringify(data))
          };
        });
        return { docs, empty: docs.length === 0, size: docs.length };
      },
      where(field: string, op: string, value: any) {
        const createQueryObj = (currentFilters: Array<{ field: string; op: string; value: any }>) => {
          return {
            where(f2: string, op2: string, val2: any) {
              return createQueryObj([...currentFilters, { field: f2, op: op2, value: val2 }]);
            },
            orderBy() { return this; },
            limit() { return this; },
            async get() {
              const all = Array.from(self.getColMap(colName).entries());
              const filtered = all.filter(([_, data]) => {
                if (!data) return false;
                for (const filter of currentFilters) {
                  const val = data[filter.field];
                  if (filter.op === '==') {
                    if (val !== filter.value) return false;
                  } else if (filter.op === 'in') {
                    if (!Array.isArray(filter.value) || !filter.value.includes(val)) return false;
                  } else if (filter.op === '>=') {
                    if (!(val >= filter.value)) return false;
                  } else if (filter.op === '<=') {
                    if (!(val <= filter.value)) return false;
                  } else if (filter.op === 'array-contains') {
                    if (!Array.isArray(val) || !val.includes(filter.value)) return false;
                  }
                }
                return true;
              });
              const docs = filtered.map(([id, data]) => {
                const docRef = self.collection(colName).doc(id);
                return {
                  id,
                  ref: docRef,
                  exists: true,
                  data: () => JSON.parse(JSON.stringify(data))
                };
              });
              return { docs, empty: docs.length === 0, size: docs.length };
            }
          };
        };
        return createQueryObj([{ field, op, value }]);
      },
      async add(data: any) {
        const id = `id_${Math.random().toString(36).substring(2, 9)}`;
        self.getColMap(colName).set(id, JSON.parse(JSON.stringify(data)));
        return this.doc(id);
      }
    };
  }

  batch() {
    const self = this;
    const operations: Array<() => Promise<void> | void> = [];
    return {
      set(docRef: any, data: any, options?: any) {
        operations.push(() => docRef.set(data, options));
        return this;
      },
      update(docRef: any, data: any) {
        operations.push(() => docRef.update(data));
        return this;
      },
      delete(docRef: any) {
        operations.push(() => docRef.delete());
        return this;
      },
      async commit() {
        for (const op of operations) {
          await op();
        }
      }
    };
  }

  async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    const self = this;
    let hasWritten = false;
    const tx = {
      async get(docRefOrQuery: any) {
        if (hasWritten) {
          throw new Error('Firestore transactions require all reads to be executed before all writes.');
        }
        return await docRefOrQuery.get();
      },
      async getAll(...docRefs: any[]) {
        if (hasWritten) {
          throw new Error('Firestore transactions require all reads to be executed before all writes.');
        }
        return await Promise.all(docRefs.map(ref => ref.get()));
      },
      set(docRef: any, data: any, options?: any) {
        hasWritten = true;
        docRef.set(data, options);
        return this;
      },
      update(docRef: any, data: any) {
        hasWritten = true;
        docRef.update(data);
        return this;
      },
      delete(docRef: any) {
        hasWritten = true;
        docRef.delete();
        return this;
      },
      create(docRef: any, data: any) {
        hasWritten = true;
        docRef.set(data);
        return this;
      }
    };
    return await updateFunction(tx);
  }

  doc(path: string) {
    const parts = path.split('/');
    if (parts.length === 2) {
      return this.collection(parts[0]).doc(parts[1]);
    }
    throw new Error(`Invalid path ${path}`);
  }
}

const inMemoryTestDb = new InMemoryFirestoreMock();

/**
 * Initialize Firebase Admin exactly once.
 *
 * Render is not a Google-managed runtime, so Application Default Credentials
 * (ADC) are not implicitly available. Production therefore must use the
 * service-account values supplied through FIREBASE_* environment variables.
 * The private key is normalized because hosting dashboards commonly store
 * escaped newline sequences (\\n) instead of literal newlines.
 */
function ensureAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const projectId = getFirebaseProjectId();
  const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();

  if (isProduction && (!clientEmail || !privateKey)) {
    throw new Error(
      'Firebase Admin production credentials are incomplete: FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are required.'
    );
  }

  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey
      }),
      projectId
    });
  }

  // Development may still use local Google ADC when no explicit service
  // account credentials are configured. Production never falls through here.
  return initializeApp({ projectId });
}

export function getAdminDb(): any {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
    return inMemoryTestDb;
  }
  ensureAdminApp();
  return getFirestore();
}

export function getAdminAuth() {
  ensureAdminApp();
  return getAuth();
}

export function getAdminMessaging(): any {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
    return {
      async send(msg: any) {
        return 'projects/test/messages/mock_msg_id';
      }
    };
  }
  ensureAdminApp();
  return getMessaging();
}
