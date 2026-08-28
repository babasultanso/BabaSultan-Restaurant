import {
  Recipe,
  RecipeVersionHistory,
  Ingredient,
  IngredientMovement,
  UnitConversion,
  StockCount,
  WasteRecord,
  ConsumptionStat,
  IngredientForecast,
  FoodCostDashboardData
} from '../entities/recipe';

export interface IRecipeRepository {
  // Recipes
  fetchRecipes(branchId?: string): Promise<Recipe[]>;
  subscribeRecipes(callback: (recipes: Recipe[]) => void, branchId?: string): () => void;
  getRecipeById(id: string): Promise<Recipe | null>;
  getRecipeByProductId(productId: string): Promise<Recipe | null>;
  createRecipe(recipeData: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>): Promise<Recipe>;
  updateRecipe(id: string, recipeData: Partial<Recipe>, changeReason?: string, changedBy?: string): Promise<void>;
  deleteRecipe(id: string): Promise<void>;
  fetchRecipeHistory(recipeId: string): Promise<RecipeVersionHistory[]>;

  // Ingredients
  fetchIngredients(branchId?: string): Promise<Ingredient[]>;
  subscribeIngredients(callback: (ingredients: Ingredient[]) => void, branchId?: string): () => void;
  createIngredient(ingredientData: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'>): Promise<Ingredient>;
  updateIngredient(id: string, ingredientData: Partial<Ingredient>): Promise<void>;
  deleteIngredient(id: string): Promise<void>;

  // Movements
  fetchIngredientMovements(ingredientId?: string): Promise<IngredientMovement[]>;
  subscribeIngredientMovements(callback: (movements: IngredientMovement[]) => void): () => void;

  // Automatic Inventory Deduction for Orders
  deductRecipeIngredientsForOrder(
    orderItems: Array<{ productId: string; productName: string; quantity: number }>,
    orderNumber: string,
    createdBy: string
  ): Promise<void>;

  // Unit Conversions
  fetchUnitConversions(): Promise<UnitConversion[]>;
  subscribeUnitConversions(callback: (conversions: UnitConversion[]) => void): () => void;
  createUnitConversion(data: Omit<UnitConversion, 'id' | 'createdAt' | 'updatedAt'>): Promise<UnitConversion>;
  deleteUnitConversion(id: string): Promise<void>;

  // Stock Counting
  fetchStockCounts(): Promise<StockCount[]>;
  createStockCount(data: Omit<StockCount, 'id' | 'createdAt' | 'updatedAt'>): Promise<StockCount>;
  applyStockCountAdjustment(stockCountId: string, user: string): Promise<void>;

  // Waste Management
  fetchWasteRecords(branchId?: string): Promise<WasteRecord[]>;
  subscribeWasteRecords(callback: (records: WasteRecord[]) => void, branchId?: string): () => void;
  recordWaste(data: Omit<WasteRecord, 'id' | 'createdAt'>): Promise<WasteRecord>;

  // Analytics & Forecasting
  getConsumptionAnalytics(): Promise<ConsumptionStat[]>;
  getIngredientForecasts(): Promise<IngredientForecast[]>;
  getFoodCostDashboardData(): Promise<FoodCostDashboardData>;
}
