/**
 * Baba Sultan Restaurant ERP — Canonical Domain Contracts Registry
 * 
 * Single authoritative contract registry for all cross-domain interfaces,
 * status enums, payment methods, inventory types, and operational states.
 * 
 * Rules:
 * 1. ONE SOURCE OF TRUTH: All layers (Frontend, Backend, Repositories, Services, Tests)
 *    must derive or align their domain models from these canonical definitions.
 * 2. NO AMBIGUOUS ALIASES: Status values and domain methods must map deterministically.
 * 3. EXPLICIT BUSINESS MEANING: Every method/status has clear financial and operational effects.
 */

// ============================================================================
// 1. PAYMENT METHOD CONTRACT
// ============================================================================

export type PaymentMethod = 
  | 'cash'           // Physical cash tender (drawer balance, tender & change calculation)
  | 'card'           // POS card terminal (electronic settlement)
  | 'bank'           // Bank transfer / wire transfer
  | 'mobile_money'   // Mobile wallet (EVC Plus, ZAAD, Sahal, etc.)
  | 'credit'         // Customer credit account (Accounts Receivable)
  | 'unpaid'         // Explicit unpaid / on-hold order (Receivable / Pending collection)
  | 'cod';            // Cash on Delivery (driver collection upon delivery)

export const CANONICAL_PAYMENT_METHODS: readonly PaymentMethod[] = [
  'cash',
  'card',
  'bank',
  'mobile_money',
  'credit',
  'unpaid',
  'cod'
] as const;

// ============================================================================
// 2. PAYMENT STATUS CONTRACT
// ============================================================================

export type PaymentStatus = 
  | 'pending'             // Awaiting payment / uncollected
  | 'paid'                // Collected in full and settled
  | 'partially_paid'      // Partial amount collected
  | 'failed'              // Payment collection attempt failed
  | 'refunded'            // Full amount returned to customer
  | 'partially_refunded'  // Partial amount returned
  | 'voided'              // Transaction voided before settlement
  | 'unpaid';             // Unpaid status alias for credit/on-account

export const CANONICAL_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'pending',
  'paid',
  'partially_paid',
  'failed',
  'refunded',
  'partially_refunded',
  'voided',
  'unpaid'
] as const;

// ============================================================================
// 3. ORDER TYPE & ORDER LIFECYCLE CONTRACT
// ============================================================================

export type OrderType = 
  | 'dine_in'
  | 'takeaway'
  | 'delivery'
  | 'online'
  | 'reservation';

export type OrderStatus = 
  | 'new'
  | 'confirmed'
  | 'in_preparation'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'held'
  | 'pending'
  | 'preparing'   // Legacy display compatibility
  | 'ready'       // Legacy display compatibility
  | 'received';   // Legacy display compatibility

export const CANONICAL_ORDER_STATUSES: readonly OrderStatus[] = [
  'new',
  'confirmed',
  'in_preparation',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled',
  'held',
  'pending'
] as const;

// ============================================================================
// 4. KITCHEN PREPARATION LIFECYCLE CONTRACT (DECOUPLED FROM ORDER STATUS)
// ============================================================================

export type KitchenPrepStatus = 
  | 'new'               // Ticket received in kitchen
  | 'accepted'          // Chef acknowledged ticket
  | 'cooking'           // Active preparation on station
  | 'ready_for_pickup'  // Preparation finished, ready at the pass
  | 'completed'         // Handed over to waiter or delivery driver
  | 'cancelled';        // Ticket cancelled by kitchen or manager

export type KitchenStationType = 
  | 'grill'
  | 'pizza'
  | 'drinks'
  | 'dessert'
  | 'packing';

// ============================================================================
// 5. DELIVERY & DRIVER LIFECYCLE CONTRACT (DECOUPLED)
// ============================================================================

export type DeliveryStatus = 
  | 'unassigned'        // Delivery order created, waiting for driver assignment
  | 'assigned'          // Driver assigned
  | 'accepted'          // Driver accepted delivery
  | 'pending'           // Legacy/pending delivery state
  | 'picked_up'         // Driver collected order from restaurant
  | 'on_the_way'        // In transit to customer destination
  | 'in_transit'        // In transit alias
  | 'arrived'           // Driver arrived at customer location
  | 'delivered'         // Successfully delivered to customer
  | 'failed'            // Customer not reachable / wrong address
  | 'returned'          // Package returned to restaurant
  | 'cancelled';        // Delivery cancelled

export type DriverStatus =
  | 'active'
  | 'inactive'
  | 'on_break'
  | 'off_duty'
  | 'available'
  | 'busy'
  | 'on_delivery'
  | 'in_transit'
  | 'offline';

// ============================================================================
// 6. INVENTORY ITEM TYPE & MOVEMENT TYPE CONTRACT
// ============================================================================

export type InventoryItemType = 
  | 'product'           // Finished menu item / sellable goods
  | 'ingredient'        // Raw material / recipe ingredient
  | 'inventory';        // General trackable stock asset

export type InventoryMovementType = 
  | 'purchase_receive'  // Stock increase from approved Purchase Order
  | 'sale'              // Stock deduction from POS sale
  | 'order_deduction'   // Ingredient deduction from order fulfillment
  | 'order_restoration' // Ingredient return from order cancellation/refund
  | 'refund'            // Stock return from customer refund
  | 'cancel'            // Stock restoration from order cancellation
  | 'waste'             // Stock write-off due to kitchen waste / spoilage
  | 'spoilage'          // Stock write-off due to expiration / rot
  | 'adjustment'        // Manual stock count reconciliation
  | 'transfer'          // Inter-branch stock movement
  | 'return'            // Stock return to vendor
  | 'count'             // Periodic stock audit
  | 'expired'           // Expired stock removal
  | 'stock_in'          // Generic stock increase alias
  | 'stock_out'         // Generic stock deduction alias
  | 'in'                // Legacy inward alias
  | 'out';              // Legacy outward alias

// ============================================================================
// 7. HRM ATTENDANCE CONTRACT
// ============================================================================

export type AttendanceStatus = 
  | 'present'
  | 'late'
  | 'absent'
  | 'on_leave'
  | 'half_day';

// ============================================================================
// 8. PURCHASING & SUPPLIER CONTRACT
// ============================================================================

export type PurchaseOrderStatus = 
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'partially_received'
  | 'received'
  | 'cancelled';

// ============================================================================
// 9. REFUND & FINANCIALS CONTRACT
// ============================================================================

export type RefundStatus = 
  | 'pending'
  | 'approved'
  | 'completed'
  | 'rejected';

export type ReceivableStatus = 
  | 'outstanding'
  | 'partially_paid'
  | 'paid'
  | 'written_off';

export type CashRegisterStatus = 
  | 'Open'
  | 'Closed'
  | 'Suspended';
