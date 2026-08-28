import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';

let testEnv: RulesTestEnvironment;

describe('FIREBASE STORAGE SECURITY RULES EMULATOR SUITE', () => {
  beforeAll(async () => {
    const firestoreRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
    const storageRules = fs.readFileSync(path.resolve(process.cwd(), 'storage.rules'), 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: 'babasultan-restaurant-erp',
      firestore: {
        rules: firestoreRules,
        host: '127.0.0.1',
        port: 8080
      },
      storage: {
        rules: storageRules,
        host: '127.0.0.1',
        port: 9199
      }
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
      await testEnv.clearStorage();

      // Seed user profiles in Firestore
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        // Employee 1
        await setDoc(doc(db, 'users', 'emp_001'), {
          id: 'emp_001',
          role: 'Employee',
          branchId: 'BR-001',
          status: 'active'
        });
        // Employee 2
        await setDoc(doc(db, 'users', 'emp_002'), {
          id: 'emp_002',
          role: 'Employee',
          branchId: 'BR-002',
          status: 'active'
        });
        // Accountant
        await setDoc(doc(db, 'users', 'acct_001'), {
          id: 'acct_001',
          role: 'Accountant',
          branchId: 'BR-001',
          status: 'active'
        });
        // Manager
        await setDoc(doc(db, 'users', 'mgr_001'), {
          id: 'mgr_001',
          role: 'Manager',
          branchId: 'BR-001',
          status: 'active'
        });
      });
    }
  });

  // 1. UNAUTHENTICATED STORAGE ACCESS
  it('1. Unauthenticated users cannot read or write any storage files', async () => {
    const unauthStorage = testEnv.unauthenticatedContext().storage();
    const testData = new Uint8Array([1, 2, 3]);
    await assertFails(uploadBytes(ref(unauthStorage, 'products/item.png'), testData));
    await assertFails(getBytes(ref(unauthStorage, 'products/item.png')));
  });

  // 2. PRODUCT ASSETS (MANAGEMENT ONLY UPLOAD)
  it('2. Management can upload product images; standard staff cannot upload products', async () => {
    const mgrStorage = testEnv.authenticatedContext('mgr_001').storage();
    const empStorage = testEnv.authenticatedContext('emp_001').storage();
    const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header

    // Manager upload succeeds
    await assertSucceeds(uploadBytes(ref(mgrStorage, 'products/shawarma.png'), imageBytes, { contentType: 'image/png' }));
    // Standard employee upload fails
    await assertFails(uploadBytes(ref(empStorage, 'products/shawarma.png'), imageBytes, { contentType: 'image/png' }));
  });

  // 3. EMPLOYEE DOCUMENTS (OWNERSHIP & MANAGEMENT ACCESS)
  it('3. Employee can upload/read their own documents; cannot access other employees documents', async () => {
    const emp1Storage = testEnv.authenticatedContext('emp_001').storage();
    const emp2Storage = testEnv.authenticatedContext('emp_002').storage();
    const docBytes = new Uint8Array([1, 2, 3, 4]);

    // Employee 1 uploads own document
    await assertSucceeds(uploadBytes(ref(emp1Storage, 'employee_documents/emp_001'), docBytes, { contentType: 'application/pdf' }));
    // Employee 1 reads own document
    await assertSucceeds(getBytes(ref(emp1Storage, 'employee_documents/emp_001')));

    // Employee 2 cannot read or overwrite Employee 1's document
    await assertFails(getBytes(ref(emp2Storage, 'employee_documents/emp_001')));
    await assertFails(uploadBytes(ref(emp2Storage, 'employee_documents/emp_001'), docBytes, { contentType: 'application/pdf' }));
  });

  // 4. FINANCIAL ATTACHMENTS (ACCOUNTANT & MANAGEMENT ONLY)
  it('4. Accountant and Manager can read/write financial attachments; standard employee cannot', async () => {
    const acctStorage = testEnv.authenticatedContext('acct_001').storage();
    const empStorage = testEnv.authenticatedContext('emp_001').storage();
    const pdfBytes = new Uint8Array([1, 2, 3, 4]);

    // Accountant uploads financial receipt
    await assertSucceeds(uploadBytes(ref(acctStorage, 'financial_attachments/receipt_001.pdf'), pdfBytes, { contentType: 'application/pdf' }));
    // Standard employee cannot upload or read financial attachments
    await assertFails(uploadBytes(ref(empStorage, 'financial_attachments/receipt_002.pdf'), pdfBytes, { contentType: 'application/pdf' }));
    await assertFails(getBytes(ref(empStorage, 'financial_attachments/receipt_001.pdf')));
  });
});
