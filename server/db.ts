import { cert, applicationDefault, initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import firebaseConfig from '../firebase-applet-config.json';

export interface RequestIdempotencyContext {
  payloadHash: string;
  idempotencyKey?: string;
  conflictDetected?: boolean;
  conflictMessage?: string;
}

export const requestIdempotencyStorage = new AsyncLocalStorage<RequestIdempotencyContext>();
let fallbackIdempotencyContext: RequestIdempotencyContext | null = null;

export function setActiveIdempotencyContext(ctx: RequestIdempotencyContext | null): void {
  fallbackIdempotencyContext = ctx;
}

export function getActiveIdempotencyContext(): RequestIdempotencyContext | null {
  return requestIdempotencyStorage.getStore() || fallbackIdempotencyContext;
}

export function computeCanonicalPayloadHash(body: any, params?: any): string {
  const IGNORED_KEYS = new Set(['idempotencyKey', 'idempotency_key', 'createdAt', 'updatedAt', 'timestamp', 'itemOrIngredientName']);
  const normalize = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(normalize);
    const sortedKeys = Object.keys(obj)
      .filter((k) => !IGNORED_KEYS.has(k))
      .sort();
    const result: Record<string, any> = {};
    for (const key of sortedKeys) {
      if (obj[key] !== undefined) {
        result[key] = normalize(obj[key]);
      }
    }
    return result;
  };
  const combined = params && Object.keys(params).length > 0
    ? { body: normalize(body || {}), params: normalize(params) }
    : normalize(body || {});
  return createHash('sha256').update(JSON.stringify(combined)).digest('hex');
}

export function getFirebaseProjectId(): string {
  const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const explicit =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.VITE_FIREBASE_PROJECT_ID;

  if (explicit && explicit.trim()) return explicit.trim();
  if (isProduction) {
    const explicitProductionId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
    if (!explicitProductionId) {
      throw new Error('FIREBASE_PROJECT_ID is required in production');
    }
    return explicitProductionId.trim();
  }
  return firebaseConfig.projectId || 'babasultan-restaurant';
}

export function getFirebaseApiKey(): string {
  const explicit =
    process.env.FIREBASE_API_KEY ||
    process.env.VITE_FIREBASE_API_KEY;

  if (explicit && explicit.trim()) return explicit.trim();
  const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (isProduction) {
    throw new Error('FIREBASE_API_KEY is required in production for REST auth fallback.');
  }
  return firebaseConfig.apiKey || '';
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
      ['acc_driver_payable', { id: 'acc_driver_payable', code: '2020', name: 'Driver Payable', type: 'Liability', balance: 0, branchId: 'all' }],
      ['acc_wallet_liability', { id: 'acc_wallet_liability', code: '2030', name: 'Customer Wallet Liability', type: 'Liability', balance: 0, branchId: 'all' }],
      ['acc_tax', { id: 'acc_tax', code: '2100', name: 'Tax Payable', type: 'Liability', balance: 0, branchId: 'all' }],
      ['acc_equity', { id: 'acc_equity', code: '3000', name: 'Owner Equity', type: 'Equity', balance: 0, branchId: 'all' }],
      ['acc_revenue', { id: 'acc_revenue', code: '4010', name: 'Sales Revenue', type: 'Revenue', balance: 0, branchId: 'all' }],
      ['acc_delivery_revenue', { id: 'acc_delivery_revenue', code: '4020', name: 'Delivery Revenue', type: 'Revenue', balance: 0, branchId: 'all' }],
      ['acc_cogs', { id: 'acc_cogs', code: '5010', name: 'Cost of Goods Sold', type: 'COGS', balance: 0, branchId: 'all' }],
      ['acc_expense', { id: 'acc_expense', code: '6100', name: 'General Expense', type: 'Expense', balance: 0, branchId: 'all' }],
      ['acc_driver_expense', { id: 'acc_driver_expense', code: '6110', name: 'Driver Earnings Expense', type: 'Expense', balance: 0, branchId: 'all' }],
      ['acc_payroll_expense', { id: 'acc_payroll_expense', code: '6120', name: 'Salaries & Wages Expense', type: 'Expense', balance: 0, branchId: 'all' }],
      ['acc_bank_fees', { id: 'acc_bank_fees', code: '6200', name: 'Bank Charges & Merchant Fees', type: 'Expense', balance: 0, branchId: 'all' }],
      ['acc_cash_short', { id: 'acc_cash_short', code: '6290', name: 'Cash Shortage / Over & Short', type: 'Expense', balance: 0, branchId: 'all' }],
      ['acc_cash_over', { id: 'acc_cash_over', code: '4290', name: 'Cash Over / Other Income', type: 'Revenue', balance: 0, branchId: 'all' }],
      ['acc_waste', { id: 'acc_waste', code: '6300', name: 'Inventory Waste Expense', type: 'Expense', balance: 0, branchId: 'all' }],
      ['acc_inventory_adjustment', { id: 'acc_inventory_adjustment', code: '6310', name: 'Inventory Adjustment Expense', type: 'Expense', balance: 0, branchId: 'all' }],
      ['acc_due_from_branch', { id: 'acc_due_from_branch', code: '1310', name: 'Due From Branches', type: 'Asset', balance: 0, branchId: 'all' }],
      ['acc_due_to_branch', { id: 'acc_due_to_branch', code: '2110', name: 'Due To Branches', type: 'Liability', balance: 0, branchId: 'all' }]
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
            if (colName === 'mutation_idempotency' && data !== undefined) {
              const ctx = getActiveIdempotencyContext();
              if (ctx && ctx.payloadHash && data.payloadHash && data.payloadHash !== ctx.payloadHash) {
                ctx.conflictDetected = true;
                const keyLabel = ctx.idempotencyKey || data.idempotencyKey || id;
                ctx.conflictMessage = `Idempotency key reuse conflict: Idempotency-Key "${keyLabel}" was already used with a different request payload.`;
                throw Object.assign(new Error(ctx.conflictMessage), {
                  statusCode: 409,
                  code: 'IDEMPOTENCY_PAYLOAD_MISMATCH'
                });
              }
            }
            return {
              id,
              ref: docRef,
              exists: data !== undefined,
              data: () => {
                if (!data) return undefined;
                const copy = JSON.parse(JSON.stringify(data));
                if (colName === 'mutation_idempotency') {
                  delete copy.payloadHash;
                }
                return copy;
              }
            };
          },
          async set(data: any, options?: { merge?: boolean }) {
            const cloned = JSON.parse(JSON.stringify(data));
            if (colName === 'mutation_idempotency') {
              const ctx = getActiveIdempotencyContext();
              if (ctx?.payloadHash && !cloned.payloadHash) {
                cloned.payloadHash = ctx.payloadHash;
              }
            }
            if (options?.merge) {
              const existing = self.getColMap(colName).get(id) || {};
              self.getColMap(colName).set(id, { ...existing, ...cloned });
            } else {
              self.getColMap(colName).set(id, cloned);
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
        const createQueryObj = (
          currentFilters: Array<{ field: string; op: string; value: any }>,
          limitCount?: number
        ) => {
          return {
            where(f2: string, op2: string, val2: any) {
              return createQueryObj([...currentFilters, { field: f2, op: op2, value: val2 }], limitCount);
            },
            orderBy() { return this; },
            limit(n: number) {
              return createQueryObj(currentFilters, typeof n === 'number' && n > 0 ? n : limitCount);
            },
            async get() {
              const all = Array.from(self.getColMap(colName).entries());
              let filtered = all.filter(([_, data]) => {
                if (!data) return false;
                for (const filter of currentFilters) {
                  const val = data[filter.field];
                  if (filter.op === '==') {
                    if (val !== filter.value) return false;
                  } else if (filter.op === '!=') {
                    if (val === filter.value) return false;
                  } else if (filter.op === 'in') {
                    if (!Array.isArray(filter.value) || !filter.value.includes(val)) return false;
                  } else if (filter.op === '>=') {
                    if (!(val >= filter.value)) return false;
                  } else if (filter.op === '<=') {
                    if (!(val <= filter.value)) return false;
                  } else if (filter.op === '>') {
                    if (!(val > filter.value)) return false;
                  } else if (filter.op === '<') {
                    if (!(val < filter.value)) return false;
                  } else if (filter.op === 'array-contains') {
                    if (!Array.isArray(val) || !val.includes(filter.value)) return false;
                  }
                }
                return true;
              });
              if (typeof limitCount === 'number' && limitCount > 0) {
                filtered = filtered.slice(0, limitCount);
              }
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

  private txQueue: Promise<any> = Promise.resolve();

  async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      let hasWritten = false;
      const pendingOps: Array<() => Promise<any>> = [];
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
          pendingOps.push(() => docRef.set(data, options));
          return this;
        },
        update(docRef: any, data: any) {
          hasWritten = true;
          pendingOps.push(() => docRef.update(data));
          return this;
        },
        delete(docRef: any) {
          hasWritten = true;
          pendingOps.push(() => docRef.delete());
          return this;
        },
        create(docRef: any, data: any) {
          hasWritten = true;
          pendingOps.push(async () => {
            const snap = await docRef.get();
            if (snap.exists) {
              throw Object.assign(new Error(`Document already exists: ${docRef.path || docRef.id}`), {
                code: 6,
                statusCode: 409
              });
            }
            return await docRef.set(data);
          });
          return this;
        }
      };
      const result = await updateFunction(tx);
      for (const op of pendingOps) {
        await op();
      }
      return result;
    };
    const next = this.txQueue.then(run, run);
    this.txQueue = next.then(() => undefined, () => undefined);
    return next;
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

function validateAndStripIdempotencySnap(snap: any, fallbackId?: string): any {
  if (!snap || !snap.exists) return snap;
  const rawData = typeof snap.data === 'function' ? snap.data() : undefined;
  if (rawData) {
    const ctx = getActiveIdempotencyContext();
    if (ctx && ctx.payloadHash && rawData.payloadHash && rawData.payloadHash !== ctx.payloadHash) {
      ctx.conflictDetected = true;
      const keyLabel = ctx.idempotencyKey || rawData.idempotencyKey || snap.id || fallbackId || 'unknown';
      ctx.conflictMessage = `Idempotency key reuse conflict: Idempotency-Key "${keyLabel}" was already used with a different request payload.`;
      throw Object.assign(new Error(ctx.conflictMessage), {
        statusCode: 409,
        code: 'IDEMPOTENCY_PAYLOAD_MISMATCH'
      });
    }
  }
  return new Proxy(snap, {
    get(target, prop, receiver) {
      if (prop === 'data') {
        return () => {
          if (!rawData) return undefined;
          const copy = { ...rawData };
          delete copy.payloadHash;
          return copy;
        };
      }
      const val = Reflect.get(target, prop, receiver);
      return typeof val === 'function' ? val.bind(target) : val;
    }
  });
}

function attachIdempotencyPayloadHash(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const ctx = getActiveIdempotencyContext();
  if (ctx?.payloadHash && !data.payloadHash) {
    return { ...data, payloadHash: ctx.payloadHash };
  }
  return data;
}

function isMutationIdempotencyRef(ref: any): boolean {
  if (!ref) return false;
  if (ref.__isMutationIdempotencyRef) return true;
  const pathStr = String(ref.path || '');
  return pathStr.startsWith('mutation_idempotency/') || pathStr.includes('/mutation_idempotency/');
}

function wrapFirestoreWithIdempotency(rawDb: any): any {
  if (!rawDb || rawDb instanceof InMemoryFirestoreMock || rawDb.__idempotencyWrapped) return rawDb;
  const wrapped = new Proxy(rawDb, {
    get(target, prop, receiver) {
      if (prop === '__idempotencyWrapped') return true;
      if (prop === 'collection') {
        return (colName: string) => {
          const rawCol = target.collection(colName);
          if (colName !== 'mutation_idempotency') return rawCol;
          return new Proxy(rawCol, {
            get(colTarget, colProp, colReceiver) {
              if (colProp === 'doc') {
                return (docId?: string) => {
                  const rawDoc = docId !== undefined ? colTarget.doc(docId) : colTarget.doc();
                  return new Proxy(rawDoc, {
                    get(docTarget, docProp, docReceiver) {
                      if (docProp === '__isMutationIdempotencyRef') return true;
                      if (docProp === '__rawDocRef') return docTarget;
                      if (docProp === 'get') {
                        return async (...args: any[]) => {
                          const snap = await docTarget.get(...args);
                          return validateAndStripIdempotencySnap(snap, docTarget.id);
                        };
                      }
                      if (docProp === 'set') {
                        return async (data: any, options?: any) => {
                          return await docTarget.set(attachIdempotencyPayloadHash(data), options);
                        };
                      }
                      if (docProp === 'create') {
                        return async (data: any) => {
                          return await docTarget.create(attachIdempotencyPayloadHash(data));
                        };
                      }
                      const v = Reflect.get(docTarget, docProp, docReceiver);
                      return typeof v === 'function' ? v.bind(docTarget) : v;
                    }
                  });
                };
              }
              const v = Reflect.get(colTarget, colProp, colReceiver);
              return typeof v === 'function' ? v.bind(colTarget) : v;
            }
          });
        };
      }
      if (prop === 'runTransaction') {
        return async (updateFunction: (tx: any) => Promise<any>, ...rest: any[]) => {
          return await target.runTransaction(async (rawTx: any) => {
            const wrappedTx = new Proxy(rawTx, {
              get(txTarget, txProp, txReceiver) {
                if (txProp === 'get') {
                  return async (refOrQuery: any, ...args: any[]) => {
                    const rawTarget = refOrQuery?.__rawDocRef || refOrQuery;
                    const snap = await txTarget.get(rawTarget, ...args);
                    if (isMutationIdempotencyRef(refOrQuery)) {
                      return validateAndStripIdempotencySnap(snap, rawTarget?.id);
                    }
                    return snap;
                  };
                }
                if (txProp === 'set') {
                  return (ref: any, data: any, options?: any) => {
                    const rawTarget = ref?.__rawDocRef || ref;
                    const nextData = isMutationIdempotencyRef(ref) ? attachIdempotencyPayloadHash(data) : data;
                    if (options !== undefined) {
                      txTarget.set(rawTarget, nextData, options);
                    } else {
                      txTarget.set(rawTarget, nextData);
                    }
                    return wrappedTx;
                  };
                }
                if (txProp === 'create') {
                  return (ref: any, data: any) => {
                    const rawTarget = ref?.__rawDocRef || ref;
                    const nextData = isMutationIdempotencyRef(ref) ? attachIdempotencyPayloadHash(data) : data;
                    txTarget.create(rawTarget, nextData);
                    return wrappedTx;
                  };
                }
                if (txProp === 'update') {
                  return (ref: any, ...args: any[]) => {
                    const rawTarget = ref?.__rawDocRef || ref;
                    txTarget.update(rawTarget, ...args);
                    return wrappedTx;
                  };
                }
                if (txProp === 'delete') {
                  return (ref: any, ...args: any[]) => {
                    const rawTarget = ref?.__rawDocRef || ref;
                    txTarget.delete(rawTarget, ...args);
                    return wrappedTx;
                  };
                }
                const v = Reflect.get(txTarget, txProp, txReceiver);
                return typeof v === 'function' ? v.bind(txTarget) : v;
              }
            });
            return await updateFunction(wrappedTx);
          }, ...rest);
        };
      }
      const val = Reflect.get(target, prop, receiver);
      return typeof val === 'function' ? val.bind(target) : val;
    }
  });
  return wrapped;
}

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

  // If explicit service account credentials are provided, use cert()
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

  // Check if running in a managed Google Cloud environment with Application Default Credentials (ADC)
  // (Cloud Run sets K_SERVICE; Cloud Functions sets FUNCTION_TARGET; GAE sets GAE_ENV; or explicit GOOGLE_APPLICATION_CREDENTIALS)
  const isGcpEnvironment = Boolean(
    process.env.K_SERVICE ||
    process.env.FUNCTION_TARGET ||
    process.env.GAE_ENV ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  );

  if (isProduction && !isGcpEnvironment && (!clientEmail || !privateKey)) {
    throw new Error(
      'FATAL PRODUCTION CONFIGURATION ERROR: Firebase credentials missing. Production mode requires FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY when running outside a Google Cloud managed environment (ADC).'
    );
  }

  try {
    // Use Application Default Credentials (ADC) on Google Cloud Run or dev environment
    return initializeApp({
      credential: applicationDefault(),
      projectId: projectId || undefined
    });
  } catch (adcErr) {
    if (isProduction && !isGcpEnvironment) {
      throw new Error(`Production Firebase credentials missing. When running in production outside GCP ADC, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY must be provided: ${adcErr instanceof Error ? adcErr.message : String(adcErr)}`);
    }
    console.warn('Firebase Admin ADC initialization notice (dev fallback):', adcErr);
    return initializeApp({
      projectId: projectId || 'babasultan-restaurant'
    });
  }
}

export function getAdminDb(): any {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
    return inMemoryTestDb;
  }
  const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  try {
    ensureAdminApp();
    return wrapFirestoreWithIdempotency(getFirestore());
  } catch (err) {
    if (isProduction) {
      console.error('FATAL PRODUCTION ERROR: In-memory fallback is strictly forbidden in production mode.', err);
      throw new Error(`FATAL PRODUCTION ERROR: Firebase Firestore cannot be initialized in production. In-memory database fallback is rejected to prevent silent data loss: ${err instanceof Error ? err.message : String(err)}`);
    }
    console.warn('Firebase Admin getFirestore fallback to in-memory store (DEVELOPMENT ONLY):', err);
    return inMemoryTestDb;
  }
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
