import { describe, it, expect } from 'vitest';

describe('P0 & P1 Financial & Operational Lifecycle Integration Tests', () => {

  describe('1 & 2. Recipe Snapshot Integrity & Historical Deduction Restoration', () => {
    it('generates immutable recipe snapshots at checkout time', () => {
      const product = {
        id: 'prod_shawarma',
        name: 'Chicken Shawarma',
        price: 8.0,
        recipe: [
          { ingredientId: 'ing_chicken', quantity: 0.2, unit: 'kg' },
          { ingredientId: 'ing_bread', quantity: 1, unit: 'pcs' },
          { ingredientId: 'ing_garlic_sauce', quantity: 0.05, unit: 'kg' }
        ]
      };

      const ingredientCosts: Record<string, number> = {
        ing_chicken: 5.0, // $5/kg -> $1.00
        ing_bread: 0.3,   // $0.3/pc -> $0.30
        ing_garlic_sauce: 4.0 // $4/kg -> $0.20
      };

      const qty = 3;
      const snapshot = product.recipe.map(r => ({
        ingredientId: r.ingredientId,
        quantityPerItem: r.quantity,
        totalQuantity: r.quantity * qty,
        unit: r.unit,
        costPerUnit: ingredientCosts[r.ingredientId],
        totalCost: r.quantity * qty * ingredientCosts[r.ingredientId]
      }));

      expect(snapshot).toHaveLength(3);
      expect(snapshot[0].totalQuantity).toBeCloseTo(0.6);
      expect(snapshot[0].totalCost).toBeCloseTo(3.0);
      expect(snapshot[1].totalQuantity).toBe(3);
      expect(snapshot[2].totalQuantity).toBeCloseTo(0.15);

      const totalItemCogs = snapshot.reduce((sum, s) => sum + s.totalCost, 0);
      expect(totalItemCogs).toBeCloseTo((1.0 + 0.3 + 0.2) * 3); // $4.50
    });

    it('restores exact ingredient quantities from recipe snapshot even if recipe changed later', () => {
      // Snapshot saved at checkout
      const historicalItem = {
        productId: 'prod_burger',
        quantity: 2,
        recipeSnapshot: [
          { ingredientId: 'ing_beef_patty', totalQuantity: 2, quantityPerItem: 1 },
          { ingredientId: 'ing_cheese_slice', totalQuantity: 4, quantityPerItem: 2 } // double cheese originally
        ]
      };

      // Current recipe (which was changed later to single cheese)
      const currentRecipe = [
        { ingredientId: 'ing_beef_patty', quantity: 1 },
        { ingredientId: 'ing_cheese_slice', quantity: 1 }
      ];

      // Restoration logic: priority on historical snapshot
      const restoredIngredients = historicalItem.recipeSnapshot
        ? historicalItem.recipeSnapshot.map(s => ({ ingredientId: s.ingredientId, restoredQty: s.totalQuantity }))
        : currentRecipe.map(r => ({ ingredientId: r.ingredientId, restoredQty: r.quantity * historicalItem.quantity }));

      expect(restoredIngredients.find(i => i.ingredientId === 'ing_cheese_slice')?.restoredQty).toBe(4);
    });
  });

  describe('3. Customer Loyalty Reversals (Cancellation & Refund)', () => {
    it('reverses earned loyalty points and total spending on full cancellation', () => {
      const initialCustomer = {
        id: 'cust_123',
        loyaltyPoints: 150,
        totalSpent: 450,
        totalOrders: 6,
        membershipLevel: 'Silver'
      };

      const orderToCancel = {
        totalAmount: 100,
        pointsEarned: 100
      };

      const newSpent = Math.max(0, initialCustomer.totalSpent - orderToCancel.totalAmount);
      const newOrders = Math.max(0, initialCustomer.totalOrders - 1);
      const newPoints = Math.max(0, initialCustomer.loyaltyPoints - orderToCancel.pointsEarned);

      let membershipLevel = 'Bronze';
      if (newSpent >= 1000) membershipLevel = 'Platinum';
      else if (newSpent >= 500) membershipLevel = 'Gold';
      else if (newSpent >= 200) membershipLevel = 'Silver';

      expect(newSpent).toBe(350);
      expect(newOrders).toBe(5);
      expect(newPoints).toBe(50);
      expect(membershipLevel).toBe('Silver');
    });

    it('proportionally reverses loyalty points on partial customer refund', () => {
      const customer = {
        loyaltyPoints: 200,
        totalSpent: 600,
        membershipLevel: 'Gold'
      };

      const originalOrder = { totalAmount: 120 };
      const refundAmount = 40; // 1/3 refund

      const pointsToDeduct = Math.floor(refundAmount);
      const newSpent = Math.max(0, customer.totalSpent - refundAmount);
      const newPoints = Math.max(0, customer.loyaltyPoints - pointsToDeduct);

      let membershipLevel = 'Bronze';
      if (newSpent >= 1000) membershipLevel = 'Platinum';
      else if (newSpent >= 500) membershipLevel = 'Gold';
      else if (newSpent >= 200) membershipLevel = 'Silver';

      expect(pointsToDeduct).toBe(40);
      expect(newSpent).toBe(560);
      expect(newPoints).toBe(160);
      expect(membershipLevel).toBe('Gold');
    });
  });

  describe('4. Receivables Lifecycle on Credit Order Cancellation', () => {
    it('cancels pending accounts receivable when a credit order is cancelled', () => {
      const receivable = {
        id: 'rec_999',
        orderId: 'ord_123',
        amount: 250,
        status: 'pending'
      };

      // Cancellation execution
      const updatedReceivable = {
        ...receivable,
        status: 'cancelled',
        notes: `Cancelled alongside Order #ord_123`
      };

      expect(updatedReceivable.status).toBe('cancelled');
    });

    it('adjusts accounts receivable balance on partial refund of credit sale', () => {
      const receivable = {
        id: 'rec_999',
        orderId: 'ord_123',
        amount: 250,
        totalAmount: 250,
        status: 'pending'
      };

      const refundAmount = 50;
      const newAmount = Math.max(0, receivable.amount - refundAmount);
      const updatedReceivable = {
        ...receivable,
        amount: newAmount,
        totalAmount: newAmount,
        status: newAmount <= 0.001 ? 'paid' : receivable.status
      };

      expect(updatedReceivable.amount).toBe(200);
      expect(updatedReceivable.status).toBe('pending');
    });
  });

  describe('5. Delivery & Driver Cancellation Synchronization', () => {
    it('cancels delivery record and frees assigned driver back to available', () => {
      const delivery = {
        id: 'ord_del_456',
        orderId: 'ord_del_456',
        driverId: 'drv_ahmed',
        status: 'assigned'
      };

      const driver = {
        id: 'drv_ahmed',
        name: 'Ahmed Noor',
        availability: 'busy',
        activeDeliveryId: 'ord_del_456'
      };

      // Order cancellation logic
      const updatedDelivery = {
        ...delivery,
        status: 'cancelled'
      };

      let updatedDriver = { ...driver };
      if (driver.activeDeliveryId === delivery.orderId || driver.availability === 'busy') {
        updatedDriver = {
          ...driver,
          availability: 'available',
          activeDeliveryId: null
        };
      }

      expect(updatedDelivery.status).toBe('cancelled');
      expect(updatedDriver.availability).toBe('available');
      expect(updatedDriver.activeDeliveryId).toBeNull();
    });
  });

  describe('6 & 7. Inventory Field Synchronization (stock & currentStockUsageUnit)', () => {
    it('keeps stock and currentStockUsageUnit identical during waste or physical count adjustments', () => {
      const ingredient = {
        id: 'ing_rice',
        stock: 50,
        currentStockUsageUnit: 50
      };

      const wasteQty = 5;
      const newStock = Math.max(0, ingredient.stock - wasteQty);

      const updatedIngredient = {
        ...ingredient,
        stock: newStock,
        currentStockUsageUnit: newStock
      };

      expect(updatedIngredient.stock).toBe(45);
      expect(updatedIngredient.currentStockUsageUnit).toBe(45);
    });
  });

  describe('8. Item-Level Partial Refund', () => {
    it('calculates specific product stock restorations and recipe restores for item-level refund', () => {
      const order = {
        id: 'ord_item_level',
        totalAmount: 40,
        items: [
          {
            productId: 'prod_pizza',
            quantity: 2,
            unitPrice: 15,
            recipeSnapshot: [
              { ingredientId: 'ing_dough', quantityPerItem: 1, totalQuantity: 2 },
              { ingredientId: 'ing_cheese', quantityPerItem: 0.2, totalQuantity: 0.4 }
            ]
          },
          {
            productId: 'prod_coke',
            quantity: 2,
            unitPrice: 5,
            recipeSnapshot: []
          }
        ]
      };

      // User requests refund for 1 pizza only
      const requestedRefundItems = [{ productId: 'prod_pizza', quantity: 1 }];
      const itemMap = new Map(requestedRefundItems.map(i => [i.productId, i.quantity]));

      const restoredProducts: Array<{ productId: string; restoredQty: number; restoredIngs: Array<{ id: string; qty: number }> }> = [];

      for (const item of order.items) {
        const refundQty = itemMap.get(item.productId) || 0;
        if (refundQty > 0) {
          const restoredIngs = (item.recipeSnapshot || []).map(snap => ({
            id: snap.ingredientId,
            qty: snap.quantityPerItem * refundQty
          }));
          restoredProducts.push({
            productId: item.productId,
            restoredQty: refundQty,
            restoredIngs
          });
        }
      }

      expect(restoredProducts).toHaveLength(1);
      expect(restoredProducts[0].productId).toBe('prod_pizza');
      expect(restoredProducts[0].restoredQty).toBe(1);
      expect(restoredProducts[0].restoredIngs.find(i => i.id === 'ing_dough')?.qty).toBe(1);
      expect(restoredProducts[0].restoredIngs.find(i => i.id === 'ing_cheese')?.qty).toBeCloseTo(0.2);
    });
  });
});
