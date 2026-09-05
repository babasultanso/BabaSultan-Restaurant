import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  where,
  addDoc
} from 'firebase/firestore';
import { db, auth, COLLECTIONS, rechargeWalletFirestore, deductWalletFirestore, refundToWalletFirestore, getEffectiveBranchId } from '../../lib/firebase';
import { getApiUrl } from '../../lib/apiConfig';
import { ICustomerRepository } from '../../domain/repositories/ICustomerRepository';
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
} from '../../domain/entities/customer';
import { CustomerService } from '../../domain/services/customerService';

export class CustomerRepositoryImpl implements ICustomerRepository {
  // ==========================================
  // CUSTOMER CRUD
  // ==========================================

  async fetchCustomers(): Promise<Customer[]> {
    try {
      const branchId = getEffectiveBranchId();
      const q = query(collection(db, COLLECTIONS.CUSTOMERS), where('branchId', '==', branchId), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list = snap.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          fullName: data.fullName || data.name || 'Unnamed Customer',
          name: data.name || data.fullName || 'Unnamed Customer',
          phone: data.phone || '',
          email: data.email || '',
          gender: data.gender || 'unspecified',
          dateOfBirth: data.dateOfBirth || '',
          profilePhoto: data.profilePhoto || '',
          preferredLanguage: data.preferredLanguage || 'so',
          address: data.address || '',
          city: data.city || '',
          notes: data.notes || '',
          registrationDate: data.registrationDate || data.createdAt || new Date().toISOString(),
          createdAt: data.createdAt || new Date().toISOString(),
          lastOrderDate: data.lastOrderDate || '',
          status: data.status || 'active',
          membershipLevel: data.membershipLevel || 'Bronze',
          totalOrders: data.totalOrders || 0,
          totalSpending: data.totalSpending || data.totalSpent || 0,
          totalSpent: data.totalSpent || data.totalSpending || 0,
          averageOrderValue: data.averageOrderValue || 0,
          favoriteProducts: data.favoriteProducts || [],
          cancelledOrders: data.cancelledOrders || 0,
          refundHistoryCount: data.refundHistoryCount || 0,
          orderFrequencyDays: Number.isFinite(Number(data.orderFrequencyDays)) ? Number(data.orderFrequencyDays) : 0
        } as Customer;
      });
      return list;
    } catch (error: any) {
      console.warn('Note fetching customers from Firestore:', error?.message || error);
      return [];
    }
  }

  async addCustomer(customerData: Omit<Customer, 'id'>): Promise<Customer> {
    const newRef = doc(collection(db, COLLECTIONS.CUSTOMERS));
    const now = new Date().toISOString();
    const effectiveBranchId = getEffectiveBranchId(customerData.branchId || (customerData as any).branch);
    const fullCustomer: Customer = {
      ...customerData,
      branchId: effectiveBranchId,
      id: newRef.id,
      fullName: customerData.fullName || customerData.name || 'Unnamed Customer',
      name: customerData.name || customerData.fullName || 'Unnamed Customer',
      registrationDate: customerData.registrationDate || now,
      createdAt: customerData.createdAt || now,
      status: customerData.status || 'active',
      membershipLevel: customerData.membershipLevel || 'Bronze',
      totalOrders: customerData.totalOrders || 0,
      totalSpending: customerData.totalSpending || 0,
      totalSpent: customerData.totalSpent || 0,
      averageOrderValue: customerData.averageOrderValue || 0,
      cancelledOrders: 0,
      refundHistoryCount: 0
    };

    await setDoc(newRef, fullCustomer);
    return fullCustomer;
  }

  async updateCustomer(id: string, data: Partial<Customer>): Promise<void> {
    const custRef = doc(db, COLLECTIONS.CUSTOMERS, id);
    await updateDoc(custRef, {
      ...data,
      updatedAt: new Date().toISOString()
    });
  }

  async deleteCustomer(id: string): Promise<void> {
    const custRef = doc(db, COLLECTIONS.CUSTOMERS, id);
    await updateDoc(custRef, {
      status: 'archived',
      isDeleted: true,
      updatedAt: new Date().toISOString()
    });
  }

  // ==========================================
  // WALLET OPERATIONS
  // ==========================================

  async fetchCustomerWallets(): Promise<CustomerWallet[]> {
    try {
      const branchId = getEffectiveBranchId();
      const q = branchId === 'all'
        ? collection(db, COLLECTIONS.CUSTOMER_WALLETS)
        : query(collection(db, COLLECTIONS.CUSTOMER_WALLETS), where('branchId', '==', branchId));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerWallet));
      return list;
    } catch (error: any) {
      console.warn('Note fetching customer wallets from Firestore:', error?.message || error);
      return [];
    }
  }

  async fetchCustomerWallet(customerId: string): Promise<CustomerWallet | null> {
    try {
      const branchId = getEffectiveBranchId();
      const q = branchId === 'all'
        ? query(collection(db, COLLECTIONS.CUSTOMER_WALLETS), where('customerId', '==', customerId))
        : query(collection(db, COLLECTIONS.CUSTOMER_WALLETS), where('customerId', '==', customerId), where('branchId', '==', branchId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const matchingDoc = snap.docs.find(d => d.data().customerId === customerId);
        if (matchingDoc) {
          return { id: matchingDoc.id, ...matchingDoc.data() } as CustomerWallet;
        }
      }

      // Return default virtual wallet structure without direct client setDoc
      const now = new Date().toISOString();
      const defaultWallet: CustomerWallet = {
        id: `wall_${customerId}`,
        customerId,
        customerName: 'Customer #' + customerId.substring(0, 5),
        balance: 0,
        currency: 'USD',
        createdAt: now,
        updatedAt: now
      };
      return defaultWallet;
    } catch (error: any) {
      console.warn('Failed to fetch customer wallet for ID:', customerId, error?.message || error);
      return null;
    }
  }

  async rechargeWallet(
    customerId: string,
    amount: number,
    paymentMethod: WalletPaymentMethod,
    referenceNumber?: string,
    notes?: string,
    createdBy?: string
  ): Promise<WalletTransaction> {
    const res = await rechargeWalletFirestore({
      customerId,
      amount,
      paymentMethod,
      notes: notes || 'Wallet recharge balance addition'
    });

    return {
      id: res.transactionId,
      walletId: res.walletId,
      customerId,
      customerName: '',
      type: 'recharge',
      amount,
      balanceAfter: res.newBalance,
      paymentMethod,
      referenceNumber: referenceNumber || res.transactionId,
      notes: notes || 'Wallet recharge balance addition',
      createdBy: createdBy || '',
      createdAt: new Date().toISOString()
    };
  }

  async processWalletPayment(
    customerId: string,
    amount: number,
    orderId: string,
    notes?: string,
    createdBy?: string
  ): Promise<WalletTransaction> {
    const res = await deductWalletFirestore({
      customerId,
      amount,
      orderId,
      notes: notes || `Order payment using wallet funds`
    });

    return {
      id: res.transactionId,
      walletId: res.walletId,
      customerId,
      customerName: '',
      type: 'payment',
      amount: -amount,
      balanceAfter: res.newBalance,
      orderId,
      notes: notes || `Order payment using wallet funds`,
      createdBy: createdBy || 'POS System',
      createdAt: new Date().toISOString()
    };
  }

  async refundToWallet(
    customerId: string,
    amount: number,
    orderId: string,
    reason?: string,
    createdBy?: string
  ): Promise<WalletTransaction> {
    const res = await refundToWalletFirestore({
      customerId,
      amount,
      orderId,
      reason: reason || 'Order refund credited to customer wallet'
    });

    return {
      id: res.transactionId,
      walletId: res.walletId,
      customerId,
      customerName: '',
      type: 'refund',
      amount,
      balanceAfter: res.newBalance,
      orderId,
      notes: reason || 'Order refund credited to customer wallet',
      createdBy: createdBy || 'Manager',
      createdAt: new Date().toISOString()
    };
  }

  async fetchWalletTransactions(customerId?: string): Promise<WalletTransaction[]> {
    try {
      let q = query(collection(db, COLLECTIONS.WALLET_TRANSACTIONS), orderBy('createdAt', 'desc'));
      if (customerId) {
        q = query(collection(db, COLLECTIONS.WALLET_TRANSACTIONS), where('customerId', '==', customerId), orderBy('createdAt', 'desc'));
      }
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as WalletTransaction));
      return list;
    } catch (error: any) {
      console.warn('Note fetching wallet transactions from Firestore:', error?.message || error);
      return [];
    }
  }

  // ==========================================
  // LOYALTY POINTS & REWARDS
  // ==========================================

  async fetchCustomerPointsList(): Promise<CustomerPoints[]> {
    try {
      const branchId = getEffectiveBranchId();
      const q = branchId === 'all'
        ? collection(db, COLLECTIONS.CUSTOMER_POINTS)
        : query(collection(db, COLLECTIONS.CUSTOMER_POINTS), where('branchId', '==', branchId));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerPoints));
      return list;
    } catch (error: any) {
      console.warn('Note fetching customer points from Firestore:', error?.message || error);
      return [];
    }
  }

  async fetchCustomerPoints(customerId: string): Promise<CustomerPoints | null> {
    try {
      const branchId = getEffectiveBranchId();
      const q = branchId === 'all'
        ? query(collection(db, COLLECTIONS.CUSTOMER_POINTS), where('customerId', '==', customerId))
        : query(collection(db, COLLECTIONS.CUSTOMER_POINTS), where('customerId', '==', customerId), where('branchId', '==', branchId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const matchingDoc = snap.docs.find(d => d.data().customerId === customerId);
        if (matchingDoc) {
          return { id: matchingDoc.id, ...matchingDoc.data() } as CustomerPoints;
        }
      }
      return null;
    } catch (error: any) {
      console.warn('Note fetching customer points for ID:', customerId, error?.message || error);
      return null;
    }
  }

  async addLoyaltyPoints(
    customerId: string,
    points: number,
    orderId?: string,
    description?: string
  ): Promise<void> {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const idempotencyKey = `loyalty-add:${customerId}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(getApiUrl('/api/crm/points/add'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customerId,
        points,
        orderId,
        description,
        reason: description || 'Manual loyalty point award',
        idempotencyKey
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to add loyalty points (${res.status})`);
    }
  }

  async fetchRewards(): Promise<CustomerReward[]> {
    try {
      const branchId = getEffectiveBranchId();
      const q = branchId === 'all'
        ? query(collection(db, COLLECTIONS.CUSTOMER_REWARDS), orderBy('pointsRequired', 'asc'))
        : query(collection(db, COLLECTIONS.CUSTOMER_REWARDS), where('branchId', 'in', [branchId, 'all']), orderBy('pointsRequired', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerReward));
    } catch (error: any) {
      console.warn('Note fetching customer rewards from Firestore:', error?.message || error);
      return [];
    }
  }

  async createReward(data: Omit<CustomerReward, 'id' | 'createdAt' | 'currentRedemptions'>): Promise<CustomerReward> {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const idempotencyKey = globalThis.crypto?.randomUUID?.() || `reward-create:${Date.now()}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(getApiUrl('/api/crm/rewards'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...data, idempotencyKey })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to create reward (${res.status})`);
    }

    return await res.json();
  }

  async updateReward(id: string, data: Partial<CustomerReward>): Promise<void> {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const idempotencyKey = globalThis.crypto?.randomUUID?.() || `reward-update:${id}:${Date.now()}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(getApiUrl(`/api/crm/rewards/${id}/update`), {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...data, idempotencyKey })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to update reward (${res.status})`);
    }
  }

  async redeemPointsForReward(customerId: string, rewardId: string): Promise<ClaimedReward> {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const idempotencyKey = `loyalty-redeem:${customerId}:${rewardId}:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(getApiUrl('/api/crm/points/redeem'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customerId,
        rewardId,
        idempotencyKey
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to redeem points for reward (${res.status})`);
    }

    return await res.json();
  }

  // ==========================================
  // PROMOTIONS & COUPONS
  // ==========================================

  async fetchCoupons(): Promise<CustomerCoupon[]> {
    try {
      const branchId = getEffectiveBranchId();
      const q = branchId === 'all'
        ? query(collection(db, COLLECTIONS.CUSTOMER_COUPONS), orderBy('createdAt', 'desc'))
        : query(collection(db, COLLECTIONS.CUSTOMER_COUPONS), where('branchId', 'in', [branchId, 'all']), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerCoupon));
    } catch (error: any) {
      const message = String(error?.message || error);
      if (/Branch ID is required for this operation/i.test(message)) {
        return [];
      }
      console.error('Failed to fetch customer coupons from Firestore:', error);
      throw error;
    }
  }

  async createCoupon(data: Omit<CustomerCoupon, 'id' | 'createdAt' | 'usageCount'>): Promise<CustomerCoupon> {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const idempotencyKey = globalThis.crypto?.randomUUID?.() || `coupon-create:${Date.now()}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(getApiUrl('/api/crm/coupons'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...data, idempotencyKey })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to create coupon (${res.status})`);
    }

    return await res.json();
  }

  async updateCoupon(id: string, data: Partial<CustomerCoupon>): Promise<void> {
    const token = await auth.currentUser?.getIdToken().catch(() => null);
    const idempotencyKey = globalThis.crypto?.randomUUID?.() || `coupon-update:${id}:${Date.now()}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(getApiUrl(`/api/crm/coupons/${id}/update`), {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...data, idempotencyKey })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to update coupon (${res.status})`);
    }
  }

  async validateCoupon(
    code: string,
    customerId?: string,
    orderAmount: number = 0
  ): Promise<{ valid: boolean; discountAmount: number; coupon?: CustomerCoupon; reason?: string }> {
    try {
      const coupons = await this.fetchCoupons();
      const target = coupons.find(c => (c.code || '').toLowerCase() === (code || '').toLowerCase().trim());
      if (!target) {
        return { valid: false, discountAmount: 0, reason: 'Invalid or unrecognized coupon code' };
      }

      let customerLevel: any = 'Bronze';
      if (customerId) {
        const points = await this.fetchCustomerPoints(customerId);
        if (points) customerLevel = points.membershipLevel;
      }

      const res = CustomerService.validateCouponCode(target, customerId, orderAmount, customerLevel);
      return {
        ...res,
        coupon: target
      };
    } catch (error: any) {
      console.warn('Note validating coupon:', error?.message || error);
      return { valid: false, discountAmount: 0, reason: 'Internal error during coupon validation' };
    }
  }

  // ==========================================
  // NOTIFICATIONS & COMMUNICATIONS
  // ==========================================

  async sendCustomerNotification(data: Omit<CustomerNotification, 'id' | 'createdAt'>): Promise<CustomerNotification> {
    const newRef = doc(collection(db, COLLECTIONS.CUSTOMER_NOTIFICATIONS));
    const now = new Date().toISOString();

    const dispatchResult = CustomerService.dispatchChannelNotification(
      data.channel,
      data.recipient || '',
      data.message
    );

    const notification: CustomerNotification = {
      ...data,
      id: newRef.id,
      status: dispatchResult.status === 'sent' ? 'sent' : 'failed',
      sentAt: dispatchResult.status === 'sent' ? now : undefined,
      createdAt: now
    };

    await setDoc(newRef, notification);
    if (dispatchResult.status === 'failed') {
      throw new Error(dispatchResult.details);
    }
    return notification;
  }

  async fetchNotifications(customerId?: string): Promise<CustomerNotification[]> {
    try {
      let q = query(collection(db, COLLECTIONS.CUSTOMER_NOTIFICATIONS), orderBy('createdAt', 'desc'));
      if (customerId) {
        q = query(collection(db, COLLECTIONS.CUSTOMER_NOTIFICATIONS), where('customerId', '==', customerId), orderBy('createdAt', 'desc'));
      }
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerNotification));
      if (list.length > 0) return list;
    } catch (error: any) {
      console.warn('Note fetching customer notifications from Firestore:', error?.message || error);
    }
    return [];
  }

  // ==========================================
  // CRM ANALYTICS DATA
  // ==========================================

  async getAnalyticsData(): Promise<CustomerAnalyticsData> {
    const customers = await this.fetchCustomers();
    const wallets = await this.fetchCustomerWallets();
    const pointsList = await this.fetchCustomerPointsList();

    const totalCustomers = customers.length;
    const totalSpending = customers.reduce((sum, c) => sum + (c.totalSpending || c.totalSpent || (c as any).orderSummary?.totalSpent || 0), 0);
    const avgSpendingPerCustomer = totalCustomers > 0 ? totalSpending / totalCustomers : 0;
    const totalWalletBalance = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);

    const activeCount = customers.filter(c => c.status === 'active' || c.status === 'vip').length;
    const retentionRate = totalCustomers > 0 ? (activeCount / totalCustomers) * 100 : 0;
    const churnRate = 100 - retentionRate;

    // Top 5 customers by spending
    const topCustomers = [...customers]
      .sort((a, b) => (b.totalSpending || b.totalSpent || (b as any).orderSummary?.totalSpent || 0) - (a.totalSpending || a.totalSpent || (a as any).orderSummary?.totalSpent || 0))
      .slice(0, 5);

    const vipCount = customers.filter(c => c.status === 'vip' || c.membershipLevel === 'VIP').length;
    const blockedCount = customers.filter(c => c.status === 'blocked').length;

    // Real loyalty points aggregation
    const totalLoyaltyPointsIssued = pointsList.reduce((sum, p) => sum + ((p as any).totalEarned || (p as any).points || 0), 0);
    const totalLoyaltyPointsRedeemed = pointsList.reduce((sum, p) => sum + ((p as any).totalRedeemed || 0), 0);

    // New customers this month based on real registration dates
    const currentMonthPrefix = new Date().toISOString().substring(0, 7);
    const newCustomersThisMonth = customers.filter(c => c.createdAt && c.createdAt.startsWith(currentMonthPrefix)).length;

    // Real membership level distribution
    const bronzeCount = customers.filter(c => !c.membershipLevel || c.membershipLevel === 'Bronze').length;
    const silverCount = customers.filter(c => c.membershipLevel === 'Silver').length;
    const goldCount = customers.filter(c => c.membershipLevel === 'Gold').length;
    const platinumCount = customers.filter(c => c.membershipLevel === 'Platinum').length;
    const vipLevelCount = customers.filter(c => c.membershipLevel === 'VIP').length;

    return {
      totalCustomers,
      activeCustomers: activeCount,
      vipCustomers: vipCount,
      blockedCustomers: blockedCount,
      churnedCustomers: Math.max(0, totalCustomers - activeCount),
      newCustomersThisMonth,
      totalWalletBalance,
      totalLoyaltyPointsIssued,
      totalLoyaltyPointsRedeemed,
      averageCustomerLifetimeValue: avgSpendingPerCustomer,
      avgCustomerLifetimeValue: avgSpendingPerCustomer,
      customerRetentionRate: retentionRate,
      retentionRate,
      customerChurnRate: churnRate,
      churnRate,
      topCustomersBySpending: topCustomers,
      topCustomers,
      membershipLevelDistribution: {
        Bronze: bronzeCount,
        Silver: silverCount,
        Gold: goldCount,
        Platinum: platinumCount,
        VIP: vipLevelCount
      },
      customerGrowthTrend: totalCustomers > 0 ? [
        { month: 'Total', newCustomers: newCustomersThisMonth, totalCustomers }
      ] : [],
      spendingCategoryDistribution: totalSpending > 0 ? [
        { categoryName: 'Food & Dining', totalAmount: totalSpending, percentage: 100 }
      ] : []
    };
  }
}
