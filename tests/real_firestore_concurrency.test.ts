import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, runTransaction } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('REAL FIRESTORE EMULATOR CONCURRENCY SUITE', () => {
  // Concurrency tests verify Firestore's real ACID transaction serialization, lock management,
  // and atomic multi-client contention. All tests execute via withSecurityRulesDisabled().
  // Omitting the 53KB production firestore.rules here prevents the emulator from spending
  // 6-12s parsing and compiling the security AST in beforeAll(), resolving Windows hook timeouts.
  beforeAll(async () => {
    const host = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8081').split(':')[0];
    const port = Number((process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8081').split(':')[1]);

    testEnv = await initializeTestEnvironment({
      projectId: 'babasultan-real-concurrency',
      firestore: {
        host,
        port
      }
    });
  }, 30000);

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  // 1. CONCURRENT INVENTORY DECREMENT (Zero lost updates under real transaction contention)
  it('1. Real Firestore Emulator: Simultaneous inventory decrements maintain exact balance with zero lost updates', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const itemRef = doc(db, 'inventory', 'inv_item_concurrent');

      await setDoc(itemRef, {
        id: 'inv_item_concurrent',
        name: 'Prime Wagyu Cut',
        currentQuantity: 10,
        branchId: 'BR-001'
      });

      // Launch 10 simultaneous decrements of 1 unit each
      const tasks = Array.from({ length: 10 }, async (_, index) => {
        return runTransaction(db, async (tx) => {
          const snap = await tx.get(itemRef);
          if (!snap.exists()) throw new Error('Item not found');
          const cur = snap.data().currentQuantity;
          if (cur < 1) throw new Error('Insufficient stock');
          tx.update(itemRef, {
            currentQuantity: cur - 1,
            lastUpdatedIndex: index
          });
          return cur - 1;
        });
      });

      const results = await Promise.all(tasks);
      expect(results).toHaveLength(10);

      const finalSnap = await getDoc(itemRef);
      expect(finalSnap.data()?.currentQuantity).toBe(0);

      // An 11th decrement must be rejected due to zero remaining stock
      await expect(
        runTransaction(db, async (tx) => {
          const snap = await tx.get(itemRef);
          const cur = snap.data()?.currentQuantity;
          if (cur < 1) throw new Error('Insufficient stock');
          tx.update(itemRef, { currentQuantity: cur - 1 });
        })
      ).rejects.toThrow(/Insufficient stock/);
    });
  });

  // 2. CONCURRENT AR PAYMENT (No lost updates, exact remaining balance)
  it('2. Real Firestore Emulator: Concurrent AR payments atomically decrement receivable balance', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const arRef = doc(db, 'receivables', 'inv_ar_concurrent');

      await setDoc(arRef, {
        id: 'inv_ar_concurrent',
        invoiceNumber: 'INV-CONC-001',
        totalAmount: 100,
        paidAmount: 0,
        remainingBalance: 100,
        status: 'Unpaid',
        branchId: 'BR-001'
      });

      // 5 concurrent payments of $20 each
      const payments = Array.from({ length: 5 }, async () => {
        return runTransaction(db, async (tx) => {
          const snap = await tx.get(arRef);
          const data = snap.data();
          const rem = data.remainingBalance;
          if (rem < 20) throw new Error('Overpayment not allowed');
          const nextPaid = data.paidAmount + 20;
          const nextRem = rem - 20;
          tx.update(arRef, {
            paidAmount: nextPaid,
            remainingBalance: nextRem,
            status: nextRem === 0 ? 'Paid' : 'Partial'
          });
          return nextRem;
        });
      });

      await Promise.all(payments);

      const finalAR = await getDoc(arRef);
      expect(finalAR.data()?.paidAmount).toBe(100);
      expect(finalAR.data()?.remainingBalance).toBe(0);
      expect(finalAR.data()?.status).toBe('Paid');
    });
  });

  // 3. CONCURRENT AP PAYMENT (No lost updates, supplier balance consistency)
  it('3. Real Firestore Emulator: Concurrent AP payments decrement supplier outstanding balance without collision loss', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const supRef = doc(db, 'suppliers', 'sup_concurrent');

      await setDoc(supRef, {
        id: 'sup_concurrent',
        name: 'Mogadishu Dairy Ltd',
        outstandingBalance: 250,
        branchId: 'BR-001'
      });

      // 5 concurrent payments of $50 each
      const payments = Array.from({ length: 5 }, async () => {
        return runTransaction(db, async (tx) => {
          const snap = await tx.get(supRef);
          const data = snap.data();
          const cur = data.outstandingBalance;
          if (cur < 50) throw new Error('Cannot overpay supplier');
          tx.update(supRef, { outstandingBalance: cur - 50 });
          return cur - 50;
        });
      });

      await Promise.all(payments);

      const finalSup = await getDoc(supRef);
      expect(finalSup.data()?.outstandingBalance).toBe(0);
    });
  });

  // 4. CONCURRENT BANK TRANSACTIONS (Deposit increments with total balance integrity)
  it('4. Real Firestore Emulator: Concurrent bank deposits increment bank_accounts.currentBalance atomically', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const bankRef = doc(db, 'bank_accounts', 'bank_conc_001');

      await setDoc(bankRef, {
        id: 'bank_conc_001',
        bankName: 'Premier Bank Somalia',
        accountNumber: 'SOM-998877',
        currentBalance: 500,
        branchId: 'BR-001'
      });

      // 10 concurrent deposits of $100 each
      const deposits = Array.from({ length: 10 }, async () => {
        return runTransaction(db, async (tx) => {
          const snap = await tx.get(bankRef);
          const cur = snap.data()?.currentBalance || 0;
          tx.update(bankRef, { currentBalance: cur + 100 });
          return cur + 100;
        });
      });

      await Promise.all(deposits);

      const finalBank = await getDoc(bankRef);
      expect(finalBank.data()?.currentBalance).toBe(1500); // 500 + (10 * 100) = 1500
    });
  });

  // 5. CONCURRENT TABLE RESERVATION CONFLICT (First succeeds, second detects overlap and aborts)
  it('5. Real Firestore Emulator: Concurrent table reservations prevent double-booking of same table and slot', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const tableRef = doc(db, 'tables', 'tbl_vip_01');

      await setDoc(tableRef, {
        id: 'tbl_vip_01',
        tableNumber: 'VIP-1',
        capacity: 6,
        status: 'available',
        branchId: 'BR-001'
      });

      // Function attempting to book the table for 19:00 slot
      const bookSlot = (guestName: string) => {
        return runTransaction(db, async (tx) => {
          const snap = await tx.get(tableRef);
          const data = snap.data();
          if (data.activeBookingSlot === '2026-10-03T19:00:00Z') {
            throw Object.assign(new Error('Table already reserved for this slot'), { statusCode: 409 });
          }
          tx.update(tableRef, {
            activeBookingSlot: '2026-10-03T19:00:00Z',
            bookedBy: guestName,
            status: 'reserved'
          });
          return { success: true, bookedBy: guestName };
        });
      };

      // Run 2 simultaneous bookings
      const [res1, res2] = await Promise.allSettled([
        bookSlot('Customer Alpha'),
        bookSlot('Customer Beta')
      ]);

      const succeeded = [res1, res2].filter(r => r.status === 'fulfilled');
      const failed = [res1, res2].filter(r => r.status === 'rejected');

      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect((failed[0] as PromiseRejectedResult).reason.message).toMatch(/already reserved/);

      const finalTable = await getDoc(tableRef);
      expect(finalTable.data()?.status).toBe('reserved');
      expect(finalTable.data()?.activeBookingSlot).toBe('2026-10-03T19:00:00Z');
    });
  });

  // 6. IDEMPOTENCY RECORD UNDER CONCURRENT COLLISION
  it('6. Real Firestore Emulator: Concurrent requests with identical idempotency key execute exactly once', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const idemKey = 'idem-concurrency-key-8899';
      const idemRef = doc(db, 'mutation_idempotency', idemKey);
      const counterRef = doc(db, 'counters', 'exec_count');

      await setDoc(counterRef, { count: 0 });

      // 5 concurrent requests with identical Idempotency-Key
      const results = await Promise.all(
        Array.from({ length: 5 }, async () => {
          return runTransaction(db, async (tx) => {
            const idemSnap = await tx.get(idemRef);
            if (idemSnap.exists()) {
              return { cached: true, ...idemSnap.data() };
            }
            const cSnap = await tx.get(counterRef);
            const nextCount = (cSnap.data()?.count || 0) + 1;
            tx.update(counterRef, { count: nextCount });

            const out = { status: 'created', timestamp: '2026-10-03T00:00:00Z' };
            tx.set(idemRef, out);
            return { cached: false, ...out };
          });
        })
      );

      const freshExecutions = results.filter(r => r.cached === false);
      const cachedExecutions = results.filter(r => r.cached === true);

      expect(freshExecutions).toHaveLength(1);
      expect(cachedExecutions).toHaveLength(4);

      const finalCounter = await getDoc(counterRef);
      expect(finalCounter.data()?.count).toBe(1); // Increment occurred EXACTLY once!
    });
  });
});
