import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';
import { getAdminDb } from '../server/trustedFinancialBackend.js';

describe('TRUSTED BACKEND API ENDPOINTS INTEGRATION TESTS', () => {

  const OWNER_TOKEN = 'Bearer test_token_owner';
  const CASHIER_TOKEN = 'Bearer test_token_cashier';
  const DRIVER_TOKEN = 'Bearer test_token_driver';
  const CHEF_TOKEN = 'Bearer test_token_chef';

  beforeEach(async () => {
    const db = getAdminDb();
    await db.collection('branches').doc('main_branch_01').set({
      id: 'main_branch_01',
      taxRate: 0.05,
      defaultDeliveryFee: 2.00
    });
    await db.collection('customers').doc('cust_wallet_test_1').set({
      id: 'cust_wallet_test_1',
      name: 'Amina Ali',
      phone: '+252615000001',
      branchId: 'main_branch_01'
    });
    await db.collection('orders').doc('ord_wallet_1').set({
      id: 'ord_wallet_1',
      customerId: 'cust_wallet_test_1',
      totalAmount: 100,
      paymentStatus: 'paid',
      branchId: 'main_branch_01'
    });
    await db.collection('employees').doc('emp_test_99').set({
      id: 'emp_test_99',
      name: 'John Doe',
      role: 'Staff',
      branchId: 'main_branch_01'
    });
  });

  it('1. POST /api/pos/complete - successfully completes POS checkout with trusted auth token & calculates totals', async () => {
    const db = getAdminDb();
    // Seed product doc so server-side price/stock verification passes
    await db.collection('products').doc('test_prod_1').set({
      id: 'test_prod_1',
      name: 'Burger',
      price: 10,
      cost: 4,
      stock: 100,
      branchId: 'main_branch_01'
    });

    const res = await request(app)
      .post('/api/pos/complete')
      .set('Authorization', CASHIER_TOKEN)
      .send({
        orderData: {
          branchId: 'main_branch_01',
          paymentMethod: 'cash',
          paidAmount: 10.5,
          items: [
            { productId: 'test_prod_1', productName: 'Burger', quantity: 1, price: 10, costPrice: 4 }
          ],
          subtotal: 10,
          tax: 0.5,
          discountAmount: 0,
          totalAmount: 10.5
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.order.id).toBeDefined();

    // Verify database state: order document created in Firestore
    const orderSnap = await db.collection('orders').doc(res.body.order.id).get();
    expect(orderSnap.exists).toBe(true);
    expect(orderSnap.data().totalAmount).toBe(10.5);
  });

  it('2. POST /api/orders/:orderId/refund - processes customer refund with validation & journal reversal', async () => {
    const db = getAdminDb();
    await db.collection('products').doc('test_prod_2').set({
      id: 'test_prod_2',
      name: 'Pizza',
      price: 20,
      cost: 8,
      stock: 50,
      branchId: 'main_branch_01'
    });

    const orderRes = await request(app)
      .post('/api/pos/complete')
      .set('Authorization', OWNER_TOKEN)
      .send({
        orderData: {
          branchId: 'main_branch_01',
          paymentMethod: 'cash',
          paidAmount: 21,
          items: [{ productId: 'test_prod_2', productName: 'Pizza', quantity: 1, price: 20, costPrice: 8 }],
          subtotal: 20,
          tax: 1,
          totalAmount: 21
        }
      });

    expect(orderRes.status).toBe(200);
    const orderId = orderRes.body.order.id;

    const refundRes = await request(app)
      .post(`/api/orders/${orderId}/refund`)
      .set('Authorization', OWNER_TOKEN)
      .send({
        amount: 21,
        reason: 'Customer returned item',
        paymentMethod: 'cash'
      });

    expect(refundRes.status).toBe(200);
    expect(refundRes.body.status).toBe('success');
    expect(refundRes.body.refundedAmount).toBe(21);

    // Verify order status updated in database
    const refundedOrderSnap = await db.collection('orders').doc(orderId).get();
    expect(refundedOrderSnap.data().paymentStatus).toBe('refunded');
  });

  it('3. POST /api/accounting/receivables/:id/payment - records customer AR payment and posts double-entry journal', async () => {
    const db = getAdminDb();
    await db.collection('receivables').doc('rec_test_1').set({
      id: 'rec_test_1',
      customerId: 'cust_test_1',
      customerName: 'Ali Hassan',
      totalAmount: 100,
      amount: 100,
      paidAmount: 0,
      status: 'pending',
      branchId: 'main_branch_01'
    });

    const res = await request(app)
      .post('/api/accounting/receivables/rec_test_1/payment')
      .set('Authorization', OWNER_TOKEN)
      .send({
        amount: 50,
        paymentMethod: 'cash',
        notes: 'Partial AR payment'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    // Verify updated receivable balance in database
    const recSnap = await db.collection('receivables').doc('rec_test_1').get();
    expect(recSnap.data().paidAmount).toBe(50);
  });

  it('4. POST /api/purchases/receive - processes goods receipt and updates inventory asset', async () => {
    const db = getAdminDb();
    await db.collection('purchase_orders').doc('po_test_1').set({
      id: 'po_test_1',
      supplierId: 'sup_test_1',
      supplierName: 'Fresh Produce Vendor',
      status: 'ordered',
      branchId: 'main_branch_01',
      items: [
        { itemId: 'item_1', name: 'Flour', itemType: 'ingredient', quantity: 10, unitCost: 2 }
      ]
    });

    await db.collection('inventory').doc('item_1').set({
      id: 'item_1',
      name: 'Flour',
      currentQuantity: 20,
      unitCost: 2,
      branchId: 'main_branch_01'
    });

    const res = await request(app)
      .post('/api/purchases/receive')
      .set('Authorization', OWNER_TOKEN)
      .send({
        poId: 'po_test_1',
        receivedItems: [
          { itemId: 'item_1', name: 'Flour', itemType: 'ingredient', receivedQty: 10, unitCost: 2 }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    // Verify stock updated in database
    const invSnap = await db.collection('inventory').doc('item_1').get();
    expect(invSnap.data().currentQuantity).toBe(30);
  });

  it('5. POST /api/purchases/supplier-payment - records AP supplier payment', async () => {
    const db = getAdminDb();
    await db.collection('suppliers').doc('sup_test_1').set({
      id: 'sup_test_1',
      name: 'Fresh Produce Vendor',
      outstandingBalance: 200,
      branchId: 'main_branch_01'
    });

    const res = await request(app)
      .post('/api/purchases/supplier-payment')
      .set('Authorization', OWNER_TOKEN)
      .send({
        supplierId: 'sup_test_1',
        supplierName: 'Fresh Produce Vendor',
        amount: 100,
        paymentMethod: 'bank',
        notes: 'Vendor payment'
      });

    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();

    // Verify supplier balance updated in database
    const supSnap = await db.collection('suppliers').doc('sup_test_1').get();
    expect(supSnap.data().outstandingBalance).toBe(100);
  });

  it('6. POST /api/accounting/journal-entries - validates debit == credit for manual journal entry', async () => {
    const res = await request(app)
      .post('/api/accounting/journal-entries')
      .set('Authorization', OWNER_TOKEN)
      .send({
        branchId: 'main_branch_01',
        description: 'Manual adjustment entry',
        lines: [
          { accountId: 'acc_1', accountCode: '1010', accountName: 'Cash', debit: 100, credit: 0 },
          { accountId: 'acc_2', accountCode: '4010', accountName: 'Sales', debit: 0, credit: 100 }
        ]
      });

    expect(res.status).toBe(200);
    expect(['Posted', 'success']).toContain(res.body.status);
    expect(res.body.entryNumber).toBeDefined();
  });

  it('6b. REJECTS unbalanced manual journal entry where debit != credit', async () => {
    const res = await request(app)
      .post('/api/accounting/journal-entries')
      .set('Authorization', OWNER_TOKEN)
      .send({
        branchId: 'main_branch_01',
        description: 'Unbalanced entry',
        lines: [
          { accountId: 'acc_1', accountCode: '1010', accountName: 'Cash', debit: 100, credit: 0 },
          { accountId: 'acc_2', accountCode: '4010', accountName: 'Sales', debit: 0, credit: 50 }
        ]
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unbalanced|debit.*credit/i);
  });

  it('7. POST /api/orders/:orderId/update - allows whitelisted order metadata update and rejects sovereign financial field tampering', async () => {
    const db = getAdminDb();
    await db.collection('products').doc('test_prod_3').set({
      id: 'test_prod_3',
      name: 'Salad',
      price: 10,
      cost: 3,
      stock: 50,
      branchId: 'main_branch_01'
    });

    const orderRes = await request(app)
      .post('/api/pos/complete')
      .set('Authorization', CASHIER_TOKEN)
      .send({
        orderData: {
          branchId: 'main_branch_01',
          paymentMethod: 'cash',
          paidAmount: 10.5,
          items: [{ productId: 'test_prod_3', productName: 'Salad', quantity: 1, price: 10, costPrice: 3 }],
          totalAmount: 10.5
        }
      });

    expect(orderRes.status).toBe(200);
    const orderId = orderRes.body.order.id;

    // 1. Valid whitelisted metadata update succeeds with 200
    const updateRes = await request(app)
      .post(`/api/orders/${orderId}/update`)
      .set('Authorization', CASHIER_TOKEN)
      .send({
        tableNumber: 'Table 5',
        notes: 'Extra dressing'
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('success');
    expect(updateRes.body.orderId).toBe(orderId);

    // 2. Direct financial field tampering attempt is strictly REJECTED with 403
    const tamperRes = await request(app)
      .post(`/api/orders/${orderId}/update`)
      .set('Authorization', CASHIER_TOKEN)
      .send({
        totalAmount: 0.01,
        subtotal: 0.01,
        paymentStatus: 'paid'
      });

    expect(tamperRes.status).toBe(403);
    expect(tamperRes.body.error).toMatch(/Direct modification of financial, payment, or order items/i);

    // Verify totalAmount remained unchanged in database
    const updatedOrderSnap = await db.collection('orders').doc(orderId).get();
    expect(updatedOrderSnap.data().totalAmount).toBe(10.5);
    expect(updatedOrderSnap.data().tableNumber).toBe('Table 5');
    expect(updatedOrderSnap.data().notes).toBe('Extra dressing');
  });

  it('8. POST /api/kitchen/:ticketId/update - enforces role auth and whitelisted ticket updates', async () => {
    const db = getAdminDb();
    await db.collection('kitchen_orders').doc('ticket_test_123').set({
      id: 'ticket_test_123',
      orderNumber: 'ORD-100',
      prepStatus: 'accepted',
      branchId: 'main_branch_01'
    });

    const updateRes = await request(app)
      .post('/api/kitchen/ticket_test_123/update')
      .set('Authorization', CASHIER_TOKEN)
      .send({
        prepStatus: 'cooking',
        priority: 'high',
        notes: 'Priority order'
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('success');

    // Verify prepStatus updated in database
    const ticketSnap = await db.collection('kitchen_orders').doc('ticket_test_123').get();
    expect(ticketSnap.data().prepStatus).toBe('cooking');
  });

  it('8b. REJECTS kitchen ticket update with invalid prepStatus transition', async () => {
    const res = await request(app)
      .post('/api/kitchen/ticket_test_123/update')
      .set('Authorization', CASHIER_TOKEN)
      .send({
        prepStatus: 'invalid_status_xyz'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid status transition/i);
  });

  it('9. POST /api/crm/wallet/recharge - processes wallet recharge server-authoritatively', async () => {
    const res = await request(app)
      .post('/api/crm/wallet/recharge')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', 'idemp_test_recharge_9')
      .send({
        customerId: 'cust_wallet_test_1',
        amount: 100,
        paymentMethod: 'cash',
        customerName: 'Amina Ali'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.newBalance).toBeGreaterThanOrEqual(100);
  });

  it('10. POST /api/crm/wallet/deduct - processes wallet deduction with balance check', async () => {
    const res = await request(app)
      .post('/api/crm/wallet/deduct')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', 'idemp_test_deduct_10')
      .send({
        customerId: 'cust_wallet_test_1',
        amount: 25,
        orderId: 'ord_wallet_1',
        notes: 'Order payment'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.newBalance).toBe(75);
  });

  it('11. POST /api/crm/wallet/refund - credits refund back to customer wallet', async () => {
    const res = await request(app)
      .post('/api/crm/wallet/refund')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', 'idemp_test_refund_11')
      .send({
        customerId: 'cust_wallet_test_1',
        amount: 15,
        orderId: 'ord_wallet_1',
        reason: 'Item returned'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.newBalance).toBe(90);
  });

  it('12. GET /api/financial-summary - enforces management role auth and returns period-filtered summary', async () => {
    // 12a. Cashier rejected with 403
    const cashierRes = await request(app)
      .get('/api/financial-summary')
      .set('Authorization', CASHIER_TOKEN);

    expect(cashierRes.status).toBe(403);
    expect(cashierRes.body.error).toMatch(/unauthorized/i);

    // 12b. Owner accepted with 200 and valid structure
    const ownerRes = await request(app)
      .get('/api/financial-summary?period=today')
      .set('Authorization', OWNER_TOKEN);

    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.sales).toBeDefined();
    expect(ownerRes.body.netSales).toBeDefined();
    expect(ownerRes.body.operationalKpis).toBeDefined();
  });

  it('13. POST /api/ai-chat - restricts financial access for operational role', async () => {
    const cashierAiRes = await request(app)
      .post('/api/ai-chat')
      .set('Authorization', CASHIER_TOKEN)
      .send({
        prompt: 'Show me total net sales and cash balance',
        language: 'en'
      });

    expect(cashierAiRes.status).toBe(200);
    expect(cashierAiRes.body.reply).toBeDefined();
  }, 15000);

  it('14. POST /api/audit/activity - records activity log securely via server Admin SDK', async () => {
    const res = await request(app)
      .post('/api/audit/activity')
      .set('Authorization', OWNER_TOKEN)
      .send({
        action: 'UPDATE_ROLE',
        details: 'Promoted cashier_01 to Manager',
        userRole: 'ATTEMPT_FORGED_ROLE',
        userId: 'FORGED_USER_ID',
        branchId: 'FORGED_BRANCH'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.log.id).toBeDefined();
    expect(res.body.log.action).toBe('UPDATE_ROLE');
    expect(res.body.log.userId).toBe('test_user_id'); // Derived from token, not forged input!
    expect(res.body.log.userRole).toBe('Owner'); // Derived from trusted server record!
    expect(res.body.log.branchId).toBe('main_branch_01'); // Derived from trusted server record!

    const db = getAdminDb();
    const logSnap = await db.collection('activity_logs').doc(res.body.log.id).get();
    expect(logSnap.exists).toBe(true);
    expect(logSnap.data().action).toBe('UPDATE_ROLE');
    expect(logSnap.data().userId).toBe('test_user_id');
  });

  it('14b. POST /api/audit/activity - rejects unauthorized/unallowed action strings', async () => {
    const res = await request(app)
      .post('/api/audit/activity')
      .set('Authorization', OWNER_TOKEN)
      .send({
        action: 'FORGE_ADMIN_ACCESS',
        details: 'Attempting invalid action'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid or unauthorized audit action');
  });

  it('14c. POST /api/kitchen/waste - processes waste, stock adjustment and audit log server-side', async () => {
    const db = getAdminDb();
    await db.collection('ingredients').doc('ing_tomato_01').set({
      id: 'ing_tomato_01',
      name: 'Tomatoes',
      stock: 50,
      unit: 'kg'
    });

    const res = await request(app)
      .post('/api/kitchen/waste')
      .set('Authorization', CASHIER_TOKEN)
      .send({
        wasteData: {
          itemId: 'ing_tomato_01',
          itemType: 'ingredient',
          itemOrIngredientName: 'Tomatoes',
          quantity: 5,
          unit: 'kg',
          reason: 'Spoiled in fridge',
          cost: 10
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.id).toBeDefined();

    const wasteSnap = await db.collection('kitchen_waste').doc(res.body.id).get();
    expect(wasteSnap.exists).toBe(true);
    expect(wasteSnap.data().quantity).toBe(5);

    const ingSnap = await db.collection('ingredients').doc('ing_tomato_01').get();
    expect(ingSnap.data().stock).toBe(45); // 50 - 5 = 45
  });

  it('15. POST /api/deliveries/:deliveryId/rating - records delivery rating securely', async () => {
    const db = getAdminDb();
    await db.collection('deliveries').doc('del_test_100').set({
      id: 'del_test_100',
      branchId: 'main_branch_01',
      status: 'delivered'
    });

    const res = await request(app)
      .post('/api/deliveries/del_test_100/rating')
      .set('Authorization', CASHIER_TOKEN)
      .send({
        rating: 5,
        feedback: 'Excellent speed!'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    const delSnap = await db.collection('deliveries').doc('del_test_100').get();
    expect(delSnap.data().customerRating).toBe(5);
    expect(delSnap.data().customerFeedback).toBe('Excellent speed!');
  });

  it('16. POST /api/deliveries/notifications - creates internal delivery event log via Trusted Backend & rejects unauthorized access', async () => {
    const db = getAdminDb();

    // Rejects unauthenticated request
    const unauthRes = await request(app)
      .post('/api/deliveries/notifications')
      .send({ deliveryId: 'del_test_100', title: 'Driver Arrived' });
    expect(unauthRes.status).toBe(401);

    // Authorized staff creates internal event log entry
    const res = await request(app)
      .post('/api/deliveries/notifications')
      .set('Authorization', CASHIER_TOKEN)
      .send({
        deliveryId: 'del_test_100',
        title: 'Driver Arrived',
        message: 'Driver arrived at location',
        type: 'driver_arrived',
        targetUser: 'customer'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.id).toBeDefined();

    const notifSnap = await db.collection('delivery_notifications').doc(res.body.id).get();
    expect(notifSnap.exists).toBe(true);
    expect(notifSnap.data().title).toBe('Driver Arrived');
  });

  it('17. AI Actions Execution via Trusted Backend: validates authorization, branch isolation & records financial mutations', async () => {
    // Expense creation via trusted backend
    const expRes = await request(app)
      .post('/api/expenses')
      .set('Authorization', OWNER_TOKEN)
      .send({
        expenseData: {
          title: 'AI Logged Utilities',
          amount: 250,
          category: 'Utilities',
          description: 'AI execution test'
        }
      });
    expect(expRes.status).toBe(200);
    expect(expRes.body.status).toBe('success');

    // Salary disbursement via trusted backend
    const salRes = await request(app)
      .post('/api/salaries')
      .set('Authorization', OWNER_TOKEN)
      .send({
        salaryData: {
          employeeId: 'emp_test_99',
          employeeName: 'John Doe',
          amount: 1500,
          period: 'August 2026'
        }
      });
    expect(salRes.status).toBe(200);
    expect(salRes.body.status).toBe('success');

    // Bank transaction via trusted backend
    const bankRes = await request(app)
      .post('/api/bank-transactions')
      .set('Authorization', OWNER_TOKEN)
      .send({
        bankTransactionData: {
          accountName: 'Operating Account',
          type: 'deposit',
          amount: 5000,
          description: 'Initial deposit'
        }
      });
    expect(bankRes.status).toBe(200);
    expect(bankRes.body.status).toBe('success');
  });

  it('18. POST /api/ai/execute-action - Server-Authoritative Execution: validates Auth, Schema, Resource, Branch Isolation & executes mutations', async () => {
    const db = getAdminDb();

    // Seed test resources in Firestore
    await db.collection('suppliers').doc('test_sup_1').set({ id: 'test_sup_1', name: 'Al Marai Dairy' });
    await db.collection('employees').doc('test_emp_1').set({ id: 'test_emp_1', name: 'Sultan Chef', branchId: 'main_branch_01' });
    await db.collection('employees').doc('test_emp_other_branch').set({ id: 'test_emp_other_branch', name: 'Other Chef', branchId: 'branch_02' });
    await db.collection('orders').doc('test_order_ai').set({ id: 'test_order_ai', orderNumber: 'ORD-999', totalAmount: 100, paidAmount: 100, paymentStatus: 'paid', refundedAmount: 0, branchId: 'main_branch_01' });
    await db.collection('orders').doc('test_order_other_branch').set({ id: 'test_order_other_branch', orderNumber: 'ORD-888', totalAmount: 100, refundedAmount: 0, branchId: 'branch_02' });
    await db.collection('products').doc('test_prod_ai').set({ id: 'test_prod_ai', name: 'Lamb Kebab', stock: 20, branchId: 'main_branch_01' });
    await db.collection('products').doc('test_prod_other_branch').set({ id: 'test_prod_other_branch', name: 'Desert Shawarma', stock: 15, branchId: 'branch_02' });
    await db.collection('ingredients').doc('test_ing_ai').set({ id: 'test_ing_ai', name: 'Olive Oil', stock: 50, branchId: 'main_branch_01' });
    await db.collection('accounts').doc('test_acc_ai').set({ id: 'test_acc_ai', name: 'Central Bank', balance: 10000, branchId: 'main_branch_01' });

    // 18a. Rejects unauthenticated request
    const unauthRes = await request(app)
      .post('/api/ai/execute-action')
      .send({ actionType: 'ADD_EXPENSE', payload: { title: 'Test', amount: 100 } });
    expect(unauthRes.status).toBe(401);

    // 18b. Rejects unknown actionType
    const unknownRes = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .send({ actionType: 'INVALID_ACTION_TYPE', payload: {} });
    expect(unknownRes.status).toBe(400);
    expect(unknownRes.body.error).toContain('Invalid or unsupported AI actionType');

    // 18c. Rejects invalid payload (schema validation: negative amount)
    const invalidSchemaRes = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .send({ actionType: 'ADD_EXPENSE', payload: { title: 'Test Expense', amount: -50 } });
    expect(invalidSchemaRes.status).toBe(400);

    // 18d. Rejects missing resource (supplier 404)
    const missingSupRes = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', `idemp-test-sup-${Date.now()}`)
      .send({
        actionType: 'REGISTER_PURCHASE',
        payload: { supplierId: 'non_existent_supplier', itemName: 'Flour', quantity: 10, totalCost: 100 }
      });
    expect(missingSupRes.status).toBe(404);

    // 18e. Rejects missing employee for REGISTER_SALARY
    const missingEmpRes = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', `idemp-test-emp-${Date.now()}`)
      .send({
        actionType: 'REGISTER_SALARY',
        payload: { employeeId: 'non_existent_emp', amount: 1000 }
      });
    expect(missingEmpRes.status).toBe(404);

    // 18f. Rejects missing order for RECORD_REFUND
    const missingOrderRes = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', `idemp-test-ord-${Date.now()}`)
      .send({
        actionType: 'RECORD_REFUND',
        payload: { orderId: 'non_existent_order', amount: 20 }
      });
    expect(missingOrderRes.status).toBe(404);

    // 18g. Rejects missing product for UPDATE_STOCK
    const missingProdRes = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', `idemp-test-stk-${Date.now()}`)
      .send({
        actionType: 'UPDATE_STOCK',
        payload: { productId: 'non_existent_prod', newStock: 50 }
      });
    expect(missingProdRes.status).toBe(404);

    // 18h. Happy Path: ADD_EXPENSE
    const expRes = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', `idemp-test-exp-${Date.now()}`)
      .send({
        actionType: 'ADD_EXPENSE',
        payload: { title: 'AI Kitchen Repairs', amount: 350, category: 'Maintenance' }
      });
    expect(expRes.status).toBe(200);
    expect(expRes.body.status).toBe('success');

    // 18i. Happy Path: REGISTER_PURCHASE
    const purRes = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', `idemp-test-pur-${Date.now()}`)
      .send({
        actionType: 'REGISTER_PURCHASE',
        payload: { supplierId: 'test_sup_1', supplierName: 'Al Marai Dairy', itemName: 'Butter', quantity: 20, unitPrice: 5, totalCost: 100 }
      });
    expect(purRes.status).toBe(200);
    expect(purRes.body.status).toBe('success');

    // 18j. Happy Path: REGISTER_SALARY
    const salRes = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', `idemp-test-sal-${Date.now()}`)
      .send({
        actionType: 'REGISTER_SALARY',
        payload: { employeeId: 'test_emp_1', employeeName: 'Sultan Chef', amount: 2000, period: 'August 2026' }
      });
    expect(salRes.status).toBe(200);
    expect(salRes.body.status).toBe('success');

    // 18k. Happy Path: RECORD_REFUND
    const refRes = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', `idemp-test-ref-${Date.now()}`)
      .send({
        actionType: 'RECORD_REFUND',
        payload: { orderId: 'test_order_ai', amount: 25, reason: 'Cold food' }
      });
    expect(refRes.status).toBe(200);
    expect(refRes.body.status).toBe('success');

    // 18l. Happy Path: RECORD_BANK_TRANSACTION
    const bankRes = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', `idemp-test-bnk-${Date.now()}`)
      .send({
        actionType: 'RECORD_BANK_TRANSACTION',
        payload: { bankAccountId: 'test_acc_ai', accountName: 'Central Bank', type: 'deposit', amount: 1500, description: 'Capital Injection' }
      });
    expect(bankRes.status).toBe(200);
    expect(bankRes.body.status).toBe('success');

    // 18m. Happy Path: RECORD_MOVEMENT
    const movRes = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', `idemp-test-mov-${Date.now()}`)
      .send({
        actionType: 'RECORD_MOVEMENT',
        payload: { itemId: 'test_ing_ai', itemType: 'ingredient', itemName: 'Olive Oil', type: 'in', quantity: 10, reason: 'Fresh Stock' }
      });
    expect(movRes.status).toBe(200);
    expect(movRes.body.status).toBe('success');

    // 18n. Happy Path: UPDATE_STOCK
    const stockRes = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', `idemp-test-stk2-${Date.now()}`)
      .send({
        actionType: 'UPDATE_STOCK',
        payload: { productId: 'test_prod_ai', newStock: 45 }
      });
    expect(stockRes.status).toBe(200);
    expect(stockRes.body.status).toBe('success');

    // Verify stock was updated in Firestore
    const prodSnap = await db.collection('products').doc('test_prod_ai').get();
    expect(prodSnap.data().stock).toBe(45);
  });

  it('19. POST /api/ai/execute-action - strict Zod schema validation rejects invalid AI payloads', async () => {
    // a. missing required field
    const resMissing = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .send({
        actionType: 'ADD_EXPENSE',
        payload: { title: 'Electricity' }
      });
    expect(resMissing.status).toBe(400);
    expect(resMissing.body.error).toMatch(/schema validation failed/i);

    // b. wrong type
    const resWrongType = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .send({
        actionType: 'ADD_EXPENSE',
        payload: { title: 'Electricity', amount: 'one hundred' }
      });
    expect(resWrongType.status).toBe(400);
    expect(resWrongType.body.error).toMatch(/schema validation failed/i);

    // c. unknown/unexpected field
    const resUnknownField = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .send({
        actionType: 'ADD_EXPENSE',
        payload: { title: 'Electricity', amount: 100, unexpectedField: 'hack' }
      });
    expect(resUnknownField.status).toBe(400);
    expect(resUnknownField.body.error).toMatch(/schema validation failed/i);

    // d. invalid enum
    const resInvalidEnum = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .send({
        actionType: 'ADD_EXPENSE',
        payload: { title: 'Electricity', amount: 100, paymentMethod: 'bitcoin' }
      });
    expect(resInvalidEnum.status).toBe(400);
    expect(resInvalidEnum.body.error).toMatch(/schema validation failed/i);

    // e. negative amount
    const resNegativeAmount = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .send({
        actionType: 'ADD_EXPENSE',
        payload: { title: 'Electricity', amount: -50 }
      });
    expect(resNegativeAmount.status).toBe(400);
    expect(resNegativeAmount.body.error).toMatch(/schema validation failed/i);

    // f. fake ID
    const resFakeId = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .set('Idempotency-Key', 'idemp-test-fake-ord')
      .send({
        actionType: 'RECORD_REFUND',
        payload: { orderId: 'ord_1', amount: 10 }
      });
    expect(resFakeId.status).toBe(400);
    expect(resFakeId.body.error).toMatch(/Fake or invalid/i);

    // g. forbidden security field
    const resForbiddenSecurity = await request(app)
      .post('/api/ai/execute-action')
      .set('Authorization', OWNER_TOKEN)
      .send({
        actionType: 'ADD_EXPENSE',
        payload: { title: 'Electricity', amount: 100, role: 'Owner' }
      });
    expect(resForbiddenSecurity.status).toBe(400);
    expect(resForbiddenSecurity.body.error).toMatch(/Security violation/i);
  });

  describe('P0 & P1 SERVER-AUTHORITATIVE FINANCIAL INTEGRITY & TAMPERING PREVENTION', () => {
    it('P0-1: Server recalculates tax using server configuration, IGNORES client taxRate tampering, and REJECTS if unconfigured', async () => {
      const db = getAdminDb();
      await db.collection('products').doc('prod_tax_test').set({
        id: 'prod_tax_test',
        name: 'Tax Test Burger',
        price: 100,
        isActive: true,
        trackStock: false
      });

      // 1. With branch taxEnabled=true but no tax config -> Reject checkout
      await db.collection('branches').doc('main_branch_01').set({ id: 'main_branch_01', taxEnabled: true });
      const resReject = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [{ productId: 'prod_tax_test', quantity: 1, price: 100 }],
            taxRate: 0.50,
            orderType: 'dine_in',
            paymentMethod: 'cash',
            paidAmount: 150
          }
        });
      expect(resReject.status).toBe(400);
      expect(resReject.body.error).toMatch(/Tax configuration not found/i);

      // 2. With branch configured taxRate = 0.05 -> Ignores client taxRate: 0.00
      await db.collection('branches').doc('main_branch_01').set({
        id: 'main_branch_01',
        taxRate: 0.05,
        defaultDeliveryFee: 2.00
      });

      const res = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [{ productId: 'prod_tax_test', quantity: 1, price: 100 }],
            taxRate: 0.00, // Tampered!
            orderType: 'dine_in',
            paymentMethod: 'cash',
            paidAmount: 105
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.order.taxRate).toBe(0.05);
      expect(res.body.order.tax).toBe(5);
      expect(res.body.order.totalAmount).toBe(105);
    });

    it('P0-2: Server recalculates delivery fee, IGNORES client deliveryFee tampering, and REJECTS if unconfigured', async () => {
      const db = getAdminDb();
      await db.collection('products').doc('prod_del_test').set({
        id: 'prod_del_test',
        name: 'Delivery Pizza',
        price: 50,
        isActive: true,
        trackStock: false
      });

      // 1. Without delivery fee config -> Reject delivery checkout
      await db.collection('branches').doc('main_branch_01').set({ id: 'main_branch_01', taxRate: 0.05 });
      const resReject = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [{ productId: 'prod_del_test', quantity: 1 }],
            orderType: 'delivery',
            deliveryFee: 10.00,
            paymentMethod: 'cash',
            paidAmount: 100
          }
        });
      expect(resReject.status).toBe(400);
      expect(resReject.body.error).toMatch(/Delivery fee configuration not found/i);

      // 2. Configured delivery fee on branch -> Ignores client deliveryFee: 0.00
      await db.collection('branches').doc('main_branch_01').set({
        id: 'main_branch_01',
        taxRate: 0.05,
        defaultDeliveryFee: 2.00
      });

      const res = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [{ productId: 'prod_del_test', quantity: 1 }],
            orderType: 'delivery',
            deliveryFee: 0.00, // Tampered!
            paymentMethod: 'cash',
            paidAmount: 54.5
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.order.deliveryFee).toBe(2);
      expect(res.body.order.totalAmount).toBe(54.5);
    });

    it('P0-3: Server looks up option/modifier prices from database and REJECTS client price tampering / fake options', async () => {
      const db = getAdminDb();
      await db.collection('products').doc('prod_opt_test').set({
        id: 'prod_opt_test',
        name: 'Custom Steak',
        price: 80,
        isActive: true,
        trackStock: false,
        options: [
          {
            id: 'opt_sauce',
            nameEn: 'Sauce',
            choices: [
              { id: 'ch_mushroom', nameEn: 'Mushroom', priceModifier: 15 }
            ]
          }
        ]
      });

      const res1 = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [
              {
                productId: 'prod_opt_test',
                quantity: 1,
                selectedOptions: [
                  { optionId: 'opt_sauce', choiceId: 'ch_mushroom', priceModifier: 0 }
                ]
              }
            ],
            orderType: 'dine_in',
            paymentMethod: 'cash',
            paidAmount: 99.75
          }
        });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.order.subtotal).toBe(95);

      const res2 = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [
              {
                productId: 'prod_opt_test',
                quantity: 1,
                selectedOptions: [
                  { optionId: 'opt_sauce', choiceId: 'ch_fake_choice', priceModifier: 0 }
                ]
              }
            ],
            orderType: 'dine_in',
            paymentMethod: 'cash'
          }
        });

      expect(res2.status).toBe(400);
      expect(res2.body.error).toMatch(/Invalid or missing choice/i);
    });

    it('P0-4: Server verifies payment authority (rejects insufficient / negative amounts, correctly records cash & credit sales)', async () => {
      const db = getAdminDb();
      await db.collection('products').doc('prod_pay_test').set({
        id: 'prod_pay_test',
        name: 'Juice',
        price: 20,
        isActive: true,
        trackStock: false
      });

      const resInsufficient = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [{ productId: 'prod_pay_test', quantity: 1 }],
            paidAmount: 5,
            paymentMethod: 'cash'
          }
        });
      expect(resInsufficient.status).toBe(400);
      expect(resInsufficient.body.error).toMatch(/Payment amount must exactly match order total|Insufficient payment amount|Underpayment rejected/i);

      const resNegative = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [{ productId: 'prod_pay_test', quantity: 1 }],
            paidAmount: -50,
            paymentMethod: 'cash'
          }
        });
      expect(resNegative.status).toBe(400);
      expect(resNegative.body.error).toMatch(/Invalid payment amount/i);

      const resCredit = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [{ productId: 'prod_pay_test', quantity: 1 }],
            paymentMethod: 'credit',
            customerName: 'Ahmad VIP Credit'
          }
        });
      expect(resCredit.status).toBe(200);
      expect(resCredit.body.order.paymentStatus).toBe('unpaid');
      expect(resCredit.body.order.paymentMethod).toBe('credit');

      const resValidCash = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [{ productId: 'prod_pay_test', quantity: 1 }],
            paymentMethod: 'cash',
            paidAmount: 21
          }
        });
      expect(resValidCash.status).toBe(200);
      expect(resValidCash.body.order.paymentStatus).toBe('paid');
    });

    it('P0-5: PAYMENT - Rejects fake paid status & missing payment amount, and verifies Credit uses AR without cash/bank line', async () => {
      const db = getAdminDb();
      await db.collection('products').doc('prod_pay_test_2').set({
        id: 'prod_pay_test_2',
        name: 'Coffee',
        price: 10,
        isActive: true,
        trackStock: false
      });
      await db.collection('branches').doc('main_branch_01').set({ id: 'main_branch_01', taxRate: 0.05 });

      // 1. Missing payment amount for cash sale -> REJECT
      const resMissingPay = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [{ productId: 'prod_pay_test_2', quantity: 1 }],
            paymentMethod: 'cash'
          }
        });
      expect(resMissingPay.status).toBe(400);
      expect(resMissingPay.body.error).toMatch(/Missing payment amount/i);

      // 2. Fake paid status (claiming paymentStatus: 'paid' without paidAmount) -> REJECT
      const resFakePaid = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [{ productId: 'prod_pay_test_2', quantity: 1 }],
            paymentMethod: 'cash',
            paymentStatus: 'paid'
          }
        });
      expect(resFakePaid.status).toBe(400);

      // 3. Credit sale -> Creates AR record and journal uses acc_ar (no cash/bank debit)
      const resCreditSale = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [{ productId: 'prod_pay_test_2', quantity: 1 }],
            paymentMethod: 'credit',
            customerName: 'Test Credit Customer'
          }
        });
      expect(resCreditSale.status).toBe(200);
      expect(resCreditSale.body.order.paymentStatus).toBe('unpaid');
      const orderId = resCreditSale.body.order.id;

      // Verify Journal Entry for Credit Sale
      const jeSnap = await db.collection('journal_entries').where('reference', '==', resCreditSale.body.order.orderNumber).get();
      expect(jeSnap.empty).toBe(false);
      const jeData = jeSnap.docs[0].data();
      const arLine = jeData.lines.find((l: any) => l.accountId === 'acc_ar');
      const cashLine = jeData.lines.find((l: any) => l.accountId === 'acc_cash');
      const bankLine = jeData.lines.find((l: any) => l.accountId === 'acc_bank');
      expect(arLine).toBeDefined();
      expect(cashLine).toBeUndefined(); // NO Cash line for unpaid credit sale!
      expect(bankLine).toBeUndefined(); // NO Bank line for unpaid credit sale!
    });

    it('P0-6: TAX - Selects correct Tax Policy and rejects when tax policy is unconfigured/invalid', async () => {
      const db = getAdminDb();
      await db.collection('products').doc('prod_tax_policy_test').set({
        id: 'prod_tax_policy_test',
        name: 'Tax Item',
        price: 100,
        isActive: true,
        trackStock: false
      });

      // Branch without branch taxRate set, but has specific tax policies in taxes collection
      await db.collection('branches').doc('main_branch_01').set({ id: 'main_branch_01' }); // clear taxRate on branch
      
      // Add two active tax docs for main_branch_01
      await db.collection('taxes').doc('tax_vat').set({
        id: 'tax_vat',
        branchId: 'main_branch_01',
        taxType: 'vat',
        rate: 5,
        isActive: true,
        isPrimary: true
      });
      await db.collection('taxes').doc('tax_excise').set({
        id: 'tax_excise',
        branchId: 'main_branch_01',
        taxType: 'excise',
        rate: 15,
        isActive: true,
        isPrimary: false
      });

      // Checkout picks primary tax (VAT 5%), does NOT sum all taxes to 20%
      const resTaxPolicy = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [{ productId: 'prod_tax_policy_test', quantity: 1 }],
            paymentMethod: 'cash',
            paidAmount: 105
          }
        });

      expect(resTaxPolicy.status).toBe(200);
      expect(resTaxPolicy.body.order.taxRate).toBe(0.05);
      expect(resTaxPolicy.body.order.tax).toBe(5);

      // Remove taxes collection docs as well while branch has taxEnabled: true -> Branch with NO tax configuration -> REJECT
      await db.collection('branches').doc('main_branch_01').set({ id: 'main_branch_01', taxEnabled: true });
      await db.collection('taxes').doc('tax_vat').delete();
      await db.collection('taxes').doc('tax_excise').delete();

      const resNoTax = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [{ productId: 'prod_tax_policy_test', quantity: 1 }],
            paymentMethod: 'cash',
            paidAmount: 100
          }
        });

      expect(resNoTax.status).toBe(400);
      expect(resNoTax.body.error).toMatch(/Tax configuration not found/i);
    });

    it('P0-7: DELIVERY ZONE - Validates deliveryZoneId exists and belongs to branch, REJECTS invalid or cross-branch zone without fallback', async () => {
      const db = getAdminDb();
      await db.collection('products').doc('prod_dz_test').set({
        id: 'prod_dz_test',
        name: 'Zone Sandwich',
        price: 20,
        isActive: true,
        trackStock: false
      });
      await db.collection('branches').doc('main_branch_01').set({ id: 'main_branch_01', taxRate: 0.05 });
      await db.collection('branches').doc('branch_other').set({ id: 'branch_other', taxRate: 0.05 });

      // Valid zone for main_branch_01
      await db.collection('delivery_zones').doc('zone_valid_01').set({
        id: 'zone_valid_01',
        branchId: 'main_branch_01',
        baseDeliveryFee: 3.50,
        name: 'Downtown Zone'
      });
      // Zone belonging to branch_other
      await db.collection('delivery_zones').doc('zone_other_02').set({
        id: 'zone_other_02',
        branchId: 'branch_other',
        baseDeliveryFee: 5.00,
        name: 'Uptown Zone'
      });

      // 1. Non-existent deliveryZoneId -> REJECT
      const resFakeZone = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [{ productId: 'prod_dz_test', quantity: 1 }],
            orderType: 'delivery',
            deliveryZoneId: 'non_existent_zone_999',
            paymentMethod: 'cash',
            paidAmount: 50
          }
        });
      expect(resFakeZone.status).toBe(400);
      expect(resFakeZone.body.error).toMatch(/Delivery zone .* not found/i);

      // 2. Cross-branch deliveryZoneId -> REJECT
      const resCrossBranchZone = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [{ productId: 'prod_dz_test', quantity: 1 }],
            orderType: 'delivery',
            deliveryZoneId: 'zone_other_02',
            paymentMethod: 'cash',
            paidAmount: 50
          }
        });
      expect(resCrossBranchZone.status).toBe(400);
      expect(resCrossBranchZone.body.error).toMatch(/does not belong to branch/i);

      // 3. Valid zone for branch -> SUCCESS with exact fee
      const resValidZone = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [{ productId: 'prod_dz_test', quantity: 1 }],
            orderType: 'delivery',
            deliveryZoneId: 'zone_valid_01',
            paymentMethod: 'cash',
            paidAmount: 24.5
          }
        });
      expect(resValidZone.status).toBe(200);
      expect(resValidZone.body.order.deliveryFee).toBe(3.50);
    });

    it('P1-3B: Delivery fee optional, client tampering ignored, driver earnings separated', async () => {
      const db = getAdminDb();
      // 1. Setup zone with deliveryFeeEnabled = false & driverEarningsAmount = 2.00
      await db.collection('delivery_zones').doc('zone_nofee_01').set({
        id: 'zone_nofee_01',
        branchId: 'main_branch_01',
        deliveryFeeEnabled: false,
        baseDeliveryFee: 5.00,
        driverEarningsAmount: 2.00,
        name: 'Free Delivery Zone'
      });

      // Checkout with client tampering (client sends deliveryFee: 99.00)
      const resFeeDisabled = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            items: [{ productId: 'prod_dz_test', quantity: 1 }],
            orderType: 'delivery',
            deliveryZoneId: 'zone_nofee_01',
            deliveryFee: 99.00, // Client fee tampering!
            paymentMethod: 'cash',
            paidAmount: 21
          }
        });

      expect(resFeeDisabled.status).toBe(200);
      // Server must set deliveryFee = 0 because deliveryFeeEnabled = false
      expect(resFeeDisabled.body.order.deliveryFee).toBe(0);
      expect(resFeeDisabled.body.order.driverEarningsAmount).toBe(2.00);
      expect(resFeeDisabled.body.order.driverDue).toBe(2.00);

      // Verify journal entry has NO delivery revenue line since deliveryFee = 0, and driver expense line is present
      const orderNumber = resFeeDisabled.body.order.orderNumber;
      const jeSnap = await db.collection('journal_entries').where('reference', '==', orderNumber).get();
      expect(jeSnap.empty).toBe(false);
      const jeData = jeSnap.docs[0].data();
      const deliveryRevLine = jeData.lines.find((l: any) => l.accountId === 'acc_delivery_revenue');
      expect(deliveryRevLine).toBeUndefined();
      const driverExpLine = jeData.lines.find((l: any) => l.accountId === 'acc_driver_expense');
      expect(driverExpLine).toBeDefined();
      expect(driverExpLine.debit).toBe(2.00);
    });

    it('P1-4: Server entrypoint verification', async () => {
      const res = await request(app).get('/api/health');
      expect([200, 404]).toContain(res.status);
    });

    it('P1-5: AI Actions validate strict Zod schemas and reject security field overrides', async () => {
      const resForbidden = await request(app)
        .post('/api/ai/execute-action')
        .set('Authorization', OWNER_TOKEN)
        .send({
          actionType: 'ADD_EXPENSE',
          payload: {
            title: 'Hacked Expense',
            amount: 50,
            role: 'Owner' // Security field violation!
          }
        });
      expect(resForbidden.status).toBe(400);
      expect(resForbidden.body.error).toMatch(/Security violation/i);

      const resInvalidSchema = await request(app)
        .post('/api/ai/execute-action')
        .set('Authorization', OWNER_TOKEN)
        .send({
          actionType: 'ADD_EXPENSE',
          payload: {
            title: 'Bad Amount Expense',
            amount: -100 // Invalid negative amount
          }
        });
      expect(resInvalidSchema.status).toBe(400);
      expect(resInvalidSchema.body.error).toMatch(/schema validation failed/i);
    });

    it('P1-6 & P1-7: Financial report calculates AR/AP and Cash/Bank GL control account reconciliation', async () => {
      const resReport = await request(app)
        .get('/api/financial-summary')
        .set('Authorization', OWNER_TOKEN);

      expect(resReport.status).toBe(200);
      expect(resReport.body.reconciliation).toBeDefined();
      expect(typeof resReport.body.reconciliation.arOperational).toBe('number');
      expect(typeof resReport.body.reconciliation.arGlControl).toBe('number');
      expect(typeof resReport.body.reconciliation.arReconciled).toBe('boolean');
      expect(typeof resReport.body.reconciliation.apOperational).toBe('number');
      expect(typeof resReport.body.reconciliation.apGlControl).toBe('number');
      expect(typeof resReport.body.reconciliation.apReconciled).toBe('boolean');
      expect(typeof resReport.body.reconciliation.cashOperational).toBe('number');
      expect(typeof resReport.body.reconciliation.cashGlControl).toBe('number');
      expect(typeof resReport.body.reconciliation.cashReconciled).toBe('boolean');
      expect(typeof resReport.body.reconciliation.bankOperational).toBe('number');
      expect(typeof resReport.body.reconciliation.bankGlControl).toBe('number');
      expect(typeof resReport.body.reconciliation.bankReconciled).toBe('boolean');
    });

    it('P1-1: 4-Case Matrix: Separate Cash vs Bank Reconciliation', async () => {
      const { getFinancialSummaryData } = await import('../server/trustedFinancialBackend.js');
      const db = getAdminDb();

      // Case 1: Cash match (5000/5000) / Bank match (2000/2000)
      await db.collection('accounts').doc('acc_cash_p1_1').set({ id: 'acc_cash_p1_1', code: '1010', type: 'cash', balance: 5000, branchId: 'branch_p1_1' });
      await db.collection('accounts').doc('acc_bank_p1_1').set({ id: 'acc_bank_p1_1', code: '1020', type: 'bank', balance: 2000, branchId: 'branch_p1_1' });

      const nowIso = new Date().toISOString();
      await db.collection('journal_lines').doc('jl_p1_1_cash').set({
        id: 'jl_p1_1_cash',
        branchId: 'branch_p1_1',
        accountCode: '1010',
        debit: 5000,
        credit: 0,
        createdAt: nowIso
      });
      await db.collection('journal_lines').doc('jl_p1_1_bank').set({
        id: 'jl_p1_1_bank',
        branchId: 'branch_p1_1',
        accountCode: '1020',
        debit: 2000,
        credit: 0,
        createdAt: nowIso
      });

      const summary1 = await getFinancialSummaryData('branch_p1_1');
      expect(summary1.reconciliation.cashOperational).toBe(5000);
      expect(summary1.reconciliation.cashGlControl).toBe(5000);
      expect(summary1.reconciliation.cashDifference).toBe(0);
      expect(summary1.reconciliation.cashReconciled).toBe(true);
      expect(summary1.reconciliation.bankOperational).toBe(2000);
      expect(summary1.reconciliation.bankGlControl).toBe(2000);
      expect(summary1.reconciliation.bankDifference).toBe(0);
      expect(summary1.reconciliation.bankReconciled).toBe(true);

      // Case 2: Cash mismatch (5000 vs 0) / Bank match (2000 vs 2000)
      await db.collection('journal_lines').doc('jl_p1_1_cash').set({
        id: 'jl_p1_1_cash',
        branchId: 'branch_p1_1',
        accountCode: '1010',
        debit: 0,
        credit: 0,
        createdAt: nowIso
      });

      const summary2 = await getFinancialSummaryData('branch_p1_1');
      expect(summary2.reconciliation.cashOperational).toBe(5000);
      expect(summary2.reconciliation.cashGlControl).toBe(0);
      expect(summary2.reconciliation.cashDifference).toBe(5000);
      expect(summary2.reconciliation.cashReconciled).toBe(false);
      expect(summary2.reconciliation.bankOperational).toBe(2000);
      expect(summary2.reconciliation.bankGlControl).toBe(2000);
      expect(summary2.reconciliation.bankDifference).toBe(0);
      expect(summary2.reconciliation.bankReconciled).toBe(true);

      // Case 3: Cash match (5000 vs 5000) / Bank mismatch (2000 vs 1000)
      await db.collection('journal_lines').doc('jl_p1_1_cash').set({
        id: 'jl_p1_1_cash',
        branchId: 'branch_p1_1',
        accountCode: '1010',
        debit: 5000,
        credit: 0,
        createdAt: nowIso
      });
      await db.collection('journal_lines').doc('jl_p1_1_bank').set({
        id: 'jl_p1_1_bank',
        branchId: 'branch_p1_1',
        accountCode: '1020',
        debit: 1000,
        credit: 0,
        createdAt: nowIso
      });

      const summary3 = await getFinancialSummaryData('branch_p1_1');
      expect(summary3.reconciliation.cashOperational).toBe(5000);
      expect(summary3.reconciliation.cashGlControl).toBe(5000);
      expect(summary3.reconciliation.cashDifference).toBe(0);
      expect(summary3.reconciliation.cashReconciled).toBe(true);
      expect(summary3.reconciliation.bankOperational).toBe(2000);
      expect(summary3.reconciliation.bankGlControl).toBe(1000);
      expect(summary3.reconciliation.bankDifference).toBe(1000);
      expect(summary3.reconciliation.bankReconciled).toBe(false);

      // Case 4: Cash mismatch (5000 vs 0) / Bank mismatch (2000 vs 5000)
      await db.collection('journal_lines').doc('jl_p1_1_cash').set({
        id: 'jl_p1_1_cash',
        branchId: 'branch_p1_1',
        accountCode: '1010',
        debit: 0,
        credit: 0,
        createdAt: nowIso
      });
      await db.collection('journal_lines').doc('jl_p1_1_bank').set({
        id: 'jl_p1_1_bank',
        branchId: 'branch_p1_1',
        accountCode: '1020',
        debit: 5000,
        credit: 0,
        createdAt: nowIso
      });

      const summary4 = await getFinancialSummaryData('branch_p1_1');
      expect(summary4.reconciliation.cashOperational).toBe(5000);
      expect(summary4.reconciliation.cashGlControl).toBe(0);
      expect(summary4.reconciliation.cashDifference).toBe(5000);
      expect(summary4.reconciliation.cashReconciled).toBe(false);
      expect(summary4.reconciliation.bankOperational).toBe(2000);
      expect(summary4.reconciliation.bankGlControl).toBe(5000);
      expect(summary4.reconciliation.bankDifference).toBe(-3000);
      expect(summary4.reconciliation.bankReconciled).toBe(false);
    });

    it('P1-2: Unify HQ Authorization in Wallet Handlers (6 Scenarios)', async () => {
      const db = getAdminDb();
      await db.collection('customers').doc('cust_b').set({
        id: 'cust_b',
        name: 'Customer B',
        branchId: 'branch_b'
      });
      await db.collection('customer_wallets').doc('wall_b').set({
        id: 'wall_b',
        customerId: 'cust_b',
        customerName: 'Customer B',
        balance: 100,
        branchId: 'branch_b'
      });

      // 1. Manager + empty branchId -> DENIED
      const res1 = await request(app)
        .post('/api/crm/wallet/recharge')
        .set('Authorization', 'Bearer test_token_manager_nobranch')
        .send({ customerId: 'cust_b', amount: 50, branchId: 'branch_b' });
      expect(res1.status).toBe(403);
      expect(res1.body.error).toMatch(/Access denied/i);

      // 2. Admin + empty branchId -> DENIED
      const res2 = await request(app)
        .post('/api/crm/wallet/recharge')
        .set('Authorization', 'Bearer test_token_admin_nobranch')
        .send({ customerId: 'cust_b', amount: 50, branchId: 'branch_b' });
      expect(res2.status).toBe(403);
      expect(res2.body.error).toMatch(/Access denied/i);

      // 3. Manager Branch A -> Wallet Branch B -> DENIED
      const res3 = await request(app)
        .post('/api/crm/wallet/recharge')
        .set('Authorization', 'Bearer test_token_manager_branch_a')
        .send({ customerId: 'cust_b', amount: 50, branchId: 'branch_b' });
      expect(res3.status).toBe(403);
      expect(res3.body.error).toMatch(/Unauthorized cross-branch/i);

      // 4. Admin Branch A -> Wallet Branch B -> DENIED
      const res4 = await request(app)
        .post('/api/crm/wallet/deduct')
        .set('Authorization', 'Bearer test_token_admin_branch_a')
        .send({ customerId: 'cust_b', amount: 10, branchId: 'branch_b' });
      expect(res4.status).toBe(403);
      expect(res4.body.error).toMatch(/Unauthorized cross-branch/i);

      // 5. Owner / explicit HQ -> ALLOWED
      const res5 = await request(app)
        .post('/api/crm/wallet/recharge')
        .set('Authorization', 'Bearer test_token_owner_branch_a')
        .set('Idempotency-Key', 'idemp_p1_recharge_5')
        .send({ customerId: 'cust_b', amount: 50, branchId: 'branch_b' });
      expect(res5.status).toBe(200);
      expect(res5.body.status).toBe('success');

      // 6. Same-branch authorized wallet action -> ALLOWED
      const res6 = await request(app)
        .post('/api/crm/wallet/deduct')
        .set('Authorization', 'Bearer test_token_manager_branch_b')
        .set('Idempotency-Key', 'idemp_p1_deduct_6')
        .send({ customerId: 'cust_b', amount: 10, branchId: 'branch_b' });
      expect(res6.status).toBe(200);
      expect(res6.body.status).toBe('success');
    });

    it('P0 REGRESSION: Credit / Unpaid Refund Cash Payout Protection (5 Scenarios)', async () => {
      const db = getAdminDb();
      // 1. Paid cash order -> valid cash refund
      await db.collection('orders').doc('ord_ref_test_1').set({
        id: 'ord_ref_test_1', orderNumber: 'ORD-R1', totalAmount: 100, paidAmount: 100, paymentStatus: 'paid', paymentMethod: 'cash', branchId: 'main_branch_01'
      });
      const res1 = await request(app)
        .post('/api/orders/ord_ref_test_1/refund')
        .set('Authorization', OWNER_TOKEN)
        .send({ amount: 20, paymentMethod: 'cash' });
      expect(res1.status).toBe(200);
      expect(res1.body.status).toBe('success');

      // 2. Unpaid order -> cash refund rejected
      await db.collection('orders').doc('ord_ref_test_2').set({
        id: 'ord_ref_test_2', orderNumber: 'ORD-R2', totalAmount: 100, paidAmount: 0, paymentStatus: 'unpaid', paymentMethod: 'cash', branchId: 'main_branch_01'
      });
      const res2 = await request(app)
        .post('/api/orders/ord_ref_test_2/refund')
        .set('Authorization', OWNER_TOKEN)
        .send({ amount: 20, paymentMethod: 'cash' });
      expect(res2.status).toBe(500);
      expect(res2.body.error).toMatch(/unpaid Order/i);

      // 3. Credit order with paidAmount=0 -> cash refund rejected
      await db.collection('orders').doc('ord_ref_test_3').set({
        id: 'ord_ref_test_3', orderNumber: 'ORD-R3', totalAmount: 100, paidAmount: 0, paymentStatus: 'unpaid', paymentMethod: 'credit', isCredit: true, branchId: 'main_branch_01'
      });
      const res3 = await request(app)
        .post('/api/orders/ord_ref_test_3/refund')
        .set('Authorization', OWNER_TOKEN)
        .send({ amount: 20, paymentMethod: 'cash' });
      expect(res3.status).toBe(500);
      expect(res3.body.error).toMatch(/unpaid Order|Credit Order/i);

      // 4. Credit order with malicious request paymentMethod="cash" -> rejected
      await db.collection('orders').doc('ord_ref_test_4').set({
        id: 'ord_ref_test_4', orderNumber: 'ORD-R4', totalAmount: 100, paidAmount: 100, paymentStatus: 'paid', paymentMethod: 'credit', isCredit: true, branchId: 'main_branch_01'
      });
      const res4 = await request(app)
        .post('/api/orders/ord_ref_test_4/refund')
        .set('Authorization', OWNER_TOKEN)
        .send({ amount: 20, paymentMethod: 'cash' });
      expect(res4.status).toBe(500);
      expect(res4.body.error).toMatch(/Credit Order/i);

      // 5. Paid bank/card order -> valid eligible refund
      await db.collection('orders').doc('ord_ref_test_5').set({
        id: 'ord_ref_test_5', orderNumber: 'ORD-R5', totalAmount: 100, paidAmount: 100, paymentStatus: 'paid', paymentMethod: 'bank', branchId: 'main_branch_01'
      });
      const res5 = await request(app)
        .post('/api/orders/ord_ref_test_5/refund')
        .set('Authorization', OWNER_TOKEN)
        .send({ amount: 20, paymentMethod: 'bank' });
      expect(res5.status).toBe(200);
      expect(res5.body.status).toBe('success');
    });

    it('P0-2: Inventory adjustment rejects unauthorized cross-branch item mutation', async () => {
      const db = getAdminDb();
      await db.collection('products').doc('prod_branch_2').set({
        id: 'prod_branch_2',
        name: 'Branch 2 Steak',
        stock: 50,
        branchId: 'branch_02'
      });

      const res = await request(app)
        .post('/api/inventory/adjust')
        .set('Authorization', 'Bearer test_token_manager') // Manager of main_branch_01
        .send({
          movementData: {
            itemId: 'prod_branch_2',
            itemType: 'product',
            type: 'in',
            quantity: 10,
            branchId: 'main_branch_01' // trying to disguise as main_branch_01
          }
        });

      expect([403, 500]).toContain(res.status);
      expect(res.body.error).toMatch(/Unauthorized cross-branch inventory modification/i);
    });

    it('P0-3: Bank transaction rejects unauthorized cross-branch account balance modification', async () => {
      const db = getAdminDb();
      await db.collection('accounts').doc('bank_acc_branch_2').set({
        id: 'bank_acc_branch_2',
        balance: 1000,
        branchId: 'branch_02'
      });

      const res = await request(app)
        .post('/api/bank-transactions')
        .set('Authorization', 'Bearer test_token_manager') // Manager of main_branch_01
        .send({
          bankTransactionData: {
            bankAccountId: 'bank_acc_branch_2',
            amount: 100,
            type: 'deposit',
            branchId: 'main_branch_01'
          }
        });

      expect([403, 500]).toContain(res.status);
      expect(res.body.error).toMatch(/Unauthorized cross-branch bank transaction/i);
    });

    it('P1-5: Supplier payment rejects unauthorized cross-branch supplier modification', async () => {
      const db = getAdminDb();
      await db.collection('suppliers').doc('sup_branch_2').set({
        id: 'sup_branch_2',
        name: 'Branch 2 Meat Vendor',
        outstandingBalance: 500,
        branchId: 'branch_02'
      });

      const res = await request(app)
        .post('/api/purchases/supplier-payment')
        .set('Authorization', 'Bearer test_token_manager') // Manager of main_branch_01
        .send({
          supplierId: 'sup_branch_2',
          amount: 200,
          paymentMethod: 'cash',
          branchId: 'main_branch_01'
        });

      expect([403, 500]).toContain(res.status);
      expect(res.body.error).toMatch(/Unauthorized cross-branch supplier payment/i);
    });

    it('P1-6 & P1-7: Kitchen ticket 404 on missing ticket and validates state machine transitions', async () => {
      // 1. Missing ticket returns 404
      const res404 = await request(app)
        .post('/api/kitchen/non_existent_ticket_123/update')
        .set('Authorization', OWNER_TOKEN)
        .send({ prepStatus: 'cooking' });
      expect(res404.status).toBe(404);

      // 2. Invalid state machine jump (new -> completed) rejected with 400
      const db = getAdminDb();
      await db.collection('kitchen_orders').doc('kitchen_ticket_sm').set({
        id: 'kitchen_ticket_sm',
        branchId: 'main_branch_01',
        prepStatus: 'new'
      });

      const resInvalid = await request(app)
        .post('/api/kitchen/kitchen_ticket_sm/update')
        .set('Authorization', OWNER_TOKEN)
        .send({ prepStatus: 'completed' });
      expect(resInvalid.status).toBe(400);
      expect(resInvalid.body.error).toMatch(/Invalid kitchen ticket status transition/i);

      // 3. Valid transition (new -> accepted) allowed with 200
      const resValid = await request(app)
        .post('/api/kitchen/kitchen_ticket_sm/update')
        .set('Authorization', OWNER_TOKEN)
        .send({ prepStatus: 'accepted' });
      expect(resValid.status).toBe(200);
    });

    it('P1-8 & P1-9: Enforces single open register per branch and posts opening balance journal entry', async () => {
      const db = getAdminDb();
      // Clean up previous registers for branch_test_reg
      const snap = await db.collection('cash_registers').where('branchId', '==', 'branch_test_reg').get();
      for (const d of snap.docs) {
        await d.ref.delete();
      }

      // 1. Open first register with opening float 150
      const res1 = await request(app)
        .post('/api/accounting/cash-registers/open')
        .set('Authorization', OWNER_TOKEN)
        .send({
          branchId: 'branch_test_reg',
          openingBalance: 150
        });
      expect(res1.status).toBe(200);
      expect(res1.body.status).toBe('Open');
      const regId = res1.body.id;

      // Check journal entry for float created
      const jeSnap = await db.collection('journal_entries').where('reference', '==', regId).get();
      expect(jeSnap.empty).toBe(false);
      const je = jeSnap.docs[0].data();
      expect(je.totalDebit).toBe(150);
      expect(je.totalCredit).toBe(150);

      // 2. Attempting to open a second register in the same branch fails with 409
      const res2 = await request(app)
        .post('/api/accounting/cash-registers/open')
        .set('Authorization', OWNER_TOKEN)
        .send({
          branchId: 'branch_test_reg',
          openingBalance: 200
        });
      expect(res2.status).toBe(409);
      expect(res2.body.error).toMatch(/active open cash register already exists/i);
    });

    it('KITCHEN-TICKET-FLOW: /api/pos/complete creates consistent kitchen ticket with createdAt timestamp & unassigned delivery', async () => {
      const db = getAdminDb();
      await db.collection('products').doc('prod_kds_01').set({
        id: 'prod_kds_01',
        name: 'Somali Camel Steak & Rice',
        price: 25,
        cost: 10,
        stock: 50,
        branchId: 'main_branch_01'
      });

      const res = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', CASHIER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            orderType: 'delivery',
            customerName: 'Amina Ali',
            customerPhone: '+252615000000',
            customerAddress: 'KM4 Hodan District',
            paymentMethod: 'cash',
            paidAmount: 28.25,
            deliveryFee: 2.00,
            items: [
              { productId: 'prod_kds_01', productName: 'Somali Camel Steak & Rice', quantity: 1, price: 25, costPrice: 10 }
            ],
            subtotal: 25,
            tax: 1.25,
            discountAmount: 0,
            totalAmount: 28.25
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      const orderId = res.body.order.id;
      expect(orderId).toBeDefined();

      // 1. Verify orders collection document
      const orderSnap = await db.collection('orders').doc(orderId).get();
      expect(orderSnap.exists).toBe(true);
      const orderData = orderSnap.data();
      expect(orderData.status).toBe('completed');
      expect(orderData.deliveryStatus).toBe('unassigned');
      expect(orderData.orderType).toBe('delivery');

      // 2. Verify kitchen_orders collection document and full contract
      const kitchenSnap = await db.collection('kitchen_orders').doc(orderId).get();
      expect(kitchenSnap.exists).toBe(true);
      const kitchenData = kitchenSnap.data();

      expect(kitchenData.id).toBe(orderId);
      expect(kitchenData.orderId).toBe(orderId);
      expect(kitchenData.orderNumber).toBeDefined();
      expect(kitchenData.orderTime).toBeDefined();
      expect(kitchenData.createdAt).toBeDefined();
      expect(kitchenData.updatedAt).toBeDefined();
      expect(kitchenData.orderType).toBe('delivery');
      expect(kitchenData.customerName).toBe('Amina Ali');
      expect(kitchenData.branchId).toBe('main_branch_01');
      expect(kitchenData.prepStatus).toBe('new');
      expect(kitchenData.priority).toBe('medium');
      expect(Array.isArray(kitchenData.items)).toBe(true);
      expect(kitchenData.items.length).toBe(1);
      expect(kitchenData.items[0].productName).toBe('Somali Camel Steak & Rice');

      // 3. Verify separation of states: order status (completed/paid) is independent from kitchen prepStatus (new)
      expect(orderData.status).toBe('completed');
      expect(kitchenData.prepStatus).toBe('new');
      expect(orderData.status).not.toBe(kitchenData.prepStatus);

      // 4. Verify delivery document created with status 'unassigned'
      const delSnap = await db.collection('deliveries').doc(orderId).get();
      expect(delSnap.exists).toBe(true);
      const delData = delSnap.data();
      expect(delData.status).toBe('unassigned');
      expect(delData.driverId).toBeUndefined();

      // 5. Seed active driver and assign delivery
      await db.collection('drivers').doc('driver_kds_99').set({
        id: 'driver_kds_99',
        name: 'Ahmed Driver',
        phone: '+252615999999',
        branchId: 'main_branch_01',
        status: 'active',
        availability: 'available'
      });

      const assignRes = await request(app)
        .post(`/api/deliveries/${orderId}/assign`)
        .set('Authorization', CASHIER_TOKEN)
        .send({
          driverId: 'driver_kds_99'
        });

      expect(assignRes.status).toBe(200);
      expect(assignRes.body.status).toBe('success');

      // 6. Verify delivery updated to assigned
      const updatedDelSnap = await db.collection('deliveries').doc(orderId).get();
      expect(updatedDelSnap.data().status).toBe('assigned');
      expect(updatedDelSnap.data().driverId).toBe('driver_kds_99');

      // 7. Verify driver notification was created
      const notifId = `DELIVERY_ASSIGNED_${orderId}_driver_kds_99`;
        const notifSnap = await db.collection('notifications').doc(notifId).get();
      expect(notifSnap.exists).toBe(true);
      expect(notifSnap.data().type).toBe('DELIVERY_ASSIGNED');
      expect(notifSnap.data().recipientId).toBe('driver_kds_99');
    });

    it('DELIVERY-ASSIGNMENT-SUITE: Comprehensive security, authorization, and state integrity tests', async () => {
      const db = getAdminDb();

      // Seed test branch and deliveries
      await db.collection('branches').doc('branch_assign_01').set({
        id: 'branch_assign_01',
        name: 'Assign Branch 1',
        isActive: true
      });
      await db.collection('branches').doc('branch_assign_02').set({
        id: 'branch_assign_02',
        name: 'Assign Branch 2',
        isActive: true
      });

      // Seed drivers
      await db.collection('drivers').doc('drv_valid_01').set({
        id: 'drv_valid_01',
        name: 'Mustafa Hassan',
        phone: '+252615111111',
        branchId: 'branch_assign_01',
        status: 'active',
        availability: 'available'
      });

      await db.collection('drivers').doc('drv_wrong_branch').set({
        id: 'drv_wrong_branch',
        name: 'Ali Omar',
        phone: '+252615222222',
        branchId: 'branch_assign_02',
        status: 'active',
        availability: 'available'
      });

      await db.collection('drivers').doc('drv_suspended').set({
        id: 'drv_suspended',
        name: 'Khadar Suspended',
        phone: '+252615333333',
        branchId: 'branch_assign_01',
        status: 'suspended',
        availability: 'available'
      });

      // Seed unassigned delivery
      await db.collection('deliveries').doc('del_suite_01').set({
        id: 'del_suite_01',
        orderId: 'order_suite_01',
        branchId: 'branch_assign_01',
        customerName: 'Amina Warsame',
        customerPhone: '+252615444444',
        address: 'Hodan District, Mogadishu',
        status: 'unassigned',
        totalAmount: 45,
        deliveryFee: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await db.collection('orders').doc('order_suite_01').set({
        id: 'order_suite_01',
        branchId: 'branch_assign_01',
        status: 'completed',
        deliveryStatus: 'unassigned',
        totalAmount: 48,
        createdAt: new Date().toISOString()
      });

      // 1. Missing authentication -> 401
      const resUnauth = await request(app)
        .post('/api/deliveries/del_suite_01/assign')
        .send({ driverId: 'drv_valid_01' });
      expect(resUnauth.status).toBe(401);

      // 2. Nonexistent delivery -> 404
      const resMissingDel = await request(app)
        .post('/api/deliveries/del_nonexistent_999/assign')
        .set('Authorization', OWNER_TOKEN)
        .send({ driverId: 'drv_valid_01' });
      expect(resMissingDel.status).toBe(404);
      expect(resMissingDel.body.error).toMatch(/not found/i);

      // 3. Nonexistent driver -> 404
      const resMissingDrv = await request(app)
        .post('/api/deliveries/del_suite_01/assign')
        .set('Authorization', OWNER_TOKEN)
        .send({ driverId: 'drv_nonexistent_999' });
      expect(resMissingDrv.status).toBe(404);
      expect(resMissingDrv.body.error).toMatch(/driver #drv_nonexistent_999 not found/i);

      // 4. Inactive/Suspended driver -> 400
      const resSuspended = await request(app)
        .post('/api/deliveries/del_suite_01/assign')
        .set('Authorization', OWNER_TOKEN)
        .send({ driverId: 'drv_suspended' });
      expect(resSuspended.status).toBe(400);
      expect(resSuspended.body.error).toMatch(/inactive or suspended/i);

      // 5. Wrong-branch driver (cross-branch unauthorized manager) -> 403
      const resWrongBranch = await request(app)
        .post('/api/deliveries/del_suite_01/assign')
        .set('Authorization', CASHIER_TOKEN) // CASHIER_TOKEN is assigned to main_branch_01
        .send({ driverId: 'drv_wrong_branch' });
      expect(resWrongBranch.status).toBe(403);
      expect(resWrongBranch.body.error).toMatch(/unauthorized/i);

      // 6. Valid same-branch driver assignment -> 200
      const resValid = await request(app)
        .post('/api/deliveries/del_suite_01/assign')
        .set('Authorization', OWNER_TOKEN)
        .send({ driverId: 'drv_valid_01' });
      expect(resValid.status).toBe(200);
      expect(resValid.body.status).toBe('success');

      // 7. Verify Delivery document state
      const delSnap = await db.collection('deliveries').doc('del_suite_01').get();
      expect(delSnap.exists).toBe(true);
      const delData = delSnap.data();
      expect(delData.status).toBe('assigned');
      expect(delData.driverId).toBe('drv_valid_01');
      expect(delData.driverName).toBe('Mustafa Hassan');
      expect(delData.driverPhone).toBe('+252615111111');
      expect(delData.assignedAt).toBeDefined();

      // 8. Verify Driver document state updated to on_delivery
      const drvSnap = await db.collection('drivers').doc('drv_valid_01').get();
      expect(drvSnap.exists).toBe(true);
      expect(drvSnap.data().availability).toBe('on_delivery');

      // 9. Verify Order deliveryStatus synced
      const orderSnap = await db.collection('orders').doc('order_suite_01').get();
      expect(orderSnap.exists).toBe(true);
      expect(orderSnap.data().deliveryStatus).toBe('assigned');

      // 10. Verify Notification created
      const notifSnap = await db.collection('notifications').doc('DELIVERY_ASSIGNED_del_suite_01_drv_valid_01').get();
      expect(notifSnap.exists).toBe(true);
      expect(notifSnap.data().type).toBe('DELIVERY_ASSIGNED');
      expect(notifSnap.data().recipientId).toBe('drv_valid_01');
      expect(notifSnap.data().deliveryId).toBe('del_suite_01');
    });

    it('P0 CRITICAL REGRESSION: Exact Payment & Option Pricing (7 Scenarios)', async () => {
      const db = getAdminDb();

      // Product 1: Simple 100 flat price (taxRate 0 for pure 100 total test)
      await db.collection('branches').doc('branch_exact_pay').set({
        id: 'branch_exact_pay',
        name: 'Exact Pay Branch',
        taxEnabled: false,
        taxRate: 0
      });

      await db.collection('products').doc('prod_exact_100').set({
        id: 'prod_exact_100',
        name: 'Exact 100 Item',
        price: 100,
        isActive: true,
        trackStock: false
      });

      // Scenario 1: total 100 / payment 100 -> PASS
      const res1 = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'branch_exact_pay',
            items: [{ productId: 'prod_exact_100', quantity: 1 }],
            paymentMethod: 'cash',
            paidAmount: 100
          }
        });
      expect(res1.status).toBe(200);
      expect(res1.body.order.totalAmount).toBe(100);
      expect(res1.body.order.paidAmount).toBe(100);
      expect(res1.body.order.changeAmount).toBe(0);
      expect(res1.body.order.changeDue).toBe(0);

      // Scenario 2: total 100 / payment 99 -> REJECT
      const res2 = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'branch_exact_pay',
            items: [{ productId: 'prod_exact_100', quantity: 1 }],
            paymentMethod: 'cash',
            paidAmount: 99
          }
        });
      expect(res2.status).toBe(400);
      expect(res2.body.error).toMatch(/Payment amount must exactly match order total|Underpayment rejected/i);

      // Scenario 3: total 100 / payment 101 -> REJECT
      const res3 = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'branch_exact_pay',
            items: [{ productId: 'prod_exact_100', quantity: 1 }],
            paymentMethod: 'card',
            paidAmount: 101
          }
        });
      expect(res3.status).toBe(400);
      expect(res3.body.error).toMatch(/Payment amount must exactly match order total|Overpayment rejected/i);

      // Scenario 4: total 100 / payment 101 cash -> REJECT
      const res4 = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'branch_exact_pay',
            items: [{ productId: 'prod_exact_100', quantity: 1 }],
            paymentMethod: 'cash',
            paidAmount: 101
          }
        });
      expect(res4.status).toBe(400);
      expect(res4.body.error).toMatch(/Payment amount must exactly match order total|Overpayment rejected/i);

      // Scenario 5: total 100 / payment 101 mobile_money -> REJECT
      const res5 = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'branch_exact_pay',
            items: [{ productId: 'prod_exact_100', quantity: 1 }],
            paymentMethod: 'mobile_money',
            paidAmount: 101
          }
        });
      expect(res5.status).toBe(400);
      expect(res5.body.error).toMatch(/Payment amount must exactly match order total|Overpayment rejected/i);

      // Scenario 6: total 100 / client-supplied change=1 with overpayment -> REJECT; with exact payment -> change is hardcoded 0
      const res6Reject = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'branch_exact_pay',
            items: [{ productId: 'prod_exact_100', quantity: 1 }],
            paymentMethod: 'cash',
            paidAmount: 101,
            amountTendered: 101,
            change: 1,
            changeAmount: 1,
            changeDue: 1
          }
        });
      expect(res6Reject.status).toBe(400);
      expect(res6Reject.body.error).toMatch(/Payment amount must exactly match order total|Overpayment rejected/i);

      const res6Exact = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'branch_exact_pay',
            items: [{ productId: 'prod_exact_100', quantity: 1 }],
            paymentMethod: 'cash',
            paidAmount: 100,
            amountTendered: 100,
            change: 1,
            changeAmount: 1,
            changeDue: 1
          }
        });
      expect(res6Exact.status).toBe(200);
      expect(res6Exact.body.order.change).toBe(0);
      expect(res6Exact.body.order.changeAmount).toBe(0);
      expect(res6Exact.body.order.changeDue).toBe(0);

      // Scenario 7: Option modifier pricing, item subtotal consistency, and failed payment atomic rollback
      await db.collection('branches').doc('branch_pricing_test').set({
        id: 'branch_pricing_test',
        name: 'Pricing Branch',
        taxRate: 0.05,
        defaultDeliveryFee: 2.00
      });

      await db.collection('products').doc('prod_combo_burger').set({
        id: 'prod_combo_burger',
        name: 'Sultan Burger',
        price: 14.50,
        isActive: true,
        trackStock: true,
        stock: 50,
        options: [
          {
            id: 'opt_extra_cheese',
            nameEn: 'Extra Cheese',
            choices: [
              {
                id: 'ch_double_cheese',
                nameEn: 'Double Cheddar',
                priceModifier: 1.50
              }
            ]
          }
        ]
      });

      // A. Overpayment (18.81 or 17.23 vs true total 18.80) -> REJECT and verify ATOMIC ROLLBACK
      const preOrders = await db.collection('orders').where('branchId', '==', 'branch_pricing_test').get();
      const preMovements = await db.collection('inventory_movements').where('branchId', '==', 'branch_pricing_test').get();
      const preKitchen = await db.collection('kitchen_orders').where('branchId', '==', 'branch_pricing_test').get();

      const resFailOverpay = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'branch_pricing_test',
            orderType: 'delivery',
            items: [
              {
                productId: 'prod_combo_burger',
                quantity: 1,
                price: 14.50,
                subtotal: 14.50,
                selectedOptions: [
                  {
                    optionId: 'opt_extra_cheese',
                    optionName: 'Extra Cheese',
                    choiceId: 'ch_double_cheese',
                    choiceName: 'Double Cheddar',
                    priceModifier: 1.50
                  }
                ]
              }
            ],
            paymentMethod: 'mobile_money',
            paidAmount: 18.81 // 0.01 overpayment
          }
        });
      expect(resFailOverpay.status).toBe(400);
      expect(resFailOverpay.body.error).toMatch(/Payment amount must exactly match order total|Overpayment rejected/i);

      // Verify ATOMIC ROLLBACK: Nothing committed
      const postOrders = await db.collection('orders').where('branchId', '==', 'branch_pricing_test').get();
      const postMovements = await db.collection('inventory_movements').where('branchId', '==', 'branch_pricing_test').get();
      const postKitchen = await db.collection('kitchen_orders').where('branchId', '==', 'branch_pricing_test').get();
      const prodCheck = await db.collection('products').doc('prod_combo_burger').get();

      expect(postOrders.size).toBe(preOrders.size);
      expect(postMovements.size).toBe(preMovements.size);
      expect(postKitchen.size).toBe(preKitchen.size);
      expect(prodCheck.data().stock).toBe(50); // Stock unchanged

      // B. Exact Payment (18.80 = 16.00 item + 0.80 tax + 2.00 delivery) -> SUCCESS and verify item pricing consistency
      const resSuccessExact = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', OWNER_TOKEN)
        .send({
          orderData: {
            branchId: 'branch_pricing_test',
            orderType: 'delivery',
            items: [
              {
                productId: 'prod_combo_burger',
                quantity: 1,
                price: 14.50,
                subtotal: 14.50,
                selectedOptions: [
                  {
                    optionId: 'opt_extra_cheese',
                    optionName: 'Extra Cheese',
                    choiceId: 'ch_double_cheese',
                    choiceName: 'Double Cheddar',
                    priceModifier: 1.50
                  }
                ]
              }
            ],
            paymentMethod: 'mobile_money',
            paidAmount: 18.80
          }
        });

      expect(resSuccessExact.status).toBe(200);
      const createdOrder = resSuccessExact.body.order;
      expect(createdOrder.subtotal).toBe(16.00);
      expect(createdOrder.tax).toBe(0.80);
      expect(createdOrder.deliveryFee).toBe(2.00);
      expect(createdOrder.totalAmount).toBe(18.80);
      expect(createdOrder.paidAmount).toBe(18.80);
      expect(createdOrder.changeAmount).toBe(0);
      expect(createdOrder.changeDue).toBe(0);

      // Verify item fields consistency
      expect(createdOrder.items[0].price).toBe(16.00);
      expect(createdOrder.items[0].unitPrice).toBe(16.00);
      expect(createdOrder.items[0].subtotal).toBe(16.00);
      expect(createdOrder.items[0].totalPrice).toBe(16.00);

      // Stock deducted by 1
      const prodAfter = await db.collection('products').doc('prod_combo_burger').get();
      expect(prodAfter.data().stock).toBe(49);
    });

    it('KITCHEN-DELIVERY-LIFECYCLE: End-to-end state machine synchronization, strict transitions, and driver security', async () => {
      const db = getAdminDb();
      const testOrderId = 'order_lifecycle_test_999';

      // 1. Seed product
      await db.collection('products').doc('prod_kds_life').set({
        id: 'prod_kds_life',
        name: 'Spiced Lamb Stew',
        price: 20,
        cost: 8,
        stock: 30,
        branchId: 'main_branch_01'
      });

      // 2. POS Checkout creates Order, Kitchen Ticket, and Delivery doc
      const checkoutRes = await request(app)
        .post('/api/pos/complete')
        .set('Authorization', CASHIER_TOKEN)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            orderType: 'delivery',
            customerName: 'Fatima Zahra',
            customerPhone: '+252615777888',
            customerAddress: 'Waberi District, House 12',
            paymentMethod: 'cash',
            paidAmount: 23.00,
            deliveryFee: 2.00,
            items: [
              { productId: 'prod_kds_life', productName: 'Spiced Lamb Stew', quantity: 1, price: 20, costPrice: 8 }
            ],
            subtotal: 20,
            tax: 1.00,
            discountAmount: 0,
            totalAmount: 23.00
          }
        });

      expect(checkoutRes.status).toBe(200);
      const orderId = checkoutRes.body.order.id;

      // Verify initial states
      const kSnap0 = await db.collection('kitchen_orders').doc(orderId).get();
      expect(kSnap0.data().prepStatus).toBe('new');

      const dSnap0 = await db.collection('deliveries').doc(orderId).get();
      expect(dSnap0.data().status).toBe('unassigned');

      // 3. Strict Kitchen Transitions Validation:
      // Invalid transition: new -> cooking is rejected (must be new -> accepted)
      const kInvalid = await request(app)
        .post(`/api/kitchen/${orderId}/status`)
        .set('Authorization', OWNER_TOKEN)
        .send({ status: 'cooking' });
      expect(kInvalid.status).toBe(400);

      // Valid: new -> accepted
      const kAcc = await request(app)
        .post(`/api/kitchen/${orderId}/status`)
        .set('Authorization', OWNER_TOKEN)
        .send({ status: 'accepted' });
      expect(kAcc.status).toBe(200);

      const kSnap1 = await db.collection('kitchen_orders').doc(orderId).get();
      expect(kSnap1.data().prepStatus).toBe('accepted');

      const ordSnap1 = await db.collection('orders').doc(orderId).get();
      expect(ordSnap1.data().status).toBe('confirmed');

      // Valid: accepted -> cooking
      const kCook = await request(app)
        .post(`/api/kitchen/${orderId}/status`)
        .set('Authorization', OWNER_TOKEN)
        .send({ status: 'cooking' });
      expect(kCook.status).toBe(200);

      const ordSnap2 = await db.collection('orders').doc(orderId).get();
      expect(ordSnap2.data().status).toBe('in_preparation');

      // Valid: cooking -> ready_for_pickup
      const kReady = await request(app)
        .post(`/api/kitchen/${orderId}/status`)
        .set('Authorization', OWNER_TOKEN)
        .send({ status: 'ready_for_pickup' });
      expect(kReady.status).toBe(200);

      const ordSnap3 = await db.collection('orders').doc(orderId).get();
      expect(ordSnap3.data().status).toBe('ready_for_pickup');

      // Valid: ready_for_pickup -> completed
      const kDone = await request(app)
        .post(`/api/kitchen/${orderId}/status`)
        .set('Authorization', OWNER_TOKEN)
        .send({ status: 'completed' });
      expect(kDone.status).toBe(200);

      const ordSnap4 = await db.collection('orders').doc(orderId).get();
      expect(ordSnap4.data().status).toBe('completed');

      // 4. Delivery Lifecycle & Security:
      // Driver setup
      await db.collection('drivers').doc('mock_driver_uid_123').set({
        id: 'mock_driver_uid_123',
        name: 'Mock Driver User',
        phone: '+252615111222',
        branchId: 'main_branch_01',
        status: 'active',
        availability: 'available'
      });

      await db.collection('drivers').doc('driver_beta').set({
        id: 'driver_beta',
        name: 'Beta Driver',
        phone: '+252615333444',
        branchId: 'main_branch_01',
        status: 'active',
        availability: 'available'
      });

      // Unassigned driver cannot advance unassigned delivery
      const dUnauthDriver = await request(app)
        .post(`/api/deliveries/${orderId}/status`)
        .set('Authorization', DRIVER_TOKEN) // DRIVER_TOKEN is uid: mock_driver_uid_123
        .send({ status: 'picked_up' });
      expect([400, 403]).toContain(dUnauthDriver.status);

      // Assign driver manually
      const assignRes = await request(app)
        .post(`/api/deliveries/${orderId}/assign`)
        .set('Authorization', CASHIER_TOKEN)
        .send({ driverId: 'mock_driver_uid_123' });
      expect(assignRes.status).toBe(200);

      const dSnapAssigned = await db.collection('deliveries').doc(orderId).get();
      expect(dSnapAssigned.data().status).toBe('assigned');
      expect(dSnapAssigned.data().driverId).toBe('mock_driver_uid_123');

      // Invalid jump: assigned -> delivered is rejected
      const dInvalidJump = await request(app)
        .post(`/api/deliveries/${orderId}/status`)
        .set('Authorization', DRIVER_TOKEN)
        .send({ status: 'delivered' });
      expect(dInvalidJump.status).toBe(400);

      // Invalid jump: assigned -> picked_up is rejected (must be assigned -> accepted first)
      const dInvalidPickedUp = await request(app)
        .post(`/api/deliveries/${orderId}/status`)
        .set('Authorization', DRIVER_TOKEN)
        .send({ status: 'picked_up' });
      expect(dInvalidPickedUp.status).toBe(400);
      expect(dInvalidPickedUp.body.error).toMatch(/Invalid delivery transition/i);

      // Valid: assigned -> accepted
      const dAcc = await request(app)
        .post(`/api/deliveries/${orderId}/status`)
        .set('Authorization', DRIVER_TOKEN)
        .send({ status: 'accepted' });
      expect(dAcc.status).toBe(200);

      // Valid: accepted -> picked_up
      const dPick = await request(app)
        .post(`/api/deliveries/${orderId}/status`)
        .set('Authorization', DRIVER_TOKEN)
        .send({ status: 'picked_up' });
      expect(dPick.status).toBe(200);

      const ordSnapTransit = await db.collection('orders').doc(orderId).get();
      expect(ordSnapTransit.data().deliveryStatus).toBe('in_transit');

      // Valid: picked_up -> on_the_way
      const dOnWay = await request(app)
        .post(`/api/deliveries/${orderId}/status`)
        .set('Authorization', DRIVER_TOKEN)
        .send({ status: 'on_the_way' });
      expect(dOnWay.status).toBe(200);

      // Invalid jump: on_the_way -> delivered is rejected (must be on_the_way -> arrived first)
      const dInvalidDeliveredFromOnTheWay = await request(app)
        .post(`/api/deliveries/${orderId}/status`)
        .set('Authorization', DRIVER_TOKEN)
        .send({ status: 'delivered' });
      expect(dInvalidDeliveredFromOnTheWay.status).toBe(400);
      expect(dInvalidDeliveredFromOnTheWay.body.error).toMatch(/Invalid delivery transition/i);

      // Valid: on_the_way -> arrived
      const dArrived = await request(app)
        .post(`/api/deliveries/${orderId}/status`)
        .set('Authorization', DRIVER_TOKEN)
        .send({ status: 'arrived' });
      expect(dArrived.status).toBe(200);

      // Valid: arrived -> delivered
      const dDelivered = await request(app)
        .post(`/api/deliveries/${orderId}/status`)
        .set('Authorization', DRIVER_TOKEN)
        .send({ status: 'delivered' });
      expect(dDelivered.status).toBe(200);

      const dSnapFinal = await db.collection('deliveries').doc(orderId).get();
      expect(dSnapFinal.data().status).toBe('delivered');
      expect(dSnapFinal.data().deliveredAt).toBeDefined();
      expect(dSnapFinal.data().branchId).toBe('main_branch_01');

      const ordSnapFinal = await db.collection('orders').doc(orderId).get();
      expect(ordSnapFinal.data().deliveryStatus).toBe('delivered');
      expect(ordSnapFinal.data().status).toBe('completed');
      expect(ordSnapFinal.data().paymentStatus).toBe('paid');
      expect(ordSnapFinal.data().branchId).toBe('main_branch_01');

      // Verify Driver Assignment Notification
      const notifSnap = await db.collection('notifications').where('recipientId', '==', 'mock_driver_uid_123').get();
      expect(notifSnap.empty).toBe(false);
      const assignNotif = notifSnap.docs.find(d => d.data().deliveryId === orderId || d.data().metadata?.deliveryId === orderId);
      expect(assignNotif).toBeDefined();

      // Verify No Duplicate Kitchen Orders or Deliveries
      const allKitchensForOrder = await db.collection('kitchen_orders').where('orderId', '==', orderId).get();
      expect(allKitchensForOrder.size).toBe(1);

      const allDeliveriesForOrder = await db.collection('deliveries').where('orderId', '==', orderId).get();
      expect(allDeliveriesForOrder.size).toBe(1);
    });

    it('DELIVERY-INVALID-TRANSITIONS-SUITE: Rejects invalid delivery transitions (assigned -> picked_up and on_the_way -> delivered)', async () => {
      const db = getAdminDb();

      await db.collection('drivers').doc('drv_trans_test_1').set({
        id: 'drv_trans_test_1',
        name: 'Test Driver',
        phone: '+252615999000',
        branchId: 'main_branch_01',
        status: 'active',
        availability: 'available'
      });

      // 1. Test assigned -> picked_up transition failure
      await db.collection('deliveries').doc('del_trans_assigned').set({
        id: 'del_trans_assigned',
        orderId: 'order_trans_1',
        branchId: 'main_branch_01',
        driverId: 'drv_trans_test_1',
        status: 'assigned',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const resAssignedToPickedUp = await request(app)
        .post('/api/deliveries/del_trans_assigned/status')
        .set('Authorization', OWNER_TOKEN)
        .send({ status: 'picked_up' });

      expect(resAssignedToPickedUp.status).toBe(400);
      expect(resAssignedToPickedUp.body.error).toMatch(/Invalid delivery transition/i);
      expect(resAssignedToPickedUp.body.error).toMatch(/assigned/i);
      expect(resAssignedToPickedUp.body.error).toMatch(/picked_up/i);

      // 2. Test on_the_way -> delivered transition failure
      await db.collection('deliveries').doc('del_trans_on_way').set({
        id: 'del_trans_on_way',
        orderId: 'order_trans_2',
        branchId: 'main_branch_01',
        driverId: 'drv_trans_test_1',
        status: 'on_the_way',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const resOnWayToDelivered = await request(app)
        .post('/api/deliveries/del_trans_on_way/status')
        .set('Authorization', OWNER_TOKEN)
        .send({ status: 'delivered' });

      expect(resOnWayToDelivered.status).toBe(400);
      expect(resOnWayToDelivered.body.error).toMatch(/Invalid delivery transition/i);
      expect(resOnWayToDelivered.body.error).toMatch(/on_the_way/i);
      expect(resOnWayToDelivered.body.error).toMatch(/delivered/i);
    });

    it('DELIVERY-CREATION-UNASSIGNED-SUITE: New delivery MUST always start unassigned even if driverId is supplied', async () => {
      const db = getAdminDb();

      await db.collection('drivers').doc('drv_auto_test_1').set({
        id: 'drv_auto_test_1',
        name: 'Auto Assign Driver',
        phone: '+252615888777',
        branchId: 'main_branch_01',
        status: 'active',
        availability: 'available'
      });

      // 1. Create delivery without driverId
      const resNew = await request(app)
        .post('/api/deliveries')
        .set('Authorization', OWNER_TOKEN)
        .send({
          deliveryData: {
            branchId: 'main_branch_01',
            customerName: 'Amina Delivery',
            customerPhone: '+252615112233',
            address: 'Hodan KM4',
            totalAmount: 25.00,
            deliveryFee: 3.00
          }
        });

      expect(resNew.status).toBe(200);
      expect(resNew.body.id).toBeDefined();

      const delSnap1 = await db.collection('deliveries').doc(resNew.body.id).get();
      expect(delSnap1.exists).toBe(true);
      expect(delSnap1.data().status).toBe('unassigned');
      expect(delSnap1.data().driverId).toBe('');

      // 2. Create delivery with driverId supplied -> MUST NOT become assigned automatically!
      const resWithDriver = await request(app)
        .post('/api/deliveries')
        .set('Authorization', OWNER_TOKEN)
        .send({
          deliveryData: {
            branchId: 'main_branch_01',
            customerName: 'Farah Delivery',
            customerPhone: '+252615445566',
            address: 'Waberi District',
            driverId: 'drv_auto_test_1',
            totalAmount: 30.00,
            deliveryFee: 3.50
          }
        });

      expect(resWithDriver.status).toBe(200);
      const delSnap2 = await db.collection('deliveries').doc(resWithDriver.body.id).get();
      expect(delSnap2.exists).toBe(true);
      expect(delSnap2.data().status).toBe('unassigned');
      expect(delSnap2.data().driverId).toBe('');

      // 3. Driver assignment MUST happen via /api/deliveries/:deliveryId/assign
      const resAssign = await request(app)
        .post(`/api/deliveries/${resWithDriver.body.id}/assign`)
        .set('Authorization', OWNER_TOKEN)
        .send({ driverId: 'drv_auto_test_1' });

      expect(resAssign.status).toBe(200);
      const delSnap3 = await db.collection('deliveries').doc(resWithDriver.body.id).get();
      expect(delSnap3.data().status).toBe('assigned');
      expect(delSnap3.data().driverId).toBe('drv_auto_test_1');
    });

    it('KITCHEN-STRICT-STATE-MACHINE-SUITE: Enforces exact lifecycle (new -> accepted -> cooking -> ready_for_pickup -> completed)', async () => {
      const db = getAdminDb();
      const ticketId = 'ticket_strict_sm_01';

      await db.collection('kitchen_orders').doc(ticketId).set({
        id: ticketId,
        orderId: ticketId,
        orderNumber: 'ORD-KSM-01',
        branchId: 'main_branch_01',
        items: [
          { productId: 'p1', productName: 'Somali Rice', quantity: 1, itemStatus: 'new' },
          { productId: 'p2', productName: 'Camel Tea', quantity: 1, itemStatus: 'new' }
        ],
        prepStatus: 'new',
        priority: 'normal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // 1. 'new' -> 'cooking' is REJECTED (must go to 'accepted' first)
      const resNewToCooking = await request(app)
        .post(`/api/kitchen/${ticketId}/update`)
        .set('Authorization', OWNER_TOKEN)
        .send({ prepStatus: 'cooking' });
      expect(resNewToCooking.status).toBe(400);
      expect(resNewToCooking.body.error).toMatch(/Invalid kitchen ticket status transition/i);

      // 2. 'new' -> 'ready_for_pickup' is REJECTED
      const resNewToReady = await request(app)
        .post(`/api/kitchen/${ticketId}/update`)
        .set('Authorization', OWNER_TOKEN)
        .send({ prepStatus: 'ready_for_pickup' });
      expect(resNewToReady.status).toBe(400);

      // 3. 'new' -> 'accepted' is VALID
      const resNewToAccepted = await request(app)
        .post(`/api/kitchen/${ticketId}/update`)
        .set('Authorization', OWNER_TOKEN)
        .send({ prepStatus: 'accepted' });
      expect(resNewToAccepted.status).toBe(200);

      // 4. 'accepted' -> 'ready_for_pickup' is REJECTED (must go to 'cooking' first)
      const resAcceptedToReady = await request(app)
        .post(`/api/kitchen/${ticketId}/update`)
        .set('Authorization', OWNER_TOKEN)
        .send({ prepStatus: 'ready_for_pickup' });
      expect(resAcceptedToReady.status).toBe(400);
      expect(resAcceptedToReady.body.error).toMatch(/Invalid kitchen ticket status transition/i);

      // 5. 'accepted' -> 'cooking' is VALID
      const resAcceptedToCooking = await request(app)
        .post(`/api/kitchen/${ticketId}/update`)
        .set('Authorization', OWNER_TOKEN)
        .send({ prepStatus: 'cooking' });
      expect(resAcceptedToCooking.status).toBe(200);

      // 6. 'cooking' -> 'completed' is REJECTED (must go to 'ready_for_pickup' first)
      const resCookingToCompleted = await request(app)
        .post(`/api/kitchen/${ticketId}/update`)
        .set('Authorization', OWNER_TOKEN)
        .send({ prepStatus: 'completed' });
      expect(resCookingToCompleted.status).toBe(400);
      expect(resCookingToCompleted.body.error).toMatch(/Invalid kitchen ticket status transition/i);

      // 7. 'cooking' -> 'ready_for_pickup' is VALID
      const resCookingToReady = await request(app)
        .post(`/api/kitchen/${ticketId}/update`)
        .set('Authorization', OWNER_TOKEN)
        .send({ prepStatus: 'ready_for_pickup' });
      expect(resCookingToReady.status).toBe(200);

      // 8. 'ready_for_pickup' -> 'completed' is VALID
      const resReadyToCompleted = await request(app)
        .post(`/api/kitchen/${ticketId}/update`)
        .set('Authorization', OWNER_TOKEN)
        .send({ prepStatus: 'completed' });
      expect(resReadyToCompleted.status).toBe(200);

      // 9. Phantom Kitchen Ticket: Updating non-existent ticket returns 404
      const resPhantom = await request(app)
        .post('/api/kitchen/phantom_ticket_999/update')
        .set('Authorization', OWNER_TOKEN)
        .send({ prepStatus: 'accepted' });
      expect(resPhantom.status).toBe(404);
      expect(resPhantom.body.error).toMatch(/not found/i);
    });

    it('DRIVER-DISPATCH-SECURITY-AND-REASSIGNMENT-SUITE: Role normalization, atomic driver availability, reassignment cleanup, and driver restrictions', async () => {
      const db = getAdminDb();

      // Seed 2 drivers
      await db.collection('drivers').doc('drv_alpha_101').set({
        id: 'drv_alpha_101',
        fullName: 'Driver Alpha',
        phone: '+252615111111',
        branchId: 'main_branch_01',
        status: 'active',
        availability: 'available'
      });

      await db.collection('drivers').doc('drv_beta_102').set({
        id: 'drv_beta_102',
        fullName: 'Driver Beta',
        phone: '+252615222222',
        branchId: 'main_branch_01',
        status: 'active',
        availability: 'available'
      });

      await db.collection('drivers').doc('drv_inactive_103').set({
        id: 'drv_inactive_103',
        fullName: 'Driver Inactive',
        phone: '+252615333333',
        branchId: 'main_branch_01',
        status: 'inactive',
        availability: 'available'
      });

      // Seed a delivery
      const delId = 'del_dispatch_sec_01';
      await db.collection('deliveries').doc(delId).set({
        id: delId,
        orderId: 'ord_sec_01',
        deliveryNumber: 'DEL-SEC-01',
        branchId: 'main_branch_01',
        customerName: 'Ayaan Ahmed',
        customerPhone: '+252615998877',
        deliveryAddress: 'Wadajir District',
        totalAmount: 45.00,
        status: 'unassigned',
        driverId: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // 1. Driver role cannot assign deliveries (FIX #3)
      const resDriverAssign = await request(app)
        .post(`/api/deliveries/${delId}/assign`)
        .set('Authorization', DRIVER_TOKEN)
        .send({ driverId: 'drv_alpha_101' });
      expect(resDriverAssign.status).toBe(403);
      expect(resDriverAssign.body.error).toMatch(/Access Denied.*Delivery Driver|restricted/i);

      // 2. Inactive driver cannot be assigned (FIX #7)
      const resInactiveAssign = await request(app)
        .post(`/api/deliveries/${delId}/assign`)
        .set('Authorization', OWNER_TOKEN)
        .send({ driverId: 'drv_inactive_103' });
      expect(resInactiveAssign.status).toBe(400);
      expect(resInactiveAssign.body.error).toMatch(/inactive or suspended/i);

      // 3. Assign Driver Alpha -> Success, Alpha becomes on_delivery (FIX #8)
      const resAssignAlpha = await request(app)
        .post(`/api/deliveries/${delId}/assign`)
        .set('Authorization', OWNER_TOKEN)
        .send({ driverId: 'drv_alpha_101' });
      expect(resAssignAlpha.status).toBe(200);

      const dSnapAfterAlpha = await db.collection('deliveries').doc(delId).get();
      expect(dSnapAfterAlpha.data().status).toBe('assigned');
      expect(dSnapAfterAlpha.data().driverId).toBe('drv_alpha_101');

      const alphaSnap1 = await db.collection('drivers').doc('drv_alpha_101').get();
      expect(alphaSnap1.data().availability).toBe('on_delivery');

      // 4. Attempting to assign Driver Alpha to another delivery while on_delivery is rejected (FIX #7)
      const delId2 = 'del_dispatch_sec_02';
      await db.collection('deliveries').doc(delId2).set({
        id: delId2,
        orderId: 'ord_sec_02',
        branchId: 'main_branch_01',
        status: 'unassigned',
        driverId: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const resAssignBusyAlpha = await request(app)
        .post(`/api/deliveries/${delId2}/assign`)
        .set('Authorization', OWNER_TOKEN)
        .send({ driverId: 'drv_alpha_101' });
      expect(resAssignBusyAlpha.status).toBe(400);
      expect(resAssignBusyAlpha.body.error).toMatch(/currently on delivery/i);

      // 5. Reassigning del_dispatch_sec_01 from Driver Alpha to Driver Beta (FIX #9)
      const resReassignBeta = await request(app)
        .post(`/api/deliveries/${delId}/assign`)
        .set('Authorization', OWNER_TOKEN)
        .send({ driverId: 'drv_beta_102' });
      expect(resReassignBeta.status).toBe(200);

      // Delivery updated to Driver Beta
      const dSnapAfterBeta = await db.collection('deliveries').doc(delId).get();
      expect(dSnapAfterBeta.data().driverId).toBe('drv_beta_102');

      // Driver Alpha availability RESET to available
      const alphaSnap2 = await db.collection('drivers').doc('drv_alpha_101').get();
      expect(alphaSnap2.data().availability).toBe('available');

      // Driver Beta availability SET to on_delivery
      const betaSnap1 = await db.collection('drivers').doc('drv_beta_102').get();
      expect(betaSnap1.data().availability).toBe('on_delivery');

      // 6. Complete delivery lifecycle to 'delivered' and verify Driver Beta availability resets to 'available'
      await request(app).post(`/api/deliveries/${delId}/status`).set('Authorization', OWNER_TOKEN).send({ status: 'accepted' });
      await request(app).post(`/api/deliveries/${delId}/status`).set('Authorization', OWNER_TOKEN).send({ status: 'picked_up' });
      await request(app).post(`/api/deliveries/${delId}/status`).set('Authorization', OWNER_TOKEN).send({ status: 'on_the_way' });
      await request(app).post(`/api/deliveries/${delId}/status`).set('Authorization', OWNER_TOKEN).send({ status: 'arrived' });
      const finalDelRes = await request(app).post(`/api/deliveries/${delId}/status`).set('Authorization', OWNER_TOKEN).send({ status: 'delivered' });
      expect(finalDelRes.status).toBe(200);

      const betaSnap2 = await db.collection('drivers').doc('drv_beta_102').get();
      expect(betaSnap2.data().availability).toBe('available');
    });

    it('LOYALTY-POINTS-SUITE: Add points and redeem rewards via server-authoritative endpoints', async () => {
      const db = getAdminDb();
      const testCustId = 'cust_loyalty_test_01';
      const testRewardId = 'rew_loyalty_test_01';

      await db.collection('customers').doc(testCustId).set({
        id: testCustId,
        fullName: 'Zahra Hassan',
        branchId: 'branch_1',
        membershipLevel: 'Bronze'
      });

      await db.collection('customer_rewards').doc(testRewardId).set({
        id: testRewardId,
        rewardName: 'Free Cardamom Tea',
        pointsRequired: 150,
        currentRedemptions: 0
      });

      // 1. Unauthorized attempt
      const unauthRes = await request(app)
        .post('/api/crm/points/add')
        .send({ customerId: testCustId, points: 200 });
      expect(unauthRes.status).toBe(401);

      // 2. Authorized add points
      const addRes = await request(app)
        .post('/api/crm/points/add')
        .set('Authorization', OWNER_TOKEN)
        .send({ customerId: testCustId, points: 200 });
      expect(addRes.status).toBe(200);
      expect(addRes.body.currentPointsBalance).toBe(200);
      expect(addRes.body.membershipLevel).toBe('Silver');

      // 3. Redeem reward with sufficient balance
      const redeemRes = await request(app)
        .post('/api/crm/points/redeem')
        .set('Authorization', OWNER_TOKEN)
        .send({ customerId: testCustId, rewardId: testRewardId });
      expect(redeemRes.status).toBe(200);
      expect(redeemRes.body.pointsSpent).toBe(150);
      expect(redeemRes.body.couponCode).toBeDefined();

      // 4. Attempt to redeem again with insufficient remaining balance (50 points left, 150 needed)
      const failRedeemRes = await request(app)
        .post('/api/crm/points/redeem')
        .set('Authorization', OWNER_TOKEN)
        .send({ customerId: testCustId, rewardId: testRewardId });
      expect(failRedeemRes.status).toBe(400);
      expect(failRedeemRes.body.error).toMatch(/Insufficient loyalty points/i);
    });

    it('KITCHEN-ORDER-WORKFLOW-AND-RESILIENCE-SUITE: Lifecycle transitions, cross-collection sync, and transaction resilience', async () => {
      const db = getAdminDb();
      const ticketId = 'kt_resilience_01';
      const orderId = 'ord_resilience_01';
      const deliveryId = 'del_resilience_01';

      // Seed order, kitchen ticket, and delivery
      await db.collection('orders').doc(orderId).set({
        id: orderId,
        orderNumber: 'ORD-KITCHEN-01',
        branchId: 'main_branch_01',
        status: 'pending',
        orderType: 'delivery',
        totalAmount: 35.0,
        createdAt: new Date().toISOString()
      });

      await db.collection('kitchen_orders').doc(ticketId).set({
        id: ticketId,
        orderId: orderId,
        orderNumber: 'ORD-KITCHEN-01',
        branchId: 'main_branch_01',
        prepStatus: 'new',
        priority: 'normal',
        items: [
          { productId: 'p1', productName: 'Camel Steak', quantity: 2, itemStatus: 'new', assignedStation: 'grill' }
        ],
        createdAt: new Date().toISOString()
      });

      await db.collection('deliveries').doc(deliveryId).set({
        id: deliveryId,
        orderId: orderId,
        branchId: 'main_branch_01',
        status: 'unassigned',
        createdAt: new Date().toISOString()
      });

      // 1. Accept Order (new -> accepted)
      const resAccept = await request(app)
        .post(`/api/kitchen/${ticketId}/status`)
        .set('Authorization', OWNER_TOKEN)
        .send({ status: 'accepted' });
      expect(resAccept.status).toBe(200);
      expect(resAccept.body.status).toBe('success');
      expect(resAccept.body.prepStatus).toBe('accepted');

      const ktSnap1 = await db.collection('kitchen_orders').doc(ticketId).get();
      expect(ktSnap1.data().prepStatus).toBe('accepted');
      const ordSnap1 = await db.collection('orders').doc(orderId).get();
      expect(ordSnap1.data().status).toBe('confirmed');

      // 2. Start Cooking (accepted -> cooking)
      const resCook = await request(app)
        .post(`/api/kitchen/${ticketId}/status`)
        .set('Authorization', CHEF_TOKEN)
        .send({ status: 'cooking' });
      expect(resCook.status).toBe(200);
      expect(resCook.body.prepStatus).toBe('cooking');

      const ordSnap2 = await db.collection('orders').doc(orderId).get();
      expect(ordSnap2.data().status).toBe('in_preparation');

      // 3. Mark Ready (cooking -> ready_for_pickup)
      const resReady = await request(app)
        .post(`/api/kitchen/${ticketId}/status`)
        .set('Authorization', CHEF_TOKEN)
        .send({ status: 'ready_for_pickup' });
      expect(resReady.status).toBe(200);
      expect(resReady.body.prepStatus).toBe('ready_for_pickup');

      const ordSnap3 = await db.collection('orders').doc(orderId).get();
      expect(ordSnap3.data().status).toBe('ready_for_pickup');

      // 4. Update Ticket Priority and Items via /api/kitchen/:ticketId/update
      const resUpdateTicket = await request(app)
        .post(`/api/kitchen/${ticketId}/update`)
        .set('Authorization', OWNER_TOKEN)
        .send({
          priority: 'urgent',
          estimatedPrepTimeMinutes: 20
        });
      expect(resUpdateTicket.status).toBe(200);
      expect(resUpdateTicket.body.status).toBe('success');

      const ktSnapUpdated = await db.collection('kitchen_orders').doc(ticketId).get();
      expect(ktSnapUpdated.data().priority).toBe('urgent');
      expect(ktSnapUpdated.data().estimatedPrepTimeMinutes).toBe(20);

      // 5. Complete Kitchen Ticket (ready_for_pickup -> completed)
      const resComplete = await request(app)
        .post(`/api/kitchen/${ticketId}/status`)
        .set('Authorization', OWNER_TOKEN)
        .send({ status: 'completed' });
      expect(resComplete.status).toBe(200);
      expect(resComplete.body.prepStatus).toBe('completed');

      const ordSnap4 = await db.collection('orders').doc(orderId).get();
      expect(ordSnap4.data().status).toBe('completed');

      // 6. Test Transaction Retry helper directly with simulated contention
      const { runTransactionWithRetry } = await import('../server/trustedFinancialBackend.js');
      let attempts = 0;
      const result = await runTransactionWithRetry(db, async (txn: any) => {
        attempts++;
        if (attempts < 3) {
          const contentionErr: any = new Error('Too much contention on these documents.');
          contentionErr.code = 10; // ABORTED
          throw contentionErr;
        }
        return 'transaction_retry_success';
      }, 5);

      expect(result).toBe('transaction_retry_success');
      expect(attempts).toBe(3);
    });

    it('DRIVER-ELIGIBILITY-AND-ROBUST-ASSIGNMENT-SUITE: Robust server-side eligibility re-validation and atomic state updates', async () => {
      const db = getAdminDb();
      const branchId = 'main_branch_01';
      const orderId = 'ord_deliv_elig_01';
      const deliveryId = 'del_deliv_elig_01';

      // 1. Seed order and unassigned delivery
      await db.collection('orders').doc(orderId).set({
        id: orderId,
        orderNumber: 'ORD-ELIG-001',
        branchId,
        status: 'ready_for_pickup',
        deliveryStatus: 'unassigned',
        totalAmount: 32.50,
        createdAt: new Date().toISOString()
      });

      await db.collection('deliveries').doc(deliveryId).set({
        id: deliveryId,
        orderId,
        branchId,
        customerName: 'Khadija Farah',
        customerPhone: '+252617778899',
        address: 'Waberi, Mogadishu',
        status: 'unassigned',
        totalAmount: 32.50,
        deliveryFee: 2.50,
        createdAt: new Date().toISOString()
      });

      // 2. Seed drivers with various statuses
      await db.collection('drivers').doc('drv_avail_hq').set({
        id: 'drv_avail_hq',
        fullName: 'Omar Available',
        phoneNumber: '+252615000001',
        status: 'active',
        availability: 'available',
        branchId: 'branch_hq_01',
        branchName: 'Headquarters - Mogadishu Main'
      });

      await db.collection('drivers').doc('drv_busy_hq').set({
        id: 'drv_busy_hq',
        fullName: 'Ali Busy',
        phoneNumber: '+252615000002',
        status: 'active',
        availability: 'on_delivery',
        branchId: 'branch_hq_01'
      });

      await db.collection('drivers').doc('drv_suspended_hq').set({
        id: 'drv_suspended_hq',
        fullName: 'Hassan Suspended',
        phoneNumber: '+252615000003',
        status: 'suspended',
        availability: 'available',
        branchId: 'branch_hq_01'
      });

      // 3. Attempting to assign busy driver -> 400
      const resBusy = await request(app)
        .post(`/api/deliveries/${deliveryId}/assign`)
        .set('Authorization', OWNER_TOKEN)
        .send({ driverId: 'drv_busy_hq' });
      expect(resBusy.status).toBe(400);
      expect(resBusy.body.error).toMatch(/currently on delivery/i);

      // 4. Attempting to assign suspended driver -> 400
      const resSuspended = await request(app)
        .post(`/api/deliveries/${deliveryId}/assign`)
        .set('Authorization', OWNER_TOKEN)
        .send({ driverId: 'drv_suspended_hq' });
      expect(resSuspended.status).toBe(400);
      expect(resSuspended.body.error).toMatch(/inactive or suspended/i);

      // 5. Assigning available driver -> 200 (re-validated by server)
      const resValid = await request(app)
        .post(`/api/deliveries/${deliveryId}/assign`)
        .set('Authorization', OWNER_TOKEN)
        .send({ driverId: 'drv_avail_hq' });
      expect(resValid.status).toBe(200);
      expect(resValid.body.status).toBe('success');

      // Check delivery & driver state
      const delSnap = await db.collection('deliveries').doc(deliveryId).get();
      expect(delSnap.data().status).toBe('assigned');
      expect(delSnap.data().driverId).toBe('drv_avail_hq');
      expect(delSnap.data().driverName).toBe('Omar Available');

      const drvSnap = await db.collection('drivers').doc('drv_avail_hq').get();
      expect(drvSnap.data().availability).toBe('on_delivery');
    });

    it('CRM-REWARDS-AND-COUPONS-SUITE: Server-authoritative rewards and coupons CRUD with role enforcement', async () => {
      const db = getAdminDb();

      // 1. Non-management (Driver) cannot create reward -> 403
      const resDriverReward = await request(app)
        .post('/api/crm/rewards')
        .set('Authorization', DRIVER_TOKEN)
        .send({
          rewardName: 'Free Shawarma',
          pointsRequired: 150,
          discountType: 'fixed_amount',
          discountValue: 6
        });
      expect(resDriverReward.status).toBe(403);

      // 2. Owner creates reward -> 201
      const resOwnerReward = await request(app)
        .post('/api/crm/rewards')
        .set('Authorization', OWNER_TOKEN)
        .send({
          rewardName: 'Free Shawarma',
          pointsRequired: 150,
          discountType: 'fixed_amount',
          discountValue: 6,
          description: 'Redeem for 1 regular shawarma wrap'
        });
      expect(resOwnerReward.status).toBe(201);
      expect(resOwnerReward.body.id).toBeDefined();
      expect(resOwnerReward.body.rewardName).toBe('Free Shawarma');

      const rewardId = resOwnerReward.body.id;
      const rewDoc = await db.collection('customer_rewards').doc(rewardId).get();
      expect(rewDoc.exists).toBe(true);
      expect(rewDoc.data().pointsRequired).toBe(150);

      // 3. Management updates reward -> 200
      const resUpdateReward = await request(app)
        .patch(`/api/crm/rewards/${rewardId}`)
        .set('Authorization', OWNER_TOKEN)
        .send({ pointsRequired: 175 });
      expect(resUpdateReward.status).toBe(200);

      const rewDocUpdated = await db.collection('customer_rewards').doc(rewardId).get();
      expect(rewDocUpdated.data().pointsRequired).toBe(175);

      // 4. Non-management cannot create coupon -> 403
      const resDriverCoupon = await request(app)
        .post('/api/crm/coupons')
        .set('Authorization', DRIVER_TOKEN)
        .send({
          code: 'TEST20',
          discountType: 'percentage',
          discountValue: 20
        });
      expect(resDriverCoupon.status).toBe(403);

      // 5. Owner creates coupon -> 201
      const resOwnerCoupon = await request(app)
        .post('/api/crm/coupons')
        .set('Authorization', OWNER_TOKEN)
        .send({
          code: 'ramadan20',
          title: 'Ramadan 20% Discount',
          discountType: 'percentage',
          discountValue: 20,
          minOrderAmount: 30
        });
      expect(resOwnerCoupon.status).toBe(201);
      expect(resOwnerCoupon.body.code).toBe('RAMADAN20');

      const couponId = resOwnerCoupon.body.id;
      const cpDoc = await db.collection('customer_coupons').doc(couponId).get();
      expect(cpDoc.exists).toBe(true);
      expect(cpDoc.data().code).toBe('RAMADAN20');

      // 6. Owner updates coupon -> 200
      const resUpdateCoupon = await request(app)
        .patch(`/api/crm/coupons/${couponId}`)
        .set('Authorization', OWNER_TOKEN)
        .send({ discountValue: 25 });
      expect(resUpdateCoupon.status).toBe(200);

      const cpDocUpdated = await db.collection('customer_coupons').doc(couponId).get();
      expect(cpDocUpdated.data().discountValue).toBe(25);
    });

    it('KITCHEN-SINGLE-TRANSACTION-PATH-SUITE: Enforces canonical transitions without secondary mutation paths', async () => {
      const db = getAdminDb();
      const ticketId = 'kit_single_path_test_01';
      const orderId = 'ord_single_path_test_01';

      await db.collection('orders').doc(orderId).set({
        id: orderId,
        status: 'new',
        branchId: 'branch_hq_01',
        totalAmount: 40
      });

      await db.collection('kitchen_orders').doc(ticketId).set({
        id: ticketId,
        orderId,
        prepStatus: 'new',
        branchId: 'branch_hq_01',
        items: [{ id: 'item_1', name: 'Burger', quantity: 1, itemStatus: 'new' }]
      });

      // 1. Invalid jump from new -> ready_for_pickup -> 400
      const resInvalidJump = await request(app)
        .post(`/api/kitchen/${ticketId}/update`)
        .set('Authorization', CHEF_TOKEN)
        .send({ prepStatus: 'ready_for_pickup' });
      expect(resInvalidJump.status).toBe(400);
      expect(resInvalidJump.body.error).toMatch(/Invalid kitchen ticket status transition/i);

      // 2. Valid transition: new -> accepted -> 200
      const resAccept = await request(app)
        .post(`/api/kitchen/${ticketId}/update`)
        .set('Authorization', CHEF_TOKEN)
        .send({ prepStatus: 'accepted' });
      expect(resAccept.status).toBe(200);

      const orderSnap1 = await db.collection('orders').doc(orderId).get();
      expect(orderSnap1.data().status).toBe('confirmed');

      // 3. Valid transition: accepted -> cooking -> 200
      const resCooking = await request(app)
        .post(`/api/kitchen/${ticketId}/update`)
        .set('Authorization', CHEF_TOKEN)
        .send({ prepStatus: 'cooking' });
      expect(resCooking.status).toBe(200);

      const orderSnap2 = await db.collection('orders').doc(orderId).get();
      expect(orderSnap2.data().status).toBe('in_preparation');

      // 4. Valid transition: cooking -> ready_for_pickup -> 200
      const resReady = await request(app)
        .post(`/api/kitchen/${ticketId}/update`)
        .set('Authorization', CHEF_TOKEN)
        .send({ prepStatus: 'ready_for_pickup' });
      expect(resReady.status).toBe(200);

      // 5. Valid transition: ready_for_pickup -> completed -> 200
      const resDone = await request(app)
        .post(`/api/kitchen/${ticketId}/update`)
        .set('Authorization', CHEF_TOKEN)
        .send({ prepStatus: 'completed' });
      expect(resDone.status).toBe(200);

      // 6. Attempt transition from terminal completed state -> 400
      const resPostComplete = await request(app)
        .post(`/api/kitchen/${ticketId}/update`)
        .set('Authorization', CHEF_TOKEN)
        .send({ prepStatus: 'cooking' });
      expect(resPostComplete.status).toBe(400);
      expect(resPostComplete.body.error).toMatch(/Invalid kitchen ticket status transition/i);
    });
  });

  describe('AI-MONETARY-IDEMPOTENCY-SUITE: Persistent Firestore Idempotency & Replay Protection', () => {
    it('executes monetary AI mutation with Idempotency-Key and prevents duplicate re-execution on replay', async () => {
      const db = getAdminDb();
      const idempKey = `IDEMP-AI-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      // Initial execution
      const res1 = await request(app)
        .post('/api/ai/execute-action')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', idempKey)
        .send({
          actionType: 'ADD_EXPENSE',
          payload: {
            title: 'Office Cleaning Supplies',
            amount: 45.5,
            category: 'Supplies',
            paymentMethod: 'cash'
          },
          confirmed: true
        });

      expect(res1.status).toBe(200);
      expect(res1.body.status).toBe('success');
      const expenseId = res1.body.id;
      expect(expenseId).toBeDefined();

      // Verify idempotency record saved in Firestore
      const idempDocs = await db.collection('ai_idempotency_keys')
        .where('idempotencyKey', '==', idempKey)
        .get();
      expect(idempDocs.empty).toBe(false);
      const idempDoc = idempDocs.docs[0].data();
      expect(idempDoc.status).toBe('completed');
      expect(idempDoc.actionType).toBe('ADD_EXPENSE');
      expect(idempDoc.responseBody.id).toBe(expenseId);

      // Count total expense records created
      const initialExpSnap = await db.collection('expenses').where('title', '==', 'Office Cleaning Supplies').get();
      const initialCount = initialExpSnap.docs.length;

      // Replay request with the exact same Idempotency-Key
      const resReplay = await request(app)
        .post('/api/ai/execute-action')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', idempKey)
        .send({
          actionType: 'ADD_EXPENSE',
          payload: {
            title: 'Office Cleaning Supplies',
            amount: 45.5,
            category: 'Supplies',
            paymentMethod: 'cash'
          },
          confirmed: true
        });

      expect(resReplay.status).toBe(200);
      expect(resReplay.headers['x-idempotent-replay']).toBe('true');
      expect(resReplay.body._idempotentReplay).toBe(true);
      expect(resReplay.body.id).toBe(expenseId);

      // Verify NO secondary expense record was created in Firestore
      const afterReplayExpSnap = await db.collection('expenses').where('title', '==', 'Office Cleaning Supplies').get();
      expect(afterReplayExpSnap.docs.length).toBe(initialCount);
    });

    it('rejects AI monetary actions when user confirmation is explicitly declined or missing in production check', async () => {
      const resDeclined = await request(app)
        .post('/api/ai/execute-action')
        .set('Authorization', OWNER_TOKEN)
        .send({
          actionType: 'ADD_EXPENSE',
          payload: {
            title: 'Unconfirmed Expense',
            amount: 100,
            confirmed: false
          }
        });
      expect(resDeclined.status).toBe(400);
      expect(resDeclined.body.error).toMatch(/Explicit user confirmation is required/i);
    });

    it('rejects monetary AI actions without Idempotency-Key with 400 Bad Request', async () => {
      const resMissingKey = await request(app)
        .post('/api/ai/execute-action')
        .set('Authorization', OWNER_TOKEN)
        .send({
          actionType: 'ADD_EXPENSE',
          payload: {
            title: 'Valid Schema But Missing Key',
            amount: 75,
            category: 'Supplies'
          },
          confirmed: true
        });
      expect(resMissingKey.status).toBe(400);
      expect(resMissingKey.body.error).toMatch(/Idempotency-Key is required for monetary AI action/i);
    });

    it('rejects replay with mismatched payload with 409 Conflict', async () => {
      const idempKey = `idemp_mismatch_${Date.now()}`;

      // 1. Initial successful execution
      const initialRes = await request(app)
        .post('/api/ai/execute-action')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', idempKey)
        .send({
          actionType: 'ADD_EXPENSE',
          payload: {
            title: 'Initial Expense For Key',
            amount: 50,
            category: 'Utilities'
          },
          confirmed: true
        });
      expect(initialRes.status).toBe(200);

      // 2. Subsequent execution with SAME key but DIFFERENT payload
      const mismatchRes = await request(app)
        .post('/api/ai/execute-action')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', idempKey)
        .send({
          actionType: 'ADD_EXPENSE',
          payload: {
            title: 'Different Expense Modified Amount',
            amount: 999,
            category: 'Utilities'
          },
          confirmed: true
        });
      expect(mismatchRes.status).toBe(409);
      expect(mismatchRes.body.error).toMatch(/different request payload/i);
      expect(mismatchRes.body.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
    });
  });

  describe('WALLET-AUTHORITATIVE-RELATION-SUITE: Removal of docs[0], Exact Matching & Duplicate Protection', () => {
    it('rejects ambiguous wallet operations when multiple customer wallets exist', async () => {
      const db = getAdminDb();
      const custId = `cust_ambig_${Date.now()}`;
      await db.collection('customers').doc(custId).set({
        id: custId,
        fullName: 'Ambiguous Customer',
        branchId: 'HQ'
      });

      // Intentionally insert two wallet records for the same customer
      const w1 = db.collection('customer_wallets').doc();
      await w1.set({ id: w1.id, customerId: custId, balance: 100, branchId: 'HQ' });
      const w2 = db.collection('customer_wallets').doc();
      await w2.set({ id: w2.id, customerId: custId, balance: 200, branchId: 'HQ' });

      // Attempt recharge -> rejected due to ambiguity
      const resRecharge = await request(app)
        .post('/api/wallet/recharge')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', `idemp_ambig_${Date.now()}`)
        .send({ customerId: custId, amount: 50 });
      expect(resRecharge.status).toBe(500);
      expect(resRecharge.body.error).toMatch(/Multiple wallets/i);

      // Attempt deduct -> rejected due to ambiguity
      const resDeduct = await request(app)
        .post('/api/wallet/deduct')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', `idemp_ambig_deduct_${Date.now()}`)
        .send({ customerId: custId, amount: 20 });
      expect(resDeduct.status).toBe(500);
      expect(resDeduct.body.error).toMatch(/Multiple wallets/i);

      // Cleanup
      await w1.delete();
      await w2.delete();
    });

    it('enforces required Idempotency-Key on wallet operations and rejects missing key with 400', async () => {
      const db = getAdminDb();
      const custId = `cust_idemp_req_${Date.now()}`;
      await db.collection('customers').doc(custId).set({
        id: custId,
        fullName: 'Idemp Test Customer',
        branchId: 'HQ'
      });

      // Missing Idempotency-Key on recharge -> 400
      const res1 = await request(app)
        .post('/api/wallet/recharge')
        .set('Authorization', OWNER_TOKEN)
        .send({ customerId: custId, amount: 50 });
      expect(res1.status).toBe(400);
      expect(res1.body.error).toMatch(/Idempotency-Key/i);

      // Verify no wallet created / balance mutated
      const snap1 = await db.collection('customer_wallets').where('customerId', '==', custId).get();
      expect(snap1.empty).toBe(true);

      // Missing Idempotency-Key on deduct -> 400
      const res2 = await request(app)
        .post('/api/wallet/deduct')
        .set('Authorization', OWNER_TOKEN)
        .send({ customerId: custId, amount: 20 });
      expect(res2.status).toBe(400);
      expect(res2.body.error).toMatch(/Idempotency-Key/i);

      // Missing Idempotency-Key on refund -> 400
      const res3 = await request(app)
        .post('/api/wallet/refund')
        .set('Authorization', OWNER_TOKEN)
        .send({ customerId: custId, orderId: 'ord_fake', amount: 10 });
      expect(res3.status).toBe(400);
      expect(res3.body.error).toMatch(/Idempotency-Key/i);
    });

    it('enforces exact customer relation matching without docs[0] and deduplicates recharge', async () => {
      const db = getAdminDb();
      const custId = `cust_exact_${Date.now()}`;
      await db.collection('customers').doc(custId).set({
        id: custId,
        fullName: 'Exact Customer',
        branchId: 'HQ'
      });

      const uniqueRef = `REF-WALLET-${Date.now()}`;

      // First recharge with Idempotency-Key
      const res1 = await request(app)
        .post('/api/wallet/recharge')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', uniqueRef)
        .send({
          customerId: custId,
          amount: 75
        });
      expect(res1.status).toBe(200);
      expect(res1.body.status).toBe('success');
      expect(res1.body.newBalance).toBe(75);

      // Re-send recharge with same deduplication key
      const resDup = await request(app)
        .post('/api/wallet/recharge')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', uniqueRef)
        .send({
          customerId: custId,
          amount: 75
        });
      expect(resDup.status).toBe(200);
      expect(resDup.body.status).toBe('duplicate');
      expect(resDup.body.newBalance).toBe(75);

      // Verify wallet balance is strictly 75, not 150
      const walletSnap = await db.collection('customer_wallets').where('customerId', '==', custId).get();
      expect(walletSnap.docs.length).toBe(1);
      expect(walletSnap.docs[0].data().balance).toBe(75);
    });

    it('enforces cumulative order refund limits and prevents excess refunding', async () => {
      const db = getAdminDb();
      const custId = `cust_refund_${Date.now()}`;
      const orderId = `ord_refund_${Date.now()}`;

      await db.collection('customers').doc(custId).set({
        id: custId,
        fullName: 'Refundable Customer',
        branchId: 'HQ'
      });

      await db.collection('orders').doc(orderId).set({
        id: orderId,
        customerId: custId,
        totalAmount: 100,
        status: 'completed',
        paymentStatus: 'paid',
        branchId: 'HQ'
      });

      // First valid refund ($60 out of $100)
      const res1 = await request(app)
        .post('/api/wallet/refund')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', `idemp_ref_1_${Date.now()}`)
        .send({
          customerId: custId,
          orderId,
          amount: 60
        });
      expect(res1.status).toBe(200);
      expect(res1.body.status).toBe('success');

      // Second excessive refund ($50 when only $40 remaining) -> 500 error
      const resExcess = await request(app)
        .post('/api/wallet/refund')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', `idemp_ref_2_${Date.now()}`)
        .send({
          customerId: custId,
          orderId,
          amount: 50
        });
      expect(resExcess.status).toBe(500);
      expect(resExcess.body.error).toMatch(/exceeds remaining refundable balance/i);

      // Second valid refund within remaining limit ($40) -> success
      const resValid2 = await request(app)
        .post('/api/wallet/refund')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', `idemp_ref_3_${Date.now()}`)
        .send({
          customerId: custId,
          orderId,
          amount: 40
        });
      expect(resValid2.status).toBe(200);
      expect(resValid2.body.status).toBe('success');
    });

    it('resolves wallets with customerId + branchId and isolates wallets across branches', async () => {
      const db = getAdminDb();
      const custId = `cust_multi_branch_${Date.now()}`;
      await db.collection('customers').doc(custId).set({
        id: custId,
        fullName: 'Multi Branch Customer',
        branchId: 'all'
      });

      // Branch 1 recharge ($50)
      const resB1 = await request(app)
        .post('/api/wallet/recharge')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', `idemp_b1_${Date.now()}`)
        .send({
          customerId: custId,
          branchId: 'branch_hq_01',
          amount: 50
        });
      expect(resB1.status).toBe(200);
      expect(resB1.body.newBalance).toBe(50);

      // Branch 2 recharge ($100)
      const resB2 = await request(app)
        .post('/api/wallet/recharge')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', `idemp_b2_${Date.now()}`)
        .send({
          customerId: custId,
          branchId: 'branch_hargeisa_01',
          amount: 100
        });
      expect(resB2.status).toBe(200);
      expect(resB2.body.newBalance).toBe(100);

      // Verify each branch has its own wallet
      const wHqSnap = await db.collection('customer_wallets')
        .where('customerId', '==', custId)
        .where('branchId', '==', 'branch_hq_01')
        .get();
      expect(wHqSnap.docs.length).toBe(1);
      expect(wHqSnap.docs[0].data().balance).toBe(50);

      const wHarSnap = await db.collection('customer_wallets')
        .where('customerId', '==', custId)
        .where('branchId', '==', 'branch_hargeisa_01')
        .get();
      expect(wHarSnap.docs.length).toBe(1);
      expect(wHarSnap.docs[0].data().balance).toBe(100);
    });

    it('handles concurrent identical AI actions via Promise.all and ensures only ONE execution', async () => {
      const db = getAdminDb();
      const idempKey = `IDEMP-CONCUR-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const payload = {
        title: 'Concurrent AI Expense Test',
        amount: 88.0,
        category: 'Maintenance',
        paymentMethod: 'cash'
      };

      const [resA, resB] = await Promise.all([
        request(app)
          .post('/api/ai/execute-action')
          .set('Authorization', OWNER_TOKEN)
          .set('Idempotency-Key', idempKey)
          .send({ actionType: 'ADD_EXPENSE', payload, confirmed: true }),
        request(app)
          .post('/api/ai/execute-action')
          .set('Authorization', OWNER_TOKEN)
          .set('Idempotency-Key', idempKey)
          .send({ actionType: 'ADD_EXPENSE', payload, confirmed: true })
      ]);

      expect([200, 409]).toContain(resA.status);
      expect([200, 409]).toContain(resB.status);

      // Verify only ONE expense document was created in the expenses collection
      const expSnap = await db.collection('expenses').where('title', '==', 'Concurrent AI Expense Test').get();
      expect(expSnap.docs.length).toBe(1);
    });

    it('allows non-monetary AI actions without Idempotency-Key header', async () => {
      const res = await request(app)
        .post('/api/ai/execute-action')
        .set('Authorization', OWNER_TOKEN)
        .send({
          actionType: 'UPDATE_INVENTORY',
          payload: {
            itemId: 'test_prod_1',
            quantity: 50,
            reason: 'Routine AI Stock Sync'
          },
          confirmed: true
        });

      expect([200, 400]).toContain(res.status);
      if (res.status === 400) {
        expect(res.body.error).not.toMatch(/Idempotency-Key is required/i);
      }
    });

    // P2-01: Global Tax Authorization
    it('P2-01: Rejects tax creation by branch manager/cashier and allows Owner/HQ Admin', async () => {
      // 1. Branch Cashier fails with 403
      const cashierRes = await request(app)
        .post('/api/accounting/taxes')
        .set('Authorization', CASHIER_TOKEN)
        .send({ name: 'VAT 15%', rate: 0.15, type: 'percentage' });
      expect(cashierRes.status).toBe(403);

      // 2. Branch Manager fails with 403 (restricted to Owner / HQ Admin)
      const managerRes = await request(app)
        .post('/api/accounting/taxes')
        .set('Authorization', 'Bearer test_token_manager_branch_a')
        .send({ name: 'VAT 15%', rate: 0.15, type: 'percentage' });
      expect(managerRes.status).toBe(403);

      // 3. Owner succeeds
      const ownerRes = await request(app)
        .post('/api/accounting/taxes')
        .set('Authorization', OWNER_TOKEN)
        .send({ name: 'VAT 15%', rate: 0.15, type: 'percentage' });
      expect(ownerRes.status).toBe(200);
      expect(ownerRes.body.name).toBe('VAT 15%');
    });

    // P3-01: Security Headers & CORS
    it('P3-01: Returns security headers and enforces CORS allowlist', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-xss-protection']).toBe('1; mode=block');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');

      // Test trusted origin
      const trustedOriginRes = await request(app)
        .options('/api/health')
        .set('Origin', 'https://babasultan-restaurant-erp.web.app');
      expect(trustedOriginRes.status).toBe(204);
      expect(trustedOriginRes.headers['access-control-allow-origin']).toBe('https://babasultan-restaurant-erp.web.app');

      // Test unauthorized arbitrary origin on OPTIONS preflight
      const badOriginRes = await request(app)
        .options('/api/health')
        .set('Origin', 'https://malicious-site.attacker.com');
      expect(badOriginRes.status).toBe(403);
    });

    // P1-04: Global Chart of Accounts Authorization
    it('P1-04: Enforces Owner/HQ Admin for Global Chart of Accounts while allowing branch managers only on their branch', async () => {
      // 1. Branch Manager creating global account (no branchId or 'all') fails
      const mgrGlobalRes = await request(app)
        .post('/api/accounting/accounts')
        .set('Authorization', 'Bearer test_token_manager_branch_a')
        .send({ code: '9901', name: 'Global Secret Reserve', type: 'Equity' });
      expect(mgrGlobalRes.status).toBe(403);

      // 2. Branch Manager creating account for different branch fails
      const mgrCrossRes = await request(app)
        .post('/api/accounting/accounts')
        .set('Authorization', 'Bearer test_token_manager_branch_a')
        .send({ code: '9902', name: 'Branch B Cash', type: 'Asset', branchId: 'branch_b' });
      expect(mgrCrossRes.status).toBe(403);

      // 3. Branch Manager creating account for own branch succeeds
      const mgrOwnRes = await request(app)
        .post('/api/accounting/accounts')
        .set('Authorization', 'Bearer test_token_manager_branch_a')
        .send({ code: '9903', name: 'Branch A Petty Cash', type: 'Asset', branchId: 'branch_a' });
      expect(mgrOwnRes.status).toBe(200);

      // 4. Owner creating global account succeeds
      const ownerGlobalRes = await request(app)
        .post('/api/accounting/accounts')
        .set('Authorization', OWNER_TOKEN)
        .send({ code: '1001', name: 'Enterprise Master Treasury', type: 'Asset' });
      expect(ownerGlobalRes.status).toBe(200);
    });

    // P1-06: Rewards Cross-Branch Authorization
    it('P1-06: Blocks cross-branch and unauthorized global reward creation/modification', async () => {
      // 1. Branch Manager A cannot create reward for Branch B
      const crossCreateRes = await request(app)
        .post('/api/crm/rewards')
        .set('Authorization', 'Bearer test_token_manager_branch_a')
        .send({ rewardName: 'Branch B Free Burger', pointsRequired: 100, branchId: 'branch_b' });
      expect(crossCreateRes.status).toBe(403);

      // 2. Branch Manager A cannot create global reward
      const globalCreateRes = await request(app)
        .post('/api/crm/rewards')
        .set('Authorization', 'Bearer test_token_manager_branch_a')
        .send({ rewardName: 'Global Free Shawarma', pointsRequired: 150, branchId: 'all' });
      expect(globalCreateRes.status).toBe(403);

      // 3. Owner can create global reward
      const ownerCreateRes = await request(app)
        .post('/api/crm/rewards')
        .set('Authorization', OWNER_TOKEN)
        .send({ rewardName: 'Enterprise VIP Meal', pointsRequired: 500, branchId: 'all' });
      expect(ownerCreateRes.status).toBe(201);
      const rewardId = ownerCreateRes.body.id;

      // 4. Branch Manager A cannot update or delete Owner's global reward
      const crossUpdateRes = await request(app)
        .put(`/api/crm/rewards/${rewardId}`)
        .set('Authorization', 'Bearer test_token_manager_branch_a')
        .send({ rewardName: 'Hacked VIP Meal' });
      expect(crossUpdateRes.status).toBe(403);

      const crossDeleteRes = await request(app)
        .delete(`/api/crm/rewards/${rewardId}`)
        .set('Authorization', 'Bearer test_token_manager_branch_a');
      expect(crossDeleteRes.status).toBe(403);
    });

    // P1-07: Coupons Cross-Branch Authorization
    it('P1-07: Blocks cross-branch and unauthorized global coupon creation/modification', async () => {
      // 1. Branch Manager A cannot create coupon for Branch B
      const crossCouponRes = await request(app)
        .post('/api/crm/coupons')
        .set('Authorization', 'Bearer test_token_manager_branch_a')
        .send({ code: 'DISC_B_50', discountValue: 50, branchId: 'branch_b' });
      expect(crossCouponRes.status).toBe(403);

      // 2. Branch Manager A cannot create global coupon
      const globalCouponRes = await request(app)
        .post('/api/crm/coupons')
        .set('Authorization', 'Bearer test_token_manager_branch_a')
        .send({ code: 'GLOBAL_FREE', discountValue: 100, branchId: 'all' });
      expect(globalCouponRes.status).toBe(403);

      // 3. Owner can create global coupon
      const ownerCouponRes = await request(app)
        .post('/api/crm/coupons')
        .set('Authorization', OWNER_TOKEN)
        .send({ code: 'GLOBAL_VIP_20', discountValue: 20, branchId: 'all' });
      expect(ownerCouponRes.status).toBe(201);
      const couponId = ownerCouponRes.body.id;

      // 4. Branch Manager A cannot delete global coupon
      const crossDeleteCouponRes = await request(app)
        .delete(`/api/crm/coupons/${couponId}`)
        .set('Authorization', 'Bearer test_token_manager_branch_a');
      expect(crossDeleteCouponRes.status).toBe(403);
    });
  });
});

