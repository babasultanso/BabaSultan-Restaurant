import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, COLLECTIONS, getEffectiveBranchId, addCategoryFirestore, updateCategoryFirestore, deleteCategoryFirestore, reorderCategoriesFirestore } from '../../lib/firebase';
import { ICategoryRepository } from '../../domain/repositories/ICategoryRepository';
import { Category } from '../../types';

export class CategoryRepository implements ICategoryRepository {
  async fetchCategories(): Promise<Category[]> {
    const branchId = getEffectiveBranchId();
    const snap = await getDocs(query(collection(db, COLLECTIONS.CATEGORIES), where('branchId', '==', branchId)));
    const categories = snap.docs.map(d => ({ id: d.id, ...d.data() } as Category));
    categories.sort((a, b) => (a.order || 0) - (b.order || 0));
    return categories;
  }

  async addCategory(category: Omit<Category, 'id'>): Promise<string> {
    return await addCategoryFirestore(category);
  }

  async updateCategory(id: string, category: Partial<Category>): Promise<void> {
    await updateCategoryFirestore(id, category);
  }

  async deleteCategory(id: string): Promise<void> {
    await deleteCategoryFirestore(id);
  }

  async reorderCategories(categories: { id: string; order: number }[]): Promise<void> {
    await reorderCategoriesFirestore(categories);
  }
}

export const categoryRepository = new CategoryRepository();
