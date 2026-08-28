import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import firebaseConfig from '../firebase-applet-config.json';

export function getFirebaseProjectId(): string {
  return (
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    firebaseConfig.projectId ||
    'babasultan-restaurant'
  );
}

export function getFirebaseApiKey(): string {
  return (
    process.env.VITE_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    firebaseConfig.apiKey ||
    ''
  );
}

function initializeFirebaseAdmin() {
  if (getApps().length > 0) return;

  const projectId = getFirebaseProjectId();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (clientEmail && privateKey) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId
    });
    return;
  }

  // On Google-managed runtimes (e.g. Cloud Run), fall back to ADC.
  // On Render, configure FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.
  initializeApp({ projectId });
}

export class InMemoryFirestoreMock {
  private store: Map<string, Map<string, any>> = new Map();

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

export function getAdminDb(): any {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
    return inMemoryTestDb;
  }
  initializeFirebaseAdmin();
  return getFirestore();
}

export function getAdminAuth() {
  initializeFirebaseAdmin();
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
  initializeFirebaseAdmin();
  return getMessaging();
}
