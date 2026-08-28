import { Category } from '../../types';

export interface ICategoryRepository {
  fetchCategories(): Promise<Category[]>;
  addCategory(category: Omit<Category, 'id'>): Promise<string>;
  updateCategory(id: string, category: Partial<Category>): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  reorderCategories(categories: { id: string; order: number }[]): Promise<void>;
}
