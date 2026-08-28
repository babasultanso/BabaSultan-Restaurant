import { Category, Customer, Branch, Revenue, AISetting, UserPermission } from '../entities/admin';

export interface IAdminRepository {
  // Categories
  fetchCategories(): Promise<Category[]>;
  createCategory(category: Omit<Category, 'id'>): Promise<Category>;
  deleteCategory(id: string): Promise<void>;

  // Customers
  fetchCustomers(): Promise<Customer[]>;
  createCustomer(customer: Omit<Customer, 'id'>): Promise<Customer>;

  // Branches
  fetchBranches(): Promise<Branch[]>;
  createBranch(branch: Omit<Branch, 'id'>): Promise<Branch>;
  toggleBranchStatus(id: string, status: 'active' | 'inactive'): Promise<void>;

  // Revenues
  fetchRevenues(): Promise<Revenue[]>;
  recordRevenue(revenue: Omit<Revenue, 'id'>): Promise<Revenue>;

  // AI Settings
  fetchAISettings(): Promise<AISetting>;
  updateAISettings(settings: Partial<AISetting>): Promise<void>;

  // Permissions
  fetchUserPermissions(): Promise<UserPermission[]>;
  updateUserPermission(permissionId: string, role: UserPermission['role'], permissions: UserPermission['permissions']): Promise<void>;
}
