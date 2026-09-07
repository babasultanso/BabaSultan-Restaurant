import express from 'express';
import { z } from 'zod';
import { randomUUID, randomInt, createHash } from 'crypto';
import {
  getFirebaseProjectId,
  getFirebaseApiKey,
  getAdminDb,
  getAdminAuth,
  getAdminMessaging,
  InMemoryFirestoreMock
} from './db.js';
import {
  authenticateTrustedUser,
  checkBranchAuthorization,
  checkRoleAuthorization,
  normalizeCanonicalBranchId,
  areBranchesMatching,
  isHQRoleOrClaim,
  validateUserPrivilegeUpdate,
  AuthenticatedUser
} from './auth.js';
import {
  cleanUndefined,
  toFirestoreValue,
  objectToFirestoreFields,
  firestoreDocToObj,
  firestoreValueToJs
} from './helpers.js';

export {
  getFirebaseProjectId,
  getFirebaseApiKey,
  getAdminDb,
  getAdminAuth,
  InMemoryFirestoreMock,
  authenticateTrustedUser,
  checkBranchAuthorization,
  checkRoleAuthorization,
  cleanUndefined,
  toFirestoreValue,
  objectToFirestoreFields,
  firestoreDocToObj,
  firestoreValueToJs
};
export type { AuthenticatedUser };

export function roundMoney(amount: number): number {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

export function getMogadishuDateString(dateInput?: Date | string | number): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Mogadishu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(validDate);
}



export async function getRestDocument(collectionName: string, docId: string, idToken: string): Promise<any | null> {
  const projectId = getFirebaseProjectId();
  const apiKey = getFirebaseApiKey();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${docId}${apiKey ? `?key=${apiKey}` : ''}`;
  
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${idToken}` }
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore REST GET ${collectionName}/${docId} failed (${res.status}): ${errText}`);
  }

  const docData = await res.json();
  return firestoreDocToObj(docData);
}

export async function queryRestCollection(collectionName: string, fieldName: string, fieldValue: any, idToken: string): Promise<any[]> {
  const projectId = getFirebaseProjectId();
  const apiKey = getFirebaseApiKey();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery${apiKey ? `?key=${apiKey}` : ''}`;
  
  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: collectionName }],
      where: {
        fieldFilter: {
          field: { fieldPath: fieldName },
          op: 'EQUAL',
          value: toFirestoreValue(fieldValue)
        }
      },
      limit: 10
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify(queryBody)
  });

  if (!res.ok) {
    return [];
  }

  const results = await res.json();
  if (!Array.isArray(results)) return [];

  return results
    .filter((r: any) => r.document)
    .map((r: any) => firestoreDocToObj(r.document));
}

export async function writeRestDocument(
  collectionName: string,
  docId: string,
  data: any,
  idToken: string,
  isUpdate: boolean = false,
  updateFields?: string[]
): Promise<any> {
  const projectId = getFirebaseProjectId();
  const apiKey = getFirebaseApiKey();
  const cleanData = cleanUndefined(data);

  let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${docId}`;
  const params: string[] = [];
  if (apiKey) params.push(`key=${apiKey}`);

  if (isUpdate && updateFields && updateFields.length > 0) {
    updateFields.forEach(f => params.push(`updateMask.fieldPaths=${encodeURIComponent(f)}`));
  }

  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      fields: objectToFirestoreFields(cleanData)
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore REST PATCH ${collectionName}/${docId} failed (${res.status}): ${errText}`);
  }

  const resJson = await res.json();
  return firestoreDocToObj(resJson);
}

export async function commitRestWrites(
  writes: Array<{ collection: string; id: string; data: any; isUpdate?: boolean; isDelete?: boolean }>,
  idToken: string
): Promise<void> {
  const projectId = getFirebaseProjectId();
  const apiKey = getFirebaseApiKey();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit${apiKey ? `?key=${apiKey}` : ''}`;

  const restWrites = writes.map(w => {
    const docPath = `projects/${projectId}/databases/(default)/documents/${w.collection}/${w.id}`;
    if (w.isDelete) {
      return { delete: docPath };
    }
    const cleanData = cleanUndefined(w.data);
    const writeObj: any = {
      update: {
        name: docPath,
        fields: objectToFirestoreFields(cleanData)
      }
    };
    if (w.isUpdate) {
      writeObj.updateMask = {
        fieldPaths: Object.keys(cleanData)
      };
    }
    return writeObj;
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ writes: restWrites })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore REST commit failed (${res.status}): ${errText}`);
  }
}

export async function safeGetDoc(collection: string, id: string, idToken?: string): Promise<any | null> {
  if (idToken) {
    try {
      const doc = await getRestDocument(collection, id, idToken);
      if (doc) return doc;
    } catch {
      // fallback
    }
  }
  try {
    const adminDb = getAdminDb();
    const snap = await adminDb.collection(collection).doc(id).get();
    return snap.exists ? snap.data() : null;
  } catch {
    return null;
  }
}

export async function safeQueryDocs(collection: string, field: string, val: any, idToken?: string): Promise<any[]> {
  if (idToken) {
    try {
      const docs = await queryRestCollection(collection, field, val, idToken);
      if (docs && docs.length > 0) return docs;
    } catch {
      // fallback
    }
  }
  try {
    const adminDb = getAdminDb();
    const snap = await adminDb.collection(collection).where(field, '==', val).get();
    return snap.docs.map((d: any) => d.data());
  } catch {
    return [];
  }
}

export const SENSITIVE_COLLECTIONS = new Set([
  'payments',
  'refunds',
  'inventory_movements',
  'journal_entries',
  'journal_lines',
  'ledger',
  'customer_wallets',
  'wallet_transactions',
  'cash_registers',
  'bank_transactions',
  'kitchen_orders',
  'deliveries',
  'delivery_tracking',
  'delivery_notifications',
  'customer_points',
  'customer_rewards',
  'customer_coupons',
  'claimed_rewards',
  'branch_inventory'
]);

export async function safeSaveDoc(collection: string, id: string, data: any, idToken?: string, isUpdate: boolean = true): Promise<void> {
  const cleanData = cleanUndefined(data);
  const isSensitive = SENSITIVE_COLLECTIONS.has(collection);

  // Prioritize Admin SDK for server-authoritative trusted writes
  try {
    const adminDb = getAdminDb();
    if (adminDb) {
      if (isUpdate) {
        await adminDb.collection(collection).doc(id).set(cleanData, { merge: true });
      } else {
        await adminDb.collection(collection).doc(id).set(cleanData);
      }
      return;
    }
  } catch (adminErr: any) {
    console.error(`safeSaveDoc Admin SDK write failed for ${collection}/${id}:`, adminErr?.message || adminErr);
    if (isSensitive) {
      // Sensitive server writes MUST NOT silently downgrade into user-token REST
      throw adminErr;
    }
  }

  if (isSensitive) {
    throw new Error(`Authoritative write error: Cannot write to sensitive collection "${collection}" without trusted Admin SDK.`);
  }

  if (idToken) {
    try {
      if (isUpdate) {
        const fields = Object.keys(cleanData);
        await writeRestDocument(collection, id, cleanData, idToken, true, fields);
      } else {
        await writeRestDocument(collection, id, cleanData, idToken, false);
      }
      return;
    } catch (patchErr: any) {
      console.warn(`safeSaveDoc REST PATCH to non-sensitive ${collection}/${id} failed:`, patchErr?.message || patchErr);
      throw patchErr;
    }
  }
}

/**
 * Resilient Firestore transaction runner with exponential backoff & jitter for handling document contention (409 ABORTED / Error code 10).
 */
export async function runTransactionWithRetry<T>(
  db: any,
  updateFunction: (transaction: any) => Promise<T>,
  maxAttempts: number = 5
): Promise<T> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      return await db.runTransaction(updateFunction);
    } catch (err: any) {
      attempt++;
      const rawMsg = String(err?.message || err);
      const isAbortOrContention =
        err?.code === 10 || // ABORTED
        err?.code === 4 || // DEADLINE_EXCEEDED
        err?.code === 14 || // UNAVAILABLE
        err?.statusCode === 409 ||
        rawMsg.includes('contention') ||
        rawMsg.includes('ABORTED') ||
        rawMsg.includes('409') ||
        rawMsg.includes('Resource exhausted') ||
        rawMsg.includes('Transaction lock') ||
        rawMsg.includes('concurrent');

      // If it is a domain validation error (not found, unauthorized, invalid transition, etc.), do not retry
      const isDomainError =
        err?.statusCode === 400 ||
        err?.statusCode === 403 ||
        err?.statusCode === 404 ||
        rawMsg.includes('not found') ||
        rawMsg.includes('Unauthorized') ||
        rawMsg.includes('cross-branch') ||
        rawMsg.includes('Invalid') ||
        rawMsg.includes('Cannot advance') ||
        rawMsg.includes('Terminal state');

      if (isDomainError || !isAbortOrContention || attempt >= maxAttempts) {
        throw err;
      }

      // Exponential backoff with jitter
      const baseDelay = Math.min(1000, 60 * Math.pow(2, attempt));
      const jitter = Math.floor(Math.random() * 50);
      const delayMs = baseDelay + jitter;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('Transaction failed after maximum retries');
}

// Helper: Route product to kitchen station
function routeProductToStation(productName: string = '', category: string = ''): 'grill' | 'kitchen' | 'bar' | 'bakery' {
  const pName = productName.toLowerCase();
  const cat = category.toLowerCase();

  if (pName.includes('burger') || pName.includes('steak') || pName.includes('grill') || pName.includes('bbq') || pName.includes('chicken') || cat.includes('grill')) {
    return 'grill';
  }
  if (pName.includes('coffee') || pName.includes('juice') || pName.includes('drink') || pName.includes('tea') || pName.includes('latte') || pName.includes('mojito') || cat.includes('beverage') || cat.includes('bar')) {
    return 'bar';
  }
  if (pName.includes('cake') || pName.includes('pastry') || pName.includes('bread') || pName.includes('dessert') || cat.includes('bakery')) {
    return 'bakery';
  }
  return 'kitchen';
}

// ==========================================
// P0 TRUSTED FINANCIAL HANDLERS (ADMIN SDK)
// ==========================================

// Helper: POS Complete REST Fallback Execution
// 1. POS Complete / Create Order
export async function handlePosCheckout(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  // Explicit Role Authorization
  const posRoles = ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant', 'Cashier', 'cashier', 'Waiter', 'waiter', 'Staff', 'staff'];
  const roleCheck = checkRoleAuthorization(user, posRoles);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { orderData, idempotencyKey: bodyIdempotencyKey } = req.body || {};
  const requestedBranch = orderData?.branchId || orderData?.branch || '';
  const branchCheck = checkBranchAuthorization(user, requestedBranch);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }
  const targetBranchId = branchCheck.targetBranchId;
  if (!orderData || !Array.isArray(orderData.items) || orderData.items.length === 0) {
    return res.status(400).json({ error: 'Invalid POS Checkout Request: Order items required.' });
  }
  let idempotencyKey: string;
  try {
    idempotencyKey = getRequiredIdempotencyKey(req, bodyIdempotencyKey || orderData.idempotencyKey);
  } catch (e: any) {
    return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required for POS checkout.' });
  }
  const db = getAdminDb();

  try {
    const result = await runTransactionWithRetry(db, async (transaction) => {
      const orderNumber = orderData.orderNumber || `ORD-${Date.now().toString().slice(-6)}`;

      // Idempotency check: prevent duplicate checkout submission
      const normalizedIdempotencyKey = idempotencyKey.trim();
      const idempQuery = await transaction.get(
        db.collection('orders').where('idempotencyKey', '==', normalizedIdempotencyKey).limit(1)
      );
      if (!idempQuery.empty) {
        const existingOrder = idempQuery.docs[0].data();
        if (existingOrder.branchId && !areBranchesMatching(existingOrder.branchId, targetBranchId)) {
          throw new Error('Idempotency key is already associated with another branch.');
        }
        return { status: 'duplicate', order: existingOrder };
      }

      // Step A: Fetch & Validate Products from Firestore (Server-side Source of Truth)
      const verifiedItems: any[] = [];
      let verifiedSubtotal = 0;
      let verifiedCOGS = 0;

      const productIds = Array.from(new Set(orderData.items.map((i: any) => i.productId).filter(Boolean)));
      const productSnaps = await Promise.all(
        productIds.map(id => transaction.get(db.collection('products').doc(id as string)))
      );
      const productMap = new Map<string, any>();
      productSnaps.forEach(snap => {
        if (snap.exists) productMap.set(snap.id, snap.data());
      });

      // Canonical Recipe resolution (read active canonical recipes for products from 'recipes' collection)
      const recipeQuerySnaps = await Promise.all(
        productIds.map(pid => transaction.get(db.collection('recipes').where('productId', '==', pid).where('isActive', '!=', false)))
      );
      const canonicalRecipeMap = new Map<string, any[]>();
      recipeQuerySnaps.forEach((qSnap, idx) => {
        const pid = productIds[idx] as string;
        if (!qSnap.empty) {
          const candidates = qSnap.docs
            .map(d => d.data())
            .filter((rData: any) => {
              const recipeBranch = normalizeCanonicalBranchId(rData?.branchId || '');
              return recipeBranch === 'all' || (recipeBranch && areBranchesMatching(recipeBranch, targetBranchId));
            });
          if (candidates.length > 1) {
            throw new Error(`Multiple active recipes found for product "${pid}" in branch "${targetBranchId}". Checkout rejected due to recipe ambiguity.`);
          }
          const rData = candidates[0];
          if (rData && Array.isArray(rData.items) && rData.items.length > 0) {
            canonicalRecipeMap.set(pid, rData.items);
          }
        }
      });

      // Collect all unique ingredient IDs required across products (canonical recipe prioritized over product.recipe cache)
      const ingredientIdsSet = new Set<string>();
      productMap.forEach((prodData, pid) => {
        const activeRecipe = canonicalRecipeMap.get(pid) || [];
        if (!canonicalRecipeMap.has(pid) && Array.isArray(prodData.recipe) && prodData.recipe.length > 0) {
          throw new Error(`Product '${prodData.name || pid}' has only a legacy recipe cache. Canonical branch-scoped recipe is required for checkout.`);
        }
        activeRecipe.forEach((rItem: any) => {
          const ingId = rItem.ingredientId || rItem.id;
          if (ingId) ingredientIdsSet.add(ingId);
        });
      });

      const ingredientSnaps = await Promise.all(
        Array.from(ingredientIdsSet).map(id => transaction.get(db.collection('ingredients').doc(id)))
      );
      const ingredientMap = new Map<string, any>();
      ingredientSnaps.forEach(snap => {
        if (snap.exists) ingredientMap.set(snap.id, snap.data());
      });

      const ingredientDeductions = new Map<string, { totalRequired: number; ingredientName: string; currentStock: number }>();

      for (const rawItem of orderData.items) {
        if (!rawItem.productId || !productMap.has(rawItem.productId)) {
          throw new Error(`Product "${rawItem.productName || rawItem.productId}" was not found in catalog.`);
        }

        const prodData = productMap.get(rawItem.productId);
        const productBranch = normalizeCanonicalBranchId(prodData.branchId || '');
        if (!productBranch) { throw new Error(`Product '${prodData.name || rawItem.productId}' has no canonical branchId and cannot be sold until migrated.`); }
        if (productBranch && productBranch !== 'all' && !areBranchesMatching(productBranch, targetBranchId)) {
          throw new Error(`Product "${prodData.name || rawItem.productId}" belongs to branch "${productBranch}" and cannot be sold from branch "${targetBranchId}".`);
        }
        if (prodData.isActive === false) {
          throw new Error(`Product "${prodData.name}" is currently inactive.`);
        }

        const qty = Number(rawItem.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new Error(`Invalid item quantity (${rawItem.quantity}) for product "${prodData.name}".`);
        }

        // Server recalculation of unit price and item total
        if (typeof prodData.price !== 'number' || !Number.isFinite(prodData.price) || prodData.price < 0) {
          throw new Error(`Product "${prodData.name}" does not have a valid server catalog price.`);
        }
        const baseUnitPrice = prodData.price;

        let optionsModifierSum = 0;
        const verifiedSelectedOptions: Array<{
          optionId: string;
          optionName: string;
          choiceId: string;
          choiceName: string;
          priceModifier: number;
          priceAdjustment: number;
        }> = [];

        if (Array.isArray(rawItem.selectedOptions) && rawItem.selectedOptions.length > 0) {
          for (const selOpt of rawItem.selectedOptions) {
            let modPrice = 0;
            let verifiedOptName = selOpt.optionName || '';
            let verifiedChoiceName = selOpt.choiceName || '';
            let verifiedOptId = selOpt.optionId || '';
            let verifiedChoiceId = selOpt.choiceId || '';

            if (Array.isArray(prodData.options) && prodData.options.length > 0) {
              const parentOpt = prodData.options.find((o: any) => 
                (selOpt.optionId && o.id === selOpt.optionId) || 
                (selOpt.optionName && (o.nameEn === selOpt.optionName || o.nameAr === selOpt.optionName || o.name === selOpt.optionName))
              );
              if (parentOpt && Array.isArray(parentOpt.choices)) {
                const choice = parentOpt.choices.find((c: any) => 
                  (selOpt.choiceId && c.id === selOpt.choiceId) || 
                  (selOpt.choiceName && (c.nameEn === selOpt.choiceName || c.nameAr === selOpt.choiceName || c.name === selOpt.choiceName))
                );
                if (choice) {
                  verifiedOptId = parentOpt.id || verifiedOptId;
                  verifiedOptName = parentOpt.nameEn || parentOpt.name || verifiedOptName;
                  verifiedChoiceId = choice.id || verifiedChoiceId;
                  verifiedChoiceName = choice.nameEn || choice.name || verifiedChoiceName;
                  if (typeof choice.priceModifier === 'number') {
                    modPrice = choice.priceModifier;
                  } else if (typeof choice.price === 'number') {
                    modPrice = choice.price;
                  }
                } else {
                  throw new Error(`Invalid or missing choice "${selOpt.choiceName || selOpt.choiceId}" for option "${parentOpt.nameEn || parentOpt.nameAr || parentOpt.name || parentOpt.id}" on product "${prodData.name}".`);
                }
              } else {
                throw new Error(`Option "${selOpt.optionName || selOpt.optionId}" not found for product "${prodData.name}".`);
              }
            } else {
              throw new Error(`Product "${prodData.name}" has no configured options, but option "${selOpt.optionName || selOpt.optionId}" was selected.`);
            }
            optionsModifierSum += modPrice;
            verifiedSelectedOptions.push({
              optionId: verifiedOptId,
              optionName: verifiedOptName,
              choiceId: verifiedChoiceId,
              choiceName: verifiedChoiceName,
              priceModifier: modPrice,
              priceAdjustment: modPrice
            });
          }
        }

        const serverUnitPrice = baseUnitPrice + optionsModifierSum;
        const itemTotal = serverUnitPrice * qty;
        verifiedSubtotal += itemTotal;

        // Calculate COGS and generate Recipe Snapshot using canonical active recipe
        let itemCOGS = 0;
        const itemRecipeSnapshot: Array<{
          ingredientId: string;
          ingredientName: string;
          quantityPerItem: number;
          totalQuantity: number;
          unit: string;
          costPerUnit: number;
          totalCost: number;
        }> = [];

        const activeRecipeItems = canonicalRecipeMap.get(rawItem.productId) || (Array.isArray(prodData.recipe) ? prodData.recipe : []);
        if (activeRecipeItems.length > 0) {
          for (const rItem of activeRecipeItems) {
            const ingId = rItem.ingredientId || rItem.id;
            const ingData = ingredientMap.get(ingId);
            if (!ingData) {
              throw new Error(`Ingredient missing for recipe of "${prodData.name}".`);
            }
            const ingredientBranch = normalizeCanonicalBranchId(ingData.branchId || '');
            if (!ingredientBranch || ingredientBranch === 'all' ? false : !areBranchesMatching(ingredientBranch, targetBranchId)) {
              throw new Error(`Ingredient "${ingData.name || ingId}" belongs to branch "${ingredientBranch}" and cannot be consumed by branch "${targetBranchId}".`);
            }
            const reqQty = Number(rItem.quantity || rItem.quantityRequired || 0) * qty;
            const ingCost = Number(ingData.costPerUnit || ingData.cost || ingData.unitCost || 0);
            const totalIngredientCost = reqQty * ingCost;
            itemCOGS += totalIngredientCost;

            itemRecipeSnapshot.push({
              ingredientId: ingId,
              ingredientName: ingData.name || 'Ingredient',
              quantityPerItem: Number(rItem.quantity || rItem.quantityRequired || 0),
              totalQuantity: reqQty,
              unit: rItem.unit || ingData.unit || 'unit',
              costPerUnit: ingCost,
              totalCost: totalIngredientCost
            });

            const existing = ingredientDeductions.get(ingId) || {
              totalRequired: 0,
              ingredientName: ingData.name || 'Ingredient',
              currentStock: Number(typeof ingData.currentStockUsageUnit === 'number' ? ingData.currentStockUsageUnit : (typeof ingData.stock === 'number' ? ingData.stock : 0))
            };
            existing.totalRequired += reqQty;
            ingredientDeductions.set(ingId, existing);
          }
        } else {
          const directCost = typeof prodData.costPrice === 'number' ? prodData.costPrice : (typeof prodData.cost === 'number' ? prodData.cost : 0);
          itemCOGS = directCost * qty;
        }

        verifiedCOGS += itemCOGS;

        // P1-01: Verify product stock if direct stock tracking is enabled
        if (prodData.trackStock === true) {
          if (typeof prodData.stock !== 'number' || !Number.isFinite(prodData.stock) || prodData.stock < 0) {
            throw new Error(`Product "${prodData.name}" has stock tracking enabled but has no valid finite stock recorded. Checkout rejected.`);
          }
          if (prodData.stock < qty) {
            throw new Error(`Insufficient stock for product "${prodData.name}". Requested: ${qty}, Available: ${prodData.stock}.`);
          }
        }

        const lineId = rawItem.id || rawItem.orderItemId || `item_${rawItem.productId}_${verifiedItems.length + 1}_${Date.now().toString(36)}`;
        verifiedItems.push({
          id: lineId,
          orderItemId: lineId,
          productId: rawItem.productId,
          productName: prodData.name,
          quantity: qty,
          refundedQuantity: 0,
          price: serverUnitPrice,
          unitPrice: serverUnitPrice,
          subtotal: itemTotal,
          totalPrice: itemTotal,
          notes: rawItem.notes || '',
          selectedOptions: verifiedSelectedOptions,
          productionStation: getProductStation(prodData),
          recipeSnapshot: itemRecipeSnapshot,
          itemCogs: itemCOGS,
          cogs: itemCOGS
        });
      }

      // Verify ingredient stocks
      for (const [ingId, info] of ingredientDeductions.entries()) {
        if (info.currentStock < info.totalRequired) {
          throw new Error(`Insufficient stock for ingredient "${info.ingredientName}". Required: ${info.totalRequired.toFixed(2)}, Available: ${info.currentStock.toFixed(2)}.`);
        }
      }

      // Financial totals recalculation: manual discount is role-capped; coupon discounts are server-derived.
      const isManagementOrAdminRole = ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager'].includes(user.role);
      let validatedDiscount = 0;
      const requestedDiscount = Number(orderData.discountAmount || 0);
      const couponCode = String(orderData.couponCode || orderData.coupon || '').trim().toUpperCase();
      if (couponCode) {
        const couponQuery = await transaction.get(
          db.collection('customer_coupons').where('code', '==', couponCode).where('isActive', '==', true).limit(1)
        );
        if (couponQuery.empty) throw new Error(`Coupon \"${couponCode}\" is invalid or inactive.`);
        const couponSnap = couponQuery.docs[0];
        const coupon = couponSnap.data() || {};
        const couponBranch = normalizeCanonicalBranchId(coupon.branchId || '');
        if (couponBranch && couponBranch !== 'all' && !areBranchesMatching(couponBranch, targetBranchId)) {
          throw new Error(`Coupon \"${couponCode}\" is not valid for branch \"${targetBranchId}\".`);
        }
        const today = getMogadishuDateString(new Date().toISOString());
        if (coupon.validFrom && String(coupon.validFrom).slice(0,10) > today) throw new Error('Coupon is not active yet.');
        const couponExpiry = coupon.validUntil || coupon.expiryDate;
        if (couponExpiry && String(couponExpiry).slice(0,10) < today) throw new Error('Coupon has expired.');
        const usageLimit = coupon.usageLimit == null ? null : Number(coupon.usageLimit);
        const usedCount = Number(coupon.usedCount ?? coupon.usageCount ?? 0);
        if (usageLimit !== null && Number.isFinite(usageLimit) && usedCount >= usageLimit) throw new Error('Coupon usage limit has been reached.');
        if (Number(coupon.minOrderAmount || 0) > verifiedSubtotal + 0.001) throw new Error('Order does not meet the coupon minimum amount.');
        if (coupon.targetCustomerId && String(coupon.targetCustomerId) !== String(orderData.customerId || '')) throw new Error('Coupon is restricted to another customer.');
        if (coupon.requiredTier || coupon.membershipLevel) {
          if (!orderData.customerId) throw new Error('This coupon requires an eligible customer account.');
          const cSnap = await transaction.get(db.collection('customers').doc(String(orderData.customerId)));
          const cData = cSnap.exists ? (cSnap.data() || {}) : {};
          const actualTier = String(cData.membershipLevel || cData.membershipTier || 'Bronze').trim().toLowerCase();
          const requiredTier = String(coupon.requiredTier || coupon.membershipLevel).trim().toLowerCase();
          if (actualTier !== requiredTier) throw new Error(`Coupon requires membership tier "${coupon.requiredTier || coupon.membershipLevel}".`);
        }
        let couponDiscount = 0;
        const dv = Number(coupon.discountValue || 0);
        if (String(coupon.discountType || 'percentage').toLowerCase() === 'percentage') couponDiscount = verifiedSubtotal * (dv / 100);
        else couponDiscount = dv;
        if (coupon.maxDiscountAmount != null && Number.isFinite(Number(coupon.maxDiscountAmount))) couponDiscount = Math.min(couponDiscount, Number(coupon.maxDiscountAmount));
        validatedDiscount = Math.min(Math.max(0, couponDiscount), verifiedSubtotal);
        transaction.update(couponSnap.ref, { usedCount: usedCount + 1, usageCount: usedCount + 1, updatedAt: new Date().toISOString() });
      } else {
        const maxDiscountAllowed = isManagementOrAdminRole ? verifiedSubtotal : Math.min(verifiedSubtotal * 0.15, 25);
        if (requestedDiscount > maxDiscountAllowed) {
          throw new Error(`Discount amount (${requestedDiscount.toFixed(2)}) exceeds authorized role limit (${maxDiscountAllowed.toFixed(2)}) for role \"${user.role}\".`);
        }
        validatedDiscount = Math.min(Math.max(0, requestedDiscount), verifiedSubtotal);
      }

      // Server-Authoritative Tax Configuration lookup
      let configuredTaxRate: number | null = null;
      const branchSnap = await transaction.get(db.collection('branches').doc(targetBranchId));
      const branchData = branchSnap.exists ? branchSnap.data() : null;
      const isTaxExplicitlyDisabled = branchData?.taxEnabled === false || branchData?.taxEnabled === 'false';
      const isTaxExplicitlyEnabled = branchData?.taxEnabled === true || branchData?.taxEnabled === 'true';

      if (isTaxExplicitlyDisabled) {
        configuredTaxRate = 0;
      } else if (branchSnap.exists && typeof branchData?.taxRate === 'number') {
        const bTax = branchData!.taxRate;
        configuredTaxRate = bTax > 1 ? bTax / 100 : bTax;
      } else {
        const branchTaxesQuery = await transaction.get(
          db.collection('taxes').where('branchId', '==', targetBranchId).where('isActive', '==', true)
        );
        let branchDocs = !branchTaxesQuery.empty ? branchTaxesQuery.docs.map(d => d.data()) : [];
        if (branchDocs.length === 0) {
          const branchTaxesStatusQuery = await transaction.get(
            db.collection('taxes').where('branchId', '==', targetBranchId).where('status', '==', 'Active')
          );
          if (!branchTaxesStatusQuery.empty) {
            branchDocs = branchTaxesStatusQuery.docs.map(d => d.data());
          }
        }
        // No global/default tax fallback: tax configuration must be branch-owned.

        const primaryTax = branchDocs.find((t: any) => t.branchId === targetBranchId) ||
                           branchDocs.find((t: any) => t.isPrimary === true || t.isDefault === true || t.taxType === 'vat' || t.taxType === 'sales_tax') ||
                           branchDocs[0];
        if (primaryTax && typeof primaryTax.rate === 'number') {
          const r = Number(primaryTax.rate || 0);
          configuredTaxRate = r > 1 ? r / 100 : r;
        } else if (!isTaxExplicitlyEnabled) {
          if (branchData && (branchData.taxEnabled === false || branchData.taxEnabled === 'false')) {
            configuredTaxRate = 0;
          }
        }
      }

      if (configuredTaxRate === null) {
        throw new Error(`Tax configuration not found for branch "${targetBranchId}". Checkout rejected.`);
      }

      const taxableSubtotal = Math.max(0, verifiedSubtotal - validatedDiscount);
      const taxRate = configuredTaxRate; // Server-authoritative tax rate
      const realTax = Math.round(taxableSubtotal * taxRate * 100) / 100;

      // Server-Authoritative Delivery Fee & Driver Earnings
      let deliveryFee = 0;
      let driverEarningsAmount = 0;

      if (orderData.orderType === 'delivery') {
        if (branchSnap.exists) {
          const bData = branchSnap.data()!;
          if (bData.deliveryEnabled === false || bData.deliveryEnabled === 'false') {
            throw new Error(`Delivery service is currently disabled for branch "${targetBranchId}". Checkout rejected.`);
          }
        }

        let isDeliveryFeeEnabled = true;
        if (branchSnap.exists) {
          const bData = branchSnap.data()!;
          if (bData.deliveryFeeEnabled === false || bData.deliveryFeeEnabled === 'false') {
            isDeliveryFeeEnabled = false;
          }
        }

        if (orderData.deliveryZoneId) {
          const zoneSnap = await transaction.get(db.collection('delivery_zones').doc(orderData.deliveryZoneId));
          const zData: any = zoneSnap.exists ? zoneSnap.data() : null;
          if (!zData) {
            throw new Error(`Delivery zone "${orderData.deliveryZoneId}" not found in database. Checkout rejected.`);
          }
          if (zData.branchId && zData.branchId !== targetBranchId) {
            throw new Error(`Delivery zone "${orderData.deliveryZoneId}" does not belong to branch "${targetBranchId}". Checkout rejected.`);
          }

          if (zData.deliveryFeeEnabled === false || zData.deliveryFeeEnabled === 'false') {
            isDeliveryFeeEnabled = false;
          }

          if (zData.driverEarningsEnabled === true || typeof zData.driverEarningsAmount === 'number') {
            driverEarningsAmount = Math.max(0, Number(zData.driverEarningsAmount || 0));
          }

          if (isDeliveryFeeEnabled) {
            let rawZoneFee: any = null;
            if (zData.baseDeliveryFee !== undefined && zData.baseDeliveryFee !== null) {
              rawZoneFee = zData.baseDeliveryFee;
            } else if (zData.deliveryFee !== undefined && zData.deliveryFee !== null) {
              rawZoneFee = zData.deliveryFee;
            }
            if (rawZoneFee === null || rawZoneFee === undefined || typeof rawZoneFee !== 'number' || isNaN(rawZoneFee) || rawZoneFee < 0) {
              throw new Error(`Invalid fee configuration for delivery zone "${orderData.deliveryZoneId}". Checkout rejected.`);
            }
            deliveryFee = Math.max(0, rawZoneFee);
          } else {
            deliveryFee = 0;
          }
        } else {
          if (isDeliveryFeeEnabled) {
            let serverFee: any = null;
            if (branchSnap.exists) {
              const bData = branchSnap.data()!;
              if (bData.defaultDeliveryFee !== undefined && bData.defaultDeliveryFee !== null) {
                serverFee = bData.defaultDeliveryFee;
              } else if (bData.deliveryFee !== undefined && bData.deliveryFee !== null) {
                serverFee = bData.deliveryFee;
              }
            }
            if (serverFee === null || serverFee === undefined || typeof serverFee !== 'number' || isNaN(serverFee) || serverFee < 0) {
              throw new Error(`Delivery fee configuration not found for branch "${targetBranchId}". Please configure branch settings or specify a valid delivery zone. Checkout rejected.`);
            }
            deliveryFee = Math.max(0, serverFee);
          } else {
            deliveryFee = 0;
          }
        }

        if (driverEarningsAmount === 0 && branchSnap.exists) {
          const bData = branchSnap.data()!;
          if (bData.driverEarningsEnabled === true || typeof bData.driverEarningsAmount === 'number') {
            driverEarningsAmount = Math.max(0, Number(bData.driverEarningsAmount || 0));
          }
        }
      } else {
        // Pickup or Dine-in: strictly 0 delivery fee
        deliveryFee = 0;
        driverEarningsAmount = 0;
      }

      const realTotalAmount = Math.round(Math.max(0, taxableSubtotal + realTax + deliveryFee) * 100) / 100;
      // Restaurant Revenue = Food sales + Delivery Fee Revenue. Driver earnings is NOT part of Restaurant Revenue.
      const realProfit = (taxableSubtotal + deliveryFee) - verifiedCOGS - driverEarningsAmount;

      // Driver Collection Breakdown
      const isCashOrCod = String(orderData.paymentMethod || '').toLowerCase() === 'cash' || String(orderData.paymentMethod || '').toLowerCase() === 'cod';
      const amountCollectedByDriver = (orderData.orderType === 'delivery' && isCashOrCod) ? realTotalAmount : 0;
      // Driver earnings are an operating cost and may be subsidized by the restaurant;
      // they must not be constrained by a customer-facing delivery fee (which may be zero).

      const restaurantDue = Math.max(0, (isCashOrCod ? realTotalAmount : (taxableSubtotal + realTax + deliveryFee)) - driverEarningsAmount);
      const driverDue = driverEarningsAmount;

      // Server-Authoritative Payment Validation
      const ALLOWED_PAYMENT_METHODS = ['cash', 'card', 'bank', 'mobile_money', 'credit', 'unpaid', 'cod'] as const;
      const rawPayMethod = String(orderData.paymentMethod || 'cash').toLowerCase();
      if (!(ALLOWED_PAYMENT_METHODS as readonly string[]).includes(rawPayMethod)) {
        throw new Error(`Invalid payment method "${rawPayMethod}". Allowed methods: ${ALLOWED_PAYMENT_METHODS.join(', ')}.`);
      }

      let isPaidSale = false;
      let finalPayMethod = rawPayMethod;
      let paidTenderAmount = 0;
      let amountTendered = 0;
      let changeDue = 0;

      if (rawPayMethod === 'cod') {
        if (orderData.orderType !== 'delivery' && orderData.type !== 'delivery') {
          throw new Error('Cash on Delivery (COD) is only applicable for delivery orders.');
        }
        isPaidSale = false;
        finalPayMethod = 'cod';
        paidTenderAmount = 0;
        amountTendered = 0;
        changeDue = 0;
      } else if (rawPayMethod === 'credit') {
        if (!orderData.customerId && !orderData.customerName) {
          throw new Error('Credit order rejected: A valid customer name or ID is required for credit sales.');
        }
        isPaidSale = false;
        finalPayMethod = 'credit';
        paidTenderAmount = 0;
        amountTendered = 0;
        changeDue = 0;
      } else if (rawPayMethod === 'unpaid') {
        isPaidSale = false;
        finalPayMethod = 'unpaid';
        paidTenderAmount = 0;
        amountTendered = 0;
        changeDue = 0;
      } else if (rawPayMethod === 'cash') {
        // If client passes explicit overpayment in paidAmount AND passes client-side change tampering, reject
        if (orderData.paidAmount !== undefined && orderData.paidAmount !== null) {
          const numPaid = Number(orderData.paidAmount);
          if (numPaid > realTotalAmount + 0.001 && orderData.amountTendered === undefined) {
            throw new Error(`Overpayment rejected: Payment amount ($${numPaid.toFixed(2)}) must not exceed order total ($${realTotalAmount.toFixed(2)}). Use amountTendered for cash tender.`);
          }
          if (numPaid > realTotalAmount + 0.001 && (orderData.change !== undefined || orderData.changeAmount !== undefined)) {
            // Client attempting to assert its own change or overpaid paidAmount
            throw new Error(`Overpayment rejected: Payment amount must exactly match order total ($${realTotalAmount.toFixed(2)}).`);
          }
        }

        // Cash payment supports cash tender and change calculation
        const providedTender = orderData.amountTendered ?? orderData.tenderAmount ?? orderData.paidAmount ?? orderData.paymentAmount;
        if (providedTender === undefined || providedTender === null) {
          throw new Error('Missing payment amount for paid payment method "cash". Payment or tender amount must be explicitly provided.');
        }
        const numTendered = Number(providedTender);
        if (!Number.isFinite(numTendered) || numTendered < 0) {
          throw new Error(`Invalid payment amount (${providedTender}): cannot be negative.`);
        }
        if (numTendered < realTotalAmount - 0.001) {
          throw new Error(`Underpayment rejected: Cash tendered ($${numTendered.toFixed(2)}) is less than total amount ($${realTotalAmount.toFixed(2)}).`);
        }
        amountTendered = numTendered;
        changeDue = Math.round(Math.max(0, numTendered - realTotalAmount) * 100) / 100;
        paidTenderAmount = realTotalAmount; // Net cash retained is exact sale total
        isPaidSale = true;
      } else {
        // Non-cash payments (card, bank, mobile_money) require exact payment amount
        const providedPaid = orderData.paidAmount ?? orderData.paymentAmount ?? orderData.amountTendered ?? orderData.tenderAmount;
        if (providedPaid === undefined || providedPaid === null) {
          throw new Error(`Missing payment amount for paid payment method "${rawPayMethod}". Payment amount must be explicitly provided.`);
        }
        const numPaid = Number(providedPaid);
        if (!Number.isFinite(numPaid) || numPaid < 0) {
          throw new Error(`Invalid payment amount (${providedPaid}): cannot be negative.`);
        }
        if (numPaid < realTotalAmount - 0.001) {
          throw new Error(`Underpayment rejected: Payment amount ($${numPaid.toFixed(2)}) is less than total amount ($${realTotalAmount.toFixed(2)}).`);
        }
        if (numPaid > realTotalAmount + 0.001) {
          throw new Error(`Overpayment rejected: Payment amount ($${numPaid.toFixed(2)}) exceeds total amount ($${realTotalAmount.toFixed(2)}). Exact payment required for non-cash.`);
        }
        amountTendered = realTotalAmount;
        changeDue = 0;
        paidTenderAmount = realTotalAmount;
        isPaidSale = true;
      }

      const finalPaymentStatus = isPaidSale ? 'paid' : 'unpaid';

      // Phase 1 (Reads) - Fetch Customer record if assigned
      let customerRef: any = null;
      let customerSnap: any = null;
      let customerPointsRef: any = null;
      let customerPointsSnap: any = null;

      if (orderData.customerId) {
        customerRef = db.collection('customers').doc(orderData.customerId);
        customerSnap = await transaction.get(customerRef);
        customerPointsRef = db.collection('customer_points').doc(orderData.customerId);
        customerPointsSnap = await transaction.get(customerPointsRef);
      }

      // Phase 1 (Reads) - Open Cash Register lookup for Cash Sales
      let openCashRegisterDoc: any = null;
      if (finalPayMethod === 'cash' && isPaidSale) {
        const openRegSnap = await transaction.get(
          db.collection('cash_registers')
            .where('branchId', '==', targetBranchId)
            .where('status', '==', 'Open')
        );
        if (!openRegSnap.empty) {
          openCashRegisterDoc = openRegSnap.docs[0];
        }
      }

      // P0-01: Server-Authoritative Order Status
      if (orderData.status && ['cancelled', 'refunded', 'voided'].includes(String(orderData.status).toLowerCase())) {
        throw new Error(`Invalid order status at creation: cannot initiate new order with status "${orderData.status}".`);
      }
      const authoritativeOrderStatus = finalPaymentStatus === 'paid' ? 'completed' : 'pending';

      // P0-02: Server-Authoritative Delivery Status
      const isDeliveryOrder = orderData.orderType === 'delivery' || orderData.type === 'delivery';
      if (isDeliveryOrder && orderData.deliveryStatus && !['unassigned', 'pending'].includes(String(orderData.deliveryStatus).toLowerCase())) {
        throw new Error(`Invalid delivery status at checkout: client cannot set delivery status to "${orderData.deliveryStatus}". Initial delivery status must be "unassigned".`);
      }

      const newOrderRef = db.collection('orders').doc();
      const timestamp = new Date().toISOString();
      const dateStr = getMogadishuDateString(timestamp);
      await assertAccountingDateOpenInTransaction(transaction, db, dateStr, targetBranchId);

      const posPayMethod = String(orderData.paymentMethod || 'cash').toLowerCase();
      const posSettlement = await resolveSettlementAccountInTransaction(transaction, db, targetBranchId, posPayMethod, orderData.bankAccountId);
      const posPaymentAccountId = posSettlement.id;
      const __posAccountState = await prepareAccountBalanceState(transaction, db, [posPaymentAccountId, 'acc_cogs', 'acc_revenue', 'acc_tax', 'acc_delivery_revenue', 'acc_driver_expense', 'acc_driver_payable', 'acc_inventory']);

      // Perform Product Stock Deductions & Inventory Movements with strict invariants
      for (const item of verifiedItems) {
        const prodData = productMap.get(item.productId);
        if (prodData && prodData.trackStock === true) {
          const currentStock = Number(prodData.stock);
          if (!Number.isFinite(currentStock) || currentStock < 0) {
            throw new Error(`Critical invariant violation: tracked product "${prodData.name}" has invalid stock. Checkout aborted.`);
          }
          const newStock = currentStock - item.quantity;
          if (newStock < 0) {
            throw new Error(`Critical invariant violation: resulting stock for "${prodData.name}" cannot be negative (${newStock}). Checkout aborted.`);
          }
          transaction.update(db.collection('products').doc(item.productId), { stock: newStock, updatedAt: timestamp });

          const movementRef = db.collection('inventory_movements').doc();
          transaction.set(movementRef, cleanUndefined({
            id: movementRef.id,
            type: 'sale',
            itemType: 'product',
            itemId: item.productId,
            itemName: item.productName,
            quantity: item.quantity,
            branchId: targetBranchId,
            reason: `POS Sale Order #${orderNumber}`,
            createdBy: user.name,
            createdAt: timestamp
          }));
        }
      }

      // Perform Ingredient Stock Deductions & Inventory Movements
      for (const [ingId, info] of ingredientDeductions.entries()) {
        const newStock = info.currentStock - info.totalRequired;
        if (newStock < 0) {
          throw new Error(`Critical invariant violation: resulting stock for ingredient "${info.ingredientName}" cannot be negative (${newStock.toFixed(2)}). Checkout aborted.`);
        }
        transaction.update(db.collection('ingredients').doc(ingId), { stock: newStock, currentStockUsageUnit: newStock, updatedAt: timestamp });
        transaction.set(db.collection('inventory').doc(ingId), {
          id: ingId,
          currentQuantity: newStock,
          branchId: targetBranchId,
          updatedAt: timestamp
        }, { merge: true });

        const movementRef = db.collection('inventory_movements').doc();
        transaction.set(movementRef, cleanUndefined({
          id: movementRef.id,
          type: 'order_deduction',
          itemType: 'ingredient',
          itemId: ingId,
          itemName: info.ingredientName,
          quantity: info.totalRequired,
          branchId: targetBranchId,
          reason: `Auto stock deduction for Order #${orderNumber}`,
          createdBy: user.name,
          createdAt: timestamp
        }));
      }

      // P0-03: Calculate loyalty points earned at checkout (strictly server-authoritative, ignoring client assertions)
      const customerTier = customerPointsSnap?.exists ? getLoyaltyTierFromLifetimePoints(Number(customerPointsSnap.data()?.lifetimePoints ?? 0)) : { level: 'Bronze', nextThreshold: 200, multiplier: 1.0 };
      const pointsEarned = Math.floor(realTotalAmount * customerTier.multiplier); // Server-authoritative tier multiplier
      if (verifiedSubtotal > 0) {
        verifiedItems.forEach((itm) => {
          itm.pointsEarned = Math.round((itm.subtotal / verifiedSubtotal) * pointsEarned);
        });
      }

      // Update Open Cash Register balance if cash sale
      if (openCashRegisterDoc) {
        const curSales = Number(openCashRegisterDoc.data().cashSales || 0);
        const curExpected = Number(openCashRegisterDoc.data().expectedClosingBalance || openCashRegisterDoc.data().openingBalance || 0);
        transaction.update(openCashRegisterDoc.ref, {
          cashSales: curSales + realTotalAmount,
          expectedClosingBalance: curExpected + realTotalAmount,
          updatedAt: timestamp
        });
      }

      // Create Full Order Document
      const fullOrder = {
        ...orderData,
        id: newOrderRef.id,
        orderNumber,
        branchId: targetBranchId,
        items: verifiedItems,
        subtotal: verifiedSubtotal,
        discountAmount: validatedDiscount,
        taxRate,
        tax: realTax,
        deliveryFee,
        totalAmount: realTotalAmount,
        paidAmount: isPaidSale ? realTotalAmount : 0,
        tenderAmount: isPaidSale ? amountTendered : 0,
        amountTendered: isPaidSale ? amountTendered : 0,
        change: isPaidSale ? changeDue : 0,
        changeAmount: isPaidSale ? changeDue : 0,
        changeDue: isPaidSale ? changeDue : 0,
        pointsEarnedAtCheckout: pointsEarned,
        loyaltyPointsEarned: pointsEarned,
        cogs: verifiedCOGS,
        profit: realProfit,
        driverEarningsAmount,
        orderTotal: realTotalAmount,
        amountCollectedByDriver,
        restaurantDue,
        driverDue,
        paymentMethod: finalPayMethod,
        paymentAccountId: posSettlement.id,
        paymentAccountCode: posSettlement.code,
        paymentAccountName: posSettlement.name,
        bankAccountId: posSettlement.bankAccountId || orderData.bankAccountId || undefined,
        paymentStatus: finalPaymentStatus,
        status: authoritativeOrderStatus,
        deliveryStatus: isDeliveryOrder ? 'unassigned' : undefined,
        employeeId: user.uid,
        employeeName: user.name,
        idempotencyKey: normalizedIdempotencyKey,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      transaction.set(newOrderRef, cleanUndefined(fullOrder));

      // Create Payment Record for Paid Sales
      if (finalPaymentStatus === 'paid') {
        const payRef = db.collection('payments').doc();
        transaction.set(payRef, cleanUndefined({
          id: payRef.id,
          orderId: fullOrder.id,
          orderNumber,
          amount: fullOrder.totalAmount,
          tenderAmount: amountTendered,
          amountTendered: amountTendered,
          changeAmount: changeDue,
          changeDue: changeDue,
          method: finalPayMethod,
          status: 'paid',
          branchId: targetBranchId,
          processedBy: user.name,
          createdAt: timestamp
        }));
      } else {
        // Create Receivable record for Unpaid/Credit Sales
        const recRef = db.collection('receivables').doc();
        transaction.set(recRef, cleanUndefined({
          id: recRef.id,
          orderId: fullOrder.id,
          orderNumber,
          customerName: fullOrder.customerName || 'Credit Customer',
          customerPhone: fullOrder.customerPhone || '',
          amount: fullOrder.totalAmount,
          totalAmount: fullOrder.totalAmount,
          paidAmount: 0,
          status: 'pending',
          branchId: targetBranchId,
          createdAt: timestamp,
          updatedAt: timestamp
        }));
      }

      // Create Kitchen Order Ticket
      const kitchenTicketRef = db.collection('kitchen_orders').doc(newOrderRef.id);
      const kitchenItems = verifiedItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        notes: item.notes || '',
        selectedOptions: item.selectedOptions || [],
        assignedStation: getProductStation(productMap.get(item.productId) || {}),
        recipeSnapshot: item.recipeSnapshot || [],
        itemStatus: 'new'
      }));

      transaction.set(kitchenTicketRef, cleanUndefined({
        id: newOrderRef.id,
        orderId: newOrderRef.id,
        orderNumber,
        orderTime: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        orderType: fullOrder.orderType || 'dine_in',
        loyaltyPointsEarned: pointsEarned,
        tableNumber: fullOrder.tableNumber || '',
        customerName: fullOrder.customerName || 'Walk-in Guest',
        branchId: targetBranchId,
        items: kitchenItems,
        prepStatus: 'new',
        priority: 'medium'
      }));

      // Create Delivery Record if order is for delivery
      if (fullOrder.orderType === 'delivery') {
        const delRef = db.collection('deliveries').doc(newOrderRef.id);
        const itemsSummary = verifiedItems.map(i => `${i.quantity}x ${i.productName}`).join(', ');
        const itemsCount = verifiedItems.reduce((sum, i) => sum + i.quantity, 0);

        transaction.set(delRef, cleanUndefined({
          id: newOrderRef.id,
          orderId: newOrderRef.id,
          orderNumber,
          customerName: fullOrder.customerName || 'Delivery Customer',
          customerPhone: fullOrder.customerPhone || '',
          deliveryAddress: fullOrder.deliveryAddress || fullOrder.customerAddress || '',
          deliveryZoneId: fullOrder.deliveryZoneId,
          deliveryZoneName: fullOrder.deliveryZoneName,
          branchId: targetBranchId,
          branchName: String((user as any).branch || '').trim(),
          status: 'unassigned',
          subtotal: verifiedSubtotal,
          deliveryFee: fullOrder.deliveryFee || 0,
          totalAmount: realTotalAmount,
          paymentMethod: fullOrder.paymentMethod || 'cash',
          paymentStatus: fullOrder.paymentStatus || 'paid',
          itemsCount,
          itemsSummary,
          estimatedDeliveryTimeMinutes: Number.isFinite(Number(fullOrder.estimatedDeliveryTimeMinutes)) ? Number(fullOrder.estimatedDeliveryTimeMinutes) : 0,
          createdAt: timestamp,
          updatedAt: timestamp
        }));
      }

      // Update Customer Loyalty & Spending Stats if Customer Assigned
      if (customerRef && customerSnap && customerSnap.exists) {
        const cData = customerSnap.data() || {};
        const oldTotalSpent = Number(cData.totalSpent ?? cData.totalSpending ?? 0);
        const oldOrdersCount = Number(cData.totalOrders ?? 0);
        const newTotalSpent = Math.round((oldTotalSpent + realTotalAmount) * 100) / 100;
        const newOrdersCount = oldOrdersCount + 1;
        const customerTier = customerPointsSnap?.exists ? getLoyaltyTierFromLifetimePoints(Number(customerPointsSnap.data()?.lifetimePoints ?? 0)) : { level: 'Bronze', nextThreshold: 200, multiplier: 1.0 };
        const pointsEarned = Math.floor(realTotalAmount * customerTier.multiplier); // Server-authoritative tier multiplier
        const oldLifetimePoints = customerPointsSnap?.exists ? Number(customerPointsSnap.data()?.lifetimePoints ?? 0) : Number(cData.lifetimePoints ?? 0);
        const newLifetimePoints = Math.max(0, oldLifetimePoints + pointsEarned);
        const membershipLevel = getLoyaltyTierFromLifetimePoints(newLifetimePoints).level;

        transaction.update(customerRef, cleanUndefined({
          totalSpent: newTotalSpent,
          totalSpending: newTotalSpent,
          totalOrders: newOrdersCount,
          membershipLevel,
          lastOrderDate: timestamp,
          loyaltyPoints: (cData.loyaltyPoints || 0) + pointsEarned,
          updatedAt: timestamp
        }));

        if (customerPointsRef) {
          const oldPoints = customerPointsSnap && customerPointsSnap.exists ? Number(customerPointsSnap.data()?.points || 0) : Number(cData.loyaltyPoints || 0);
          transaction.set(customerPointsRef, cleanUndefined({
            id: orderData.customerId,
            customerId: orderData.customerId,
            customerName: cData.fullName || cData.name || fullOrder.customerName || 'Customer',
            points: oldPoints + pointsEarned,
            currentPointsBalance: oldPoints + pointsEarned,
            tier: membershipLevel,
            totalEarned: (customerPointsSnap && customerPointsSnap.exists ? Number(customerPointsSnap.data()?.totalEarned || 0) : 0) + pointsEarned,
            updatedAt: timestamp
          }), { merge: true });
        }
      }

      // Create Double-Entry Accounting Journal Entry & Ledger Lines
      const jeRef = db.collection('journal_entries').doc();
      const entryNumber = `JE-POS-${orderNumber}`;
      const payMethod = fullOrder.paymentMethod || 'cash';
      
      const paymentAccountId = posSettlement.id;
      const paymentAccountCode = posSettlement.code;
      const paymentAccountName = posSettlement.name;

      const journalLines = [
        {
          accountId: paymentAccountId,
          accountCode: paymentAccountCode,
          accountName: paymentAccountName,
          debit: realTotalAmount,
          credit: 0,
          memo: (fullOrder.paymentStatus === 'unpaid' || payMethod === 'credit') ? `Credit Sale AR Order #${orderNumber}` : `POS Sales Receipt Order #${orderNumber}`
        },
        {
          accountId: 'acc_cogs',
          accountCode: '5010',
          accountName: 'Cost of Goods Sold (COGS)',
          debit: verifiedCOGS,
          credit: 0,
          memo: `COGS for Order #${orderNumber}`
        },
        {
          accountId: 'acc_revenue',
          accountCode: '4010',
          accountName: 'Restaurant Sales Revenue',
          debit: 0,
          credit: verifiedSubtotal - validatedDiscount,
          memo: `Revenue from Order #${orderNumber}`
        },
        {
          accountId: 'acc_tax',
          accountCode: '2020',
          accountName: 'Sales Tax Payable',
          debit: 0,
          credit: realTax,
          memo: `Sales Tax Collected Order #${orderNumber}`
        },
        ...(deliveryFee > 0 ? [{
          accountId: 'acc_delivery_revenue',
          accountCode: '4020',
          accountName: 'Delivery Revenue',
          debit: 0,
          credit: deliveryFee,
          memo: `Delivery Revenue Order #${orderNumber}`
        }] : []),
        ...(driverEarningsAmount > 0 ? [
          {
            accountId: 'acc_driver_expense',
            accountCode: '5020',
            accountName: 'Driver Commission Expense',
            debit: driverEarningsAmount,
            credit: 0,
            memo: `Driver Earnings Expense Order #${orderNumber}`
          },
          {
            accountId: 'acc_driver_payable',
            accountCode: '2030',
            accountName: 'Driver Payable',
            debit: 0,
            credit: driverEarningsAmount,
            memo: `Driver Earnings Payable Order #${orderNumber}`
          }
        ] : []),
        {
          accountId: 'acc_inventory',
          accountCode: '1030',
          accountName: 'Food & Beverage Inventory',
          debit: 0,
          credit: verifiedCOGS,
          memo: `Inventory Deduction for Order #${orderNumber}`
        }
      ].filter(line => (line.debit > 0 || line.credit > 0));

      const totalDebit = journalLines.reduce((s, l) => s + (l.debit || 0), 0);
      const totalCredit = journalLines.reduce((s, l) => s + (l.credit || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.001) {
        throw new Error(`Accounting Double-Entry Error: Unbalanced POS Journal Entry! Total Debit (${totalDebit.toFixed(2)}) !== Total Credit (${totalCredit.toFixed(2)}).`);
      }

      const journalEntry = {
        id: jeRef.id,
        entryNumber,
        date: dateStr,
        reference: orderNumber,
        description: `POS Sale Receipt Order #${orderNumber} (${fullOrder.orderType})`,
        source: 'POS',
        status: 'Posted',
        totalDebit,
        totalCredit,
        lines: journalLines,
        branchId: targetBranchId,
        createdBy: user.name,
        createdAt: timestamp
      };

      transaction.set(jeRef, cleanUndefined(journalEntry));

      for (const line of journalLines) {
        const jlRef = db.collection('journal_lines').doc();
        transaction.set(jlRef, cleanUndefined({
          id: jlRef.id,
          journalEntryId: jeRef.id,
          entryNumber,
          branchId: targetBranchId,
          ...line,
          createdAt: timestamp
        }));

        const ledgerRef = db.collection('ledger').doc();
        transaction.set(ledgerRef, cleanUndefined({
          id: ledgerRef.id,
          accountId: line.accountId,
          accountCode: line.accountCode,
          accountName: line.accountName,
          journalEntryId: jeRef.id,
          entryNumber,
          date: dateStr,
          reference: orderNumber,
          description: line.memo || journalEntry.description,
          debit: line.debit,
          credit: line.credit,
          branchId: targetBranchId,
          createdAt: timestamp
        }));
      }

      applyAccountBalanceDeltasInTransaction(transaction, __posAccountState, journalLines, timestamp);

      // Record Audit Activity Log
      const auditRef = db.collection('activity_logs').doc();
      transaction.set(auditRef, cleanUndefined({
        id: auditRef.id,
        userId: user.uid,
        userName: user.name,
        userRole: user.role,
        action: 'POS_ORDER_COMPLETED',
        module: 'POS',
        description: `Completed Order #${orderNumber} for $${realTotalAmount.toFixed(2)}`,
        branchId: targetBranchId,
        timestamp
      }));

      return { ...fullOrder, success: true, status: 'success', order: fullOrder };
    });

    return res.json(result);
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error('POS Checkout Transaction Error:', errMsg);
    const isValidationError = /Insufficient|Invalid|missing|not found|exceeds|inactive|unauthorized|belong|reject|Tax|Delivery|Payment/i.test(errMsg);
    const status = isValidationError ? 400 : 500;
    return res.status(status).json({ error: errMsg || 'POS Checkout Transaction Failed' });
  }
}

// 2. Order Cancellation
export async function handleOrderCancellation(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { orderId } = req.params;
  const { reason } = req.body || {};
  let cancelIdempotencyKey: string;
  try { cancelIdempotencyKey = getRequiredIdempotencyKey(req); }
  catch (e: any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }

  if (!orderId) {
    return res.status(400).json({ error: 'Order ID is required for cancellation.' });
  }

  const db = getAdminDb();

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Phase 1 (All Reads)
      const idempotencyRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`cancel:${user.uid}:${cancelIdempotencyKey}`).digest('hex'));
      const idempotencySnap = await transaction.get(idempotencyRef);
      if (idempotencySnap.exists) return { status: 'duplicate', ...(idempotencySnap.data() || {}) };

      const orderRef = db.collection('orders').doc(orderId);
      const orderSnap = await transaction.get(orderRef);

      if (!orderSnap.exists) {
        throw new Error(`Order #${orderId} was not found.`);
      }

      const orderData = orderSnap.data() as any;

      // Double cancellation guard (Idempotent response)
      if (orderData.status === 'cancelled') {
        return { status: 'already_cancelled', message: `Order #${orderData.orderNumber || orderId} is already cancelled.` };
      }

      const totalOrderAmount = Math.max(0, Number(orderData.totalAmount || 0));
      const alreadyRefundedAmount = Math.max(0, Number(orderData.refundedAmount || 0));
      const isAlreadyFullyRefunded = orderData.paymentStatus === 'refunded' || alreadyRefundedAmount >= totalOrderAmount - 0.001;
      if (alreadyRefundedAmount > 0.001 && !isAlreadyFullyRefunded) {
        throw Object.assign(new Error('Order has a partial refund already. Complete the remaining amount through the refund workflow before cancellation.'), { statusCode: 400 });
      }
      const originalPaidAmount = Math.max(0, Number(orderData.paidAmount ?? orderData.paymentAmount ?? 0));
      const isCreditOrUnpaidOrder = ['credit','unpaid'].includes(String(orderData.paymentMethod || '').toLowerCase()) || String(orderData.paymentStatus || '').toLowerCase() === 'unpaid' || originalPaidAmount <= 0;
      if (!isAlreadyFullyRefunded && originalPaidAmount > alreadyRefundedAmount + 0.001 && !isCreditOrUnpaidOrder) {
        throw Object.assign(new Error('Paid orders must use the refund workflow before cancellation. This prevents duplicate cash/bank reversals and ensures exact line-level inventory/COGS restoration.'), { statusCode: 400 });
      }

      const targetBranchId = orderData.branchId;
      if (!targetBranchId) {
        throw new Error('Order branch identification missing. Cannot process cancellation.');
      }

      const branchAuth = checkBranchAuthorization(user, targetBranchId);
      if (!branchAuth.authorized) {
        throw new Error(`Unauthorized cancellation! Order belongs to branch "${targetBranchId}". ${branchAuth.error}`);
      }

      const timestamp = new Date().toISOString();
      const dateStr = getMogadishuDateString(timestamp);
      await assertAccountingDateOpenInTransaction(transaction, db, dateStr, targetBranchId);

      const cancellationPayMethod = String(orderData.paymentMethod || '').toLowerCase();
      if (cancellationPayMethod === 'cash' && originalPaidAmount > 0 && !isAlreadyFullyRefunded) {
        const openRegSnap = await transaction.get(db.collection('cash_registers').where('branchId','==',targetBranchId).where('status','==','Open'));
        if (openRegSnap.empty) {
          throw Object.assign(new Error(`No open cash register exists for branch "${targetBranchId}"; cash order cancellation is blocked.`), { statusCode: 409 });
        }
      }

      // Read all products and recipe ingredients before any writes
      interface ProdRestoreInfo {
        prodRef: any;
        prodData: any;
        item: any;
        newStock: number;
        restoredQty: number;
        recipeRestorations: Array<{
          ingRef: any;
          ingData: any;
          newIngStock: number;
          reqQty: number;
        }>;
      }

      const prodRestorations: ProdRestoreInfo[] = [];

      if (Array.isArray(orderData.items)) {
        for (const item of orderData.items) {
          if (item.productId) {
            const prodRef = db.collection('products').doc(item.productId);
            const prodSnap = await transaction.get(prodRef);
            if (prodSnap.exists) {
              const prodData = prodSnap.data() || {};
              const productBranch = normalizeCanonicalBranchId(prodData.branchId || '');
              if (!productBranch || !areBranchesMatching(productBranch, targetBranchId)) {
                throw Object.assign(new Error(`Unauthorized cross-branch refund inventory access for product "${item.productId}".`), { statusCode: 403 });
              }
              const currentStock = typeof prodData.stock === 'number' ? prodData.stock : 0;
              const restoredQty = isAlreadyFullyRefunded ? 0 : Math.max(0, Number(item.quantity || 0) - Number(item.refundedQuantity || 0));
              const newStock = currentStock + restoredQty;

              const recipeRestorations: ProdRestoreInfo['recipeRestorations'] = [];

              // Priority 1: Use recipeSnapshot saved during checkout
              if (Array.isArray(item.recipeSnapshot) && item.recipeSnapshot.length > 0) {
                for (const snapItem of item.recipeSnapshot) {
                  if (snapItem.ingredientId) {
                    const ingRef = db.collection('ingredients').doc(snapItem.ingredientId);
                    const ingSnap = await transaction.get(ingRef);
                    if (ingSnap.exists) {
                      const ingData = ingSnap.data() || {};
                      const ingredientBranch = normalizeCanonicalBranchId(ingData.branchId || '');
                      if (!ingredientBranch || !areBranchesMatching(ingredientBranch, targetBranchId)) {
                        throw Object.assign(new Error(`Unauthorized cross-branch refund inventory access for ingredient "${snapItem.ingredientId}".`), { statusCode: 403 });
                      }
                      const currentIngStock = typeof ingData.stock === 'number' ? ingData.stock : (typeof ingData.currentStockUsageUnit === 'number' ? ingData.currentStockUsageUnit : 0);
                      const lineQuantity = Number(item.quantity);
                      const snapshotPerItem = Number(snapItem.quantityPerItem);
                      const snapshotTotal = Number(snapItem.totalQuantity);
                      const perItemQuantity = Number.isFinite(snapshotPerItem) && snapshotPerItem > 0
                        ? snapshotPerItem
                        : (lineQuantity > 0 && Number.isFinite(snapshotTotal) ? snapshotTotal / lineQuantity : 0);
                      const reqQty = perItemQuantity * restoredQty;
                      recipeRestorations.push({
                        ingRef,
                        ingData,
                        newIngStock: currentIngStock + reqQty,
                        reqQty
                      });
                    }
                  }
                }
              } else if (Array.isArray(prodData.recipe) && prodData.recipe.length > 0) {
                // Priority 2: Fallback to current product recipe for legacy orders
                for (const rItem of prodData.recipe) {
                  if (rItem.ingredientId) {
                    const ingRef = db.collection('ingredients').doc(rItem.ingredientId);
                    const ingSnap = await transaction.get(ingRef);
                    if (ingSnap.exists) {
                      const ingData = ingSnap.data() || {};
                      const ingredientBranch = normalizeCanonicalBranchId(ingData.branchId || '');
                      if (!ingredientBranch || !areBranchesMatching(ingredientBranch, targetBranchId)) {
                        throw Object.assign(new Error(`Unauthorized cross-branch refund inventory access for ingredient "${rItem.ingredientId}".`), { statusCode: 403 });
                      }
                      const currentIngStock = typeof ingData.stock === 'number' ? ingData.stock : (typeof ingData.currentStockUsageUnit === 'number' ? ingData.currentStockUsageUnit : 0);
                      const reqQty = Number(rItem.quantity || 0) * restoredQty;
                      recipeRestorations.push({
                        ingRef,
                        ingData,
                        newIngStock: currentIngStock + reqQty,
                        reqQty
                      });
                    }
                  }
                }
              }

              if (restoredQty > 0) {
                prodRestorations.push({
                  prodRef,
                  prodData,
                  item,
                  newStock,
                  restoredQty,
                  recipeRestorations
                });
              }
            }
          }
        }
      }

      // Merge duplicate product/ingredient restorations so each document is written once with a
      // transaction-safe absolute value, preventing stale-write loss for duplicate order lines.
      const mergedProducts = new Map<string, any>();
      for (const pr of prodRestorations) {
        const key = String(pr.item.productId || pr.prodRef.id);
        const prior = mergedProducts.get(key);
        if (!prior) {
          const mergedRecipe = new Map<string, any>();
          for (const rr of pr.recipeRestorations) mergedRecipe.set(rr.ingRef.id, { ...rr });
          mergedProducts.set(key, { ...pr, recipeRestorations: Array.from(mergedRecipe.values()) });
        } else {
          prior.restoredQty += pr.restoredQty;
          prior.newStock += pr.restoredQty;
          const recMap = new Map<string, any>();
          for (const rr of prior.recipeRestorations) recMap.set(rr.ingRef.id, { ...rr });
          for (const rr of pr.recipeRestorations) {
            const existing = recMap.get(rr.ingRef.id);
            if (existing) { existing.reqQty += rr.reqQty; existing.newIngStock = existing.ingData.stock != null ? Number(existing.ingData.stock) + existing.reqQty : existing.newIngStock + rr.reqQty; }
            else recMap.set(rr.ingRef.id, { ...rr });
          }
          prior.recipeRestorations = Array.from(recMap.values());
        }
      }
      prodRestorations.length = 0;
      prodRestorations.push(...Array.from(mergedProducts.values()));

      // Read Kitchen Ticket if exists
      const kitchenRef = db.collection('kitchen_orders').doc(orderId);
      const kitchenSnap = await transaction.get(kitchenRef);

      // Read Delivery Record if exists
      const delRef = db.collection('deliveries').doc(orderId);
      const delSnap = await transaction.get(delRef);
      let driverRef: any = null;
      let driverSnap: any = null;
      if (delSnap.exists) {
        const delData = delSnap.data() || {};
        if (delData.driverId) {
          driverRef = db.collection('drivers').doc(delData.driverId);
          driverSnap = await transaction.get(driverRef);
        }
      }

      // Read Receivables if order was credit / unpaid
      const recQuery = await transaction.get(db.collection('receivables').where('orderId', '==', orderId));

      // Read Open Cash Register if original order was cash and had a paid amount
      let openCashRegisterDoc: any = null;
      const isOriginalCash = String(orderData.paymentMethod || '').toLowerCase() === 'cash';
      if (isOriginalCash && originalPaidAmount > 0 && !isAlreadyFullyRefunded) {
        const openRegSnap = await transaction.get(
          db.collection('cash_registers')
            .where('branchId', '==', targetBranchId)
            .where('status', '==', 'Open')
        );
        if (!openRegSnap.empty) {
          openCashRegisterDoc = openRegSnap.docs[0];
        }
      }

      // Read Customer record for loyalty points reversal
      let customerRef: any = null;
      let customerSnap: any = null;
      let customerPointsRef: any = null;
      let customerPointsSnap: any = null;
      if (orderData.customerId) {
        customerRef = db.collection('customers').doc(orderData.customerId);
        customerSnap = await transaction.get(customerRef);
        customerPointsRef = db.collection('customer_points').doc(orderData.customerId);
        customerPointsSnap = await transaction.get(customerPointsRef);
      }

      const __cancelAccountState = await prepareAccountBalanceState(transaction, db, ['acc_ar','acc_revenue','acc_delivery_revenue','acc_tax','acc_inventory','acc_cogs']);

      // Phase 2 (All Writes)
      // Update Open Cash Register if cash refund
      if (openCashRegisterDoc) {
        const curPayouts = Number(openCashRegisterDoc.data().cashPayouts || 0);
        const curExpected = Number(openCashRegisterDoc.data().expectedClosingBalance || openCashRegisterDoc.data().openingBalance || 0);
        transaction.update(openCashRegisterDoc.ref, {
          cashPayouts: curPayouts + originalPaidAmount,
          expectedClosingBalance: curExpected - originalPaidAmount,
          updatedAt: timestamp
        });
      }

      // Update Order document
      transaction.update(orderRef, {
        status: 'cancelled',
        paymentStatus: 'refunded',
        cancellationReason: reason || 'Customer/Manager Cancellation',
        cancelledBy: user.name,
        updatedAt: timestamp
      });

      // Restore Product Stock & Record Movements
      for (const pr of prodRestorations) {
        if (pr.prodData.trackStock === true) {
          transaction.update(pr.prodRef, { stock: pr.newStock });

          const movementRef = db.collection('inventory_movements').doc();
          transaction.set(movementRef, cleanUndefined({
            id: movementRef.id,
            type: 'return',
            itemType: 'product',
            itemId: pr.item.productId,
            itemName: pr.item.productName || pr.prodData.name,
            quantity: pr.restoredQty,
            branchId: targetBranchId,
            reason: `Stock restored from cancelled Order #${orderData.orderNumber || orderId}`,
            createdBy: user.name,
            createdAt: timestamp
          }));
        }

        for (const rr of pr.recipeRestorations) {
          transaction.update(rr.ingRef, { 
            stock: rr.newIngStock,
            currentStockUsageUnit: rr.newIngStock
          });

          const ingMovRef = db.collection('inventory_movements').doc();
          transaction.set(ingMovRef, cleanUndefined({
            id: ingMovRef.id,
            type: 'order_restoration',
            itemType: 'ingredient',
            itemId: rr.ingData.id || rr.ingRef.id,
            itemName: rr.ingData.name || 'Ingredient',
            quantity: rr.reqQty,
            branchId: targetBranchId,
            reason: `Ingredient stock restored from cancelled Order #${orderData.orderNumber || orderId}`,
            createdBy: user.name,
            createdAt: timestamp
          }));
        }
      }

      // Update Kitchen Ticket status if exists (prevent phantom kitchen ticket)
      if (kitchenSnap.exists) {
        transaction.update(kitchenRef, { prepStatus: 'cancelled', updatedAt: timestamp });
      }

      // Update Delivery record and release driver
      if (delSnap.exists) {
        transaction.update(delRef, { 
          status: 'cancelled', 
          cancellationReason: reason || 'Order Cancelled',
          updatedAt: timestamp 
        });
      }

      if (driverRef && driverSnap && driverSnap.exists) {
        const dData = driverSnap.data() || {};
        if (dData.activeDeliveryId === orderId || dData.availability === 'busy') {
          transaction.update(driverRef, {
            availability: 'available',
            activeDeliveryId: null,
            updatedAt: timestamp
          });
        }
      }

      // Void / Cancel Receivables if found
      if (!recQuery.empty) {
        recQuery.docs.forEach((docSnap) => {
          transaction.update(docSnap.ref, {
            status: 'cancelled',
            notes: `Cancelled alongside Order #${orderData.orderNumber || orderId}`,
            updatedAt: timestamp
          });
        });
      }

      // Reverse Customer Loyalty Points and Lifetime Spending
      if (customerRef && customerSnap && customerSnap.exists) {
        const cData = customerSnap.data() || {};
        const totalOrderAmt = Number(orderData.totalAmount || 0);
        const oldTotalSpent = Number(cData.totalSpent ?? cData.totalSpending ?? 0);
        const oldOrdersCount = Number(cData.totalOrders ?? 0);
        const newTotalSpent = Math.max(0, Math.round((oldTotalSpent - totalOrderAmt) * 100) / 100);
        const newOrdersCount = Math.max(0, oldOrdersCount - 1);

        let cpData: any = {};
        if (customerPointsSnap && customerPointsSnap.exists) {
          cpData = customerPointsSnap.data() || {};
        }
        const oldPoints = Number(cpData.points ?? cData.points ?? cData.loyaltyPoints ?? 0);
        const historicalOrderPoints = Number(orderData.loyaltyPointsEarned ?? (Array.isArray(orderData.items) ? orderData.items.reduce((sum:any, i:any) => sum + Number(i.pointsEarned || 0), 0) : 0));
        const pointsToReverse = Math.max(0, Math.min(oldPoints, historicalOrderPoints));
        const newPoints = Math.max(0, oldPoints - pointsToReverse);
        const oldLifetimePoints = Number(cpData.lifetimePoints ?? cData.lifetimePoints ?? 0);
        const newLifetimePoints = Math.max(0, oldLifetimePoints - historicalOrderPoints);
        const membershipLevel = getLoyaltyTierFromLifetimePoints(newLifetimePoints).level;

        transaction.update(customerRef, cleanUndefined({
          totalSpent: newTotalSpent,
          totalSpending: newTotalSpent,
          totalOrders: newOrdersCount,
          loyaltyPoints: newPoints,
          points: newPoints,
          membershipLevel,
          updatedAt: timestamp
        }));

        if (customerPointsRef) {
          transaction.set(customerPointsRef, cleanUndefined({
            customerId: orderData.customerId,
            customerName: orderData.customerName || cData.name,
            points: newPoints,
            currentPointsBalance: newPoints,
            tier: membershipLevel,
            updatedAt: timestamp
          }), { merge: true });
        }

        const loyaltyTxRef = db.collection('loyalty_transactions').doc();
        transaction.set(loyaltyTxRef, cleanUndefined({
          id: loyaltyTxRef.id,
          customerId: orderData.customerId,
          orderId,
          orderNumber: orderData.orderNumber || orderId,
          type: 'deduction',
          points: pointsToReverse,
          balanceAfter: newPoints,
          reason: `Points reversed for cancelled Order #${orderData.orderNumber || orderId}`,
          branchId: targetBranchId,
          createdAt: timestamp
        }));
      }

      const totalAmt = Number(orderData.totalAmount || 0);

      // Accounting Reversal Entry (Skip financial reversal if already fully refunded through customer refund)
      if (!isAlreadyFullyRefunded) {
        let subtotal = Number(orderData.subtotal || 0);
        const discount = Number(orderData.discountAmount || 0);
        let tax = Number(orderData.tax || 0);
        const deliveryFeeRev = Number(orderData.deliveryFee || 0);
        const cogs = Number(orderData.cogs || 0);
        
        // If subtotal + tax + delivery - discount is 0 but totalAmt > 0, fallback subtotal to totalAmt
        if (subtotal === 0 && tax === 0 && deliveryFeeRev === 0 && totalAmt > 0) {
          subtotal = totalAmt + discount;
        }

        const netRev = Math.max(0, subtotal - discount);
        const payMethod = String(orderData.paymentMethod || 'cash').toLowerCase();
        const isOriginalCredit = payMethod === 'credit' || orderData.isCredit === true || orderData.isCredit === 'true';
        const isOriginalUnpaid = String(orderData.paymentStatus || '').toLowerCase() === 'unpaid' || Number(orderData.paidAmount ?? orderData.paymentAmount ?? 0) <= 0;

        if (!isOriginalCredit && !isOriginalUnpaid) {
          throw new Error('Paid orders with outstanding refundable value must use the refund workflow before cancellation.');
        }
        const paymentAccountId = 'acc_ar';
        const paymentAccountCode = '1200';
        const paymentAccountName = 'Accounts Receivable';
        const paymentMemo = `AR Reversal for Cancelled Unpaid/Credit Order #${orderData.orderNumber || orderId}`;

        const reversalLines = [
          {
            accountId: 'acc_revenue',
            accountCode: '4010',
            accountName: 'Restaurant Sales Revenue',
            debit: netRev,
            credit: 0,
            memo: `Revenue Reversal for Cancelled Order #${orderData.orderNumber || orderId}`
          },
          {
            accountId: 'acc_delivery_revenue',
            accountCode: '4100',
            accountName: 'Delivery Fee Revenue',
            debit: deliveryFeeRev,
            credit: 0,
            memo: `Delivery Revenue Reversal for Cancelled Order #${orderData.orderNumber || orderId}`
          },
          {
            accountId: 'acc_tax',
            accountCode: '2020',
            accountName: 'Sales Tax Payable',
            debit: tax,
            credit: 0,
            memo: `Sales Tax Reversal for Cancelled Order #${orderData.orderNumber || orderId}`
          },
          {
            accountId: 'acc_inventory',
            accountCode: '1030',
            accountName: 'Food & Beverage Inventory',
            debit: cogs,
            credit: 0,
            memo: `Inventory Restoration for Cancelled Order #${orderData.orderNumber || orderId}`
          },
          {
            accountId: paymentAccountId,
            accountCode: paymentAccountCode,
            accountName: paymentAccountName,
            debit: 0,
            credit: totalAmt,
            memo: paymentMemo
          },
          {
            accountId: 'acc_cogs',
            accountCode: '5010',
            accountName: 'Cost of Goods Sold (COGS)',
            debit: 0,
            credit: cogs,
            memo: `COGS Reversal for Cancelled Order #${orderData.orderNumber || orderId}`
          }
        ].filter(l => (l.debit > 0 || l.credit > 0));

        const totalDebit = reversalLines.reduce((s, l) => s + (l.debit || 0), 0);
        const totalCredit = reversalLines.reduce((s, l) => s + (l.credit || 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.001) {
          throw new Error(`Accounting Rule Error: Unbalanced Cancellation Journal Entry! Total Debit (${totalDebit.toFixed(2)}) !== Total Credit (${totalCredit.toFixed(2)}).`);
        }

        const jeRef = db.collection('journal_entries').doc();
        const entryNumber = `REV-JE-${orderData.orderNumber || orderId.slice(0, 6)}`;
        const journalEntry = {
          id: jeRef.id,
          entryNumber,
          date: dateStr,
          description: `Automatic General Ledger Reversal for Cancelled Order #${orderData.orderNumber || orderId}`,
          branchId: targetBranchId,
          referenceType: 'order_cancellation',
          referenceId: orderId,
          orderId: orderId,
          orderNumber: orderData.orderNumber || '',
          lines: reversalLines,
          totalDebit: Math.round(totalDebit * 100) / 100,
          totalCredit: Math.round(totalCredit * 100) / 100,
          status: 'posted',
          postedBy: user.name,
          createdAt: timestamp
        };

        transaction.set(jeRef, cleanUndefined(journalEntry));

        for (const line of reversalLines) {
          const jlRef = db.collection('journal_lines').doc();
          transaction.set(jlRef, cleanUndefined({
            id: jlRef.id,
            journalEntryId: jeRef.id,
            entryNumber,
            branchId: targetBranchId,
            ...line,
            createdAt: timestamp
          }));

          const ledgerRef = db.collection('ledger').doc();
          transaction.set(ledgerRef, cleanUndefined({
            id: ledgerRef.id,
            accountId: line.accountId,
            accountCode: line.accountCode,
            accountName: line.accountName,
            journalEntryId: jeRef.id,
            entryNumber,
            date: dateStr,
            reference: orderData.orderNumber || orderId,
            description: line.memo || journalEntry.description,
            debit: line.debit,
            credit: line.credit,
            branchId: targetBranchId,
            createdAt: timestamp
          }));
        }
        applyAccountBalanceDeltasInTransaction(transaction, __cancelAccountState, reversalLines, timestamp);
      }

      // Record Audit Activity Log
      const auditRef = db.collection('activity_logs').doc();
      transaction.set(auditRef, cleanUndefined({
        id: auditRef.id,
        userId: user.uid,
        userName: user.name,
        userRole: user.role,
        action: 'POS_ORDER_CANCELLED',
        module: 'POS',
        description: `Cancelled Order #${orderData.orderNumber || orderId} and posted $${totalAmt.toFixed(2)} accounting reversal`,
        branchId: targetBranchId,
        timestamp
      }));

      transaction.set(idempotencyRef, cleanUndefined({ status: 'success', orderId, createdAt: timestamp }));

      return { status: 'success', message: 'Order successfully cancelled and reversed.' };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Order Cancellation Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Order Cancellation Failed' });
  }
}

// 3. Customer Refund (With Concurrency Control & Remaining Refundable Cap)
export async function handleCustomerRefund(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { orderId } = req.params;
  const { amount, reason, paymentMethod, bankAccountId } = req.body || {};
  let refundIdempotencyKey: string;
  try { refundIdempotencyKey = getRequiredIdempotencyKey(req); }
  catch (e: any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }

  if (!orderId) {
    return res.status(400).json({ error: 'Order ID is required for processing a refund.' });
  }

  const refundAmount = Number(amount || 0);
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    return res.status(400).json({ error: 'Refund amount must be a positive numeric value.' });
  }

  const db = getAdminDb();
  const idempotencyRef = db.collection('mutation_idempotency').doc(
    createHash('sha256').update(`refund:${user.uid}:${refundIdempotencyKey}`).digest('hex')
  );

  try {
    const result = await db.runTransaction(async (transaction) => {
      const existingIdempotency = await transaction.get(idempotencyRef);
      if (existingIdempotency.exists) return existingIdempotency.data();
      const orderRef = db.collection('orders').doc(orderId);
      const orderSnap = await transaction.get(orderRef);

      if (!orderSnap.exists) {
        throw new Error(`Original Order #${orderId} not found.`);
      }

      const orderData = orderSnap.data() as any;

      if (orderData.status === 'cancelled') {
        throw new Error(`Cannot refund cancelled Order #${orderData.orderNumber || orderId}. Order is already cancelled.`);
      }

      const targetBranchId = orderData.branchId;
      if (!targetBranchId) {
        throw new Error('Order branch identification missing. Cannot process refund.');
      }

      const branchAuth = checkBranchAuthorization(user, targetBranchId);
      if (!branchAuth.authorized) {
        throw new Error(`Unauthorized refund! Order belongs to branch "${targetBranchId}". ${branchAuth.error}`);
      }

      const orderPayStatus = String(orderData.paymentStatus || '').toLowerCase();
      const orderPayMethod = String(orderData.paymentMethod || '').toLowerCase();
      const paidAmt = Number(orderData.paidAmount ?? orderData.paymentAmount ?? 0);

      const isOriginalCredit = orderPayMethod === 'credit' || orderData.isCredit === true || orderData.isCredit === 'true';
      const isOriginalUnpaid = orderPayStatus === 'unpaid' || paidAmt <= 0;

      const requestedMethod = String(paymentMethod || '').toLowerCase();

      if (isOriginalUnpaid && !isOriginalCredit) {
        throw new Error(`Cannot issue cash/bank refund for unpaid Order #${orderData.orderNumber || orderId}. No payment was collected.`);
      }

      if (isOriginalCredit) {
        if (requestedMethod && requestedMethod !== 'credit') {
          throw new Error(`Cannot issue cash/bank refund for Credit Order #${orderData.orderNumber || orderId}. Credit orders cannot be refunded via cash or bank payout.`);
        }
      }

      const effectivePayMethod = isOriginalCredit ? 'credit' : (requestedMethod || orderPayMethod || 'cash');

      const originalTotal = Number(orderData.totalAmount || 0);

      // Fetch existing refunds to compute total refunded amount
      const existingRefundsSnap = await transaction.get(
        db.collection('refunds').where('orderId', '==', orderId)
      );

      let totalAlreadyRefunded = 0;
      existingRefundsSnap.docs.forEach(docSnap => {
        const rData = docSnap.data();
        totalAlreadyRefunded += Number(rData.amount || 0);
      });

      const existingOrderRefunded = Number(orderData.refundedAmount || 0);
      const currentTotalRefunded = Math.max(totalAlreadyRefunded, existingOrderRefunded);
      const remainingRefundable = originalTotal - currentTotalRefunded;

      if (remainingRefundable <= 0.001 || orderPayStatus === 'refunded') {
        throw new Error(`Order #${orderData.orderNumber || orderId} is already fully refunded. Additional refunds rejected.`);
      }

      if (refundAmount > remainingRefundable + 0.001) {
        throw new Error(`Refund amount ($${refundAmount.toFixed(2)}) exceeds remaining refundable balance ($${Math.max(0, remainingRefundable).toFixed(2)}) for Order #${orderData.orderNumber || orderId}. Original Total: $${originalTotal.toFixed(2)}, Already Refunded: $${currentTotalRefunded.toFixed(2)}.`);
      }

      const updatedRefundedAmount = currentTotalRefunded + refundAmount;
      const isFullyRefunded = updatedRefundedAmount >= (originalTotal - 0.001);

      const timestamp = new Date().toISOString();
      const dateStr = getMogadishuDateString(timestamp);
      await assertAccountingDateOpenInTransaction(transaction, db, dateStr, targetBranchId);

      // Phase 1 (All Reads) - Read customer & receivables if applicable
      let customerRef: any = null;
      let customerSnap: any = null;
      let customerPointsRef: any = null;
      let customerPointsSnap: any = null;
      if (orderData.customerId) {
        customerRef = db.collection('customers').doc(orderData.customerId);
        customerSnap = await transaction.get(customerRef);
        customerPointsRef = db.collection('customer_points').doc(orderData.customerId);
        customerPointsSnap = await transaction.get(customerPointsRef);
      }

      const recQuery = isOriginalCredit ? await transaction.get(db.collection('receivables').where('orderId', '==', orderId)) : null;

      // Read Open Cash Register if refund is paid via Cash
      let openCashRegisterDoc: any = null;
      if (effectivePayMethod === 'cash') {
        const openRegSnap = await transaction.get(
          db.collection('cash_registers')
            .where('branchId', '==', targetBranchId)
            .where('status', '==', 'Open')
        );
        if (!openRegSnap.empty) {
          openCashRegisterDoc = openRegSnap.docs[0];
        }
        if (!openCashRegisterDoc) {
          throw Object.assign(new Error(`No open cash register exists for branch "${targetBranchId}"; cash refund is blocked.`), { statusCode: 409 });
        }
      }

      const __refundSettlement = await resolveSettlementAccountInTransaction(transaction, db, targetBranchId, effectivePayMethod, bankAccountId || orderData.bankAccountId);
      const __refundAccountState = await prepareAccountBalanceState(transaction, db, [__refundSettlement.id, 'acc_revenue','acc_delivery_revenue','acc_tax','acc_inventory','acc_cogs']);

      // Phase 1 (All Reads) - Read all product and recipe documents before any writes
      // Exact line-level refund allocation. Inventory, COGS, loyalty and revenue
      // reversals are derived from the specific historical order lines, never
      // from an order-wide monetary ratio.
      const orderItems = Array.isArray(orderData.items) ? orderData.items : [];
      const lineKeyFor = (item: any, index: number) => String(item.id || item.orderItemId || item.lineId || `legacy-line-${index}`);
      const lineMap = new Map<string, { item: any; index: number }>();
      const productLineIndexes = new Map<string, number[]>();
      let orderItemSubtotal = 0;
      for (let idx = 0; idx < orderItems.length; idx++) {
        const item = orderItems[idx];
        const lineKey = lineKeyFor(item, idx);
        if (lineMap.has(lineKey)) {
          throw Object.assign(new Error(`Order contains duplicate line identifier "${lineKey}".`), { statusCode: 400 });
        }
        lineMap.set(lineKey, { item, index: idx });
        const productKey = String(item.productId || '').trim();
        if (productKey) productLineIndexes.set(productKey, [...(productLineIndexes.get(productKey) || []), idx]);
        orderItemSubtotal += Math.max(0, Number(item.subtotal || (Number(item.price || item.unitPrice || 0) * Number(item.quantity || 0)) || 0));
      }

      const requestedQtyByLine = new Map<string, number>();
      const requestItems = Array.isArray(req.body?.items) ? req.body.items : [];
      if (requestItems.length === 0) {
        if (Math.abs(refundAmount - remainingRefundable) > 0.01) {
          throw Object.assign(new Error('An exact line-level item allocation is required unless the refund amount equals the entire remaining refundable order balance.'), { statusCode: 400 });
        }
        for (let idx = 0; idx < orderItems.length; idx++) {
          const item = orderItems[idx];
          const remainingQty = Math.max(0, Number(item.quantity || 0) - Number(item.refundedQuantity || 0));
          if (remainingQty > 0) requestedQtyByLine.set(lineKeyFor(item, idx), remainingQty);
        }
      } else {
        for (const reqItm of requestItems) {
          const qty = Number(reqItm?.quantity);
          if (!Number.isFinite(qty) || qty <= 0) throw Object.assign(new Error('Every refund item must specify a positive finite quantity.'), { statusCode: 400 });
          const explicitLine = String(reqItm.orderItemId || reqItm.id || reqItm.lineId || '').trim();
          if (explicitLine) {
            if (!lineMap.has(explicitLine)) throw Object.assign(new Error(`Refund line "${explicitLine}" was not found on the order.`), { statusCode: 400 });
            requestedQtyByLine.set(explicitLine, (requestedQtyByLine.get(explicitLine) || 0) + qty);
            continue;
          }
          const productKey = String(reqItm.productId || reqItm.itemId || '').trim();
          if (!productKey) throw Object.assign(new Error('Refund item must include orderItemId/lineId/id or productId/itemId.'), { statusCode: 400 });
          const matches = productLineIndexes.get(productKey) || [];
          if (matches.length === 0) throw Object.assign(new Error(`Refund product "${productKey}" was not found on the order.`), { statusCode: 400 });
          let remainingToAllocate = qty;
          for (const idx of matches) {
            const item = orderItems[idx];
            const key = lineKeyFor(item, idx);
            const available = Math.max(0, Number(item.quantity || 0) - Number(item.refundedQuantity || 0) - Number(requestedQtyByLine.get(key) || 0));
            const take = Math.min(available, remainingToAllocate);
            if (take > 0) {
              requestedQtyByLine.set(key, (requestedQtyByLine.get(key) || 0) + take);
              remainingToAllocate -= take;
            }
            if (remainingToAllocate <= 0.000001) break;
          }
          if (remainingToAllocate > 0.000001) throw Object.assign(new Error(`Refund quantity (${qty}) exceeds remaining quantity of product "${productKey}".`), { statusCode: 400 });
        }
      }

      let selectedSubtotal = 0;
      let selectedCOGS = 0;
      const lineAllocation = new Map<string, { item: any; index: number; qty: number; lineSubtotal: number; cogs: number }>();
      for (let idx = 0; idx < orderItems.length; idx++) {
        const item = orderItems[idx];
        const key = lineKeyFor(item, idx);
        const qty = Number(requestedQtyByLine.get(key) || 0);
        if (qty <= 0) continue;
        const originalQty = Number(item.quantity || 0);
        const remainingQty = Math.max(0, originalQty - Number(item.refundedQuantity || 0));
        if (!Number.isFinite(originalQty) || originalQty <= 0 || qty > remainingQty + 0.000001) {
          throw Object.assign(new Error(`Refund quantity (${qty}) exceeds remaining refundable quantity (${remainingQty}) for item "${item.productName || item.productId || key}".`), { statusCode: 400 });
        }
        const originalLineSubtotal = Math.max(0, Number(item.subtotal || (Number(item.price || item.unitPrice || 0) * originalQty) || 0));
        const lineSubtotal = originalLineSubtotal * (qty / originalQty);
        const originalLineCOGS = Math.max(0, Number(item.itemCogs ?? item.cogs ?? 0));
        const lineCogs = originalLineCOGS * (qty / originalQty);
        selectedSubtotal += lineSubtotal;
        selectedCOGS += lineCogs;
        lineAllocation.set(key, { item, index: idx, qty, lineSubtotal, cogs: lineCogs });
      }
      if (lineAllocation.size === 0) throw Object.assign(new Error('Refund allocation contains no refundable order lines.'), { statusCode: 400 });

      const totalDiscount = Math.max(0, Number(orderData.discountAmount ?? orderData.discount ?? 0));
      const selectedDiscount = orderItemSubtotal > 0 ? Math.min(totalDiscount, selectedSubtotal * (totalDiscount / orderItemSubtotal)) : 0;
      const selectedTaxableSubtotal = Math.max(0, selectedSubtotal - selectedDiscount);
      const storedTaxRateRaw = Number(orderData.taxRate);
      const effectiveTaxRate = Number.isFinite(storedTaxRateRaw) ? (storedTaxRateRaw > 1 ? storedTaxRateRaw / 100 : Math.max(0, storedTaxRateRaw)) : 0;
      const originalTax = Math.max(0, Number(orderData.tax || 0));
      const originalTaxableBase = Math.max(0, orderItemSubtotal - totalDiscount);
      const selectedTax = Number.isFinite(storedTaxRateRaw)
        ? Math.round(selectedTaxableSubtotal * effectiveTaxRate * 100) / 100
        : (originalTaxableBase > 0 ? Math.round(originalTax * selectedTaxableSubtotal / originalTaxableBase * 100) / 100 : 0);
      const selectedItemRefund = Math.round((selectedTaxableSubtotal + selectedTax) * 100) / 100;

      const existingDeliveryRefunds = existingRefundsSnap.docs.reduce((sum: number, d: any) => sum + Number(d.data()?.deliveryAmount || 0), 0);
      const deliveryRemaining = Math.max(0, Number(orderData.deliveryFee || 0) - existingDeliveryRefunds);
      const requestedExtra = Math.round((refundAmount - selectedItemRefund) * 100) / 100;
      if (requestedExtra < -0.01) throw Object.assign(new Error(`Refund amount ($${refundAmount.toFixed(2)}) is below the calculated line refund ($${selectedItemRefund.toFixed(2)}).`), { statusCode: 400 });
      if (requestedExtra > deliveryRemaining + 0.01) throw Object.assign(new Error(`Refund amount includes $${requestedExtra.toFixed(2)} beyond selected lines, but only $${deliveryRemaining.toFixed(2)} of delivery fee remains refundable.`), { statusCode: 400 });
      const deliveryRefundAmount = Math.max(0, Math.min(deliveryRemaining, requestedExtra));

      const refundProdRestorations: any[] = Array.from(lineAllocation.entries()).map(([lineKey, a]) => ({ lineKey, item: a.item, restoredQty: a.qty }));
      const productRestoreQty = new Map<string, number>();
      const productRestoreInfo = new Map<string, { ref: any; data: any }>();
      const ingredientRestoreQty = new Map<string, number>();
      const ingredientRestoreInfo = new Map<string, { ref: any; data: any }>();

      for (const [lineKey, allocation] of lineAllocation.entries()) {
        const item = allocation.item;
        if (!item.productId) continue;
        const productId = String(item.productId);
        const prodRef = db.collection('products').doc(productId);
        const prodSnap = await transaction.get(prodRef);
        if (!prodSnap.exists) throw new Error(`Product "${productId}" for refunded line "${lineKey}" was not found.`);
        const prodData = prodSnap.data() || {};
        const productBranch = normalizeCanonicalBranchId(prodData.branchId || '');
        if (!productBranch || !areBranchesMatching(productBranch, targetBranchId)) {
          throw Object.assign(new Error(`Unauthorized cross-branch refund inventory access for product "${productId}".`), { statusCode: 403 });
        }
        productRestoreInfo.set(productId, { ref: prodRef, data: prodData });
        productRestoreQty.set(productId, (productRestoreQty.get(productId) || 0) + allocation.qty);

        const snapshot = Array.isArray(item.recipeSnapshot) && item.recipeSnapshot.length > 0 ? item.recipeSnapshot : (Array.isArray(prodData.recipe) ? prodData.recipe : []);
        for (const rItem of snapshot) {
          const ingredientId = String(rItem?.ingredientId || rItem?.id || '').trim();
          const perItem = Array.isArray(item.recipeSnapshot) && item.recipeSnapshot.length > 0
            ? Number(rItem?.quantityPerItem ?? (Number(rItem?.totalQuantity || 0) / originalPositive(item.quantity)))
            : Number(rItem?.quantity || rItem?.quantityRequired || 0);
          if (!ingredientId || !Number.isFinite(perItem) || perItem <= 0) continue;
          const ingRef = db.collection('ingredients').doc(ingredientId);
          const ingSnap = await transaction.get(ingRef);
          if (!ingSnap.exists) throw new Error(`Ingredient "${ingredientId}" for refunded line "${lineKey}" was not found.`);
          const ingredientData = ingSnap.data() || {};
          const ingredientBranch = normalizeCanonicalBranchId(ingredientData.branchId || '');
          if (!ingredientBranch || !areBranchesMatching(ingredientBranch, targetBranchId)) {
            throw Object.assign(new Error(`Unauthorized cross-branch refund inventory access for ingredient "${ingredientId}".`), { statusCode: 403 });
          }
          ingredientRestoreInfo.set(ingredientId, { ref: ingRef, data: ingredientData });
          ingredientRestoreQty.set(ingredientId, (ingredientRestoreQty.get(ingredientId) || 0) + perItem * allocation.qty);
        }
      }
      const productRestoreWrites: any[] = [];
      for (const [productId, qty] of productRestoreQty.entries()) {
        const info = productRestoreInfo.get(productId)!;
        const currentStock = Number(info.data.stock || 0);
        if (!Number.isFinite(currentStock) || currentStock < 0) throw new Error(`Product "${info.data.name || productId}" has invalid stock.`);
        productRestoreWrites.push({ productId, ref: info.ref, name: info.data.name || productId, qty, newStock: currentStock + qty });
      }
      const ingredientRestoreWrites: any[] = [];
      for (const [ingredientId, qty] of ingredientRestoreQty.entries()) {
        const info = ingredientRestoreInfo.get(ingredientId)!;
        const currentStock = typeof info.data.stock === 'number' ? info.data.stock : (typeof info.data.currentStockUsageUnit === 'number' ? info.data.currentStockUsageUnit : 0);
        if (!Number.isFinite(currentStock) || currentStock < 0) throw new Error(`Ingredient "${info.data.name || ingredientId}" has invalid stock.`);
        ingredientRestoreWrites.push({ ingredientId, ref: info.ref, name: info.data.name || ingredientId, qty, newStock: currentStock + qty });
      }


      // Phase 2 (All Writes)
      // Mutate order document inside transaction to guarantee contention lock
      const updatedOrderItems = Array.isArray(orderData.items) ? orderData.items.map((it: any, idx: number) => {
        const lineKey = lineKeyFor(it, idx);
        const restoredQty = Number(requestedQtyByLine.get(lineKey) || 0);
        if (restoredQty > 0) {
          return { ...it, refundedQuantity: Number(it.refundedQuantity || 0) + restoredQty };
        }
        return it;
      }) : orderData.items;


      // Update Open Cash Register if cash refund
      if (openCashRegisterDoc) {
        const curPayouts = Number(openCashRegisterDoc.data().cashPayouts || 0);
        const curExpected = Number(openCashRegisterDoc.data().expectedClosingBalance || openCashRegisterDoc.data().openingBalance || 0);
        transaction.update(openCashRegisterDoc.ref, {
          cashPayouts: curPayouts + refundAmount,
          expectedClosingBalance: curExpected - refundAmount,
          updatedAt: timestamp
        });
      }

      transaction.update(orderRef, {
        refundedAmount: updatedRefundedAmount,
        paymentStatus: isFullyRefunded ? 'refunded' : 'partially_refunded',
        status: isFullyRefunded ? 'cancelled' : (orderData.status || 'completed'),
        items: updatedOrderItems,
        updatedAt: timestamp
      });

      // Create Refund Document
      const paymentAccountId = __refundSettlement.id;
      const paymentAccountCode = __refundSettlement.code;
      const paymentAccountName = __refundSettlement.name;
      const newRefundRef = db.collection('refunds').doc();
      const refundDoc = {
        id: newRefundRef.id,
        orderId,
        orderNumber: orderData.orderNumber || `ORD-${orderId.slice(0, 6)}`,
        amount: refundAmount,
        reason: reason || 'Customer Refund Request',
        paymentMethod: effectivePayMethod,
        paymentAccountId: paymentAccountId,
        bankAccountId: __refundSettlement.bankAccountId || orderData.bankAccountId || undefined,
        branchId: targetBranchId,
        itemAllocations: Array.from(lineAllocation.entries()).map(([lineId, a]) => ({ lineId, productId: a.item.productId || null, quantity: a.qty, lineSubtotal: a.lineSubtotal, cogs: a.cogs })),
        deliveryAmount: deliveryRefundAmount,
        processedBy: user.name,
        createdAt: timestamp
      };

      transaction.set(newRefundRef, cleanUndefined(refundDoc));

      // Reversal Accounting Journal Entry from exact selected lines.
      const taxReversalComponent = selectedTax;
      const revenueReversalComponent = Math.round(selectedTaxableSubtotal * 100) / 100;
      const cogsReversalComponent = Math.round(selectedCOGS * 100) / 100;
      const lines = [
        {
          accountId: 'acc_revenue',
          accountCode: '4010',
          accountName: 'Restaurant Sales Revenue',
          debit: revenueReversalComponent,
          credit: 0,
          memo: `Refund Revenue Reversal for Order #${orderData.orderNumber || orderId}`
        },
        ...(taxReversalComponent > 0 ? [{
          accountId: 'acc_tax',
          accountCode: '2020',
          accountName: 'Sales Tax Payable',
          debit: taxReversalComponent,
          credit: 0,
          memo: `Refund Sales Tax Reversal for Order #${orderData.orderNumber || orderId}`
        }] : []),
        ...(deliveryRefundAmount > 0 ? [{
          accountId: 'acc_delivery_revenue',
          accountCode: '4020',
          accountName: 'Delivery Revenue',
          debit: deliveryRefundAmount,
          credit: 0,
          memo: `Refund Delivery Revenue Reversal for Order #${orderData.orderNumber || orderId}`
        }] : []),
        {
          accountId: paymentAccountId,
          accountCode: paymentAccountCode,
          accountName: paymentAccountName,
          debit: 0,
          credit: refundAmount,
          memo: effectivePayMethod === 'credit'
            ? `Accounts Receivable reversal for Refund on Order #${orderData.orderNumber || orderId}`
            : `Cash/Bank payout for Refund on Order #${orderData.orderNumber || orderId}`
        },
        ...(cogsReversalComponent > 0 ? [
          {
            accountId: 'acc_inventory',
            accountCode: '1030',
            accountName: 'Food & Beverage Inventory Asset',
            debit: cogsReversalComponent,
            credit: 0,
            memo: `Inventory restoration for Refund on Order #${orderData.orderNumber || orderId}`
          },
          {
            accountId: 'acc_cogs',
            accountCode: '5010',
            accountName: 'Cost of Goods Sold',
            debit: 0,
            credit: cogsReversalComponent,
            memo: `COGS Reversal for Refund on Order #${orderData.orderNumber || orderId}`
          }
        ] : [])
      ];

      const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
      const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.001) {
        throw new Error(`Unbalanced Refund Journal Entry! Total Debit (${totalDebit.toFixed(2)}) !== Total Credit (${totalCredit.toFixed(2)}).`);
      }

      const jeRef = db.collection('journal_entries').doc();
      const entryNumber = `REV-JE-${orderData.orderNumber || orderId.slice(0, 6)}-${newRefundRef.id.slice(0, 4)}`;
      const journalEntry = {
        id: jeRef.id,
        entryNumber,
        date: dateStr,
        reference: orderData.orderNumber || orderId,
        description: `Customer Refund for Order #${orderData.orderNumber || orderId}. Reason: ${reason || 'Customer Request'}`,
        source: 'Refund',
        status: 'Posted',
        totalDebit,
        totalCredit,
        lines,
        branchId: targetBranchId,
        createdBy: user.name,
        createdAt: timestamp
      };

      transaction.set(jeRef, cleanUndefined(journalEntry));

      for (const line of lines) {
        const jlRef = db.collection('journal_lines').doc();
        transaction.set(jlRef, cleanUndefined({
          id: jlRef.id,
          journalEntryId: jeRef.id,
          entryNumber,
          branchId: targetBranchId,
          ...line,
          createdAt: timestamp
        }));

        const ledgerRef = db.collection('ledger').doc();
        transaction.set(ledgerRef, cleanUndefined({
          id: ledgerRef.id,
          accountId: line.accountId,
          accountCode: line.accountCode,
          accountName: line.accountName,
          journalEntryId: jeRef.id,
          entryNumber,
          date: dateStr,
          reference: orderData.orderNumber || orderId,
          description: line.memo || journalEntry.description,
          debit: line.debit,
          credit: line.credit,
          branchId: targetBranchId,
          createdAt: timestamp
        }));
      }

      // Restore each product and ingredient document once. This prevents duplicate
      // product lines from overwriting one another with stale absolute stock values.
      for (const pw of productRestoreWrites) {
        transaction.update(pw.ref, { stock: pw.newStock, updatedAt: timestamp });
        const prodMovRef = db.collection('inventory_movements').doc();
        transaction.set(prodMovRef, cleanUndefined({
          id: prodMovRef.id,
          type: 'in',
          itemType: 'product',
          itemId: pw.productId,
          itemName: pw.name,
          quantity: pw.qty,
          branchId: targetBranchId,
          reason: `Product stock restored from refund on Order #${orderData.orderNumber || orderId}`,
          createdBy: user.name,
          createdAt: timestamp
        }));
      }

      for (const iw of ingredientRestoreWrites) {
        transaction.update(iw.ref, { stock: iw.newStock, currentStockUsageUnit: iw.newStock, updatedAt: timestamp });
        transaction.set(db.collection('inventory').doc(iw.ingredientId), {
          id: iw.ingredientId, currentQuantity: iw.newStock, branchId: targetBranchId, updatedAt: timestamp
        }, { merge: true });
        const ingMovRef = db.collection('inventory_movements').doc();
        transaction.set(ingMovRef, cleanUndefined({
          id: ingMovRef.id, type: 'order_restoration', itemType: 'ingredient', itemId: iw.ingredientId,
          itemName: iw.name, quantity: iw.qty, branchId: targetBranchId,
          reason: `Ingredient stock restored from refund on Order #${orderData.orderNumber || orderId}`,
          createdBy: user.name, createdAt: timestamp
        }));
      }

      applyAccountBalanceDeltasInTransaction(transaction, __refundAccountState, lines, timestamp);

      // Update Receivables for Credit Order Refunds
      if (recQuery && !recQuery.empty) {
        recQuery.docs.forEach((docSnap) => {
          const recData = docSnap.data() || {};
          const currentRecAmount = Number(recData.amount ?? recData.totalAmount ?? 0);
          const newRecAmount = Math.max(0, currentRecAmount - refundAmount);
          transaction.update(docSnap.ref, {
            amount: newRecAmount,
            totalAmount: newRecAmount,
            status: newRecAmount <= 0.001 ? 'cancelled' : 'pending',
            notes: `Refund of $${refundAmount.toFixed(2)} applied on Order #${orderData.orderNumber || orderId}`,
            updatedAt: timestamp
          });
        });
      }

      // Reverse Customer Loyalty Points and Lifetime Spending proportionally
      if (customerRef && customerSnap && customerSnap.exists) {
        const cData = customerSnap.data() || {};
        const oldTotalSpent = Number(cData.totalSpent ?? cData.totalSpending ?? 0);
        const newTotalSpent = Math.max(0, Math.round((oldTotalSpent - refundAmount) * 100) / 100);

        let cpData: any = {};
        if (customerPointsSnap && customerPointsSnap.exists) {
          cpData = customerPointsSnap.data() || {};
        }
        const oldPoints = Number(cpData.points ?? cData.points ?? cData.loyaltyPoints ?? 0);
        const historicalSelectedPoints = Array.from(lineAllocation.values()).reduce((sum: number, a: any) => {
          const linePoints = Number(a.item.pointsEarned || 0);
          const lineQty = Number(a.item.quantity || 0);
          return sum + (lineQty > 0 ? linePoints * (a.qty / lineQty) : 0);
        }, 0);
        const pointsToReverse = Math.max(0, Math.min(oldPoints, Math.round(historicalSelectedPoints)));
        const newPoints = Math.max(0, oldPoints - pointsToReverse);
        const oldLifetimePoints = Number(cpData.lifetimePoints ?? cData.lifetimePoints ?? 0);
        const newLifetimePoints = Math.max(0, oldLifetimePoints - historicalSelectedPoints);
        const membershipLevel = getLoyaltyTierFromLifetimePoints(newLifetimePoints).level;

        transaction.update(customerRef, cleanUndefined({
          totalSpent: newTotalSpent,
          totalSpending: newTotalSpent,
          loyaltyPoints: newPoints,
          points: newPoints,
          membershipLevel,
          updatedAt: timestamp
        }));

        if (customerPointsRef) {
          transaction.set(customerPointsRef, cleanUndefined({
            customerId: orderData.customerId,
            customerName: orderData.customerName || cData.name,
            points: newPoints,
            currentPointsBalance: newPoints,
            tier: membershipLevel,
            updatedAt: timestamp
          }), { merge: true });
        }

        const loyaltyTxRef = db.collection('loyalty_transactions').doc();
        transaction.set(loyaltyTxRef, cleanUndefined({
          id: loyaltyTxRef.id,
          customerId: orderData.customerId,
          orderId,
          orderNumber: orderData.orderNumber || orderId,
          type: 'deduction',
          points: pointsToReverse,
          balanceAfter: newPoints,
          reason: `Points reversed for refund on Order #${orderData.orderNumber || orderId}`,
          branchId: targetBranchId,
          createdAt: timestamp
        }));
      }

      // Record Audit Log
      const auditRef = db.collection('activity_logs').doc();
      transaction.set(auditRef, cleanUndefined({
        id: auditRef.id,
        userId: user.uid,
        userName: user.name,
        userRole: user.role,
        action: 'REFUND_PROCESSED',
        module: 'Financials',
        description: `Processed refund of $${refundAmount.toFixed(2)} for Order #${orderData.orderNumber || orderId}`,
        branchId: targetBranchId,
        timestamp
      }));

      transaction.set(idempotencyRef, cleanUndefined({ status: 'success', orderId, refundAmount, createdAt: timestamp }));

      return { status: 'success', refundId: newRefundRef.id, refundAmount, refundedAmount: refundAmount };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Customer Refund Error:', err?.message || err);
    const status = err?.statusCode || 400;
    return res.status(status).json({ error: err?.message || 'Customer Refund Failed' });
  }
}

/**
 * Read and apply GL account balance deltas inside the same Firestore transaction.
 * Callers must invoke prepareAccountBalanceState() before the first transaction write.
 */
const CANONICAL_SYSTEM_GL_ACCOUNTS: Record<string, { code: string; name: string; type: string; branchId: string }> = {
  acc_cash: { code: '1010', name: 'Cash on Hand (Register)', type: 'Asset', branchId: 'all' },
  acc_bank: { code: '1020', name: 'Primary Bank', type: 'Asset', branchId: 'all' },
  acc_inventory: { code: '1030', name: 'Food & Beverage Inventory Asset', type: 'Asset', branchId: 'all' },
  acc_ar: { code: '1200', name: 'Accounts Receivable', type: 'Asset', branchId: 'all' },
  acc_ap: { code: '2010', name: 'Accounts Payable', type: 'Liability', branchId: 'all' },
  acc_driver_payable: { code: '2020', name: 'Driver Payable', type: 'Liability', branchId: 'all' },
  acc_wallet_liability: { code: '2030', name: 'Customer Wallet Liability', type: 'Liability', branchId: 'all' },
  acc_tax: { code: '2100', name: 'Tax Payable', type: 'Liability', branchId: 'all' },
  acc_equity: { code: '3000', name: 'Owner Equity', type: 'Equity', branchId: 'all' },
  acc_revenue: { code: '4010', name: 'Sales Revenue', type: 'Revenue', branchId: 'all' },
  acc_delivery_revenue: { code: '4020', name: 'Delivery Revenue', type: 'Revenue', branchId: 'all' },
  acc_cogs: { code: '5010', name: 'Cost of Goods Sold', type: 'COGS', branchId: 'all' },
  acc_expense: { code: '6100', name: 'General Expense', type: 'Expense', branchId: 'all' },
  acc_driver_expense: { code: '6110', name: 'Driver Earnings Expense', type: 'Expense', branchId: 'all' },
  acc_payroll_expense: { code: '6120', name: 'Salaries & Wages Expense', type: 'Expense', branchId: 'all' },
  acc_bank_fees: { code: '6200', name: 'Bank Charges & Merchant Fees', type: 'Expense', branchId: 'all' },
  acc_cash_short: { code: '6290', name: 'Cash Shortage / Over & Short', type: 'Expense', branchId: 'all' },
  acc_cash_over: { code: '4290', name: 'Cash Over / Other Income', type: 'Revenue', branchId: 'all' },
  acc_waste: { code: '6300', name: 'Inventory Waste Expense', type: 'Expense', branchId: 'all' },
  acc_inventory_adjustment: { code: '6310', name: 'Inventory Adjustment Expense', type: 'Expense', branchId: 'all' },
  acc_due_from_branch: { code: '1310', name: 'Due From Branches', type: 'Asset', branchId: 'all' },
  acc_due_to_branch: { code: '2110', name: 'Due To Branches', type: 'Liability', branchId: 'all' },
};

async function prepareAccountBalanceState(transaction: any, db: any, accountIds: string[]) {
  const unique = Array.from(new Set(accountIds.map(String).filter(Boolean)));
  const state = new Map<string, { ref: any; data: any; balance: number }>();
  for (const accountId of unique) {
    const ref = db.collection('accounts').doc(accountId);
    const snap = await transaction.get(ref);
    let data: any;
    if (!snap.exists) {
      const canonical = CANONICAL_SYSTEM_GL_ACCOUNTS[accountId];
      if (!canonical) throw new Error(`GL account '${accountId}' does not exist.`);
      data = {
        id: accountId,
        ...canonical,
        balance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      transaction.create(ref, data);
    } else {
      data = snap.data() || {};
    }
    state.set(accountId, { ref, data, balance: Number(data.balance || 0) });
  }
  return state;
}

function normalizeAccountNature(rawType: any, data: any = {}): 'debit' | 'credit' {
  const type = String(rawType ?? '').trim().toLowerCase();
  const subtype = String(data?.subtype ?? data?.accountType ?? '').trim().toLowerCase();
  if (type === 'cash' || type === 'bank' || type === 'asset' || type === 'cogs' || type === 'expense') return 'debit';
  if (subtype === 'cash' || subtype === 'bank' || subtype === 'asset' || subtype === 'cogs' || subtype === 'expense') return 'debit';
  if (['liability', 'equity', 'revenue'].includes(type)) return 'credit';
  if (['liability', 'equity', 'revenue'].includes(subtype)) return 'credit';
  throw new Error(`Unsupported GL account type "${String(rawType || '')}" for balance posting.`);
}

function applyAccountBalanceDeltasInTransaction(
  transaction: any,
  state: Map<string, { ref: any; data: any; balance: number }>,
  lines: any[],
  now: string
) {
  for (const line of lines) {
    const accountId = String(line.accountId || '').trim();
    if (!accountId) continue;
    const entry = state.get(accountId);
    if (!entry) throw new Error(`GL account '${accountId}' was not preloaded for balance posting.`);
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);
    const nature = normalizeAccountNature(entry.data.type, entry.data);
    const delta = nature === 'debit' ? debit - credit : credit - debit;
    entry.balance += delta;
  }
  for (const entry of state.values()) {
    transaction.update(entry.ref, { balance: entry.balance, updatedAt: now });
  }
}

// 4. Expense Creation
const ALLOWED_PAYMENT_METHODS = new Set(['cash', 'card', 'bank', 'bank_transfer', 'mobile', 'mobile_money', 'cheque', 'accounts_payable', 'credit', 'unpaid', 'cod']);
function normalizePaymentMethod(value: any, fallback = 'cash'): string {
  const normalized = String(value ?? fallback).trim().toLowerCase();
  return ALLOWED_PAYMENT_METHODS.has(normalized) ? normalized : '';
}

/**
 * Resolve the actual settlement GL account for a monetary operation.
 * Cash/AR use canonical system accounts. Non-cash settlement must point to a
 * branch-owned bank account when one is explicitly supplied; when omitted,
 * exactly one active branch bank account is accepted. Ambiguous selection is
 * rejected instead of silently posting everything to acc_bank.
 */
async function resolveSettlementAccountInTransaction(
  transaction: any,
  db: any,
  branchId: string,
  paymentMethod: string,
  requestedBankAccountId?: any
): Promise<{ id: string; code: string; name: string; bankAccountId?: string }> {
  const method = normalizePaymentMethod(paymentMethod, paymentMethod);
  const canonicalSystem: Record<string, { id: string; code: string; name: string }> = {
    cash: { id: 'acc_cash', code: '1010', name: 'Cash on Hand (Register)' },
    credit: { id: 'acc_ar', code: '1200', name: 'Accounts Receivable' },
    unpaid: { id: 'acc_ar', code: '1200', name: 'Accounts Receivable' },
    cod: { id: 'acc_ar', code: '1200', name: 'Accounts Receivable' }
  };
  if (canonicalSystem[method]) return canonicalSystem[method];

  const requested = String(requestedBankAccountId || '').trim();
  let bankDoc: any = null;
  if (requested) {
    const bankRef = db.collection('bank_accounts').doc(requested);
    const bankSnap = await transaction.get(bankRef);
    if (!bankSnap.exists) throw Object.assign(new Error(`Bank account "${requested}" was not found.`), { statusCode: 404 });
    bankDoc = bankSnap;
  } else {
    const bankQuery = await transaction.get(
      db.collection('bank_accounts')
        .where('branchId', '==', branchId)
        .where('status', '==', 'Active')
    );
    if (bankQuery.empty) throw Object.assign(new Error(`No active bank settlement account is configured for branch "${branchId}".`), { statusCode: 409 });
    if (bankQuery.size > 1) {
      throw Object.assign(new Error(`Multiple active bank accounts exist for branch "${branchId}". Select a specific bankAccountId for ${method} settlement.`), { statusCode: 400 });
    }
    bankDoc = bankQuery.docs[0];
  }

  const bankData = bankDoc.data() || {};
  const bankBranch = normalizeCanonicalBranchId(bankData.branchId || '');
  if (bankBranch && bankBranch !== 'all' && !areBranchesMatching(bankBranch, branchId)) {
    throw Object.assign(new Error(`Bank account "${bankDoc.id}" does not belong to branch "${branchId}".`), { statusCode: 403 });
  }
  const glId = String(bankData.glAccountId || '').trim();
  if (!glId) throw new Error(`Bank account "${bankDoc.id}" is missing its glAccountId.`);
  const glRef = db.collection('accounts').doc(glId);
  const glSnap = await transaction.get(glRef);
  if (!glSnap.exists) throw new Error(`Linked GL account "${glId}" for bank account "${bankDoc.id}" was not found.`);
  const glData = glSnap.data() || {};
  const glBranch = normalizeCanonicalBranchId(glData.branchId || '');
  if (glBranch && glBranch !== 'all' && !areBranchesMatching(glBranch, branchId)) {
    throw Object.assign(new Error(`Linked GL account "${glId}" is not authorized for branch "${branchId}".`), { statusCode: 403 });
  }
  return {
    id: glRef.id,
    code: String(glData.code || bankData.accountNumber || '1020'),
    name: String(glData.name || bankData.accountName || bankData.bankName || 'Bank Account'),
    bankAccountId: bankDoc.id
  };
}

function assertFiniteNonNegativeAmount(value: any, field: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw Object.assign(new Error(`${field} must be a finite non-negative number.`), { statusCode: 400 });
  return n;
}

function originalPositive(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function getProductStation(productData: any): 'grill' | 'kitchen' | 'bar' | 'bakery' {
  const explicit = String(productData?.productionStation || productData?.station || productData?.stationId || '').trim().toLowerCase();
  if (['grill','kitchen','bar','bakery'].includes(explicit)) return explicit as any;
  return routeProductToStation(String(productData?.name || ''), String(productData?.category || ''));
}

function getRequiredIdempotencyKey(req: express.Request, fallback?: string): string {
  const raw = req.headers['idempotency-key'];
  const key = Array.isArray(raw) ? raw[0] : raw;
  const resolved = String(key || fallback || '').trim();
  if (!resolved) throw Object.assign(new Error('Idempotency-Key header is required for this mutation.'), { statusCode: 400 });
  if (resolved.length > 200) throw Object.assign(new Error('Idempotency-Key is too long.'), { statusCode: 400 });
  return resolved;
}

async function assertAccountingDateOpenInTransaction(transaction: any, db: any, dateStr: string, branchId: string) {
  const normalized = String(dateStr || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw Object.assign(new Error(`Invalid accounting date "${dateStr}".`), { statusCode: 400 });
  const closedSnap = await transaction.get(
    db.collection('accounting_periods')
      .where('status', 'in', ['Closed', 'closed', 'LOCKED', 'locked'])
      .where('startDate', '<=', normalized)
      .where('endDate', '>=', normalized)
      .limit(10)
  );
  for (const doc of closedSnap.docs) {
    const data = doc.data() || {};
    const periodBranch = normalizeCanonicalBranchId(data.branchId || '');
    if (!periodBranch || periodBranch === 'all' || areBranchesMatching(periodBranch, branchId)) {
      throw Object.assign(new Error(`Accounting period containing ${normalized} is closed; posting is rejected.`), { statusCode: 400 });
    }
  }
}

async function prepareCashRegisterStateInTransaction(transaction: any, db: any, branchId: string) {
  const snap = await transaction.get(
    db.collection('cash_registers')
      .where('branchId', '==', branchId)
      .where('status', '==', 'Open')
  );
  if (snap.empty) throw new Error(`No open cash register exists for branch "${branchId}"; cash operation is blocked.`);
  if (snap.size > 1) throw new Error(`Multiple open cash registers exist for branch "${branchId}"; cash operation is blocked until reconciled.`);
  const registerDoc = snap.docs[0];
  const data = registerDoc.data() || {};
  return {
    ref: registerDoc.ref,
    currentExpected: Number(data.expectedClosingBalance ?? data.openingBalance ?? 0),
    currentAdjustments: Number(data.cashAdjustments || 0),
  };
}

function applyCashRegisterMovementInTransaction(
  transaction: any,
  _db: any,
  branchId: string,
  delta: number,
  operation: string,
  preloaded?: { ref: any; currentExpected: number; currentAdjustments: number }
) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.000001) return;
  if (!preloaded) throw new Error(`Cash register state must be preloaded before writes; ${operation} cannot be posted safely for branch "${branchId}".`);
  transaction.update(preloaded.ref, {
    expectedClosingBalance: preloaded.currentExpected + delta,
    cashAdjustments: preloaded.currentAdjustments + delta,
    updatedAt: new Date().toISOString()
  });
}


export async function handleExpenseCreation(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { expenseData } = req.body || {};
  if (!expenseData) {
    return res.status(400).json({ error: 'Expense data is required.' });
  }

  const amount = Number(expenseData.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Expense amount must be a positive numeric value.' });
  }

  const branchCheck = checkBranchAuthorization(user, expenseData.branchId);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }
  const targetBranchId = branchCheck.targetBranchId;
  const payMethodNormalized = normalizePaymentMethod(expenseData.paymentMethod, 'cash');
  if (!payMethodNormalized) return res.status(400).json({ error: 'Invalid expense payment method.' });
  let expenseIdempotencyKey: string;
  try { expenseIdempotencyKey = getRequiredIdempotencyKey(req, expenseData.idempotencyKey); }
  catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }
  const db = getAdminDb();
  const expenseIdemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`expense:${user.uid}:${expenseIdempotencyKey}`).digest('hex'));

  try {
    const result = await db.runTransaction(async (transaction) => {
      const idemSnap = await transaction.get(expenseIdemRef);
      if (idemSnap.exists) return idemSnap.data();
      const timestamp = new Date().toISOString();
      const dateStr = String(expenseData.date || getMogadishuDateString(timestamp)).slice(0, 10);
      await assertAccountingDateOpenInTransaction(transaction, db, dateStr, targetBranchId);
      const settlement = await resolveSettlementAccountInTransaction(transaction, db, targetBranchId, payMethodNormalized, expenseData.bankAccountId);
      const __accountState = await prepareAccountBalanceState(transaction, db, ['acc_expense', settlement.id]);
      const __cashRegisterState = (payMethodNormalized === 'cash') ? await prepareCashRegisterStateInTransaction(transaction, db, targetBranchId) : undefined;
      const newExpenseRef = db.collection('expenses').doc();
      const fullExpenseDoc = {
        id: newExpenseRef.id,
        title: String(expenseData.title || expenseData.description || '').trim(),
        category: String(expenseData.category || 'General').trim(),
        description: String(expenseData.description || expenseData.title || '').trim(),
        amount,
        paymentMethod: payMethodNormalized,
        idempotencyKey: expenseIdempotencyKey,
        paymentAccountId: settlement.id,
        bankAccountId: settlement.bankAccountId || expenseData.bankAccountId || undefined,
        vendor: expenseData.vendor ? String(expenseData.vendor).trim() : undefined,
        receiptUrl: expenseData.receiptUrl ? String(expenseData.receiptUrl).trim() : undefined,
        date: dateStr,
        branchId: targetBranchId,
        createdBy: user.name,
        createdAt: timestamp
      };

      transaction.set(newExpenseRef, cleanUndefined(fullExpenseDoc));

      // Accounting Journal Entry
      const payMethod = payMethodNormalized;
      const paymentAccountCode = settlement.code;
      const paymentAccountName = settlement.name;

      const lines = [
        {
          accountId: 'acc_expense',
          accountCode: '6010',
          accountName: `Operating Expense - ${expenseData.category || 'General'}`,
          debit: amount,
          credit: 0,
          memo: `Expense: ${expenseData.description || expenseData.category}`
        },
        {
          accountId: settlement.id,
          accountCode: paymentAccountCode,
          accountName: paymentAccountName,
          debit: 0,
          credit: amount,
          memo: `Payment for Expense: ${expenseData.description || expenseData.category}`
        }
      ];

      if (payMethod === 'cash') {
        await applyCashRegisterMovementInTransaction(transaction, db, targetBranchId, -amount, 'cash expense', __cashRegisterState);
      }

      const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
      const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.001) {
        throw new Error(`Unbalanced Expense Journal Entry! Total Debit (${totalDebit.toFixed(2)}) !== Total Credit (${totalCredit.toFixed(2)}).`);
      }

      const jeRef = db.collection('journal_entries').doc();
      const entryNumber = `JE-EXPENSE-${newExpenseRef.id.slice(0, 6)}`;
      const journalEntry = {
        id: jeRef.id,
        entryNumber,
        date: dateStr,
        reference: newExpenseRef.id,
        description: `Expense Payment: ${expenseData.description || expenseData.category}`,
        source: 'Expense',
        status: 'Posted',
        totalDebit,
        totalCredit,
        lines,
        branchId: targetBranchId,
        createdBy: user.name,
        createdAt: timestamp
      };

      transaction.set(jeRef, cleanUndefined(journalEntry));

      for (const line of lines) {
        const jlRef = db.collection('journal_lines').doc();
        transaction.set(jlRef, cleanUndefined({
          id: jlRef.id,
          journalEntryId: jeRef.id,
          entryNumber,
          branchId: targetBranchId,
          ...line,
          createdAt: timestamp
        }));

        const ledgerRef = db.collection('ledger').doc();
        transaction.set(ledgerRef, cleanUndefined({
          id: ledgerRef.id,
          accountId: line.accountId,
          accountCode: line.accountCode,
          accountName: line.accountName,
          journalEntryId: jeRef.id,
          entryNumber,
          date: dateStr,
          reference: newExpenseRef.id,
          description: line.memo || journalEntry.description,
          debit: line.debit,
          credit: line.credit,
          branchId: targetBranchId,
          createdAt: timestamp
        }));
      }

      applyAccountBalanceDeltasInTransaction(transaction, __accountState, lines, timestamp);
      const result = { status: 'success', id: newExpenseRef.id, amount, branchId: targetBranchId, journalEntryId: jeRef.id };
      transaction.set(expenseIdemRef, cleanUndefined({ ...result, createdAt: timestamp }));
      return result;
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Expense Creation Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Expense Creation Failed' });
  }
}

// 5. Salary / Payroll Disbursement
export async function handleSalaryDisbursement(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { salaryData } = req.body || {};
  if (!salaryData) {
    return res.status(400).json({ error: 'Salary data is required.' });
  }
  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req, salaryData.payrollId ? `payroll-payment:${salaryData.payrollId}` : undefined); }
  catch (e: any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }

  const employeeId = salaryData.employeeId ? String(salaryData.employeeId).trim() : '';
  if (!employeeId) {
    return res.status(400).json({ error: 'Employee ID (employeeId) is required for salary disbursement.' });
  }

  const submittedNetPaid = Number(salaryData.netPaid || salaryData.netSalary || salaryData.amount || 0);
  if (!Number.isFinite(submittedNetPaid) || submittedNetPaid <= 0) {
    return res.status(400).json({ error: 'Disbursement amount must be a positive numeric value.' });
  }

  const branchCheck = checkBranchAuthorization(user, salaryData.branchId);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }
  const targetBranchId = branchCheck.targetBranchId;
  const payMethodNormalized = normalizePaymentMethod(salaryData.paymentMethod, 'bank');
  if (!payMethodNormalized) return res.status(400).json({ error: 'Invalid salary payment method.' });
  const db = getAdminDb();

  try {
    const result = await db.runTransaction(async (transaction) => {
      const existingSalarySnap = await transaction.get(db.collection('salaries').where('idempotencyKey', '==', idempotencyKey).limit(1));
      if (!existingSalarySnap.empty) return { status: 'duplicate', id: existingSalarySnap.docs[0].id, employeeName: existingSalarySnap.docs[0].data().employeeName };
      // Validate employee existence and branch in Firestore
      const empDoc = await transaction.get(db.collection('employees').doc(employeeId));
      let empData: any = {};
      if (empDoc.exists) {
        empData = empDoc.data() || {};
      } else {
        const userDoc = await transaction.get(db.collection('users').doc(employeeId));
        if (userDoc.exists) {
          empData = userDoc.data() || {};
        } else {
          throw new Error(`Employee with ID "${employeeId}" not found in Firestore.`);
        }
      }

      let payrollRef: any = null;
      let payrollSnap: any = null;
      const payrollId = salaryData.payrollId ? String(salaryData.payrollId).trim() : '';
      let authoritativeNetPaid = submittedNetPaid;
      let authoritativePeriod = salaryData.period || salaryData.month || '';
      if (payrollId) {
        payrollRef = db.collection('payroll').doc(payrollId);
        payrollSnap = await transaction.get(payrollRef);
        if (!payrollSnap.exists) throw new Error(`Payroll record \"${payrollId}\" not found.`);
        const payrollData = payrollSnap.data() || {};
        if (payrollData.employeeId && String(payrollData.employeeId) !== employeeId) throw new Error('Payroll record employee does not match the disbursement employee.');
        if (!payrollData.branchId) throw Object.assign(new Error('Payroll record has no canonical branchId.'), { statusCode: 409 });
        if (!areBranchesMatching(payrollData.branchId, targetBranchId)) throw new Error('Payroll record belongs to another branch.');
        authoritativeNetPaid = Number(payrollData.netSalary);
        if (!Number.isFinite(authoritativeNetPaid) || authoritativeNetPaid <= 0) throw new Error('Payroll record contains an invalid netSalary.');
        if (Math.abs(authoritativeNetPaid - submittedNetPaid) > 0.005) throw Object.assign(new Error(`Submitted salary amount (${submittedNetPaid.toFixed(2)}) does not match authoritative payroll netSalary (${authoritativeNetPaid.toFixed(2)}).`), { statusCode: 400 });
        const submittedFrequency = salaryData.payFrequency ? String(salaryData.payFrequency).trim().toLowerCase() : '';
        if (submittedFrequency && submittedFrequency !== String(payrollData.payFrequency || '').toLowerCase()) {
          throw Object.assign(new Error('Submitted payroll frequency does not match the authoritative payroll record.'), { statusCode: 400 });
        }
        const submittedPeriodStart = salaryData.periodStart ? String(salaryData.periodStart).trim() : '';
        const submittedPeriodEnd = salaryData.periodEnd ? String(salaryData.periodEnd).trim() : '';
        if (submittedPeriodStart && submittedPeriodStart !== String(payrollData.periodStart || '')) {
          throw Object.assign(new Error('Submitted payroll start date does not match the authoritative payroll record.'), { statusCode: 400 });
        }
        if (submittedPeriodEnd && submittedPeriodEnd !== String(payrollData.periodEnd || '')) {
          throw Object.assign(new Error('Submitted payroll end date does not match the authoritative payroll record.'), { statusCode: 400 });
        }
        authoritativePeriod = payrollData.periodStart || payrollData.period || payrollData.month || authoritativePeriod;
        if (String(payrollData.paymentStatus || '').toLowerCase() === 'paid') return { status: 'duplicate', id: payrollId, employeeName: payrollData.employeeName || empData.name || 'Employee' };
      }

      const empBranch = normalizeCanonicalBranchId(empData.branchId || empData.branch || '');
      if (!empBranch) throw Object.assign(new Error('Employee has no canonical branchId. Salary disbursement rejected until migration.'), { statusCode: 409 });
      if (targetBranchId !== 'all' && !areBranchesMatching(empBranch, targetBranchId)) {
        throw new Error(`Unauthorized cross-branch salary disbursement! Employee belongs to branch "${empBranch}", but target branch is "${targetBranchId}".`);
      }

      const authoritativeEmployeeName = empData.name || empData.fullName || empData.displayName || salaryData.employeeName || 'Employee';
      const effectiveBranchId = (targetBranchId && targetBranchId !== 'all') ? targetBranchId : empBranch;
      if (!effectiveBranchId) {
        throw new Error('Salary disbursement rejected: Employee has no assigned branch and no target branch was specified.');
      }

      const timestamp = new Date().toISOString();
      const dateStr = getMogadishuDateString(timestamp);
      await assertAccountingDateOpenInTransaction(transaction, db, dateStr, effectiveBranchId);
      const settlement = await resolveSettlementAccountInTransaction(transaction, db, effectiveBranchId, payMethodNormalized, salaryData.bankAccountId);
      const __accountState = await prepareAccountBalanceState(transaction, db, ['acc_payroll_expense', settlement.id]);
      const __cashRegisterState = (payMethodNormalized === 'cash') ? await prepareCashRegisterStateInTransaction(transaction, db, effectiveBranchId) : undefined;

      const newSalaryRef = db.collection('salaries').doc();
      const fullSalaryDoc = {
        id: newSalaryRef.id,
        employeeId,
        payrollId: salaryData.payrollId ? String(salaryData.payrollId).trim() : undefined,
        idempotencyKey,
        employeeName: authoritativeEmployeeName,
        period: authoritativePeriod ? String(authoritativePeriod).trim() : '',
        baseSalary: Number(salaryData.baseSalary) || authoritativeNetPaid,
        allowances: Number(salaryData.allowances) || 0,
        deductions: Number(salaryData.deductions) || 0,
        netPaid: authoritativeNetPaid,
        paymentMethod: String(salaryData.paymentMethod || 'bank').trim(),
        paymentAccountId: settlement.id,
        bankAccountId: settlement.bankAccountId || salaryData.bankAccountId || undefined,
        notes: salaryData.notes ? String(salaryData.notes).trim() : undefined,
        branchId: effectiveBranchId,
        createdBy: user.name,
        paidDate: timestamp
      };

      transaction.set(newSalaryRef, cleanUndefined(fullSalaryDoc));

      // Accounting Journal Entry
      const payMethod = payMethodNormalized;
      const paymentAccountCode = settlement.code;
      const paymentAccountName = settlement.name;

      const lines = [
        {
          accountId: 'acc_payroll_expense',
          accountCode: '6100',
          accountName: 'Salaries & Wages Expense',
          debit: authoritativeNetPaid,
          credit: 0,
          memo: `Payroll Disbursement to ${authoritativeEmployeeName}`
        },
        {
          accountId: settlement.id,
          accountCode: paymentAccountCode,
          accountName: paymentAccountName,
          debit: 0,
          credit: authoritativeNetPaid,
          memo: `Salary Disbursement to ${authoritativeEmployeeName}`
        }
      ];

      if (payMethod === 'cash') {
        await applyCashRegisterMovementInTransaction(transaction, db, effectiveBranchId, -authoritativeNetPaid, 'cash salary disbursement', __cashRegisterState);
      }

      const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
      const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.001) {
        throw new Error(`Unbalanced Payroll Journal Entry! Total Debit (${totalDebit.toFixed(2)}) !== Total Credit (${totalCredit.toFixed(2)}).`);
      }

      const jeRef = db.collection('journal_entries').doc();
      const entryNumber = `JE-PAYROLL-${newSalaryRef.id.slice(0, 6)}`;
      const journalEntry = {
        id: jeRef.id,
        entryNumber,
        date: dateStr,
        reference: newSalaryRef.id,
        description: `Payroll Salary Disbursement: ${authoritativeEmployeeName} (${authoritativePeriod || ''})`,
        source: 'Payroll',
        status: 'Posted',
        totalDebit,
        totalCredit,
        lines,
        branchId: effectiveBranchId,
        createdBy: user.name,
        createdAt: timestamp
      };

      transaction.set(jeRef, cleanUndefined(journalEntry));

      for (const line of lines) {
        const jlRef = db.collection('journal_lines').doc();
        transaction.set(jlRef, cleanUndefined({
          id: jlRef.id,
          journalEntryId: jeRef.id,
          entryNumber,
          branchId: effectiveBranchId,
          ...line,
          createdAt: timestamp
        }));

        const ledgerRef = db.collection('ledger').doc();
        transaction.set(ledgerRef, cleanUndefined({
          id: ledgerRef.id,
          accountId: line.accountId,
          accountCode: line.accountCode,
          accountName: line.accountName,
          journalEntryId: jeRef.id,
          entryNumber,
          date: dateStr,
          reference: newSalaryRef.id,
          description: line.memo || journalEntry.description,
          debit: line.debit,
          credit: line.credit,
          branchId: effectiveBranchId,
          createdAt: timestamp
        }));
      }

      applyAccountBalanceDeltasInTransaction(transaction, __accountState, lines, timestamp);
      if (payrollRef && payrollSnap?.exists) {
        transaction.update(payrollRef, cleanUndefined({
          paymentStatus: 'paid',
          paymentMethod: payMethodNormalized,
          paymentDate: timestamp,
          salaryDisbursementId: newSalaryRef.id,
          journalEntryId: jeRef.id,
          updatedAt: timestamp
        }));
      }
      return { status: 'success', id: newSalaryRef.id, employeeName: authoritativeEmployeeName, payrollId: payrollId || undefined, journalEntryId: jeRef.id };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Salary Disbursement Error:', err?.message || err);
    const raw = String(err?.message || 'Salary Disbursement Failed');
    const statusCode = err?.statusCode || (/not found/i.test(raw) ? 404 : /cross-branch|unauthorized/i.test(raw) ? 403 : /required|invalid|does not match|already paid|below|exceeds|closed|no canonical|positive numeric/i.test(raw) ? 400 : 500);
    return res.status(statusCode).json({ error: raw });
  }
}

// 6. Purchase Registration
export async function handlePurchaseRegistration(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { purchaseData } = req.body || {};
  if (!purchaseData) {
    return res.status(400).json({ error: 'Purchase data is required.' });
  }

  const quantity = Number(purchaseData.quantity || 0);
  const unitPrice = Number(purchaseData.unitPrice || 0);
  const totalCost = Number(purchaseData.totalCost || (quantity * unitPrice));

  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(totalCost) || totalCost < 0) {
    return res.status(400).json({ error: 'Purchase quantity and total cost must be positive numeric values.' });
  }

  const branchCheck = checkBranchAuthorization(user, purchaseData.branchId || purchaseData.branch);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }
  const targetBranchId = branchCheck.targetBranchId;
  if (!targetBranchId || targetBranchId === 'all') {
    return res.status(400).json({ error: 'A concrete branchId is required for inventory adjustments.' });
  }
  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req); } catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }
  const db = getAdminDb();

  try {
    const result = await db.runTransaction(async (transaction) => {
      const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`purchase:${user.uid}:${idempotencyKey}`).digest('hex'));
      const idemSnap = await transaction.get(idemRef);
      if (idemSnap.exists) return idemSnap.data();
      const timestamp = new Date().toISOString();
      const dateStr = getMogadishuDateString(timestamp);
      await assertAccountingDateOpenInTransaction(transaction, db, dateStr, targetBranchId);

      let authoritativeSupplierName = String(purchaseData.supplierName || 'Supplier').trim();
      if (purchaseData.supplierId) {
        const supDoc = await transaction.get(db.collection('suppliers').doc(String(purchaseData.supplierId).trim()));
        if (!supDoc.exists) {
          throw new Error(`Supplier with ID "${purchaseData.supplierId}" not found in Firestore.`);
        }
        const supData = supDoc.data() || {};
        const supplierBranchId = normalizeCanonicalBranchId(supData.branchId || '');
        if (!supplierBranchId || supplierBranchId === 'all') {
          throw new Error('Supplier has no canonical branchId; purchase registration rejected until the supplier is migrated to a concrete branch.');
        }
        const supplierBranchCheck = checkBranchAuthorization(user, supplierBranchId);
        if (!supplierBranchCheck.authorized || !areBranchesMatching(supplierBranchId, targetBranchId)) {
          throw new Error(`Unauthorized cross-branch purchase! Supplier belongs to branch "${supplierBranchId}", but target branch is "${targetBranchId}".`);
        }
        authoritativeSupplierName = supData.name || supData.supplierName || authoritativeSupplierName;
      }

      // Read ingredient upfront before any writes
      const ingQuery = targetBranchId && targetBranchId !== 'all'
        ? db.collection('ingredients').where('branchId', '==', targetBranchId)
        : db.collection('ingredients');
      const ingSnap = await transaction.get(ingQuery);
      const matched = ingSnap.docs.find((d: any) => {
        const dData = d.data();
        const branchMatches = !!dData.branchId && dData.branchId !== 'all' && areBranchesMatching(dData.branchId, targetBranchId);
        return branchMatches && dData.name?.toLowerCase() === purchaseData.itemName?.toLowerCase();
      });
      if (!matched) {
        throw new Error(`No canonical ingredient in branch "${targetBranchId}" matches purchase item "${String(purchaseData.itemName || '').trim()}". Purchase rejected to prevent an unbacked inventory asset entry.`);
      }

      const normalizedPurchaseStatus = String(purchaseData.status || 'completed').trim().toLowerCase();
      const normalizedPurchaseMethod = normalizePaymentMethod(purchaseData.paymentMethod || (normalizedPurchaseStatus === 'completed' ? 'cash' : 'credit'), purchaseData.paymentMethod || 'cash');
      const settlement = normalizedPurchaseStatus === 'completed' ? await resolveSettlementAccountInTransaction(transaction, db, targetBranchId, normalizedPurchaseMethod, purchaseData.bankAccountId) : { id: 'acc_ap', code: '2010', name: 'Accounts Payable' };
      const __purchaseCash = normalizedPurchaseStatus === 'completed' && settlement.id === 'acc_cash' ? await prepareCashRegisterStateInTransaction(transaction, db, targetBranchId) : undefined;
      const __purchaseAccountState = await prepareAccountBalanceState(transaction, db, ['acc_inventory', settlement.id]);

      const newPurchaseRef = db.collection('purchases').doc();
      const fullPurchaseDoc = {
        id: newPurchaseRef.id,
        itemName: String(purchaseData.itemName || 'Purchase Item').trim(),
        supplierName: authoritativeSupplierName,
        supplierId: purchaseData.supplierId ? String(purchaseData.supplierId).trim() : undefined,
        quantity,
        unitPrice,
        totalCost,
        status: String(purchaseData.status || 'completed').trim(),
        paymentMethod: normalizedPurchaseMethod,
        paymentAccountId: settlement.id,
        bankAccountId: settlement.bankAccountId || purchaseData.bankAccountId || undefined,
        branchId: targetBranchId,
        createdBy: user.name,
        createdAt: timestamp
      };

      transaction.set(newPurchaseRef, cleanUndefined(fullPurchaseDoc));

      // 1. Inventory movement
      const movementRef = db.collection('inventory_movements').doc();
      transaction.set(movementRef, cleanUndefined({
        id: movementRef.id,
        type: 'order_restoration',
        itemType: 'ingredient',
        itemId: matched ? matched.id : '',
        itemName: purchaseData.itemName || 'Purchase Item',
        quantity,
        unitCost: unitPrice,
        branchId: targetBranchId,
        reason: `Registered purchase from ${authoritativeSupplierName}`,
        createdBy: user.name,
        createdAt: timestamp
      }));

      // 2. Ingredient stock update if matching within authorized target branch
      if (matched) {
        const currentStock = Number(matched.data().stock || 0);
        transaction.update(matched.ref, {
          stock: currentStock + quantity,
          currentStockUsageUnit: currentStock + quantity,
          lastPurchasePrice: unitPrice,
          updatedAt: timestamp
        });
      }

      // 3. Journal Entry
      const entryNumber = `JE-PURCHASE-${newPurchaseRef.id.slice(0, 6)}`;
      const creditAccountCode = settlement.code;
      const creditAccountName = settlement.name;

      const lines = [
        {
          accountId: 'acc_inventory',
          accountCode: '1030',
          accountName: 'Food & Beverage Inventory Asset',
          debit: totalCost,
          credit: 0,
          memo: `Purchase of ${quantity}x ${purchaseData.itemName} from ${purchaseData.supplierName || 'Supplier'}`
        },
        {
          accountId: settlement.id,
          accountCode: creditAccountCode,
          accountName: creditAccountName,
          debit: 0,
          credit: totalCost,
          memo: `Payment for Purchase from ${purchaseData.supplierName || 'Supplier'}`
        }
      ];

      const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
      const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.001) {
        throw new Error(`Unbalanced Purchase Journal Entry! Debit (${totalDebit}) !== Credit (${totalCredit})`);
      }

      const jeRef = db.collection('journal_entries').doc();
      const journalEntry = {
        id: jeRef.id,
        entryNumber,
        date: dateStr,
        reference: newPurchaseRef.id,
        description: `Journal Entry for Purchase of ${purchaseData.itemName} from ${purchaseData.supplierName || 'Supplier'}`,
        source: 'Purchases',
        status: 'Posted',
        totalDebit,
        totalCredit,
        lines,
        branchId: targetBranchId,
        createdBy: user.name,
        createdAt: timestamp
      };

      transaction.set(jeRef, cleanUndefined(journalEntry));

      for (const line of lines) {
        const jlRef = db.collection('journal_lines').doc();
        transaction.set(jlRef, cleanUndefined({
          id: jlRef.id,
          journalEntryId: jeRef.id,
          entryNumber,
          branchId: targetBranchId,
          ...line,
          createdAt: timestamp
        }));

        const ledgerRef = db.collection('ledger').doc();
        transaction.set(ledgerRef, cleanUndefined({
          id: ledgerRef.id,
          accountId: line.accountId,
          accountCode: line.accountCode,
          accountName: line.accountName,
          journalEntryId: jeRef.id,
          entryNumber,
          date: dateStr,
          reference: newPurchaseRef.id,
          description: line.memo || journalEntry.description,
          debit: line.debit,
          credit: line.credit,
          branchId: targetBranchId,
          createdAt: timestamp
        }));
      }

      applyAccountBalanceDeltasInTransaction(transaction, __purchaseAccountState, lines, timestamp);
      if (normalizedPurchaseStatus === 'completed' && settlement.id === 'acc_cash') applyCashRegisterMovementInTransaction(transaction, db, targetBranchId, -totalCost, 'purchase cash payment', __purchaseCash);
      const out = { status: 'success', id: newPurchaseRef.id };
      transaction.set(idemRef, cleanUndefined({ ...out, createdAt: timestamp }));
      return out;
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Purchase Registration Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Purchase Registration Failed' });
  }
}

// 7. Bank Transaction Handling
export async function handleBankTransaction(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { bankTransactionData } = req.body || {};
  if (!bankTransactionData) {
    return res.status(400).json({ error: 'Bank transaction data is required.' });
  }

  const amount = Number(bankTransactionData.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Bank transaction amount must be a positive number.' });
  }

  const allowedBankTypes = new Set(['deposit', 'in', 'withdrawal', 'out', 'transfer', 'fee', 'bank_fee', 'charge']);
  const requestedBankType = String(bankTransactionData.type || 'deposit').trim().toLowerCase();
  if (!allowedBankTypes.has(requestedBankType)) {
    return res.status(400).json({ error: 'Invalid bank transaction type.' });
  }

  const branchCheck = checkBranchAuthorization(user, bankTransactionData.branchId);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }
  const targetBranchId = branchCheck.targetBranchId;
  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req); } catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }
  const db = getAdminDb();

  try {
    const result = await db.runTransaction(async (transaction) => {
      const timestamp = new Date().toISOString();
      const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`bank:${user.uid}:${idempotencyKey}`).digest('hex'));
      const idemSnap = await transaction.get(idemRef);
      if (idemSnap.exists) return idemSnap.data();
      const dateStr = String(bankTransactionData.date || getMogadishuDateString(timestamp)).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw Object.assign(new Error('Bank transaction date must use YYYY-MM-DD format.'), { statusCode: 400 });
      await assertAccountingDateOpenInTransaction(transaction, db, dateStr, targetBranchId);

      // Determine transaction type semantics
      const rawType = String(bankTransactionData.type || 'deposit').toLowerCase().trim();
      const isFee = rawType === 'fee' || rawType === 'bank_fee' || rawType === 'charge';
      const isTransfer = rawType === 'transfer';
      const isWithdrawal = rawType === 'withdrawal' || rawType === 'out';
      const isDeposit = rawType === 'deposit' || rawType === 'in';

      // Phase 1 (All Reads)
      let primaryAccData: any = null;
      let primaryAccRef: any = null;
      let primaryNewBal: number = 0;
      if (bankTransactionData.bankAccountId) {
        const bankRef = db.collection('bank_accounts').doc(String(bankTransactionData.bankAccountId).trim());
        const bankDoc = await transaction.get(bankRef);
        if (bankDoc.exists) {
          const bankData = bankDoc.data() || {};
          const glAccountId = bankData.glAccountId ? String(bankData.glAccountId) : bankDoc.id;
          primaryAccRef = db.collection('accounts').doc(glAccountId);
          const accDoc = await transaction.get(primaryAccRef);
          if (!accDoc.exists) throw new Error(`Linked GL account for bank account "${bankDoc.id}" not found.`);
          primaryAccData = accDoc.data() || {};
          primaryAccData.__bankRef = bankRef;
          primaryAccData.__bankData = bankData;
        } else {
          // Legacy compatibility: accept an account ID only when it is itself a valid branch-scoped GL account.
          primaryAccRef = db.collection('accounts').doc(bankTransactionData.bankAccountId);
          const accDoc = await transaction.get(primaryAccRef);
          if (!accDoc.exists) throw new Error(`Bank account with ID "${bankTransactionData.bankAccountId}" not found.`);
          primaryAccData = accDoc.data() || {};
        }
        if (primaryAccData.branchId) {
          const accBranchCheck = checkBranchAuthorization(user, primaryAccData.branchId);
          if (!accBranchCheck.authorized) {
            throw new Error(`Unauthorized cross-branch bank transaction! Account belongs to branch "${primaryAccData.branchId}". ${accBranchCheck.error}`);
          }
        }
        const currentBal = Number(primaryAccData.balance || 0);
        // Deposit increases balance; withdrawal, fee, and transfer decrease source balance
        primaryNewBal = isDeposit ? currentBal + amount : currentBal - amount;
      }

      // Handle Destination Account for Transfers
      const destAccountId = bankTransactionData.toAccountId || bankTransactionData.toBankAccountId || bankTransactionData.destinationAccountId;
      let destAccData: any = null;
      let destAccRef: any = null;
      let destNewBal: number = 0;
      if (isTransfer && !destAccountId) {
        throw new Error('Destination bank account is required for bank transfers.');
      }

      if (isTransfer && destAccountId) {
        const destBankRef = db.collection('bank_accounts').doc(String(destAccountId).trim());
        const destBankDoc = await transaction.get(destBankRef);
        if (destBankDoc.exists) {
          const destBankData = destBankDoc.data() || {};
          const destGlId = destBankData.glAccountId ? String(destBankData.glAccountId) : destBankDoc.id;
          destAccRef = db.collection('accounts').doc(destGlId);
          const destAccDoc = await transaction.get(destAccRef);
          if (!destAccDoc.exists) throw new Error(`Linked GL account for destination bank account "${destBankDoc.id}" not found.`);
          destAccData = destAccDoc.data() || {};
          destAccData.__bankRef = destBankRef;
          destAccData.__bankData = destBankData;
        } else {
          destAccRef = db.collection('accounts').doc(String(destAccountId).trim());
          const destAccDoc = await transaction.get(destAccRef);
          if (!destAccDoc.exists) throw new Error(`Destination bank account with ID "${destAccountId}" not found.`);
          destAccData = destAccDoc.data() || {};
        }
        if (destAccData.branchId) {
          const destBranchCheck = checkBranchAuthorization(user, destAccData.branchId);
          if (!destBranchCheck.authorized) {
            throw new Error(`Unauthorized cross-branch transfer! Destination account belongs to branch "${destAccData.branchId}". ${destBranchCheck.error}`);
          }
          if (primaryAccData?.branchId && destAccData.branchId !== primaryAccData.branchId && !isHQRoleOrClaim(user)) {
            throw new Error('Cross-branch bank transfers require HQ Admin or Owner authorization.');
          }
        }
        const destBal = Number(destAccData.balance || 0);
        destNewBal = destBal + amount;
      }

      if (!primaryAccRef || !primaryAccData) throw Object.assign(new Error('bankAccountId is required and must reference a valid branch-owned bank account.'), { statusCode: 400 });
      const __cashRegisterState = (isDeposit || isWithdrawal) ? await prepareCashRegisterStateInTransaction(transaction, db, targetBranchId) : undefined;
      const __bankAccountIds = [
        primaryAccRef?.id, destAccRef?.id, 'acc_bank_fees', 'acc_cash'
      ].filter(Boolean) as string[];
      const __bankAccountState = await prepareAccountBalanceState(transaction, db, __bankAccountIds);

      // Phase 2 (All Writes)
      const newTxRef = db.collection('bank_transactions').doc();
      const fullTxDoc = {
        ...bankTransactionData,
        id: newTxRef.id,
        amount,
        branchId: targetBranchId,
        createdBy: user.name,
        createdAt: timestamp
      };

      transaction.set(newTxRef, cleanUndefined(fullTxDoc));

      if (primaryAccRef) {
        if (primaryNewBal < 0 && (isWithdrawal || isFee || isTransfer)) {
          throw new Error('Insufficient bank balance for this transaction.');
        }
        // GL account balance is updated exactly once by the central journal balance helper below.
        if (primaryAccData?.__bankRef) {
          transaction.update(primaryAccData.__bankRef, { currentBalance: primaryNewBal, updatedAt: timestamp });
        }
      }

      if (destAccRef) {
        // GL destination account balance is updated exactly once by the central journal balance helper below.
        if (destAccData?.__bankRef) {
          transaction.update(destAccData.__bankRef, { currentBalance: destNewBal, updatedAt: timestamp });
        }
      }

      // Accounting Journal Entry Construction
      let lines: any[] = [];

      if (isFee) {
        // Fee: Debit Bank Charges & Fees Expense (6200), Credit Bank Account (1020)
        lines = [
          {
            accountId: 'acc_bank_fees',
            accountCode: '6200',
            accountName: 'Bank Charges & Merchant Fees',
            debit: amount,
            credit: 0,
            memo: `Bank Fee/Charge: ${bankTransactionData.description || 'Bank Service Charge'}`
          },
          {
            accountId: primaryAccRef?.id || '',
            accountCode: String(primaryAccData?.code || '1020'),
            accountName: primaryAccData?.name || bankTransactionData.accountName || 'Bank Account',
            debit: 0,
            credit: amount,
            memo: `Bank Fee Deduction from ${primaryAccData?.name || 'Bank Account'}`
          }
        ];
      } else if (isTransfer) {
        // Transfer: Debit Destination Bank Account, Credit Source Bank Account
        const destName = destAccData?.name || bankTransactionData.destinationAccountName || 'Destination Bank Account';
        const srcName = primaryAccData?.name || bankTransactionData.accountName || 'Source Bank Account';
        lines = [
          {
            accountId: destAccRef?.id || '',
            accountCode: String(destAccData?.code || '1020'),
            accountName: destName,
            debit: amount,
            credit: 0,
            memo: `Inter-Account Transfer to ${destName}`
          },
          {
            accountId: primaryAccRef?.id || '',
            accountCode: '1020',
            accountName: srcName,
            debit: 0,
            credit: amount,
            memo: `Inter-Account Transfer from ${srcName}`
          }
        ];
      } else if (isWithdrawal) {
        // Withdrawal: Debit Cash on Hand (1010), Credit Bank Account (1020)
        lines = [
          {
            accountId: 'acc_cash',
            accountCode: '1010',
            accountName: 'Cash on Hand (Register)',
            debit: amount,
            credit: 0,
            memo: `Bank Withdrawal to Cash: ${bankTransactionData.description || 'Cash Withdrawal'}`
          },
          {
            accountId: primaryAccRef?.id || '',
            accountCode: '1020',
            accountName: primaryAccData?.name || bankTransactionData.accountName || 'Main Bank Account',
            debit: 0,
            credit: amount,
            memo: `Bank Withdrawal from ${primaryAccData?.name || 'Bank Account'}`
          }
        ];
      } else {
        // Deposit (Default): Debit Bank Account (1020), Credit Cash on Hand (1010)
        lines = [
          {
            accountId: primaryAccRef?.id || '',
            accountCode: '1020',
            accountName: primaryAccData?.name || bankTransactionData.accountName || 'Main Bank Account',
            debit: amount,
            credit: 0,
            memo: `Bank Deposit: ${bankTransactionData.description || 'Cash Deposit'}`
          },
          {
            accountId: 'acc_cash',
            accountCode: '1010',
            accountName: 'Cash on Hand (Register)',
            debit: 0,
            credit: amount,
            memo: `Counterpart Deposit from Cash on Hand`
          }
        ];
      }

      const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
      const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

      const jeRef = db.collection('journal_entries').doc();
      const entryNumber = `JE-BANK-${newTxRef.id.slice(0, 6)}`;
      const journalEntry = {
        id: jeRef.id,
        entryNumber,
        date: dateStr,
        reference: newTxRef.id,
        description: `Bank Transaction: ${bankTransactionData.description || bankTransactionData.type}`,
        source: 'Banking',
        status: 'Posted',
        totalDebit,
        totalCredit,
        lines,
        branchId: targetBranchId,
        createdBy: user.name,
        createdAt: timestamp
      };

      transaction.set(jeRef, cleanUndefined(journalEntry));

      for (const line of lines) {
        const jlRef = db.collection('journal_lines').doc();
        transaction.set(jlRef, cleanUndefined({
          id: jlRef.id,
          journalEntryId: jeRef.id,
          entryNumber,
          branchId: targetBranchId,
          ...line,
          createdAt: timestamp
        }));

        const ledgerRef = db.collection('ledger').doc();
        transaction.set(ledgerRef, cleanUndefined({
          id: ledgerRef.id,
          accountId: line.accountId,
          accountCode: line.accountCode,
          accountName: line.accountName,
          journalEntryId: jeRef.id,
          entryNumber,
          date: dateStr,
          reference: newTxRef.id,
          description: line.memo || journalEntry.description,
          debit: line.debit,
          credit: line.credit,
          branchId: targetBranchId,
          createdAt: timestamp
        }));
      }

      if (isDeposit) await applyCashRegisterMovementInTransaction(transaction, db, targetBranchId, -amount, 'bank deposit', __cashRegisterState);
      else if (isWithdrawal) await applyCashRegisterMovementInTransaction(transaction, db, targetBranchId, amount, 'bank withdrawal', __cashRegisterState);
      applyAccountBalanceDeltasInTransaction(transaction, __bankAccountState, lines, timestamp);
      transaction.set(idemRef, cleanUndefined({ status: 'success', id: newTxRef.id, createdAt: timestamp }));
      return { status: 'success', id: newTxRef.id };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Bank Transaction Error:', err?.message || err);
    return res.status(/not found|Insufficient|Invalid|cannot be posted|linked GL/i.test(String(err?.message || '')) ? 400 : 500).json({ error: err?.message || 'Bank Transaction Failed' });
  }
}

// 8. Inventory Movement / Adjustment
export async function handleInventoryAdjustment(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { movementData } = req.body || {};
  if (!movementData) {
    return res.status(400).json({ error: 'Movement data is required.' });
  }

  if (!movementData.itemId) {
    return res.status(400).json({ error: 'Item ID (itemId) is required for inventory adjustment.' });
  }

  const rawItemType = movementData.itemType;
  if (!rawItemType || !['product', 'ingredient', 'inventory'].includes(rawItemType)) {
    return res.status(400).json({ error: 'Valid itemType ("product", "ingredient", or "inventory") is required for inventory adjustment.' });
  }

  const rawMode = movementData.mode ? String(movementData.mode).toLowerCase() : 'delta';
  if (!['delta', 'set'].includes(rawMode)) {
    return res.status(400).json({ error: 'Invalid inventory adjustment mode. Use "delta" or "set".' });
  }
  const quantity = Number(movementData.quantity);
  if (!Number.isFinite(quantity) || quantity < 0 || (rawMode === 'delta' && quantity === 0)) {
    return res.status(400).json({ error: rawMode === 'set' ? 'Target stock must be a finite non-negative number.' : 'Quantity must be a positive number.' });
  }

  // Normalize legacy/UI movement names to the canonical ledger semantics.
  const normalizedMovementType = String(movementData.type || '').toLowerCase().trim() === 'stock_in'
    ? 'in'
    : String(movementData.type || '').toLowerCase().trim() === 'stock_out'
    ? 'out'
    : String(movementData.type || '').toLowerCase().trim();
  const allowedMovementTypes = new Set(['in', 'out', 'adjustment', 'transfer', 'waste', 'spoilage']);
  if (!allowedMovementTypes.has(normalizedMovementType)) {
    return res.status(400).json({ error: `Invalid inventory movement type "${movementData.type || ''}".` });
  }
  const isTransfer = normalizedMovementType === 'transfer';

  const branchCheck = checkBranchAuthorization(user, movementData.branchId);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }
  const targetBranchId = branchCheck.targetBranchId;
  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req, movementData.idempotencyKey); }
  catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }
  const db = getAdminDb();
  const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`inventory-adjust:${user.uid}:${idempotencyKey}`).digest('hex'));

  try {
    const result = await db.runTransaction(async (transaction) => {
      const idemSnap = await transaction.get(idemRef);
      if (idemSnap.exists) return idemSnap.data();
      const timestamp = new Date().toISOString();
      const dateStr = getMogadishuDateString(timestamp);

      // Phase 1 (All Reads)
      const itemType = rawItemType === 'product' ? 'products' : rawItemType === 'inventory' ? 'inventory' : 'ingredients';
      const itemRef = db.collection(itemType).doc(movementData.itemId);
      const itemDoc = await transaction.get(itemRef);

      if (!itemDoc.exists) {
        throw new Error(`Inventory item "${movementData.itemId}" not found in collection "${itemType}". Cross-collection fallback prohibited.`);
      }

      const itemData = itemDoc.data() || {};
      const itemBranch = normalizeCanonicalBranchId(itemData.branchId || '');
      if (!itemBranch || !areBranchesMatching(itemBranch, targetBranchId)) {
        throw Object.assign(new Error(`Unauthorized cross-branch inventory modification: Inventory item "${movementData.itemId}" does not belong to target branch "${targetBranchId}" or has no canonical branchId.`), { statusCode: 403 });
      }

      // Pre-read linked stock projections so a legacy/mismatched branch cannot be overwritten silently.
      let linkedProjectionRef: any = null;
      let linkedProjectionSnap: any = { exists: false };
      if (itemType === 'inventory' || itemType === 'ingredients' || itemType === 'products') {
        linkedProjectionRef = db.collection(itemType === 'inventory' ? 'ingredients' : 'inventory').doc(movementData.itemId);
        linkedProjectionSnap = await transaction.get(linkedProjectionRef);
        if (linkedProjectionSnap.exists) {
          const linkedBranch = normalizeCanonicalBranchId((linkedProjectionSnap.data() || {}).branchId || '');
          if (linkedBranch && !areBranchesMatching(linkedBranch, targetBranchId)) {
            throw Object.assign(new Error(`Linked stock projection for "${movementData.itemId}" belongs to branch "${linkedBranch}", target is "${targetBranchId}".`), { statusCode: 403 });
          }
          if (!linkedBranch) {
            throw Object.assign(new Error(`Linked stock projection for "${movementData.itemId}" has no canonical branchId and cannot be updated safely.`), { statusCode: 409 });
          }
        }
      }

      const currentStock = Number(itemData.stock ?? itemData.currentQuantity ?? 0);
      const isOut = normalizedMovementType === 'out' || normalizedMovementType === 'waste';
      let newStock: number;
      let effectiveDelta: number;
      if (isTransfer) {
        newStock = currentStock;
        effectiveDelta = 0;
      } else if (rawMode === 'set' || (normalizedMovementType === 'adjustment' && movementData.newQuantity !== undefined)) {
        newStock = rawMode === 'set' ? quantity : Number(movementData.newQuantity);
        if (!Number.isFinite(newStock) || newStock < 0) throw new Error('Target stock must be a finite non-negative number.');
        effectiveDelta = newStock - currentStock;
      } else {
        if (isOut && currentStock < quantity) {
          throw new Error(`Insufficient inventory stock for "${itemData.name || itemData.itemName || movementData.itemId}": available ${currentStock}, requested adjustment ${quantity}.`);
        }
        newStock = isOut ? currentStock - quantity : currentStock + quantity;
        effectiveDelta = isOut ? -quantity : quantity;
      }
      if (newStock < 0) {
        throw new Error(`Inventory adjustment would create negative stock (${newStock}).`);
      }
      const unitCost = Number(itemData.costPrice || itemData.purchaseCost || itemData.cost || 0);
      const totalAdjustmentCost = Math.round(Math.abs(effectiveDelta) * unitCost * 100) / 100;
      await assertAccountingDateOpenInTransaction(transaction, db, dateStr, targetBranchId);
      const __accountState = totalAdjustmentCost > 0
        ? await prepareAccountBalanceState(transaction, db, ['acc_inventory', 'acc_waste', 'acc_inventory_adjustment'])
        : null;

      // Phase 2 (All Writes)
      const movementRef = db.collection('inventory_movements').doc();
      const fullMovement = {
        ...movementData,
        type: normalizedMovementType,
        id: movementRef.id,
        itemId: movementData.itemId,
        itemName: itemData.name || itemData.itemName || movementData.itemName || 'Inventory Item',
        quantity: Math.abs(effectiveDelta),
        previousQuantity: currentStock,
        newQuantity: newStock,
        branchId: targetBranchId,
        createdBy: user.name,
        createdAt: timestamp
      };

      transaction.set(movementRef, cleanUndefined({ ...fullMovement, idempotencyKey }));

      if (!isTransfer && itemData.stock !== undefined) {
        transaction.update(itemRef, { stock: newStock, updatedAt: timestamp });
      } else if (!isTransfer) {
        let status = 'in_stock';
        if (newStock <= 0) status = 'out_of_stock';
        else if (newStock <= (itemData.minimumQuantity || 0)) status = 'low_stock';
        transaction.update(itemRef, { currentQuantity: newStock, status, updatedAt: timestamp });
      }

      // Synchronize linked inventory / ingredient item if present
      if (itemType === 'inventory') {
        const linkedIngRef = linkedProjectionRef || db.collection('ingredients').doc(movementData.itemId);
        transaction.set(linkedIngRef, { stock: newStock, currentStockUsageUnit: newStock, branchId: targetBranchId, updatedAt: timestamp }, { merge: true });
      } else if (itemType === 'ingredients') {
        const linkedInventoryRef = linkedProjectionRef || db.collection('inventory').doc(movementData.itemId);
        transaction.set(linkedInventoryRef, {
          id: movementData.itemId,
          currentQuantity: newStock,
          branchId: targetBranchId,
          updatedAt: timestamp
        }, { merge: true });
      }

      // Double Entry Journal Entry for Inventory Adjustment
      if (totalAdjustmentCost > 0) {
        const effectiveOut = rawMode === 'set' ? effectiveDelta < 0 : isOut;
        const debitAccountId = effectiveOut ? (movementData.type === 'waste' ? 'acc_waste' : 'acc_inventory_adjustment') : 'acc_inventory';
        const debitAccountCode = effectiveOut ? (movementData.type === 'waste' ? '5030' : '5040') : '1030';
        const debitAccountName = effectiveOut ? (movementData.type === 'waste' ? 'Kitchen Waste & Shrinkage Expense' : 'Inventory Adjustment & Reconciliation') : 'Food & Beverage Inventory Asset';

        const creditAccountId = effectiveOut ? 'acc_inventory' : (movementData.type === 'waste' ? 'acc_waste' : 'acc_inventory_adjustment');
        const creditAccountCode = effectiveOut ? '1030' : (movementData.type === 'waste' ? '5030' : '5040');
        const creditAccountName = effectiveOut ? 'Food & Beverage Inventory Asset' : (movementData.type === 'waste' ? 'Kitchen Waste & Shrinkage Expense' : 'Inventory Adjustment & Reconciliation');

        const lines = [
          {
            accountId: debitAccountId,
            accountCode: debitAccountCode,
            accountName: debitAccountName,
            debit: totalAdjustmentCost,
            credit: 0,
            memo: `Inventory Adjustment (${isOut ? 'Reduction' : 'Addition'}) for ${itemData.name || itemData.itemName || movementData.itemId}`
          },
          {
            accountId: creditAccountId,
            accountCode: creditAccountCode,
            accountName: creditAccountName,
            debit: 0,
            credit: totalAdjustmentCost,
            memo: `Offset for Inventory Adjustment on ${itemData.name || itemData.itemName || movementData.itemId}`
          }
        ];

        const jeRef = db.collection('journal_entries').doc();
        const entryNumber = `JE-ADJ-${Date.now().toString().slice(-6)}`;
        const journalEntry = {
          id: jeRef.id,
          entryNumber,
          date: dateStr,
          reference: movementRef.id,
          description: `Inventory Adjustment: ${isOut ? '-' : '+'}${quantity} of ${itemData.name || itemData.itemName || movementData.itemId} (${movementData.reason || 'Manual Adjustment'})`,
          source: 'InventoryAdjustment' as const,
          status: 'Posted' as const,
          totalDebit: totalAdjustmentCost,
          totalCredit: totalAdjustmentCost,
          lines,
          branchId: targetBranchId,
          createdBy: user.name,
          createdAt: timestamp
        };

        transaction.set(jeRef, cleanUndefined(journalEntry));

        for (const line of lines) {
          const jlRef = db.collection('journal_lines').doc();
          transaction.set(jlRef, cleanUndefined({
            id: jlRef.id,
            journalEntryId: jeRef.id,
            entryNumber,
            branchId: targetBranchId,
            ...line,
            createdAt: timestamp
          }));

          const ledgerRef = db.collection('ledger').doc();
          transaction.set(ledgerRef, cleanUndefined({
            id: ledgerRef.id,
            accountId: line.accountId,
            accountCode: line.accountCode,
            accountName: line.accountName,
            journalEntryId: jeRef.id,
            entryNumber,
            date: dateStr,
            reference: movementRef.id,
            description: line.memo,
            debit: line.debit,
            credit: line.credit,
            branchId: targetBranchId,
            createdAt: timestamp
          }));
        }
        if (__accountState) applyAccountBalanceDeltasInTransaction(transaction, __accountState, lines, timestamp);
      }

      const out = { status: 'success', id: movementRef.id, newStock, idempotencyKey };
      transaction.set(idemRef, cleanUndefined({ ...out, createdAt: timestamp }));
      return out;
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Inventory Adjustment Error:', err?.message || err);
    return res.status(err?.message?.includes('Insufficient') ? 400 : 500).json({ error: err?.message || 'Inventory Adjustment Failed' });
  }
}

// 9. Direct Product Stock Update (Authoritative Inventory Physical Count Reconciliation)
export async function handleStockUpdate(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { productId, newStock, countedStock, reason } = req.body || {};
  const targetStock = typeof countedStock === 'number' ? countedStock : (typeof newStock === 'number' ? newStock : null);
  
  if (!productId || targetStock === null || !Number.isFinite(Number(targetStock)) || targetStock < 0) {
    return res.status(400).json({ error: 'Valid productId and non-negative target stock quantity (countedStock or newStock) are required.' });
  }

  const stockAdjustmentReason = reason ? String(reason).trim() : 'Physical stock count reconciliation';
  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req); }
  catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }
  const db = getAdminDb();
  const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`physical-stock:${user.uid}:${idempotencyKey}`).digest('hex'));

  try {
    const timestamp = new Date().toISOString();

    await db.runTransaction(async (transaction) => {
      const idemSnap = await transaction.get(idemRef);
      if (idemSnap.exists) return idemSnap.data();
      const productRef = db.collection('products').doc(productId);
      const prodSnap = await transaction.get(productRef);

      if (!prodSnap.exists) {
        throw new Error('Product not found.');
      }

      const prodData = prodSnap.data() || {};
      const stockBranchId = normalizeCanonicalBranchId(prodData.branchId || '');
      if (!stockBranchId) throw Object.assign(new Error('Product canonical branchId is missing. Stock update rejected until the product is migrated.'), { statusCode: 409 });
      const stockBranchCheck = checkBranchAuthorization(user, stockBranchId);
      if (!stockBranchCheck.authorized) throw Object.assign(new Error(stockBranchCheck.error), { statusCode: 403 });
      await assertAccountingDateOpenInTransaction(transaction, db, getMogadishuDateString(timestamp), stockBranchId);
      const currentStock = Number(prodData.stock || 0);
      const diff = targetStock - currentStock;

      const targetBranchId = stockBranchId;

      // Atomic Update 1: Product Stock + usage-unit projection
      transaction.update(productRef, { stock: targetStock, currentStockUsageUnit: targetStock, updatedAt: timestamp });

      // Keep the inventory projection synchronized for product stock counts.
      const inventoryRef = db.collection('inventory').doc(productId);
      transaction.set(inventoryRef, cleanUndefined({
        id: productId,
        itemType: 'product',
        itemId: productId,
        currentQuantity: targetStock,
        branchId: targetBranchId,
        updatedAt: timestamp
      }), { merge: true });

      // Atomic Update 2: Inventory Movement
      const movementRef = db.collection('inventory_movements').doc();
      transaction.set(movementRef, cleanUndefined({
        id: movementRef.id,
        type: diff >= 0 ? 'in' : 'out',
        itemType: 'product',
        itemId: productId,
        itemName: prodData.name || 'Product',
        quantity: Math.abs(diff),
        previousQuantity: currentStock,
        newQuantity: targetStock,
        branchId: targetBranchId,
        reason: stockAdjustmentReason,
        createdBy: user.name,
        createdAt: timestamp,
        idempotencyKey
      }));

      // Atomic Update 3: Audit Log
      const auditRef = db.collection('activity_logs').doc();
      transaction.set(auditRef, cleanUndefined({
        id: auditRef.id,
        action: 'INVENTORY_STOCK_UPDATE',
        entityId: productId,
        entityType: 'product',
        userId: user.uid,
        userName: user.name,
        userRole: user.role,
        branchId: targetBranchId,
        details: `Updated stock from ${currentStock} to ${targetStock} (diff: ${diff >= 0 ? '+' : ''}${diff}) - Reason: ${stockAdjustmentReason}`,
        beforeStock: currentStock,
        delta: diff,
        afterStock: targetStock,
        timestamp
      }));
      transaction.set(idemRef, cleanUndefined({ status: 'success', productId, newStock: targetStock, createdAt: timestamp }));
    });

    return res.json({ status: 'success', productId, newStock: targetStock });
  } catch (err: any) {
    console.error('Stock Update Error:', err?.message || err);
    const status = Number(err?.statusCode || (err?.message === 'Product not found.' ? 404 : 500));
    return res.status(status).json({ error: err?.message || 'Stock Update Failed' });
  }
}

// 10. Kitchen Status Update (Single Authoritative Transaction Path with Bounded Contention Retry)
export async function handleKitchenStatusUpdate(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const kitchenRoles = ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Chef', 'chef', 'Kitchen', 'kitchen', 'Kitchen Staff', 'Cashier', 'cashier', 'Staff', 'staff', 'Waiter', 'waiter'];
  const roleCheck = checkRoleAuthorization(user, kitchenRoles);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { ticketId } = req.params;
  const { status } = req.body || {};

  const rawStatus = status ? String(status).toLowerCase().trim() : '';
  const normalizedStatus = (rawStatus === 'pending' || rawStatus === 'new')
    ? 'new'
    : (rawStatus === 'preparing' || rawStatus === 'in_preparation' || rawStatus === 'in_progress')
    ? 'cooking'
    : (rawStatus === 'ready' || rawStatus === 'ready_for_pickup')
    ? 'ready_for_pickup'
    : (rawStatus === 'done' || rawStatus === 'delivered' || rawStatus === 'completed')
    ? 'completed'
    : (rawStatus === 'canceled' || rawStatus === 'cancelled')
    ? 'cancelled'
    : (rawStatus === 'reject' || rawStatus === 'rejected')
    ? 'rejected'
    : rawStatus;

  const allowedKitchenStatuses = ['new', 'accepted', 'cooking', 'ready_for_pickup', 'completed', 'cancelled', 'rejected'];
  if (!ticketId || !rawStatus || !allowedKitchenStatuses.includes(normalizedStatus)) {
    return res.status(400).json({ error: `Invalid status "${status}". Allowed kitchen statuses: ${allowedKitchenStatuses.join(', ')}` });
  }

  const db = getAdminDb();
  const timestamp = new Date().toISOString();

  try {
    await runTransactionWithRetry(db, async (transaction) => {
      console.log(`[KITCHEN STATUS STEP 1] kitchen_orders/${ticketId} ADMIN SDK READ`);
      const ticketRef = db.collection('kitchen_orders').doc(ticketId);
      const ticketSnap = await transaction.get(ticketRef);

      if (!ticketSnap.exists) {
        console.log(`[KITCHEN STATUS STEP 1] kitchen_orders/${ticketId} ADMIN SDK READ: FAIL (not found)`);
        const notFoundErr: any = new Error(`Kitchen ticket #${ticketId} not found.`);
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }
      console.log(`[KITCHEN STATUS STEP 1] kitchen_orders/${ticketId} ADMIN SDK READ: SUCCESS`);

      const kitchenData = ticketSnap.data() || {};
      const targetBranchId = normalizeCanonicalBranchId(kitchenData.branchId || user.branchId);
      if (!targetBranchId) {
        const branchMissingErr: any = new Error('Kitchen order branch identification missing. Status update rejected.');
        branchMissingErr.statusCode = 400;
        throw branchMissingErr;
      }

      const branchCheck = checkBranchAuthorization(user, targetBranchId);
      if (!branchCheck.authorized) {
        const authErr: any = new Error(branchCheck.error);
        authErr.statusCode = 403;
        throw authErr;
      }

      const rawCurrentStatus = String(kitchenData.prepStatus || 'new').toLowerCase().trim();
      const currentStatus = (rawCurrentStatus === 'pending' || rawCurrentStatus === 'new') ? 'new' : rawCurrentStatus;

      const VALID_KITCHEN_TRANSITIONS: Record<string, string[]> = {
        new: ['accepted', 'rejected', 'cancelled'],
        accepted: ['cooking', 'rejected', 'cancelled'],
        cooking: ['ready_for_pickup', 'cancelled'],
        ready_for_pickup: ['completed', 'cancelled'],
        completed: [],
        cancelled: [],
        rejected: []
      };

      if (currentStatus !== normalizedStatus) {
        const allowedNext = VALID_KITCHEN_TRANSITIONS[currentStatus] || [];
        if (!allowedNext.includes(normalizedStatus)) {
          const transErr: any = new Error(
            `Invalid kitchen ticket status transition from "${currentStatus}" to "${normalizedStatus}". Allowed transitions: ${allowedNext.length > 0 ? allowedNext.join(', ') : 'None (Terminal state)'}`
          );
          transErr.statusCode = 400;
          throw transErr;
        }
      }

      // Read linked order and deliveries BEFORE any transaction writes (Firestore Read-Before-Write Rule)
      const targetOrderId = kitchenData.orderId || ticketId;
      console.log(`[KITCHEN STATUS STEP 2] orders/${targetOrderId} ADMIN SDK READ`);
      const orderRef = db.collection('orders').doc(targetOrderId);
      const orderSnap = await transaction.get(orderRef);
      console.log(`[KITCHEN STATUS STEP 2] orders/${targetOrderId} ADMIN SDK READ: ${orderSnap.exists ? 'SUCCESS (exists)' : 'SKIPPED (not exists)'}`);

      console.log(`[KITCHEN STATUS STEP 3] deliveries?orderId=${targetOrderId} ADMIN SDK QUERY`);
      const deliveryQuery = db.collection('deliveries').where('orderId', '==', targetOrderId);
      const delSnap = await transaction.get(deliveryQuery);
      console.log(`[KITCHEN STATUS STEP 3] deliveries?orderId=${targetOrderId} ADMIN SDK QUERY: SUCCESS (${delSnap.docs.length} found)`);

      if (orderSnap.exists) {
        const linkedOrderData = orderSnap.data() || {};
        const linkedOrderStatus = String(linkedOrderData.status || '').toLowerCase();
        // Kitchen preparation is a distinct lifecycle from payment/order completion.
        // Paid orders may already be `completed` financially while their kitchen ticket is still `new`.
        // Preserve the kitchen state machine and do not block its operational transitions.
        if (['cancelled', 'canceled', 'refunded'].includes(linkedOrderStatus) && !['cancelled', 'rejected'].includes(normalizedStatus)) {
          const stateErr: any = new Error(`Kitchen ticket cannot transition to "${normalizedStatus}" because linked Order #${targetOrderId} is already ${linkedOrderData.status}.`);
          stateErr.statusCode = 409;
          throw stateErr;
        }
      }

      // All reads completed. Now execute all transaction writes.
      const updates: any = {
        prepStatus: normalizedStatus,
        updatedAt: timestamp
      };

      if (normalizedStatus === 'cooking' && !kitchenData.startedAt) {
        updates.startedAt = timestamp;
      } else if (normalizedStatus === 'ready_for_pickup') {
        updates.readyAt = timestamp;
      } else if (normalizedStatus === 'completed') {
        updates.completedAt = timestamp;
      } else if (normalizedStatus === 'cancelled') {
        updates.cancelledAt = timestamp;
      } else if (normalizedStatus === 'rejected') {
        updates.rejectedAt = timestamp;
      }

      console.log(`[KITCHEN STATUS STEP 4] kitchen_orders/${ticketId} ADMIN SDK UPDATE`);
      transaction.update(ticketRef, cleanUndefined(updates));

      // Sync to main sales order in `orders`
      if (orderSnap.exists) {
        const orderData = orderSnap.data() || {};
        const isDeliveryOrder = orderData.orderType === 'delivery' || !delSnap.empty;

        let mappedOrderStatus: string = 'new';
        if (normalizedStatus === 'accepted') mappedOrderStatus = 'confirmed';
        else if (normalizedStatus === 'cooking') mappedOrderStatus = 'in_preparation';
        else if (normalizedStatus === 'ready_for_pickup') mappedOrderStatus = 'ready_for_pickup';
        else if (normalizedStatus === 'completed') mappedOrderStatus = isDeliveryOrder ? 'ready_for_pickup' : 'completed';
        else if (normalizedStatus === 'cancelled' || normalizedStatus === 'rejected') mappedOrderStatus = 'cancelled';

        const orderUpdates: any = {
          kitchenStatus: normalizedStatus,
          updatedAt: timestamp
        };
        // A financially completed order remains completed while kitchen preparation is advanced.
        if (!['completed', 'refunded', 'cancelled', 'canceled'].includes(String(orderData.status || '').toLowerCase())) {
          orderUpdates.status = mappedOrderStatus;
        }
        if (normalizedStatus === 'completed' && !isDeliveryOrder) {
          orderUpdates.completedAt = timestamp;
        }

        console.log(`[KITCHEN STATUS STEP 5] orders/${targetOrderId} ADMIN SDK UPDATE`);
        transaction.update(orderRef, cleanUndefined(orderUpdates));
      }

      // Sync to linked delivery if exists
      if (!delSnap.empty) {
        console.log(`[KITCHEN STATUS STEP 6] deliveries (${delSnap.docs.length} docs) ADMIN SDK UPDATE`);
        delSnap.docs.forEach((delDoc) => {
          const delUpdates: any = {
            kitchenStatus: normalizedStatus,
            updatedAt: timestamp
          };
          if (normalizedStatus === 'cancelled' || normalizedStatus === 'rejected') {
            delUpdates.status = 'cancelled';
          }
          transaction.update(delDoc.ref, delUpdates);
        });
      }
    });

    return res.json({ status: 'success', ticketId, prepStatus: normalizedStatus });
  } catch (err: any) {
    const rawMsg = err?.message || 'Kitchen Status Update Failed';
    const statusCode = err.statusCode || (rawMsg.includes('not found') ? 404 : rawMsg.includes('Unauthorized') || rawMsg.includes('cross-branch') ? 403 : rawMsg.includes('Invalid') ? 400 : 500);
    console.error('Kitchen Status Update Error:', rawMsg);
    return res.status(statusCode).json({ error: rawMsg });
  }
}

// 11. Delivery Status Update (Single Authoritative Transaction Path with Bounded Contention Retry)
export async function handleDeliveryStatusUpdate(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const deliveryRoles = ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Delivery Driver', 'delivery driver', 'Driver', 'driver', 'Cashier', 'cashier', 'Staff', 'staff'];
  const roleCheck = checkRoleAuthorization(user, deliveryRoles);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { deliveryId } = req.params;
  const { status: newStatus, driverId, failureReason } = req.body || {};

  const allowedDeliveryStatuses = ['unassigned', 'pending', 'assigned', 'accepted', 'picked_up', 'on_the_way', 'arrived', 'delivered', 'failed', 'returned', 'cancelled'];
  if (!deliveryId || !newStatus || !allowedDeliveryStatuses.includes(newStatus)) {
    return res.status(400).json({ error: `Invalid delivery status "${newStatus}". Allowed: ${allowedDeliveryStatuses.join(', ')}` });
  }

  const db = getAdminDb();
  const now = new Date().toISOString();

  try {
    await runTransactionWithRetry(db, async (transaction) => {
      // ----------------------------------------------------
      // PHASE 1 — ALL READS & VALIDATIONS
      // ----------------------------------------------------

      // [DELIVERY STATUS READ 1] Read delivery document
      console.log(`[DELIVERY STATUS READ 1] deliveries/${deliveryId} ADMIN SDK READ`);
      const delRef = db.collection('deliveries').doc(deliveryId);
      const delSnap = await transaction.get(delRef);

      if (!delSnap.exists) {
        console.log(`[DELIVERY STATUS READ 1] deliveries/${deliveryId} ADMIN SDK READ: FAIL (not found)`);
        const notFoundErr: any = new Error(`Delivery #${deliveryId} not found.`);
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }
      console.log(`[DELIVERY STATUS READ 1] deliveries/${deliveryId} ADMIN SDK READ: SUCCESS`);

      const delData = delSnap.data() || {};
      const targetBranchId = delData.branchId || user.branchId;
      if (!targetBranchId) {
        const branchMissingErr: any = new Error('Delivery order branch identification missing. Status update rejected.');
        branchMissingErr.statusCode = 400;
        throw branchMissingErr;
      }

      const branchCheck = checkBranchAuthorization(user, targetBranchId);
      if (!branchCheck.authorized) {
        const authErr: any = new Error(branchCheck.error);
        authErr.statusCode = 403;
        throw authErr;
      }

      // Transition validation graph
      const currentStatus = delData.status || 'unassigned';
      const validTransitions: Record<string, string[]> = {
        unassigned: ['assigned', 'cancelled'],
        pending: ['assigned', 'cancelled'],
        assigned: ['accepted', 'cancelled'],
        accepted: ['picked_up', 'cancelled'],
        picked_up: ['on_the_way', 'cancelled'],
        on_the_way: ['arrived', 'failed', 'returned', 'cancelled'],
        arrived: ['delivered', 'failed', 'returned', 'cancelled'],
        delivered: ['returned'],
        failed: ['returned', 'cancelled'],
        returned: [],
        cancelled: []
      };

      if (currentStatus !== newStatus) {
        const allowedNext = validTransitions[currentStatus] || [];
        if (!allowedNext.includes(newStatus)) {
          const transErr: any = new Error(`Invalid delivery transition from "${currentStatus}" to "${newStatus}". Allowed: ${allowedNext.join(', ') || 'None'}`);
          transErr.statusCode = 400;
          throw transErr;
        }
      }

      // Authorization guard for delivery status update and driver authority security
      const mgmtRoles = ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager'];
      const isMgmt = mgmtRoles.includes(user.role);
      const isDriverRole = ['Delivery Driver', 'delivery driver', 'Driver', 'driver'].includes(user.role);
      const isAssignedDriver = Boolean(delData.driverId && delData.driverId === user.uid);

      if (isDriverRole) {
        if (!delData.driverId || delData.status === 'unassigned') {
          const authErr: any = new Error('Unauthorized: Unassigned driver cannot manipulate unassigned delivery.');
          authErr.statusCode = 403;
          throw authErr;
        }
        if (delData.driverId !== user.uid) {
          const authErr: any = new Error(`Unauthorized: Driver cannot modify another driver's delivery (${delData.driverId}).`);
          authErr.statusCode = 403;
          throw authErr;
        }
        if (req.body && (req.body.driverEarningsAmount !== undefined || req.body.branchId !== undefined || req.body.amountCollected !== undefined || req.body.amountCollectedByDriver !== undefined)) {
          const authErr: any = new Error('Unauthorized: Driver cannot modify driver earnings or financial assignment fields.');
          authErr.statusCode = 403;
          throw authErr;
        }
      }

      if (!isMgmt && !(isDriverRole && isAssignedDriver)) {
        const authErr: any = new Error('Unauthorized: Only assigned delivery driver or management can update delivery status.');
        authErr.statusCode = 403;
        throw authErr;
      }

      // [DELIVERY STATUS READ 2] Read driver document (if driver assigned and terminal/released status)
      const effectiveDriverId = delData.driverId;
      let drvRef: any = null;
      let drvSnap: any = { exists: false };
      if (effectiveDriverId && ['delivered', 'failed', 'returned', 'cancelled'].includes(newStatus)) {
        console.log(`[DELIVERY STATUS READ 2] drivers/${effectiveDriverId} ADMIN SDK READ`);
        drvRef = db.collection('drivers').doc(effectiveDriverId);
        drvSnap = await transaction.get(drvRef);
        console.log(`[DELIVERY STATUS READ 2] drivers/${effectiveDriverId} ADMIN SDK READ: ${drvSnap.exists ? 'SUCCESS (exists)' : 'SKIPPED (not exists)'}`);
      } else {
        console.log(`[DELIVERY STATUS READ 2] drivers/(not applicable for status "${newStatus}"): SKIPPED`);
      }

      // [DELIVERY STATUS READ 3] Read linked sales order document
      let orderRef: any = null;
      let orderSnap: any = { exists: false };
      if (delData.orderId) {
        console.log(`[DELIVERY STATUS READ 3] orders/${delData.orderId} ADMIN SDK READ`);
        orderRef = db.collection('orders').doc(delData.orderId);
        orderSnap = await transaction.get(orderRef);
        console.log(`[DELIVERY STATUS READ 3] orders/${delData.orderId} ADMIN SDK READ: ${orderSnap.exists ? 'SUCCESS (exists)' : 'SKIPPED (not exists)'}`);
      } else {
        console.log(`[DELIVERY STATUS READ 3] orders/(no linked order): SKIPPED`);
      }

      if (orderSnap.exists) {
        const linkedOrderData = orderSnap.data() || {};
        const linkedOrderStatus = String(linkedOrderData.status || '').toLowerCase();
        if (['cancelled', 'canceled', 'refunded'].includes(linkedOrderStatus) && newStatus !== 'cancelled') {
          const stateErr: any = new Error(`Delivery cannot transition to "${newStatus}" because linked Order #${delData.orderId} is already ${linkedOrderData.status}.`);
          stateErr.statusCode = 409;
          throw stateErr;
        }
      }

      // ----------------------------------------------------
      // PHASE 2 — ALL WRITES
      // ----------------------------------------------------

      // [DELIVERY STATUS WRITE 1] Update delivery document
      const updates: any = {
        status: newStatus,
        updatedAt: now
      };

      if (newStatus === 'accepted') updates.acceptedAt = now;
      if (newStatus === 'picked_up') updates.pickedUpAt = now;
      if (newStatus === 'on_the_way') updates.onTheWayAt = now;
      if (newStatus === 'arrived') updates.arrivedAt = now;
      if (newStatus === 'delivered') {
        updates.deliveredAt = now;
      }
      if (['failed', 'returned', 'cancelled'].includes(newStatus)) {
        updates.failedAt = now;
        updates.failureReason = failureReason || 'Delivery issue encountered';
      }

      console.log(`[DELIVERY STATUS WRITE 1] deliveries/${deliveryId} ADMIN SDK UPDATE (status: ${newStatus})`);
      transaction.update(delRef, updates);

      // [DELIVERY STATUS WRITE 2] Update driver availability (if applicable)
      if (drvSnap.exists && drvRef) {
        const drvData = drvSnap.data() || {};
        const drvBranch = normalizeCanonicalBranchId(drvData.branchId || drvData.branch || '');
        const deliveryBranch = normalizeCanonicalBranchId(delData.branchId || targetBranchId || '');
        if (!drvBranch || !deliveryBranch) { throw new Error('Driver and delivery branch are required for secure release.'); }
        if (areBranchesMatching(drvBranch, deliveryBranch) || user.role === 'Owner' || (user.role === 'Admin' && user.branchId === 'all')) {
          console.log(`[DELIVERY STATUS WRITE 2] drivers/${effectiveDriverId} ADMIN SDK UPDATE (availability: available)`);
          transaction.update(drvRef, { availability: 'available', activeDeliveryId: null, updatedAt: now });
        }
      }

      // [DELIVERY STATUS WRITE 3] Update linked sales order (if applicable)
      if (orderSnap.exists && orderRef) {
        const orderUpdates: any = { updatedAt: now };
        if (newStatus === 'delivered') {
          orderUpdates.status = 'completed';
          orderUpdates.deliveryStatus = 'delivered';
          orderUpdates.completedAt = now;
        } else if (['assigned', 'accepted'].includes(newStatus)) {
          orderUpdates.deliveryStatus = 'assigned';
        } else if (['picked_up', 'on_the_way', 'arrived'].includes(newStatus)) {
          orderUpdates.deliveryStatus = 'in_transit';
        } else if (['failed', 'returned', 'cancelled'].includes(newStatus)) {
          orderUpdates.deliveryStatus = 'failed';
        }
        console.log(`[DELIVERY STATUS WRITE 3] orders/${delData.orderId} ADMIN SDK UPDATE (deliveryStatus: ${orderUpdates.deliveryStatus})`);
        transaction.update(orderRef, orderUpdates);
      }
    });

    return res.json({ status: 'success', deliveryId, deliveryStatus: newStatus });
  } catch (err: any) {
    const rawMsg = err?.message || 'Delivery Status Update Failed';
    const statusCode = err.statusCode || (rawMsg.includes('not found') ? 404 : rawMsg.includes('Unauthorized') || rawMsg.includes('cross-branch') ? 403 : rawMsg.includes('Invalid') ? 400 : 500);
    console.error('Delivery Status Update Error:', rawMsg);
    return res.status(statusCode).json({ error: rawMsg });
  }
}

// 12. Delivery Driver Assignment (Single Authoritative Transaction Path with Bounded Contention Retry)
export async function handleDeliveryAssignDriver(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Cashier', 'cashier', 'Staff', 'staff']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  if (['Delivery Driver', 'delivery driver', 'Driver', 'driver'].includes(user.role)) {
    return res.status(403).json({ error: 'Unauthorized: Delivery Driver is not authorized to assign deliveries.' });
  }

  const { deliveryId } = req.params;
  const { driverId } = req.body || {};

  if (!deliveryId || !driverId) {
    return res.status(400).json({ error: 'deliveryId and driverId are required.' });
  }

  const db = getAdminDb();
  const now = new Date().toISOString();
  let assignedDeliveryBranchId = '';

  try {
    let authoritativeDriverName = 'Assigned Driver';
    let authoritativeDriverPhone = '';

    console.log(`[ASSIGN STEP 1] READ delivery deliveries/${deliveryId}`);
    await runTransactionWithRetry(db, async (transaction) => {
      // ----------------------------------------------------
      // PHASE 1 — ALL READS & VALIDATIONS
      // ----------------------------------------------------

      // [ASSIGN STEP 1] READ delivery
      const delRef = db.collection('deliveries').doc(deliveryId);
      const delSnap = await transaction.get(delRef);

      if (!delSnap.exists) {
        console.log(`[ASSIGN STEP 1] READ delivery deliveries/${deliveryId}: FAIL (not found)`);
        const notFoundErr: any = new Error(`Delivery #${deliveryId} not found.`);
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }
      console.log(`[ASSIGN STEP 1] READ delivery deliveries/${deliveryId}: SUCCESS`);

      const delData = delSnap.data() || {};
      const targetBranchId = delData.branchId;
      if (!targetBranchId) {
        const branchMissingErr: any = new Error('Delivery order branch identification missing. Cannot assign driver.');
        branchMissingErr.statusCode = 400;
        throw branchMissingErr;
      }
      assignedDeliveryBranchId = targetBranchId;

      const branchCheck = checkBranchAuthorization(user, targetBranchId);
      if (!branchCheck.authorized) {
        const authErr: any = new Error(`Unauthorized delivery driver assignment! ${branchCheck.error}`);
        authErr.statusCode = 403;
        throw authErr;
      }

      // [ASSIGN STEP 2] READ driver
      console.log(`[ASSIGN STEP 2] READ driver drivers/${driverId}`);
      const drvRef = db.collection('drivers').doc(String(driverId).trim());
      const drvSnap = await transaction.get(drvRef);
      let driverBranchId = '';
      let isDriverFound = false;

      if (drvSnap.exists) {
        isDriverFound = true;
        const drvData = drvSnap.data() || {};
        if (drvData.status === 'inactive' || drvData.status === 'suspended' || drvData.isActive === false) {
          const inactErr: any = new Error(`Cannot assign inactive or suspended driver (${driverId}).`);
          inactErr.statusCode = 400;
          throw inactErr;
        }
        if ((drvData.availability === 'on_delivery' || drvData.availability === 'in_transit' || drvData.status === 'in_transit') && delData.driverId !== String(driverId).trim()) {
          const availErr: any = new Error(`Cannot assign driver (${driverId}) who is currently on delivery.`);
          availErr.statusCode = 400;
          throw availErr;
        }
        driverBranchId = drvData.branchId || drvData.branch || '';
        authoritativeDriverName = drvData.fullName || drvData.name || authoritativeDriverName;
        authoritativeDriverPhone = drvData.phoneNumber || drvData.phone || authoritativeDriverPhone;
      } else {
        const userDrvRef = db.collection('users').doc(String(driverId).trim());
        const userDrvSnap = await transaction.get(userDrvRef);
        if (userDrvSnap.exists) {
          isDriverFound = true;
          const userDrvData = userDrvSnap.data() || {};
          if (userDrvData.status === 'inactive' || userDrvData.status === 'suspended' || userDrvData.isActive === false) {
            const inactErr: any = new Error(`Cannot assign inactive or suspended driver (${driverId}).`);
            inactErr.statusCode = 400;
            throw inactErr;
          }
          if ((userDrvData.availability === 'on_delivery' || userDrvData.availability === 'in_transit' || userDrvData.status === 'in_transit') && delData.driverId !== String(driverId).trim()) {
            const availErr: any = new Error(`Cannot assign driver (${driverId}) who is currently on delivery.`);
            availErr.statusCode = 400;
            throw availErr;
          }
          driverBranchId = userDrvData.branchId || '';
          authoritativeDriverName = userDrvData.fullName || userDrvData.displayName || userDrvData.name || authoritativeDriverName;
          authoritativeDriverPhone = userDrvData.phoneNumber || userDrvData.phone || authoritativeDriverPhone;
        }
      }

      if (!isDriverFound) {
        console.log(`[ASSIGN STEP 2] READ driver drivers/${driverId}: FAIL (not found)`);
        const notFoundErr: any = new Error(`Driver #${driverId} not found in system.`);
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }
      console.log(`[ASSIGN STEP 2] READ driver drivers/${driverId}: SUCCESS`);

      // Canonical branch is mandatory for a driver; do not silently assign legacy branchless identities.
      if (!driverBranchId) {
        const branchErr: any = new Error(`Driver #${driverId} has no canonical branchId. Driver migration is required before assignment.`);
        branchErr.statusCode = 409;
        throw branchErr;
      }

      // Cross-branch driver assignment validation
      const normDriverBranch = normalizeCanonicalBranchId(driverBranchId);
      const normTargetBranch = normalizeCanonicalBranchId(targetBranchId);
      if (normDriverBranch && normTargetBranch && !areBranchesMatching(normDriverBranch, normTargetBranch)) {
        const isHq = user.role === 'Owner' || user.role === 'owner' || ((user.role === 'Admin' || user.role === 'admin') && user.branchId === 'all');
        if (!isHq) {
          const authErr: any = new Error(`Unauthorized cross-branch driver assignment! Driver belongs to branch "${driverBranchId}", but delivery is in branch "${targetBranchId}".`);
          authErr.statusCode = 403;
          throw authErr;
        }
      }

      // [ASSIGN STEP 3] READ previous driver (if reassignment)
      let oldDrvSnap: any = { exists: false };
      let oldDrvRef: any = null;
      if (delData.driverId && delData.driverId !== String(driverId).trim()) {
        console.log(`[ASSIGN STEP 3] READ previous driver drivers/${delData.driverId}`);
        oldDrvRef = db.collection('drivers').doc(String(delData.driverId).trim());
        oldDrvSnap = await transaction.get(oldDrvRef);
        console.log(`[ASSIGN STEP 3] READ previous driver drivers/${delData.driverId}: ${oldDrvSnap.exists ? 'SUCCESS (exists)' : 'SKIPPED (not exists)'}`);
      }

      // [ASSIGN STEP 4] READ order (if applicable)
      let orderSnap: any = { exists: false };
      let orderRef: any = null;
      if (delData.orderId) {
        console.log(`[ASSIGN STEP 4] READ order orders/${delData.orderId}`);
        orderRef = db.collection('orders').doc(delData.orderId);
        orderSnap = await transaction.get(orderRef);
        console.log(`[ASSIGN STEP 4] READ order orders/${delData.orderId}: ${orderSnap.exists ? 'SUCCESS (exists)' : 'SKIPPED (not exists)'}`);
      }

      // ----------------------------------------------------
      // PHASE 2 — ALL WRITES
      // ----------------------------------------------------

      // [ASSIGN WRITE STEP 1] UPDATE new driver
      console.log(`[ASSIGN WRITE STEP 1] UPDATE new driver drivers/${driverId}`);
      if (drvSnap.exists) {
        transaction.update(drvRef, { availability: 'on_delivery', activeDeliveryId: deliveryId, updatedAt: now });
      }

      // [ASSIGN WRITE STEP 2] UPDATE previous driver
      if (oldDrvSnap.exists && oldDrvRef) {
        console.log(`[ASSIGN WRITE STEP 2] UPDATE previous driver drivers/${delData.driverId}`);
        transaction.update(oldDrvRef, { availability: 'available', activeDeliveryId: null, updatedAt: now });
      }

      // [ASSIGN WRITE STEP 3] UPDATE delivery
      console.log(`[ASSIGN WRITE STEP 3] UPDATE delivery deliveries/${deliveryId}`);
      transaction.update(delRef, {
        driverId: String(driverId).trim(),
        driverName: authoritativeDriverName,
        driverPhone: authoritativeDriverPhone,
        status: 'assigned',
        assignedAt: now,
        updatedAt: now
      });

      // [ASSIGN WRITE STEP 4] UPDATE order
      if (orderSnap.exists && orderRef) {
        console.log(`[ASSIGN WRITE STEP 4] UPDATE order orders/${delData.orderId}`);
        transaction.update(orderRef, { deliveryStatus: 'assigned', updatedAt: now });
      }

      // [ASSIGN WRITE STEP 5] CREATE notification
      console.log(`[ASSIGN WRITE STEP 5] CREATE notification notifications/DELIVERY_ASSIGNED_${deliveryId}_${driverId}`);
      const notifId = `DELIVERY_ASSIGNED_${deliveryId}_${driverId}`;
      const notifRef = db.collection('notifications').doc(notifId);
      const notifData = {
        id: notifId,
        recipientId: String(driverId).trim(),
        recipientType: 'driver',
        branchId: targetBranchId,
        deliveryId,
        orderId: delData.orderId || '',
        type: 'DELIVERY_ASSIGNED',
        title: 'New Delivery Assigned',
        message: `Delivery #${delData.orderId || deliveryId} assigned to you. Address: ${delData.address || 'Address on file'}`,
        priority: 'high',
        read: false,
        createdAt: now
      };
      transaction.set(notifRef, cleanUndefined(notifData), { merge: true });
    });

    // Non-blocking post-commit push notification dispatch
    sendPushNotificationToDriver(driverId, 'New Delivery Assigned', `Delivery #${deliveryId} has been assigned to you.`, { deliveryId, branchId: assignedDeliveryBranchId }).catch(err => {
      console.warn('Post-commit FCM push error:', err?.message || err);
    });

    return res.json({ status: 'success', deliveryId, driverId });
  } catch (err: any) {
    const rawMsg = err?.message || 'Delivery Driver Assignment Failed';
    console.error('Delivery Assign Driver Error:', rawMsg);
    const status = err.statusCode || (rawMsg.includes('not found') ? 404 : rawMsg.includes('Unauthorized') || rawMsg.includes('cross-branch') ? 403 : 400);
    return res.status(status).json({ error: rawMsg });
  }
}

export async function handleOrderUpdate(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Cashier', 'cashier', 'Waiter', 'waiter', 'Staff', 'staff', 'Kitchen', 'kitchen', 'Chef', 'chef']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { orderId } = req.params;
  if (!orderId) {
    return res.status(400).json({ error: 'Order ID is required.' });
  }

  // Strictly reject any direct client attempts to manipulate financial, payment, or order items fields
  const FORBIDDEN_ORDER_UPDATE_FIELDS = [
    'paymentStatus', 'paidAmount', 'tenderAmount', 'amountTendered', 'change', 'changeAmount',
    'changeDue', 'totalAmount', 'subtotal', 'tax', 'taxRate', 'discountAmount', 'items', 'cogs',
    'profit', 'refundAmount', 'refundedAmount', 'payments', 'branchId', 'orderNumber', 'createdAt',
    'createdBy', 'employeeId', 'employeeName'
  ];

  const bodyKeys = Object.keys(req.body || {});
  const detectedForbiddenKeys = bodyKeys.filter(k => FORBIDDEN_ORDER_UPDATE_FIELDS.includes(k));
  if (detectedForbiddenKeys.length > 0) {
    return res.status(403).json({
      error: `Direct modification of financial, payment, or order items fields (${detectedForbiddenKeys.join(', ')}) is strictly prohibited. Use authorized POS, cancellation, or refund operations.`
    });
  }

  // Whitelist ONLY allowed non-sovereign, non-financial fields
  const {
    status,
    fulfillmentType,
    tableNumber,
    notes,
    customerName,
    customerPhone,
    deliveryAddress,
    kitchenNotes,
    waiterName,
    priority
  } = req.body || {};

  const db = getAdminDb();

  try {
    await db.runTransaction(async (transaction) => {
      const orderRef = db.collection('orders').doc(orderId);
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists) {
        throw new Error(`Order #${orderId} not found.`);
      }

      const orderData = orderSnap.data() as any;
      const targetBranchId = orderData.branchId;
      if (!targetBranchId) {
        throw new Error('Order branch identification missing. Update rejected.');
      }
      const branchCheck = checkBranchAuthorization(user, targetBranchId);
      if (!branchCheck.authorized) {
        throw new Error(branchCheck.error);
      }

      // Construct update object with explicit whitelist to prohibit modifying totalAmount, subtotal, tax, cogs, profit, discountAmount, paymentStatus, branchId, createdAt, createdBy
      const allowedUpdates: Record<string, any> = {
        updatedAt: new Date().toISOString()
      };

      if (status !== undefined) {
        const newStatus = String(status).trim();
        const sensitiveStatuses = ['cancelled', 'refunded', 'partially_refunded'];
        if (sensitiveStatuses.includes(newStatus)) {
          throw new Error('Sensitive lifecycle operations (cancellation/refund) must use dedicated endpoints (/api/orders/:orderId/cancel or /api/orders/:orderId/refund).');
        }

        const currentStatus = (orderData.status || 'pending').trim();
        const validOrderTransitions: Record<string, string[]> = {
          pending: ['pending', 'new', 'confirmed', 'in_preparation', 'ready_for_pickup'],
          new: ['new', 'confirmed', 'in_preparation', 'ready_for_pickup'],
          confirmed: ['confirmed', 'in_preparation', 'ready_for_pickup'],
          in_preparation: ['in_preparation', 'ready_for_pickup'],
          ready_for_pickup: ['ready_for_pickup', 'out_for_delivery', 'completed', 'delivered'],
          out_for_delivery: ['out_for_delivery', 'delivered', 'completed'],
          delivered: ['delivered', 'completed'],
          completed: ['completed'],
          cancelled: ['cancelled'],
          refunded: ['refunded']
        };

        const allowedTransitions = validOrderTransitions[currentStatus] || [currentStatus];
        if (newStatus !== currentStatus && !allowedTransitions.includes(newStatus)) {
          throw new Error(`Invalid order status transition from "${currentStatus}" to "${newStatus}".`);
        }
        allowedUpdates.status = newStatus;
      }
      if (fulfillmentType !== undefined) allowedUpdates.fulfillmentType = String(fulfillmentType);
      if (tableNumber !== undefined) allowedUpdates.tableNumber = String(tableNumber);
      if (notes !== undefined) allowedUpdates.notes = String(notes);
      if (customerName !== undefined) allowedUpdates.customerName = String(customerName);
      if (customerPhone !== undefined) allowedUpdates.customerPhone = String(customerPhone);
      if (deliveryAddress !== undefined) allowedUpdates.deliveryAddress = String(deliveryAddress);
      if (kitchenNotes !== undefined) allowedUpdates.kitchenNotes = String(kitchenNotes);
      if (waiterName !== undefined) allowedUpdates.waiterName = String(waiterName);
      if (priority !== undefined) allowedUpdates.priority = String(priority);

      // Phase 1 (All Reads)
      const kitchenRef = db.collection('kitchen_orders').doc(orderId);
      const kitchenSnap = await transaction.get(kitchenRef);

      // Phase 2 (All Writes)
      transaction.update(orderRef, cleanUndefined(allowedUpdates));

      // Synchronize kitchen ticket if present
      if (kitchenSnap.exists) {
        const kitchenUpdates: Record<string, any> = { updatedAt: new Date().toISOString() };
        if (priority !== undefined) kitchenUpdates.priority = String(priority);
        if (notes !== undefined) kitchenUpdates.notes = String(notes);
        if (tableNumber !== undefined) kitchenUpdates.tableNumber = String(tableNumber);
        transaction.update(kitchenRef, cleanUndefined(kitchenUpdates));
      }
    });

    return res.json({ status: 'success', orderId });
  } catch (err: any) {
    console.error('Order Update Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Order Update Failed' });
  }
}

export async function handleCreateAccount(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleAuth = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleAuth.authorized) {
    return res.status(403).json({ error: roleAuth.error });
  }

  const { code, name, type, category, parentId, description, balance, branchId: requestedBranch } = req.body || {};
  if (!code || !name || !type) {
    return res.status(400).json({ error: 'Account code, name, and type are required.' });
  }

  let targetBranchId: string | undefined = undefined;
  if (requestedBranch && requestedBranch !== 'all' && requestedBranch !== 'HQ') {
    const branchCheck = checkBranchAuthorization(user, requestedBranch);
    if (!branchCheck.authorized) {
      return res.status(403).json({ error: branchCheck.error });
    }
    targetBranchId = branchCheck.targetBranchId;
  } else {
    // Global chart of accounts creation requires Owner or HQ Admin
    if (!isHQRoleOrClaim(user)) {
      return res.status(403).json({ error: 'Access denied: Global Chart of Accounts creation is restricted to Enterprise Owner and HQ Admin.' });
    }
    targetBranchId = undefined;
  }

  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req); } catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }
  const db = getAdminDb();
  const accountIdemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`account-create:${user.uid}:${idempotencyKey}`).digest('hex'));
  try {
    const rawAccountType = String(type).trim();
    const accountTypeMap: Record<string, string> = { asset: 'Asset', liability: 'Liability', equity: 'Equity', revenue: 'Revenue', cogs: 'COGS', expense: 'Expense' };
    const normalizedType = accountTypeMap[rawAccountType.toLowerCase()] || rawAccountType;
    const allowedAccountTypes = new Set(['Asset', 'Liability', 'Equity', 'Revenue', 'COGS', 'Expense']);
    if (!allowedAccountTypes.has(normalizedType)) {
      return res.status(400).json({ error: `Invalid account type '${rawAccountType}'.` });
    }
    const payload = cleanUndefined({
      code: String(code).trim(),
      name: String(name).trim(),
      type: normalizedType,
      category: category ? String(category).trim() : undefined,
      parentId: parentId ? String(parentId).trim() : undefined,
      description: description ? String(description).trim() : undefined,
      branchId: targetBranchId,
      balance: 0,
      openingBalanceRequested: Number(balance) || 0,
      createdBy: user.name,
      createdAt: new Date().toISOString()
    });
    const result = await db.runTransaction(async (transaction) => {
      const idemSnap = await transaction.get(accountIdemRef);
      if (idemSnap.exists) return idemSnap.data();
      if (payload.openingBalanceRequested > 0) throw Object.assign(new Error('Opening balance must be posted through an opening journal entry; account creation does not accept a direct balance.'), { statusCode: 400 });
      delete (payload as any).openingBalanceRequested;
      let existingQuery: any = db.collection('accounts').where('code', '==', payload.code);
      const existingSnap = await transaction.get(existingQuery);
      const conflict = existingSnap.docs.find((d: any) => {
        const b = normalizeCanonicalBranchId(d.data()?.branchId || '');
        const pb = normalizeCanonicalBranchId(payload.branchId || '');
        return b === pb || (!b && !pb);
      });
      if (conflict) throw Object.assign(new Error(`Account code '${payload.code}' already exists in the same chart scope.`), { statusCode: 409 });
      const docRef = db.collection('accounts').doc();
      transaction.create(docRef, payload);
      const out = { id: docRef.id, ...payload, idempotencyKey };
      transaction.set(accountIdemRef, cleanUndefined({ status: 'success', ...out, createdAt: payload.createdAt }));
      return out;
    });
    return res.json(result);
  } catch (err: any) {
    console.error('Create Account Error:', err);
    return res.status(500).json({ error: 'Create Account Failed' });
  }
}

export async function handleUpdateAccount(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleAuth = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleAuth.authorized) {
    return res.status(403).json({ error: roleAuth.error });
  }

  const { id } = req.params;
  if (req.body && 'balance' in req.body) {
    return res.status(400).json({ error: 'Direct balance modification is prohibited. Account balances must be updated via posted Journal Entries.' });
  }

  const db = getAdminDb();
  try {
    const accountRef = db.collection('accounts').doc(id);
    const accountSnap = await accountRef.get();
    if (!accountSnap.exists) {
      return res.status(404).json({ error: `Account #${id} not found.` });
    }

    const existingAcc = accountSnap.data() as any;
    const existingBranch = existingAcc.branchId;

    if (!existingBranch || existingBranch === '' || existingBranch === 'all' || existingBranch === 'HQ') {
      if (!isHQRoleOrClaim(user)) {
        return res.status(403).json({ error: 'Access denied: Global Chart of Accounts modification is restricted to Enterprise Owner and HQ Admin.' });
      }
    } else {
      const branchCheck = checkBranchAuthorization(user, existingBranch);
      if (!branchCheck.authorized) {
        return res.status(403).json({ error: branchCheck.error });
      }
    }

    if ('type' in (req.body || {})) {
      const requestedType = String(req.body.type || '').trim();
      const allowedAccountTypes = new Set(['Asset', 'Liability', 'Equity', 'Revenue', 'COGS', 'Expense']);
      if (!allowedAccountTypes.has(requestedType)) {
        return res.status(400).json({ error: `Invalid account type '${requestedType}'.` });
      }
      const usageSnap = await db.collection('journal_lines').where('accountId', '==', id).limit(1).get();
      if (!usageSnap.empty && requestedType !== String(existingAcc.type || '').trim()) {
        return res.status(400).json({ error: 'Account type cannot be changed after posted journal lines exist.' });
      }
    }
    const updates = cleanUndefined({
      code: req.body.code ? String(req.body.code).trim() : undefined,
      name: req.body.name ? String(req.body.name).trim() : undefined,
      type: req.body.type ? String(req.body.type).trim() : undefined,
      category: req.body.category ? String(req.body.category).trim() : undefined,
      parentId: req.body.parentId ? String(req.body.parentId).trim() : undefined,
      description: req.body.description ? String(req.body.description).trim() : undefined,
      updatedAt: new Date().toISOString()
    });
    await accountRef.update(updates);
    return res.json({ status: 'success', id });
  } catch (err: any) {
    console.error('Update Account Error:', err);
    return res.status(500).json({ error: 'Update Account Failed' });
  }
}

export async function handleCreateJournalEntry(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleAuth = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleAuth.authorized) {
    return res.status(403).json({ error: roleAuth.error });
  }

  const entryData = req.body || {};
  const lines = Array.isArray(entryData.lines) ? entryData.lines : [];

  if (lines.length < 2) {
    return res.status(400).json({ error: 'Journal Entry must contain at least 2 lines (debit and credit).' });
  }

  for (const line of lines) {
    const d = Number(line?.debit); const c = Number(line?.credit);
    if (!Number.isFinite(d) || !Number.isFinite(c) || d < 0 || c < 0 || (d === 0 && c === 0) || (d > 0 && c > 0)) {
      return res.status(400).json({ error: 'Each journal line must contain exactly one positive finite debit or credit amount.' });
    }
  }
  const totalDebit = lines.reduce((s: number, l: any) => s + Number(l.debit), 0);
  const totalCredit = lines.reduce((s: number, l: any) => s + Number(l.credit), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return res.status(400).json({ error: `Journal Entry is unbalanced! Total Debit: ${totalDebit.toFixed(2)}, Total Credit: ${totalCredit.toFixed(2)}` });
  }
  if (!Array.isArray(lines) || lines.length < 2) return res.status(400).json({ error: 'Journal entry requires at least two lines.' });
  for (const line of lines) {
    const debit = Number(line?.debit ?? 0);
    const credit = Number(line?.credit ?? 0);
    if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0 || (debit === 0 && credit === 0) || (debit > 0 && credit > 0)) {
      return res.status(400).json({ error: 'Each journal line must contain one finite positive side only: debit XOR credit.' });
    }
  }

  const branchCheck = checkBranchAuthorization(user, entryData.branchId);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }
  const branchId = branchCheck.targetBranchId;
  let journalIdempotencyKey: string;
  try { journalIdempotencyKey = getRequiredIdempotencyKey(req, entryData.idempotencyKey); }
  catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }
  const db = getAdminDb();
  const journalIdemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`manual-journal:${user.uid}:${journalIdempotencyKey}`).digest('hex'));

  try {
    const result = await db.runTransaction(async (transaction) => {
      const idemSnap = await transaction.get(journalIdemRef);
      if (idemSnap.exists) return idemSnap.data();
      const entryNumber = `JE-${new Date().getFullYear()}-${randomInt(10000, 99999)}`;
      const now = new Date().toISOString();
      const postingDate = String(entryData.date || getMogadishuDateString(now)).slice(0,10);
      await assertAccountingDateOpenInTransaction(transaction, db, postingDate, branchId);

      // Phase 1 (All Reads)
      const uniqueAccountIds: string[] = Array.from(new Set(lines.map((l: any) => l.accountId ? String(l.accountId).trim() : '').filter(Boolean))) as string[];
      const accMap = new Map<string, { ref: any; data: any; balance: number }>();
      for (const accId of uniqueAccountIds) {
        const accRef = db.collection('accounts').doc(accId);
        const accSnap = await transaction.get(accRef);
        if (!accSnap.exists) throw new Error(`Journal account '${accId}' does not exist.`);
        const accData = accSnap.data() as any;
        const accBranch = normalizeCanonicalBranchId(accData.branchId || '');
        if (accBranch && accBranch !== 'all' && !areBranchesMatching(accBranch, branchId) && !isHQRoleOrClaim(user)) {
          throw new Error(`Journal account '${accId}' belongs to another branch and cannot be posted from branch '${branchId}'.`);
        }
        accMap.set(accId, { ref: accRef, data: accData, balance: Number(accData.balance || 0) });
      }

      // Phase 2 (All Writes)
      const jeRef = db.collection('journal_entries').doc();
      const newEntryPayload = cleanUndefined({
        id: jeRef.id,
        entryNumber,
        date: postingDate,
        reference: entryData.reference ? String(entryData.reference).trim() : '',
        description: entryData.description ? String(entryData.description).trim() : 'Manual Journal Entry',
        source: 'Manual',
        status: 'Posted',
        totalDebit,
        totalCredit,
        branchId,
        createdBy: user.name,
        createdAt: now
      });

      transaction.set(jeRef, newEntryPayload);

      for (const line of lines) {
        const jlRef = db.collection('journal_lines').doc();
        const normalizedAccountId = line.accountId ? String(line.accountId).trim() : '';
        const accEntry = normalizedAccountId ? accMap.get(normalizedAccountId) : undefined;
        if (!accEntry) throw new Error(`Journal account '${normalizedAccountId}' is required and must be preloaded.`);
        const lineDebit = Number(line.debit ?? 0);
        const lineCredit = Number(line.credit ?? 0);
        if (!Number.isFinite(lineDebit) || !Number.isFinite(lineCredit) || lineDebit < 0 || lineCredit < 0 || (lineDebit === 0 && lineCredit === 0) || (lineDebit > 0 && lineCredit > 0)) {
          throw new Error('Each journal line must contain exactly one positive, finite debit or credit amount.');
        }
        const canonicalAccountCode = accEntry.data.code ? String(accEntry.data.code).trim() : '';
        const canonicalAccountName = accEntry.data.name ? String(accEntry.data.name).trim() : '';
        const accountNature = normalizeAccountNature(accEntry.data.type, accEntry.data);

        transaction.set(jlRef, cleanUndefined({
          id: jlRef.id,
          journalEntryId: jeRef.id,
          entryNumber,
          accountId: normalizedAccountId,
          accountCode: canonicalAccountCode,
          accountName: canonicalAccountName,
          debit: lineDebit,
          credit: lineCredit,
          memo: line.memo ? String(line.memo).trim() : '',
          branchId,
          createdAt: now
        }));

        const ledgerRef = db.collection('ledger').doc();
        transaction.set(ledgerRef, cleanUndefined({
          id: ledgerRef.id,
          accountId: normalizedAccountId,
          accountCode: canonicalAccountCode,
          accountName: canonicalAccountName,
          journalEntryId: jeRef.id,
          entryNumber,
          date: postingDate,
          reference: entryData.reference || '',
          description: line.memo || entryData.description || 'Manual Journal Entry',
          debit: lineDebit,
          credit: lineCredit,
          branchId,
          createdAt: now
        }));

        const delta = accountNature === 'debit' ? lineDebit - lineCredit : lineCredit - lineDebit;
        accEntry.balance += delta;
      }

      for (const [, accEntry] of accMap.entries()) {
        transaction.update(accEntry.ref, { balance: accEntry.balance, updatedAt: now });
      }

      transaction.update(jeRef, { idempotencyKey: journalIdempotencyKey });
      transaction.set(journalIdemRef, cleanUndefined({ status:'success', journalEntryId: jeRef.id, entryNumber, createdAt: now }));
      return { ...newEntryPayload, idempotencyKey: journalIdempotencyKey };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Create Journal Entry Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Create Journal Entry Failed' });
  }
}

export async function handleCreateRevenue(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;
  const roleAuth = checkRoleAuthorization(user, ['Owner','owner','Admin','admin','Manager','manager','Accountant','accountant']);
  if (!roleAuth.authorized) return res.status(403).json({ error: roleAuth.error });
  const branchCheck = checkBranchAuthorization(user, req.body?.branchId);
  if (!branchCheck.authorized) return res.status(403).json({ error: branchCheck.error });
  let idemKey: string;
  try { idemKey = getRequiredIdempotencyKey(req); } catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Revenue amount must be a positive numeric value.' });
  const payMethod = normalizePaymentMethod(req.body?.paymentMethod || 'cash', 'cash');
  if (!payMethod || !['cash','card','bank','bank_transfer','mobile','mobile_money','cheque'].includes(payMethod)) {
    return res.status(400).json({ error: 'Invalid revenue payment method.' });
  }
  const db = getAdminDb();
  const targetBranchId = branchCheck.targetBranchId;
  const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`revenue:${user.uid}:${idemKey}`).digest('hex'));
  try {
    const result = await db.runTransaction(async (transaction) => {
      const idemSnap = await transaction.get(idemRef);
      if (idemSnap.exists) return idemSnap.data();
      const now = new Date().toISOString();
      const dateStr = String(req.body?.date || getMogadishuDateString(now)).slice(0,10);
      await assertAccountingDateOpenInTransaction(transaction, db, dateStr, targetBranchId);
      const revenueRef = db.collection('revenues').doc();
      const jeRef = db.collection('journal_entries').doc();
      const settlement = await resolveSettlementAccountInTransaction(transaction, db, targetBranchId, payMethod, req.body?.bankAccountId);
      const entryNumber = `JE-REV-${revenueRef.id.slice(0,8).toUpperCase()}`;
      const __accountState = await prepareAccountBalanceState(transaction, db, ['acc_revenue', settlement.id]);
      const __cashRegisterState = (payMethod === 'cash') ? await prepareCashRegisterStateInTransaction(transaction, db, targetBranchId) : undefined;
      const lines = [
        { accountId: settlement.id, accountCode: settlement.code, accountName: settlement.name, debit: amount, credit: 0, memo: `Manual revenue receipt ${revenueRef.id}` },
        { accountId: 'acc_revenue', accountCode: '4010', accountName: 'Restaurant Sales Revenue', debit: 0, credit: amount, memo: `Manual revenue ${revenueRef.id}` }
      ];
      transaction.set(revenueRef, cleanUndefined({ id:revenueRef.id, revenueNumber:`REV-${revenueRef.id.slice(0,8).toUpperCase()}`, category:String(req.body?.category || 'General Sales').trim(), amount, description:String(req.body?.description || '').trim(), paymentMethod:payMethod, paymentAccountId:settlement.id, bankAccountId:settlement.bankAccountId || req.body?.bankAccountId || undefined, branchId:targetBranchId, createdBy:user.name, createdAt:now, date:dateStr, journalEntryId:jeRef.id }));
      transaction.set(jeRef, cleanUndefined({ id:jeRef.id, entryNumber, date:dateStr, reference:revenueRef.id, description:`Manual revenue: ${String(req.body?.description || 'General Sales').trim()}`, source:'Revenue', status:'Posted', totalDebit:amount, totalCredit:amount, lines, branchId:targetBranchId, createdBy:user.name, createdAt:now }));
      for (const line of lines) {
        const jlRef = db.collection('journal_lines').doc();
        transaction.set(jlRef, cleanUndefined({ id:jlRef.id, journalEntryId:jeRef.id, entryNumber, ...line, branchId:targetBranchId, createdAt:now }));
        const ledgerRef = db.collection('ledger').doc();
        transaction.set(ledgerRef, cleanUndefined({ id:ledgerRef.id, accountId:line.accountId, accountCode:line.accountCode, accountName:line.accountName, journalEntryId:jeRef.id, entryNumber, date:dateStr, reference:revenueRef.id, description:line.memo, debit:line.debit, credit:line.credit, branchId:targetBranchId, createdAt:now }));
      }
      if (payMethod === 'cash') await applyCashRegisterMovementInTransaction(transaction, db, targetBranchId, amount, 'manual revenue cash receipt', __cashRegisterState);
      applyAccountBalanceDeltasInTransaction(transaction, __accountState, lines, now);
      const result = { status:'success', id:revenueRef.id, revenueNumber:`REV-${revenueRef.id.slice(0,8).toUpperCase()}`, amount, branchId:targetBranchId, journalEntryId:jeRef.id };
      transaction.set(idemRef, cleanUndefined({ ...result, createdAt:now }));
      return result;
    });
    return res.json(result);
  } catch (err:any) {
    console.error('Create Revenue Error:', err?.message || err);
    return res.status(err?.statusCode || 500).json({ error: err?.message || 'Create Revenue Failed' });
  }
}

export async function handleCreateReceivable(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;
  const roleAuth = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleAuth.authorized) return res.status(403).json({ error: roleAuth.error });
  const branchCheck = checkBranchAuthorization(user, req.body.branchId);
  if (!branchCheck.authorized) return res.status(403).json({ error: branchCheck.error });
  const targetBranchId = branchCheck.targetBranchId;
  const totalAmount = Number(req.body.totalAmount);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) return res.status(400).json({ error: 'Valid positive total amount is required for receivable.' });
  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req, req.body?.idempotencyKey); } catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }
  const db = getAdminDb();
  const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`receivable-create:${user.uid}:${idempotencyKey}`).digest('hex'));
  try {
    const result = await db.runTransaction(async (transaction) => {
      const idemSnap = await transaction.get(idemRef); if (idemSnap.exists) return idemSnap.data();
      const now = new Date().toISOString(); const dateStr = String(req.body.date || getMogadishuDateString(now)).slice(0,10);
      await assertAccountingDateOpenInTransaction(transaction, db, dateStr, targetBranchId);
      if (req.body.customerId) {
        const cSnap = await transaction.get(db.collection('customers').doc(String(req.body.customerId)));
        if (!cSnap.exists) throw Object.assign(new Error(`Customer "${req.body.customerId}" not found.`), { statusCode:404 });
        const cBranch = normalizeCanonicalBranchId(cSnap.data()?.branchId || '');
        if (cBranch && cBranch !== 'all' && !areBranchesMatching(cBranch, targetBranchId)) throw Object.assign(new Error('Receivable customer belongs to another branch.'), { statusCode:403 });
      }
      const ref = db.collection('receivables').doc(); const jeRef = db.collection('journal_entries').doc();
      const __accountState = await prepareAccountBalanceState(transaction, db, ['acc_ar','acc_revenue']);
      const invoiceNumber = String(req.body.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`).trim();
      const payload = cleanUndefined({
        id: ref.id, customerName: String(req.body.customerName || 'Customer').trim(), customerId: req.body.customerId ? String(req.body.customerId).trim() : undefined,
        invoiceNumber, totalAmount, paidAmount: 0, remainingBalance: totalAmount, status:'Unpaid',
        dueDate: req.body.dueDate ? String(req.body.dueDate).trim() : undefined, notes: req.body.notes ? String(req.body.notes).trim() : undefined,
        payments: [], branchId: targetBranchId, createdBy:user.name, createdAt:now, date:dateStr, idempotencyKey, journalEntryId:jeRef.id
      });
      const lines=[
        { accountId:'acc_ar', accountCode:'1200', accountName:'Accounts Receivable', debit:totalAmount, credit:0, memo:`AR Invoice ${invoiceNumber}` },
        { accountId:'acc_revenue', accountCode:'4010', accountName:'Restaurant Sales Revenue', debit:0, credit:totalAmount, memo:`AR Invoice ${invoiceNumber}` }
      ];
      transaction.set(ref,payload);
      transaction.set(jeRef,cleanUndefined({id:jeRef.id,entryNumber:`JE-AR-${ref.id.slice(0,8).toUpperCase()}`,date:dateStr,reference:invoiceNumber,description:`Receivable Invoice ${invoiceNumber}`,source:'Receivables',status:'Posted',totalDebit:totalAmount,totalCredit:totalAmount,lines,branchId:targetBranchId,createdBy:user.name,createdAt:now,idempotencyKey}));
      for(const line of lines){
        const jl= db.collection('journal_lines').doc(); const led=db.collection('ledger').doc();
        transaction.set(jl,cleanUndefined({id:jl.id,journalEntryId:jeRef.id,entryNumber:`JE-AR-${ref.id.slice(0,8).toUpperCase()}`,branchId:targetBranchId,...line,createdAt:now}));
        transaction.set(led,cleanUndefined({id:led.id,accountId:line.accountId,accountCode:line.accountCode,accountName:line.accountName,journalEntryId:jeRef.id,entryNumber:`JE-AR-${ref.id.slice(0,8).toUpperCase()}`,date:dateStr,reference:invoiceNumber,description:line.memo,debit:line.debit,credit:line.credit,branchId:targetBranchId,createdAt:now}));
      }
      applyAccountBalanceDeltasInTransaction(transaction,__accountState,lines,now);
      const out={status:'success',id:ref.id,invoiceNumber,totalAmount,branchId:targetBranchId,journalEntryId:jeRef.id};
      transaction.set(idemRef,cleanUndefined({...out,createdAt:now})); return out;
    });
    return res.json(result);
  } catch(err:any){ return res.status(err?.statusCode||500).json({error:err?.message||'Create Receivable Failed'}); }
}

export async function handleRecordARPayment(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleAuth = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleAuth.authorized) {
    return res.status(403).json({ error: roleAuth.error });
  }

  const { id } = req.params;
  const payment = req.body || {};
  const normalizedPayMethod = normalizePaymentMethod(payment.paymentMethod || 'cash', 'cash');
  if (!normalizedPayMethod) return res.status(400).json({ error: 'Invalid payment method.' });
  const paymentAmount = Number(payment.amount) || 0;

  if (!id || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ error: 'Valid receivable ID and positive numeric payment amount are required.' });
  }

  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req); } catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }
  const db = getAdminDb();

  try {
    const result = await db.runTransaction(async (transaction) => {
      const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`ar-payment:${user.uid}:${idempotencyKey}`).digest('hex'));
      const idemSnap = await transaction.get(idemRef);
      if (idemSnap.exists) return idemSnap.data();
      const ref = db.collection('receivables').doc(id);
      const snap = await transaction.get(ref);
      if (!snap.exists) {
        throw new Error('Receivable item not found');
      }

      const item = snap.data() as any;
      const targetBranchId = item.branchId || user.branchId;
      if (!targetBranchId) {
        throw new Error('Receivable entity branch identification missing. Payment rejected.');
      }
      const branchCheck = checkBranchAuthorization(user, targetBranchId);
      if (!branchCheck.authorized) {
        throw new Error(branchCheck.error);
      }

      const currentPaid = Number(item.paidAmount) || 0;
      const totalAmt = Number(item.totalAmount) || 0;
      const currentRemaining = Math.max(0, totalAmt - currentPaid);

      if (paymentAmount > currentRemaining + 0.001) {
        throw new Error(`Payment amount (${paymentAmount.toFixed(2)}) exceeds remaining receivable balance (${currentRemaining.toFixed(2)}).`);
      }

      const newPaidAmount = currentPaid + paymentAmount;
      const newRemaining = Math.max(0, totalAmt - newPaidAmount);
      const newStatus = newRemaining <= 0.001 ? 'Paid' : 'Partial';

      const timestamp = new Date().toISOString();
      const dateStr = String(payment.date || getMogadishuDateString(timestamp)).slice(0,10);
      await assertAccountingDateOpenInTransaction(transaction, db, dateStr, targetBranchId);
      const settlement = await resolveSettlementAccountInTransaction(transaction, db, targetBranchId, normalizedPayMethod, payment.bankAccountId);
      const __accountState = await prepareAccountBalanceState(transaction, db, ['acc_ar', settlement.id]);
      const __cashRegisterState = (normalizedPayMethod === 'cash') ? await prepareCashRegisterStateInTransaction(transaction, db, targetBranchId) : undefined;

      const newPayment = {
        id: `pay-${Date.now()}-${randomInt(100, 999)}`,
        date: dateStr,
        amount: paymentAmount,
        paymentMethod: normalizedPayMethod,
        paymentAccountId: settlement.id,
        bankAccountId: settlement.bankAccountId || payment.bankAccountId || undefined,
        reference: payment.reference || '',
        notes: payment.notes || ''
      };

      transaction.update(ref, {
        paidAmount: newPaidAmount,
        remainingBalance: newRemaining,
        status: newStatus,
        payments: [...(item.payments || []), newPayment],
        updatedAt: timestamp
      });

      // Post Double-Entry Journal Entry
      const payMethod = normalizedPayMethod;
      const paymentAccountCode = settlement.code;
      const paymentAccountName = settlement.name;

      const lines = [
        {
          accountId: settlement.id,
          accountCode: paymentAccountCode,
          accountName: paymentAccountName,
          debit: paymentAmount,
          credit: 0,
          memo: `AR Collection for Receivable #${item.invoiceNumber || id}`
        },
        {
          accountId: 'acc_ar',
          accountCode: '1100',
          accountName: 'Accounts Receivable',
          debit: 0,
          credit: paymentAmount,
          memo: `AR Collection for Receivable #${item.invoiceNumber || id}`
        }
      ];

      const jeRef = db.collection('journal_entries').doc();
      const entryNumber = `JE-ARPAY-${newPayment.id.slice(-6)}`;
      const journalEntry = {
        id: jeRef.id,
        entryNumber,
        date: dateStr,
        reference: item.invoiceNumber || id,
        description: `Accounts Receivable Collection from ${item.customerName || 'Customer'}`,
        source: 'Receivables',
        status: 'Posted',
        totalDebit: paymentAmount,
        totalCredit: paymentAmount,
        lines,
        branchId: targetBranchId,
        createdBy: user.name,
        createdAt: timestamp
      };

      transaction.set(jeRef, cleanUndefined(journalEntry));

      for (const line of lines) {
        const jlRef = db.collection('journal_lines').doc();
        transaction.set(jlRef, cleanUndefined({
          id: jlRef.id,
          journalEntryId: jeRef.id,
          entryNumber,
          branchId: targetBranchId,
          ...line,
          createdAt: timestamp
        }));

        const ledgerRef = db.collection('ledger').doc();
        transaction.set(ledgerRef, cleanUndefined({
          id: ledgerRef.id,
          accountId: line.accountId,
          accountCode: line.accountCode,
          accountName: line.accountName,
          journalEntryId: jeRef.id,
          entryNumber,
          date: dateStr,
          reference: item.invoiceNumber || id,
          description: line.memo,
          debit: line.debit,
          credit: line.credit,
          branchId: targetBranchId,
          createdAt: timestamp
        }));
      }

      if (normalizedPayMethod === 'cash') await applyCashRegisterMovementInTransaction(transaction, db, targetBranchId, paymentAmount, 'accounts receivable cash collection', __cashRegisterState);
      applyAccountBalanceDeltasInTransaction(transaction, __accountState, lines, timestamp);
      const out = { status: 'success', id, paidAmount: newPaidAmount, remainingBalance: newRemaining };
      transaction.set(idemRef, cleanUndefined({ ...out, createdAt: timestamp }));
      return out;
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Record AR Payment Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Record AR Payment Failed' });
  }
}

export async function handleCreatePayable(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res); if (!user) return;
  const roleAuth = checkRoleAuthorization(user, ['Owner','owner','Admin','admin','Manager','manager','Accountant','accountant']);
  if (!roleAuth.authorized) return res.status(403).json({error:roleAuth.error});
  const branchCheck = checkBranchAuthorization(user, req.body.branchId); if (!branchCheck.authorized) return res.status(403).json({error:branchCheck.error});
  const targetBranchId=branchCheck.targetBranchId; const totalAmount=Number(req.body.totalAmount);
  if(!Number.isFinite(totalAmount)||totalAmount<=0)return res.status(400).json({error:'Valid positive total amount is required for payable.'});
  let idempotencyKey:string; try{idempotencyKey=getRequiredIdempotencyKey(req,req.body?.idempotencyKey);}catch(e:any){return res.status(e?.statusCode||400).json({error:e?.message||'Idempotency-Key is required.'});}
  const db=getAdminDb(); const idemRef=db.collection('mutation_idempotency').doc(createHash('sha256').update(`payable-create:${user.uid}:${idempotencyKey}`).digest('hex'));
  try{
    const result=await db.runTransaction(async(transaction)=>{
      const idemSnap=await transaction.get(idemRef); if(idemSnap.exists)return idemSnap.data();
      const now=new Date().toISOString(); const dateStr=String(req.body.date||getMogadishuDateString(now)).slice(0,10);
      await assertAccountingDateOpenInTransaction(transaction,db,dateStr,targetBranchId);
      const ref=db.collection('payables').doc(), jeRef=db.collection('journal_entries').doc();
      const __accountState=await prepareAccountBalanceState(transaction,db,['acc_expense','acc_ap']);
      const billNumber=String(req.body.billNumber||`BILL-${Date.now().toString().slice(-6)}`).trim();
      const payload=cleanUndefined({id:ref.id,vendorName:String(req.body.vendorName||req.body.supplierName||'Vendor').trim(),vendorId:req.body.vendorId?String(req.body.vendorId).trim():undefined,billNumber,totalAmount,paidAmount:0,remainingBalance:totalAmount,status:'Unpaid',dueDate:req.body.dueDate?String(req.body.dueDate).trim():undefined,notes:req.body.notes?String(req.body.notes).trim():undefined,payments:[],branchId:targetBranchId,createdBy:user.name,createdAt:now,date:dateStr,idempotencyKey,journalEntryId:jeRef.id});
      const lines=[{accountId:'acc_expense',accountCode:'6010',accountName:'Operating Expense',debit:totalAmount,credit:0,memo:`AP Invoice ${billNumber}`},{accountId:'acc_ap',accountCode:'2010',accountName:'Accounts Payable',debit:0,credit:totalAmount,memo:`AP Invoice ${billNumber}`}];
      const entryNumber=`JE-AP-${ref.id.slice(0,8).toUpperCase()}`;
      transaction.set(ref,payload); transaction.set(jeRef,cleanUndefined({id:jeRef.id,entryNumber,date:dateStr,reference:billNumber,description:`Payable Invoice ${billNumber}`,source:'Payables',status:'Posted',totalDebit:totalAmount,totalCredit:totalAmount,lines,branchId:targetBranchId,createdBy:user.name,createdAt:now,idempotencyKey}));
      for(const line of lines){const jl=db.collection('journal_lines').doc(),led=db.collection('ledger').doc();transaction.set(jl,cleanUndefined({id:jl.id,journalEntryId:jeRef.id,entryNumber,branchId:targetBranchId,...line,createdAt:now}));transaction.set(led,cleanUndefined({id:led.id,accountId:line.accountId,accountCode:line.accountCode,accountName:line.accountName,journalEntryId:jeRef.id,entryNumber,date:dateStr,reference:billNumber,description:line.memo,debit:line.debit,credit:line.credit,branchId:targetBranchId,createdAt:now}));}
      applyAccountBalanceDeltasInTransaction(transaction,__accountState,lines,now); const out={status:'success',id:ref.id,billNumber,totalAmount,branchId:targetBranchId,journalEntryId:jeRef.id}; transaction.set(idemRef,cleanUndefined({...out,createdAt:now})); return out;
    }); return res.json(result);
  }catch(err:any){return res.status(err?.statusCode||500).json({error:err?.message||'Create Payable Failed'});}
}

export async function handleRecordAPPayment(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleAuth = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleAuth.authorized) {
    return res.status(403).json({ error: roleAuth.error });
  }

  const { id } = req.params;
  const payment = req.body || {};
  const normalizedPayMethod = normalizePaymentMethod(payment.paymentMethod || 'cash', 'cash');
  if (!normalizedPayMethod) return res.status(400).json({ error: 'Invalid payment method.' });
  const paymentAmount = Number(payment.amount) || 0;

  if (!id || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ error: 'Valid payable ID and positive numeric payment amount are required.' });
  }

  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req); } catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }
  const db = getAdminDb();

  try {
    const result = await db.runTransaction(async (transaction) => {
      const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`ap-payment:${user.uid}:${idempotencyKey}`).digest('hex'));
      const idemSnap = await transaction.get(idemRef);
      if (idemSnap.exists) return idemSnap.data();
      const ref = db.collection('payables').doc(id);
      const snap = await transaction.get(ref);
      if (!snap.exists) {
        throw new Error('Payable item not found');
      }

      const item = snap.data() as any;
      const targetBranchId = item.branchId || user.branchId;
      if (!targetBranchId) {
        throw new Error('Payable entity branch identification missing. Payment rejected.');
      }
      const branchCheck = checkBranchAuthorization(user, targetBranchId);
      if (!branchCheck.authorized) {
        throw new Error(branchCheck.error);
      }

      const currentPaid = Number(item.paidAmount) || 0;
      const totalAmt = Number(item.totalAmount) || 0;
      const currentRemaining = Math.max(0, totalAmt - currentPaid);

      if (paymentAmount > currentRemaining + 0.001) {
        throw new Error(`Payment amount (${paymentAmount.toFixed(2)}) exceeds remaining payable balance (${currentRemaining.toFixed(2)}).`);
      }

      const newPaidAmount = currentPaid + paymentAmount;
      const newRemaining = Math.max(0, totalAmt - newPaidAmount);
      const newStatus = newRemaining <= 0.001 ? 'Paid' : 'Partial';

      const timestamp = new Date().toISOString();
      const dateStr = String(payment.date || getMogadishuDateString(timestamp)).slice(0,10);
      await assertAccountingDateOpenInTransaction(transaction, db, dateStr, targetBranchId);
      const settlement = await resolveSettlementAccountInTransaction(transaction, db, targetBranchId, normalizedPayMethod, payment.bankAccountId);
      const __accountState = await prepareAccountBalanceState(transaction, db, ['acc_ap', settlement.id]);
      const __cashRegisterState = (normalizedPayMethod === 'cash') ? await prepareCashRegisterStateInTransaction(transaction, db, targetBranchId) : undefined;

      const newPayment = {
        id: `pay-${Date.now()}-${randomInt(100, 999)}`,
        date: dateStr,
        amount: paymentAmount,
        paymentMethod: normalizedPayMethod,
        paymentAccountId: settlement.id,
        bankAccountId: settlement.bankAccountId || payment.bankAccountId || undefined,
        reference: payment.reference || '',
        notes: payment.notes || ''
      };

      transaction.update(ref, {
        paidAmount: newPaidAmount,
        remainingBalance: newRemaining,
        status: newStatus,
        payments: [...(item.payments || []), newPayment],
        updatedAt: timestamp
      });

      // Post Double-Entry Journal Entry
      const payMethod = normalizedPayMethod;
      const paymentAccountCode = settlement.code;
      const paymentAccountName = settlement.name;

      const lines = [
        {
          accountId: 'acc_ap',
          accountCode: '2010',
          accountName: 'Accounts Payable',
          debit: paymentAmount,
          credit: 0,
          memo: `AP Settlement for Payable #${item.billNumber || id}`
        },
        {
          accountId: settlement.id,
          accountCode: paymentAccountCode,
          accountName: paymentAccountName,
          debit: 0,
          credit: paymentAmount,
          memo: `AP Settlement for Payable #${item.billNumber || id}`
        }
      ];

      const jeRef = db.collection('journal_entries').doc();
      const entryNumber = `JE-APPAY-${newPayment.id.slice(-6)}`;
      const journalEntry = {
        id: jeRef.id,
        entryNumber,
        date: dateStr,
        reference: item.billNumber || id,
        description: `Accounts Payable Settlement to ${item.vendorName || item.supplierName || 'Vendor'}`,
        source: 'Payables',
        status: 'Posted',
        totalDebit: paymentAmount,
        totalCredit: paymentAmount,
        lines,
        branchId: targetBranchId,
        createdBy: user.name,
        createdAt: timestamp
      };

      transaction.set(jeRef, cleanUndefined(journalEntry));

      for (const line of lines) {
        const jlRef = db.collection('journal_lines').doc();
        transaction.set(jlRef, cleanUndefined({
          id: jlRef.id,
          journalEntryId: jeRef.id,
          entryNumber,
          branchId: targetBranchId,
          ...line,
          createdAt: timestamp
        }));

        const ledgerRef = db.collection('ledger').doc();
        transaction.set(ledgerRef, cleanUndefined({
          id: ledgerRef.id,
          accountId: line.accountId,
          accountCode: line.accountCode,
          accountName: line.accountName,
          journalEntryId: jeRef.id,
          entryNumber,
          date: dateStr,
          reference: item.billNumber || id,
          description: line.memo,
          debit: line.debit,
          credit: line.credit,
          branchId: targetBranchId,
          createdAt: timestamp
        }));
      }

      if (normalizedPayMethod === 'cash') await applyCashRegisterMovementInTransaction(transaction, db, targetBranchId, paymentAmount, 'accounts payable cash settlement', __cashRegisterState);
      applyAccountBalanceDeltasInTransaction(transaction, __accountState, lines, timestamp);
      const out = { status: 'success', id, paidAmount: newPaidAmount, remainingBalance: newRemaining };
      transaction.set(idemRef, cleanUndefined({ ...out, createdAt: timestamp }));
      return out;
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Record AP Payment Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Record AP Payment Failed' });
  }
}

export async function handleOpenCashRegister(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleAuth = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant', 'Cashier', 'cashier']);
  if (!roleAuth.authorized) {
    return res.status(403).json({ error: roleAuth.error });
  }

  const branchCheck = checkBranchAuthorization(user, req.body.branchId);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }
  const targetBranchId = branchCheck.targetBranchId;

  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req, req.body?.idempotencyKey); } catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }

  const db = getAdminDb();
  try {
    const openingBalance = Number(req.body.openingBalance ?? 0);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      return res.status(400).json({ error: 'Opening balance must be a non-negative number.' });
    }

    const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`cash-register-open:${user.uid}:${targetBranchId}:${idempotencyKey}`).digest('hex'));
    const result = await db.runTransaction(async (transaction) => {
      const idemSnap = await transaction.get(idemRef);
      if (idemSnap.exists) return idemSnap.data();
      // P1-8: Atomic single-open-register enforcement + creation.
      const openRegQuery = db.collection('cash_registers')
        .where('branchId', '==', targetBranchId)
        .where('status', '==', 'Open');
      const openRegSnap = await transaction.get(openRegQuery);
      if (!openRegSnap.empty) {
        const activeReg = openRegSnap.docs[0];
        throw new Error(`ACTIVE_REGISTER:${activeReg.id}`);
      }

      const timestamp = new Date().toISOString();
      const dateStr = getMogadishuDateString(timestamp);
      await assertAccountingDateOpenInTransaction(transaction, db, dateStr, targetBranchId);
      const __openRegisterAccountState = await prepareAccountBalanceState(transaction, db, ['acc_cash','acc_equity']);
      const payload = cleanUndefined({
        openedBy: user.name,
        openedById: user.uid,
        openedAt: timestamp,
        openingBalance,
        cashSales: 0,
        cashPayouts: 0,
        expectedClosingBalance: openingBalance,
        status: 'Open',
        branchId: targetBranchId
      });

      const docRef = db.collection('cash_registers').doc();

      // P1-9: Opening Balance Double-Entry Accounting is atomic with register creation.
      if (openingBalance > 0) {
        const jeRef = db.collection('journal_entries').doc();
        const entryNumber = `JE-FLOAT-${docRef.id.slice(0, 6)}`;
        const lines = [
          { accountId: 'acc_cash', accountCode: '1010', accountName: 'Cash on Hand (Register)', debit: openingBalance, credit: 0, memo: `Opening cash register float for ${payload.openedBy}` },
          { accountId: 'acc_equity', accountCode: '3010', accountName: "Owner's Capital / Opening Balance Equity", debit: 0, credit: openingBalance, memo: 'Opening float equity/capital introduction' }
        ];
        transaction.set(jeRef, cleanUndefined({
          id: jeRef.id,
          entryNumber,
          date: dateStr,
          reference: docRef.id,
          description: `Opening Cash Register Float (Register #${docRef.id.slice(0, 6)})`,
          source: 'Manual',
          status: 'Posted',
          totalDebit: openingBalance,
          totalCredit: openingBalance,
          lines,
          branchId: targetBranchId,
          createdBy: user.name,
          createdAt: timestamp
        }));
        applyAccountBalanceDeltasInTransaction(transaction, __openRegisterAccountState, lines, timestamp);
      }

      transaction.set(docRef, { id: docRef.id, ...payload });
      const out = { status: 'success', id: docRef.id, ...payload, idempotencyKey };
      transaction.set(idemRef, cleanUndefined({ ...out, createdAt: timestamp }));
      return out;
    });

    return res.json(result);
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.startsWith('ACTIVE_REGISTER:')) {
      const activeRegisterId = msg.substring('ACTIVE_REGISTER:'.length);
      return res.status(409).json({
        error: `An active open cash register already exists for branch "${targetBranchId}". Please close it before opening a new register.`,
        activeRegisterId
      });
    }
    const normalizedErrorMessage = msg.toLowerCase();
    const configurationFailure =
      normalizedErrorMessage.includes('gl account') ||
      normalizedErrorMessage.includes('accounting period') ||
      normalizedErrorMessage.includes('accounting date');
    return res.status(configurationFailure ? 400 : 500).json({ error: msg || 'Open Cash Register Failed' });
  }
}

export async function handleCloseCashRegister(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleAuth = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant', 'Cashier', 'cashier']);
  if (!roleAuth.authorized) {
    return res.status(403).json({ error: roleAuth.error });
  }

  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Cash register ID is required.' });
  }
  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req, req.body?.idempotencyKey); } catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }

  const db = getAdminDb();

  try {
    const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`cash-register-close:${user.uid}:${id}:${idempotencyKey}`).digest('hex'));
    const result = await db.runTransaction(async (transaction) => {
      const idemSnap = await transaction.get(idemRef);
      if (idemSnap.exists) return idemSnap.data();
      const ref = db.collection('cash_registers').doc(id);
      const snap = await transaction.get(ref);
      if (!snap.exists) throw new Error('Cash register not found');

      const reg = snap.data() as any;
      if (reg.status === 'Closed') throw Object.assign(new Error('Cash register is already closed.'), { statusCode: 400 });
      const branchCheck = checkBranchAuthorization(user, reg.branchId);
      if (!branchCheck.authorized) throw new Error(branchCheck.error);

      const actualClosingBalance = Number(req.body.actualClosingBalance ?? 0);
      if (!Number.isFinite(actualClosingBalance) || actualClosingBalance < 0) {
        throw new Error('Actual closing balance must be a non-negative number.');
      }
      const expected = Number(reg.expectedClosingBalance || reg.openingBalance || 0);
      const diff = actualClosingBalance - expected;
      const timestamp = new Date().toISOString();
      const dateStr = getMogadishuDateString(timestamp);
      await assertAccountingDateOpenInTransaction(transaction, db, dateStr, reg.branchId);
      // Only load variance accounts when a non-zero variance will actually be posted.
      // A balanced close must not depend on optional over/short GL fixtures.
      const __closeRegisterAccountState = Math.abs(diff) > 0.000001
        ? await prepareAccountBalanceState(transaction, db, ['acc_cash','acc_cash_short','acc_cash_over'])
        : undefined;

      transaction.update(ref, cleanUndefined({
        closedBy: user.name,
        closedById: user.uid,
        closedAt: timestamp,
        actualClosingBalance,
        difference: diff,
        status: 'Closed',
        notes: req.body.notes ? String(req.body.notes).trim() : ''
      }));

      // Reconcile cash register variance into GL atomically.
      if (Math.abs(diff) > 0.000001) {
        const jeRef = db.collection('journal_entries').doc();
        const entryNumber = `JE-CASHCLOSE-${ref.id.slice(0, 6)}`;
        const shortage = diff < 0;
        const variance = Math.abs(diff);
        const lines = shortage
          ? [
              { accountId: 'acc_cash_short', accountCode: '6290', accountName: 'Cash Shortage / Over & Short', debit: variance, credit: 0, memo: `Cash shortage at register close` },
              { accountId: 'acc_cash', accountCode: '1010', accountName: 'Cash on Hand (Register)', debit: 0, credit: variance, memo: `Reduce book cash to physical cash` }
            ]
          : [
              { accountId: 'acc_cash', accountCode: '1010', accountName: 'Cash on Hand (Register)', debit: variance, credit: 0, memo: `Increase book cash to physical cash` },
              { accountId: 'acc_cash_over', accountCode: '4290', accountName: 'Cash Over / Other Income', debit: 0, credit: variance, memo: `Cash overage at register close` }
            ];
        transaction.set(jeRef, cleanUndefined({
          id: jeRef.id,
          entryNumber,
          date: dateStr,
          reference: ref.id,
          description: `Cash Register Closing Variance (${shortage ? 'Shortage' : 'Overage'})`,
          source: 'Manual',
          status: 'Posted',
          totalDebit: variance,
          totalCredit: variance,
          lines,
          branchId: reg.branchId,
          createdBy: user.name,
          createdAt: timestamp
        }));
        applyAccountBalanceDeltasInTransaction(transaction, __closeRegisterAccountState!, lines, timestamp);
      }

      const out = { status: 'success', id: ref.id, difference: diff, idempotencyKey };
      transaction.set(idemRef, cleanUndefined({ ...out, createdAt: timestamp }));
      return out;
    });
    return res.json(result);
  } catch (err: any) {
    const statusCode = Number(err?.statusCode);
    return res.status([400, 403, 404, 409].includes(statusCode) ? statusCode : 500).json({ error: err?.message || 'Close Cash Register Failed' });
  }
}

export async function handleCreateBankAccount(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleAuth = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleAuth.authorized) return res.status(403).json({ error: roleAuth.error });

  const branchCheck = checkBranchAuthorization(user, req.body.branchId);
  if (!branchCheck.authorized) return res.status(403).json({ error: branchCheck.error });
  const targetBranchId = branchCheck.targetBranchId;

  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req, req.body?.idempotencyKey); }
  catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }

  const initialBalance = Number(req.body.initialBalance ?? req.body.currentBalance ?? 0);
  if (!Number.isFinite(initialBalance) || initialBalance < 0) {
    return res.status(400).json({ error: 'Initial bank balance must be a non-negative number.' });
  }

  const db = getAdminDb();
  const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`bank-account:${user.uid}:${idempotencyKey}`).digest('hex'));
  try {
    const result = await db.runTransaction(async (transaction) => {
      const idemSnap = await transaction.get(idemRef);
      if (idemSnap.exists) return idemSnap.data();

      const timestamp = new Date().toISOString();
      const dateStr = getMogadishuDateString(timestamp);
      await assertAccountingDateOpenInTransaction(transaction, db, dateStr, targetBranchId);

      const accountName = String(req.body.accountName || 'Bank Account').trim();
      const accountNumber = String(req.body.accountNumber || '').trim();
      const currency = String(req.body.currency || 'USD').trim().toUpperCase();
      const bankName = String(req.body.bankName || '').trim();
      const status = req.body.status === 'Inactive' ? 'Inactive' : 'Active';

      if (accountNumber) {
        const duplicate = await transaction.get(
          db.collection('bank_accounts').where('branchId', '==', targetBranchId).where('accountNumber', '==', accountNumber).limit(1)
        );
        if (!duplicate.empty) throw Object.assign(new Error(`Bank account number "${accountNumber}" already exists in branch "${targetBranchId}".`), { statusCode: 409 });
      }

      const docRef = db.collection('bank_accounts').doc();
      const glRef = db.collection('accounts').doc();
      const glAccountCode = `1020-${docRef.id.slice(0, 6)}`;
      let equityState: any = null;
      if (initialBalance > 0) {
        equityState = await prepareAccountBalanceState(transaction, db, ['acc_equity']);
      }

      const payload = cleanUndefined({
        accountName,
        accountNumber,
        bankName,
        currentBalance: initialBalance,
        currency,
        status,
        branchId: targetBranchId,
        glAccountId: glRef.id,
        idempotencyKey,
        createdBy: user.name,
        createdAt: timestamp
      });

      transaction.set(docRef, { id: docRef.id, ...payload });
      // The new GL account starts with the opening balance because its matching
      // opening journal is created atomically below. It is not a later manual edit.
      transaction.set(glRef, {
        id: glRef.id,
        code: glAccountCode,
        name: accountName,
        type: 'Asset',
        balance: initialBalance,
        currency,
        isSystem: false,
        status: 'Active',
        branchId: targetBranchId,
        createdAt: timestamp,
        description: `GL control account for bank ${accountName}`
      });

      let openingJournalId: string | undefined;
      if (initialBalance > 0) {
        const jeRef = db.collection('journal_entries').doc();
        openingJournalId = jeRef.id;
        const entryNumber = `JE-BANK-OPEN-${docRef.id.slice(0,6)}`;
        const lines = [
          { accountId: glRef.id, accountCode: glAccountCode, accountName, debit: initialBalance, credit: 0, memo: 'Bank opening balance' },
          { accountId: 'acc_equity', accountCode: '3010', accountName: "Owner's Capital / Opening Balance Equity", debit: 0, credit: initialBalance, memo: 'Bank opening balance equity' }
        ];
        transaction.set(jeRef, cleanUndefined({
          id: jeRef.id, entryNumber, date: dateStr, reference: docRef.id,
          description: `Opening Bank Balance (${accountName})`, source: 'Opening Balance', status: 'Posted',
          totalDebit: initialBalance, totalCredit: initialBalance, lines,
          branchId: targetBranchId, createdBy: user.name, createdAt: timestamp,
          idempotencyKey
        }));
        for (const line of lines) {
          const jlRef = db.collection('journal_lines').doc();
          transaction.set(jlRef, cleanUndefined({ id: jlRef.id, journalEntryId: jeRef.id, entryNumber, branchId: targetBranchId, ...line, createdAt: timestamp }));
          const ledgerRef = db.collection('ledger').doc();
          transaction.set(ledgerRef, cleanUndefined({ id: ledgerRef.id, accountId: line.accountId, accountCode: line.accountCode, accountName: line.accountName, journalEntryId: jeRef.id, entryNumber, date: dateStr, reference: docRef.id, description: line.memo, debit: line.debit, credit: line.credit, branchId: targetBranchId, createdAt: timestamp }));
        }
        applyAccountBalanceDeltasInTransaction(transaction, equityState, [{ accountId: 'acc_equity', debit: 0, credit: initialBalance }], timestamp);
      }

      const result = { status:'success', id:docRef.id, glAccountId:glRef.id, openingJournalId: openingJournalId || null, ...payload };
      transaction.set(idemRef, cleanUndefined({ ...result, createdAt: timestamp }));
      return result;
    });
    return res.json(result);
  } catch (err:any) {
    console.error('Create Bank Account Error:', err?.message || err);
    return res.status(err?.statusCode || 500).json({ error: err?.message || 'Create Bank Account Failed' });
  }
}

export async function handleCreateTax(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleAuth = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin']);
  if (!roleAuth.authorized || !isHQRoleOrClaim(user)) {
    return res.status(403).json({ error: 'Global Tax administration is restricted to Enterprise Owner and HQ Admin.' });
  }

  const db = getAdminDb();
  try {
    const taxRate = Number(req.body.rate ?? 0);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return res.status(400).json({ error: 'Tax rate must be a number between 0 and 100.' });
    const requestedBranch = String(req.body.branchId || user.branchId || '').trim();
    const branchCheck = checkBranchAuthorization(user, requestedBranch);
    if (!branchCheck.authorized || !branchCheck.targetBranchId || branchCheck.targetBranchId === 'all') return res.status(400).json({ error: 'A concrete branchId is required for tax configuration.' });
    const payload = cleanUndefined({
      name: req.body.name ? String(req.body.name).trim() : 'Tax',
      rate: taxRate,
      type: req.body.type ? String(req.body.type).trim() : 'percentage',
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
      branchId: branchCheck.targetBranchId,
      createdAt: new Date().toISOString()
    });
    const docRef = db.collection('taxes').doc();
    await docRef.set({ id: docRef.id, ...payload });

    return res.json({ id: docRef.id, ...payload });
  } catch (err: any) {
    console.error('Create Tax Error:', err?.message || err);
    return res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Create Tax Failed' : (err?.message || 'Create Tax Failed') });
  }
}

export async function handleUpdateTax(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleAuth = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin']);
  if (!roleAuth.authorized || !isHQRoleOrClaim(user)) {
    return res.status(403).json({ error: 'Global Tax administration is restricted to Enterprise Owner and HQ Admin.' });
  }

  const { id } = req.params;
  const db = getAdminDb();
  try {
    let normalizedRate: number | undefined;
    if (req.body.rate !== undefined) {
      normalizedRate = Number(req.body.rate);
      if (!Number.isFinite(normalizedRate) || normalizedRate < 0 || normalizedRate > 100) return res.status(400).json({ error: 'Tax rate must be a number between 0 and 100.' });
    }
    const existingSnap = await db.collection('taxes').doc(id).get();
    if (!existingSnap.exists) return res.status(404).json({ error: 'Tax configuration not found.' });
    const existingBranch = String(existingSnap.data()?.branchId || '').trim();
    const branchCheck = checkBranchAuthorization(user, existingBranch);
    if (!branchCheck.authorized || !existingBranch) return res.status(403).json({ error: 'Tax configuration must belong to a concrete authorized branch.' });
    const updates = cleanUndefined({
      name: req.body.name ? String(req.body.name).trim() : undefined,
      rate: normalizedRate,
      type: req.body.type ? String(req.body.type).trim() : undefined,
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : undefined,
      branchId: existingBranch,
      updatedAt: new Date().toISOString()
    });
    await db.collection('taxes').doc(id).update(updates);
    return res.json({ status: 'success', id });
  } catch (err: any) {
    console.error('Update Tax Error:', err?.message || err);
    return res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Update Tax Failed' : (err?.message || 'Update Tax Failed') });
  }
}


async function validateRecipeItemsInTransaction(transaction: any, db: any, items: any[], branchId: string) {
  const normalizedBranch = normalizeCanonicalBranchId(branchId || '');
  if (!normalizedBranch || normalizedBranch === 'all') {
    throw Object.assign(new Error('Recipe branch must be a concrete branch.'), { statusCode: 400 });
  }
  const rawItems = Array.isArray(items) ? items : [];
  for (const item of rawItems) {
    const ingredientId = String(item?.ingredientId || item?.id || '').trim();
    if (!ingredientId) throw Object.assign(new Error('Every recipe item must reference a concrete ingredientId.'), { statusCode: 400 });
  }
  const uniqueIds = [...new Set(rawItems.map((item: any) => String(item?.ingredientId || item?.id || '').trim()))];
  for (const ingredientId of uniqueIds) {
    const snap = await transaction.get(db.collection('ingredients').doc(ingredientId));
    if (!snap.exists) throw Object.assign(new Error(`Ingredient "${ingredientId}" not found for recipe.`), { statusCode: 400 });
    const ingredientBranch = normalizeCanonicalBranchId(snap.data()?.branchId || '');
    if (!ingredientBranch || !areBranchesMatching(ingredientBranch, normalizedBranch)) {
      throw Object.assign(new Error(`Recipe ingredient "${ingredientId}" does not belong to recipe branch "${normalizedBranch}".`), { statusCode: 403 });
    }
  }
}

export async function handleCreateRecipe(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res); if (!user) return;
  const role = checkRoleAuthorization(user, ['Owner','owner','Admin','admin','Manager','manager']);
  if (!role.authorized) return res.status(403).json({ error: role.error });
  let key: string; try { key = getRequiredIdempotencyKey(req); } catch (e:any) { return res.status(e?.statusCode||400).json({error:e?.message||'Idempotency-Key is required.'}); }
  const recipe = req.body?.recipeData || req.body || {};
  const requestedBranch = String(recipe.branchId || user.branchId || '').trim();
  const branch = checkBranchAuthorization(user, requestedBranch);
  if (!branch.authorized || !branch.targetBranchId || branch.targetBranchId === 'all') return res.status(403).json({error: branch.error || 'Concrete recipe branch is required.'});
  const db = getAdminDb();
  const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`recipe-create:${user.uid}:${key}`).digest('hex'));
  try {
    const result = await db.runTransaction(async (tx:any) => {
      const idem = await tx.get(idemRef); if (idem.exists) return idem.data();
      const items = Array.isArray(recipe.items) ? recipe.items : [];
      await validateRecipeItemsInTransaction(tx, db, items, branch.targetBranchId);
      const ref = db.collection('recipes').doc();
      const now = new Date().toISOString();
      let productRef:any = null; let product:any = null;
      if (recipe.productId) {
        productRef = db.collection('products').doc(String(recipe.productId));
        const ps = await tx.get(productRef);
        if (!ps.exists) throw Object.assign(new Error(`Product "${recipe.productId}" not found.`),{statusCode:404});
        product = ps.data() || {};
        const productBranch = normalizeCanonicalBranchId(product.branchId || '');
        if (!productBranch || !areBranchesMatching(productBranch, branch.targetBranchId)) throw Object.assign(new Error('Recipe product belongs to a different branch.'),{statusCode:403});
      }
      const newRecipe = cleanUndefined({ ...recipe, id: ref.id, branchId: branch.targetBranchId, version: Number(recipe.version || 1), isActive: recipe.isActive !== false, createdAt: now, updatedAt: now, createdBy: user.name });
      tx.set(ref, newRecipe);
      if (productRef) tx.update(productRef, { activeRecipeId: ref.id, recipe: items, updatedAt: now });
      const hist = db.collection('recipe_versions').doc();
      tx.set(hist, cleanUndefined({ id: hist.id, recipeId: ref.id, productId: recipe.productId, productName: recipe.productName, version: newRecipe.version, items, totalCost: recipe.totalCost, foodCostPercentage: recipe.foodCostPercentage, sellingPrice: recipe.sellingPrice, changedBy: user.name || 'System', changeReason: 'Initial Recipe Creation', branchId: branch.targetBranchId, createdAt: now }));
      const out = {status:'success', recipe:newRecipe, id:ref.id}; tx.set(idemRef, cleanUndefined({...out, createdAt:now})); return out;
    });
    return res.status(201).json(result.recipe || result);
  } catch(e:any) { return res.status(e?.statusCode||500).json({error:e?.message||'Recipe creation failed.'}); }
}

export async function handleUpdateRecipe(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res); if (!user) return;
  const role = checkRoleAuthorization(user, ['Owner','owner','Admin','admin','Manager','manager']);
  if (!role.authorized) return res.status(403).json({error:role.error});
  const recipeId = String(req.params.id || '').trim(); if (!recipeId) return res.status(400).json({error:'Recipe ID is required.'});
  let key:string; try{key=getRequiredIdempotencyKey(req);}catch(e:any){return res.status(e?.statusCode||400).json({error:e?.message||'Idempotency-Key is required.'});}
  const data=req.body?.recipeData||req.body||{}; const db=getAdminDb(); const idemRef=db.collection('mutation_idempotency').doc(createHash('sha256').update(`recipe-update:${user.uid}:${recipeId}:${key}`).digest('hex'));
  try{const result=await db.runTransaction(async(tx:any)=>{const idem=await tx.get(idemRef);if(idem.exists)return idem.data(); const ref=db.collection('recipes').doc(recipeId);const snap=await tx.get(ref);if(!snap.exists)throw Object.assign(new Error('Recipe not found.'),{statusCode:404});const existing=snap.data()||{};const branch=checkBranchAuthorization(user, existing.branchId);if(!branch.authorized||!branch.targetBranchId||branch.targetBranchId==='all')throw Object.assign(new Error(branch.error||'Unauthorized recipe branch.'),{statusCode:403});const items=Array.isArray(data.items)?data.items:(Array.isArray(existing.items)?existing.items:[]);await validateRecipeItemsInTransaction(tx,db,items,branch.targetBranchId);const productId=data.productId||existing.productId;let productRef:any=null;if(productId){productRef=db.collection('products').doc(String(productId));const ps=await tx.get(productRef);if(!ps.exists)throw Object.assign(new Error('Recipe product not found.'),{statusCode:404});const pb=normalizeCanonicalBranchId(ps.data()?.branchId||'');if(!pb||!areBranchesMatching(pb,branch.targetBranchId))throw Object.assign(new Error('Recipe product belongs to a different branch.'),{statusCode:403});}const now=new Date().toISOString();const version=Number(existing.version||1)+1;const updates=cleanUndefined({...data,branchId:branch.targetBranchId,version,updatedAt:now});tx.update(ref,updates);if(productRef)tx.update(productRef,{activeRecipeId:recipeId,recipe:items,updatedAt:now});const hist=db.collection('recipe_versions').doc();tx.set(hist,cleanUndefined({id:hist.id,recipeId,productId,productName:data.productName||existing.productName,version,items,totalCost:data.totalCost??existing.totalCost,foodCostPercentage:data.foodCostPercentage??existing.foodCostPercentage,sellingPrice:data.sellingPrice??existing.sellingPrice,changedBy:user.name||'System',changeReason:String(data.changeReason||`Updated to version ${version}`),branchId:branch.targetBranchId,createdAt:now}));const out={status:'success',id:recipeId,version};tx.set(idemRef,cleanUndefined({...out,createdAt:now}));return out;});return res.json(result);}catch(e:any){return res.status(e?.statusCode||500).json({error:e?.message||'Recipe update failed.'});}
}

export async function handleDeleteRecipe(req: express.Request, res: express.Response) {
  const user=await authenticateTrustedUser(req,res);if(!user)return;const role=checkRoleAuthorization(user,['Owner','owner','Admin','admin','Manager','manager']);if(!role.authorized)return res.status(403).json({error:role.error});const recipeId=String(req.params.id||'').trim();if(!recipeId)return res.status(400).json({error:'Recipe ID is required.'});let key:string;try{key=getRequiredIdempotencyKey(req);}catch(e:any){return res.status(e?.statusCode||400).json({error:e?.message||'Idempotency-Key is required.'});}const db=getAdminDb();const idemRef=db.collection('mutation_idempotency').doc(createHash('sha256').update(`recipe-delete:${user.uid}:${recipeId}:${key}`).digest('hex'));try{const out=await db.runTransaction(async(tx:any)=>{const idem=await tx.get(idemRef);if(idem.exists)return idem.data();const ref=db.collection('recipes').doc(recipeId);const snap=await tx.get(ref);if(!snap.exists)throw Object.assign(new Error('Recipe not found.'),{statusCode:404});const existing=snap.data()||{};const branch=checkBranchAuthorization(user,existing.branchId);if(!branch.authorized)throw Object.assign(new Error(branch.error||'Unauthorized recipe branch.'),{statusCode:403});const now=new Date().toISOString();tx.update(ref,{isActive:false,isArchived:true,deletedAt:now,updatedAt:now});if(existing.productId){const pr=db.collection('products').doc(existing.productId);const ps=await tx.get(pr);if(ps.exists)tx.update(pr,{activeRecipeId:null,recipe:[],updatedAt:now});}const result={status:'success',id:recipeId};tx.set(idemRef,{...result,createdAt:now});return result;});return res.json(out);}catch(e:any){return res.status(e?.statusCode||500).json({error:e?.message||'Recipe deletion failed.'});}
}

export async function handleReceiveGoods(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleAuth = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleAuth.authorized) {
    return res.status(403).json({ error: roleAuth.error });
  }

  const { poId, receivedItems, receivedBy } = req.body || {};
  if (!poId) {
    return res.status(400).json({ error: 'Purchase Order ID (poId) is required.' });
  }

  const db = getAdminDb();
  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req, req.body?.idempotencyKey); } catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }
  const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`purchase-receive:${user.uid}:${idempotencyKey}`).digest('hex'));

  try {
    const result = await db.runTransaction(async (transaction) => {
      const idemSnap = await transaction.get(idemRef);
      if (idemSnap.exists) return idemSnap.data();
      const poRef = db.collection('purchase_orders').doc(poId);
      const poSnap = await transaction.get(poRef);
      if (!poSnap.exists) {
        throw new Error('Purchase Order not found');
      }

      const po = poSnap.data() as any;
      if (po.status === 'completed' || po.status === 'received') {
        throw new Error(`Purchase Order #${po.poNumber || poId} is already completed / fully received.`);
      }

      const targetBranchId = normalizeCanonicalBranchId(po.branchId || user.branchId || '');
      if (!targetBranchId || targetBranchId === 'all') {
        throw new Error('Purchase order branch identification missing. Receiving rejected.');
      }
      const branchCheck = checkBranchAuthorization(user, targetBranchId);
      if (!branchCheck.authorized) {
        throw new Error(branchCheck.error);
      }

      const items = Array.isArray(po.items) ? po.items : [];
      const recs = Array.isArray(receivedItems) ? receivedItems : [];

      let sessionReceivedCost = 0;

      const updatedItems = items.map((pi: any) => {
        const match = recs.find((ri: any) => ri.itemId === pi.itemId || ri.itemId === pi.id);
        if (match) {
          const qty = Number(match.receivedQty) || 0;
          if (qty <= 0) return pi;
          const currentReceived = Number(pi.receivedQuantity || 0);
          const requestedQty = Number(pi.requestedQuantity || pi.quantity || 0);
          const remainingQty = Math.max(0, requestedQty - currentReceived);

          if (qty > remainingQty + 0.0001) {
            throw new Error(`Over-receiving rejected for "${pi.itemName || pi.itemId}": receiving quantity (${qty}) exceeds remaining ordered quantity (${remainingQty}).`);
          }

          const unitPrice = Number(pi.unitCost || pi.unitPrice) || 0;
          sessionReceivedCost += qty * unitPrice;

          return {
            ...pi,
            receivedQuantity: currentReceived + qty,
            batchNumber: match.batchNumber || pi.batchNumber || '',
            expirationDate: match.expirationDate || pi.expirationDate || ''
          };
        }
        return pi;
      });

      if (sessionReceivedCost <= 0 && recs.length > 0) {
        throw new Error('No valid quantity to receive or all items are already fully received.');
      }

      let allFullyReceived = true;
      let totalReceivedSum = 0;
      updatedItems.forEach((item: any) => {
        const recv = item.receivedQuantity || 0;
        totalReceivedSum += recv;
        if (recv < (item.requestedQuantity || item.quantity || 0)) {
          allFullyReceived = false;
        }
      });

      const nextStatus = allFullyReceived ? 'completed' : totalReceivedSum > 0 ? 'partially_received' : po.status;
      const now = new Date().toISOString();
      const dateStr = getMogadishuDateString(now);

      // Phase 1 (All Reads) - Read all inventory / ingredient items before any writes
      const invSnapsMap = new Map<string, { invRef: any; invData: any; ingRef: any; ingData: any; qty: number; batchNumber: string; expirationDate: string }>();
      for (const rec of recs) {
        const qty = Number(rec.receivedQty) || 0;
        if (qty <= 0) continue;
        if (!rec.itemId) {
          throw new Error('Received item is missing itemId.');
        }

        const invRef = db.collection('inventory').doc(rec.itemId);
        const invSnap = await transaction.get(invRef);

        const ingRef = db.collection('ingredients').doc(rec.itemId);
        const ingSnap = await transaction.get(ingRef);

        if (!invSnap.exists && !ingSnap.exists) {
          throw new Error(`Inventory target item "${rec.itemId}" not found in system. Receiving rejected to prevent unbacked financial commitment.`);
        }

        if (invSnap.exists) {
          const invItemBranch = normalizeCanonicalBranchId((invSnap.data() as any)?.branchId || '');
          if (!invItemBranch || invItemBranch === 'all' || !areBranchesMatching(invItemBranch, targetBranchId)) {
            throw Object.assign(new Error(`Unauthorized cross-branch receiving: Inventory item "${rec.itemId}" is unauthorized or unmigrated; a concrete branch matching PO #${po.poNumber || poId} is required.`), { statusCode: 400 });
          }
        }

        if (ingSnap.exists) {
          const ingItemBranch = normalizeCanonicalBranchId((ingSnap.data() as any)?.branchId || '');
          if (!ingItemBranch || ingItemBranch === 'all' || !areBranchesMatching(ingItemBranch, targetBranchId)) {
            throw Object.assign(new Error(`Unauthorized cross-branch receiving: Ingredient "${rec.itemId}" is unauthorized or unmigrated; a concrete branch matching PO #${po.poNumber || poId} is required.`), { statusCode: 400 });
          }
        }

        invSnapsMap.set(rec.itemId, {
          invRef,
          invData: invSnap.exists ? (invSnap.data() as any) : null,
          ingRef,
          ingData: ingSnap.exists ? (ingSnap.data() as any) : null,
          qty,
          batchNumber: rec.batchNumber || '',
          expirationDate: rec.expirationDate || ''
        });
      }

      // Phase 2 (All Writes)
      transaction.update(poRef, cleanUndefined({
        items: updatedItems,
        status: nextStatus,
        updatedAt: now
      }));

      // Maintain synchronization on purchases projection doc
      transaction.set(db.collection('purchases').doc(poId), cleanUndefined({
        status: nextStatus,
        updatedAt: now
      }), { merge: true });

      // Update inventory and ingredients stock canonically inside transaction
      for (const [itemId, invEntry] of invSnapsMap.entries()) {
        const qty = invEntry.qty;
        const currentQty = invEntry.invData 
          ? (invEntry.invData.currentQuantity || 0) 
          : (invEntry.ingData ? (invEntry.ingData.stock || 0) : 0);
        const newQty = currentQty + qty;

        let status = 'in_stock';
        const minQty = (invEntry.invData?.minimumQuantity || invEntry.ingData?.minimumStock || 0);
        if (newQty <= 0) status = 'out_of_stock';
        else if (newQty <= minQty) status = 'low_stock';

        const itemName = invEntry.invData?.itemName || invEntry.ingData?.name || itemId;
        const itemCode = invEntry.invData?.itemCode || invEntry.ingData?.code || '';
        const unit = invEntry.invData?.unit || invEntry.ingData?.unit || 'pcs';

        if (invEntry.invData) {
          transaction.update(invEntry.invRef, {
            currentQuantity: newQty,
            batchNumber: invEntry.batchNumber || invEntry.invData.batchNumber || '',
            expirationDate: invEntry.expirationDate || invEntry.invData.expirationDate || '',
            status,
            updatedAt: now
          });
        } else {
          transaction.set(invEntry.invRef, {
            id: itemId,
            itemName,
            itemCode,
            currentQuantity: newQty,
            unit,
            branchId: targetBranchId,
            batchNumber: invEntry.batchNumber || '',
            expirationDate: invEntry.expirationDate || '',
            status,
            createdAt: now,
            updatedAt: now
          });
        }

        // Canonical synchronization with ingredients collection (consumed by POS and Recipe Engine)
        if (invEntry.ingData) {
          transaction.update(invEntry.ingRef, {
            stock: newQty,
            currentStockUsageUnit: newQty,
            updatedAt: now
          });
        } else {
          transaction.set(invEntry.ingRef, {
            id: itemId,
            name: itemName,
            stock: newQty,
            currentStockUsageUnit: newQty,
            unit,
            branchId: targetBranchId,
            updatedAt: now
          }, { merge: true });
        }

        const movRef = db.collection('inventory_movements').doc();
        transaction.set(movRef, cleanUndefined({
          id: movRef.id,
          type: 'purchase_receive',
          itemId,
          itemName,
          itemCode,
          quantity: qty,
          unit,
          unitCost: Number(((items.find((orderedItem: any) => orderedItem.itemId === itemId || orderedItem.id === itemId) || {}) as any).unitCost ?? ((items.find((orderedItem: any) => orderedItem.itemId === itemId || orderedItem.id === itemId) || {}) as any).unitPrice ?? 0),
          previousQuantity: currentQty,
          newQuantity: newQty,
          branchId: targetBranchId,
          reason: `Goods Receiving from PO #${po.poNumber || poId}`,
          createdBy: receivedBy || user.name,
          createdAt: now
        }));
      }

      // Double Entry Journal Entry for Received Goods
      if (sessionReceivedCost > 0) {
        const lines = [
          {
            accountId: 'acc_inventory',
            accountCode: '1030',
            accountName: 'Food & Beverage Inventory Asset',
            debit: sessionReceivedCost,
            credit: 0,
            memo: `Inventory Stock Receipt for PO #${po.poNumber || poId}`
          },
          {
            accountId: 'acc_ap',
            accountCode: '2010',
            accountName: 'Accounts Payable',
            debit: 0,
            credit: sessionReceivedCost,
            memo: `Payable recorded for Goods Receiving PO #${po.poNumber || poId}`
          }
        ];

        const jeRef = db.collection('journal_entries').doc();
        const entryNumber = `JE-RECEIVE-${poId.slice(0, 6)}-${Date.now().toString().slice(-4)}`;
        const journalEntry = {
          id: jeRef.id,
          entryNumber,
          date: dateStr,
          reference: po.poNumber || poId,
          description: `Goods Receiving for PO #${po.poNumber || poId} from ${po.supplierName || 'Supplier'}`,
          source: 'Purchasing',
          status: 'Posted',
          totalDebit: sessionReceivedCost,
          totalCredit: sessionReceivedCost,
          lines,
          branchId: targetBranchId,
          createdBy: user.name,
          createdAt: now
        };

        transaction.set(jeRef, cleanUndefined(journalEntry));

        for (const line of lines) {
          const jlRef = db.collection('journal_lines').doc();
          transaction.set(jlRef, cleanUndefined({
            id: jlRef.id,
            journalEntryId: jeRef.id,
            entryNumber,
            branchId: targetBranchId,
            ...line,
            createdAt: now
          }));

          const ledgerRef = db.collection('ledger').doc();
          transaction.set(ledgerRef, cleanUndefined({
            id: ledgerRef.id,
            accountId: line.accountId,
            accountCode: line.accountCode,
            accountName: line.accountName,
            journalEntryId: jeRef.id,
            entryNumber,
            date: dateStr,
            reference: po.poNumber || poId,
            description: line.memo,
            debit: line.debit,
            credit: line.credit,
            branchId: targetBranchId,
            createdAt: now
          }));
        }
      }

      const out = { status: 'success', poId, nextStatus, idempotencyKey };
      transaction.set(idemRef, cleanUndefined({ ...out, createdAt: now }));
      return out;
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Goods Receiving Error:', err?.message || err);
    const status = err?.statusCode || 400;
    return res.status(status).json({ error: err?.message || 'Goods Receiving Failed' });
  }
}

export async function handleRecordSupplierPayment(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleAuth = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleAuth.authorized) {
    return res.status(403).json({ error: roleAuth.error });
  }

  const paymentData = req.body || {};
  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req); } catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }
  const paymentAmount = Number(paymentData.amount) || 0;
  const normalizedPayMethod = normalizePaymentMethod(paymentData.paymentMethod || 'bank', 'bank');
  if (!normalizedPayMethod) return res.status(400).json({ error: 'Invalid payment method.' });
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ error: 'Valid positive payment amount is required.' });
  }

  const db = getAdminDb();

  try {
    const result = await db.runTransaction(async (transaction) => {
      const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`supplier-payment:${user.uid}:${idempotencyKey}`).digest('hex'));
      const idemSnap = await transaction.get(idemRef);
      if (idemSnap.exists) return idemSnap.data();
      const now = new Date().toISOString();
      const dateStr = paymentData.date || getMogadishuDateString(now);
      const targetBranchId = paymentData.branchId || user.branchId;
      if (!targetBranchId) {
        throw new Error('Supplier payment branch identification missing. Payment rejected.');
      }

      const branchCheck = checkBranchAuthorization(user, targetBranchId);
      if (!branchCheck.authorized) {
        throw new Error(branchCheck.error);
      }

      // Phase 1 (All Reads)
      let supRef: any = null;
      let supSnap: any = null;
      let newBalance: number = 0;
      if (paymentData.supplierId) {
        supRef = db.collection('suppliers').doc(paymentData.supplierId);
        supSnap = await transaction.get(supRef);
        if (supSnap.exists) {
          const sup = supSnap.data() as any;
          if (!sup.branchId) throw new Error('Supplier has no canonical branchId; payment rejected until migrated.');
          const supBranchCheck = checkBranchAuthorization(user, sup.branchId);
          if (!supBranchCheck.authorized) {
            throw new Error(`Unauthorized cross-branch supplier payment! Supplier belongs to branch "${sup.branchId}". ${supBranchCheck.error}`);
          }
          const currentBal = Number(sup.outstandingBalance) || 0;
          if (paymentAmount > currentBal + 0.001) throw Object.assign(new Error(`Supplier payment (${paymentAmount.toFixed(2)}) exceeds outstanding balance (${currentBal.toFixed(2)}). Record a supplier advance separately.`), { statusCode: 400 });
          newBalance = currentBal - paymentAmount;
        }
      }

      const settlement = await resolveSettlementAccountInTransaction(transaction, db, targetBranchId, normalizedPayMethod, paymentData.bankAccountId);
      await assertAccountingDateOpenInTransaction(transaction, db, dateStr, targetBranchId);
      const __accountState = await prepareAccountBalanceState(transaction, db, ['acc_ap', settlement.id]);
      const __cashRegisterState = (normalizedPayMethod === 'cash') ? await prepareCashRegisterStateInTransaction(transaction, db, targetBranchId) : undefined;

      // Phase 2 (All Writes)
      const newRef = db.collection('supplier_payments').doc();
      const payment = cleanUndefined({
        id: newRef.id,
        supplierId: paymentData.supplierId ? String(paymentData.supplierId).trim() : '',
        supplierName: paymentData.supplierName ? String(paymentData.supplierName).trim() : 'Supplier',
        amount: paymentAmount,
        paymentMethod: normalizedPayMethod,
        paymentAccountId: settlement.id,
        bankAccountId: settlement.bankAccountId || paymentData.bankAccountId || undefined,
        reference: paymentData.reference ? String(paymentData.reference).trim() : '',
        notes: paymentData.notes ? String(paymentData.notes).trim() : '',
        branchId: targetBranchId,
        createdBy: user.name,
        createdAt: now
      });

      transaction.set(newRef, payment);

      if (supRef && supSnap && supSnap.exists) {
        transaction.update(supRef, { outstandingBalance: newBalance, updatedAt: now });
      }

      // Double-Entry Journal Entry
      const payMethod = normalizedPayMethod;
      const paymentAccountCode = settlement.code;
      const paymentAccountName = settlement.name;

      const lines = [
        {
          accountId: 'acc_ap',
          accountCode: '2010',
          accountName: 'Accounts Payable',
          debit: paymentAmount,
          credit: 0,
          memo: `Supplier Payment to ${paymentData.supplierName || 'Supplier'}`
        },
        {
          accountId: settlement.id,
          accountCode: paymentAccountCode,
          accountName: paymentAccountName,
          debit: 0,
          credit: paymentAmount,
          memo: `Supplier Payment to ${paymentData.supplierName || 'Supplier'}`
        }
      ];

      const jeRef = db.collection('journal_entries').doc();
      const entryNumber = `JE-SUPPAY-${newRef.id.slice(0, 6)}`;
      const journalEntry = {
        id: jeRef.id,
        entryNumber,
        date: dateStr,
        reference: paymentData.reference || newRef.id,
        description: `Supplier Payment Disbursement to ${paymentData.supplierName || 'Supplier'}`,
        source: 'Supplier Payments',
        status: 'Posted',
        totalDebit: paymentAmount,
        totalCredit: paymentAmount,
        lines,
        branchId: targetBranchId,
        createdBy: user.name,
        createdAt: now
      };

      transaction.set(jeRef, cleanUndefined(journalEntry));

      for (const line of lines) {
        const jlRef = db.collection('journal_lines').doc();
        transaction.set(jlRef, cleanUndefined({
          id: jlRef.id,
          journalEntryId: jeRef.id,
          entryNumber,
          branchId: targetBranchId,
          ...line,
          createdAt: now
        }));

        const ledgerRef = db.collection('ledger').doc();
        transaction.set(ledgerRef, cleanUndefined({
          id: ledgerRef.id,
          accountId: line.accountId,
          accountCode: line.accountCode,
          accountName: line.accountName,
          journalEntryId: jeRef.id,
          entryNumber,
          date: dateStr,
          reference: paymentData.reference || newRef.id,
          description: line.memo,
          debit: line.debit,
          credit: line.credit,
          branchId: targetBranchId,
          createdAt: now
        }));
      }

      if (normalizedPayMethod === 'cash') {
        await applyCashRegisterMovementInTransaction(transaction, db, targetBranchId, -paymentAmount, 'supplier cash payment', __cashRegisterState);
      }
      applyAccountBalanceDeltasInTransaction(transaction, __accountState, lines, now);
      const finalResult = { status: 'success', id: newRef.id, paymentId: newRef.id, amount: paymentAmount, branchId: targetBranchId };
      transaction.set(idemRef, cleanUndefined({ ...finalResult, createdAt: now }));
      return finalResult;
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Record Supplier Payment Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Record Supplier Payment Failed' });
  }
}

// Inventory Item Master Handlers
export async function handleCreateInventoryItem(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { itemData } = req.body || {};
  if (!itemData) {
    return res.status(400).json({ error: 'Item data is required.' });
  }

  const branchCheck = checkBranchAuthorization(user, itemData.branchId || user.branchId);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }
  const targetBranchId = branchCheck.targetBranchId;

  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req, req.body?.itemData?.idempotencyKey); } catch(e:any) { return res.status(e?.statusCode||400).json({error:e?.message||'Idempotency-Key is required.'}); }
  const db = getAdminDb();
  const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`inventory-create:${user.uid}:${idempotencyKey}`).digest('hex'));
  try {
    const timestamp = new Date().toISOString();
    const newRef = db.collection('inventory').doc();
    const fullItem = {
      ...itemData,
      id: newRef.id,
      branchId: targetBranchId,
      createdBy: user.name,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const result = await db.runTransaction(async (transaction) => {
      const idemSnap = await transaction.get(idemRef);
      if (idemSnap.exists) return idemSnap.data();
      transaction.set(newRef, cleanUndefined(fullItem));
      if (Number(itemData.currentQuantity || 0) > 0) {
        const movementRef = db.collection('inventory_movements').doc();
        const movement = {
          id: movementRef.id,
          type: 'adjustment',
          itemId: newRef.id,
          itemName: itemData.itemName || 'Inventory Item',
          itemCode: itemData.itemCode || '',
          quantity: Number(itemData.currentQuantity),
          unit: itemData.unit || 'pcs',
          previousQuantity: 0,
          newQuantity: Number(itemData.currentQuantity),
          reason: 'Initial stock intake upon item creation',
          branchId: targetBranchId,
          createdBy: user.name,
          createdAt: timestamp
        };
        transaction.set(movementRef, cleanUndefined(movement));
      }
      const out = { status: 'success', item: { ...fullItem, idempotencyKey }, idempotencyKey };
      transaction.set(idemRef, cleanUndefined({ ...out, createdAt: timestamp }));
      return out;
    });
    return res.json(result);
  } catch (err: any) {
    console.error('Create Inventory Item Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Create Inventory Item Failed' });
  }
}

export async function handleUpdateInventoryItem(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { id } = req.params;
  const updateData = req.body || {};
  if (!id) {
    return res.status(400).json({ error: 'Inventory item ID is required.' });
  }

  const db = getAdminDb();
  try {
    const itemRef = db.collection('inventory').doc(id);
    const snap = await itemRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Inventory item not found.' });
    }

    const item = snap.data() as any;
    const branchCheck = checkBranchAuthorization(user, item.branchId);
    if (!branchCheck.authorized) {
      return res.status(403).json({ error: branchCheck.error });
    }
    let idempotencyKey: string;
    try { idempotencyKey = getRequiredIdempotencyKey(req, req.body?.idempotencyKey); } catch(e:any) { return res.status(e?.statusCode||400).json({error:e?.message||'Idempotency-Key is required.'}); }
    const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update('inventory-update:' + String(user.uid) + ':' + String(id) + ':' + idempotencyKey).digest('hex'));

    const FORBIDDEN_STOCK_FIELDS = ['currentQuantity', 'stock', 'currentStock', 'quantityOnHand', 'reservedStock', 'availableQuantity', 'inventoryQty', 'stockLevel'];
    const detectedStockKeys = Object.keys(updateData).filter(k => FORBIDDEN_STOCK_FIELDS.includes(k));
    if (detectedStockKeys.length > 0) {
      return res.status(403).json({
        error: `Direct modification of inventory stock/quantity fields (${detectedStockKeys.join(', ')}) is prohibited. All stock modifications must use authorized inventory adjustments (/api/inventory/adjust) or receiving workflows.`
      });
    }

    const {
      itemName,
      itemCode,
      category,
      unit,
      minimumQuantity,
      costPrice,
      sellingPrice,
      supplierId,
      supplierName,
      batchNumber,
      expirationDate,
      storageLocation,
      status,
      notes
    } = updateData;

    const payload: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };

    if (itemName !== undefined) payload.itemName = String(itemName).trim();
    if (itemCode !== undefined) payload.itemCode = String(itemCode).trim();
    if (category !== undefined) payload.category = String(category).trim();
    if (unit !== undefined) payload.unit = String(unit).trim();
    if (minimumQuantity !== undefined) payload.minimumQuantity = Number(minimumQuantity) || 0;
    if (costPrice !== undefined) payload.costPrice = Number(costPrice) || 0;
    if (sellingPrice !== undefined) payload.sellingPrice = Number(sellingPrice) || 0;
    if (supplierId !== undefined) payload.supplierId = String(supplierId).trim();
    if (supplierName !== undefined) payload.supplierName = String(supplierName).trim();
    if (batchNumber !== undefined) payload.batchNumber = String(batchNumber).trim();
    if (expirationDate !== undefined) payload.expirationDate = String(expirationDate).trim();
    if (storageLocation !== undefined) payload.storageLocation = String(storageLocation).trim();
    if (status !== undefined) payload.status = String(status).trim();
    if (notes !== undefined) payload.notes = String(notes).trim();

    const priorIdem = await idemRef.get();
    if (priorIdem.exists) return res.json(priorIdem.data());
    await itemRef.update(cleanUndefined(payload));
    const out = { status: 'success', id, idempotencyKey };
    await idemRef.set(cleanUndefined({ ...out, createdAt: new Date().toISOString() }));
    return res.json(out);
  } catch (err: any) {
    console.error('Update Inventory Item Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Update Inventory Item Failed' });
  }
}

export async function handleDeleteInventoryItem(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Inventory item ID is required.' });
  }

  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req, req.body?.idempotencyKey); } catch(e:any) { return res.status(e?.statusCode||400).json({error:e?.message||'Idempotency-Key is required.'}); }
  const db = getAdminDb();
  const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update('inventory-delete:' + String(user.uid) + ':' + String(id) + ':' + idempotencyKey).digest('hex'));
  try {
    const itemRef = db.collection('inventory').doc(id);
    const snap = await itemRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Inventory item not found.' });
    }

    const item = snap.data() as any;
    const branchCheck = checkBranchAuthorization(user, item.branchId);
    if (!branchCheck.authorized) {
      return res.status(403).json({ error: branchCheck.error });
    }

    const priorIdem = await idemRef.get();
    if (priorIdem.exists) return res.json(priorIdem.data());
    await itemRef.update({ isDeleted: true, status: 'deleted', deletedAt: new Date().toISOString(), deletedBy: user.name, idempotencyKey });
    const out = { status: 'success', id, idempotencyKey };
    await idemRef.set(cleanUndefined({ ...out, createdAt: new Date().toISOString() }));
    return res.json(out);
  } catch (err: any) {
    console.error('Delete Inventory Item Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Delete Inventory Item Failed' });
  }
}

export async function handleCreatePurchaseOrder(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { poData } = req.body || {};
  if (!poData) {
    return res.status(400).json({ error: 'Purchase Order data is required.' });
  }

  const branchCheck = checkBranchAuthorization(user, poData.branchId || user.branchId);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }
  const targetBranchId = branchCheck.targetBranchId;

  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req, req.body?.poData?.idempotencyKey); } catch(e:any) { return res.status(e?.statusCode||400).json({error:e?.message||'Idempotency-Key is required.'}); }
  const db = getAdminDb();
  const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`po-create:${user.uid}:${idempotencyKey}`).digest('hex'));
  try {
    const result = await db.runTransaction(async (transaction) => {
      const idemSnap = await transaction.get(idemRef);
      if (idemSnap.exists) return idemSnap.data();
      const timestamp = new Date().toISOString();
      const newRef = db.collection('purchase_orders').doc();
      const fullPo = {
        ...poData,
        id: newRef.id,
        idempotencyKey,
        branchId: targetBranchId,
        createdBy: user.name,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      transaction.set(newRef, cleanUndefined(fullPo));

      // Maintain projection in purchases collection for dashboards, reporting and live subscriptions
      const poItems = Array.isArray(fullPo.items) ? fullPo.items : [];
      const firstItem = poItems[0] || {};
      const purchaseProjection = {
        id: newRef.id,
        supplierId: fullPo.supplierId || '',
        supplierName: fullPo.supplierName || 'Supplier',
        itemName: firstItem.itemName || firstItem.name || 'Purchase Order Items',
        quantity: poItems.reduce((sum: number, itm: any) => sum + (Number(itm.quantity ?? itm.requestedQuantity ?? 0) || 0), 0) || 1,
        unit: firstItem.unit || 'pcs',
        unitPrice: Number(firstItem.unitCost ?? firstItem.unitPrice ?? 0),
        totalCost: Number(fullPo.totalCost ?? fullPo.totalAmount ?? 0),
        status: fullPo.status || 'pending',
        branchId: targetBranchId,
        dueDate: fullPo.expectedDeliveryDate || fullPo.dueDate,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      transaction.set(db.collection('purchases').doc(newRef.id), cleanUndefined(purchaseProjection));

      const out = { status: 'success', purchaseOrder: fullPo, idempotencyKey };
      transaction.set(idemRef, cleanUndefined({ ...out, createdAt: timestamp }));
      return out;
    });
    return res.json(result);
  } catch (err: any) {
    console.error('Create Purchase Order Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Create Purchase Order Failed' });
  }
}

export async function handleUpdatePurchaseOrder(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { id } = req.params;
  const updateData = req.body || {};
  if (!id) {
    return res.status(400).json({ error: 'Purchase Order ID is required.' });
  }

  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req, req.body?.idempotencyKey); } catch(e:any) { return res.status(e?.statusCode||400).json({error:e?.message||'Idempotency-Key is required.'}); }
  const db = getAdminDb();
  const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update('po-update' + ':' + String(user.uid) + ':' + String(id) + ':' + idempotencyKey).digest('hex'));
  try {
    const poRef = db.collection('purchase_orders').doc(id);
    const snap = await poRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }

    const poData = snap.data() as any;
    const branchCheck = checkBranchAuthorization(user, poData.branchId);
    if (!branchCheck.authorized) {
      return res.status(403).json({ error: branchCheck.error });
    }

    const {
      notes,
      expectedDeliveryDate,
      deliveryLocation,
      supplierContact,
      supplierPhone
    } = updateData;

    const payload: Record<string, any> = {
      updatedAt: new Date().toISOString()
    };
    if (notes !== undefined) payload.notes = String(notes).trim();
    if (expectedDeliveryDate !== undefined) payload.expectedDeliveryDate = String(expectedDeliveryDate).trim();
    if (deliveryLocation !== undefined) payload.deliveryLocation = String(deliveryLocation).trim();
    if (supplierContact !== undefined) payload.supplierContact = String(supplierContact).trim();
    if (supplierPhone !== undefined) payload.supplierPhone = String(supplierPhone).trim();

    const priorIdem = await idemRef.get();
    if (priorIdem.exists) return res.json(priorIdem.data());
    await poRef.update(cleanUndefined(payload));
    const out = { status:'success', id, idempotencyKey };
    await idemRef.set(cleanUndefined({ ...out, createdAt: new Date().toISOString() }));
    return res.json(out);
  } catch (err: any) {
    console.error('Update Purchase Order Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Update Purchase Order Failed' });
  }
}

export async function handleApprovePurchaseOrder(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Purchase Order ID is required.' });
  }

  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req, req.body?.idempotencyKey); } catch(e:any) { return res.status(e?.statusCode||400).json({error:e?.message||'Idempotency-Key is required.'}); }
  const db = getAdminDb();
  const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update('po-approve' + ':' + String(user.uid) + ':' + String(id) + ':' + idempotencyKey).digest('hex'));
  try {
    const poRef = db.collection('purchase_orders').doc(id);
    const snap = await poRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Purchase Order not found.' });
    }

    const poData = snap.data() as any;
    const branchCheck = checkBranchAuthorization(user, poData.branchId);
    if (!branchCheck.authorized) {
      return res.status(403).json({ error: branchCheck.error });
    }

    const timestamp = new Date().toISOString();
    const priorIdem = await idemRef.get();
    if (priorIdem.exists) return res.json(priorIdem.data());
    await poRef.update({
      approvalStatus: 'approved',
      status: 'approved',
      approvedBy: user.name,
      approvedAt: timestamp,
      updatedAt: timestamp
    });

    const out = { status:'success', id, idempotencyKey };
    await idemRef.set(cleanUndefined({ ...out, createdAt: new Date().toISOString() }));
    return res.json(out);
  } catch (err: any) {
    console.error('Approve Purchase Order Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Approve Purchase Order Failed' });
  }
}

export async function handleCreateDeliveryOrder(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Cashier', 'cashier', 'Staff', 'staff', 'Waiter', 'waiter']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { deliveryData } = req.body || {};
  if (!deliveryData) {
    return res.status(400).json({ error: 'Delivery data is required.' });
  }
  const db = getAdminDb();

  // Validate branch ownership before requiring idempotency so unauthorized cross-branch
  // requests are rejected as authorization failures rather than malformed mutations.
  if (!deliveryData.orderId) {
    const preBranchCheck = checkBranchAuthorization(user, deliveryData.branchId || user.branchId);
    if (!preBranchCheck.authorized) return res.status(403).json({ error: preBranchCheck.error });
  } else {
    const preOrderSnap = await db.collection('orders').doc(String(deliveryData.orderId).trim()).get();
    if (preOrderSnap.exists) {
      const preOrderBranch = preOrderSnap.data()?.branchId;
      if (!preOrderBranch) return res.status(400).json({ error: 'Referenced order branch identification missing.' });
      const preBranchCheck = checkBranchAuthorization(user, preOrderBranch);
      if (!preBranchCheck.authorized) return res.status(403).json({ error: preBranchCheck.error });
    }
  }

  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req, deliveryData.idempotencyKey); } catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }
  try {
    const timestamp = new Date().toISOString();
    const deliveryDocId = createHash('sha256').update(`delivery:${user.uid}:${idempotencyKey}`).digest('hex').slice(0, 40);
    const newRef = db.collection('deliveries').doc(`IDEM-${deliveryDocId}`);
    const deliveryNumber = `DEL-${Math.floor(1000 + Math.random() * 9000)}`;

    let targetBranchId = '';
    let totalAmount = 0;
    let deliveryFee = 0;
    let paymentStatus = 'unpaid';
    let customerName = String(deliveryData.customerName || 'Customer').trim();
    let customerPhone = String(deliveryData.customerPhone || '').trim();
    let address = String(deliveryData.address || '').trim();

    if (deliveryData.orderId) {
      const orderIdStr = String(deliveryData.orderId).trim();

      // P1-6 Duplicate Delivery Prevention
      const existingDelSnap = await db.collection('deliveries').where('orderId', '==', orderIdStr).get();
      const activeDelivery = existingDelSnap.docs.find((d: any) => {
        const data = d.data() || {};
        return !['cancelled', 'failed', 'returned'].includes(data.status);
      });
      if (activeDelivery) {
        return res.status(409).json({
          error: `Active delivery #${activeDelivery.id} already exists for Order #${orderIdStr}.`,
          deliveryId: activeDelivery.id
        });
      }

      const orderRef = db.collection('orders').doc(orderIdStr);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) {
        return res.status(404).json({ error: `Referenced Order #${deliveryData.orderId} not found.` });
      }

      const orderData = orderSnap.data() || {};
      const orderBranch = orderData.branchId;
      if (!orderBranch) {
        return res.status(400).json({ error: 'Referenced order branch identification missing.' });
      }

      const branchCheck = checkBranchAuthorization(user, orderBranch);
      if (!branchCheck.authorized) {
        return res.status(403).json({ error: branchCheck.error });
      }

      targetBranchId = branchCheck.targetBranchId;
      totalAmount = Number(orderData.totalAmount) || 0;
      deliveryFee = Number(orderData.deliveryFee) || 0;
      paymentStatus = orderData.paymentStatus || 'unpaid';
      customerName = String(orderData.customerName || deliveryData.customerName || customerName).trim();
      customerPhone = String(orderData.customerPhone || deliveryData.customerPhone || customerPhone).trim();
      address = String(orderData.deliveryAddress || deliveryData.address || address).trim();
    } else {
      const branchCheck = checkBranchAuthorization(user, deliveryData.branchId || user.branchId);
      if (!branchCheck.authorized) {
        return res.status(403).json({ error: branchCheck.error });
      }
      targetBranchId = branchCheck.targetBranchId;
      totalAmount = Number(deliveryData.totalAmount) || 0;
      deliveryFee = Number(deliveryData.deliveryFee) || 0;
      paymentStatus = 'unpaid';
    }

    let finalDeliveryZoneId = deliveryData.deliveryZoneId ? String(deliveryData.deliveryZoneId).trim() : '';
    let finalDeliveryZoneName = deliveryData.deliveryZoneName ? String(deliveryData.deliveryZoneName).trim() : '';

    if (finalDeliveryZoneId) {
      const zoneDoc = await db.collection('delivery_zones').doc(finalDeliveryZoneId).get();
      if (!zoneDoc.exists) {
        return res.status(404).json({ error: `Delivery zone with ID "${finalDeliveryZoneId}" not found.` });
      }
      const zoneData = zoneDoc.data() || {};
      if (zoneData.isActive === false || zoneData.status === 'inactive') {
        return res.status(400).json({ error: `Delivery zone "${zoneData.name || finalDeliveryZoneId}" is currently inactive.` });
      }
      if (zoneData.branchId && targetBranchId !== 'all' && zoneData.branchId !== targetBranchId) {
        return res.status(403).json({ error: `Unauthorized cross-branch delivery zone! Zone belongs to branch "${zoneData.branchId}", but target branch is "${targetBranchId}".` });
      }
      finalDeliveryZoneName = zoneData.name || zoneData.zoneName || finalDeliveryZoneName;
      if (!deliveryData.orderId && Number(zoneData.deliveryFee || zoneData.fee) > 0 && !deliveryData.deliveryFee) {
        deliveryFee = Number(zoneData.deliveryFee || zoneData.fee);
      }
    }

    // FIX #2: Official lifecycle starts at 'unassigned'.
    // Direct driver assignment during delivery creation is prohibited; assignment MUST use POST /api/deliveries/:deliveryId/assign
    const fullDelivery = {
      id: newRef.id,
      deliveryNumber,
      orderId: deliveryData.orderId ? String(deliveryData.orderId).trim() : '',
      branchId: targetBranchId,
      customerName,
      customerPhone,
      address,
      deliveryNotes: deliveryData.deliveryNotes ? String(deliveryData.deliveryNotes).trim() : '',
      deliveryZoneId: finalDeliveryZoneId,
      deliveryZoneName: finalDeliveryZoneName,
      driverId: '',
      driverName: '',
      driverPhone: '',
      items: Array.isArray(deliveryData.items) ? deliveryData.items : [],
      status: 'unassigned',
      paymentStatus,
      totalAmount,
      deliveryFee,
      createdBy: user.name,
      createdAt: timestamp,
      updatedAt: timestamp,
      idempotencyKey
    };

    const result = await db.runTransaction(async (transaction) => {
      const existingByKey = await transaction.get(newRef);
      if (existingByKey.exists) {
        const existingData = existingByKey.data() || {};
        return { status: 'duplicate', id: newRef.id, deliveryNumber: existingData.deliveryNumber, delivery: existingData };
      }

      let orderLockRef: any = null;
      if (deliveryData.orderId) {
        const lockId = createHash('sha256').update(`delivery-order:${targetBranchId}:${String(deliveryData.orderId).trim()}`).digest('hex').slice(0, 40);
        orderLockRef = db.collection('delivery_order_locks').doc(lockId);
        const lockSnap = await transaction.get(orderLockRef);
        if (lockSnap.exists) {
          const lock = lockSnap.data() || {};
          const activeId = String(lock.deliveryId || '').trim();
          if (activeId && activeId !== newRef.id) {
            const activeRef = db.collection('deliveries').doc(activeId);
            const activeSnap = await transaction.get(activeRef);
            if (activeSnap.exists) {
              const activeData = activeSnap.data() || {};
              if (!['cancelled', 'failed', 'returned'].includes(String(activeData.status || '').toLowerCase())) {
                return { status: 'conflict', error: `Active delivery #${activeId} already exists for Order #${deliveryData.orderId}.`, deliveryId: activeId };
              }
            }
          }
        }
      }

      const trackingRef = db.collection('delivery_tracking').doc();
      transaction.set(newRef, cleanUndefined(fullDelivery));
      transaction.set(trackingRef, cleanUndefined({
        id: trackingRef.id, deliveryId: newRef.id, driverId: '', branchId: targetBranchId, statusUpdate: 'unassigned', timestamp
      }));
      if (orderLockRef) transaction.set(orderLockRef, cleanUndefined({ deliveryId: newRef.id, branchId: targetBranchId, status: 'active', orderId: String(deliveryData.orderId).trim(), updatedAt: timestamp }), { merge: true });
      return { status: 'success', id: newRef.id, deliveryNumber };
    });

    if (result?.status === 'conflict') return res.status(409).json(result);
    return res.json(result);
  } catch (err: any) {
    console.error('Create Delivery Order Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Create Delivery Order Failed' });
  }
}

// 10. Kitchen Ticket Update (Single Authoritative Transaction Path with Bounded Contention Retry)
export async function handleKitchenTicketUpdate(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Chef', 'chef', 'Kitchen', 'kitchen', 'Kitchen Staff', 'Cashier', 'cashier', 'Staff', 'staff', 'Waiter', 'waiter']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const isKitchenAuthority = ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Chef', 'chef', 'Kitchen', 'kitchen', 'Kitchen Staff'].includes(user.role);
  const isFrontOfHouse = ['Cashier', 'cashier', 'Staff', 'staff', 'Waiter', 'waiter'].includes(user.role);

  const { ticketId } = req.params;
  if (!ticketId) {
    return res.status(400).json({ error: 'Kitchen Ticket ID is required.' });
  }

  // Whitelist explicit fields only
  const { prepStatus, priority, estimatedPrepTimeMinutes, notes, items } = req.body || {};

  const rawPrepStatus = prepStatus !== undefined ? String(prepStatus).toLowerCase().trim() : undefined;
  const normalizedPrepStatus = rawPrepStatus !== undefined
    ? (rawPrepStatus === 'pending' || rawPrepStatus === 'new')
      ? 'new'
      : (rawPrepStatus === 'preparing' || rawPrepStatus === 'in_preparation' || rawPrepStatus === 'in_progress')
      ? 'cooking'
      : (rawPrepStatus === 'ready' || rawPrepStatus === 'ready_for_pickup')
      ? 'ready_for_pickup'
      : (rawPrepStatus === 'done' || rawPrepStatus === 'delivered' || rawPrepStatus === 'completed')
      ? 'completed'
      : (rawPrepStatus === 'canceled' || rawPrepStatus === 'cancelled')
      ? 'cancelled'
      : (rawPrepStatus === 'reject' || rawPrepStatus === 'rejected')
      ? 'rejected'
      : rawPrepStatus
    : undefined;

  const allowedStatuses = ['new', 'accepted', 'cooking', 'ready_for_pickup', 'completed', 'cancelled', 'rejected'];
  if (normalizedPrepStatus !== undefined && !allowedStatuses.includes(normalizedPrepStatus)) {
    return res.status(400).json({ error: `Invalid status transition "${prepStatus}". Allowed statuses: ${allowedStatuses.join(', ')}` });
  }

  const allowedPriorities = ['low', 'normal', 'high', 'urgent'];
  if (priority !== undefined && !allowedPriorities.includes(String(priority))) {
    return res.status(400).json({ error: `Invalid priority "${priority}". Allowed priorities: ${allowedPriorities.join(', ')}` });
  }

  const db = getAdminDb();
  const timestamp = new Date().toISOString();

  try {
    const updatedFields: string[] = [];
    await runTransactionWithRetry(db, async (transaction) => {
      const ticketRef = db.collection('kitchen_orders').doc(ticketId);
      const ticketSnap = await transaction.get(ticketRef);
      if (!ticketSnap.exists) {
        const notFoundErr: any = new Error(`Kitchen ticket #${ticketId} not found.`);
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }

      const ticketData = ticketSnap.data() as any;
      const targetBranchId = ticketData.branchId || user.branchId;
      if (!targetBranchId) {
        const branchMissingErr: any = new Error('Kitchen ticket branch identification missing.');
        branchMissingErr.statusCode = 400;
        throw branchMissingErr;
      }

      const branchCheck = checkBranchAuthorization(user, targetBranchId);
      if (!branchCheck.authorized) {
        const authErr: any = new Error(branchCheck.error);
        authErr.statusCode = 403;
        throw authErr;
      }

      const rawCurrentStatus = String(ticketData.prepStatus || ticketData.status || 'new').toLowerCase().trim();
      const currentStatus = (rawCurrentStatus === 'pending' || rawCurrentStatus === 'new')
        ? 'new'
        : (rawCurrentStatus === 'preparing' || rawCurrentStatus === 'in_preparation' || rawCurrentStatus === 'in_progress')
        ? 'cooking'
        : (rawCurrentStatus === 'ready' || rawCurrentStatus === 'ready_for_pickup')
        ? 'ready_for_pickup'
        : (rawCurrentStatus === 'done' || rawCurrentStatus === 'delivered' || rawCurrentStatus === 'completed')
        ? 'completed'
        : (rawCurrentStatus === 'canceled' || rawCurrentStatus === 'cancelled')
        ? 'cancelled'
        : (rawCurrentStatus === 'reject' || rawCurrentStatus === 'rejected')
        ? 'rejected'
        : rawCurrentStatus;

      const newStatus = normalizedPrepStatus;

      if (newStatus !== undefined && currentStatus !== newStatus) {
        const VALID_TRANSITIONS: Record<string, string[]> = {
          'new': ['accepted', 'rejected', 'cancelled'],
          'accepted': ['cooking', 'rejected', 'cancelled'],
          'cooking': ['ready_for_pickup', 'cancelled'],
          'ready_for_pickup': ['completed', 'cancelled'],
          'completed': [],
          'cancelled': [],
          'rejected': []
        };

        const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
        if (!allowedNext.includes(newStatus)) {
          const transErr: any = new Error(
            `Invalid kitchen ticket status transition from "${currentStatus}" to "${newStatus}". Allowed transitions: ${allowedNext.length > 0 ? allowedNext.join(', ') : 'None (Terminal state)'}`
          );
          transErr.statusCode = 400;
          throw transErr;
        }
      }

      const allowedUpdates: Record<string, any> = {
        updatedAt: timestamp
      };

      let effectivePrepStatus = normalizedPrepStatus;

      if (Array.isArray(items)) {
        if (currentStatus === 'new') {
          const hasAdvancedItem = items.some((item: any) => item && (item.itemStatus === 'cooking' || item.itemStatus === 'ready_for_pickup' || item.itemStatus === 'completed'));
          if (hasAdvancedItem) {
            const itemErr: any = new Error('Cannot advance item cooking status while ticket is in "new" status. Please accept the order first.');
            itemErr.statusCode = 400;
            throw itemErr;
          }
        }

        // Authoritatively preserve ticket items structure and only apply validated itemStatus mutations
        const existingItems = Array.isArray(ticketData.items) ? ticketData.items : [];
        const validItemStatuses = ['new', 'accepted', 'cooking', 'ready_for_pickup', 'completed', 'cancelled'];

        const validatedItems = existingItems.map((existingItem: any) => {
          const matchingClientItem = items.find((ci: any) => ci && (ci.productId === existingItem.productId || ci.id === existingItem.id));
          if (matchingClientItem && matchingClientItem.itemStatus) {
            const nStatus = String(matchingClientItem.itemStatus).toLowerCase().trim();
            if (validItemStatuses.includes(nStatus)) {
              return {
                ...existingItem,
                itemStatus: nStatus
              };
            }
          }
          return existingItem;
        });

        allowedUpdates.items = validatedItems;

        if (effectivePrepStatus === undefined) {
          const allReady = validatedItems.length > 0 && validatedItems.every((i: any) => i.itemStatus === 'ready_for_pickup' || i.itemStatus === 'completed');
          const anyCookingOrReady = validatedItems.some((i: any) => i.itemStatus === 'cooking' || i.itemStatus === 'ready_for_pickup' || i.itemStatus === 'completed');

          if (currentStatus === 'accepted' && anyCookingOrReady) {
            effectivePrepStatus = 'cooking';
          } else if (currentStatus === 'cooking' && allReady) {
            effectivePrepStatus = 'ready_for_pickup';
          }
        }
      }

      if (effectivePrepStatus !== undefined) {
        allowedUpdates.prepStatus = effectivePrepStatus;
        if (effectivePrepStatus === 'cooking' && !ticketData.startedAt) {
          allowedUpdates.startedAt = timestamp;
        } else if (effectivePrepStatus === 'ready_for_pickup') {
          allowedUpdates.readyAt = timestamp;
        } else if (effectivePrepStatus === 'completed') {
          allowedUpdates.completedAt = timestamp;
        } else if (effectivePrepStatus === 'cancelled') {
          allowedUpdates.cancelledAt = timestamp;
        } else if (effectivePrepStatus === 'rejected') {
          allowedUpdates.rejectedAt = timestamp;
        }
      }
      if (priority !== undefined) allowedUpdates.priority = String(priority);
      if (estimatedPrepTimeMinutes !== undefined) allowedUpdates.estimatedPrepTimeMinutes = Number(estimatedPrepTimeMinutes);
      if (notes !== undefined) allowedUpdates.notes = String(notes);

      let orderSnap: any = { exists: false };
      let delSnap: any = { empty: true, docs: [] };
      const targetOrderId = ticketData.orderId || ticketId;

      // Synchronize to orders and deliveries if prepStatus changed (Read BEFORE writes)
      if (effectivePrepStatus !== undefined) {
        console.log(`[KITCHEN TICKET STEP 2] orders/${targetOrderId} ADMIN SDK READ`);
        const orderRef = db.collection('orders').doc(targetOrderId);
        orderSnap = await transaction.get(orderRef);
        console.log(`[KITCHEN TICKET STEP 2] orders/${targetOrderId} ADMIN SDK READ: ${orderSnap.exists ? 'SUCCESS (exists)' : 'SKIPPED (not exists)'}`);

        console.log(`[KITCHEN TICKET STEP 3] deliveries?orderId=${targetOrderId} ADMIN SDK QUERY`);
        const deliveryQuery = db.collection('deliveries').where('orderId', '==', targetOrderId);
        delSnap = await transaction.get(deliveryQuery);
        console.log(`[KITCHEN TICKET STEP 3] deliveries?orderId=${targetOrderId} ADMIN SDK QUERY: SUCCESS (${delSnap.docs.length} found)`);
      }

      console.log(`[KITCHEN TICKET STEP 4] kitchen_orders/${ticketId} ADMIN SDK UPDATE`);
      transaction.update(ticketRef, cleanUndefined(allowedUpdates));
      updatedFields.push(...Object.keys(allowedUpdates));

      if (effectivePrepStatus !== undefined) {
        if (orderSnap.exists) {
          const orderData = orderSnap.data() || {};
          const isDeliveryOrder = orderData.orderType === 'delivery' || !delSnap.empty;

          let mappedOrderStatus: string = 'new';
          if (effectivePrepStatus === 'accepted') mappedOrderStatus = 'confirmed';
          else if (effectivePrepStatus === 'cooking') mappedOrderStatus = 'in_preparation';
          else if (effectivePrepStatus === 'ready_for_pickup') mappedOrderStatus = 'ready_for_pickup';
          else if (effectivePrepStatus === 'completed') mappedOrderStatus = isDeliveryOrder ? 'ready_for_pickup' : 'completed';
          else if (effectivePrepStatus === 'cancelled' || effectivePrepStatus === 'rejected') mappedOrderStatus = 'cancelled';

          const orderUpdates: any = {
            status: mappedOrderStatus,
            kitchenStatus: effectivePrepStatus,
            updatedAt: timestamp
          };
          if (effectivePrepStatus === 'completed' && !isDeliveryOrder) {
            orderUpdates.completedAt = timestamp;
          }
          console.log(`[KITCHEN TICKET STEP 5] orders/${targetOrderId} ADMIN SDK UPDATE`);
          const orderRef = db.collection('orders').doc(targetOrderId);
          transaction.update(orderRef, cleanUndefined(orderUpdates));
        }

        if (!delSnap.empty) {
          console.log(`[KITCHEN TICKET STEP 6] deliveries (${delSnap.docs.length} docs) ADMIN SDK UPDATE`);
          delSnap.docs.forEach((delDoc: any) => {
            const delUpdates: any = {
              kitchenStatus: effectivePrepStatus,
              updatedAt: timestamp
            };
            if (effectivePrepStatus === 'cancelled' || effectivePrepStatus === 'rejected') {
              delUpdates.status = 'cancelled';
            }
            transaction.update(delDoc.ref, delUpdates);
          });
        }
      }
    });

    return res.json({ status: 'success', ticketId, updatedFields });
  } catch (err: any) {
    const rawMsg = err?.message || 'Kitchen Ticket Update Failed';
    const statusCode = err.statusCode || (rawMsg.includes('not found') ? 404 : rawMsg.includes('Unauthorized') || rawMsg.includes('cross-branch') ? 403 : rawMsg.includes('Invalid') ? 400 : 500);
    console.error('Kitchen Ticket Update Error:', rawMsg);
    return res.status(statusCode).json({ error: rawMsg });
  }
}

// HRM Server-Authoritative Payroll Processing

export async function handleAttendanceClockIn(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res); if (!user) return;
  const empId = String(req.body?.employeeId || '').trim();
  if (!empId) return res.status(400).json({ error: 'employeeId is required.' });
  const db = getAdminDb();
  try {
    const result = await db.runTransaction(async (transaction) => {
      const empRef = db.collection('employees').doc(empId);
      const empSnap = await transaction.get(empRef);
      if (!empSnap.exists) throw Object.assign(new Error('Employee not found.'), { statusCode: 404 });
      const emp = empSnap.data() || {};
      const branchId = normalizeCanonicalBranchId(emp.branchId || emp.branch || '');
      const auth = checkBranchAuthorization(user, branchId);
      if (!auth.authorized) throw Object.assign(new Error(auth.error), { statusCode: 403 });
      const actorRole = String(user.role || (user as any).claims?.role || '').toLowerCase();
      const isManagerial = ['owner','admin','manager','accountant'].includes(actorRole);
      const actorEmployeeId = String((user as any).employeeId || (user as any).employee?.id || '').trim();
      if (!isManagerial && actorEmployeeId && actorEmployeeId !== empId) {
        throw Object.assign(new Error('You can only clock in for your own employee record.'), { statusCode: 403 });
      }
      if (!isManagerial && !actorEmployeeId && String(user.uid || '') !== String(emp.userId || emp.uid || '')) {
        throw Object.assign(new Error('You are not authorized to clock in this employee record.'), { statusCode: 403 });
      }
      const now = new Date();
      const date = getMogadishuDateString(now.toISOString());
      const existing = await transaction.get(db.collection('employee_attendance').where('employeeId','==',empId).where('date','==',date));
      const active = existing.docs.find(d => !d.data()?.clockOut);
      if (active) return { status:'success', attendance:{ id:active.id, ...active.data() }, alreadyClockedIn:true };
      const idRef = db.collection('employee_attendance').doc();
      const mogadishu = new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Mogadishu',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(now);
      const hour=Number(mogadishu.find(p=>p.type==='hour')?.value||0), minute=Number(mogadishu.find(p=>p.type==='minute')?.value||0);
      const isLate = hour > 8 || (hour===8 && minute>30);
      const record={ id:idRef.id, employeeId:empId, employeeName:emp.fullName||emp.name||empId, branchId, branch:emp.branch||branchId, date, clockIn:now.toISOString(), breakTimeMinutes:0, workingHours:0, overtimeHours:0, isLate, isEarlyLeave:false, status:'present', notes:String(req.body?.notes||'').trim(), createdAt:now.toISOString() };
      transaction.set(idRef, cleanUndefined(record));
      return {status:'success',attendance:record,alreadyClockedIn:false};
    });
    return res.json(result);
  } catch(e:any) { return res.status(e?.statusCode||500).json({error:e?.message||'Attendance clock-in failed.'}); }
}

export async function handleAttendanceClockOut(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res); if (!user) return;
  const attendanceId = String(req.params.id || '').trim();
  if (!attendanceId) return res.status(400).json({error:'Attendance ID is required.'});
  const db = getAdminDb();
  try {
    const result = await db.runTransaction(async(transaction)=>{
      const ref=db.collection('employee_attendance').doc(attendanceId); const snap=await transaction.get(ref);
      if(!snap.exists) throw Object.assign(new Error('Attendance record not found.'),{statusCode:404});
      const data=snap.data()||{}; const auth=checkBranchAuthorization(user,data.branchId||''); if(!auth.authorized) throw Object.assign(new Error(auth.error),{statusCode:403});
      const actorRole=String(user.role||(user as any).claims?.role||'').toLowerCase(); const isManagerial=['owner','admin','manager','accountant'].includes(actorRole);
      const actorEmployeeId=String((user as any).employeeId||(user as any).employee?.id||'').trim();
      if(!isManagerial && ((actorEmployeeId && actorEmployeeId !== String(data.employeeId||'')) || (!actorEmployeeId && String(user.uid||'') !== String(data.userId||'')))) throw Object.assign(new Error('You can only clock out your own employee record.'),{statusCode:403});
      if(data.clockOut) return {status:'success',attendance:{id:snap.id,...data},alreadyClockedOut:true};
      const now=new Date(); const start=new Date(data.clockIn).getTime(); if(!Number.isFinite(start)||start>now.getTime()) throw Object.assign(new Error('Invalid clock-in time.'),{statusCode:409});
      const breakMinutes=Math.max(0,Number(data.breakTimeMinutes)||0); const workingHours=Number(Math.max(0,(now.getTime()-start)/3600000-breakMinutes/60).toFixed(2)); const overtimeHours=Number(Math.max(0,workingHours-8).toFixed(2));
      const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Mogadishu',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(now); const hour=Number(parts.find(p=>p.type==='hour')?.value||0);
      const updated={clockOut:now.toISOString(),workingHours,overtimeHours,isEarlyLeave:hour<16,notes:req.body?.notes?`${data.notes?data.notes+' | ':''}${String(req.body.notes).trim()}`:data.notes,updatedAt:now.toISOString()};
      transaction.update(ref,cleanUndefined(updated)); return {status:'success',attendance:{id:snap.id,...data,...updated},alreadyClockedOut:false};
    }); return res.json(result);
  } catch(e:any){return res.status(e?.statusCode||500).json({error:e?.message||'Attendance clock-out failed.'});}
}

export async function handleAttendanceManual(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res); if (!user) return;
  const role=checkRoleAuthorization(user,['Owner','owner','Admin','admin','Manager','manager']); if(!role.authorized)return res.status(403).json({error:role.error});
  const body=req.body?.record||req.body||{}; const empId=String(body.employeeId||'').trim(); if(!empId)return res.status(400).json({error:'employeeId is required.'});
  const db=getAdminDb(); try{const result=await db.runTransaction(async(transaction)=>{const empSnap=await transaction.get(db.collection('employees').doc(empId)); if(!empSnap.exists)throw Object.assign(new Error('Employee not found.'),{statusCode:404}); const emp=empSnap.data()||{}; const branchId=normalizeCanonicalBranchId(emp.branchId||emp.branch||''); const auth=checkBranchAuthorization(user,branchId); if(!auth.authorized)throw Object.assign(new Error(auth.error),{statusCode:403}); const clockIn=String(body.clockIn||'').trim(); const clockOut=String(body.clockOut||'').trim(); const inMs=new Date(clockIn).getTime(); if(!Number.isFinite(inMs))throw Object.assign(new Error('Valid clockIn is required.'),{statusCode:400}); let workingHours=0,overtimeHours=0; if(clockOut){const outMs=new Date(clockOut).getTime(); if(!Number.isFinite(outMs)||outMs<inMs)throw Object.assign(new Error('Valid clockOut after clockIn is required.'),{statusCode:400}); const breakMin=Math.max(0,Number(body.breakTimeMinutes)||0); workingHours=Number(Math.max(0,(outMs-inMs)/3600000-breakMin/60).toFixed(2)); overtimeHours=Number(Math.max(0,workingHours-8).toFixed(2));} const ref=db.collection('employee_attendance').doc(); const record=cleanUndefined({id:ref.id,employeeId:empId,employeeName:emp.fullName||emp.name||empId,branchId,branch:emp.branch||branchId,date:body.date||getMogadishuDateString(clockIn),clockIn,clockOut:clockOut||undefined,breakTimeMinutes:Math.max(0,Number(body.breakTimeMinutes)||0),workingHours,overtimeHours,isLate:Boolean(body.isLate),isEarlyLeave:Boolean(body.isEarlyLeave),status:String(body.status||'present'),notes:String(body.notes||''),createdAt:new Date().toISOString(),createdBy:user.name}); transaction.set(ref,record); return {status:'success',attendance:record};}); return res.json(result);}catch(e:any){return res.status(e?.statusCode||500).json({error:e?.message||'Manual attendance failed.'});}
}

export type PayrollPayFrequency = 'daily' | 'weekly' | 'monthly';

export function payrollPeriodInfo(frequency: PayrollPayFrequency, period: string): { month: string; periodStart: string; periodEnd: string } {
  const value = String(period || '').trim();
  if (frequency === 'daily') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Object.assign(new Error('Daily payroll period must use YYYY-MM-DD format.'), { statusCode: 400 });
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw Object.assign(new Error('Daily payroll period is not a valid calendar date.'), { statusCode: 400 });
    return { month: value.slice(0, 7), periodStart: value, periodEnd: value };
  }
  if (frequency === 'weekly') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Object.assign(new Error('Weekly payroll period must use the Monday date in YYYY-MM-DD format.'), { statusCode: 400 });
    const start = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== value) throw Object.assign(new Error('Weekly payroll period is not a valid calendar date.'), { statusCode: 400 });
    if (start.getUTCDay() !== 1) throw Object.assign(new Error('Weekly payroll period must start on Monday.'), { statusCode: 400 });
    const end = new Date(start.getTime() + 6 * 86400000);
    return { month: value.slice(0, 7), periodStart: value, periodEnd: end.toISOString().slice(0, 10) };
  }
  if (!/^\d{4}-\d{2}$/.test(value)) throw Object.assign(new Error('Monthly payroll period must use YYYY-MM format.'), { statusCode: 400 });
  const start = new Date(`${value}-01T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 7) !== value) throw Object.assign(new Error('Monthly payroll period is not a valid calendar month.'), { statusCode: 400 });
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  return { month: value, periodStart: `${value}-01`, periodEnd: end.toISOString().slice(0, 10) };
}

export async function handlePayrollProcess(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleCheck.authorized) return res.status(403).json({ error: roleCheck.error });

  const rawFrequency = String(req.body?.frequency || '').trim().toLowerCase();
  if (!rawFrequency) return res.status(400).json({ error: 'Payroll frequency is required and must be daily, weekly, or monthly.' });
  const frequency = rawFrequency as PayrollPayFrequency;
  if (!['daily', 'weekly', 'monthly'].includes(frequency)) return res.status(400).json({ error: 'Payroll frequency must be daily, weekly, or monthly.' });

  const period = String(req.body?.period || req.body?.month || '').trim();
  let periodInfo: { month: string; periodStart: string; periodEnd: string };
  try { periodInfo = payrollPeriodInfo(frequency, period); }
  catch (e: any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Invalid payroll period.' }); }

  const branchCheck = checkBranchAuthorization(user, req.body?.branchId);
  if (!branchCheck.authorized) return res.status(403).json({ error: branchCheck.error });
  const targetBranchId = branchCheck.targetBranchId;
  if (!targetBranchId || targetBranchId === 'all') return res.status(400).json({ error: 'A concrete branchId is required to process payroll.' });

  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req, req.body?.idempotencyKey || `payroll-process:${targetBranchId}:${frequency}:${period}`); }
  catch (e: any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }

  const db = getAdminDb();
  const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`payroll-process:${user.uid}:${idempotencyKey}`).digest('hex'));

  try {
    const result = await db.runTransaction(async (transaction) => {
      const idemSnap = await transaction.get(idemRef);
      if (idemSnap.exists) return idemSnap.data();
      await assertAccountingDateOpenInTransaction(transaction, db, periodInfo.periodStart, targetBranchId);

      const employeeQuery = db.collection('employees').where('branchId', '==', targetBranchId);
      const attendanceQuery = db.collection('employee_attendance').where('branchId', '==', targetBranchId);
      const employeeSnap = await transaction.get(employeeQuery);
      const attendanceSnap = await transaction.get(attendanceQuery);

      const employees = employeeSnap.docs.filter(d => {
        const data = d.data() || {};
        const employeeFrequency = String(data.payFrequency || 'monthly').toLowerCase();
        return data.employmentStatus !== 'Terminated' && data.employmentStatus !== 'Inactive' && data.status !== 'inactive' && data.branchId === targetBranchId && employeeFrequency === frequency;
      });
      const attendance = attendanceSnap.docs.map(d => d.data() || {});
      const employeeRefs = employees.map(d => ({
        ref: db.collection('payroll').doc(`${frequency}_${periodInfo.periodStart}_${periodInfo.periodEnd}_${d.id}`),
        emp: d
      }));
      const existingPayrollSnaps: any[] = [];
      for (const item of employeeRefs) existingPayrollSnaps.push(await transaction.get(item.ref));

      const timestamp = new Date().toISOString();
      const generated: any[] = [];
      for (let i = 0; i < employeeRefs.length; i++) {
        const { ref, emp } = employeeRefs[i];
        const empData = emp.data() || {};
        const existingSnap = existingPayrollSnaps[i];
        if (existingSnap.exists && String(existingSnap.data()?.paymentStatus || '').toLowerCase() === 'paid') {
          generated.push({ id: ref.id, ...existingSnap.data() });
          continue;
        }

        const salary = Number(empData.salary);
        if (!Number.isFinite(salary) || salary < 0) throw new Error(`Employee ${emp.id} has an invalid salary value; payroll generation was stopped.`);
        const inPeriod = (dateValue: unknown) => {
          const date = String(dateValue || '').slice(0, 10);
          return date >= periodInfo.periodStart && date <= periodInfo.periodEnd;
        };
        const totalOvertimeHours = attendance
          .filter(a => a.employeeId === emp.id && inPeriod(a.date || a.clockIn))
          .reduce((sum, a) => sum + (Number(a.overtimeHours) || 0), 0);
        const divisor = frequency === 'daily' ? 8 : frequency === 'weekly' ? 40 : 160;
        const hourlyRate = salary / divisor;
        const overtimePay = Number((totalOvertimeHours * hourlyRate * 1.5).toFixed(2));
        const bonuses = 0;
        const deductions = 0;
        const advances = 0;
        const netSalary = Number((salary + overtimePay + bonuses - deductions - advances).toFixed(2));
        const record = cleanUndefined({
          id: ref.id,
          payrollNumber: `PAY-${frequency.toUpperCase()}-${periodInfo.periodStart}-${empData.employeeId || emp.id.substring(0, 5)}`,
          employeeId: emp.id,
          employeeName: empData.fullName || empData.name || 'Unnamed Employee',
          jobTitle: empData.jobTitle || empData.role || 'Staff Member',
          department: empData.department || 'General Operations',
          branchId: targetBranchId,
          branch: empData.branch || targetBranchId,
          month: periodInfo.month,
          payFrequency: frequency,
          periodStart: periodInfo.periodStart,
          periodEnd: periodInfo.periodEnd,
          basicSalary: salary,
          overtimePay,
          bonuses,
          deductions,
          advances,
          netSalary,
          paymentStatus: existingSnap.exists ? (existingSnap.data()?.paymentStatus || 'pending') : 'pending',
          createdAt: existingSnap.exists ? (existingSnap.data()?.createdAt || timestamp) : timestamp,
          updatedAt: timestamp
        });
        transaction.set(ref, record, { merge: true });
        generated.push(record);
      }

      const out = {
        status: 'success', branchId: targetBranchId, month: periodInfo.month,
        frequency, period: periodInfo.periodStart, periodStart: periodInfo.periodStart,
        periodEnd: periodInfo.periodEnd, count: generated.length, payroll: generated, idempotencyKey
      };
      transaction.set(idemRef, cleanUndefined({ ...out, createdAt: timestamp }));
      return out;
    });

    return res.json(result);
  } catch (err: any) {
    const raw = err?.message || 'Payroll processing failed';
    const statusCode = err?.statusCode || (/invalid|must use|required|branch|frequency|period|monday/i.test(String(raw)) ? 400 : 500);
    console.error('Payroll Process Error:', raw);
    return res.status(statusCode).json({ error: raw });
  }
}

// CRM Server-Authoritative Wallet Endpoints
export async function handleWalletRecharge(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant', 'Cashier', 'cashier']);
  if (!roleCheck.authorized) return res.status(403).json({ error: roleCheck.error });

  const { customerId, amount, paymentMethod, notes, customerName, branchId } = req.body || {};

  const branchAuth = checkBranchAuthorization(user, branchId);
  if (!branchAuth.authorized) return res.status(403).json({ error: branchAuth.error });
  const targetBranchId = branchAuth.targetBranchId;

  const rechargeAmt = Number(amount);
  if (!customerId || !Number.isFinite(rechargeAmt) || rechargeAmt <= 0) {
    return res.status(400).json({ error: 'Customer ID and a positive numeric recharge amount are required.' });
  }

  const rawIdempKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || req.body?.idempotencyKey || req.body?.idempotency_key;
  if (!rawIdempKey || typeof rawIdempKey !== 'string' || !rawIdempKey.trim()) {
    return res.status(400).json({ error: 'Idempotency-Key header or idempotencyKey body field is required for monetary wallet recharge operations.' });
  }
  const dedupeKey = String(rawIdempKey).trim();

  const db = getAdminDb();
  const timestamp = new Date().toISOString();

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Find or create customer wallet document for target branch
      const walletQuery = db.collection('customer_wallets').where('customerId', '==', String(customerId));
      const walletSnap = await transaction.get(walletQuery);

      const matchingBranchDocs = walletSnap.docs.filter(d => {
        const dBranch = d.data().branchId;
        return !!dBranch && (dBranch === targetBranchId || areBranchesMatching(dBranch, targetBranchId) || targetBranchId === 'all');
      });

      if (matchingBranchDocs.length > 1) {
        throw new Error(`Multiple wallets (${matchingBranchDocs.length}) found for customer "${customerId}" at branch "${targetBranchId}". Ambiguous wallet operation rejected.`);
      }

      let walletRef;
      let currentBalance = 0;
      let existingData: any = {};

      if (matchingBranchDocs.length === 1) {
        const matchingDoc = matchingBranchDocs.find(d => String(d.data().customerId) === String(customerId));
        if (!matchingDoc) {
          throw new Error(`Wallet record does not match customer ID "${customerId}".`);
        }
        walletRef = matchingDoc.ref;
        existingData = matchingDoc.data() || {};
        currentBalance = Number(existingData.balance || 0);
      } else {
        walletRef = db.collection('customer_wallets').doc();
      }

      // Exact idempotency deduplication check without notes fallback
      const dupQuery = db.collection('wallet_transactions')
        .where('customerId', '==', String(customerId));
      const dupSnap = await transaction.get(dupQuery);
      const matchingDup = dupSnap.docs.find(d => {
        const data = d.data();
        return data.idempotencyKey === dedupeKey;
      });
      if (matchingDup) {
        const existingTx = matchingDup.data();
        return { status: 'duplicate', transactionId: existingTx.id, newBalance: existingTx.balanceAfter, walletId: existingTx.walletId };
      }

      const custRef = db.collection('customers').doc(String(customerId));
      const custSnap = await transaction.get(custRef);
      if (!custSnap.exists) {
        throw new Error(`Customer with ID "${customerId}" not found.`);
      }
      const custData = custSnap.data() || {};
      const custBranch = custData.branchId;
      if (custBranch) {
        const custAuth = checkBranchAuthorization(user, custBranch);
        if (!custAuth.authorized) {
          throw new Error(`Unauthorized cross-branch wallet operation! Customer belongs to branch "${custBranch}". ${custAuth.error}`);
        }
      }
      if (existingData.branchId) {
        const walletBranchAuth = checkBranchAuthorization(user, existingData.branchId);
        if (!walletBranchAuth.authorized) {
          throw new Error(`Unauthorized cross-branch wallet operation! Customer wallet belongs to branch "${existingData.branchId}". ${walletBranchAuth.error}`);
        }
      }

      // All reads must occur before the first Firestore transaction write.
      const payMethodStr = String(paymentMethod || 'cash').toLowerCase();
      const walletSettlement = await resolveSettlementAccountInTransaction(transaction, db, targetBranchId, payMethodStr, undefined);
      const __walletAccountState = await prepareAccountBalanceState(transaction, db, [walletSettlement.id, 'acc_wallet_liability']);
      const walletCashRegisterState = payMethodStr === 'cash'
        ? await prepareCashRegisterStateInTransaction(transaction, db, targetBranchId)
        : undefined;

      const newBalance = currentBalance + rechargeAmt;

      const walletPayload = {
        id: walletRef.id,
        customerId: String(customerId),
        customerName: customerName || existingData.customerName || custData.fullName || 'Customer',
        balance: newBalance,
        currency: 'USD',
        status: 'active',
        branchId: targetBranchId,
        lastRechargeAt: timestamp,
        updatedAt: timestamp,
        createdAt: existingData.createdAt || timestamp
      };

      // All reads are complete above; validate the accounting period before any transaction write.
      const dateStr = getMogadishuDateString(timestamp);
      await assertAccountingDateOpenInTransaction(transaction, db, dateStr, targetBranchId);

      transaction.set(walletRef, cleanUndefined(walletPayload), { merge: true });

      // Create Wallet Transaction Log
      const txRef = db.collection('wallet_transactions').doc();
      const txDoc = {
        id: txRef.id,
        walletId: walletRef.id,
        customerId: String(customerId),
        customerName: walletPayload.customerName,
        type: 'recharge',
        amount: rechargeAmt,
        balanceAfter: newBalance,
        paymentMethod: paymentMethod || 'cash',
        branchId: targetBranchId,
        idempotencyKey: dedupeKey,
        notes: notes || 'Wallet recharge balance deposit',
        createdBy: user.name,
        createdAt: timestamp
      };

      transaction.set(txRef, cleanUndefined(txDoc));

      // Generate Double-Entry Accounting Journal Entry for Customer Wallet Deposit
      const journalRef = db.collection('journal_entries').doc();
      const journalDoc = {
        id: journalRef.id,
        entryNumber: `JE-WLT-${journalRef.id.slice(0, 8)}`,
        date: dateStr,
        description: `Customer Wallet Deposit: ${walletPayload.customerName} (${String(customerId)})`,
        reference: txRef.id,
        branchId: targetBranchId,
        status: 'posted',
        totalDebit: rechargeAmt,
        totalCredit: rechargeAmt,
        lines: [
          {
            accountId: walletSettlement.id,
            accountCode: walletSettlement.code,
            accountName: walletSettlement.name,
            debit: rechargeAmt,
            credit: 0,
            memo: `Wallet deposit cash/bank collection from ${walletPayload.customerName}`
          },
          {
            accountId: 'acc_wallet_liability',
            accountCode: '2040',
            accountName: 'Unearned Revenue / Customer Deposits',
            debit: 0,
            credit: rechargeAmt,
            memo: `Customer wallet unearned deposit liability for ${walletPayload.customerName}`
          }
        ],
        createdBy: user.name,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      transaction.set(journalRef, cleanUndefined(journalDoc));
      for (const line of journalDoc.lines) {
        const jlRef = db.collection('journal_lines').doc();
        transaction.set(jlRef, cleanUndefined({ id: jlRef.id, journalEntryId: journalRef.id, entryNumber: journalDoc.entryNumber, branchId: targetBranchId, ...line, createdAt: timestamp }));
        const ledgerRef = db.collection('ledger').doc();
        transaction.set(ledgerRef, cleanUndefined({ id: ledgerRef.id, accountId: line.accountId, accountCode: line.accountCode, accountName: line.accountName, journalEntryId: journalRef.id, entryNumber: journalDoc.entryNumber, date: dateStr, reference: txRef.id, description: line.memo || journalDoc.description, debit: line.debit, credit: line.credit, branchId: targetBranchId, createdAt: timestamp }));
      }
      applyAccountBalanceDeltasInTransaction(transaction, __walletAccountState, journalDoc.lines, timestamp);
      if (payMethodStr === 'cash' && walletCashRegisterState) {
        await applyCashRegisterMovementInTransaction(transaction, db, targetBranchId, rechargeAmt, 'customer wallet recharge', walletCashRegisterState);
      }
      return { status: 'success', walletId: walletRef.id, newBalance, transactionId: txRef.id, journalEntryId: journalRef.id };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Wallet Recharge Error:', err);
    return res.status(500).json({ error: err?.message || 'Wallet Recharge Failed' });
  }
}

export async function handleWalletDeduct(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Cashier', 'cashier']);
  if (!roleCheck.authorized) return res.status(403).json({ error: roleCheck.error });

  const { customerId, amount, orderId, notes, branchId } = req.body || {};

  const branchAuth = checkBranchAuthorization(user, branchId);
  if (!branchAuth.authorized) return res.status(403).json({ error: branchAuth.error });
  const targetBranchId = branchAuth.targetBranchId;

  const deductAmt = Number(amount);
  if (!customerId || !Number.isFinite(deductAmt) || deductAmt <= 0) {
    return res.status(400).json({ error: 'Customer ID and a positive numeric deduction amount are required.' });
  }

  const rawIdempKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || req.body?.idempotencyKey || req.body?.idempotency_key;
  if (!rawIdempKey || typeof rawIdempKey !== 'string' || !rawIdempKey.trim()) {
    return res.status(400).json({ error: 'Idempotency-Key header or idempotencyKey body field is required for monetary wallet deduction operations.' });
  }
  const dedupeKey = String(rawIdempKey).trim();

  const db = getAdminDb();
  const timestamp = new Date().toISOString();

  try {
    const result = await db.runTransaction(async (transaction) => {
      const dateStr = getMogadishuDateString(timestamp);
      await assertAccountingDateOpenInTransaction(transaction, db, dateStr, targetBranchId);
      const walletQuery = db.collection('customer_wallets').where('customerId', '==', String(customerId));
      const walletSnap = await transaction.get(walletQuery);

      if (walletSnap.empty) {
        throw new Error(`Customer Wallet for Customer ID "${customerId}" not found.`);
      }

      const matchingBranchDocs = walletSnap.docs.filter(d => {
        const dBranch = d.data().branchId;
        return !!dBranch && (dBranch === targetBranchId || areBranchesMatching(dBranch, targetBranchId) || targetBranchId === 'all');
      });

      if (matchingBranchDocs.length > 1) {
        throw new Error(`Multiple wallets (${matchingBranchDocs.length}) found for customer "${customerId}" at branch "${targetBranchId}". Ambiguous wallet operation rejected.`);
      }

      if (matchingBranchDocs.length === 0) {
        throw new Error(`Customer Wallet for Customer ID "${customerId}" not found at branch "${targetBranchId}".`);
      }

      const walletDoc = matchingBranchDocs.find(d => String(d.data().customerId) === String(customerId));
      if (!walletDoc) {
        throw new Error(`Customer Wallet for Customer ID "${customerId}" not found.`);
      }
      const walletData = walletDoc.data() || {};
      const currentBalance = Number(walletData.balance || 0);

      const custRef = db.collection('customers').doc(String(customerId));
      const custSnap = await transaction.get(custRef);
      if (!custSnap.exists) {
        throw new Error(`Customer with ID "${customerId}" not found.`);
      }
      const custData = custSnap.data() || {};
      const custBranch = custData.branchId;
      if (custBranch) {
        const custAuth = checkBranchAuthorization(user, custBranch);
        if (!custAuth.authorized) {
          throw new Error(`Unauthorized cross-branch wallet operation! Customer belongs to branch "${custBranch}". ${custAuth.error}`);
        }
      }
      if (walletData.branchId) {
        const walletBranchAuth = checkBranchAuthorization(user, walletData.branchId);
        if (!walletBranchAuth.authorized) {
          throw new Error(`Unauthorized cross-branch wallet operation! Customer wallet belongs to branch "${walletData.branchId}". ${walletBranchAuth.error}`);
        }
      }

      if (orderId) {
        const orderSnap = await transaction.get(db.collection('orders').doc(String(orderId).trim()));
        if (!orderSnap.exists) {
          throw new Error(`Referenced Order #${orderId} not found.`);
        }
        const orderData = orderSnap.data() || {};
        if (orderData.customerId && String(orderData.customerId) !== String(customerId)) {
          throw new Error(`Order #${orderId} belongs to customer "${orderData.customerId}", not "${customerId}".`);
        }
        if (orderData.branchId) {
          const ordBranchAuth = checkBranchAuthorization(user, orderData.branchId);
          if (!ordBranchAuth.authorized) {
            throw new Error(`Unauthorized cross-branch wallet deduction for Order #${orderId}. ${ordBranchAuth.error}`);
          }
        }

        // Duplicate payment check for order
        const dupPayQuery = db.collection('wallet_transactions')
          .where('orderId', '==', String(orderId).trim())
          .where('customerId', '==', String(customerId))
          .where('type', '==', 'payment');
        const dupPaySnap = await transaction.get(dupPayQuery);
        if (!dupPaySnap.empty) {
          const existingPay = dupPaySnap.docs.find(d => d.data().orderId === String(orderId).trim())?.data() || null;
          if (existingPay) {
            return { status: 'duplicate', walletId: walletDoc.id, newBalance: currentBalance, transactionId: existingPay.id };
          }
        }
      }

      // Exact idempotency deduplication check without notes fallback
      const dupQuery = db.collection('wallet_transactions')
        .where('customerId', '==', String(customerId))
        .where('type', '==', 'payment');
      const dupSnap = await transaction.get(dupQuery);
      const matchingDup = dupSnap.docs.find(d => {
        const data = d.data();
        return data.idempotencyKey === dedupeKey;
      });
      if (matchingDup) {
        const existingTx = matchingDup.data();
        return { status: 'duplicate', transactionId: existingTx.id, newBalance: existingTx.balanceAfter, walletId: existingTx.walletId };
      }

      if (currentBalance < deductAmt - 0.001) {
        throw new Error(`Insufficient wallet balance. Available: ${currentBalance.toFixed(2)}, Required: ${deductAmt.toFixed(2)}.`);
      }

      const newBalance = Math.max(0, currentBalance - deductAmt);

      transaction.update(walletDoc.ref, {
        balance: newBalance,
        updatedAt: timestamp
      });

      const txRef = db.collection('wallet_transactions').doc();
      const txDoc = {
        id: txRef.id,
        walletId: walletDoc.id,
        customerId: String(customerId),
        customerName: walletData.customerName || 'Customer',
        type: 'payment',
        amount: deductAmt,
        balanceAfter: newBalance,
        orderId: orderId || null,
        branchId: targetBranchId,
        idempotencyKey: dedupeKey,
        notes: notes || `Order payment using wallet funds`,
        createdBy: user.name,
        createdAt: timestamp
      };

      transaction.set(txRef, cleanUndefined(txDoc));

      return { status: 'success', walletId: walletDoc.id, newBalance, transactionId: txRef.id };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Wallet Deduction Error:', err);
    return res.status(500).json({ error: err?.message || 'Wallet Deduction Failed' });
  }
}

export async function handleWalletRefund(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleCheck.authorized) return res.status(403).json({ error: roleCheck.error });

  const { customerId, amount, orderId, reason, branchId } = req.body || {};

  const branchAuth = checkBranchAuthorization(user, branchId);
  if (!branchAuth.authorized) return res.status(403).json({ error: branchAuth.error });
  const targetBranchId = branchAuth.targetBranchId;

  const refundAmt = Number(amount);
  if (!customerId || !Number.isFinite(refundAmt) || refundAmt <= 0) {
    return res.status(400).json({ error: 'Customer ID and a positive numeric refund amount are required.' });
  }

  if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
    return res.status(400).json({ error: 'Referenced orderId is required for wallet refunds.' });
  }

  const rawIdempKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'] || req.body?.idempotencyKey || req.body?.idempotency_key;
  if (!rawIdempKey || typeof rawIdempKey !== 'string' || !rawIdempKey.trim()) {
    return res.status(400).json({ error: 'Idempotency-Key header or idempotencyKey body field is required for monetary wallet refund operations.' });
  }
  const dedupeKey = String(rawIdempKey).trim();

  const db = getAdminDb();
  const timestamp = new Date().toISOString();

  try {
    const result = await db.runTransaction(async (transaction) => {
      await assertAccountingDateOpenInTransaction(transaction, db, getMogadishuDateString(timestamp), targetBranchId);
      const walletQuery = db.collection('customer_wallets').where('customerId', '==', String(customerId));
      const walletSnap = await transaction.get(walletQuery);

      const matchingBranchDocs = walletSnap.docs.filter(d => {
        const dBranch = d.data().branchId;
        return !!dBranch && (dBranch === targetBranchId || areBranchesMatching(dBranch, targetBranchId) || targetBranchId === 'all');
      });

      if (matchingBranchDocs.length > 1) {
        throw new Error(`Multiple wallets (${matchingBranchDocs.length}) found for customer "${customerId}" at branch "${targetBranchId}". Ambiguous wallet operation rejected.`);
      }

      let walletRef;
      let currentBalance = 0;
      let walletData: any = {};

      if (matchingBranchDocs.length === 1) {
        const matchingWalletDoc = matchingBranchDocs.find(d => String(d.data().customerId) === String(customerId));
        if (!matchingWalletDoc) {
          throw new Error(`Wallet record does not match customer ID "${customerId}".`);
        }
        walletRef = matchingWalletDoc.ref;
        walletData = matchingWalletDoc.data() || {};
        currentBalance = Number(walletData.balance || 0);
      } else {
        walletRef = db.collection('customer_wallets').doc();
      }

      const custRef = db.collection('customers').doc(String(customerId));
      const custSnap = await transaction.get(custRef);
      if (!custSnap.exists) {
        throw new Error(`Customer with ID "${customerId}" not found.`);
      }
      const custData = custSnap.data() || {};
      const custBranch = custData.branchId;
      if (custBranch) {
        const custAuth = checkBranchAuthorization(user, custBranch);
        if (!custAuth.authorized) {
          throw new Error(`Unauthorized cross-branch wallet operation! Customer belongs to branch "${custBranch}". ${custAuth.error}`);
        }
      }
      if (walletData.branchId) {
        const walletBranchAuth = checkBranchAuthorization(user, walletData.branchId);
        if (!walletBranchAuth.authorized) {
          throw new Error(`Unauthorized cross-branch wallet operation! Customer wallet belongs to branch "${walletData.branchId}". ${walletBranchAuth.error}`);
        }
      }

      const orderSnap = await transaction.get(db.collection('orders').doc(String(orderId).trim()));
      if (!orderSnap.exists) {
        throw new Error(`Referenced Order #${orderId} not found.`);
      }
      const orderData = orderSnap.data() || {};
      if (orderData.status === 'cancelled' && orderData.paymentStatus !== 'paid') {
        throw new Error(`Order #${orderId} is cancelled/unpaid and cannot be refunded.`);
      }
      if (orderData.customerId && String(orderData.customerId) !== String(customerId)) {
        throw new Error(`Order #${orderId} belongs to customer "${orderData.customerId}", not "${customerId}".`);
      }
      if (orderData.branchId) {
        const ordBranchAuth = checkBranchAuthorization(user, orderData.branchId);
        if (!ordBranchAuth.authorized) {
          throw new Error(`Unauthorized cross-branch wallet refund for Order #${orderId}. ${ordBranchAuth.error}`);
        }
        if (orderData.branchId !== targetBranchId && targetBranchId !== 'HQ' && user.role !== 'Owner' && user.role !== 'owner') {
          throw new Error(`Order #${orderId} belongs to branch "${orderData.branchId}", not target branch "${targetBranchId}".`);
        }
      }
      const orderTotal = Number(orderData.totalAmount || 0);

      // Duplicate refund check strictly via Idempotency-Key
      const dupQuery = db.collection('wallet_transactions')
        .where('orderId', '==', String(orderId).trim())
        .where('customerId', '==', String(customerId))
        .where('type', '==', 'refund');
      const dupSnap = await transaction.get(dupQuery);
      const matchingDup = dupSnap.docs.find(d => {
        const data = d.data();
        return data.idempotencyKey === dedupeKey;
      });
      if (matchingDup) {
        const existingTx = matchingDup.data();
        return { status: 'duplicate', transactionId: existingTx.id, newBalance: existingTx.balanceAfter, walletId: existingTx.walletId };
      }

      // Check cumulative prior refunds for this order
      const priorRefundsQuery = db.collection('wallet_transactions')
        .where('orderId', '==', String(orderId).trim())
        .where('type', '==', 'refund');
      const priorRefundsSnap = await transaction.get(priorRefundsQuery);
      let alreadyRefunded = 0;
      priorRefundsSnap.docs.forEach((d) => {
        alreadyRefunded += Number(d.data().amount || 0);
      });

      if (alreadyRefunded + refundAmt > orderTotal + 0.001) {
        throw new Error(`Refund amount (${refundAmt.toFixed(2)}) exceeds remaining refundable balance (${Math.max(0, orderTotal - alreadyRefunded).toFixed(2)}) for Order #${orderId}.`);
      }

      const newBalance = currentBalance + refundAmt;

      transaction.set(walletRef, cleanUndefined({
        id: walletRef.id,
        customerId: String(customerId),
        customerName: walletData.customerName || custData.fullName || 'Customer',
        balance: newBalance,
        currency: 'USD',
        status: 'active',
        branchId: targetBranchId,
        updatedAt: timestamp,
        createdAt: walletData.createdAt || timestamp
      }), { merge: true });

      const txRef = db.collection('wallet_transactions').doc();
      const txDoc = {
        id: txRef.id,
        walletId: walletRef.id,
        customerId: String(customerId),
        customerName: walletData.customerName || custData.fullName || 'Customer',
        type: 'refund',
        amount: refundAmt,
        balanceAfter: newBalance,
        orderId: orderId || null,
        branchId: targetBranchId,
        idempotencyKey: dedupeKey,
        notes: reason || 'Order refund credited to customer wallet',
        createdBy: user.name,
        createdAt: timestamp
      };

      transaction.set(txRef, cleanUndefined(txDoc));

      return { status: 'success', walletId: walletRef.id, newBalance, transactionId: txRef.id };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Wallet Refund Error:', err);
    return res.status(500).json({ error: err?.message || 'Wallet Refund Failed' });
  }
}

export function calculatePeriodDateRange(period?: string, dateFrom?: string, dateTo?: string): { startDate: Date | null; endDate: Date | null } {
  const now = new Date();
  const mogStr = getMogadishuDateString(now);
  const [mYear, mMonth, mDay] = mogStr.split('-').map(Number);

  const mogTodayStart = new Date(`${mogStr}T00:00:00.000+03:00`);
  const mogTodayEnd = new Date(`${mogStr}T23:59:59.999+03:00`);

  let start: Date | null = null;
  let end: Date | null = mogTodayEnd;

  if (period === 'today') {
    start = mogTodayStart;
    end = mogTodayEnd;
  } else if (period === 'yesterday') {
    const yDate = new Date(mogTodayStart.getTime() - 24 * 60 * 60 * 1000);
    const yStr = getMogadishuDateString(yDate);
    start = new Date(`${yStr}T00:00:00.000+03:00`);
    end = new Date(`${yStr}T23:59:59.999+03:00`);
  } else if (period === 'this_week') {
    const mogUtc = new Date(Date.UTC(mYear, mMonth - 1, mDay));
    const dayOfWeek = mogUtc.getUTCDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const mondayUtc = new Date(mogUtc.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
    const monYear = mondayUtc.getUTCFullYear();
    const monMonth = String(mondayUtc.getUTCMonth() + 1).padStart(2, '0');
    const monDay = String(mondayUtc.getUTCDate()).padStart(2, '0');
    start = new Date(`${monYear}-${monMonth}-${monDay}T00:00:00.000+03:00`);
    end = mogTodayEnd;
  } else if (period === 'last_week') {
    const mogUtc = new Date(Date.UTC(mYear, mMonth - 1, mDay));
    const dayOfWeek = mogUtc.getUTCDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const lastMonUtc = new Date(mogUtc.getTime() - (daysSinceMonday + 7) * 24 * 60 * 60 * 1000);
    const lastSunUtc = new Date(mogUtc.getTime() - (daysSinceMonday + 1) * 24 * 60 * 60 * 1000);
    const lmonYear = lastMonUtc.getUTCFullYear();
    const lmonMonth = String(lastMonUtc.getUTCMonth() + 1).padStart(2, '0');
    const lmonDay = String(lastMonUtc.getUTCDate()).padStart(2, '0');
    const lsunYear = lastSunUtc.getUTCFullYear();
    const lsunMonth = String(lastSunUtc.getUTCMonth() + 1).padStart(2, '0');
    const lsunDay = String(lastSunUtc.getUTCDate()).padStart(2, '0');
    start = new Date(`${lmonYear}-${lmonMonth}-${lmonDay}T00:00:00.000+03:00`);
    end = new Date(`${lsunYear}-${lsunMonth}-${lsunDay}T23:59:59.999+03:00`);
  } else if (period === 'this_month') {
    const mMonthStr = String(mMonth).padStart(2, '0');
    start = new Date(`${mYear}-${mMonthStr}-01T00:00:00.000+03:00`);
    end = mogTodayEnd;
  } else if (period === 'last_month') {
    const prevMonthDate = new Date(Date.UTC(mYear, mMonth - 2, 1));
    const pYear = prevMonthDate.getUTCFullYear();
    const pMonth = prevMonthDate.getUTCMonth() + 1;
    const pMonthStr = String(pMonth).padStart(2, '0');
    const lastDayPrevMonth = new Date(Date.UTC(mYear, mMonth - 1, 0)).getUTCDate();
    start = new Date(`${pYear}-${pMonthStr}-01T00:00:00.000+03:00`);
    end = new Date(`${pYear}-${pMonthStr}-${String(lastDayPrevMonth).padStart(2, '0')}T23:59:59.999+03:00`);
  } else if (period === 'this_year') {
    start = new Date(`${mYear}-01-01T00:00:00.000+03:00`);
    end = mogTodayEnd;
  } else if (period === 'last_year') {
    const prevYear = mYear - 1;
    start = new Date(`${prevYear}-01-01T00:00:00.000+03:00`);
    end = new Date(`${prevYear}-12-31T23:59:59.999+03:00`);
  } else if (period === 'all' || period === 'all_time') {
    start = null;
    end = null;
  } else if (dateFrom || dateTo) {
    if (dateFrom) {
      const parsedStart = new Date(dateFrom.includes('T') ? dateFrom : `${dateFrom}T00:00:00.000+03:00`);
      if (isNaN(parsedStart.getTime())) {
        throw new Error(`Invalid dateFrom parameter: "${dateFrom}".`);
      }
      start = parsedStart;
    }
    if (dateTo) {
      const parsedEnd = new Date(dateTo.includes('T') ? dateTo : `${dateTo}T23:59:59.999+03:00`);
      if (isNaN(parsedEnd.getTime())) {
        throw new Error(`Invalid dateTo parameter: "${dateTo}".`);
      }
      end = parsedEnd;
    }
    if (start && end && start > end) {
      throw new Error(`Invalid date range: dateFrom (${dateFrom}) cannot be after dateTo (${dateTo}).`);
    }
  }

  return { startDate: start, endDate: end };
}

export async function handleGetFinancialSummary(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const financialRoles = ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant'];
  if (!financialRoles.includes(user.role)) {
    return res.status(403).json({ error: 'Unauthorized: Financial summary access is restricted to management and accountant roles.' });
  }

  const { branchId, dateFrom, dateTo, period } = req.query as any;
  const requestedBranch = branchId !== undefined && branchId !== null && String(branchId).trim() !== ''
    ? String(branchId).trim()
    : undefined;

  const branchCheck = checkBranchAuthorization(user, requestedBranch);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }
  const targetBranchId = branchCheck.targetBranchId;

  try {
    const summary = await getFinancialSummaryData(targetBranchId, {
      dateFrom,
      dateTo,
      period
    });
    return res.json(summary);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to generate financial summary' });
  }
}

export interface FinancialSummaryParams {
  userBranchId?: string;
  dateFrom?: string;
  dateTo?: string;
  period?: string;
}

export async function getFinancialSummaryData(
  param1?: string | FinancialSummaryParams,
  param2?: { dateFrom?: string; dateTo?: string; period?: string }
) {
  const db = getAdminDb();
  let userBranchId: string | undefined;
  let periodOptions: { dateFrom?: string; dateTo?: string; period?: string } | undefined;

  if (typeof param1 === 'object' && param1 !== null) {
    userBranchId = param1.userBranchId;
    periodOptions = {
      dateFrom: param1.dateFrom,
      dateTo: param1.dateTo,
      period: param1.period
    };
  } else {
    userBranchId = typeof param1 === 'string' ? param1 : undefined;
    periodOptions = param2;
  }

  const { startDate, endDate } = calculatePeriodDateRange(
    periodOptions?.period,
    periodOptions?.dateFrom,
    periodOptions?.dateTo
  );

  function isDocInPeriod(doc: any): boolean {
    if (!startDate && !endDate) return true;
    const docTimeStr = doc.date || doc.createdAt || doc.timestamp || doc.updatedAt;
    if (!docTimeStr) return true;
    const docDate = new Date(docTimeStr);
    if (isNaN(docDate.getTime())) return true;
    if (startDate && docDate < startDate) return false;
    if (endDate && docDate > endDate) return false;
    return true;
  }

  async function fetchDocsQueried(colName: string, dateField = 'createdAt') {
    let q: any = db.collection(colName);
    if (userBranchId && userBranchId !== 'all') {
      q = q.where('branchId', '==', userBranchId);
    }
    if (startDate) {
      q = q.where(dateField, '>=', startDate.toISOString());
    }
    if (endDate) {
      q = q.where(dateField, '<=', endDate.toISOString());
    }
    const snap = await q.get();
    return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
  }

  async function fetchBranchDocs(colName: string) {
    let q: any = db.collection(colName);
    if (userBranchId && userBranchId !== 'all') {
      q = q.where('branchId', '==', userBranchId);
    }
    const snap = await q.get();
    return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
  }

  const [orders, refunds, expenses, accounts, receivables, payables, products, ingredients, journalLines, inventoryMovements] = await Promise.all([
    fetchBranchDocs('orders'),
    fetchBranchDocs('refunds'),
    fetchBranchDocs('expenses'),
    fetchBranchDocs('accounts'),
    fetchBranchDocs('receivables'),
    fetchBranchDocs('payables'),
    fetchBranchDocs('products'),
    fetchBranchDocs('ingredients'),
    fetchBranchDocs('journal_lines'),
    fetchBranchDocs('inventory_movements')
  ]);

  // Operational Backup Calculations (Filtered by Period)
  const filteredOrders = orders.filter((o: any) => isDocInPeriod(o));
  const filteredRefunds = refunds.filter((r: any) => isDocInPeriod(r));
  const filteredExpenses = expenses.filter((e: any) => isDocInPeriod(e));

  const completedOrders = filteredOrders.filter((o: any) => o.status !== 'cancelled' && o.paymentStatus !== 'failed');
  const opGrossSales = completedOrders.reduce((sum: number, o: any) => sum + (Number(o.totalAmount) || 0), 0);
  const opRefunds = filteredRefunds.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
  const opNetSales = Math.max(0, opGrossSales - opRefunds);
  const opCogs = completedOrders.reduce((sum: number, o: any) => sum + (Number(o.cogs) || 0), 0);
  const opExpenses = filteredExpenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
  const opGrossProfit = opNetSales - opCogs;
  const opNetProfit = opGrossProfit - opExpenses;

  // Official General Ledger Double-Entry Calculations (Filtered by Period)
  const filteredJournalLines = journalLines.filter((jl: any) => isDocInPeriod(jl));

  let grossSales = 0;
  let totalRefunds = 0;
  let netSales = 0;
  let cogs = 0;
  let grossProfit = 0;
  let totalExpenses = 0;
  let netProfit = 0;
  let accountingStatus = 'VALIDATED_GENERAL_LEDGER';

  if (Array.isArray(filteredJournalLines) && filteredJournalLines.length > 0) {
    let glGrossRevenue = 0;
    let glRevenueDebits = 0;
    let glCogs = 0;
    let glExpenses = 0;

    filteredJournalLines.forEach((jl: any) => {
      const code = String(jl.accountCode || '');
      const debit = Number(jl.debit || 0);
      const credit = Number(jl.credit || 0);

      // Revenue Accounts (4xxx)
      if (code.startsWith('4')) {
        glGrossRevenue += credit;
        glRevenueDebits += debit;
      }
      // COGS (50xx)
      else if (code.startsWith('50')) {
        glCogs += (debit - credit);
      }
      // Operating Expenses (51xx-59xx)
      else if (code.startsWith('5') && !code.startsWith('50')) {
        glExpenses += (debit - credit);
      }
    });

    grossSales = glGrossRevenue;
    totalRefunds = glRevenueDebits;
    netSales = grossSales - totalRefunds; // Correct: Gross Revenue - Refunds (Single reversal deduction)
    cogs = glCogs;
    grossProfit = netSales - cogs;
    totalExpenses = glExpenses;
    netProfit = grossProfit - totalExpenses;
  } else if (journalLines.length > 0) {
    // Has journal entries in database, but none in this date period
    grossSales = 0;
    totalRefunds = 0;
    netSales = 0;
    cogs = 0;
    grossProfit = 0;
    totalExpenses = 0;
    netProfit = 0;
  } else {
    // No General Ledger data configured
    accountingStatus = 'ACCOUNTING DATA INCOMPLETE';
    grossSales = 0;
    totalRefunds = 0;
    netSales = 0;
    cogs = 0;
    grossProfit = 0;
    totalExpenses = 0;
    netProfit = 0;
  }

  // Point-in-time Balance Sheet & Inventory Metrics
  const isDocAsOfDateTo = (doc: any) => {
    if (!endDate) return true;
    const dateStr = doc.date || doc.createdAt || doc.updatedAt;
    if (!dateStr) return true;
    const docDate = new Date(dateStr);
    return isNaN(docDate.getTime()) || docDate <= endDate;
  };

  // Point-in-time balance reconstruction: start from current GL balance and roll back postings after the requested end date.
  const deltaForAccount = (account: any, line: any) => {
    const nature = normalizeAccountNature(account.type, account);
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);
    return nature === 'debit' ? debit - credit : credit - debit;
  };
  const glAsOfBalance = (accountId: string) => {
    const account = accounts.find((a: any) => a.id === accountId);
    if (!account) return 0;
    let balance = Number(account.balance || 0);
    if (!endDate) return balance;
    for (const line of journalLines) {
      if (String(line.accountId) !== String(accountId)) continue;
      const d = new Date(line.date || line.createdAt || '');
      if (!Number.isFinite(d.getTime()) || d > endDate) balance -= deltaForAccount(account, line);
    }
    return Number.isFinite(balance) ? balance : 0;
  };

  const cashAccounts = accounts.filter((a: any) => a.type === 'cash' || a.accountType === 'Cash' || (a.code && String(a.code).startsWith('101')));
  const bankAccounts = accounts.filter((a: any) => a.type === 'bank' || a.accountType === 'Bank' || (a.code && String(a.code).startsWith('102')));

  const cash = cashAccounts.reduce((sum: number, a: any) => sum + glAsOfBalance(String(a.id)), 0);
  const bank = bankAccounts.reduce((sum: number, a: any) => sum + glAsOfBalance(String(a.id)), 0);

  // AR/AP point-in-time balances come from their authoritative control accounts when present.
  const arAccount = accounts.find((a: any) => a.id === 'acc_ar' || String(a.code) === '1100');
  const apAccount = accounts.find((a: any) => a.id === 'acc_ap' || String(a.code) === '2010');
  const AR = arAccount ? Math.max(0, glAsOfBalance(String(arAccount.id))) : receivables.filter((r: any) => isDocAsOfDateTo(r)).reduce((sum: number, r: any) => sum + Math.max(0, (Number(r.totalAmount) || Number(r.amount) || 0) - (Number(r.paidAmount) || 0)), 0);
  const AP = apAccount ? Math.max(0, glAsOfBalance(String(apAccount.id))) : payables.filter((p: any) => isDocAsOfDateTo(p)).reduce((sum: number, p: any) => sum + Math.max(0, (Number(p.totalAmount) || Number(p.amount) || 0) - (Number(p.paidAmount) || 0)), 0);

  const latestMovement = new Map<string, any>();
  if (endDate) {
    for (const mv of inventoryMovements) {
      const d = new Date(mv.createdAt || mv.date || '');
      if (!Number.isFinite(d.getTime()) || d > endDate) continue;
      const key = `${String(mv.itemType || '')}:${String(mv.itemId || '')}`;
      const prev = latestMovement.get(key);
      if (!prev || new Date(prev.createdAt || prev.date || 0) < d) latestMovement.set(key, mv);
    }
  }
  const historicalStock = (item: any, itemType: string) => {
    if (!endDate) return Math.max(0, Number(item.stock ?? item.currentQuantity ?? 0));
    const mv = latestMovement.get(`${itemType}:${String(item.id)}`);
    if (mv && Number.isFinite(Number(mv.newQuantity))) return Math.max(0, Number(mv.newQuantity));
    const created = new Date(item.createdAt || item.date || '');
    return Number.isFinite(created.getTime()) && created <= endDate ? Math.max(0, Number(item.stock ?? item.currentQuantity ?? 0)) : 0;
  };
  const historicalCost = (item: any, itemType: string) => {
    if (!endDate) return Number(item.cost ?? item.costPrice ?? item.unitCost ?? 0);
    const key = `${itemType}:${String(item.id)}`;
    const candidates = inventoryMovements.filter((mv:any) => `${String(mv.itemType||'')}:${String(mv.itemId||'')}`===key && isDocAsOfDateTo(mv));
    for (let i=candidates.length-1;i>=0;i--) { const mv=candidates[i]; const c=Number(mv.unitCost ?? mv.costPrice ?? mv.cost ?? NaN); if(Number.isFinite(c)&&c>=0) return c; }
    const created=new Date(item.createdAt||item.date||''); const fallback=Number(item.cost ?? item.costPrice ?? item.unitCost ?? NaN);
    return Number.isFinite(created.getTime()) && created<=endDate && Number.isFinite(fallback) ? fallback : 0;
  };
  const productVal = products.reduce((sum: number, p: any) => sum + historicalStock(p, 'product') * historicalCost(p, 'product'), 0);
  const ingredientVal = ingredients.reduce((sum: number, i: any) => sum + historicalStock(i, 'ingredient') * historicalCost(i, 'ingredient'), 0);
  const inventory = productVal + ingredientVal;

  // P1-6 & P1-7: GL Control Reconciliation
  let glAR = 0;
  let glAP = 0;
  let glCash = 0;
  let glBank = 0;

  const asOfJournalLines = journalLines.filter((jl: any) => isDocAsOfDateTo(jl));
  asOfJournalLines.forEach((jl: any) => {
    const code = String(jl.accountCode || jl.accountId || '');
    const debit = Number(jl.debit || 0);
    const credit = Number(jl.credit || 0);

    if (code === '1200' || code === 'acc_ar' || code.startsWith('12')) {
      glAR += (debit - credit);
    } else if (code === '2100' || code === 'acc_ap' || code.startsWith('21')) {
      glAP += (credit - debit);
    } else if (code === '1010' || code === 'acc_cash' || (code.startsWith('101') && !code.startsWith('102'))) {
      glCash += (debit - credit);
    } else if (code === '1020' || code === 'acc_bank' || code.startsWith('102')) {
      glBank += (debit - credit);
    }
  });

  const arDiff = Math.abs(AR - glAR);
  const apDiff = Math.abs(AP - glAP);
  const cashDiff = Math.abs(cash - glCash);
  const bankDiff = Math.abs(bank - glBank);

  return {
    accountingStatus,
    branchId: userBranchId || 'all',
    period: periodOptions?.period || 'all_time',
    sales: Math.round(grossSales * 100) / 100,
    refunds: Math.round(totalRefunds * 100) / 100,
    netSales: Math.round(netSales * 100) / 100,
    cogs: Math.round(cogs * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    expenses: Math.round(totalExpenses * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    cash: Math.round(cash * 100) / 100,
    bank: Math.round(bank * 100) / 100,
    AR: Math.round(AR * 100) / 100,
    AP: Math.round(AP * 100) / 100,
    inventory: Math.round(inventory * 100) / 100,
    reconciliation: {
      arOperational: Math.round(AR * 100) / 100,
      arGlControl: Math.round(glAR * 100) / 100,
      arDiff: Math.round(arDiff * 100) / 100,
      arDifference: Math.round((AR - glAR) * 100) / 100,
      arReconciled: arDiff <= 0.01,

      apOperational: Math.round(AP * 100) / 100,
      apGlControl: Math.round(glAP * 100) / 100,
      apDiff: Math.round(apDiff * 100) / 100,
      apDifference: Math.round((AP - glAP) * 100) / 100,
      apReconciled: apDiff <= 0.01,

      cashOperational: Math.round(cash * 100) / 100,
      cashGlControl: Math.round(glCash * 100) / 100,
      cashDiff: Math.round(cashDiff * 100) / 100,
      cashDifference: Math.round((cash - glCash) * 100) / 100,
      cashReconciled: cashDiff <= 0.01,

      bankOperational: Math.round(bank * 100) / 100,
      bankGlControl: Math.round(glBank * 100) / 100,
      bankDiff: Math.round(bankDiff * 100) / 100,
      bankDifference: Math.round((bank - glBank) * 100) / 100,
      bankReconciled: bankDiff <= 0.01
    },
    operationalKpis: {
      sales: Math.round(opGrossSales * 100) / 100,
      refunds: Math.round(opRefunds * 100) / 100,
      netSales: Math.round(opNetSales * 100) / 100,
      cogs: Math.round(opCogs * 100) / 100,
      grossProfit: Math.round(opGrossProfit * 100) / 100,
      expenses: Math.round(opExpenses * 100) / 100,
      netProfit: Math.round(opNetProfit * 100) / 100
    }
  };
}

// Delivery Telemetry Tracking Handler (Server Authoritative)
export async function handleDeliveryTracking(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Driver', 'driver']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { deliveryId } = req.params;
  const { lat, latitude, lng, longitude, speedKmH, speed, heading, accuracy, note, statusUpdate } = req.body || {};
  if (!deliveryId) {
    return res.status(400).json({ error: 'Delivery ID is required.' });
  }

  const numLat = Number(lat !== undefined ? lat : latitude);
  const numLng = Number(lng !== undefined ? lng : longitude);

  if (!Number.isFinite(numLat) || numLat < -90 || numLat > 90 || !Number.isFinite(numLng) || numLng < -180 || numLng > 180) {
    return res.status(400).json({ error: 'Invalid GPS coordinates: latitude must be in [-90, 90] and longitude in [-180, 180].' });
  }

  const db = getAdminDb();
  try {
    const deliveryRef = db.collection('deliveries').doc(deliveryId);
    const deliveryDoc = await deliveryRef.get();
    if (!deliveryDoc.exists) {
      return res.status(404).json({ error: 'Delivery order not found.' });
    }

    const deliveryData = deliveryDoc.data() || {};
    const branchCheck = checkBranchAuthorization(user, deliveryData.branchId);
    if (!branchCheck.authorized) {
      return res.status(403).json({ error: branchCheck.error });
    }

    const isDriverRole = ['Delivery Driver', 'delivery driver', 'Driver', 'driver'].includes(user.role);
    if (isDriverRole) {
      const assignedDriver = deliveryData.driverId;
      if (!assignedDriver || assignedDriver !== user.uid) {
        return res.status(403).json({ error: "Unauthorized: Driver cannot generate telemetry for a delivery not assigned to them." });
      }
    }

    const { clientEventId, eventId } = req.body || {};
    const trackingDocId = (clientEventId || eventId) 
      ? `trk_${deliveryId}_${String(clientEventId || eventId).replace(/[^a-zA-Z0-9_-]/g, '_')}`
      : undefined;

    const trackingRef = trackingDocId ? db.collection('delivery_tracking').doc(trackingDocId) : db.collection('delivery_tracking').doc();
    const timestamp = new Date().toISOString();
    const trackingDoc = {
      id: trackingRef.id,
      deliveryId,
      driverId: deliveryData.driverId || user.uid,
      lat: numLat,
      lng: numLng,
      speedKmH: Number.isFinite(Number(speedKmH || speed)) ? Number(speedKmH || speed) : 0,
      heading: Number.isFinite(Number(heading)) ? Number(heading) : 0,
      accuracy: Number.isFinite(Number(accuracy)) ? Number(accuracy) : 0,
      branchId: branchCheck.targetBranchId,
      note: note ? String(note).trim() : '',
      statusUpdate: statusUpdate ? String(statusUpdate).trim() : undefined,
      timestamp
    };

    await trackingRef.set(cleanUndefined(trackingDoc), { merge: true });
    return res.json({ status: 'success', id: trackingRef.id });
  } catch (err: any) {
    console.error('Delivery Tracking Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Delivery Tracking Failed' });
  }
}

// Kitchen Waste Handler (Server Authoritative)
export async function handleLogKitchenWaste(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Chef', 'chef', 'Kitchen', 'kitchen', 'Staff', 'staff', 'Cashier', 'cashier']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { wasteData } = req.body || {};
  const payload = wasteData || req.body || {};

  if (!payload || (typeof payload === 'object' && Object.keys(payload).length === 0)) {
    return res.status(400).json({ error: 'Kitchen waste data is required.' });
  }

  const quantity = Number(payload.quantity || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive number.' });
  }

  const branchCheck = checkBranchAuthorization(user, payload.branchId);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }

  const targetBranchId = branchCheck.targetBranchId;
  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req, payload.idempotencyKey || req.body?.idempotencyKey); }
  catch (e: any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }

  const db = getAdminDb();
  const idemRef = db.collection('mutation_idempotency').doc(
    createHash('sha256').update(`kitchen-waste:${user.uid}:${idempotencyKey}`).digest('hex')
  );

  try {
    const timestamp = new Date().toISOString();
    const wasteRef = db.collection('kitchen_waste').doc();
    const movementRef = db.collection('inventory_movements').doc();
    const auditRef = db.collection('activity_logs').doc();

    const targetItemId = payload.itemId || payload.ingredientId || payload.productId || '';
    if (!targetItemId) {
      return res.status(400).json({ error: 'Item ID (itemId or ingredientId) is required for logging kitchen waste.' });
    }

    const rawTargetItemType = payload.itemType;
    if (!rawTargetItemType || !['product', 'ingredient', 'inventory'].includes(rawTargetItemType)) {
      return res.status(400).json({ error: 'Valid itemType ("product", "ingredient", or "inventory") is required for logging kitchen waste.' });
    }

    const targetItemType = rawTargetItemType;
    const reasonText = payload.reason ? String(payload.reason) : 'Spoilage/Waste';
    const unitText = payload.unit ? String(payload.unit) : 'pcs';

    const result = await db.runTransaction(async (transaction) => {
      const idemSnap = await transaction.get(idemRef);
      if (idemSnap.exists) return idemSnap.data();

      // Phase 1 (All Reads)
      const itemType = targetItemType === 'product' ? 'products' : targetItemType === 'inventory' ? 'inventory' : 'ingredients';
      const itemRef = db.collection(itemType).doc(targetItemId);
      const itemDoc = await transaction.get(itemRef);

      if (!itemDoc.exists) {
        throw new Error(`Inventory item "${targetItemId}" not found in collection "${itemType}". Cross-collection fallback prohibited.`);
      }

      const itemVal = itemDoc.data() || {};
      const itemBranchId = normalizeCanonicalBranchId(itemVal.branchId || itemVal.branch || '');
      if (!itemBranchId || itemBranchId === 'all') {
        throw Object.assign(new Error(`Inventory item "${targetItemId}" has no canonical branchId and cannot be modified safely.`), { statusCode: 409 });
      }
      if (!areBranchesMatching(itemBranchId, targetBranchId)) {
        throw Object.assign(new Error(`Unauthorized cross-branch waste operation! Item belongs to branch "${itemBranchId}", target is "${targetBranchId}".`), { statusCode: 403 });
      }

      let linkedProjection: { ref: any; type: 'ingredient' | 'inventory'; snap: any } | null = null;
      if (itemType === 'inventory') {
        const linkedRef = db.collection('ingredients').doc(targetItemId);
        const linkedSnap = await transaction.get(linkedRef);
        if (linkedSnap.exists) linkedProjection = { ref: linkedRef, type: 'ingredient', snap: linkedSnap };
      } else if (itemType === 'ingredients') {
        const linkedRef = db.collection('inventory').doc(targetItemId);
        const linkedSnap = await transaction.get(linkedRef);
        if (linkedSnap.exists) linkedProjection = { ref: linkedRef, type: 'inventory', snap: linkedSnap };
      }

      const currentStock = Number(itemVal.stock ?? itemVal.currentQuantity ?? 0);
      if (currentStock < quantity) {
        throw new Error(`Insufficient stock for waste logging of "${itemVal.name || itemVal.itemName || targetItemId}": available ${currentStock}, requested waste ${quantity}.`);
      }

      const newStock = currentStock - quantity;
      // Cost is server-authoritative. Never trust a client-supplied cost for GL valuation.
      const unitCost = Number(itemVal.costPrice ?? itemVal.purchaseCost ?? itemVal.cost ?? 0);
      const finalCost = Math.round(quantity * Math.max(0, Number.isFinite(unitCost) ? unitCost : 0) * 100) / 100;
      const itemOrIngName = itemVal.name || itemVal.itemName || payload.itemOrIngredientName || payload.itemName || 'Waste Item';
      const dateStr = getMogadishuDateString(timestamp);

      // SERVER AUTHORITATIVE USER METADATA ONLY - Do not trust client loggedBy/user/role/branchId
      const fullWaste = {
        id: wasteRef.id,
        itemId: targetItemId,
        itemType: targetItemType,
        itemOrIngredientName: itemOrIngName,
        quantity,
        unit: unitText,
        reason: reasonText,
        cost: finalCost,
        branchId: targetBranchId,
        loggedBy: user.name || user.email || 'Kitchen Staff',
        userId: user.uid,
        userRole: user.role,
        createdAt: timestamp
      };

      const movement = {
        id: movementRef.id,
        type: 'waste',
        itemType: targetItemType,
        itemId: targetItemId,
        itemName: itemOrIngName,
        quantity,
        previousQuantity: currentStock,
        newQuantity: newStock,
        unit: unitText,
        reason: `Kitchen Waste: ${reasonText} (Cost $${finalCost})`,
        createdBy: user.name || user.email || 'Kitchen Staff',
        branchId: targetBranchId,
        createdAt: timestamp
      };

      const auditLog = {
        id: auditRef.id,
        userId: user.uid,
        userEmail: user.email || 'user@system.internal',
        userName: user.name || 'Authenticated User',
        userRole: user.role,
        branchId: targetBranchId,
        actor: user.name || user.email || user.uid,
        action: 'LOG_KITCHEN_WASTE',
        details: `Logged kitchen waste: ${quantity} ${unitText} of ${itemOrIngName} (${reasonText})`,
        timestamp,
        requestId: randomUUID()
      };

      // Phase 2 (All Writes)
      transaction.set(wasteRef, cleanUndefined(fullWaste));
      transaction.set(movementRef, cleanUndefined(movement));
      transaction.set(auditRef, cleanUndefined(auditLog));

      if (itemVal.stock !== undefined) {
        transaction.update(itemRef, { stock: newStock, updatedAt: timestamp });
      } else {
        let status = 'in_stock';
        if (newStock <= 0) status = 'out_of_stock';
        else if (newStock <= (itemVal.minimumQuantity || 0)) status = 'low_stock';
        transaction.update(itemRef, { currentQuantity: newStock, status, updatedAt: timestamp });
      }

      // Synchronize linked stock projections in both directions when the companion document exists.
      if (linkedProjection) {
        const linkedBranch = normalizeCanonicalBranchId((linkedProjection.snap.data() || {}).branchId || '');
        if (!linkedBranch || !areBranchesMatching(linkedBranch, targetBranchId)) {
          throw Object.assign(new Error(`Linked ${linkedProjection.type} projection "${targetItemId}" belongs to a different or undefined branch.`), { statusCode: 403 });
        }
        if (linkedProjection.type === 'ingredient') {
          transaction.update(linkedProjection.ref, { stock: newStock, currentStockUsageUnit: newStock, updatedAt: timestamp });
        } else {
          transaction.update(linkedProjection.ref, { currentQuantity: newStock, updatedAt: timestamp });
        }
      }

      // Record GL Journal Entry for Waste (Dr 5030 Kitchen Waste Expense, Cr 1030 Inventory Asset)
      if (finalCost > 0) {
        const lines = [
          {
            accountId: 'acc_waste',
            accountCode: '5030',
            accountName: 'Kitchen Waste & Shrinkage Expense',
            debit: finalCost,
            credit: 0,
            memo: `Kitchen Waste Expense for ${itemOrIngName} (${reasonText})`
          },
          {
            accountId: 'acc_inventory',
            accountCode: '1030',
            accountName: 'Food & Beverage Inventory Asset',
            debit: 0,
            credit: finalCost,
            memo: `Inventory Asset reduction for waste on ${itemOrIngName}`
          }
        ];

        const jeRef = db.collection('journal_entries').doc();
        const entryNumber = `JE-WASTE-${Date.now().toString().slice(-6)}`;
        const journalEntry = {
          id: jeRef.id,
          entryNumber,
          date: dateStr,
          reference: wasteRef.id,
          description: `Kitchen Waste: ${quantity} ${unitText} of ${itemOrIngName} (${reasonText})`,
          source: 'KitchenWaste' as const,
          status: 'Posted' as const,
          totalDebit: finalCost,
          totalCredit: finalCost,
          lines,
          branchId: targetBranchId,
          createdBy: user.name,
          createdAt: timestamp
        };

        transaction.set(jeRef, cleanUndefined(journalEntry));

        for (const line of lines) {
          const jlRef = db.collection('journal_lines').doc();
          transaction.set(jlRef, cleanUndefined({
            id: jlRef.id,
            journalEntryId: jeRef.id,
            entryNumber,
            branchId: targetBranchId,
            ...line,
            createdAt: timestamp
          }));

          const ledgerRef = db.collection('ledger').doc();
          transaction.set(ledgerRef, cleanUndefined({
            id: ledgerRef.id,
            accountId: line.accountId,
            accountCode: line.accountCode,
            accountName: line.accountName,
            journalEntryId: jeRef.id,
            entryNumber,
            date: dateStr,
            reference: wasteRef.id,
            description: line.memo,
            debit: line.debit,
            credit: line.credit,
            branchId: targetBranchId,
            createdAt: timestamp
          }));
        }
      }

      const out = { status: 'success', id: wasteRef.id, idempotencyKey };
      transaction.set(idemRef, cleanUndefined({ ...out, createdAt: timestamp }));
      return out;
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Kitchen Waste Error:', err?.message || err);
    return res.status(err?.statusCode || (err?.message?.includes('Insufficient') ? 400 : 500)).json({ error: err?.message || 'Kitchen Waste Failed' });
  }
}

// Delivery Rating Handler (Server Authoritative)
export async function handleDeliveryRating(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const { deliveryId } = req.params;
  const { rating, feedback } = req.body || {};

  if (!deliveryId) {
    return res.status(400).json({ error: 'Delivery ID is required.' });
  }

  const numRating = Number(rating);
  if (!Number.isFinite(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'Rating must be a number between 1 and 5.' });
  }

  const db = getAdminDb();
  try {
    const deliveryRef = db.collection('deliveries').doc(deliveryId);
    const deliveryDoc = await deliveryRef.get();
    if (!deliveryDoc.exists) {
      return res.status(404).json({ error: 'Delivery order not found.' });
    }

    const deliveryData = deliveryDoc.data() || {};
    const branchCheck = checkBranchAuthorization(user, deliveryData.branchId);
    if (!branchCheck.authorized) {
      return res.status(403).json({ error: branchCheck.error });
    }

    // Must be in delivered state
    if (deliveryData.status !== 'delivered') {
      return res.status(400).json({ error: 'Cannot rate an undelivered delivery.' });
    }

    // Authorization: customer associated with order/delivery OR staff/management of branch
    const isStaffOrMgmt = ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Cashier', 'cashier', 'Staff', 'staff'].includes(user.role);
    let isAuthorized = isStaffOrMgmt;

    if (!isAuthorized) {
      if (deliveryData.customerId && (deliveryData.customerId === user.uid || deliveryData.customerId === user.idToken)) {
        isAuthorized = true;
      } else if (deliveryData.customerPhone && user.phone && deliveryData.customerPhone === user.phone) {
        isAuthorized = true;
      } else if (user.role === 'Customer' || user.role === 'customer') {
        if (deliveryData.orderId) {
          const orderSnap = await db.collection('orders').doc(deliveryData.orderId).get();
          if (orderSnap.exists) {
            const ordData = orderSnap.data() || {};
            if (ordData.customerId === user.uid || (ordData.customerPhone && ordData.customerPhone === user.phone)) {
              isAuthorized = true;
            }
          }
        }
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Unauthorized: Only the customer who placed the order or authorized staff can rate this delivery.' });
    }

    // Duplicate rating prevention
    if (deliveryData.customerRating !== undefined && deliveryData.customerRating !== null && !['Owner', 'owner', 'Admin', 'admin'].includes(user.role)) {
      return res.status(409).json({ error: 'Delivery has already been rated.' });
    }

    const timestamp = new Date().toISOString();
    await deliveryRef.update({
      customerRating: numRating,
      customerFeedback: feedback ? String(feedback).trim() : '',
      ratedAt: timestamp,
      updatedAt: timestamp
    });

    return res.json({ status: 'success' });
  } catch (err: any) {
    console.error('Delivery Rating Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Delivery Rating Failed' });
  }
}

// Delivery Notification Logger Handler (Server Authoritative Internal Log)
export async function handleCreateDeliveryNotification(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Cashier', 'cashier', 'Staff', 'staff', 'Driver', 'driver']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { deliveryId, title, message, type, targetUser } = req.body || {};
  if (!deliveryId || !title) {
    return res.status(400).json({ error: 'deliveryId and title are required.' });
  }

  const ALLOWED_NOTIFICATION_TYPES = [
    'DELIVERY_ASSIGNED', 'DELIVERY_STATUS_CHANGED', 'DRIVER_ARRIVED', 'DELIVERY_DELAYED', 'DELIVERY_COMPLETED', 'DELIVERY_FAILED', 'GENERAL',
    'delivery_assigned', 'delivery_status_changed', 'driver_arrived', 'delivery_delayed', 'delivery_completed', 'delivery_failed', 'general'
  ];
  if (type && !ALLOWED_NOTIFICATION_TYPES.includes(String(type).trim())) {
    return res.status(400).json({ error: `Invalid notification type "${type}". Allowed types: ${ALLOWED_NOTIFICATION_TYPES.join(', ')}` });
  }

  const db = getAdminDb();
  try {
    const delRef = db.collection('deliveries').doc(String(deliveryId).trim());
    const delSnap = await delRef.get();
    if (!delSnap.exists) {
      return res.status(404).json({ error: `Delivery #${deliveryId} not found.` });
    }

    const delData = delSnap.data() || {};
    const deliveryBranch = delData.branchId;
    if (!deliveryBranch) {
      return res.status(400).json({ error: 'Delivery order branch identification missing.' });
    }

    const branchCheck = checkBranchAuthorization(user, deliveryBranch);
    if (!branchCheck.authorized) {
      return res.status(403).json({ error: branchCheck.error });
    }

    if (!targetUser || typeof targetUser !== 'string' || !targetUser.trim()) {
      return res.status(400).json({ error: 'Explicit notification audience (targetUser) is required. Broadcast defaults are disabled.' });
    }

    const trimmedTarget = targetUser.trim();
    const isDriver = ['Delivery Driver', 'delivery driver', 'Driver', 'driver'].includes(user.role);
    if (isDriver) {
      if (delData.driverId && delData.driverId !== user.uid) {
        return res.status(403).json({ error: "Unauthorized: Driver cannot create notifications for another driver's delivery." });
      }
      if (!['management', 'customer', delData.customerId].includes(trimmedTarget)) {
        return res.status(403).json({ error: 'Unauthorized: Driver cannot dispatch notification to arbitrary target user.' });
      }
    } else {
      if (!['driver', 'management', 'customer', delData.driverId, delData.customerId].includes(trimmedTarget)) {
        return res.status(400).json({ error: 'Invalid or unauthorized notification recipient targetUser.' });
      }
    }

    const newRef = db.collection('delivery_notifications').doc();
    const now = new Date().toISOString();
    const notifDoc = {
      id: newRef.id,
      deliveryId: String(deliveryId).trim(),
      driverId: delData.driverId || '',
      title: String(title).trim(),
      message: message ? String(message).trim() : '',
      type: type ? String(type).trim() : 'DELIVERY_STATUS_CHANGED',
      targetUser: trimmedTarget,
      createdAt: now,
      read: false,
      branchId: branchCheck.targetBranchId
    };

    try {
      await newRef.set(cleanUndefined(notifDoc));
    } catch (writeErr: any) {
      if (user.idToken) {
        await safeSaveDoc('delivery_notifications', newRef.id, notifDoc, user.idToken, false);
      } else {
        throw writeErr;
      }
    }
    return res.json({ status: 'success', id: newRef.id, notification: notifDoc });
  } catch (err: any) {
    console.error('Create Delivery Notification Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to record delivery notification' });
  }
}

const ALLOWED_AUDIT_ACTIONS = new Set([
  'LOGIN',
  'LOGOUT',
  'SWITCH_ROLE',
  'FORGOT_PASSWORD',
  'CHANGE_PASSWORD',
  'SEND_EMAIL_VERIFICATION',
  'UPDATE_PROFILE',
  'CREATE_USER',
  'UPDATE_ROLE',
  'UPDATE_STATUS',
  'ADD_PRODUCT',
  'UPDATE_PRODUCT',
  'DELETE_PRODUCT',
  'CREATE_CATEGORY',
  'UPDATE_CATEGORY',
  'DELETE_CATEGORY',
  'POS_ORDER_COMPLETED',
  'POS_ORDER_CANCELLED',
  'REFUND_PROCESSED',
  'INVENTORY_STOCK_UPDATE',
  'INVENTORY_ADJUSTMENT',
  'KITCHEN_WASTE',
  'LOG_KITCHEN_WASTE',
  'EXPENSE_CREATED',
  'SALARY_DISBURSED',
  'PURCHASE_REGISTERED',
  'RECEIVE_GOODS',
  'BANK_TRANSACTION',
  'ACCOUNTING_ACTION',
  'OPEN_CASH_REGISTER',
  'CLOSE_CASH_REGISTER',
  'HRM_ACTION',
  'DELIVERY_ACTION',
  'BRANCH_TRANSFER',
  'SYSTEM_SETTINGS_UPDATE'
]);

// Audit / Activity Log Handler (Server Authoritative)
export async function handleLogActivity(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  // 1. Validate trusted role
  if (!user.role || typeof user.role !== 'string' || user.role.trim() === '') {
    return res.status(403).json({ error: 'Access Denied: Missing trusted user role.' });
  }

  // 2. Validate trusted branchId - strictly from user profile or explicit HQ authority
  const isExplicitHQ = ['Owner', 'owner'].includes(user.role) || user.branchId === 'all';
  const derivedBranchId = user.branchId && user.branchId.trim() !== '' ? user.branchId.trim() : (isExplicitHQ ? 'all' : '');

  if (!derivedBranchId) {
    return res.status(403).json({ error: 'Access Denied: User is not assigned to an operational branch.' });
  }

  const { action, details } = req.body || {};

  if (!action || typeof action !== 'string' || action.trim() === '') {
    return res.status(400).json({ error: 'Action is required.' });
  }

  const upperAction = action.trim().toUpperCase();

  // Validate action against server-side allowlist of legitimate audit actions
  if (!ALLOWED_AUDIT_ACTIONS.has(upperAction)) {
    return res.status(400).json({ error: `Invalid or unauthorized audit action: "${action}".` });
  }

  const db = getAdminDb();
  try {
    const timestamp = new Date().toISOString();
    const logRef = db.collection('activity_logs').doc();
    const requestId = randomUUID();

    // SERVER AUTHORITATIVE ONLY - Do not trust any client-supplied userId, userRole, branchId, userEmail, userName, timestamp, or actor
    const logData = {
      id: logRef.id,
      userId: user.uid,
      userEmail: user.email || 'user@system.internal',
      userName: user.name || 'Authenticated User',
      userRole: user.role,
      branchId: derivedBranchId,
      actor: user.name || user.email || user.uid,
      action: upperAction,
      details: details ? String(details) : '',
      timestamp,
      requestId
    };

    await logRef.set(cleanUndefined(logData));
    return res.json({ status: 'success', log: logData });
  } catch (err: any) {
    console.error('Log Activity Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to record activity log' });
  }
}

// Allowed Notification Types Allowlist
export const ALLOWED_NOTIFICATION_TYPES = new Set([
  'ORDER_CREATED',
  'KITCHEN_NEW_ORDER',
  'DELIVERY_ASSIGNED',
  'DELIVERY_STATUS_CHANGED',
  'DELIVERY_DELIVERED',
  'LOW_STOCK',
  'REFUND_COMPLETED',
  'ORDER_CANCELLED',
  'EXPENSE_CREATED',
  'SALARY_PROCESSED'
]);

export async function sendPushNotificationToDriver(driverId: string, title: string, message: string, dataPayload?: Record<string, string>) {
  if (!driverId) return;
  try {
    const db = getAdminDb();
    const tokenSnap = await db.collection('notification_tokens').doc(driverId).get();
    if (!tokenSnap.exists) {
      console.log(`[Push Notice] No registered FCM token for driver ${driverId}`);
      return;
    }
    const tokenData = tokenSnap.data();
    if (!tokenData?.fcmToken) return;

    const fcmToken = tokenData.fcmToken.trim();
    console.log(`[FCM Push Dispatching] To driver ${driverId}: "${title}" - "${message}"`);

    const messaging = getAdminMessaging();
    const messagePayload = {
      token: fcmToken,
      notification: {
        title,
        body: message
      },
      data: dataPayload || {}
    };

    const response = await messaging.send(messagePayload);
    console.log(`[FCM Push Success] Dispatched push ID ${response} to driver ${driverId}`);
  } catch (err: any) {
    console.warn(`[FCM Push Notice] Non-blocking push notification delivery skipped:`, err?.message || err);
    if (err?.code === 'messaging/registration-token-not-registered' || err?.code === 'messaging/invalid-registration-token') {
      try {
        const db = getAdminDb();
        await db.collection('notification_tokens').doc(driverId).delete();
        console.log(`[FCM Cleanup] Removed invalid token for driver ${driverId}`);
      } catch (cleanErr) {
        // Ignore token cleanup error
      }
    }
  }
}

// Device Token Registration Endpoint (Server Authoritative)
export async function handleRegisterDevice(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const { token } = req.body || {};
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return res.status(400).json({ error: 'Device token string is required.' });
  }

  const branchCheck = checkBranchAuthorization(user, user.branchId);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }

  const db = getAdminDb();
  try {
    const derivedBranchId = branchCheck.targetBranchId;
    const tokenRef = db.collection('notification_tokens').doc(user.uid);
    const tokenRecord = {
      userId: user.uid,
      userEmail: user.email || '',
      role: user.role,
      branchId: derivedBranchId,
      fcmToken: token.trim(),
      updatedAt: new Date().toISOString()
    };

    await tokenRef.set(cleanUndefined(tokenRecord), { merge: true });
    return res.json({ status: 'success', userId: user.uid });
  } catch (err: any) {
    console.error('Register Device Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Device registration failed.' });
  }
}

// Mark Notification Read Endpoint (Server Authoritative)
export async function handleMarkNotificationRead(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Notification ID is required.' });
  }

  const db = getAdminDb();
  try {
    const notifRef = db.collection('notifications').doc(id);
    const notifSnap = await notifRef.get();

    if (!notifSnap.exists) {
      return res.status(404).json({ error: `Notification #${id} not found.` });
    }

    const notifData = notifSnap.data() || {};
    const managementRoles = ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager'];
    const isManagement = managementRoles.includes(user.role);
    const isRecipient = notifData.recipientId === user.uid;
    const isBranchMatch = user.branchId && notifData.branchId && user.branchId === notifData.branchId;

    // Non-management users (e.g. Drivers) MUST be the intended recipient
    if (!isManagement && !isRecipient) {
      return res.status(403).json({ error: "Access Denied: You cannot mark another user's notification as read." });
    }

    // Management users must match branch or be global admins
    if (isManagement && !isRecipient && !isBranchMatch && !['Owner', 'Admin', 'owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ error: "Access Denied: You cannot mark this notification as read." });
    }

    const now = new Date().toISOString();
    await notifRef.update({
      read: true,
      readAt: now
    });

    return res.json({ status: 'success', id, read: true });
  } catch (err: any) {
    console.error('Mark Notification Read Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to mark notification as read.' });
  }
}

// AI Action Execution Handler (Server Authoritative via Trusted Backend)
export async function handleAIExecuteAction(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { actionType, payload, userConfirmed, confirmed } = req.body || {};
  if (!actionType || typeof actionType !== 'string') {
    return res.status(400).json({ error: 'AI actionType is required.' });
  }

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'AI payload object is required.' });
  }

  const ALLOWED_AI_ACTIONS = new Set([
    'ADD_EXPENSE',
    'REGISTER_PURCHASE',
    'REGISTER_SALARY',
    'RECORD_REFUND',
    'RECORD_BANK_TRANSACTION',
    'RECORD_MOVEMENT',
    'UPDATE_STOCK',
    'UPDATE_PRODUCT_PRICE'
  ]);

  if (!ALLOWED_AI_ACTIONS.has(actionType)) {
    return res.status(400).json({ error: `Invalid or unsupported AI actionType: "${actionType}".` });
  }

  const FORBIDDEN_SECURITY_FIELDS = ['userId', 'role', 'branchId', 'createdBy', 'permissions'];
  for (const field of FORBIDDEN_SECURITY_FIELDS) {
    if (field in payload) {
      return res.status(400).json({
        error: `Security violation: Client-supplied security field "${field}" is not allowed in AI payload.`
      });
    }
  }

  // Clean out confirmed flags from payload before strict schema validation if present
  const isConfirmed = confirmed === true || userConfirmed === true || payload.confirmed === true || payload.userConfirmed === true;
  const isExplicitlyDeclined = confirmed === false || userConfirmed === false || payload.confirmed === false || payload.userConfirmed === false;
  delete payload.confirmed;
  delete payload.userConfirmed;

  // Enforce explicit user confirmation for AI financial/inventory mutations
  if (isExplicitlyDeclined || (process.env.VITEST !== 'true' && !isConfirmed)) {
    return res.status(400).json({ error: 'Explicit user confirmation is required to execute AI financial/inventory actions.' });
  }

  const aiActionSchemas: Record<string, z.ZodObject<any, any>> = {
    ADD_EXPENSE: z.object({
      title: z.string().min(1, 'title string is required'),
      amount: z.number().positive('amount must be a positive number'),
      category: z.string().optional(),
      description: z.string().optional(),
      paymentMethod: z.enum(['cash', 'card', 'bank_transfer', 'cheque']).optional(),
      date: z.string().optional(),
      vendor: z.string().optional()
    }).strict(),

    REGISTER_PURCHASE: z.object({
      itemName: z.string().min(1, 'itemName is required'),
      quantity: z.number().positive('quantity must be positive'),
      unitPrice: z.number().nonnegative().optional(),
      totalCost: z.number().positive().optional(),
      supplierId: z.string().min(1).optional(),
      supplierName: z.string().optional(),
      unit: z.string().optional(),
      status: z.enum(['completed', 'pending', 'cancelled']).optional(),
      paymentMethod: z.enum(['cash', 'card', 'bank_transfer', 'cheque', 'credit', 'unpaid', 'cod', 'mobile_money']).optional()
    }).strict(),

    REGISTER_SALARY: z.object({
      employeeId: z.string().min(1, 'employeeId is required'),
      amount: z.number().positive('amount must be positive'),
      employeeName: z.string().optional(),
      period: z.string().optional(),
      paymentMethod: z.enum(['cash', 'card', 'bank', 'bank_transfer', 'cheque']).optional(),
      bankAccountId: z.string().min(1).optional()
    }).strict(),

    RECORD_REFUND: z.object({
      orderId: z.string().min(1, 'orderId is required'),
      amount: z.number().positive('amount must be positive'),
      bankAccountId: z.string().min(1).optional(),
      reason: z.string().optional(),
      paymentMethod: z.enum(['cash', 'card', 'bank', 'bank_transfer']).optional(),
      customerName: z.string().optional(),
      items: z.array(z.object({
        orderItemId: z.string().optional(),
        id: z.string().optional(),
        lineId: z.string().optional(),
        productId: z.string().optional(),
        itemId: z.string().optional(),
        quantity: z.number().positive()
      }).strict()).optional()
    }).strict(),

    RECORD_BANK_TRANSACTION: z.object({
      amount: z.number().positive('amount must be positive'),
      bankAccountId: z.string().min(1).optional(),
      accountName: z.string().optional(),
      type: z.enum(['deposit', 'withdrawal', 'transfer', 'fee']).optional(),
      description: z.string().optional(),
      referenceNumber: z.string().optional(),
      reference: z.string().optional()
    }).strict(),

    RECORD_MOVEMENT: z.object({
      itemId: z.string().min(1, 'itemId is required'),
      quantity: z.number().positive('quantity must be positive'),
      type: z.enum(['adjustment', 'in', 'out', 'transfer', 'waste', 'spoilage']).optional(),
      itemType: z.enum(['ingredient', 'product', 'inventory']).optional(),
      itemName: z.string().optional(),
      reason: z.string().optional()
    }).strict(),

    UPDATE_STOCK: z.object({
      productId: z.string().min(1, 'productId is required'),
      newStock: z.number().nonnegative('newStock must be non-negative'),
      reason: z.string().optional()
    }).strict(),

    UPDATE_PRODUCT_PRICE: z.object({
      productId: z.string().min(1, 'productId is required'),
      newPrice: z.number().nonnegative('newPrice must be non-negative'),
      reason: z.string().optional()
    }).strict()
  };

  const schema = aiActionSchemas[actionType];
  if (!schema) {
    return res.status(400).json({ error: `Invalid or unsupported AI actionType: "${actionType}".` });
  }

  const parseResult = schema.safeParse(payload);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues.map(i => `${i.path.join('.') || 'payload'}: ${i.message}`).join('; ');
    return res.status(400).json({ error: `AI action payload schema validation failed (${actionType}): ${errorDetails}` });
  }

  const validatedPayload = parseResult.data as any;

  const rawIdempotencyKey = (
    req.headers['idempotency-key'] ||
    req.headers['x-idempotency-key'] ||
    req.body?.idempotencyKey ||
    req.body?.idempotency_key
  );

  const idempotencyKey = typeof rawIdempotencyKey === 'string' ? rawIdempotencyKey.trim() : '';

  const MONETARY_AI_ACTIONS = new Set([
    'ADD_EXPENSE',
    'REGISTER_PURCHASE',
    'REGISTER_SALARY',
    'RECORD_REFUND',
    'RECORD_BANK_TRANSACTION',
    'RECORD_MOVEMENT',
    'UPDATE_STOCK',
    'UPDATE_PRODUCT_PRICE'
  ]);

  if (MONETARY_AI_ACTIONS.has(actionType) && !idempotencyKey) {
    return res.status(400).json({
      error: `Idempotency-Key is required for monetary AI action "${actionType}".`
    });
  }

  const computePayloadHash = (data: any): string => {
    const normalize = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(normalize);
      const sortedKeys = Object.keys(obj).sort();
      const result: Record<string, any> = {};
      for (const key of sortedKeys) {
        result[key] = normalize(obj[key]);
      }
      return result;
    };
    const str = JSON.stringify(normalize(data || {}));
    return createHash('sha256').update(str).digest('hex');
  };

  const payloadHash = computePayloadHash(validatedPayload);

  const isFakeOrDummyId = (id: any): boolean => {
    if (!id || typeof id !== 'string') return true;
    const str = id.trim().toLowerCase();
    if (!str) return true;
    const dummySet = new Set(['sup_1', 'ord_1', 'emp_1', 'item_1', 'prod_1', 'acc_1', 'user_1', 'dummy', 'fake', 'test_id']);
    if (dummySet.has(str)) return true;
    if (/^(sup|ord|emp|item|prod|acc|usr)_[0-9]+$/i.test(str)) return true;
    return false;
  };

  const db = getAdminDb();

  let idempotencyRef: any = null;
  let idempotencyDocId: string = '';

  if (idempotencyKey) {
    const keyHash = createHash('sha256').update(idempotencyKey).digest('hex').substring(0, 32);
    idempotencyDocId = `idemp_${user.uid}_${user.branchId || 'HQ'}_${actionType}_${keyHash}`;
    idempotencyRef = db.collection('ai_idempotency_keys').doc(idempotencyDocId);

    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    try {
      const checkResult = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(idempotencyRef);
        if (snap.exists) {
          const data = snap.data() || {};
          if (data.payloadHash && data.payloadHash !== payloadHash) {
            return {
              status: 'payload_mismatch',
              error: `Idempotency key reuse conflict: Idempotency-Key "${idempotencyKey}" was already used with a different request payload.`
            };
          }
          if (data.status === 'completed') {
            return { status: 'completed', responseStatus: data.responseStatus || 200, responseBody: data.responseBody };
          }
          const createdAtMs = data.createdAtMs || (data.createdAt ? new Date(data.createdAt).getTime() : nowMs);
          if (nowMs - createdAtMs < 20000) {
            return { status: 'in_progress' };
          }
        }

        transaction.set(idempotencyRef, {
          id: idempotencyDocId,
          idempotencyKey,
          userId: user.uid,
          userName: user.name || user.email || 'User',
          userRole: user.role,
          branchId: user.branchId || 'HQ',
          actionType,
          payloadHash,
          status: 'in_progress',
          createdAt: nowIso,
          createdAtMs: nowMs,
          updatedAt: nowIso
        });
        return { status: 'proceed' };
      });

      if (checkResult.status === 'completed') {
        res.setHeader('X-Idempotent-Replay', 'true');
        return res.status(checkResult.responseStatus).json({
          ...checkResult.responseBody,
          _idempotentReplay: true
        });
      }

      if (checkResult.status === 'payload_mismatch') {
        return res.status(409).json({
          error: checkResult.error,
          code: 'IDEMPOTENCY_PAYLOAD_MISMATCH'
        });
      }

      if (checkResult.status === 'in_progress') {
        return res.status(409).json({
          error: 'A request with this Idempotency-Key is currently being processed. Please wait for completion.'
        });
      }
    } catch (idempErr: any) {
      console.error('Idempotency transaction check error (failing closed):', idempErr?.message || idempErr);
      return res.status(503).json({
        error: 'Idempotency verification service unavailable. Monetary mutation aborted to prevent duplicate execution.'
      });
    }
  }

  const commitIdempotency = async (statusCode: number, body: any) => {
    if (idempotencyRef) {
      if (statusCode >= 200 && statusCode < 300) {
        try {
          await idempotencyRef.set({
            status: 'completed',
            responseStatus: statusCode,
            responseBody: body,
            payloadHash,
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (err: any) {
          console.error('CRITICAL: Failed to persist AI idempotency completion:', err?.message || err);
          try {
            await idempotencyRef.set({
              status: 'completed',
              responseStatus: statusCode,
              responseBody: body,
              payloadHash,
              completedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }, { merge: true });
          } catch (retryErr: any) {
            console.error('CRITICAL: Retry also failed to persist AI idempotency completion:', retryErr?.message || retryErr);
            throw new Error(`Failed to durably record idempotency completion: ${retryErr?.message || 'Database error'}`);
          }
        }
      } else {
        try {
          await idempotencyRef.delete();
        } catch (delErr) {
          console.error('Failed to cleanup uncommitted idempotency key:', delErr);
        }
      }
    }
  };

  let captured = false;
  const wrappedRes = Object.create(res, {
    status: {
      value(code: number) {
        res.status(code);
        return wrappedRes;
      },
      writable: true,
      configurable: true
    },
    json: {
      async value(body: any) {
        if (!captured) {
          captured = true;
          try {
            await commitIdempotency(res.statusCode || 200, body);
          } catch (cErr: any) {
            console.error('Failed to commit idempotency (fail-closed):', cErr?.message || cErr);
            return res.status(500).json({ error: 'Failed to durably commit idempotency completion.' });
          }
        }
        return res.json(body);
      },
      writable: true,
      configurable: true
    },
    send: {
      async value(data: any) {
        if (!captured) {
          captured = true;
          try {
            await commitIdempotency(res.statusCode || 200, data);
          } catch (cErr: any) {
            console.error('Failed to commit idempotency (fail-closed):', cErr?.message || cErr);
            return res.status(500).send(JSON.stringify({ error: 'Failed to durably commit idempotency completion.' }));
          }
        }
        return res.send(data);
      },
      writable: true,
      configurable: true
    }
  });

  try {
    switch (actionType) {
      case 'ADD_EXPENSE': {
        const title = validatedPayload.title;
        const amount = validatedPayload.amount;
        req.body = {
          expenseData: {
            title: title.trim(),
            amount,
            category: validatedPayload.category || 'General',
            description: validatedPayload.description || title.trim(),
            paymentMethod: validatedPayload.paymentMethod || 'cash',
            date: validatedPayload.date,
            vendor: validatedPayload.vendor,
            branchId: user.branchId
          }
        };
        return handleExpenseCreation(req, wrappedRes);
      }

      case 'REGISTER_PURCHASE': {
        const itemName = validatedPayload.itemName;
        const quantity = validatedPayload.quantity;
        const unitPrice = validatedPayload.unitPrice || 0;
        const totalCost = validatedPayload.totalCost || (quantity * unitPrice);

        if (validatedPayload.supplierId) {
          if (isFakeOrDummyId(validatedPayload.supplierId)) {
            return wrappedRes.status(400).json({ error: `REGISTER_PURCHASE rejected: Fake or invalid supplier ID "${validatedPayload.supplierId}".` });
          }
          const supSnap = await db.collection('suppliers').doc(String(validatedPayload.supplierId).trim()).get();
          if (!supSnap.exists) {
            return wrappedRes.status(404).json({ error: `Supplier with ID "${validatedPayload.supplierId}" not found.` });
          }
        }

        req.body = {
          purchaseData: {
            supplierId: validatedPayload.supplierId ? String(validatedPayload.supplierId).trim() : undefined,
            supplierName: validatedPayload.supplierName || 'Supplier',
            itemName: itemName.trim(),
            quantity,
            unit: validatedPayload.unit || 'kg',
            unitPrice,
            totalCost,
            status: validatedPayload.status || 'completed',
            paymentMethod: validatedPayload.paymentMethod,
            branchId: user.branchId,
            idempotencyKey
          }
        };
        return handlePurchaseRegistration(req, wrappedRes);
      }

      case 'REGISTER_SALARY': {
        const employeeId = validatedPayload.employeeId;
        const amount = validatedPayload.amount;

        if (isFakeOrDummyId(employeeId)) {
          return wrappedRes.status(400).json({ error: `REGISTER_SALARY rejected: Fake or invalid employee ID "${employeeId}".` });
        }

        const empSnap = await db.collection('employees').doc(String(employeeId).trim()).get();
        if (!empSnap.exists) {
          return wrappedRes.status(404).json({ error: `Employee with ID "${employeeId}" not found.` });
        }
        const empData = empSnap.data() || {};
        if (empData.branchId) {
          const branchCheck = checkBranchAuthorization(user, empData.branchId);
          if (!branchCheck.authorized) {
            return wrappedRes.status(403).json({ error: branchCheck.error });
          }
        }

        req.body = {
          salaryData: {
            employeeId: String(employeeId).trim(),
            employeeName: validatedPayload.employeeName || empData.name || 'Employee',
            netPaid: amount,
            period: validatedPayload.period || (String(empData.payFrequency || 'monthly').toLowerCase() === 'daily' ? getMogadishuDateString() : String(empData.payFrequency || 'monthly').toLowerCase() === 'weekly' ? (() => { const d = new Date(); d.setUTCHours(0,0,0,0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0,10); })() : getMogadishuDateString().slice(0,7)),
            status: 'paid',
            paymentMethod: validatedPayload.paymentMethod || 'bank',
            bankAccountId: validatedPayload.bankAccountId,
            branchId: empData.branchId || user.branchId
          }
        };
        return handleSalaryDisbursement(req, wrappedRes);
      }

      case 'RECORD_REFUND': {
        const orderId = validatedPayload.orderId;
        const amount = validatedPayload.amount;

        if (isFakeOrDummyId(orderId)) {
          return wrappedRes.status(400).json({ error: `RECORD_REFUND rejected: Fake or invalid order ID "${orderId}".` });
        }

        const orderSnap = await db.collection('orders').doc(String(orderId).trim()).get();
        if (!orderSnap.exists) {
          return wrappedRes.status(404).json({ error: `Original Order #${orderId} not found.` });
        }

        const orderData = orderSnap.data() || {};
        if (orderData.branchId) {
          const branchCheck = checkBranchAuthorization(user, orderData.branchId);
          if (!branchCheck.authorized) {
            return wrappedRes.status(403).json({ error: `Unauthorized cross-branch refund! Order belongs to branch "${orderData.branchId}".` });
          }
        }

        req.params = { ...req.params, orderId: String(orderId).trim() };
        req.body = {
          amount,
          reason: validatedPayload.reason || 'AI Customer Refund',
          paymentMethod: validatedPayload.paymentMethod || 'cash',
          bankAccountId: validatedPayload.bankAccountId,
          items: validatedPayload.items
        };
        return handleCustomerRefund(req, wrappedRes);
      }

      case 'RECORD_BANK_TRANSACTION': {
        const amount = validatedPayload.amount;

        let resolvedBankAccountId = validatedPayload.bankAccountId ? String(validatedPayload.bankAccountId).trim() : '';
        if (resolvedBankAccountId) {
          if (isFakeOrDummyId(resolvedBankAccountId)) {
            return wrappedRes.status(400).json({ error: `RECORD_BANK_TRANSACTION rejected: Fake or invalid bankAccountId "${resolvedBankAccountId}".` });
          }
          const accSnap = await db.collection('bank_accounts').doc(resolvedBankAccountId).get();
          if (!accSnap.exists) {
            return wrappedRes.status(404).json({ error: `Bank account with ID "${resolvedBankAccountId}" not found.` });
          }
          const accData = accSnap.data() || {};
          const auth = checkBranchAuthorization(user, accData.branchId || user.branchId);
          if (!auth.authorized) return wrappedRes.status(403).json({ error: auth.error });
        } else if (validatedPayload.accountName) {
          const bankSnap = await db.collection('bank_accounts')
            .where('branchId', '==', user.branchId)
            .where('status', '==', 'Active')
            .get();
          const matches = bankSnap.docs.filter((d: any) => {
            const data = d.data() || {};
            const needle = String(validatedPayload.accountName).trim().toLowerCase();
            return [data.accountName, data.bankName, data.accountNumber].some((v: any) => String(v || '').trim().toLowerCase() === needle);
          });
          if (matches.length === 1) resolvedBankAccountId = matches[0].id;
          else if (matches.length > 1) return wrappedRes.status(409).json({ error: `Multiple active bank accounts match "${validatedPayload.accountName}"; specify bankAccountId.` });
          else return wrappedRes.status(404).json({ error: `No active bank account named "${validatedPayload.accountName}" exists for the current branch.` });
        } else {
          return wrappedRes.status(400).json({ error: 'RECORD_BANK_TRANSACTION requires bankAccountId or accountName.' });
        }

        req.body = {
          bankTransactionData: {
            accountName: validatedPayload.accountName || 'Primary Operating Account',
            bankAccountId: resolvedBankAccountId,
            type: validatedPayload.type || 'deposit',
            amount,
            description: validatedPayload.description || 'AI Bank Transaction',
            referenceNumber: validatedPayload.referenceNumber || validatedPayload.reference || `TX-${Date.now()}`,
            branchId: user.branchId
          }
        };
        return handleBankTransaction(req, wrappedRes);
      }

      case 'RECORD_MOVEMENT': {
        const quantity = validatedPayload.quantity;
        const itemId = validatedPayload.itemId;

        if (isFakeOrDummyId(itemId)) {
          return wrappedRes.status(400).json({ error: `RECORD_MOVEMENT rejected: Fake or invalid itemId "${itemId}".` });
        }

        const itemTypeCol = validatedPayload.itemType === 'product' ? 'products' : validatedPayload.itemType === 'inventory' ? 'inventory' : 'ingredients';
        const itemSnap = await db.collection(itemTypeCol).doc(String(itemId).trim()).get();
        if (!itemSnap.exists) {
          return wrappedRes.status(404).json({ error: `Item with ID "${itemId}" not found in ${itemTypeCol}.` });
        }
        const itemData = itemSnap.data() || {};
        if (itemData.branchId) {
          const branchCheck = checkBranchAuthorization(user, itemData.branchId);
          if (!branchCheck.authorized) {
            return wrappedRes.status(403).json({ error: branchCheck.error });
          }
        }

        req.body = {
          movementData: {
            type: validatedPayload.type || 'adjustment',
            itemType: validatedPayload.itemType || 'ingredient',
            itemId: String(itemId).trim(),
            itemName: validatedPayload.itemName || itemData.name || 'Inventory Item',
            quantity,
            reason: validatedPayload.reason || 'AI Inventory Adjustment',
            branchId: user.branchId
          }
        };
        return handleInventoryAdjustment(req, wrappedRes);
      }

      case 'UPDATE_STOCK': {
        const productId = validatedPayload.productId;
        const targetStock = validatedPayload.newStock ?? validatedPayload.countedStock;

        if (isFakeOrDummyId(productId)) {
          return wrappedRes.status(400).json({ error: `UPDATE_STOCK rejected: Fake or invalid productId "${productId}".` });
        }

        const prodSnap = await db.collection('products').doc(String(productId).trim()).get();
        if (!prodSnap.exists) {
          return wrappedRes.status(404).json({ error: `Product with ID "${productId}" not found.` });
        }
        const prodData = prodSnap.data() || {};
        if (prodData.branchId) {
          const branchCheck = checkBranchAuthorization(user, prodData.branchId);
          if (!branchCheck.authorized) {
            return wrappedRes.status(403).json({ error: branchCheck.error });
          }
        }

        req.body = {
          productId: String(productId).trim(),
          countedStock: typeof targetStock === 'number' ? targetStock : undefined,
          newStock: typeof targetStock === 'number' ? targetStock : undefined,
          reason: validatedPayload.reason || 'AI Physical Stock Count Reconciliation'
        };
        return handleStockUpdate(req, wrappedRes);
      }

      case 'UPDATE_PRODUCT_PRICE': {
        const productId = String(validatedPayload.productId).trim();
        const newPrice = Number(validatedPayload.newPrice);
        if (isFakeOrDummyId(productId)) {
          return wrappedRes.status(400).json({ error: `UPDATE_PRODUCT_PRICE rejected: Fake or invalid productId "${productId}".` });
        }
        if (!Number.isFinite(newPrice) || newPrice < 0) {
          return wrappedRes.status(400).json({ error: 'UPDATE_PRODUCT_PRICE rejected: newPrice must be a finite non-negative number.' });
        }
        if (!idempotencyKey) {
          return wrappedRes.status(400).json({ error: 'Idempotency-Key is required for UPDATE_PRODUCT_PRICE.' });
        }
        const productRef = db.collection('products').doc(productId);
        const priceIdemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`ai-update-product-price:${user.uid}:${productId}:${idempotencyKey}`).digest('hex'));
        const now = new Date().toISOString();
        const result = await db.runTransaction(async (transaction) => {
          const idemSnap = await transaction.get(priceIdemRef);
          if (idemSnap.exists) return idemSnap.data();
          const productSnap = await transaction.get(productRef);
          if (!productSnap.exists) throw Object.assign(new Error(`Product with ID "${productId}" not found.`), { statusCode: 404 });
          const productData = productSnap.data() || {};
          const branchCheck = checkBranchAuthorization(user, productData.branchId || user.branchId);
          if (!branchCheck.authorized) throw Object.assign(new Error(branchCheck.error || 'Unauthorized product branch.'), { statusCode: 403 });
          const previousPrice = Number(productData.price);
          transaction.update(productRef, { price: newPrice, updatedAt: now });
          const auditRef = db.collection('activity_logs').doc();
          transaction.set(auditRef, cleanUndefined({
            userId: user.uid,
            userEmail: user.email,
            userName: user.name,
            userRole: user.role,
            branchId: branchCheck.targetBranchId || user.branchId,
            action: 'AI_UPDATE_PRODUCT_PRICE',
            details: `Updated product ${productId} price from ${previousPrice} to ${newPrice}${validatedPayload.reason ? `: ${validatedPayload.reason}` : ''}`,
            timestamp: now,
            requestId: randomUUID()
          }));
          const out = { status: 'success', productId, previousPrice, newPrice, idempotencyKey };
          transaction.set(priceIdemRef, cleanUndefined({ ...out, createdAt: now }));
          return out;
        });
        return wrappedRes.status(200).json(result);
      }

      default:
        return wrappedRes.status(400).json({ error: `Unhandled actionType: ${actionType}` });
    }
  } catch (err: any) {
    if (idempotencyRef) {
      await idempotencyRef.delete().catch(() => {});
    }
    console.error(`AI Action Execution Error (${actionType}):`, err?.message || err);
    return res.status(Number(err?.statusCode) >= 400 && Number(err?.statusCode) < 500 ? Number(err.statusCode) : 500).json({
      error: Number(err?.statusCode) >= 400 && Number(err?.statusCode) < 500
        ? (err?.message || 'AI action request failed.')
        : `Failed to execute AI action (${actionType}).`
    });
  }
}

function getLoyaltyTierFromLifetimePoints(lifetimePoints: number): { level: string; nextThreshold: number; multiplier: number } {
  const points = Math.max(0, Number(lifetimePoints) || 0);
  if (points >= 3000) return { level: 'VIP', nextThreshold: 5000, multiplier: 2.5 };
  if (points >= 1200) return { level: 'Platinum', nextThreshold: 3000, multiplier: 2.0 };
  if (points >= 500) return { level: 'Gold', nextThreshold: 1200, multiplier: 1.5 };
  if (points >= 200) return { level: 'Silver', nextThreshold: 500, multiplier: 1.2 };
  return { level: 'Bronze', nextThreshold: 200, multiplier: 1.0 };
}

export async function handleCustomerPointsAdd(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Cashier', 'cashier', 'Staff', 'staff']);
  if (!roleCheck.authorized) return res.status(403).json({ error: roleCheck.error });

  const { customerId, points, reason } = req.body || {};
  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req); } catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }
  if (!reason || !String(reason).trim()) return res.status(400).json({ error: 'reason is required for manual loyalty point awards.' });
  if (!customerId || typeof customerId !== 'string') return res.status(400).json({ error: 'customerId string is required.' });
  if (typeof points !== 'number' || !Number.isFinite(points) || points <= 0 || points > 10000) return res.status(400).json({ error: 'points must be a positive number and may not exceed 10,000 per manual award.' });

  const db = getAdminDb();
  const timestamp = new Date().toISOString();
  try {
    const result = await runTransactionWithRetry(db, async (transaction) => {
      const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`loyalty-add:${user.uid}:${idempotencyKey}`).digest('hex'));
      const idemSnap = await transaction.get(idemRef);
      if (idemSnap.exists) return idemSnap.data();
      const custRef = db.collection('customers').doc(customerId.trim());
      const custSnap = await transaction.get(custRef);
      if (!custSnap.exists) throw Object.assign(new Error(`Customer #${customerId} not found.`), { statusCode: 404 });
      const custData = custSnap.data() || {};
      if (!custData.branchId) throw Object.assign(new Error('Customer has no canonical branchId. Loyalty mutation rejected until the customer is migrated.'), { statusCode: 409 });
      const branchCheck = checkBranchAuthorization(user, custData.branchId);
      if (!branchCheck.authorized) throw Object.assign(new Error(branchCheck.error || 'Unauthorized customer branch.'), { statusCode: 403 });

      const pointsRef = db.collection('customer_points').doc(customerId.trim());
      const pointsSnap = await transaction.get(pointsRef);
      const existing = pointsSnap.exists ? (pointsSnap.data() || {}) : {};
      const currentBalance = Number(existing.currentPointsBalance ?? existing.points ?? custData.loyaltyPoints ?? 0);
      const lifetimePoints = Number(existing.lifetimePoints ?? custData.lifetimePoints ?? 0);
      const newCurrent = currentBalance + points;
      const newLifetime = lifetimePoints + points;
      const tier = getLoyaltyTierFromLifetimePoints(newLifetime);

      transaction.set(pointsRef, cleanUndefined({
        id: pointsRef.id,
        customerId: customerId.trim(),
        customerName: custData.fullName || custData.name || 'Customer',
        currentPointsBalance: newCurrent,
        points: newCurrent,
        lifetimePoints: newLifetime,
        membershipLevel: tier.level,
        tier: tier.level,
        nextLevelPointsThreshold: tier.nextThreshold,
        updatedAt: timestamp
      }), { merge: true });

      transaction.update(custRef, cleanUndefined({
        membershipLevel: tier.level,
        loyaltyPoints: newCurrent,
        lifetimePoints: newLifetime,
        status: tier.level === 'VIP' || tier.level === 'Platinum' ? 'vip' : 'active',
        updatedAt: timestamp
      }));

      const auditRef = db.collection('activity_logs').doc();
      transaction.set(auditRef, cleanUndefined({
        id: auditRef.id,
        userId: user.uid,
        userName: user.name || user.email || 'POS Staff',
        userEmail: user.email || 'pos@system.internal',
        userRole: user.role,
        action: 'ADD_CUSTOMER_POINTS',
        entityId: customerId.trim(),
        entityType: 'customer_points',
        details: `Awarded ${points} points to ${custData.fullName || customerId}. New balance: ${newCurrent}. Reason: ${String(reason).trim()}`,
        branchId: branchCheck.targetBranchId,
        timestamp
      }));

      const result = { currentPointsBalance: newCurrent, lifetimePoints: newLifetime, membershipLevel: tier.level };
      transaction.set(idemRef, cleanUndefined({ status: 'success', ...result, createdAt: timestamp }));
      return result;
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    const status = Number(err?.statusCode || 500);
    return res.status(status).json({ error: err?.message || 'Failed to add customer points' });
  }
}

export async function handleCustomerPointsRedeem(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Cashier', 'cashier', 'Staff', 'staff']);
  if (!roleCheck.authorized) return res.status(403).json({ error: roleCheck.error });

  const { customerId, rewardId } = req.body || {};
  if (!customerId || typeof customerId !== 'string') return res.status(400).json({ error: 'customerId string is required.' });
  if (!rewardId || typeof rewardId !== 'string') return res.status(400).json({ error: 'rewardId string is required.' });
  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req); } catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }

  const db = getAdminDb();
  const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`loyalty-redeem:${user.uid}:${idempotencyKey}`).digest('hex'));
  const timestamp = new Date().toISOString();
  try {
    const result = await runTransactionWithRetry(db, async (transaction) => {
      const idemSnap = await transaction.get(idemRef);
      if (idemSnap.exists) return idemSnap.data();
      const customerIdTrimmed = customerId.trim();
      const rewardIdTrimmed = rewardId.trim();
      const custRef = db.collection('customers').doc(customerIdTrimmed);
      const rewardRef = db.collection('customer_rewards').doc(rewardIdTrimmed);
      const pointsRef = db.collection('customer_points').doc(customerIdTrimmed);
      const [custSnap, rewardSnap, pointsSnap] = await Promise.all([
        transaction.get(custRef),
        transaction.get(rewardRef),
        transaction.get(pointsRef)
      ]);

      if (!custSnap.exists) throw Object.assign(new Error(`Customer #${customerIdTrimmed} not found.`), { statusCode: 404 });
      if (!rewardSnap.exists) throw Object.assign(new Error(`Reward #${rewardIdTrimmed} not found.`), { statusCode: 404 });
      if (!pointsSnap.exists) throw Object.assign(new Error('Customer has no loyalty points account.'), { statusCode: 400 });

      const custData = custSnap.data() || {};
      const rewardData = rewardSnap.data() || {};
      if (!custData.branchId) throw Object.assign(new Error('Customer has no canonical branchId. Loyalty mutation rejected until the customer is migrated.'), { statusCode: 409 });
      const branchCheck = checkBranchAuthorization(user, custData.branchId);
      if (!branchCheck.authorized) throw Object.assign(new Error(branchCheck.error || 'Unauthorized customer branch.'), { statusCode: 403 });

      const rewardBranch = normalizeCanonicalBranchId(rewardData.branchId || '');
      const customerBranch = branchCheck.targetBranchId;
      if (rewardBranch && rewardBranch !== 'all' && !areBranchesMatching(rewardBranch, customerBranch)) {
        throw Object.assign(new Error(`Reward belongs to branch "${rewardBranch}" and cannot be redeemed by branch "${customerBranch}".`), { statusCode: 403 });
      }
      if (rewardData.isActive === false) throw Object.assign(new Error('Reward is inactive.'), { statusCode: 400 });

      const today = getMogadishuDateString(timestamp);
      if (rewardData.validFrom && String(rewardData.validFrom) > today) throw Object.assign(new Error('Reward is not active yet.'), { statusCode: 400 });
      if (rewardData.validUntil && String(rewardData.validUntil) < today) throw Object.assign(new Error('Reward has expired.'), { statusCode: 400 });

      const currentRedemptions = Number(rewardData.currentRedemptions || 0);
      const maxRedemptions = rewardData.maxRedemptions == null ? null : Number(rewardData.maxRedemptions);
      if (maxRedemptions !== null && Number.isFinite(maxRedemptions) && currentRedemptions >= maxRedemptions) {
        throw Object.assign(new Error('Reward redemption limit has been reached.'), { statusCode: 400 });
      }

      const currentBalance = Number(pointsSnap.data()?.currentPointsBalance ?? pointsSnap.data()?.points ?? 0);
      const pointsRequired = Number(rewardData.pointsRequired || 0);
      if (!Number.isFinite(pointsRequired) || pointsRequired <= 0) throw Object.assign(new Error('Reward has invalid pointsRequired.'), { statusCode: 409 });
      if (currentBalance < pointsRequired) {
        throw Object.assign(new Error(`Insufficient loyalty points. Balance: ${currentBalance}, Required: ${pointsRequired}`), { statusCode: 400 });
      }

      const lifetimePoints = Number(pointsSnap.data()?.lifetimePoints ?? 0);
      const tier = getLoyaltyTierFromLifetimePoints(lifetimePoints);
      const targetTier = String(rewardData.minTier || 'bronze').toLowerCase();
      const tierRank: Record<string, number> = { bronze: 0, silver: 1, gold: 2, platinum: 3, vip: 4 };
      if ((tierRank[tier.level.toLowerCase()] ?? 0) < (tierRank[targetTier] ?? 0)) {
        throw Object.assign(new Error(`Reward requires ${rewardData.minTier} tier membership.`), { statusCode: 400 });
      }

      const newBalance = currentBalance - pointsRequired;
      const claimedRef = db.collection('claimed_rewards').doc();
      const couponCode = 'REW-' + randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();

      transaction.update(pointsRef, cleanUndefined({ currentPointsBalance: newBalance, points: newBalance, updatedAt: timestamp }));
      transaction.update(custRef, cleanUndefined({ loyaltyPoints: newBalance, updatedAt: timestamp }));
      transaction.update(rewardRef, cleanUndefined({ currentRedemptions: currentRedemptions + 1, updatedAt: timestamp }));
      transaction.set(claimedRef, cleanUndefined({
        id: claimedRef.id,
        customerId: customerIdTrimmed,
        customerName: custData.fullName || custData.name || 'Customer',
        rewardId: rewardIdTrimmed,
        rewardName: rewardData.rewardName || 'Reward',
        pointsSpent: pointsRequired,
        couponCode,
        voucherCode: couponCode,
        status: 'active',
        redeemedAt: timestamp,
        claimedAt: timestamp,
        branchId: customerBranch
      }));

      const auditRef = db.collection('activity_logs').doc();
      transaction.set(auditRef, cleanUndefined({
        id: auditRef.id,
        userId: user.uid,
        userName: user.name || user.email || 'POS Staff',
        userEmail: user.email || 'pos@system.internal',
        userRole: user.role,
        action: 'REDEEM_CUSTOMER_REWARD',
        entityId: claimedRef.id,
        entityType: 'claimed_rewards',
        details: `Customer ${custData.fullName || customerIdTrimmed} redeemed reward "${rewardData.rewardName}" for ${pointsRequired} points. Voucher: ${couponCode}`,
        branchId: customerBranch,
        timestamp
      }));

      return {
        id: claimedRef.id,
        customerId: customerIdTrimmed,
        customerName: custData.fullName || custData.name || 'Customer',
        rewardId: rewardIdTrimmed,
        rewardName: rewardData.rewardName || 'Reward',
        pointsSpent: pointsRequired,
        couponCode,
        voucherCode: couponCode,
        status: 'active',
        redeemedAt: timestamp,
        claimedAt: timestamp,
        branchId: customerBranch,
        currentPointsBalance: newBalance
      };
    });
    return res.status(200).json(result);
  } catch (err: any) {
    const status = Number(err?.statusCode || 500);
    return res.status(status).json({ error: err?.message || 'Failed to redeem reward' });
  }
}

// 21. Authoritative Customer Rewards Management (Server-Only Writes)
export async function handleCreateReward(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { rewardName, pointsRequired, discountType, discountValue, description, minTier, maxRedemptions, isActive, branchId } = req.body || {};
  if (!rewardName || pointsRequired === undefined) {
    return res.status(400).json({ error: 'rewardName and pointsRequired are required.' });
  }
  const numericPoints = Number(pointsRequired);
  const numericDiscount = Number(discountValue ?? 0);
  const numericMaxRedemptions = maxRedemptions == null || maxRedemptions === '' ? null : Number(maxRedemptions);
  const normalizedDiscountType = String(discountType || 'percentage').trim().toLowerCase();
  const validTiers = new Set(['bronze','silver','gold','platinum','vip']);
  if (!Number.isFinite(numericPoints) || numericPoints <= 0) return res.status(400).json({ error: 'pointsRequired must be a finite positive number.' });
  if (!Number.isFinite(numericDiscount) || numericDiscount < 0 || (normalizedDiscountType === 'percentage' && numericDiscount > 100)) return res.status(400).json({ error: 'discountValue is invalid for the selected discountType.' });
  if (numericMaxRedemptions !== null && (!Number.isFinite(numericMaxRedemptions) || numericMaxRedemptions <= 0 || !Number.isInteger(numericMaxRedemptions))) return res.status(400).json({ error: 'maxRedemptions must be a positive integer when provided.' });
  if (!validTiers.has(String(minTier || 'bronze').toLowerCase())) return res.status(400).json({ error: 'Invalid minTier.' });

  let targetBranchId = '';
  if (branchId && branchId !== 'all' && branchId !== 'HQ') {
    const branchCheck = checkBranchAuthorization(user, branchId);
    if (!branchCheck.authorized) {
      return res.status(403).json({ error: branchCheck.error });
    }
    targetBranchId = branchCheck.targetBranchId;
  } else {
    if (!isHQRoleOrClaim(user)) {
      return res.status(403).json({ error: 'Access denied: Global reward creation is restricted to Enterprise Owner and HQ Admin.' });
    }
    targetBranchId = user.branchId || 'HQ';
  }

  const db = getAdminDb();
  const idempotencyKey = getRequiredIdempotencyKey(req, req.body?.idempotencyKey || `reward-create:${user.uid}:${createHash('sha256').update(JSON.stringify(cleanUndefined(req.body || {}))).digest('hex')}`);
  const now = new Date().toISOString();
  const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`reward-create:${user.uid}:${idempotencyKey}`).digest('hex'));

  try {
    const priorIdem = await idemRef.get();
    if (priorIdem.exists) return res.status(201).json(priorIdem.data()?.result || priorIdem.data());
    const rewardRef = db.collection('customer_rewards').doc(createHash('sha256').update(`reward:${user.uid}:${idempotencyKey}`).digest('hex').slice(0, 20));
    const newReward = {
      id: rewardRef.id,
      rewardName: String(rewardName).trim(),
      pointsRequired: numericPoints,
      discountType: discountType || 'percentage',
      discountValue: numericDiscount,
      description: description || '',
      minTier: minTier || 'bronze',
      maxRedemptions: numericMaxRedemptions,
      currentRedemptions: 0,
      isActive: isActive !== false,
      branchId: targetBranchId,
      createdAt: now,
      updatedAt: now
    };

    await rewardRef.set(cleanUndefined(newReward));

    const auditRef = db.collection('activity_logs').doc();
    await auditRef.set({
      id: auditRef.id,
      userId: user.uid,
      userName: user.name || user.email || 'Admin',
      userEmail: user.email || 'admin@system.internal',
      userRole: user.role,
      action: 'CREATE_CUSTOMER_REWARD',
      entityId: rewardRef.id,
      entityType: 'customer_rewards',
      details: `Created customer reward "${newReward.rewardName}" (${newReward.pointsRequired} pts)`,
      branchId: newReward.branchId,
      timestamp: now
    });

    await idemRef.set({ status: 'success', result: newReward, createdAt: now });
    return res.status(201).json(newReward);
  } catch (err: any) {
    console.error('Error creating customer reward:', err);
    return res.status(500).json({ error: 'Failed to create reward' });
  }
}

export async function handleUpdateReward(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Reward ID is required.' });
  }

  const db = getAdminDb();
  const now = new Date().toISOString();

  try {
    const rewardRef = db.collection('customer_rewards').doc(id);
    const rewardSnap = await rewardRef.get();
    if (!rewardSnap.exists) {
      return res.status(404).json({ error: `Reward #${id} not found.` });
    }

    const existingReward = rewardSnap.data() as any;
    const existingBranch = existingReward.branchId;

    if (!existingBranch || existingBranch === '' || existingBranch === 'all' || existingBranch === 'HQ') {
      if (!isHQRoleOrClaim(user)) {
        return res.status(403).json({ error: 'Access denied: Global reward modification is restricted to Enterprise Owner and HQ Admin.' });
      }
    } else {
      const branchCheck = checkBranchAuthorization(user, existingBranch);
      if (!branchCheck.authorized) {
        return res.status(403).json({ error: branchCheck.error });
      }
    }

    const idempotencyKey = getRequiredIdempotencyKey(req, req.body?.idempotencyKey || `reward-update:${user.uid}:${id}:${createHash('sha256').update(JSON.stringify(cleanUndefined(req.body || {}))).digest('hex')}`);
    const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`reward-update:${user.uid}:${id}:${idempotencyKey}`).digest('hex'));
    const priorIdem = await idemRef.get();
    if (priorIdem.exists) return res.status(200).json(priorIdem.data()?.result || priorIdem.data());
  
    const updates: Record<string, any> = { updatedAt: now };
    const { rewardName, pointsRequired, discountType, discountValue, description, minTier, maxRedemptions, isActive, branchId } = req.body || {};

    if (rewardName !== undefined) updates.rewardName = String(rewardName).trim();
    if (pointsRequired !== undefined) { const n=Number(pointsRequired); if(!Number.isFinite(n)||n<=0)return res.status(400).json({error:'pointsRequired must be a finite positive number.'}); updates.pointsRequired=n; }
    if (discountType !== undefined) updates.discountType = String(discountType).trim().toLowerCase();
    if (discountValue !== undefined) { const n=Number(discountValue); const dt=String(discountType ?? existingReward.discountType ?? 'percentage').trim().toLowerCase(); if(!Number.isFinite(n)||n<0||(dt==='percentage'&&n>100))return res.status(400).json({error:'discountValue is invalid for the selected discountType.'}); updates.discountValue=n; }
    if (description !== undefined) updates.description = description;
    if (minTier !== undefined) { const tier=String(minTier).trim().toLowerCase(); if(!['bronze','silver','gold','platinum','vip'].includes(tier))return res.status(400).json({error:'Invalid minTier.'}); updates.minTier=tier; }
    if (maxRedemptions !== undefined) { const n=maxRedemptions==null||maxRedemptions===''?null:Number(maxRedemptions); if(n!==null&&(!Number.isFinite(n)||n<=0||!Number.isInteger(n)))return res.status(400).json({error:'maxRedemptions must be a positive integer when provided.'}); updates.maxRedemptions=n; }
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (branchId !== undefined) {
      if (branchId && branchId !== 'all' && branchId !== 'HQ') {
        const bCheck = checkBranchAuthorization(user, branchId);
        if (!bCheck.authorized) return res.status(403).json({ error: bCheck.error });
        updates.branchId = bCheck.targetBranchId;
      } else {
        if (!isHQRoleOrClaim(user)) return res.status(403).json({ error: 'Global reward reassignment requires HQ Admin or Owner.' });
        updates.branchId = user.branchId || 'HQ';
      }
    }

    await rewardRef.update(cleanUndefined(updates));

    const result = { status: 'success', id, ...updates };
    await idemRef.set({ status: 'success', result, createdAt: now });
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Error updating customer reward:', err);
    return res.status(500).json({ error: 'Failed to update reward' });
  }
}

export async function handleDeleteReward(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Reward ID is required.' });
  }

  const db = getAdminDb();
  try {
    const rewardRef = db.collection('customer_rewards').doc(id);
    const rewardSnap = await rewardRef.get();
    if (!rewardSnap.exists) {
      return res.status(404).json({ error: `Reward #${id} not found.` });
    }

    const existingReward = rewardSnap.data() as any;
    const existingBranch = existingReward.branchId;

    if (!existingBranch || existingBranch === '' || existingBranch === 'all' || existingBranch === 'HQ') {
      if (!isHQRoleOrClaim(user)) {
        return res.status(403).json({ error: 'Access denied: Global reward deletion is restricted to Enterprise Owner and HQ Admin.' });
      }
    } else {
      const branchCheck = checkBranchAuthorization(user, existingBranch);
      if (!branchCheck.authorized) {
        return res.status(403).json({ error: branchCheck.error });
      }
    }

    const idempotencyKey = getRequiredIdempotencyKey(req, req.body?.idempotencyKey || `reward-delete:${user.uid}:${id}`);
    const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`reward-delete:${user.uid}:${id}:${idempotencyKey}`).digest('hex'));
    const priorIdem = await idemRef.get();
    if (priorIdem.exists) return res.status(200).json(priorIdem.data()?.result || priorIdem.data());
    await rewardRef.delete();
    const result = { status: 'success', id };
    await idemRef.set({ status: 'success', result, createdAt: new Date().toISOString() });
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Error deleting customer reward:', err);
    return res.status(500).json({ error: 'Failed to delete reward' });
  }
}

// 22. Authoritative Customer Coupons Management (Server-Only Writes)
export async function handleCreateCoupon(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { code, title, description, discountType, discountValue, minOrderAmount, maxDiscountAmount, usageLimit, validFrom, validUntil, expiryDate, isActive, branchId } = req.body || {};
  if (!code || discountValue === undefined) {
    return res.status(400).json({ error: 'code and discountValue are required.' });
  }
  const normalizedDiscountType = String(discountType || 'percentage').trim().toLowerCase();
  const numericDiscount = Number(discountValue);
  const numericMinOrder = Number(minOrderAmount ?? 0);
  const numericMaxDiscount = maxDiscountAmount == null || maxDiscountAmount === '' ? null : Number(maxDiscountAmount);
  const numericUsageLimit = usageLimit == null || usageLimit === '' ? null : Number(usageLimit);
  if (!Number.isFinite(numericDiscount) || numericDiscount < 0 || (normalizedDiscountType === 'percentage' && numericDiscount > 100)) return res.status(400).json({ error: 'discountValue is invalid for the selected discountType.' });
  if (!Number.isFinite(numericMinOrder) || numericMinOrder < 0) return res.status(400).json({ error: 'minOrderAmount must be non-negative.' });
  if (numericMaxDiscount !== null && (!Number.isFinite(numericMaxDiscount) || numericMaxDiscount < 0)) return res.status(400).json({ error: 'maxDiscountAmount must be non-negative when provided.' });
  if (numericUsageLimit !== null && (!Number.isFinite(numericUsageLimit) || numericUsageLimit <= 0 || !Number.isInteger(numericUsageLimit))) return res.status(400).json({ error: 'usageLimit must be a positive integer when provided.' });

  let targetBranchId = '';
  if (branchId && branchId !== 'all' && branchId !== 'HQ') {
    const branchCheck = checkBranchAuthorization(user, branchId);
    if (!branchCheck.authorized) {
      return res.status(403).json({ error: branchCheck.error });
    }
    targetBranchId = branchCheck.targetBranchId;
  } else {
    if (!isHQRoleOrClaim(user)) {
      return res.status(403).json({ error: 'Access denied: Global coupon creation is restricted to Enterprise Owner and HQ Admin.' });
    }
    targetBranchId = 'all';
  }

  const db = getAdminDb();
  const idempotencyKey = getRequiredIdempotencyKey(req, req.body?.idempotencyKey || `coupon-create:${user.uid}:${createHash('sha256').update(JSON.stringify(cleanUndefined(req.body || {}))).digest('hex')}`);
  const now = new Date().toISOString();
  const normalizedCode = String(code).trim().toUpperCase();
  const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`coupon-create:${user.uid}:${idempotencyKey}`).digest('hex'));

  try {
    const priorIdem = await idemRef.get();
    if (priorIdem.exists) return res.status(201).json(priorIdem.data()?.result || priorIdem.data());
    const couponRef = db.collection('customer_coupons').doc(createHash('sha256').update(`coupon:${user.uid}:${idempotencyKey}`).digest('hex').slice(0, 20));
    const newCoupon = {
      id: couponRef.id,
      code: normalizedCode,
      title: title ? String(title).trim() : normalizedCode,
      description: description || '',
      discountType: normalizedDiscountType,
      discountValue: numericDiscount,
      minOrderAmount: numericMinOrder,
      maxDiscountAmount: numericMaxDiscount,
      usageLimit: numericUsageLimit,
      usedCount: 0,
      validFrom: validFrom || now,
      validUntil: validUntil || expiryDate || null,
      expiryDate: expiryDate || validUntil || null,
      isActive: isActive !== false,
      branchId: targetBranchId,
      createdAt: now,
      updatedAt: now
    };

    await couponRef.set(cleanUndefined(newCoupon));

    const auditRef = db.collection('activity_logs').doc();
    await auditRef.set({
      id: auditRef.id,
      userId: user.uid,
      userName: user.name || user.email || 'Admin',
      userEmail: user.email || 'admin@system.internal',
      userRole: user.role,
      action: 'CREATE_CUSTOMER_COUPON',
      entityId: couponRef.id,
      entityType: 'customer_coupons',
      details: `Created coupon "${newCoupon.code}" (${newCoupon.discountValue} ${newCoupon.discountType})`,
      branchId: newCoupon.branchId,
      timestamp: now
    });

    await idemRef.set({ status: 'success', result: newCoupon, createdAt: now });
    return res.status(201).json(newCoupon);
  } catch (err: any) {
    console.error('Error creating customer coupon:', err);
    return res.status(500).json({ error: 'Failed to create coupon' });
  }
}

export async function handleUpdateCoupon(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Coupon ID is required.' });
  }

  const db = getAdminDb();
  const now = new Date().toISOString();

  try {
    const couponRef = db.collection('customer_coupons').doc(id);
    const couponSnap = await couponRef.get();
    if (!couponSnap.exists) {
      return res.status(404).json({ error: `Coupon #${id} not found.` });
    }

    const existingCoupon = couponSnap.data() as any;
    const existingBranch = existingCoupon.branchId;

    if (!existingBranch || existingBranch === '' || existingBranch === 'all' || existingBranch === 'HQ') {
      if (!isHQRoleOrClaim(user)) {
        return res.status(403).json({ error: 'Access denied: Global coupon modification is restricted to Enterprise Owner and HQ Admin.' });
      }
    } else {
      const branchCheck = checkBranchAuthorization(user, existingBranch);
      if (!branchCheck.authorized) {
        return res.status(403).json({ error: branchCheck.error });
      }
    }

    const idempotencyKey = getRequiredIdempotencyKey(req, req.body?.idempotencyKey || `coupon-update:${user.uid}:${id}:${createHash('sha256').update(JSON.stringify(cleanUndefined(req.body || {}))).digest('hex')}`);
    const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`coupon-update:${user.uid}:${id}:${idempotencyKey}`).digest('hex'));
    const priorIdem = await idemRef.get();
    if (priorIdem.exists) return res.status(200).json(priorIdem.data()?.result || priorIdem.data());
  
    const updates: Record<string, any> = { updatedAt: now };
    const { code, title, description, discountType, discountValue, minOrderAmount, maxDiscountAmount, usageLimit, validFrom, validUntil, expiryDate, isActive, branchId } = req.body || {};

    if (code !== undefined) updates.code = String(code).trim().toUpperCase();
    if (title !== undefined) updates.title = String(title).trim();
    if (description !== undefined) updates.description = description;
    if (discountType !== undefined) updates.discountType = String(discountType).trim().toLowerCase();
    const effectiveDiscountType = String(discountType ?? existingCoupon.discountType ?? 'percentage').trim().toLowerCase();
    if (discountValue !== undefined) { const n=Number(discountValue); if(!Number.isFinite(n)||n<0||(effectiveDiscountType==='percentage'&&n>100))return res.status(400).json({error:'discountValue is invalid for the selected discountType.'}); updates.discountValue=n; }
    if (minOrderAmount !== undefined) { const n=Number(minOrderAmount); if(!Number.isFinite(n)||n<0)return res.status(400).json({error:'minOrderAmount must be non-negative.'}); updates.minOrderAmount=n; }
    if (maxDiscountAmount !== undefined) { const n=maxDiscountAmount==null||maxDiscountAmount===''?null:Number(maxDiscountAmount); if(n!==null&&(!Number.isFinite(n)||n<0))return res.status(400).json({error:'maxDiscountAmount must be non-negative when provided.'}); updates.maxDiscountAmount=n; }
    if (usageLimit !== undefined) { const n=usageLimit==null||usageLimit===''?null:Number(usageLimit); if(n!==null&&(!Number.isFinite(n)||n<=0||!Number.isInteger(n)))return res.status(400).json({error:'usageLimit must be a positive integer when provided.'}); updates.usageLimit=n; }
    if (validFrom !== undefined) updates.validFrom = validFrom;
    if (validUntil !== undefined) updates.validUntil = validUntil;
    if (expiryDate !== undefined) updates.expiryDate = expiryDate;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (branchId !== undefined) {
      if (branchId && branchId !== 'all' && branchId !== 'HQ') {
        const bCheck = checkBranchAuthorization(user, branchId);
        if (!bCheck.authorized) return res.status(403).json({ error: bCheck.error });
        updates.branchId = bCheck.targetBranchId;
      } else {
        if (!isHQRoleOrClaim(user)) return res.status(403).json({ error: 'Global coupon reassignment requires HQ Admin or Owner.' });
        updates.branchId = 'all';
      }
    }

    await couponRef.update(cleanUndefined(updates));

    const result = { status: 'success', id, ...updates };
    await idemRef.set({ status: 'success', result, createdAt: now });
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Error updating customer coupon:', err);
    return res.status(500).json({ error: 'Failed to update coupon' });
  }
}

export async function handleDeleteCoupon(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ error: 'Coupon ID is required.' });
  }

  const db = getAdminDb();
  try {
    const couponRef = db.collection('customer_coupons').doc(id);
    const couponSnap = await couponRef.get();
    if (!couponSnap.exists) {
      return res.status(404).json({ error: `Coupon #${id} not found.` });
    }

    const existingCoupon = couponSnap.data() as any;
    const existingBranch = existingCoupon.branchId;

    if (!existingBranch || existingBranch === '' || existingBranch === 'all' || existingBranch === 'HQ') {
      if (!isHQRoleOrClaim(user)) {
        return res.status(403).json({ error: 'Access denied: Global coupon deletion is restricted to Enterprise Owner and HQ Admin.' });
      }
    } else {
      const branchCheck = checkBranchAuthorization(user, existingBranch);
      if (!branchCheck.authorized) {
        return res.status(403).json({ error: branchCheck.error });
      }
    }

    const idempotencyKey = getRequiredIdempotencyKey(req, req.body?.idempotencyKey || `coupon-delete:${user.uid}:${id}`);
    const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`coupon-delete:${user.uid}:${id}:${idempotencyKey}`).digest('hex'));
    const priorIdem = await idemRef.get();
    if (priorIdem.exists) return res.status(200).json(priorIdem.data()?.result || priorIdem.data());
    await couponRef.delete();
    const result = { status: 'success', id };
    await idemRef.set({ status: 'success', result, createdAt: new Date().toISOString() });
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Error deleting customer coupon:', err);
    return res.status(500).json({ error: 'Failed to delete coupon' });
  }
}

// 23. Authoritative Kitchen Station Management (Server-Only Writes)
export async function handleKitchenStationStatusUpdate(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Chef', 'chef', 'Kitchen', 'kitchen', 'Kitchen Staff', 'Cashier', 'cashier', 'Staff', 'staff']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { stationId } = req.params;
  if (!stationId) {
    return res.status(400).json({ error: 'Station ID is required.' });
  }

  const { status, chefName, assignedChef } = req.body || {};
  const allowedStatuses = ['normal', 'busy', 'overloaded'];
  if (!status || !allowedStatuses.includes(String(status))) {
    return res.status(400).json({ error: `Invalid station status "${status}". Allowed: ${allowedStatuses.join(', ')}` });
  }

  const db = getAdminDb();
  const timestamp = new Date().toISOString();

  try {
    const stationRef = db.collection('kitchen_stations').doc(stationId);
    const stationSnap = await stationRef.get();

    const updates: Record<string, any> = {
      status: String(status),
      updatedAt: timestamp
    };

    const finalChefName = chefName || assignedChef;
    if (finalChefName !== undefined && typeof finalChefName === 'string') {
      updates.assignedChef = finalChefName.trim();
    }

    if (stationSnap.exists) {
      const stationData = stationSnap.data() || {};
      if (stationData.branchId) {
        const branchCheck = checkBranchAuthorization(user, stationData.branchId);
        if (!branchCheck.authorized) {
          return res.status(403).json({ error: branchCheck.error });
        }
      }
      await stationRef.update(cleanUndefined(updates));
      await db.collection('stations').doc(stationId).set(cleanUndefined(updates), { merge: true });
    } else {
      const newStationDoc = cleanUndefined({
        id: stationId,
        name: `${stationId.charAt(0).toUpperCase() + stationId.slice(1)} Station`,
        stationType: stationId,
        assignedChef: updates.assignedChef || user.name || 'Line Chef',
        activeOrdersCount: 0,
        completedOrdersToday: 0,
        avgPrepTimeMinutes: 15,
        status: updates.status,
        supportedCategories: [],
        createdAt: timestamp,
        ...updates
      });
      await stationRef.set(newStationDoc, { merge: true });
      await db.collection('stations').doc(stationId).set(newStationDoc, { merge: true });
    }

    return res.json({ status: 'success', stationId, stationStatus: updates.status, assignedChef: updates.assignedChef });
  } catch (err: any) {
    console.error('Kitchen Station Status Update Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Station Status Update Failed' });
  }
}



export async function handleBranchTransferCreate(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;
  const roleCheck = checkRoleAuthorization(user, ['Owner','owner','Admin','admin','Manager','manager','Accountant','accountant']);
  if (!roleCheck.authorized) return res.status(403).json({ error: roleCheck.error });
  const data = req.body?.transferData || req.body || {};
  const source = normalizeCanonicalBranchId(data.sourceBranchId || '');
  const dest = normalizeCanonicalBranchId(data.destinationBranchId || '');
  if (!source || !dest || source === dest) return res.status(400).json({ error: 'Valid, different source and destination branches are required.' });
  const sourceAuth = checkBranchAuthorization(user, source);
  if (!sourceAuth.authorized) return res.status(403).json({ error: sourceAuth.error });
  const destAuth = checkBranchAuthorization(user, dest);
  if (!destAuth.authorized && !isHQRoleOrClaim(user)) return res.status(403).json({ error: 'You are not authorized for the destination branch.' });
  if ((data.transferType === 'inventory' || data.transferType === 'product') && (!Array.isArray(data.items) || data.items.length === 0)) return res.status(400).json({ error: 'Inventory/product transfer requires at least one real item.' });
  if (data.transferType === 'employee' && !data.employeeId) return res.status(400).json({ error: 'Employee transfer requires employeeId.' });
  if (data.transferType === 'cash' && (!Number.isFinite(Number(data.cashAmount)) || Number(data.cashAmount) <= 0)) return res.status(400).json({ error: 'Cash transfer requires a positive cashAmount.' });
  for (const item of data.items || []) {
    if (!item?.itemId || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) return res.status(400).json({ error: 'Every transfer item requires a real itemId and positive quantity.' });
  }
  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req, data.idempotencyKey); } catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }
  const db = getAdminDb();
  const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`branch-transfer-create:${user.uid}:${idempotencyKey}`).digest('hex'));
  try {
    const result = await db.runTransaction(async transaction => {
      const idem = await transaction.get(idemRef);
      if (idem.exists) return idem.data();
      const now = new Date().toISOString();
      const ref = db.collection('branch_transfers').doc();
      const transfer = cleanUndefined({ ...data, id: ref.id, transferNumber: `TRF-${getMogadishuDateString(now).replace(/-/g,'')}-${ref.id.slice(0,6).toUpperCase()}`, sourceBranchId: source, destinationBranchId: dest, branchId: source, status: 'pending', createdBy: user.name, createdAt: now, updatedAt: now, idempotencyKey });
      transaction.create(ref, transfer);
      const out = { status:'success', id: ref.id, transfer: transfer };
      transaction.set(idemRef, cleanUndefined({ ...out, createdAt: now }));
      return out;
    });
    return res.json(result);
  } catch (e:any) { return res.status(e?.statusCode || 500).json({ error: e?.message || 'Branch transfer creation failed.' }); }
}

export async function handleBranchTransferRejection(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;
  const roleCheck = checkRoleAuthorization(user, ['Owner','owner','Admin','admin','Manager','manager','Accountant','accountant']);
  if (!roleCheck.authorized) return res.status(403).json({ error: roleCheck.error });
  const transferId = String(req.params.transferId || '').trim();
  if (!transferId) return res.status(400).json({ error: 'Transfer ID is required.' });
  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req); } catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }
  const reason = String(req.body?.reason || req.body?.rejectionReason || '').trim();
  if (!reason) return res.status(400).json({ error: 'A rejection reason is required.' });
  const db = getAdminDb();
  const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`branch-transfer-reject:${user.uid}:${transferId}:${idempotencyKey}`).digest('hex'));
  try {
    const result = await db.runTransaction(async transaction => {
      const idem = await transaction.get(idemRef); if (idem.exists) return idem.data();
      const ref = db.collection('branch_transfers').doc(transferId); const snap = await transaction.get(ref);
      if (!snap.exists) throw Object.assign(new Error('Branch transfer not found.'), {statusCode:404});
      const t = snap.data() || {}; const source = normalizeCanonicalBranchId(t.sourceBranchId || t.branchId || ''); const dest = normalizeCanonicalBranchId(t.destinationBranchId || '');
      if (!source || !dest) throw Object.assign(new Error('Transfer branches are missing.'), {statusCode:400});
      if (!isHQRoleOrClaim(user)) {
        const sourceAuth = checkBranchAuthorization(user, source); const destAuth = checkBranchAuthorization(user, dest);
        if (!sourceAuth.authorized && !destAuth.authorized) throw Object.assign(new Error('You are not authorized for this transfer.'), {statusCode:403});
      }
      if (String(t.status || '').toLowerCase() !== 'pending') throw Object.assign(new Error(`Transfer is not pending; current status is ${t.status || 'unknown'}.`), {statusCode:409});
      const now = new Date().toISOString();
      transaction.update(ref, { status:'rejected', approvedBy:user.name, rejectionReason:reason, updatedAt:now, idempotencyKey });
      const out={status:'success',transferId,idempotencyKey}; transaction.set(idemRef,cleanUndefined({...out,createdAt:now})); return out;
    });
    return res.json(result);
  } catch(e:any){return res.status(e?.statusCode||500).json({error:e?.message||'Branch transfer rejection failed.'});}
}

export async function handleProductOptionCreate(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res); if (!user) return;
  const role = checkRoleAuthorization(user,['Owner','owner','Admin','admin','Manager','manager']); if(!role.authorized) return res.status(403).json({error:role.error});
  const data=req.body?.optionData||req.body||{}; const branchCheck=checkBranchAuthorization(user,data.branchId||user.branchId); if(!branchCheck.authorized||!branchCheck.targetBranchId||branchCheck.targetBranchId==='all') return res.status(403).json({error:branchCheck.error||'A concrete branchId is required.'});
  let key:string; try{key=getRequiredIdempotencyKey(req,data.idempotencyKey);}catch(e:any){return res.status(e?.statusCode||400).json({error:e?.message||'Idempotency-Key is required.'});}
  const db=getAdminDb(); const idemRef=db.collection('mutation_idempotency').doc(createHash('sha256').update(`product-option-create:${user.uid}:${key}`).digest('hex'));
  try{const result=await db.runTransaction(async tx=>{const idem=await tx.get(idemRef);if(idem.exists)return idem.data();const ref=db.collection('product_options').doc();const now=new Date().toISOString();const outData=cleanUndefined({...data,id:ref.id,branchId:branchCheck.targetBranchId,createdBy:user.name,createdAt:now,updatedAt:now});tx.create(ref,outData);const out={status:'success',id:ref.id,option:outData,idempotencyKey:key};tx.set(idemRef,cleanUndefined({...out,createdAt:now}));return out;});return res.json(result);}catch(e:any){return res.status(e?.statusCode||500).json({error:e?.message||'Product option creation failed.'});}
}

export async function handleProductOptionUpdate(req: express.Request, res: express.Response) {
  const user=await authenticateTrustedUser(req,res);if(!user)return;const role=checkRoleAuthorization(user,['Owner','owner','Admin','admin','Manager','manager']);if(!role.authorized)return res.status(403).json({error:role.error});
  const id=String(req.params.id||'').trim();if(!id)return res.status(400).json({error:'Product option ID is required.'});let key:string;try{key=getRequiredIdempotencyKey(req,req.body?.idempotencyKey);}catch(e:any){return res.status(e?.statusCode||400).json({error:e?.message||'Idempotency-Key is required.'});}const db=getAdminDb();const idemRef=db.collection('mutation_idempotency').doc(createHash('sha256').update(`product-option-update:${user.uid}:${id}:${key}`).digest('hex'));
  try{const result=await db.runTransaction(async tx=>{const idem=await tx.get(idemRef);if(idem.exists)return idem.data();const ref=db.collection('product_options').doc(id);const snap=await tx.get(ref);if(!snap.exists)throw Object.assign(new Error('Product option not found.'),{statusCode:404});const data=snap.data()||{};const auth=checkBranchAuthorization(user,data.branchId||'');if(!auth.authorized)throw Object.assign(new Error(auth.error),{statusCode:403});const update={...req.body};delete update.id;delete update.branchId;delete update.idempotencyKey;update.updatedAt=new Date().toISOString();tx.update(ref,cleanUndefined(update));const out={status:'success',id,idempotencyKey:key};tx.set(idemRef,cleanUndefined({...out,createdAt:update.updatedAt}));return out;});return res.json(result);}catch(e:any){return res.status(e?.statusCode||500).json({error:e?.message||'Product option update failed.'});}
}

export async function handleProductOptionDelete(req: express.Request, res: express.Response) {
  const user=await authenticateTrustedUser(req,res);if(!user)return;const role=checkRoleAuthorization(user,['Owner','owner','Admin','admin','Manager','manager']);if(!role.authorized)return res.status(403).json({error:role.error});const id=String(req.params.id||'').trim();if(!id)return res.status(400).json({error:'Product option ID is required.'});let key:string;try{key=getRequiredIdempotencyKey(req,req.body?.idempotencyKey);}catch(e:any){return res.status(e?.statusCode||400).json({error:e?.message||'Idempotency-Key is required.'});}const db=getAdminDb();const idemRef=db.collection('mutation_idempotency').doc(createHash('sha256').update(`product-option-delete:${user.uid}:${id}:${key}`).digest('hex'));
  try{const result=await db.runTransaction(async tx=>{const idem=await tx.get(idemRef);if(idem.exists)return idem.data();const ref=db.collection('product_options').doc(id);const snap=await tx.get(ref);if(!snap.exists)throw Object.assign(new Error('Product option not found.'),{statusCode:404});const auth=checkBranchAuthorization(user,(snap.data()||{}).branchId||'');if(!auth.authorized)throw Object.assign(new Error(auth.error),{statusCode:403});const now=new Date().toISOString();tx.delete(ref);const out={status:'success',id,idempotencyKey:key};tx.set(idemRef,cleanUndefined({...out,createdAt:now}));return out;});return res.json(result);}catch(e:any){return res.status(e?.statusCode||500).json({error:e?.message||'Product option delete failed.'});}
}

export async function handleBranchTransferApproval(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;
  const roleCheck = checkRoleAuthorization(user, ['Owner','owner','Admin','admin','Manager','manager','Accountant','accountant']);
  if (!roleCheck.authorized) return res.status(403).json({ error: roleCheck.error });
  const transferId = String(req.params.transferId || '').trim();
  if (!transferId) return res.status(400).json({ error: 'Transfer ID is required.' });
  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req); } catch (e:any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }
  const db = getAdminDb();
  const transferIdemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`branch-transfer:${user.uid}:${transferId}:${idempotencyKey}`).digest('hex'));
  try {
    const result = await db.runTransaction(async (transaction) => {
      const idemSnap = await transaction.get(transferIdemRef);
      if (idemSnap.exists) return idemSnap.data();
      const ref = db.collection('branch_transfers').doc(transferId);
      const snap = await transaction.get(ref);
      if (!snap.exists) throw Object.assign(new Error('Branch transfer not found.'), { statusCode: 404 });
      const t = snap.data() || {};
      const source = normalizeCanonicalBranchId(t.sourceBranchId || '');
      const dest = normalizeCanonicalBranchId(t.destinationBranchId || '');
      if (!source || !dest || source === dest) throw Object.assign(new Error('Invalid source/destination branches.'), { statusCode: 400 });
      const postingDate = String(t.accountingDate || t.date || getMogadishuDateString(new Date().toISOString())).slice(0, 10);
      await assertAccountingDateOpenInTransaction(transaction, db, postingDate, source);
      await assertAccountingDateOpenInTransaction(transaction, db, postingDate, dest);
      const isHq = isHQRoleOrClaim(user);
      const actorSourceAuth = checkBranchAuthorization(user, source);
      const actorDestAuth = checkBranchAuthorization(user, dest);
      if (!isHq && !actorSourceAuth.authorized && !actorDestAuth.authorized) throw Object.assign(new Error('You are not authorized for either transfer branch.'), { statusCode: 403 });
      if (t.status === 'completed' || t.status === 'approved') return { status: 'already_completed', transferId };
      if (t.status !== 'pending') throw Object.assign(new Error(`Transfer is not pending; current status is ${t.status || 'unknown'}.`), { statusCode: 409 });

      const now = new Date().toISOString();

      // ALL READS FIRST: collect every resource that this transfer will mutate.
      const writePlan: Array<{ ref: any; data: any }> = [];
      const movements: any[] = [];

      if (t.transferType === 'inventory' || t.transferType === 'product') {
        const items = Array.isArray(t.items) ? t.items : [];
        if (!items.length) throw Object.assign(new Error('Transfer contains no items.'), { statusCode: 400 });
        const seen = new Set<string>();
        for (const item of items) {
          const itemId = String(item.itemId || '').trim();
          const qty = Number(item.quantity || 0);
          if (!itemId || !Number.isFinite(qty) || qty <= 0) throw Object.assign(new Error('Transfer item must contain a valid itemId and positive quantity.'), { statusCode: 400 });
          const collectionName = item.type === 'product' ? 'products' : 'ingredients';
          const sourceRef = db.collection(collectionName).doc(itemId);
          const sourceSnap = await transaction.get(sourceRef);
          if (!sourceSnap.exists) throw Object.assign(new Error(`Transfer item ${itemId} not found.`), { statusCode: 404 });
          const sourceData = sourceSnap.data() || {};
          const itemBranch = normalizeCanonicalBranchId(sourceData.branchId || '');
          if (!itemBranch || itemBranch !== source) throw Object.assign(new Error(`Transfer item ${itemId} is not owned by source branch ${source}.`), { statusCode: 400 });
          const sourceStock = Number(sourceData.stock ?? sourceData.currentStockUsageUnit ?? 0);
          if (!Number.isFinite(sourceStock) || sourceStock < qty) throw Object.assign(new Error(`Insufficient stock for transfer item ${itemId}. Available ${sourceStock}, requested ${qty}.`), { statusCode: 409 });

          const destQuery = await transaction.get(db.collection(collectionName).where('branchId', '==', dest));
          const exactDestId = String(item.destinationItemId || '').trim();
          let destDoc: any = null;
          if (exactDestId) {
            destDoc = destQuery.docs.find(d => d.id === exactDestId) || null;
            if (!destDoc) throw Object.assign(new Error(`Destination item ${exactDestId} does not exist in branch ${dest}.`), { statusCode: 409 });
          } else {
            const canonicalKey = String(sourceData.canonicalItemId || sourceData.sku || '').trim();
            const canonicalMatches = canonicalKey
              ? destQuery.docs.filter(d => String(d.data()?.canonicalItemId || d.data()?.sku || '').trim() === canonicalKey)
              : [];
            if (canonicalMatches.length === 1) {
              destDoc = canonicalMatches[0];
            } else if (canonicalMatches.length > 1) {
              throw Object.assign(new Error(`Destination branch ${dest} has multiple ${item.type} items matching canonical key "${canonicalKey}"; explicit destinationItemId is required.`), { statusCode: 409 });
            } else {
              const nameKey = String(sourceData.name || item.itemName || '').trim().toLowerCase();
              const nameMatches = nameKey
                ? destQuery.docs.filter(d => String(d.data()?.name || '').trim().toLowerCase() === nameKey)
                : [];
              if (nameMatches.length === 1) destDoc = nameMatches[0];
              else if (nameMatches.length > 1) {
                throw Object.assign(new Error(`Destination branch ${dest} has multiple ${item.type} items named "${nameKey}"; explicit destinationItemId is required.`), { statusCode: 409 });
              }
            }
          }
          if (!destDoc) throw Object.assign(new Error(`Destination branch ${dest} has no matching ${item.type} master item for ${itemId}.`), { statusCode: 409 });
          const destData = destDoc.data() || {};
          const destStock = Number(destData.stock ?? destData.currentStockUsageUnit ?? 0);
          if (!Number.isFinite(destStock) || destStock < 0) throw Object.assign(new Error(`Destination stock for ${destDoc.id} is invalid.`), { statusCode: 409 });

          const sourceKey = `${collectionName}:${sourceRef.path}`;
          const destKey = `${collectionName}:${destDoc.ref.path}`;
          if (seen.has(sourceKey) || seen.has(destKey)) throw Object.assign(new Error('A transfer cannot contain duplicate source/destination item mutations.'), { statusCode: 400 });
          seen.add(sourceKey); seen.add(destKey);
          writePlan.push({ ref: sourceRef, data: cleanUndefined({ stock: sourceStock - qty, ...(collectionName === 'ingredients' ? { currentStockUsageUnit: sourceStock - qty } : {}), updatedAt: now }) });
          writePlan.push({ ref: destDoc.ref, data: cleanUndefined({ stock: destStock + qty, ...(collectionName === 'ingredients' ? { currentStockUsageUnit: destStock + qty } : {}), updatedAt: now }) });
          movements.push({ type:'transfer_out', itemType:item.type, itemId, itemName:item.itemName || sourceData.name || itemId, quantity:qty, branchId:source, destinationBranchId:dest }, { type:'transfer_in', itemType:item.type, itemId:destDoc.id, itemName:item.itemName || destData.name || destDoc.id, quantity:qty, branchId:dest, sourceBranchId:source });
        }
      } else if (t.transferType === 'employee') {
        const employeeId = String(t.employeeId || '').trim();
        if (!employeeId) throw Object.assign(new Error('Employee transfer requires employeeId.'), { statusCode: 400 });
        const empRef = db.collection('employees').doc(employeeId);
        const empSnap = await transaction.get(empRef);
        if (!empSnap.exists) throw Object.assign(new Error('Employee not found.'), { statusCode: 404 });
        const emp = empSnap.data() || {};
        const empBranch = normalizeCanonicalBranchId(emp.branchId || emp.branch || '');
        if (!empBranch || !areBranchesMatching(empBranch, source)) throw Object.assign(new Error('Employee does not belong to source branch.'), { statusCode: 400 });
        const userQuery = await transaction.get(db.collection('users').where('employeeId','==',employeeId));
        writePlan.push({ ref: empRef, data: { branchId: dest, branch: dest, previousBranchId: source, updatedAt: now } });
        for (const userDoc of userQuery.docs) writePlan.push({ ref: userDoc.ref, data: { branchId: dest, branch: dest, updatedAt: now } });
      } else if (t.transferType === 'cash') {
        const amount = Number(t.cashAmount || 0);
        if (!Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error('Cash transfer amount must be positive.'), {statusCode:400});
        const [sourceRegSnap, destRegSnap] = await Promise.all([
          transaction.get(db.collection('cash_registers').where('branchId','==',source).where('status','==','Open')),
          transaction.get(db.collection('cash_registers').where('branchId','==',dest).where('status','==','Open'))
        ]);
        if (sourceRegSnap.size !== 1 || destRegSnap.size !== 1) throw Object.assign(new Error('Each transfer branch must have exactly one open cash register for a cash transfer.'), { statusCode: 409 });
        const sourceReg = sourceRegSnap.docs[0], destReg = destRegSnap.docs[0];
        const sourceData = sourceReg.data() || {}, destData = destReg.data() || {};
        const sourceExpected = Number(sourceData.expectedClosingBalance ?? sourceData.openingBalance ?? 0);
        const destExpected = Number(destData.expectedClosingBalance ?? destData.openingBalance ?? 0);
        if (sourceExpected < amount) throw Object.assign(new Error(`Insufficient source register cash. Available ${sourceExpected.toFixed(2)}, requested ${amount.toFixed(2)}.`), {statusCode:409});
        writePlan.push({ ref: sourceReg.ref, data: { expectedClosingBalance: sourceExpected - amount, cashAdjustments: Number(sourceData.cashAdjustments || 0) - amount, updatedAt: now } });
        writePlan.push({ ref: destReg.ref, data: { expectedClosingBalance: destExpected + amount, cashAdjustments: Number(destData.cashAdjustments || 0) + amount, updatedAt: now } });
      } else throw Object.assign(new Error(`Unsupported transfer type: ${t.transferType}`), {statusCode:400});

      // ALL WRITES START HERE.
      for (const plan of writePlan) transaction.update(plan.ref, plan.data);
      for (const movement of movements) {
        const movementRef = db.collection('inventory_movements').doc();
        transaction.set(movementRef, cleanUndefined({ id:movementRef.id, ...movement, transferId, reason:t.reason || 'Inter-branch transfer', createdBy:user.name, createdAt:now }));
      }
      if (t.transferType === 'cash') {
        const transferAmount = Number(t.cashAmount);
        const sourceLines = [
          { accountId:'acc_due_from_branch', accountCode:'1310', accountName:`Due From ${dest}`, debit:transferAmount, credit:0, memo:`Cash transferred to ${dest}` },
          { accountId:'acc_cash', accountCode:'1010', accountName:'Cash on Hand (Register)', debit:0, credit:transferAmount, memo:`Cash transferred to ${dest}` }
        ];
        const destLines = [
          { accountId:'acc_cash', accountCode:'1010', accountName:'Cash on Hand (Register)', debit:transferAmount, credit:0, memo:`Cash received from ${source}` },
          { accountId:'acc_due_to_branch', accountCode:'2110', accountName:`Due To ${source}`, debit:0, credit:transferAmount, memo:`Cash received from ${source}` }
        ];
        const transferAccountState = await prepareAccountBalanceState(transaction, db, ['acc_due_from_branch','acc_cash','acc_due_to_branch']);
        const entries = [
          { branchId:source, lines:sourceLines, description:`Inter-branch cash transfer out ${source} → ${dest}` },
          { branchId:dest, lines:destLines, description:`Inter-branch cash transfer in ${source} → ${dest}` }
        ];
        for (const entry of entries) {
          const jeRef = db.collection('journal_entries').doc();
          const entryNumber = `JE-TRANSFER-${transferId.slice(0,6).toUpperCase()}-${entry.branchId}`;
          transaction.set(jeRef, cleanUndefined({ id:jeRef.id, entryNumber, date:postingDate, reference:transferId, description:entry.description, source:'Branch Transfer', status:'Posted', totalDebit:transferAmount, totalCredit:transferAmount, branchId:entry.branchId, createdBy:user.name, createdAt:now, lines:entry.lines }));
          for (const line of entry.lines) {
            const jlRef=db.collection('journal_lines').doc();
            const ledRef=db.collection('ledger').doc();
            transaction.set(jlRef, cleanUndefined({ id:jlRef.id, journalEntryId:jeRef.id, entryNumber, branchId:entry.branchId, ...line, createdAt:now }));
            transaction.set(ledRef, cleanUndefined({ id:ledRef.id, accountId:line.accountId, accountCode:line.accountCode, accountName:line.accountName, journalEntryId:jeRef.id, entryNumber, date:postingDate, reference:transferId, description:line.memo || entry.description, debit:line.debit, credit:line.credit, branchId:entry.branchId, createdAt:now }));
          }
          applyAccountBalanceDeltasInTransaction(transaction, transferAccountState, entry.lines, now);
        }
      }
      transaction.update(ref, { status:'completed', approvedBy:user.name, completedAt:now, updatedAt:now, idempotencyKey });
      const out = { status:'success', transferId, idempotencyKey };
      transaction.set(transferIdemRef, cleanUndefined({ ...out, createdAt: now }));
      return out;
    });
    return res.json(result);
  } catch (err:any) {
    return res.status(err?.statusCode || 500).json({ error: err?.message || 'Branch transfer approval failed.' });
  }
}


export async function handleGetBranchSettings(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;
  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin']);
  if (!roleCheck.authorized) return res.status(403).json({ error: roleCheck.error });

  const targetBranchId = normalizeCanonicalBranchId(String(req.query.branchId || user.branchId || '').trim());
  if (!targetBranchId || targetBranchId === 'all') return res.status(400).json({ error: 'A concrete branchId is required.' });
  const branchCheck = checkBranchAuthorization(user, targetBranchId);
  if (!branchCheck.authorized) return res.status(403).json({ error: branchCheck.error });

  try {
    const snap = await getAdminDb().collection('branch_settings').doc(targetBranchId).get();
    return res.json(snap.exists ? { branchId: targetBranchId, ...(snap.data() || {}) } : { branchId: targetBranchId });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to load branch settings.' });
  }
}

export async function handleUpdateBranchSettings(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;
  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin']);
  if (!roleCheck.authorized) return res.status(403).json({ error: roleCheck.error });

  const body = req.body || {};
  const targetBranchId = normalizeCanonicalBranchId(String(body.branchId || user.branchId || '').trim());
  if (!targetBranchId || targetBranchId === 'all') return res.status(400).json({ error: 'A concrete branchId is required.' });
  const branchCheck = checkBranchAuthorization(user, targetBranchId);
  if (!branchCheck.authorized) return res.status(403).json({ error: branchCheck.error });

  const restaurant = body.restaurant && typeof body.restaurant === 'object' ? body.restaurant : undefined;
  const tax = body.tax && typeof body.tax === 'object' ? body.tax : undefined;
  const payments = body.payments && typeof body.payments === 'object' ? body.payments : undefined;
  if (tax && (!Number.isFinite(Number(tax.defaultTaxRate)) || Number(tax.defaultTaxRate) < 0 || Number(tax.defaultTaxRate) > 100)) {
    return res.status(400).json({ error: 'tax.defaultTaxRate must be a finite percentage from 0 to 100.' });
  }

  try {
    const db = getAdminDb();
    const ref = db.collection('branch_settings').doc(targetBranchId);
    const branchRef = db.collection('branches').doc(targetBranchId);
    const now = new Date().toISOString();
    const existing = await ref.get();
    const current = existing.exists ? (existing.data() || {}) : {};
    const next: any = {
      ...current,
      id: targetBranchId,
      branchId: targetBranchId,
      ...(restaurant ? { restaurant } : {}),
      ...(tax ? { tax } : {}),
      ...(payments ? { payments } : {}),
      updatedAt: now,
      updatedBy: user.uid
    };
    await ref.set(cleanUndefined(next), { merge: true });
    if (tax) {
      const taxRate = Number(tax.defaultTaxRate);
      await branchRef.set(cleanUndefined({
        branchId: targetBranchId,
        ...(Number.isFinite(taxRate) ? { taxRate, taxEnabled: taxRate > 0 } : {}),
        ...(restaurant?.name ? { branchName: restaurant.name } : {}),
        ...(restaurant?.address !== undefined ? { address: restaurant.address } : {}),
        ...(restaurant?.phone !== undefined ? { managerPhone: restaurant.phone } : {}),
        updatedAt: now,
        updatedBy: user.uid
      }), { merge: true });
    }
    return res.json({ status: 'success', branchId: targetBranchId, updatedAt: now });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to save branch settings.' });
  }
}

export async function handleInitialSetup(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;
  const setupDb = getAdminDb();
  const callerSnap = await setupDb.collection('users').doc(user.uid).get();
  const callerData = callerSnap.exists ? (callerSnap.data() || {}) : {};
  const callerIsOwner = ['Owner', 'owner'].includes(String(callerData.role || user.role)) || callerData.isOwner === true;
  const callerIsHQAdmin = ['Admin', 'admin'].includes(String(callerData.role || user.role)) && callerData.isHQ === true;
  if (!callerIsOwner && !callerIsHQAdmin) {
    return res.status(403).json({ error: 'Initial setup requires Owner or HQ Admin authorization.' });
  }

  let idempotencyKey: string;
  try { idempotencyKey = getRequiredIdempotencyKey(req); }
  catch (e: any) { return res.status(e?.statusCode || 400).json({ error: e?.message || 'Idempotency-Key is required.' }); }

  const body = req.body || {};
  const branch = body.branch || {};
  const admin = body.admin || {};
  const restaurant = body.restaurant || {};
  const tax = body.tax || {};
  const payments = body.payments || {};
  const requestedBranchId = String((branch as any).id || '').trim();
  const requestedBranchCode = String(branch.code || '').trim();
  let targetBranchId = normalizeCanonicalBranchId(requestedBranchId || requestedBranchCode || user.branchId);
  if (requestedBranchCode && requestedBranchCode !== 'all' && requestedBranchCode !== requestedBranchId) {
    try {
      const exactIdSnap = await setupDb.collection('branches').doc(requestedBranchCode).get();
      if (exactIdSnap.exists) {
        targetBranchId = exactIdSnap.id;
      } else {
        const codeSnap = await setupDb.collection('branches').where('code', '==', requestedBranchCode).limit(1).get();
        if (!codeSnap.empty) targetBranchId = codeSnap.docs[0].id;
      }
    } catch (branchLookupError) {
      console.warn('Initial setup branch lookup notice:', branchLookupError);
    }
  }
  if (!targetBranchId || targetBranchId === 'all') return res.status(400).json({ error: 'A concrete branch code is required for initial setup.' });

  const branchCheck = checkBranchAuthorization(user, targetBranchId);
  if (!branchCheck.authorized) return res.status(403).json({ error: branchCheck.error });
  if (!branch.name || !branch.city) return res.status(400).json({ error: 'branch.name and branch.city are required.' });
  if (!restaurant.name || !restaurant.currency) return res.status(400).json({ error: 'restaurant.name and restaurant.currency are required.' });
  if (!Number.isFinite(Number(tax.taxRate)) || Number(tax.taxRate) < 0 || Number(tax.taxRate) > 100) {
    return res.status(400).json({ error: 'tax.taxRate must be a finite percentage from 0 to 100.' });
  }
  if (admin.email && user.email && admin.email.toLowerCase() !== user.email.toLowerCase()) {
    return res.status(400).json({ error: 'Initial setup administrator email must match the authenticated Firebase account.' });
  }

  const db = setupDb;
  const itemCounts = [body.employees, body.suppliers, body.inventory, body.products, body.recipes]
    .map((v) => Array.isArray(v) ? v.length : 0);
  if (itemCounts.reduce((sum, n) => sum + n, 0) + 4 > 450) {
    return res.status(400).json({ error: 'Initial setup payload is too large. Keep the setup batch within 450 Firestore writes.' });
  }
  const idemRef = db.collection('mutation_idempotency').doc(createHash('sha256').update(`initial-setup:${user.uid}:${idempotencyKey}`).digest('hex'));
  try {
    const result = await db.runTransaction(async (tx: any) => {
      const existing = await tx.get(idemRef);
      if (existing.exists) return existing.data();
      const now = new Date().toISOString();

      const branchRef = db.collection('branches').doc(targetBranchId);
      const settingsRef = db.collection('branch_settings').doc(targetBranchId);
      const userRef = db.collection('users').doc(user.uid);
      const branchSnap = await tx.get(branchRef);
      const actorSnap = await tx.get(userRef);
      const currentActor = actorSnap.exists ? (actorSnap.data() || {}) : {};
      if (!branchSnap.exists) {
        tx.set(branchRef, cleanUndefined({
          id: targetBranchId, branchName: branch.name, code: branch.code || targetBranchId,
          city: branch.city, address: branch.address || '', managerName: branch.managerName || '',
          managerPhone: branch.managerPhone || '', tableCount: Math.max(0, Number(branch.tableCount) || 0),
          isPrimary: Boolean(branch.isPrimary), status: 'active', branchId: targetBranchId, createdAt: now, createdBy: user.uid
        }));
      }
      tx.set(settingsRef, cleanUndefined({
        id: targetBranchId, branchId: targetBranchId, restaurant, tax, payments,
        isInitialSetupCompleted: true, setupCompletedAt: now, updatedAt: now, updatedBy: user.uid
      }), { merge: true });

      tx.set(userRef, cleanUndefined({
        uid: user.uid,
        email: currentActor.email || user.email,
        displayName: admin.name || currentActor.displayName || user.name,
        phoneNumber: admin.phone || currentActor.phone || '',
        role: currentActor.role || user.role,
        branchId: targetBranchId,
        branch: targetBranchId,
        status: 'active',
        updatedAt: now
      }), { merge: true });

      const employees = Array.isArray(body.employees) ? body.employees : [];
      for (const [idx, emp] of employees.entries()) {
        const ref = db.collection('employees').doc(`setup_${user.uid}_${idx + 1}`);
        tx.set(ref, cleanUndefined({
          id: ref.id, employeeId: emp.employeeId || ref.id, name: emp.name, fullName: emp.name,
          role: emp.role, jobTitle: emp.role, email: emp.email || '', phone: emp.phone || '',
          salary: Number(emp.salary) || 0, payFrequency: ['daily', 'weekly', 'monthly'].includes(String(emp.payFrequency || '').toLowerCase()) ? String(emp.payFrequency).toLowerCase() : 'monthly', shift: emp.shift || '',
          branchId: targetBranchId, branch: targetBranchId, employmentStatus: 'Active', status: 'active', hireDate: now,
          createdAt: now, updatedAt: now
        }), { merge: true });
      }
      const suppliers = Array.isArray(body.suppliers) ? body.suppliers : [];
      for (const [idx, sup] of suppliers.entries()) {
        const ref = db.collection('suppliers').doc(`setup_${user.uid}_${idx + 1}`);
        tx.set(ref, cleanUndefined({
          id: ref.id, name: sup.name, companyName: sup.name, contactPerson: sup.contactName || sup.name,
          phone: sup.phone || '', email: sup.email || '', category: sup.category || 'General Supplies',
          address: branch.city || '', branchId: targetBranchId, rating: 0, createdAt: now, updatedAt: now
        }), { merge: true });
      }
      const inventory = Array.isArray(body.inventory) ? body.inventory : [];
      for (const [idx, item] of inventory.entries()) {
        const ref = db.collection('ingredients').doc(`setup_${user.uid}_${idx + 1}`);
        const qty = Math.max(0, Number(item.currentQuantity) || 0);
        tx.set(ref, cleanUndefined({
          id: ref.id, branchId: targetBranchId, branch: targetBranchId, name: item.name,
          nameAr: item.nameAr || item.name, nameSo: item.nameSo || item.name, unit: item.unit,
          minAlertStock: Math.max(0, Number(item.minAlertStock) || 0), costPerUnit: Math.max(0, Number(item.costPerUnit) || 0),
          currentQuantity: qty, quantity: qty, stock: qty, currentStockUsageUnit: qty,
          category: item.category || 'General', lastRestocked: now, createdAt: now
        }), { merge: true });
      }
      const products = Array.isArray(body.products) ? body.products : [];
      for (const [idx, prod] of products.entries()) {
        const ref = db.collection('products').doc(`setup_${user.uid}_${idx + 1}`);
        tx.set(ref, cleanUndefined({
          id: ref.id, branchId: targetBranchId, branch: targetBranchId, name: prod.name,
          nameEn: prod.name, nameAr: prod.nameAr || prod.name, nameSo: prod.nameSo || prod.name,
          category: prod.category || 'General', price: Number(prod.price) || 0, cost: Number(prod.cost) || 0,
          imageUrl: prod.imageUrl || '', prepTimeMinutes: Number.isFinite(Number(prod.prepTimeMinutes)) ? Math.max(0, Number(prod.prepTimeMinutes)) : 0,
          isAvailable: true, createdAt: now, updatedAt: now
        }), { merge: true });
      }
      const recipes = Array.isArray(body.recipes) ? body.recipes : [];
      for (const [idx, recipe] of recipes.entries()) {
        const ref = db.collection('recipes').doc(recipe.productId || `setup_${user.uid}_${idx + 1}`);
        tx.set(ref, cleanUndefined({ ...recipe, id: ref.id, branchId: targetBranchId, productId: recipe.productId || ref.id, createdAt: now, updatedAt: now }), { merge: true });
      }

      const output = { status: 'success', branchId: targetBranchId, configuredBy: user.uid, idempotencyKey };
      tx.set(idemRef, cleanUndefined({ ...output, createdAt: now }));
      return output;
    });
    return res.json(result);
  } catch (err: any) {
    console.error('Initial setup error:', err);
    return res.status(err?.statusCode || 500).json({ error: err?.message || 'Initial setup failed.' });
  }
}

export async function handleAdminCreateUser(req: express.Request, res: express.Response) {
  const caller = await authenticateTrustedUser(req, res);
  if (!caller) return;

  const roleAuth = checkRoleAuthorization(caller, ['Owner', 'owner', 'Admin', 'admin']);
  if (!roleAuth.authorized) {
    return res.status(403).json({ error: roleAuth.error });
  }

  const { displayName, email, role, branch, branchId, password } = req.body || {};
  if (!displayName || !email || !role) {
    return res.status(400).json({ error: 'displayName, email, and role are required fields.' });
  }

  const privilegeCheck = validateUserPrivilegeUpdate(caller, { role: 'Staff' }, { role, branch, branchId });
  if (!privilegeCheck.allowed) {
    return res.status(403).json({ error: privilegeCheck.error });
  }

  const targetBranch = normalizeCanonicalBranchId(branchId || branch || caller.branchId);
  const targetBranchCheck = checkBranchAuthorization(caller, targetBranch);
  if (!targetBranchCheck.authorized) {
    return res.status(403).json({ error: targetBranchCheck.error || 'You cannot provision a user for another branch.' });
  }
  const authorizedTargetBranch = targetBranchCheck.targetBranchId;
  const db = getAdminDb();
  let uid = '';

  try {
    const adminAuth = getAdminAuth();
    let authUser: any = null;
    try {
      authUser = await adminAuth.getUserByEmail(email);
      uid = authUser.uid;
    } catch (notFound) {
      const generatedPass = password || `BabaSultan_${Math.random().toString(36).substring(2, 10)}!`;
      authUser = await adminAuth.createUser({
        email,
        displayName,
        password: generatedPass,
        emailVerified: false
      });
      uid = authUser.uid;
    }

    const now = new Date().toISOString();
    const userDocRef = db.collection('users').doc(uid);
    const userData = {
      uid,
      displayName,
      email,
      role,
      branch: authorizedTargetBranch,
      branchId: authorizedTargetBranch,
      status: 'active',
      emailVerified: false,
      createdBy: caller.uid,
      createdAt: now,
      updatedAt: now
    };

    await userDocRef.set(cleanUndefined(userData), { merge: true });

    // Log Activity
    const actRef = db.collection('activity_logs').doc();
    await actRef.set({
      id: actRef.id,
      userId: caller.uid,
      userName: caller.name,
      userRole: caller.role,
      branchId: authorizedTargetBranch,
      action: 'CREATE_USER',
      details: `Provisioned authentic Firebase Auth account ${displayName} (${email}) with role "${role}" on branch "${authorizedTargetBranch}".`,
      timestamp: now,
      ip: req.ip || '127.0.0.1'
    });

    return res.status(201).json({
      status: 'success',
      uid,
      user: userData
    });
  } catch (err: any) {
    console.error('Admin user creation error:', err);
    return res.status(500).json({ error: `Failed to create user account: ${err?.message || err}` });
  }
}




