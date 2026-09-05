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

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('FIRESTORE SECURITY RULES EMULATOR SUITE', () => {
  beforeAll(async () => {
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');

    testEnv = await initializeTestEnvironment({
      projectId: 'babasultan-rules-firestore',
      firestore: {
        rules,
        host: (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8081').split(':')[0],
        port: Number((process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8081').split(':')[1])
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
    // Missing customer documents must fail closed without a rules-engine null evaluation error.
    await assertFails(getDoc(doc(cashierADb, 'customers', 'cust_missing')));

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

  // 8. SERVER-AUTHORITATIVE OPERATIONAL/PROCUREMENT COLLECTIONS
  it('8. Blocks direct writes to server-authoritative waste, purchase items, cash transfers and token branch changes', async () => {
    const managerADb = testEnv.authenticatedContext('manager_a').firestore();

    await assertFails(setDoc(doc(managerADb, 'kitchen_waste', 'waste_spoof_001'), {
      branchId: 'BR-001', itemId: 'ing_1', itemType: 'ingredient', quantity: 999
    }));
    await assertFails(setDoc(doc(managerADb, 'purchase_items', 'pi_spoof_001'), {
      branchId: 'BR-001', itemId: 'item_1', quantity: 999, unitPrice: 1
    }));
    await assertFails(setDoc(doc(managerADb, 'cash_transfers', 'ct_spoof_001'), {
      branchId: 'BR-001', amount: 9999, fromAccountId: 'cash', toAccountId: 'bank'
    }));

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'notification_tokens', 'manager_a'), {
        userId: 'manager_a', branchId: 'BR-001', fcmToken: 'token-original'
      });
    });
    await assertFails(updateDoc(doc(managerADb, 'notification_tokens', 'manager_a'), { branchId: 'BR-002' }));
    await assertSucceeds(updateDoc(doc(managerADb, 'notification_tokens', 'manager_a'), { fcmToken: 'token-updated' }));
  });

  // 9. P0-1: PRIVILEGE ESCALATION VIA isHQ BLOCKED
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

  it('14a. Prevents employees from changing leave workflow/approval fields and enforces workflow transitions', async () => {
    const employeeDb = testEnv.authenticatedContext('cashier_a').firestore();
    const managerDb = testEnv.authenticatedContext('manager_a').firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'employees', 'emp_leave_a'), { id: 'emp_leave_a', name: 'Employee A', branchId: 'BR-001' });
      await setDoc(doc(context.firestore(), 'leave_requests', 'leave_rules_001'), {
        id: 'leave_rules_001', employeeId: 'cashier_a', branchId: 'BR-001',
        status: 'pending', approvalStatus: 'pending', workflowStatus: 'Request',
        leaveType: 'Annual', startDate: '2026-09-10', endDate: '2026-09-11', daysCount: 2
      });
    });

    await assertFails(updateDoc(doc(employeeDb, 'leave_requests', 'leave_rules_001'), { workflowStatus: 'Completed' }));
    await assertFails(updateDoc(doc(employeeDb, 'leave_requests', 'leave_rules_001'), { managerApproval: { approvedBy: 'Attacker' } }));
    await assertFails(setDoc(doc(employeeDb, 'leave_requests', 'leave_rules_create_tamper'), {
      employeeId: 'cashier_a', branchId: 'BR-001', status: 'pending', approvalStatus: 'pending',
      workflowStatus: 'Completed', leaveType: 'Annual', startDate: '2026-09-12', endDate: '2026-09-13', daysCount: 2
    }));

    await assertSucceeds(updateDoc(doc(managerDb, 'leave_requests', 'leave_rules_001'), { workflowStatus: 'Manager Approval' }));
    await assertFails(updateDoc(doc(managerDb, 'leave_requests', 'leave_rules_001'), { daysCount: 99 }));
    await assertFails(updateDoc(doc(managerDb, 'leave_requests', 'leave_rules_001'), { workflowStatus: 'Request' }));
    await assertSucceeds(updateDoc(doc(managerDb, 'leave_requests', 'leave_rules_001'), { workflowStatus: 'Completed' }));
  });

  it('13a. Blocks client writes to supplier financial balances', async () => {
    const accountantDb = testEnv.authenticatedContext('manager_a').firestore();
    await assertFails(setDoc(doc(accountantDb, 'suppliers', 'sup_finance_create_bad'), {
      id: 'sup_finance_create_bad', name: 'Supplier', branchId: 'BR-001', pendingAmount: 9999
    }));
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'suppliers', 'sup_finance_update_bad'), {
        id: 'sup_finance_update_bad', name: 'Supplier', branchId: 'BR-001', pendingAmount: 0, overdueAmount: 0
      });
    });
    await assertFails(updateDoc(doc(accountantDb, 'suppliers', 'sup_finance_update_bad'), { pendingAmount: 500 }));
    await assertSucceeds(updateDoc(doc(accountantDb, 'suppliers', 'sup_finance_update_bad'), { phone: '+252600000000' }));
  });

  it('13b. Customer feedback creation is server-authoritative only', async () => {
    const cashierDb = testEnv.authenticatedContext('cashier_a').firestore();
    await assertFails(setDoc(doc(cashierDb, 'customer_feedbacks', 'feedback_client_write_blocked'), {
      customerId: 'cashier_a', branchId: 'BR-001', rating: 1, comment: 'forged feedback', status: 'open'
    }));
  });

  it('14. Blocks POS staff from forging driver operational state', async () => {
    const cashierADb = testEnv.authenticatedContext('cashier_a').firestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'drivers', 'drv_rules_001'), {
        id: 'drv_rules_001',
        branchId: 'BR-001',
        fullName: 'Driver A',
        availability: 'available',
        rating: 5,
        totalDeliveries: 10,
        completedDeliveries: 9,
        failedDeliveries: 1,
        currentLocation: { lat: 2.0, lng: 45.0 }
      });
    });

    await assertFails(updateDoc(doc(cashierADb, 'drivers', 'drv_rules_001'), { availability: 'offline' }));
    await assertFails(updateDoc(doc(cashierADb, 'drivers', 'drv_rules_001'), { rating: 1 }));
    await assertFails(updateDoc(doc(cashierADb, 'drivers', 'drv_rules_001'), { activeDeliveryId: 'delivery_fake' }));
  });

  it('15. Allows management to update driver profile fields but not operational counters/state', async () => {
    const managerADb = testEnv.authenticatedContext('manager_a').firestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'drivers', 'drv_rules_002'), {
        id: 'drv_rules_002',
        branchId: 'BR-001',
        fullName: 'Driver A',
        phoneNumber: '+252611111111',
        availability: 'available',
        rating: 5,
        totalDeliveries: 10
      });
    });

    await assertSucceeds(updateDoc(doc(managerADb, 'drivers', 'drv_rules_002'), { phoneNumber: '+252622222222' }));
    await assertFails(updateDoc(doc(managerADb, 'drivers', 'drv_rules_002'), { totalDeliveries: 99 }));
    await assertFails(updateDoc(doc(managerADb, 'drivers', 'drv_rules_002'), { availability: 'offline' }));
  });

  it('16. Rejects management attempts to create products or ingredients with non-zero hidden stock projections', async () => {
    const managerADb = testEnv.authenticatedContext('manager_a').firestore();
    await assertFails(setDoc(doc(managerADb, 'products', 'prod_bad_projection'), {
      id: 'prod_bad_projection', branchId: 'BR-001', name: 'Bad Product', stock: 0, currentStock: 25
    }));
    await assertFails(setDoc(doc(managerADb, 'ingredients', 'ing_bad_projection'), {
      id: 'ing_bad_projection', branchId: 'BR-001', name: 'Bad Ingredient', stock: 0, currentQuantity: 25
    }));
    await assertSucceeds(setDoc(doc(managerADb, 'products', 'prod_zero_projection'), {
      id: 'prod_zero_projection', branchId: 'BR-001', name: 'Safe Product', stock: 0, currentStock: 0
    }));
  });

  it('13. Enforces customer coupon branch isolation while allowing global coupons', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'customer_coupons', 'coupon_branch_a'), {
        id: 'coupon_branch_a',
        code: 'BRANCHA10',
        branchId: 'BR-001',
        isActive: true
      });
      await setDoc(doc(db, 'customer_coupons', 'coupon_branch_b'), {
        id: 'coupon_branch_b',
        code: 'BRANCHB10',
        branchId: 'BR-002',
        isActive: true
      });
      await setDoc(doc(db, 'customer_coupons', 'coupon_global'), {
        id: 'coupon_global',
        code: 'GLOBAL10',
        branchId: 'all',
        isActive: true
      });
    });

    const branchA = testEnv.authenticatedContext('cashier_a').firestore();
    const branchB = testEnv.authenticatedContext('cashier_b').firestore();
    const owner = testEnv.authenticatedContext('owner_hq').firestore();

    await assertSucceeds(getDoc(doc(branchA, 'customer_coupons', 'coupon_branch_a')));
    await assertFails(getDoc(doc(branchA, 'customer_coupons', 'coupon_branch_b')));
    await assertSucceeds(getDoc(doc(branchA, 'customer_coupons', 'coupon_global')));
    await assertSucceeds(getDoc(doc(branchB, 'customer_coupons', 'coupon_branch_b')));
    await assertFails(getDoc(doc(branchB, 'customer_coupons', 'coupon_branch_a')));
    await assertSucceeds(getDoc(doc(owner, 'customer_coupons', 'coupon_branch_a')));
    await assertSucceeds(getDoc(doc(owner, 'customer_coupons', 'coupon_branch_b')));
  });

});
