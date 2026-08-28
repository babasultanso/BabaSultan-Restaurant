import { RecipeIngredient, ProductOption } from '../../types';

export type ProductAvailabilityStatus = 'enabled' | 'disabled' | 'out_of_stock';

export interface ProductEntity {
  id: string;
  name: string;
  nameEn?: string;
  nameAr?: string;
  nameSo?: string;
  description?: string;
  shortDescription?: string;
  imageUrl?: string;
  images?: string[];
  category: string;
  categoryId?: string;
  branchId?: string;
  branch?: string;
  price: number;
  discountPrice?: number;
  cost: number;
  tax?: number;
  prepTimeMinutes?: number;
  availabilityStatus?: ProductAvailabilityStatus;
  isFeatured?: boolean;
  sku?: string;
  barcode?: string;
  stock: number;
  minStockAlert: number;
  unit: string;
  salesCount: number;
  ingredients?: RecipeIngredient[];
  calories?: number;
  notes?: string;
  options?: ProductOption[];
  createdAt?: string;
  updatedAt?: string;
}
