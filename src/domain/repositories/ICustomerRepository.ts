import {
  Customer,
  CustomerWallet,
  WalletTransaction,
  WalletPaymentMethod,
  CustomerPoints,
  CustomerReward,
  ClaimedReward,
  CustomerCoupon,
  CustomerNotification,
  CustomerAnalyticsData
} from '../entities/customer';

export interface ICustomerRepository {
  // Customer CRUD
  fetchCustomers(): Promise<Customer[]>;
  addCustomer(data: Omit<Customer, 'id'>): Promise<Customer>;
  updateCustomer(id: string, data: Partial<Customer>): Promise<void>;
  deleteCustomer(id: string): Promise<void>;

  // Customer Wallet Operations
  fetchCustomerWallets(): Promise<CustomerWallet[]>;
  fetchCustomerWallet(customerId: string): Promise<CustomerWallet | null>;
  rechargeWallet(
    customerId: string,
    amount: number,
    paymentMethod: WalletPaymentMethod,
    referenceNumber?: string,
    notes?: string,
    createdBy?: string
  ): Promise<WalletTransaction>;
  processWalletPayment(
    customerId: string,
    amount: number,
    orderId: string,
    notes?: string,
    createdBy?: string
  ): Promise<WalletTransaction>;
  refundToWallet(
    customerId: string,
    amount: number,
    orderId: string,
    reason?: string,
    createdBy?: string
  ): Promise<WalletTransaction>;
  fetchWalletTransactions(customerId?: string): Promise<WalletTransaction[]>;

  // Loyalty Points & Rewards
  fetchCustomerPointsList(): Promise<CustomerPoints[]>;
  fetchCustomerPoints(customerId: string): Promise<CustomerPoints | null>;
  addLoyaltyPoints(
    customerId: string,
    points: number,
    orderId?: string,
    description?: string
  ): Promise<void>;
  fetchRewards(): Promise<CustomerReward[]>;
  createReward(data: Omit<CustomerReward, 'id' | 'createdAt' | 'currentRedemptions'>): Promise<CustomerReward>;
  updateReward(id: string, data: Partial<CustomerReward>): Promise<void>;
  redeemPointsForReward(customerId: string, rewardId: string): Promise<ClaimedReward>;

  // Promotions & Coupons
  fetchCoupons(): Promise<CustomerCoupon[]>;
  createCoupon(data: Omit<CustomerCoupon, 'id' | 'createdAt' | 'usageCount'>): Promise<CustomerCoupon>;
  updateCoupon(id: string, data: Partial<CustomerCoupon>): Promise<void>;
  validateCoupon(
    code: string,
    customerId?: string,
    orderAmount?: number
  ): Promise<{ valid: boolean; discountAmount: number; coupon?: CustomerCoupon; reason?: string }>;

  // Notifications & Communication
  sendCustomerNotification(data: Omit<CustomerNotification, 'id' | 'createdAt'>): Promise<CustomerNotification>;
  fetchNotifications(customerId?: string): Promise<CustomerNotification[]>;

  // Analytics
  getAnalyticsData(): Promise<CustomerAnalyticsData>;
}
