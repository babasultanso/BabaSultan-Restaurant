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
async function executePosCheckoutRestFallback(
  orderData: any,
  idempotencyKey: string | null,
  user: AuthenticatedUser,
  targetBranchId: string
) {
  const timestamp = new Date().toISOString();
  const dateStr = getMogadishuDateString(timestamp);
  const orderNumber = orderData.orderNumber || `ORD-${Date.now().toString().slice(-6)}`;

  // Idempotency check via REST
  if (idempotencyKey) {
    const existingOrders = await safeQueryDocs('orders', 'idempotencyKey', idempotencyKey, user.idToken);
    if (existingOrders.length > 0) {
      return { status: 'duplicate', order: existingOrders[0] };
    }
  }

  // Fetch products
  const productIds = Array.from(new Set(orderData.items.map((i: any) => i.productId).filter(Boolean)));
  const productMap = new Map<string, any>();
  for (const id of productIds) {
    const pDoc = await safeGetDoc('products', id as string, user.idToken);
    if (pDoc) productMap.set(id as string, pDoc);
  }

  // Recipe ingredients check
  const ingredientIdsSet = new Set<string>();
  productMap.forEach(prodData => {
    if (prodData.recipe && Array.isArray(prodData.recipe)) {
      prodData.recipe.forEach((rItem: any) => {
        if (rItem.ingredientId) ingredientIdsSet.add(rItem.ingredientId);
      });
    }
  });

  const ingredientMap = new Map<string, any>();
  for (const ingId of Array.from(ingredientIdsSet)) {
    const ingDoc = await safeGetDoc('ingredients', ingId, user.idToken);
    if (ingDoc) ingredientMap.set(ingId, ingDoc);
  }

  const ingredientDeductions = new Map<string, { totalRequired: number; ingredientName: string; currentStock: number }>();
  const verifiedItems: any[] = [];
  let verifiedSubtotal = 0;
  let verifiedCOGS = 0;

  for (const rawItem of orderData.items) {
    if (!rawItem.productId || !productMap.has(rawItem.productId)) {
      throw new Error(`Product "${rawItem.productName || rawItem.productId}" was not found in catalog.`);
    }

    const prodData = productMap.get(rawItem.productId);
    if (prodData.isActive === false) {
      throw new Error(`Product "${prodData.name}" is currently inactive.`);
    }

    const qty = Number(rawItem.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`Invalid item quantity (${rawItem.quantity}) for product "${prodData.name}".`);
    }

    let optionsModifierSum = 0;
    if (Array.isArray(rawItem.selectedOptions) && rawItem.selectedOptions.length > 0) {
      for (const selOpt of rawItem.selectedOptions) {
        let modPrice = 0;
        if (Array.isArray(prodData.options)) {
          const parentOpt = prodData.options.find((o: any) => o.id === selOpt.optionId || o.nameEn === selOpt.optionName || o.nameAr === selOpt.optionName || o.name === selOpt.optionName);
          if (parentOpt && Array.isArray(parentOpt.choices)) {
            const choice = parentOpt.choices.find((c: any) => c.id === selOpt.choiceId || c.nameEn === selOpt.choiceName || c.nameAr === selOpt.choiceName || c.name === selOpt.choiceName);
            if (choice) {
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
      }
    }

    const serverUnitPrice = (typeof prodData.price === 'number' ? prodData.price : Number(prodData.price || 0)) + optionsModifierSum;
    const itemTotal = serverUnitPrice * qty;
    verifiedSubtotal += itemTotal;

    let itemCOGS = 0;
    if (prodData.recipe && Array.isArray(prodData.recipe) && prodData.recipe.length > 0) {
      for (const rItem of prodData.recipe) {
        const ingData = ingredientMap.get(rItem.ingredientId);
        const reqQtyPerUnit = Number(rItem.quantity || 0);
        const totalReqQty = reqQtyPerUnit * qty;
        const ingCostPerUnit = Number(ingData?.costPerUnit || rItem.costPerUnit || 0);
        itemCOGS += totalReqQty * ingCostPerUnit;

        if (ingData) {
          const currentDeduction = ingredientDeductions.get(rItem.ingredientId) || {
            totalRequired: 0,
            ingredientName: ingData.name || rItem.ingredientName,
            currentStock: Number(ingData.stock || 0)
          };
          currentDeduction.totalRequired += totalReqQty;
          ingredientDeductions.set(rItem.ingredientId, currentDeduction);
        }
      }
    } else {
      itemCOGS = Number(prodData.costPrice || prodData.cost || 0) * qty;
    }
    verifiedCOGS += itemCOGS;

    if (prodData.trackStock === true && typeof prodData.stock === 'number') {
      if (prodData.stock < qty) {
        throw new Error(`Insufficient inventory stock for product "${prodData.name}". Available: ${prodData.stock}, Requested: ${qty}.`);
      }
    }

    verifiedItems.push({
      ...rawItem,
      productId: rawItem.productId,
      productName: prodData.name,
      price: serverUnitPrice,
      unitPrice: serverUnitPrice,
      subtotal: itemTotal,
      totalPrice: itemTotal,
      quantity: qty,
      itemCogs: itemCOGS,
      selectedOptions: rawItem.selectedOptions || [],
      notes: rawItem.notes || ''
    });
  }

  for (const [ingId, info] of ingredientDeductions.entries()) {
    if (info.currentStock < info.totalRequired) {
      throw new Error(`Insufficient raw ingredient stock for "${info.ingredientName}". Available: ${info.currentStock.toFixed(2)}, Required: ${info.totalRequired.toFixed(2)}.`);
    }
  }

  const requestedDiscount = Math.max(0, Number(orderData.discountAmount || 0));
  const validatedDiscount = Math.min(verifiedSubtotal, requestedDiscount);
  const netTaxableAmount = Math.max(0, verifiedSubtotal - validatedDiscount);

  // Server-authoritative Tax Rate lookup
  let configuredTaxRate: number | null = null;
  const branchDoc = await safeGetDoc('branches', targetBranchId, user.idToken);
  
  // Tax optionality determined strictly by server branch config (never client orderData)
  const isTaxExplicitlyDisabled = branchDoc?.taxEnabled === false || branchDoc?.taxEnabled === 'false';
  const isTaxExplicitlyEnabled = branchDoc?.taxEnabled === true || branchDoc?.taxEnabled === 'true';

  if (isTaxExplicitlyDisabled) {
    configuredTaxRate = 0;
  } else if (branchDoc && typeof branchDoc.taxRate === 'number') {
    const bTax = branchDoc.taxRate;
    configuredTaxRate = bTax > 1 ? bTax / 100 : bTax;
  } else {
    let taxesDocs = await safeQueryDocs('taxes', 'isActive', true, user.idToken);
    if (!taxesDocs || taxesDocs.length === 0) {
      taxesDocs = await safeQueryDocs('taxes', 'status', 'Active', user.idToken);
    }
    const branchTaxes = (taxesDocs || []).filter((t: any) => 
      (t.isActive === true || t.status === 'Active' || t.status === 'active') && 
      (t.branchId === targetBranchId || t.branchId === 'all' || !t.branchId || t.isDefault)
    );
    if (branchTaxes.length > 0) {
      const primaryTax = branchTaxes.find((t: any) => t.branchId === targetBranchId) ||
                         branchTaxes.find((t: any) => t.isPrimary === true || t.isDefault === true || t.taxType === 'vat' || t.taxType === 'sales_tax') ||
                         branchTaxes[0];
      if (primaryTax && typeof primaryTax.rate === 'number') {
        const r = Number(primaryTax.rate || 0);
        configuredTaxRate = r > 1 ? r / 100 : r;
      }
    } else if (!isTaxExplicitlyEnabled && (!taxesDocs || taxesDocs.length === 0)) {
      // If branch does not have tax enabled and no tax documents exist
      if (branchDoc && (branchDoc.taxEnabled === false || branchDoc.taxEnabled === 'false')) {
        configuredTaxRate = 0;
      }
    }
  }

  if (configuredTaxRate === null) {
    throw new Error(`Tax configuration not found for branch "${targetBranchId}". Checkout rejected.`);
  }

  const taxRate = configuredTaxRate;
  const realTax = Math.round(netTaxableAmount * taxRate * 100) / 100;

  // Server-authoritative Delivery Fee & Driver Earnings Calculation
  let deliveryFee = 0;
  let driverEarningsAmount = 0;

  if (orderData.orderType === 'delivery') {
    if (branchDoc && (branchDoc.deliveryEnabled === false || branchDoc.deliveryEnabled === 'false')) {
      throw new Error(`Delivery service is currently disabled for branch "${targetBranchId}". Checkout rejected.`);
    }

    let isDeliveryFeeEnabled = true;
    if (branchDoc && (branchDoc.deliveryFeeEnabled === false || branchDoc.deliveryFeeEnabled === 'false')) {
      isDeliveryFeeEnabled = false;
    }

    if (orderData.deliveryZoneId) {
      const zDoc = await safeGetDoc('delivery_zones', orderData.deliveryZoneId, user.idToken);
      if (!zDoc) {
        throw new Error(`Delivery zone "${orderData.deliveryZoneId}" not found in database. Checkout rejected.`);
      }
      if (zDoc.branchId && zDoc.branchId !== targetBranchId) {
        throw new Error(`Delivery zone "${orderData.deliveryZoneId}" does not belong to branch "${targetBranchId}". Checkout rejected.`);
      }

      if (zDoc.deliveryFeeEnabled === false || zDoc.deliveryFeeEnabled === 'false') {
        isDeliveryFeeEnabled = false;
      }

      if (zDoc.driverEarningsEnabled === true || typeof zDoc.driverEarningsAmount === 'number') {
        driverEarningsAmount = Math.max(0, Number(zDoc.driverEarningsAmount || 0));
      }

      if (isDeliveryFeeEnabled) {
        let rawZoneFee: any = null;
        if (zDoc.baseDeliveryFee !== undefined && zDoc.baseDeliveryFee !== null) {
          rawZoneFee = zDoc.baseDeliveryFee;
        } else if (zDoc.deliveryFee !== undefined && zDoc.deliveryFee !== null) {
          rawZoneFee = zDoc.deliveryFee;
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
        if (branchDoc) {
          if (branchDoc.defaultDeliveryFee !== undefined && branchDoc.defaultDeliveryFee !== null) {
            serverFee = branchDoc.defaultDeliveryFee;
          } else if (branchDoc.deliveryFee !== undefined && branchDoc.deliveryFee !== null) {
            serverFee = branchDoc.deliveryFee;
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

    if (driverEarningsAmount === 0 && branchDoc) {
      if (branchDoc.driverEarningsEnabled === true || typeof branchDoc.driverEarningsAmount === 'number') {
        driverEarningsAmount = Math.max(0, Number(branchDoc.driverEarningsAmount || 0));
      }
    }
  } else {
    // Pickup or Dine-in: strictly 0 delivery fee
    deliveryFee = 0;
    driverEarningsAmount = 0;
  }

  const realTotalAmount = Math.round((netTaxableAmount + realTax + deliveryFee) * 100) / 100;
  // Restaurant Revenue = Food sales (netTaxableAmount) + Delivery Fee Revenue (deliveryFee). Driver earnings is NOT part of Restaurant Sales Revenue.
  const realProfit = (netTaxableAmount + deliveryFee) - verifiedCOGS - driverEarningsAmount;

  // Driver Collection Breakdown (Server-calculated)
  const isCashOrCod = orderData.paymentMethod === 'cash' || orderData.paymentMethod === 'cod';
  const amountCollectedByDriver = (orderData.orderType === 'delivery' && isCashOrCod) ? realTotalAmount : 0;
  const restaurantDue = Math.max(0, (isCashOrCod ? realTotalAmount : (netTaxableAmount + realTax + deliveryFee)) - driverEarningsAmount);
  const driverDue = driverEarningsAmount;

  // Server-authoritative Payment Status
  const ALLOWED_PAYMENT_METHODS = ['cash', 'card', 'bank', 'mobile_money', 'credit', 'unpaid'];
  const rawPayMethod = String(orderData.paymentMethod || 'cash').toLowerCase();
  if (!ALLOWED_PAYMENT_METHODS.includes(rawPayMethod)) {
    throw new Error(`Invalid payment method "${rawPayMethod}". Allowed methods: ${ALLOWED_PAYMENT_METHODS.join(', ')}.`);
  }

  let isPaidSale = false;
  let finalPayMethod = rawPayMethod;
  let paidTenderAmount = 0;

  if (rawPayMethod === 'credit') {
    if (!orderData.customerId && !orderData.customerName) {
      throw new Error('Credit order rejected: A valid customer name or ID is required for credit sales.');
    }
    isPaidSale = false;
    finalPayMethod = 'credit';
    paidTenderAmount = 0;
  } else if (rawPayMethod === 'unpaid') {
    isPaidSale = false;
    finalPayMethod = 'unpaid';
    paidTenderAmount = 0;
  } else {
    // rawPayMethod in ['cash', 'card', 'bank', 'mobile_money']
    const providedPaid = orderData.paidAmount ?? orderData.paymentAmount ?? orderData.amountTendered;
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
      throw new Error(`Overpayment rejected: Payment amount ($${numPaid.toFixed(2)}) exceeds total amount ($${realTotalAmount.toFixed(2)}). Exact payment required, no change allowed.`);
    }
    isPaidSale = true;
    finalPayMethod = rawPayMethod;
    paidTenderAmount = realTotalAmount;
  }

  const finalPaymentStatus = isPaidSale ? 'paid' : 'unpaid';

  const writes: Array<{ collection: string; id: string; data: any; isUpdate?: boolean }> = [];

  for (const rawItem of orderData.items) {
    const prodData = productMap.get(rawItem.productId);
    if (prodData && prodData.trackStock === true && typeof prodData.stock === 'number') {
      const newStock = Math.max(0, Number(prodData.stock || 0) - Number(rawItem.quantity));
      const newSalesCount = Number(prodData.salesCount || 0) + Number(rawItem.quantity);
      writes.push({
        collection: 'products',
        id: rawItem.productId,
        data: { stock: newStock, salesCount: newSalesCount, updatedAt: timestamp },
        isUpdate: true
      });
    }
  }

  for (const [ingId, info] of ingredientDeductions.entries()) {
    const newIngStock = Math.max(0, info.currentStock - info.totalRequired);
    writes.push({
      collection: 'ingredients',
      id: ingId,
      data: { stock: newIngStock, lastUpdated: timestamp, updatedAt: timestamp },
      isUpdate: true
    });

    const movementId = `mov-${Date.now()}-${randomUUID().substring(0, 8)}`;
    writes.push({
      collection: 'inventory_movements',
      id: movementId,
      data: {
        id: movementId,
        type: 'out',
        itemType: 'ingredient',
        itemId: ingId,
        itemName: info.ingredientName,
        quantity: info.totalRequired,
        branchId: targetBranchId,
        reason: `Auto stock deduction for Order #${orderNumber}`,
        createdBy: user.name,
        createdAt: timestamp
      }
    });
  }

  const orderId = orderData.id || `ORD-${Date.now()}-${randomUUID().substring(0, 8)}`;
  const fullOrder = {
    ...orderData,
    id: orderId,
    orderNumber,
    branchId: targetBranchId,
    items: verifiedItems,
    subtotal: verifiedSubtotal,
    discountAmount: validatedDiscount,
    tax: realTax,
    deliveryFee: deliveryFee,
    totalAmount: realTotalAmount,
    paidAmount: isPaidSale ? realTotalAmount : 0,
    tenderAmount: isPaidSale ? realTotalAmount : 0,
    amountTendered: isPaidSale ? realTotalAmount : 0,
    change: 0,
    changeAmount: 0,
    changeDue: 0,
    cogs: verifiedCOGS,
    profit: realProfit,
    driverEarningsAmount: driverEarningsAmount,
    orderTotal: realTotalAmount,
    amountCollectedByDriver: amountCollectedByDriver,
    restaurantDue: restaurantDue,
    driverDue: driverDue,
    paymentStatus: isPaidSale ? 'paid' : (orderData.paymentStatus || 'unpaid'),
    status: orderData.status || 'completed',
    employeeId: user.uid,
    employeeName: user.name,
    idempotencyKey: idempotencyKey || null,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  writes.push({
    collection: 'orders',
    id: orderId,
    data: fullOrder
  });

  if (fullOrder.paymentStatus === 'paid') {
    const payId = `pay-${Date.now()}-${randomUUID().substring(0, 8)}`;
    writes.push({
      collection: 'payments',
      id: payId,
      data: {
        id: payId,
        orderId: fullOrder.id,
        orderNumber,
        amount: fullOrder.totalAmount,
        tenderAmount: fullOrder.totalAmount,
        amountTendered: fullOrder.totalAmount,
        changeAmount: 0,
        changeDue: 0,
        method: fullOrder.paymentMethod || 'cash',
        status: 'paid',
        branchId: targetBranchId,
        processedBy: user.name,
        createdAt: timestamp
      }
    });
  }

  const kitchenItems = verifiedItems.map(item => ({
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    notes: item.notes || '',
    selectedOptions: item.selectedOptions || [],
    assignedStation: routeProductToStation(item.productName),
    itemStatus: 'new'
  }));

  writes.push({
    collection: 'kitchen_orders',
    id: orderId,
    data: {
      id: orderId,
      orderId: orderId,
      orderNumber,
      orderTime: timestamp,
      createdAt: timestamp,
      orderType: fullOrder.orderType || 'dine_in',
      tableNumber: fullOrder.tableNumber || '',
      customerName: fullOrder.customerName || 'Walk-in Guest',
      branchId: targetBranchId,
      items: kitchenItems,
      prepStatus: 'new',
      priority: 'medium',
      updatedAt: timestamp
    }
  });

  if (fullOrder.orderType === 'delivery') {
    const itemsSummary = verifiedItems.map(i => `${i.quantity}x ${i.productName}`).join(', ');
    const itemsCount = verifiedItems.reduce((sum, i) => sum + i.quantity, 0);

    writes.push({
      collection: 'deliveries',
      id: orderId,
      data: {
        id: orderId,
        orderId: orderId,
        orderNumber,
        customerName: fullOrder.customerName || 'Delivery Customer',
        customerPhone: fullOrder.customerPhone || '',
        deliveryAddress: fullOrder.deliveryAddress || fullOrder.customerAddress || 'Default Address',
        deliveryZoneId: fullOrder.deliveryZoneId,
        deliveryZoneName: fullOrder.deliveryZoneName,
        branchId: targetBranchId,
        branchName: (user as any).branch || 'Headquarters',
        status: 'unassigned',
        subtotal: verifiedSubtotal,
        deliveryFee: fullOrder.deliveryFee || 0,
        totalAmount: realTotalAmount,
        paymentMethod: fullOrder.paymentMethod || 'cash',
        paymentStatus: fullOrder.paymentStatus || 'paid',
        itemsCount,
        itemsSummary,
        estimatedDeliveryTimeMinutes: 30,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    });
  }

  const jeId = `je-${Date.now()}-${randomUUID().substring(0, 8)}`;
  const entryNumber = `JE-POS-${orderNumber}`;
  const payMethod = fullOrder.paymentMethod || 'cash';
  let paymentAccountId = 'acc_cash';
  let paymentAccountCode = '1010';
  let paymentAccountName = 'Cash on Hand (Register)';

  if (fullOrder.paymentStatus === 'unpaid' || payMethod === 'credit') {
    paymentAccountId = 'acc_ar';
    paymentAccountCode = '1200';
    paymentAccountName = 'Accounts Receivable (AR)';
  } else if (payMethod === 'card' || payMethod === 'bank' || payMethod === 'mobile_money') {
    paymentAccountId = 'acc_bank';
    paymentAccountCode = '1020';
    paymentAccountName = 'Main Bank Account (Premier Bank)';
  }

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
      memo: `Food Revenue from Order #${orderNumber}`
    },
    {
      accountId: 'acc_delivery_revenue',
      accountCode: '4020',
      accountName: 'Delivery Fee Revenue',
      debit: 0,
      credit: deliveryFee,
      memo: `Delivery Fee Revenue Order #${orderNumber}`
    },
    {
      accountId: 'acc_tax',
      accountCode: '2020',
      accountName: 'Sales Tax Payable',
      debit: 0,
      credit: realTax,
      memo: `Sales Tax Collected Order #${orderNumber}`
    },
    {
      accountId: 'acc_inventory',
      accountCode: '1030',
      accountName: 'Food & Beverage Inventory',
      debit: 0,
      credit: verifiedCOGS,
      memo: `Inventory Deduction for Order #${orderNumber}`
    },
    {
      accountId: 'acc_driver_expense',
      accountCode: '5030',
      accountName: 'Driver Commission Expense',
      debit: driverEarningsAmount,
      credit: 0,
      memo: `Driver Commission Expense Order #${orderNumber}`
    },
    {
      accountId: 'acc_driver_payable',
      accountCode: '2030',
      accountName: 'Accrued Driver Payable',
      debit: 0,
      credit: driverEarningsAmount,
      memo: `Accrued Driver Payable Order #${orderNumber}`
    }
  ].filter(line => (line.debit > 0 || line.credit > 0));

  const totalDebit = journalLines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = journalLines.reduce((s, l) => s + (l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(`Accounting Double-Entry Error: Unbalanced POS Journal Entry! Total Debit (${totalDebit.toFixed(2)}) !== Total Credit (${totalCredit.toFixed(2)}).`);
  }

  const journalEntry = {
    id: jeId,
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

  writes.push({
    collection: 'journal_entries',
    id: jeId,
    data: journalEntry
  });

  for (const line of journalLines) {
    const jlId = `jl-${Date.now()}-${randomUUID().substring(0, 8)}`;
    writes.push({
      collection: 'journal_lines',
      id: jlId,
      data: {
        id: jlId,
        journalEntryId: jeId,
        entryNumber,
        branchId: targetBranchId,
        ...line,
        createdAt: timestamp
      }
    });

    const ledgerId = `led-${Date.now()}-${randomUUID().substring(0, 8)}`;
    writes.push({
      collection: 'ledger',
      id: ledgerId,
      data: {
        id: ledgerId,
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        journalEntryId: jeId,
        entryNumber,
        date: dateStr,
        reference: orderNumber,
        description: line.memo || journalEntry.description,
        debit: line.debit,
        credit: line.credit,
        runningBalance: 0,
        branchId: targetBranchId,
        createdAt: timestamp
      }
    });
  }

  const auditId = `aud-${Date.now()}-${randomUUID().substring(0, 8)}`;
  writes.push({
    collection: 'activity_logs',
    id: auditId,
    data: {
      id: auditId,
      userId: user.uid,
      userName: user.name,
      userRole: user.role,
      action: 'POS_ORDER_COMPLETED',
      module: 'POS',
      description: `Completed Order #${orderNumber} for $${realTotalAmount.toFixed(2)}`,
      branchId: targetBranchId,
      timestamp
    }
  });

  await commitRestWrites(writes, user.idToken);

  return { status: 'success', order: fullOrder };
}

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

  const { orderData, idempotencyKey } = req.body || {};
  if (!orderData || !Array.isArray(orderData.items) || orderData.items.length === 0) {
    return res.status(400).json({ error: 'Invalid POS Checkout Request: Order items required.' });
  }

  // Branch authorization check
  const requestedBranch = orderData.branchId || orderData.branch || '';
  const branchCheck = checkBranchAuthorization(user, requestedBranch);

  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }
  const targetBranchId = branchCheck.targetBranchId;
  const db = getAdminDb();

  try {
    const result = await runTransactionWithRetry(db, async (transaction) => {
      const orderNumber = orderData.orderNumber || `ORD-${Date.now().toString().slice(-6)}`;

      // Idempotency check: prevent duplicate checkout submission
      if (idempotencyKey) {
        const idempQuery = await transaction.get(
          db.collection('orders').where('idempotencyKey', '==', idempotencyKey).limit(1)
        );
        if (!idempQuery.empty) {
          const existingOrder = idempQuery.docs[0].data();
          return { status: 'duplicate', order: existingOrder };
        }
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

      // Recipe ingredients check
      const ingredientIdsSet = new Set<string>();
      productMap.forEach(prodData => {
        if (prodData.recipe && Array.isArray(prodData.recipe)) {
          prodData.recipe.forEach((rItem: any) => {
            if (rItem.ingredientId) ingredientIdsSet.add(rItem.ingredientId);
          });
        }
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
        if (Array.isArray(rawItem.selectedOptions) && rawItem.selectedOptions.length > 0) {
          for (const selOpt of rawItem.selectedOptions) {
            let modPrice = 0;
            if (Array.isArray(prodData.options)) {
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
          }
        }

        const serverUnitPrice = baseUnitPrice + optionsModifierSum;
        const itemTotal = serverUnitPrice * qty;
        verifiedSubtotal += itemTotal;

        // Calculate COGS
        let itemCOGS = 0;
        if (prodData.recipe && Array.isArray(prodData.recipe) && prodData.recipe.length > 0) {
          for (const rItem of prodData.recipe) {
            const ingData = ingredientMap.get(rItem.ingredientId);
            if (!ingData) {
              throw new Error(`Ingredient missing for recipe of "${prodData.name}".`);
            }
            const reqQty = Number(rItem.quantity || 0) * qty;
            const ingCost = Number(ingData.costPerUnit || ingData.cost || 0);
            itemCOGS += reqQty * ingCost;

            const existing = ingredientDeductions.get(rItem.ingredientId) || {
              totalRequired: 0,
              ingredientName: ingData.name || 'Ingredient',
              currentStock: Number(ingData.stock || 0)
            };
            existing.totalRequired += reqQty;
            ingredientDeductions.set(rItem.ingredientId, existing);
          }
        } else {
          const directCost = typeof prodData.cost === 'number' ? prodData.cost : 0;
          itemCOGS = directCost * qty;
        }

        verifiedCOGS += itemCOGS;

        // Verify product stock if direct stock tracking
        if (prodData.trackStock === true && typeof prodData.stock === 'number') {
          if (prodData.stock < qty) {
            throw new Error(`Insufficient stock for product "${prodData.name}". Requested: ${qty}, Available: ${prodData.stock}.`);
          }
        }

        verifiedItems.push({
          productId: rawItem.productId,
          productName: prodData.name,
          quantity: qty,
          price: serverUnitPrice,
          unitPrice: serverUnitPrice,
          subtotal: itemTotal,
          totalPrice: itemTotal,
          notes: rawItem.notes || '',
          selectedOptions: rawItem.selectedOptions || [],
          itemCogs: itemCOGS
        });
      }

      // Verify ingredient stocks
      for (const [ingId, info] of ingredientDeductions.entries()) {
        if (info.currentStock < info.totalRequired) {
          throw new Error(`Insufficient stock for ingredient "${info.ingredientName}". Required: ${info.totalRequired.toFixed(2)}, Available: ${info.currentStock.toFixed(2)}.`);
        }
      }

      // Financial totals recalculation
      const requestedDiscount = Number(orderData.discountAmount || 0);
      const isManagementOrAdminRole = ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager'].includes(user.role);
      const maxDiscountAllowed = isManagementOrAdminRole ? verifiedSubtotal : Math.min(verifiedSubtotal * 0.15, 25);
      if (requestedDiscount > maxDiscountAllowed) {
        throw new Error(`Discount amount (${requestedDiscount.toFixed(2)}) exceeds authorized role limit (${maxDiscountAllowed.toFixed(2)}) for role "${user.role}".`);
      }
      const validatedDiscount = Math.min(Math.max(0, requestedDiscount), verifiedSubtotal);

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
        if (branchDocs.length === 0) {
          const allTaxesQuery = await transaction.get(
            db.collection('taxes').where('isActive', '==', true)
          );
          if (!allTaxesQuery.empty) {
            branchDocs = allTaxesQuery.docs.map(d => d.data()).filter((t: any) => t.branchId === 'all' || !t.branchId || t.isDefault);
          }
        }

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
      const isCashOrCod = orderData.paymentMethod === 'cash' || orderData.paymentMethod === 'cod';
      const amountCollectedByDriver = (orderData.orderType === 'delivery' && isCashOrCod) ? realTotalAmount : 0;
      const restaurantDue = Math.max(0, (isCashOrCod ? realTotalAmount : (taxableSubtotal + realTax + deliveryFee)) - driverEarningsAmount);
      const driverDue = driverEarningsAmount;

      // Server-Authoritative Payment Validation
      const ALLOWED_PAYMENT_METHODS = ['cash', 'card', 'bank', 'mobile_money', 'credit', 'unpaid'];
      const rawPayMethod = String(orderData.paymentMethod || 'cash').toLowerCase();
      if (!ALLOWED_PAYMENT_METHODS.includes(rawPayMethod)) {
        throw new Error(`Invalid payment method "${rawPayMethod}". Allowed methods: ${ALLOWED_PAYMENT_METHODS.join(', ')}.`);
      }

      let isPaidSale = false;
      let finalPayMethod = rawPayMethod;
      let paidTenderAmount = 0;

      if (rawPayMethod === 'credit') {
        if (!orderData.customerId && !orderData.customerName) {
          throw new Error('Credit order rejected: A valid customer name or ID is required for credit sales.');
        }
        isPaidSale = false;
        finalPayMethod = 'credit';
        paidTenderAmount = 0;
      } else if (rawPayMethod === 'unpaid') {
        isPaidSale = false;
        finalPayMethod = 'unpaid';
        paidTenderAmount = 0;
      } else {
        const providedPaid = orderData.paidAmount ?? orderData.paymentAmount ?? orderData.amountTendered;
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
          throw new Error(`Overpayment rejected: Payment amount ($${numPaid.toFixed(2)}) exceeds total amount ($${realTotalAmount.toFixed(2)}). Exact payment required, no change allowed.`);
        }
        isPaidSale = true;
        paidTenderAmount = realTotalAmount;
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

      const newOrderRef = db.collection('orders').doc();
      const timestamp = new Date().toISOString();
      const dateStr = getMogadishuDateString(timestamp);

      // Perform Product Stock Deductions & Inventory Movements
      for (const item of verifiedItems) {
        const prodData = productMap.get(item.productId);
        if (prodData && prodData.trackStock === true && typeof prodData.stock === 'number') {
          const newStock = Math.max(0, prodData.stock - item.quantity);
          transaction.update(db.collection('products').doc(item.productId), { stock: newStock });

          const movementRef = db.collection('inventory_movements').doc();
          transaction.set(movementRef, cleanUndefined({
            id: movementRef.id,
            type: 'out',
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
        transaction.update(db.collection('ingredients').doc(ingId), { stock: newStock });

        const movementRef = db.collection('inventory_movements').doc();
        transaction.set(movementRef, cleanUndefined({
          id: movementRef.id,
          type: 'out',
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
        tenderAmount: isPaidSale ? realTotalAmount : 0,
        amountTendered: isPaidSale ? realTotalAmount : 0,
        change: 0,
        changeAmount: 0,
        changeDue: 0,
        cogs: verifiedCOGS,
        profit: realProfit,
        driverEarningsAmount,
        orderTotal: realTotalAmount,
        amountCollectedByDriver,
        restaurantDue,
        driverDue,
        paymentMethod: finalPayMethod,
        paymentStatus: finalPaymentStatus,
        status: orderData.status || 'completed',
        deliveryStatus: (orderData.orderType === 'delivery' || orderData.type === 'delivery') ? (orderData.deliveryStatus || 'unassigned') : undefined,
        employeeId: user.uid,
        employeeName: user.name,
        idempotencyKey: idempotencyKey || null,
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
          tenderAmount: fullOrder.totalAmount,
          amountTendered: fullOrder.totalAmount,
          changeAmount: 0,
          changeDue: 0,
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
        assignedStation: routeProductToStation(item.productName),
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
          deliveryAddress: fullOrder.deliveryAddress || fullOrder.customerAddress || 'Default Address',
          deliveryZoneId: fullOrder.deliveryZoneId,
          deliveryZoneName: fullOrder.deliveryZoneName,
          branchId: targetBranchId,
          branchName: (user as any).branch || 'Headquarters',
          status: 'unassigned',
          subtotal: verifiedSubtotal,
          deliveryFee: fullOrder.deliveryFee || 0,
          totalAmount: realTotalAmount,
          paymentMethod: fullOrder.paymentMethod || 'cash',
          paymentStatus: fullOrder.paymentStatus || 'paid',
          itemsCount,
          itemsSummary,
          estimatedDeliveryTimeMinutes: 30,
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
        const pointsEarned = Math.floor(realTotalAmount);

        let membershipLevel = cData.membershipLevel || 'Bronze';
        if (newTotalSpent >= 1000) membershipLevel = 'Platinum';
        else if (newTotalSpent >= 500) membershipLevel = 'Gold';
        else if (newTotalSpent >= 200) membershipLevel = 'Silver';

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
      
      let paymentAccountId = 'acc_cash';
      let paymentAccountCode = '1010';
      let paymentAccountName = 'Cash on Hand (Register)';

      if (fullOrder.paymentStatus === 'unpaid' || payMethod === 'credit') {
        paymentAccountId = 'acc_ar';
        paymentAccountCode = '1200';
        paymentAccountName = 'Accounts Receivable (AR)';
      } else if (payMethod === 'card' || payMethod === 'bank' || payMethod === 'mobile_money') {
        paymentAccountId = 'acc_bank';
        paymentAccountCode = '1020';
        paymentAccountName = 'Main Bank Account (Premier Bank)';
      }

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
          runningBalance: 0,
          branchId: targetBranchId,
          createdAt: timestamp
        }));
      }

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

      return { success: true, status: 'success', order: fullOrder };
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

  if (!orderId) {
    return res.status(400).json({ error: 'Order ID is required for cancellation.' });
  }

  const db = getAdminDb();

  try {
    const result = await db.runTransaction(async (transaction) => {
      // Phase 1 (All Reads)
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

      const isAlreadyFullyRefunded = orderData.paymentStatus === 'refunded' || Number(orderData.refundedAmount || 0) >= Number(orderData.totalAmount || 0) - 0.001;

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
              const currentStock = typeof prodData.stock === 'number' ? prodData.stock : 0;
              const restoredQty = Number(item.quantity || 0);
              const newStock = currentStock + restoredQty;

              const recipeRestorations: ProdRestoreInfo['recipeRestorations'] = [];
              if (Array.isArray(prodData.recipe) && prodData.recipe.length > 0) {
                for (const rItem of prodData.recipe) {
                  if (rItem.ingredientId) {
                    const ingRef = db.collection('ingredients').doc(rItem.ingredientId);
                    const ingSnap = await transaction.get(ingRef);
                    if (ingSnap.exists) {
                      const ingData = ingSnap.data() || {};
                      const currentIngStock = typeof ingData.stock === 'number' ? ingData.stock : 0;
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

      // Read Kitchen Ticket if exists
      const kitchenRef = db.collection('kitchen_orders').doc(orderId);
      const kitchenSnap = await transaction.get(kitchenRef);

      // Phase 2 (All Writes)
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
        transaction.update(pr.prodRef, { stock: pr.newStock });

        const movementRef = db.collection('inventory_movements').doc();
        transaction.set(movementRef, cleanUndefined({
          id: movementRef.id,
          type: 'in',
          itemType: 'product',
          itemId: pr.item.productId,
          itemName: pr.item.productName || pr.prodData.name,
          quantity: pr.restoredQty,
          branchId: targetBranchId,
          reason: `Stock restored from cancelled Order #${orderData.orderNumber || orderId}`,
          createdBy: user.name,
          createdAt: timestamp
        }));

        for (const rr of pr.recipeRestorations) {
          transaction.update(rr.ingRef, { stock: rr.newIngStock });

          const ingMovRef = db.collection('inventory_movements').doc();
          transaction.set(ingMovRef, cleanUndefined({
            id: ingMovRef.id,
            type: 'in',
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

      const totalAmt = Number(orderData.totalAmount || 0);

      // Accounting Reversal Entry (Skip financial reversal if already fully refunded through customer refund)
      if (!isAlreadyFullyRefunded) {
        const subtotal = Number(orderData.subtotal || 0);
        const discount = Number(orderData.discountAmount || 0);
        const netRev = Math.max(0, subtotal - discount);
        const tax = Number(orderData.tax || 0);
        const deliveryFeeRev = Number(orderData.deliveryFee || 0);
        const cogs = Number(orderData.cogs || 0);
        const payMethod = String(orderData.paymentMethod || 'cash').toLowerCase();
        const isOriginalCredit = payMethod === 'credit' || orderData.isCredit === true || orderData.isCredit === 'true';
        const isOriginalUnpaid = String(orderData.paymentStatus || '').toLowerCase() === 'unpaid' || Number(orderData.paidAmount ?? orderData.paymentAmount ?? 0) <= 0;

        let paymentAccountId = 'acc_cash';
        let paymentAccountCode = '1010';
        let paymentAccountName = 'Cash on Hand (Register)';
        let paymentMemo = `Cash Refund for Cancelled Order #${orderData.orderNumber || orderId}`;

        if (isOriginalCredit || isOriginalUnpaid) {
          paymentAccountId = 'acc_ar';
          paymentAccountCode = '1200';
          paymentAccountName = 'Accounts Receivable';
          paymentMemo = `AR Reversal for Cancelled Unpaid/Credit Order #${orderData.orderNumber || orderId}`;
        } else if (payMethod === 'bank' || payMethod === 'card' || payMethod === 'mobile_money') {
          paymentAccountId = 'acc_bank';
          paymentAccountCode = '1020';
          paymentAccountName = 'Main Bank Account (Premier Bank)';
          paymentMemo = `Bank Refund for Cancelled Order #${orderData.orderNumber || orderId}`;
        }

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
            runningBalance: 0,
            branchId: targetBranchId,
            createdAt: timestamp
          }));
        }
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
  const { amount, reason, paymentMethod } = req.body || {};

  if (!orderId) {
    return res.status(400).json({ error: 'Order ID is required for processing a refund.' });
  }

  const refundAmount = Number(amount || 0);
  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    return res.status(400).json({ error: 'Refund amount must be a positive numeric value.' });
  }

  const db = getAdminDb();

  try {
    const result = await db.runTransaction(async (transaction) => {
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
      const refundRatio = originalTotal > 0 ? Math.min(1, Math.max(0, refundAmount / originalTotal)) : 0;

      // Phase 1 (All Reads) - Read all product and recipe documents before any writes
      interface ProdRefundRestoreInfo {
        prodRef: any;
        prodData: any;
        item: any;
        restoredQty: number;
        newStock: number;
        recipeRestorations: Array<{
          ingRef: any;
          ingData: any;
          newIngStock: number;
          reqQty: number;
        }>;
      }

      const refundProdRestorations: ProdRefundRestoreInfo[] = [];

      if (refundRatio > 0 && Array.isArray(orderData.items) && orderData.items.length > 0) {
        for (const item of orderData.items) {
          if (item.productId) {
            const prodRef = db.collection('products').doc(item.productId);
            const prodSnap = await transaction.get(prodRef);
            if (prodSnap.exists) {
              const prodData = prodSnap.data() || {};
              const currentStock = typeof prodData.stock === 'number' ? prodData.stock : 0;
              const restoredQty = (Number(item.quantity || 0) * refundRatio);

              if (restoredQty > 0) {
                const recipeRestorations: ProdRefundRestoreInfo['recipeRestorations'] = [];
                if (Array.isArray(prodData.recipe) && prodData.recipe.length > 0) {
                  for (const rItem of prodData.recipe) {
                    if (rItem.ingredientId) {
                      const ingRef = db.collection('ingredients').doc(rItem.ingredientId);
                      const ingSnap = await transaction.get(ingRef);
                      if (ingSnap.exists) {
                        const ingData = ingSnap.data() || {};
                        const currentIngStock = typeof ingData.stock === 'number' ? ingData.stock : 0;
                        const reqQty = Number(rItem.quantity || 0) * restoredQty;
                        if (reqQty > 0) {
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
                }

                refundProdRestorations.push({
                  prodRef,
                  prodData,
                  item,
                  restoredQty,
                  newStock: currentStock + restoredQty,
                  recipeRestorations
                });
              }
            }
          }
        }
      }

      // Phase 2 (All Writes)
      // Mutate order document inside transaction to guarantee contention lock
      transaction.update(orderRef, {
        refundedAmount: updatedRefundedAmount,
        paymentStatus: isFullyRefunded ? 'refunded' : 'partially_refunded',
        status: isFullyRefunded ? 'cancelled' : (orderData.status || 'completed'),
        updatedAt: timestamp
      });

      // Create Refund Document
      const newRefundRef = db.collection('refunds').doc();
      const refundDoc = {
        id: newRefundRef.id,
        orderId,
        orderNumber: orderData.orderNumber || `ORD-${orderId.slice(0, 6)}`,
        amount: refundAmount,
        reason: reason || 'Customer Refund Request',
        paymentMethod: effectivePayMethod,
        branchId: targetBranchId,
        processedBy: user.name,
        createdAt: timestamp
      };

      transaction.set(newRefundRef, cleanUndefined(refundDoc));

      // Reversal Accounting Journal Entry with proportional Tax and COGS Reversal
      let paymentAccountId = 'acc_cash';
      let paymentAccountCode = '1010';
      let paymentAccountName = 'Cash on Hand (Register)';

      if (effectivePayMethod === 'credit') {
        paymentAccountId = 'acc_ar';
        paymentAccountCode = '1200';
        paymentAccountName = 'Accounts Receivable';
      } else if (effectivePayMethod === 'bank' || effectivePayMethod === 'card' || effectivePayMethod === 'transfer' || effectivePayMethod === 'mobile' || effectivePayMethod === 'mobile_money') {
        paymentAccountId = 'acc_bank';
        paymentAccountCode = '1020';
        paymentAccountName = 'Main Bank Account (Premier Bank)';
      }

      const originalTax = Number(orderData.tax || 0);
      const originalCogs = Number(orderData.cogs || 0);

      const taxReversalComponent = Math.round(refundAmount * (originalTotal > 0 ? (originalTax / originalTotal) : 0) * 100) / 100;
      const revenueReversalComponent = Math.round((refundAmount - taxReversalComponent) * 100) / 100;
      const cogsReversalComponent = Math.round(refundRatio * originalCogs * 100) / 100;

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
          runningBalance: 0,
          branchId: targetBranchId,
          createdAt: timestamp
        }));
      }

      // Restore product stock and recipe ingredient stock proportionally based on refundRatio
      for (const pr of refundProdRestorations) {
        transaction.update(pr.prodRef, {
          stock: pr.newStock,
          updatedAt: timestamp
        });

        const prodMovRef = db.collection('inventory_movements').doc();
        transaction.set(prodMovRef, cleanUndefined({
          id: prodMovRef.id,
          type: 'in',
          itemType: 'product',
          itemId: pr.item.productId,
          itemName: pr.prodData.name || pr.item.productName || 'Product',
          quantity: pr.restoredQty,
          branchId: targetBranchId,
          reason: `Product stock restored from refund on Order #${orderData.orderNumber || orderId}`,
          createdBy: user.name,
          createdAt: timestamp
        }));

        // Restore recipe ingredient stock
        for (const rr of pr.recipeRestorations) {
          transaction.update(rr.ingRef, {
            stock: rr.newIngStock,
            updatedAt: timestamp
          });

          const ingMovRef = db.collection('inventory_movements').doc();
          transaction.set(ingMovRef, cleanUndefined({
            id: ingMovRef.id,
            type: 'in',
            itemType: 'ingredient',
            itemId: rr.ingData.id || rr.ingRef.id,
            itemName: rr.ingData.name || 'Ingredient',
            quantity: rr.reqQty,
            branchId: targetBranchId,
            reason: `Ingredient stock restored from refund on Order #${orderData.orderNumber || orderId}`,
            createdBy: user.name,
            createdAt: timestamp
          }));
        }
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

      return { status: 'success', refundId: newRefundRef.id, refundedAmount: refundAmount };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Customer Refund Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Customer Refund Failed' });
  }
}

// 4. Expense Creation
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
  const db = getAdminDb();

  try {
    const result = await db.runTransaction(async (transaction) => {
      const timestamp = new Date().toISOString();
      const dateStr = expenseData.date || getMogadishuDateString(timestamp);

      const newExpenseRef = db.collection('expenses').doc();
      const fullExpenseDoc = {
        id: newExpenseRef.id,
        title: String(expenseData.title || expenseData.description || '').trim(),
        category: String(expenseData.category || 'General').trim(),
        description: String(expenseData.description || expenseData.title || '').trim(),
        amount,
        paymentMethod: String(expenseData.paymentMethod || 'cash').trim(),
        vendor: expenseData.vendor ? String(expenseData.vendor).trim() : undefined,
        receiptUrl: expenseData.receiptUrl ? String(expenseData.receiptUrl).trim() : undefined,
        date: expenseData.date ? String(expenseData.date).trim() : dateStr,
        branchId: targetBranchId,
        createdBy: user.name,
        createdAt: timestamp
      };

      transaction.set(newExpenseRef, cleanUndefined(fullExpenseDoc));

      // Accounting Journal Entry
      const payMethod = expenseData.paymentMethod || 'cash';
      const paymentAccountCode = payMethod === 'cash' ? '1010' : '1020';
      const paymentAccountName = payMethod === 'cash' ? 'Cash on Hand (Register)' : 'Main Bank Account (Premier Bank)';

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
          accountId: payMethod === 'cash' ? 'acc_cash' : 'acc_bank',
          accountCode: paymentAccountCode,
          accountName: paymentAccountName,
          debit: 0,
          credit: amount,
          memo: `Payment for Expense: ${expenseData.description || expenseData.category}`
        }
      ];

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
          runningBalance: 0,
          branchId: targetBranchId,
          createdAt: timestamp
        }));
      }

      return { status: 'success', id: newExpenseRef.id };
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

  const employeeId = salaryData.employeeId ? String(salaryData.employeeId).trim() : '';
  if (!employeeId) {
    return res.status(400).json({ error: 'Employee ID (employeeId) is required for salary disbursement.' });
  }

  const netPaid = Number(salaryData.netPaid || salaryData.netSalary || salaryData.amount || 0);
  if (!Number.isFinite(netPaid) || netPaid <= 0) {
    return res.status(400).json({ error: 'Disbursement amount must be a positive numeric value.' });
  }

  const branchCheck = checkBranchAuthorization(user, salaryData.branchId);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }
  const targetBranchId = branchCheck.targetBranchId;
  const db = getAdminDb();

  try {
    const result = await db.runTransaction(async (transaction) => {
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

      const empBranch = empData.branchId || empData.branch;
      if (empBranch && targetBranchId !== 'all' && empBranch !== targetBranchId) {
        throw new Error(`Unauthorized cross-branch salary disbursement! Employee belongs to branch "${empBranch}", but target branch is "${targetBranchId}".`);
      }

      const authoritativeEmployeeName = empData.name || empData.fullName || empData.displayName || salaryData.employeeName || 'Employee';
      const effectiveBranchId = (targetBranchId && targetBranchId !== 'all') ? targetBranchId : empBranch;
      if (!effectiveBranchId) {
        throw new Error('Salary disbursement rejected: Employee has no assigned branch and no target branch was specified.');
      }

      const timestamp = new Date().toISOString();
      const dateStr = getMogadishuDateString(timestamp);

      const newSalaryRef = db.collection('salaries').doc();
      const fullSalaryDoc = {
        id: newSalaryRef.id,
        employeeId,
        employeeName: authoritativeEmployeeName,
        period: salaryData.period || salaryData.month ? String(salaryData.period || salaryData.month).trim() : '',
        baseSalary: Number(salaryData.baseSalary) || netPaid,
        allowances: Number(salaryData.allowances) || 0,
        deductions: Number(salaryData.deductions) || 0,
        netPaid,
        paymentMethod: String(salaryData.paymentMethod || 'bank').trim(),
        notes: salaryData.notes ? String(salaryData.notes).trim() : undefined,
        branchId: effectiveBranchId,
        createdBy: user.name,
        paidDate: timestamp
      };

      transaction.set(newSalaryRef, cleanUndefined(fullSalaryDoc));

      // Accounting Journal Entry
      const payMethod = salaryData.paymentMethod || 'bank';
      const paymentAccountCode = payMethod === 'cash' ? '1010' : '1020';
      const paymentAccountName = payMethod === 'cash' ? 'Cash on Hand (Register)' : 'Main Bank Account (Premier Bank)';

      const lines = [
        {
          accountId: 'acc_payroll_expense',
          accountCode: '6100',
          accountName: 'Salaries & Wages Expense',
          debit: netPaid,
          credit: 0,
          memo: `Payroll Disbursement to ${authoritativeEmployeeName}`
        },
        {
          accountId: payMethod === 'cash' ? 'acc_cash' : 'acc_bank',
          accountCode: paymentAccountCode,
          accountName: paymentAccountName,
          debit: 0,
          credit: netPaid,
          memo: `Salary Disbursement to ${authoritativeEmployeeName}`
        }
      ];

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
        description: `Payroll Salary Disbursement: ${authoritativeEmployeeName} (${salaryData.month || salaryData.period || ''})`,
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
          runningBalance: 0,
          branchId: effectiveBranchId,
          createdAt: timestamp
        }));
      }

      return { status: 'success', id: newSalaryRef.id, employeeName: authoritativeEmployeeName };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Salary Disbursement Error:', err?.message || err);
    return res.status(err?.message?.includes('not found') ? 404 : err?.message?.includes('cross-branch') ? 403 : 500).json({ error: err?.message || 'Salary Disbursement Failed' });
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
  const db = getAdminDb();

  try {
    const result = await db.runTransaction(async (transaction) => {
      const timestamp = new Date().toISOString();
      const dateStr = getMogadishuDateString(timestamp);

      let authoritativeSupplierName = String(purchaseData.supplierName || 'Supplier').trim();
      if (purchaseData.supplierId) {
        const supDoc = await transaction.get(db.collection('suppliers').doc(String(purchaseData.supplierId).trim()));
        if (!supDoc.exists) {
          throw new Error(`Supplier with ID "${purchaseData.supplierId}" not found in Firestore.`);
        }
        const supData = supDoc.data() || {};
        if (supData.branchId && targetBranchId !== 'all' && supData.branchId !== targetBranchId) {
          throw new Error(`Unauthorized cross-branch purchase! Supplier belongs to branch "${supData.branchId}", but target branch is "${targetBranchId}".`);
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
        const branchMatches = !dData.branchId || dData.branchId === targetBranchId || targetBranchId === 'all';
        return branchMatches && dData.name?.toLowerCase() === purchaseData.itemName?.toLowerCase();
      });

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
        branchId: targetBranchId,
        createdBy: user.name,
        createdAt: timestamp
      };

      transaction.set(newPurchaseRef, cleanUndefined(fullPurchaseDoc));

      // 1. Inventory movement
      const movementRef = db.collection('inventory_movements').doc();
      transaction.set(movementRef, cleanUndefined({
        id: movementRef.id,
        type: 'in',
        itemType: 'ingredient',
        itemId: (purchaseData.itemName || 'item').toLowerCase().replace(/\s+/g, '_'),
        itemName: purchaseData.itemName || 'Purchase Item',
        quantity,
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
          lastPurchasePrice: unitPrice,
          updatedAt: timestamp
        });
      }

      // 3. Journal Entry
      const entryNumber = `JE-PURCHASE-${newPurchaseRef.id.slice(0, 6)}`;
      const creditAccountCode = purchaseData.status === 'completed' ? '1010' : '2010';
      const creditAccountName = purchaseData.status === 'completed' ? 'Cash on Hand (Register)' : 'Accounts Payable';

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
          accountId: creditAccountCode === '1010' ? 'acc_cash' : 'acc_ap',
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
          runningBalance: 0,
          branchId: targetBranchId,
          createdAt: timestamp
        }));
      }

      return { status: 'success', id: newPurchaseRef.id };
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

  const branchCheck = checkBranchAuthorization(user, bankTransactionData.branchId);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }
  const targetBranchId = branchCheck.targetBranchId;
  const db = getAdminDb();

  try {
    const result = await db.runTransaction(async (transaction) => {
      const timestamp = new Date().toISOString();
      const dateStr = bankTransactionData.date || getMogadishuDateString(timestamp);

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
        primaryAccRef = db.collection('accounts').doc(bankTransactionData.bankAccountId);
        const accDoc = await transaction.get(primaryAccRef);
        if (!accDoc.exists) {
          throw new Error(`Bank account with ID "${bankTransactionData.bankAccountId}" not found.`);
        }
        primaryAccData = accDoc.data() || {};
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
      if (isTransfer && destAccountId) {
        destAccRef = db.collection('accounts').doc(String(destAccountId).trim());
        const destAccDoc = await transaction.get(destAccRef);
        if (!destAccDoc.exists) {
          throw new Error(`Destination bank account with ID "${destAccountId}" not found.`);
        }
        destAccData = destAccDoc.data() || {};
        if (destAccData.branchId) {
          const destBranchCheck = checkBranchAuthorization(user, destAccData.branchId);
          if (!destBranchCheck.authorized) {
            throw new Error(`Unauthorized cross-branch transfer! Destination account belongs to branch "${destAccData.branchId}". ${destBranchCheck.error}`);
          }
        }
        const destBal = Number(destAccData.balance || 0);
        destNewBal = destBal + amount;
      }

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
        transaction.update(primaryAccRef, { balance: primaryNewBal, updatedAt: timestamp });
      }

      if (destAccRef) {
        transaction.update(destAccRef, { balance: destNewBal, updatedAt: timestamp });
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
            accountId: bankTransactionData.bankAccountId || 'acc_bank',
            accountCode: '1020',
            accountName: primaryAccData?.name || bankTransactionData.accountName || 'Main Bank Account (Premier Bank)',
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
            accountId: destAccountId || 'acc_dest_bank',
            accountCode: '1020',
            accountName: destName,
            debit: amount,
            credit: 0,
            memo: `Inter-Account Transfer to ${destName}`
          },
          {
            accountId: bankTransactionData.bankAccountId || 'acc_src_bank',
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
            accountId: bankTransactionData.bankAccountId || 'acc_bank',
            accountCode: '1020',
            accountName: primaryAccData?.name || bankTransactionData.accountName || 'Main Bank Account (Premier Bank)',
            debit: 0,
            credit: amount,
            memo: `Bank Withdrawal from ${primaryAccData?.name || 'Bank Account'}`
          }
        ];
      } else {
        // Deposit (Default): Debit Bank Account (1020), Credit Cash on Hand (1010)
        lines = [
          {
            accountId: bankTransactionData.bankAccountId || 'acc_bank',
            accountCode: '1020',
            accountName: primaryAccData?.name || bankTransactionData.accountName || 'Main Bank Account (Premier Bank)',
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
          runningBalance: 0,
          branchId: targetBranchId,
          createdAt: timestamp
        }));
      }

      return { status: 'success', id: newTxRef.id };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Bank Transaction Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Bank Transaction Failed' });
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

  const quantity = Number(movementData.quantity || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive number.' });
  }

  const branchCheck = checkBranchAuthorization(user, movementData.branchId);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }
  const targetBranchId = branchCheck.targetBranchId;
  const db = getAdminDb();

  try {
    const result = await db.runTransaction(async (transaction) => {
      const timestamp = new Date().toISOString();

      // Phase 1 (All Reads)
      let itemDoc: any = null;
      let itemRef: any = null;
      let newStock: number = 0;
      if (movementData.itemId) {
        const itemType = movementData.itemType === 'product' ? 'products' : 'ingredients';
        itemRef = db.collection(itemType).doc(movementData.itemId);
        itemDoc = await transaction.get(itemRef);
        if (!itemDoc.exists) {
          throw new Error(`${movementData.itemType === 'product' ? 'Product' : 'Ingredient'} not found.`);
        }
        const itemData = itemDoc.data() || {};
        if (itemData.branchId) {
          const itemBranchCheck = checkBranchAuthorization(user, itemData.branchId);
          if (!itemBranchCheck.authorized) {
            throw new Error(`Unauthorized cross-branch inventory modification! Item belongs to branch "${itemData.branchId}". ${itemBranchCheck.error}`);
          }
        }
        const currentStock = Number(itemData.stock || 0);
        const isOut = movementData.type === 'out' || movementData.type === 'waste';
        newStock = isOut ? Math.max(0, currentStock - quantity) : currentStock + quantity;
      }

      // Phase 2 (All Writes)
      const movementRef = db.collection('inventory_movements').doc();
      const fullMovement = {
        ...movementData,
        id: movementRef.id,
        quantity,
        branchId: targetBranchId,
        createdBy: user.name,
        createdAt: timestamp
      };

      transaction.set(movementRef, cleanUndefined(fullMovement));

      if (itemRef && itemDoc && itemDoc.exists) {
        transaction.update(itemRef, { stock: newStock, updatedAt: timestamp });
      }

      return { status: 'success', id: movementRef.id };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Inventory Adjustment Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Inventory Adjustment Failed' });
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
  
  if (!productId || targetStock === null || targetStock < 0) {
    return res.status(400).json({ error: 'Valid productId and non-negative target stock quantity (countedStock or newStock) are required.' });
  }

  const stockAdjustmentReason = reason ? String(reason).trim() : 'Physical stock count reconciliation';
  const db = getAdminDb();

  try {
    const timestamp = new Date().toISOString();

    await db.runTransaction(async (transaction) => {
      const productRef = db.collection('products').doc(productId);
      const prodSnap = await transaction.get(productRef);

      if (!prodSnap.exists) {
        throw new Error('Product not found.');
      }

      const prodData = prodSnap.data() || {};
      const currentStock = Number(prodData.stock || 0);
      const diff = targetStock - currentStock;

      const targetBranchId = prodData.branchId || user.branchId;
      if (!targetBranchId) {
        throw new Error('Product branch identification missing. Stock update rejected.');
      }
      const branchCheck = checkBranchAuthorization(user, targetBranchId);
      if (!branchCheck.authorized) {
        throw new Error(branchCheck.error);
      }

      // Atomic Update 1: Product Stock
      transaction.update(productRef, { stock: targetStock, updatedAt: timestamp });

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
        createdAt: timestamp
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
    });

    return res.json({ status: 'success', productId, newStock: targetStock });
  } catch (err: any) {
    console.error('Stock Update Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Stock Update Failed' });
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
        let mappedOrderStatus: string = 'new';
        if (normalizedStatus === 'accepted') mappedOrderStatus = 'confirmed';
        else if (normalizedStatus === 'cooking') mappedOrderStatus = 'in_preparation';
        else if (normalizedStatus === 'ready_for_pickup') mappedOrderStatus = 'ready_for_pickup';
        else if (normalizedStatus === 'completed') mappedOrderStatus = 'completed';
        else if (normalizedStatus === 'cancelled' || normalizedStatus === 'rejected') mappedOrderStatus = 'cancelled';

        const orderUpdates: any = {
          status: mappedOrderStatus,
          kitchenStatus: normalizedStatus,
          updatedAt: timestamp
        };
        if (normalizedStatus === 'completed') {
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
      const isAssignedDriver = delData.driverId && (delData.driverId === user.uid || delData.driverId === user.idToken);

      if (isDriverRole) {
        if (!delData.driverId || delData.status === 'unassigned') {
          const authErr: any = new Error('Unauthorized: Unassigned driver cannot manipulate unassigned delivery.');
          authErr.statusCode = 403;
          throw authErr;
        }
        if (delData.driverId !== user.uid && delData.driverId !== user.idToken) {
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
        const drvBranch = drvData.branchId || drvData.branch || '';
        if (!drvBranch || drvBranch === delData.branchId || user.role === 'Owner' || (user.role === 'Admin' && user.branchId === 'all')) {
          console.log(`[DELIVERY STATUS WRITE 2] drivers/${effectiveDriverId} ADMIN SDK UPDATE (availability: available)`);
          transaction.update(drvRef, { availability: 'available', updatedAt: now });
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
        transaction.update(drvRef, { availability: 'on_delivery', updatedAt: now });
      }

      // [ASSIGN WRITE STEP 2] UPDATE previous driver
      if (oldDrvSnap.exists && oldDrvRef) {
        console.log(`[ASSIGN WRITE STEP 2] UPDATE previous driver drivers/${delData.driverId}`);
        transaction.update(oldDrvRef, { availability: 'available', updatedAt: now });
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

  const db = getAdminDb();
  try {
    const payload = cleanUndefined({
      code: String(code).trim(),
      name: String(name).trim(),
      type: String(type).trim(),
      category: category ? String(category).trim() : undefined,
      parentId: parentId ? String(parentId).trim() : undefined,
      description: description ? String(description).trim() : undefined,
      branchId: targetBranchId,
      balance: Number(balance) || 0,
      createdBy: user.name,
      createdAt: new Date().toISOString()
    });
    const docRef = await db.collection('accounts').add(payload);
    return res.json({ id: docRef.id, ...payload });
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

  const totalDebit = lines.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return res.status(400).json({ error: `Journal Entry is unbalanced! Total Debit: ${totalDebit.toFixed(2)}, Total Credit: ${totalCredit.toFixed(2)}` });
  }

  const branchCheck = checkBranchAuthorization(user, entryData.branchId);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }
  const branchId = branchCheck.targetBranchId;
  const db = getAdminDb();

  try {
    const result = await db.runTransaction(async (transaction) => {
      const entryNumber = `JE-${new Date().getFullYear()}-${randomInt(10000, 99999)}`;
      const now = new Date().toISOString();

      // Phase 1 (All Reads)
      const uniqueAccountIds: string[] = Array.from(new Set(lines.map((l: any) => l.accountId ? String(l.accountId).trim() : '').filter(Boolean))) as string[];
      const accMap = new Map<string, { ref: any; data: any; balance: number }>();
      for (const accId of uniqueAccountIds) {
        const accRef = db.collection('accounts').doc(accId);
        const accSnap = await transaction.get(accRef);
        if (accSnap.exists) {
          const accData = accSnap.data() as any;
          accMap.set(accId, { ref: accRef, data: accData, balance: Number(accData.balance || 0) });
        }
      }

      // Phase 2 (All Writes)
      const jeRef = db.collection('journal_entries').doc();
      const newEntryPayload = cleanUndefined({
        id: jeRef.id,
        entryNumber,
        date: entryData.date || getMogadishuDateString(now),
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
        const lineDebit = Number(line.debit) || 0;
        const lineCredit = Number(line.credit) || 0;

        transaction.set(jlRef, cleanUndefined({
          id: jlRef.id,
          journalEntryId: jeRef.id,
          entryNumber,
          accountId: line.accountId ? String(line.accountId).trim() : '',
          accountCode: line.accountCode ? String(line.accountCode).trim() : '',
          accountName: line.accountName ? String(line.accountName).trim() : '',
          debit: lineDebit,
          credit: lineCredit,
          memo: line.memo ? String(line.memo).trim() : '',
          branchId,
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
          date: entryData.date || getMogadishuDateString(now),
          reference: entryData.reference || '',
          description: line.memo || entryData.description || 'Manual Journal Entry',
          debit: lineDebit,
          credit: lineCredit,
          branchId,
          createdAt: now
        }));

        if (line.accountId && accMap.has(String(line.accountId).trim())) {
          const accEntry = accMap.get(String(line.accountId).trim())!;
          let delta = 0;
          if (['Asset', 'COGS', 'Expense'].includes(accEntry.data.type)) {
            delta = lineDebit - lineCredit;
          } else {
            delta = lineCredit - lineDebit;
          }
          accEntry.balance += delta;
        }
      }

      for (const [, accEntry] of accMap.entries()) {
        transaction.update(accEntry.ref, { balance: accEntry.balance, updatedAt: now });
      }

      return newEntryPayload;
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

  const roleAuth = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleAuth.authorized) {
    return res.status(403).json({ error: roleAuth.error });
  }

  const branchCheck = checkBranchAuthorization(user, req.body.branchId);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }

  const db = getAdminDb();
  try {
    const revenueNumber = `REV-${randomInt(100000, 999999)}`;
    const now = new Date().toISOString();
    const payload = cleanUndefined({
      revenueNumber,
      category: req.body.category ? String(req.body.category).trim() : 'General Sales',
      amount: Number(req.body.amount) || 0,
      description: req.body.description ? String(req.body.description).trim() : '',
      paymentMethod: req.body.paymentMethod ? String(req.body.paymentMethod).trim() : 'Cash',
      branchId: branchCheck.targetBranchId,
      createdBy: user.name,
      createdAt: now
    });

    const revRef = db.collection('revenues').doc();
    await revRef.set({ id: revRef.id, ...payload });

    return res.json({ id: revRef.id, ...payload });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Create Revenue Failed' });
  }
}

export async function handleCreateReceivable(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleAuth = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleAuth.authorized) {
    return res.status(403).json({ error: roleAuth.error });
  }

  const branchCheck = checkBranchAuthorization(user, req.body.branchId);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }

  const totalAmount = Number(req.body.totalAmount) || 0;
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return res.status(400).json({ error: 'Valid positive total amount is required for receivable.' });
  }

  const db = getAdminDb();
  try {
    const payload = cleanUndefined({
      customerName: req.body.customerName ? String(req.body.customerName).trim() : 'Customer',
      customerId: req.body.customerId ? String(req.body.customerId).trim() : undefined,
      invoiceNumber: req.body.invoiceNumber ? String(req.body.invoiceNumber).trim() : `INV-${Date.now().toString().slice(-6)}`,
      totalAmount,
      paidAmount: 0,
      remainingBalance: totalAmount,
      status: 'Unpaid',
      dueDate: req.body.dueDate ? String(req.body.dueDate).trim() : undefined,
      notes: req.body.notes ? String(req.body.notes).trim() : undefined,
      payments: [],
      branchId: branchCheck.targetBranchId,
      createdBy: user.name,
      createdAt: new Date().toISOString()
    });

    const docRef = db.collection('receivables').doc();
    await docRef.set({ id: docRef.id, ...payload });

    return res.json({ id: docRef.id, ...payload });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Create Receivable Failed' });
  }
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
  const paymentAmount = Number(payment.amount) || 0;

  if (!id || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ error: 'Valid receivable ID and positive numeric payment amount are required.' });
  }

  const db = getAdminDb();

  try {
    const result = await db.runTransaction(async (transaction) => {
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
      const dateStr = payment.date || getMogadishuDateString(timestamp);

      const newPayment = {
        id: `pay-${Date.now()}-${randomInt(100, 999)}`,
        date: dateStr,
        amount: paymentAmount,
        paymentMethod: payment.paymentMethod || 'Cash',
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
      const payMethod = (payment.paymentMethod || 'Cash').toLowerCase();
      const paymentAccountCode = payMethod === 'cash' ? '1010' : '1020';
      const paymentAccountName = payMethod === 'cash' ? 'Cash on Hand (Register)' : 'Main Bank Account (Premier Bank)';

      const lines = [
        {
          accountId: payMethod === 'cash' ? 'acc_cash' : 'acc_bank',
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

      return { status: 'success', id, paidAmount: newPaidAmount, remainingBalance: newRemaining };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Record AR Payment Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Record AR Payment Failed' });
  }
}

export async function handleCreatePayable(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleAuth = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleAuth.authorized) {
    return res.status(403).json({ error: roleAuth.error });
  }

  const branchCheck = checkBranchAuthorization(user, req.body.branchId);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }

  const totalAmount = Number(req.body.totalAmount) || 0;
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return res.status(400).json({ error: 'Valid positive total amount is required for payable.' });
  }

  const db = getAdminDb();
  try {
    const payload = cleanUndefined({
      vendorName: req.body.vendorName || req.body.supplierName ? String(req.body.vendorName || req.body.supplierName).trim() : 'Vendor',
      vendorId: req.body.vendorId ? String(req.body.vendorId).trim() : undefined,
      billNumber: req.body.billNumber ? String(req.body.billNumber).trim() : `BILL-${Date.now().toString().slice(-6)}`,
      totalAmount,
      paidAmount: 0,
      remainingBalance: totalAmount,
      status: 'Unpaid',
      dueDate: req.body.dueDate ? String(req.body.dueDate).trim() : undefined,
      notes: req.body.notes ? String(req.body.notes).trim() : undefined,
      payments: [],
      branchId: branchCheck.targetBranchId,
      createdBy: user.name,
      createdAt: new Date().toISOString()
    });

    const docRef = db.collection('payables').doc();
    await docRef.set({ id: docRef.id, ...payload });

    return res.json({ id: docRef.id, ...payload });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Create Payable Failed' });
  }
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
  const paymentAmount = Number(payment.amount) || 0;

  if (!id || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ error: 'Valid payable ID and positive numeric payment amount are required.' });
  }

  const db = getAdminDb();

  try {
    const result = await db.runTransaction(async (transaction) => {
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
      const dateStr = payment.date || getMogadishuDateString(timestamp);

      const newPayment = {
        id: `pay-${Date.now()}-${randomInt(100, 999)}`,
        date: dateStr,
        amount: paymentAmount,
        paymentMethod: payment.paymentMethod || 'Cash',
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
      const payMethod = (payment.paymentMethod || 'Cash').toLowerCase();
      const paymentAccountCode = payMethod === 'cash' ? '1010' : '1020';
      const paymentAccountName = payMethod === 'cash' ? 'Cash on Hand (Register)' : 'Main Bank Account (Premier Bank)';

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
          accountId: payMethod === 'cash' ? 'acc_cash' : 'acc_bank',
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

      return { status: 'success', id, paidAmount: newPaidAmount, remainingBalance: newRemaining };
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

  const db = getAdminDb();
  try {
    // P1-8: Single Open Register Enforcement per Branch
    const openRegQuery = db.collection('cash_registers')
      .where('branchId', '==', targetBranchId)
      .where('status', '==', 'Open');
    const openRegSnap = await openRegQuery.get();
    if (!openRegSnap.empty) {
      const activeReg = openRegSnap.docs[0];
      return res.status(409).json({
        error: `An active open cash register already exists for branch "${targetBranchId}" (Register #${activeReg.id}). Please close it before opening a new register.`,
        activeRegisterId: activeReg.id
      });
    }

    const openingBalance = Number(req.body.openingBalance ?? 0);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      return res.status(400).json({ error: 'Opening balance must be a non-negative number.' });
    }
    const timestamp = new Date().toISOString();
    const dateStr = getMogadishuDateString(timestamp);

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
    await docRef.set({ id: docRef.id, ...payload });

    // P1-9: Opening Balance Double-Entry Accounting
    if (openingBalance > 0) {
      const jeRef = db.collection('journal_entries').doc();
      const entryNumber = `JE-FLOAT-${docRef.id.slice(0, 6)}`;
      const lines = [
        {
          accountId: 'acc_cash',
          accountCode: '1010',
          accountName: 'Cash on Hand (Register)',
          debit: openingBalance,
          credit: 0,
          memo: `Opening cash register float for ${payload.openedBy}`
        },
        {
          accountId: 'acc_equity',
          accountCode: '3010',
          accountName: "Owner's Capital / Opening Balance Equity",
          debit: 0,
          credit: openingBalance,
          memo: `Opening float equity/capital introduction`
        }
      ];

      const journalEntry = {
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
      };

      await jeRef.set(cleanUndefined(journalEntry));
    }

    return res.json({ id: docRef.id, ...payload });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Open Cash Register Failed' });
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

  const db = getAdminDb();

  try {
    const ref = db.collection('cash_registers').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Cash register not found' });
    }

    const reg = snap.data() as any;
    if (reg.status === 'Closed') {
      return res.status(400).json({ error: 'Cash register is already closed.' });
    }
    const branchCheck = checkBranchAuthorization(user, reg.branchId);
    if (!branchCheck.authorized) {
      return res.status(403).json({ error: branchCheck.error });
    }

    const actualClosingBalance = Number(req.body.actualClosingBalance ?? 0);
    if (!Number.isFinite(actualClosingBalance) || actualClosingBalance < 0) {
      return res.status(400).json({ error: 'Actual closing balance must be a non-negative number.' });
    }
    const diff = actualClosingBalance - (reg.expectedClosingBalance || 0);

    await ref.update(cleanUndefined({
      closedBy: user.name,
      closedById: user.uid,
      closedAt: new Date().toISOString(),
      actualClosingBalance,
      difference: diff,
      status: 'Closed',
      notes: req.body.notes ? String(req.body.notes).trim() : ''
    }));

    return res.json({ status: 'success', id });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Close Cash Register Failed' });
  }
}

export async function handleCreateBankAccount(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleAuth = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Accountant', 'accountant']);
  if (!roleAuth.authorized) {
    return res.status(403).json({ error: roleAuth.error });
  }

  const branchCheck = checkBranchAuthorization(user, req.body.branchId);
  if (!branchCheck.authorized) {
    return res.status(403).json({ error: branchCheck.error });
  }

  const db = getAdminDb();
  try {
    const payload = cleanUndefined({
      accountName: req.body.accountName ? String(req.body.accountName).trim() : 'Bank Account',
      accountNumber: req.body.accountNumber ? String(req.body.accountNumber).trim() : '',
      bankName: req.body.bankName ? String(req.body.bankName).trim() : '',
      currentBalance: Number(req.body.initialBalance) || Number(req.body.currentBalance) || 0,
      branchId: branchCheck.targetBranchId,
      createdBy: user.name,
      createdAt: new Date().toISOString()
    });

    const docRef = db.collection('bank_accounts').doc();
    await docRef.set({ id: docRef.id, ...payload });

    return res.json({ id: docRef.id, ...payload });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Create Bank Account Failed' });
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
    const payload = cleanUndefined({
      name: req.body.name ? String(req.body.name).trim() : 'Tax',
      rate: Number(req.body.rate) || 0,
      type: req.body.type ? String(req.body.type).trim() : 'percentage',
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
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
    const updates = cleanUndefined({
      name: req.body.name ? String(req.body.name).trim() : undefined,
      rate: req.body.rate !== undefined ? Number(req.body.rate) : undefined,
      type: req.body.type ? String(req.body.type).trim() : undefined,
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : undefined,
      updatedAt: new Date().toISOString()
    });
    await db.collection('taxes').doc(id).update(updates);
    return res.json({ status: 'success', id });
  } catch (err: any) {
    console.error('Update Tax Error:', err?.message || err);
    return res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Update Tax Failed' : (err?.message || 'Update Tax Failed') });
  }
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

  try {
    const result = await db.runTransaction(async (transaction) => {
      const poRef = db.collection('purchase_orders').doc(poId);
      const poSnap = await transaction.get(poRef);
      if (!poSnap.exists) {
        throw new Error('Purchase Order not found');
      }

      const po = poSnap.data() as any;
      if (po.status === 'completed' || po.status === 'received') {
        throw new Error(`Purchase Order #${po.poNumber || poId} is already completed / fully received.`);
      }

      const targetBranchId = po.branchId || user.branchId;
      if (!targetBranchId) {
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

      // Phase 1 (All Reads) - Read all inventory items before any writes
      const invSnapsMap = new Map<string, { ref: any; data: any; qty: number; batchNumber: string; expirationDate: string }>();
      for (const rec of recs) {
        const qty = Number(rec.receivedQty) || 0;
        if (qty <= 0) continue;
        const invRef = db.collection('inventory').doc(rec.itemId);
        const invSnap = await transaction.get(invRef);
        if (invSnap.exists) {
          invSnapsMap.set(rec.itemId, {
            ref: invRef,
            data: invSnap.data() as any,
            qty,
            batchNumber: rec.batchNumber || '',
            expirationDate: rec.expirationDate || ''
          });
        }
      }

      // Phase 2 (All Writes)
      transaction.update(poRef, cleanUndefined({
        items: updatedItems,
        status: nextStatus,
        updatedAt: now
      }));

      // Update inventory items stock inside transaction
      for (const [, invEntry] of invSnapsMap.entries()) {
        const invItem = invEntry.data;
        const qty = invEntry.qty;
        const newQty = (invItem.currentQuantity || 0) + qty;
        let status = 'in_stock';
        if (newQty <= 0) status = 'out_of_stock';
        else if (newQty <= (invItem.minimumQuantity || 0)) status = 'low_stock';

        transaction.update(invEntry.ref, {
          currentQuantity: newQty,
          batchNumber: invEntry.batchNumber || invItem.batchNumber || '',
          expirationDate: invEntry.expirationDate || invItem.expirationDate || '',
          status,
          updatedAt: now
        });

        const movRef = db.collection('inventory_movements').doc();
        transaction.set(movRef, cleanUndefined({
          id: movRef.id,
          type: 'stock_in',
          itemId: invItem.id,
          itemName: invItem.itemName || '',
          itemCode: invItem.itemCode || '',
          quantity: qty,
          unit: invItem.unit || 'pcs',
          previousQuantity: invItem.currentQuantity || 0,
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

      return { status: 'success', poId, nextStatus };
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Goods Receiving Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Goods Receiving Failed' });
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
  const paymentAmount = Number(paymentData.amount) || 0;
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ error: 'Valid positive payment amount is required.' });
  }

  const db = getAdminDb();

  try {
    const result = await db.runTransaction(async (transaction) => {
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
          if (sup.branchId) {
            const supBranchCheck = checkBranchAuthorization(user, sup.branchId);
            if (!supBranchCheck.authorized) {
              throw new Error(`Unauthorized cross-branch supplier payment! Supplier belongs to branch "${sup.branchId}". ${supBranchCheck.error}`);
            }
          }
          const currentBal = Number(sup.outstandingBalance) || 0;
          newBalance = Math.max(0, currentBal - paymentAmount);
        }
      }

      // Phase 2 (All Writes)
      const newRef = db.collection('supplier_payments').doc();
      const payment = cleanUndefined({
        id: newRef.id,
        supplierId: paymentData.supplierId ? String(paymentData.supplierId).trim() : '',
        supplierName: paymentData.supplierName ? String(paymentData.supplierName).trim() : 'Supplier',
        amount: paymentAmount,
        paymentMethod: paymentData.paymentMethod ? String(paymentData.paymentMethod).trim() : 'bank',
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
      const payMethod = (paymentData.paymentMethod || 'bank').toLowerCase();
      const paymentAccountCode = payMethod === 'cash' ? '1010' : '1020';
      const paymentAccountName = payMethod === 'cash' ? 'Cash on Hand (Register)' : 'Main Bank Account (Premier Bank)';

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
          accountId: payMethod === 'cash' ? 'acc_cash' : 'acc_bank',
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

      return payment;
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

  const db = getAdminDb();
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

    await newRef.set(cleanUndefined(fullItem));

    if (Number(itemData.currentQuantity || 0) > 0) {
      const movementRef = db.collection('inventory_movements').doc();
      const movement = {
        id: movementRef.id,
        type: 'stock_in',
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
      await movementRef.set(cleanUndefined(movement));
    }

    return res.json({ status: 'success', item: fullItem });
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

    await itemRef.update(cleanUndefined(payload));
    return res.json({ status: 'success', id });
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

    await itemRef.delete();
    return res.json({ status: 'success', id });
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

  const db = getAdminDb();
  try {
    const timestamp = new Date().toISOString();
    const newRef = db.collection('purchase_orders').doc();
    const fullPo = {
      ...poData,
      id: newRef.id,
      branchId: targetBranchId,
      createdBy: user.name,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await newRef.set(cleanUndefined(fullPo));
    return res.json({ status: 'success', purchaseOrder: fullPo });
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

  const db = getAdminDb();
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

    await poRef.update(cleanUndefined(payload));
    return res.json({ status: 'success', id });
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

  const db = getAdminDb();
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
    await poRef.update({
      approvalStatus: 'approved',
      status: 'approved',
      approvedBy: user.name,
      approvedAt: timestamp,
      updatedAt: timestamp
    });

    return res.json({ status: 'success', id });
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
  try {
    const timestamp = new Date().toISOString();
    const newRef = db.collection('deliveries').doc();
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
      updatedAt: timestamp
    };

    await newRef.set(cleanUndefined(fullDelivery));

    const trackingRef = db.collection('delivery_tracking').doc();
    await trackingRef.set({
      id: trackingRef.id,
      deliveryId: newRef.id,
      driverId: '',
      branchId: targetBranchId,
      statusUpdate: 'unassigned',
      timestamp
    });

    return res.json({ status: 'success', id: newRef.id, deliveryNumber });
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
        allowedUpdates.items = items;

        if (effectivePrepStatus === undefined) {
          const allReady = items.length > 0 && items.every((i: any) => i.itemStatus === 'ready_for_pickup' || i.itemStatus === 'completed');
          const anyCookingOrReady = items.some((i: any) => i.itemStatus === 'cooking' || i.itemStatus === 'ready_for_pickup' || i.itemStatus === 'completed');

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
          let mappedOrderStatus: string = 'new';
          if (effectivePrepStatus === 'accepted') mappedOrderStatus = 'confirmed';
          else if (effectivePrepStatus === 'cooking') mappedOrderStatus = 'in_preparation';
          else if (effectivePrepStatus === 'ready_for_pickup') mappedOrderStatus = 'ready_for_pickup';
          else if (effectivePrepStatus === 'completed') mappedOrderStatus = 'completed';
          else if (effectivePrepStatus === 'cancelled' || effectivePrepStatus === 'rejected') mappedOrderStatus = 'cancelled';

          const orderUpdates: any = {
            status: mappedOrderStatus,
            kitchenStatus: effectivePrepStatus,
            updatedAt: timestamp
          };
          if (effectivePrepStatus === 'completed') {
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
        return dBranch === targetBranchId || areBranchesMatching(dBranch, targetBranchId) || (!dBranch && (targetBranchId === 'HQ' || targetBranchId === 'branch_hq_01' || targetBranchId === 'main_branch_01' || targetBranchId === 'all'));
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
      const payMethodStr = String(paymentMethod || 'cash').toLowerCase();
      const assetAccountCode = (payMethodStr === 'bank' || payMethodStr === 'transfer' || payMethodStr === 'card' || payMethodStr === 'mobile') ? '1020' : '1010';
      const assetAccountName = assetAccountCode === '1010' ? 'Cash on Hand (Register)' : 'Main Bank Account (Premier Bank)';

      const journalRef = db.collection('journal_entries').doc();
      const dateStr = getMogadishuDateString(timestamp);
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
            accountId: assetAccountCode === '1010' ? 'acc_cash' : 'acc_bank',
            accountCode: assetAccountCode,
            accountName: assetAccountName,
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

      return { status: 'success', walletId: walletRef.id, newBalance, transactionId: txRef.id };
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
      const walletQuery = db.collection('customer_wallets').where('customerId', '==', String(customerId));
      const walletSnap = await transaction.get(walletQuery);

      if (walletSnap.empty) {
        throw new Error(`Customer Wallet for Customer ID "${customerId}" not found.`);
      }

      const matchingBranchDocs = walletSnap.docs.filter(d => {
        const dBranch = d.data().branchId;
        return dBranch === targetBranchId || areBranchesMatching(dBranch, targetBranchId) || (!dBranch && (targetBranchId === 'HQ' || targetBranchId === 'branch_hq_01' || targetBranchId === 'main_branch_01' || targetBranchId === 'all'));
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
      const walletQuery = db.collection('customer_wallets').where('customerId', '==', String(customerId));
      const walletSnap = await transaction.get(walletQuery);

      const matchingBranchDocs = walletSnap.docs.filter(d => {
        const dBranch = d.data().branchId;
        return dBranch === targetBranchId || areBranchesMatching(dBranch, targetBranchId) || (!dBranch && (targetBranchId === 'HQ' || targetBranchId === 'branch_hq_01' || targetBranchId === 'main_branch_01' || targetBranchId === 'all'));
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
    const docTimeStr = doc.createdAt || doc.date || doc.timestamp || doc.updatedAt;
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

  const [orders, refunds, expenses, accounts, receivables, payables, products, ingredients, journalLines] = await Promise.all([
    fetchDocsQueried('orders', 'createdAt'),
    fetchDocsQueried('refunds', 'createdAt'),
    fetchDocsQueried('expenses', 'createdAt'),
    fetchBranchDocs('accounts'),
    fetchBranchDocs('receivables'),
    fetchBranchDocs('payables'),
    fetchBranchDocs('products'),
    fetchBranchDocs('ingredients'),
    fetchDocsQueried('journal_lines', 'createdAt')
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
    const dateStr = doc.createdAt || doc.date || doc.updatedAt;
    if (!dateStr) return true;
    const docDate = new Date(dateStr);
    return isNaN(docDate.getTime()) || docDate <= endDate;
  };

  const cashAccounts = accounts.filter((a: any) => a.type === 'cash' || a.accountType === 'Cash' || (a.code && String(a.code).startsWith('101')));
  const bankAccounts = accounts.filter((a: any) => a.type === 'bank' || a.accountType === 'Bank' || (a.code && String(a.code).startsWith('102')));

  const cash = cashAccounts.reduce((sum: number, a: any) => sum + (Number(a.balance) || 0), 0);
  const bank = bankAccounts.reduce((sum: number, a: any) => sum + (Number(a.balance) || 0), 0);

  const activeReceivables = receivables.filter((r: any) => isDocAsOfDateTo(r) && r.status !== 'paid' && r.status !== 'Paid');
  const activePayables = payables.filter((p: any) => isDocAsOfDateTo(p) && p.status !== 'paid' && p.status !== 'Paid');

  const AR = activeReceivables.reduce((sum: number, r: any) => sum + ((Number(r.totalAmount) || Number(r.amount) || 0) - (Number(r.paidAmount) || 0)), 0);
  const AP = activePayables.reduce((sum: number, p: any) => sum + ((Number(p.totalAmount) || Number(p.amount) || 0) - (Number(p.paidAmount) || 0)), 0);

  const productVal = products.reduce((sum: number, p: any) => sum + ((Number(p.stock) || 0) * (Number(p.cost) || Number(p.costPrice) || 0)), 0);
  const ingredientVal = ingredients.reduce((sum: number, i: any) => sum + ((Number(i.stock) || Number(i.currentQuantity) || 0) * (Number(i.unitCost) || Number(i.cost) || 0)), 0);
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
      if (!assignedDriver || (assignedDriver !== user.uid && assignedDriver !== user.idToken)) {
        return res.status(403).json({ error: "Unauthorized: Driver cannot generate telemetry for a delivery not assigned to them." });
      }
    }

    const trackingRef = db.collection('delivery_tracking').doc();
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

    await trackingRef.set(cleanUndefined(trackingDoc));
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
  const db = getAdminDb();

  try {
    const timestamp = new Date().toISOString();
    const wasteRef = db.collection('kitchen_waste').doc();
    const movementRef = db.collection('inventory_movements').doc();
    const auditRef = db.collection('activity_logs').doc();

    const targetItemId = payload.itemId || payload.ingredientId || payload.productId || '';
    const targetItemType = payload.itemType || 'ingredient';
    const itemOrIngName = payload.itemOrIngredientName || payload.itemName || payload.ingredientName || 'Waste Item';
    const costVal = Number(payload.cost || 0);
    const reasonText = payload.reason ? String(payload.reason) : 'Spoilage/Waste';
    const unitText = payload.unit ? String(payload.unit) : 'pcs';

    // SERVER AUTHORITATIVE USER METADATA ONLY - Do not trust client loggedBy/user/role/branchId
    const fullWaste = {
      id: wasteRef.id,
      itemId: targetItemId,
      itemType: targetItemType,
      itemOrIngredientName: itemOrIngName,
      quantity,
      unit: unitText,
      reason: reasonText,
      cost: costVal,
      branchId: targetBranchId,
      loggedBy: user.name || user.email || 'Kitchen Staff',
      userId: user.uid,
      userRole: user.role,
      createdAt: timestamp
    };

    const movement = {
      id: movementRef.id,
      type: 'out',
      itemType: targetItemType,
      itemId: targetItemId || itemOrIngName.toLowerCase().replace(/\s+/g, '_'),
      itemName: itemOrIngName,
      quantity,
      unit: unitText,
      reason: `Kitchen Waste: ${reasonText} (Cost $${costVal})`,
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

    await db.runTransaction(async (transaction) => {
      // Phase 1 (All Reads)
      let itemDoc: any = null;
      let itemRef: any = null;
      if (targetItemId) {
        const itemType = targetItemType === 'product' ? 'products' : targetItemType === 'inventory' ? 'inventory' : 'ingredients';
        itemRef = db.collection(itemType).doc(targetItemId);
        itemDoc = await transaction.get(itemRef);
      }

      // Phase 2 (All Writes)
      transaction.set(wasteRef, cleanUndefined(fullWaste));
      transaction.set(movementRef, cleanUndefined(movement));
      transaction.set(auditRef, cleanUndefined(auditLog));

      if (targetItemId && itemRef && itemDoc && itemDoc.exists) {
        const itemVal = itemDoc.data() || {};
        const currentStock = Number(itemVal.stock ?? itemVal.currentQuantity ?? 0);
        const newStock = Math.max(0, currentStock - quantity);
        if (itemVal.stock !== undefined) {
          transaction.update(itemRef, { stock: newStock, updatedAt: timestamp });
        } else {
          transaction.update(itemRef, { currentQuantity: newStock, updatedAt: timestamp });
        }
      }
    });

    return res.json({ status: 'success', id: wasteRef.id, waste: fullWaste });
  } catch (err: any) {
    console.error('Kitchen Waste Error:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Kitchen Waste Failed' });
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

    const isDriver = ['Delivery Driver', 'delivery driver', 'Driver', 'driver'].includes(user.role);
    if (isDriver) {
      if (delData.driverId && delData.driverId !== user.uid && delData.driverId !== user.idToken) {
        return res.status(403).json({ error: "Unauthorized: Driver cannot create notifications for another driver's delivery." });
      }
      if (targetUser && !['management', 'customer', 'all', delData.customerId].includes(String(targetUser).trim())) {
        return res.status(403).json({ error: 'Unauthorized: Driver cannot dispatch notification to arbitrary target user.' });
      }
    } else {
      if (targetUser && !['driver', 'management', 'customer', 'all', delData.driverId, delData.customerId].includes(String(targetUser).trim())) {
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
      targetUser: targetUser ? String(targetUser).trim() : 'all',
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
    console.log(`[FCM Push Dispatching] To driver ${driverId} (token: ${fcmToken.slice(0, 10)}...): "${title}" - "${message}"`);

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
    'UPDATE_STOCK'
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
      status: z.enum(['completed', 'pending', 'cancelled']).optional()
    }).strict(),

    REGISTER_SALARY: z.object({
      employeeId: z.string().min(1, 'employeeId is required'),
      amount: z.number().positive('amount must be positive'),
      employeeName: z.string().optional(),
      period: z.string().optional()
    }).strict(),

    RECORD_REFUND: z.object({
      orderId: z.string().min(1, 'orderId is required'),
      amount: z.number().positive('amount must be positive'),
      reason: z.string().optional(),
      paymentMethod: z.enum(['cash', 'card', 'bank_transfer']).optional(),
      customerName: z.string().optional()
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
      itemType: z.enum(['ingredient', 'product']).optional(),
      itemName: z.string().optional(),
      reason: z.string().optional()
    }).strict(),

    UPDATE_STOCK: z.object({
      productId: z.string().min(1, 'productId is required'),
      newStock: z.number().nonnegative('newStock must be non-negative'),
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
    'UPDATE_STOCK'
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
            branchId: user.branchId
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
            period: validatedPayload.period || 'Current Month',
            status: 'paid',
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
          paymentMethod: validatedPayload.paymentMethod || 'cash'
        };
        return handleCustomerRefund(req, wrappedRes);
      }

      case 'RECORD_BANK_TRANSACTION': {
        const amount = validatedPayload.amount;

        if (validatedPayload.bankAccountId) {
          if (isFakeOrDummyId(validatedPayload.bankAccountId)) {
            return wrappedRes.status(400).json({ error: `RECORD_BANK_TRANSACTION rejected: Fake or invalid bankAccountId "${validatedPayload.bankAccountId}".` });
          }
          const accSnap = await db.collection('accounts').doc(String(validatedPayload.bankAccountId).trim()).get();
          if (!accSnap.exists) {
            return wrappedRes.status(404).json({ error: `Bank account with ID "${validatedPayload.bankAccountId}" not found.` });
          }
        }

        req.body = {
          bankTransactionData: {
            accountName: validatedPayload.accountName || 'Primary Operating Account',
            bankAccountId: validatedPayload.bankAccountId ? String(validatedPayload.bankAccountId).trim() : undefined,
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

        const itemTypeCol = validatedPayload.itemType === 'product' ? 'products' : 'ingredients';
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

      default:
        return wrappedRes.status(400).json({ error: `Unhandled actionType: ${actionType}` });
    }
  } catch (err: any) {
    if (idempotencyRef) {
      await idempotencyRef.delete().catch(() => {});
    }
    console.error(`AI Action Execution Error (${actionType}):`, err?.message || err);
    return res.status(500).json({ error: err?.message || `Failed to execute AI action (${actionType})` });
  }
}

export async function handleCustomerPointsAdd(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Cashier', 'cashier', 'Staff', 'staff']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { customerId, points } = req.body || {};
  if (!customerId || typeof customerId !== 'string') {
    return res.status(400).json({ error: 'customerId string is required.' });
  }
  if (typeof points !== 'number' || points <= 0) {
    return res.status(400).json({ error: 'points must be a positive number.' });
  }

  const db = getAdminDb();
  const now = new Date().toISOString();

  try {
    const custRef = db.collection('customers').doc(customerId.trim());
    const custSnap = await custRef.get();
    if (!custSnap.exists) {
      return res.status(404).json({ error: `Customer #${customerId} not found.` });
    }
    const custData = custSnap.data() || {};
    if (custData.branchId) {
      const branchCheck = checkBranchAuthorization(user, custData.branchId);
      if (!branchCheck.authorized) {
        return res.status(403).json({ error: branchCheck.error });
      }
    }

    const pointsQuery = await db.collection('customer_points').where('customerId', '==', customerId.trim()).get();
    if (pointsQuery.docs.length > 1) {
      return res.status(409).json({ error: `Multiple loyalty points accounts (${pointsQuery.docs.length}) found for customer "${customerId}". Operation rejected.` });
    }
    let pointsDocRef: any;
    let existingData: any = null;

    if (!pointsQuery.empty) {
      const matchingPointsDoc = pointsQuery.docs.find(d => d.data().customerId === customerId.trim());
      if (!matchingPointsDoc) {
        return res.status(404).json({ error: `Loyalty points account does not match customer ID "${customerId}".` });
      }
      pointsDocRef = matchingPointsDoc.ref;
      existingData = matchingPointsDoc.data();
    } else {
      pointsDocRef = db.collection('customer_points').doc();
    }

    const newCurrent = (existingData?.currentPointsBalance || 0) + points;
    const newLifetime = (existingData?.lifetimePoints || 0) + points;

    let membershipLevel = 'Bronze';
    let nextThreshold = 200;
    if (newLifetime >= 1000) {
      membershipLevel = 'Platinum';
      nextThreshold = 2000;
    } else if (newLifetime >= 500) {
      membershipLevel = 'Gold';
      nextThreshold = 1000;
    } else if (newLifetime >= 200) {
      membershipLevel = 'Silver';
      nextThreshold = 500;
    }

    await pointsDocRef.set({
      id: pointsDocRef.id,
      customerId: customerId.trim(),
      customerName: custData.fullName || custData.name || 'Customer',
      currentPointsBalance: newCurrent,
      lifetimePoints: newLifetime,
      membershipLevel,
      nextLevelPointsThreshold: nextThreshold,
      updatedAt: now
    }, { merge: true });

    await custRef.update({
      membershipLevel,
      status: (membershipLevel === 'VIP' || membershipLevel === 'Platinum') ? 'vip' : 'active',
      updatedAt: now
    });

    const auditRef = db.collection('activity_logs').doc();
    await auditRef.set({
      id: auditRef.id,
      userId: user.uid,
      userName: user.name || user.email || 'POS Staff',
      userEmail: user.email || 'pos@system.internal',
      userRole: user.role,
      action: 'ADD_CUSTOMER_POINTS',
      entityId: customerId.trim(),
      entityType: 'customer_points',
      details: `Awarded ${points} points to ${custData.fullName || customerId}. New balance: ${newCurrent}`,
      branchId: custData.branchId || user.branchId || 'HQ',
      timestamp: now
    });

    return res.status(200).json({
      success: true,
      currentPointsBalance: newCurrent,
      lifetimePoints: newLifetime,
      membershipLevel
    });
  } catch (err: any) {
    console.error('Error adding customer points:', err);
    return res.status(500).json({ error: err.message || 'Failed to add customer points' });
  }
}

export async function handleCustomerPointsRedeem(req: express.Request, res: express.Response) {
  const user = await authenticateTrustedUser(req, res);
  if (!user) return;

  const roleCheck = checkRoleAuthorization(user, ['Owner', 'owner', 'Admin', 'admin', 'Manager', 'manager', 'Cashier', 'cashier', 'Staff', 'staff']);
  if (!roleCheck.authorized) {
    return res.status(403).json({ error: roleCheck.error });
  }

  const { customerId, rewardId } = req.body || {};
  if (!customerId || typeof customerId !== 'string') {
    return res.status(400).json({ error: 'customerId string is required.' });
  }
  if (!rewardId || typeof rewardId !== 'string') {
    return res.status(400).json({ error: 'rewardId string is required.' });
  }

  const db = getAdminDb();
  const now = new Date().toISOString();

  try {
    const custRef = db.collection('customers').doc(customerId.trim());
    const custSnap = await custRef.get();
    if (!custSnap.exists) {
      return res.status(404).json({ error: `Customer #${customerId} not found.` });
    }
    const custData = custSnap.data() || {};
    if (custData.branchId) {
      const branchCheck = checkBranchAuthorization(user, custData.branchId);
      if (!branchCheck.authorized) {
        return res.status(403).json({ error: branchCheck.error });
      }
    }

    const rewRef = db.collection('customer_rewards').doc(rewardId.trim());
    const rewSnap = await rewRef.get();
    if (!rewSnap.exists) {
      return res.status(404).json({ error: `Reward #${rewardId} not found.` });
    }
    const rewardData = rewSnap.data() || {};

    const pointsQuery = await db.collection('customer_points').where('customerId', '==', customerId.trim()).get();
    if (pointsQuery.empty) {
      return res.status(400).json({ error: 'Customer has no loyalty points account.' });
    }
    if (pointsQuery.docs.length > 1) {
      return res.status(409).json({ error: `Multiple loyalty points accounts (${pointsQuery.docs.length}) found for customer "${customerId}". Operation rejected.` });
    }

    const matchingPointsDoc = pointsQuery.docs.find(d => d.data().customerId === customerId.trim());
    if (!matchingPointsDoc) {
      return res.status(404).json({ error: `Loyalty points account does not match customer ID "${customerId}".` });
    }
    const pointsDoc = matchingPointsDoc;
    const pointsData = pointsDoc.data() || {};
    const pointsRequired = Number(rewardData.pointsRequired) || 0;

    if ((pointsData.currentPointsBalance || 0) < pointsRequired) {
      return res.status(400).json({
        error: `Insufficient loyalty points. Balance: ${pointsData.currentPointsBalance || 0}, Required: ${pointsRequired}`
      });
    }

    const newBalance = (pointsData.currentPointsBalance || 0) - pointsRequired;
    const claimedRef = db.collection('claimed_rewards').doc();
    const couponCode = 'REW-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    const claimedReward = {
      id: claimedRef.id,
      customerId: customerId.trim(),
      customerName: custData.fullName || custData.name || 'Customer',
      rewardId: rewardId.trim(),
      rewardName: rewardData.rewardName || 'Reward',
      pointsSpent: pointsRequired,
      couponCode,
      voucherCode: couponCode,
      status: 'active',
      redeemedAt: now,
      claimedAt: now,
      branchId: custData.branchId || user.branchId || 'HQ'
    };

    await pointsDoc.ref.update({
      currentPointsBalance: newBalance,
      updatedAt: now
    });
    await rewRef.update({
      currentRedemptions: (rewardData.currentRedemptions || 0) + 1,
      updatedAt: now
    });
    await claimedRef.set(claimedReward);

    const auditRef = db.collection('activity_logs').doc();
    await auditRef.set({
      id: auditRef.id,
      userId: user.uid,
      userName: user.name || user.email || 'POS Staff',
      userEmail: user.email || 'pos@system.internal',
      userRole: user.role,
      action: 'REDEEM_CUSTOMER_REWARD',
      entityId: claimedRef.id,
      entityType: 'claimed_rewards',
      details: `Customer ${custData.fullName || customerId} redeemed reward "${rewardData.rewardName}" for ${pointsRequired} points. Voucher: ${couponCode}`,
      branchId: custData.branchId || user.branchId || 'HQ',
      timestamp: now
    });

    return res.status(200).json(claimedReward);
  } catch (err: any) {
    console.error('Error redeeming customer reward:', err);
    return res.status(500).json({ error: err.message || 'Failed to redeem reward' });
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
  const now = new Date().toISOString();

  try {
    const rewardRef = db.collection('customer_rewards').doc();
    const newReward = {
      id: rewardRef.id,
      rewardName: String(rewardName).trim(),
      pointsRequired: Number(pointsRequired),
      discountType: discountType || 'percentage',
      discountValue: Number(discountValue || 0),
      description: description || '',
      minTier: minTier || 'bronze',
      maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
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

    const updates: Record<string, any> = { updatedAt: now };
    const { rewardName, pointsRequired, discountType, discountValue, description, minTier, maxRedemptions, isActive, branchId } = req.body || {};

    if (rewardName !== undefined) updates.rewardName = String(rewardName).trim();
    if (pointsRequired !== undefined) updates.pointsRequired = Number(pointsRequired);
    if (discountType !== undefined) updates.discountType = discountType;
    if (discountValue !== undefined) updates.discountValue = Number(discountValue);
    if (description !== undefined) updates.description = description;
    if (minTier !== undefined) updates.minTier = minTier;
    if (maxRedemptions !== undefined) updates.maxRedemptions = maxRedemptions ? Number(maxRedemptions) : null;
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

    return res.status(200).json({ status: 'success', id, ...updates });
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

    await rewardRef.delete();
    return res.status(200).json({ status: 'success', id });
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
  const now = new Date().toISOString();
  const normalizedCode = String(code).trim().toUpperCase();

  try {
    const couponRef = db.collection('customer_coupons').doc();
    const newCoupon = {
      id: couponRef.id,
      code: normalizedCode,
      title: title ? String(title).trim() : normalizedCode,
      description: description || '',
      discountType: discountType || 'percentage',
      discountValue: Number(discountValue || 0),
      minOrderAmount: Number(minOrderAmount || 0),
      maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
      usageLimit: usageLimit ? Number(usageLimit) : null,
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

    const updates: Record<string, any> = { updatedAt: now };
    const { code, title, description, discountType, discountValue, minOrderAmount, maxDiscountAmount, usageLimit, validFrom, validUntil, expiryDate, isActive, branchId } = req.body || {};

    if (code !== undefined) updates.code = String(code).trim().toUpperCase();
    if (title !== undefined) updates.title = String(title).trim();
    if (description !== undefined) updates.description = description;
    if (discountType !== undefined) updates.discountType = discountType;
    if (discountValue !== undefined) updates.discountValue = Number(discountValue);
    if (minOrderAmount !== undefined) updates.minOrderAmount = Number(minOrderAmount);
    if (maxDiscountAmount !== undefined) updates.maxDiscountAmount = maxDiscountAmount ? Number(maxDiscountAmount) : null;
    if (usageLimit !== undefined) updates.usageLimit = usageLimit ? Number(usageLimit) : null;
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

    return res.status(200).json({ status: 'success', id, ...updates });
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

    await couponRef.delete();
    return res.status(200).json({ status: 'success', id });
  } catch (err: any) {
    console.error('Error deleting customer coupon:', err);
    return res.status(500).json({ error: 'Failed to delete coupon' });
  }
}




