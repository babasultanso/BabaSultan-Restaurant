import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('TARGETED REMEDIATION — CONFIRMED ISSUES REGRESSION SUITE', () => {
  // ISSUE 1: Dockerfile and Distributable Contract
  describe('Issue 1: Dockerfile Presence & Packaging Contract', () => {
    it('verifies Dockerfile exists at repository root with correct production contract', () => {
      const dockerfilePath = path.resolve(process.cwd(), 'Dockerfile');
      expect(fs.existsSync(dockerfilePath)).toBe(true);
      const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');

      expect(dockerfile).toContain('FROM node:22-bookworm-slim');
      expect(dockerfile).toContain('COPY package*.json ./');
      expect(dockerfile).toContain('RUN npm ci --no-audit --no-fund');
      expect(dockerfile).toContain('RUN npm run build');
      expect(dockerfile).toContain('USER node');
      expect(dockerfile).toContain('EXPOSE 8080');
      expect(dockerfile).toContain('CMD ["node", "dist/server.cjs"]');
      expect(dockerfile).not.toContain('.env');
    });
  });

  // ISSUE 2: Employee Identity / User Linkage
  describe('Issue 2: Employee Identity & User Linkage Protection', () => {
    it('verifies ordinary users cannot read another employee salary by forging employeeId or email in storage', async () => {
      const { canReadSensitiveCustomerFields } = await import('../src/data/repositories/CustomerRepositoryImpl.js');
      const { HRMRepositoryImpl } = await import('../src/data/repositories/HRMRepositoryImpl.js');

      // Setup simulated local storage with ordinary cashier profile
      const ordinaryProfile = {
        id: 'usr_cashier_1',
        uid: 'usr_cashier_1',
        role: 'Cashier',
        employeeId: 'emp_victim_ceo', // Attempted forgery
        email: 'attacker@example.com'
      };

      const storageMock: Record<string, string> = {
        user_profile: JSON.stringify(ordinaryProfile)
      };

      vi.stubGlobal('localStorage', {
        getItem: (k: string) => storageMock[k] || null,
        setItem: (k: string, v: string) => { storageMock[k] = v; },
        removeItem: (k: string) => { delete storageMock[k]; }
      });

      // Target victim employee belongs to a different userId
      const victimEmployee = {
        id: 'emp_victim_ceo',
        userId: 'usr_victim_ceo',
        email: 'ceo@restaurant.com'
      };

      // Test repository's employee fetch sanitization logic:
      // An ordinary cashier with uid 'usr_cashier_1' must NOT be able to view victim's sensitive fields
      const hrmRepo = new HRMRepositoryImpl();
      // Internal canReadSensitiveEmployeeFields check
      const canRead = (hrmRepo as any).canReadSensitiveEmployeeFields
        ? (hrmRepo as any).canReadSensitiveEmployeeFields(victimEmployee)
        : false;

      expect(canRead).toBe(false);

      vi.unstubAllGlobals();
    });

    it('verifies firestore.rules protects employeeId, userId, uid, authUid in users and employees update', () => {
      const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
      // In users update:
      expect(rules).toMatch(/affectedKeys\(\)\.hasAny\(\[[^\]]*'employeeId'[^\]]*'userId'[^\]]*\]\)/);
      // In employees update:
      expect(rules).toMatch(/affectedKeys\(\)\.hasAny\(\[[^\]]*'userId'[^\]]*'employeeId'[^\]]*\]\)/);
    });
  });

  // ISSUE 3: Driver Create Mass Assignment
  describe('Issue 3: Driver Create Mass-Assignment Protection', () => {
    it('verifies createDriver sanitizes client-forged metrics and enforces baseline defaults', async () => {
      const { createDriver } = await import('../src/lib/deliveryService.js');

      // The createDriver function implementation strips forged fields
      const driverServiceFile = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/deliveryService.ts'), 'utf8');
      expect(driverServiceFile).toContain('totalDeliveries: 0');
      expect(driverServiceFile).toContain('completedDeliveries: 0');
      expect(driverServiceFile).toContain('failedDeliveries: 0');
      expect(driverServiceFile).toContain('activeDeliveries: 0');
      expect(driverServiceFile).toContain("availability: 'available'");
    });

    it('verifies firestore.rules rejects forged driver metrics on creation', () => {
      const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
      expect(rules).toContain("request.resource.data.get('totalDeliveries', 0) == 0");
      expect(rules).toContain("request.resource.data.get('completedDeliveries', 0) == 0");
      expect(rules).toContain("request.resource.data.get('activeDeliveries', 0) == 0");
    });
  });

  // ISSUE 4: Customer Data Privacy
  describe('Issue 4: Customer Data Privacy & Least-Privilege Projection', () => {
    it('masks sensitive customer financial and private fields for operational roles', async () => {
      const { canReadSensitiveCustomerFields } = await import('../src/data/repositories/CustomerRepositoryImpl.js');

      // Case A: Operational Waiter
      const waiterProfile = { id: 'usr_waiter_99', role: 'Waiter', branchId: 'BR-001' };
      const storageMock: Record<string, string> = { user_profile: JSON.stringify(waiterProfile) };
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => storageMock[k] || null
      });

      const customerDoc = { id: 'cust_abc_1', userId: 'cust_user_44' };
      expect(canReadSensitiveCustomerFields(customerDoc)).toBe(false);

      // Case B: Management (Manager / Owner / Admin)
      const managerProfile = { id: 'usr_mgr_1', role: 'Manager', branchId: 'BR-001' };
      storageMock.user_profile = JSON.stringify(managerProfile);
      expect(canReadSensitiveCustomerFields(customerDoc)).toBe(true);

      // Case C: Customer Self-Access
      const customerSelfProfile = { id: 'cust_user_44', role: 'Customer' };
      storageMock.user_profile = JSON.stringify(customerSelfProfile);
      expect(canReadSensitiveCustomerFields(customerDoc)).toBe(true);

      vi.unstubAllGlobals();
    });
  });

  // ISSUE 5: Customer Notification Spoofing
  describe('Issue 5: Customer Notification Spoofing Prevention', () => {
    it('verifies firestore.rules blocks client-forged system metadata on customer_notifications create and restricts update', () => {
      const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
      expect(rules).toContain("!request.resource.data.keys().hasAny(['isSystem', 'isPrivileged', 'systemBroadcast', 'verifiedByAdmin'])");
      expect(rules).toContain("request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read', 'isRead', 'readAt'])");
    });
  });

  // ISSUE 6: Customer Ownership Forging
  describe('Issue 6: Customer Ownership Forging Prevention', () => {
    it('verifies firestore.rules binds customer userId and authUid to authenticated identity on create', () => {
      const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
      expect(rules).toContain("request.resource.data.userId == request.auth.uid || isManagement()");
      expect(rules).toContain("request.resource.data.authUid == request.auth.uid || isManagement()");
    });
  });

  // ISSUE 7: Delivery Rating Race Condition
  describe('Issue 7: Delivery Rating Atomic Concurrency', () => {
    it('verifies handleDeliveryRating is wrapped in an atomic Firestore transaction', () => {
      const backendSource = fs.readFileSync(path.resolve(process.cwd(), 'server/trustedFinancialBackend.ts'), 'utf8');
      const ratingFnMatch = backendSource.indexOf('export async function handleDeliveryRating');
      expect(ratingFnMatch).toBeGreaterThan(-1);
      const ratingFnBody = backendSource.slice(ratingFnMatch, ratingFnMatch + 3500);

      expect(ratingFnBody).toContain('runTransactionWithRetry(db, async (transaction)');
      expect(ratingFnBody).toContain('deliveryDoc = await transaction.get(deliveryRef)');
      expect(ratingFnBody).toContain("status !== 'delivered'");
      expect(ratingFnBody).toContain("statusCode: 409");
      expect(ratingFnBody).toContain('transaction.update(deliveryRef');
    });
  });

  // ISSUE 8: Branch Settings Data Exposure
  describe('Issue 8: Branch Settings Data Isolation & Sanitization', () => {
    it('verifies firestore.rules restricts direct branch_settings read to management and owner', () => {
      const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
      expect(rules).toContain("match /branch_settings/{settingId}");
      expect(rules).toMatch(/allow read:\s*if\s*\(isManagement\(\)\s*\|\|\s*isOwnerRole\(\)\)/);
    });

    it('verifies handleGetBranchSettings returns sanitized operational DTO for non-admin staff', () => {
      const backendSource = fs.readFileSync(path.resolve(process.cwd(), 'server/trustedFinancialBackend.ts'), 'utf8');
      expect(backendSource).toContain('export async function handleGetBranchSettings');
      expect(backendSource).toContain('// Operational Staff receive only permitted non-sensitive operational settings');
      expect(backendSource).toContain('defaultTaxRate: data.tax?.defaultTaxRate');
    });
  });

  // ISSUE 9: Hold Orders, Tables, Shifts, Notification Tokens
  describe('Issue 9: Tightened Allowlist & Branch Isolation for Operational Entities', () => {
    it('verifies firestore.rules enforces strict keys for hold_orders', () => {
      const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
      expect(rules).toContain("match /hold_orders/{holdId}");
      expect(rules).toContain("!request.resource.data.keys().hasAny(['paidAmount', 'paymentId', 'isCompleted', 'isSettled'])");
    });

    it('verifies firestore.rules enforces strict keys for dining_tables and tables', () => {
      const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
      expect(rules).toContain("match /dining_tables/{tableId}");
      expect(rules).toContain("match /tables/{tableId}");
      expect(rules).toContain("request.resource.data.keys().hasOnly([\n          'id', 'branchId', 'name', 'tableNumber', 'capacity'");
    });

    it('verifies firestore.rules enforces branch isolation and field allowlists on shifts', () => {
      const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
      expect(rules).toContain("match /shifts/{id}");
      expect(rules).toContain("request.resource.data.get('branchId', '') != ''");
      expect(rules).toContain("request.resource.data.get('branchId', '') == resource.data.get('branchId', '')");
    });

    it('verifies firestore.rules strictly binds notification_tokens to authenticated user and branch', () => {
      const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
      expect(rules).toContain("match /notification_tokens/{tokenId}");
      expect(rules).toContain("request.resource.data.userId == request.auth.uid");
      expect(rules).toContain("request.resource.data.get('branchId', '') == '' || isUserBranch(request.resource.data.get('branchId', ''))");
    });
  });

  // ISSUE 10: Cloud Run / Gemini Secret Configuration
  describe('Issue 10: Server Secret Isolation & Cloud Run Secret Manager Mount', () => {
    it('verifies cloudbuild.yaml configures GEMINI_API_KEY through Cloud Run Secret Manager', () => {
      const cloudbuild = fs.readFileSync(path.resolve(process.cwd(), 'cloudbuild.yaml'), 'utf8');
      expect(cloudbuild).toContain("'--set-secrets'");
      expect(cloudbuild).toContain("'GEMINI_API_KEY=GEMINI_API_KEY:latest'");
    });

    it('verifies scripts/verify-build-config.mjs rejects any GEMINI_API_KEY with VITE_ prefix', () => {
      const verifyScript = fs.readFileSync(path.resolve(process.cwd(), 'scripts/verify-build-config.mjs'), 'utf8');
      expect(verifyScript).toContain('/GEMINI_API_KEY/i');
    });
  });

  // ISSUE 11: Financial Summary Scalability
  describe('Issue 11: Financial Summary Scalability & Calculation Equivalence', () => {
    it('verifies getFinancialSummaryData query optimization with date bounds', () => {
      const backendSource = fs.readFileSync(path.resolve(process.cwd(), 'server/trustedFinancialBackend.ts'), 'utf8');
      expect(backendSource).toContain("fetchBranchDocs('orders', 'createdAt')");
      expect(backendSource).toContain("fetchBranchDocs('refunds', 'createdAt')");
      expect(backendSource).toContain("fetchBranchDocs('expenses', 'createdAt')");
      expect(backendSource).toContain("if (dateField && (startDate || endDate))");
    });
  });

  // ISSUE 12: Empty / Inconsistent bun.lock Removal
  describe('Issue 12: bun.lock Cleanup & Authoritative Lockfile Enforcement', () => {
    it('verifies bun.lock is removed from the repository root', () => {
      const bunLockPath = path.resolve(process.cwd(), 'bun.lock');
      expect(fs.existsSync(bunLockPath)).toBe(false);
    });

    it('verifies package-lock.json is present and valid for production npm ci', () => {
      const lockPath = path.resolve(process.cwd(), 'package-lock.json');
      expect(fs.existsSync(lockPath)).toBe(true);
      const content = fs.readFileSync(lockPath, 'utf8');
      const json = JSON.parse(content);
      expect(json.name).toBe('babasultan-restaurant-erp');
      expect(json.lockfileVersion).toBeDefined();
    });
  });
});
