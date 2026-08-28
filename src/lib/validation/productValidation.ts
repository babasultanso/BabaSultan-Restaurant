import { Product, Category, ProductOption } from '../../types';

export interface ValidationError {
  field: string;
  message: string;
}

export function validateProductForm(data: Partial<Product>): ValidationError[] {
  const errors: ValidationError[] = [];

  const nameEn = data.nameEn || data.name;
  if (!nameEn || nameEn.trim().length === 0) {
    errors.push({ field: 'nameEn', message: 'English product name is required.' });
  }

  if (!data.nameAr || data.nameAr.trim().length === 0) {
    errors.push({ field: 'nameAr', message: 'Arabic product name is required.' });
  }

  if (!data.nameSo || data.nameSo.trim().length === 0) {
    errors.push({ field: 'nameSo', message: 'Somali product name is required.' });
  }

  if (!data.category || data.category.trim().length === 0) {
    errors.push({ field: 'category', message: 'Category selection is required.' });
  }

  if (data.price === undefined || data.price < 0) {
    errors.push({ field: 'price', message: 'Price must be a valid positive number.' });
  }

  if (data.discountPrice !== undefined && data.discountPrice < 0) {
    errors.push({ field: 'discountPrice', message: 'Discount price cannot be negative.' });
  }

  if (data.discountPrice !== undefined && data.price !== undefined && data.discountPrice >= data.price) {
    errors.push({ field: 'discountPrice', message: 'Discount price must be less than regular price.' });
  }

  if (!data.sku || data.sku.trim().length === 0) {
    errors.push({ field: 'sku', message: 'SKU code is required.' });
  }

  if (data.prepTimeMinutes !== undefined && data.prepTimeMinutes < 0) {
    errors.push({ field: 'prepTimeMinutes', message: 'Preparation time cannot be negative.' });
  }

  if (data.calories !== undefined && data.calories < 0) {
    errors.push({ field: 'calories', message: 'Calories cannot be negative.' });
  }

  return errors;
}

export function validateCategoryForm(data: Partial<Category>): ValidationError[] {
  const errors: ValidationError[] = [];

  const nameEn = data.nameEn || data.name;
  if (!nameEn || nameEn.trim().length === 0) {
    errors.push({ field: 'nameEn', message: 'English category name is required.' });
  }

  if (!data.nameAr || data.nameAr.trim().length === 0) {
    errors.push({ field: 'nameAr', message: 'Arabic category name is required.' });
  }

  if (!data.nameSo || data.nameSo.trim().length === 0) {
    errors.push({ field: 'nameSo', message: 'Somali category name is required.' });
  }

  if (data.order === undefined || data.order < 0) {
    errors.push({ field: 'order', message: 'Display order must be a non-negative number.' });
  }

  return errors;
}

export function validateOptionForm(data: Partial<ProductOption>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.nameEn || data.nameEn.trim().length === 0) {
    errors.push({ field: 'nameEn', message: 'Option name is required.' });
  }

  if (!data.choices || data.choices.length === 0) {
    errors.push({ field: 'choices', message: 'At least one choice is required for this option group.' });
  }

  return errors;
}
