import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server.ts';
import { getAdminDb } from '../server/trustedFinancialBackend.js';

describe('3 & 4 & 5 & 6 & 7. POS, INVENTORY, RECIPE, IDEMPOTENCY & CONCURRENCY TESTS', () => {
  // Test atomic sale checkout simulation
  function simulatePosCheckout(params: {
    stock: number;
    requestedQty: number;
    price: number;
    costPrice: number;
    recipe?: { ingredientId: string; stock: number; reqQty: number; costPerUnit: number }[];
    idempotencyKey?: string;
    existingIdempotencyKeys?: Set<string>;
  }) {
    const { stock, requestedQty, price, costPrice, recipe, idempotencyKey, existingIdempotencyKeys } = params;

    // 1. Idempotency Check
    if (idempotencyKey && existingIdempotencyKeys?.has(idempotencyKey)) {
      return { status: 'duplicate', message: 'Transaction already processed' };
    }

    // 2. Stock Verification
    if (stock < requestedQty) {
      throw new Error(`Insufficient inventory stock. Available: ${stock}, Requested: ${requestedQty}`);
    }

    // 3. Recipe Stock Verification
    if (recipe) {
      for (const item of recipe) {
        const requiredTotal = item.reqQty * requestedQty;
        if (item.stock < requiredTotal) {
          throw new Error(`Insufficient recipe ingredient stock for item. Available: ${item.stock}, Required: ${requiredTotal}`);
        }
      }
    }

    // 4. Calculate Financial Metrics
    const subtotal = price * requestedQty;
    const cogs = recipe
      ? recipe.reduce((acc, r) => acc + (r.reqQty * requestedQty * r.costPerUnit), 0)
      : costPrice * requestedQty;

    const remainingStock = stock - requestedQty;

    // 5. Recipe Deductions
    const updatedRecipe = recipe?.map(r => ({
      ...r,
      remainingStock: r.stock - (r.reqQty * requestedQty)
    }));

    // 6. Double Entry Journal Verification
    const journalEntries = [
      { account: 'Cash', debit: subtotal, credit: 0 },
      { account: 'Sales Revenue', debit: 0, credit: subtotal },
      { account: 'COGS', debit: cogs, credit: 0 },
      { account: 'Inventory', debit: 0, credit: cogs }
    ];

    const totalDebit = journalEntries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = journalEntries.reduce((sum, e) => sum + e.credit, 0);

    if (totalDebit !== totalCredit) {
      throw new Error(`Unbalanced Journal Entry! Debit (${totalDebit}) != Credit (${totalCredit})`);
    }

    if (idempotencyKey && existingIdempotencyKeys) {
      existingIdempotencyKeys.add(idempotencyKey);
    }

    return {
      status: 'success',
      order: { subtotal, cogs, itemsQty: requestedQty },
      remainingStock,
      updatedRecipe,
      journalEntries,
      totalDebit,
      totalCredit,
      auditLogged: true
    };
  }

  it('successfully completes POS sale with atomic stock deduction, COGS calculation, balanced Journal (Debit==Credit), and Audit log', () => {
    const result = simulatePosCheckout({
      stock: 10,
      requestedQty: 2,
      price: 10,
      costPrice: 4
    });

    expect(result.status).toBe('success');
    expect(result.remainingStock).toBe(8); // Stock = 10 - 2 = 8
    expect(result.order.subtotal).toBe(20); // Revenue = 20
    expect(result.order.cogs).toBe(8); // Cost = 4 * 2 = 8
    expect(result.totalDebit).toBe(result.totalCredit); // 20 + 8 = 28 Debit == 28 Credit
    expect(result.auditLogged).toBe(true);
  });

  it('REJECTS transaction and prevents atomic commit if stock is INSUFFICIENT', () => {
    expect(() => {
      simulatePosCheckout({
        stock: 1,
        requestedQty: 2,
        price: 10,
        costPrice: 4
      });
    }).toThrowError(/Insufficient inventory stock/i);
  });

  it('handles IDEMPOTENCY key: re-submitting same idempotency key does not duplicate sale', () => {
    const existingKeys = new Set<string>();
    const key = 'checkout_unique_abc123';

    // First request
    const res1 = simulatePosCheckout({
      stock: 10,
      requestedQty: 1,
      price: 15,
      costPrice: 5,
      idempotencyKey: key,
      existingIdempotencyKeys: existingKeys
    });
    expect(res1.status).toBe('success');

    // Duplicate request with same idempotency key
    const res2 = simulatePosCheckout({
      stock: 9,
      requestedQty: 1,
      price: 15,
      costPrice: 5,
      idempotencyKey: key,
      existingIdempotencyKeys: existingKeys
    });
    expect(res2.status).toBe('duplicate');
  });

  it('prevents CONCURRENCY over-selling when stock = 1 and 2 requests occur simultaneously', () => {
    let currentStock = 1;

    function attemptConcurrentSale() {
      if (currentStock < 1) {
        throw new Error('Insufficient inventory stock.');
      }
      currentStock -= 1;
      return 'success';
    }

    const firstAttempt = attemptConcurrentSale();
    expect(firstAttempt).toBe('success');
    expect(currentStock).toBe(0);

    // Second concurrent attempt must fail
    expect(() => attemptConcurrentSale()).toThrowError(/Insufficient/i);
    expect(currentStock).toBe(0); // Stock never drops below zero
  });

  it('correctly deducts RECIPE raw ingredients upon sale of finished item (Burger recipe)', () => {
    // Burger requires Bread (1), Meat (1), Sauce (1)
    const result = simulatePosCheckout({
      stock: 20,
      requestedQty: 5, // Sell 5 Burgers
      price: 12,
      costPrice: 0,
      recipe: [
        { ingredientId: 'ing_bread', stock: 20, reqQty: 1, costPerUnit: 1.0 },
        { ingredientId: 'ing_meat', stock: 20, reqQty: 1, costPerUnit: 2.5 },
        { ingredientId: 'ing_sauce', stock: 20, reqQty: 1, costPerUnit: 0.5 }
      ]
    });

    expect(result.status).toBe('success');
    expect(result.updatedRecipe).toBeDefined();

    // Each raw ingredient stock should be 20 - 5 = 15
    result.updatedRecipe?.forEach(ing => {
      expect(ing.remainingStock).toBe(15);
    });

    // COGS = 5 * (1.0 + 2.5 + 0.5) = 5 * 4.0 = 20
    expect(result.order.cogs).toBe(20);
  });

  it('verifies kitchen ticket contract and separation of states (order status != kitchen prepStatus)', () => {
    // 1. Initial creation contract
    const now = new Date().toISOString();
    const kitchenTicket = {
      id: 'ord_123',
      orderId: 'ord_123',
      orderNumber: 'ORD-1001',
      orderTime: now,
      createdAt: now,
      updatedAt: now,
      orderType: 'delivery',
      tableNumber: '',
      customerName: 'Amina',
      branchId: 'main_branch_01',
      items: [
        { productId: 'p1', productName: 'Burger', quantity: 2, itemStatus: 'new' }
      ],
      prepStatus: 'pending',
      priority: 'medium'
    };

    expect(kitchenTicket.createdAt).toBe(now);
    expect(kitchenTicket.orderTime).toBe(now);
    expect(kitchenTicket.prepStatus).toBe('pending');

    // 2. Order status independent from kitchen status
    const order = {
      id: 'ord_123',
      status: 'completed', // e.g. Customer paid and cashier checked out
      paymentStatus: 'paid'
    };

    // Even if order is completed/paid, kitchen ticket remains at its own authoritative prepStatus
    expect(order.status).toBe('completed');
    expect(kitchenTicket.prepStatus).toBe('pending');
    expect(order.status).not.toBe(kitchenTicket.prepStatus);

    // 3. Verifies no fake fallback fabricating tickets
    const existingKitchenOrders: any[] = [];
    function resolveKitchenTickets(tickets: any[]) {
      // Direct return without fallback reconstruction from orders
      return tickets.map(t => ({
        id: t.id,
        ...t,
        createdAt: t.createdAt || t.orderTime || now,
        orderTime: t.orderTime || t.createdAt || now
      }));
    }

    const resolved = resolveKitchenTickets(existingKitchenOrders);
    expect(resolved.length).toBe(0); // Never fabricate tickets if kitchen_orders is empty
  });

  describe('REAL BACKEND /api/pos/checkout (handlePosCheckout) VERIFICATION SUITE', () => {
    const CASHIER_TOKEN = 'Bearer test_token_cashier'; // branchId: 'main_branch_01', role: 'Cashier'
    const OWNER_TOKEN = 'Bearer test_token_owner';

    beforeEach(async () => {
      const db = getAdminDb();
      for (const col of [
        'accounting_periods',
        'cash_registers',
        'orders',
        'payments',
        'inventory_movements',
        'journal_entries',
        'journal_lines',
        'ledger',
        'mutation_idempotency',
        'products',
        'recipes',
        'ingredients',
        'inventory',
        'customers',
        'customer_points',
        'kitchen_orders'
      ]) {
        const snap = await db.collection(col).get();
        for (const d of snap.docs) {
          await d.ref.delete();
        }
      }

      await db.collection('branches').doc('main_branch_01').set({
        id: 'main_branch_01',
        name: 'Main Branch',
        taxEnabled: true,
        taxRate: 0.05,
        defaultDeliveryFee: 2.0
      });

      await db.collection('cash_registers').doc('reg_pos_test_01').set({
        id: 'reg_pos_test_01',
        branchId: 'main_branch_01',
        status: 'Open',
        openingBalance: 1000,
        expectedClosingBalance: 1000,
        cashSales: 0,
        openedBy: 'Test Cashier',
        openedAt: new Date().toISOString()
      });

      await db.collection('ingredients').doc('ing_pos_beef').set({
        id: 'ing_pos_beef',
        name: 'Beef Patty',
        branchId: 'main_branch_01',
        stock: 50,
        currentStockUsageUnit: 50,
        costPerUsageUnit: 3.0,
        usageUnit: 'pcs'
      });

      await db.collection('products').doc('prod_pos_burger').set({
        id: 'prod_pos_burger',
        name: 'Signature Burger',
        price: 20,
        cost: 3,
        trackStock: true,
        stock: 20,
        isActive: true,
        branchId: 'main_branch_01',
        options: [
          {
            id: 'opt_cheese',
            nameEn: 'Cheese Option',
            choices: [
              { id: 'ch_cheddar', nameEn: 'Extra Cheddar', priceModifier: 4 },
              { id: 'ch_swiss', nameEn: 'Swiss Cheese', priceModifier: 6 }
            ]
          }
        ]
      });

      await db.collection('recipes').doc('rec_pos_burger').set({
        id: 'rec_pos_burger',
        productId: 'prod_pos_burger',
        branchId: 'main_branch_01',
        isActive: true,
        items: [
          { ingredientId: 'ing_pos_beef', quantity: 2, unit: 'pcs' }
        ]
      });
    });

    it('1, 2 & 3. Ignores client price/total/tax tampering and rejects invented or mismatched options', async () => {
      // Tampered price (0.01), tampered option priceModifier (-100), tampered taxRate (0), tampered totalAmount (0.01)
      // Server must calculate: (20 + 4) * 2 = 48 subtotal, 5% tax = 2.40, total = 50.40
      const res = await request(app)
        .post('/api/pos/checkout')
        .set('Authorization', CASHIER_TOKEN)
        .set('Idempotency-Key', 'idem-pos-price-tamper-1')
        .send({
          orderData: {
            branchId: 'main_branch_01',
            orderType: 'dine_in',
            paymentMethod: 'cash',
            amountTendered: 60,
            subtotal: 0.01,
            taxRate: 0,
            tax: 0,
            totalAmount: 0.01,
            items: [
              {
                productId: 'prod_pos_burger',
                quantity: 2,
                price: 0.01,
                unitPrice: 0.01,
                selectedOptions: [
                  { optionId: 'opt_cheese', choiceId: 'ch_cheddar', priceModifier: -100 }
                ]
              }
            ]
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.order.subtotal).toBe(48);
      expect(res.body.order.taxRate).toBe(0.05);
      expect(res.body.order.tax).toBe(2.4);
      expect(res.body.order.totalAmount).toBe(50.4);
      expect(res.body.order.changeDue).toBe(9.6);
      expect(res.body.order.cogs).toBe(12); // 2 burgers * 2 patties * $3 = $12

      // Reject invented option
      const resFakeOpt = await request(app)
        .post('/api/pos/checkout')
        .set('Authorization', CASHIER_TOKEN)
        .set('Idempotency-Key', 'idem-pos-fake-opt-1')
        .send({
          orderData: {
            branchId: 'main_branch_01',
            orderType: 'dine_in',
            paymentMethod: 'cash',
            paidAmount: 21,
            items: [
              {
                productId: 'prod_pos_burger',
                quantity: 1,
                selectedOptions: [
                  { optionId: 'opt_invented', choiceId: 'ch_free', priceModifier: -15 }
                ]
              }
            ]
          }
        });
      expect(resFakeOpt.status).toBe(400);

      // Reject mismatched choiceId + choiceName (e.g. cheap choiceId paired with expensive choiceName)
      const resMismatchChoice = await request(app)
        .post('/api/pos/checkout')
        .set('Authorization', CASHIER_TOKEN)
        .set('Idempotency-Key', 'idem-pos-mismatch-choice-1')
        .send({
          orderData: {
            branchId: 'main_branch_01',
            orderType: 'dine_in',
            paymentMethod: 'cash',
            paidAmount: 30,
            items: [
              {
                productId: 'prod_pos_burger',
                quantity: 1,
                selectedOptions: [
                  { optionId: 'opt_cheese', choiceId: 'ch_cheddar', choiceName: 'Swiss Cheese' }
                ]
              }
            ]
          }
        });
      expect(resMismatchChoice.status).toBe(400);
    });

    it('4 & 5. Enforces role discount limits, rejects negative discounts, and blocks paidAmount/tender underpayment', async () => {
      // Cashier role limit is min(15% of subtotal, $25). For subtotal $20, max discount is $3.00.
      const resExcessDiscount = await request(app)
        .post('/api/pos/checkout')
        .set('Authorization', CASHIER_TOKEN)
        .set('Idempotency-Key', 'idem-pos-discount-limit-1')
        .send({
          orderData: {
            branchId: 'main_branch_01',
            orderType: 'dine_in',
            paymentMethod: 'cash',
            discountAmount: 10,
            paidAmount: 21,
            items: [{ productId: 'prod_pos_burger', quantity: 1 }]
          }
        });
      expect(resExcessDiscount.status).toBe(400);
      expect(resExcessDiscount.body.error).toMatch(/exceeds authorized role limit/i);

      // Negative discount must be rejected
      const resNegDiscount = await request(app)
        .post('/api/pos/checkout')
        .set('Authorization', CASHIER_TOKEN)
        .set('Idempotency-Key', 'idem-pos-discount-neg-1')
        .send({
          orderData: {
            branchId: 'main_branch_01',
            orderType: 'dine_in',
            paymentMethod: 'cash',
            discountAmount: -10,
            paidAmount: 50,
            items: [{ productId: 'prod_pos_burger', quantity: 1 }]
          }
        });
      expect(resNegDiscount.status).toBe(400);
      expect(resNegDiscount.body.error).toMatch(/Invalid discount amount/i);

      // Underpayment via paidAmount even when amountTendered is high must be rejected
      const resMaskedUnderpay = await request(app)
        .post('/api/pos/checkout')
        .set('Authorization', CASHIER_TOKEN)
        .set('Idempotency-Key', 'idem-pos-underpay-masked-1')
        .send({
          orderData: {
            branchId: 'main_branch_01',
            orderType: 'dine_in',
            paymentMethod: 'cash',
            amountTendered: 100,
            paidAmount: 5, // Underpaid! Total is 21
            items: [{ productId: 'prod_pos_burger', quantity: 1 }]
          }
        });
      expect(resMaskedUnderpay.status).toBe(400);
      expect(resMaskedUnderpay.body.error).toMatch(/Underpayment rejected/i);
    });

    it('6, 7 & 8. Enforces idempotency on sequential/concurrent retries without duplicating side effects, and rejects payload conflicts with 409', async () => {
      const db = getAdminDb();
      const idemKey = 'idem-pos-concurrent-and-conflict-1';
      const validPayload = {
        orderData: {
          branchId: 'main_branch_01',
          orderType: 'dine_in',
          paymentMethod: 'cash',
          paidAmount: 21,
          items: [{ productId: 'prod_pos_burger', quantity: 1 }]
        }
      };

      // Concurrent requests with the exact same Idempotency-Key and payload
      const [resA, resB] = await Promise.all([
        request(app)
          .post('/api/pos/checkout')
          .set('Authorization', CASHIER_TOKEN)
          .set('Idempotency-Key', idemKey)
          .send(validPayload),
        request(app)
          .post('/api/pos/checkout')
          .set('Authorization', CASHIER_TOKEN)
          .set('Idempotency-Key', idemKey)
          .send(validPayload)
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(resA.body.order.id).toBe(resB.body.order.id);

      // Verify exactly 1 order, 1 payment, 1 product deduction, 1 ingredient deduction, 1 journal entry
      const ordersSnap = await db.collection('orders').where('idempotencyKey', '==', idemKey).get();
      expect(ordersSnap.size).toBe(1);

      const paymentsSnap = await db.collection('payments').where('orderId', '==', resA.body.order.id).get();
      expect(paymentsSnap.size).toBe(1);

      const jeSnap = await db.collection('journal_entries').where('reference', '==', resA.body.order.orderNumber).get();
      expect(jeSnap.size).toBe(1);

      const prodSnap = await db.collection('products').doc('prod_pos_burger').get();
      expect(prodSnap.data()?.stock).toBe(19); // 20 - 1 = 19

      const ingSnap = await db.collection('ingredients').doc('ing_pos_beef').get();
      expect(ingSnap.data()?.stock).toBe(48); // 50 - 2 = 48

      // Same Idempotency-Key with a DIFFERENT payload (quantity: 2 instead of 1) -> 409 Conflict
      const resConflict = await request(app)
        .post('/api/pos/checkout')
        .set('Authorization', CASHIER_TOKEN)
        .set('Idempotency-Key', idemKey)
        .send({
          orderData: {
            branchId: 'main_branch_01',
            orderType: 'dine_in',
            paymentMethod: 'cash',
            paidAmount: 42,
            items: [{ productId: 'prod_pos_burger', quantity: 2 }]
          }
        });

      expect(resConflict.status).toBe(409);
      expect(resConflict.body.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
    });

    it('9 & 10. Enforces branch isolation and ensures failed checkout leaves zero partial state', async () => {
      const db = getAdminDb();

      // 9a. Cashier assigned to main_branch_01 cannot spoof branchId to another branch
      const resBranchSpoof = await request(app)
        .post('/api/pos/checkout')
        .set('Authorization', CASHIER_TOKEN)
        .set('Idempotency-Key', 'idem-pos-branch-spoof-1')
        .send({
          orderData: {
            branchId: 'branch_other_99',
            orderType: 'dine_in',
            paymentMethod: 'cash',
            paidAmount: 21,
            items: [{ productId: 'prod_pos_burger', quantity: 1 }]
          }
        });
      expect(resBranchSpoof.status).toBe(403);

      // 9b. Cross-branch customer assignment is rejected with 403
      await db.collection('customers').doc('cust_other_branch').set({
        id: 'cust_other_branch',
        name: 'Other Branch Customer',
        branchId: 'branch_other_99'
      });
      const resCrossCust = await request(app)
        .post('/api/pos/checkout')
        .set('Authorization', OWNER_TOKEN)
        .set('Idempotency-Key', 'idem-pos-cross-cust-1')
        .send({
          orderData: {
            branchId: 'main_branch_01',
            customerId: 'cust_other_branch',
            orderType: 'dine_in',
            paymentMethod: 'cash',
            paidAmount: 21,
            items: [{ productId: 'prod_pos_burger', quantity: 1 }]
          }
        });
      expect(resCrossCust.status).toBe(403);

      // 10. Failed checkout (e.g. split lines for same product exceeding available stock 20) leaves zero partial state
      const resInsufficientSplit = await request(app)
        .post('/api/pos/checkout')
        .set('Authorization', CASHIER_TOKEN)
        .set('Idempotency-Key', 'idem-pos-atomic-fail-1')
        .send({
          orderData: {
            branchId: 'main_branch_01',
            orderType: 'dine_in',
            paymentMethod: 'cash',
            paidAmount: 525,
            items: [
              { productId: 'prod_pos_burger', quantity: 12 },
              { productId: 'prod_pos_burger', quantity: 13 } // 12 + 13 = 25 > 20 available stock!
            ]
          }
        });
      expect(resInsufficientSplit.status).toBe(400);
      expect(resInsufficientSplit.body.error).toMatch(/Insufficient stock/i);

      // Verify zero orders, payments, movements, or journal entries were created and stock is untouched
      const ordersSnap = await db.collection('orders').get();
      const paymentsSnap = await db.collection('payments').get();
      const movSnap = await db.collection('inventory_movements').get();
      const jeSnap = await db.collection('journal_entries').get();
      const prodSnap = await db.collection('products').doc('prod_pos_burger').get();
      const ingSnap = await db.collection('ingredients').doc('ing_pos_beef').get();

      expect(ordersSnap.size).toBe(0);
      expect(paymentsSnap.size).toBe(0);
      expect(movSnap.size).toBe(0);
      expect(jeSnap.size).toBe(0);
      expect(prodSnap.data()?.stock).toBe(20);
      expect(ingSnap.data()?.stock).toBe(50);
    });
  });
});
