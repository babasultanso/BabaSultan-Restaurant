export interface CategoryEntity {
  id: string;
  name: string;
  nameEn: string;
  nameAr?: string;
  nameSo?: string;
  description?: string;
  imageUrl?: string;
  order: number;
  isActive: boolean;
  productCount?: number;
  createdAt?: string;
}
