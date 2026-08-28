import {
  Customer,
  MembershipLevel,
  CustomerCoupon,
  NotificationChannel
} from '../entities/customer';
import { getMogadishuDateString } from '../../lib/dateUtils';

export class CustomerService {
  /**
   * Determine membership tier level based on lifetime loyalty points
   */
  static determineMembershipLevel(lifetimePoints: number): {
    level: MembershipLevel;
    nextThreshold: number;
    colorClass: string;
  } {
    if (lifetimePoints >= 3000) {
      return { level: 'VIP', nextThreshold: 5000, colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    } else if (lifetimePoints >= 1200) {
      return { level: 'Platinum', nextThreshold: 3000, colorClass: 'text-purple-400 bg-purple-500/10 border-purple-500/30' };
    } else if (lifetimePoints >= 500) {
      return { level: 'Gold', nextThreshold: 1200, colorClass: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' };
    } else if (lifetimePoints >= 200) {
      return { level: 'Silver', nextThreshold: 500, colorClass: 'text-slate-300 bg-slate-500/10 border-slate-500/30' };
    } else {
      return { level: 'Bronze', nextThreshold: 200, colorClass: 'text-amber-700 bg-amber-900/10 border-amber-800/30' };
    }
  }

  /**
   * Calculate loyalty points earned for an order amount
   * Rule: $1 = 1 point, bonus 1.5x for Gold, 2x for Platinum, 2.5x for VIP
   */
  static calculatePointsForOrder(amount: number, level: MembershipLevel = 'Bronze'): number {
    let multiplier = 1;
    if (level === 'Silver') multiplier = 1.2;
    if (level === 'Gold') multiplier = 1.5;
    if (level === 'Platinum') multiplier = 2.0;
    if (level === 'VIP') multiplier = 2.5;

    return Math.floor(amount * multiplier);
  }

  /**
   * Validate coupon code against minimum order amount, customer targeting, and expiry
   */
  static validateCouponCode(
    coupon: CustomerCoupon,
    customerId?: string,
    orderAmount: number = 0,
    customerLevel: MembershipLevel = 'Bronze'
  ): { valid: boolean; discountAmount: number; reason?: string } {
    if (!coupon.isActive) {
      return { valid: false, discountAmount: 0, reason: 'Coupon code is inactive or disabled' };
    }

    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return { valid: false, discountAmount: 0, reason: 'Coupon usage limit has been reached' };
    }

    const todayIso = getMogadishuDateString();
    if (coupon.expiryDate && coupon.expiryDate < todayIso) {
      return { valid: false, discountAmount: 0, reason: 'Coupon code has expired' };
    }

    if (orderAmount < coupon.minOrderAmount) {
      return {
        valid: false,
        discountAmount: 0,
        reason: `Minimum order amount of $${coupon.minOrderAmount.toFixed(2)} required for this coupon`
      };
    }

    if (coupon.targetCustomerId && customerId && coupon.targetCustomerId !== customerId) {
      return { valid: false, discountAmount: 0, reason: 'This offer is personalized for another customer' };
    }

    if (coupon.targetLevel && coupon.targetLevel !== customerLevel) {
      return { valid: false, discountAmount: 0, reason: `Exclusive to ${coupon.targetLevel} tier members` };
    }

    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = (orderAmount * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
        discount = coupon.maxDiscountAmount;
      }
    } else {
      discount = coupon.discountValue;
    }

    return { valid: true, discountAmount: Math.min(discount, orderAmount) };
  }

  /**
   * Dispatcher for communication channels (Email, SMS, Push, WhatsApp)
   */
  static dispatchChannelNotification(
    channel: NotificationChannel,
    contact: string,
    message: string
  ): { status: 'sent' | 'failed'; details: string } {
    if (!contact || contact.trim().length === 0) {
      return { status: 'failed', details: 'Missing customer contact info' };
    }

    return {
      status: 'failed',
      details: `Provider not configured. Communication channel [${channel.toUpperCase()}] gateway is not configured.`
    };
  }
}
