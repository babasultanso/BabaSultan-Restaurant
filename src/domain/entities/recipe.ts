export type UnitType = 'mass' | 'volume' | 'count' | 'packaging';

export type InventoryUnit =
  | 'kg'
  | 'g'
  | 'Ton'
  | 'L'
  | 'ml'
  | 'pcs'
  | 'box'
  | 'carton'
  | 'bag'
  | 'bottle'
  | 'can'
  | 'tray'
  | 'pack';

export interface UnitConversion {
  id: string;
  fromUnit: string;
  toUnit: string;
  factor: number; // e.g., 1 kg = 1000 g -> factor = 1000
  ingredientId?: string; // Optional custom conversion for a specific ingredient
  ingredientName?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Ingredient {
  id: string;
  code: string;
  name: string;
  nameEn?: string;
  nameAr?: string;
  nameSo?: string;
  category: string; // e.g. Meat, Dairy, Produce, Bakery, Spices, Liquids, Packaging
  branchId?: string;
  branch?: string;
  purchaseUnit: string; // e.g. 'kg', 'box', 'L', 'carton'
  usageUnit: string; // e.g. 'g', 'pcs', 'ml'
  conversionFactor: number; // 1 purchaseUnit = conversionFactor usageUnits (e.g. 1 Box = 24 pcs, 1 kg = 1000 g)
  currentStockUsageUnit: number; // Current quantity in usage units
  minStockUsageUnit: number; // Reorder alert level in usage units
  purchaseCost: number; // Cost per purchase unit (e.g., $50 per 50kg bag)
  costPerUsageUnit: number; // Calculated: purchaseCost / conversionFactor (e.g., $1 per kg or $0.001 per g)
  supplierId?: string;
  supplierName?: string;
  storageLocation?: string;
  expirationDate?: string;
  batchNumber?: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'expired';
  createdAt: string;
  updatedAt: string;
}

export interface RecipeItem {
  id: string;
  recipeId?: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number; // Quantity required in recipe usage unit (e.g., 150)
  unit: string; // Unit used in recipe (e.g., 'g', 'pcs', 'ml')
  costPerUnit: number; // Cost per usage unit
  totalCost: number; // Calculated: quantity * costPerUnit
  wastePercent?: number; // Prep waste percentage (e.g., 5%)
  notes?: string;
}

export interface Recipe {
  id: string;
  productId: string; // Linked menu product ID
  productName: string;
  productCategory?: string;
  recipeName: string;
  version: number;
  branchId?: string;
  branch?: string;
  items: RecipeItem[];
  yieldQuantity: number; // Portion / Meal yield (default 1)
  totalCost: number; // Sum of ingredient costs
  costPerPortion: number; // totalCost / yieldQuantity
  sellingPrice: number;
  foodCostPercentage: number; // (costPerPortion / sellingPrice) * 100
  grossProfit: number; // sellingPrice - costPerPortion
  grossProfitMargin: number; // (grossProfit / sellingPrice) * 100
  netProfit: number;
  notes?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeVersionHistory {
  id: string;
  recipeId: string;
  productId: string;
  productName: string;
  version: number;
  items: RecipeItem[];
  totalCost: number;
  foodCostPercentage: number;
  sellingPrice: number;
  changedBy: string;
  changeReason?: string;
  createdAt: string;
}

export interface IngredientMovement {
  id: string;
  ingredientId: string;
  ingredientName: string;
  type: 'purchase' | 'order_deduction' | 'order_cancellation' | 'adjustment' | 'waste' | 'stock_count';
  quantity: number; // Amount in usage units (+ for addition, - for deduction)
  unit: string;
  previousStock: number;
  newStock: number;
  cost: number;
  referenceId?: string; // Order #, PO #, Waste ID, Count ID
  reason?: string;
  createdBy: string;
  createdAt: string;
}

export interface StockCountItem {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  expectedQuantity: number;
  actualQuantity: number;
  difference: number; // actual - expected
  costPerUnit: number;
  lossValue: number; // Math.abs(difference) * costPerUnit (if negative)
  notes?: string;
}

export interface StockCount {
  id: string;
  countNumber: string;
  countDate: string;
  branch?: string;
  status: 'draft' | 'completed' | 'adjusted';
  items: StockCountItem[];
  totalExpectedValue: number;
  totalActualValue: number;
  totalDiscrepancyValue: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type WasteReason =
  | 'expired'
  | 'spoiled'
  | 'cooking_loss'
  | 'preparation_waste'
  | 'damage'
  | 'unknown';

export interface WasteRecord {
  id: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
  reason: WasteReason;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface ConsumptionStat {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  totalQuantityUsed: number;
  totalCost: number;
  averageDailyUsage: number;
  averageMonthlyUsage: number;
  movementCount: number;
  movementType: 'fast' | 'slow' | 'moderate';
}

export interface IngredientForecast {
  ingredientId: string;
  ingredientName: string;
  currentStock: number;
  unit: string;
  averageDailyUsage: number;
  daysRemaining: number;
  suggestedReorderQuantity: number;
  expectedConsumptionNext30Days: number;
  reorderStatus: 'urgent' | 'warning' | 'normal' | 'overstocked';
  purchaseRecommendation: string;
}

export interface FoodCostDashboardData {
  totalRecipesCount: number;
  averageFoodCostPercentage: number;
  highestCostRecipe: { name: string; foodCostPercentage: number } | null;
  lowestCostRecipe: { name: string; foodCostPercentage: number } | null;
  totalWasteCost: number;
  totalWastePercentage: number;
  totalInventoryValuation: number;
}
