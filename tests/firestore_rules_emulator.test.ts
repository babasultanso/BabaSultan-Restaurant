import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

describe('FIRESTORE SECURITY RULES EMULATOR SUITE', () => {
  beforeAll(async () => {
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: 'babasultan-restaurant-erp',
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080
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

      // Seed baseline user profiles
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        // Branch A Cashier
        await setDoc(doc(db, 'users', 'cashier_a'), {
          id: 'cashier_a',
          role: 'Cashier',
          branchId: 'BR-001',
          branch: 'Main Flagship Branch',
          status: 'active'
        });
        // Branch B Cashier
        await setDoc(doc(db, 'users', 'cashier_b'), {
          id: 'cashier_b',
          role: 'Cashier',
          branchId: 'BR-002',
          branch: 'Downtown Branch',
          status: 'active'
        });
        // Branch A Manager
        await setDoc(doc(db, 'users', 'manager_a'), {
          id: 'manager_a',
          role: 'Manager',
          branchId: 'BR-001',
          branch: 'Main Flagship Branch',
          status: 'active'
        });
        // HQ Owner
        await setDoc(doc(db, 'users', 'owner_hq'), {
          id: 'owner_hq',
          role: 'Owner',
          isOwner: true,
          branchId: 'all',
          status: 'active'
        });

        // Seed branch customers
        await setDoc(doc(db, 'customers', 'cust_branch_a'), {
          id: 'cust_branch_a',
          name: 'Ahmed Branch A',
          branchId: 'BR-001',
          phone: '+252 61 111 2222'
        });
        await setDoc(doc(db, 'customers', 'cust_branch_b'), {
          id: 'cust_branch_b',
          name: 'Farah Branch B',
          branchId: 'BR-002',
          phone: '+252 61 333 4444'
        });

        // Seed branch transfers
        await setDoc(doc(db, 'branch_transfers', 'trf_a_to_b'), {
          id: 'trf_a_to_b',
          sourceBranchId: 'BR-001',
          destinationBranchId: 'BR-002',
          items: [{ name: 'Rice', quantity: 50 }],
          status: 'pending'
        });
        await setDoc(doc(db, 'branch_transfers', 'trf_c_to_d'), {
          id: 'trf_c_to_d',
          sourceBranchId: 'BR-003',
          destinationBranchId: 'BR-004',
          items: [{ name: 'Oil', quantity: 20 }],
          status: 'pending'
        });

        // Seed notifications
        await setDoc(doc(db, 'notifications', 'notif_cashier_a'), {
          id: 'notif_cashier_a',
          recipientId: 'cashier_a',
          branchId: 'BR-001',
          title: 'Shift Reminder',
          read: false
        });
        await setDoc(doc(db, 'notifications', 'notif_cashier_b'), {
          id: 'notif_cashier_b',
          recipientId: 'cashier_b',
          branchId: 'BR-002',
          title: 'Shift Reminder',
          read: false
        });
      });
    }
  });

  // 1. UNAUTHENTICATED ACCESS
  it('1. Rejects unauthenticated read and write access to protected collections', async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthDb, 'customers', 'cust_branch_a')));
    await assertFails(setDoc(doc(unauthDb, 'orders', 'ord_unauth'), { branchId: 'BR-001', total: 50 }));
    await assertFails(getDoc(doc(unauthDb, 'accounts', 'acc_001')));
  });

  // 2. UNPROVISIONED USER
  it('2. Rejects unprovisioned user without a valid database profile', async () => {
    const unprovDb = testEnv.authenticatedContext('unprovisioned_stranger', { email: 'stranger@example.com' }).firestore();
    await assertFails(setDoc(doc(unprovDb, 'orders', 'ord_unprov'), { branchId: 'BR-001', total: 20 }));
    await assertFails(getDoc(doc(unprovDb, 'customers', 'cust_branch_a')));
  });

  // 3. DIRECT FINANCIAL WRITES DENIED
  it('3. Direct salary, expense, purchase, revenue, and account writes are strictly DENIED for ordinary clients', async () => {
    const cashierDb = testEnv.authenticatedContext('cashier_a', { email: 'cashier@baba.so' }).firestore();
    const managerDb = testEnv.authenticatedContext('manager_a', { email: 'manager@baba.so' }).firestore();

    // Salaries direct write
    await assertFails(setDoc(doc(cashierDb, 'salaries', 'sal_001'), { branchId: 'BR-001', amount: 500 }));
    await assertFails(setDoc(doc(managerDb, 'salaries', 'sal_002'), { branchId: 'BR-001', amount: 500 }));

    // Expenses direct write
    await assertFails(setDoc(doc(cashierDb, 'expenses', 'exp_001'), { branchId: 'BR-001', amount: 100 }));
    await assertFails(setDoc(doc(managerDb, 'expenses', 'exp_002'), { branchId: 'BR-001', amount: 100 }));

    // Purchases direct write
    await assertFails(setDoc(doc(cashierDb, 'purchases', 'pur_001'), { branchId: 'BR-001', totalAmount: 300 }));
    await assertFails(setDoc(doc(managerDb, 'purchases', 'pur_002'), { branchId: 'BR-001', totalAmount: 300 }));

    // Revenues direct write
    await assertFails(setDoc(doc(cashierDb, 'revenues', 'rev_001'), { branchId: 'BR-001', amount: 1000 }));
    await assertFails(setDoc(doc(managerDb, 'revenues', 'rev_002'), { branchId: 'BR-001', amount: 1000 }));

    // Accounts direct write
    await assertFails(setDoc(doc(cashierDb, 'accounts', 'acc_001'), { code: '1010', name: 'Cash', balance: 5000 }));
    await assertFails(setDoc(doc(managerDb, 'accounts', 'acc_002'), { code: '1020', name: 'Bank', balance: 10000 }));

    // Customer wallets direct write
    await assertFails(setDoc(doc(cashierDb, 'customer_wallets', 'wal_001'), { customerId: 'cust_001', balance: 500 }));
  });

  // 4. CUSTOMER CROSS-BRANCH ACCESS
  it('4. Enforces branch isolation for branch-scoped customers', async () => {
    const cashierADb = testEnv.authenticatedContext('cashier_a').firestore();
    // Branch A user can read Branch A customer
    await assertSucceeds(getDoc(doc(cashierADb, 'customers', 'cust_branch_a')));
    // Branch A user CANNOT read Branch B customer
    await assertFails(getDoc(doc(cashierADb, 'customers', 'cust_branch_b')));

    // Owner/HQ can read any branch customer
    const ownerDb = testEnv.authenticatedContext('owner_hq').firestore();
    await assertSucceeds(getDoc(doc(ownerDb, 'customers', 'cust_branch_b')));
  });

  // 5. BRANCH TRANSFERS AUTHORIZATION
  it('5. Enforces branch transfer visibility based on source/destination branch', async () => {
    const cashierADb = testEnv.authenticatedContext('cashier_a').firestore();
    // Branch A user can read transfer where Branch A is source or destination
    await assertSucceeds(getDoc(doc(cashierADb, 'branch_transfers', 'trf_a_to_b')));
    // Branch A user CANNOT read unrelated transfer between Branch C and D
    await assertFails(getDoc(doc(cashierADb, 'branch_transfers', 'trf_c_to_d')));

    // HQ Owner can read all transfers
    const ownerDb = testEnv.authenticatedContext('owner_hq').firestore();
    await assertSucceeds(getDoc(doc(ownerDb, 'branch_transfers', 'trf_c_to_d')));
  });

  // 6. NOTIFICATION & AUDIT LOG INTEGRITY
  it('6. Enforces notification recipient isolation and blocks client-spoofed activity logs', async () => {
    const cashierADb = testEnv.authenticatedContext('cashier_a').firestore();
    // Cashier A can read their own notification
    await assertSucceeds(getDoc(doc(cashierADb, 'notifications', 'notif_cashier_a')));
    // Cashier A CANNOT read Cashier B notification
    await assertFails(getDoc(doc(cashierADb, 'notifications', 'notif_cashier_b')));

    // Cashier A CANNOT create arbitrary official activity log
    await assertFails(setDoc(doc(cashierADb, 'activity_logs', 'log_spoof_001'), {
      actorId: 'owner_hq',
      action: 'DELETE_DATABASE',
      timestamp: new Date().toISOString()
    }));
  });

  // 7. BRANCH INVENTORY AUTHORIZATION
  it('7. Enforces branch-scoping on branch_inventory', async () => {
    const cashierADb = testEnv.authenticatedContext('cashier_a').firestore();
    // Direct client mutation without server backend is rejected
    await assertFails(setDoc(doc(cashierADb, 'branch_inventory', 'inv_br2_prod1'), {
      branchId: 'BR-002',
      productId: 'prod_1',
      quantity: 999
    }));
  });

  // 8. P0-1: PRIVILEGE ESCALATION VIA isHQ BLOCKED
  it('8. Strictly blocks user from escalating privileges via isHQ in Firestore', async () => {
    const cashierADb = testEnv.authenticatedContext('cashier_a').firestore();
    // Attempting to set isHQ=true on self profile update is rejected
    await assertFails(updateDoc(doc(cashierADb, 'users', 'cashier_a'), {
      isHQ: true
    }));

    // Attempting to create new user with isHQ=true is rejected
    await assertFails(setDoc(doc(cashierADb, 'users', 'new_hacked_user'), {
      id: 'new_hacked_user',
      isHQ: true,
      role: 'Cashier',
      branchId: 'BR-001'
    }));
  });

  // 9. P0-2: DIRECT ORDER DELETION FORBIDDEN
  it('9. Strictly forbids direct deletion of orders from client Firestore SDK', async () => {
    const managerADb = testEnv.authenticatedContext('manager_a').firestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'orders', 'ord_test_001'), {
        id: 'ord_test_001',
        branchId: 'BR-001',
        totalAmount: 100,
        status: 'completed'
      });
    });

    // Deletion must fail
    await assertFails(deleteDoc(doc(managerADb, 'orders', 'ord_test_001')));
  });

  // 10. P1-1: EMPLOYEE SENSITIVE FIELDS PROTECTED
  it('10. Blocks non-HQ/non-Admin manager from modifying employee salary or role directly', async () => {
    const managerADb = testEnv.authenticatedContext('manager_a').firestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'employees', 'emp_001'), {
        id: 'emp_001',
        name: 'Worker 1',
        salary: 500,
        role: 'Waiter',
        branchId: 'BR-001'
      });
    });

    // Manager updating salary directly is rejected
    await assertFails(updateDoc(doc(managerADb, 'employees', 'emp_001'), {
      salary: 1500
    }));

    // Manager updating role directly is rejected
    await assertFails(updateDoc(doc(managerADb, 'employees', 'emp_001'), {
      role: 'Manager'
    }));
  });

  // 11. P1-2: PAYROLL DIRECT CLIENT WRITES BLOCKED
  it('11. Strictly blocks direct client writes to payroll collection', async () => {
    const managerADb = testEnv.authenticatedContext('manager_a').firestore();
    await assertFails(setDoc(doc(managerADb, 'payroll', 'pay_001'), {
      id: 'pay_001',
      branchId: 'BR-001',
      netSalary: 2000,
      status: 'paid'
    }));
  });

  // 12. P1-3: POS STAFF DIRECT STOCK MUTATION BLOCKED
  it('12. Blocks POS staff from directly mutating product or ingredient stock in Firestore', async () => {
    const cashierADb = testEnv.authenticatedContext('cashier_a').firestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'products', 'prod_juice'), {
        id: 'prod_juice',
        name: 'Mango Juice',
        branchId: 'BR-001',
        stock: 50
      });
    });

    // Direct product stock update by Cashier is rejected
    await assertFails(updateDoc(doc(cashierADb, 'products', 'prod_juice'), {
      stock: 100
    }));
  });
});
