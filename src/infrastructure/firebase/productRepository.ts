import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, COLLECTIONS, addProductFirestore, updateProductFirestore, deleteProductFirestore, toggleProductAvailabilityFirestore, deductProductIngredientsStockFirestore } from '../../lib/firebase';
import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { Product, ProductOption } from '../../types';

export class ProductRepository implements IProductRepository {
  async fetchProducts(): Promise<Product[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.PRODUCTS));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
  }

  async getProductById(id: string): Promise<Product | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.PRODUCTS, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Product;
  }

  async addProduct(product: Omit<Product, 'id'>): Promise<string> {
    return await addProductFirestore(product);
  }

  async updateProduct(id: string, product: Partial<Product>): Promise<void> {
    await updateProductFirestore(id, product);
  }

  async deleteProduct(id: string): Promise<void> {
    await deleteProductFirestore(id);
  }

  async toggleAvailability(id: string, status: 'enabled' | 'disabled' | 'out_of_stock'): Promise<void> {
    await toggleProductAvailabilityFirestore(id, status);
  }

  async saveProductOptions(productId: string, options: ProductOption[]): Promise<void> {
    await updateProductFirestore(productId, { options });
  }

  async deductIngredientsStock(productId: string, quantitySold: number, orderId?: string): Promise<void> {
    await deductProductIngredientsStockFirestore(productId, quantitySold, orderId);
  }
}

export const productRepository = new ProductRepository();
