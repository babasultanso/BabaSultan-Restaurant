export type UserRole = 'admin' | 'manager' | 'cashier' | 'chef' | 'driver' | 'accountant';

export interface UserPermissions {
  canAccessPOS: boolean;
  canAccessInventory: boolean;
  canAccessFinancials: boolean;
  canAccessHR: boolean;
  canAccessKitchen: boolean;
  canAccessCEO: boolean;
  canAccessOperations: boolean;
  canManageUsers: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  branchId?: string;
  avatarUrl?: string;
  status?: 'active' | 'inactive' | 'suspended';
  createdAt: string;
}

export const ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  admin: {
    canAccessPOS: true,
    canAccessInventory: true,
    canAccessFinancials: true,
    canAccessHR: true,
    canAccessKitchen: true,
    canAccessCEO: true,
    canAccessOperations: true,
    canManageUsers: true
  },
  manager: {
    canAccessPOS: true,
    canAccessInventory: true,
    canAccessFinancials: true,
    canAccessHR: true,
    canAccessKitchen: true,
    canAccessCEO: false,
    canAccessOperations: true,
    canManageUsers: false
  },
  cashier: {
    canAccessPOS: true,
    canAccessInventory: false,
    canAccessFinancials: false,
    canAccessHR: false,
    canAccessKitchen: false,
    canAccessCEO: false,
    canAccessOperations: false,
    canManageUsers: false
  },
  chef: {
    canAccessPOS: false,
    canAccessInventory: true,
    canAccessFinancials: false,
    canAccessHR: false,
    canAccessKitchen: true,
    canAccessCEO: false,
    canAccessOperations: true,
    canManageUsers: false
  },
  driver: {
    canAccessPOS: false,
    canAccessInventory: false,
    canAccessFinancials: false,
    canAccessHR: false,
    canAccessKitchen: false,
    canAccessCEO: false,
    canAccessOperations: true,
    canManageUsers: false
  },
  accountant: {
    canAccessPOS: false,
    canAccessInventory: true,
    canAccessFinancials: true,
    canAccessHR: true,
    canAccessKitchen: false,
    canAccessCEO: true,
    canAccessOperations: false,
    canManageUsers: false
  }
};
