import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Static hardening guards', () => {
  it('requires an explicit Firebase project ID in production builds', () => {
    const source = readFileSync(new URL('../src/lib/firebase.ts', import.meta.url), 'utf8');
    expect(source).toContain('VITE_FIREBASE_PROJECT_ID is required for production builds.');
    expect(source).toContain('env.PROD');
  });


  it('requires the complete Firebase client configuration in production', () => {
    const source = readFileSync(new URL('../src/lib/firebase.ts', import.meta.url), 'utf8');
    for (const key of [
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID'
    ]) expect(source).toContain(key);
    expect(source).toContain('Missing required Firebase production configuration');
  });

  it('requires an explicit server Firebase project in production', () => {
    const source = readFileSync(new URL('../server/db.ts', import.meta.url), 'utf8');
    expect(source).toContain('FIREBASE_PROJECT_ID is required in production');
    expect(source).toContain('const explicitProductionId');
  });

  it('Cloud Build passes the Firebase project explicitly to Cloud Run', () => {
    const source = readFileSync(new URL('../cloudbuild.yaml', import.meta.url), 'utf8');
    expect(source).toContain('FIREBASE_PROJECT_ID=$PROJECT_ID');
  });

  it('does not silently use a bundled Firestore database ID in production', () => {
    const source = readFileSync(new URL('../src/lib/firebase.ts', import.meta.url), 'utf8');
    expect(source).toContain('(!env.PROD ? (defaultFirebaseConfig as any).firestoreDatabaseId : undefined)');
  });

  it('requires an explicit API base URL for production frontends', () => {
    const source = readFileSync(new URL('../src/lib/apiConfig.ts', import.meta.url), 'utf8');
    expect(source).toContain('VITE_API_BASE_URL is required for production frontends.');
    expect(source).toContain('(import.meta as any).env?.PROD');
  });

  it('does not use a bundled Firebase API key in production server auth fallback', () => {
    const source = readFileSync(new URL('../server/db.ts', import.meta.url), 'utf8');
    expect(source).toContain('FIREBASE_API_KEY is required in production for REST auth fallback.');
  });

  it('does not reintroduce fixed business defaults', () => {
    const files = [
      '../src/lib/cfoAnalytics.ts',
      '../src/data/repositories/KitchenRepositoryImpl.ts',
      '../src/data/repositories/CustomerRepositoryImpl.ts',
      '../src/presentation/components/delivery/DeliveryManagementView.tsx',
      '../src/presentation/components/OrdersView.tsx',
      '../src/lib/aiBusinessPlatformAnalytics.ts'
    ];
    const joined = files.map((f) => readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n');
    expect(joined).not.toContain('Primary Supplier');
    expect(joined).not.toContain('estimatedPrepTimeMinutes: data.estimatedPrepTimeMinutes || 15');
    expect(joined).not.toContain('orderFrequencyDays: data.orderFrequencyDays || 7');
    expect(joined).not.toContain('parseFloat(e.target.value) || 5');
    expect(joined).not.toContain('minStockAlert || 5');
    expect(joined).not.toContain('minStockAlert ?? 5');
  });


  it('keeps AI product-price mutations schema-validated and driver writes server-authoritative', () => {
    const backend = readFileSync(new URL('../server/trustedFinancialBackend.ts', import.meta.url), 'utf8');
    const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
    expect(backend).toContain('UPDATE_PRODUCT_PRICE: z.object');
    expect(backend).toContain('newPrice: z.number().nonnegative');
    expect(rules).not.toContain("isPOSStaff() &&\n          isUserBranch(resource.data.get('branchId', '')) &&\n          isUserBranch(request.resource.data.get('branchId', ''))");
  });

  it('keeps the canonical translation registry wired to all domains', () => {
    const source = readFileSync(new URL('../src/i18n/translations.ts', import.meta.url), 'utf8');
    expect(source).toContain('core: translations[lang]');
    expect(source).toContain('inventory: inventoryDict[lang]');
    expect(source).toContain('recipe: recipeDict[lang]');
    expect(source).toContain('kitchen: kdsDict[lang]');
  });
});

  it('does not invent operational metrics or delivery/product defaults when source data is missing', () => {
    const files = [
      '../src/presentation/components/dashboard/OtherRolesView.tsx',
      '../src/presentation/components/AdminPanelView.tsx',
      '../src/presentation/components/delivery/DeliveryManagementView.tsx',
      '../src/presentation/components/OrdersView.tsx',
      '../src/presentation/components/products/ProductFormModal.tsx',
      '../src/presentation/components/products/ProductManagementView.tsx',
      '../src/presentation/components/products/ProductDetailsModal.tsx',
      '../src/presentation/components/crm/CustomerDetailsView.tsx',
      '../src/presentation/components/reports/BIAnalyticsDashboard.tsx',
      '../src/lib/deliveryService.ts',
      '../server/trustedFinancialBackend.ts'
    ];
    const joined = files.map((f) => readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n');
    for (const forbidden of [
      'activeDineIn.length || 4',
      "tableNumber || 'Table 4'",
      'branches.length || 1',
      'estimatedDeliveryTimeMinutes || 30',
      'estimatedTimeMinutes: parseInt(e.target.value) || 25',
      'prepTimeMinutes || 15',
      'p.minStockAlert || 10',
      'product.minStockAlert || 10',
      'orderFrequencyDays || 7',
      'item.quantity || 1',
      "Default Address",
      "branchName: (user as any).branch || 'Headquarters'",
      'Number(prod.prepTimeMinutes) || 15'
    ]) expect(joined).not.toContain(forbidden);
  });

  it('removes seeded demo entities and fake operator identity from production UI state', () => {
    const files = [
      '../src/presentation/components/kitchen/StationView.tsx',
      '../src/presentation/components/inventory/InventoryListView.tsx'
    ];
    const joined = files.map((f) => readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n');
    for (const forbidden of [
      "completedOrdersToday: 30",
      "avgPrepTimeMinutes: 14",
      "Chef Youssef Hassan",
      "Global Food Wholesale Ltd",
      "storageLocation: 'Main Dry Storage'"
    ]) expect(joined).not.toContain(forbidden);
  });

  it('does not seed promotional coupons with fixed commercial terms', () => {
    const source = readFileSync(new URL('../src/presentation/components/crm/CouponsView.tsx', import.meta.url), 'utf8');
    expect(source).not.toContain('discountValue: 10');
    expect(source).not.toContain('minOrderAmount: 20');
    expect(source).not.toContain('maxDiscountAmount: 15');
    expect(source).not.toContain('usageLimit: 100');
    expect(source).not.toContain('Date.now() + 30 * 24 * 60 * 60 * 1000');
  });

  it('does not fabricate charts, warehouse locations, or station-specific delay thresholds', () => {
    const files = [
      '../src/presentation/components/reports/BIAnalyticsDashboard.tsx',
      '../src/presentation/components/inventory/InventoryListView.tsx',
      '../src/presentation/components/inventory/StockMovementView.tsx',
      '../src/lib/operationsAnalytics.ts',
      '../src/lib/ceoAnalytics.ts'
    ];
    const joined = files.map((f) => readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n');
    expect(joined).not.toContain("[{ name: 'Default', value: 100 }]");
    expect(joined).not.toContain("'Main Warehouse'");
    expect(joined).not.toContain("'Kitchen Prep Station'");
    expect(joined).not.toContain('15-minute preparation limit at the Grill Station');
  });

describe('Repeated security-closure guards', () => {
  it('keeps server-authoritative collections closed to direct client writes', () => {
    const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
    for (const collection of ['kitchen_waste', 'purchase_items', 'cash_transfers']) {
      const marker = `match /${collection}/`;
      const start = rules.indexOf(marker);
      expect(start).toBeGreaterThanOrEqual(0);
      const next = rules.indexOf('\n    match /', start + marker.length);
      const block = rules.slice(start, next >= 0 ? next : rules.length);
      expect(block).toContain('allow write: if false;');
    }
  });

  it('keeps notification-token ownership and branch immutable for the token owner', () => {
    const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
    const start = rules.indexOf('match /notification_tokens/');
    expect(start).toBeGreaterThanOrEqual(0);
    const next = rules.indexOf('\n    match /', start + 10);
    const block = rules.slice(start, next >= 0 ? next : rules.length);
    expect(block).toContain("request.resource.data.userId == resource.data.userId");
    expect(block).toContain("request.resource.data.get('branchId', '') == resource.data.get('branchId', '')");
  });
});


// R87+ hardening expectations: attendance and recipe write paths are server-authoritative.

it('keeps cross-layer integrity contracts aligned after hardening', () => {
  const backend = readFileSync(new URL('../server/trustedFinancialBackend.ts', import.meta.url), 'utf8');
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const orders = readFileSync(new URL('../src/data/repositories/OrdersRepositoryImpl.ts', import.meta.url), 'utf8');
  const customers = readFileSync(new URL('../src/data/repositories/CustomerRepositoryImpl.ts', import.meta.url), 'utf8');
  const firebase = readFileSync(new URL('../src/lib/firebase.ts', import.meta.url), 'utf8');
  expect(backend).toContain('No canonical ingredient in branch');
  expect(backend).toContain('Supplier has no canonical branchId');
  expect(backend).toContain("activeDeliveryId: null");
  expect(backend).toContain('No open cash register exists for branch');
  expect(backend).toContain('currentStockUsageUnit: newQty');
  expect(rules).toContain('match /recipes/{recipeId}');
  expect(rules).toContain('allow create, update, delete: if false; // Server-authoritative recipe lifecycle');
  expect(rules).toContain('match /recipe_versions/{id}');
  expect(rules).toContain('allow create, update, delete: if false; // Immutable, server-generated recipe history');
  expect(rules).toContain('match /categories/{categoryId}');
  expect(rules).toContain('Categories are archived/soft-deleted');
  expect(orders).toContain("'Idempotency-Key': idempotencyKey");
  expect(customers).toContain("/api/crm/rewards/${id}/update");
  expect(customers).toContain("/api/crm/coupons/${id}/update");
  expect(firebase).toContain("ATTENDANCE: 'employee_attendance'");
  expect(firebase).not.toContain('loyaltyPoints: 100');
});

it('keeps master-data hard-delete bypasses closed', () => {
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  for (const collection of ['employees', 'suppliers', 'products', 'ingredients', 'customers', 'categories', 'inventory']) {
    const start = rules.indexOf(`match /${collection}/`);
    expect(start).toBeGreaterThanOrEqual(0);
    const next = rules.indexOf('\n    match /', start + 10);
    const block = rules.slice(start, next >= 0 ? next : rules.length);
    expect(block).toContain('allow delete: if false;');
  }
});
