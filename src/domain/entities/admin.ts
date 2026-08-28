export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  itemCount?: number;
  createdAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  loyaltyPoints: number;
  createdAt: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  location: string;
  managerName: string;
  status: 'active' | 'inactive';
  dailyRevenue: number;
  createdAt: string;
}

export interface Revenue {
  id: string;
  source: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string;
  branchId: string;
  createdAt: string;
}

export interface AISetting {
  id: string;
  model: string;
  temperature: number;
  autoReorderEnabled: boolean;
  smartPricingEnabled: boolean;
  languageMode: 'auto' | 'en' | 'ar' | 'so';
  systemPromptAddon?: string;
  updatedAt: string;
}

export interface UserPermission {
  id: string;
  userId: string;
  userName: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier' | 'chef' | 'accountant';
  permissions: {
    canManageProducts: boolean;
    canManageOrders: boolean;
    canManageStaff: boolean;
    canViewFinancials: boolean;
    canModifyAISettings: boolean;
  };
  updatedAt: string;
}
