import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { db, COLLECTIONS, recordInventoryMovementFirestore, getEffectiveBranchId, getAuthToken } from '../../lib/firebase';
import { IRecipeRepository } from '../../domain/repositories/IRecipeRepository';
import {
  Recipe,
  RecipeItem,
  RecipeVersionHistory,
  Ingredient,
  IngredientMovement,
  UnitConversion,
  StockCount,
  WasteRecord,
  ConsumptionStat,
  IngredientForecast,
  FoodCostDashboardData
} from '../../domain/entities/recipe';
import { UnitConversionEngine } from '../../lib/unitConversionEngine';
import { getApiUrl } from '../../lib/apiConfig';

// Canonical Collections
const RECIPES_COLL = 'recipes';
const RECIPE_VERSIONS_COLL = 'recipe_versions';
const INGREDIENTS_COLL = 'ingredients';
const INGREDIENT_MOVEMENTS_COLL = 'inventory_movements';
const UNIT_CONVERSIONS_COLL = 'unit_conversions';
const STOCK_COUNTS_COLL = 'stock_counts';
const WASTE_RECORDS_COLL = 'kitchen_waste';

export class RecipeRepositoryImpl implements IRecipeRepository {
  // ==========================================
  // RECIPES
  // ==========================================
  async fetchRecipes(branchId?: string): Promise<Recipe[]> {
    try {
      const q = branchId && branchId !== 'all'
        ? query(collection(db, RECIPES_COLL), where('branchId', '==', branchId), orderBy('productName', 'asc'))
        : query(collection(db, RECIPES_COLL), orderBy('productName', 'asc'));
      const snap = await getDocs(q);
      const list: Recipe[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Recipe));
      return list;
    } catch (err: any) {
      console.warn('Note fetching recipes:', err?.message || err);
      return [];
    }
  }

  subscribeRecipes(callback: (recipes: Recipe[]) => void, branchId?: string): () => void {
    const q = branchId && branchId !== 'all'
      ? query(collection(db, RECIPES_COLL), where('branchId', '==', branchId), orderBy('productName', 'asc'))
      : query(collection(db, RECIPES_COLL), orderBy('productName', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        const list: Recipe[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Recipe));
        callback(list);
      },
      (err) => {
        console.warn('Note subscribing recipes:', err?.message || err);
      }
    );
  }

  async getRecipeById(id: string): Promise<Recipe | null> {
    try {
      const ref = doc(db, RECIPES_COLL, id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as Recipe;
      }
      return null;
    } catch {
      return null;
    }
  }

  async getRecipeByProductId(productId: string): Promise<Recipe | null> {
    try {
      const branchId = getEffectiveBranchId();
      const q = query(collection(db, RECIPES_COLL), where('productId', '==', productId), where('branchId', '==', branchId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        return { id: docSnap.id, ...docSnap.data() } as Recipe;
      }
      return null;
    } catch {
      return null;
    }
  }

  async createRecipe(recipeData: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>): Promise<Recipe> {
    const token = await getAuthToken();
    const idempotencyKey = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const response = await fetch(getApiUrl('/api/recipes'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ recipeData })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Recipe creation failed (${response.status})`);
    return data.recipe || data;
  }

  async updateRecipe(
    id: string,
    recipeData: Partial<Recipe>,
    changeReason?: string,
    changedBy?: string
  ): Promise<void> {
    const token = await getAuthToken();
    const idempotencyKey = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const response = await fetch(getApiUrl(`/api/recipes/${encodeURIComponent(id)}/update`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ recipeData: { ...recipeData, changeReason, changedBy } })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Recipe update failed (${response.status})`);
  }

  async deleteRecipe(id: string): Promise<void> {
    const token = await getAuthToken();
    const idempotencyKey = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const response = await fetch(getApiUrl(`/api/recipes/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Recipe deletion failed (${response.status})`);
  }

  async fetchRecipeHistory(recipeId: string): Promise<RecipeVersionHistory[]> {
    try {
      const branchId = getEffectiveBranchId();
      const q = query(
        collection(db, RECIPE_VERSIONS_COLL),
        where('recipeId', '==', recipeId),
        where('branchId', '==', branchId)
      );
      const snap = await getDocs(q);
      const list: RecipeVersionHistory[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as RecipeVersionHistory));
      return list.sort((a, b) => b.version - a.version);
    } catch {
      return [];
    }
  }

  // ==========================================
  // INGREDIENTS
  // ==========================================
  async fetchIngredients(branchId?: string): Promise<Ingredient[]> {
    try {
      const q = branchId && branchId !== 'all'
        ? query(collection(db, INGREDIENTS_COLL), where('branchId', '==', branchId), orderBy('name', 'asc'))
        : query(collection(db, INGREDIENTS_COLL), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      const list: Ingredient[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Ingredient));
      return list;
    } catch {
      return [];
    }
  }

  subscribeIngredients(callback: (ingredients: Ingredient[]) => void, branchId?: string): () => void {
    const q = branchId && branchId !== 'all'
      ? query(collection(db, INGREDIENTS_COLL), where('branchId', '==', branchId), orderBy('name', 'asc'))
      : query(collection(db, INGREDIENTS_COLL), orderBy('name', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        const list: Ingredient[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Ingredient));
        callback(list);
      },
      (err) => console.warn('Note subscribing ingredients:', err?.message || err)
    );
  }

  async createIngredient(
    ingredientData: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Ingredient> {
    const ref = doc(collection(db, INGREDIENTS_COLL));
    const now = new Date().toISOString();

    const costPerUsageUnit = ingredientData.conversionFactor > 0
      ? ingredientData.purchaseCost / ingredientData.conversionFactor
      : ingredientData.purchaseCost;

    const status =
      ingredientData.currentStockUsageUnit <= 0
        ? 'out_of_stock'
        : ingredientData.currentStockUsageUnit <= ingredientData.minStockUsageUnit
        ? 'low_stock'
        : 'in_stock';

    const requestedOpeningStock = Number(ingredientData.currentStockUsageUnit || 0);
    if (!Number.isFinite(requestedOpeningStock) || requestedOpeningStock < 0) {
      throw new Error('Initial ingredient stock must be a finite non-negative number.');
    }

    // Firestore rules intentionally forbid client-side stock initialization.
    // Create the master record at zero, then establish any opening balance through
    // the trusted inventory adjustment endpoint so stock + movement stay authoritative.
    const newIng: Ingredient = {
      ...ingredientData,
      currentStockUsageUnit: 0,
      id: ref.id,
      costPerUsageUnit,
      status: 'out_of_stock',
      createdAt: now,
      updatedAt: now
    };

    await setDoc(ref, newIng);

    if (requestedOpeningStock > 0) {
      const token = await getAuthToken();
      const idempotencyKey = `ingredient-opening:${ref.id}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
      const res = await fetch(getApiUrl('/api/inventory/adjust'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          movementData: {
            type: 'adjustment',
            itemType: 'ingredient',
            itemId: ref.id,
            mode: 'set',
            quantity: requestedOpeningStock,
            reason: 'Initial Ingredient Stocking',
            idempotencyKey
          }
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to initialize ingredient stock: HTTP ${res.status}`);
      }
      newIng.currentStockUsageUnit = requestedOpeningStock;
      newIng.status = requestedOpeningStock <= (ingredientData.minStockUsageUnit || 0) ? 'low_stock' : 'in_stock';
    }

    return newIng;
  }

  async updateIngredient(id: string, ingredientData: Partial<Ingredient>): Promise<void> {
    const ref = doc(db, INGREDIENTS_COLL, id);
    const now = new Date().toISOString();

    const { currentStockUsageUnit: _clientStock, stock: _clientStockLegacy, status: _clientStatus, branchId: _clientBranch, ...safeIngredientData } = ingredientData as any;
    const updates: any = { ...safeIngredientData, updatedAt: now };

    // Recalculate cost per usage unit if purchaseCost or conversionFactor updated
    if (ingredientData.purchaseCost !== undefined || ingredientData.conversionFactor !== undefined) {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const cur = snap.data();
        const pCost = ingredientData.purchaseCost ?? cur.purchaseCost;
        const cFactor = ingredientData.conversionFactor ?? cur.conversionFactor;
        updates.costPerUsageUnit = cFactor > 0 ? pCost / cFactor : pCost;
      }
    }

    // Recalculate status if stock updated
    if (ingredientData.currentStockUsageUnit !== undefined) {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const cur = snap.data();
        const minStock = Number(ingredientData.minStockUsageUnit ?? cur.minStockUsageUnit ?? 0);
        updates.status =
          ingredientData.currentStockUsageUnit <= 0
            ? 'out_of_stock'
            : ingredientData.currentStockUsageUnit <= minStock
            ? 'low_stock'
            : 'in_stock';
      }
    }

    await updateDoc(ref, updates);

    // If purchase cost changed, auto-recalculate recipes that use this ingredient!
    if (ingredientData.purchaseCost !== undefined || updates.costPerUsageUnit !== undefined) {
      this.recalculateRecipeCostsForIngredient(id, updates.costPerUsageUnit);
    }
  }

  async deleteIngredient(id: string): Promise<void> {
    await updateDoc(doc(db, INGREDIENTS_COLL, id), {
      isActive: false,
      isArchived: true,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any);
  }

  private async recalculateRecipeCostsForIngredient(ingredientId: string, newCostPerUsageUnit: number) {
    try {
      const recipes = await this.fetchRecipes();
      for (const recipe of recipes) {
        let updated = false;
        const newItems = recipe.items.map((item) => {
          if (item.ingredientId === ingredientId) {
            updated = true;
            const costPerUnit = newCostPerUsageUnit;
            const totalCost = item.quantity * costPerUnit;
            return { ...item, costPerUnit, totalCost };
          }
          return item;
        });

        if (updated) {
          const totalCost = newItems.reduce((sum, i) => sum + i.totalCost, 0);
          const costPerPortion = recipe.yieldQuantity > 0 ? totalCost / recipe.yieldQuantity : totalCost;
          const foodCostPercentage = recipe.sellingPrice > 0 ? (costPerPortion / recipe.sellingPrice) * 100 : 0;
          const grossProfit = recipe.sellingPrice - costPerPortion;
          const grossProfitMargin = recipe.sellingPrice > 0 ? (grossProfit / recipe.sellingPrice) * 100 : 0;

          await this.updateRecipe(recipe.id, {
            items: newItems,
            totalCost,
            costPerPortion,
            foodCostPercentage,
            grossProfit,
            grossProfitMargin
          }, `Automatic cost recalculation after ingredient ${ingredientId} cost update`, 'System');
        }
      }
    } catch (err) {
      console.warn('Note recalculating recipes for ingredient:', err);
    }
  }

  // ==========================================
  // INGREDIENT MOVEMENTS & AUTO DEDUCTION
  // ==========================================
  async fetchIngredientMovements(ingredientId?: string): Promise<IngredientMovement[]> {
    try {
      const branchId = getEffectiveBranchId();
      let q = query(collection(db, INGREDIENT_MOVEMENTS_COLL), where('branchId', '==', branchId), orderBy('createdAt', 'desc'));
      if (ingredientId) {
        q = query(
          collection(db, INGREDIENT_MOVEMENTS_COLL),
          where('ingredientId', '==', ingredientId),
          where('branchId', '==', branchId),
          orderBy('createdAt', 'desc')
        );
      }
      const snap = await getDocs(q);
      const list: IngredientMovement[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as IngredientMovement));
      return list;
    } catch {
      return [];
    }
  }

  subscribeIngredientMovements(callback: (movements: IngredientMovement[]) => void): () => void {
    let q;
    try {
      q = query(collection(db, INGREDIENT_MOVEMENTS_COLL), where('branchId', '==', getEffectiveBranchId()), orderBy('createdAt', 'desc'));
    } catch {
      return () => {};
    }
    return onSnapshot(
      q,
      (snap) => {
        const list: IngredientMovement[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as IngredientMovement));
        callback(list);
      },
      (err) => console.warn('Note subscribing movements:', err?.message || err)
    );
  }

  /**
   * AUTOMATIC INVENTORY DEDUCTION ENGINE
   * Called when an order is completed. For each order item, finds its recipe and deducts all ingredients from stock.
   */
  async deductRecipeIngredientsForOrder(
    orderItems: Array<{ productId: string; productName: string; quantity: number }>,
    orderNumber: string,
    createdBy: string
  ): Promise<void> {
    try {
      const customConversions = await this.fetchUnitConversions();
      const now = new Date().toISOString();

      for (const orderItem of orderItems) {
        const recipe = await this.getRecipeByProductId(orderItem.productId);
        if (!recipe || !recipe.items || recipe.items.length === 0) continue;

        for (const recipeItem of recipe.items) {
          const ingRef = doc(db, INGREDIENTS_COLL, recipeItem.ingredientId);
          const ingSnap = await getDoc(ingRef);

          if (!ingSnap.exists()) continue;
          const ingData = ingSnap.data() as Ingredient;

          // Quantity required per order = recipeItem.quantity * orderItem.quantity
          const recipeQuantityTotal = recipeItem.quantity * orderItem.quantity;

          // Convert recipe quantity unit to ingredient usageUnit if different
          const deductedInUsageUnit = UnitConversionEngine.convert(
            recipeQuantityTotal,
            recipeItem.unit,
            ingData.usageUnit,
            customConversions,
            ingData.id
          );

          const previousStock = ingData.currentStockUsageUnit || 0;
          const newStock = previousStock - deductedInUsageUnit;
          if (newStock < 0) {
            throw new Error(`Insufficient stock for ${ingData.name}.`);
          }

          // Automatic order deductions must be executed atomically by the trusted backend.
          // This legacy repository method is retained for interface compatibility, but refuses to
          // perform a partial client-side stock write that could diverge from POS/Accounting.
          if (newStock < 0) {
            throw new Error(`Insufficient stock for ${ingData.name}.`);
          }
          const token = await (await import('../../lib/firebase')).getAuthToken();
          const response = await fetch((await import('../../lib/firebase')).getApiUrl('/api/inventory/adjust'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              movementData: {
                type: 'order_deduction',
                mode: 'delta',
                itemType: 'ingredient',
                itemId: ingData.id,
                itemName: ingData.name,
                quantity: deductedInUsageUnit,
                reason: `Auto-deduction for ${orderItem.quantity}x ${orderItem.productName} (Order #${orderNumber})`,
                createdBy: createdBy || 'POS System'
              }
            })
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Trusted ingredient deduction failed (${response.status}).`);
          }
        }
      }
    } catch (err) {
      console.warn('Note during automatic ingredient deduction:', err);
    }
  }

  // ==========================================
  // UNIT CONVERSIONS
  // ==========================================
  async fetchUnitConversions(): Promise<UnitConversion[]> {
    try {
      const branchId = getEffectiveBranchId();
      const q = query(collection(db, UNIT_CONVERSIONS_COLL), where('branchId', '==', branchId));
      const snap = await getDocs(q);
      const list: UnitConversion[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as UnitConversion));
      return list;
    } catch {
      return [];
    }
  }

  subscribeUnitConversions(callback: (conversions: UnitConversion[]) => void): () => void {
    let q;
    try {
      q = query(collection(db, UNIT_CONVERSIONS_COLL), where('branchId', '==', getEffectiveBranchId()));
    } catch {
      return () => {};
    }
    return onSnapshot(
      q,
      (snap) => {
        const list: UnitConversion[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as UnitConversion));
        callback(list);
      },
      (err) => console.warn('Note subscribing unit conversions:', err?.message || err)
    );
  }

  async createUnitConversion(
    data: Omit<UnitConversion, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<UnitConversion> {
    const ref = doc(collection(db, UNIT_CONVERSIONS_COLL));
    const now = new Date().toISOString();
    const newConv: UnitConversion = {
      ...data,
      branchId: (data as any).branchId || getEffectiveBranchId(),
      id: ref.id,
      createdAt: now,
      updatedAt: now
    };
    await setDoc(ref, newConv);
    return newConv;
  }

  async deleteUnitConversion(id: string): Promise<void> {
    await deleteDoc(doc(db, UNIT_CONVERSIONS_COLL, id));
  }

  // ==========================================
  // STOCK COUNTING
  // ==========================================
  async fetchStockCounts(): Promise<StockCount[]> {
    try {
      const branchId = getEffectiveBranchId();
      const q = query(collection(db, STOCK_COUNTS_COLL), where('branchId', '==', branchId), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list: StockCount[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as StockCount));
      return list;
    } catch {
      return [];
    }
  }

  async createStockCount(data: Omit<StockCount, 'id' | 'createdAt' | 'updatedAt'>): Promise<StockCount> {
    const ref = doc(collection(db, STOCK_COUNTS_COLL));
    const now = new Date().toISOString();

    const countNumber = `STK-${Math.floor(10000 + Math.random() * 90000)}`;
    const newCount: StockCount = {
      ...data,
      branchId: (data as any).branchId || getEffectiveBranchId(),
      id: ref.id,
      countNumber: data.countNumber || countNumber,
      createdAt: now,
      updatedAt: now
    };

    await setDoc(ref, newCount);
    return newCount;
  }

  async applyStockCountAdjustment(stockCountId: string, user: string): Promise<void> {
    const ref = doc(db, STOCK_COUNTS_COLL, stockCountId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const countData = snap.data() as StockCount;
    const now = new Date().toISOString();

    if (countData.status === 'adjusted') return;

    for (const [index, item] of countData.items.entries()) {
      if (item.difference !== 0) {
        const ingRef = doc(db, INGREDIENTS_COLL, item.ingredientId);
        const ingSnap = await getDoc(ingRef);
        if (ingSnap.exists()) {
          const ingData = ingSnap.data() as Ingredient;
          const token = await (await import('../../lib/firebase')).getAuthToken();
          const idempotencyKey = `stock-count:${stockCountId}:${index}:${item.ingredientId}`;
          const response = await fetch((await import('../../lib/firebase')).getApiUrl('/api/inventory/adjust'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': idempotencyKey,
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              movementData: {
                type: item.difference < 0 ? 'out' : 'in',
                mode: 'delta',
                itemType: 'ingredient',
                itemId: ingData.id || item.ingredientId,
                itemName: ingData.name || item.ingredientName,
                quantity: Math.abs(item.difference),
                reason: `Physical Stock Count Adjustment (${item.difference > 0 ? '+' : ''}${item.difference} ${item.unit})`,
                createdBy: user,
                idempotencyKey
              }
            })
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Stock count adjustment failed (${response.status}).`);
          }
        }
      }
    }

    await updateDoc(ref, {
      status: 'adjusted',
      updatedAt: now
    });
  }

  // ==========================================
  // WASTE MANAGEMENT
  // ==========================================
  async fetchWasteRecords(branchId?: string): Promise<WasteRecord[]> {
    try {
      const q = branchId && branchId !== 'all'
        ? query(collection(db, WASTE_RECORDS_COLL), where('branchId', '==', branchId), orderBy('createdAt', 'desc'))
        : query(collection(db, WASTE_RECORDS_COLL), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list: WasteRecord[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as WasteRecord));
      return list;
    } catch {
      return [];
    }
  }

  subscribeWasteRecords(callback: (records: WasteRecord[]) => void, branchId?: string): () => void {
    const q = branchId && branchId !== 'all'
      ? query(collection(db, WASTE_RECORDS_COLL), where('branchId', '==', branchId), orderBy('createdAt', 'desc'))
      : query(collection(db, WASTE_RECORDS_COLL), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const list: WasteRecord[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as WasteRecord));
        callback(list);
      },
      (err) => console.warn('Note subscribing waste records:', err?.message || err)
    );
  }

  async recordWaste(data: Omit<WasteRecord, 'id' | 'createdAt'>): Promise<WasteRecord> {
    const token = await getAuthToken();
    const idempotencyKey = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const response = await fetch(getApiUrl('/api/kitchen/waste'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        wasteData: {
          itemId: data.ingredientId,
          itemType: 'ingredient',
          quantity: data.quantity,
          unit: data.unit,
          reason: data.reason,
          notes: data.notes,
          cost: data.totalCost,
          branchId: (data as any).branchId || getEffectiveBranchId()
        }
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || `Kitchen waste logging failed (${response.status})`);
    }
    return (result.waste || result.wasteRecord || result) as WasteRecord;
  }

  // ==========================================
  // ANALYTICS & FORECASTING
  // ==========================================
  async getConsumptionAnalytics(): Promise<ConsumptionStat[]> {
    const ingredients = await this.fetchIngredients();
    const movements = await this.fetchIngredientMovements();

    const statsMap: Record<string, ConsumptionStat> = {};

    ingredients.forEach((ing) => {
      statsMap[ing.id] = {
        ingredientId: ing.id,
        ingredientName: ing.name,
        unit: ing.usageUnit,
        totalQuantityUsed: 0,
        totalCost: 0,
        averageDailyUsage: 0,
        averageMonthlyUsage: 0,
        movementCount: 0,
        movementType: 'moderate'
      };
    });

    movements.forEach((m) => {
      if ((m.type === 'order_deduction' || m.type === 'waste') && m.quantity < 0) {
        const ingId = m.ingredientId;
        if (statsMap[ingId]) {
          const used = Math.abs(m.quantity);
          statsMap[ingId].totalQuantityUsed += used;
          statsMap[ingId].totalCost += m.cost || 0;
          statsMap[ingId].movementCount += 1;
        }
      }
    });

    return Object.values(statsMap).map((s) => {
      const avgDaily = Number((s.totalQuantityUsed / 30).toFixed(2));
      const avgMonthly = Number(s.totalQuantityUsed.toFixed(2));
      const movementType =
        avgDaily > 500 ? 'fast' : avgDaily < 50 ? 'slow' : 'moderate';

      return {
        ...s,
        averageDailyUsage: avgDaily,
        averageMonthlyUsage: avgMonthly,
        movementType
      };
    });
  }

  async getIngredientForecasts(): Promise<IngredientForecast[]> {
    const ingredients = await this.fetchIngredients();
    const analytics = await this.getConsumptionAnalytics();
    const analyticsMap = new Map(analytics.map((a) => [a.ingredientId, a]));

    return ingredients.map((ing) => {
      const stat = analyticsMap.get(ing.id);
      const avgDaily = stat && stat.averageDailyUsage > 0 ? stat.averageDailyUsage : 0;
      const currentStock = ing.currentStockUsageUnit || 0;

      const daysRemaining = avgDaily > 0 ? Math.max(0, Math.floor(currentStock / avgDaily)) : 0;
      const expected30Days = Number((avgDaily * 30).toFixed(2));
      const suggestedReorder = Math.max(0, expected30Days - currentStock + ing.minStockUsageUnit);

      let reorderStatus: IngredientForecast['reorderStatus'] = 'normal';
      let purchaseRecommendation = avgDaily > 0 ? 'Stock level is healthy.' : 'Insufficient consumption history to forecast demand.';

      if (avgDaily > 0 && daysRemaining <= 3) {
        reorderStatus = 'urgent';
        purchaseRecommendation = `URGENT: Reorder at least ${suggestedReorder} ${ing.usageUnit} immediately! Only ${daysRemaining} days remaining.`;
      } else if (avgDaily > 0 && daysRemaining <= 7) {
        reorderStatus = 'warning';
        purchaseRecommendation = `WARNING: Reorder ${suggestedReorder} ${ing.usageUnit} soon. Stock covers ${daysRemaining} days.`;
      } else if (avgDaily > 0 && daysRemaining > 60) {
        reorderStatus = 'overstocked';
        purchaseRecommendation = 'Stock level high. Reduce upcoming purchase orders.';
      }

      return {
        ingredientId: ing.id,
        ingredientName: ing.name,
        currentStock,
        unit: ing.usageUnit,
        averageDailyUsage: avgDaily,
        daysRemaining,
        suggestedReorderQuantity: Math.ceil(suggestedReorder),
        expectedConsumptionNext30Days: expected30Days,
        reorderStatus,
        purchaseRecommendation
      };
    });
  }

  async getFoodCostDashboardData(): Promise<FoodCostDashboardData> {
    const recipes = await this.fetchRecipes();
    const wasteRecords = await this.fetchWasteRecords();
    const ingredients = await this.fetchIngredients();

    const totalRecipesCount = recipes.length;
    const avgFc =
      recipes.length > 0
        ? recipes.reduce((sum, r) => sum + r.foodCostPercentage, 0) / recipes.length
        : 0;

    let highest: { name: string; foodCostPercentage: number } | null = null;
    let lowest: { name: string; foodCostPercentage: number } | null = null;

    recipes.forEach((r) => {
      if (!highest || r.foodCostPercentage > highest.foodCostPercentage) {
        highest = { name: r.productName, foodCostPercentage: r.foodCostPercentage };
      }
      if (!lowest || r.foodCostPercentage < lowest.foodCostPercentage) {
        lowest = { name: r.productName, foodCostPercentage: r.foodCostPercentage };
      }
    });

    const totalWasteCost = wasteRecords.reduce((sum, w) => sum + w.totalCost, 0);

    const totalInventoryValuation = ingredients.reduce((sum, ing) => {
      return sum + (ing.currentStockUsageUnit * ing.costPerUsageUnit);
    }, 0);

    const totalWastePercentage =
      totalInventoryValuation > 0
        ? Number(((totalWasteCost / totalInventoryValuation) * 100).toFixed(2))
        : 0;

    return {
      totalRecipesCount,
      averageFoodCostPercentage: Number(avgFc.toFixed(2)),
      highestCostRecipe: highest,
      lowestCostRecipe: lowest,
      totalWasteCost: Number(totalWasteCost.toFixed(2)),
      totalWastePercentage,
      totalInventoryValuation: Number(totalInventoryValuation.toFixed(2))
    };
  }
}
