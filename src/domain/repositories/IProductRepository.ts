import { Product, ProductOption } from '../../types';

export interface IProductRepository {
  fetchProducts(): Promise<Product[]>;
  getProductById(id: string): Promise<Product | null>;
  addProduct(product: Omit<Product, 'id'>): Promise<string>;
  updateProduct(id: string, product: Partial<Product>): Promise<void>;
  deleteProduct(id: string): Promise<void>;
  toggleAvailability(id: string, status: 'enabled' | 'disabled' | 'out_of_stock'): Promise<void>;
  saveProductOptions(productId: string, options: ProductOption[]): Promise<void>;
  deductIngredientsStock(productId: string, quantitySold: number, orderId?: string): Promise<void>;
}
