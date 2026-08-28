import { ProductOptionChoice } from '../../types';

export type ProductOptionType = 'size' | 'variant' | 'addon' | 'custom';
export type ProductOptionSelectionType = 'single' | 'multiple';

export interface ProductOptionEntity {
  id: string;
  productId?: string;
  nameEn: string;
  nameAr?: string;
  nameSo?: string;
  type: ProductOptionType;
  selectionType: ProductOptionSelectionType;
  isRequired: boolean;
  choices: ProductOptionChoice[];
}
