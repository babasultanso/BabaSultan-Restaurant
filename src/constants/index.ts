export type UserRole =
  | 'Owner'
  | 'Admin'
  | 'Manager'
  | 'Accountant'
  | 'Cashier'
  | 'Kitchen'
  | 'Waiter'
  | 'Delivery Driver';

export const USER_ROLES: Record<string, UserRole> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  ACCOUNTANT: 'Accountant',
  CASHIER: 'Cashier',
  KITCHEN: 'Kitchen',
  WAITER: 'Waiter',
  DRIVER: 'Delivery Driver'
};

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  'Owner': 100,
  'Admin': 90,
  'Manager': 80,
  'Accountant': 70,
  'Cashier': 50,
  'Kitchen': 50,
  'Waiter': 40,
  'Delivery Driver': 30
};

export interface RolePermission {
  canAccessAdminPanel: boolean;
  canAccessPOS: boolean;
  canAccessKitchen: boolean;
  canAccessInventory: boolean;
  canAccessFinancials: boolean;
  canAccessStaff: boolean;
  canAccessReports: boolean;
  canAccessAIAdvisor: boolean;
  canManageBranchSettings: boolean;
  canManageUsers: boolean;
  canManageProducts: boolean;
  canViewProducts: boolean;
  canAccessCustomers: boolean;
  canManageCustomers: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermission> = {
  'Owner': {
    canAccessAdminPanel: true,
    canAccessPOS: true,
    canAccessKitchen: true,
    canAccessInventory: true,
    canAccessFinancials: true,
    canAccessStaff: true,
    canAccessReports: true,
    canAccessAIAdvisor: true,
    canManageBranchSettings: true,
    canManageUsers: true,
    canManageProducts: true,
    canViewProducts: true,
    canAccessCustomers: true,
    canManageCustomers: true
  },
  'Admin': {
    canAccessAdminPanel: true,
    canAccessPOS: true,
    canAccessKitchen: true,
    canAccessInventory: true,
    canAccessFinancials: true,
    canAccessStaff: true,
    canAccessReports: true,
    canAccessAIAdvisor: true,
    canManageBranchSettings: true,
    canManageUsers: true,
    canManageProducts: true,
    canViewProducts: true,
    canAccessCustomers: true,
    canManageCustomers: true
  },
  'Manager': {
    canAccessAdminPanel: true,
    canAccessPOS: true,
    canAccessKitchen: true,
    canAccessInventory: true,
    canAccessFinancials: true,
    canAccessStaff: true,
    canAccessReports: true,
    canAccessAIAdvisor: true,
    canManageBranchSettings: false,
    canManageUsers: false,
    canManageProducts: true,
    canViewProducts: true,
    canAccessCustomers: true,
    canManageCustomers: true
  },
  'Accountant': {
    canAccessAdminPanel: false,
    canAccessPOS: false,
    canAccessKitchen: false,
    canAccessInventory: true,
    canAccessFinancials: true,
    canAccessStaff: true,
    canAccessReports: true,
    canAccessAIAdvisor: true,
    canManageBranchSettings: false,
    canManageUsers: false,
    canManageProducts: false,
    canViewProducts: true,
    canAccessCustomers: true,
    canManageCustomers: false
  },
  'Cashier': {
    canAccessAdminPanel: false,
    canAccessPOS: true,
    canAccessKitchen: false,
    canAccessInventory: false,
    canAccessFinancials: false,
    canAccessStaff: false,
    canAccessReports: false,
    canAccessAIAdvisor: false,
    canManageBranchSettings: false,
    canManageUsers: false,
    canManageProducts: false,
    canViewProducts: true,
    canAccessCustomers: true,
    canManageCustomers: true
  },
  'Kitchen': {
    canAccessAdminPanel: false,
    canAccessPOS: false,
    canAccessKitchen: true,
    canAccessInventory: true,
    canAccessFinancials: false,
    canAccessStaff: false,
    canAccessReports: false,
    canAccessAIAdvisor: false,
    canManageBranchSettings: false,
    canManageUsers: false,
    canManageProducts: false,
    canViewProducts: true,
    canAccessCustomers: false,
    canManageCustomers: false
  },
  'Waiter': {
    canAccessAdminPanel: false,
    canAccessPOS: true,
    canAccessKitchen: false,
    canAccessInventory: false,
    canAccessFinancials: false,
    canAccessStaff: false,
    canAccessReports: false,
    canAccessAIAdvisor: false,
    canManageBranchSettings: false,
    canManageUsers: false,
    canManageProducts: false,
    canViewProducts: true,
    canAccessCustomers: true,
    canManageCustomers: false
  },
  'Delivery Driver': {
    canAccessAdminPanel: false,
    canAccessPOS: false,
    canAccessKitchen: false,
    canAccessInventory: false,
    canAccessFinancials: false,
    canAccessStaff: false,
    canAccessReports: false,
    canAccessAIAdvisor: false,
    canManageBranchSettings: false,
    canManageUsers: false,
    canManageProducts: false,
    canViewProducts: true,
    canAccessCustomers: true,
    canManageCustomers: false
  }
};

export const LANGUAGES = [
  { code: 'en', name: 'English', dir: 'ltr', flag: '🇬🇧' },
  { code: 'ar', name: 'العربية', dir: 'rtl', flag: '🇸🇦' },
  { code: 'so', name: 'Soomaali', dir: 'ltr', flag: '🇸🇴' }
] as const;

export type SupportedLanguage = 'en' | 'ar' | 'so';

export const SYSTEM_CONFIG = {
  APP_NAME: 'Commercial Restaurant ERP System',
  VERSION: '1.0.0-PROD',
  CURRENCY: 'USD',
  CURRENCY_SYMBOL: '$'
};
