export type CustomerGender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type CustomerLanguage = 'en' | 'ar' | 'so';
export type CustomerStatus = 'active' | 'inactive' | 'vip' | 'blocked';
export type MembershipLevel = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'VIP';

export interface FavoriteProductSummary {
  productId: string;
  productName: string;
  orderCount: number;
}

export interface CustomerOrderSummary {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  itemsCount: number;
  status: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  fullName?: string;
  name?: string; // Backward compatibility alias
  phone: string;
  email?: string;
  gender?: CustomerGender;
  dateOfBirth?: string;
  profilePhoto?: string;
  preferredLanguage?: CustomerLanguage;
  address?: string;
  city?: string;
  notes?: string;
  registrationDate?: string;
  createdAt?: string; // Backward compatibility alias
  lastOrderDate?: string;
  status?: CustomerStatus;
  membershipLevel?: MembershipLevel;
  
  // Historical analytics metrics
  totalOrders?: number;
  totalSpending?: number;
  totalSpent?: number; // Backward compatibility alias
  averageOrderValue?: number;
  cancelledOrders?: number;
  refundHistoryCount?: number;
  favoriteProducts?: FavoriteProductSummary[];
  recentOrders?: CustomerOrderSummary[];
  orderFrequencyDays?: number;
}

export interface CustomerWallet {
  id: string;
  customerId: string;
  customerName: string;
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export type WalletTransactionType = 'recharge' | 'payment' | 'refund' | 'bonus' | 'adjustment';
export type WalletPaymentMethod = 'cash' | 'card' | 'bank' | 'mobile_money';

export interface WalletTransaction {
  id: string;
  walletId: string;
  customerId: string;
  customerName: string;
  type: WalletTransactionType;
  amount: number;
  balanceBefore?: number;
  balanceAfter: number;
  paymentMethod?: WalletPaymentMethod;
  referenceNumber?: string;
  orderId?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface CustomerPoints {
  id: string;
  customerId: string;
  customerName: string;
  totalPointsEarned?: number;
  currentPointsBalance: number;
  lifetimePoints: number;
  membershipLevel: MembershipLevel;
  nextLevelPointsThreshold: number;
  updatedAt: string;
}

export interface PointsLog {
  id: string;
  customerId: string;
  orderId?: string;
  points: number;
  type: 'earn' | 'redeem' | 'bonus' | 'adjustment';
  description: string;
  createdAt: string;
}

export interface CustomerReward {
  id: string;
  rewardName: string;
  rewardNameAr?: string;
  rewardNameSo?: string;
  description: string;
  pointsRequired: number;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  isActive: boolean;
  maxRedemptions?: number;
  currentRedemptions: number;
  createdAt: string;
}

export interface ClaimedReward {
  id: string;
  customerId: string;
  customerName: string;
  rewardId: string;
  rewardName: string;
  pointsSpent: number;
  couponCode: string;
  voucherCode?: string;
  status: 'active' | 'used' | 'expired';
  redeemedAt: string;
  claimedAt?: string;
  usedAt?: string;
}

export interface CustomerCoupon {
  id: string;
  code: string;
  title: string;
  titleAr?: string;
  titleSo?: string;
  description: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  expiryDate: string;
  isBirthdayOffer?: boolean;
  isSeasonal?: boolean;
  targetCustomerId?: string; // Specific customer target
  targetLevel?: MembershipLevel; // Specific level target
  usageLimit?: number;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
}

export type NotificationChannel = 'email' | 'sms' | 'push' | 'whatsapp';
export type NotificationStatus = 'sent' | 'pending' | 'failed';

export interface CustomerNotification {
  id: string;
  customerId?: string;
  customerName?: string;
  customerContact?: string;
  recipient?: string;
  sentBy?: string;
  channel: NotificationChannel;
  title: string;
  message: string;
  status?: NotificationStatus;
  sentAt?: string;
  createdAt?: string;
}

export interface CustomerAnalyticsData {
  totalCustomers: number;
  activeCustomers: number;
  vipCustomers: number;
  blockedCustomers: number;
  churnedCustomers?: number;
  totalWalletBalance: number;
  totalLoyaltyPointsIssued: number;
  totalLoyaltyPointsRedeemed: number;
  averageCustomerLifetimeValue: number;
  avgCustomerLifetimeValue?: number;
  customerRetentionRate: number; // percentage
  retentionRate?: number;
  customerChurnRate: number; // percentage
  churnRate?: number;
  newCustomersThisMonth?: number;
  topCustomersBySpending: Customer[];
  topCustomers?: Customer[];
  membershipLevelDistribution: Record<MembershipLevel, number>;
  customerGrowthTrend: { month: string; newCustomers: number; totalCustomers: number }[];
  spendingCategoryDistribution: { categoryName: string; totalAmount: number; percentage: number }[];
}
