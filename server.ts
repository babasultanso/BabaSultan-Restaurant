import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { handleAIChatRequest } from './server/aiService.js';
import {
  handlePosCheckout,
  handleOrderCancellation,
  handleCustomerRefund,
  handleExpenseCreation,
  handleSalaryDisbursement,
  handlePayrollProcess,
  handleAttendanceClockIn,
  handleAttendanceClockOut,
  handleAttendanceManual,
  handlePurchaseRegistration,
  handleBankTransaction,
  handleInventoryAdjustment,
  handleStockUpdate,
  handleKitchenStatusUpdate,
  handleDeliveryStatusUpdate,
  handleDeliveryAssignDriver,
  handleOrderUpdate,
  handleCreateAccount,
  handleUpdateAccount,
  handleCreateJournalEntry,
  handleCreateRevenue,
  handleCreateReceivable,
  handleRecordARPayment,
  handleCreatePayable,
  handleRecordAPPayment,
  handleOpenCashRegister,
  handleCloseCashRegister,
  handleCreateBankAccount,
  handleCreateTax,
  handleUpdateTax,
  handleReceiveGoods,
  handleRecordSupplierPayment,
  handleKitchenTicketUpdate,
  handleKitchenStationStatusUpdate,
  handleWalletRecharge,
  handleWalletDeduct,
  handleWalletRefund,
  handleGetFinancialSummary,
  handleCreateInventoryItem,
  handleUpdateInventoryItem,
  handleDeleteInventoryItem,
  handleBranchTransferApproval, handleBranchTransferCreate, handleBranchTransferRejection, handleProductOptionCreate, handleProductOptionUpdate, handleProductOptionDelete,
  handleCreatePurchaseOrder,
  handleUpdatePurchaseOrder,
  handleApprovePurchaseOrder,
  handleCreateDeliveryOrder,
  handleDeliveryTracking,
  handleLogKitchenWaste,
  handleDeliveryRating,
  handleCreateDeliveryNotification,
  handleLogActivity,
  handleRegisterDevice,
  handleMarkNotificationRead,
  handleAIExecuteAction,
  handleCustomerPointsAdd,
  handleCustomerPointsRedeem,
  handleCreateReward,
  handleUpdateReward,
  handleDeleteReward,
  handleCreateCoupon,
  handleUpdateCoupon,
  handleDeleteCoupon,
  handleAdminCreateUser,
  handleInitialSetup,
  handleGetBranchSettings,
  handleUpdateBranchSettings,
  handleCreateRecipe,
  handleUpdateRecipe,
  handleDeleteRecipe
} from './server/trustedFinancialBackend.js';

dotenv.config();

export const app = express();
// Render/Cloud Run sit behind a trusted reverse proxy; use the proxy-aware client IP for rate limiting.
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;

// P3-01: Production Security Headers & Strict CORS Allowlist Middleware
function isOriginAllowed(origin?: string): boolean {
  if (!origin) return true; // Same-origin or non-browser / server-to-server requests
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname;
    // Strict match for the production Vercel frontend. Compare origins, not hostnames,
    // so alternate schemes/ports are never implicitly trusted.
    if (parsed.origin === 'https://baba-sultan-restaurant.vercel.app') {
      return true;
    }
    
    // Allow local development only outside production.
    const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    if (!isProduction && (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0')) {
      return true;
    }
    
    // Production/preview origins must be explicitly configured. Never allow
    // every *.vercel.app / *.google.com origin by suffix because that creates an
    // unnecessarily broad browser trust boundary.

    // Allow explicitly configured application domains via environment variables
    const envOrigins = [
      process.env.FRONTEND_URL,
      process.env.APP_URL,
      process.env.VITE_APP_URL,
      process.env.ALLOWED_ORIGINS
    ].filter(Boolean) as string[];

    for (const envOrigin of envOrigins) {
      for (const single of envOrigin.split(',')) {
        const trimmed = single.trim();
        try {
          if (new URL(trimmed).origin === origin) return true;
        } catch {
          if (trimmed === origin) return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  const origin = req.headers.origin;
  const allowed = isOriginAllowed(origin);

  if (origin && allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key, X-Idempotency-Key, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    if (origin && !allowed) {
      return res.status(403).json({ error: 'CORS policy violation: Origin not allowed.' });
    }
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

// Lightweight in-process rate limiting. Deployments with multiple instances
// should additionally enforce limits at the edge/load-balancer layer.
const rateState = new Map<string, { count: number; resetAt: number }>();
app.use('/api', (req, res, next) => {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') return next();
  const now = Date.now();
  const key = `${req.ip}:${req.path.startsWith('/ai') ? 'ai' : req.method}`;
  const windowMs = 60_000;
  const max = req.path.startsWith('/ai') ? 30 : 120;
  const current = rateState.get(key);
  if (!current || current.resetAt <= now) {
    rateState.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }
  current.count += 1;
  if (current.count > max) {
    res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
    return res.status(429).json({ error: 'Too many requests. Please retry later.' });
  }
  return next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// P0 Trusted Financial & Operational Endpoints (Firebase Admin SDK Server Execution)
app.post('/api/pos/complete', handlePosCheckout);
app.post('/api/orders/:orderId/cancel', handleOrderCancellation);
app.post('/api/orders/:orderId/refund', handleCustomerRefund);
app.post('/api/expenses', handleExpenseCreation);
app.post('/api/salaries', handleSalaryDisbursement);
app.post('/api/payroll/process', handlePayrollProcess);
app.post('/api/hrm/attendance/clock-in', handleAttendanceClockIn);
app.post('/api/hrm/attendance/:id/clock-out', handleAttendanceClockOut);
app.post('/api/hrm/attendance/manual', handleAttendanceManual);
app.post('/api/purchases', handlePurchaseRegistration);
app.post('/api/bank-transactions', handleBankTransaction);
app.post('/api/inventory/adjust', handleInventoryAdjustment);
app.post('/api/inventory/stock', handleStockUpdate);
app.post('/api/kitchen/:ticketId/status', handleKitchenStatusUpdate);
app.post('/api/kitchen/:ticketId/update', handleKitchenTicketUpdate);
app.post('/api/kitchen/stations/:stationId/status', handleKitchenStationStatusUpdate);
app.post('/api/deliveries/:deliveryId/status', handleDeliveryStatusUpdate);
app.post('/api/deliveries/:deliveryId/assign', handleDeliveryAssignDriver);
app.post('/api/deliveries/notifications', handleCreateDeliveryNotification);
app.post('/api/orders/:orderId/update', handleOrderUpdate);
app.post('/api/branch-transfers', handleBranchTransferCreate);
app.post('/api/branch-transfers/:transferId/approve', handleBranchTransferApproval);
app.post('/api/branch-transfers/:transferId/reject', handleBranchTransferRejection);
app.post('/api/product-options', handleProductOptionCreate);
app.post('/api/product-options/:id', handleProductOptionUpdate);
app.delete('/api/product-options/:id', handleProductOptionDelete);

// Accounting & Purchasing API Routes
app.post('/api/accounting/accounts', handleCreateAccount);
app.post('/api/accounting/accounts/:id', handleUpdateAccount);
app.post('/api/accounting/journal-entries', handleCreateJournalEntry);
app.post('/api/accounting/revenues', handleCreateRevenue);
app.post('/api/accounting/receivables', handleCreateReceivable);
app.post('/api/accounting/receivables/:id/payment', handleRecordARPayment);
app.post('/api/accounting/payables', handleCreatePayable);
app.post('/api/accounting/payables/:id/payment', handleRecordAPPayment);
app.post('/api/accounting/cash-registers/open', handleOpenCashRegister);
app.post('/api/accounting/cash-registers/close', handleCloseCashRegister);
app.post('/api/accounting/bank-accounts', handleCreateBankAccount);
app.post('/api/accounting/taxes', handleCreateTax);
app.post('/api/accounting/taxes/:id', handleUpdateTax);
app.post('/api/purchases/receive', handleReceiveGoods);
app.post('/api/purchases/supplier-payment', handleRecordSupplierPayment);
app.post('/api/purchases/orders', handleCreatePurchaseOrder);
app.post('/api/purchases/orders/:id/update', handleUpdatePurchaseOrder);
app.post('/api/purchases/orders/:id/approve', handleApprovePurchaseOrder);
app.post('/api/inventory/items', handleCreateInventoryItem);
app.post('/api/inventory/items/:id/update', handleUpdateInventoryItem);
app.post('/api/inventory/items/:id/delete', handleDeleteInventoryItem);
app.post('/api/recipes', handleCreateRecipe);
app.post('/api/recipes/:id/update', handleUpdateRecipe);
app.delete('/api/recipes/:id', handleDeleteRecipe);
app.post('/api/deliveries', handleCreateDeliveryOrder);
app.post('/api/deliveries/:deliveryId/tracking', handleDeliveryTracking);
app.post('/api/deliveries/:deliveryId/rating', handleDeliveryRating);
app.post('/api/kitchen/waste', handleLogKitchenWaste);
app.post('/api/audit/activity', handleLogActivity);

// Notification API Routes
app.post('/api/notifications/register-device', handleRegisterDevice);
app.post('/api/notifications/:id/read', handleMarkNotificationRead);

// CRM Wallet & Loyalty API Routes
app.post('/api/crm/wallet/recharge', handleWalletRecharge);
app.post('/api/crm/wallet/deduct', handleWalletDeduct);
app.post('/api/crm/wallet/refund', handleWalletRefund);
app.post('/api/wallet/recharge', handleWalletRecharge);
app.post('/api/wallet/deduct', handleWalletDeduct);
app.post('/api/wallet/refund', handleWalletRefund);
app.post('/api/crm/points/add', handleCustomerPointsAdd);
app.post('/api/crm/points/redeem', handleCustomerPointsRedeem);
app.post('/api/points/add', handleCustomerPointsAdd);
app.post('/api/points/redeem', handleCustomerPointsRedeem);
app.post('/api/crm/rewards', handleCreateReward);
app.post('/api/crm/rewards/:id/update', handleUpdateReward);
app.patch('/api/crm/rewards/:id', handleUpdateReward);
app.put('/api/crm/rewards/:id', handleUpdateReward);
app.delete('/api/crm/rewards/:id', handleDeleteReward);
app.post('/api/crm/coupons', handleCreateCoupon);
app.post('/api/crm/coupons/:id/update', handleUpdateCoupon);
app.patch('/api/crm/coupons/:id', handleUpdateCoupon);
app.put('/api/crm/coupons/:id', handleUpdateCoupon);
app.delete('/api/crm/coupons/:id', handleDeleteCoupon);

// User Management API Routes
app.post('/api/users/admin-create', handleAdminCreateUser);
app.post('/api/setup/initial', handleInitialSetup);
app.get('/api/settings/branch', handleGetBranchSettings);
app.put('/api/settings/branch', handleUpdateBranchSettings);

// Financial Summary Route
app.get('/api/financial-summary', handleGetFinancialSummary);

// AI Assistant Endpoint using Gemini API
app.post('/api/ai-chat', handleAIChatRequest);
app.post('/api/ai/execute-action', handleAIExecuteAction);

// Central error boundary: never leak stack traces or internal implementation details to clients.
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = Number(err?.statusCode || err?.status || 500);
  const safeStatus = status >= 400 && status < 600 ? status : 500;
  console.error('Unhandled API error', {
    method: req.method,
    path: req.path,
    status: safeStatus,
    message: err?.message || String(err)
  });
  if (res.headersSent) return;
  return res.status(safeStatus).json({
    error: safeStatus >= 500 ? 'Internal server error.' : (err?.message || 'Request failed.')
  });
});

// Vite Development or Production Server Static Middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Restaurant ERP & AI Business Assistant server running on port ${PORT}`);
  });
}

if (!process.env.VERCEL && !process.env.VITEST && process.env.NODE_ENV !== 'test') {
  startServer();
}
