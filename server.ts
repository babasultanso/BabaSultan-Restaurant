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
  handleWalletRecharge,
  handleWalletDeduct,
  handleWalletRefund,
  handleGetFinancialSummary,
  handleCreateInventoryItem,
  handleUpdateInventoryItem,
  handleDeleteInventoryItem,
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
  handleDeleteCoupon
} from './server/trustedFinancialBackend.js';

dotenv.config();

export const app = express();
const PORT = Number(process.env.PORT) || 3000;

// P3-01: Production Security Headers & Strict CORS Allowlist Middleware
function isOriginAllowed(origin?: string): boolean {
  if (!origin) return true; // Same-origin or non-browser / server-to-server requests
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    
    // Strict match for production Vercel frontend
    if (origin === 'https://baba-sultan-restaurant.vercel.app' || host === 'baba-sultan-restaurant.vercel.app') {
      return true;
    }
    
    // Allow local development and test environments
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
      return true;
    }
    
    // Allow Vercel preview deployments, Google Cloud Run, Firebase Hosting, and Google AI Studio
    if (
      host.endsWith('.vercel.app') ||
      host.endsWith('.run.app') ||
      host.endsWith('.web.app') ||
      host.endsWith('.firebaseapp.com') ||
      host.endsWith('.aistudio.google.com') ||
      host.endsWith('.google.com')
    ) {
      return true;
    }
    
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

app.use(express.json({ limit: '10mb' }));

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
app.post('/api/purchases', handlePurchaseRegistration);
app.post('/api/bank-transactions', handleBankTransaction);
app.post('/api/inventory/adjust', handleInventoryAdjustment);
app.post('/api/inventory/stock', handleStockUpdate);
app.post('/api/kitchen/:ticketId/status', handleKitchenStatusUpdate);
app.post('/api/kitchen/:ticketId/update', handleKitchenTicketUpdate);
app.post('/api/deliveries/:deliveryId/status', handleDeliveryStatusUpdate);
app.post('/api/deliveries/:deliveryId/assign', handleDeliveryAssignDriver);
app.post('/api/deliveries/notifications', handleCreateDeliveryNotification);
app.post('/api/orders/:orderId/update', handleOrderUpdate);

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

// Financial Summary Route
app.get('/api/financial-summary', handleGetFinancialSummary);

// AI Assistant Endpoint using Gemini API
app.post('/api/ai-chat', handleAIChatRequest);
app.post('/api/ai/execute-action', handleAIExecuteAction);

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
