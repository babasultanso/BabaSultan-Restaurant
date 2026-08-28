import { Product, Category } from '../../types';

export class ProductService {
  filterAndSearchProducts(
    products: Product[],
    searchTerm: string,
    selectedCategory: string,
    availabilityFilter: string,
    isFeaturedOnly: boolean
  ): Product[] {
    return products.filter((p) => {
      // Category filter
      if (selectedCategory && selectedCategory !== 'all') {
        const matchesCategory = p.categoryId === selectedCategory || p.category === selectedCategory;
        if (!matchesCategory) return false;
      }

      // Availability filter
      if (availabilityFilter && availabilityFilter !== 'all') {
        const status = p.availabilityStatus || 'enabled';
        if (status !== availabilityFilter) return false;
      }

      // Featured filter
      if (isFeaturedOnly && !p.isFeatured) {
        return false;
      }

      // Search filter across multi-lingual names, SKU, Barcode, Description
      if (searchTerm && searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchName = (p.name || '').toLowerCase().includes(term);
        const matchNameEn = (p.nameEn || '').toLowerCase().includes(term);
        const matchNameAr = (p.nameAr || '').toLowerCase().includes(term);
        const matchNameSo = (p.nameSo || '').toLowerCase().includes(term);
        const matchSku = (p.sku || '').toLowerCase().includes(term);
        const matchBarcode = (p.barcode || '').toLowerCase().includes(term);
        const matchDesc = (p.description || '').toLowerCase().includes(term);

        if (!matchName && !matchNameEn && !matchNameAr && !matchNameSo && !matchSku && !matchBarcode && !matchDesc) {
          return false;
        }
      }

      return true;
    });
  }

  getLocalizedName(product: Product, lang: 'en' | 'ar' | 'so'): string {
    if (lang === 'ar' && product.nameAr) return product.nameAr;
    if (lang === 'so' && product.nameSo) return product.nameSo;
    if (lang === 'en' && product.nameEn) return product.nameEn;
    return product.name || product.nameEn || 'Unnamed Dish';
  }

  getLocalizedCategoryName(category: Category, lang: 'en' | 'ar' | 'so'): string {
    if (lang === 'ar' && category.nameAr) return category.nameAr;
    if (lang === 'so' && category.nameSo) return category.nameSo;
    if (lang === 'en' && category.nameEn) return category.nameEn;
    return category.name || category.nameEn || 'Category';
  }

  calculateEffectivePrice(product: Product): { currentPrice: number; hasDiscount: boolean; originalPrice: number } {
    if (product.discountPrice !== undefined && product.discountPrice > 0 && product.discountPrice < product.price) {
      return {
        currentPrice: product.discountPrice,
        hasDiscount: true,
        originalPrice: product.price
      };
    }
    return {
      currentPrice: product.price,
      hasDiscount: false,
      originalPrice: product.price
    };
  }
}

export const productService = new ProductService();
